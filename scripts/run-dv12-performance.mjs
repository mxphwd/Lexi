import fs from 'node:fs/promises';
import {spawnSync} from 'node:child_process';
const percentile=(values,p)=>[...values].sort((a,b)=>a-b)[Math.max(0,Math.ceil(values.length*p)-1)]??null;
const stats=values=>({samples:values.length,p50:percentile(values,.5),p95:percentile(values,.95),p99:percentile(values,.99)});
if(process.argv.includes('--child')){
  const start=performance.now();
  const {Session}=await import('../modules/dv12/runtime.ts');
  const s=new Session();s.respond('What is the capital of France?');
  console.log(JSON.stringify({milliseconds:performance.now()-start,peakRssKiB:process.resourceUsage().maxRSS}));
}else{
  const cold=[];
  for(let i=0;i<8;i++){
    const child=spawnSync(process.execPath,['--import','tsx',new URL(import.meta.url).pathname,'--child'],{encoding:'utf8',timeout:20000});
    if(child.status!==0)throw new Error(child.stderr||'COLD_START_FAILED');
    cold.push(JSON.parse(child.stdout.trim()));
  }
  const {Session}=await import('../modules/dv12/runtime.ts');
  const {resourceLoader}=await import('../worker/dv12-resources.ts');
  const {assetCacheStats}=await import('../worker/dv12-assets.ts');
  const assets={async fetch(request){try{return new Response(await fs.readFile(new URL('../public'+new URL(request.url).pathname,import.meta.url)));}catch{return new Response('missing',{status:404});}}};
  const questions={factual:'What is the capital of France?',arithmetic:'Calculate (2+3)*4',ranking:'List the three largest planets',multiClause:'What is gravity? What is photosynthesis? How many legs does a snake have?',package:'Where was Lydia Dean Pilcher born?',lexical:'Define quiescence',dialogue:'My name is Mina. What is my name?'},routes={};
  for(const [route,prompt] of Object.entries(questions)){
    const times=[];
    for(let i=0;i<20;i++){const start=performance.now();await new Session().prepareAsync(prompt,resourceLoader(assets,'http://lexi.local'));times.push(performance.now()-start);}
    routes[route]=stats(times);
  }
  const long=new Session(),longStart=performance.now();
  for(let i=0;i<300;i++)long.respond('My name is Person '+i);
  const snapshot=long.snapshot(),peakRssKiB=Math.max(process.resourceUsage().maxRSS,...cold.map(x=>x.peakRssKiB));
  const report={environment:{node:process.version,platform:process.platform,architecture:process.arch},method:'Local Node process with real file-backed packages; not browser or production-network latency. Cold timers include imports and first index construction. maxRSS is OS high-water memory, not before/after snapshots. Eight cold samples do not establish a stable tail estimate.',cold:stats(cold.map(c=>c.milliseconds)),routes,longSession:{turns:300,milliseconds:performance.now()-longStart,retainedTurns:snapshot.history.length,retainedMemories:snapshot.memories.length,nextTurn:snapshot.nextTurn},peakRssKiB,cache:assetCacheStats(),passed:Object.values(routes).every(r=>r.p95<2000)&&peakRssKiB<512*1024&&snapshot.history.length<=32};
  await fs.writeFile(new URL('../docs/dv12/performance.json',import.meta.url),JSON.stringify(report,null,2)+'\n');
  console.log(JSON.stringify(report,null,2));if(!report.passed)process.exitCode=1;
}
