import { handleDv12, prepareDv12Runtime } from '../../../../worker/dv12-handler';

export async function GET(request:Request){
  return prepareDv12Runtime({fetch:(input,init)=>fetch(input,init)},request.url);
}

export async function POST(request:Request){
  return handleDv12(request,{fetch:(input,init)=>fetch(input,init)});
}
