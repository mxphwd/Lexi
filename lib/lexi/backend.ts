declare const __LEXI_STATIC_BUILD__: boolean;
declare const __LEXI_CONFIGURED_BACKEND__: string;
export function backendEndpoint(){
  const override=typeof window==='undefined'?undefined:(window as Window&{LEXI_BACKEND_URL?:string}).LEXI_BACKEND_URL;
  if(override)return override;
  if(typeof __LEXI_STATIC_BUILD__!=='undefined'&&__LEXI_STATIC_BUILD__){
    if(typeof __LEXI_CONFIGURED_BACKEND__!=='undefined'&&__LEXI_CONFIGURED_BACKEND__)return __LEXI_CONFIGURED_BACKEND__;
    throw new Error('This GitHub Pages preview needs a configured Lexi backend. Server-based answers are unavailable here.');
  }
  return '/api/lexi/respond';
}
