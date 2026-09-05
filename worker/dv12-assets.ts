export type AssetFetcher={fetch(input:RequestInfo|URL,init?:RequestInit):Promise<Response>};
export type Metadata={path:string;sha256:string;sizeBytes:number;decodedSha256?:string;decodedSizeBytes?:number};
const cache=new Map<string,{value:unknown;bytes:number}>();
const cacheLimit=12*1024*1024;
let cacheBytes=0;
export async function hash(bytes:Uint8Array){return [...new Uint8Array(await crypto.subtle.digest('SHA-256',bytes as BufferSource))].map(x=>x.toString(16).padStart(2,'0')).join('');}
export async function readBounded(stream:ReadableStream<Uint8Array>|null,limit:number,signal?:AbortSignal):Promise<Uint8Array>{
  if(!stream)throw new Error('MISSING_BODY');
  const reader=stream.getReader(),chunks:Uint8Array[]=[];let size=0;
  const abort=()=>{void reader.cancel(signal?.reason);};
  signal?.addEventListener('abort',abort,{once:true});
  try{
    while(true){
      if(signal?.aborted)throw new DOMException('Canceled','AbortError');
      const {done,value}=await reader.read();if(done)break;
      size+=value.length;if(size>limit)throw new Error('BODY_BUDGET');chunks.push(value);
    }
    if(signal?.aborted)throw new DOMException('Canceled','AbortError');
    const out=new Uint8Array(size);let offset=0;for(const b of chunks){out.set(b,offset);offset+=b.length;}return out;
  }catch(e){await reader.cancel().catch(()=>{});throw e;}finally{signal?.removeEventListener('abort',abort);reader.releaseLock();}
}
export async function assetJson<T>(assets:AssetFetcher,origin:string,m:Metadata,signal?:AbortSignal):Promise<T>{
  if(!/^[a-f0-9]{64}$/.test(m.sha256)||!m.path.startsWith('/dv'))throw new Error('UNTRUSTED_ASSET_METADATA');
  const key=m.sha256+':'+m.path,cached=cache.get(key);
  if(cached){cache.delete(key);cache.set(key,cached);return cached.value as T;}
  const timeout=AbortSignal.timeout(8000),combined=signal?AbortSignal.any([signal,timeout]):timeout;
  const response=await assets.fetch(new Request(new URL(m.path,origin),{signal:combined}));
  if(!response.ok)throw new Error('ASSET_HTTP_'+response.status);
  const bytes=await readBounded(response.body,Math.max(m.sizeBytes,m.decodedSizeBytes??0)+1,combined);
  const gzip=bytes[0]===31&&bytes[1]===139,digest=await hash(bytes);
  if(!(digest===m.sha256&&bytes.length===m.sizeBytes)&&!(digest===m.decodedSha256&&bytes.length===m.decodedSizeBytes))throw new Error('ASSET_HASH_MISMATCH');
  const decoded=gzip?await readBounded(new Blob([bytes as BlobPart]).stream().pipeThrough(new DecompressionStream('gzip')),m.decodedSizeBytes??16*1024*1024,combined):bytes;
  if(m.decodedSha256&&await hash(decoded)!==m.decodedSha256)throw new Error('DECODED_HASH_MISMATCH');
  const value:unknown=JSON.parse(new TextDecoder().decode(decoded));
  const retained=decoded.byteLength*3;
  if(retained<cacheLimit){
    while(cacheBytes+retained>cacheLimit&&cache.size){const first=cache.keys().next().value!;cacheBytes-=cache.get(first)!.bytes;cache.delete(first);}
    cache.set(key,{value,bytes:retained});cacheBytes+=retained;
  }
  return value as T;
}
export function assetCacheStats(){return {entries:cache.size,estimatedRetainedBytes:cacheBytes,budgetBytes:cacheLimit};}
