# LakeLoom: 10–15 Minute Interview Guide

## 1. Introduction — 1 minute

> LakeLoom is a visual PySpark notebook builder for Databricks. A data engineer configures a source, inspects its schema, selects and orders transformations, and gets a readable notebook as the pipeline is built. The generated code stays visible and editable, and can be previewed with Databricks, saved as a recipe, or exported.
>
> The goal is to make common data engineering pipelines quicker to assemble and easier to review, while keeping users in control of the PySpark they run.

## 2. The problem — 1 minute

Data engineers repeatedly write similar code for:

- Selecting, renaming, and removing columns
- Handling nulls and duplicates
- Filtering, sorting, and aggregating records
- Flattening nested JSON
- Applying window functions and Delta operations
- Adding quality checks, joins, and pipeline monitoring

LakeLoom provides a visual way to configure these steps and generates ordinary PySpark. It helps reduce repetitive setup, gives users an early view of likely column mistakes, and produces notebooks that can still be edited and reviewed in Databricks.

## 3. Source selection and schema inspection — 2 minutes

LakeLoom supports three source workflows:

### Local files and table folders

Users can select CSV, JSON, TXT, Parquet, Avro, or ORC files. **Browse folder** can inspect Delta folders through `_delta_log` and Iceberg folders through their metadata. The format is detected from the selection and remains editable.

Local files are sent to the LakeLoom backend for schema inspection only; they are not saved or uploaded to Databricks. CSV and JSON types are inferred from up to 1,000 records per file. Parquet, ORC, Avro, Delta, and Iceberg use stored metadata. Local inspection supports selections up to 60 MB. The generated notebook still needs an equivalent Databricks-accessible path for execution.

### Databricks sources

Users can enter a Unity Catalog table or a Databricks-accessible path. They can also load the schema from Databricks when local metadata is unavailable or the source is too large for local inspection.

### Schema validation

> LakeLoom displays source columns, Spark SQL types, and nested fields. Once a schema is loaded, it checks selected transformation inputs in order and warns about unknown columns, including common SQL and `F.col(...)` references. It accounts for outputs created, renamed, selected, removed, aggregated, or flattened by earlier steps.

Dynamic pivot columns, nested fields that cannot be determined locally, manual notebook edits, and Delta management fields that refer to a separate target table still need Spark validation. Changing the source clears its previous schema and warnings.

## 4. Transformation library — 2 minutes

The searchable transformation library is organized into:

- **Select & shape:** select, create, rename, remove, and standardize columns
- **Data quality:** null handling, duplicate removal, key deduplication, and latest records
- **Filter & sort:** filter expressions, sorting, and row limits
- **Columns & expressions:** text, numeric, conditional, array, map, and JSON functions
- **Date & time:** parsing, formatting, comparison, and date shifting
- **Analytics:** grouping, aggregation, pivoting, ranking, and cumulative totals
- **DataFrame tools:** intermediate DataFrames and typed sample DataFrames
- **Engineering modules:** profiling, quality rules, joins, branching, rejects, schema comparison, parameters, incremental loading, monitoring, and generated tests
- **Delta & SCD:** Delta maintenance and dimension history

> Choosing a transformation opens its settings. The live notebook preview updates as settings change, and the selected steps run in their chosen order. Dropdowns include help text, and unknown input columns show warnings beside the relevant settings.

## 5. Nested JSON flattening — 1–2 minutes

LakeLoom supports struct paths, one array with optional nested struct expansion, and a plan for multiple nested arrays. For multiple arrays, the user enters ordered explode steps:

```text
orders -> order
order.items -> item
```

Then the user lists the fields to select and optional output aliases:

```text
user_id
address.city -> city
order.order_id -> order_id
item.product_id -> product_id
item.quantity -> quantity
```

Generated PySpark pattern:

```python
df = (
    df
    .withColumn("order", F.explode(F.col("orders")))
    .withColumn("item", F.explode(F.col("order.items")))
    .select(
        F.col("user_id"),
        F.col("address.city").alias("city"),
        F.col("order.order_id").alias("order_id"),
        F.col("item.product_id").alias("product_id"),
        F.col("item.quantity").alias("quantity")
    )
)
```

> Each explode step names the array element for use by later steps. The final `select` keeps the requested leaf fields. Exploding arrays can multiply rows, so the performance advisor suggests profiling row counts around flattening.

## 6. DataFrames and generated-code optimization — 1 minute

Users can divide a pipeline into named DataFrames, such as `df_next` and `df_part`. Each new DataFrame can start from the **Current result** or the **Original source**. Original-source mode preserves the original lazy reference before transformations; neither option copies, caches, or checkpoints the data.

LakeLoom groups compatible independent calculated-column and date-expression mappings with `withColumns`. References to earlier outputs, repeated output names, and complex expressions remain sequential when needed. Transformation order is preserved because moving filters, sorts, windows, or aggregations can change results. The optimization can reduce projection-plan overhead for eligible mappings, but execution time still depends on data size, shuffles, storage, and Databricks compute. Manual code edits are not automatically optimized.

## 7. Engineering modules — 1–2 minutes

The **Engineering modules** category adds common production-pipeline building blocks to the generated notebook:

- **Profile DataFrame:** reports per-column null and distinct counts and summary statistics; users can choose columns and a sample fraction.
- **Data quality rules:** evaluates named Spark SQL conditions, creates valid and failed DataFrames, and records which rules failed.
- **Join another DataFrame:** reads a table and joins on configurable left-to-right keys using a selected join type.
- **Branch the pipeline:** creates matching and nonmatching DataFrames from a condition.
- **Capture rejected records:** separates invalid rows and attaches a rejection reason.
- **Compare target schema:** displays source and target field types and differences. The merge option adds `mergeSchema` guidance for a Delta write; it does not perform the write by itself.
- **Notebook parameters:** creates Databricks widgets for user-supplied values such as environment or processing date.
- **Incremental loading:** filters on a timestamp watermark or reads Delta Change Data Feed from a starting version.
- **Pipeline monitoring:** creates a run ID, UTC completion timestamp, row count, and status DataFrame.
- **Generated data tests:** adds executable assertions for required columns, nulls, unique keys, and minimum row count.

The outputs remain standard PySpark operations. Users should review the generated conditions, table names, parameters, and sample values before running the notebook.

## 8. Delta Lake and SCD — 1 minute

### SCD Type 1

Keeps the latest value for each business key. Matching rows are updated, so previous values are not retained.

### SCD Type 2

Preserves history by expiring the current row and inserting a new version. It uses fields such as `valid_from`, `valid_to`, and `is_current`.

Other Delta operations include inspecting table history and metadata, comparing versions, deleting matching records, restoring a previous version, and vacuuming old files.

> Delta maintenance and SCD actions can change a target table. The generated code stays visible so the user can review the target and operation. These actions are excluded from LakeLoom's read-only run preview.

## 9. Pipeline tools, preview, and export — 1 minute

The builder includes three pipeline tools:

- **Visual execution path** shows the source, ordered transformations, and preview or output.
- **Performance advisor** flags structural patterns such as sorting before filtering, wide joins, array explosions, large window shuffles, and long unnamed pipelines. Its suggestions are heuristics for review.
- **Step preview** runs the notebook only through a selected transformation to help locate where results change.

The full **Run preview** executes through Databricks Connect or a Databricks App connection. It returns up to 100 rows, skips output writes, and does not run Delta management or SCD merge steps. Building and exporting notebooks work without Databricks; PySpark execution requires Databricks compute and source permissions.

Users can edit the generated code, copy it, reset manual edits, or export as:

- Databricks Python notebook (`.py`)
- Jupyter notebook (`.ipynb`)
- Plain text (`.txt`)
- Markdown (`.md`)
- HTML (`.html`)
- PDF through the browser print dialog

## 10. Recipes, history, and help — 1 minute

> Users can save the source configuration, transformations, and output settings as a recipe, then restore that configuration later. Recipes and activity history are stored in the current browser profile. Recipes can be exported to JSON and imported in another browser; recipe files contain configuration, not source data.

The in-app Documentation view covers setup, transformations, nested JSON, and common questions. The Help center has searchable topics for Databricks connection, preview problems, sources and schemas, exports, and recipes.

## 11. Technical implementation — 1 minute

> The frontend uses HTML, CSS, and JavaScript to manage the builder state, show schema feedback, and generate PySpark. The Flask backend serves the app, inspects local source metadata, and connects to Databricks for schema loading and preview.
>
> Databricks preview uses Databricks Connect with serverless compute. In a local run, it uses the configured profile of the person running Flask. In Databricks Apps, it runs as the app service principal. The UI does not receive the forwarded access token. Recipes and local activity are stored in the browser.

## Challenges to discuss

### Nested schema handling

Tracking fields through nested structs and arrays while validating each step in order was a key challenge.

### Transformation ordering

A field may exist in the source but disappear after a select, rename, aggregation, or flattening operation. Validation therefore simulates the pipeline step by step.

### Code generation

The generated code must remain readable while preserving dependencies between expressions and transformations. Eligible independent expressions can be batched without moving transformations whose order changes the result.

### Safe, useful preview

Preview should help users inspect results while keeping execution bounded and avoiding output writes or table-management actions. Databricks authentication also needs to stay on the backend.

### User experience

The interface must guide beginners while keeping the actual PySpark visible for experienced engineers. Visual pipeline tools and field-level warnings provide guidance without hiding the generated code.

## Closing statement — 30 seconds

> LakeLoom combines a visual pipeline builder with transparent PySpark generation. It supports source inspection, ordered column validation, nested JSON, multiple DataFrames, production engineering modules, Delta operations, bounded Databricks preview, reusable recipes, and notebook export.
>
> Its value is helping data engineers assemble and review pipelines faster while keeping the final code understandable and under their control.

## Recommended live demonstration order

1. Open **Overview** and briefly explain the builder.
2. Go to **Notebook builder** and select a JSON file.
3. Show format detection, nested schema display, and column validation.
4. Add **Flatten nested JSON** and demonstrate a multiple-array explode plan.
5. Add a named data quality rule and a generated test.
6. Show the generated code and visual execution path.
7. Open the performance advisor and step preview controls.
8. Show a DataFrame boundary or the original-source option.
9. Run a bounded preview if Databricks is connected; otherwise show the generated notebook and export options.
10. Show saved recipes, JSON import/export, and the Documentation or Help center.

## Presentation advice

- Demonstrate one simple feature and one complex feature.
- Explain the problem before showing the solution.
- Keep the generated PySpark visible during the demonstration.
- Review generated values and conditions before running them.
- Mention one technical challenge and how you solved it.
- Finish by explaining the value to data engineers.
