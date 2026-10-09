# LakeLoom — Databricks data prep

This project is a Databricks Apps application with a local development mode. In Databricks Apps, the Flask backend reads identity headers forwarded by the Apps proxy and reports the current user's name to the UI. It never sends the forwarded access token to the browser.

The **Run preview** action uses Databricks Connect 15.4 with serverless compute. In Databricks Apps, it runs as the app's service principal; all app users share that identity, so grant it only the serverless-compute and source-table or storage permissions the app needs. Locally, it uses the Databricks Connect profile configured for the user running Flask. The UI remains in guest mode and never receives credentials. Preview returns at most 100 rows, skips output writes, and does not run Delta table management or SCD merge steps.

## Run locally

Use **Python 3.11** in a separate environment. With Anaconda or Miniconda:

```bash
conda create -n lakeloom python=3.11 -y
conda activate lakeloom
python -m pip install --upgrade pip
python -m pip install -r requirements.txt
```

Python 3.13 is incompatible with NumPy 1.26.4, which can be selected by this dependency stack. If installation reports a NumPy compiler or metadata-generation error, use the Python 3.11 environment above. Do not install standalone `pyspark` alongside `databricks-connect`; Databricks Connect provides the PySpark modules.

Configure a Databricks Connect profile for serverless compute, then run `python app.py` and open `http://localhost:8000`:

```bash
databricks auth login --configure-serverless --host https://<your-workspace-host>
python app.py
```

Complete the OAuth sign-in in the browser and use the `DEFAULT` profile, or set `DATABRICKS_CONFIG_PROFILE` to your profile name before starting LakeLoom. The preview uses your Databricks user permissions. Without a configured profile, the Run preview button stays disabled and explains how to connect.

## Inspect source columns

Selecting local files automatically detects CSV, JSON, TXT, Parquet, Avro, or ORC from the file extension and displays the source columns and data types. **Browse folder** detects Delta from `_delta_log` and Iceberg from its metadata directory. The detected format remains editable when an extension is misleading. Files are sent to the app backend for inspection without saving them or uploading them to Databricks. CSV and JSON types are inferred from up to 1,000 records per file; Parquet, ORC, Avro, Delta, and Iceberg use their stored metadata. TXT sources have one string column named `value`. Local inspection supports selections up to 60 MB; Delta checkpoint-only folders and larger sources can use **Load from Databricks** with a configured connection and accessible table or path.

Generated source readers use one chained statement for every format. For example, JSON uses `df = spark.read.format("json").option("multiline", "true").load(path)` and CSV includes its header and schema-inference options in the same statement. Multiline JSON allows one document to span several lines. Spark can still read newline-delimited JSON with this setting, although very large JSON documents are usually more efficient when stored as one record per line.

After loading a schema, selected transformations show warnings beside unknown input columns, including common SQL and `F.col(...)` expression references. Checks follow selection order and account for calculated, renamed, selected, removed, aggregated, and flattened columns. New output column names are allowed. Dynamic pivot columns, structures whose fields cannot be determined locally, manual notebook edits, and Delta management fields referencing a separate target table require Spark validation. Changing the source clears its schema and previous warnings.

For nested structs, **Flatten nested JSON** accepts a full dot-separated path. For example, `order.item.details` expands `order`, then `item`, then `details` in one selected step. For one array such as `orders`, choose a single-array method and optionally enter `details.more_details` under **Then expand struct fields only**. The generated pipeline explodes the array item and continues expanding those struct levels in order.

For a pipeline containing several nested arrays, choose **Multiple array levels — build an explode plan**. Add one `source path -> output column` line per array, such as `orders -> order` followed by `order.items -> item`. Then list the leaf columns to select, such as `address.city -> city` and `item.product_id -> product_id`. Any number of array levels and output fields can be added; the generated code chains `withColumn(..., explode(...))` calls and finishes with an explicit `select(...)`.

## Generated-code optimization

The new DataFrame option includes **Start new DataFrame from**: choose **Current result** to retain previous transformations, or **Original source** to begin the next transformations with the source's original columns and data. Original-source mode preserves a lazy reference before the first transformation and restores source-schema validation at the boundary. Neither option physically copies or caches the data.

To keep intermediate results, select your first transformations (for example, four), select **Continue in a new DataFrame** under **DataFrame tools**, enter a name such as `df_next`, then select the remaining transformations. Use **Add DataFrame step** to add more boundaries with separate names, such as `df_part`. Each generated assignment preserves its preceding DataFrame, and later steps and output writing use the most recent DataFrame. All completed DataFrames are displayed in the final action cell. These are lazy DataFrame references, not copies, caches, or checkpoints. Step order follows the order in which options were selected; uncheck and reselect options to change that order.

DataFrame transformations retain their selected order. Delta table operations and SCD actions run after those transformations, retaining their relative order. Output writing follows these operations, and all generated `display` calls appear in the final notebook cell. SCD null/duplicate checks stay immediately before their merge or write, since those actions validate the operation's inputs. This ordering also means an SCD merge consumes the completed source pipeline even when it was selected before other transformations.

Generated notebooks batch independent arithmetic mappings in calculated-column and date-expression steps using `withColumns`. References to earlier outputs and repeated output names start a new batch; complex SQL and function expressions stay sequential. The selected transformation order is preserved because moving filters, sorts, windows, or aggregations can change results. This reduces projection-plan overhead for eligible mappings; execution time still depends on data size, shuffles, storage, and Databricks compute. Manually edited notebook code is not automatically optimized.

## Advanced engineering modules

The **Engineering modules** category adds production pipeline building blocks directly to generated PySpark notebooks:

- **Data profiling** generates row counts, null counts, distinct counts, and descriptive statistics.
- **Data quality rules** split valid and failed records and attach the failed rule names.
- **Join DataFrames** reads another table and joins it with configurable keys and join type.
- **Pipeline branching** creates named matching and nonmatching DataFrames without copying data.
- **Rejected records** route invalid rows to a separate DataFrame with a rejection reason.
- **Schema evolution** compares source and target fields and can enable Delta `mergeSchema` output.
- **Notebook parameters** generate Databricks widgets for environment-specific configuration.
- **Incremental loading** supports watermark filters and Delta Change Data Feed starting versions.
- **Monitoring** creates a run ID, UTC timestamp, status, and row-count metrics DataFrame.
- **Generated tests** add assertions for required columns, nulls, key uniqueness, and minimum row counts.

The builder also includes a visual execution path, a performance advisor, and a step preview that runs the notebook only through a selected transformation. Its local pipeline assistant maps plain-language goals to relevant transformations; always review the suggested fields, expressions, and sample values before running them.

Saved recipes can be exported to JSON and imported into another browser. Recipe files contain notebook configuration and do not contain source data. The footer **Documentation** link opens the complete in-app usage guide.

## Build for Windows

On a Windows 10 or 11 machine, install Python 3.11 and run `build_windows.bat` from this folder. The script creates `dist\LakeLoom-Windows.zip`; extract it and run `LakeLoom.exe`. The packaged launcher uses port 8000 by default and opens the app in your browser. If that port is busy, it selects an available local port and prints the address. Keep the console window open while using it, and press Ctrl+C there to stop the app. The package includes Python and the app dependencies, so Python is not needed on the target machine.

To enable Databricks preview in the packaged app, configure Databricks Connect authentication on that Windows machine first, using the Databricks CLI and the profile you intend to use. Notebook generation and export work without a Databricks connection.

You can also run the **Build Windows app** workflow from the repository's GitHub Actions tab. It uploads the same ZIP as a downloadable workflow artifact.

## Deploy to Databricks Apps

Deploy this project directory as a Databricks App. The included `app.yaml` starts the Flask app with Gunicorn. Grant `CAN USE` to the users or groups who should open it. Databricks Apps will require workspace authentication before a user can access the app. Grant the app service principal permission to use serverless compute and read only the Unity Catalog tables, volumes, or external locations needed by the preview.

Signing out is controlled by the Databricks workspace session. Use the workspace profile menu and choose **Sign out**; an app cannot revoke the user's workspace SSO session.
