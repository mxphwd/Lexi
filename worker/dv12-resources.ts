import { result } from '../modules/dv12/executor';
import { sourceMappings } from '../modules/dv12/schema';
import { normalize, type Store } from '../modules/dv12/store';
import type { ResourceLoader } from '../modules/dv12/runtime';
import type { Atom, Fact, ImportedKnowledgePackage, Plan, Term, Value } from '../modules/dv12/types';
import { assetJson, hash, type AssetFetcher, type Metadata } from './dv12-assets';
import { DV12_CATALOG } from './dv12-integrity';
import { PackageRegistry } from '../modules/dv12/packages';
import { retrievalFrontier } from '../modules/dv12/executor';
import { canonicalIdentity } from '../modules/dv12/identity';
import { validateImportedKnowledgePackage } from '../modules/dv12/runtime-validation';
import { semanticAnalysis } from '../modules/dv12/semantic-parser';
type Reference=readonly [string,string];
type CompositeIndex={shards:Record<string,Metadata>};
type Catalog={version:12;world:{sourceShards:Record<string,Metadata&{packageId:string}>;indexes:{alias:{shards:Record<string,Metadata>};subject:{shards:Record<string,Metadata>};object:{shards:Record<string,Metadata>};predicate:Metadata;subjectPredicate?:CompositeIndex;predicateObject?:CompositeIndex;entityType?:CompositeIndex}};lexical:{indexes:{alias:{shards:Record<string,Metadata>}};packages:Array<{sourceShards:Array<Metadata&{shard:string}>}>}};
type Alias=readonly [string,string,string,number];
type NormalizedDescriptor=Metadata&{id:string;version:string;templates:string[];utterances:string[];decodedSha256:string;decodedSizeBytes:number};
async function bucket(s:string){return (await hash(new TextEncoder().encode(s))).slice(0,2);}
function atoms(plan:Plan):Atom[]{return plan.kind==='query'?plan.atoms:plan.kind==='compare'?plan.subjects.map(subject=>({subject,relation:plan.relation,object:{kind:'variable',name:'answer'}})):[];}
const discoveryStop=new Set(['what','which','who','where','when','why','how','is','are','was','were','be','the','a','an','of','in','on','at','to','for','from','with','and','or','but','please','tell','give','show','me','my','your','its']);
function discoveryPhrases(text:string){
  const words=normalize(text).replace(/[^\p{L}\p{N}'-]+/gu,' ').split(/\s+/).filter(Boolean);
  const phrases:string[]=[];
  for(let width=Math.min(5,words.length);width>=1;width--)for(let i=0;i+width<=words.length;i++){
    const phrase=words.slice(i,i+width).join(' ');if(width===1&&discoveryStop.has(phrase))continue;
    phrases.push(phrase);if(phrases.length>=32)return phrases;
  }
  return phrases;
}
function migrate(untrusted:ImportedKnowledgePackage,store:Store){
  const pack=validateImportedKnowledgePackage(untrusted);
  const identity=(id:string)=>canonicalIdentity(id,store);
  if(pack.manifest.schemaVersion!==1||!['DV11','DV12'].includes(pack.manifest.minimumRuntime))throw new Error('PACKAGE_VERSION');
  if(pack.manifest.dependencies.length)throw new Error('UNRESOLVED_PACKAGE_DEPENDENCY');
  // Each overlay is disposable. Duplicate facts must be byte-equivalent, not silently overwritten.
  for(const e of pack.entities)if(!store.entity(identity(e.id)))store.addEntity({id:e.id,name:e.canonicalName,aliases:e.aliases,type:e.kind});
  for(const p of pack.propositions){
    if(!p.provenance[0]?.sourceLocation||!p.provenance[0]?.license)throw new Error('SOURCE_LOCATION_OR_LICENSE_MISSING');
    const raw=p.id.match(/:(P\d+):/)?.[1];if(!raw)throw new Error('SOURCE_PREDICATE_MISSING');
    // An unmapped source predicate must not collide with a similarly named
    // legacy relation whose type or meaning differs.
    const mapping=sourceMappings[raw];if(!mapping)continue;
    const relation=mapping.relation;
    if(p.object.kind!=='entity')throw new Error('AD1_VALUE_SCHEMA');
    const subject=identity(mapping?.reverse?p.object.entityId:p.subjectId),object:Value={kind:'entity',id:identity(mapping?.reverse?p.subjectId:p.object.entityId)};
    if(!store.schema(relation))store.addSchema({id:relation,aliases:[p.relation.replaceAll('_',' ')],domain:[],range:['entity'],world:'open'});
    const sources=p.provenance.map(source=>({id:source.sourceId,location:source.sourceLocation,license:source.license??'source-factual-data',method:source.extractionMethod+'; source-predicate '+raw+'; mapping 14.0.0',review:'source-attested' as const,confidence:source.confidence,createdAt:source.createdAt,disputeStatus:source.disputeStatus,disputed:source.disputeStatus!=='undisputed'}));
    const f:Fact={id:p.id+':dv12',subject,relation,object,negative:p.polarity==='negative',source:sources[0],sources,};
    // AD1 has no claim-validity dates. Import dates are deliberately not currentness evidence.
    const previous=store.fact(f.id);if(previous){if(JSON.stringify(previous)!==JSON.stringify(f))throw new Error('PACKAGE_FACT_CONFLICT');}else store.addFact(f);
  }
}
export function resourceLoader(assets:AssetFetcher,origin:string):ResourceLoader{
  const loaded=new Set<string>(),normalizedLoaded=new Set<string>();let totalCandidates=0,loadedBytes=0;
  let activeStore:Store|undefined;
  return async need=>{
    if(activeStore!==need.store){activeStore=need.store;loaded.clear();normalizedLoaded.clear();totalCandidates=0;loadedBytes=0;}
    const c=await assetJson<Catalog&{normalized?:NormalizedDescriptor[]}>(assets,origin,DV12_CATALOG,need.signal);
    if(c.version!==12)throw new Error('CATALOG_VERSION');
    const input=normalize(need.text).replace(/[.!?]+$/,'');
    const selectedPacks=(c.normalized??[]).filter(d=>!normalizedLoaded.has(d.id)&&(d.utterances.some(s=>normalize(s)===input)||d.templates.some(template=>{
      const [prefix,suffix]=normalize(template).split('{subject}');return input.startsWith(prefix)&&input.endsWith(suffix??'')&&input.length>prefix.length+(suffix?.length??0);
    })));
    if(selectedPacks.length){
      const registry=new PackageRegistry(need.store);
      for(const d of c.normalized??[])registry.register({id:d.id,version:d.version,sha256:d.decodedSha256,decodedBytes:d.decodedSizeBytes,load:async signal=>new TextEncoder().encode(JSON.stringify(await assetJson(assets,origin,d,signal)))});
      const store=await registry.load(selectedPacks.map(d=>d.id),need.signal);
      activeStore=store;selectedPacks.forEach(d=>normalizedLoaded.add(d.id));return {store};
    }
    if(need.plan.kind==='lexical'){
      const term=normalize(need.plan.term),m=c.lexical.indexes.alias.shards[/^[a-z0-9]/.test(term)?term[0]:'_'];
      const r=result(need.plan);if(!m)return {result:r};
      const index=await assetJson<Record<string,[string,string[],string,string]>>(assets,origin,m,need.signal),record=index[term];if(!record)return {result:r};
      const source=c.lexical.packages[0].sourceShards.find(x=>x.shard===record[3]);if(!source)throw new Error('LEXICAL_SHARD_MISSING');
      type Entry={e:string;w:string;m:Array<[string,string,string,string|null]>};
      const shard=await assetJson<Record<string,Entry>>(assets,origin,source,need.signal),entry=shard[term];
      if(!entry||!Array.isArray(entry.m))throw new Error('LEXICAL_SCHEMA');
      if(entry.m.length>1&&!need.plan.senseId){
        r.status='ambiguous';r.text='Which meaning of '+entry.w+' do you mean? '+entry.m.slice(0,4).map((m,i)=>(i+1)+'. '+m[2]).join(' ');
        r.choices=entry.m.slice(0,4).map(m=>({id:m[0],label:m[2]}));
        r.missing=['word sense'];return {result:r};
      }
      const meaning=need.plan.senseId?entry.m.find(m=>m[0]===(need.plan as Extract<Plan,{kind:'lexical'}>).senseId):entry.m[0];if(!meaning)return {result:r};
      r.status='supported';r.values=[{kind:'text',value:meaning[2]}];
      r.facts=[{id:meaning[0],subject:'lexical:'+entry.e,relation:'lexical_definition',object:r.values[0],source:{id:'wordset',location:source.path+'#'+meaning[0],method:'source lexical sense',review:'source-attested',license:'CC-BY-SA-4.0'}}];
      r.proof=[{id:'lexical:'+meaning[0],rule:'sense-definition',premises:[meaning[0]],bindings:{answer:r.values[0]},constraints:['lexical store; not a world entity']}];
      r.text=entry.w+': '+meaning[2]+'.';return {result:r};
    }
    const requested=[...atoms(need.plan),...retrievalFrontier(need.plan,need.store)],subjects=new Set<string>(),objects=new Set<string>(),wanted=new Set(requested.map(a=>a.relation));
    const resolve=async(t:Term,target:Set<string>)=>{
      if(t.kind==='variable')return;
      const alias=t.kind==='mention'?normalize(t.text):t.kind==='entity'?normalize(need.store.entity(t.id)?.name??''):'';
      if(t.kind==='entity'&&t.id.startsWith('wd:'))target.add(t.id);
      if(!alias)return;
      const meta=c.world.indexes.alias.shards[await bucket(alias)];
      if(!meta)return;
      const index=await assetJson<Record<string,Alias[]>>(assets,origin,meta,need.signal);
      // Preserve competing identities; popularity is not an identity proof.
      const candidates=index[alias]??[];
      if(candidates.length>12)throw new Error('ENTITY_AMBIGUITY_BUDGET');
      for(const match of candidates)target.add(match[0]);
    };
    for(const a of requested){await resolve(a.subject,subjects);await resolve(a.object,objects);}
    // Candidate discovery is bounded to syntactic/noun-like spans and merely
    // loads symbols. It never authorizes an answer without a recompiled plan.
    if(!requested.length||need.plan.kind==='unknown'){
      const analysis=semanticAnalysis(need.text,need.store);
      const phrases=[...new Set([...analysis.phrases.map(p=>normalize(p.text)),...discoveryPhrases(need.text)])];
      for(const phrase of phrases){
        const meta=c.world.indexes.alias.shards[await bucket(phrase)];if(!meta)continue;
        const index=await assetJson<Record<string,Alias[]>>(assets,origin,meta,need.signal);
        for(const match of (index[phrase]??[]).slice(0,8))subjects.add(match[0]);
      }
      for(const relation of need.store.allSchemas())if(relation.aliases.some(alias=>phrases.includes(alias))||phrases.includes(relation.id.replaceAll('_',' ')))wanted.add(relation.id);
    }
    const references=new Set<string>();
    const refs=async(ids:Set<string>,kind:'subject'|'object')=>{
      for(const id of ids){
        const meta=c.world.indexes[kind].shards[await bucket(id)];if(!meta)continue;
        const index=await assetJson<Record<string,Reference[]>>(assets,origin,meta,need.signal);
        for(const [,key] of index[id]??[])references.add(key);
      }
    };
    await refs(subjects,'subject');await refs(objects,'object');
    // Inverse execution needs the opposite index as well.
    await refs(subjects,'object');await refs(objects,'subject');
    const predicates=await assetJson<Record<string,{shards:string[]}>>(assets,origin,c.world.indexes.predicate,need.signal);
    const relationKeys=new Set([...wanted,...Object.entries(sourceMappings).filter(([,v])=>wanted.has(v.relation)).map(([p])=>'wdt:'+p)]);
    const predicateShards=new Set([...relationKeys].flatMap(r=>predicates[r]?.shards??[]));
    const compositeRefs=new Set<string>();
    if(c.world.indexes.subjectPredicate)for(const id of subjects){
      const meta=c.world.indexes.subjectPredicate.shards[await bucket(id)];if(!meta)continue;
      const index=await assetJson<Record<string,string[]>>(assets,origin,meta,need.signal);
      for(const relation of relationKeys)for(const shard of index[id+'\0'+relation]??[])compositeRefs.add(shard);
    }
    if(c.world.indexes.predicateObject)for(const id of objects){
      const meta=c.world.indexes.predicateObject.shards[await bucket(id)];if(!meta)continue;
      const index=await assetJson<Record<string,string[]>>(assets,origin,meta,need.signal);
      for(const relation of relationKeys)for(const shard of index[relation+'\0'+id]??[])compositeRefs.add(shard);
    }
    if(compositeRefs.size){references.clear();compositeRefs.forEach(key=>references.add(key));}
    let candidates=[...references].filter(key=>!predicateShards.size||predicateShards.has(key));
    if(!references.size&&!subjects.size&&!objects.size&&requested.every(a=>a.subject.kind==='variable'&&a.object.kind==='variable'))candidates=[...predicateShards];
    const compatibility=(key:string)=>Number(references.has(key))*4+Number(predicateShards.has(key))*8;
    candidates.sort((a,b)=>compatibility(b)-compatibility(a)||(c.world.sourceShards[a]?.decodedSizeBytes??c.world.sourceShards[a]?.sizeBytes??0)-(c.world.sourceShards[b]?.decodedSizeBytes??c.world.sourceShards[b]?.sizeBytes??0)||a.localeCompare(b));totalCandidates=Math.max(totalCandidates,candidates.length);
    const remaining=candidates.filter(key=>!loaded.has(key));
    const maxPages=32,maxBytes=8*1024*1024;const selected:string[]=[];let selectedBytes=0;
    for(const key of remaining){
      const meta=c.world.sourceShards[key];if(!meta)continue;
      const bytes=meta.decodedSizeBytes??meta.sizeBytes;
      if(loaded.size+selected.length>=maxPages||loadedBytes+selectedBytes+bytes>maxBytes)continue;
      selected.push(key);selectedBytes+=bytes;
    }
    for(const key of selected){
      const meta=c.world.sourceShards[key];if(!meta)throw new Error('PACKAGE_INDEX_INTEGRITY');
      const pack=await assetJson<ImportedKnowledgePackage>(assets,origin,meta,need.signal);
      migrate(pack,need.store);loaded.add(key);loadedBytes+=meta.decodedSizeBytes??meta.sizeBytes;
    }
    const missing=remaining.filter(key=>!selected.includes(key));
    return {coverage:{candidateShards:totalCandidates,loadedShards:loaded.size,excludedShards:missing.length,complete:missing.length===0,missing,loadedIds:[...loaded],candidateBytes:candidates.reduce((sum,key)=>sum+(c.world.sourceShards[key]?.decodedSizeBytes??c.world.sourceShards[key]?.sizeBytes??0),0),loadedBytes,unresolvedFrontiers:requested.filter(atom=>atom.subject.kind==='variable'||atom.object.kind==='variable').map(atom=>atom.relation),missingIndexes:!references.size&&subjects.size?['composite subject-predicate index']:[],truncationReason:missing.length?(loaded.size>=maxPages?'page-budget':loadedBytes>=maxBytes?'decoded-byte-budget':'compatibility-budget'):undefined}};
  };
}
