# LakeLoom: 10–15 Minute Interview Guide

## 1. Introduction — 1 minute

> LakeLoom is a web application that helps data engineers generate PySpark notebooks without manually writing every transformation.
>
> A user selects a data source, inspects its schema, chooses transformations, and immediately sees the generated PySpark code. The notebook can then be previewed with Databricks or exported in several formats.
>
> My main goal was to make common data engineering work faster, easier to understand, and reusable.

## 2. The problem — 1 minute

Data engineers repeatedly write similar PySpark code for:

- Selecting, renaming, and removing columns
- Handling null values and duplicates
- Filtering, sorting, and aggregating records
- Flattening nested JSON
- Applying window functions
- Writing transformed output

This work can be slow and error prone. LakeLoom provides a visual interface for configuring these operations while keeping the generated PySpark visible and editable.

Key benefits:

- Reduces repetitive PySpark coding
- Helps beginners understand PySpark
- Makes pipelines easier to review
- Detects common column mistakes early
- Produces reusable, editable notebooks

## 3. Source selection and schema inspection — 2 minutes

LakeLoom supports three source methods.

### Files

Users can select CSV, JSON, TXT, Parquet, Avro, or ORC files. The format is detected from the file extension and remains editable when needed.

### Table folder

Users can select a complete Delta or Iceberg table directory.

### Databricks

Users can enter a Unity Catalog table name or a Databricks storage path.

### Schema inspection

> LakeLoom inspects the selected source and displays its columns and Spark SQL types. It uses this information to validate transformation settings. If a transformation references an unavailable column, the field is highlighted before the notebook runs.

Local files are used for schema inspection and are not uploaded to Databricks. The generated notebook reads from the Databricks path provided by the user.

## 4. Transformation library — 2 minutes

The searchable transformation library is organized into these categories:

- **Select and shape:** select, create, rename, remove, and standardize columns
- **Data quality:** null handling, duplicate removal, key deduplication, and latest records
- **Filter and sort:** filter expressions, sorting, and row limits
- **Expressions:** text, numeric, conditional, array, map, and JSON functions
- **Dates:** parsing, formatting, comparison, and date shifting
- **Analytics:** grouping, aggregation, pivoting, ranking, and cumulative totals
- **DataFrame tools:** intermediate DataFrames and typed sample DataFrames
- **Delta and SCD:** Delta maintenance and dimension history

> Selecting a transformation opens its settings. Dropdown options include explanations. Transformations run in selection order, and the live code preview updates whenever a setting changes.

## 5. Nested JSON flattening — 2 minutes

LakeLoom supports:

- Struct-only paths
- A single array
- Multiple nested arrays

For multiple arrays, enter an ordered explode plan:

```text
orders -> order
order.items -> item
```

Then select and rename the required fields:

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

> The first line explodes `orders` and names each element `order`. The second line explodes the `items` array inside each order and names each element `item`. The output list selects the final leaf fields.

If an output alias changes, LakeLoom updates dependent paths in the form automatically.

## 6. Multiple DataFrames and optimization — 1 minute

Users can divide a pipeline into multiple DataFrames, such as `df_next` and `df_part`.

Each new DataFrame can start from:

- **Current result:** continue all preceding transformations
- **Original source:** restart from the original input DataFrame

> Spark DataFrames are lazy query plans. Assigning a new variable does not copy, execute, cache, or checkpoint the data.

LakeLoom also groups compatible calculated columns with `withColumns` when it is safe. Dependent expressions remain in their required order.

## 7. Delta Lake and SCD — 1–2 minutes

### SCD Type 1

Keeps only the latest value for each business key. Matching rows are updated, so previous values are not retained.

### SCD Type 2

Preserves history by expiring the current row and inserting a new version. It uses fields such as `valid_from`, `valid_to`, and `is_current`.

Other Delta operations include:

- Inspect table history and metadata
- Compare Delta versions
- Delete matching records
- Restore a previous version
- Vacuum old files

> Delta operations can change a target table. LakeLoom keeps the generated code visible so the user can review the target and operation first.

## 8. Preview, output, and export — 1 minute

The live preview displays the generated notebook. Users can:

- Edit the generated code
- Copy the code
- Reset manual edits
- Run a limited Databricks preview when connected

Supported output formats:

- Delta
- CSV
- JSON
- TXT
- Parquet
- Avro
- ORC
- Iceberg

Supported export formats:

- Databricks Python notebook (`.py`)
- Jupyter notebook (`.ipynb`)
- Plain text (`.txt`)
- Markdown (`.md`)
- HTML (`.html`)
- PDF through the browser print dialog

## 9. Recipes, history, and documentation — 1 minute

> Users can save the current source, transformations, and output settings as a recipe and restore the configuration later.

Recipes and local activity history are stored in the current browser profile. Source file contents are not stored in recipes.

The in-app documentation includes:

- Quick-start instructions
- Transformation reference
- Nested JSON examples
- Delta and SCD guidance
- Troubleshooting questions

## 10. Technical implementation — 1 minute

> The frontend uses HTML, CSS, and JavaScript. It manages interface state, validates columns, and generates PySpark dynamically.
>
> The backend uses Flask for application serving, source inspection, and preview integration. PySpark code uses `from pyspark.sql import functions as F` to keep function calls clear and avoid naming conflicts.
>
> Browser storage holds recipes and local activity. Databricks authentication is required for workspace operations.

## Challenges to discuss

### Nested schema handling

Tracking fields through nested structs and arrays while validating each step in order was a key challenge.

### Transformation ordering

A field may exist in the source but disappear after a select, rename, aggregation, or flattening operation. Validation therefore simulates the pipeline step by step.

### Code generation

The generated code must remain readable while preserving dependencies between expressions and transformations.

### User experience

The interface must guide beginners while keeping the actual PySpark visible for experienced engineers.

## Closing statement — 30 seconds

> LakeLoom combines visual configuration with transparent PySpark generation. It supports source inspection, column validation, nested JSON, multiple DataFrames, Delta operations, Databricks preview, reusable recipes, and notebook export.
>
> Its main value is helping users build pipelines faster while still allowing them to understand and control the final code.

## Recommended live demonstration order

1. Open **Overview**.
2. Go to **Notebook builder**.
3. Select a JSON file.
4. Show format detection and schema inspection.
5. Select **Flatten nested JSON**.
6. Demonstrate the multiple-array explode plan.
7. Add one data-quality transformation.
8. Show column validation and generated code.
9. Show output configuration.
10. Open the export menu.
11. Show saved recipes and history.
12. Open the in-app documentation.

## Presentation advice

- Demonstrate one simple feature and one complex feature.
- Explain the problem before showing the solution.
- Avoid opening every transformation card.
- Keep the generated PySpark visible during the demonstration.
- Mention one technical challenge and how you solved it.
- Finish by explaining the value to data engineers.

