const transformations = [
  { id: 'selectColumns', category: 'shape', icon: '☷', title: 'Select required columns', description: 'Keep selected fields or choose a range of columns by position.', fields: [
    { key: 'mode', label: 'Selection method', type: 'select', value: 'columns', options: [['columns', 'Choose columns'], ['range', 'Choose by column position']] },
    { key: 'columns', label: 'Columns to keep', type: 'input', value: 'employee_id, employee_name, salary', placeholder: 'employee_id, employee_name, salary', wide: true, when: { key: 'mode', value: 'columns' } },
    { ...inputField('startIndex', 'Start position (included)', '1', false, '1', 'Zero-based column position.'), when: { key: 'mode', value: 'range' } },
    { ...inputField('endIndex', 'End position (excluded)', '6', false, '6', 'Matches Python slicing: columns[1:6].'), when: { key: 'mode', value: 'range' } }
  ]},
  { id: 'createColumns', category: 'shape', icon: '＋', title: 'Create calculated columns', description: 'Add one or more columns from Spark SQL expressions.', fields: [
    { key: 'mappings', label: 'New column : expression', type: 'textarea', value: 'total_comp: salary + bonus\nannual_salary: salary * 12', placeholder: 'total_comp: salary + bonus\nannual_salary: salary * 12', wide: true, hint: 'One per line. Supports SQL functions and CASE WHEN expressions.' }
  ]},
  { id: 'rename', category: 'shape', icon: '✎', title: 'Rename columns', description: 'Rename one or several fields.', fields: [
    { key: 'mappings', label: 'Old name : new name', type: 'textarea', value: 'salary: base_salary\nemp_id: employee_id', placeholder: 'salary: base_salary\nemp_id: employee_id', wide: true, hint: 'One mapping per line.' }
  ]},
  { id: 'dropColumns', category: 'shape', icon: '⊖', title: 'Remove columns', description: 'Drop one or more fields from the DataFrame.', fields: [
    { key: 'columns', label: 'Columns to remove', type: 'input', value: 'age, bonus', placeholder: 'age, bonus', wide: true }
  ]},
  { id: 'standardizeNames', category: 'shape', icon: 'Aa', title: 'Standardize column names', description: 'Normalize names to lowercase snake_case.', fields: [] },
  { id: 'nulls', category: 'quality', icon: '∅', title: 'Handle null values', description: 'Fill nulls, drop incomplete rows, or replace nulls in a column.', fields: [
    { key: 'strategy', label: 'Null handling method', type: 'select', value: 'dropAny', options: [['dropAny', 'Drop rows with any null'], ['dropAll', 'Drop fully empty rows'], ['dropSubset', 'Drop rows with null keys'], ['fillValue', 'Fill nulls with one value'], ['fillMap', 'Fill different columns'], ['coalesce', 'Replace null with fallback'], ['nvl', 'Replace null (NVL)'], ['nullif', 'Convert matching value to null']] },
    { key: 'columns', label: 'Columns / null keys', type: 'input', value: 'employee_id, salary', placeholder: 'employee_id, salary', hint: 'Comma separated.', whenAny: { key: 'strategy', values: ['dropSubset', 'fillValue'] } },
    { key: 'fillValue', label: 'Fill / compare value', type: 'input', value: '0', placeholder: '0', whenAny: { key: 'strategy', values: ['fillValue', 'coalesce', 'nvl', 'nullif'] } },
    { key: 'mappings', label: 'Column : fill value', type: 'textarea', value: 'bonus: 0\ndepartment: Unknown', placeholder: 'bonus: 0\ndepartment: Unknown', wide: true, hint: 'Strings and numbers are inferred.', when: { key: 'strategy', value: 'fillMap' } },
    { key: 'target', label: 'Column to update', type: 'input', value: 'bonus', placeholder: 'bonus', whenAny: { key: 'strategy', values: ['coalesce', 'nvl', 'nullif'] } }
  ]},
  { id: 'distinct', category: 'quality', icon: '◫', title: 'Keep distinct values', description: 'Return unique values, optionally for selected columns.', fields: [
    { key: 'columns', label: 'Distinct columns', type: 'input', value: 'department', placeholder: 'department', hint: 'Leave blank to return distinct full rows.' }
  ]},
  { id: 'duplicates', category: 'quality', icon: '▤', title: 'Remove duplicate rows', description: 'Keep one row per full record or selected key.', fields: [
    { key: 'columns', label: 'Duplicate key columns', type: 'input', value: 'employee_id', placeholder: 'employee_id', hint: 'Leave blank to compare every column.' }
  ]},
  { id: 'dedupKeys', category: 'quality', icon: '↧', title: 'Deduplicate by key', description: 'Keep one row for each business key.', fields: [
    { key: 'keys', label: 'Key columns', type: 'input', value: 'employee_id, department', placeholder: 'employee_id, department', wide: true }
  ]},
  { id: 'latest', category: 'quality', icon: '◴', title: 'Keep latest record', description: 'Keep the newest row for each key using a timestamp.', fields: [
    { key: 'keys', label: 'Key columns', type: 'input', value: 'employee_id', placeholder: 'employee_id', wide: true },
    { key: 'timestamp', label: 'Timestamp column', type: 'input', value: 'updated_at', placeholder: 'updated_at' }
  ]},
  { id: 'filter', category: 'filtering', icon: '▽', title: 'Filter records', description: 'Filter or where with AND, OR, ranges, null checks, sets, and text matches.', fields: [
    { key: 'method', label: 'Spark method', type: 'select', value: 'filter', options: [['filter', 'filter()'], ['where', 'where()']] },
    { key: 'condition', label: 'Condition (PySpark or Spark SQL)', type: 'textarea', value: '(F.col("state") == "CA") & (F.col("salary") >= 5000)', placeholder: '(F.col("state") == "CA") & (F.col("salary") >= 5000)', wide: true, hint: 'PySpark examples: F.col("state").isin(["CA", "AK", "NY"]), F.col("employee_name").startswith("M"), .endswith("a"), .contains("an"), .like("A%"), .ilike("%AM%"). Spark SQL conditions such as salary > 3000 AND department = \'IT\' are also accepted.' }
  ]},
  { id: 'sort', category: 'filtering', icon: '↕', title: 'Sort rows', description: 'Sort ascending, descending, or by multiple fields.', fields: [
    { key: 'method', label: 'Sorting method', type: 'select', value: 'orderBy', options: [['orderBy', 'orderBy()'], ['sort', 'sort()']] },
    { key: 'mappings', label: 'Column : direction', type: 'textarea', value: 'department: asc\nsalary: desc', placeholder: 'department: asc\nsalary: desc', wide: true, hint: 'One per line. Direction can be asc or desc.' }
  ]},
  { id: 'limit', category: 'filtering', icon: '⇣', title: 'Limit output rows', description: 'Return the first N rows.', fields: [
    { key: 'count', label: 'Maximum rows', type: 'input', value: '10', placeholder: '10', wide: true }
  ]},
  { id: 'conditional', category: 'expressions', icon: '⌥', title: 'Classify with conditions', description: 'Map conditions to results; the first matching rule wins.', fields: [
    { key: 'target', label: 'New column', type: 'input', value: 'salary_category', placeholder: 'category', wide: true },
    { key: 'cases', label: 'Condition, result (one per line)', type: 'textarea', value: "F.col('salary') >= 9000, 'High'\n(F.col('salary') >= 5000) & (F.col('salary') < 9000), 'Medium'\nF.col('salary') < 5000, 'Low'", placeholder: "F.col('salary') >= 9000, 'High'\n(F.col('salary') >= 5000) & (F.col('salary') < 9000), 'Medium'\nF.col('salary') < 5000, 'Low'", wide: true, hint: 'Use PySpark Column expressions (F.col(...)) or Spark SQL conditions. Rules run from top to bottom.' },
    { key: 'otherwise', label: 'Default when no condition matches', type: 'input', value: 'Unknown', placeholder: 'Unknown' }
  ]},
  { id: 'dates', category: 'dates', icon: '◷', title: 'Date & time functions', description: 'Parse, extract, format, compare, and shift dates.', fields: [
    { key: 'mappings', label: 'Output column : SQL expression', type: 'textarea', value: "joining_date: to_date(joining_date, 'yyyy-MM-dd')\nyear: year(joining_date)\ndays: datediff(current_date(), joining_date)\nload_timestamp: current_timestamp()", placeholder: "joining_date: to_date(joining_date, 'yyyy-MM-dd')\nyear: year(joining_date)\ndays: datediff(current_date(), joining_date)\nload_timestamp: current_timestamp()", wide: true, hint: 'Functions: to_date, year, month, dayofmonth, datediff, date_add, date_format, current_date, current_timestamp, add_months, months_between, last_day, next_day.' }
  ]},
  { id: 'trimAll', category: 'expressions', icon: '↔', title: 'Trim all string columns', description: 'Remove leading and trailing whitespace from every string field.', fields: [] },
  { id: 'aggregate', category: 'analytics', icon: 'Σ', title: 'Group & aggregate', description: 'Count, sum, average, combine aggregates, or pivot rows to columns.', fields: [
    { key: 'mode', label: 'Aggregation type', type: 'select', value: 'group', options: [['group', 'Group by'], ['pivot', 'Pivot rows to columns']] },
    { key: 'groups', label: 'Group-by columns', type: 'input', value: 'department', placeholder: 'department' },
    { key: 'pivot', label: 'Pivot column', type: 'input', value: 'department', placeholder: 'department' },
    { key: 'mappings', label: 'Output name : aggregate', type: 'textarea', value: 'emp_count: count(*)\ntotal_salary: sum(salary)\navg_salary: avg(salary)', placeholder: 'emp_count: count(*)\ntotal_salary: sum(salary)\navg_salary: avg(salary)', wide: true, hint: 'Spark SQL aggregate expressions: count, sum, avg, min, max.' }
  ]},
];

function inputField(key, label, placeholder, wide = false, value = null, hint = '') {
  return { key, label, type: 'input', value: value === null ? placeholder : value, placeholder, wide, hint };
}

function textOperation(spec) {
  const source = inputField('source', 'Source column', 'employee_name');
  const target = inputField('target', 'Output column', 'name_clean');
  const fields = spec.fields.map(field => ({ ...field }));
  if (spec.needsSource !== false) fields.unshift(source);
  if (spec.needsTarget !== false) fields.push(target);
  return { id: `text_${spec.fn}`, kind: 'text', presetFn: spec.fn, category: 'expressions', icon: 'Tt', title: spec.title, description: spec.description, fields };
}

const textOperations = [
  ['upper', 'Uppercase text', 'Convert text to uppercase.', []],
  ['lower', 'Lowercase text', 'Convert text to lowercase.', []],
  ['initcap', 'Proper case', 'Capitalize the first letter of each word.', []],
  ['trim', 'Trim spaces', 'Remove spaces from both ends of text.', []],
  ['ltrim', 'Remove left spaces', 'Remove leading spaces.', []],
  ['rtrim', 'Remove right spaces', 'Remove trailing spaces.', []],
  ['length', 'Calculate string length', 'Add a column with the number of characters.', []],
  ['reverse', 'Reverse string', 'Reverse the characters in a string.', []],
  ['substring', 'Extract substring', 'Extract a range of characters.', [inputField('arg1', 'Start position', '1'), inputField('arg2', 'Character count', '5')]],
  ['left', 'Extract first characters', 'Keep the first N characters.', [inputField('arg1', 'Character count', '3')]],
  ['right', 'Extract last characters', 'Keep the last N characters.', [inputField('arg1', 'Character count', '3')]],
  ['replace', 'Replace text', 'Replace a literal string.', [inputField('arg1', 'Find text', 'MH'), inputField('arg2', 'Replace with', 'Maharashtra')]],
  ['regexp_replace', 'Replace by regex', 'Replace text that matches a regular expression.', [inputField('arg1', 'Regex pattern', '[^a-zA-Z ]'), inputField('arg2', 'Replace with', '')]],
  ['regexp_extract', 'Extract regex match', 'Extract a capture group from matching text.', [inputField('arg1', 'Regex pattern', '\\d+'), inputField('arg3', 'Capture group index', '0')]],
  ['split', 'Split into array', 'Split text using a delimiter or regex.', [inputField('arg1', 'Delimiter / pattern', ' ')]],
  ['split_item', 'Extract split value', 'Split text and return one item by index.', [inputField('arg1', 'Delimiter / pattern', ' '), inputField('arg2', 'Zero-based item index', '0')]],
  ['concat', 'Combine columns', 'Join values from multiple columns.', [inputField('columns', 'Columns to combine', 'employee_id, employee_name', true)], false],
  ['concat_ws', 'Combine with separator', 'Join columns with a chosen separator.', [inputField('columns', 'Columns to combine', 'employee_id, employee_name', true), inputField('arg3', 'Separator', '-')], false],
  ['translate', 'Replace characters', 'Map characters from one set to another.', [inputField('arg1', 'Characters to replace', 'abc'), inputField('arg2', 'Replacement characters', 'ABC')]],
  ['lpad', 'Left pad values', 'Pad values to a fixed width from the left.', [inputField('arg1', 'Output width', '6'), inputField('arg3', 'Pad character', '0')]],
  ['rpad', 'Right pad values', 'Pad values to a fixed width from the right.', [inputField('arg1', 'Output width', '8'), inputField('arg3', 'Pad character', 'X')]]
].map(([fn, title, description, fields, needsSource]) => textOperation({ fn, title, description, fields, needsSource }));

const numericOperations = [
  { fn: 'cast', title: 'Change datatype', description: 'Cast a column to a Spark data type.', args: [inputField('arg1', 'Spark type', 'double')] },
  { fn: 'round', title: 'Round numeric value', description: 'Round a number to the requested decimal places.', args: [inputField('arg1', 'Decimal places', '2')] },
  { fn: 'abs', title: 'Absolute value', description: 'Return the absolute value of a number.', args: [] }
].map(spec => ({ id: `numeric_${spec.fn}`, kind: 'numeric', presetFn: spec.fn, category: 'expressions', icon: 'ƒ', title: spec.title, description: spec.description, fields: [inputField('source', 'Source column', 'salary'), inputField('target', 'Output column', 'salary_clean'), ...spec.args] }));

const dateOperations = [
  { fn: 'to_date', title: 'Convert string to date', description: 'Parse a string using a date format.', fields: [inputField('source', 'Source column', 'joining_date'), inputField('arg1', 'Date format', 'yyyy-MM-dd')] },
  { fn: 'year', title: 'Extract year', description: 'Get the year from a date.', fields: [inputField('source', 'Date column', 'joining_date')] },
  { fn: 'month', title: 'Extract month', description: 'Get the month number from a date.', fields: [inputField('source', 'Date column', 'joining_date')] },
  { fn: 'dayofmonth', title: 'Extract day', description: 'Get the day of month from a date.', fields: [inputField('source', 'Date column', 'joining_date')] },
  { fn: 'datediff', title: 'Calculate date difference', description: 'Get days between a date and today or another date.', fields: [inputField('source', 'Start date column', 'joining_date'), inputField('otherSource', 'End date column (optional)', '', false, '', 'Leave blank to use today.')] },
  { fn: 'date_add', title: 'Add days to date', description: 'Add a number of days to a date.', fields: [inputField('source', 'Date column', 'joining_date'), inputField('arg1', 'Days to add', '30')] },
  { fn: 'current_date', title: 'Add current date', description: 'Add today’s date as a new column.', fields: [] },
  { fn: 'current_timestamp', title: 'Add current timestamp', description: 'Add the current timestamp as a new column.', fields: [] },
  { fn: 'date_format', title: 'Format date', description: 'Render a date using a format string.', fields: [inputField('source', 'Date column', 'joining_date'), inputField('arg1', 'Output format', 'yyyy-MM')] },
  { fn: 'add_months', title: 'Add months to date', description: 'Shift a date by a number of months.', fields: [inputField('source', 'Date column', 'joining_date'), inputField('arg1', 'Months to add', '6')] },
  { fn: 'months_between', title: 'Calculate months between', description: 'Get whole or fractional months between dates.', fields: [inputField('source', 'Start date column', 'joining_date'), inputField('otherSource', 'End date column (optional)', '', false, '', 'Leave blank to use today.')] },
  { fn: 'last_day', title: 'Get month end', description: 'Return the last day of the date’s month.', fields: [inputField('source', 'Date column', 'joining_date')] },
  { fn: 'next_day', title: 'Get next weekday', description: 'Find the next selected weekday after a date.', fields: [inputField('source', 'Date column', 'joining_date'), inputField('arg1', 'Weekday', 'Mon')] }
].map(spec => ({ id: `date_${spec.fn}`, kind: 'date', presetFn: spec.fn, category: 'dates', icon: '◷', title: spec.title, description: spec.description, fields: [...spec.fields, inputField('target', 'Output column', spec.fn === 'current_date' ? 'load_date' : 'date_result')] }));

const windowOperations = [
  { fn: 'rank', title: 'Rank within group', description: 'Rank rows within a partition.', fields: [] },
  { fn: 'runningSum', title: 'Cumulative total', description: 'Calculate a running total within a partition.', fields: [inputField('source', 'Value column', 'salary')] }
].map(spec => ({ id: `window_${spec.fn}`, kind: 'window', presetFn: spec.fn, category: 'analytics', icon: '⌗', title: spec.title, description: spec.description, fields: [inputField('target', 'Output column', spec.fn === 'rank' ? 'rank' : 'running_salary'), ...spec.fields, inputField('partition', 'Partition by', 'department'), inputField('order', 'Order by', 'employee_id'), { key: 'direction', label: 'Order direction', type: 'select', value: 'desc', options: [['desc', 'Descending'], ['asc', 'Ascending']] }] }));

const arrayOperations = [
  { fn: 'explode', title: 'Array to rows', description: 'Create one output row for each array item.', fields: [inputField('source', 'Array column', 'skills'), inputField('target', 'Output item column', 'skill')] },
  { fn: 'explode_outer', title: 'Explode array including nulls', description: 'Keep rows when the array is null or empty.', fields: [inputField('source', 'Array column', 'skills'), inputField('target', 'Output item column', 'skill')] },
  { fn: 'posexplode', title: 'Explode with position', description: 'Return each array index alongside its value.', fields: [inputField('source', 'Array column', 'skills'), inputField('position', 'Position column', 'position'), inputField('target', 'Value column', 'skill')] },
  { fn: 'create', title: 'Create array', description: 'Build an array from columns.', fields: [inputField('columns', 'Columns to combine', 'department, state', true), inputField('target', 'Output array column', 'employee_details')] },
  { fn: 'contains', title: 'Check array value', description: 'Return whether an array contains a value.', fields: [inputField('source', 'Array column', 'skills'), inputField('arg1', 'Value to find', 'Python'), inputField('target', 'Output boolean column', 'has_python')] },
  { fn: 'size', title: 'Count array items', description: 'Return the number of items in an array.', fields: [inputField('source', 'Array column', 'skills'), inputField('target', 'Output count column', 'skill_count')] },
  { fn: 'sort_array', title: 'Sort array values', description: 'Sort elements in an array.', fields: [inputField('source', 'Array column', 'skills'), inputField('target', 'Output array column', 'sorted_skills')] },
  { fn: 'array_distinct', title: 'Remove duplicate array items', description: 'Keep only unique elements in an array.', fields: [inputField('source', 'Array column', 'skills'), inputField('target', 'Output array column', 'unique_skills')] },
  { fn: 'array_union', title: 'Combine arrays', description: 'Combine two arrays and keep unique items.', fields: [inputField('source', 'First array', 'skills'), inputField('otherSource', 'Second array', 'skills2'), inputField('target', 'Output array column', 'all_skills')] },
  { fn: 'array_intersect', title: 'Find common array items', description: 'Keep values present in both arrays.', fields: [inputField('source', 'First array', 'skills'), inputField('otherSource', 'Second array', 'skills2'), inputField('target', 'Output array column', 'common_skills')] },
  { fn: 'array_except', title: 'Find array items in first only', description: 'Keep values in the first array but not the second.', fields: [inputField('source', 'First array', 'skills'), inputField('otherSource', 'Second array', 'skills2'), inputField('target', 'Output array column', 'unique_skills')] },
  { fn: 'get_item', title: 'Extract array value', description: 'Return an array item by zero-based index.', fields: [inputField('source', 'Array column', 'skills'), inputField('arg1', 'Zero-based index', '0'), inputField('target', 'Output value column', 'first_skill')] }
].map(spec => ({ id: `array_${spec.fn}`, kind: 'array', presetFn: spec.fn, category: 'complex', icon: '[]', title: spec.title, description: spec.description, fields: spec.fields }));

const mapOperations = [
  { fn: 'map_from_arrays', title: 'Create map from arrays', description: 'Pair key and value arrays into a map.', fields: [inputField('source', 'Keys array', 'keys'), inputField('values', 'Values array', 'values')] },
  { fn: 'map_keys', title: 'Extract map keys', description: 'Return the keys from a map column.', fields: [inputField('source', 'Map column', 'employee_map')] },
  { fn: 'map_values', title: 'Extract map values', description: 'Return the values from a map column.', fields: [inputField('source', 'Map column', 'employee_map')] }
].map(spec => ({ id: `map_${spec.fn}`, kind: 'map', presetFn: spec.fn, category: 'complex', icon: '{…}', title: spec.title, description: spec.description, fields: [...spec.fields, inputField('target', 'Output column', 'map_result')] }));

const jsonOperations = [
  { fn: 'struct', title: 'Create struct', description: 'Group columns into a named struct column.', fields: [inputField('columns', 'Fields to include', 'employee_id, employee_name, salary', true)] },
  { fn: 'get_json_object', title: 'Extract JSON value', description: 'Read one value using a JSON path.', fields: [inputField('source', 'JSON string column', 'json_col'), inputField('arg1', 'JSON path', '$.address.city')] },
  { fn: 'from_json', title: 'Parse JSON string', description: 'Parse a JSON string into a typed struct.', fields: [inputField('source', 'JSON string column', 'json_col'), inputField('arg1', 'Schema (DDL)', 'STRUCT<city: STRING>')] },
  { fn: 'to_json', title: 'Convert struct to JSON', description: 'Serialize a struct column to a JSON string.', fields: [inputField('source', 'Struct column', 'employee_details')] }
].map(spec => ({ id: `json_${spec.fn}`, kind: 'json', presetFn: spec.fn, category: 'complex', icon: '{ }', title: spec.title, description: spec.description, fields: [...spec.fields, inputField('target', 'Output column', 'json_result')] }));

transformations.push(...textOperations, ...numericOperations, ...dateOperations, ...windowOperations, ...arrayOperations, ...mapOperations, ...jsonOperations);
transformations.push({
  id: 'newDataFrame', category: 'dataframe', icon: '▦', title: 'Continue in a new DataFrame',
  description: 'Keep the current result and apply subsequent selected steps to a new DataFrame.', fields: [
    { key: 'base', label: 'Start new DataFrame from', type: 'select', value: 'current', options: [['current', 'Current result — keep previous transformations'], ['source', 'Original source — start without previous transformations']] },
    inputField('target', 'New DataFrame name', 'df_next', true, 'df_next', 'Select the steps that should run before this boundary. Add another DataFrame step for a later boundary; each one keeps its own distinct name. These are lazy references, not copies or caches.')
  ]
});
transformations.push({
  id: 'flattenNested', category: 'complex', icon: '{ }', title: 'Flatten nested JSON',
  description: 'Expand a full nested struct path or flatten an array; parse JSON strings with from_json first.', fields: [
    { ...inputField('source', 'Nested column or struct path', 'order.item.details', true, 'payload', 'For nested structs, enter the full dot-separated path, such as order.item.details. Each struct level is expanded in sequence.'), whenAny: { key: 'mode', values: ['struct', 'explode', 'posexplode', 'explode_outer', 'posexplode_outer', 'explode_struct', 'posexplode_struct', 'explode_outer_struct', 'posexplode_outer_struct'] } },
    { key: 'mode', label: 'Flatten method', type: 'select', value: 'recursive', options: [
      ['recursive', 'Multiple array levels — build an explode plan'], ['struct', 'Structs only — expand a dot-separated path'], ['explode', 'Single array — explode'], ['posexplode', 'Single array — posexplode'],
      ['explode_outer', 'Single array — explode and keep null / empty'], ['posexplode_outer', 'Single array — posexplode and keep null / empty'],
      ['explode_struct', 'Explode array of structs into columns'], ['posexplode_struct', 'Posexplode array of structs into columns'],
      ['explode_outer_struct', 'Explode array of structs, keep null / empty'], ['posexplode_outer_struct', 'Posexplode array of structs, keep null / empty']
    ], wide: true },
    { key: 'target', label: 'Output item column', type: 'input', value: 'item', placeholder: 'item', whenAny: { key: 'mode', values: ['explode', 'posexplode', 'explode_outer', 'posexplode_outer', 'explode_struct', 'posexplode_struct', 'explode_outer_struct', 'posexplode_outer_struct'] } },
    { key: 'position', label: 'Array position column', type: 'input', value: 'position', placeholder: 'position', whenAny: { key: 'mode', values: ['posexplode', 'posexplode_outer', 'posexplode_struct', 'posexplode_outer_struct'] } },
    { key: 'nestedStructs', label: 'Then expand struct fields only (optional)', type: 'input', value: '', placeholder: 'details.more_details', wide: true, hint: 'Use this only for structs. If another level is an array, choose “Multiple array levels” above and add it to the explode plan.', whenAny: { key: 'mode', values: ['explode', 'posexplode', 'explode_outer', 'posexplode_outer', 'explode_struct', 'posexplode_struct', 'explode_outer_struct', 'posexplode_outer_struct'] } },
    { key: 'recursiveExplodeMode', label: 'Array expansion', type: 'select', value: 'explode', options: [['explode', 'Explode arrays'], ['explode_outer', 'Explode arrays and keep null / empty']], when: { key: 'mode', value: 'recursive' } },
    { key: 'explodeSteps', label: 'Array path → output column (one per line)', type: 'textarea', value: 'orders -> order\norder.items -> item', placeholder: 'orders -> order\norder.items -> item', wide: true, hint: 'Steps run from top to bottom. Add as many array levels as needed.', when: { key: 'mode', value: 'recursive' } },
    { key: 'selectFields', label: 'Column path → output name (one per line)', type: 'textarea', value: 'user_id\nname\nemail\ncreated_at\naddress.street -> street\naddress.city -> city\naddress.state -> state\naddress.zip -> zipcode\norder.order_id -> order_id\norder.amount -> order_amount\nitem.product_id -> product_id\nitem.quantity -> quantity', placeholder: 'user_id\naddress.city -> city\norder.order_id -> order_id\nitem.product_id -> product_id', wide: true, hint: 'An output name is optional for top-level columns. Nested paths default to their final field name.', when: { key: 'mode', value: 'recursive' } }
  ]
});
transformations.push(
  {
    id: 'scd1', category: 'scd', icon: 'S1', title: 'Apply SCD Type 1',
    description: 'Merge the latest values into a Delta dimension; matched changes replace old values.', fields: [
      { key: 'targetKind', label: 'Target type', type: 'select', value: 'table', options: [['table', 'Unity Catalog table'], ['path', 'Delta storage path']] },
      inputField('target', 'Target dimension', 'catalog.schema.dim_employee_scd1', true, 'catalog.schema.dim_employee_scd1', 'On first run this target is initialized from the source DataFrame.'),
      inputField('keys', 'Business key columns', 'employee_id', true),
      inputField('updateColumns', 'Columns to update (optional)', 'department, salary, state', true, '', 'Leave blank to update all matched columns.')
    ]
  },
  {
    id: 'scd2', category: 'scd', icon: 'S2', title: 'Apply SCD Type 2',
    description: 'Keep history by expiring the active version and inserting a new version when tracked fields change.', fields: [
      { key: 'targetKind', label: 'Target type', type: 'select', value: 'table', options: [['table', 'Unity Catalog table'], ['path', 'Delta storage path']] },
      inputField('target', 'Target dimension', 'catalog.schema.dim_employee_scd2', true, 'catalog.schema.dim_employee_scd2', 'On first run, creates valid_from, valid_to, and is_current columns. Existing targets must contain the configured history columns.'),
      inputField('keys', 'Business key columns', 'employee_id', true),
      inputField('trackedColumns', 'Track changes in', 'department, salary, state', true),
      inputField('effectiveColumn', 'Effective timestamp column (optional)', 'updated_at', false, '', 'Leave blank to use the current timestamp.'),
      inputField('validFrom', 'Valid from column', 'valid_from'),
      inputField('validTo', 'Valid to column', 'valid_to'),
      inputField('currentFlag', 'Current row flag', 'is_current')
    ]
  }
);
transformations.push(
  {
    id: 'deltaInspect', category: 'scd', icon: '◷', title: 'Inspect Delta table',
    description: 'View recent commit history or table details for a Delta target.', fields: [
      { key: 'targetKind', label: 'Target type', type: 'select', value: 'table', options: [['table', 'Unity Catalog table'], ['path', 'Delta storage path']] },
      inputField('target', 'Delta table', 'catalog.schema.dim_employee', true),
      { key: 'action', label: 'Inspection', type: 'select', value: 'history', options: [['history', 'Table history'], ['detail', 'Table details']] },
      { ...inputField('historyLimit', 'Recent history rows (optional)', '20', false, '20'), when: { key: 'action', value: 'history' } }
    ]
  },
  {
    id: 'deltaDelete', category: 'scd', icon: '⌫', title: 'Delete matching Delta rows',
    description: 'Delete rows from a Delta table using a Spark SQL or PySpark condition.', fields: [
      { key: 'targetKind', label: 'Target type', type: 'select', value: 'table', options: [['table', 'Unity Catalog table'], ['path', 'Delta storage path']] },
      inputField('target', 'Delta table', 'catalog.schema.dim_employee', true),
      inputField('condition', 'Delete condition', 'employee_id = 3000', true, 'employee_id = 3000', 'Use a narrow filter. Examples: department = \'Sales\' or F.col("employee_id") == 3000.')
    ]
  },
  {
    id: 'deltaRestore', category: 'scd', icon: '↶', title: 'Restore Delta version',
    description: 'Restore the table to a selected point in its transaction history.', fields: [
      { key: 'targetKind', label: 'Target type', type: 'select', value: 'table', options: [['table', 'Unity Catalog table'], ['path', 'Delta storage path']] },
      inputField('target', 'Delta table', 'catalog.schema.dim_employee', true),
      { ...inputField('version', 'Version to restore', '8', false, '8'), type: 'input' }
    ]
  },
  {
    id: 'deltaVacuum', category: 'scd', icon: '⌁', title: 'Vacuum Delta files',
    description: 'Remove files no longer needed by the retained Delta history.', fields: [
      { key: 'targetKind', label: 'Target type', type: 'select', value: 'table', options: [['table', 'Unity Catalog table'], ['path', 'Delta storage path']] },
      inputField('target', 'Delta table', 'catalog.schema.dim_employee', true),
      { ...inputField('retentionHours', 'Retention (hours)', '168', false, '168', 'Delta applies a safety check to short retention periods. Keep the default unless you understand the history impact.'), type: 'input' }
    ]
  },
  {
    id: 'deltaCompare', category: 'scd', icon: '⇄', title: 'Compare Delta versions',
    description: 'Find rows present in one table version but not another.', fields: [
      { key: 'targetKind', label: 'Target type', type: 'select', value: 'table', options: [['table', 'Unity Catalog table'], ['path', 'Delta storage path']] },
      inputField('target', 'Delta table', 'catalog.schema.dim_employee', true),
      { ...inputField('fromVersion', 'Earlier version', '7', false, '7'), type: 'input' },
      { ...inputField('toVersion', 'Later version', '8', false, '8'), type: 'input' },
      { key: 'comparison', label: 'Difference method', type: 'select', value: 'exceptAll', options: [['except', 'except() · distinct rows'], ['exceptAll', 'exceptAll() · preserve duplicates']] }
    ]
  }
);
transformations.push({
  id: 'createFrameFromSchema', category: 'dataframe', icon: '▦', title: 'Create DataFrame from schema',
  description: 'Build an explicitly typed DataFrame and combine its rows with unionByName.', fields: [
    inputField('target', 'New DataFrame name', 'sample_df', false, 'sample_df'),
    { key: 'schemaFields', label: 'Column name : Spark type (one per line)', type: 'textarea', value: 'employee_name: string\nage: integer\njob_title: string\ncity: string', placeholder: 'employee_name: string\nage: integer\njob_title: string\ncity: string', wide: true, hint: 'Supported types: string, integer, long, double, float, boolean, date, timestamp.' },
    { key: 'rows', label: 'JSON row arrays (one per line)', type: 'textarea', value: '["Madhur", 25, "Data Engineer", "Bijnor"]', placeholder: '["Madhur", 25, "Data Engineer", "Bijnor"]', wide: true, hint: 'Each row must be a JSON array with values matching the schema column order.' }
  ]
});

function makeDuplicateOutputDefaultsUnique() {
  const outputKinds = new Set(['text', 'numeric', 'date', 'window', 'array', 'map', 'json']);
  const outputFields = transformations.flatMap(item => {
    if (!outputKinds.has(item.kind) && item.id !== 'flattenNested' && item.id !== 'conditional') return [];
    return item.fields
      .filter(field => ['target', 'position'].includes(field.key) && String(field.value || '').trim())
      .map(field => ({ item, field, base: String(field.value).trim() }));
  });
  const counts = new Map();
  outputFields.forEach(({ base }) => {
    const key = base.toLowerCase();
    counts.set(key, (counts.get(key) || 0) + 1);
  });
  const reserved = new Set(outputFields
    .filter(({ base }) => counts.get(base.toLowerCase()) === 1)
    .map(({ base }) => base.toLowerCase()));

  outputFields.filter(({ base }) => counts.get(base.toLowerCase()) > 1).forEach(({ item, field, base }) => {
    const suffix = String(item.presetFn || item.id)
      .replace(/([a-z0-9])([A-Z])/g, '$1_$2')
      .replace(/[^a-zA-Z0-9]+/g, '_')
      .replace(/^_+|_+$/g, '')
      .toLowerCase();
    const stem = `${base}_${suffix || 'result'}`;
    let candidate = stem;
    let index = 2;
    while (reserved.has(candidate.toLowerCase())) candidate = `${stem}_${index++}`;
    field.value = candidate;
    field.placeholder = candidate;
    reserved.add(candidate.toLowerCase());
  });
}

makeDuplicateOutputDefaultsUnique();

function isNewDataFrameStep(itemOrId) {
  const id = typeof itemOrId === 'string' ? itemOrId : itemOrId?.id;
  return id === 'newDataFrame' || /^newDataFrame_\d+$/.test(id || '');
}

function nextNewDataFrameId() {
  const suffixes = transformations
    .map(item => item.id.match(/^newDataFrame_(\d+)$/))
    .filter(Boolean)
    .map(match => Number(match[1]));
  return `newDataFrame_${Math.max(1, ...suffixes) + 1}`;
}

function nextNewDataFrameName() {
  const usedNames = new Set([document.getElementById('dataframeName')?.value.trim() || 'df']);
  transformations.filter(isNewDataFrameStep).forEach(item => usedNames.add(getValue(item.id, 'target')));
  let candidate = 'df_part';
  let suffix = 2;
  while (usedNames.has(candidate)) candidate = `df_part_${suffix++}`;
  return candidate;
}

function createNewDataFrameStep(id, target) {
  const template = transformations.find(item => item.id === 'newDataFrame');
  return {
    ...template,
    id,
    fields: template.fields.map(field => field.key === 'target'
      ? { ...field, value: target, placeholder: target }
      : { ...field })
  };
}

const categories = [
  ['all', 'All transformations'], ['shape', 'Select & shape'], ['quality', 'Data quality'],
  ['filtering', 'Filter & sort'], ['expressions', 'Columns & expressions'],
  ['dates', 'Date & time'], ['analytics', 'Analytics'], ['complex', 'Arrays, maps & JSON'], ['dataframe', 'DataFrame tools'], ['scd', 'Delta & SCD']
];

const sourcePathExamples = {
  delta: 'catalog.schema.your_table',
  csv: '/Volumes/catalog/schema/volume/your_file.csv',
  json: '/Volumes/catalog/schema/volume/your_file.json',
  text: '/Volumes/catalog/schema/volume/your_file.txt',
  parquet: '/Volumes/catalog/schema/volume/your_file.parquet',
  avro: '/Volumes/catalog/schema/volume/your_file.avro',
  orc: '/Volumes/catalog/schema/volume/your_file.orc',
  iceberg: 'catalog.schema.your_table'
};
let activeSuggestedFormat = 'delta';

const state = { selected: new Set(), category: 'all', uploads: [], sourceMode: 'files', activeSourceMode: 'files', uploadSelectionKind: 'files', uploadedPathBase: null, uploadedPathFileName: null, view: 'builder', customCode: null, unsyncedCodeEdits: false, editingCode: false, previewRunning: false, lastRunCode: null, session: { authenticated: false, databricksApp: false, displayName: '', email: '', workspaceUrl: '' } };
const list = document.getElementById('transformList');
const codePreview = document.getElementById('codePreview');
const toast = document.getElementById('toast');
const recipeStorageKey = 'forge.dataPrep.recipes.v1';
const activityStorageKey = 'forge.dataPrep.activity.v1';
const notebookNameStorageKey = 'lakeloom.notebookName.v1';
const notebookNameInput = document.getElementById('notebookName');
let modalReturnFocus = null;

try {
  const savedNotebookName = localStorage.getItem(notebookNameStorageKey);
  if (savedNotebookName) notebookNameInput.value = savedNotebookName;
} catch {}

function getNotebookName() {
  return notebookNameInput.value.trim() || 'Untitled notebook';
}

function getNotebookFilenameBase() {
  const normalized = getNotebookName().normalize('NFKD').replace(/[\u0300-\u036f]/g, '');
  return normalized.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '') || 'untitled_notebook';
}

function syncNotebookNameDisplay() {
  document.getElementById('notebookFileLabel').textContent = `${getNotebookFilenameBase()}.py`;
}

syncNotebookNameDisplay();

function persistNotebookName() {
  const name = notebookNameInput.value.trim();
  try {
    if (name) localStorage.setItem(notebookNameStorageKey, name);
    else localStorage.removeItem(notebookNameStorageKey);
  } catch {}
}

function openModal(modalId, focusId) {
  const modal = document.getElementById(modalId);
  modalReturnFocus = document.activeElement;
  modal.hidden = false;
  requestAnimationFrame(() => document.getElementById(focusId)?.focus());
}

function closeModal(modal) {
  if (!modal) return;
  modal.hidden = true;
  if (!document.querySelector('.modal-backdrop:not([hidden])')) {
    modalReturnFocus?.focus?.();
    modalReturnFocus = null;
  }
}

function readLocalList(key) {
  try {
    const parsed = JSON.parse(localStorage.getItem(key) || '[]');
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeLocalList(key, items) {
  try {
    localStorage.setItem(key, JSON.stringify(items));
    return true;
  } catch {
    showToast('Browser storage is unavailable. Changes were not saved.');
    return false;
  }
}

function addActivity(type, detail) {
  const history = readLocalList(activityStorageKey);
  history.unshift({ id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`, type, detail, createdAt: new Date().toISOString() });
  writeLocalList(activityStorageKey, history.slice(0, 50));
  renderWorkspaceViews();
}

function activityMarkup(items, emptyMessage) {
  if (!items.length) return `<div class="empty-activity"><span>◷</span><p>${escapeHtml(emptyMessage)}</p></div>`;
  return items.map(item => {
    const type = String(item.type || 'Workspace activity');
    const icon = type.startsWith('Notebook ') ? '↓' : type.toLowerCase().includes('recipe') ? '▤' : '⌘';
    return `<article class="activity-item"><span class="activity-mark">${icon}</span><div><strong>${escapeHtml(type)}</strong><p>${escapeHtml(item.detail || '')}</p></div><time>${formatRelativeTime(item.createdAt)}</time></article>`;
  }).join('');
}

function formatRelativeTime(value) {
  if (!value) return 'Recently';
  const timestamp = new Date(value).getTime();
  if (!Number.isFinite(timestamp)) return 'Recently';
  const elapsedMinutes = Math.max(0, Math.floor((Date.now() - timestamp) / 60000));
  if (elapsedMinutes < 1) return 'Just now';
  if (elapsedMinutes < 60) return `${elapsedMinutes}m ago`;
  if (elapsedMinutes < 1440) return `${Math.floor(elapsedMinutes / 60)}h ago`;
  return new Date(timestamp).toLocaleDateString();
}

function renderWorkspaceViews() {
  const history = readLocalList(activityStorageKey);
  const recipes = readLocalList(recipeStorageKey);
  document.getElementById('overviewTransformCount').textContent = state.selected.size;
  document.getElementById('overviewExportCount').textContent = history.filter(item => ['Notebook downloaded', 'Notebook exported'].includes(item.type)).length;
  document.getElementById('overviewRecipeCount').textContent = recipes.length;
  document.getElementById('overviewRecentActivity').innerHTML = activityMarkup(history.slice(0, 4), 'No notebook activity yet.');
  document.getElementById('historyList').innerHTML = activityMarkup(history, 'Your local notebook activity will appear here.');
  document.getElementById('recipeList').innerHTML = recipes.map(recipe => {
    const count = Array.isArray(recipe.selected) ? recipe.selected.length : 0;
    return `<article class="recipe-card"><div class="recipe-card-top"><span class="recipe-mark">▤</span><button class="recipe-delete" type="button" data-recipe-delete="${escapeHtml(recipe.id || '')}" aria-label="Delete ${escapeHtml(recipe.name || 'recipe')}">×</button></div><h2>${escapeHtml(recipe.name || 'Untitled recipe')}</h2><p>${count} transformation${count === 1 ? '' : 's'} · ${escapeHtml(String(recipe.sourceFormat || 'delta').toUpperCase())} source${recipe.writeOutput ? ` · ${escapeHtml(String(recipe.outputFormat || '').toUpperCase())} output` : ''}</p><small>Saved ${formatRelativeTime(recipe.createdAt)}</small><button class="recipe-use" type="button" data-recipe-use="${escapeHtml(recipe.id || '')}">Use this recipe <span>↗</span></button></article>`;
  }).join('');
  document.getElementById('emptyRecipes').hidden = recipes.length > 0;
  document.getElementById('recipeList').hidden = recipes.length === 0;
}

function setView(view) {
  const knownViews = ['overview', 'builder', 'history', 'recipes', 'documentation'];
  const target = knownViews.includes(view) ? view : 'builder';
  const titles = { overview: 'Overview', builder: 'Notebook builder', history: 'Run history', recipes: 'Saved recipes', documentation: 'Documentation' };
  if (document.getElementById('builderView').classList.contains('preview-focus-mode')) {
    setPreviewFocusMode(false);
  }
  state.view = target;
  document.querySelectorAll('.app-view').forEach(section => {
    section.hidden = section.id !== `${target}View`;
  });
  document.querySelectorAll('.side-nav [data-view]').forEach(link => {
    const selected = link.dataset.view === target;
    link.classList.toggle('active', selected);
    link.setAttribute('aria-current', selected ? 'page' : 'false');
  });
  document.getElementById('breadcrumbCurrent').textContent = titles[target];
  renderWorkspaceViews();
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function initialsFor(name) {
  const parts = String(name || '').trim().split(/[\s@._-]+/).filter(Boolean);
  return (parts.length > 1 ? `${parts[0][0]}${parts[1][0]}` : (parts[0] || 'GU').slice(0, 2)).toUpperCase();
}

function renderDatabricksSession(session = {}) {
  const authenticated = session.authenticated === true;
  const databricksApp = session.databricksApp === true;
  const previewAvailable = session.previewAvailable === true;
  const name = authenticated ? (session.displayName || session.email || session.userId || 'Databricks user') : 'Guest user';
  state.session = { ...session, authenticated, databricksApp, previewAvailable };

  const authButton = document.getElementById('authButton');
  authButton.disabled = false;
  authButton.textContent = authenticated ? 'Workspace account' : 'Sign in with Databricks';
  authButton.title = authenticated ? `Signed in as ${name}` : 'Sign in through Databricks workspace SSO';
  document.getElementById('currentUserName').textContent = name;
  document.getElementById('currentUserRole').textContent = authenticated ? 'Databricks workspace user' : (databricksApp ? 'Workspace sign-in required' : 'Not signed in');
  document.getElementById('userAvatar').textContent = authenticated ? initialsFor(name) : 'GU';
  document.getElementById('workspaceSessionStatus').textContent = authenticated
    ? 'Databricks Apps · signed in'
    : (databricksApp ? 'Databricks Apps · sign-in required' : 'Local preview · SSO unavailable');

  const identityCard = document.getElementById('authIdentityCard');
  const identityName = document.getElementById('authIdentityName');
  const identityEmail = document.getElementById('authIdentityEmail');
  const workspaceLink = document.getElementById('authWorkspaceLink');
  const authTitle = document.getElementById('authDialogTitle');
  const authCopy = document.getElementById('authDialogCopy');
  const workspaceUrl = typeof session.workspaceUrl === 'string' ? session.workspaceUrl : '';

  identityCard.hidden = !authenticated;
  identityName.textContent = name;
  identityEmail.textContent = session.email || (authenticated ? 'Authenticated by Databricks workspace SSO' : '');
  workspaceLink.hidden = !workspaceUrl;
  workspaceLink.href = workspaceUrl || '#';
  if (authenticated) {
    authTitle.textContent = 'Connected with Databricks SSO';
    authCopy.textContent = 'Your workspace identity is active for this app. To sign out, use the Databricks workspace profile menu and choose Sign out.';
    workspaceLink.firstChild.textContent = 'Open Databricks workspace ';
  } else if (databricksApp) {
    authTitle.textContent = 'Databricks workspace sign-in';
    authCopy.textContent = 'This app is running in Databricks Apps but no workspace identity was received. Confirm you have permission to use the app, then refresh this status.';
    workspaceLink.firstChild.textContent = 'Open Databricks workspace ';
  } else if (session.localConnectReady) {
    authTitle.textContent = 'Local Databricks connection';
    authCopy.textContent = 'LakeLoom can run previews through your local Databricks Connect profile. The app UI stays in guest mode and does not expose your credentials.';
    workspaceLink.firstChild.textContent = 'Open Databricks workspace ';
  } else {
    authTitle.textContent = 'Open in Databricks Apps';
    authCopy.textContent = 'For local preview runs, configure Databricks Connect with a workspace OAuth profile. You can also deploy and open LakeLoom from Databricks Apps, where the workspace handles sign-in.';
    workspaceLink.firstChild.textContent = 'Open Databricks workspace ';
  }
  updateRunAvailability();
  updateSchemaAvailability();
}

function updateRunAvailability() {
  const button = document.getElementById('runPreview');
  const help = document.getElementById('runHelp');
  if (!button || !help) return;
  if (state.previewRunning) {
    button.disabled = true;
    button.textContent = 'Running…';
    return;
  }

  const deltaOperationSelected = [...state.selected].some(id => id.startsWith('delta') || id.startsWith('scd'));
  if (!state.session.previewAvailable) {
    button.disabled = true;
    help.textContent = state.session.databricksApp
      ? 'Databricks Connect is not available in this app runtime. Add it to requirements and redeploy LakeLoom.'
      : 'Configure Databricks Connect with a workspace OAuth profile, or deploy LakeLoom as a Databricks App.';
    help.classList.remove('is-warning');
  } else if (state.session.databricksApp && !state.session.authenticated) {
    button.disabled = true;
    help.textContent = 'Sign in through your Databricks workspace to run this preview.';
    help.classList.remove('is-warning');
  } else if (deltaOperationSelected) {
    button.disabled = true;
    help.textContent = 'Remove Delta table management or SCD steps to run a read-only data preview.';
    help.classList.add('is-warning');
  } else {
    button.disabled = false;
    help.textContent = state.session.databricksApp
      ? 'Runs the current PySpark pipeline on Databricks and returns up to 100 rows. Write steps are skipped.'
      : 'Runs as the Databricks user configured in your local Connect profile and returns up to 100 rows. Write steps are skipped.';
    help.classList.remove('is-warning');
  }
}

async function loadDatabricksSession() {
  try {
    const response = await fetch('/api/session', { credentials: 'same-origin', cache: 'no-store', headers: { Accept: 'application/json' } });
    if (!response.ok) throw new Error('Session endpoint unavailable');
    renderDatabricksSession(await response.json());
  } catch {
    renderDatabricksSession({ authenticated: false, databricksApp: false, previewAvailable: false, displayName: '', email: '', workspaceUrl: '' });
  }
}

function transformationCardMarkup(item) {
  const fields = item.fields.map(field => {
      const id = `${item.id}-${field.key}`;
      const optionHelp = dropdownOptionHelp(item.id, field.key);
      const control = field.type === 'select'
        ? `<select class="setting-select" id="${id}" data-op="${item.id}" data-key="${field.key}" title="${escapeHtml(optionHelp[field.value] || '')}">${field.options.map(([value, label]) => `<option value="${value}" title="${escapeHtml(optionHelp[value] || '')}" ${value === field.value ? 'selected' : ''}>${label}</option>`).join('')}</select>`
        : field.type === 'textarea'
          ? `<textarea class="setting-area" id="${id}" data-op="${item.id}" data-key="${field.key}" placeholder="${escapeHtml(field.placeholder || '')}">${escapeHtml(field.value || '')}</textarea>`
          : `<input class="setting-input" id="${id}" data-op="${item.id}" data-key="${field.key}" value="${escapeHtml(field.value || '')}" placeholder="${escapeHtml(field.placeholder || '')}" spellcheck="false" />`;
      const optionHint = field.type === 'select' ? `<div class="setting-hint dropdown-option-help" data-select-help>${escapeHtml(optionHelp[field.value] || '')}</div>` : '';
      const hint = `${optionHint}${field.hint ? `<div class="setting-hint">${field.hint}</div>` : ''}`;
      const condition = field.when
        ? `data-when-key="${field.when.key}" data-when-value="${field.when.value}"`
        : field.whenAny ? `data-when-any-key="${field.whenAny.key}" data-when-values="${field.whenAny.values.join('|')}"` : '';
      return `<div class="setting-field ${field.wide ? 'wide' : ''}" ${condition}><label for="${id}">${field.label}</label>${control}${hint}</div>`;
    }).join('');
  return `<article class="transform-card" data-card="${item.id}" data-category="${item.category}">
      <div class="transform-card-head" data-toggle="${item.id}">
        <span class="check-wrap"><input class="transform-check" type="checkbox" aria-label="Select ${item.title}" data-check="${item.id}" /></span>
        <span class="transform-icon" aria-hidden="true">${item.icon}</span>
        <span class="transform-copy"><strong>${item.title}</strong><span>${item.description}</span></span>
        <span class="transform-chevron" aria-hidden="true">⌄</span>
      </div>
      <div class="transform-settings"><div class="setting-grid">${fields || '<div class="setting-hint">No additional settings required.</div>'}</div></div>
    </article>`;
}

const dropdownHelp = {
  'selectColumns.mode': {
    columns: 'Keep the named columns in the order entered.',
    range: 'Keep columns between zero-based start and end positions; the end position is excluded.'
  },
  'nulls.strategy': {
    dropAny: 'Remove a row when any column contains null.', dropAll: 'Remove a row only when every column is null.',
    dropSubset: 'Remove a row when any selected key column is null.', fillValue: 'Replace nulls in the selected columns with one shared value.',
    fillMap: 'Set a different replacement value for each listed column.', coalesce: 'Use the fallback only when the selected column is null.',
    nvl: 'Spark SQL NVL behavior: return the fallback when the selected column is null.', nullif: 'Return null when the column equals the comparison value.'
  },
  'filter.method': { filter: 'Apply the condition with DataFrame.filter().', where: 'Apply the same condition with the equivalent DataFrame.where().' },
  'sort.method': { orderBy: 'Sort rows with DataFrame.orderBy().', sort: 'Sort rows with the equivalent DataFrame.sort().' },
  'aggregate.mode': { group: 'Create one result row per group and calculate aggregates.', pivot: 'Turn values from the pivot column into result columns before aggregating.' },
  'newDataFrame.base': { current: 'Start from the result produced by all preceding selected transformations.', source: 'Start again from the original source DataFrame and leave preceding results available.' },
  'flattenNested.mode': {
    recursive: 'Explode two or more nested array levels in sequence, then select and rename the required leaf fields.',
    struct: 'Expand struct fields through a dot-separated path without exploding an array.',
    explode: 'Create one row per array item and discard rows whose array is null or empty.',
    posexplode: 'Create one row per array item, including its zero-based array position; null or empty arrays are discarded.',
    explode_outer: 'Create one row per array item and preserve rows whose array is null or empty.',
    posexplode_outer: 'Create one row per array item with its position and preserve null or empty arrays.',
    explode_struct: 'Explode one array and immediately promote every field of each struct item to a column.',
    posexplode_struct: 'Explode one array of structs, keep each item position, and promote the struct fields to columns.',
    explode_outer_struct: 'Explode an array of structs into columns while preserving null or empty arrays.',
    posexplode_outer_struct: 'Explode an array of structs into columns with item positions while preserving null or empty arrays.'
  },
  'flattenNested.recursiveExplodeMode': {
    explode: 'Discard a row when the array at an explode step is null or empty.',
    explode_outer: 'Preserve a row with a null item when the array at an explode step is null or empty.'
  },
  'window.direction': { desc: 'Order the newest or largest values first inside each partition.', asc: 'Order the oldest or smallest values first inside each partition.' },
  'deltaInspect.action': { history: 'Return recent commits, operations, users, timestamps, and version numbers.', detail: 'Return table metadata such as format, location, size, properties, and partition columns.' },
  'deltaCompare.comparison': { except: 'Return distinct rows present in the earlier version but absent from the later version.', exceptAll: 'Return differences while preserving duplicate row counts.' },
  '*.targetKind': { table: 'Address the Delta target by its Unity Catalog name: catalog.schema.table.', path: 'Address the Delta target by its storage location, such as a /Volumes or cloud path.' }
};

function dropdownOptionHelp(operationId, fieldKey) {
  return dropdownHelp[`${operationId}.${fieldKey}`] || dropdownHelp[`*.${fieldKey}`] || {};
}

function syncDropdownHelp(select) {
  if (!select || select.tagName !== 'SELECT') return;
  const help = dropdownOptionHelp(select.dataset.op, select.dataset.key)[select.value] || '';
  select.title = help;
  const hint = select.parentElement.querySelector('[data-select-help]');
  if (hint) hint.textContent = help;
}

function renderTransformations() {
  list.innerHTML = transformations.map(transformationCardMarkup).join('');
  applyCategory();
}

function renderCategories() {
  const select = document.getElementById('categorySelect');
  select.innerHTML = categories.map(([id, label]) => `<option value="${id}">${escapeHtml(label)}</option>`).join('');
  select.value = state.category;
  updateCategoryCount();
}

function updateCategoryCount() {
  const count = state.category === 'all'
    ? transformations.length
    : transformations.filter(item => item.category === state.category).length;
  document.getElementById('categoryCount').textContent = count;
}

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));
}

function getValue(op, key) {
  if (sourceSchemaState.generating && sourceSchemaState.cleanedValues?.has(`${op}.${key}`)) return sourceSchemaState.cleanedValues.get(`${op}.${key}`);
  const field = document.querySelector(`[data-op="${op}"][data-key="${key}"]`);
  return field ? field.value.trim() : '';
}

function csvList(value) {
  return value.split(',').map(part => part.trim()).filter(Boolean);
}

function nestedStructPath(value) {
  return String(value || '').split('.').map(part => part.trim()).filter(Boolean);
}

function nestedStructsAfterTarget(value, target) {
  const path = nestedStructPath(value);
  return path[0] === target ? path.slice(1) : path;
}

function flattenPlanLines(value) {
  return String(value || '').split(/\r?\n/).map(line => {
    const trimmed = line.trim();
    if (!trimmed) return null;
    const separator = trimmed.indexOf('->');
    const source = (separator < 0 ? trimmed : trimmed.slice(0, separator)).trim();
    const target = (separator < 0 ? source.split('.').pop() : trimmed.slice(separator + 2)).trim();
    return source && target ? [source, target] : null;
  }).filter(Boolean);
}

function replaceFlattenPathRoots(value, replacements) {
  return String(value || '').split(/(\r?\n)/).map(part => {
    if (/^\r?\n$/.test(part)) return part;
    const separator = part.indexOf('->');
    const pathPart = separator < 0 ? part : part.slice(0, separator);
    const suffix = separator < 0 ? '' : part.slice(separator);
    let updatedPath = pathPart;
    replacements.forEach(([before, after]) => {
      if (!before || !after || before === after) return;
      const pattern = new RegExp(`^(\\s*)${before.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(?=\\.|\\s*$)`);
      updatedPath = updatedPath.replace(pattern, `$1${after}`);
    });
    return updatedPath + suffix;
  }).join('');
}

function syncFlattenPlanAliases(field) {
  if (field.dataset.op !== 'flattenNested' || field.dataset.key !== 'explodeSteps') return;
  const previousValue = field.dataset.previousPlan ?? field.defaultValue;
  const previousSteps = flattenPlanLines(previousValue);
  const nextSteps = flattenPlanLines(field.value);
  const replacements = [];
  previousSteps.forEach(([previousSource, previousTarget], index) => {
    const next = nextSteps[index];
    if (next && next[0] === previousSource && next[1] !== previousTarget) replacements.push([previousTarget, next[1]]);
  });
  if (replacements.length) {
    field.value = replaceFlattenPathRoots(field.value, replacements);
    const selectFields = document.querySelector('[data-op="flattenNested"][data-key="selectFields"]');
    if (selectFields) selectFields.value = replaceFlattenPathRoots(selectFields.value, replacements);
  }
  field.dataset.previousPlan = field.value;
}

function pyString(value) {
  return JSON.stringify(value);
}

function pyList(values) {
  return `[${values.map(pyString).join(', ')}]`;
}

// Batch independent arithmetic projections without moving dependent expressions.
function optimizedColumnMappings(pairs) {
  const output = [];
  let batch = [];
  const flush = () => {
    if (!batch.length) return;
    output.push(batch.length === 1
      ? `.withColumn(${pyString(batch[0][0])}, F.expr(${pyString(batch[0][1])}))`
      : `.withColumns({${batch.map(([name, sql]) => `${pyString(name)}: F.expr(${pyString(sql)})`).join(', ')}})`);
    batch = [];
  };
  for (const pair of pairs) {
    const [name, sql] = pair;
    // Functions, literals, casts, and complex SQL stay sequential. This includes
    // random generators and expressions whose dependencies cannot be established.
    const simple = /^[A-Za-z0-9_\s.+*/%()-]+$/.test(sql) && !/[A-Za-z_]\w*\s*\(/.test(sql);
    const references = sql.match(/[A-Za-z_]\w*/g) || [];
    const normalize = value => sourceSchemaState.caseSensitive ? value : value.toLowerCase();
    if (!simple) { flush(); output.push(`.withColumn(${pyString(name)}, F.expr(${pyString(sql)}))`); continue; }
    if (batch.some(([target]) => normalize(target) === normalize(name) || references.some(ref => normalize(ref) === normalize(target)))) flush();
    batch.push(pair);
  }
  flush();
  return output;
}

function parseMappings(value) {
  return value.split('\n').map(line => {
    const separator = line.indexOf(':');
    if (separator < 1) return null;
    const left = line.slice(0, separator).trim();
    const right = line.slice(separator + 1).trim();
    return left && right ? [left, right] : null;
  }).filter(Boolean);
}

function codeSectionForTransformation(code, item) {
  const lines = code.split('\n');
  const heading = /^\s*# Steps? \d+(?:-\d+)?:/;
  const start = lines.findIndex(line => heading.test(line) && line.includes(item.title));
  if (start < 0) return '';
  let end = start + 1;
  while (end < lines.length && !heading.test(lines[end])) end++;
  return lines.slice(start + 1, end).join('\n');
}

function decodeCodeString(value) {
  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
}

function extractMethodArgument(source, method) {
  const marker = `.${method}(`;
  const start = source.indexOf(marker);
  if (start < 0) return null;
  const open = start + marker.length - 1;
  let depth = 0;
  let quote = '';
  for (let index = open; index < source.length; index++) {
    const character = source[index];
    if (quote) {
      if (character === '\\') index++;
      else if (character === quote) quote = '';
      continue;
    }
    if (character === '"' || character === "'") quote = character;
    else if (character === '(') depth++;
    else if (character === ')' && --depth === 0) return source.slice(open + 1, index).trim();
  }
  return null;
}

function extractCallAt(source, open) {
  let depth = 0;
  let quote = '';
  for (let index = open; index < source.length; index++) {
    const character = source[index];
    if (quote) {
      if (character === '\\') index++;
      else if (character === quote) quote = '';
      continue;
    }
    if (character === '"' || character === "'") quote = character;
    else if (character === '(') depth++;
    else if (character === ')' && --depth === 0) return source.slice(open + 1, index).trim();
  }
  return null;
}

function splitTopLevelArguments(expression) {
  let depth = 0;
  let quote = '';
  for (let index = 0; index < expression.length; index++) {
    const character = expression[index];
    if (quote) {
      if (character === '\\') index++;
      else if (character === quote) quote = '';
      continue;
    }
    if (character === '"' || character === "'") quote = character;
    else if (character === '(' || character === '[' || character === '{') depth++;
    else if (character === ')' || character === ']' || character === '}') depth--;
    else if (character === ',' && depth === 0) return [expression.slice(0, index).trim(), expression.slice(index + 1).trim()];
  }
  return null;
}

function generatedConditionToSetting(expression) {
  const sqlExpression = expression.match(/^F\.expr\(\s*("(?:\\.|[^"\\])*")\s*\)$/);
  return sqlExpression ? decodeCodeString(sqlExpression[1]) : expression.trim();
}

function generatedLiteralToSetting(expression) {
  const literal = expression.match(/^F\.lit\(\s*(.*?)\s*\)$/s);
  if (!literal) return null;
  const value = literal[1].trim();
  if (value.startsWith('"') && value.endsWith('"')) {
    const decoded = decodeCodeString(value);
    return decoded === null ? null : JSON.stringify(decoded);
  }
  if (value.startsWith("'") && value.endsWith("'")) return JSON.stringify(value.slice(1, -1));
  return value;
}

function syncSettingFromCode(op, key, value) {
  const field = document.querySelector(`[data-op="${op}"][data-key="${key}"]`);
  if (!field || field.value === value) return;
  field.value = value;
  syncCard(op);
}

function syncBuilderFromEditedCode(code) {
  for (const id of state.selected) {
    const item = transformations.find(operation => operation.id === id);
    if (!item) continue;
    const section = codeSectionForTransformation(code, item);
    if (!section) continue;

    if (item.id === 'createColumns' || item.id === 'dates') {
      const mappings = [];
      const expressionPattern = /(?:\.withColumn\(\s*|[{,]\s*)("(?:\\.|[^"\\])*")\s*(?:,|:)\s*F\.expr\(\s*("(?:\\.|[^"\\])*")\s*\)/g;
      for (const match of section.matchAll(expressionPattern)) {
        const target = decodeCodeString(match[1]);
        const expression = decodeCodeString(match[2]);
        if (target && expression) mappings.push(`${target}: ${expression}`);
      }
      if (mappings.length) syncSettingFromCode(item.id, 'mappings', mappings.join('\n'));
    } else if (item.id === 'dropColumns') {
      const argument = extractMethodArgument(section, 'drop');
      if (argument) {
        const listArgument = argument.replace(/^\*\s*/, '').trim();
        try {
          const columns = listArgument.startsWith('[') ? JSON.parse(listArgument) : [decodeCodeString(listArgument)];
          if (Array.isArray(columns) && columns.every(column => typeof column === 'string')) syncSettingFromCode(item.id, 'columns', columns.join(', '));
        } catch { /* An incomplete or hand-written Python expression cannot be mapped to this field. */ }
      }
    } else if (item.id === 'rename') {
      const mappings = [];
      const renamePattern = /\.withColumnRenamed\(\s*("(?:\\.|[^"\\])*")\s*,\s*("(?:\\.|[^"\\])*")\s*\)/g;
      for (const match of section.matchAll(renamePattern)) {
        const oldName = decodeCodeString(match[1]);
        const newName = decodeCodeString(match[2]);
        if (oldName && newName) mappings.push(`${oldName}: ${newName}`);
      }
      if (mappings.length) syncSettingFromCode(item.id, 'mappings', mappings.join('\n'));
    } else if (item.id === 'filter') {
      for (const method of ['filter', 'where']) {
        const argument = extractMethodArgument(section, method);
        if (!argument) continue;
        syncSettingFromCode(item.id, 'condition', generatedConditionToSetting(argument));
        syncSettingFromCode(item.id, 'method', method);
        break;
      }
    } else if (item.id === 'sort') {
      const method = ['orderBy', 'sort'].find(name => extractMethodArgument(section, name) !== null);
      if (!method) continue;
      const argument = extractMethodArgument(section, method);
      const mappings = [];
      const sortPattern = /F\.col\(("(?:\\.|[^"\\])*")\)\.(asc|desc)\(\)/g;
      for (const match of argument.matchAll(sortPattern)) {
        const column = decodeCodeString(match[1]);
        if (column) mappings.push(`${column}: ${match[2]}`);
      }
      if (mappings.length) syncSettingFromCode(item.id, 'mappings', mappings.join('\n'));
      syncSettingFromCode(item.id, 'method', method);
    } else if (item.id === 'limit') {
      const argument = extractMethodArgument(section, 'limit');
      if (argument && /^\d+$/.test(argument)) syncSettingFromCode(item.id, 'count', argument);
    } else if (item.id === 'duplicates' || item.id === 'dedupKeys') {
      const argument = extractMethodArgument(section, 'dropDuplicates');
      if (argument !== null) {
        const listMatch = argument.match(/(?:subset\s*=\s*)?(\[[^\]]*\])/);
        if (!listMatch) syncSettingFromCode(item.id, item.id === 'duplicates' ? 'columns' : 'keys', '');
        else {
          try {
            const columns = JSON.parse(listMatch[1]);
            if (Array.isArray(columns) && columns.every(column => typeof column === 'string')) syncSettingFromCode(item.id, item.id === 'duplicates' ? 'columns' : 'keys', columns.join(', '));
          } catch { /* Leave the option unchanged while the edited expression is incomplete. */ }
        }
      }
    } else if (item.id === 'conditional') {
      const cases = [];
      const whenPattern = /F\.when\(|\.when\(/g;
      for (const match of section.matchAll(whenPattern)) {
        const open = match.index + match[0].lastIndexOf('(');
        const call = extractCallAt(section, open);
        const pair = call && splitTopLevelArguments(call);
        const result = pair && generatedLiteralToSetting(pair[1]);
        if (pair && result !== null) cases.push(`${generatedConditionToSetting(pair[0])}, ${result}`);
      }
      const otherwise = extractMethodArgument(section, 'otherwise');
      if (cases.length) syncSettingFromCode(item.id, 'cases', cases.join('\n'));
      if (otherwise) {
        const fallback = generatedLiteralToSetting(otherwise);
        if (fallback !== null) syncSettingFromCode(item.id, 'otherwise', fallback);
      }
    }
  }
}

function pyLiteral(value) {
  const clean = value.trim();
  if (/^-?(?:\d+\.?\d*|\.\d+)$/.test(clean)) return clean;
  if (clean.toLowerCase() === 'true') return 'True';
  if (clean.toLowerCase() === 'false') return 'False';
  if (clean.toLowerCase() === 'null' || clean.toLowerCase() === 'none') return 'None';
  return pyString(value);
}

function addTransformationCode(item, frame, lines, stepNumber) {
  const value = key => getValue(item.id, key);
  const columns = key => csvList(value(key));
  const mappings = key => parseMappings(value(key));
  const todo = message => lines.push(`# TODO: ${message}`);

  lines.push(`# Step ${stepNumber}: ${item.title}`);
  if (item.id === 'createFrameFromSchema') {
    addCreateFrameFromSchema(item, frame, lines);
  } else if (item.id === 'selectColumns') {
    const names = validSelectionColumns(item, columns('columns'));
    const start = value('startIndex');
    const end = value('endIndex');
    if (value('mode') === 'range' && /^\d+$/.test(start) && /^\d+$/.test(end) && Number(end) > Number(start)) {
      lines.push(`${frame} = ${frame}.select(*[F.col(c) for c in ${frame}.columns[${start}:${end}]])`);
    } else if (value('mode') !== 'range' && names.length) {
      lines.push(`${frame} = ${frame}.select(*[F.col(c) for c in ${pyList(names)}])`);
    } else todo(value('mode') === 'range' ? 'Enter a valid column position range' : 'Add columns to select');
  } else if (item.id === 'createColumns') {
    const expressions = mappings('mappings');
    if (expressions.length) optimizedColumnMappings(expressions).forEach(expression => lines.push(`${frame} = ${frame}${expression}`));
    else todo('Add output column : SQL expression mappings');
  } else if (item.id === 'conditional') {
    addClassification(item, frame, lines);
  } else if (item.id.startsWith('delta')) {
    addDeltaOperation(item, lines);
  } else if (item.id === 'scd1') {
    addScdType1(item, frame, lines);
  } else if (item.id === 'scd2') {
    addScdType2(item, frame, lines);
  } else if (item.id === 'rename') {
    const pairs = mappings('mappings');
    if (pairs.length) for (const [oldName, newName] of pairs) lines.push(`${frame} = ${frame}.withColumnRenamed(${pyString(oldName)}, ${pyString(newName)})`);
    else todo('Add old name : new name mappings');
  } else if (item.id === 'dropColumns') {
    const names = columns('columns');
    if (names.length) lines.push(`${frame} = ${frame}.drop(*${pyList(names)})`);
    else todo('Add columns to remove');
  } else if (item.id === 'standardizeNames') {
    lines.push(`${frame} = ${frame}.toDF(*[re.sub(r"[^a-zA-Z0-9]+", "_", c).strip("_").lower() for c in ${frame}.columns])`);
  } else if (item.id === 'trimAll') {
    lines.push(`for _field in ${frame}.schema.fields:`);
    lines.push('    if isinstance(_field.dataType, StringType):');
    lines.push(`        ${frame} = ${frame}.withColumn(_field.name, F.trim(F.col(_field.name)))`);
  } else if (item.id === 'nulls') {
    const strategy = value('strategy');
    const names = columns('columns');
    const fill = value('fillValue');
    if (strategy === 'dropAny') lines.push(`${frame} = ${frame}.dropna()`);
    else if (strategy === 'dropAll') lines.push(`${frame} = ${frame}.dropna(how="all")`);
    else if (strategy === 'dropSubset') names.length ? lines.push(`${frame} = ${frame}.dropna(subset=${pyList(names)})`) : todo('Add required key columns for null removal');
    else if (strategy === 'fillValue') lines.push(`${frame} = ${frame}.fillna(${pyLiteral(fill || '0')}${names.length ? `, subset=${pyList(names)}` : ''})`);
    else if (strategy === 'fillMap') {
      const pairs = mappings('mappings');
      if (pairs.length) lines.push(`${frame} = ${frame}.fillna({${pairs.map(([column, fillValue]) => `${pyString(column)}: ${pyLiteral(fillValue)}`).join(', ')}})`);
      else todo('Add column : fill value mappings');
    } else {
      const source = value('target');
      const output = source;
      if (!source || fill === '') todo('Add a column and fallback or comparison value');
      else if (strategy === 'nullif') lines.push(`${frame} = ${frame}.withColumn(${pyString(output)}, F.when(F.col(${pyString(source)}) == F.lit(${pyLiteral(fill)}), F.lit(None)).otherwise(F.col(${pyString(source)})))`);
      else lines.push(`${frame} = ${frame}.withColumn(${pyString(output)}, F.coalesce(F.col(${pyString(source)}), F.lit(${pyLiteral(fill)})))`);
    }
  } else if (item.id === 'distinct') {
    const names = columns('columns');
    lines.push(names.length ? `${frame} = ${frame}.select(*[F.col(c) for c in ${pyList(names)}]).distinct()` : `${frame} = ${frame}.distinct()`);
  } else if (item.id === 'duplicates' || item.id === 'dedupKeys') {
    const names = item.id === 'duplicates' ? columns('columns') : columns('keys');
    if (item.id === 'dedupKeys' && !names.length) todo('Add key columns for deduplication');
    else lines.push(`${frame} = ${frame}.dropDuplicates(${names.length ? `subset=${pyList(names)}` : ''})`);
  } else if (item.id === 'latest') {
    const keys = columns('keys');
    const timestamp = value('timestamp');
    if (!keys.length || !timestamp) todo('Add key and timestamp columns to keep the latest record');
    else {
      lines.push(`_lakeloom_column_names = set(${frame}.columns)`);
      lines.push('_rank_col = "__lakeloom_dedup_rank"');
      lines.push('while _rank_col in _lakeloom_column_names:');
      lines.push('    _rank_col += "_"');
      lines.push(`_dedup_window = Window.partitionBy(*[F.col(c) for c in ${pyList(keys)}]).orderBy(F.col(${pyString(timestamp)}).desc())`);
      lines.push(`${frame} = ${frame}.withColumn(_rank_col, F.row_number().over(_dedup_window)).filter(F.col(_rank_col) == 1).drop(_rank_col)`);
    }
  } else if (item.id === 'filter') {
    const condition = value('condition');
    if (condition) lines.push(`${frame} = ${frame}.${value('method') || 'filter'}(${conditionExpression(condition, frame)})`);
    else todo('Add a PySpark Column or Spark SQL filter condition');
  } else if (item.id === 'sort') {
    const pairs = mappings('mappings').map(([column, direction]) => [column, direction.toLowerCase() === 'desc' ? 'desc' : 'asc']);
    if (pairs.length) {
      const method = value('method') === 'sort' ? 'sort' : 'orderBy';
      lines.push(`${frame} = ${frame}.${method}(`);
      pairs.forEach(([column, direction], index) => lines.push(`    F.col(${pyString(column)}).${direction}()${index < pairs.length - 1 ? ',' : ''}`));
      lines.push(')');
    } else todo('Add column : direction sort mappings');
  } else if (item.id === 'limit') {
    const count = value('count');
    if (/^\d+$/.test(count)) lines.push(`${frame} = ${frame}.limit(${count})`);
    else todo('Enter a whole number of rows to keep');
  } else if (item.kind === 'text') {
    addTextFunction(item, frame, lines);
  } else if (item.kind === 'numeric') {
    const fn = item.presetFn;
    const source = value('source');
    const target = value('target') || source;
    const arg = value('arg1');
    if (!source || !target) todo('Add the source and output column names');
    else if (fn === 'cast') lines.push(`${frame} = ${frame}.withColumn(${pyString(target)}, F.col(${pyString(source)}).cast(${pyString(arg || 'double')}))`);
    else if (fn === 'round') lines.push(`${frame} = ${frame}.withColumn(${pyString(target)}, F.round(F.col(${pyString(source)}), ${/^\d+$/.test(arg) ? arg : '2'}))`);
    else if (fn === 'abs') lines.push(`${frame} = ${frame}.withColumn(${pyString(target)}, F.abs(F.col(${pyString(source)})))`);
    else todo('Enter valid decimal places for rounding');
  } else if (item.id === 'dates') {
    const expressions = mappings('mappings');
    if (expressions.length) optimizedColumnMappings(expressions).forEach(expression => lines.push(`${frame} = ${frame}${expression}`));
    else todo('Add date output column : SQL expression mappings');
  } else if (item.kind === 'date') {
    addDateFunction(item, frame, lines);
  } else if (item.id === 'aggregate') {
    const groups = columns('groups');
    const aggs = mappings('mappings').map(([name, expression]) => `F.expr(${pyString(expression)}).alias(${pyString(name)})`);
    if (!groups.length || !aggs.length) todo('Add group-by columns and aggregate expressions');
    else if (value('mode') === 'pivot' && value('pivot')) {
      lines.push(`${frame} = ${frame}.groupBy(*[F.col(c) for c in ${pyList(groups)}]).pivot(${pyString(value('pivot'))}).agg(${aggs.join(', ')})`);
    } else if (value('mode') === 'pivot') todo('Add a pivot column');
    else lines.push(`${frame} = ${frame}.groupBy(*[F.col(c) for c in ${pyList(groups)}]).agg(${aggs.join(', ')})`);
  } else if (item.kind === 'window') {
    const fn = item.presetFn;
    const target = value('target');
    const order = value('order');
    const partitions = columns('partition');
    const direction = value('direction') === 'asc' ? 'asc' : 'desc';
    if (!target || !order || (fn === 'runningSum' && !value('source'))) todo('Add an output column, order column, and value column for cumulative sum');
    else {
      lines.push(`_window_spec = Window.partitionBy(*[F.col(c) for c in ${pyList(partitions)}]).orderBy(F.col(${pyString(order)}).${direction}())`);
      if (fn === 'runningSum') lines.push(`${frame} = ${frame}.withColumn(${pyString(target)}, F.sum(F.col(${pyString(value('source'))})).over(_window_spec.rowsBetween(Window.unboundedPreceding, Window.currentRow)))`);
      else lines.push(`${frame} = ${frame}.withColumn(${pyString(target)}, F.rank().over(_window_spec))`);
    }
  } else if (item.id === 'flattenNested') {
    const source = value('source');
    const mode = value('mode') || 'struct';
    const target = value('target');
    const position = value('position') || 'position';
    const nestedStructs = nestedStructsAfterTarget(value('nestedStructs'), target);
    if (mode === 'recursive') {
      const explodeSteps = flattenPlanLines(value('explodeSteps'));
      const selectFields = flattenPlanLines(value('selectFields'));
      const generator = value('recursiveExplodeMode') === 'explode_outer' ? 'explode_outer' : 'explode';
      if (!explodeSteps.length || !selectFields.length) todo('Add at least one array explode step and one output field');
      else {
        lines.push(`${frame} = (`);
        lines.push(`    ${frame}`);
        explodeSteps.forEach(([path, output]) => lines.push(`    .withColumn(${pyString(output)}, F.${generator}(F.col(${pyString(path)})))`));
        lines.push('    .select(');
        selectFields.forEach(([path, output], index) => {
          const expression = path === output ? `F.col(${pyString(path)})` : `F.col(${pyString(path)}).alias(${pyString(output)})`;
          lines.push(`        ${expression}${index < selectFields.length - 1 ? ',' : ''}`);
        });
        lines.push('    )');
        lines.push(')');
      }
    } else if (!source) todo('Set the nested struct or array column');
    else if (mode === 'struct') {
      const path = nestedStructPath(source);
      lines.push(`${frame} = (`);
      lines.push(`    ${frame}`);
      path.forEach(level => {
        lines.push(`    .select("*", F.col(${pyString(`${level}.*`)}))`);
        lines.push(`    .drop(${pyString(level)})`);
      });
      lines.push(')');
    } else {
      const flattenArrayStruct = mode.endsWith('_struct');
      const generator = mode.replace(/_struct$/, '');
      const hasPosition = generator.startsWith('posexplode');
      if (!target) todo('Set the output item column');
      else if (target === source || (hasPosition && (!position || position === source || position === target))) todo('Use different names for the source, item, and position columns');
      else if (['explode', 'explode_outer', 'posexplode', 'posexplode_outer'].includes(generator)) {
        const aliases = hasPosition ? `${pyString(position)}, ${pyString(target)}` : pyString(target);
        lines.push(`${frame} = (`);
        lines.push(`    ${frame}`);
        lines.push(`    .select("*", F.${generator}(F.col(${pyString(source)})).alias(${aliases}))`);
        if (flattenArrayStruct || nestedStructs.length) {
          lines.push(`    .select("*", F.col(${pyString(`${target}.*`)}))`);
          lines.push(`    .drop(${pyString(source)}, ${pyString(target)})`);
          nestedStructs.forEach(level => {
            lines.push(`    .select("*", F.col(${pyString(`${level}.*`)}))`);
            lines.push(`    .drop(${pyString(level)})`);
          });
        } else {
          lines.push(`    .drop(${pyString(source)})`);
        }
        lines.push(')');
      } else todo('Choose a supported nested flatten method');
    }
  } else if (item.kind === 'array') {
    addArrayFunction(item, frame, lines);
  } else if (item.kind === 'map') {
    addMapFunction(item, frame, lines);
  } else if (item.kind === 'json') {
    addJsonFunction(item, frame, lines);
  }
}

function addDateFunction(item, frame, lines) {
  const fn = item.presetFn;
  const source = getValue(item.id, 'source');
  const target = getValue(item.id, 'target');
  const arg = getValue(item.id, 'arg1');
  const other = getValue(item.id, 'otherSource');
  const col = `F.col(${pyString(source)})`;
  let expression;
  if (fn === 'current_date') expression = 'F.current_date()';
  else if (fn === 'current_timestamp') expression = 'F.current_timestamp()';
  else if (fn === 'to_date' && source && arg) expression = `F.to_date(${col}, ${pyString(arg)})`;
  else if (['year', 'month', 'dayofmonth', 'last_day'].includes(fn) && source) expression = `F.${fn}(${col})`;
  else if (fn === 'date_add' && source && /^-?\d+$/.test(arg)) expression = `F.date_add(${col}, ${arg})`;
  else if (fn === 'date_format' && source && arg) expression = `F.date_format(${col}, ${pyString(arg)})`;
  else if (fn === 'add_months' && source && /^-?\d+$/.test(arg)) expression = `F.add_months(${col}, ${arg})`;
  else if (fn === 'next_day' && source && arg) expression = `F.next_day(${col}, ${pyString(arg)})`;
  else if (fn === 'datediff' && source) expression = `F.datediff(${other ? `F.col(${pyString(other)})` : 'F.current_date()'}, ${col})`;
  else if (fn === 'months_between' && source) expression = `F.months_between(${other ? `F.col(${pyString(other)})` : 'F.current_date()'}, ${col})`;
  if (target && expression) lines.push(`${frame} = ${frame}.withColumn(${pyString(target)}, ${expression})`);
  else lines.push(`# TODO: Complete the inputs for the ${item.title.toLowerCase()} operation`);
}

function splitConditionResult(line) {
  let quote = '';
  let depth = 0;
  for (let index = 0; index < line.length; index++) {
    const character = line[index];
    if (quote) {
      if (character === quote && line[index + 1] === quote) index++;
      else if (character === quote && line[index - 1] !== '\\') quote = '';
      continue;
    }
    if (character === "'" || character === '"') quote = character;
    else if (character === '(') depth++;
    else if (character === ')') depth = Math.max(0, depth - 1);
    else if (character === ',' && depth === 0) return [line.slice(0, index).trim(), line.slice(index + 1).trim()];
  }
  const arrow = line.indexOf('=>');
  if (arrow > 0) return [line.slice(0, arrow).trim(), line.slice(arrow + 2).trim()];
  return null;
}

function classificationLiteral(rawValue) {
  const value = rawValue.trim();
  if ((value.startsWith("'") && value.endsWith("'")) || (value.startsWith('"') && value.endsWith('"'))) {
    return pyString(value.slice(1, -1).replaceAll(value[0] + value[0], value[0]));
  }
  return pyLiteral(value);
}

function conditionExpression(rawCondition, frame) {
  const condition = rawCondition.trim();
  const usesColumnApi = /\bF\.col\s*\(|\bcol\s*\(|\bdf\.[A-Za-z_]/.test(condition);
  if (!usesColumnApi) return `F.expr(${pyString(condition)})`;
  return condition
    .replace(/\bdf\./g, `${frame}.`)
    .replace(/(^|[^\w.])col\s*\(/g, '$1F.col(');
}

const schemaTypeConstructors = {
  string: 'StringType', str: 'StringType',
  integer: 'IntegerType', int: 'IntegerType',
  long: 'LongType', bigint: 'LongType',
  double: 'DoubleType', float: 'FloatType',
  boolean: 'BooleanType', bool: 'BooleanType',
  date: 'DateType', timestamp: 'TimestampType'
};

function addCreateFrameFromSchema(item, frame, lines) {
  const target = getValue(item.id, 'target');
  const definitions = parseMappings(getValue(item.id, 'schemaFields'));
  const rows = getValue(item.id, 'rows').split(/\r?\n/).map(row => row.trim()).filter(Boolean);
  const fields = definitions.map(([name, type]) => ({ name, type: schemaTypeConstructors[type.toLowerCase()] }));
  if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(target) || !fields.length || fields.some(field => !field.type)) {
    lines.push('# TODO: Use a valid DataFrame name and supported column : type definitions.');
    return;
  }
  if (!rows.length) {
    lines.push('# TODO: Add at least one JSON row array.');
    return;
  }
  try {
    const parsedRows = rows.map(row => JSON.parse(row));
    if (parsedRows.some(row => !Array.isArray(row) || row.length !== fields.length)) {
      lines.push('# TODO: Each JSON row must be an array with one value per schema column.');
      return;
    }
  } catch {
    lines.push('# TODO: Each row must be valid JSON, for example ["Madhur", 25, "Data Engineer", "Bijnor"].');
    return;
  }

  const schemaName = '_lakeloom_sample_schema';
  const rowsName = '_lakeloom_sample_rows';
  const newFrame = `${target}_new`;
  lines.push(`${schemaName} = StructType([`);
  for (const field of fields) lines.push(`    StructField(${pyString(field.name)}, ${field.type}(), True),`);
  lines.push('])');
  lines.push(`${target} = spark.createDataFrame([], schema=${schemaName})`);
  lines.push(`${rowsName} = [json.loads(line) for line in ${pyString(rows.join('\n'))}.splitlines() if line.strip()]`);
  lines.push(`${newFrame} = spark.createDataFrame(${rowsName}, schema=${schemaName})`);
  lines.push(`${target} = ${target}.unionByName(${newFrame})`);
  lines.push(`display(${target})`);
  lines.push(`# The source frame ${frame} remains available for the other selected transformations.`);
}

function quotedSqlName(name) {
  return `\`${name.replaceAll('`', '``')}\``;
}

function deltaTargetSpec(itemId, target) {
  const usePath = getValue(itemId, 'targetKind') === 'path';
  return {
    exists: usePath ? `DeltaTable.isDeltaTable(spark, ${pyString(target)})` : `spark.catalog.tableExists(${pyString(target)})`,
    open: usePath ? `DeltaTable.forPath(spark, ${pyString(target)})` : `DeltaTable.forName(spark, ${pyString(target)})`,
    save: usePath ? `save(${pyString(target)})` : `saveAsTable(${pyString(target)})`
  };
}

function deltaConditionExpression(rawCondition) {
  const condition = rawCondition.trim();
  if (/\bF\.col\s*\(|\bcol\s*\(/.test(condition)) {
    return condition.replace(/(^|[^\w.])col\s*\(/g, '$1F.col(');
  }
  return `F.expr(${pyString(condition)})`;
}

function addDeltaOperation(item, lines) {
  const target = getValue(item.id, 'target');
  if (!target) {
    lines.push('# TODO: Set the Delta table name or storage path.');
    return;
  }
  const targetSpec = deltaTargetSpec(item.id, target);

  if (item.id === 'deltaInspect') {
    const action = getValue(item.id, 'action') === 'detail' ? 'detail' : 'history';
    const limit = getValue(item.id, 'historyLimit');
    const inspection = action === 'detail'
      ? '_lakeloom_delta_target.detail()'
      : /^\d+$/.test(limit) && Number(limit) > 0
        ? `_lakeloom_delta_target.history(${limit})`
        : '_lakeloom_delta_target.history()';
    lines.push(`# Inspect Delta ${action === 'history' ? 'transaction history' : 'table details'}.`);
    lines.push(`_lakeloom_delta_target = ${targetSpec.open}`);
    lines.push(`display(${inspection})`);
  } else if (item.id === 'deltaDelete') {
    const condition = getValue(item.id, 'condition');
    if (!condition) {
      lines.push('# TODO: Add a condition to identify the Delta rows to delete.');
      return;
    }
    lines.push('# Delete only rows that match the selected condition.');
    lines.push(`_lakeloom_delta_target = ${targetSpec.open}`);
    lines.push(`_lakeloom_delta_target.delete(condition=${deltaConditionExpression(condition)})`);
  } else if (item.id === 'deltaRestore') {
    const version = getValue(item.id, 'version');
    if (!/^\d+$/.test(version)) {
      lines.push('# TODO: Enter a non-negative Delta version number to restore.');
      return;
    }
    lines.push(`# Restore the Delta table to version ${version}.`);
    lines.push(`_lakeloom_delta_target = ${targetSpec.open}`);
    lines.push(`_lakeloom_restore_metrics = _lakeloom_delta_target.restoreToVersion(${version})`);
    lines.push('display(_lakeloom_restore_metrics)');
  } else if (item.id === 'deltaVacuum') {
    const retention = getValue(item.id, 'retentionHours');
    if (!/^\d+(?:\.\d+)?$/.test(retention)) {
      lines.push('# TODO: Enter a non-negative Delta retention period in hours.');
      return;
    }
    lines.push('# Vacuum removes data files outside the configured retention window.');
    if (Number(retention) < 168) lines.push('# Review Delta retention safety checks and time-travel requirements before using less than 168 hours.');
    lines.push(`_lakeloom_delta_target = ${targetSpec.open}`);
    lines.push(`_lakeloom_vacuum_result = _lakeloom_delta_target.vacuum(retentionHours=${retention})`);
    lines.push('display(_lakeloom_vacuum_result)');
  } else if (item.id === 'deltaCompare') {
    const fromVersion = getValue(item.id, 'fromVersion');
    const toVersion = getValue(item.id, 'toVersion');
    if (!/^\d+$/.test(fromVersion) || !/^\d+$/.test(toVersion) || fromVersion === toVersion) {
      lines.push('# TODO: Enter two different non-negative Delta version numbers.');
      return;
    }
    const readAtVersion = version => getValue(item.id, 'targetKind') === 'path'
      ? `spark.read.format("delta").option("versionAsOf", ${version}).load(${pyString(target)})`
      : `spark.read.option("versionAsOf", ${version}).table(${pyString(target)})`;
    const comparison = getValue(item.id, 'comparison') === 'except' ? 'except' : 'exceptAll';
    lines.push(`# Rows in version ${fromVersion} that are not in version ${toVersion}.`);
    lines.push(`_lakeloom_delta_version_${fromVersion} = ${readAtVersion(fromVersion)}`);
    lines.push(`_lakeloom_delta_version_${toVersion} = ${readAtVersion(toVersion)}`);
    lines.push(`_lakeloom_delta_difference = _lakeloom_delta_version_${fromVersion}.${comparison}(_lakeloom_delta_version_${toVersion})`);
    lines.push('display(_lakeloom_delta_difference)');
  }
}

function addScdType1(item, frame, lines) {
  const target = getValue(item.id, 'target');
  const keys = csvList(getValue(item.id, 'keys'));
  const updateColumns = csvList(getValue(item.id, 'updateColumns'));
  if (!target || !keys.length || new Set(keys).size !== keys.length || new Set(updateColumns).size !== updateColumns.length || updateColumns.some(column => keys.includes(column))) {
    lines.push('# TODO: Set the Delta target and at least one business key for SCD Type 1.');
    if (updateColumns.some(column => keys.includes(column))) lines.push('# TODO: Do not include business key columns in the update list.');
    return;
  }

  const targetSpec = deltaTargetSpec(item.id, target);
  const mergeCondition = keys.map(key => `target.${quotedSqlName(key)} = source.${quotedSqlName(key)}`).join(' AND ');
  lines.push('# SCD Type 1: update matched rows in place and insert new business keys.');
  lines.push(`_lakeloom_scd1_keys = ${pyList(keys)}`);
  lines.push(`_lakeloom_scd1_null_source_keys = ${frame}.filter(${keys.map(key => `F.col(${pyString(key)}).isNull()`).join(' | ')}).limit(1).count()`);
  lines.push('if _lakeloom_scd1_null_source_keys:');
  lines.push('    raise ValueError("SCD Type 1 business keys cannot be null.")');
  lines.push(`_lakeloom_scd1_duplicate_source_keys = ${frame}.groupBy(*[F.col(column) for column in _lakeloom_scd1_keys]).count().filter(F.col("count") > 1).limit(1).count()`);
  lines.push('if _lakeloom_scd1_duplicate_source_keys:');
  lines.push('    raise ValueError("SCD Type 1 requires one source row per business key.")');
  lines.push(`_lakeloom_scd1_exists = ${targetSpec.exists}`);
  lines.push('if not _lakeloom_scd1_exists:');
  lines.push(`    ${frame}.write.format("delta").mode("overwrite").${targetSpec.save}`);
  lines.push('else:');
  lines.push(`    _lakeloom_scd1_target = ${targetSpec.open}`);
  lines.push('    _lakeloom_scd1_duplicate_target_keys = _lakeloom_scd1_target.toDF().groupBy(*[F.col(column) for column in _lakeloom_scd1_keys]).count().filter(F.col("count") > 1).limit(1).count()');
  lines.push('    if _lakeloom_scd1_duplicate_target_keys:');
  lines.push('        raise ValueError("SCD Type 1 target must contain one row per business key.")');
  lines.push('    (');
  lines.push('        _lakeloom_scd1_target.alias("target").merge(');
  lines.push(`            ${frame}.alias("source"),`);
  lines.push(`            ${pyString(mergeCondition)}`);
  lines.push('        )');
  if (updateColumns.length) {
    lines.push('        .whenMatchedUpdate(set={');
    for (const column of updateColumns) lines.push(`            ${pyString(column)}: ${pyString(`source.${quotedSqlName(column)}`)},`);
    lines.push('        })');
  } else {
    lines.push('        .whenMatchedUpdateAll()');
  }
  lines.push('        .whenNotMatchedInsertAll()');
  lines.push('        .execute()');
  lines.push('    )');
}

function addScdType2(item, frame, lines) {
  const target = getValue(item.id, 'target');
  const keys = csvList(getValue(item.id, 'keys'));
  const trackedColumns = csvList(getValue(item.id, 'trackedColumns'));
  const effectiveColumn = getValue(item.id, 'effectiveColumn');
  const validFrom = getValue(item.id, 'validFrom');
  const validTo = getValue(item.id, 'validTo');
  const currentFlag = getValue(item.id, 'currentFlag');
  const historyColumns = [validFrom, validTo, currentFlag];
  const configuredColumns = [...keys, ...trackedColumns, ...historyColumns];
  const hasOverlappingColumns = new Set(configuredColumns).size !== configuredColumns.length;
  if (!target || !keys.length || !trackedColumns.length || historyColumns.some(column => !column) || hasOverlappingColumns) {
    lines.push('# TODO: Set a Delta target, business key, tracked columns, and three unique history columns for SCD Type 2.');
    if (hasOverlappingColumns) lines.push('# TODO: Keep business keys, tracked columns, and history columns distinct.');
    return;
  }

  const targetSpec = deltaTargetSpec(item.id, target);
  const effectiveExpression = effectiveColumn
    ? `F.coalesce(F.col(${pyString(effectiveColumn)}).cast("timestamp"), F.current_timestamp())`
    : 'F.current_timestamp()';
  const keyMatches = keys.map(key => `(F.col(${pyString(`source.${quotedSqlName(key)}`)}) == F.col(${pyString(`target.${quotedSqlName(key)}`)}))`);
  const changedChecks = trackedColumns.map(column => `(~F.col(${pyString(`target.${quotedSqlName(column)}`)}).eqNullSafe(F.col(${pyString(`source.${quotedSqlName(column)}`)})))`);
  const mergeCondition = [
    ...keys.map(key => `target.${quotedSqlName(key)} = source.${quotedSqlName(key)}`),
    `target.${quotedSqlName(currentFlag)} = true`,
    "source.__lakeloom_merge_action = 'expire'"
  ].join(' AND ');

  lines.push('# SCD Type 2: expire changed active rows and insert new versions.');
  lines.push('# Enforce one source row per business key and one active target row per key.');
  lines.push(`_lakeloom_scd2_keys = ${pyList(keys)}`);
  lines.push(`_lakeloom_scd2_exists = ${targetSpec.exists}`);
  lines.push('_lakeloom_scd2_source = (');
  lines.push(`    ${frame}`);
  lines.push(`    .withColumn(${pyString(validFrom)}, ${effectiveExpression})`);
  lines.push(`    .withColumn(${pyString(validTo)}, F.lit(None).cast("timestamp"))`);
  lines.push(`    .withColumn(${pyString(currentFlag)}, F.lit(True))`);
  lines.push(')');
  lines.push('_lakeloom_scd2_duplicate_source_keys = _lakeloom_scd2_source.groupBy(*[F.col(column) for column in _lakeloom_scd2_keys]).count().filter(F.col("count") > 1).limit(1).count()');
  lines.push('if _lakeloom_scd2_duplicate_source_keys:');
  lines.push('    raise ValueError("SCD Type 2 requires one source row per business key per run.")');
  lines.push(`_lakeloom_scd2_null_source_keys = _lakeloom_scd2_source.filter(${keys.map(key => `F.col(${pyString(key)}).isNull()`).join(' | ')}).limit(1).count()`);
  lines.push('if _lakeloom_scd2_null_source_keys:');
  lines.push('    raise ValueError("SCD Type 2 business keys cannot be null.")');
  lines.push('if not _lakeloom_scd2_exists:');
  lines.push(`    _lakeloom_scd2_source.write.format("delta").mode("overwrite").${targetSpec.save}`);
  lines.push('else:');
  lines.push(`    _lakeloom_scd2_target = ${targetSpec.open}`);
  lines.push(`    _lakeloom_scd2_current = _lakeloom_scd2_target.toDF().filter(F.col(${pyString(currentFlag)}) == F.lit(True))`);
  lines.push('    _lakeloom_scd2_duplicate_current_keys = _lakeloom_scd2_current.groupBy(*[F.col(column) for column in _lakeloom_scd2_keys]).count().filter(F.col("count") > 1).limit(1).count()');
  lines.push('    if _lakeloom_scd2_duplicate_current_keys:');
  lines.push('        raise ValueError("SCD Type 2 target must contain only one active version per business key.")');
  lines.push('    _lakeloom_scd2_key_match = (');
  keyMatches.forEach((condition, index) => lines.push(`        ${index ? '& ' : ''}${condition}`));
  lines.push('    )');
  lines.push('    _lakeloom_scd2_changed = (');
  changedChecks.forEach((condition, index) => lines.push(`        ${index ? '| ' : ''}${condition}`));
  lines.push('    )');
  lines.push('    _lakeloom_scd2_joined = _lakeloom_scd2_source.alias("source").join(');
  lines.push('        _lakeloom_scd2_current.alias("target"),');
  lines.push('        _lakeloom_scd2_key_match,');
  lines.push('        "inner"');
  lines.push('    )');
  lines.push('    _lakeloom_scd2_changed_rows = _lakeloom_scd2_joined.filter(_lakeloom_scd2_changed).select("source.*")');
  lines.push('    _lakeloom_scd2_new_rows = (');
  lines.push('        _lakeloom_scd2_source.alias("source").join(');
  lines.push('            _lakeloom_scd2_current.alias("target"),');
  lines.push('            _lakeloom_scd2_key_match,');
  lines.push('            "left_anti"');
  lines.push('        ).select("source.*")');
  lines.push('    )');
  lines.push('    _lakeloom_scd2_expire_rows = _lakeloom_scd2_changed_rows.withColumn("__lakeloom_merge_action", F.lit("expire"))');
  lines.push('    _lakeloom_scd2_insert_rows = (');
  lines.push('        _lakeloom_scd2_new_rows.unionByName(_lakeloom_scd2_changed_rows)');
  lines.push('        .withColumn("__lakeloom_merge_action", F.lit("insert"))');
  lines.push('    )');
  lines.push('    _lakeloom_scd2_merge_rows = _lakeloom_scd2_expire_rows.unionByName(_lakeloom_scd2_insert_rows)');
  lines.push('    _lakeloom_scd2_insert_values = {');
  lines.push('        column: f"source.`{column}`"');
  lines.push('        for column in _lakeloom_scd2_merge_rows.columns');
  lines.push('        if column != "__lakeloom_merge_action"');
  lines.push('    }');
  lines.push('    (');
  lines.push('        _lakeloom_scd2_target.alias("target").merge(');
  lines.push('            _lakeloom_scd2_merge_rows.alias("source"),');
  lines.push(`            ${pyString(mergeCondition)}`);
  lines.push('        )');
  lines.push('        .whenMatchedUpdate(set={');
  lines.push(`            ${pyString(validTo)}: ${pyString(`source.${quotedSqlName(validFrom)}`)},`);
  lines.push(`            ${pyString(currentFlag)}: "false"`);
  lines.push('        })');
  lines.push('        .whenNotMatchedInsert(');
  lines.push('            condition="source.__lakeloom_merge_action = \'insert\'",');
  lines.push('            values=_lakeloom_scd2_insert_values');
  lines.push('        )');
  lines.push('        .execute()');
  lines.push('    )');
}

function addClassification(item, frame, lines) {
  const target = getValue(item.id, 'target');
  const cases = getValue(item.id, 'cases').split('\n').map(splitConditionResult).filter(pair => pair && pair[0] && pair[1]);
  if (!target || !cases.length) {
    lines.push('# TODO: Add an output column and condition, result pairs');
    return;
  }
  const fallback = getValue(item.id, 'otherwise') || 'Unknown';
  lines.push(`${frame} = ${frame}.withColumn(`);
  lines.push(`    ${pyString(target)},`);
  lines.push(`    F.when(${conditionExpression(cases[0][0], frame)}, F.lit(${classificationLiteral(cases[0][1])}))`);
  for (const [condition, result] of cases.slice(1)) {
    lines.push(`        .when(${conditionExpression(condition, frame)}, F.lit(${classificationLiteral(result)}))`);
  }
  lines.push(`        .otherwise(F.lit(${classificationLiteral(fallback)}))`);
  lines.push(')');
}

function addTextFunction(item, frame, lines) {
  const fn = item.presetFn;
  const source = getValue(item.id, 'source');
  const target = getValue(item.id, 'target') || source;
  const arg1 = getValue(item.id, 'arg1');
  const arg2 = getValue(item.id, 'arg2');
  const arg3 = getValue(item.id, 'arg3');
  const col = `F.col(${pyString(source)})`;
  const unary = { upper: 'upper', lower: 'lower', initcap: 'initcap', trim: 'trim', ltrim: 'ltrim', rtrim: 'rtrim', length: 'length', reverse: 'reverse' };
  if (fn === 'concat' || fn === 'concat_ws') {
    const names = csvList(getValue(item.id, 'columns'));
    if (!names.length) return lines.push('# TODO: Add columns to concatenate');
    const args = names.map(name => `F.col(${pyString(name)})`).join(', ');
    const expression = fn === 'concat' ? `F.concat(${args})` : `F.concat_ws(${pyString(arg3 || '-')}, ${args})`;
    return lines.push(`${frame} = ${frame}.withColumn(${pyString(target || 'combined_text')}, ${expression})`);
  }
  if (!source || !target) return lines.push('# TODO: Add source and output columns for the text function');
  let expression;
  if (unary[fn]) expression = `F.${unary[fn]}(${col})`;
  else if (fn === 'substring' && /^-?\d+$/.test(arg1) && /^\d+$/.test(arg2)) expression = `F.substring(${col}, ${arg1}, ${arg2})`;
  else if ((fn === 'left' || fn === 'right') && /^\d+$/.test(arg1)) expression = `F.${fn}(${col}, ${arg1})`;
  else if (fn === 'replace' && arg1 !== '') expression = `F.replace(${col}, F.lit(${pyLiteral(arg1)}), F.lit(${pyLiteral(arg2)}))`;
  else if (fn === 'regexp_replace' && arg1 !== '') expression = `F.regexp_replace(${col}, ${pyString(arg1)}, ${pyString(arg2)})`;
  else if (fn === 'regexp_extract' && arg1 !== '') expression = `F.regexp_extract(${col}, ${pyString(arg1)}, ${/^\d+$/.test(arg3) ? arg3 : '0'})`;
  else if (fn === 'split' && arg1 !== '') expression = `F.split(${col}, ${pyString(arg1)})`;
  else if (fn === 'split_item' && arg1 !== '' && /^\d+$/.test(arg2)) expression = `F.split(${col}, ${pyString(arg1)}).getItem(${arg2})`;
  else if (fn === 'translate' && arg1 !== '') expression = `F.translate(${col}, ${pyString(arg1)}, ${pyString(arg2)})`;
  else if ((fn === 'lpad' || fn === 'rpad') && /^\d+$/.test(arg1)) expression = `F.${fn}(${col}, ${arg1}, ${pyString(arg3 || ' ')})`;
  if (expression) lines.push(`${frame} = ${frame}.withColumn(${pyString(target)}, ${expression})`);
  else lines.push(`# TODO: Complete the inputs for the ${fn} text operation`);
}

function addArrayFunction(item, frame, lines) {
  const fn = item.presetFn;
  const source = getValue(item.id, 'source');
  const target = getValue(item.id, 'target');
  const other = getValue(item.id, 'otherSource');
  const names = csvList(getValue(item.id, 'columns'));
  const arg = getValue(item.id, 'arg1');
  const col = `F.col(${pyString(source)})`;
  if (fn === 'create' && names.length && target) lines.push(`${frame} = ${frame}.withColumn(${pyString(target)}, F.array(*[F.col(c) for c in ${pyList(names)}]))`);
  else if (['explode', 'explode_outer'].includes(fn) && source && target) lines.push(`${frame} = ${frame}.select("*", F.${fn}(${col}).alias(${pyString(target)}))`);
  else if (fn === 'posexplode' && source && target) lines.push(`${frame} = ${frame}.select("*", F.posexplode(${col}).alias(${pyString(getValue(item.id, 'position') || 'position')}, ${pyString(target)}))`);
  else if (fn === 'contains' && source && target && arg !== '') lines.push(`${frame} = ${frame}.withColumn(${pyString(target)}, F.array_contains(${col}, F.lit(${pyLiteral(arg)})))`);
  else if (['size', 'sort_array', 'array_distinct'].includes(fn) && source && target) lines.push(`${frame} = ${frame}.withColumn(${pyString(target)}, F.${fn}(${col}))`);
  else if (['array_union', 'array_intersect', 'array_except'].includes(fn) && source && other && target) lines.push(`${frame} = ${frame}.withColumn(${pyString(target)}, F.${fn}(${col}, F.col(${pyString(other)})))`);
  else if (fn === 'get_item' && source && target && /^\d+$/.test(arg)) lines.push(`${frame} = ${frame}.withColumn(${pyString(target)}, ${col}.getItem(${arg}))`);
  else lines.push('# TODO: Complete the array function inputs');
}

function addMapFunction(item, frame, lines) {
  const fn = item.presetFn;
  const source = getValue(item.id, 'source');
  const target = getValue(item.id, 'target');
  const expression = fn === 'map_from_arrays'
    ? `F.map_from_arrays(F.col(${pyString(source)}), F.col(${pyString(getValue(item.id, 'values'))}))`
    : `F.${fn}(F.col(${pyString(source)}))`;
  if (source && target && (fn !== 'map_from_arrays' || getValue(item.id, 'values'))) lines.push(`${frame} = ${frame}.withColumn(${pyString(target)}, ${expression})`);
  else lines.push('# TODO: Add the map source, output column, and values array if needed');
}

function addJsonFunction(item, frame, lines) {
  const fn = item.presetFn;
  const source = getValue(item.id, 'source');
  const target = getValue(item.id, 'target');
  const arg = getValue(item.id, 'arg1');
  let expression;
  if (fn === 'struct') {
    const names = csvList(getValue(item.id, 'columns'));
    if (names.length) expression = `F.struct(*[F.col(c) for c in ${pyList(names)}])`;
  } else if (fn === 'get_json_object' && arg) expression = `F.get_json_object(F.col(${pyString(source)}), ${pyString(arg)})`;
  else if (fn === 'from_json' && arg) expression = `F.from_json(F.col(${pyString(source)}), ${pyString(arg)})`;
  else if (fn === 'to_json') expression = `F.to_json(F.col(${pyString(source)}))`;
  if (target && expression && (fn === 'struct' || source)) lines.push(`${frame} = ${frame}.withColumn(${pyString(target)}, ${expression})`);
  else lines.push('# TODO: Complete the struct or JSON function inputs');
}

function chainOperation(item, frame) {
  const value = key => getValue(item.id, key);
  const columns = key => csvList(value(key));
  const mappings = key => parseMappings(value(key));
  const col = name => `F.col(${pyString(name)})`;

  if (item.id === 'selectColumns') {
    const names = validSelectionColumns(item, columns('columns'));
    const start = value('startIndex');
    const end = value('endIndex');
    if (value('mode') === 'range') {
      return /^\d+$/.test(start) && /^\d+$/.test(end) && Number(end) > Number(start)
        ? `.select(*[F.col(c) for c in ${frame}.columns[${start}:${end}]])`
        : null;
    }
    return names.length
      ? `.select(\n${names.map((name, index) => `    F.col(${pyString(name)})${index < names.length - 1 ? ',' : ''}`).join('\n')})`
      : null;
  }
  if (item.id === 'dropColumns') {
    const names = columns('columns');
    return names.length ? `.drop(*${pyList(names)})` : null;
  }
  if (item.id === 'filter') {
    const condition = value('condition');
    const method = value('method') === 'where' ? 'where' : 'filter';
    return condition ? `.${method}(${conditionExpression(condition, frame)})` : null;
  }
  if (item.id === 'limit') {
    const count = value('count');
    return /^\d+$/.test(count) ? `.limit(${count})` : null;
  }
  if (item.id === 'distinct') {
    const names = columns('columns');
    return names.length ? `.select(*[F.col(c) for c in ${pyList(names)}]).distinct()` : '.distinct()';
  }
  if (['duplicates', 'dedupKeys'].includes(item.id)) {
    const names = columns(item.id === 'duplicates' ? 'columns' : 'keys');
    if (item.id === 'dedupKeys' && !names.length) return null;
    return `.dropDuplicates(${names.length ? `subset=${pyList(names)}` : ''})`;
  }
  if (item.id === 'sort') {
    const pairs = mappings('mappings').map(([name, direction]) => [name, direction.toLowerCase() === 'desc' ? 'desc' : 'asc']);
    const method = value('method') === 'sort' ? 'sort' : 'orderBy';
    return pairs.length
      ? `.${method}(\n${pairs.map(([name, direction]) => `    ${col(name)}.${direction}()`).join(',\n')}\n)`
      : null;
  }
  if (item.id === 'rename') {
    const pairs = mappings('mappings');
    return pairs.length ? pairs.map(([oldName, newName]) => `.withColumnRenamed(${pyString(oldName)}, ${pyString(newName)})`).join('\n') : null;
  }
  if (item.id === 'createColumns') {
    const pairs = mappings('mappings');
    return pairs.length ? optimizedColumnMappings(pairs).join('\n') : null;
  }
  if (item.id === 'nulls') {
    const strategy = value('strategy');
    const names = columns('columns');
    const fill = value('fillValue');
    if (strategy === 'dropAny') return '.dropna()';
    if (strategy === 'dropAll') return '.dropna(how="all")';
    if (strategy === 'dropSubset') return names.length ? `.dropna(subset=${pyList(names)})` : null;
    if (strategy === 'fillValue') return `.fillna(${pyLiteral(fill || '0')}${names.length ? `, subset=${pyList(names)}` : ''})`;
    if (strategy === 'fillMap') {
      const pairs = mappings('mappings');
      return pairs.length ? `.fillna({${pairs.map(([name, fillValue]) => `${pyString(name)}: ${pyLiteral(fillValue)}`).join(', ')}})` : null;
    }
    const source = value('target');
    if (!source || fill === '') return null;
    if (strategy === 'nullif') return `.withColumn(${pyString(source)}, F.when(${col(source)} == F.lit(${pyLiteral(fill)}), F.lit(None)).otherwise(${col(source)}))`;
    return `.withColumn(${pyString(source)}, F.coalesce(${col(source)}, F.lit(${pyLiteral(fill)})))`;
  }
  if (item.id === 'conditional') {
    const target = value('target');
    const cases = value('cases').split('\n').map(splitConditionResult).filter(pair => pair && pair[0] && pair[1]);
    if (!target || !cases.length) return null;
    const fallback = value('otherwise') || 'Unknown';
    const conditions = cases.map(([condition, result], index) => `${index ? '    .when' : 'F.when'}(${conditionExpression(condition, frame)}, F.lit(${classificationLiteral(result)}))`);
    return `.withColumn(\n    ${pyString(target)},\n    ${conditions.join('\n    ')}\n        .otherwise(F.lit(${classificationLiteral(fallback)}))\n)`;
  }
  if (item.id === 'flattenNested') {
    const source = value('source');
    const mode = value('mode') || 'struct';
    const target = value('target');
    const position = value('position') || 'position';
    const nestedStructs = nestedStructsAfterTarget(value('nestedStructs'), target);
    if (mode === 'recursive') {
      const explodeSteps = flattenPlanLines(value('explodeSteps'));
      const selectFields = flattenPlanLines(value('selectFields'));
      const generator = value('recursiveExplodeMode') === 'explode_outer' ? 'explode_outer' : 'explode';
      if (!explodeSteps.length || !selectFields.length) return null;
      const explosions = explodeSteps.map(([path, output]) => `.withColumn(${pyString(output)}, F.${generator}(F.col(${pyString(path)})))`);
      const selections = selectFields.map(([path, output]) => path === output
        ? `    F.col(${pyString(path)})`
        : `    F.col(${pyString(path)}).alias(${pyString(output)})`);
      return [...explosions, `.select(\n${selections.join(',\n')}\n)`].join('\n');
    }
    if (!source) return null;
    if (mode === 'struct') return nestedStructPath(source)
      .flatMap(level => [`.select("*", F.col(${pyString(`${level}.*`)}))`, `.drop(${pyString(level)})`])
      .join('\n');
    if (!target || target === source) return null;
    const flattenArrayStruct = mode.endsWith('_struct');
    const generator = mode.replace(/_struct$/, '');
    const hasPosition = generator.startsWith('posexplode');
    if (!['explode', 'explode_outer', 'posexplode', 'posexplode_outer'].includes(generator)) return null;
    if (hasPosition && (!position || position === source || position === target)) return null;
    const aliases = hasPosition ? `${pyString(position)}, ${pyString(target)}` : pyString(target);
    const flattened = flattenArrayStruct || nestedStructs.length
      ? [`.select("*", F.col(${pyString(`${target}.*`)}))`, `.drop(${pyString(source)}, ${pyString(target)})`, ...nestedStructs.flatMap(level => [`.select("*", F.col(${pyString(`${level}.*`)}))`, `.drop(${pyString(level)})`])].join('\n')
      : `.drop(${pyString(source)})`;
    return `.select("*", F.${generator}(${col(source)}).alias(${aliases}))${flattened.replace(/^\./, '\n.')}`;
  }
  if (item.id === 'standardizeNames') {
    return `.transform(lambda _d: _d.toDF(*[re.sub(r"[^a-zA-Z0-9]+", "_", c).strip("_").lower() for c in _d.columns]))`;
  }
  if (item.id === 'trimAll') {
    return `.transform(lambda _d: _d.select(*[F.trim(F.col(field.name)).alias(field.name) if field.dataType.typeName() == "string" else F.col(field.name) for field in _d.schema.fields]))`;
  }
  if (item.id === 'dates') {
    const pairs = mappings('mappings');
    return pairs.length ? optimizedColumnMappings(pairs).join('\n') : null;
  }
  if (item.id === 'aggregate') {
    const groups = columns('groups');
    const aggs = mappings('mappings').map(([name, expression]) => `F.expr(${pyString(expression)}).alias(${pyString(name)})`);
    if (!groups.length || !aggs.length) return null;
    const grouped = `.groupBy(*[F.col(c) for c in ${pyList(groups)}])`;
    if (value('mode') === 'pivot') return value('pivot') ? `${grouped}.pivot(${pyString(value('pivot'))}).agg(${aggs.join(', ')})` : null;
    return `${grouped}.agg(${aggs.join(', ')})`;
  }
  if (item.kind === 'window') {
    const fn = item.presetFn;
    const target = value('target');
    const order = value('order');
    const partitions = columns('partition');
    const direction = value('direction') === 'asc' ? 'asc' : 'desc';
    if (!target || !order || (fn === 'runningSum' && !value('source'))) return null;
    const windowSpec = `Window.partitionBy(*[F.col(c) for c in ${pyList(partitions)}]).orderBy(F.col(${pyString(order)}).${direction}())`;
    if (fn === 'runningSum') return `.withColumn(${pyString(target)}, F.sum(${col(value('source'))}).over(${windowSpec}.rowsBetween(Window.unboundedPreceding, Window.currentRow)))`;
    return `.withColumn(${pyString(target)}, F.rank().over(${windowSpec}))`;
  }
  if (item.kind === 'date') {
    const fn = item.presetFn;
    const source = value('source');
    const target = value('target');
    const arg = value('arg1');
    const other = value('otherSource');
    let expression;
    if (fn === 'current_date') expression = 'F.current_date()';
    else if (fn === 'current_timestamp') expression = 'F.current_timestamp()';
    else if (fn === 'to_date' && source && arg) expression = `F.to_date(${col(source)}, ${pyString(arg)})`;
    else if (['year', 'month', 'dayofmonth', 'last_day'].includes(fn) && source) expression = `F.${fn}(${col(source)})`;
    else if (fn === 'date_add' && source && /^-?\d+$/.test(arg)) expression = `F.date_add(${col(source)}, ${arg})`;
    else if (fn === 'date_format' && source && arg) expression = `F.date_format(${col(source)}, ${pyString(arg)})`;
    else if (fn === 'add_months' && source && /^-?\d+$/.test(arg)) expression = `F.add_months(${col(source)}, ${arg})`;
    else if (fn === 'next_day' && source && arg) expression = `F.next_day(${col(source)}, ${pyString(arg)})`;
    else if (fn === 'datediff' && source) expression = `F.datediff(${other ? col(other) : 'F.current_date()'}, ${col(source)})`;
    else if (fn === 'months_between' && source) expression = `F.months_between(${other ? col(other) : 'F.current_date()'}, ${col(source)})`;
    return target && expression ? `.withColumn(${pyString(target)}, ${expression})` : null;
  }
  if (item.kind === 'text') {
    const fn = item.presetFn;
    const source = value('source');
    const target = value('target') || source;
    const arg1 = value('arg1');
    const arg2 = value('arg2');
    const arg3 = value('arg3');
    if (fn === 'concat' || fn === 'concat_ws') {
      const names = columns('columns');
      if (!names.length) return null;
      const args = names.map(col).join(', ');
      const expression = fn === 'concat' ? `F.concat(${args})` : `F.concat_ws(${pyString(arg3 || '-')}, ${args})`;
      return `.withColumn(${pyString(target || 'combined_text')}, ${expression})`;
    }
    if (!source || !target) return null;
    const unary = { upper: 'upper', lower: 'lower', initcap: 'initcap', trim: 'trim', ltrim: 'ltrim', rtrim: 'rtrim', length: 'length', reverse: 'reverse' };
    let expression;
    if (unary[fn]) expression = `F.${unary[fn]}(${col(source)})`;
    else if (fn === 'substring' && /^-?\d+$/.test(arg1) && /^\d+$/.test(arg2)) expression = `F.substring(${col(source)}, ${arg1}, ${arg2})`;
    else if (['left', 'right'].includes(fn) && /^\d+$/.test(arg1)) expression = `F.${fn}(${col(source)}, ${arg1})`;
    else if (fn === 'replace' && arg1 !== '') expression = `F.replace(${col(source)}, F.lit(${pyLiteral(arg1)}), F.lit(${pyLiteral(arg2)}))`;
    else if (fn === 'regexp_replace' && arg1 !== '') expression = `F.regexp_replace(${col(source)}, ${pyString(arg1)}, ${pyString(arg2)})`;
    else if (fn === 'regexp_extract' && arg1 !== '') expression = `F.regexp_extract(${col(source)}, ${pyString(arg1)}, ${/^\d+$/.test(arg3) ? arg3 : '0'})`;
    else if (fn === 'split' && arg1 !== '') expression = `F.split(${col(source)}, ${pyString(arg1)})`;
    else if (fn === 'split_item' && arg1 !== '' && /^\d+$/.test(arg2)) expression = `F.split(${col(source)}, ${pyString(arg1)}).getItem(${arg2})`;
    else if (fn === 'translate' && arg1 !== '') expression = `F.translate(${col(source)}, ${pyString(arg1)}, ${pyString(arg2)})`;
    else if (['lpad', 'rpad'].includes(fn) && /^\d+$/.test(arg1)) expression = `F.${fn}(${col(source)}, ${arg1}, ${pyString(arg3 || ' ')})`;
    return expression ? `.withColumn(${pyString(target)}, ${expression})` : null;
  }
  if (item.kind === 'numeric') {
    const fn = item.presetFn;
    const source = value('source');
    const target = value('target') || source;
    const arg = value('arg1');
    if (!source || !target) return null;
    if (fn === 'cast') return `.withColumn(${pyString(target)}, ${col(source)}.cast(${pyString(arg || 'double')}))`;
    if (fn === 'round') return `.withColumn(${pyString(target)}, F.round(${col(source)}, ${/^\d+$/.test(arg) ? arg : '2'}))`;
    if (fn === 'abs') return `.withColumn(${pyString(target)}, F.abs(${col(source)}))`;
    return null;
  }
  if (item.kind === 'array') {
    const fn = item.presetFn;
    const source = value('source');
    const target = value('target');
    const other = value('otherSource');
    const names = columns('columns');
    const arg = value('arg1');
    if (fn === 'create' && names.length && target) return `.withColumn(${pyString(target)}, F.array(*[F.col(c) for c in ${pyList(names)}]))`;
    if (['explode', 'explode_outer'].includes(fn) && source && target) return `.select("*", F.${fn}(${col(source)}).alias(${pyString(target)}))`;
    if (fn === 'posexplode' && source && target) return `.select("*", F.posexplode(${col(source)}).alias(${pyString(value('position') || 'position')}, ${pyString(target)}))`;
    if (fn === 'contains' && source && target && arg !== '') return `.withColumn(${pyString(target)}, F.array_contains(${col(source)}, F.lit(${pyLiteral(arg)})))`;
    if (['size', 'sort_array', 'array_distinct'].includes(fn) && source && target) return `.withColumn(${pyString(target)}, F.${fn}(${col(source)}))`;
    if (['array_union', 'array_intersect', 'array_except'].includes(fn) && source && other && target) return `.withColumn(${pyString(target)}, F.${fn}(${col(source)}, ${col(other)}))`;
    if (fn === 'get_item' && source && target && /^\d+$/.test(arg)) return `.withColumn(${pyString(target)}, ${col(source)}.getItem(${arg}))`;
    return null;
  }
  if (item.kind === 'json') {
    const fn = item.presetFn;
    const source = value('source');
    const target = value('target');
    const arg = value('arg1');
    let expression;
    if (fn === 'struct') {
      const names = columns('columns');
      if (names.length) expression = `F.struct(*[F.col(c) for c in ${pyList(names)}])`;
    } else if (fn === 'get_json_object' && source && arg) expression = `F.get_json_object(${col(source)}, ${pyString(arg)})`;
    else if (fn === 'from_json' && source && arg) expression = `F.from_json(${col(source)}, ${pyString(arg)})`;
    else if (fn === 'to_json' && source) expression = `F.to_json(${col(source)})`;
    return target && expression ? `.withColumn(${pyString(target)}, ${expression})` : null;
  }
  if (item.kind === 'map') {
    const source = value('source');
    const target = value('target');
    const expression = item.presetFn === 'map_from_arrays'
      ? `F.map_from_arrays(${col(source)}, ${col(value('values'))})`
      : `F.${item.presetFn}(${col(source)})`;
    return source && target && (item.presetFn !== 'map_from_arrays' || value('values')) ? `.withColumn(${pyString(target)}, ${expression})` : null;
  }
  return null;
}

function addOutputCode(frame, lines) {
  if (!document.getElementById('writeOutput').checked) return;

  const format = document.getElementById('outputFormat').value;
  const destination = document.getElementById('outputDestination').value.trim();
  const supportsPartitions = format === 'delta' || format === 'iceberg';
  const partitions = supportsPartitions ? csvList(document.getElementById('outputPartitions').value) : [];
  const compression = document.getElementById('outputCompression').value;
  const writeMode = document.getElementById('outputMode').value;
  const todo = message => lines.push(`# TODO: ${message}`);

  lines.push('', '# COMMAND ----------', '# Write transformed data');
  if (!destination) {
    todo(format === 'iceberg' ? 'Set an Iceberg catalog table name' : 'Set the Databricks output path');
    return;
  }

  if (format === 'iceberg') {
    const tableMode = document.getElementById('icebergMode').value;
    if (tableMode === 'append') {
      lines.push(`${frame}.writeTo(${pyString(destination)}).append()`);
      return;
    }

    lines.push(`_output_writer = ${frame}.writeTo(${pyString(destination)}).using("iceberg")`);
    const location = document.getElementById('icebergLocation').value.trim();
    if (location) lines.push(`_output_writer = _output_writer.tableProperty("location", ${pyString(location)})`);
    if (partitions.length) {
      const partitionColumns = partitions.map(column => `F.col(${pyString(column)})`);
      lines.push(`_output_writer = _output_writer.partitionedBy(${partitionColumns.join(', ')})`);
    }
    lines.push('_output_writer.createOrReplace()');
    return;
  }

  const writerFrame = format === 'text' ? '_output_df' : frame;
  if (format === 'text') {
    const selectedPartitions = partitions.length ? `, *[F.col(c) for c in ${pyList(partitions)}]` : '';
    lines.push(`_output_df = ${frame}.select(F.to_json(F.struct(*[F.col(c) for c in ${frame}.columns])).alias("value")${selectedPartitions})`);
  }

  lines.push(`_output_writer = ${writerFrame}.write.format(${pyString(format)}).mode(${pyString(writeMode)})`);
  if (format === 'csv') {
    const hasHeader = document.getElementById('csvHeader').checked ? 'true' : 'false';
    const delimiter = document.getElementById('csvDelimiter').value || ',';
    lines.push(`_output_writer = _output_writer.option("header", ${pyString(hasHeader)}).option("delimiter", ${pyString(delimiter)})`);
  }
  if (compression) lines.push(`_output_writer = _output_writer.option("compression", ${pyString(compression)})`);
  if (partitions.length) lines.push(`_output_writer = _output_writer.partitionBy(*${pyList(partitions)})`);
  lines.push(`_output_writer.save(${pyString(destination)})`);
}

function makeCode() {
  sourceSchemaState.generating = true;
  try { return makeValidatedCode(); }
  finally { sourceSchemaState.generating = false; }
}

function makeValidatedCode() {
  const frameNameInput = document.getElementById('dataframeName').value.trim();
  let frame = /^[A-Za-z_][A-Za-z0-9_]*$/.test(frameNameInput) ? frameNameInput : 'df';
  const completedFrames = [];
  const usedFrameNames = new Set([frame]);
  const startNewFrame = item => {
    if (!isNewDataFrameStep(item)) return false;
    const target = getValue(item.id, 'target');
    if (!validNewFrameName(target, frame) || usedFrameNames.has(target)) return true;
    usedFrameNames.add(target);
    completedFrames.push(frame);
    const base = getValue(item.id, 'base') === 'source' ? '_lakeloom_source_df' : frame;
    lines.push(`# Continue subsequent transformations in ${target}`, `${target} = ${base}`, '', '# COMMAND ----------');
    frame = target;
    return true;
  };
  const format = document.getElementById('sourceFormat').value;
  const source = document.getElementById('sourcePath').value.trim() || sourcePathExamples[format];
  const deltaVersion = document.getElementById('sourceDeltaVersion').value.trim();
  const lines = [
    '# Databricks notebook source',
    '# COMMAND ----------',
    '# Generated with LakeLoom data prep',
    `# Notebook: ${getNotebookName().replace(/[\r\n\t]+/g, ' ')}`,
    'from pyspark.sql import functions as F'
  ];
  // Keep transformation dependencies in selection order. Table actions consume
  // the completed source pipeline and retain their relative order at the end.
  const selectedInOrder = [...state.selected]
    .map(id => transformations.find(item => item.id === id))
    .filter(item => item && !sourceSchemaState.omittedSteps?.has(item.id)
      && !(item.id === 'filter' && !getValue('filter', 'condition')));
  const isActionStep = item => item.id.startsWith('delta') || ['scd1', 'scd2'].includes(item.id);
  const selected = [...selectedInOrder.filter(item => !isActionStep(item)), ...selectedInOrder.filter(isActionStep)];
  const sparkTypeImports = new Set();
  if (selected.some(item => item.id === 'trimAll')) sparkTypeImports.add('StringType');
  if (selected.some(item => item.id === 'createFrameFromSchema')) {
    const fieldDefinitions = parseMappings(getValue('createFrameFromSchema', 'schemaFields'));
    sparkTypeImports.add('StructType');
    sparkTypeImports.add('StructField');
    fieldDefinitions.forEach(([, type]) => {
      const constructor = schemaTypeConstructors[type.toLowerCase()];
      if (constructor) sparkTypeImports.add(constructor);
    });
    lines.push('import json');
  }
  if (sparkTypeImports.size) lines.push(`from pyspark.sql.types import ${[...sparkTypeImports].join(', ')}`);
  if (selected.some(item => item.kind === 'window' || item.id === 'latest')) lines.push('from pyspark.sql.window import Window');
  if (selected.some(item => item.id === 'standardizeNames')) lines.push('import re');
  if (selected.some(item => item.id.startsWith('delta') || item.id.startsWith('scd'))) lines.push('from delta.tables import DeltaTable');
  lines.push('', '# COMMAND ----------');

  if (state.uploads.length) {
    lines.push('# Files selected in the builder (make them available at the Databricks source path below):');
    for (const file of state.uploads.slice(0, 20)) {
      const selectedName = (file.webkitRelativePath || file.name).replace(/[\r\n]/g, ' ');
      lines.push(`# - ${selectedName}`);
    }
    if (state.uploads.length > 20) lines.push(`# - ...and ${state.uploads.length - 20} more file(s)`);
  }
  const isCatalogTable = ['delta', 'iceberg'].includes(format) && /^[\w-]+(?:\.[\w-]+){1,2}$/.test(source);
  const hasValidDeltaVersion = format === 'delta' && /^\d+$/.test(deltaVersion);
  if (format === 'delta' && deltaVersion && !hasValidDeltaVersion) {
    lines.push('# TODO: Delta version must be a non-negative whole number. The latest version is loaded below.');
  }
  if (isCatalogTable && hasValidDeltaVersion) {
    lines.push(`reader = spark.read.option("versionAsOf", ${deltaVersion})`);
    lines.push(`${frame} = reader.table(${pyString(source)})`);
  } else if (isCatalogTable) {
    lines.push(`${frame} = spark.read.table(${pyString(source)})`);
  } else {
    lines.push(`reader = spark.read.format(${pyString(format)})`);
    if (hasValidDeltaVersion) lines.push(`reader = reader.option("versionAsOf", ${deltaVersion})`);
    if (format === 'csv') lines.push('reader = reader.option("header", "true").option("inferSchema", "true")');
    lines.push(`${frame} = reader.load(${pyString(source)})`);
  }
  if (selected.some(item => isNewDataFrameStep(item) && getValue(item.id, 'base') === 'source')) {
    lines.push(`# Preserve the original source before applying transformations`, `_lakeloom_source_df = ${frame}`);
  }
  lines.push('', '# COMMAND ----------');

  if (document.getElementById('chainSelectedSteps').checked) {
    let pending = [];
    const flushChain = () => {
      if (!pending.length) return;
      const firstStep = pending[0].step;
      const lastStep = pending[pending.length - 1].step;
      const label = pending.map(entry => entry.item.title).join(' → ');
      lines.push(`# Steps ${firstStep}${lastStep === firstStep ? '' : `-${lastStep}`}: ${label}`);
      lines.push(`${frame} = (`);
      lines.push(`    ${frame}`);
      const expressionLines = pending.flatMap(entry => entry.expression.split('\n'));
      let parenthesisDepth = 0;
      expressionLines.forEach((line, lineIndex) => {
        parenthesisDepth += pythonParenthesisDelta(line);
        const nextLine = expressionLines[lineIndex + 1] || '';
        const continuesChain = parenthesisDepth === 0 && nextLine.trimStart().startsWith('.');
        lines.push(`    ${line}${continuesChain ? '\\' : ''}`);
      });
      lines.push(')');
      lines.push('', '# COMMAND ----------');
      pending = [];
    };
    for (const [index, item] of selected.entries()) {
      if (isNewDataFrameStep(item)) { flushChain(); startNewFrame(item); continue; }
      const expression = chainOperation(item, frame);
      if (expression) {
        pending.push({ item, expression, step: index + 1 });
        continue;
      }
      flushChain();
      addTransformationCode(item, frame, lines, index + 1);
      lines.push('', '# COMMAND ----------');
    }
    flushChain();
  } else {
    for (const [index, item] of selected.entries()) {
      if (startNewFrame(item)) continue;
      addTransformationCode(item, frame, lines, index + 1);
      lines.push('', '# COMMAND ----------');
    }
  }
  addOutputCode(frame, lines);
  if (!document.getElementById('writeOutput').checked) lines.push('');
  // Displays are Spark actions too: defer every generated display until all
  // DataFrame transformations, SCD checks/merges, and output writes are complete.
  const finalDisplays = [];
  for (let index = 0; index < lines.length; index++) {
    if (/^display\([A-Za-z_]\w*\)$/.test(lines[index])) {
      finalDisplays.push(lines[index]);
      lines.splice(index--, 1);
    }
  }
  lines.push('# COMMAND ----------', '# Final actions: display completed DataFrames');
  lines.push(...new Set([...finalDisplays, ...completedFrames.map(name => `display(${name})`), `display(${frame})`]));
  return lines.join('\n');
}

function colorize(code) {
  return code.split('\n').map((line, index) => {
    const escaped = escapeHtml(line);
    const highlighted = escaped.replace(/("(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'|#.*|\b(?:from|import|as|for|in|if|while)\b|\b(?:spark|df|F|Window|StringType|reader)\b|\b\d+\b)/g, token => {
      let className = 'code-number';
      if (token.startsWith('#')) className = 'code-comment';
      else if (token.startsWith('"') || token.startsWith("'")) className = 'code-string';
      else if (/^(from|import|as|for|in|if|while)$/.test(token)) className = 'code-keyword';
      else if (/^(spark|df|F|Window|StringType|reader)$/.test(token)) className = 'code-function';
      return `<span class="${className}">${token}</span>`;
    });
    return `<span class="code-line"><span class="line-number">${index + 1}</span>${highlighted || ' '}</span>`;
  }).join('');
}

function currentNotebookCode() {
  return state.customCode === null ? makeCode() : state.customCode;
}

function pythonParenthesisDelta(line) {
  let depth = 0;
  let quote = null;
  let escaped = false;
  for (const character of line) {
    if (quote) {
      if (escaped) escaped = false;
      else if (character === '\\') escaped = true;
      else if (character === quote) quote = null;
      continue;
    }
    if (character === '"' || character === "'") quote = character;
    else if (character === '(') depth += 1;
    else if (character === ')') depth -= 1;
  }
  return depth;
}

function codeForRunPreview(code) {
  const writeStart = code.indexOf('\n# COMMAND ----------\n# Write transformed data');
  if (writeStart < 0) return code;
  const nextCommand = code.indexOf('\n# COMMAND ----------', writeStart + 1);
  return nextCommand < 0 ? code.slice(0, writeStart) : `${code.slice(0, writeStart)}${code.slice(nextCommand)}`;
}

function previewCellValue(value) {
  if (value === null || value === undefined) return 'NULL';
  if (typeof value === 'object') return JSON.stringify(value);
  return String(value);
}

function renderRunResult(result) {
  const columns = Array.isArray(result.columns) ? result.columns : [];
  const rows = Array.isArray(result.rows) ? result.rows : [];
  const status = document.getElementById('runStatus');
  const count = rows.length;
  status.textContent = `${count} row${count === 1 ? '' : 's'} returned${result.truncated ? ' · showing the first 100' : ''}.`;
  status.classList.remove('is-error');
  const table = columns.length
    ? `<table class="run-table"><thead><tr>${columns.map(column => `<th title="${escapeHtml(column.type || '')}">${escapeHtml(column.name)}</th>`).join('')}</tr></thead><tbody>${rows.map(row => `<tr>${columns.map(column => {
      const value = previewCellValue(row[column.name]);
      return `<td title="${escapeHtml(value)}">${escapeHtml(value)}</td>`;
    }).join('')}</tr>`).join('')}</tbody></table>`
    : '<p class="run-status">The DataFrame has no columns to display.</p>';
  document.getElementById('runTable').innerHTML = count ? table : `${table}<p class="run-status">No rows matched this pipeline.</p>`;
}

async function runNotebookPreview() {
  if (state.previewRunning) return;
  const button = document.getElementById('runPreview');
  const results = document.getElementById('runResults');
  const status = document.getElementById('runStatus');
  const table = document.getElementById('runTable');
  const code = codeForRunPreview(currentNotebookCode());
  state.previewRunning = true;
  results.hidden = false;
  status.textContent = 'Connecting to Databricks and running the selected pipeline…';
  status.classList.remove('is-error');
  table.innerHTML = '';
  updateRunAvailability();

  try {
    const response = await fetch('/api/run-preview', {
      method: 'POST',
      credentials: 'same-origin',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({ code, dataframeName: document.getElementById('dataframeName').value.trim() || 'df' })
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(payload.error || `Preview failed (${response.status}).`);
    state.lastRunCode = currentNotebookCode();
    renderRunResult(payload);
  } catch (error) {
    status.textContent = error.message || 'Databricks could not run this preview.';
    status.classList.add('is-error');
  } finally {
    state.previewRunning = false;
    updateRunAvailability();
  }
}

function getIpynbContent(code) {
  const cells = code.replace(/\r\n/g, '\n').split(/^# COMMAND ----------\s*$/m)
    .map((content, index) => index === 0 ? content.replace(/^# Databricks notebook source\s*\n?/, '').trim() : content.trim())
    .filter(content => content.length > 0)
    .map(source => ({
      cell_type: 'code',
      execution_count: null,
      metadata: {},
      outputs: [],
      source: source.split('\n').map((line, index, lines) => line + (index < lines.length - 1 ? '\n' : ''))
    }));
  return JSON.stringify({
    cells,
    metadata: {
      title: getNotebookName(),
      kernelspec: { display_name: 'Python 3', language: 'python', name: 'python3' },
      language_info: { name: 'python' }
    },
    nbformat: 4,
    nbformat_minor: 5
  }, null, 2);
}

function makeNotebookHtml(code, title = getNotebookName()) {
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${escapeHtml(title)}</title>
  <style>
    body{margin:32px auto;max-width:1100px;padding:0 24px;color:#203239;font:14px/1.55 -apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif}
    h1{font-size:22px;margin:0 0 5px}p{margin:0 0 22px;color:#71817d;font-size:12px}
    pre{white-space:pre-wrap;overflow-wrap:anywhere;background:#f5f8f6;border:1px solid #e1e9e4;border-radius:8px;padding:20px;font:12px/1.65 ui-monospace,SFMono-Regular,Menlo,monospace}
    @media print{body{margin:0;max-width:none;padding:0;color:#111}pre{border:0;border-radius:0;padding:0;background:#fff;font-size:9pt;overflow:visible}h1{font-size:16pt}p{margin-bottom:12pt}}
  </style>
</head>
<body><h1>${escapeHtml(title)}</h1><p>PySpark source generated by LakeLoom.</p><pre>${escapeHtml(code)}</pre></body>
</html>`;
}

function triggerDownload(filename, content, mimeType) {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function openNotebookPrintView(code) {
  const printWindow = window.open('', '_blank');
  if (!printWindow) return false;
  let printStarted = false;
  const startPrint = () => {
    if (printStarted || printWindow.closed) return;
    printStarted = true;
    printWindow.focus();
    printWindow.print();
  };
  printWindow.document.open();
  printWindow.document.write(makeNotebookHtml(code));
  printWindow.document.close();
  window.setTimeout(startPrint, 500);
  return true;
}

const exportFormatHints = {
  databricks: 'Databricks source notebook (.py), ready to import into a workspace.',
  ipynb: 'Jupyter notebook (.ipynb), with each Databricks command exported as a code cell.',
  txt: 'Plain text copy of the current notebook source.',
  markdown: 'Markdown document containing the notebook source in a Python code block.',
  html: 'Self-contained HTML copy of the notebook source.',
  pdf: 'Opens your browser’s print dialog. Choose “Save as PDF” to download a PDF.'
};

function syncDownloadFormatHint() {
  document.getElementById('downloadFormatHint').textContent = 'Click Export notebook, then choose a download format. The download starts immediately.';
}

function updatePreview() {
  refreshColumnValidation();
  const generatedCode = makeCode();
  const code = state.customCode === null ? generatedCode : state.customCode;
  codePreview.innerHTML = colorize(code);
  codePreview.hidden = state.editingCode;
  const editor = document.getElementById('codeEditor');
  editor.hidden = !state.editingCode;
  if (state.editingCode && state.customCode === null && editor.value !== generatedCode) editor.value = generatedCode;
  const editButton = document.getElementById('editCode');
  editButton.textContent = state.editingCode ? 'Preview' : 'Edit code';
  editButton.setAttribute('aria-pressed', String(state.editingCode));
  document.querySelector('.ready-indicator').innerHTML = '<i></i> Code ready';
  document.getElementById('resetCode').disabled = state.customCode === null;
  const count = state.selected.size;
  const countLabel = `${count} ${count === 1 ? 'step' : 'steps'} selected`;
  const uploadLabel = state.uploads.length ? `${state.uploads.length} source ${state.uploads.length === 1 ? 'file' : 'files'}` : '';
  const outputLabel = document.getElementById('writeOutput').checked ? 'output write enabled' : '';
  const details = [count ? countLabel : '', uploadLabel, outputLabel].filter(Boolean);
  document.getElementById('summaryText').textContent = state.customCode !== null
    ? `${details.join(' · ') || 'Notebook code'} · ${state.unsyncedCodeEdits ? 'manual code edits active; some code has no matching option' : 'code and builder options are synced'}`
    : details.length
      ? `${details.join(' · ')} · PySpark code updates as you edit`
      : 'Add a transformation or output step to get started';
  updateRunAvailability();
  const runResults = document.getElementById('runResults');
  if (runResults && !runResults.hidden && state.lastRunCode !== null && state.lastRunCode !== code) {
    const status = document.getElementById('runStatus');
    status.textContent = 'The notebook changed after this run. Run preview again for current results.';
    status.classList.remove('is-error');
  }
  applyCategory();
  updateSchemaAvailability();
}

function syncCard(id) {
  const card = document.querySelector(`[data-card="${id}"]`);
  const checked = state.selected.has(id);
  card.classList.toggle('is-selected', checked);
  card.querySelector('.transform-check').checked = checked;
  card.querySelectorAll('[data-when-key], [data-when-any-key]').forEach(field => {
    const key = field.dataset.whenKey || field.dataset.whenAnyKey;
    const control = card.querySelector(`[data-key="${key}"]`);
    const values = field.dataset.whenValues ? field.dataset.whenValues.split('|') : [field.dataset.whenValue];
    field.hidden = !control || !values.includes(control.value);
  });
  card.querySelectorAll('select[data-op]').forEach(syncDropdownHelp);
}

function applyCategory() {
  const query = document.getElementById('operationSearch').value.trim().toLowerCase();
  document.getElementById('backToAllTransformations').hidden = state.category === 'all' && !query;
  let shown = 0;
  document.querySelectorAll('.transform-card').forEach(card => {
    const item = transformations.find(operation => operation.id === card.dataset.card);
    const categoryMatch = state.category === 'all' || card.dataset.category === state.category;
    const searchable = `${item.title} ${item.description} ${item.presetFn || ''} ${item.kind || ''} ${item.fields.map(field => `${field.label} ${field.placeholder || ''} ${field.hint || ''} ${(field.options || []).flat().join(' ')}`).join(' ')}`.toLowerCase();
    const queryMatch = !query || searchable.includes(query);
    card.hidden = !(categoryMatch && queryMatch);
    if (!card.hidden) shown++;
  });
  const selectedCount = state.selected.size;
  document.getElementById('operationCount').textContent = `${shown} ${shown === 1 ? 'transformation' : 'transformations'}${selectedCount ? ` · ${selectedCount} selected` : ''}`;
  document.getElementById('emptyState').hidden = shown !== 0;
}

function showToast(message) {
  toast.textContent = message;
  toast.classList.add('visible');
  clearTimeout(showToast.timer);
  showToast.timer = setTimeout(() => toast.classList.remove('visible'), 2200);
}

function saveCurrentRecipe(name) {
  const recipe = {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    name,
    notebookName: getNotebookName(),
    createdAt: new Date().toISOString(),
    sourceFormat: document.getElementById('sourceFormat').value,
    sourcePath: document.getElementById('sourcePath').value,
    sourceDeltaVersion: document.getElementById('sourceDeltaVersion').value,
    dataframeName: document.getElementById('dataframeName').value,
    selected: [...state.selected],
    fields: [...document.querySelectorAll('[data-op][data-key]')].map(field => ({ op: field.dataset.op, key: field.dataset.key, value: field.value })),
    chainSelectedSteps: document.getElementById('chainSelectedSteps').checked,
    customCode: state.customCode,
    unsyncedCodeEdits: state.unsyncedCodeEdits,
    writeOutput: document.getElementById('writeOutput').checked,
    outputFormat: document.getElementById('outputFormat').value,
    outputDestination: document.getElementById('outputDestination').value,
    outputPartitions: document.getElementById('outputPartitions').value,
    outputMode: document.getElementById('outputMode').value,
    icebergMode: document.getElementById('icebergMode').value,
    icebergLocation: document.getElementById('icebergLocation').value,
    outputCompression: document.getElementById('outputCompression').value,
    csvDelimiter: document.getElementById('csvDelimiter').value,
    csvHeader: document.getElementById('csvHeader').checked
  };
  const recipes = readLocalList(recipeStorageKey);
  recipes.unshift(recipe);
  if (!writeLocalList(recipeStorageKey, recipes.slice(0, 100))) return;
  closeModal(document.getElementById('recipeModal'));
  document.getElementById('recipeName').value = '';
  renderWorkspaceViews();
  addActivity('Recipe saved', name);
  showToast(`Saved “${name}”`);
}

function ensureNewDataFrameSteps(selectedIds, savedFields = []) {
  let added = false;
  for (const id of selectedIds) {
    if (!isNewDataFrameStep(id) || id === 'newDataFrame' || transformations.some(item => item.id === id)) continue;
    const savedTarget = savedFields.find(field => field.op === id && field.key === 'target')?.value;
    const item = createNewDataFrameStep(id, typeof savedTarget === 'string' && savedTarget ? savedTarget : nextNewDataFrameName());
    transformations.push(item);
    list.insertAdjacentHTML('beforeend', transformationCardMarkup(item));
    added = true;
  }
  if (added) renderCategories();
}

function openRecipeDialog() {
  document.getElementById('recipeName').value = getNotebookName();
  openModal('recipeModal', 'recipeName');
}

function useRecipe(recipeId) {
  const recipe = readLocalList(recipeStorageKey).find(item => item.id === recipeId);
  if (!recipe) return showToast('That saved recipe could not be found');
  invalidateSourceSchema();
  notebookNameInput.value = recipe.notebookName || recipe.name || 'Untitled notebook';
  persistNotebookName();
  syncNotebookNameDisplay();
  document.getElementById('sourceFormat').value = recipe.sourceFormat || 'delta';
  document.getElementById('sourcePath').value = recipe.sourcePath || sourcePathExamples[recipe.sourceFormat || 'delta'];
  document.getElementById('sourceDeltaVersion').value = recipe.sourceDeltaVersion || '';
  document.getElementById('dataframeName').value = recipe.dataframeName || 'df';
  state.uploads = [];
  state.sourceMode = 'databricks';
  state.activeSourceMode = 'databricks';
  state.uploadSelectionKind = 'files';
  state.uploadedPathBase = null;
  state.uploadedPathFileName = null;
  document.getElementById('sourceFiles').value = '';
  document.getElementById('sourceFolder').value = '';
  renderUploadedFiles();
  updateUploadMode();

  ensureNewDataFrameSteps(recipe.selected || [], recipe.fields || []);
  state.selected = new Set(recipe.selected || []);
  for (const field of recipe.fields || []) {
    const control = document.getElementById(`${field.op}-${field.key}`);
    if (control) control.value = field.value;
  }
  transformations.forEach(item => syncCard(item.id));

  document.getElementById('writeOutput').checked = Boolean(recipe.writeOutput);
  document.getElementById('outputFormat').value = recipe.outputFormat || 'delta';
  document.getElementById('outputDestination').value = recipe.outputDestination || '';
  document.getElementById('outputPartitions').value = recipe.outputPartitions || '';
  document.getElementById('outputMode').value = recipe.outputMode || 'overwrite';
  document.getElementById('icebergMode').value = recipe.icebergMode || 'createOrReplace';
  document.getElementById('icebergLocation').value = recipe.icebergLocation || '';
  document.getElementById('outputCompression').value = recipe.outputCompression || '';
  document.getElementById('csvDelimiter').value = recipe.csvDelimiter || ',';
  document.getElementById('csvHeader').checked = recipe.csvHeader !== false;
  document.getElementById('chainSelectedSteps').checked = recipe.chainSelectedSteps !== false;
  state.customCode = typeof recipe.customCode === 'string' ? recipe.customCode : null;
  state.unsyncedCodeEdits = recipe.unsyncedCodeEdits === undefined ? state.customCode !== null : Boolean(recipe.unsyncedCodeEdits);
  state.editingCode = false;
  syncOutputSettings();
  updatePreview();
  location.hash = 'builder';
  setView('builder');
  addActivity('Recipe opened', recipe.name);
  showToast(`Loaded “${recipe.name}”`);
}

const folderFormats = new Set(['delta', 'iceberg']);
const extensionFormats = [
  [/\.csv$/i, 'csv'],
  [/\.(?:json|jsonl|ndjson)$/i, 'json'],
  [/\.(?:txt|text|log)$/i, 'text'],
  [/\.parquet$/i, 'parquet'],
  [/\.avro$/i, 'avro'],
  [/\.orc$/i, 'orc']
];

function formatFromFileName(name) {
  return extensionFormats.find(([pattern]) => pattern.test(name))?.[1] || null;
}

function detectSourceFormat(files, selectionKind = 'files') {
  const paths = files.map(file => file.webkitRelativePath || file.name);
  if (selectionKind === 'folder') {
    if (paths.some(path => /(?:^|\/)\_delta_log\/(?:\d+\.json|_last_checkpoint)$/i.test(path))) return 'delta';
    if (paths.some(path => /(?:^|\/)metadata\/.*\.metadata\.json$/i.test(path))) return 'iceberg';
  }
  const detected = new Set(files.map(file => formatFromFileName(file.name)).filter(Boolean));
  return detected.size === 1 ? [...detected][0] : null;
}

function setSourceMode(mode) {
  if (!['files', 'folder', 'databricks'].includes(mode) || mode === state.sourceMode) return;
  state.sourceMode = mode;
  renderUploadedFiles();
  updateUploadMode();
}

function updateUploadMode() {
  const format = document.getElementById('sourceFormat').value;
  const mode = state.sourceMode;
  const localMode = mode !== 'databricks';
  const hasFiles = localMode && state.activeSourceMode === mode && state.uploads.length > 0;
  const pathInput = document.getElementById('sourcePath');
  if (pathInput.value === sourcePathExamples[activeSuggestedFormat]) pathInput.value = sourcePathExamples[format];
  activeSuggestedFormat = format;
  const isFolder = folderFormats.has(format);
  document.querySelectorAll('[data-source-mode]').forEach(button => {
    const active = button.dataset.sourceMode === mode;
    const selected = button.dataset.sourceMode === state.activeSourceMode
      && (button.dataset.sourceMode === 'databricks' || state.uploads.length > 0);
    button.classList.toggle('is-active', active);
    button.classList.toggle('has-source', selected);
    button.setAttribute('aria-pressed', String(active));
    const status = button.querySelector('.source-method-status');
    status.hidden = !selected;
    if (selected) status.textContent = button.dataset.sourceMode === 'files'
      ? `✓ ${state.uploads.length === 1 ? 'File selected' : `${state.uploads.length} files selected`}`
      : button.dataset.sourceMode === 'folder' ? '✓ Folder selected' : '✓ Databricks selected';
  });
  document.querySelector('.source-fields').hidden = localMode && !hasFiles;
  document.getElementById('sourceFormatField').hidden = localMode && !hasFiles;
  document.getElementById('sourceFormatLabel').innerHTML = mode === 'databricks'
    ? 'Source format'
    : `${mode === 'folder' ? 'Table' : 'File'} format <small>(detected automatically)</small>`;
  pathInput.closest('.field').hidden = localMode && !hasFiles;
  document.getElementById('uploadZone').hidden = !localMode;
  document.getElementById('uploadFootnote').hidden = !localMode;
  document.getElementById('uploadButton').hidden = mode !== 'files';
  document.getElementById('uploadFolderButton').hidden = mode !== 'folder';
  document.getElementById('loadSourceSchema').hidden = !localMode || !hasFiles;
  document.getElementById('loadSourceSchema').textContent = 'Reinspect source';
  document.getElementById('loadRemoteSchema').hidden = mode !== 'databricks';
  document.querySelector('.schema-toolbar').hidden = localMode && !hasFiles;
  document.getElementById('sourceSchemaStatus').hidden = localMode && !hasFiles;
  document.getElementById('sourceSchemaPanel').hidden = state.activeSourceMode !== mode || !sourceSchemaState.columns;
  document.getElementById('uploadTitle').textContent = hasFiles
    ? `${format === 'text' ? 'TXT' : format.toUpperCase()} source detected`
    : (mode === 'folder' ? 'Choose a table folder' : 'Choose one or more files');
  document.getElementById('uploadDescription').textContent = hasFiles
    ? 'Change the detected format above only when the file extension is misleading'
    : (mode === 'folder' ? 'LakeLoom detects Delta or Iceberg from folder metadata' : 'LakeLoom detects the format from the selected files');
  document.getElementById('sourcePathLabel').textContent = isFolder
    ? 'Databricks table name or table path'
    : 'Databricks storage path';
  const versionField = document.getElementById('sourceDeltaVersionField');
  const versionInput = document.getElementById('sourceDeltaVersion');
  const isDelta = format === 'delta';
  const supportsVersionOption = isDelta || format === 'parquet';
  versionField.hidden = !supportsVersionOption || (localMode && !hasFiles);
  document.getElementById('sourceVersionLabel').innerHTML = isDelta
    ? 'Delta version as of <small>(optional)</small>'
    : 'Parquet snapshot reference <small>(optional)</small>';
  versionInput.placeholder = isDelta ? 'Latest version' : 'Informational only';
  document.getElementById('sourceVersionHint').textContent = isDelta
    ? 'Read a historical Delta table snapshot, such as version 2.'
    : 'Parquet has no built-in version history; this reference will not change the read.';
  document.getElementById('uploadZone').classList.toggle('folder-mode', state.uploadSelectionKind === 'folder');
  updateSourceSummary();
}

function syncOutputSettings() {
  const format = document.getElementById('outputFormat').value;
  const isIceberg = format === 'iceberg';
  const supportsPartitions = format === 'delta' || isIceberg;
  const isCsv = format === 'csv';
  const icebergMode = document.getElementById('icebergMode').value;
  const icebergCreatesTable = isIceberg && icebergMode === 'createOrReplace';
  const partitionField = document.getElementById('outputPartitions').closest('.field');

  document.getElementById('outputDestinationLabel').textContent = isIceberg ? 'Iceberg catalog table' : 'Databricks storage path';
  document.getElementById('outputDestination').placeholder = isIceberg
    ? 'catalog.schema.cleaned_table'
    : `/Volumes/catalog/schema/volume/cleaned_data${format === 'csv' ? '.csv' : format === 'json' ? '.json' : format === 'text' ? '.txt' : ''}`;
  document.getElementById('outputModeField').hidden = isIceberg;
  document.getElementById('icebergModeField').hidden = !isIceberg;
  document.getElementById('icebergLocationField').hidden = !icebergCreatesTable;
  document.getElementById('outputCompressionField').hidden = isIceberg || format === 'delta';
  document.getElementById('csvDelimiterField').hidden = !isCsv;
  document.getElementById('csvHeaderField').hidden = !isCsv;
  partitionField.hidden = !supportsPartitions;
  document.getElementById('outputPartitions').disabled = isIceberg && !icebergCreatesTable;

  if (isIceberg && !icebergCreatesTable) {
    document.getElementById('partitionHint').textContent = 'Append keeps the table’s existing partition specification.';
  } else if (isIceberg) {
    document.getElementById('partitionHint').textContent = 'Applied as the Iceberg table partition specification.';
  } else if (format === 'delta') {
    document.getElementById('partitionHint').textContent = 'Comma separated. Leave blank for an unpartitioned Delta output.';
  } else {
    document.getElementById('partitionHint').textContent = 'Comma separated. Leave blank for an unpartitioned output.';
  }

  document.getElementById('outputHelp').textContent = isIceberg
    ? 'Use a catalog.schema.table name. Create or replace can set its storage location and partition columns; append uses the existing table definition.'
    : format === 'text'
      ? 'Enter a Databricks accessible path. TXT output is written as one JSON serialized record per line.'
      : 'Enter a Databricks accessible path. The generated notebook writes the transformed DataFrame when you run it.';
}

function formatBytes(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function renderUploadedFiles() {
  const panel = document.getElementById('selectedFiles');
  const list = document.getElementById('selectedFilesList');
  const showingActiveSource = state.sourceMode === state.activeSourceMode;
  panel.hidden = !state.uploads.length || !showingActiveSource;
  updateSourceSummary();
  if (!state.uploads.length || !showingActiveSource) {
    list.innerHTML = '';
    return;
  }
  const format = document.getElementById('sourceFormat').value;
  const isFolder = folderFormats.has(format);
  document.getElementById('selectedFilesCount').textContent = isFolder
    ? `${state.uploads.length} ${state.uploads.length === 1 ? 'file' : 'files'} in table folder`
    : `${state.uploads.length} ${state.uploads.length === 1 ? 'file' : 'files'} selected`;
  list.innerHTML = state.uploads.slice(0, 3).map(file => {
    const name = file.webkitRelativePath || file.name;
    return `<li><span class="file-type-icon">${escapeHtml(format.slice(0, 2).toUpperCase())}</span><span class="file-name" title="${escapeHtml(name)}">${escapeHtml(name)}</span><span class="file-size">${formatBytes(file.size)}</span></li>`;
  }).join('') + (state.uploads.length > 3 ? `<li class="more-files">+ ${state.uploads.length - 3} more</li>` : '');
}

function updateSourceSummary() {
  const summary = document.getElementById('sourceSummary');
  if (!summary) return;
  const format = document.getElementById('sourceFormat').value;
  const count = state.sourceMode === state.activeSourceMode ? state.uploads.length : 0;
  document.getElementById('source-heading').textContent = count ? 'Source selected' : 'Add your source';
  if (!count) {
    const preserved = state.uploads.length && state.activeSourceMode !== state.sourceMode
      ? ` Your current ${state.activeSourceMode === 'folder' ? 'table folder' : 'file'} source is preserved until you choose a replacement.`
      : '';
    summary.textContent = (state.sourceMode === 'databricks'
      ? 'Enter a Databricks catalog table or storage path.'
      : state.sourceMode === 'folder'
        ? 'Choose a Delta or Iceberg table folder; LakeLoom will detect its format.'
        : 'Choose local files; LakeLoom will detect their format automatically.') + preserved;
    summary.classList.remove('has-upload');
    return;
  }

  summary.classList.add('has-upload');
  if (folderFormats.has(format)) {
    const folderName = (state.uploads[0].webkitRelativePath || '').split('/')[0];
    const folderLabel = folderName ? `“${folderName}”` : `${format === 'delta' ? 'Delta' : 'Iceberg'} table`;
    summary.textContent = `${folderLabel} folder selected (${count} ${count === 1 ? 'file' : 'files'}). Make sure Databricks can access the matching path.`;
    return;
  }

  const firstName = state.uploads[0].name;
  const formatName = format.toUpperCase();
  summary.textContent = count === 1
    ? `${firstName} selected. Make sure it is available at the Databricks path below.`
    : `${count} ${formatName} files selected, including ${firstName}. Make sure they are available at the Databricks path below.`;
}

function setUploadedFiles(fileList, selectionKind = 'files') {
  const files = Array.from(fileList || []);
  if (!files.length) return;
  const format = detectSourceFormat(files, selectionKind);
  if (!format) {
    showToast(selectionKind === 'folder'
      ? 'Could not detect one format. Choose a Delta/Iceberg folder or files with one supported extension.'
      : 'Choose files with the same supported extension.');
    return;
  }
  invalidateSourceSchema();
  state.sourceMode = selectionKind;
  state.activeSourceMode = selectionKind;
  state.uploadSelectionKind = selectionKind;
  document.getElementById('sourceFormat').value = format;
  updateUploadMode();
  const sourcePathBase = sourcePathBaseForUpload(format);
  if (!folderFormats.has(format)) {
    const extension = {
      csv: /\.csv$/i,
      json: /\.(json|jsonl|ndjson)$/i,
      text: /\.(txt|text|log)$/i,
      parquet: /\.parquet$/i,
      avro: /\.avro$/i,
      orc: /\.orc$/i
    }[format];
    const accepted = files.filter(file => extension.test(file.name));
    if (accepted.length !== files.length) showToast(`Detected ${format.toUpperCase()}; unsupported companion files were skipped`);
    state.uploads = accepted;
    if (accepted.length === 1) {
      state.uploadedPathBase = sourcePathBase;
      state.uploadedPathFileName = accepted[0].name;
      document.getElementById('sourcePath').value = joinSourcePath(sourcePathBase, accepted[0].name);
    } else {
      if (accepted.length > 1 || state.uploadedPathBase !== null) document.getElementById('sourcePath').value = sourcePathBase;
      state.uploadedPathBase = null;
      state.uploadedPathFileName = null;
    }
  } else {
    state.uploads = files;
    state.uploadedPathBase = null;
    state.uploadedPathFileName = null;
  }
  renderUploadedFiles();
  updateUploadMode();
  updatePreview();
  if (state.uploads.length) loadSourceSchema(false);
}

function joinSourcePath(directory, fileName) {
  const base = String(directory || '').replace(/\/+$/, '');
  return base ? `${base}/${fileName}` : fileName;
}

function sourcePathBaseForUpload(format) {
  const path = document.getElementById('sourcePath').value.trim();
  if (state.uploadedPathBase !== null && state.uploadedPathFileName && path === joinSourcePath(state.uploadedPathBase, state.uploadedPathFileName)) {
    return state.uploadedPathBase;
  }
  const example = sourcePathExamples[format];
  if (path === example) return sourcePathParent(path);
  const extensions = {
    csv: /\.csv$/i,
    json: /\.(?:json|jsonl|ndjson)$/i,
    text: /\.(?:txt|text|log)$/i,
    parquet: /\.parquet$/i,
    avro: /\.avro$/i,
    orc: /\.orc$/i
  };
  if (extensions[format]?.test(path)) return sourcePathParent(path);
  return path.replace(/\/+$/, '');
}

function sourcePathParent(path) {
  const separator = path.lastIndexOf('/');
  return separator < 0 ? '' : separator === 0 ? '/' : path.slice(0, separator);
}

function restoreUploadedPathBase() {
  if (state.uploadedPathBase !== null && state.uploadedPathFileName) {
    const sourcePath = document.getElementById('sourcePath');
    if (sourcePath.value === joinSourcePath(state.uploadedPathBase, state.uploadedPathFileName)) sourcePath.value = state.uploadedPathBase;
  }
  state.uploadedPathBase = null;
  state.uploadedPathFileName = null;
}

renderCategories();
renderTransformations();
transformations.forEach(item => syncCard(item.id));
updateUploadMode();
syncOutputSettings();
syncDownloadFormatHint();
updatePreview();
initSourceSchema();
loadDatabricksSession();
setView(location.hash.replace(/^#/, '') || 'builder');

list.addEventListener('click', event => {
  const head = event.target.closest('[data-toggle]');
  if (!head || event.target.closest('input')) return;
  const id = head.dataset.toggle;
  if (state.selected.has(id)) state.selected.delete(id); else state.selected.add(id);
  syncCard(id);
  updatePreview();
});

list.addEventListener('change', event => {
  if (event.target.matches('[data-check]')) {
    const id = event.target.dataset.check;
    if (event.target.checked) state.selected.add(id); else state.selected.delete(id);
    syncCard(id);
  }
  if (event.target.matches('[data-op]')) syncCard(event.target.dataset.op);
  updatePreview();
});

list.addEventListener('input', event => {
  if (event.target.matches('[data-op]')) {
    syncFlattenPlanAliases(event.target);
    updatePreview();
  }
});

document.getElementById('categorySelect').addEventListener('change', event => {
  state.category = event.currentTarget.value;
  updateCategoryCount();
  applyCategory();
});
document.getElementById('operationSearch').addEventListener('input', applyCategory);

document.getElementById('clearSelection').addEventListener('click', () => {
  state.selected.clear();
  transformations.forEach(item => syncCard(item.id));
  updatePreview();
});

document.getElementById('backToAllTransformations').addEventListener('click', () => {
  state.category = 'all';
  document.getElementById('operationSearch').value = '';
  renderCategories();
  applyCategory();
  document.getElementById('categorySelect').focus({ preventScroll: true });
});

document.getElementById('addNewDataFrame').addEventListener('click', () => {
  const hasSelectedBoundary = [...state.selected].some(isNewDataFrameStep);
  let id = 'newDataFrame';
  if (hasSelectedBoundary) {
    const item = createNewDataFrameStep(nextNewDataFrameId(), nextNewDataFrameName());
    transformations.push(item);
    list.insertAdjacentHTML('beforeend', transformationCardMarkup(item));
    id = item.id;
  }
  state.selected.add(id);
  state.category = 'dataframe';
  document.getElementById('operationSearch').value = '';
  renderCategories();
  applyCategory();
  syncCard(id);
  updatePreview();
  const field = document.getElementById(`${id}-target`);
  field.closest('.transform-card').scrollIntoView({ behavior: 'smooth', block: 'center' });
  field.focus({ preventScroll: true });
  field.select();
  showToast(hasSelectedBoundary
    ? 'Added another DataFrame step. Select the next transformations to continue in it.'
    : 'DataFrame step added after your selected steps. Select the next transformations to continue in it.');
});

notebookNameInput.addEventListener('input', () => {
  persistNotebookName();
  syncNotebookNameDisplay();
  updatePreview();
});
notebookNameInput.addEventListener('blur', () => {
  if (!notebookNameInput.value.trim()) notebookNameInput.value = 'Untitled notebook';
  persistNotebookName();
  syncNotebookNameDisplay();
  updatePreview();
});

document.getElementById('sourcePath').addEventListener('input', () => {
  invalidateSourceSchema();
  state.uploadedPathBase = null;
  state.uploadedPathFileName = null;
  updatePreview();
});
document.getElementById('dataframeName').addEventListener('input', updatePreview);
document.getElementById('sourceDeltaVersion').addEventListener('input', () => {
  invalidateSourceSchema();
  updatePreview();
});
document.getElementById('sourceFormat').addEventListener('change', () => {
  invalidateSourceSchema();
  renderUploadedFiles();
  updateUploadMode();
  updatePreview();
  if (state.uploads.length) loadSourceSchema(false);
});

document.getElementById('writeOutput').addEventListener('change', () => {
  updatePreview();
});
document.getElementById('chainSelectedSteps').addEventListener('change', updatePreview);
document.getElementById('outputFormat').addEventListener('change', () => {
  syncOutputSettings();
  updatePreview();
});
document.getElementById('icebergMode').addEventListener('change', () => {
  syncOutputSettings();
  updatePreview();
});
['outputDestination', 'outputPartitions', 'outputCompression', 'csvDelimiter', 'csvHeader', 'outputMode'].forEach(id => {
  const control = document.getElementById(id);
  control.addEventListener(control.type === 'checkbox' || control.tagName === 'SELECT' ? 'change' : 'input', updatePreview);
});

document.querySelector('.side-nav').addEventListener('click', event => {
  const link = event.target.closest('[data-view]');
  if (!link) return;
  event.preventDefault();
  location.hash = link.dataset.view;
  setView(link.dataset.view);
});
document.querySelectorAll('[data-go-view]').forEach(control => control.addEventListener('click', event => {
  event.preventDefault();
  const view = control.dataset.goView;
  location.hash = view;
  setView(view);
}));
document.querySelector('[data-copy-doc-code]')?.addEventListener('click', async event => {
  const code = document.getElementById('docsFlattenCode')?.textContent || '';
  try {
    await navigator.clipboard.writeText(code);
    event.currentTarget.textContent = 'Copied';
    window.setTimeout(() => { event.currentTarget.textContent = 'Copy example'; }, 1400);
  } catch {
    showToast('Copy is unavailable in this browser.');
  }
});
window.addEventListener('hashchange', () => setView(location.hash.replace(/^#/, '') || 'builder'));

document.getElementById('authButton').addEventListener('click', () => {
  openModal('authModal', 'refreshAuth');
});
document.getElementById('refreshAuth').addEventListener('click', async event => {
  const button = event.currentTarget;
  button.disabled = true;
  button.textContent = 'Checking…';
  await loadDatabricksSession();
  button.disabled = false;
  button.textContent = 'Check sign-in status';
  showToast(state.session.authenticated ? 'Databricks workspace session is active' : 'No Databricks workspace session was found');
});
document.querySelectorAll('[data-close-modal]').forEach(button => button.addEventListener('click', () => {
  closeModal(button.closest('.modal-backdrop'));
}));
document.querySelectorAll('.modal-backdrop').forEach(backdrop => backdrop.addEventListener('click', event => {
  if (event.target === backdrop) closeModal(backdrop);
}));
document.addEventListener('keydown', event => {
  if (event.key === 'Escape') document.querySelectorAll('.modal-backdrop:not([hidden])').forEach(closeModal);
});

document.getElementById('saveRecipe').addEventListener('click', openRecipeDialog);
document.getElementById('saveRecipeFromLibrary').addEventListener('click', openRecipeDialog);
document.getElementById('recipeForm').addEventListener('submit', event => {
  event.preventDefault();
  const name = document.getElementById('recipeName').value.trim();
  if (name) saveCurrentRecipe(name);
});
document.getElementById('recipeList').addEventListener('click', event => {
  const useButton = event.target.closest('[data-recipe-use]');
  if (useButton) return useRecipe(useButton.dataset.recipeUse);
  const deleteButton = event.target.closest('[data-recipe-delete]');
  if (!deleteButton) return;
  const recipe = readLocalList(recipeStorageKey).find(item => item.id === deleteButton.dataset.recipeDelete);
  if (!recipe || !window.confirm(`Delete the saved recipe “${recipe.name}”?`)) return;
  const updatedRecipes = readLocalList(recipeStorageKey).filter(item => item.id !== recipe.id);
  if (!writeLocalList(recipeStorageKey, updatedRecipes)) return;
  renderWorkspaceViews();
  addActivity('Recipe deleted', recipe.name);
  showToast(`Deleted “${recipe.name}”`);
});
document.getElementById('clearHistory').addEventListener('click', () => {
  if (!readLocalList(activityStorageKey).length) return showToast('History is already empty');
  if (!window.confirm('Clear local notebook activity from this browser?')) return;
  if (!writeLocalList(activityStorageKey, [])) return;
  renderWorkspaceViews();
  showToast('Local activity history cleared');
});

document.querySelectorAll('[data-source-mode]').forEach(button => {
  button.addEventListener('click', () => setSourceMode(button.dataset.sourceMode));
});
document.getElementById('sourceFiles').addEventListener('change', event => setUploadedFiles(event.target.files, 'files'));
document.getElementById('sourceFolder').addEventListener('change', event => setUploadedFiles(event.target.files, 'folder'));
document.getElementById('clearFiles').addEventListener('click', () => {
  invalidateSourceSchema();
  restoreUploadedPathBase();
  state.uploads = [];
  state.uploadSelectionKind = 'files';
  document.getElementById('sourceFiles').value = '';
  document.getElementById('sourceFolder').value = '';
  renderUploadedFiles();
  updateUploadMode();
  updatePreview();
});

const uploadZone = document.getElementById('uploadZone');
uploadZone.addEventListener('dragover', event => {
  event.preventDefault();
  uploadZone.classList.add('drag-over');
});
uploadZone.addEventListener('dragleave', () => uploadZone.classList.remove('drag-over'));
uploadZone.addEventListener('drop', event => {
  event.preventDefault();
  uploadZone.classList.remove('drag-over');
  setUploadedFiles(event.dataTransfer.files, 'files');
});

document.getElementById('copyCode').addEventListener('click', async () => {
  try {
    await navigator.clipboard.writeText(currentNotebookCode());
    addActivity('Notebook code copied', `${state.selected.size} transformation${state.selected.size === 1 ? '' : 's'} selected`);
    showToast('Notebook code copied to clipboard');
  } catch {
    const textarea = document.createElement('textarea');
    textarea.value = currentNotebookCode();
    textarea.style.position = 'fixed';
    textarea.style.opacity = '0';
    document.body.appendChild(textarea);
    textarea.select();
    document.execCommand('copy');
    textarea.remove();
    addActivity('Notebook code copied', `${state.selected.size} transformation${state.selected.size === 1 ? '' : 's'} selected`);
    showToast('Notebook code copied to clipboard');
  }
});

function exportNotebook(format) {
  const code = currentNotebookCode();
  const filenameBase = getNotebookFilenameBase();
  const notebookName = getNotebookName();
  const markdownFence = code.includes('```') ? '````' : '```';
  const exports = {
    databricks: {
      filename: `${filenameBase}.py`,
      content: code.startsWith('# Databricks notebook source') ? code : `# Databricks notebook source\n# COMMAND ----------\n${code}`,
      mimeType: 'text/x-python;charset=utf-8',
      label: 'Databricks notebook source (.py)'
    },
    ipynb: { filename: `${filenameBase}.ipynb`, content: getIpynbContent(code), mimeType: 'application/x-ipynb+json;charset=utf-8', label: 'Jupyter notebook (.ipynb)' },
    txt: { filename: `${filenameBase}.txt`, content: code, mimeType: 'text/plain;charset=utf-8', label: 'Plain text (.txt)' },
    markdown: { filename: `${filenameBase}.md`, content: `# ${notebookName}\n\n${markdownFence}python\n${code}\n${markdownFence}\n`, mimeType: 'text/markdown;charset=utf-8', label: 'Markdown (.md)' },
    html: { filename: `${filenameBase}.html`, content: makeNotebookHtml(code, notebookName), mimeType: 'text/html;charset=utf-8', label: 'HTML (.html)' }
  };

  if (format === 'pdf') {
    if (!openNotebookPrintView(code)) {
      showToast('Allow pop-ups to open the print view, then save it as PDF.');
      return;
    }
  } else {
    const file = exports[format];
    if (!file) return;
    triggerDownload(file.filename, file.content, file.mimeType);
  }

  const output = document.getElementById('writeOutput').checked ? ` · ${document.getElementById('outputFormat').value.toUpperCase()} output configured` : '';
  const exportLabel = format === 'pdf' ? 'PDF print view' : exports[format].label;
  addActivity('Notebook exported', `${exportLabel} · ${state.selected.size} transformation${state.selected.size === 1 ? '' : 's'} selected${output}`);
  showToast(format === 'pdf' ? 'Print view opened · choose Save as PDF' : `Exported ${exports[format].filename}`);
}

const downloadCodeButton = document.getElementById('downloadCode');
const exportFormatMenu = document.getElementById('exportFormatMenu');

function setExportMenuOpen(open) {
  exportFormatMenu.hidden = !open;
  downloadCodeButton.setAttribute('aria-expanded', String(open));
  downloadCodeButton.querySelector('.button-arrow').textContent = open ? '⌃' : '⌄';
}

downloadCodeButton.addEventListener('click', event => {
  event.stopPropagation();
  setExportMenuOpen(exportFormatMenu.hidden);
  if (!exportFormatMenu.hidden) exportFormatMenu.querySelector('[data-export-format]')?.focus();
});

exportFormatMenu.addEventListener('click', event => {
  const option = event.target.closest('[data-export-format]');
  if (!option) return;
  const format = option.dataset.exportFormat;
  document.getElementById('downloadFormat').value = format;
  syncDownloadFormatHint();
  setExportMenuOpen(false);
  exportNotebook(format);
});

document.addEventListener('click', event => {
  if (!event.target.closest('.export-menu-wrap')) setExportMenuOpen(false);
});

document.addEventListener('keydown', event => {
  if (event.key === 'Escape' && !exportFormatMenu.hidden) {
    setExportMenuOpen(false);
    downloadCodeButton.focus();
  }
});
document.getElementById('runPreview').addEventListener('click', runNotebookPreview);
document.getElementById('clearRunResults').addEventListener('click', () => {
  document.getElementById('runResults').hidden = true;
  document.getElementById('runStatus').textContent = '';
  document.getElementById('runTable').innerHTML = '';
  state.lastRunCode = null;
});

document.getElementById('editCode').addEventListener('click', () => {
  state.editingCode = !state.editingCode;
  updatePreview();
  if (state.editingCode) document.getElementById('codeEditor').focus();
});
document.getElementById('codeEditor').addEventListener('input', event => {
  const editedCode = event.currentTarget.value;
  syncBuilderFromEditedCode(editedCode);
  const generatedCode = makeCode();
  state.customCode = editedCode === generatedCode ? null : editedCode;
  state.unsyncedCodeEdits = state.customCode !== null;
  updatePreview();
});
document.getElementById('codeEditor').addEventListener('keydown', event => {
  const editor = event.currentTarget;
  if (event.key === 'Tab') {
    event.preventDefault();
    editor.setRangeText('    ', editor.selectionStart, editor.selectionEnd, 'end');
    editor.dispatchEvent(new Event('input', { bubbles: true }));
  } else if (event.key === 'Enter') {
    const beforeCursor = editor.value.slice(0, editor.selectionStart);
    const lineStart = beforeCursor.lastIndexOf('\n') + 1;
    const currentIndent = (beforeCursor.slice(lineStart).match(/^[\t ]*/) || [''])[0];
    const previousLine = beforeCursor.slice(lineStart).trimEnd();
    const nextIndent = currentIndent + (previousLine.endsWith(':') ? '    ' : '');
    event.preventDefault();
    editor.setRangeText(`\n${nextIndent}`, editor.selectionStart, editor.selectionEnd, 'end');
    editor.dispatchEvent(new Event('input', { bubbles: true }));
  }
});
document.getElementById('resetCode').addEventListener('click', () => {
  state.customCode = null;
  state.unsyncedCodeEdits = false;
  updatePreview();
  showToast('Restored code generated from the current options');
});

let builderScrollPosition = 0;
function setPreviewFocusMode(focused) {
  const builderView = document.getElementById('builderView');
  const pageWrap = document.querySelector('.page-wrap');
  const previewButton = document.getElementById('expandPreview');
  const previewIcon = previewButton.querySelector('.expand-icon');
  const previewLabel = previewButton.querySelector('.expand-label');

  if (focused) builderScrollPosition = window.scrollY;
  builderView.classList.toggle('preview-focus-mode', focused);
  pageWrap.classList.toggle('preview-focus-mode', focused);
  previewButton.setAttribute('aria-expanded', String(focused));
  previewButton.setAttribute('aria-label', focused ? 'Return to notebook builder' : 'Open full-page live preview');
  previewButton.title = focused ? 'Return to notebook builder' : 'Open full-page live preview';
  previewIcon.textContent = focused ? '↙' : '⤢';
  previewLabel.hidden = !focused;
  document.getElementById('breadcrumbCurrent').textContent = focused ? 'Live preview' : 'Notebook builder';
  window.scrollTo(0, focused ? 0 : builderScrollPosition);
}

document.getElementById('expandPreview').addEventListener('click', () => {
  const focused = document.getElementById('builderView').classList.contains('preview-focus-mode');
  setPreviewFocusMode(!focused);
});

document.addEventListener('keydown', event => {
  if (event.key === 'Escape' && document.getElementById('builderView').classList.contains('preview-focus-mode')) {
    setPreviewFocusMode(false);
  }
});


function bindModuleToggle(buttonId, panelSelector, contentId, moduleName) {
  const button = document.getElementById(buttonId);
  const panel = document.querySelector(panelSelector);
  const content = document.getElementById(contentId);
  const icon = button.querySelector('.module-toggle-icon');
  const setCollapsed = collapsed => {
    panel.classList.toggle('is-collapsed', collapsed);
    content.hidden = collapsed;
    button.setAttribute('aria-expanded', String(!collapsed));
    button.setAttribute('aria-label', `${collapsed ? 'Expand' : 'Collapse'} ${moduleName}`);
    button.title = `${collapsed ? 'Expand' : 'Collapse'} ${moduleName}`;
    icon.textContent = collapsed ? '⌄' : '⌃';
  };

  setCollapsed(button.getAttribute('aria-expanded') !== 'true');
  button.addEventListener('click', () => {
    setCollapsed(button.getAttribute('aria-expanded') === 'true');
  });
}

bindModuleToggle('toggleSourceModule', '.source-card', 'sourceModuleContent', 'source section');
bindModuleToggle('toggleOutputModule', '.output-card', 'outputSettings', 'output settings');

const sidebar = document.querySelector('.sidebar');
const mainArea = document.querySelector('.main-area');
const sidebarToggle = document.getElementById('toggleSidebar');
const sidebarBackdrop = document.getElementById('sidebarBackdrop');
const mobileSidebarQuery = window.matchMedia('(max-width: 900px)');
let sidebarPreference = null;

function setSidebarCollapsed(collapsed) {
  const isMobile = mobileSidebarQuery.matches;
  sidebar.classList.toggle('is-collapsed', collapsed);
  sidebar.classList.toggle('is-mobile-expanded', isMobile && !collapsed);
  mainArea.classList.toggle('sidebar-collapsed', collapsed || isMobile);
  mainArea.classList.toggle('sidebar-pane-collapsed', collapsed);
  sidebarToggle.setAttribute('aria-expanded', String(!collapsed));
  sidebarToggle.setAttribute('aria-label', `${collapsed ? 'Expand' : 'Collapse'} sidebar`);
  sidebarBackdrop.hidden = !(isMobile && !collapsed);
}

setSidebarCollapsed(mobileSidebarQuery.matches);
sidebarToggle.addEventListener('click', () => {
  sidebarPreference = !sidebar.classList.contains('is-collapsed');
  setSidebarCollapsed(sidebarPreference);
});
sidebarBackdrop.addEventListener('click', () => {
  sidebarPreference = true;
  setSidebarCollapsed(true);
});
document.querySelector('.side-nav').addEventListener('click', () => {
  if (mobileSidebarQuery.matches && !sidebar.classList.contains('is-collapsed')) {
    sidebarPreference = true;
    setSidebarCollapsed(true);
  }
});
window.addEventListener('resize', () => {
  if (sidebarPreference === null) setSidebarCollapsed(mobileSidebarQuery.matches);
  else setSidebarCollapsed(sidebarPreference);
});
document.addEventListener('keydown', event => {
  if (event.key === 'Escape' && mobileSidebarQuery.matches && !sidebar.classList.contains('is-collapsed')) {
    sidebarPreference = true;
    setSidebarCollapsed(true);
  }
});
