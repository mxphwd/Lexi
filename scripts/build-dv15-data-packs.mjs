import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import zlib from 'node:zlib';

const root=process.cwd(),out=path.join(root,'public/dv15'),dataOut=path.join(root,'data/dv15');
const digest=(bytes)=>crypto.createHash('sha256').update(bytes).digest('hex');
const normalize=(value)=>value.normalize('NFKC').replace(/[‘’]/g,"'").replace(/[“”]/g,'"').toLocaleLowerCase('en-US').replace(/\s+/g,' ').trim();
const bucket=(value)=>digest(Buffer.from(value)).slice(0,2);
const mapped=new Set(['P36','P1376','P31','P279','P37','P1412','P19','P20','P551','P27','P159','P17','P131','P276','P61','P170','P50','P127','P361','P527','P509','P1196','P828']);
const allocations={
  basic:{'everyday-core':250,geography:120,'natural-science':100,'language-mappings':80},
  advanced:{'history-civics':118,computing:35,processes:25,'causal-explanations':2,'natural-science':15,'math-measurement':5},
};
const preferred={
  basic:['P106','P54','P364','P105','P171','P407','P1344','P58','P166','P155','P156','P102','P463','P47','P103','P421','P39','P282','P141','P607','P123','P26','P140','P176','P1346','P65','P179','P366','P150','P703','P495','P30','P21','P38','P206','P945','P937','P452','P53','P59'],
  advanced:['P400','P306','P277','P408','P1414','P101','P1056','P2554','P1889','P287','P355','P749','P1001','P1142','P1435','P1313','P1365','P1366','P1387','P710','P196','P272','P375','P1029','P2176','P2175','P2670','P479','P2868','P2348','P1027','P2321','P398','P397'],
};
const relationAliasOverrides={
  P106:['occupation','profession'],P54:['sports team','team'],P364:['original language','language'],P105:['taxon rank'],P171:['parent taxon'],P421:['time zone','timezone'],P150:['administrative divisions','administrative areas'],P495:['country of origin','origin country'],P400:['platform'],P306:['operating system','os'],P277:['programming language'],P408:['software engine','engine'],P1414:['gui toolkit','ui framework'],P102:['political party'],P39:['position held','office'],P463:['member of','membership'],P166:['award received','awards'],P47:['shares border with','bordering country'],P103:['native language'],P140:['religion'],P176:['manufacturer'],P1346:['winner'],P179:['series'],P366:['use','purpose'],P607:['conflict'],P123:['publisher'],P26:['spouse'],P282:['writing system'],P141:['conservation status'],P452:['industry'],P1435:['heritage designation'],P1142:['political ideology'],P1313:['head of government office'],P1365:['replaces','predecessor'],P1366:['replaced by','successor'],P1889:['different from'],P287:['designer','designed by'],P355:['subsidiary'],P749:['parent organization'],P1001:['jurisdiction'],P710:['participant'],P2554:['production designer'],P1056:['product'],P2176:['drug used for treatment'],P2175:['medical condition treated'],
};
const source=JSON.parse(zlib.gunzipSync(fs.readFileSync(path.join(root,'public/dv12/catalog.json.gz'))));
const candidates=new Map(),schemas=new Map(),seenFacts=new Set();
for(const category of new Set(Object.values(allocations).flatMap((tier)=>Object.keys(tier))))candidates.set(category,[]);
for(const [shard,descriptor] of Object.entries(source.world.sourceShards).sort(([a],[b])=>a.localeCompare(b))){
  const category=descriptor.domain??shard.split('/')[0];if(!candidates.has(category))continue;
  const pack=JSON.parse(zlib.gunzipSync(fs.readFileSync(path.join(root,'public',descriptor.path))));
  const localEntities=new Map((pack.entities??[]).map((entity)=>[entity.id,entity]));
  for(const schema of pack.schemas??[]){const raw=schema.id.match(/^wdt:(P\d+)$/)?.[1];if(raw&&!schemas.has(raw))schemas.set(raw,schema);}
  for(const proposition of pack.propositions??[]){
    const raw=proposition.id.match(/:(P\d+):/)?.[1]??proposition.relation.match(/P\d+/)?.[0];
    if(!raw||mapped.has(raw)||proposition.object?.kind!=='entity'||seenFacts.has(proposition.id)||Object.keys(proposition.qualifiers??{}).length)continue;
    const relation=(pack.schemas??[]).find((schema)=>schema.id===`wdt:${raw}`)??schemas.get(raw);
    const subject=localEntities.get(proposition.subjectId),object=localEntities.get(proposition.object.entityId);
    if(!relation?.label||!subject||!object||!proposition.provenance?.length)continue;
    if(!subject.canonicalName||!object.canonicalName||subject.canonicalName.length>512||object.canonicalName.length>512)continue;
    seenFacts.add(proposition.id);candidates.get(category).push({raw,relation,subject,object,proposition});
  }
}

const relationIds=new Map(),usedRelationIds=new Map();
for(const [raw,schema] of [...schemas].sort(([a],[b])=>a.localeCompare(b))){
  const base=normalize(schema.label).replace(/[^\p{L}\p{N}]+/gu,'_').replace(/^_+|_+$/g,'')||raw.toLowerCase();
  const previous=usedRelationIds.get(base),id=previous&&previous!==raw?`${base}_${raw.toLowerCase()}`:base;
  usedRelationIds.set(base,raw);relationIds.set(raw,id);
}
const relationRecord=(raw,schema)=>({
  id:relationIds.get(raw),aliases:[...new Set([...(relationAliasOverrides[raw]??[]).map(normalize),normalize(schema.label),normalize(schema.label).replace(/\s*\/\s*/g,' '),normalize(schema.label).replace(/^located in /,''),normalize(schema.label).replace(/ of (?:film|television|tv).*$/,'')])].filter(Boolean),
  domain:[],range:['entity'],temporal:schema.temporalBehavior==='versioned'?'changing':'stable',
  symmetric:!!schema.symmetric,transitive:!!schema.transitive,inherited:!!schema.inheritable,functional:!!schema.functional,world:schema.worldAssumption==='closed'?'closed':'open',
});
const entityRecord=(entity,category)=>({id:entity.id,name:entity.canonicalName,aliases:[...new Set((entity.aliases??[]).filter((alias)=>typeof alias==='string'&&alias&&alias.length<=512))].slice(0,24),type:entity.kind||'concept',domain:category});
const sourceRecord=(source,raw)=>({id:source.sourceId,location:source.sourceLocation,method:`${source.extractionMethod}; DV15 promoted source predicate ${raw}`,review:'source-attested',license:source.license??'CC0-1.0',snapshot:source.createdAt,confidence:source.confidence,createdAt:source.createdAt,disputeStatus:source.disputeStatus,disputed:source.disputeStatus!=='undisputed'});

fs.rmSync(out,{recursive:true,force:true});fs.mkdirSync(out,{recursive:true});fs.mkdirSync(dataOut,{recursive:true});
const write=(relative,value)=>{const decoded=Buffer.from(JSON.stringify(value)),compressed=zlib.gzipSync(decoded,{level:9}),file=path.join(out,relative);fs.mkdirSync(path.dirname(file),{recursive:true});fs.writeFileSync(file,compressed);return {path:'/dv15/'+relative,sha256:digest(compressed),sizeBytes:compressed.length,decodedSha256:digest(decoded),decodedSizeBytes:decoded.length};};
const packDescriptors={},packSummary=[],allEntityIds=new Set(),allRelations=new Set(),aliasIndex=new Map(),entityIndex=new Map(),relationIndex=new Map();
const add=(map,key,id)=>{if(!key)return;const values=map.get(key)??new Set();values.add(id);map.set(key,values);};
let basicIndex=0,advancedIndex=0,totalFacts=0;
for(const tier of ['basic','advanced'])for(const [category,count] of Object.entries(allocations[tier])){
  const ranking=new Map(preferred[tier].map((id,index)=>[id,index]));
  const groups=new Map();for(const candidate of candidates.get(category).filter((candidate)=>relationIds.has(candidate.raw))){const values=groups.get(candidate.raw)??[];values.push(candidate);groups.set(candidate.raw,values);}
  const orderedGroups=[...groups].sort(([a],[b])=>(ranking.get(a)??10000)-(ranking.get(b)??10000)||a.localeCompare(b));
  // The source is much larger than the bounded DV15 target. Prefer entities
  // with richer reviewed alias records so everyday, recognisable subjects are
  // not displaced merely because their labels sort late alphabetically.
  for(const [,values] of orderedGroups)values.sort((a,b)=>(b.subject.aliases?.length??0)-(a.subject.aliases?.length??0)||a.subject.canonicalName.length-b.subject.canonicalName.length||a.subject.canonicalName.localeCompare(b.subject.canonicalName)||a.proposition.id.localeCompare(b.proposition.id));
  const sizes=Array.from({length:count},(_,offset)=>tier==='basic'?150:advancedIndex+offset<100?188:187),required=sizes.reduce((sum,size)=>sum+size,0),cap=Math.ceil(required*.16),pool=[];
  for(const [,values] of orderedGroups){const take=Math.min(cap,values.length,required-pool.length);pool.push(...values.slice(0,take));if(pool.length===required)break;}
  if(pool.length<required)for(const [,values] of orderedGroups){const take=Math.min(Math.max(0,values.length-cap),required-pool.length);pool.push(...values.slice(cap,cap+take));if(pool.length===required)break;}
  let cursor=0;
  for(let categoryIndex=0;categoryIndex<count;categoryIndex++){
    const globalIndex=tier==='basic'?basicIndex++:advancedIndex++,size=sizes[categoryIndex];
    const rows=pool.slice(cursor,cursor+size);cursor+=size;
    if(rows.length!==size)throw new Error(`DV15_SOURCE_CAPACITY:${tier}:${category}:${rows.length}/${size}`);
    const serial=String(globalIndex+1).padStart(3,'0'),id=`alphaine.lexi.dv15.${tier}.${category}.${serial}`;
    const entityMap=new Map(),relationMap=new Map();
    for(const row of rows){entityMap.set(row.subject.id,entityRecord(row.subject,category));entityMap.set(row.object.id,entityRecord(row.object,category));relationMap.set(row.raw,relationRecord(row.raw,row.relation));}
    const entities=[...entityMap.values()].sort((a,b)=>a.id.localeCompare(b.id)),relations=[...relationMap.values()].sort((a,b)=>a.id.localeCompare(b.id));
    const facts=rows.map(({raw,proposition})=>{const sources=proposition.provenance.map((source)=>sourceRecord(source,raw));return {id:`dv15:${proposition.id}`,subject:proposition.subjectId,relation:relationIds.get(raw),object:{kind:'entity',id:proposition.object.entityId},negative:proposition.polarity==='negative'||undefined,source:sources[0],sources};});
    const pack={manifest:{id,version:'15.0.0',tier,category,runtime:{major:12,schema:2},sourceSnapshot:'2026-09-21',propositionCount:facts.length,entityCount:entities.length,relationCount:relations.length},relations,entities,facts};
    const relative=`packs/${tier}/${category}/${serial}.pack.json.gz`,meta=write(relative,pack);
    packDescriptors[id]={...meta,id,tier,category,propositions:facts.length,entities:entities.length,relations:relations.map((relation)=>relation.id)};
    packSummary.push({id,tier,category,propositions:facts.length,entities:entities.length,relations:relations.map((relation)=>relation.id),path:meta.path});
    totalFacts+=facts.length;
    for(const entity of entities){allEntityIds.add(entity.id);add(entityIndex,entity.id,id);for(const alias of [entity.name,...entity.aliases])add(aliasIndex,normalize(alias),id);}
    for(const relation of relations){allRelations.add(relation.id);for(const alias of [relation.id,...relation.aliases])add(relationIndex,normalize(alias),id);}
  }
}
if(basicIndex!==550||advancedIndex!==200||totalFacts!==120000)throw new Error(`DV15_TARGET_MISMATCH:${basicIndex}:${advancedIndex}:${totalFacts}`);
const writeBuckets=(name,map)=>{const grouped=Array.from({length:256},()=>new Map());for(const [key,values] of map)grouped[Number.parseInt(bucket(key),16)].set(key,[...values].sort());const shards={};for(let i=0;i<256;i++){const key=i.toString(16).padStart(2,'0');shards[key]=write(`indexes/${name}/${key}.json.gz`,Object.fromEntries([...grouped[i]].sort(([a],[b])=>a.localeCompare(b))));}return {strategy:'sha256-prefix',entries:map.size,shards};};
const catalog={version:15,build:'260921-DV15',generatedAt:'2026-09-21',counts:{basicPacks:550,advancedPacks:200,packs:750,propositions:totalFacts,entities:allEntityIds.size,relations:allRelations.size},budgets:{maxPacksPerRequest:6,maxDecodedBytesPerRequest:3*1024*1024,maxPropositionsPerRequest:1500},packs:packDescriptors,indexes:{alias:writeBuckets('alias',aliasIndex),entity:writeBuckets('entity',entityIndex),relation:write('indexes/relation.json.gz',Object.fromEntries([...relationIndex].sort(([a],[b])=>a.localeCompare(b)).map(([key,values])=>[key,[...values].sort()])) )}};
const catalogMeta=write('catalog.json.gz',catalog);
fs.writeFileSync(path.join(root,'worker/dv15-integrity.ts'),'// Generated by build-dv15-data-packs.mjs.\nexport const DV15_CATALOG = '+JSON.stringify(catalogMeta,null,2)+' as const;\n');
fs.writeFileSync(path.join(dataOut,'pack-manifest.json'),JSON.stringify({version:15,build:catalog.build,counts:catalog.counts,categoryPacks:allocations,packs:packSummary},null,2)+'\n');
console.log(JSON.stringify({counts:catalog.counts,categories:allocations,indexes:{aliases:aliasIndex.size,entities:entityIndex.size,relations:relationIndex.size},catalog:catalogMeta},null,2));
