(function(){
  'use strict';
  if(window.safelightAnnotationPreviewModeLoaded)return;
  window.safelightAnnotationPreviewModeLoaded=true;

  const $=id=>document.getElementById(id);
  let current=false;

  function setMode(enabled){
    enabled=!!enabled;
    if(current===enabled)return;
    current=enabled;
    document.body.classList.toggle('sl-annotation-active',enabled);
    const wrap=$('previewWrap');
    const live=$('sl-live-canvas');
    if(enabled){
      wrap?.classList.remove('sl-live-ready');
      live?.setAttribute('aria-hidden','true');
    }else{
      live?.removeAttribute('aria-hidden');
    }
  }

  window.addEventListener('safelight:toolchange',event=>{
    setMode(event.detail?.page==='annotation');
  });

  requestAnimationFrame(()=>{
    const panel=$('panel-annotation');
    const button=document.querySelector('.sl-sidebar .sl-tool.active');
    setMode(!!panel?.classList.contains('active')||button?.dataset.page==='annotation');
  });
})();
