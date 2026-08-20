(function(){
  'use strict';
  if(window.safelightPreviewRenderGuardLoaded)return;
  window.safelightPreviewRenderGuardLoaded=true;

  const $=id=>document.getElementById(id);
  const LEGACY_LIVE=new Set(['compress','convert','resize','transform','watermark','slice']);
  const DEDICATED_LIVE=new Set(['adjust','canvas','privacy']);
  const SOURCE_ONLY=new Set(['crop','annotation','favicon','metadata','palette']);
  let requestedPage='';
  let epoch=0;
  let validLegacyTool='';
  let validLegacyEpoch=-1;
  let observerBusy=false;

  function normalizeTool(value){
    value=String(value||'').replace(/^panel-/,'').replace(/-ui$/,'');
    if(value==='crop-ui')return'crop';
    return value;
  }

  function currentTool(){
    const button=document.querySelector('.sl-sidebar .sl-tool.active');
    if(button?.dataset.page)return normalizeTool(button.dataset.page);
    const panel=document.querySelector('#sl-inspector-panels .panel.active')||document.querySelector('.panel.active');
    return panel?normalizeTool(panel.id):'';
  }

  function hideLive(){
    const wrap=$('previewWrap');
    const live=$('sl-live-canvas');
    if(wrap?.classList.contains('sl-live-ready'))wrap.classList.remove('sl-live-ready');
    live?.setAttribute('aria-hidden','true');
  }

  function allowLive(){
    $('sl-live-canvas')?.removeAttribute('aria-hidden');
  }

  function sourceReady(){return !!$('previewImg')?.src}

  function syncFaviconAvailability(){
    const ready=sourceReady();
    document.querySelectorAll('[data-page="favicon"]').forEach(button=>{
      button.disabled=!ready;
      button.setAttribute('aria-disabled',ready?'false':'true');
      if(!ready)button.title='Сначала загрузите изображение';
      else if(button.title==='Сначала загрузите изображение')button.removeAttribute('title');
    });
  }

  function syncModeClasses(tool){
    document.body.dataset.slTool=tool||'';
    document.body.classList.toggle('sl-annotation-active',tool==='annotation');
  }

  function validateVisibleLive(){
    const wrap=$('previewWrap');
    if(!wrap?.classList.contains('sl-live-ready'))return;
    const actual=currentTool();
    if(DEDICATED_LIVE.has(actual)){
      allowLive();
      return;
    }
    if(LEGACY_LIVE.has(actual)&&validLegacyTool===actual&&validLegacyEpoch===epoch){
      allowLive();
      return;
    }
    if(SOURCE_ONLY.has(actual)||!actual||!LEGACY_LIVE.has(actual)){
      hideLive();
      return;
    }
    hideLive();
  }

  window.addEventListener('safelight:toolchange',event=>{
    requestedPage=normalizeTool(event.detail?.page||'');
    epoch++;
    validLegacyTool='';
    validLegacyEpoch=-1;
    syncModeClasses(requestedPage);
    hideLive();
    requestAnimationFrame(()=>{
      const actual=currentTool();
      syncModeClasses(actual||requestedPage);
      if(actual&&requestedPage&&actual!==requestedPage)hideLive();
      validateVisibleLive();
    });
  });

  window.addEventListener('safelight:live-render',event=>{
    const rendered=normalizeTool(event.detail?.tool||'');
    const actual=currentTool();
    const expected=requestedPage||actual;

    /* Dedicated tools own their result. Ignore the old live-editor version. */
    if(!LEGACY_LIVE.has(rendered)){
      hideLive();
      return;
    }

    if(!rendered||rendered!==actual||(expected&&rendered!==expected)){
      hideLive();
      return;
    }

    validLegacyTool=rendered;
    validLegacyEpoch=epoch;
    allowLive();
  });

  const wrap=$('previewWrap');
  if(wrap){
    new MutationObserver(()=>{
      if(observerBusy)return;
      if(!wrap.classList.contains('sl-live-ready'))return;
      observerBusy=true;
      validateVisibleLive();
      queueMicrotask(()=>{observerBusy=false});
    }).observe(wrap,{attributes:true,attributeFilter:['class']});
  }

  const preview=$('previewImg');
  if(preview){
    new MutationObserver(()=>{
      epoch++;
      validLegacyTool='';
      validLegacyEpoch=-1;
      hideLive();
      syncFaviconAvailability();
    }).observe(preview,{attributes:true,attributeFilter:['src']});
  }

  /* UI shell calls window.safelightActivate dynamically, so block the known no-source Favicon loop here. */
  const originalActivate=window.safelightActivate;
  if(typeof originalActivate==='function'){
    window.safelightActivate=function(page){
      if(page==='favicon'&&!sourceReady()){
        const hint=$('sl-export-hint');
        if(hint){hint.textContent='Сначала загрузите изображение.';hint.classList.add('show');clearTimeout(hint._previewGuardTimer);hint._previewGuardTimer=setTimeout(()=>hint.classList.remove('show'),2200)}
        syncFaviconAvailability();
        return;
      }
      return originalActivate(page);
    };
  }

  syncFaviconAvailability();
  syncModeClasses(currentTool());
  validateVisibleLive();
})();
