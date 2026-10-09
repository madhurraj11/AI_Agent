// Schema inspection and column-reference checks for the visual pipeline.
const sourceSchemaState = { columns: null, loading: false, requestId: 0, partial: false, issueCount: 0 };

function updateSchemaAvailability() {
  const local = document.getElementById('loadSourceSchema');
  const remote = document.getElementById('loadRemoteSchema');
  local.disabled = sourceSchemaState.loading || !state.uploads.length;
  remote.disabled = sourceSchemaState.loading || !state.session.previewAvailable || (state.session.databricksApp && !state.session.authenticated);
}

function invalidateSourceSchema() {
  sourceSchemaState.requestId++;
  sourceSchemaState.columns = null;
  sourceSchemaState.loading = false;
  document.getElementById('sourceSchemaPanel').hidden = true;
  document.getElementById('sourceSchemaStatus').textContent = 'Source changed. Inspect selected files or load the schema from Databricks to check column names.';
  document.getElementById('sourceSchemaStatus').classList.remove('is-error');
  refreshColumnValidation();
  updateSchemaAvailability();
}

function splitSchemaTypeParts(value, separator = ',') {
  const parts = [];
  let start = 0;
  let angleDepth = 0;
  let roundDepth = 0;
  for (let index = 0; index < value.length; index++) {
    const character = value[index];
    if (character === '<') angleDepth++;
    else if (character === '>') angleDepth--;
    else if (character === '(') roundDepth++;
    else if (character === ')') roundDepth--;
    else if (character === separator && angleDepth === 0 && roundDepth === 0) {
      parts.push(value.slice(start, index).trim());
      start = index + 1;
    }
  }
  parts.push(value.slice(start).trim());
  return parts.filter(Boolean);
}

function splitSchemaField(value) {
  let depth = 0;
  for (let index = 0; index < value.length; index++) {
    if (value[index] === '<' || value[index] === '(') depth++;
    else if (value[index] === '>' || value[index] === ')') depth--;
    else if (value[index] === ':' && depth === 0) return [value.slice(0, index).trim().replace(/^`|`$/g, ''), value.slice(index + 1).trim()];
  }
  return [value.trim(), 'string'];
}

function parseSchemaType(type) {
  const source = String(type || '').trim();
  const lower = source.toLowerCase();
  if (lower.startsWith('array<') && source.endsWith('>')) return { kind: 'array', child: parseSchemaType(source.slice(6, -1)), raw: source };
  if (lower.startsWith('struct<') && source.endsWith('>')) {
    return {
      kind: 'struct',
      fields: splitSchemaTypeParts(source.slice(7, -1)).map(field => {
        const [name, fieldType] = splitSchemaField(field);
        return { name, type: parseSchemaType(fieldType) };
      }),
      raw: source
    };
  }
  if (lower.startsWith('map<') && source.endsWith('>')) {
    const [keyType = 'string', valueType = 'string'] = splitSchemaTypeParts(source.slice(4, -1));
    return { kind: 'map', key: parseSchemaType(keyType), value: parseSchemaType(valueType), raw: source };
  }
  return { kind: 'primitive', raw: source };
}

function friendlySchemaType(node) {
  if (node.kind === 'struct') return 'Object';
  if (node.kind === 'array') return node.child.kind === 'struct' ? 'List of objects' : `List of ${friendlySchemaType(node.child).toLowerCase()} values`;
  if (node.kind === 'map') return 'Key-value map';
  const type = databricksTypeLabel(node.raw);
  if (/^(STRING|CHAR|VARCHAR)/.test(type)) return 'Text';
  if (/^(BIGINT|INT|INTEGER|SMALLINT|TINYINT|FLOAT|DOUBLE|DECIMAL)/.test(type)) return 'Number';
  if (/^BOOLEAN/.test(type)) return 'True / false';
  if (/^TIMESTAMP/.test(type)) return 'Date and time';
  if (/^DATE/.test(type)) return 'Date';
  return type;
}

function renderSchemaNode(node, name = '') {
  const childRows = node.kind === 'struct'
    ? node.fields.map(field => renderSchemaNode(field.type, field.name)).join('')
    : node.kind === 'array' && (node.child.kind === 'struct' || node.child.kind === 'array' || node.child.kind === 'map')
      ? renderSchemaNode(node.child, node.child.kind === 'struct' ? 'Each item contains' : 'Each item')
      : node.kind === 'map'
        ? `${renderSchemaNode(node.key, 'Key')}${renderSchemaNode(node.value, 'Value')}`
        : '';
  return `<li><div class="schema-tree-row">${name ? `<strong>${escapeHtml(name)}</strong>` : ''}<span>${escapeHtml(friendlySchemaType(node))}</span><code>${escapeHtml(databricksTypeLabel(node.raw))}</code></div>${childRows ? `<ul>${childRows}</ul>` : ''}</li>`;
}

function renderSchemaType(type) {
  const node = parseSchemaType(type);
  if (node.kind === 'primitive') return `<div class="schema-simple-type"><strong>${escapeHtml(friendlySchemaType(node))}</strong><code>${escapeHtml(databricksTypeLabel(node.raw))}</code></div>`;
  const tree = node.kind === 'struct'
    ? node.fields.map(field => renderSchemaNode(field.type, field.name)).join('')
    : renderSchemaNode(node);
  return `<div class="schema-type-summary"><strong>${escapeHtml(friendlySchemaType(node))}</strong><span>Nested data</span></div><ul class="schema-tree">${tree}</ul><details class="schema-raw-type"><summary>Show original Spark type</summary><code>${escapeHtml(databricksTypeLabel(type))}</code></details>`;
}

async function loadSourceSchema(remote = false) {
  const requestId = ++sourceSchemaState.requestId;
  sourceSchemaState.loading = true;
  sourceSchemaState.columns = null;
  document.getElementById('sourceSchemaPanel').hidden = true;
  refreshColumnValidation();
  updateSchemaAvailability();
  const status = document.getElementById('sourceSchemaStatus');
  status.classList.remove('is-error');
  status.textContent = remote ? 'Reading schema from Databricks…' : 'Inspecting selected source files…';
  const format = document.getElementById('sourceFormat').value;
  const version = format === 'delta' ? document.getElementById('sourceDeltaVersion').value.trim() : '';
  try {
    let body;
    let headers = { Accept: 'application/json' };
    if (remote) {
      headers['Content-Type'] = 'application/json';
      body = JSON.stringify({ format, version, path: document.getElementById('sourcePath').value.trim() });
    } else {
      let files = state.uploads;
      if (format === 'delta') files = files.filter(file => /(?:^|\/)_delta_log\/\d+\.json$/.test(file.webkitRelativePath || file.name));
      if (format === 'iceberg') files = files.filter(file => file.name.endsWith('.metadata.json'));
      if (!files.length) throw new Error('No schema metadata was found in this folder. Use Load from Databricks to inspect the table.');
      if (files.reduce((size, file) => size + file.size, 0) > 60 * 1024 * 1024) throw new Error('Local inspection supports up to 60 MB per selection. Use Load from Databricks for larger sources.');
      body = new FormData();
      body.append('format', format);
      body.append('version', version);
      files.forEach(file => body.append('files', file, file.webkitRelativePath || file.name));
    }
    const response = await fetch('/api/source-schema', { method: 'POST', credentials: 'same-origin', headers, body });
    const result = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(result.error || `Schema inspection failed (${response.status}).`);
    if (!Array.isArray(result.columns) || !result.columns.length) throw new Error('No columns were found in this source.');
    if (requestId !== sourceSchemaState.requestId) return;
    if (remote) {
      state.activeSourceMode = 'databricks';
      state.uploads = [];
      state.uploadedPathBase = null;
      state.uploadedPathFileName = null;
      document.getElementById('sourceFiles').value = '';
      document.getElementById('sourceFolder').value = '';
      renderUploadedFiles();
    }
    sourceSchemaState.columns = result.columns;
    sourceSchemaState.caseSensitive = result.caseSensitive === true;
    updateUploadMode();
    document.getElementById('sourceSchemaColumns').innerHTML = result.columns.map(column => `<tr><td class="schema-column-name">${escapeHtml(column.name)}</td><td>${renderSchemaType(column.type)}</td></tr>`).join('');
    document.getElementById('sourceSchemaCount').textContent = `${result.columns.length} columns`;
    document.getElementById('sourceSchemaNote').textContent = result.inferred
      ? 'Types are inferred from up to 1,000 records per file. Load from Databricks to confirm the types used by Spark. Column checks follow your selected step order.'
      : `${remote ? 'Databricks source' : 'Selected file'} metadata provides the column names and types. Column checks follow your selected step order.`;
    document.getElementById('sourceSchemaPanel').hidden = false;
    status.textContent = `Schema loaded from ${remote ? 'Databricks' : 'selected files'}. Unknown column references will be highlighted in selected transformations.`;
    updatePreview();
  } catch (error) {
    if (requestId !== sourceSchemaState.requestId) return;
    status.textContent = error.message;
    status.classList.add('is-error');
  } finally {
    if (requestId === sourceSchemaState.requestId) {
      sourceSchemaState.loading = false;
      updateSchemaAvailability();
    }
  }
}

function expressionColumnReferences(expression) {
  const references = [];
  const columnApi = /(?:\bF\.)?\bcol\s*\(\s*(['"])(.*?)\1\s*\)/g;
  for (const match of expression.matchAll(columnApi)) references.push(match[2]);
  const frameName = document.getElementById('dataframeName').value.trim() || 'df';
  const escapedFrame = frameName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const attributePattern = new RegExp(`\\b(?:df|${escapedFrame})\\.([A-Za-z_]\\w*)(?!\\w|\\s*\\()`, 'g');
  for (const match of expression.matchAll(attributePattern)) references.push(match[1]);
  // Column API expressions contain Python methods and string literals. Only
  // explicit column references and literal F.expr SQL are checked in that case.
  if (references.length || /\bF\./.test(expression)) {
    for (const match of expression.matchAll(/\bF\.expr\(\s*(['"])(.*?)\1\s*\)/g)) references.push(...expressionColumnReferences(match[2]));
    return [...new Set(references)];
  }
  const keywords = new Set('and or not null true false case when then else end as is in between like ilike rlike regexp escape distinct over partition by order asc desc nulls first last cast try_cast string int integer bigint long double float decimal boolean date timestamp interval day days month months year years hour hours minute minutes second seconds current_date current_timestamp nan infinity'.split(' '));
  let sql = expression.replace(/'(?:''|\\.|[^'])*'|"(?:""|\\.|[^"])*"/g, ' ');
  sql = sql.replace(/`((?:``|[^`])+)`/g, (_, name) => { references.push(name.replace(/``/g, '`')); return ' '; });
  for (const match of sql.matchAll(/\b[A-Za-z_]\w*(?:\.[A-Za-z_]\w*)*/g)) {
    const token = match[0];
    if (!keywords.has(token.toLowerCase()) && !/^\s*\(/.test(sql.slice(match.index + token.length)) && !/[\w.]/.test(sql[match.index - 1] || '')) references.push(token);
  }
  return [...new Set(references)];
}

function refreshColumnValidation() {
  sourceSchemaState.issueCount = 0;
  sourceSchemaState.issues = [];
  sourceSchemaState.omittedSteps = new Set();
  sourceSchemaState.cleanedValues = new Map();
  document.querySelectorAll('.column-field-warning').forEach(element => element.remove());
  document.querySelectorAll('[data-op][aria-invalid]').forEach(element => {
    element.removeAttribute('aria-invalid');
    element.removeAttribute('aria-describedby');
  });
  const summary = document.getElementById('columnValidationSummary');
  summary.hidden = true;
  let currentFrameName = document.getElementById('dataframeName').value.trim() || 'df';
  const usedFrameNames = new Set([currentFrameName]);
  for (const id of state.selected) {
    if (!isNewDataFrameStep(id)) continue;
    const target = getValue(id, 'target');
    if (!validNewFrameName(target, currentFrameName) || usedFrameNames.has(target)) {
      sourceSchemaState.omittedSteps.add(id);
      const field = document.querySelector(`[data-op="${id}"][data-key="target"]`);
      if (field) {
        const warning = document.createElement('div');
        warning.className = 'column-field-warning';
        warning.id = `${id}-target-warning`;
        warning.textContent = 'Enter a distinct Python variable name that is not used by another DataFrame step. Reserved Python and notebook names cannot be used.';
        field.setAttribute('aria-invalid', 'true');
        field.setAttribute('aria-describedby', warning.id);
        field.closest('.setting-field').appendChild(warning);
      }
      continue;
    }
    usedFrameNames.add(target);
    currentFrameName = target;
  }
  if (state.selected.has('filter') && !getValue('filter', 'condition')) {
    sourceSchemaState.omittedSteps.add('filter');
    const field = document.querySelector('[data-op="filter"][data-key="condition"]');
    if (field) {
      const warning = document.createElement('div');
      warning.className = 'column-field-warning';
      warning.id = 'filter-condition-required-warning';
      warning.textContent = 'Enter a filter condition or uncheck Filter records. This empty step is omitted from the generated notebook.';
      field.setAttribute('aria-invalid', 'true');
      field.setAttribute('aria-describedby', warning.id);
      field.closest('.setting-field').appendChild(warning);
    }
  }
  if (!sourceSchemaState.columns) return;
  let available = new Map(sourceSchemaState.columns.map(column => [column.name, column]));
  let uncertain = false;
  let separateTarget = false;
  const issues = [];
  const lookup = name => {
    const clean = name.replace(/`/g, '');
    const find = (columns, part) => columns.find(column => sourceSchemaState.caseSensitive ? column.name === part : column.name.toLowerCase() === part.toLowerCase());
    const exact = find([...available.values()], clean);
    if (exact) return exact;
    const parts = clean.split('.');
    let current = find([...available.values()], parts.shift());
    for (const part of parts) {
      if (!current) return null;
      if (part === '*') return current;
      if (current.unknownChildren || String(current.type || '').startsWith('map<')) return current;
      current = find(current.children || [], part);
    }
    return current;
  };
  const remove = name => {
    const field = lookup(name);
    if (field) available.delete(field.name);
  };
  const add = (name, field = {}) => {
    if (!name) return;
    const previous = [...available.keys()].find(key => sourceSchemaState.caseSensitive ? key === name : key.toLowerCase() === name.toLowerCase());
    if (previous) available.delete(previous);
    available.set(name, { ...field, name });
  };
  const check = (item, key, references) => {
    const field = document.querySelector(`[data-op="${item.id}"][data-key="${key}"]`);
    if (!field || field.closest('.setting-field').hidden) return;
    const unknown = [...new Set(references)].filter(name => name && name !== '*' && !lookup(name) && !uncertain);
    if (!unknown.length) return;
    const existing = issues.find(issue => issue.id === item.id && issue.key === key);
    const combined = [...new Set([...(existing?.unknown || []), ...unknown])];
    const message = `Unknown column${combined.length > 1 ? 's' : ''}: ${combined.join(', ')}. Use a column available before this step.`;
    field.setAttribute('aria-invalid', 'true');
    const warning = document.getElementById(`${item.id}-${key}-column-warning`) || document.createElement('div');
    warning.className = 'column-field-warning';
    warning.id = `${item.id}-${key}-column-warning`;
    warning.textContent = message;
    field.setAttribute('aria-describedby', warning.id);
    field.closest('.setting-field').appendChild(warning);
    if (existing) existing.unknown = combined;
    else issues.push({ id: item.id, key, title: item.title, unknown: combined });
  };
  for (const id of state.selected) {
    const item = transformations.find(operation => operation.id === id);
    if (!item) continue;
    const value = key => sourceSchemaState.cleanedValues.get(`${id}.${key}`) ?? getValue(id, key);
    const refs = key => check(item, key, csvList(value(key)));
    const expression = (key, text) => check(item, key, expressionColumnReferences(text));
    const pairs = key => parseMappings(value(key));
    if (isNewDataFrameStep(id)) {
      if (!sourceSchemaState.omittedSteps.has(id) && value('base') === 'source') {
        available = new Map(sourceSchemaState.columns.map(column => [column.name, column]));
        uncertain = false;
      }
      continue;
    }
    if (id.startsWith('delta')) {
      if (id === 'deltaDelete') {
        if (value('target') === document.getElementById('sourcePath').value.trim() && document.getElementById('sourceFormat').value === 'delta') {
          const pipelineColumns = available;
          const pipelineUncertain = uncertain;
          available = new Map(sourceSchemaState.columns.map(column => [column.name, column]));
          uncertain = false;
          expression('condition', value('condition'));
          available = pipelineColumns;
          uncertain = pipelineUncertain;
        } else separateTarget = true;
      }
      if (issues.some(issue => issue.id === id)) sourceSchemaState.omittedSteps.add(id);
      continue;
    }
    for (const key of ['source', 'otherSource', 'values', 'keys', 'timestamp', 'partition', 'order', 'groups', 'updateColumns', 'trackedColumns', 'effectiveColumn']) {
      if (item.fields.some(field => field.key === key)) refs(key);
    }
    if (item.fields.some(field => field.key === 'columns') && !(id === 'selectColumns' && value('mode') === 'range')) refs('columns');
    if (id === 'nulls' && ['coalesce', 'nvl', 'nullif'].includes(value('strategy'))) refs('target');
    if (id === 'sort' || (id === 'nulls' && value('strategy') === 'fillMap')) check(item, 'mappings', pairs('mappings').map(([name]) => name));
    if (id === 'filter') expression('condition', value('condition'));
    if (id === 'conditional') expression('cases', value('cases').split('\n').map(line => splitConditionResult(line)?.[0] || '').join(' '));
    if (id === 'createColumns' || id === 'dates') {
      // Each mapping produces a column that later mappings in this step may use.
      const valid = [];
      for (const [name, sql] of pairs('mappings')) {
        expression('mappings', sql);
        if (expressionColumnReferences(sql).some(ref => !lookup(ref) && !uncertain)) continue;
        valid.push(`${name}: ${sql}`);
        add(name, { unknownChildren: true });
      }
      sourceSchemaState.cleanedValues.set(`${id}.mappings`, valid.join('\n'));
    }
    for (const issue of issues.filter(issue => issue.id === id)) {
      const listKeys = ['columns', 'partition', 'order', 'groups', 'updateColumns', 'trackedColumns'];
      if (listKeys.includes(issue.key)) {
        const valid = csvList(value(issue.key)).filter(name => !issue.unknown.includes(name));
        sourceSchemaState.cleanedValues.set(`${id}.${issue.key}`, valid.join(', '));
        if (!valid.length) sourceSchemaState.omittedSteps.add(id);
      } else if (issue.key === 'mappings' && ['rename', 'sort', 'nulls'].includes(id)) {
        const valid = pairs('mappings').filter(([name]) => !issue.unknown.includes(name));
        sourceSchemaState.cleanedValues.set(`${id}.mappings`, valid.map(([name, result]) => `${name}: ${result}`).join('\n'));
        if (!valid.length) sourceSchemaState.omittedSteps.add(id);
      } else if (!(issue.key === 'mappings' && ['createColumns', 'dates'].includes(id))) {
        sourceSchemaState.omittedSteps.add(id);
      }
    }
    if (['createColumns', 'dates'].includes(id) && !pairs('mappings').length) sourceSchemaState.omittedSteps.add(id);
    if (sourceSchemaState.omittedSteps.has(id)) continue;
    if (id === 'aggregate') {
      if (value('mode') === 'pivot') refs('pivot');
      if (issues.some(issue => issue.id === id && issue.key === 'pivot')) { sourceSchemaState.omittedSteps.add(id); continue; }
      const validAggregates = pairs('mappings').filter(([, sql]) => {
        expression('mappings', sql);
        return !expressionColumnReferences(sql).some(ref => !lookup(ref) && !uncertain);
      });
      sourceSchemaState.cleanedValues.set(`${id}.mappings`, validAggregates.map(([name, sql]) => `${name}: ${sql}`).join('\n'));
      if (!validAggregates.length) { sourceSchemaState.omittedSteps.add(id); continue; }
      available = new Map(csvList(value('groups')).map(name => { const column = lookup(name) || { name }; return [column.name, column]; }));
      if (value('mode') === 'pivot') uncertain = true;
      else pairs('mappings').forEach(([name]) => add(name));
    }
    if (id === 'selectColumns' || (id === 'distinct' && value('columns'))) {
      const names = id === 'selectColumns' && value('mode') === 'range'
        ? [...available.keys()].slice(Number(value('startIndex')), Number(value('endIndex')))
        : csvList(value('columns'));
      if (!names.includes('*')) available = new Map(names.map(name => { const column = lookup(name) || { name }; return [column.name, column]; }));
    }
    if (id === 'rename') {
      const valid = [];
      for (const [oldName, newName] of pairs('mappings')) {
        check(item, 'mappings', [oldName]); const field = lookup(oldName);
        if (!field && !uncertain) continue;
        valid.push(`${oldName}: ${newName}`); remove(oldName); add(newName, field || {});
      }
      sourceSchemaState.cleanedValues.set(`${id}.mappings`, valid.join('\n'));
      if (!valid.length) sourceSchemaState.omittedSteps.add(id);
    }
    if (id === 'dropColumns') csvList(value('columns')).forEach(remove);
    if (id === 'standardizeNames') available = new Map([...available.values()].map(column => {
      const name = column.name.replace(/[^a-zA-Z0-9]+/g, '_').replace(/^_+|_+$/g, '').toLowerCase();
      return [name, { ...column, name }];
    }));
    if (item.kind || id === 'conditional') {
      let field = {};
      if (item.kind === 'json' && item.presetFn === 'struct') field.children = csvList(value('columns')).map(name => lookup(name) || { name });
      if (item.kind === 'json' && item.presetFn === 'from_json') field.unknownChildren = true;
      if (item.kind === 'array' && ['explode', 'explode_outer', 'get_item', 'posexplode'].includes(item.presetFn)) field = lookup(value('source')) || {};
      add(value('target'), field);
      if (item.presetFn === 'posexplode') add(value('position') || 'position');
    }
    if (id === 'flattenNested') {
      const source = value('source');
      const mode = value('mode');
      if (mode === 'recursive') {
        for (const [path, output] of flattenPlanLines(value('explodeSteps'))) {
          check(item, 'explodeSteps', [path]);
          add(output, lookup(path) || { unknownChildren: true });
        }
        const selected = new Map();
        for (const [path, output] of flattenPlanLines(value('selectFields'))) {
          check(item, 'selectFields', [path]);
          selected.set(output, { ...(lookup(path) || { unknownChildren: true }), name: output });
        }
        available = selected;
      } else if (mode === 'struct') {
        const path = nestedStructPath(source);
        let column = lookup(path[0] || source);
        for (const [index, level] of path.entries()) {
          if (!column?.children) { uncertain = true; break; }
          remove(level);
          column.children.forEach(child => add(child.name, child));
          if (index < path.length - 1) {
            const nextName = path[index + 1];
            column = column.children.find(child => sourceSchemaState.caseSensitive
              ? child.name === nextName
              : child.name.toLowerCase() === nextName.toLowerCase());
          }
        }
      } else if (mode.endsWith('_struct') || nestedStructsAfterTarget(value('nestedStructs'), value('target')).length) {
        const column = lookup(source);
        remove(source);
        if (column?.children) column.children.forEach(child => add(child.name, child));
        else uncertain = true;
        for (const level of nestedStructsAfterTarget(value('nestedStructs'), value('target'))) {
          const nested = lookup(level);
          if (!nested?.children) { uncertain = true; break; }
          remove(level);
          nested.children.forEach(child => add(child.name, child));
        }
      } else {
        const column = lookup(source);
        add(value('target'), column || {});
        remove(source);
      }
      if (mode.startsWith('posexplode')) add(value('position') || 'position');
    }
  }
  sourceSchemaState.partial = uncertain;
  sourceSchemaState.issueCount = issues.length;
  sourceSchemaState.issues = issues;
  if (issues.length) {
    summary.hidden = false;
    summary.innerHTML = `<strong>${issues.length} column field${issues.length > 1 ? 's' : ''} need attention</strong><p>${issues.slice(0, 5).map(issue => `${escapeHtml(issue.title)}: ${issue.unknown.map(escapeHtml).join(', ')}`).join('<br>')}${issues.length > 5 ? '<br>See highlighted fields for the remaining issues.' : ''}</p>`;
  }
  const note = document.getElementById('sourceSchemaNote');
  note.dataset.partial = uncertain ? 'true' : 'false';
  document.getElementById('sourceSchemaCount').textContent = `${sourceSchemaState.columns.length} columns${uncertain ? ' · later dynamic columns require Spark validation' : ''}${separateTarget ? ' · a separate Delta target requires its own schema' : ''}`;
}

function validSelectionColumns(item, names) {
  const issue = (sourceSchemaState.issues || []).find(issue => issue.id === item.id && issue.key === 'columns');
  return issue ? names.filter(name => !issue.unknown.includes(name)) : names;
}

function validNewFrameName(name, current) {
  const reserved = new Set('False None True and as assert async await break class continue def del elif else except finally for from global if import in is lambda nonlocal not or pass raise return try while with yield match case spark F Window reader display json re StringType StructType StructField DateType TimestampType IntegerType LongType DoubleType FloatType BooleanType'.split(' '));
  return /^[A-Za-z_][A-Za-z0-9_]*$/.test(name) && name !== current && !name.startsWith('_') && !reserved.has(name);
}

function initSourceSchema() {
  document.getElementById('toggleSourceSchema').addEventListener('click', event => {
    const button = event.currentTarget;
    const expanded = button.getAttribute('aria-expanded') === 'true';
    document.getElementById('sourceSchemaDetails').hidden = expanded;
    button.setAttribute('aria-expanded', String(!expanded));
    button.textContent = expanded ? 'Expand columns ▾' : 'Collapse columns ▴';
  });
  document.getElementById('loadSourceSchema').addEventListener('click', () => loadSourceSchema(false));
  document.getElementById('loadRemoteSchema').addEventListener('click', () => loadSourceSchema(true));
  updateSchemaAvailability();
}

function databricksTypeLabel(type) {
  const aliases = {long: 'BIGINT', integer: 'INT', bool: 'BOOLEAN', bytes: 'BINARY', null: 'VOID'};
  return String(type).replace(/\b(bigint|long|int|integer|tinyint|smallint|float|double|decimal|boolean|bool|string|binary|bytes|date|timestamp_ntz|timestamp|array|map|struct|void|null)\b(?!\s*:)/gi,
    name => aliases[name.toLowerCase()] || name.toUpperCase());
}
