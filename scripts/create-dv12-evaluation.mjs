import fs from 'node:fs';
import crypto from 'node:crypto';
const root='data/dv12/evaluation';
fs.mkdirSync(root,{recursive:true});
if(fs.existsSync(root+'/manifest.json'))throw new Error('Frozen dataset exists; add a new version, never overwrite.');
const rows=[];
function add(category,prompt,expected,turns){rows.push({id:'dv12-diagnostic-'+String(rows.length+1).padStart(4,'0'),category,prompt,answerable:true,expected,turns,provenance:{kind:'development-diagnostic',author:'Codex development audit',capturedAt:'2026-09-04'}});}
const number=n=>({values:[{kind:'number',value:n}]});
for(const [q,n] of [
 ['What is 2 plus 3 times 4?',14],['Calculate (2 + 3) * 4',20],['What is 1,000 plus 2,000?',3000],
 ['What is half of 30?',15],['What is 25 percent of 80?',20],['What is 10 minus 2 times 3?',4],
 ['Calculate -2^2',-4],['Calculate 2^3^2',512],['What is two hundred and one plus nineteen?',220],['Calculate 3.5 * 2',7]
])add('arithmetic',q,number(n));
for(const [q,v,u] of [['How many minutes are in 2 hours?',120,'minutes'],['Convert 100 celsius to fahrenheit',212,'fahrenheit'],['Convert 1 kilometer to meters',1000,'meters'],['Convert 10 pounds to kg',4.5359237,'kg']])add('quantities',q,{values:[{kind:'number',value:v,unit:u}],tolerance:1e-6});
for(const [q,v] of [['How many legs does a snake have?',0],['How many legs does a spider have?',8],['How many legs does a cat have?',4],['How many legs does a bird have?',2],['What is the atomic number of oxygen?',8],['What is the atomic number of carbon?',6],['What is the atomic number of hydrogen?',1]])add('ordinary-facts',q,number(v));
for(const [q,id] of [['What is the capital of France?','city-paris'],["What is Germany's capital?",'city-berlin'],['What is the capital of Japan?','city-tokyo'],['What is the capital of Italy?','city-rome'],['What is the capital of Spain?','city-madrid']])add('ordinary-facts',q,{values:[{kind:'entity',id}],relation:'capital'});
for(const [q,v] of [['Can penguins fly?',false],['Can penguins swim?',true],['Do spiders have six legs?',false],['Do spiders have eight legs?',true],['Can all birds fly?',false],['Is a penguin an animal?',true],['Is a cat a mammal?',true]])add('reasoning',q,{values:[{kind:'boolean',value:v}]});
for(const [q,expected] of [['Could you explain gravity?','Gravity is the attraction associated with mass and the curvature of spacetime.'],['What is a computer?','A computer is an electronic machine that stores and processes data according to instructions.'],['Hello','Hello. What would you like to explore?'],['Thank you','You’re welcome.']])add('language',q,{text:[expected]});
add('multi-part','What are the capitals of France and Germany?',{values:[{kind:'entity',id:'city-paris'},{kind:'entity',id:'city-berlin'}],relation:'capital'});
add('multi-part','My name is Mina. What is my name?',{values:[{kind:'text',value:'Mina'}]});
add('dialogue','What is my name?',{values:[{kind:'text',value:'Mina'}]},['My name is Mina']);
add('dialogue','Where do I live?',{values:[{kind:'text',value:'Seoul'}]},['My name is Mina and I live in Seoul']);
add('dialogue','Where am I from?',{values:[{kind:'text',value:'Paris'}]},['I am from Paris','I live in London']);
add('dialogue','What do I like?',{values:[{kind:'text',value:'tea'},{kind:'text',value:'coffee'}]},['I like tea','I like coffee']);
add('dialogue','What is my name?',{values:[{kind:'text',value:'Lena'}]},['My name is Mina','Actually, my name is Lena']);
add('ambiguity','What is a bank?',{clarification:['bank']});
add('reference','How many legs does it have?',number(8),['What is a spider?']);
add('reference','What about the latter?',{values:[{kind:'text',value:'the fourth planet from the Sun, a rocky world with a thin carbon-dioxide atmosphere'}]},['What is Earth? What is Mars?']);
// Answerable knowledge and mechanism gaps stay in the denominator.
for(const [category,prompt,answer] of [
 ['ordinary-facts','Where was Albert Einstein born?','Ulm'],['ordinary-facts','How many teeth does an adult human usually have?','32'],
 ['explanations','Why do we sleep?','Sleep supports health and memory.'],['explanations','Why do humans need water?','Water supports transport, temperature regulation, and chemical reactions.'],
 ['procedures','How do I boil an egg?','Put the egg in water, heat it, cook it, and cool it.'],['procedures','How do I reset a forgotten password?','Use the account recovery process.'],
 ['comparisons','What is the difference between weather and climate?','Weather is short-term; climate is long-term patterns.'],
 ['comparisons','Which is better for writing notes, a pen or pencil?','It depends on whether permanence or erasability matters.'],
 ['reasoning','If all cats are mammals and all mammals are animals, are all cats animals?','Yes.'],
 ['reasoning','If all cats are mammals, are all mammals cats?','That does not follow from the premise.'],
 ['language','What does the Context Module do?','It determines context from recorded examples.'],
 ['language','How is Lexi different from an LLM?','Lexi uses explicit deterministic rules rather than a generative neural language model.'],
 ['dialogue','I feel worried.','I’m sorry you’re feeling worried.'],
 ['ordinary-facts','What continent is Tokyo in?','Asia'],['ordinary-facts','What did Alexander Graham Bell invent?','telephone'],
 ])add(category,prompt,{text:[answer]});
const data=rows.map(r=>JSON.stringify(r)).join('\n')+'\n';
fs.writeFileSync(root+'/development.jsonl',data);fs.writeFileSync(root+'/independent.jsonl','');
const file=(path,bytes)=>({path,sha256:crypto.createHash('sha256').update(bytes).digest('hex')});
fs.writeFileSync(root+'/manifest.json',JSON.stringify({version:1,population:'Ordinary English development diagnostics across declared question families; not a representative random sample.',files:[file('development.jsonl',data),file('independent.jsonl','')]},null,2)+'\n');
console.log(rows.length+' frozen development diagnostics; 0 independent user failures.');
