(function(){
'use strict';
if(window.safelightHeicSupportLoaded)return;
window.safelightHeicSupportLoaded=true;

const $=id=>document.getElementById(id);
const HEIC_MIMES=new Set(['image/heic','image/heif','image/heic-sequence','image/heif-sequence']);
let heicBlob=null;

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

function canvasToHeic(canvas,quality){
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

function prepareInput(){
  const input=$('fileInput');
  if(!input)return;
  const extras='.heic,.heif,image/heic,image/heif';
  if(!input.accept.toLowerCase().includes('.heic'))input.accept=(input.accept?input.accept+',':'')+extras;

  // Some operating systems expose HEIC files with an empty MIME type.
  // Normalize that case before the main Safelight upload listener reads the FileList.
  input.addEventListener('change',event=>{
    const file=event.target.files&&event.target.files[0];
    if(!file||!isHeicFile(file)||file.type)return;
    if(typeof DataTransfer==='undefined')return;
    try{
      const normalized=new File([file],file.name,{type:'image/heic',lastModified:file.lastModified});
      const dt=new DataTransfer();
      dt.items.add(normalized);
      event.target.files=dt.files;
    }catch(_){/* The main loader will still try the original file. */}
  },true);
}

function prepareConverter(){
  const format=$('v-format');
  const run=$('v-run');
  const downloadButton=$('v-download');
  if(!format||!run||!downloadButton)return;

  if(!format.querySelector('option[value="heic"]')){
    const option=document.createElement('option');
    option.value='heic';
    option.textContent='HEIC';
    format.appendChild(option);
  }

  const desc=$('panel-convert')?.querySelector('.desc');
  if(desc)desc.textContent='Конвертируйте PNG, JPEG, WebP и HEIC локально в браузере.';

  format.addEventListener('change',()=>{heicBlob=null;});

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
    if(status)status.textContent='Кодирую HEIC локально…';

    try{
      const canvas=document.createElement('canvas');
      canvas.width=preview.naturalWidth;
      canvas.height=preview.naturalHeight;
      const ctx=canvas.getContext('2d');
      ctx.drawImage(preview,0,0,canvas.width,canvas.height);
      const quality=Math.max(0.01,Math.min(1,Number($('v-quality')?.value||92)/100));
      heicBlob=await canvasToHeic(canvas,quality);

      const sourceName=$('meta-name')?.textContent||'image';
      const sourceSizeText=$('meta-size')?.textContent||'—';
      const sourceType=($('meta-type')?.textContent||'').replace(/^image\//i,'').toUpperCase()||'IMAGE';
      if($('v-before'))$('v-before').textContent=sourceType+' · '+sourceSizeText;
      if($('v-after'))$('v-after').textContent='HEIC · '+formatBytes(heicBlob.size);
      result?.classList.add('show');
      if(status)status.textContent='Готово. HEIC создан локально.';
      downloadButton.dataset.heicName=baseName(sourceName)+'-converted.heic';
    }catch(error){
      heicBlob=null;
      if(status){
        status.textContent=error?.message==='heic-unsupported'
          ?'Этот браузер не поддерживает локальное кодирование HEIC. Файл не был подменён другим форматом.'
          :'Не удалось создать HEIC в этом браузере.';
      }
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

function installHeicDecodeHint(){
  const input=$('fileInput');
  if(!input)return;
  input.addEventListener('change',event=>{
    const file=event.target.files&&event.target.files[0];
    if(!isHeicFile(file))return;
    // The core loader uses the browser's image decoder. If HEIC is not supported,
    // its normal image error is kept; this marker lets other UI layers identify the attempt.
    document.body.dataset.safelightHeicInput='1';
    setTimeout(()=>delete document.body.dataset.safelightHeicInput,5000);
  },true);
}

function boot(){
  if(!$('fileInput')||!$('v-format')){setTimeout(boot,60);return;}
  prepareInput();
  prepareConverter();
  installHeicDecodeHint();
}

boot();
})();