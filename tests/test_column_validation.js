const fs = require('node:fs');
const path = require('node:path');
const schema = fs.readFileSync(path.join(__dirname, '..', 'schema.js'), 'utf8');
const app = fs.readFileSync(path.join(__dirname, '..', 'app.js'), 'utf8');
const helpers = ['getValue', 'csvList', 'parseMappings', 'escapeHtml', 'splitConditionResult']
  .map(name => app.match(new RegExp('function ' + name + '\\([^]*?\\n\\}'))[0]).join('\n');
function run(ops,values,columns=[{name:"emp_id",type:"bigint"},{name:"emp_name",type:"string"},{name:"salary",type:"double"},{name:"department",type:"string"}]){
 const fields={}, warnings={}, nodes={columnValidationSummary:{hidden:true,innerHTML:""},sourceSchemaNote:{dataset:{}},sourceSchemaCount:{},dataframeName:{value:"df"}};
 for(const op of ops)for(const key of Object.keys(values[op.id]||{})){
  const container={hidden:false,appendChild(e){warnings[e.id]=e;}};
  fields[op.id+"."+key]={value:values[op.id][key],attributes:{},closest(){return container},setAttribute(k,v){this.attributes[k]=v},removeAttribute(k){delete this.attributes[k]}};
 }
 const document={getElementById(id){return nodes[id]||warnings[id]||null},querySelector(s){const m=s.match(/data-op="([^"]+)"\]\[data-key="([^"]+)"/);return m?fields[m[1]+"."+m[2]]:null},querySelectorAll(s){if(s===".column-field-warning")return Object.values(warnings);return Object.values(fields).filter(f=>f.attributes["aria-invalid"]);},createElement(){return {remove(){delete warnings[this.id]}}}};
 const state={selected:new Set(ops.map(o=>o.id))};
 ops.forEach(op=>op.fields=Object.keys(values[op.id]||{}).map(key=>({key})));
 const api=new Function("document","state","transformations",helpers+"\n"+schema+"\nreturn {refresh:refreshColumnValidation,expr:expressionColumnReferences,setColumns(c){sourceSchemaState.columns=c;}}")(document,state,ops);
 api.setColumns(columns);api.refresh();
 return {issues:Object.entries(fields).filter(([,f])=>f.attributes["aria-invalid"]).map(([key])=>key), api, summary:nodes.columnValidationSummary.innerHTML};
}
function assert(condition, message) { if (!condition) throw new Error(message); }
let result = run([{id:'text_lower',kind:'text',title:'Lowercase'}], {text_lower:{source:'order_details',target:'name_clean'}});
assert(result.issues.includes('text_lower.source'), 'An unknown input column must be flagged.');
result = run([{id:'createColumns',title:'Create'},{id:'numeric_round',kind:'numeric',title:'Round'}], {createColumns:{mappings:'total_comp: salary * 12\nbonus: total_comp * 2'},numeric_round:{source:'total_comp',target:'rounded'}});
assert(result.issues.length === 0, 'Earlier generated outputs, including mappings within a step, must be usable.');
result = run([{id:'numeric_round',kind:'numeric',title:'Round'},{id:'createColumns',title:'Create'}], {createColumns:{mappings:'total_comp: salary * 12'},numeric_round:{source:'total_comp',target:'rounded'}});
assert(result.issues.includes('numeric_round.source'), 'A future output must not be usable before it is created.');
result = run([{id:'rename',title:'Rename'},{id:'text_lower',kind:'text',title:'Lowercase'}], {rename:{mappings:'emp_name: full_name\nfull_name: display_name'},text_lower:{source:'display_name',target:'clean'}});
assert(result.issues.length === 0, 'Chained renames must retain valid column names.');
result = run([{id:'rename',title:'Rename'},{id:'text_lower',kind:'text',title:'Lowercase'}], {rename:{mappings:'emp_name: full_name'},text_lower:{source:'emp_name',target:'clean'}});
assert(result.issues.includes('text_lower.source'), 'The previous name must disappear after a rename.');
result = run([{id:'dropColumns',title:'Drop'},{id:'filter',title:'Filter'}], {dropColumns:{columns:'salary'},filter:{condition:'salary > 5000'}});
assert(result.issues.includes('filter.condition'), 'Removed columns must not be accepted in later expressions.');
result = run([{id:'selectColumns',title:'Select'},{id:'text_lower',kind:'text',title:'Lowercase'}], {selectColumns:{mode:'columns',columns:'emp_id, salary'},text_lower:{source:'emp_name',target:'clean'}});
assert(result.issues.includes('text_lower.source'), 'Selecting a subset must remove other columns.');
result = run([{id:'text_lower',kind:'text',title:'Lowercase'}], {text_lower:{source:'details.city',target:'clean'}}, [{name:'details',type:'struct',children:[{name:'city',type:'string'}]}]);
assert(result.issues.length === 0, 'A known nested field must be accepted.');
result = run([{id:'text_lower',kind:'text',title:'Lowercase'}], {text_lower:{source:'details.order_details',target:'clean'}}, [{name:'details',type:'struct',children:[{name:'city',type:'string'}]}]);
assert(result.issues.length === 1, 'An unknown nested field must be flagged.');
result = run([{id:'aggregate',title:'Aggregate'},{id:'numeric_round',kind:'numeric',title:'Round'}], {aggregate:{mode:'group',groups:'department',mappings:'total_salary: sum(salary)'},numeric_round:{source:'total_salary',target:'rounded'}});
assert(result.issues.length === 0, 'An aggregate output alias must be available.');
result = run([{id:'filter',title:'Filter'}], {filter:{condition:"(F.col('order_details') == 'IT') & (F.col('salary') > 5000)"}});
assert(result.issues.length === 1, 'Explicit F.col references must be checked.');
assert(JSON.stringify(result.api.expr("CASE WHEN salary > 5 THEN concat(emp_name, 'order_details') ELSE 'x' END")) === JSON.stringify(['salary','emp_name']), 'SQL literals, functions and keywords must not be treated as columns.');
result = run([{id:'flattenNested',title:'Flatten'},{id:'text_lower',kind:'text',title:'Lowercase'}], {flattenNested:{source:'details',mode:'struct'},text_lower:{source:'city',target:'city_clean'}}, [{name:'details',type:'struct',children:[{name:'city',type:'string'}]}]);
assert(result.issues.length === 0, 'Flattened struct fields must become available.');
result = run([{id:'numeric_round',kind:'numeric',title:'Round'}], {numeric_round:{source:'SALARY',target:'salary_round'}});
assert(result.issues.length === 0, 'The default Spark lookup must ignore case.');
console.log('14 column-validation scenarios passed.');

