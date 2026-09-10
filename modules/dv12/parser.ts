import { requestContent, compatibleAnswerNoun } from '../dv13/language';
import { expressionText, numberWords } from './numbers';
import { parseLogic } from './logic';
import { parseInventory } from './word-problems';
import { temporalSuffix } from './temporal';
import { compiledGrammar } from './grammar-plugins';
import { inertTerminalPunctuation } from './punctuation-fast-path';
import { periodTerminatesClause } from './sentence-boundaries';
import { normalize, type Store } from './store';
import { entity, variable, type Alternative, type Clause, type Plan, type Request, type Select, type State, type Term } from './types';

export function segment(input: string): Array<{text:string; start:number; end:number}> {
  const spans: Array<{text:string; start:number; end:number}> = [];
  let start = 0, depth = 0, quote = '';
  const emit = (end: number) => {
    const raw = input.slice(start,end), lead = raw.length - raw.trimStart().length;
    if (raw.trim()) spans.push({text:raw.trim(),start:start+lead,end:end-(raw.length-raw.trimEnd().length)});
    start=end;
  };
  for (let i=0;i<input.length;i++) {
    const c=input[i], prev=input[i-1]??'';
    if (c===quote || !quote&&(c==='"' || c==="'" && !/[\p{L}\p{N}]/u.test(prev))) {
      if (quote===c) quote=''; else if (!quote) quote=c;
    }
    if (quote) continue;
    if (c==='(') depth++; if (c===')') depth=Math.max(0,depth-1);
    if (depth) continue;
    if (/[!?;]/.test(c)) emit(i+1);
    else if (c==='.' && periodTerminatesClause(input,i,start)) emit(i+1);
    else {
      const connector = input.slice(i).match(/^\s+(?:and|but|then|while)\s+(?=(?:what|who|where|when|why|how|which|can|does|do|is|are|I|my|forget|explain|tell)\b)/i);
      if (connector) { emit(i); start=i+connector[0].length; i=start-1; }
    }
  }
  emit(input.length); if (spans.length>24) throw new Error('CLAUSE_BUDGET'); return spans;
}
export function mention(text: string, role: 'subject'|'object', store: Store, state: State): Term {
  const clean=text.trim().replace(/[?!.]+$/,'').replace(/^(?:the|an?) /i,''), n=normalize(clean);
  let id: string|undefined;
  if (['latter','second one'].includes(n)) id=state.topics[1];
  else if (['former','first one'].includes(n)) id=state.topics[0];
  else if (['it','its','that','this','he','she','him','her'].includes(n)) id=state.topics.length===1 ? state.topics[0] : undefined;
  else if (n==='there') id=state.answerEntities.length===1 ? state.answerEntities[0] : undefined;
  if (id) return entity(id);
  const domain=clean.match(/^(.+?) in (?:the )?(?:field of )?(finance|geography|computing|biology|chemistry|astronomy)$/i);
  const candidates=domain?store.resolve(domain[1]).filter(e=>e.domain===normalize(domain[2])):store.resolve(clean);
  if (candidates.length===1) return entity(candidates[0].id);
  return {kind:'mention',text:clean,role,candidates:candidates.map(e=>e.id)};
}
function query(subject: Term, relation: string, shape: Select['shape']='value', object: Term=variable('answer')): Select {
  return { kind:'query', atoms:[{subject,relation,object}], filters:[], answer:'answer', shape };
}
const properties: Record<string,string> = {
  capital:'capital', capitals:'capital', definition:'definition', meaning:'definition', purpose:'purpose', function:'purpose',
  cause:'cause', causes:'cause', effect:'effect', effects:'effect', mechanism:'mechanism', components:'component', parts:'has_part',
  examples:'example', example:'example', location:'location', habitat:'habitat', diet:'diet', color:'color', colour:'color',
  size:'size', diameter:'diameter', mass:'mass', weight:'mass', inventor:'inventor', creator:'creator', author:'author',
  birthplace:'birthplace', citizenship:'citizenship', headquarters:'headquarters', country:'country', continent:'continent',
  symbol:'symbol', 'atomic number':'atomic_number', 'boiling point':'boiling_point', 'melting point':'melting_point',
  lifespan:'lifespan', 'life span':'lifespan', 'official language':'official_language', language:'language',
  languages:'spoken_language', 'number of legs':'leg_count', 'leg count':'leg_count', requirements:'requires', steps:'steps',
  'orbital period':'orbit_period', 'rotation period':'rotation_period'
};
const verbs: Record<string,{relation:string; inverse?:boolean}> = {
  invent:{relation:'inventor',inverse:true}, invented:{relation:'inventor',inverse:true},
  create:{relation:'creator',inverse:true}, created:{relation:'creator',inverse:true},
  paint:{relation:'creator',inverse:true}, painted:{relation:'creator',inverse:true},
  write:{relation:'author',inverse:true}, wrote:{relation:'author',inverse:true}, written:{relation:'author',inverse:true},
  discover:{relation:'discoverer',inverse:true}, discovered:{relation:'discoverer',inverse:true},
  own:{relation:'owner',inverse:true}, owns:{relation:'owner',inverse:true},
  contain:{relation:'has_part'}, contains:{relation:'has_part'}, need:{relation:'requires'}, needs:{relation:'requires'},
  require:{relation:'requires'}, eat:{relation:'diet'}, eats:{relation:'diet'}
};
function property(name:string,store:Store): string|undefined {
  const n=normalize(name).replace(/^(?:the|a|an) /,'');
  if (properties[n]) return properties[n];
  const matches=store.allSchemas().filter(r=>r.aliases.includes(n));
  return matches.length===1 ? matches[0].id : undefined;
}
function grammar(text:string,store:Store,state:State): Alternative[] {
  let s=text.replace(/[?!.]+$/,'').trim().replace(/^actually[, ]+/i,'');
  s=requestContent(s);
  s=s.replace(/^what's\b/i,'what is').replace(/\bcan't\b/gi,'cannot').replace(/\bdon't\b/gi,'do not').replace(/\bdoesn't\b/gi,'does not');
  const n=normalize(s), results:Alternative[]=[];
  const add=(plan:Plan,grammar:string,score=1)=>results.push({plan,grammar,score});
  const subj=(t:string)=>mention(t,'subject',store,state), obj=(t:string)=>mention(t,'object',store,state);
  let m:RegExpMatchArray|null;
  results.push(...compiledGrammar(s,store,subj));
  if(s!==text.replace(/[?!.]+$/,'').trim())results.push(...compiledGrammar(text.replace(/[?!.]+$/,'').trim(),store,subj));
  const logic=parseLogic(s);if(logic)add(logic,'scoped-assumptions');
  if (/^(?:hello|hi|hey|good (?:morning|afternoon|evening))(?: lexi)?$/.test(n)) add({kind:'social',act:'greeting'},'social');
  if (/^(?:thanks|thank you)(?: lexi)?$/.test(n)) add({kind:'social',act:'thanks'},'social');
  if (/^(?:bye|goodbye|see you)$/.test(n)) add({kind:'social',act:'farewell'},'social');
  if (/^(?:who are you|what is lexi|what are you|what is your name)$/.test(n)) add({kind:'social',act:'identity'},'self');
  if (/^(?:how old are you|what is your age)$/.test(n)) add({kind:'social',act:'age'},'self');
  if (/^(?:help|what can you do)$/.test(n)) add({kind:'social',act:'help'},'help');
  if (/^i feel (?:worried|anxious|sad|upset|stressed)$/.test(n))add({kind:'social',act:'concern'},'social-emotion');
  if (/^(?:sorry|i am sorry|my apologies)$/.test(n))add({kind:'social',act:'apology'},'social-repair');
  if (/^(?:may i ask (?:another|a) question|can i ask you something)$/.test(n))add({kind:'social',act:'permission'},'social-turn');
  if (/^(?:forget everything|forget all|clear (?:my |the )?(?:memory|session))$/.test(n)) add({kind:'memory',action:'clear'},'memory');
  const captures: Array<[RegExp,string, 'set'|'add']> = [
    [/^(?:actually[, ]+)?my name is (.+)$/i,'name','set'],
    [/^(?:actually[, ]+)?(?:i live in|my residence is) (.+)$/i,'residence','set'],
    [/^(?:actually[, ]+)?i (?:am|'m) from (.+)$/i,'origin','set'],
    [/^(?:actually[, ]+)?i was born in (.+)$/i,'birthplace','set'],
    [/^(?:actually[, ]+)?i (?:am|'m) (\d+) years old$/i,'age','set'],
    [/^i like (.+)$/i,'likes','add'], [/^i (?:dislike|do not like) (.+)$/i,'dislikes','add'],
    [/^i prefer (.+)$/i,'preference','add']
  ];
  for (const [pattern,field,action] of captures) if ((m=s.match(pattern))) add({kind:'memory',action,field,value:m[1].trim()},'memory');
  const recall:Record<string,string>={'what is my name':'name','who am i':'name','where do i live':'residence','where am i from':'origin','where was i born':'birthplace','how old am i':'age','what do i like':'likes','what do i dislike':'dislikes','what do i prefer':'preference'};
  if(recall[n])add({kind:'memory',action:'recall',field:recall[n]},'memory');
  if((m=n.match(/^forget my (name|age|residence|origin|birthplace|preferences|likes|dislikes)$/)))add({kind:'memory',action:'delete',field:m[1]==='preferences'?'preference':m[1]},'memory');
  if((m=s.match(/^i meant (.+)$/i)) && state.previous?.results.length===1) {
    const p=state.previous.results[0].selectedPlan;
    if(p.kind==='memory' && p.field && ['set','add'].includes(p.action))add({kind:'memory',action:'set',field:p.field,value:m[1]},'targeted-correction');
  }
  const follow:Record<string,'proof'|'repeat'|'shorter'|'simpler'|'more'>={'why':'proof','why is that':'proof','explain that':'proof','what is your source':'proof','where did that come from':'proof','how do you know':'proof','why do you say that':'proof','show your proof':'proof','repeat':'repeat','say that again':'repeat','shorter':'shorter','simpler':'simpler','more':'more','continue':'more'};
  if(follow[n])add({kind:'followup',action:follow[n]},'dialogue');
  const exp=expressionText(s);
  if (/^[\d\s.+*/^()%,-]+$/.test(exp) && /\d/.test(exp)) add({kind:'calculate',expression:s},'arithmetic');
  if((m=s.match(/^(?:convert )?([+-]?[\d,.]+) (.+?) (?:to|in) (.+)$/i)))add({kind:'convert',value:Number(m[1].replaceAll(',','')),from:m[2],to:m[3]},'unit-conversion');
  if((m=s.match(/^how many (.+?) (?:are )?(?:in|make up) ([\d,.]+) (.+)$/i)))add({kind:'convert',value:Number(m[2].replaceAll(',','')),from:m[3],to:m[1]},'unit-conversion');
  if((m=s.match(/^(?:define|what does) (.+?)(?: mean)?$/i))) {
    add(query(subj(m[1]),'definition'),'explicit-world-definition',.96);
    add({kind:'lexical',term:m[1]},'explicit-definition',.9);
  }
  if((m=s.match(/^(?:(?:what|which)(?: (city|country|continent|person|place))? (?:is|are) |name )?(?:the )?(.+?) of (.+)$/i))) {
    const rel=property(m[2],store); if(rel && compatibleAnswerNoun(m[1],rel)) {
      const subjects=m[3].split(/\s+and\s+/i), terms=subjects.map(subj);
      if(subjects.length===1)add(query(terms[0],rel),'property-of',.98);
      else if(terms.every(t=>t.kind==='entity')){
        const q=query(variable('subject'),rel,'list');
        q.filters.push({left:variable('subject'),op:'member',right:{kind:'list',ordered:true,values:terms as Array<ReturnType<typeof entity>>}});
        q.limit=subjects.length; add(q,'coordinated-property',.98);
      }
    }
  }
  if((m=s.match(/^(?:what (?:is|are) |name )?(.+?)'s (.+)$/i))) {const rel=property(m[2],store);if(rel)add(query(subj(m[1]),rel),'possessive-property',.98);}
  if((m=s.match(/^what is (?:the )?(average|mean|sum|minimum|maximum) (.+?) of (.+)$/i))){
    const relation=property(m[2],store);
    if(relation){const q=query(variable('member'),'is_a','value',obj(m[3]));q.atoms.push({subject:variable('member'),relation,object:variable('measurement')});q.answer='measurement';q.aggregate={op:({average:'mean',mean:'mean',sum:'sum',minimum:'min',maximum:'max'} as const)[m[1].toLowerCase() as 'average'],variable:'measurement'};add(q,'aggregate-property',1);}
  }
  if((m=s.match(/^how many (.+?) (?:are there|are recorded)$/i))){
    const q=query(variable('answer'),'is_a','value',obj(m[1]));q.aggregate={op:'count',variable:'answer'};add(q,'count-members',1);
  }
  if((m=s.match(/^which (.+?) have (?:a |an )?(.+?) (greater than|less than|at least|at most|equal to) ([+-]?[\d.]+)(?: ([a-z/ ]+))?$/i))){
    const relation=property(m[2],store);
    if(relation){const q=query(variable('answer'),'is_a','list',obj(m[1]));q.atoms.push({subject:variable('answer'),relation,object:variable('measurement')});q.filters.push({left:variable('measurement'),op:({'greater than':'gt','less than':'lt','at least':'gte','at most':'lte','equal to':'eq'} as const)[m[3].toLowerCase() as 'greater than'],right:{kind:'number',value:Number(m[4]),unit:m[5]}});add(q,'filtered-class',1);}
  }
  if((m=s.match(/^how many legs (?:does|do) (.+?) have$/i)))add(query(subj(m[1]),'leg_count'),'specific-count');
  if((m=s.match(/^(?:does|do) (.+?) have (.+?) legs$/i))) {const count=numberWords(m[2]);if(count!==undefined)add(query(subj(m[1]),'leg_count','boolean',{kind:'number',value:count}),'verify-count');}
  if((m=s.match(/^(can|cannot) (.+?) (fly|swim|breathe underwater|breathe air|jump|bark|purr|climb|slither)$/i))) {
    let subject=m[2]; const qm=subject.match(/^(all|any|some|none|most) (.+)$/i);
    if(qm)subject=qm[2];
    const q=query(subj(subject),'ability','boolean',{kind:'boolean',value:normalize(m[1])==='can'});
    q.atoms[0].scope=normalize(m[3]);
    if(qm){q.atoms.unshift({subject:variable('member'),relation:'is_a',object:subj(subject)});q.atoms[1].subject=variable('member');q.quantifier={kind:qm[1]==='some'?'any':qm[1] as 'all'};}
    add(q,'ability');
  }
  if((m=s.match(/^where (?:was|were) (.+?) born$/i)))add(query(subj(m[1]),'birthplace'),'birth-event');
  if((m=s.match(/^where (?:is|are) (.+?)(?: located)?$/i)))add(query(subj(m[1]),'location'),'location',.93);
  if((m=s.match(/^where (?:does|do) (.+?) live$/i)))add(query(subj(m[1]),store.resolve(m[1]).some(e=>e.type==='person')?'residence':'habitat'),'habitat',.95);
  if((m=s.match(/^who (invented|created|painted|wrote|discovered|owns) (.+)$/i)))add(query(subj(m[2]),verbs[normalize(m[1])].relation),'agent-question',.99);
  if((m=s.match(/^by whom (?:was|were) (.+?) (invented|created|painted|written|discovered)$/i)))add(query(subj(m[1]),verbs[normalize(m[2])].relation),'passive-agent',.99);
  if((m=s.match(/^what (?:did|does|do) (.+?) (invent|create|paint|write|discover|own|contain|need|require|eat)$/i))) {
    const v=verbs[normalize(m[2])]; add(v.inverse?query(variable('answer'),v.relation,'list',obj(m[1])):query(subj(m[1]),v.relation,'list'),'active-object',.98);
  }
  if((m=s.match(/^what (?:is|are) (.+?) used for$/i)))add(query(subj(m[1]),'purpose'),'purpose',.98);
  if((m=s.match(/^what (?:does|do) (.+?) do$/i)))add(query(subj(m[1]),'purpose'),'subject-purpose',.99);
  if((m=s.match(/^what (country|continent) (?:is|are) (.+?) in$/i)))add(query(subj(m[2]),normalize(m[1])),'location-property',.99);
  if((m=s.match(/^how (?:does|do) (.+?) work$/i)))add(query(subj(m[1]),'mechanism','explanation'),'mechanism',.98);
  if((m=s.match(/^(?:how (?:do i|to)|explain how to) (.+)$/i)))add(query(subj(m[1]),'steps','procedure'),'procedure',.96);
  if((m=s.match(/^why (?:does|do|is|are) (.+)$/i))) {
    const process:Record<string,string>={'ice melt':'melting','ice melts':'melting','water freeze':'freezing','water freezes':'freezing','the sky blue':'blue sky','sky blue':'blue sky','we sleep':'sleep','we need sleep':'sleep'};
    add(query(subj(process[normalize(m[1])]??m[1]),'cause','explanation'),'causal',.95);
  }
  if((m=s.match(/^why (?:do|should) (?:we|people|humans) (sleep|eat|drink|breathe|exercise)$/i)))add(query(subj(m[1]),'purpose','explanation'),'human-function',.96);
  if((m=s.match(/^(?:explain|describe|what (?:is|are)) (.+)$/i)) && !/\b(?:not|without|largest|smallest|closest|before|after|current|today|if)\b/i.test(m[1])) {
    const term=m[1].replace(/^(?:a|an|the) /i,'');
    add(query(subj(term),'definition'),'concept-definition',.75);add({kind:'lexical',term},'lexical-definition',.55);
  }
  if((m=s.match(/^(?:is|are) (.+?) (?:a |an )?(.+)$/i))) {
    const a=subj(m[1]),b=obj(m[2]); if(a.kind==='entity'&&b.kind==='entity')add(query(a,'is_a','boolean',b),'classification',.96);
  }
  if((m=s.match(/^(?:is|are) (?:an? )?(.+?) (?:an? )(.+)$/i))) {
    const a=subj(m[1]),b=obj(m[2]); if(a.kind==='entity'&&b.kind==='entity')add(query(a,'is_a','boolean',b),'article-classification',.99);
  }
  if((m=s.match(/^(?:list|name|show|what are) (?:the )?(?:(.+?) )?(largest|smallest|closest|farthest) (.+)$/i))) {
    const count=m[1]?numberWords(m[1]):undefined;
    if(!m[1]||count!==undefined){
      const q=query(variable('answer'),'is_a','list',obj(m[3]));
      q.atoms.push({subject:variable('answer'),relation:/closest|farthest/i.test(m[2])?'average_distance':'diameter',object:variable('measure')});
      q.order={variable:'measure',direction:/smallest|closest/i.test(m[2])?1:-1};q.limit=count??10;add(q,'rank');
    }
  }
  if((m=s.match(/^what is (?:the )?(?:(first|second|third|fourth|fifth) )?(largest|smallest) (.+)$/i))) {
    const q=query(variable('answer'),'is_a','list',obj(m[3]));
    q.atoms.push({subject:variable('answer'),relation:'diameter',object:variable('measure')});
    q.order={variable:'measure',direction:normalize(m[2])==='smallest'?1:-1};
    q.offset=({first:0,second:1,third:2,fourth:3,fifth:4} as Record<string,number>)[m[1]??'first'];q.limit=1;add(q,'ordinal');
  }
  if((m=s.match(/^(?:how much (?:larger|bigger|smaller)|how many times (?:larger|bigger)|what is the size difference between) (?:is )?(.+?) (?:than|and) (.+)$/i)))add({kind:'compare',subjects:[subj(m[1]),subj(m[2])],relation:'diameter',mode:/how many times/i.test(s)?'ratio':'difference'},'comparison');
  if((m=s.match(/^(?:which is (?:bigger|larger|smaller)|compare) (.+?) (?:and|or|with) (.+)$/i)))add({kind:'compare',subjects:[subj(m[1]),subj(m[2])],relation:'diameter',mode:'qualitative'},'comparison');
  if(/^which (?:one )?is (?:bigger|larger|smaller)$/.test(n)&&state.topics.length===2)add({kind:'compare',subjects:state.topics.map(entity),relation:'diameter',mode:'qualitative'},'comparison-reference');
  if((m=s.match(/^(?:what about|how about|and) (.+)$/i))&&state.previous){
    const target=subj(m[1]);
    const candidates=state.previous.results.map(r=>r.selectedPlan).filter((p):p is Select=>p.kind==='query');
    const previous=candidates.find(p=>p.atoms[0]?.subject.kind==='entity'&&target.kind==='entity'&&p.atoms[0].subject.id===target.id)
      ?? (state.previous.results.length===1?candidates[0]:undefined);
    // Only one explicit subject can be replaced; joins and scoped questions need a full request.
    if(previous && previous.atoms.length===1 && previous.atoms[0].subject.kind==='entity'
      && !previous.atoms[0].from && !previous.atoms[0].to && !previous.atoms[0].scope
      && !previous.filters.length && !previous.quantifier && !previous.aggregate){
      const q=structuredClone(previous);q.atoms[0].subject=target;add(q,'ellipsis',.98);
    }
  }
  if((m=s.match(/^what (?:is|are) not (?:a |an )?(.+)$/i))) { const q=query(variable('answer'),'is_a','list',obj(m[1]));q.atoms[0].negative=true;add(q,'negative-classification'); }
  if((m=s.match(/^(?:is|are) (.+?) not (?:a |an )?(.+)$/i))){
    const q=query(subj(m[1]),'is_a','boolean',obj(m[2]));q.atoms[0].negative=true;add(q,'negative-verification',1);
  }
  if((m=s.match(/^which (.+?) (?:are|is) not (?:a |an )?(.+)$/i))){
    const q=query(variable('answer'),'is_a','list',obj(m[1]));
    q.atoms.push({subject:variable('answer'),relation:'is_a',object:obj(m[2]),negative:true});add(q,'restricted-negative-list',1);
  }
  if((m=s.match(/^(?:are|do) (all|any|some|none|most|exactly .+?|at least .+?|at most .+?) (.+?) (?:have (.+?) legs|(?:a |an )?(.+))$/i))){
    const qualifier=normalize(m[1]),count=qualifier.startsWith('exactly ')?numberWords(qualifier.slice(8)):qualifier.startsWith('at ')?numberWords(qualifier.split(' ').slice(2).join(' ')):undefined;
    const cardinal=/^(?:exactly|at least|at most)/.test(qualifier);
    if(!cardinal||count!==undefined){
      const q=query(variable('member'),'is_a','boolean',obj(m[2]));
      q.atoms.push({subject:variable('member'),relation:m[3]?'leg_count':'is_a',object:m[3]?{kind:'number',value:numberWords(m[3])??NaN}:obj(m[4])});
      q.quantifier={kind:qualifier==='some'?'any':qualifier.startsWith('exactly')?'exact':qualifier.startsWith('at least')?'minimum':qualifier.startsWith('at most')?'maximum':qualifier as 'all',count};
      if(!m[3]||numberWords(m[3])!==undefined)add(q,'quantified-restriction',1);
    }
  }
  if((m=s.match(/^(?:list|name) (.+)$/i)) && !/\b(?:largest|smallest|closest|farthest)\b/.test(m[1])) add(query(variable('answer'),'is_a','list',obj(m[1])),'class-members',.9);
  for(const candidate of results)if(candidate.plan.kind==='compare')candidate.plan.preference=/\bsmaller\b/i.test(s)?'lesser':'greater';
  return results.length?results.sort((a,b)=>b.score-a.score):[{plan:{kind:'unknown',reason:'I could not map this request to a supported relation or operation.'},grammar:'unrecognized',score:0}];
}
export function parseClause(text:string,start:number,id:string,store:Store,state:State):Clause {
  let content=requestContent(text);const style:Clause['style']={excludedWords:[]};
  const excluded=content.match(/\s+without using (?:the )?word ["']?([\p{L}-]+)["']?[.!?]*$/iu);
  if(excluded){style.excludedWords.push(normalize(excluded[1]));content=content.slice(0,excluded.index);}
  if(/\s+in one sentence[.!?]*$/i.test(content)){style.sentences=1;content=content.replace(/\s+in one sentence[.!?]*$/i,'');}
  if(/\s+(?:as|in) bullet points[.!?]*$/i.test(content)){style.bullets=true;content=content.replace(/\s+(?:as|in) bullet points[.!?]*$/i,'');}
  const time=temporalSuffix(content);
  if(time)content=time.text.replace(/^what was /i,'what is ').replace(/^what were /i,'what are ');
  const alternatives=grammar(content,store,state);
  if(time)for(const a of alternatives){
    if(a.plan.kind==='query'){
      const target=a.plan.atoms.at(-1)!;target.from=time.from;target.to=time.to;
    }else a.plan={kind:'unknown',reason:'Temporal scope is not supported for this operation.'};
  }
  return {id,text,start,end:start+text.length,alternatives,style};
}
export function parse(input:string,store:Store,state:State):Request {
  if(!input.trim())throw new Error('INVALID_EMPTY_REQUEST');
  if(input.length>12000 || (input.match(/\S+/g)?.length??0)>2048)throw new Error('INPUT_BUDGET');
  const inventory=parseInventory(input);
  if(inventory)return {version:12,original:input,clauses:[{id:'clause:1',text:input,start:0,end:input.length,style:{excludedWords:[]},alternatives:[{plan:inventory,grammar:'inventory-transitions',score:1}]}]};
  const normalizedQuotes=input.replace(/[‘’]/g,"'").replace(/[“”]/g,'"');
  const fast=inertTerminalPunctuation(normalizedQuotes);
  if(fast)return {version:12,original:input,fastPath:fast.kind,clauses:[parseClause(fast.text,fast.start,'clause:1',store,state)]};
  const spans=segment(normalizedQuotes);
  return {version:12,original:input,clauses:spans.map((span,i)=>parseClause(span.text,span.start,'clause:'+(i+1),store,state))};
}
