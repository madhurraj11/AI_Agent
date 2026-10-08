"""Read source column metadata without running user-supplied code."""

import csv
import io
import json
import re
from itertools import islice


SAMPLE_ROWS = 1000


def _type(value, strings=False):
    if value is None or (strings and value == ""):
        return "unknown"
    if strings:
        if value.lower() in {"true", "false"}:
            return "boolean"
        if re.fullmatch(r"[+-]?\d+", value):
            return "bigint"
        try:
            float(value)
            return "double"
        except ValueError:
            return "string"
    if isinstance(value, bool):
        return "boolean"
    if isinstance(value, int):
        return "bigint"
    if isinstance(value, float):
        return "double"
    if isinstance(value, dict):
        return "struct"
    if isinstance(value, list):
        return "array"
    return "string"


def _merge_type(left, right):
    if left == "unknown":
        return right
    if right == "unknown" or left == right:
        return left
    if {left, right} <= {"bigint", "double"}:
        return "double"
    return "string"


def _infer_records(records, strings=False):
    values = {}
    for row in records:
        if not isinstance(row, dict):
            raise ValueError("JSON records must be objects with named fields.")
        for name, value in row.items():
            values.setdefault(str(name), []).append(value)
    columns = []
    for name, samples in values.items():
        kind = "unknown"
        for value in samples:
            kind = _merge_type(kind, _type(value, strings))
        column = {"name": name, "type": kind}
        if kind == "struct":
            column["children"] = _infer_records([value for value in samples if isinstance(value, dict)])
            column["type"] = "struct<" + ",".join(f"{c['name']}:{c['type']}" for c in column["children"]) + ">"
        elif kind == "array":
            items = [item for value in samples if isinstance(value, list) for item in value][:SAMPLE_ROWS]
            element_type = "unknown"
            for item in items:
                element_type = _merge_type(element_type, _type(item))
            if element_type == "struct":
                column["children"] = _infer_records([item for item in items if isinstance(item, dict)])
                element_type = "struct<" + ",".join(f"{c['name']}:{c['type']}" for c in column["children"]) + ">"
            column["type"] = f"array<{element_type}>"
        columns.append(column)
    return columns


def _spark_fields(fields):
    columns = []
    for field in fields:
        datatype = field["type"]
        children = []
        if isinstance(datatype, dict):
            kind = datatype.get("type", "unknown")
            if kind == "struct":
                children = _spark_fields(datatype.get("fields", []))
                kind = "struct<" + ",".join(f"{c['name']}:{c['type']}" for c in children) + ">"
            elif kind in {"array", "list"}:
                element = datatype.get("elementType", datatype.get("element", "unknown"))
                if isinstance(element, dict) and element.get("type") == "struct":
                    children = _spark_fields(element.get("fields", []))
                element_name = element if isinstance(element, str) else _spark_fields([{"name": "element", "type": element}])[0]["type"]
                kind = f"array<{element_name}>"
            elif kind == "map":
                key = datatype.get("keyType", datatype.get("key", "unknown"))
                value = datatype.get("valueType", datatype.get("value", "unknown"))
                key_name = _spark_fields([{"name": "key", "type": key}])[0]["type"]
                value_name = _spark_fields([{"name": "value", "type": value}])[0]["type"]
                kind = f"map<{key_name},{value_name}>"
        else:
            kind = datatype
        column = {"name": field["name"], "type": kind, "nullable": field.get("nullable", not field.get("required", False))}
        if children:
            column["children"] = children
        columns.append(column)
    return columns


def spark_columns(schema):
    columns = _spark_fields(schema.jsonValue()["fields"])
    for column, field in zip(columns, schema.fields):
        column["type"] = field.dataType.simpleString()
    return columns


def _arrow_columns(schema):
    import pyarrow as pa

    def sql_type(dtype):
        if pa.types.is_struct(dtype):
            return 'struct<' + ','.join(f'{field.name}:{sql_type(field.type)}' for field in dtype) + '>'
        if pa.types.is_list(dtype) or pa.types.is_large_list(dtype) or pa.types.is_fixed_size_list(dtype):
            return f'array<{sql_type(dtype.value_type)}>'
        if pa.types.is_map(dtype):
            return f'map<{sql_type(dtype.key_type)},{sql_type(dtype.item_type)}>'
        if pa.types.is_decimal(dtype):
            return f'decimal({dtype.precision},{dtype.scale})'
        if pa.types.is_integer(dtype):
            if pa.types.is_unsigned_integer(dtype):
                return {8: 'smallint', 16: 'int', 32: 'bigint', 64: 'decimal(20,0)'}[dtype.bit_width]
            return {8: 'tinyint', 16: 'smallint', 32: 'int', 64: 'bigint'}[dtype.bit_width]
        if pa.types.is_floating(dtype):
            return 'double' if dtype.bit_width == 64 else 'float'
        if pa.types.is_boolean(dtype): return 'boolean'
        if pa.types.is_date(dtype): return 'date'
        if pa.types.is_timestamp(dtype): return 'timestamp' if dtype.tz else 'timestamp_ntz'
        if pa.types.is_string(dtype) or pa.types.is_large_string(dtype): return 'string'
        if pa.types.is_binary(dtype) or pa.types.is_large_binary(dtype) or pa.types.is_fixed_size_binary(dtype): return 'binary'
        if pa.types.is_null(dtype): return 'void'
        return f'unsupported ({dtype})'

    def convert(field):
        column = {"name": field.name, "type": sql_type(field.type), "nullable": field.nullable}
        dtype = field.type
        if pa.types.is_list(dtype) or pa.types.is_large_list(dtype):
            dtype = dtype.value_type
        if pa.types.is_struct(dtype):
            column["children"] = [convert(child) for child in dtype]
        return column

    return [convert(field) for field in schema]


def _avro_columns(schema):
    fields = schema.get("fields", []) if isinstance(schema, dict) else []
    columns = []
    for field in fields:
        dtype = field["type"]
        if isinstance(dtype, list):
            dtype = next((item for item in dtype if item != "null"), "null")
        column = {"name": field["name"], "type": str(dtype) if isinstance(dtype, str) else dtype.get("logicalType", dtype.get("type", "unknown"))}
        if isinstance(dtype, dict) and dtype.get("type") == "record":
            column["children"] = _avro_columns(dtype)
            column["type"] = "struct<" + ",".join(f"{c['name']}:{c['type']}" for c in column["children"]) + ">"
        elif isinstance(dtype, dict) and dtype.get("type") == "array":
            element = _avro_columns({"fields": [{"name": "element", "type": dtype.get("items", "null")}]})[0]
            column["type"] = f"array<{element['type']}>"
            if element.get("children"):
                column["children"] = element["children"]
        elif isinstance(dtype, dict) and dtype.get("type") == "map":
            element = _avro_columns({"fields": [{"name": "value", "type": dtype.get("values", "null")}]})[0]
            column["type"] = f"map<string,{element['type']}>"
        columns.append(column)
    return columns


def inspect_files(files, source_format, version=""):
    """Inspect metadata, or infer CSV/JSON types from at most 1,000 records per file."""
    if not files:
        raise ValueError("Select a file or table folder first.")
    if source_format == "delta":
        logs = []
        for file in files:
            name = file.filename.replace("\\", "/")
            match = re.search(r"(?:^|/)_delta_log/(\d+)\.json$", name)
            if match and (not version or int(match[1]) <= int(version)):
                logs.append((int(match[1]), file))
        for _, file in sorted(logs, key=lambda item: item[0], reverse=True):
            for line in io.TextIOWrapper(file.stream, encoding="utf-8-sig"):
                metadata = json.loads(line).get("metaData")
                if metadata and metadata.get("schemaString"):
                    return {"columns": _spark_fields(json.loads(metadata["schemaString"])["fields"]), "inferred": False}
        raise ValueError("This folder has no readable Delta schema in its JSON transaction log. Use Load from Databricks for checkpoint-only tables.")
    if source_format == "iceberg":
        metadata = []
        for file in files:
            if file.filename.endswith(".metadata.json"):
                value = json.load(file.stream)
                metadata.append(value)
        if not metadata:
            raise ValueError("Select an Iceberg folder containing a metadata.json file, or load its schema from Databricks.")
        value = max(metadata, key=lambda item: item.get("last-updated-ms", 0))
        schema = next((item for item in value.get("schemas", []) if item.get("schema-id") == value.get("current-schema-id")), value.get("schema", {}))
        fields = [{"name": field["name"], "type": field["type"], "nullable": not field.get("required", False)} for field in schema.get("fields", [])]
        return {"columns": _spark_fields(fields), "inferred": False}

    schemas = []
    for file in files:
        if source_format == "csv":
            text = io.TextIOWrapper(file.stream, encoding="utf-8-sig", newline="")
            reader = csv.DictReader(text)
            if not reader.fieldnames or any(not name for name in reader.fieldnames) or len(set(reader.fieldnames)) != len(reader.fieldnames):
                raise ValueError("CSV files need a header with unique, nonempty column names.")
            rows = list(islice(reader, SAMPLE_ROWS))
            if any(None in row for row in rows):
                raise ValueError("CSV rows contain more values than the header. Check the comma delimiter.")
            columns = _infer_records(rows, strings=True) if rows else [{"name": name, "type": "unknown"} for name in reader.fieldnames]
        elif source_format == "json":
            text = file.stream.read().decode("utf-8-sig")
            try:
                value = json.loads(text)
                rows = value if isinstance(value, list) else [value]
            except json.JSONDecodeError:
                rows = [json.loads(line) for line in islice((line for line in text.splitlines() if line.strip()), SAMPLE_ROWS)]
            columns = _infer_records(rows[:SAMPLE_ROWS])
        elif source_format == "text":
            columns = [{"name": "value", "type": "string"}]
        elif source_format == "parquet":
            import pyarrow.parquet as pq
            columns = _arrow_columns(pq.read_schema(file.stream))
        elif source_format == "orc":
            import pyarrow.orc as orc
            columns = _arrow_columns(orc.ORCFile(file.stream).schema)
        elif source_format == "avro":
            from fastavro import reader
            columns = _avro_columns(reader(file.stream).writer_schema)
        else:
            raise ValueError("Choose a supported source format.")
        schemas.append(columns)
    # Different file schemas need Spark reader options that this builder does not set.
    signature = lambda columns: [(column["name"], column["type"]) for column in columns]
    if any(signature(columns) != signature(schemas[0]) for columns in schemas[1:]):
        raise ValueError("The selected files have different schemas or inferred types. Select one file or use Load from Databricks to resolve the actual source schema.")
    return {"columns": schemas[0], "inferred": source_format in {"csv", "json"}}
