(function(){
'use strict';
if(window.safelightHeicSupportLoaded)return;
window.safelightHeicSupportLoaded=true;

const $=id=>document.getElementById(id);
const HEIC_MIMES=new Set(['image/heic','image/heif','image/heic-sequence','image/heif-sequence']);
const HEIC_ACCEPT='.heic,.heif,image/heic,image/heif';
const WORKER_URL='js/heic-codec-worker.js?v=1';
let heicBlob=null;
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

function download(blob,name){
  if(!blob)return;
  const url=URL.createObjectURL(blob);
  const a=document.createElement('a');
  a.href=url;
  a.download=name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(()=>URL.revokeObjectURL(url),4000);
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
  if(current.toLowerCase().includes('.heic'))return;
  input.accept=(current?current+',':'')+HEIC_ACCEPT;
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
  const name=baseName(file.name)+'.png';
  return new File([blob],name,{type:'image/png',lastModified:file.lastModified||Date.now()});
}

async function canvasToHeic(canvas){
  const ctx=canvas.getContext('2d',{willReadFrequently:true});
  const image=ctx.getImageData(0,0,canvas.width,canvas.height);
  // Copy because the worker takes ownership of the transferred ArrayBuffer.
  const rgba=new Uint8Array(image.data);
  const buffer=rgba.buffer;
  const result=await codecRequest('encode',{buffer,width:canvas.width,height:canvas.height},[buffer]);
  return new Blob([result.buffer],{type:'image/heic'});
}

function nativeCanvasToHeic(canvas,quality){
  return new Promise((resolve,reject)=>{
    canvas.toBlob(blob=>{
      if(!blob){reject(new Error('encode-failed'));return;}
      const type=(blob.type||'').toLowerCase();
      if(type!=='image/heic'&&type!=='image/heif'){
        reject(new Error('heic-unsupported'));
        return;
      }
      resolve(blob);
    },'image/heic',quality);
  });
}

async function encodeHeic(canvas,quality){
  try{return await canvasToHeic(canvas);}
  catch(wasmError){
    // Keep older browsers usable until/if the local vendor file is unavailable.
    try{return await nativeCanvasToHeic(canvas,quality);}
    catch(nativeError){
      nativeError.wasmError=wasmError;
      throw nativeError;
    }
  }
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

function prepareInput(){
  const input=$('fileInput');
  const dropzone=$('dropzone');
  if(!input)return;
  ensureAccept(input);

  new MutationObserver(()=>ensureAccept(input)).observe(input,{attributes:true,attributeFilter:['accept']});

  input.addEventListener('change',event=>{
    if(redispatching)return;
    const files=[...(event.target.files||[])];
    if(!files.some(isHeicFile))return;
    event.preventDefault();
    event.stopImmediatePropagation();
    document.body.dataset.safelightHeicInput='1';
    decodeFileList(files).then(decoded=>{
      assignFilesAndDispatch(input,decoded);
      setStatus('HEIC декодирован локально. Файл не отправлялся на сервер.');
    }).catch(error=>{
      // If the vendored WASM is not present yet, pass the original HEIC to the
      // existing browser decoder as a compatibility fallback.
      try{
        originalUiInfo=null;
        assignFilesAndDispatch(input,files);
        setStatus('Локальный HEIC-кодек недоступен; пробую системный декодер браузера.');
      }catch(_){
        setStatus('Не удалось открыть HEIC: локальный кодек недоступен.');
      }
      console.warn('[Safelight HEIC decode]',error);
    }).finally(()=>{
      setTimeout(()=>delete document.body.dataset.safelightHeicInput,5000);
    });
  },true);

  if(dropzone){
    dropzone.addEventListener('drop',event=>{
      const files=[...(event.dataTransfer?.files||[])];
      if(!files.some(isHeicFile))return;
      event.preventDefault();
      event.stopImmediatePropagation();
      document.body.dataset.safelightHeicInput='1';
      decodeFileList(files).then(decoded=>{
        assignFilesAndDispatch(input,decoded);
        setStatus('HEIC декодирован локально. Файл не отправлялся на сервер.');
      }).catch(error=>{
        try{
          originalUiInfo=null;
          assignFilesAndDispatch(input,files);
          setStatus('Локальный HEIC-кодек недоступен; пробую системный декодер браузера.');
        }catch(_){
          setStatus('Не удалось открыть HEIC: локальный кодек недоступен.');
        }
        console.warn('[Safelight HEIC drop]',error);
      }).finally(()=>{
        setTimeout(()=>delete document.body.dataset.safelightHeicInput,5000);
      });
    },true);
  }
}

function prepareConverter(){
  const format=$('v-format');
  const run=$('v-run');
  const downloadButton=$('v-download');
  const qualityRow=$('v-quality-row');
  if(!format||!run||!downloadButton)return;

  if(!format.querySelector('option[value="heic"]')){
    const option=document.createElement('option');
    option.value='heic';
    option.textContent='HEIC';
    format.appendChild(option);
  }

  const desc=$('panel-convert')?.querySelector('.desc');
  if(desc)desc.textContent='Конвертируйте PNG, JPEG, WebP и HEIC локально в браузере. HEIC обрабатывается локальным WASM-кодеком.';

  const syncFormatUi=()=>{
    heicBlob=null;
    if(qualityRow)qualityRow.style.display=format.value==='heic'?'none':'';
  };
  format.addEventListener('change',syncFormatUi);
  syncFormatUi();

  run.addEventListener('click',async event=>{
    if(format.value!=='heic')return;
    event.preventDefault();
    event.stopImmediatePropagation();

    const status=$('v-status');
    const preview=$('previewImg');
    const result=$('v-result');
    heicBlob=null;
    result?.classList.remove('show');

    if(!preview?.src||!preview.naturalWidth||!preview.naturalHeight){
      if(status)status.textContent='Сначала загрузите изображение.';
      return;
    }

    run.disabled=true;
    if(status)status.textContent='Кодирую настоящий HEIC локально через WASM…';

    try{
      const canvas=document.createElement('canvas');
      canvas.width=preview.naturalWidth;
      canvas.height=preview.naturalHeight;
      const ctx=canvas.getContext('2d');
      ctx.drawImage(preview,0,0,canvas.width,canvas.height);
      const quality=Math.max(0.01,Math.min(1,Number($('v-quality')?.value||92)/100));
      heicBlob=await encodeHeic(canvas,quality);

      const sourceName=$('meta-name')?.textContent||originalUiInfo?.name||'image';
      const sourceSizeText=$('meta-size')?.textContent||'—';
      const sourceType=($('meta-type')?.textContent||'').replace(/^image\//i,'').toUpperCase()||'IMAGE';
      if($('v-before'))$('v-before').textContent=sourceType+' · '+sourceSizeText;
      if($('v-after'))$('v-after').textContent='HEIC · '+formatBytes(heicBlob.size);
      result?.classList.add('show');
      if(status)status.textContent='Готово. Настоящий HEIC создан локально.';
      downloadButton.dataset.heicName=baseName(sourceName)+'-converted.heic';
    }catch(error){
      heicBlob=null;
      if(status){
        status.textContent=error?.message==='heic-unsupported'
          ?'Локальный WASM-кодек не найден, а браузер не умеет кодировать HEIC.'
          :'Не удалось создать HEIC локально.';
      }
      console.warn('[Safelight HEIC encode]',error?.wasmError||error);
    }finally{
      run.disabled=false;
    }
  },true);

  downloadButton.addEventListener('click',event=>{
    if(format.value!=='heic')return;
    event.preventDefault();
    event.stopImmediatePropagation();
    if(!heicBlob){
      if($('v-status'))$('v-status').textContent='Сначала выполните конвертацию в HEIC.';
      return;
    }
    download(heicBlob,downloadButton.dataset.heicName||'safelight-converted.heic');
  },true);
}

function boot(){
  if(!$('fileInput')||!$('v-format')){setTimeout(boot,60);return;}
  prepareInput();
  prepareConverter();
}

boot();
})();