/** Browser transport bounds bytes before JSON allocation, including chunked bodies. */
export async function responseJson(response:Response,signal:AbortSignal):Promise<unknown>{
  const reader=response.body?.getReader();if(!reader)throw new Error('The service returned an empty response.');
  const decoder=new TextDecoder();let text='',bytes=0;
  try{
    while(true){
      signal.throwIfAborted();const chunk=await reader.read();if(chunk.done)break;
      bytes+=chunk.value.byteLength;if(bytes>1024*1024)throw new Error('The response exceeded Lexi’s delivery budget.');
      text+=decoder.decode(chunk.value,{stream:true});
    }
    signal.throwIfAborted();text+=decoder.decode();return JSON.parse(text);
  }catch(error){await reader.cancel().catch(()=>{});throw error;}finally{reader.releaseLock();}
}
