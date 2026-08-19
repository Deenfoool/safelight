(function(){
  'use strict';
  if(window.safelightApplyToolsLoaded)return;
  window.safelightApplyToolsLoaded=true;

  const $=id=>document.getElementById(id);
  const SUPPORTED=new Set(['resize','crop','adjust','transform','watermark','canvas','privacy','annotation','background']);
  const TOOL_LABELS={resize:'Размер',crop:'Обрезка',adjust:'Коррекция',transform:'Трансформация',watermark:'Водяной знак',canvas:'Холст',privacy:'Размытие / пикселизация',annotation:'Аннотации',background:'Удаление фона'};
  const MAX_HISTORY=20;

  let history=[];
  let historyIndex=-1;
  let historySeedToken=0;
  let viewUrl=null;
  let trackedPreviewSrc='';
  let internalPreviewChange=false;
  let busy=false;
  let lastLiveTool='';

  function currentTool(){
    const activeButton=document.querySelector('.sl-sidebar .sl-tool.active');
    if(activeButton?.dataset.page)return activeButton.dataset.page;
    const panel=document.querySelector('#sl-inspector-panels .panel.active');
    if(!panel)return null;
    return panel.id.replace(/^panel-/,'').replace(/-ui$/,'');
  }
  function copyCanvas(input){const out=document.createElement('canvas');out.width=input.width;out.height=input.height;out.getContext('2d').drawImage(input,0,0);return out}
  function imageFrom(src){return new Promise((resolve,reject)=>{const image=new Image();image.onload=()=>resolve(image);image.onerror=()=>reject(new Error('Не удалось открыть рабочее изображение'));image.src=src})}
  function canvasBlob(canvas){return new Promise((resolve,reject)=>canvas.toBlob(blob=>blob?resolve(blob):reject(new Error('Не удалось сохранить рабочее изображение')),'image/png'))}
  function formatBytes(bytes){if(bytes<1024)return bytes+' B';if(bytes<1048576)return(bytes/1024).toFixed(1)+' KB';return(bytes/1048576).toFixed(2)+' MB'}
  function hint(text){const el=$('sl-export-hint');if(!el)return;el.textContent=text;el.classList.add('show');clearTimeout(hint.timer);hint.timer=setTimeout(()=>el.classList.remove('show'),2600)}
  function snapshotMeta(){const ids=['meta-name','meta-size','meta-type','meta-dims','ro-dims','ro-size','ro-format'],values={};ids.forEach(id=>{values[id]=$(id)?.textContent||''});return values}
  function restoreMeta(values){if(!values)return;Object.entries(values).forEach(([id,value])=>{if($(id))$(id).textContent=value})}
  function updateMeta(blob,canvas){if($('meta-size'))$('meta-size').textContent=formatBytes(blob.size);if($('meta-type'))$('meta-type').textContent='image/png · рабочая версия';if($('meta-dims'))$('meta-dims').textContent=canvas.width+' × '+canvas.height;if($('ro-dims'))$('ro-dims').textContent=canvas.width+' × '+canvas.height+' px';if($('ro-size'))$('ro-size').textContent=formatBytes(blob.size);if($('ro-format'))$('ro-format').textContent='WORKING'}

  async function legacyCropCanvas(){
    const preview=$('previewImg'),frame=$('sl-crop-frame');if(!preview?.src||!frame)throw new Error('Рамка обрезки ещё не готова');
    const ir=preview.getBoundingClientRect(),fr=frame.getBoundingClientRect();if(!ir.width||!ir.height)throw new Error('Предпросмотр ещё не готов');
    const source=await imageFrom(preview.src),x=Math.max(0,Math.min(1,(fr.left-ir.left)/ir.width)),y=Math.max(0,Math.min(1,(fr.top-ir.top)/ir.height)),wf=Math.max(0,Math.min(1-x,fr.width/ir.width)),hf=Math.max(0,Math.min(1-y,fr.height/ir.height));
    const sx=Math.round(x*source.naturalWidth),sy=Math.round(y*source.naturalHeight),sw=Math.max(1,Math.min(source.naturalWidth-sx,Math.round(wf*source.naturalWidth))),sh=Math.max(1,Math.min(source.naturalHeight-sy,Math.round(hf*source.naturalHeight)));
    const out=document.createElement('canvas');out.width=sw;out.height=sh;out.getContext('2d').drawImage(source,sx,sy,sw,sh,0,0,sw,sh);return out;
  }

  async function waitForLive(tool){
    if(lastLiveTool===tool)return;
    await new Promise(resolve=>{let done=false;const onRender=event=>{if(event.detail?.tool===tool){done=true;window.removeEventListener('safelight:live-render',onRender);resolve()}};window.addEventListener('safelight:live-render',onRender);setTimeout(()=>{if(!done){window.removeEventListener('safelight:live-render',onRender);resolve()}},260)});
  }
  async function currentResultCanvas(tool){
    if(tool==='crop'){
      if(typeof window.safelightCropTools?.render==='function'){const canvas=await window.safelightCropTools.render();if(canvas)return copyCanvas(canvas)}
      return legacyCropCanvas();
    }
    if(tool==='adjust'&&typeof window.safelightAdjustTools?.render==='function'){const canvas=await window.safelightAdjustTools.render();if(canvas)return copyCanvas(canvas)}
    if(tool==='canvas'&&typeof window.safelightCanvasTools?.render==='function'){const canvas=await window.safelightCanvasTools.render();if(canvas)return copyCanvas(canvas)}
    if(tool==='annotation'&&typeof window.safelightAnnotationTools?.render==='function'){const canvas=await window.safelightAnnotationTools.render();if(canvas)return copyCanvas(canvas)}
    if(tool==='background'&&typeof window.safelightBackgroundRemovalTools?.render==='function'){const canvas=await window.safelightBackgroundRemovalTools.render();if(canvas)return copyCanvas(canvas)}
    if(tool==='privacy'){
      const live=$('sl-live-canvas'),wrap=$('previewWrap');if(live&&live.width&&live.height&&wrap?.classList.contains('sl-live-ready'))return copyCanvas(live);
      throw new Error('Предпросмотр размытия ещё не готов');
    }
    await waitForLive(tool);
    const live=$('sl-live-canvas'),wrap=$('previewWrap');if(live&&live.width&&live.height&&wrap?.classList.contains('sl-live-ready')&&(lastLiveTool===tool||!lastLiveTool))return copyCanvas(live);
    throw new Error('Предпросмотр результата ещё не готов');
  }

  function setAriaDisabled(button,value){if(!button)return;button.setAttribute('aria-disabled',value?'true':'false')}
  function setToolbarState(){
    const tool=currentTool(),hasSource=!!$('previewImg')?.src,apply=$('sl-apply');
    if(apply){apply.disabled=busy||!hasSource||!SUPPORTED.has(tool);apply.title=SUPPORTED.has(tool)?'Сохранить текущий результат как рабочую версию':'В этом инструменте нечего применять к рабочему изображению'}
    setAriaDisabled($('sl-history-undo'),busy||historyIndex<=0);
    setAriaDisabled($('sl-history-redo'),busy||historyIndex<0||historyIndex>=history.length-1);
  }

  function renderHistory(){
    const menu=$('sl-history-menu'),toggle=$('sl-history-toggle');
    if(toggle){const label=toggle.querySelector('span');if(label)label.textContent=history.length?'История '+(historyIndex+1)+'/'+history.length:'История'}
    if(menu){
      if(!history.length){menu.innerHTML='<div class="sl-history-empty">Загрузите изображение, чтобы начать историю.</div>'}
      else{
        const items=history.map((entry,index)=>{
          const current=index===historyIndex?' current':'',future=index>historyIndex?' future':'';
          const dims=entry.width&&entry.height?entry.width+' × '+entry.height:'';
          return '<button type="button" class="sl-history-item'+current+future+'" role="menuitem" data-history-index="'+index+'"><span class="sl-history-dot"></span><span class="sl-history-copy"><b>'+entry.label+'</b><small>'+dims+'</small></span>'+(index===historyIndex?'<span class="sl-history-current">сейчас</span>':'')+'</button>';
        }).reverse().join('');
        menu.innerHTML='<div class="sl-history-head"><span>История действий</span><small>'+history.length+' / '+MAX_HISTORY+'</small></div><div class="sl-history-list">'+items+'</div>';
      }
    }
    setToolbarState();
  }

  async function blobFromSrc(src){const response=await fetch(src);if(!response.ok&&response.status!==0)throw new Error('Не удалось сохранить исходное состояние');return response.blob()}

  async function seedHistoryFromPreview(){
    const preview=$('previewImg'),src=preview?.src||'';const token=++historySeedToken;
    history=[];historyIndex=-1;trackedPreviewSrc='';renderHistory();
    if(!src)return;
    if(viewUrl&&src!==viewUrl){URL.revokeObjectURL(viewUrl);viewUrl=null}
    try{
      const blob=await blobFromSrc(src);if(token!==historySeedToken||internalPreviewChange||preview.src!==src)return;
      const image=preview.complete&&preview.naturalWidth?preview:await imageFrom(src);if(token!==historySeedToken||preview.src!==src)return;
      history=[{blob,meta:snapshotMeta(),width:image.naturalWidth||0,height:image.naturalHeight||0,label:'Исходник',tool:'source'}];historyIndex=0;trackedPreviewSrc=src;renderHistory();
    }catch(error){console.warn('Safelight history seed:',error);renderHistory()}
  }

  function pruneRedo(){if(historyIndex<history.length-1)history.splice(historyIndex+1)}
  function trimHistory(){
    while(history.length>MAX_HISTORY){
      const removeIndex=history[0]?.tool==='source'&&history.length>1?1:0;
      history.splice(removeIndex,1);
      if(historyIndex>=removeIndex)historyIndex=Math.max(0,historyIndex-1);
    }
  }

  async function ensureHistoryReady(){
    const preview=$('previewImg');if(!preview?.src)return false;
    if(history.length&&historyIndex>=0&&preview.src===trackedPreviewSrc)return true;
    await seedHistoryFromPreview();return history.length>0;
  }

  function neutralizeAfterApply(tool,width,height){
    if(tool==='resize'){if($('r-width'))$('r-width').value=width;if($('r-height'))$('r-height').value=height;['r-width','r-height'].forEach(id=>$(id)?.dispatchEvent(new Event('input',{bubbles:true})));return}
    if(tool==='crop'||tool==='background'){return}
    if(tool==='transform'&&window.safelightTransformState){window.safelightTransformState.angle=0;window.safelightTransformState.h=false;window.safelightTransformState.v=false;window.dispatchEvent(new CustomEvent('safelight:direct-state'));return}
    if(tool==='watermark'){setTimeout(()=>window.safelightActivate?.('convert'),40);return}
    if(tool==='privacy'){$('sl-reset')?.click();return}
    if(tool==='annotation'){window.safelightAnnotationTools?.clear?.();return}
    if(tool==='adjust'){
      const defaults={'a-exposure':0,'a-bright':0,'a-contrast':0,'a-highlights':0,'a-shadows':0,'a-temp':0,'a-tint':0,'a-sat':0,'a-gamma':1,'a-level-black':0,'a-level-mid':1,'a-level-white':255,'a-output-black':0,'a-output-white':255,'a-curve-shadow':0,'a-curve-mid':0,'a-curve-high':0,'a-sharp':0,'a-sharp-radius':0.8,'a-sharp-threshold':4,'a-denoise':0,'a-denoise-detail':65,'a-blur':0,'a-vignette':0,'a-vignette-feather':65,'a-sepia':0};
      Object.entries(defaults).forEach(([id,value])=>{const el=$(id);if(el){el.value=String(value);el.dispatchEvent(new Event('input',{bubbles:true}))}});if($('a-gray')){$('a-gray').checked=false;$('a-gray').dispatchEvent(new Event('change',{bubbles:true}))}return;
    }
    if(tool==='canvas'){
      const defaults={'cv-preset':'original','cv-fit':'contain','cv-bg-mode':'transparent','cv-border':0,'cv-radius':0,'cv-shadow':0,'cv-top':0,'cv-right':0,'cv-bottom':0,'cv-left':0,'cv-pos-x':0,'cv-pos-y':0};
      Object.entries(defaults).forEach(([id,value])=>{const el=$(id);if(el){el.value=String(value);el.dispatchEvent(new Event('change',{bubbles:true}))}});return;
    }
  }

  function neutralizePendingPreview(){
    const tool=currentTool();if(!SUPPORTED.has(tool))return;
    if(tool==='watermark'){window.safelightActivate?.('convert');return}
    if(tool==='annotation'){window.safelightAnnotationTools?.clear?.();return}
    if(tool==='background'){window.safelightBackgroundRemovalTools?.reset?.();return}
    $('sl-reset')?.click();
    if(tool==='transform'&&window.safelightTransformState){window.safelightTransformState.angle=0;window.safelightTransformState.h=false;window.safelightTransformState.v=false;window.dispatchEvent(new CustomEvent('safelight:direct-state'))}
  }

  async function waitPreview(url){const preview=$('previewImg');if(!preview)return;if(preview.complete&&preview.src===url&&preview.naturalWidth)return;await new Promise((resolve,reject)=>{const done=()=>{cleanup();resolve()},fail=()=>{cleanup();reject(new Error('Не удалось применить состояние'))},cleanup=()=>{preview.removeEventListener('load',done);preview.removeEventListener('error',fail)};preview.addEventListener('load',done,{once:true});preview.addEventListener('error',fail,{once:true})})}

  async function setPreviewFromEntry(entry){
    const preview=$('previewImg');if(!preview)throw new Error('Предпросмотр недоступен');
    const nextUrl=URL.createObjectURL(entry.blob),oldView=viewUrl;internalPreviewChange=true;$('previewWrap')?.classList.remove('sl-live-ready');lastLiveTool='';restoreMeta(entry.meta);preview.src=nextUrl;trackedPreviewSrc=nextUrl;viewUrl=nextUrl;
    try{await waitPreview(nextUrl)}finally{internalPreviewChange=false;if(oldView&&oldView!==nextUrl)URL.revokeObjectURL(oldView)}
  }

  async function restoreHistoryIndex(nextIndex,reason){
    if(busy||nextIndex<0||nextIndex>=history.length||nextIndex===historyIndex)return;
    const entry=history[nextIndex];busy=true;setToolbarState();neutralizePendingPreview();
    try{
      await setPreviewFromEntry(entry);historyIndex=nextIndex;renderHistory();
      window.dispatchEvent(new CustomEvent('safelight:working-source',{detail:{width:entry.width,height:entry.height,size:entry.blob.size,type:entry.blob.type||'image/png',history:true,undo:reason==='undo',redo:reason==='redo'}}));
      if(reason==='undo')hint('Действие отменено.');else if(reason==='redo')hint('Действие повторено.');else hint('Состояние восстановлено из истории.');
    }catch(error){console.error('Safelight history restore:',error);hint(error.message||'Не удалось восстановить состояние')}
    finally{busy=false;renderHistory()}
  }

  async function undoHistory(){if(historyIndex>0)return restoreHistoryIndex(historyIndex-1,'undo')}
  async function redoHistory(){if(historyIndex>=0&&historyIndex<history.length-1)return restoreHistoryIndex(historyIndex+1,'redo')}

  async function applyCurrent(){
    if(busy)return;const tool=currentTool();if(!SUPPORTED.has(tool)){hint('Для этого инструмента применение не требуется.');return}const preview=$('previewImg');if(!preview?.src){hint('Сначала загрузите изображение.');return}
    busy=true;setToolbarState();
    try{
      if(!(await ensureHistoryReady()))throw new Error('История исходника ещё не готова');
      if(history[historyIndex])history[historyIndex].meta=snapshotMeta();
      const canvas=await currentResultCanvas(tool),blob=await canvasBlob(canvas);pruneRedo();
      const entry={blob,meta:null,width:canvas.width,height:canvas.height,label:TOOL_LABELS[tool]||'Изменение',tool};
      const nextUrl=URL.createObjectURL(blob),oldView=viewUrl;internalPreviewChange=true;updateMeta(blob,canvas);entry.meta=snapshotMeta();$('previewWrap')?.classList.remove('sl-live-ready');lastLiveTool='';preview.src=nextUrl;trackedPreviewSrc=nextUrl;viewUrl=nextUrl;
      try{await waitPreview(nextUrl)}finally{internalPreviewChange=false;if(oldView&&oldView!==nextUrl)URL.revokeObjectURL(oldView)}
      history.push(entry);historyIndex=history.length-1;trimHistory();renderHistory();
      window.dispatchEvent(new CustomEvent('safelight:working-source',{detail:{width:canvas.width,height:canvas.height,size:blob.size,type:'image/png',applied:true,historyIndex}}));neutralizeAfterApply(tool,canvas.width,canvas.height);hint('Изменения применены и добавлены в историю.');
    }catch(error){console.error('Safelight apply:',error);hint(error.message||'Не удалось применить изменения')}
    finally{busy=false;renderHistory()}
  }

  function clearHistory(){historySeedToken++;history=[];historyIndex=-1;trackedPreviewSrc='';lastLiveTool='';if(viewUrl){URL.revokeObjectURL(viewUrl);viewUrl=null}renderHistory()}

  function editableTarget(target){if(!target)return false;if(target.isContentEditable)return true;const tag=target.tagName;if(tag==='TEXTAREA'||tag==='SELECT')return true;if(tag==='INPUT'){const type=(target.type||'text').toLowerCase();return !['range','checkbox','radio','button','submit','reset','color','file'].includes(type)}return false}
  function installShortcuts(){
    const apple=/Mac|iPhone|iPad|iPod/i.test(navigator.platform||navigator.userAgent||'');
    const undo=$('sl-history-undo'),redo=$('sl-history-redo');if(undo)undo.dataset.tooltip=apple?'Undo · ⌘Z':'Undo · Ctrl+Z';if(redo)redo.dataset.tooltip=apple?'Redo · ⌘⇧Z':'Redo · Ctrl+Shift+Z / Ctrl+Y';
    document.addEventListener('keydown',event=>{
      if(editableTarget(event.target)||event.altKey)return;const key=(event.key||'').toLowerCase(),code=event.code||'',modifier=event.ctrlKey||event.metaKey;if(!modifier)return;
      if(key==='z'||code==='KeyZ'){event.preventDefault();if(event.shiftKey)redoHistory();else undoHistory();return}
      if((key==='y'||code==='KeyY')&&event.ctrlKey&&!event.metaKey){event.preventDefault();redoHistory()}
    });
  }

  function installToolbar(){
    const topbar=document.querySelector('.sl-topbar'),exportButton=$('sl-export'),toggle=$('sl-history-toggle'),menu=$('sl-history-menu'),undo=$('sl-history-undo'),redo=$('sl-history-redo');
    if(!topbar||!exportButton||!toggle||!menu||!undo||!redo){setTimeout(installToolbar,60);return}
    if($('sl-apply')){renderHistory();return}

    const apply=document.createElement('button');apply.type='button';apply.id='sl-apply';apply.className='sl-apply';apply.innerHTML='<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m5 12 4 4L19 6"/></svg><span>Применить</span>';exportButton.insertAdjacentElement('beforebegin',apply);
    apply.addEventListener('click',applyCurrent);undo.addEventListener('click',()=>{if(undo.getAttribute('aria-disabled')!=='true')undoHistory()});redo.addEventListener('click',()=>{if(redo.getAttribute('aria-disabled')!=='true')redoHistory()});
    toggle.addEventListener('click',event=>{event.preventDefault();event.stopPropagation();const wrap=$('sl-history-wrap'),open=!wrap.classList.contains('open');wrap.classList.toggle('open',open);toggle.setAttribute('aria-expanded',open?'true':'false')});
    menu.addEventListener('click',event=>{const item=event.target.closest('[data-history-index]');if(!item)return;event.preventDefault();const index=Number(item.dataset.historyIndex);$('sl-history-wrap')?.classList.remove('open');toggle.setAttribute('aria-expanded','false');restoreHistoryIndex(index,'jump')});
    document.addEventListener('click',event=>{if(event.target.closest('#sl-history-wrap'))return;$('sl-history-wrap')?.classList.remove('open');toggle.setAttribute('aria-expanded','false')});
    document.addEventListener('keydown',event=>{if(event.key==='Escape'){$('sl-history-wrap')?.classList.remove('open');toggle.setAttribute('aria-expanded','false')}});

    window.addEventListener('safelight:toolchange',()=>setTimeout(setToolbarState,30));window.addEventListener('safelight:live-render',event=>{lastLiveTool=event.detail?.tool||''});
    const preview=$('previewImg');new MutationObserver(()=>{const src=preview?.src||'';if(internalPreviewChange)return;if(!src){clearHistory();return}if(src===trackedPreviewSrc)return;setTimeout(()=>{if(!internalPreviewChange&&preview.src===src&&src!==trackedPreviewSrc)seedHistoryFromPreview()},0)}).observe(preview,{attributes:true,attributeFilter:['src']});
    window.addEventListener('beforeunload',()=>{if(viewUrl)URL.revokeObjectURL(viewUrl)});installShortcuts();renderHistory();if(preview?.src)seedHistoryFromPreview();
  }

  window.safelightApplyTools=Object.freeze({apply:applyCurrent,undo:undoHistory,redo:redoHistory,supported:SUPPORTED,clear:clearHistory,history:()=>({index:historyIndex,items:history.map(entry=>({label:entry.label,tool:entry.tool,width:entry.width,height:entry.height,size:entry.blob.size}))})});installToolbar();
})();
