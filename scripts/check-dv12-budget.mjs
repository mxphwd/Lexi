import fs from 'node:fs/promises';
const root=new URL('../dist/client/',import.meta.url),manifest=JSON.parse(await fs.readFile(new URL('.vite/manifest.json',root),'utf8'));
const initial=new Set(),all=new Set();
function visit(key){const entry=manifest[key];if(!entry||initial.has(entry.file))return;initial.add(entry.file);for(const id of entry.imports??[])visit(id);}
for(const [id,entry] of Object.entries(manifest)){if(entry.isEntry)visit(id);if(entry.file.endsWith('.js'))all.add(entry.file);}
let initialBytes=0,totalBytes=0;const violations=[];
for(const file of all){
  const bytes=await fs.readFile(new URL(file,root));totalBytes+=bytes.length;if(initial.has(file))initialBytes+=bytes.length;
  if(/lexiKnowledgeGraph|AD1_VALUE_SCHEMA|UNBOUND_RULE_CONCLUSION/.test(bytes.toString('utf8')))violations.push('World engine leaked into client: '+file);
}
if(initialBytes>1000000)violations.push('Initial JavaScript exceeds 1 MB uncompressed');
if(totalBytes>1500000)violations.push('Total JavaScript exceeds 1.5 MB uncompressed');
const report={initialBytes,totalBytes,initialFiles:initial.size,totalFiles:all.size,limits:{initialBytes:1000000,totalBytes:1500000},violations,passed:!violations.length};
await fs.writeFile(new URL('../docs/'+(process.argv.includes('--dv13')?'dv13':'dv12')+'/bundle-budget.json',import.meta.url),JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify(report,null,2));if(violations.length)process.exitCode=1;
