# LakeLoom — Databricks data prep

This project is a Databricks Apps application with a local development mode. In Databricks Apps, the Flask backend reads identity headers forwarded by the Apps proxy and reports the current user's name to the UI. It never sends the forwarded access token to the browser.

The **Run preview** action uses Databricks Connect 15.4 with serverless compute. In Databricks Apps, it runs as the app's service principal; all app users share that identity, so grant it only the serverless-compute and source-table or storage permissions the app needs. Locally, it uses the Databricks Connect profile configured for the user running Flask. The UI remains in guest mode and never receives credentials. Preview returns at most 100 rows, skips output writes, and does not run Delta table management steps.

## Run locally

Use **Python 3.11** in a separate environment. With Anaconda or Miniconda:

```bash
conda create -n lakeloom python=3.11 -y
conda activate lakeloom
python -m pip install --upgrade pip
python -m pip install -r requirements.txt
```

Python 3.13 is incompatible with NumPy 1.26.4, which can be selected by this dependency stack. If installation reports a NumPy compiler or metadata-generation error, use the Python 3.11 environment above. Do not install standalone `pyspark` alongside `databricks-connect`; Databricks Connect provides the PySpark modules.

Run `python app.py`, open `http://localhost:8000`, and choose **Connect Databricks**. Select an existing CLI profile, or choose **Personal access token** and enter the workspace URL and token. LakeLoom validates the identity before enabling preview execution.

For the recommended OAuth profile method, create a serverless profile first:

```bash
databricks auth login --configure-serverless --host https://<your-workspace-host>
python app.py
```

If port 8000 is already in use, the local server picks a free port and prints its address in the terminal.

Complete the OAuth sign-in in the browser, then select that profile in LakeLoom. The preview uses your Databricks user permissions. Credentials stay in the server process and are never stored in browser storage or returned by the session API.

## Browser OAuth for a public deployment

Register LakeLoom as a confidential custom OAuth application in each Databricks account that will use it. Add this exact redirect URL to the integration:

```text
https://<your-lakeloom-domain>/api/oauth/callback
```

Configure these server environment variables:

```bash
DATABRICKS_OAUTH_CLIENT_ID=<integration-client-id>
DATABRICKS_OAUTH_CLIENT_SECRET=<integration-client-secret>
LAKELOOM_PUBLIC_URL=https://<your-lakeloom-domain>
LAKELOOM_SECRET_KEY=<long-random-persistent-secret>
LAKELOOM_COOKIE_SECURE=true
LAKELOOM_PROFILE_STORE=/Volumes/<catalog>/<schema>/<volume>/lakeloom/profiles.db
```

`LAKELOOM_PROFILE_STORE` must point to storage that survives application restarts. LakeLoom associates each saved username and profile photo with the user's verified Databricks email, then loads that profile again whenever the same account signs in. For Databricks Apps, use a writable Unity Catalog Volume and grant the app service principal read and write access to it. Do not use the app container's temporary local filesystem for production profiles.

When these values are present, the sign-in page selects **Continue with Databricks OAuth**. The user enters their HTTPS workspace URL, signs in on Databricks in the same browser tab, and returns to LakeLoom at the Overview page. LakeLoom uses Authorization Code with PKCE and a state check, keeps access and refresh tokens on the server, and refreshes an expiring token automatically. Signing out removes that browser session from the server.

OAuth sessions are stored in the running process so credentials are not written to disk. Run one Gunicorn worker, as shown in `app.yaml`. A horizontally scaled deployment should replace the in-memory OAuth session map with an encrypted shared session store before adding workers or replicas.

### Create the Databricks OAuth connection in the UI

An account administrator must open the Databricks **Account Console**, then go to **Settings → App connections → Add connection**. Use these values:

- **Name:** `LakeLoom`
- **Redirect URL:** `http://127.0.0.1:8000/api/oauth/callback` for local development, or `https://<your-domain>/api/oauth/callback` for production
- **Client type:** confidential / generate a client secret
- **Scopes:** `all-apis`, `offline_access`, `openid`, `profile`, and `email`
- **Access-token lifetime:** 60 minutes
- **Refresh-token lifetime:** 10080 minutes or the duration required by your organization

After selecting **Add**, copy the client ID and client secret immediately. Databricks does not show the client secret again. Copy `.env.example` to `.env`, paste those two values, and restart LakeLoom. The local launcher uses the port in `LAKELOOM_PUBLIC_URL` so the callback URL stays stable.

## Inspect source columns

Selecting local files automatically detects CSV, JSON, TXT, Parquet, Avro, or ORC from the file extension and displays the source columns and data types. **Browse folder** detects Delta from `_delta_log` and Iceberg from its metadata directory. The detected format remains editable when an extension is misleading. Files are sent to the app backend for inspection without saving them or uploading them to Databricks. CSV and JSON types are inferred from up to 1,000 records per file; Parquet, ORC, Avro, Delta, and Iceberg use their stored metadata. TXT sources have one string column named `value`. Local inspection supports selections up to 60 MB; Delta checkpoint-only folders and larger sources can use **Load from Databricks** with a configured connection and accessible table or path.

### Azure Data Factory and ADLS Gen2

For an Azure pipeline, enter the ADLS Gen2 source as an `abfss://` URI, choose the matching source format, configure transformations, and enable **Include write step** with the destination URI. For example, a Delta destination can be `abfss://finalcleandata@skpb30adls.dfs.core.windows.net/deltab31`. Export the Databricks notebook and run it from an Azure Data Factory Databricks Notebook activity. ADF orchestrates the run; Databricks performs the Spark read, transformations, and write. The Databricks identity must have read and write access through a Unity Catalog storage credential and external location, or an equivalent workspace storage configuration.

Generated source readers use one chained statement for every format. For example, JSON uses `df = spark.read.format("json").option("multiline", "true").load(path)` and CSV includes its header and schema-inference options in the same statement. Multiline JSON allows one document to span several lines. Spark can still read newline-delimited JSON with this setting, although very large JSON documents are usually more efficient when stored as one record per line.

After loading a schema, selected transformations show warnings beside unknown input columns, including common SQL and `F.col(...)` expression references. Checks follow selection order and account for calculated, renamed, selected, removed, aggregated, and flattened columns. New output column names are allowed. Dynamic pivot columns, structures whose fields cannot be determined locally, manual notebook edits, and Delta management fields referencing a separate target table require Spark validation. Changing the source clears its schema and previous warnings.

For nested structs, **Flatten nested JSON** accepts a full dot-separated path. For example, `order.item.details` expands `order`, then `item`, then `details` in one selected step. For one array such as `orders`, choose a single-array method and optionally enter `details.more_details` under **Then expand struct fields only**. The generated pipeline explodes the array item and continues expanding those struct levels in order.

For a pipeline containing several nested arrays, choose **Multiple array levels — build an explode plan**. Add one `source path -> output column` line per array, such as `orders -> order` followed by `order.items -> item`. Then list the leaf columns to select, such as `address.city -> city` and `item.product_id -> product_id`. Any number of array levels and output fields can be added; the generated code chains `withColumn(..., explode(...))` calls and finishes with an explicit `select(...)`.

## Generated-code optimization

The new DataFrame option includes **Start new DataFrame from**: choose **Current result** to retain previous transformations, or **Original source** to begin the next transformations with the source's original columns and data. Original-source mode preserves a lazy reference before the first transformation and restores source-schema validation at the boundary. Neither option physically copies or caches the data.

To keep intermediate results, select your first transformations (for example, four), select **Continue in a new DataFrame** under **DataFrame tools**, enter a name such as `df_next`, then select the remaining transformations. Use **Add DataFrame step** to add more boundaries with separate names, such as `df_part`. Each generated assignment preserves its preceding DataFrame, and later steps and output writing use the most recent DataFrame. All completed DataFrames are displayed in the final action cell. These are lazy DataFrame references, not copies, caches, or checkpoints. Step order follows the order in which options were selected; uncheck and reselect options to change that order.

DataFrame transformations, including SCD Type 1 and Type 2, retain their selected order. Each SCD step combines a source DataFrame with a target DataFrame and assigns the result back to the target variable. Delta table management operations run after DataFrame transformations. Output writing follows these operations, and generated `display` calls appear in the final notebook cell.

Generated notebooks batch independent arithmetic mappings in calculated-column and date-expression steps using `withColumns`. References to earlier outputs and repeated output names start a new batch; complex SQL and function expressions stay sequential. The selected transformation order is preserved because moving filters, sorts, windows, or aggregations can change results. This reduces projection-plan overhead for eligible mappings; execution time still depends on data size, shuffles, storage, and Databricks compute. Manually edited notebook code is not automatically optimized.

## Advanced engineering modules

The **Engineering modules** category adds production pipeline building blocks directly to generated PySpark notebooks:

- **Data profiling** generates row counts, null counts, distinct counts, and descriptive statistics.
- **Data quality rules** split valid and failed records and attach the failed rule names.
- **Join or union DataFrames** combines configurable left and right DataFrame variables using a keyed join, `union`, `unionAll`, or `unionByName`. A blank left name uses the active pipeline result.
- **Pipeline branching** creates named matching and nonmatching DataFrames without copying data.
- **Rejected records** route invalid rows to a separate DataFrame with a rejection reason.
- **Schema evolution** compares source and target fields and can enable Delta `mergeSchema` output.
- **Notebook parameters** generate Databricks widgets for environment-specific configuration.
- **Incremental loading** supports watermark filters and Delta Change Data Feed starting versions.
- **Monitoring** creates a run ID, UTC timestamp, status, and row-count metrics DataFrame.
- **Generated tests** add assertions for required columns, nulls, key uniqueness, and minimum row counts.

The builder also includes a visual execution path, a performance advisor, and a step preview that runs the notebook only through a selected transformation. Its local pipeline assistant maps plain-language goals to relevant transformations; always review the suggested fields, expressions, and sample values before running them.

Saved recipes are stored per verified Databricks account in the configured LakeLoom profile store. A browser cache keeps the interface responsive and migrates existing browser recipes into the first signed-in account. Recipe records contain notebook configuration and do not contain uploaded source data. The footer **Documentation** link opens the complete in-app usage guide.

## Build for Windows

On a Windows 10 or 11 machine, install Python 3.11 and run `build_windows.bat` from this folder. The script creates `dist\LakeLoom-Windows.zip`; extract it and run `LakeLoom.exe`. The packaged launcher uses port 8000 by default and opens the app in your browser. If that port is busy, it selects an available local port and prints the address. Keep the console window open while using it, and press Ctrl+C there to stop the app. The package includes Python and the app dependencies, so Python is not needed on the target machine.

To enable Databricks preview in the packaged app, configure Databricks Connect authentication on that Windows machine first, using the Databricks CLI and the profile you intend to use. Notebook generation and export work without a Databricks connection.

You can also run the **Build Windows app** workflow from the repository's GitHub Actions tab. It uploads the same ZIP as a downloadable workflow artifact.

## Open the macOS app

Use `LakeLoom-macOS-arm64-v40.zip` on an Apple Silicon Mac. Download the ZIP, double-click it to extract `LakeLoom.app`, then Control-click `LakeLoom.app` and choose **Open**. Confirm **Open** if macOS asks. LakeLoom starts its local server and opens the UI in your default browser. It uses port 8000 when available and chooses a free port automatically when 8000 is already in use.

If macOS blocks the app, try opening it once, then go to **System Settings → Privacy & Security** and choose **Open Anyway** for LakeLoom. Startup details are logged at `~/Library/Logs/LakeLoom/launcher.log`.

## Deploy to Databricks Apps

Deploy this project directory as a Databricks App. The included `app.yaml` starts the Flask app with Gunicorn. Grant `CAN USE` to the users or groups who should open it. Databricks Apps will require workspace authentication before a user can access the app. Grant the app service principal permission to use serverless compute and read only the Unity Catalog tables, volumes, or external locations needed by the preview.

Create or select a Unity Catalog Volume for LakeLoom account profiles and configure `LAKELOOM_PROFILE_STORE` with a file inside that Volume. The app service principal needs `USE CATALOG`, `USE SCHEMA`, `READ VOLUME`, and `WRITE VOLUME` on that location. This keeps usernames and uploaded profile photos available when the app process restarts or the same user signs in again later.

Signing out is controlled by the Databricks workspace session. Use the workspace profile menu and choose **Sign out**; an app cannot revoke the user's workspace SSO session.
