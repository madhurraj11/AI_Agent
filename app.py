"""Small Flask host for the LakeLoom UI and Databricks Apps identity."""

import os
import ast
import builtins
import json
import re
import threading
from pathlib import Path
from urllib.parse import urlsplit, urlunsplit

from flask import Flask, abort, jsonify, request, send_from_directory
from source_schema import inspect_files, spark_columns


APP_ROOT = Path(__file__).resolve().parent
app = Flask(__name__, static_folder=None)
app.config["MAX_CONTENT_LENGTH"] = 64 * 1024 * 1024

_spark_session = None
_spark_session_lock = threading.Lock()
_preview_run_lock = threading.Lock()
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
    global _spark_session
    if _spark_session is None:
        with _spark_session_lock:
            if _spark_session is None:
                from databricks.connect import DatabricksSession

                _spark_session = DatabricksSession.builder.serverless().getOrCreate()
    return _spark_session


def _has_databricks_connect_config():
    """Report whether the SDK can find a workspace host without exposing credentials."""
    try:
        from databricks.sdk.core import Config

        host = Config().host or ""
        parsed_host = urlsplit(host)
        return parsed_host.scheme == "https" and bool(parsed_host.hostname)
    except Exception:
        return False


def _json_safe(value):
    return json.loads(json.dumps(value, default=str))


@app.after_request
def set_security_headers(response):
    response.headers.setdefault("X-Content-Type-Options", "nosniff")
    response.headers.setdefault("Referrer-Policy", "strict-origin-when-cross-origin")
    response.headers.setdefault("Cache-Control", "no-store")
    return response


@app.get("/")
def index():
    return send_from_directory(APP_ROOT, "index.html")


@app.get("/<path:asset>")
def static_asset(asset):
    if asset not in {"app.js", "schema.js", "styles.css", "favicon.svg"}:
        abort(404)
    return send_from_directory(APP_ROOT, asset)


@app.get("/api/session")
def session_status():
    # Databricks documents these as identity headers forwarded by its Apps proxy.
    # Ignore them outside the managed runtime so a local caller cannot claim an identity.
    running_in_databricks_apps = bool(os.environ.get("DATABRICKS_APP_NAME"))
    headers = request.headers if running_in_databricks_apps else {}
    user_id = headers.get("x-forwarded-user", "").strip()[:256]
    preferred_username = headers.get("x-forwarded-preferred-username", "").strip()[:256]
    email = headers.get("x-forwarded-email", "").strip()[:320]
    authenticated = running_in_databricks_apps and bool(user_id or preferred_username or email)
    local_connect_ready = not running_in_databricks_apps and _has_databricks_connect_config()

    workspace_url = ""
    configured_host = os.environ.get("DATABRICKS_HOST", "").strip()
    parsed_host = urlsplit(configured_host)
    if parsed_host.scheme == "https" and parsed_host.hostname and not parsed_host.username and not parsed_host.password:
        workspace_url = urlunsplit(("https", parsed_host.netloc, "", "", ""))

    return jsonify(
        authenticated=authenticated,
        databricksApp=running_in_databricks_apps,
        previewAvailable=running_in_databricks_apps or local_connect_ready,
        localConnectReady=local_connect_ready,
        displayName=(preferred_username or email or user_id) if authenticated else "",
        email=email if authenticated else "",
        userId=user_id if authenticated else "",
        workspaceUrl=workspace_url,
    )


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
        return jsonify(columns=columns, inferred=False, origin="databricks", caseSensitive=str(_get_spark_session().conf.get("spark.sql.caseSensitive", "false")).lower() == "true")
    except (ValueError, UnicodeError, KeyError) as error:
        return jsonify(error=f"Could not read the source schema: {str(error)[:500]}"), 400
    except ImportError:
        return jsonify(error="Install the updated requirements.txt to enable schema inspection for this format."), 503
    except Exception as error:
        app.logger.exception("Source schema inspection failed")
        return jsonify(error=f"Could not read the source schema: {str(error)[:500]}"), 422


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
if __name__ == "__main__":
    # Convenience for local UI work only. Authentication is available when deployed
    # behind the Databricks Apps proxy, not when using Flask's local server.
    app.run(host="0.0.0.0", port=int(os.environ.get("DATABRICKS_APP_PORT", "8001")))
