import { join, valueText } from './executor';
import { type Store } from './store';
import type { Clause, Fact, Result } from './types';

const finish=(s:string)=>s ? s[0].toLocaleUpperCase('en-US')+s.slice(1).replace(/[.!?]+$/,'')+'.':'';
function factSentence(f:Fact,store:Store):string {
  const subject=store.entity(f.subject)?.name??f.subject, object=valueText(f.object,store);
  if(f.relation==='temperature'&&f.scope)return finish(subject+' has a recorded '+f.scope+' of '+object);
  const frames:Record<string,string>={
    definition:'is', is_a:'is', instance_of:'is an instance of', subclass_of:'is a subclass of',
    capital:'has the capital', country:'is in', continent:'is in', location:'is located in',
    habitat:'lives in', diet:'eats', purpose:'is used to', mechanism:'works through',
    author:'was written by', creator:'was created by', inventor:'was invented by', discoverer:'was discovered by',
    birthplace:'was born in', part_of:'is part of', has_part:'has', component:'has the components',
    cause:'has the recorded cause', effect:'has the recorded effect', requires:'requires'
  };
  if(f.relation==='ability'&&f.object.kind==='boolean')return finish(subject+' '+(f.object.value&&!f.negative?'can':'cannot')+' '+(f.scope??'perform the recorded action'));
  if(f.relation==='leg_count')return finish(subject+' has '+object+' legs'+(f.scope?' ('+f.scope+')':''));
  if(f.relation==='purpose'&&f.object.kind==='text'&&/^[a-z ]+ (?:helps?|supports?|allows?|provides?|is|are) /i.test(object))return finish(object);
  if(['author','inventor','creator','discoverer'].includes(f.relation)&&f.object.kind==='text'&&/\b(?:is|was|are|were)\b/.test(object))return finish(object);
  if(f.negative)return finish('The recorded evidence states that '+subject+' does not have '+f.relation.replaceAll('_',' ')+' '+object);
  if(['cause','mechanism','effect','definition'].includes(f.relation)&&f.object.kind==='text'&&/[.!?]$/.test(object))return finish(object);
  if(frames[f.relation])return finish(subject+' '+frames[f.relation]+' '+object);
  return finish('The '+f.relation.replaceAll('_',' ')+' of '+subject+' is '+object);
}
function qualifiedSentence(f:Fact,store:Store){
  const text=factSentence(f,store),qualifiers=[f.scope&&!['temperature','ability','leg_count'].includes(f.relation)?f.scope:'',f.from?'valid from '+f.from:'',f.to?'through '+f.to:''].filter(Boolean);
  return qualifiers.length?text.replace(/\.$/,'')+' ('+qualifiers.join('; ')+').':text;
}
export function realize(r:Result,clause:Clause,store:Store):Result {
  const p=r.selectedPlan;
  if(!r.text){
    if(r.status==='ambiguous')r.text=r.code==='CONFLICTING_FACTS'?'The recorded sources disagree on that property.':'Which meaning of '+join(r.missing??['that term'])+' do you mean?'+(r.choices?' '+r.choices.map((c,i)=>(i+1)+'. '+c.label).join(' '):'');
    else if(['error','canceled'].includes(r.status))r.text=r.status==='canceled'?'Request canceled.':'I could not complete this request ('+(r.code??'execution error')+').';
    else if(!r.values.length)r.text=r.code==='OPEN_UNIVERSE'?'I do not have a complete enough set of evidence to establish that claim.':r.missing?.length?'I could not identify '+join(r.missing)+' well enough to answer that request.':'I do not have evidence for the requested relation and constraints.';
    else if(p.kind==='calculate'||p.kind==='convert')r.text=valueText(r.values[0],store)+'.';
    else if(p.kind==='compare'){
      const names=p.subjects.map(t=>t.kind==='entity'?store.entity(t.id)?.name??t.id:'the subject');
      if(p.mode==='qualitative'){
        const v=r.values[0];const winner=v.kind==='text'&&v.value==='first'?names[0]:names[1];
        r.text=v.kind==='text'&&v.value==='equal'?'Their recorded measurements are equal.':finish(winner+' has the '+(p.preference==='lesser'?'smaller':'greater')+' recorded '+p.relation);
      }else r.text=finish('The '+(p.mode==='difference'?'difference':p.mode==='ratio'?'ratio':'percentage difference')+' in recorded '+p.relation+' is '+valueText(r.values[0],store));
    }else if(p.kind==='query'){
      if(p.shape==='boolean'){
        const v=r.values[0];r.text=v.kind==='boolean'&&v.value?'Yes.':'No.';
        const counter=r.facts.find(f=>f.negative||f.object.kind==='boolean'&&f.object.value===false)??r.facts[0];
        if(r.status==='contradicted'&&counter)r.text+=' '+qualifiedSentence(counter,store);
      }else if(p.aggregate)r.text=finish((r.status==='insufficient'?'Within the recorded subset, the ':'The ')+p.aggregate.op+' is '+valueText(r.values[0],store));
      else if(p.shape==='procedure'){
        const values=r.values.flatMap(v=>v.kind==='list'?v.values:[v]);r.text=values.map((v,i)=>(i+1)+'. '+finish(valueText(v,store))).join('\n');
      }else if(p.shape==='list'){
        r.text=(p.order?'Among the recorded measurements: ':'')+join(r.values.map(v=>valueText(v,store)))+'.';
        if(p.limit&&r.values.length<p.limit)r.text+=' I could establish '+r.values.length+' of the '+p.limit+' requested results.';
      }else{
        const target=p.atoms.at(-1)!;
        const selected=r.values.map(v=>r.facts.find(f=>f.relation===target.relation&&(target.subject.kind!=='entity'||f.subject===target.subject.id)&&JSON.stringify(f.object)===JSON.stringify(v))).filter((f):f is Fact=>!!f);
        r.text=selected.length?[...new Set(selected.map(f=>qualifiedSentence(f,store)))].join(' '):join(r.values.map(v=>valueText(v,store)))+'.';
      }
    }else r.text=join(r.values.map(v=>valueText(v,store)))+'.';
  }
  if(clause.style.excludedWords.some(word=>new RegExp('\\b'+word+'\\b','i').test(r.text))){
    r.status='insufficient';r.code='UNSATISFIED_WORD_RESTRICTION';
    r.text='I cannot yet restate the recorded explanation while meeting your wording restriction.';
    r.values=[];r.claims=[];return r;
  }
  if(clause.style.sentences===1)r.text=r.text.split(/(?<=[.!?])\s+/)[0];
  if(clause.style.bullets&&!/^\d+\./.test(r.text))r.text=r.text.split(/(?<=[.!?])\s+/).map(s=>'- '+s).join('\n');
  const factual=p.kind==='query'||p.kind==='compare'||p.kind==='lexical';
  if(factual&&['supported','contradicted','insufficient'].includes(r.status)&&r.values.length&&!r.facts.length){r.status='unknown';r.code='UNPROVEN_REALIZATION';r.text='I could not attach evidence to that answer.';}
  if(r.values.length||r.proof.length)r.claims=[{text:r.text,factIds:r.facts.map(f=>f.id),proofIds:r.proof.map(p=>p.id)}];
  return r;
}
