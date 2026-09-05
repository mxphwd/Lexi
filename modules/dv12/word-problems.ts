import { numberWords } from './numbers';
import type { Plan, Proof } from './types';
type Inventory=Extract<Plan,{kind:'inventory'}>;
const name=(s:string)=>s.trim().toLowerCase();
/** Strict state-transition grammar. Unknown text cannot be silently skipped. */
export function parseInventory(input:string):Inventory|undefined{
  const statements=input.trim().replace(/[?!.]+$/,'').split(/[.;]\s*/);
  if(statements.length<2)return;
  const last=statements.pop()!,q=last.match(/^how many ([a-z -]+?) (?:does|do) ([a-z ]+?) have(?: (?:left|now))?$/i);
  if(!q)return;
  const steps:Inventory['steps']=[];
  for(const line of statements){
    let m:RegExpMatchArray|null;
    if((m=line.match(/^([a-z ]+?) (?:has|have|starts? with) (.+?) ([a-z-]+)$/i))){
      const value=numberWords(m[2]);if(value===undefined)return;
      steps.push({op:'set',owner:name(m[1]),item:name(m[3]),value});
    }else if((m=line.match(/^([a-z ]+?) gives? (.+?) ([a-z-]+) to ([a-z ]+)$/i))){
      const value=numberWords(m[2]);if(value===undefined)return;
      steps.push({op:'transfer',owner:name(m[1]),to:name(m[4]),item:name(m[3]),value});
    }else if((m=line.match(/^([a-z ]+?) (buys?|gets?|receives?|loses?|eats?|sells?) (.+?) ([a-z-]+)$/i))){
      const value=numberWords(m[3]);if(value===undefined)return;
      steps.push({op:/^(?:lose|eat|sell)/i.test(m[2])?'loss':'gain',owner:name(m[1]),item:name(m[4]),value});
    }else return;
  }
  return {kind:'inventory',steps,owner:name(q[2]),item:name(q[1])};
}
export function solveInventory(plan:Inventory):{value?:number;proof:Proof[];missing?:string}{
  const amounts=new Map<string,number>(),proof:Proof[]=[];
  const key=(owner:string,item:string)=>owner+'\0'+item;
  for(const [i,step] of plan.steps.entries()){
    if(step.value<0||!Number.isSafeInteger(step.value))throw new Error('INVALID_INVENTORY_QUANTITY');
    const id=key(step.owner,step.item),before=amounts.get(id);
    if(step.op!=='set'&&before===undefined)return {proof,missing:'Starting amount for '+step.owner+' ('+step.item+')'};
    const after=step.op==='set'?step.value:before!+(step.op==='gain'?step.value:-step.value);
    if(after<0)throw new Error('INCONSISTENT_INVENTORY');
    amounts.set(id,after);
    if(step.op==='transfer'&&step.to){
      const destination=key(step.to,step.item),known=amounts.get(destination);
      // Receiving three does not establish that someone now owns exactly three.
      if(known!==undefined)amounts.set(destination,known+step.value);
    }
    proof.push({id:'inventory:'+i,rule:'request-local-'+step.op,premises:i?['inventory:'+(i-1)]:[],bindings:{after:{kind:'number',value:after}},constraints:[step.owner,step.item,'user-provided assumption; not persistent world knowledge']});
  }
  const value=amounts.get(key(plan.owner,plan.item));
  return {value,proof,missing:value===undefined?'Starting amount for '+plan.owner+' ('+plan.item+')':undefined};
}
