"""Small Flask host for the LakeLoom UI and Databricks Apps identity."""

import os
import ast
import base64
import builtins
import configparser
import hashlib
import io
import json
import re
import secrets
import sqlite3
import sys
import threading
import time
from pathlib import Path
from urllib.error import HTTPError, URLError
from urllib.parse import urlencode, urlsplit, urlunsplit
from urllib.request import Request, urlopen

from flask import Flask, abort, jsonify, redirect, request, send_file, send_from_directory, session as flask_session, url_for
from source_schema import inspect_files, spark_columns


def _find_app_root():
    required_assets = ("index.html", "app.js", "schema.js", "styles.css")
    candidates = []
    if getattr(sys, "frozen", False):
        bundle_root = Path(getattr(sys, "_MEIPASS", Path(sys.executable).resolve().parent))
        executable_root = Path(sys.executable).resolve().parent
        candidates.extend((
            bundle_root,
            bundle_root.parent,
            bundle_root / "Resources",
            bundle_root.parent / "Resources",
            executable_root,
            executable_root.parent / "Resources",
        ))
    candidates.append(Path(__file__).resolve().parent)
    for candidate in candidates:
        if all((candidate / asset).is_file() for asset in required_assets):
            return candidate
    return candidates[-1]


APP_ROOT = _find_app_root()


def _load_local_environment(path):
    """Load a small local .env file without overriding deployment variables."""
    try:
        lines = path.read_text(encoding="utf-8").splitlines()
    except OSError:
        return
    for line in lines:
        clean = line.strip()
        if not clean or clean.startswith("#") or "=" not in clean:
            continue
        key, value = clean.split("=", 1)
        key = key.strip()
        if re.fullmatch(r"[A-Za-z_][A-Za-z0-9_]*", key):
            os.environ.setdefault(key, value.strip().strip("'\""))


_load_local_environment(APP_ROOT / ".env")
app = Flask(__name__, static_folder=None)
app.config["MAX_CONTENT_LENGTH"] = 64 * 1024 * 1024
app.config["SECRET_KEY"] = os.environ.get("LAKELOOM_SECRET_KEY") or secrets.token_hex(32)
app.config["SESSION_COOKIE_HTTPONLY"] = True
app.config["SESSION_COOKIE_SAMESITE"] = "Lax"
app.config["SESSION_COOKIE_SECURE"] = os.environ.get("LAKELOOM_COOKIE_SECURE", "").lower() in {"1", "true", "yes"}

_spark_session = None
_spark_session_lock = threading.Lock()
_databricks_config = None
_databricks_connection = {}
_preview_run_lock = threading.Lock()
_oauth_sessions = {}
_oauth_lock = threading.Lock()
_profile_store_path = Path(
    os.environ.get("LAKELOOM_PROFILE_STORE", str(Path.home() / ".lakeloom" / "profiles.db"))
).expanduser()
_USERNAME_PATTERN = re.compile(r"^[A-Za-z][A-Za-z0-9._-]{2,29}$")
_SAFE_IMPORTS = {
    "json",
    "re",
    "pyspark.sql",
    "pyspark.sql.functions",
    "pyspark.sql.window",
    "pyspark.sql.types",
}
_SAFE_TYPES = {
    "StructType", "StructField", "StringType", "IntegerType", "LongType",
    "DoubleType", "FloatType", "BooleanType", "DateType", "TimestampType",
}
_SAFE_DIRECT_CALLS = {"display", "isinstance", "set", "ValueError", *_SAFE_TYPES}
_SAFE_FUNCTIONS = {
    "abs", "add_months", "array", "array_contains", "array_distinct", "array_except",
    "array_intersect", "array_union", "coalesce", "col", "concat", "concat_ws",
    "current_date", "current_timestamp", "date_add", "date_format", "datediff",
    "dayofmonth", "explode", "explode_outer", "expr", "from_json", "get_json_object",
    "ilike", "initcap", "isnan", "isnull", "isnotnull", "last_day", "left", "length", "lit", "lower",
    "lpad", "ltrim", "map_from_arrays", "map_keys", "map_values", "month",
    "months_between", "next_day", "posexplode", "posexplode_outer", "rank", "regexp_extract",
    "regexp_replace", "replace", "reverse", "right", "round", "row_number", "rpad",
    "size", "sort_array", "split", "struct", "substring", "sum", "to_date", "to_json",
    "translate", "trim", "upper", "when", "year",
}
_SAFE_DIRECT_CALLS |= _SAFE_FUNCTIONS
_SAFE_METHODS = {
    "agg", "alias", "asc", "cast", "contains", "createDataFrame", "desc", "distinct", "drop", "dropDuplicates",
    "dropna", "endswith", "eqNullSafe", "fillna", "filter", "format", "getItem", "groupBy",
    "ilike", "isNotNull", "isNull", "isin", "limit", "like", "load", "lower", "option",
    "orderBy", "over", "partitionBy", "pivot", "printSchema", "read", "rowsBetween", "schema", "select", "sort", "splitlines",
    "startswith", "strip", "table", "toDF", "typeName", "unionByName", "where", "withColumn",
    "withColumnRenamed", "withColumns", "transform", "otherwise", "when",
}
_SAFE_ATTRIBUTES = _SAFE_FUNCTIONS | _SAFE_METHODS | {
    "columns", "currentRow", "dataType", "fields", "loads", "name", "sub", "unboundedPreceding",
}
_BLOCKED_CALLS = {
    "collect", "count", "delete", "execute", "foreach", "history", "merge", "restoreToVersion",
    "save", "saveAsTable", "show", "sql", "toPandas", "vacuum", "write", "writeTo",
}
_RESERVED_NAMES = _SAFE_TYPES | {"spark", "F", "Window", "json", "re", "display", "__builtins__"}
_READ_FORMATS = {"avro", "csv", "delta", "iceberg", "json", "orc", "parquet", "text"}
_READ_OPTIONS = {"header", "inferSchema", "multiline", "versionAsOf"}


def _expression_root_name(node):
    while isinstance(node, (ast.Attribute, ast.Call)):
        if isinstance(node, ast.Attribute):
            node = node.value
        elif isinstance(node.func, ast.Attribute):
            node = node.func.value
        else:
            node = node.func
    return node.id if isinstance(node, ast.Name) else None


class _PreviewCodeValidator(ast.NodeVisitor):
    _allowed_nodes = (
        ast.Module, ast.Import, ast.ImportFrom, ast.Assign, ast.AugAssign, ast.Expr, ast.For, ast.While,
        ast.If, ast.Raise, ast.Call, ast.Name, ast.Attribute, ast.Constant, ast.List, ast.Tuple,
        ast.Dict, ast.Subscript, ast.Slice, ast.BinOp, ast.UnaryOp, ast.BoolOp, ast.Compare,
        ast.keyword, ast.arguments, ast.arg, ast.ListComp, ast.comprehension, ast.Lambda, ast.IfExp, ast.Starred,
        ast.Load, ast.Store, ast.And, ast.Or, ast.Not, ast.Invert, ast.UAdd, ast.USub, ast.Add,
        ast.Sub, ast.Mult, ast.Div, ast.FloorDiv, ast.Mod, ast.BitAnd, ast.BitOr, ast.Eq,
        ast.NotEq, ast.Lt, ast.LtE, ast.Gt, ast.GtE, ast.Is, ast.IsNot, ast.In, ast.NotIn,
    )

    def generic_visit(self, node):
        if not isinstance(node, self._allowed_nodes):
            raise ValueError(f"Preview execution does not allow {type(node).__name__} statements.")
        super().generic_visit(node)

    def visit_Import(self, node):
        for alias in node.names:
            if alias.name not in {"json", "re"} or (alias.asname or "").startswith("__"):
                raise ValueError("Preview execution only allows the generated JSON and regex imports.")

    def visit_ImportFrom(self, node):
        if node.level or node.module not in _SAFE_IMPORTS:
            raise ValueError("Preview execution only allows generated PySpark imports.")
        allowed = {
            "pyspark.sql": {"functions"},
            "pyspark.sql.functions": _SAFE_FUNCTIONS,
            "pyspark.sql.window": {"Window"},
            "pyspark.sql.types": _SAFE_TYPES,
        }.get(node.module, set())
        if any(alias.name not in allowed or (alias.asname or "").startswith("__") for alias in node.names):
            raise ValueError("Preview execution contains an unsupported PySpark import.")

    def visit_Attribute(self, node):
        root_name = _expression_root_name(node)
        dataframe_column_reference = root_name is not None and root_name not in _RESERVED_NAMES
        if node.attr.startswith("_") or (node.attr not in _SAFE_ATTRIBUTES and not dataframe_column_reference):
            raise ValueError(f"Preview execution does not allow the '{node.attr}' attribute.")
        self.generic_visit(node)

    def visit_Name(self, node):
        if node.id.startswith("__"):
            raise ValueError("Preview execution does not allow private runtime names.")
        if isinstance(node.ctx, ast.Store) and node.id in _RESERVED_NAMES:
            raise ValueError(f"Preview code cannot replace the reserved name '{node.id}'.")

    def visit_Call(self, node):
        function = node.func
        if isinstance(function, ast.Name):
            if function.id not in _SAFE_DIRECT_CALLS:
                raise ValueError(f"Preview execution does not allow calling '{function.id}'.")
        elif isinstance(function, ast.Attribute):
            name = function.attr
            receiver = function.value
            is_spark_function = isinstance(receiver, ast.Name) and receiver.id == "F" and name in _SAFE_FUNCTIONS
            is_json_or_regex = isinstance(receiver, ast.Name) and ((receiver.id == "json" and name == "loads") or (receiver.id == "re" and name == "sub"))
            is_allowed_method = name in _SAFE_METHODS and name not in _BLOCKED_CALLS
            root_name = _expression_root_name(receiver)
            is_dataframe_display = name == "display" and not node.args and not node.keywords and root_name is not None and root_name not in _RESERVED_NAMES
            if not (is_spark_function or is_json_or_regex or is_allowed_method or is_dataframe_display):
                raise ValueError(f"Preview execution does not allow calling '{name}'.")
            if is_spark_function and name == "expr":
                if not node.args or not isinstance(node.args[0], ast.Constant) or not isinstance(node.args[0].value, str):
                    raise ValueError("Spark SQL expressions must be plain string literals in preview mode.")
                if re.search(r"\b(reflect|java_method|call_function|call_udf)\s*\(", node.args[0].value, re.IGNORECASE):
                    raise ValueError("JVM reflection and dynamic UDF calls are disabled in preview mode.")
            if name == "format":
                if not node.args or not isinstance(node.args[0], ast.Constant) or node.args[0].value not in _READ_FORMATS:
                    raise ValueError("Preview mode only allows the supported file and table formats.")
            if name == "option":
                if not node.args or not isinstance(node.args[0], ast.Constant) or node.args[0].value not in _READ_OPTIONS:
                    raise ValueError("Preview mode does not allow custom reader options.")
            if name in {"load", "table"} and isinstance(receiver, (ast.Attribute, ast.Call)):
                if not node.args or not isinstance(node.args[0], ast.Constant) or not isinstance(node.args[0].value, str):
                    raise ValueError("Source paths and table names must be entered in the builder fields.")
                if name == "load" and node.args[0].value.lower().startswith(("file:", "jdbc:")):
                    raise ValueError("Local-file and JDBC sources are not available in preview mode.")
        else:
            raise ValueError("Preview execution only allows direct PySpark and DataFrame calls.")
        self.generic_visit(node)

    def visit_While(self, node):
        test = node.test
        safe_loop = (
            isinstance(test, ast.Compare)
            and isinstance(test.left, ast.Name)
            and test.left.id == "_rank_col"
            and len(test.ops) == 1
            and isinstance(test.ops[0], ast.In)
            and len(test.comparators) == 1
            and (
                (isinstance(test.comparators[0], ast.Attribute) and test.comparators[0].attr == "columns")
                or (isinstance(test.comparators[0], ast.Name) and test.comparators[0].id == "_lakeloom_column_names")
            )
            and len(node.body) == 1
            and isinstance(node.body[0], ast.AugAssign)
            and isinstance(node.body[0].target, ast.Name)
            and node.body[0].target.id == "_rank_col"
            and isinstance(node.body[0].op, ast.Add)
            and isinstance(node.body[0].value, ast.Constant)
            and node.body[0].value.value == "_"
        )
        if not safe_loop:
            raise ValueError("Preview execution does not allow custom while loops.")
        self.generic_visit(node)


class _DisplayMethodNormalizer(ast.NodeTransformer):
    def visit_Call(self, node):
        self.generic_visit(node)
        if isinstance(node.func, ast.Attribute) and node.func.attr == "display" and not node.args and not node.keywords:
            return ast.copy_location(ast.Call(func=ast.Name(id="display", ctx=ast.Load()), args=[node.func.value], keywords=[]), node)
        return node


def _safe_preview_import(name, globals=None, locals=None, fromlist=(), level=0):
    if level or name not in _SAFE_IMPORTS:
        raise ImportError("This import is not available in preview execution.")
    return builtins.__import__(name, globals, locals, fromlist, level)


def _get_spark_session():
    oauth_session = _current_oauth_session()
    if oauth_session and oauth_session.get("spark") is not None:
        return oauth_session["spark"]
    global _spark_session
    if _spark_session is None:
        with _spark_session_lock:
            if _spark_session is None:
                from databricks.connect import DatabricksSession

                builder = DatabricksSession.builder
                if _databricks_config is not None:
                    _spark_session = builder.sdkConfig(_databricks_config).getOrCreate()
                else:
                    _spark_session = builder.serverless().getOrCreate()
    return _spark_session


def _has_databricks_connect_config():
    """Report whether the SDK can find a workspace host without exposing credentials."""
    try:
        from databricks.sdk.core import Config

        config = _databricks_config or Config()
        host = config.host or ""
        parsed_host = urlsplit(host)
        return parsed_host.scheme == "https" and bool(parsed_host.hostname)
    except Exception:
        return False


def _clean_workspace_url(value):
    value = str(value or "").strip().rstrip("/")
    parsed = urlsplit(value)
    if parsed.scheme != "https" or not parsed.hostname or parsed.username or parsed.password:
        raise ValueError("Enter a valid HTTPS Databricks workspace URL.")
    if parsed.path not in ("", "/") or parsed.query or parsed.fragment:
        raise ValueError("Enter only the workspace URL, without a path or query string.")
    return urlunsplit(("https", parsed.netloc, "", "", ""))


def _clean_oauth_workspace_url(value):
    host = _clean_workspace_url(value)
    hostname = (urlsplit(host).hostname or "").casefold()
    allowed_suffixes = (".databricks.com", ".databricks.net", ".databricks.us")
    if not hostname.endswith(allowed_suffixes):
        raise ValueError("Enter a valid Databricks workspace URL.")
    return host


def _oauth_settings():
    return (
        os.environ.get("DATABRICKS_OAUTH_CLIENT_ID", "").strip(),
        os.environ.get("DATABRICKS_OAUTH_CLIENT_SECRET", "").strip(),
    )


def _oauth_redirect_uri():
    public_url = os.environ.get("LAKELOOM_PUBLIC_URL", "").strip().rstrip("/")
    if public_url:
        parsed = urlsplit(public_url)
        local_http = parsed.scheme == "http" and parsed.hostname in {"127.0.0.1", "localhost"}
        if (parsed.scheme != "https" and not local_http) or not parsed.hostname or parsed.query or parsed.fragment:
            raise ValueError("LAKELOOM_PUBLIC_URL must be an HTTPS origin, or localhost during development.")
        return f"{public_url}/api/oauth/callback"
    return url_for("oauth_callback", _external=True, _scheme="https" if app.config["SESSION_COOKIE_SECURE"] else request.scheme)


def _oauth_post(url, values, client_id, client_secret):
    encoded_credentials = base64.b64encode(f"{client_id}:{client_secret}".encode()).decode()
    oauth_request = Request(
        url,
        data=urlencode(values).encode(),
        headers={"Authorization": f"Basic {encoded_credentials}", "Content-Type": "application/x-www-form-urlencoded", "Accept": "application/json"},
        method="POST",
    )
    with urlopen(oauth_request, timeout=20) as response:
        return json.loads(response.read().decode("utf-8"))


def _oauth_identity(host, access_token):
    identity_request = Request(
        f"{host}/api/2.0/preview/scim/v2/Me",
        headers={"Authorization": f"Bearer {access_token}", "Accept": "application/json"},
    )
    with urlopen(identity_request, timeout=20) as response:
        identity = json.loads(response.read().decode("utf-8"))
    emails = identity.get("emails") if isinstance(identity.get("emails"), list) else []
    primary_email = next((item.get("value", "") for item in emails if isinstance(item, dict) and item.get("primary")), "")
    email = str(primary_email or identity.get("userName") or "")[:320]
    display_name = str(identity.get("displayName") or email or "Databricks user")[:256]
    return {"email": email, "displayName": display_name, "userId": str(identity.get("id") or "")[:256]}


def _current_oauth_session(refresh=True):
    """Return the OAuth connection owned by this signed browser session."""
    session_id = flask_session.get("oauth_session_id", "")
    if not session_id:
        return {}
    with _oauth_lock:
        oauth_session = _oauth_sessions.get(session_id)
        if not oauth_session:
            flask_session.pop("oauth_session_id", None)
            return {}
        oauth_session = dict(oauth_session)
    if not refresh or int(oauth_session.get("expiresAt") or 0) > int(time.time()) + 60:
        return oauth_session
    refresh_token = str(oauth_session.get("refreshToken") or "")
    client_id, client_secret = _oauth_settings()
    if not refresh_token or not client_id or not client_secret:
        return {}
    try:
        token_data = _oauth_post(f'{oauth_session["host"]}/oidc/v1/token', {
            "grant_type": "refresh_token",
            "refresh_token": refresh_token,
            "client_id": client_id,
            "scope": "all-apis offline_access openid email profile",
        }, client_id, client_secret)
        access_token = str(token_data.get("access_token") or "")
        if not access_token:
            return {}
        from databricks.connect import DatabricksSession
        oauth_session.update({
            "accessToken": access_token,
            "refreshToken": str(token_data.get("refresh_token") or refresh_token),
            "expiresAt": int(time.time()) + int(token_data.get("expires_in") or 3600),
            "spark": DatabricksSession.Builder().host(oauth_session["host"]).token(access_token).serverless().getOrCreate(),
        })
        with _oauth_lock:
            if session_id in _oauth_sessions:
                _oauth_sessions[session_id] = oauth_session
        return oauth_session
    except (ValueError, HTTPError, URLError, OSError, json.JSONDecodeError):
        with _oauth_lock:
            _oauth_sessions.pop(session_id, None)
        flask_session.pop("oauth_session_id", None)
        return {}


def _request_identity_email():
    if os.environ.get("DATABRICKS_APP_NAME"):
        return request.headers.get("x-forwarded-email", "")
    oauth_session = _current_oauth_session()
    if oauth_session:
        return oauth_session.get("email", "")
    return _databricks_connection.get("email", "")


def _local_profiles():
    """Return safe profile metadata; credentials never leave the server process."""
    path = Path(os.environ.get("DATABRICKS_CONFIG_FILE", "~/.databrickscfg")).expanduser()
    if not path.is_file():
        return []
    parser = configparser.RawConfigParser()
    try:
        parser.read(path)
    except (OSError, configparser.Error):
        return []
    profiles = []
    candidates = [("DEFAULT", parser.defaults()), *((name, dict(parser.items(name))) for name in parser.sections())]
    for name, values in candidates:
        host = str(values.get("host", "")).strip()
        try:
            host = _clean_workspace_url(host)
        except ValueError:
            continue
        profiles.append({"name": name, "host": host})
    return profiles


def _require_local_connection_request():
    if os.environ.get("DATABRICKS_APP_NAME"):
        abort(404)
    if request.headers.get("X-LakeLoom-Request") != "1":
        abort(403)


def _spark_case_sensitive(session):
    """Spark Connect serverless does not expose every runtime SQL configuration."""
    try:
        return str(session.conf.get("spark.sql.caseSensitive", "false")).lower() == "true"
    except Exception:
        return False


def _json_safe(value):
    return json.loads(json.dumps(value, default=str))


def _profile_database():
    _profile_store_path.parent.mkdir(parents=True, exist_ok=True)
    connection = sqlite3.connect(_profile_store_path, timeout=5)
    connection.execute(
        "CREATE TABLE IF NOT EXISTS user_profiles ("
        "email TEXT PRIMARY KEY COLLATE NOCASE, "
        "username TEXT NOT NULL UNIQUE COLLATE NOCASE, "
        "photo BLOB, photo_mime TEXT)"
    )
    columns = {row[1] for row in connection.execute("PRAGMA table_info(user_profiles)")}
    if "photo" not in columns:
        connection.execute("ALTER TABLE user_profiles ADD COLUMN photo BLOB")
    if "photo_mime" not in columns:
        connection.execute("ALTER TABLE user_profiles ADD COLUMN photo_mime TEXT")
    connection.execute(
        "CREATE TABLE IF NOT EXISTS user_recipe_stores ("
        "email TEXT PRIMARY KEY COLLATE NOCASE, "
        "recipes_json TEXT NOT NULL, "
        "updated_at INTEGER NOT NULL)"
    )
    connection.execute(
        "CREATE TABLE IF NOT EXISTS user_recipes ("
        "email TEXT NOT NULL COLLATE NOCASE, "
        "recipe_id TEXT NOT NULL, "
        "name TEXT NOT NULL, "
        "recipe_json TEXT NOT NULL, "
        "created_at TEXT, "
        "updated_at INTEGER NOT NULL, "
        "PRIMARY KEY (email, recipe_id))"
    )
    # Move records created by the earlier one-JSON-document recipe store into
    # individually queryable rows. Removing migrated rows prevents deleted
    # recipes from being restored by a later database connection.
    for email, recipes_json, updated_at in connection.execute(
        "SELECT email, recipes_json, updated_at FROM user_recipe_stores"
    ).fetchall():
        try:
            legacy_recipes = json.loads(recipes_json)
        except (TypeError, json.JSONDecodeError):
            continue
        if not isinstance(legacy_recipes, list):
            continue
        for index, recipe in enumerate(legacy_recipes):
            if not isinstance(recipe, dict):
                continue
            recipe_id = str(recipe.get("id") or f"legacy-{updated_at}-{index}")[:200]
            name = str(recipe.get("name") or "Untitled recipe")[:200]
            connection.execute(
                "INSERT OR IGNORE INTO user_recipes "
                "(email, recipe_id, name, recipe_json, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)",
                (email, recipe_id, name, json.dumps(recipe, ensure_ascii=False, separators=(",", ":")), str(recipe.get("createdAt") or ""), updated_at),
            )
        connection.execute("DELETE FROM user_recipe_stores WHERE email = ?", (email,))
    connection.execute(
        "DELETE FROM user_recipes WHERE rowid NOT IN ("
        "SELECT MAX(rowid) FROM user_recipes GROUP BY email, name COLLATE NOCASE)"
    )
    connection.execute(
        "CREATE UNIQUE INDEX IF NOT EXISTS user_recipes_unique_name "
        "ON user_recipes (email, name COLLATE NOCASE)"
    )
    return connection


def _profile_for_email(email):
    email_key = str(email or "").strip().casefold()
    if not email_key:
        return {}
    try:
        with _profile_database() as connection:
            row = connection.execute(
                "SELECT username, photo IS NOT NULL FROM user_profiles WHERE email = ?", (email_key,)
            ).fetchone()
        return {"email": email_key, "username": row[0], "hasPhoto": bool(row[1])} if row else {}
    except (OSError, sqlite3.Error):
        return {}


def _public_profile_for_username(username):
    try:
        with _profile_database() as connection:
            row = connection.execute(
                "SELECT username, photo IS NOT NULL FROM user_profiles WHERE username = ? COLLATE NOCASE",
                (username,),
            ).fetchone()
        return {"username": row[0], "hasPhoto": bool(row[1])} if row else {}
    except (OSError, sqlite3.Error):
        return {}


@app.after_request
def set_security_headers(response):
    response.headers.setdefault("X-Content-Type-Options", "nosniff")
    response.headers.setdefault("Referrer-Policy", "strict-origin-when-cross-origin")
    response.headers.setdefault("Cache-Control", "no-store")
    return response


@app.errorhandler(413)
def request_too_large(_error):
    if request.path == "/api/source-schema":
        return jsonify(error="This selection is larger than 60 MB. Upload it to Databricks or ADLS first, then choose Databricks and load the schema from its table or storage path."), 413
    return jsonify(error="This request is too large."), 413


@app.get("/")
def index():
    return send_from_directory(APP_ROOT, "index.html")


@app.get("/<path:asset>")
def static_asset(asset):
    if asset in {"app.js", "schema.js", "styles.css", "favicon.svg"}:
        return send_from_directory(APP_ROOT, asset)
    if "/" not in asset and _USERNAME_PATTERN.fullmatch(asset) and _public_profile_for_username(asset):
        return send_from_directory(APP_ROOT, "public_profile.html")
    abort(404)


@app.get("/api/oauth/start")
def oauth_start():
    if os.environ.get("DATABRICKS_APP_NAME"):
        abort(404)
    client_id, client_secret = _oauth_settings()
    if not client_id or not client_secret:
        return jsonify(error="Databricks OAuth is not configured on this LakeLoom deployment."), 503
    try:
        host = _clean_oauth_workspace_url(request.args.get("workspace"))
        redirect_uri = _oauth_redirect_uri()
    except ValueError as exc:
        return jsonify(error=str(exc)), 400
    state = secrets.token_urlsafe(32)
    verifier = secrets.token_urlsafe(64)
    challenge = base64.urlsafe_b64encode(hashlib.sha256(verifier.encode()).digest()).decode().rstrip("=")
    flask_session["oauth_pending"] = {"state": state, "verifier": verifier, "host": host, "created": int(time.time())}
    parameters = urlencode({
        "client_id": client_id,
        "redirect_uri": redirect_uri,
        "response_type": "code",
        "state": state,
        "code_challenge": challenge,
        "code_challenge_method": "S256",
        "scope": "all-apis offline_access openid email profile",
    })
    return redirect(f"{host}/oidc/v1/authorize?{parameters}")


@app.get("/api/oauth/callback")
def oauth_callback():
    pending = flask_session.pop("oauth_pending", None)
    if not isinstance(pending, dict) or not secrets.compare_digest(str(pending.get("state", "")), request.args.get("state", "")):
        return redirect("/?oauth_error=invalid_state")
    if int(time.time()) - int(pending.get("created", 0)) > 600:
        return redirect("/?oauth_error=expired")
    code = request.args.get("code", "")
    if not code or request.args.get("error"):
        return redirect("/?oauth_error=denied")
    client_id, client_secret = _oauth_settings()
    try:
        host = _clean_oauth_workspace_url(pending.get("host"))
        redirect_uri = _oauth_redirect_uri()
        token_data = _oauth_post(f"{host}/oidc/v1/token", {
            "grant_type": "authorization_code",
            "client_id": client_id,
            "redirect_uri": redirect_uri,
            "code_verifier": pending.get("verifier", ""),
            "code": code,
            "scope": "all-apis offline_access openid email profile",
        }, client_id, client_secret)
        access_token = str(token_data.get("access_token") or "")
        if not access_token:
            raise ValueError("Databricks did not return an access token.")
        identity = _oauth_identity(host, access_token)
        from databricks.connect import DatabricksSession
        spark_session = DatabricksSession.Builder().host(host).token(access_token).serverless().getOrCreate()
        session_id = secrets.token_urlsafe(32)
        with _oauth_lock:
            _oauth_sessions[session_id] = {
                "accessToken": access_token,
                "refreshToken": str(token_data.get("refresh_token") or ""),
                "expiresAt": int(time.time()) + int(token_data.get("expires_in") or 3600),
                "host": host,
                "spark": spark_session,
                **identity,
            }
        flask_session["oauth_session_id"] = session_id
        return redirect("/#overview")
    except (ValueError, HTTPError, URLError, OSError, json.JSONDecodeError):
        return redirect("/?oauth_error=exchange_failed")


@app.post("/api/oauth/logout")
def oauth_logout():
    if request.headers.get("X-LakeLoom-Request") != "1":
        abort(403)
    session_id = flask_session.pop("oauth_session_id", "")
    if session_id:
        with _oauth_lock:
            _oauth_sessions.pop(session_id, None)
    return jsonify(disconnected=True)


@app.get("/api/session")
def session_status():
    # Databricks documents these as identity headers forwarded by its Apps proxy.
    # Ignore them outside the managed runtime so a local caller cannot claim an identity.
    running_in_databricks_apps = bool(os.environ.get("DATABRICKS_APP_NAME"))
    headers = request.headers if running_in_databricks_apps else {}
    user_id = headers.get("x-forwarded-user", "").strip()[:256]
    preferred_username = headers.get("x-forwarded-preferred-username", "").strip()[:256]
    email = headers.get("x-forwarded-email", "").strip()[:320]
    forwarded_display_name = (
        headers.get("x-forwarded-display-name", "").strip()
        or headers.get("x-forwarded-name", "").strip()
    )[:256]
    oauth_session = _current_oauth_session()
    oauth_authenticated = bool(oauth_session and oauth_session.get("accessToken"))
    authenticated = (running_in_databricks_apps and bool(user_id or preferred_username or email)) or oauth_authenticated
    if oauth_authenticated:
        user_id = oauth_session.get("userId", "")
        email = oauth_session.get("email", "")
        forwarded_display_name = oauth_session.get("displayName", "")
    local_connect_ready = not running_in_databricks_apps and _has_databricks_connect_config()
    local_connected = not running_in_databricks_apps and bool(_databricks_connection.get("connected"))
    identity_email = email if authenticated else _databricks_connection.get("email", "")
    saved_profile = _profile_for_email(identity_email)

    workspace_url = ""
    configured_host = oauth_session.get("host") or _databricks_connection.get("host") or os.environ.get("DATABRICKS_HOST", "").strip()
    if not configured_host and _databricks_config is not None:
        configured_host = _databricks_config.host or ""
    parsed_host = urlsplit(configured_host)
    if parsed_host.scheme == "https" and parsed_host.hostname and not parsed_host.username and not parsed_host.password:
        workspace_url = urlunsplit(("https", parsed_host.netloc, "", "", ""))

    return jsonify(
        authenticated=authenticated or local_connected,
        oauthAvailable=bool(all(_oauth_settings())),
        oauthCallbackUrl=_oauth_redirect_uri(),
        oauthConnected=oauth_authenticated,
        databricksApp=running_in_databricks_apps,
        previewAvailable=running_in_databricks_apps or oauth_authenticated or local_connect_ready,
        localConnectReady=local_connect_ready,
        localConnected=local_connected,
        connectionMethod="oauth" if oauth_authenticated else _databricks_connection.get("method", ""),
        username=saved_profile.get("username", ""),
        hasProfilePhoto=saved_profile.get("hasPhoto", False),
        displayName=(forwarded_display_name or preferred_username or email or user_id) if authenticated else _databricks_connection.get("displayName", ""),
        email=email if authenticated else _databricks_connection.get("email", ""),
        userId=user_id if authenticated else "",
        workspaceUrl=workspace_url,
    )


@app.put("/api/profile")
def update_profile():
    if request.headers.get("X-LakeLoom-Request") != "1":
        abort(403)
    email = str(_request_identity_email()).strip().casefold()
    if not email or "@" not in email:
        return jsonify(error="A verified Databricks email is required to save a username."), 401

    payload = request.get_json(silent=True) or {}
    username = str(payload.get("username", "")).strip()
    if not _USERNAME_PATTERN.fullmatch(username):
        return jsonify(error="Use 3–30 characters. Start with a letter and use letters, numbers, dots, hyphens, or underscores."), 400

    try:
        with _profile_database() as connection:
            connection.execute(
                "INSERT INTO user_profiles (email, username) VALUES (?, ?) "
                "ON CONFLICT(email) DO UPDATE SET username = excluded.username",
                (email, username),
            )
    except sqlite3.IntegrityError:
        return jsonify(error="This username is already in use. Choose another one."), 409
    except (OSError, sqlite3.Error):
        return jsonify(error="The profile store is unavailable. Configure a writable LAKELOOM_PROFILE_STORE path."), 503
    return jsonify(saved=True, username=username)


def _verified_profile_email():
    email = _request_identity_email()
    email = str(email or "").strip().casefold()
    return email if "@" in email else ""


def _profile_photo_type(data):
    if data.startswith(b"\x89PNG\r\n\x1a\n"):
        return "image/png"
    if data.startswith(b"\xff\xd8\xff"):
        return "image/jpeg"
    if data.startswith((b"GIF87a", b"GIF89a")):
        return "image/gif"
    if len(data) >= 12 and data[:4] == b"RIFF" and data[8:12] == b"WEBP":
        return "image/webp"
    return ""


@app.get("/api/profile/photo")
def profile_photo():
    email = _verified_profile_email()
    if not email:
        abort(401)
    try:
        with _profile_database() as connection:
            row = connection.execute(
                "SELECT photo, photo_mime FROM user_profiles WHERE email = ?", (email,)
            ).fetchone()
    except (OSError, sqlite3.Error):
        abort(503)
    if not row or not row[0]:
        abort(404)
    return send_file(io.BytesIO(row[0]), mimetype=row[1] or "image/jpeg", max_age=0)


@app.post("/api/profile/photo")
def upload_profile_photo():
    if request.headers.get("X-LakeLoom-Request") != "1":
        abort(403)
    email = _verified_profile_email()
    if not email:
        return jsonify(error="A verified Databricks email is required."), 401
    upload = request.files.get("photo")
    data = upload.read(2 * 1024 * 1024 + 1) if upload else b""
    if not data:
        return jsonify(error="Choose a profile photo."), 400
    if len(data) > 2 * 1024 * 1024:
        return jsonify(error="Profile photos must be 2 MB or smaller."), 413
    mime_type = _profile_photo_type(data)
    if not mime_type:
        return jsonify(error="Use a PNG, JPEG, GIF, or WebP image."), 400
    try:
        with _profile_database() as connection:
            cursor = connection.execute(
                "UPDATE user_profiles SET photo = ?, photo_mime = ? WHERE email = ?",
                (data, mime_type, email),
            )
            if cursor.rowcount == 0:
                return jsonify(error="Save a unique username before uploading a profile photo."), 409
    except (OSError, sqlite3.Error):
        return jsonify(error="The profile store is unavailable."), 503
    return jsonify(saved=True)


@app.delete("/api/profile/photo")
def remove_profile_photo():
    if request.headers.get("X-LakeLoom-Request") != "1":
        abort(403)
    email = _verified_profile_email()
    if not email:
        return jsonify(error="A verified Databricks email is required."), 401
    try:
        with _profile_database() as connection:
            connection.execute(
                "UPDATE user_profiles SET photo = NULL, photo_mime = NULL WHERE email = ?", (email,)
            )
    except (OSError, sqlite3.Error):
        return jsonify(error="The profile store is unavailable."), 503
    return jsonify(removed=True)


@app.get("/api/recipes")
def account_recipes():
    email = _verified_profile_email()
    if not email:
        return jsonify(error="A verified Databricks account is required."), 401
    try:
        with _profile_database() as connection:
            rows = connection.execute(
                "SELECT recipe_json FROM user_recipes WHERE email = ? "
                "ORDER BY created_at DESC, updated_at DESC", (email,)
            ).fetchall()
        recipes = [json.loads(row[0]) for row in rows]
    except (OSError, sqlite3.Error, json.JSONDecodeError):
        return jsonify(error="Saved recipes are temporarily unavailable."), 503
    return jsonify(recipes=recipes if isinstance(recipes, list) else [])


@app.put("/api/recipes")
def update_account_recipes():
    if request.headers.get("X-LakeLoom-Request") != "1":
        abort(403)
    email = _verified_profile_email()
    if not email:
        return jsonify(error="A verified Databricks account is required."), 401
    payload = request.get_json(silent=True) or {}
    recipes = payload.get("recipes")
    if not isinstance(recipes, list) or len(recipes) > 100 or any(not isinstance(item, dict) for item in recipes):
        return jsonify(error="Save at most 100 valid recipes."), 400
    encoded = json.dumps(recipes, ensure_ascii=False, separators=(",", ":"))
    if len(encoded.encode("utf-8")) > 2 * 1024 * 1024:
        return jsonify(error="Saved recipes exceed the 2 MB account limit."), 413
    now = int(time.time())
    recipe_rows = []
    recipe_names = set()
    for index, recipe in enumerate(recipes):
        recipe_id = str(recipe.get("id") or f"recipe-{now}-{index}").strip()[:200]
        name = str(recipe.get("name") or "Untitled recipe").strip()[:200] or "Untitled recipe"
        name_key = name.casefold()
        if name_key in recipe_names:
            return jsonify(error=f'A recipe named "{name}" already exists in this account.'), 409
        recipe_names.add(name_key)
        stored_recipe = {**recipe, "id": recipe_id, "name": name}
        recipe_rows.append((
            email,
            recipe_id,
            name,
            json.dumps(stored_recipe, ensure_ascii=False, separators=(",", ":")),
            str(stored_recipe.get("createdAt") or ""),
            now,
        ))
    try:
        with _profile_database() as connection:
            connection.execute("DELETE FROM user_recipes WHERE email = ?", (email,))
            connection.executemany(
                "INSERT INTO user_recipes "
                "(email, recipe_id, name, recipe_json, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)",
                recipe_rows,
            )
    except sqlite3.IntegrityError:
        return jsonify(error="Each recipe name must be unique within the account."), 409
    except (OSError, sqlite3.Error):
        return jsonify(error="Saved recipes are temporarily unavailable."), 503
    return jsonify(saved=True, count=len(recipes))


@app.get("/api/public/profiles/<username>")
def public_profile(username):
    if not _USERNAME_PATTERN.fullmatch(username):
        abort(404)
    profile = _public_profile_for_username(username)
    if not profile:
        abort(404)
    canonical_username = profile["username"]
    return jsonify(
        username=canonical_username,
        profileUrl=f"{request.url_root.rstrip('/')}/{canonical_username}",
        photoUrl=f"{request.url_root.rstrip('/')}/api/public/profiles/{canonical_username}/photo" if profile["hasPhoto"] else "",
    )


@app.get("/api/public/profiles/<username>/photo")
def public_profile_photo(username):
    if not _USERNAME_PATTERN.fullmatch(username):
        abort(404)
    try:
        with _profile_database() as connection:
            row = connection.execute(
                "SELECT photo, photo_mime FROM user_profiles WHERE username = ? COLLATE NOCASE",
                (username,),
            ).fetchone()
    except (OSError, sqlite3.Error):
        abort(503)
    if not row or not row[0]:
        abort(404)
    return send_file(io.BytesIO(row[0]), mimetype=row[1] or "image/jpeg", max_age=300)


@app.get("/api/databricks/profiles")
def databricks_profiles():
    _require_local_connection_request()
    return jsonify(profiles=_local_profiles())


@app.post("/api/databricks/connect")
def connect_databricks():
    global _databricks_config, _databricks_connection, _spark_session
    _require_local_connection_request()
    payload = request.get_json(silent=True) or {}
    if not isinstance(payload, dict):
        return jsonify(error="Send connection settings as JSON."), 400
    method = str(payload.get("method", "profile")).strip().lower()
    try:
        from databricks.sdk import WorkspaceClient
        from databricks.sdk.core import Config

        if method == "profile":
            profile = str(payload.get("profile", "")).strip()
            if not profile or len(profile) > 128:
                raise ValueError("Choose a Databricks CLI profile.")
            config = Config(profile=profile, serverless_compute_id="auto")
        elif method == "token":
            host = _clean_workspace_url(payload.get("host"))
            token = str(payload.get("token", "")).strip()
            if not token or len(token) > 4096:
                raise ValueError("Enter a valid personal access token.")
            config = Config(host=host, token=token, auth_type="pat", serverless_compute_id="auto")
            profile = ""
        else:
            raise ValueError("Choose a supported connection method.")

        host = _clean_workspace_url(config.host)
        identity = WorkspaceClient(config=config).current_user.me()
        identity_name = getattr(identity, "name", None)
        formatted_name = str(getattr(identity_name, "formatted", "") or "").strip()
        given_name = str(getattr(identity_name, "given_name", "") or "").strip()
        family_name = str(getattr(identity_name, "family_name", "") or "").strip()
        structured_name = " ".join(part for part in (given_name, family_name) if part)
        display_name = str(
            formatted_name
            or structured_name
            or getattr(identity, "display_name", "")
            or getattr(identity, "user_name", "")
            or "Databricks user"
        )[:256]
        email_address = str(getattr(identity, "user_name", "") or "")[:320]
        from databricks.connect import DatabricksSession

        spark_builder = DatabricksSession.Builder().validateSession(True)
        if method == "token":
            spark_builder = spark_builder.host(host).token(token).serverless()
        else:
            spark_builder = spark_builder.profile(profile).serverless()
        spark_session = spark_builder.getOrCreate()
        with _spark_session_lock:
            _spark_session = spark_session
            _databricks_config = config
            _databricks_connection = {
                "connected": True,
                "host": host,
                "method": method,
                "profile": profile,
                "displayName": display_name,
                "email": email_address,
            }
        return jsonify(connected=True, displayName=display_name, workspaceUrl=host)
    except ValueError as exc:
        message = str(exc)
        supplied_token = str(payload.get("token", "")).strip()
        if supplied_token:
            message = message.replace(supplied_token, "[redacted]")
        return jsonify(error=message), 400
    except Exception as exc:
        message = str(exc).strip().splitlines()[0][:300]
        supplied_token = str(payload.get("token", "")).strip()
        if supplied_token:
            message = message.replace(supplied_token, "[redacted]")
        return jsonify(error=message or "Databricks rejected the connection settings."), 401


@app.post("/api/databricks/disconnect")
def disconnect_databricks():
    global _databricks_config, _databricks_connection, _spark_session
    _require_local_connection_request()
    with _spark_session_lock:
        _spark_session = None
        _databricks_config = None
        _databricks_connection = {}
    return jsonify(disconnected=True)


@app.post("/api/source-schema")
def source_schema():
    running_in_apps = bool(os.environ.get("DATABRICKS_APP_NAME"))
    if running_in_apps and not any(request.headers.get(name, "").strip() for name in ("x-forwarded-user", "x-forwarded-preferred-username", "x-forwarded-email")):
        abort(401)
    try:
        if request.mimetype == "multipart/form-data":
            source_format = request.form.get("format", "")
            version = request.form.get("version", "") if source_format == "delta" else ""
            if source_format not in _READ_FORMATS or (version and not re.fullmatch(r"\d+", version)):
                return jsonify(error="Choose a supported format and a non-negative Delta version."), 400
            result = inspect_files(request.files.getlist("files"), source_format, version)
            if not result["columns"]:
                return jsonify(error="This source has no named columns to inspect."), 400
            return jsonify(**result, origin="local")

        if not running_in_apps and not _has_databricks_connect_config():
            return jsonify(error="Configure Databricks Connect to inspect a catalog table or storage path. You can also select a local file."), 503
        payload = request.get_json(silent=True) or {}
        if not isinstance(payload, dict):
            return jsonify(error="Send source settings as a JSON object."), 400
        source_format = payload.get("format")
        path = payload.get("path")
        version = str(payload.get("version", "")) if source_format == "delta" else ""
        if not isinstance(source_format, str) or source_format not in _READ_FORMATS or not isinstance(path, str) or not path.strip() or len(path) > 4096:
            return jsonify(error="Enter a supported source format and a valid Databricks table or path."), 400
        if path.strip().lower() in {"catalog.schema.your_table", "catalog.schema.table", "your_table"}:
            return jsonify(error="Replace the example with an existing table name, such as catalog.schema.table, or a Databricks-accessible storage path."), 400
        if path.lower().startswith(("file:", "jdbc:")) or (version and not re.fullmatch(r"\d+", version)):
            return jsonify(error="Use a Databricks-accessible source and a non-negative Delta version."), 400
        with _preview_run_lock:
            reader = _get_spark_session().read
            if version:
                reader = reader.option("versionAsOf", int(version))
            if source_format in {"delta", "iceberg"} and re.fullmatch(r"[\w-]+(?:\.[\w-]+){1,2}", path.strip()):
                dataframe = reader.table(path.strip())
            else:
                reader = reader.format(source_format)
                if source_format == "csv":
                    reader = reader.option("header", "true").option("inferSchema", "true")
                dataframe = reader.load(path.strip())
            columns = spark_columns(dataframe.schema)
        return jsonify(columns=columns, inferred=False, origin="databricks", caseSensitive=_spark_case_sensitive(_get_spark_session()))
    except (ValueError, UnicodeError, KeyError) as error:
        return jsonify(error=f"Could not read the source schema: {str(error)[:500]}"), 400
    except ImportError:
        return jsonify(error="Install the updated requirements.txt to enable schema inspection for this format."), 503
    except Exception as error:
        app.logger.exception("Source schema inspection failed")
        message = str(error)
        if "TABLE_OR_VIEW_NOT_FOUND" in message or "UnresolvedRelation" in message:
            return jsonify(error=f"Table or view not found. Check the catalog, schema, and table name, and confirm your Databricks user can read it."), 404
        return jsonify(error=f"Could not read the source schema: {message[:500]}"), 422


@app.post("/api/run-preview")
def run_preview():
    if request.content_length and request.content_length > 100_000:
        abort(413)
    running_in_databricks_apps = bool(os.environ.get("DATABRICKS_APP_NAME"))
    if running_in_databricks_apps:
        headers = request.headers
        if not any(headers.get(name, "").strip() for name in ("x-forwarded-user", "x-forwarded-preferred-username", "x-forwarded-email")):
            abort(401)
    elif not _has_databricks_connect_config():
        return jsonify(error="Configure Databricks Connect locally with a workspace OAuth profile, then refresh LakeLoom."), 503

    payload = request.get_json(silent=True)
    if not isinstance(payload, dict):
        return jsonify(error="Send notebook code as a JSON object."), 400
    code = payload.get("code")
    dataframe_name = payload.get("dataframeName", "df")
    if not isinstance(code, str) or not code.strip() or len(code) > 90_000:
        return jsonify(error="Notebook code is empty or larger than the preview limit."), 400
    if not isinstance(dataframe_name, str) or not re.fullmatch(r"[A-Za-z][A-Za-z0-9_]*", dataframe_name) or dataframe_name in _RESERVED_NAMES:
        return jsonify(error="Use a valid, non-reserved DataFrame name before running the preview."), 400

    try:
        syntax_tree = ast.parse(code, filename="lake-loom-preview.py", mode="exec")
        _PreviewCodeValidator().visit(syntax_tree)
    except (SyntaxError, ValueError) as error:
        return jsonify(error=f"Preview code is not supported: {error}"), 400

    try:
        from pyspark.sql import DataFrame

        with _preview_run_lock:
            spark = _get_spark_session()
            displayed_dataframes = []

            def capture_display(value):
                if not isinstance(value, DataFrame):
                    raise ValueError("Use display() with a Spark DataFrame to preview results.")
                displayed_dataframes.append(value)

            def safe_builtins_import(name, globals=None, locals=None, fromlist=(), level=0):
                return _safe_preview_import(name, globals, locals, fromlist, level)

            namespace = {
                "__builtins__": {
                    "__import__": safe_builtins_import,
                    "isinstance": isinstance,
                    "set": set,
                    "ValueError": ValueError,
                },
                "spark": spark,
                "display": capture_display,
            }
            syntax_tree = _DisplayMethodNormalizer().visit(syntax_tree)
            ast.fix_missing_locations(syntax_tree)
            exec(compile(syntax_tree, "lake-loom-preview.py", "exec"), namespace, namespace)

            result = displayed_dataframes[-1] if displayed_dataframes else namespace.get(dataframe_name)
            if not isinstance(result, DataFrame):
                return jsonify(error=f"The notebook did not produce a Spark DataFrame named '{dataframe_name}'."), 400

            rows = result.limit(101).collect()
            truncated = len(rows) > 100
            row_data = [row.asDict(recursive=True) for row in rows[:100]]
            safe_rows = _json_safe(row_data)
            columns = [{"name": field.name, "type": field.dataType.simpleString()} for field in result.schema.fields]
            return jsonify(columns=columns, rows=safe_rows, truncated=truncated, rowLimit=100)
    except Exception as error:
        # Return a concise error to the builder; keep workspace internals and tracebacks server-side.
        app.logger.exception("Databricks preview execution failed")
        return jsonify(error=f"Databricks could not run this preview: {str(error)[:500]}"), 422


@app.post("/api/write-output")
def write_output():
    """Run the validated read/transform pipeline and write its final DataFrame."""
    if request.content_length and request.content_length > 100_000:
        abort(413)
    running_in_apps = bool(os.environ.get("DATABRICKS_APP_NAME"))
    if running_in_apps:
        if not any(request.headers.get(name, "").strip() for name in ("x-forwarded-user", "x-forwarded-preferred-username", "x-forwarded-email")):
            abort(401)
    else:
        if request.headers.get("X-LakeLoom-Request") != "1":
            abort(403)
        if not _has_databricks_connect_config():
            return jsonify(error="Connect LakeLoom to Databricks before writing output."), 503

    payload = request.get_json(silent=True)
    if not isinstance(payload, dict):
        return jsonify(error="Send output settings as a JSON object."), 400
    code = payload.get("code")
    dataframe_name = payload.get("dataframeName", "df")
    destination = str(payload.get("destination", "")).strip()
    output_format = str(payload.get("format", "")).strip().lower()
    mode = str(payload.get("mode", "")).strip().lower()
    partitions = payload.get("partitions", [])
    compression = str(payload.get("compression", "")).strip().lower()
    if not isinstance(code, str) or not code.strip() or len(code) > 90_000:
        return jsonify(error="The generated transformation code is empty or too large."), 400
    if not isinstance(dataframe_name, str) or not re.fullmatch(r"[A-Za-z][A-Za-z0-9_]*", dataframe_name):
        return jsonify(error="Use a valid DataFrame name before writing output."), 400
    if not destination.startswith(("abfss://", "/Volumes/")) or len(destination) > 4096:
        return jsonify(error="Direct writes require an abfss:// ADLS path or a /Volumes/ path."), 400
    if output_format not in {"delta", "csv", "json", "text", "parquet", "avro", "orc"}:
        return jsonify(error="Choose a supported file or Delta output format."), 400
    if mode not in {"overwrite", "append", "errorifexists", "ignore"}:
        return jsonify(error="Choose a supported write mode."), 400
    if not isinstance(partitions, list) or len(partitions) > 20 or any(not isinstance(name, str) or not re.fullmatch(r"[A-Za-z_][A-Za-z0-9_]*", name) for name in partitions):
        return jsonify(error="Partition columns must be valid column names."), 400
    if compression not in {"", "snappy", "gzip", "zstd", "bzip2"}:
        return jsonify(error="Choose a supported compression option."), 400
    try:
        syntax_tree = ast.parse(code, filename="lake-loom-write.py", mode="exec")
        _PreviewCodeValidator().visit(syntax_tree)
    except (SyntaxError, ValueError) as error:
        return jsonify(error=f"Output code is not supported: {error}"), 400

    try:
        from pyspark.sql import DataFrame
        from pyspark.sql import functions as F

        with _preview_run_lock:
            spark = _get_spark_session()
            displayed_dataframes = []

            def capture_display(value):
                if isinstance(value, DataFrame):
                    displayed_dataframes.append(value)

            namespace = {
                "__builtins__": {"__import__": _safe_preview_import, "isinstance": isinstance, "set": set, "ValueError": ValueError},
                "spark": spark,
                "display": capture_display,
            }
            syntax_tree = _DisplayMethodNormalizer().visit(syntax_tree)
            ast.fix_missing_locations(syntax_tree)
            exec(compile(syntax_tree, "lake-loom-write.py", "exec"), namespace, namespace)
            result = displayed_dataframes[-1] if displayed_dataframes else namespace.get(dataframe_name)
            if not isinstance(result, DataFrame):
                return jsonify(error="The pipeline did not produce a DataFrame to write."), 400
            writer_frame = result
            if output_format == "text":
                writer_frame = result.select(F.to_json(F.struct(*[F.col(column) for column in result.columns])).alias("value"))
            writer = writer_frame.write.format(output_format).mode(mode)
            if output_format == "csv":
                writer = writer.option("header", "true" if payload.get("csvHeader") is True else "false").option("delimiter", str(payload.get("csvDelimiter", ","))[:1] or ",")
            if compression and output_format != "delta":
                writer = writer.option("compression", compression)
            if partitions and output_format == "delta":
                writer = writer.partitionBy(*partitions)
            writer.save(destination)
        return jsonify(completed=True, destination=destination, format=output_format, mode=mode)
    except Exception as error:
        app.logger.exception("Databricks output write failed")
        return jsonify(error=f"Databricks could not write this output: {str(error)[:500]}"), 422
if __name__ == "__main__":
    public_url = os.environ.get("LAKELOOM_PUBLIC_URL", "").strip()
    oauth_port_required = bool(public_url and all(_oauth_settings()))
    public_port = urlsplit(public_url).port if public_url else None
    port = int(os.environ.get("LAKELOOM_PORT", os.environ.get("DATABRICKS_APP_PORT", (public_port or 8000) if oauth_port_required else "8000")))
    from werkzeug.serving import make_server

    try:
        server = make_server("127.0.0.1", port, app, threaded=True)
    except (OSError, SystemExit):
        if oauth_port_required:
            raise RuntimeError(f"OAuth callback port {port} is unavailable.")
        server = make_server("127.0.0.1", 0, app, threaded=True)
    print(f"LakeLoom is running at http://127.0.0.1:{server.server_port}")
    server.serve_forever()
