import { Store } from './store';
import type { Entity, Fact, Relation, Rule, LanguageFrame, DialogueFrame } from './types';
export type Package={manifest:{id:string;version:string;runtime:{major:12;schema:1};dependencies:Array<{id:string;range:string}>};entities:Entity[];relations:Relation[];facts:Fact[];rules:Rule[];language:LanguageFrame[];dialogue:DialogueFrame[]};
export type Descriptor={id:string;version:string;sha256:string;decodedBytes:number;load(signal?:AbortSignal):Promise<Uint8Array>};
function version(v:string){if(!/^\d+\.\d+\.\d+$/.test(v))throw new Error('INVALID_VERSION');return v.split('.').map(Number);}
export function satisfies(actual:string,range:string){
  const a=version(actual);
  if(range.startsWith('^')){const b=version(range.slice(1));return a[0]===b[0]&&(b[0]>0?(a[1]>b[1]||a[1]===b[1]&&a[2]>=b[2]):b[1]>0?a[1]===b[1]&&a[2]>=b[2]:a[1]===0&&a[2]===b[2]);}
  return actual===range;
}
/** Returns a new validated overlay atomically. Failed loads cannot mutate the old store. */
export class PackageRegistry{
  private descriptors=new Map<string,Descriptor>();
  constructor(private readonly base:Store){}
  register(d:Descriptor){if(!/^[a-f0-9]{64}$/.test(d.sha256)||d.decodedBytes>8*1024*1024||d.decodedBytes<2)throw new Error('INVALID_PACKAGE_DESCRIPTOR');version(d.version);this.descriptors.set(d.id,d);}
  remove(id:string){this.descriptors.delete(id);}
  async load(ids:string[],signal?:AbortSignal):Promise<Store>{
    const visiting=new Set<string>(),done=new Set<string>(),packs:Package[]=[];
    const visit=async(id:string,range?:string)=>{
      if(visiting.has(id))throw new Error('PACKAGE_DEPENDENCY_CYCLE');
      const d=this.descriptors.get(id);if(!d)throw new Error('MISSING_PACKAGE');
      if(range&&!satisfies(d.version,range))throw new Error('DEPENDENCY_VERSION_MISMATCH');
      if(done.has(id))return;if(done.size+visiting.size>=32)throw new Error('PACKAGE_COUNT_BUDGET');
      visiting.add(id);signal?.throwIfAborted();
      const bytes=await d.load(signal);signal?.throwIfAborted();
      const digest=[...new Uint8Array(await crypto.subtle.digest('SHA-256',bytes as BufferSource))].map(b=>b.toString(16).padStart(2,'0')).join('');
      if(bytes.byteLength!==d.decodedBytes||digest!==d.sha256)throw new Error('PACKAGE_HASH_MISMATCH');
      const pack=JSON.parse(new TextDecoder().decode(bytes)) as Package;
      if(pack.manifest?.runtime?.major!==12||pack.manifest.runtime.schema!==1||pack.manifest.id!==id||pack.manifest.version!==d.version)throw new Error('PACKAGE_COMPATIBILITY');
      for(const key of ['entities','relations','facts','rules','language','dialogue'] as const)if(!Array.isArray(pack[key]))throw new Error('PACKAGE_SCHEMA');
      if(!Array.isArray(pack.manifest.dependencies))throw new Error('PACKAGE_DEPENDENCIES');
      for(const dependency of pack.manifest.dependencies)await visit(dependency.id,dependency.range);
      visiting.delete(id);done.add(id);packs.push(pack);
    };
    for(const id of ids)await visit(id);
    const staged=new Store(this.base);
    for(const pack of packs){pack.relations.forEach(r=>staged.addSchema(r));pack.entities.forEach(e=>staged.addEntity(e));}
    for(const pack of packs){pack.facts.forEach(f=>staged.addFact(f));pack.rules.forEach(r=>staged.addRule(r));pack.language.forEach(f=>staged.addLanguageFrame(f));pack.dialogue.forEach(f=>staged.addDialogueFrame(f));}
    signal?.throwIfAborted();return staged;
  }
}
