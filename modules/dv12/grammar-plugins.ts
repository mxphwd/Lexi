import { singleSubjectFrames } from '../extended-pack/question-frames';
import { semanticOpenQuestionTemplates, semanticComparisonQuestionTemplates } from '../semantic/frames';
import { normalize, type Store } from './store';
import type { Alternative, Term } from './types';
/** Reuse audited grammatical forms, never the old module's completed replies. */
const relationForFocus:Record<string,string>={definition:'definition',purpose:'purpose',mechanism:'mechanism',importance:'importance',example:'example',components:'component',related:'related_to'};
function escape(value:string){return value.replace(/[.*+?^$()|[\]{}\\]/g,'\\$&');}
const propertyFrames=semanticOpenQuestionTemplates.map(frame=>{
  const rendered=normalize(frame.render('lexisubject','lexiproperty')).replace(/[.!?]+$/,'');
  const names=[...rendered.matchAll(/lexisubject|lexiproperty/g)].map(m=>m[0]);
  const expression=new RegExp('^'+escape(rendered).replace(/lexisubject|lexiproperty/g,'(.+?)')+'$');
  return {id:frame.id,names,expression};
});
const comparisons=semanticComparisonQuestionTemplates.map(frame=>{
  const rendered=normalize(frame.render('lexileft','lexiright','lexiproperty')).replace(/[.!?]+$/,'');
  return {id:frame.id,expression:new RegExp('^'+escape(rendered).replace(/lexileft|lexiright|lexiproperty/g,'(.+?)')+'$')};
});
export function compiledGrammar(input:string,store:Store,resolve:(text:string)=>Term):Alternative[]{
  const text=normalize(input),out:Alternative[]=[];
  if(/\b(?:not|never|without|except|before|after|today|if|unless)\b/.test(text))return out;
  const dialogue=store.dialogueFrame(text);
  if(dialogue)out.push({grammar:'package-dialogue',score:1,plan:{kind:'followup',action:dialogue.action}});
  for(const frame of store.frames()){
    const expression=new RegExp('^'+escape(normalize(frame.template)).replace('\\{subject\\}','(.+?)')+'$');
    const m=text.match(expression);if(!m)continue;
    const subject=resolve(m[1]);
    out.push({grammar:'package-language:'+frame.id,score:.94,plan:{kind:'query',atoms:[{subject:frame.inverse?{kind:'variable',name:'answer'}:subject,relation:frame.relation,object:frame.inverse?subject:{kind:'variable',name:'answer'}}],filters:[],answer:'answer',shape:frame.inverse?'list':'value'}});
  }
  const relation=(name:string)=>store.allSchemas().find(r=>r.id===name.replaceAll(' ','_')||r.aliases.includes(name))?.id;
  for(const frame of propertyFrames){
    const m=text.match(frame.expression);if(!m)continue;
    const captures=Object.fromEntries(frame.names.map((name,i)=>[name,m[i+1]]));
    const subject=resolve(captures.lexisubject),predicate=relation(captures.lexiproperty);
    if(subject.kind!=='entity'||!predicate)continue;
    out.push({grammar:'typed-property:'+frame.id,score:.97,plan:{kind:'query',atoms:[{subject,relation:predicate,object:{kind:'variable',name:'answer'}}],filters:[],answer:'answer',shape:'value'}});
  }
  for(const frame of comparisons){
    const m=text.match(frame.expression);if(!m)continue;
    const left=resolve(m[1]),right=resolve(m[2]),predicate=relation(m[3]);
    if(left.kind!=='entity'||right.kind!=='entity'||!predicate)continue;
    out.push({grammar:'typed-comparison:'+frame.id,score:.98,plan:{kind:'compare',subjects:[left,right],relation:predicate,mode:'attributes'}});
  }
  for(const frame of singleSubjectFrames){
    const relation=relationForFocus[frame.focus];if(!relation)continue;
    const match=text.match(frame.pattern);if(!match)continue;
    const subject=resolve(match[1]);if(subject.kind!=='entity')continue;
    out.push({grammar:'compiled:'+frame.id,score:.93,plan:{kind:'query',atoms:[{subject,relation,object:{kind:'variable',name:'answer'}}],filters:[],answer:'answer',shape:frame.focus==='components'||frame.focus==='related'?'list':frame.focus==='mechanism'?'explanation':'value'}});
  }
  return out;
}
export const compiledGrammarCount=singleSubjectFrames.filter(f=>relationForFocus[f.focus]).length+propertyFrames.length+comparisons.length;
