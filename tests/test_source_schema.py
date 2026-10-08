import io
import json
import os
import unittest
from unittest.mock import MagicMock, patch

from werkzeug.datastructures import FileStorage

from app import app
from source_schema import inspect_files


def upload(content, name="sample.csv"):
    return FileStorage(stream=io.BytesIO(content if isinstance(content, bytes) else content.encode()), filename=name)


class SourceSchemaTests(unittest.TestCase):
    def test_csv_headers_and_inferred_types(self):
        result = inspect_files([upload("emp_id,emp_name,salary,department\n1,Madhur,9500.5,IT\n2,Sam,7000,HR\n")], "csv")
        self.assertEqual([(column["name"], column["type"]) for column in result["columns"]], [("emp_id", "bigint"), ("emp_name", "string"), ("salary", "double"), ("department", "string")])
        self.assertTrue(result["inferred"])

    def test_csv_rejects_duplicate_headers(self):
        with self.assertRaisesRegex(ValueError, "unique"):
            inspect_files([upload("emp_id,emp_id\n1,2\n")], "csv")

    def test_json_nested_columns_and_numeric_widening(self):
        rows = [{"emp_id": 1, "salary": 9000, "details": {"city": "Bijnor"}}, {"emp_id": 2, "salary": 9500.5, "details": {"city": "Delhi"}}]
        result = inspect_files([upload(json.dumps(rows), "sample.json")], "json")
        self.assertEqual(result["columns"][1]["type"], "double")
        self.assertEqual(result["columns"][2]["children"][0]["name"], "city")

    def test_json_lines_and_text(self):
        result = inspect_files([upload('{"emp_id":1}\n{"emp_id":2}\n', "sample.jsonl")], "json")
        self.assertEqual(result["columns"][0]["type"], "bigint")
        self.assertEqual(inspect_files([upload("some text", "sample.txt")], "text")["columns"], [{"name": "value", "type": "string"}])

    def test_multiple_files_with_conflicting_schema(self):
        with self.assertRaisesRegex(ValueError, "different schemas"):
            inspect_files([upload("emp_id\n1\n"), upload("order_details\na\n", "other.csv")], "csv")

    def test_parquet_and_orc_metadata(self):
        import pyarrow as pa
        import pyarrow.parquet as pq
        import pyarrow.orc as orc
        table = pa.table({"emp_id": [1], "emp_name": ["Madhur"], "salary": [9500.5]})
        for format_name, writer in [("parquet", pq.write_table), ("orc", orc.write_table)]:
            buffer = io.BytesIO()
            writer(table, buffer)
            result = inspect_files([upload(buffer.getvalue(), f"sample.{format_name}")], format_name)
            self.assertEqual([column["name"] for column in result["columns"]], table.column_names)
            self.assertFalse(result["inferred"])

    def test_avro_metadata(self):
        from fastavro import writer
        schema = {"type": "record", "name": "Employee", "fields": [{"name": "emp_id", "type": "long"}, {"name": "emp_name", "type": "string"}]}
        buffer = io.BytesIO()
        writer(buffer, schema, [{"emp_id": 1, "emp_name": "Madhur"}])
        result = inspect_files([upload(buffer.getvalue(), "sample.avro")], "avro")
        self.assertEqual(result["columns"], [{"name": "emp_id", "type": "long"}, {"name": "emp_name", "type": "string"}])

    def test_delta_version_metadata(self):
        def log(version, fields):
            schema = {"type": "struct", "fields": [{"name": name, "type": "string"} for name in fields]}
            return upload(json.dumps({"metaData": {"schemaString": json.dumps(schema)}}), f"table/_delta_log/{version:020d}.json")
        result = inspect_files([log(0, ["emp_id"]), log(2, ["emp_id", "emp_name"])], "delta", "1")
        self.assertEqual([column["name"] for column in result["columns"]], ["emp_id"])

    def test_iceberg_current_schema(self):
        metadata = {"current-schema-id": 2, "last-updated-ms": 100, "schemas": [{"schema-id": 1, "fields": [{"name": "old", "type": "string"}]}, {"schema-id": 2, "fields": [{"name": "emp_id", "type": "long", "required": True}]}]}
        result = inspect_files([upload(json.dumps(metadata), "table/metadata/001.metadata.json")], "iceberg")
        self.assertEqual(result["columns"][0]["name"], "emp_id")
        self.assertFalse(result["columns"][0]["nullable"])

    def test_upload_endpoint_needs_no_databricks_connection(self):
        with patch.dict(os.environ, {}, clear=True), patch("app._get_spark_session") as spark:
            response = app.test_client().post("/api/source-schema", data={"format": "csv", "files": (io.BytesIO(b"emp_id,emp_name\n1,Madhur\n"), "sample.csv")})
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json["origin"], "local")
        spark.assert_not_called()

    def test_managed_app_upload_requires_identity(self):
        with patch.dict(os.environ, {"DATABRICKS_APP_NAME": "lakeloom"}):
            response = app.test_client().post("/api/source-schema", data={"format": "csv"})
        self.assertEqual(response.status_code, 401)

    def test_remote_schema_reads_catalog_without_collecting_rows(self):
        spark = MagicMock()
        schema = spark.read.table.return_value.schema
        schema.jsonValue.return_value = {"fields": [{"name": "emp_id", "type": "long", "nullable": False}]}
        field = MagicMock()
        field.dataType.simpleString.return_value = "bigint"
        schema.fields = [field]
        spark.conf.get.return_value = "false"
        with patch.dict(os.environ, {}, clear=True), patch("app._has_databricks_connect_config", return_value=True), patch("app._get_spark_session", return_value=spark):
            response = app.test_client().post("/api/source-schema", json={"format": "delta", "path": "catalog.schema.employee"})
        self.assertEqual(response.status_code, 200)
        spark.read.table.assert_called_once_with("catalog.schema.employee")
        spark.read.table.return_value.collect.assert_not_called()
        self.assertEqual(response.json["columns"][0]["type"], "bigint")

    def test_remote_schema_rejects_local_file_uri(self):
        with patch.dict(os.environ, {}, clear=True), patch("app._has_databricks_connect_config", return_value=True):
            response = app.test_client().post("/api/source-schema", json={"format": "csv", "path": "file:///tmp/private.csv"})
        self.assertEqual(response.status_code, 400)


if __name__ == "__main__":
    unittest.main()
