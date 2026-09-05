import { handleDv12 } from '../../../../worker/dv12-handler';
export async function POST(request:Request){
  return handleDv12(request,{fetch:(input,init)=>fetch(input,init)});
}
