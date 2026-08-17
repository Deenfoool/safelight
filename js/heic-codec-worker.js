/* Safelight HEIC worker. The codec is vendored at vendor/elheif/elheif-wasm.js. */
'use strict';

let moduleInstance=null;
let readyPromise=null;

function ensureCodec(){
  if(readyPromise)return readyPromise;
  readyPromise=new Promise((resolve,reject)=>{
    try{
      if(typeof globalThis.__init__ELHEIF_MODULE!=='function'){
        importScripts('../vendor/elheif/elheif-wasm.js');
      }
      if(typeof globalThis.__init__ELHEIF_MODULE!=='function'){
        reject(new Error('HEIC WASM bundle did not expose __init__ELHEIF_MODULE'));
        return;
      }
      const mod={
        print:()=>{},
        printErr:(...args)=>console.warn('[Safelight HEIC]',...args)
      };
      mod.onRuntimeInitialized=()=>{
        moduleInstance=mod;
        resolve(mod);
      };
      mod.onAbort=reason=>reject(new Error(String(reason||'HEIC WASM aborted')));
      globalThis.__init__ELHEIF_MODULE(mod);
    }catch(error){
      reject(error);
    }
  });
  return readyPromise;
}

self.addEventListener('message',async event=>{
  const message=event.data||{};
  const id=message.id;
  if(!id)return;
  try{
    const codec=await ensureCodec();
    if(message.op==='decode'){
      const input=new Uint8Array(message.buffer);
      const result=codec.jsDecodeImage(input);
      if(!result||result.err)throw new Error(result?.err||'HEIC decode failed');
      const image=result.data?.[0];
      if(!image||!image.width||!image.height||!image.data)throw new Error('HEIC contains no decodable image');
      const expected=image.width*image.height*4;
      if(image.data.length<expected)throw new Error('Decoded HEIC bitmap is incomplete');
      // Some elheif builds expose a larger backing array. Only return RGBA8888 pixels.
      const rgba=image.data.slice(0,expected);
      self.postMessage({id,ok:true,width:image.width,height:image.height,buffer:rgba.buffer},[rgba.buffer]);
      return;
    }
    if(message.op==='encode'){
      const rgba=new Uint8Array(message.buffer);
      const expected=message.width*message.height*4;
      if(rgba.length<expected)throw new Error('RGBA bitmap is incomplete');
      const result=codec.jsEncodeImage(rgba.subarray(0,expected),message.width,message.height);
      if(!result||result.err)throw new Error(result?.err||'HEIC encode failed');
      const bytes=result.data instanceof Uint8Array?result.data:new Uint8Array(result.data||0);
      if(!bytes.length)throw new Error('HEIC encoder returned an empty file');
      const output=bytes.slice();
      self.postMessage({id,ok:true,buffer:output.buffer},[output.buffer]);
      return;
    }
    throw new Error('Unknown HEIC worker operation');
  }catch(error){
    self.postMessage({id,ok:false,error:error?.message||String(error)});
  }
});
