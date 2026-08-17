(function(){
'use strict';
if(window.safelightHeicSupportLoaded)return;
window.safelightHeicSupportLoaded=true;

const $=id=>document.getElementById(id);
const HEIC_MIMES=new Set(['image/heic','image/heif','image/heic-sequence','image/heif-sequence']);
const HEIC_ACCEPT='.heic,.heif,image/heic,image/heif';
const WORKER_URL='js/heic-codec-worker.js?v=1';
let worker=null;
let workerFailed=false;
let requestId=0;
const pending=new Map();
let redispatching=false;
let originalUiInfo=null;

function isHeicFile(file){
  if(!file)return false;
  const type=(file.type||'').toLowerCase();
  return HEIC_MIMES.has(type)||/\.(heic|heif)$/i.test(file.name||'');
}

function formatBytes(bytes){
  if(bytes<1024)return bytes+' B';
  if(bytes<1048576)return(bytes/1024).toFixed(1)+' KB';
  return(bytes/1048576).toFixed(2)+' MB';
}

function baseName(name){
  const value=name||'image';
  const i=value.lastIndexOf('.');
  return i>0?value.slice(0,i):value;
}

function setStatus(text){
  const status=$('v-status');
  if(status)status.textContent=text||'';
  const terminal=$('t-status');
  if(terminal&&text)terminal.textContent=text;
}

function ensureAccept(input){
  if(!input)return;
  const current=input.accept||'';
  const parts=current.split(',').map(x=>x.trim()).filter(Boolean);
  const seen=new Set(parts.map(x=>x.toLowerCase()));
  HEIC_ACCEPT.split(',').forEach(value=>{if(!seen.has(value))parts.push(value);});
  const next=parts.join(',');
  if(next!==current)input.accept=next;
}

function ensureHeicOption(){
  const format=$('v-format');
  if(!format)return;
  let option=format.querySelector('option[value="heic"]');
  if(!option){
    option=document.createElement('option');
    option.value='heic';
    format.appendChild(option);
  }
  option.textContent='HEIC (.heic)';
}

function createCodecWorker(){
  if(worker)return worker;
  if(workerFailed)throw new Error('local-codec-unavailable');
  try{
    worker=new Worker(WORKER_URL);
    worker.addEventListener('message',event=>{
      const msg=event.data||{};
      const task=pending.get(msg.id);
      if(!task)return;
      pending.delete(msg.id);
      clearTimeout(task.timer);
      if(msg.ok)task.resolve(msg);
      else task.reject(new Error(msg.error||'HEIC codec error'));
    });
    worker.addEventListener('error',event=>{
      workerFailed=true;
      const error=new Error(event?.message||'local-codec-unavailable');
      for(const task of pending.values()){
        clearTimeout(task.timer);
        task.reject(error);
      }
      pending.clear();
      try{worker.terminate();}catch(_){}
      worker=null;
    });
    return worker;
  }catch(error){
    workerFailed=true;
    throw error;
  }
}

function codecRequest(op,payload,transfer){
  return new Promise((resolve,reject)=>{
    let w;
    try{w=createCodecWorker();}catch(error){reject(error);return;}
    const id=++requestId;
    const timer=setTimeout(()=>{
      pending.delete(id);
      reject(new Error('HEIC codec timeout'));
    },120000);
    pending.set(id,{resolve,reject,timer});
    try{w.postMessage({id,op,...payload},transfer||[]);}
    catch(error){
      clearTimeout(timer);
      pending.delete(id);
      reject(error);
    }
  });
}

async function decodeHeicFile(file){
  const source=await file.arrayBuffer();
  const result=await codecRequest('decode',{buffer:source},[source]);
  const rgba=new Uint8ClampedArray(result.buffer);
  const imageData=new ImageData(rgba,result.width,result.height);
  const canvas=document.createElement('canvas');
  canvas.width=result.width;
  canvas.height=result.height;
  const ctx=canvas.getContext('2d',{alpha:true});
  ctx.putImageData(imageData,0,0);
  const blob=await new Promise((resolve,reject)=>{
    canvas.toBlob(value=>value?resolve(value):reject(new Error('PNG bridge failed')),'image/png');
  });
  return new File([blob],baseName(file.name)+'.png',{type:'image/png',lastModified:file.lastModified||Date.now()});
}

async function encodeCanvas(canvas){
  const ctx=canvas.getContext('2d',{willReadFrequently:true});
  const image=ctx.getImageData(0,0,canvas.width,canvas.height);
  const rgba=new Uint8Array(image.data);
  const buffer=rgba.buffer;
  const result=await codecRequest('encode',{buffer,width:canvas.width,height:canvas.height},[buffer]);
  return new Blob([result.buffer],{type:'image/heic'});
}

function restoreOriginalUiInfo(){
  if(!originalUiInfo)return;
  const info=originalUiInfo;
  const apply=()=>{
    if($('meta-name'))$('meta-name').textContent=info.name;
    if($('meta-size'))$('meta-size').textContent=formatBytes(info.size);
    if($('meta-type'))$('meta-type').textContent=info.type;
    if($('ro-size'))$('ro-size').textContent=formatBytes(info.size);
    if($('ro-format'))$('ro-format').textContent='HEIC';
    if($('t-name'))$('t-name').textContent=info.name;
    if($('t-name2'))$('t-name2').textContent=info.name;
  };
  apply();
  requestAnimationFrame(apply);
  setTimeout(apply,80);
  setTimeout(apply,300);
}

async function decodeFileList(files){
  const list=[...files];
  const firstHeic=list.find(isHeicFile);
  if(firstHeic){
    originalUiInfo={
      name:firstHeic.name||'image.heic',
      size:firstHeic.size||0,
      type:(firstHeic.type||'image/heic').replace(/^image\//i,'').toUpperCase()
    };
  }
  const converted=[];
  for(const file of list){
    if(!isHeicFile(file)){converted.push(file);continue;}
    setStatus('Декодирую HEIC локально через WASM…');
    converted.push(await decodeHeicFile(file));
  }
  return converted;
}

function assignFilesAndDispatch(input,files){
  if(typeof DataTransfer==='undefined')throw new Error('DataTransfer unavailable');
  const dt=new DataTransfer();
  files.forEach(file=>dt.items.add(file));
  redispatching=true;
  input.files=dt.files;
  input.dispatchEvent(new Event('change',{bubbles:true}));
  redispatching=false;
  restoreOriginalUiInfo();
}

function processHeicFiles(input,files,source){
  if(!files.some(isHeicFile))return false;
  document.body.dataset.safelightHeicInput='1';
  decodeFileList(files).then(decoded=>{
    assignFilesAndDispatch(input,decoded);
    setStatus('HEIC декодирован локально через WASM.');
  }).catch(error=>{
    setStatus('Не удалось открыть HEIC локальным WASM-кодеком.');
    console.warn('[Safelight HEIC '+source+']',error);
  }).finally(()=>{
    setTimeout(()=>delete document.body.dataset.safelightHeicInput,5000);
  });
  return true;
}

function prepareInput(){
  const input=$('fileInput');
  const dropzone=$('dropzone');
  const stage=$('stage');
  if(!input)return;
  ensureAccept(input);

  input.addEventListener('change',event=>{
    if(redispatching)return;
    const files=[...(event.target.files||[])];
    if(!files.some(isHeicFile))return;
    event.preventDefault();
    event.stopImmediatePropagation();
    processHeicFiles(input,files,'input');
  },true);

  if(dropzone){
    dropzone.addEventListener('drop',event=>{
      const files=[...(event.dataTransfer?.files||[])];
      if(!files.some(isHeicFile))return;
      event.preventDefault();
      event.stopImmediatePropagation();
      processHeicFiles(input,files,'dropzone');
    },true);
  }

  if(stage&&!stage.dataset.heicDropReady){
    stage.dataset.heicDropReady='1';
    stage.addEventListener('drop',event=>{
      const files=[...(event.dataTransfer?.files||[])];
      if(!files.some(isHeicFile))return;
      event.preventDefault();
      event.stopImmediatePropagation();
      processHeicFiles(input,files,'stage');
    },true);
  }
}

function boot(){
  if(!$('fileInput')||!$('v-format')){setTimeout(boot,60);return;}
  prepareInput();
  ensureHeicOption();
  const desc=$('panel-convert')?.querySelector('.desc');
  if(desc)desc.textContent='Конвертируйте PNG, JPEG, WebP, HEIC (.heic) и PDF локально в браузере.';
}

window.safelightHeicCodec=Object.freeze({
  isHeicFile,
  decodeFile:decodeHeicFile,
  encodeCanvas
});

boot();
})();