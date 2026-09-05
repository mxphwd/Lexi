import type { Plan, Proof } from './types';
type LogicPlan=Extract<Plan,{kind:'logic'}>;
export function parseLogic(text:string):LogicPlan|undefined{
  const m=text.toLowerCase().match(/^if (.+), (?:then )?(?:are|is) (all|no) (.+?) (?:also )?(.+)$/);
  if(!m)return;
  const premises:LogicPlan['premises']=[];
  for(const clause of m[1].split(/\s+and\s+/)){
    const p=clause.match(/^(all|no) (.+?) are (.+)$/);if(!p)return;
    premises.push({subject:p[2].trim(),relation:p[1]==='all'?'subset':'disjoint',object:p[3].trim()});
  }
  // Choose the conclusion boundary from premise symbols, not first/last word guesses.
  const symbols=[...new Set(premises.flatMap(p=>[p.subject,p.object]))].sort((a,b)=>b.length-a.length);
  const target=(m[3]+' '+m[4]).replace(/[?.!]+$/,'');
  for(const subject of symbols)for(const object of symbols)if(target===subject+' '+object){
    return {kind:'logic',premises,conclusion:{subject,relation:m[2]==='all'?'subset':'disjoint',object}};
  }
}
export function solveLogic(plan:LogicPlan):{entailed:boolean;proof:Proof[]}{
  if(plan.premises.length>64)throw new Error('LOGIC_PREMISE_BUDGET');
  const paths=new Map<string,{subject:string;relation:'subset'|'disjoint';object:string;premises:string[]}>();
  const key=(s:string,r:string,o:string)=>JSON.stringify([s,r,o]);
  plan.premises.forEach((p,i)=>paths.set(key(p.subject,p.relation,p.object),{...p,premises:['assumption:'+i]}));
  let changed=true,round=0;
  while(changed&&round++<16){
    changed=false;const current=[...paths.values()];
    for(const a of current)for(const b of current){
      if(a.relation!=='subset'||a.object!==b.subject)continue;
      const id=key(a.subject,b.relation,b.object);if(paths.has(id))continue;
      if(paths.size>=2048)throw new Error('LOGIC_BINDING_BUDGET');
      paths.set(id,{subject:a.subject,relation:b.relation,object:b.object,premises:[...new Set([...a.premises,...b.premises])]});changed=true;
    }
    for(const a of current)if(a.relation==='disjoint'){
      const id=key(a.object,'disjoint',a.subject);if(!paths.has(id)){paths.set(id,{subject:a.object,relation:'disjoint',object:a.subject,premises:a.premises});changed=true;}
    }
  }
  const p=plan.conclusion,found=paths.get(key(p.subject,p.relation,p.object));
  if(changed)throw new Error('LOGIC_CLOSURE_BUDGET');
  return {entailed:!!found,proof:[{id:'logic:conclusion',rule:found?'universal-set-inference':'deductive-nonentailment',premises:found?.premises??plan.premises.map((_,i)=>'assumption:'+i),bindings:{subject:{kind:'text',value:p.subject},object:{kind:'text',value:p.object}},constraints:['request-local assumptions; no existential import',found?'derived from premises':'not in complete bounded closure; opposite not asserted']}]};
}
