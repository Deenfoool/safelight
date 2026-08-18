(function(){
  'use strict';
  if(window.safelightAnnotationPreviewModeLoaded)return;
  window.safelightAnnotationPreviewModeLoaded=true;

  const $=id=>document.getElementById(id);

  function setMode(enabled){
    document.body.classList.toggle('sl-annotation-active',!!enabled);
    const wrap=$('previewWrap');
    const live=$('sl-live-canvas');
    if(enabled){
      wrap?.classList.remove('sl-live-ready');
      if(live)live.setAttribute('aria-hidden','true');
    }else if(live){
      live.removeAttribute('aria-hidden');
    }
  }

  function syncFromDom(){
    const panel=$('panel-annotation');
    const button=document.querySelector('.sl-sidebar .sl-tool.active');
    setMode(!!panel?.classList.contains('active')||button?.dataset.page==='annotation');
  }

  window.addEventListener('safelight:toolchange',event=>{
    setMode(event.detail?.page==='annotation');
  });

  const preview=$('previewWrap');
  if(preview){
    new MutationObserver(()=>{
      if(document.body.classList.contains('sl-annotation-active'))preview.classList.remove('sl-live-ready');
    }).observe(preview,{attributes:true,attributeFilter:['class']});
  }

  requestAnimationFrame(syncFromDom);
})();
