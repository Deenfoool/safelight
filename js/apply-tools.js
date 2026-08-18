(function(){
  'use strict';
  if(window.safelightApplyToolsLoaded)return;
  window.safelightApplyToolsLoaded=true;

  const $=id=>document.getElementById(id);
  const SUPPORTED=new Set(['resize','crop','adjust','transform','watermark','canvas']);
  let undoSnapshot=null;
  let currentAppliedUrl=null;
  let busy=false;

  function currentTool(){
    const activeButton=document.querySelector('.sl-sidebar .sl-tool.active');
    if(activeButton?.dataset.page)return activeButton.dataset.page;
    const panel=document.querySelector('#sl-inspector-panels .panel.active');
    if(!panel)return null;
    return panel.id.replace(/^panel-/,'').replace(/-ui$/,'');
  }
  function copyCanvas(input){
    const out=document.createElement('canvas');out.width=input.width;out.height=input.height;
    out.getContext('2d').drawImage(input,0,0);return out;
  }
  function imageFrom(src){return new Promise((resolve,reject)=>{const image=new Image();image.onload=()=>resolve(image);image.onerror=()=>reject(new Error('Не удалось открыть рабочее изображение'));image.src=src})}
  function canvasBlob(canvas){return new Promise((resolve,reject)=>canvas.toBlob(blob=>blob?resolve(blob):reject(new Error('Не удалось сохранить рабочее изображение')),'image/png'))}
  function formatBytes(bytes){if(bytes<1024)return bytes+' B';if(bytes<1048576)return(bytes/1024).toFixed(1)+' KB';return(bytes/1048576).toFixed(2)+' MB'}
  function hint(text){const el=$('sl-export-hint');if(!el)return;el.textContent=text;el.classList.add('show');clearTimeout(hint.timer);hint.timer=setTimeout(()=>el.classList.remove('show'),2600)}

  async function cropCanvas(){
    const preview=$('previewImg'),frame=$('sl-crop-frame');
    if(!preview?.src||!frame)throw new Error('Рамка обрезки ещё не готова');
    const ir=preview.getBoundingClientRect(),fr=frame.getBoundingClientRect();
    if(!ir.width||!ir.height)throw new Error('Предпросмотр ещё не готов');
    const source=await imageFrom(preview.src);
    const x=Math.max(0,Math.min(1,(fr.left-ir.left)/ir.width));
    const y=Math.max(0,Math.min(1,(fr.top-ir.top)/ir.height));
    const w=Math.max(1/source.naturalWidth,Math.min(1-x,fr.width/ir.width));
    const h=Math.max(1/source.naturalHeight,Math.min(1-y,fr.height/ir.height));
    const sx=Math.round(x*source.naturalWidth),sy=Math.round(y*source.naturalHeight);
    const sw=Math.max(1,Math.min(source.naturalWidth-sx,Math.round(w*source.naturalWidth)));
    const sh=Math.max(1,Math.min(source.naturalHeight-sy,Math.round(h*source.naturalHeight)));
    const out=document.createElement('canvas');out.width=sw;out.height=sh;
    out.getContext('2d').drawImage(source,sx,sy,sw,sh,0,0,sw,sh);return out;
  }

  async function currentResultCanvas(tool){
    if(tool==='crop')return cropCanvas();
    if(tool==='adjust'&&typeof window.safelightAdjustTools?.render==='function'){
      const canvas=await window.safelightAdjustTools.render();if(canvas)return copyCanvas(canvas);
    }
    if(tool==='canvas'&&typeof window.safelightCanvasTools?.render==='function'){
      const canvas=await window.safelightCanvasTools.render();if(canvas)return copyCanvas(canvas);
    }
    const live=$('sl-live-canvas'),wrap=$('previewWrap');
    if(live&&live.width&&live.height&&wrap?.classList.contains('sl-live-ready'))return copyCanvas(live);
    const preview=$('previewImg');if(!preview?.src)throw new Error('Сначала загрузите изображение');
    const image=await imageFrom(preview.src),out=document.createElement('canvas');out.width=image.naturalWidth;out.height=image.naturalHeight;out.getContext('2d').drawImage(image,0,0);return out;
  }

  function snapshotMeta(){
    const ids=['meta-name','meta-size','meta-type','meta-dims','ro-dims','ro-size','ro-format'];
    const values={};ids.forEach(id=>{values[id]=$(id)?.textContent||''});return values;
  }
  function restoreMeta(values){if(!values)return;Object.entries(values).forEach(([id,value])=>{if($(id))$(id).textContent=value})}
  function updateMeta(blob,canvas){
    if($('meta-size'))$('meta-size').textContent=formatBytes(blob.size);
    if($('meta-type'))$('meta-type').textContent='image/png · рабочая версия';
    if($('meta-dims'))$('meta-dims').textContent=canvas.width+' × '+canvas.height;
    if($('ro-dims'))$('ro-dims').textContent=canvas.width+' × '+canvas.height+' px';
    if($('ro-size'))$('ro-size').textContent=formatBytes(blob.size);
    if($('ro-format'))$('ro-format').textContent='WORKING';
  }

  function setToolbarState(){
    const tool=currentTool(),hasSource=!!$('previewImg')?.src,apply=$('sl-apply'),undo=$('sl-undo-apply');
    if(apply){apply.disabled=busy||!hasSource||!SUPPORTED.has(tool);apply.title=SUPPORTED.has(tool)?'Сохранить текущий результат как рабочую версию':'В этом инструменте нечего применять к рабочему изображению'}
    if(undo){undo.hidden=!undoSnapshot;undo.disabled=busy||!undoSnapshot}
  }

  function neutralizeAfterApply(tool,width,height){
    if(tool==='resize'){
      if($('r-width'))$('r-width').value=width;if($('r-height'))$('r-height').value=height;
      ['r-width','r-height'].forEach(id=>$(id)?.dispatchEvent(new Event('input',{bubbles:true})));
      return;
    }
    if(tool==='transform'&&window.safelightTransformState){window.safelightTransformState.angle=0;window.safelightTransformState.h=false;window.safelightTransformState.v=false;window.dispatchEvent(new CustomEvent('safelight:direct-state'));return}
    if(tool==='watermark'){
      // У водяного знака нет нейтрального состояния в старом renderer, поэтому после применения переходим в нейтральную Конвертацию.
      setTimeout(()=>window.safelightActivate?.('convert'),40);return;
    }
    if(tool==='adjust'){
      const defaults={'a-exposure':0,'a-bright':0,'a-contrast':0,'a-highlights':0,'a-shadows':0,'a-temp':0,'a-tint':0,'a-sat':0,'a-gamma':1,'a-sharp':0,'a-blur':0,'a-vignette':0,'a-sepia':0};
      Object.entries(defaults).forEach(([id,value])=>{const el=$(id);if(el){el.value=String(value);el.dispatchEvent(new Event('input',{bubbles:true}))}});if($('a-gray')){$('a-gray').checked=false;$('a-gray').dispatchEvent(new Event('change',{bubbles:true}))}return;
    }
    if(tool==='canvas'){
      const defaults={'cv-preset':'original','cv-fit':'contain','cv-bg-mode':'transparent','cv-border':0,'cv-radius':0,'cv-shadow':0,'cv-top':0,'cv-right':0,'cv-bottom':0,'cv-left':0,'cv-pos-x':0,'cv-pos-y':0};
      Object.entries(defaults).forEach(([id,value])=>{const el=$(id);if(el){el.value=String(value);el.dispatchEvent(new Event('change',{bubbles:true}))}});return;
    }
    // Crop сам сбрасывает рамку при смене source.
  }

  async function waitPreview(url){
    const preview=$('previewImg');if(!preview)return;
    if(preview.complete&&preview.src===url&&preview.naturalWidth)return;
    await new Promise((resolve,reject)=>{const done=()=>{cleanup();resolve()},fail=()=>{cleanup();reject(new Error('Не удалось применить результат'))},cleanup=()=>{preview.removeEventListener('load',done);preview.removeEventListener('error',fail)};preview.addEventListener('load',done,{once:true});preview.addEventListener('error',fail,{once:true})});
  }

  async function applyCurrent(){
    if(busy)return;const tool=currentTool();if(!SUPPORTED.has(tool)){hint('Для этого инструмента применение не требуется.');return}
    const preview=$('previewImg');if(!preview?.src){hint('Сначала загрузите изображение.');return}
    busy=true;setToolbarState();
    try{
      const canvas=await currentResultCanvas(tool),blob=await canvasBlob(canvas);
      if(undoSnapshot?.owned&&undoSnapshot.src&&undoSnapshot.src!==currentAppliedUrl)URL.revokeObjectURL(undoSnapshot.src);
      undoSnapshot={src:preview.src,owned:!!currentAppliedUrl&&preview.src===currentAppliedUrl,meta:snapshotMeta()};
      const nextUrl=URL.createObjectURL(blob),oldCurrent=currentAppliedUrl;currentAppliedUrl=nextUrl;
      updateMeta(blob,canvas);
      $('previewWrap')?.classList.remove('sl-live-ready');preview.src=nextUrl;
      await waitPreview(nextUrl);
      window.dispatchEvent(new CustomEvent('safelight:working-source',{detail:{width:canvas.width,height:canvas.height,size:blob.size,type:'image/png',applied:true}}));
      neutralizeAfterApply(tool,canvas.width,canvas.height);
      if(oldCurrent&&oldCurrent!==undoSnapshot.src)URL.revokeObjectURL(oldCurrent);
      hint('Изменения применены. Теперь они переносятся между инструментами.');
    }catch(error){console.error('Safelight apply:',error);hint(error.message||'Не удалось применить изменения')}
    finally{busy=false;setToolbarState()}
  }

  async function undoApply(){
    if(busy||!undoSnapshot)return;const preview=$('previewImg'),snapshot=undoSnapshot;if(!preview)return;
    busy=true;setToolbarState();
    try{
      const doomed=currentAppliedUrl;undoSnapshot=null;currentAppliedUrl=snapshot.owned?snapshot.src:null;
      restoreMeta(snapshot.meta);$('previewWrap')?.classList.remove('sl-live-ready');preview.src=snapshot.src;await waitPreview(snapshot.src);
      const image=await imageFrom(snapshot.src);window.dispatchEvent(new CustomEvent('safelight:working-source',{detail:{width:image.naturalWidth,height:image.naturalHeight,undo:true}}));
      if(doomed&&doomed!==snapshot.src)URL.revokeObjectURL(doomed);
      hint('Последнее применение отменено.');
    }catch(error){console.error('Safelight undo apply:',error);hint(error.message||'Не удалось отменить применение')}
    finally{busy=false;setToolbarState()}
  }

  function installToolbar(){
    const topbar=document.querySelector('.sl-topbar'),exportButton=$('sl-export');if(!topbar||!exportButton){setTimeout(installToolbar,60);return}
    if($('sl-apply')){setToolbarState();return}
    const undo=document.createElement('button');undo.type='button';undo.id='sl-undo-apply';undo.className='sl-tool-action sl-undo-apply';undo.hidden=true;undo.title='Отменить последнее применение';undo.innerHTML='<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 7 4 12l5 5M5 12h8a6 6 0 1 1 0 12"/></svg><span>Отменить</span>';
    const apply=document.createElement('button');apply.type='button';apply.id='sl-apply';apply.className='sl-apply';apply.innerHTML='<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m5 12 4 4L19 6"/></svg><span>Применить</span>';
    exportButton.insertAdjacentElement('beforebegin',apply);apply.insertAdjacentElement('beforebegin',undo);
    apply.addEventListener('click',applyCurrent);undo.addEventListener('click',undoApply);
    window.addEventListener('safelight:toolchange',()=>setTimeout(setToolbarState,30));
    new MutationObserver(setToolbarState).observe($('previewImg'),{attributes:true,attributeFilter:['src']});
    setToolbarState();
  }

  window.safelightApplyTools=Object.freeze({apply:applyCurrent,undo:undoApply,supported:SUPPORTED});
  installToolbar();
})();
