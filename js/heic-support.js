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
let inputEpoch=0;
let redispatching=false;
const pending=new Map();

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
  const parts=current.split(',').map(value=>value.trim()).filter(Boolean);
  const seen=new Set(parts.map(value=>value.toLowerCase()));
  HEIC_ACCEPT.split(',').forEach(value=>{if(!seen.has(value))parts.push(value)});
  const next=parts.join(',');
  if(next!==current)input.accept=next;
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
      try{worker.terminate()}catch(_){}
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
    let activeWorker;
    try{activeWorker=createCodecWorker()}catch(error){reject(error);return}
    const id=++requestId;
    const timer=setTimeout(()=>{
      pending.delete(id);
      reject(new Error('HEIC codec timeout'));
    },120000);
    pending.set(id,{resolve,reject,timer});
    try{activeWorker.postMessage({id,op,...payload},transfer||[])}catch(error){
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
  canvas.getContext('2d',{alpha:true}).putImageData(imageData,0,0);
  const blob=await new Promise((resolve,reject)=>canvas.toBlob(value=>value?resolve(value):reject(new Error('PNG bridge failed')),'image/png'));
  return new File([blob],baseName(file.name)+'.png',{type:'image/png',lastModified:file.lastModified||Date.now()});
}

async function encodeCanvas(canvas){
  const image=canvas.getContext('2d',{willReadFrequently:true}).getImageData(0,0,canvas.width,canvas.height);
  const rgba=new Uint8Array(image.data);
  const buffer=rgba.buffer;
  const result=await codecRequest('encode',{buffer,width:canvas.width,height:canvas.height},[buffer]);
  return new Blob([result.buffer],{type:'image/heic'});
}

function originalInfo(files){
  const first=[...files].find(isHeicFile);
  if(!first)return null;
  return{
    name:first.name||'image.heic',
    size:first.size||0,
    type:(first.type||'image/heic').replace(/^image\//i,'').toUpperCase()
  };
}

function restoreOriginalUiInfo(info,epoch){
  if(!info||epoch!==inputEpoch)return;
  const apply=()=>{
    if(epoch!==inputEpoch)return;
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

async function decodeFileList(files,epoch){
  const converted=[];
  for(const file of files){
    if(epoch!==inputEpoch)return null;
    if(!isHeicFile(file)){converted.push(file);continue}
    setStatus('Декодирую HEIC локально через WASM…');
    const decoded=await decodeHeicFile(file);
    if(epoch!==inputEpoch)return null;
    converted.push(decoded);
  }
  return converted;
}

function assignFilesAndDispatch(input,files,info,epoch){
  if(epoch!==inputEpoch)return false;
  if(typeof DataTransfer==='undefined')throw new Error('DataTransfer unavailable');
  const transfer=new DataTransfer();
  files.forEach(file=>transfer.items.add(file));
  redispatching=true;
  try{
    input.files=transfer.files;
    input.dispatchEvent(new Event('change',{bubbles:true}));
  }finally{
    redispatching=false;
  }
  if(epoch!==inputEpoch)return false;
  restoreOriginalUiInfo(info,epoch);
  return true;
}

function processHeicFiles(input,files,source,epoch){
  if(!files.some(isHeicFile))return false;
  const info=originalInfo(files);
  document.body.dataset.safelightHeicInput='1';
  decodeFileList(files,epoch).then(decoded=>{
    if(!decoded||epoch!==inputEpoch)return;
    if(assignFilesAndDispatch(input,decoded,info,epoch))setStatus('HEIC декодирован локально через WASM.');
  }).catch(error=>{
    if(epoch!==inputEpoch)return;
    setStatus('Не удалось открыть HEIC локальным WASM-кодеком.');
    console.warn('[Safelight HEIC '+source+']',error);
  }).finally(()=>{
    if(epoch!==inputEpoch)return;
    setTimeout(()=>{if(epoch===inputEpoch)delete document.body.dataset.safelightHeicInput},5000);
  });
  return true;
}

function beginSourceIntent(){
  const epoch=++inputEpoch;
  window.dispatchEvent(new CustomEvent('safelight:source-intent',{detail:{epoch}}));
  return epoch;
}

function prepareInput(){
  const input=$('fileInput');
  const dropzone=$('dropzone');
  const stage=$('stage');
  if(!input)return;
  ensureAccept(input);

  input.addEventListener('change',event=>{
    if(redispatching)return;
    const epoch=beginSourceIntent();
    const files=[...(event.target.files||[])];
    if(!files.some(isHeicFile)){
      delete document.body.dataset.safelightHeicInput;
      return;
    }
    event.preventDefault();
    event.stopImmediatePropagation();
    processHeicFiles(input,files,'input',epoch);
  },true);

  dropzone?.addEventListener('drop',event=>{
    const epoch=beginSourceIntent();
    const files=[...(event.dataTransfer?.files||[])];
    if(!files.some(isHeicFile)){
      delete document.body.dataset.safelightHeicInput;
      return;
    }
    event.preventDefault();
    event.stopImmediatePropagation();
    processHeicFiles(input,files,'dropzone',epoch);
  },true);

  if(stage&&!stage.dataset.heicDropReady){
    stage.dataset.heicDropReady='1';
    stage.addEventListener('drop',event=>{
      const epoch=beginSourceIntent();
      const files=[...(event.dataTransfer?.files||[])];
      if(!files.some(isHeicFile)){
        delete document.body.dataset.safelightHeicInput;
        return;
      }
      event.preventDefault();
      event.stopImmediatePropagation();
      processHeicFiles(input,files,'stage',epoch);
    },true);
  }
}

function currentTool(){
  const panel=document.querySelector('#sl-inspector-panels .panel.active')||document.querySelector('.panel.active');
  return panel?panel.id.replace('panel-',''):'';
}

function downloadBlob(blob,filename){
  const url=URL.createObjectURL(blob);
  const anchor=document.createElement('a');
  anchor.href=url;
  anchor.download=filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  setTimeout(()=>URL.revokeObjectURL(url),4000);
}

function showExportHint(text){
  const hint=$('sl-export-hint');
  if(!hint)return;
  hint.textContent=text;
  hint.classList.add('show');
  clearTimeout(showExportHint.timer);
  showExportHint.timer=setTimeout(()=>hint.classList.remove('show'),3000);
}

function currentBaseName(){
  return baseName(($('meta-name')?.textContent||'safelight').trim())||'safelight';
}

async function imageElementCanvas(image){
  if(!image?.src)throw new Error('Сначала загрузите изображение');
  if(!image.complete||!image.naturalWidth){
    await new Promise((resolve,reject)=>{
      image.addEventListener('load',resolve,{once:true});
      image.addEventListener('error',reject,{once:true});
    });
  }
  const canvas=document.createElement('canvas');
  canvas.width=image.naturalWidth;
  canvas.height=image.naturalHeight;
  canvas.getContext('2d').drawImage(image,0,0);
  return canvas;
}

async function currentResultCanvas(){
  const live=$('sl-live-canvas');
  if(live&&live.width&&live.height&&getComputedStyle(live).display!=='none'){
    const canvas=document.createElement('canvas');
    canvas.width=live.width;
    canvas.height=live.height;
    canvas.getContext('2d').drawImage(live,0,0);
    return canvas;
  }
  return imageElementCanvas($('previewImg'));
}

function heicMenuButton(value,label,meta){
  const button=document.createElement('button');
  button.className='sl-export-option';
  button.type='button';
  button.dataset.export=value;
  button.innerHTML='<span>'+label+'</span><span>'+meta+'</span>';
  return button;
}

function insertHeicOption(menu,value,label,meta){
  if(!menu||menu.querySelector('[data-export="'+value+'"]'))return;
  const button=heicMenuButton(value,label,meta);
  const separator=menu.querySelector('.sl-export-sep');
  if(separator)menu.insertBefore(button,separator);
  else menu.appendChild(button);
}

function patchExportMenu(){
  const menu=document.querySelector('.sl-export-menu');
  if(!menu)return;
  const tool=currentTool();
  if(!tool)return;
  if(tool==='slice')insertHeicOption(menu,'slice-heic','Нарезка HEIC','ZIP');
  else if(tool==='batch')insertHeicOption(menu,'batch-heic','Все в HEIC','ZIP');
  else if(tool==='palette')insertHeicOption(menu,'palette-heic','Карточка палитры HEIC','HEVC');
  else insertHeicOption(menu,'heic','HEIC','HEVC');
}

function watchExportMenu(){
  const attach=()=>{
    const menu=document.querySelector('.sl-export-menu');
    if(!menu){setTimeout(attach,80);return}
    if(menu.dataset.heicWatch==='1')return;
    menu.dataset.heicWatch='1';
    new MutationObserver(()=>patchExportMenu()).observe(menu,{childList:true,subtree:false});
    patchExportMenu();
  };
  attach();
  document.addEventListener('click',event=>{
    if(event.target.closest('#sl-export'))setTimeout(patchExportMenu,0);
  },true);
  window.addEventListener('safelight:toolchange',()=>setTimeout(patchExportMenu,0));
}

function sliceBoundaries(){
  if(typeof window.safelightDirectState?.sliceBoundaries==='function')return window.safelightDirectState.sliceBoundaries();
  let rows=Math.max(1,Math.min(20,Number($('s-rows')?.value)||1));
  let cols=Math.max(1,Math.min(20,Number($('s-cols')?.value)||1));
  if(window.sliceMode==='horizontal')cols=1;
  if(window.sliceMode==='vertical')rows=1;
  return{
    x:Array.from({length:cols+1},(_,index)=>index/cols),
    y:Array.from({length:rows+1},(_,index)=>index/rows)
  };
}

async function exportSliceHeic(){
  if(!window.JSZip)throw new Error('Локальный ZIP-модуль не загрузился');
  const source=await imageElementCanvas($('previewImg'));
  const boundaries=sliceBoundaries();
  const zip=new JSZip();
  for(let row=0;row<boundaries.y.length-1;row++){
    for(let col=0;col<boundaries.x.length-1;col++){
      const x0=Math.round(boundaries.x[col]*source.width),x1=Math.round(boundaries.x[col+1]*source.width);
      const y0=Math.round(boundaries.y[row]*source.height),y1=Math.round(boundaries.y[row+1]*source.height);
      const tile=document.createElement('canvas');
      tile.width=Math.max(1,x1-x0);
      tile.height=Math.max(1,y1-y0);
      tile.getContext('2d').drawImage(source,x0,y0,tile.width,tile.height,0,0,tile.width,tile.height);
      zip.file(currentBaseName()+'-'+(row+1)+'-'+(col+1)+'.heic',await encodeCanvas(tile));
    }
  }
  downloadBlob(await zip.generateAsync({type:'blob'}),currentBaseName()+'-tiles-heic.zip');
}

async function fileToCanvas(file,maxWidth){
  let source=file;
  if(isHeicFile(file))source=await decodeHeicFile(file);
  const bitmap=await createImageBitmap(source);
  const scale=maxWidth&&bitmap.width>maxWidth?maxWidth/bitmap.width:1;
  const canvas=document.createElement('canvas');
  canvas.width=Math.max(1,Math.round(bitmap.width*scale));
  canvas.height=Math.max(1,Math.round(bitmap.height*scale));
  canvas.getContext('2d').drawImage(bitmap,0,0,canvas.width,canvas.height);
  bitmap.close?.();
  return canvas;
}

async function exportBatchHeic(){
  if(!window.JSZip)throw new Error('Локальный ZIP-модуль не загрузился');
  const files=[...($('batch-files')?.files||[])];
  if(!files.length)throw new Error('Сначала выберите изображения для пакетной обработки');
  const maxWidth=Math.max(0,Number($('b-width')?.value)||0);
  const bar=$('b-bar');
  const zip=new JSZip();
  for(let i=0;i<files.length;i++){
    const canvas=await fileToCanvas(files[i],maxWidth);
    zip.file(baseName(files[i].name)+'-safelight.heic',await encodeCanvas(canvas));
    if(bar)bar.style.width=Math.round(((i+1)/files.length)*100)+'%';
  }
  downloadBlob(await zip.generateAsync({type:'blob'}),'safelight-batch-heic.zip');
}

function paletteCanvas(){
  const colors=[...document.querySelectorAll('#palette-list [data-palette-hex]')].map(node=>{
    const hex=node.dataset.paletteHex||'#000000';
    const meta=node.querySelector('small')?.textContent||'';
    return{hex,meta};
  });
  if(!colors.length)throw new Error('Сначала загрузите изображение');
  const width=1200,rowHeight=104,height=160+colors.length*rowHeight;
  const canvas=document.createElement('canvas');
  canvas.width=width;
  canvas.height=height;
  const ctx=canvas.getContext('2d');
  ctx.fillStyle='#09090b';
  ctx.fillRect(0,0,width,height);
  ctx.fillStyle='#f4f4f5';
  ctx.font='700 42px system-ui, sans-serif';
  ctx.fillText('Safelight · Палитра изображения',64,70);
  ctx.fillStyle='#71717a';
  ctx.font='22px system-ui, sans-serif';
  ctx.fillText(currentBaseName(),64,108);
  colors.forEach((color,index)=>{
    const y=146+index*rowHeight;
    ctx.fillStyle=color.hex;
    ctx.fillRect(64,y,150,72);
    ctx.strokeStyle='rgba(255,255,255,.15)';
    ctx.strokeRect(64,y,150,72);
    ctx.fillStyle='#f4f4f5';
    ctx.font='700 28px ui-monospace, monospace';
    ctx.fillText(color.hex,244,y+31);
    ctx.fillStyle='#9a9aa3';
    ctx.font='20px ui-monospace, monospace';
    ctx.fillText(color.meta,244,y+61);
  });
  return canvas;
}

async function exportSpecialHeic(value,tool){
  if(value==='slice-heic')return exportSliceHeic();
  if(value==='batch-heic')return exportBatchHeic();
  if(value==='palette-heic'){
    downloadBlob(await encodeCanvas(paletteCanvas()),currentBaseName()+'-palette.heic');
    return;
  }
  if(value==='heic'&&(tool==='privacy'||tool==='metadata')){
    const canvas=await currentResultCanvas();
    downloadBlob(await encodeCanvas(canvas),currentBaseName()+'-'+tool+'.heic');
    return;
  }
  return false;
}

function bindSpecialHeicExport(){
  document.addEventListener('click',event=>{
    const option=event.target.closest('.sl-export-option[data-export]');
    if(!option)return;
    const value=option.dataset.export||'';
    const tool=currentTool();
    const special=value==='slice-heic'||value==='batch-heic'||value==='palette-heic'||(value==='heic'&&(tool==='privacy'||tool==='metadata'));
    if(!special)return;
    event.preventDefault();
    event.stopPropagation();
    event.stopImmediatePropagation();
    option.closest('.sl-export-wrap')?.classList.remove('open');
    const button=$('sl-export');
    if(button)button.disabled=true;
    showExportHint('Кодирую HEIC локально…');
    Promise.resolve(exportSpecialHeic(value,tool)).then(()=>showExportHint('HEIC экспорт готов.')).catch(error=>{
      console.error('Safelight HEIC export:',error);
      showExportHint(error.message||'Не удалось экспортировать HEIC');
    }).finally(()=>{if(button)button.disabled=false});
  },true);
}

function boot(){
  if(!$('fileInput')){setTimeout(boot,60);return}
  prepareInput();
}

window.safelightHeicCodec=Object.freeze({
  isHeicFile,
  decodeFile:decodeHeicFile,
  encodeCanvas
});

boot();
watchExportMenu();
bindSpecialHeicExport();
})();
