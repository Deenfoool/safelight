(function(){
  'use strict';
  if(window.safelightPreviewRenderGuardLoaded)return;
  window.safelightPreviewRenderGuardLoaded=true;

  const $=id=>document.getElementById(id);
  let requestedPage='';

  function currentTool(){
    const button=document.querySelector('.sl-sidebar .sl-tool.active');
    if(button?.dataset.page)return button.dataset.page;
    const panel=document.querySelector('#sl-inspector-panels .panel.active')||document.querySelector('.panel.active');
    if(!panel)return'';
    return panel.id.replace(/^panel-/,'').replace(/-ui$/,'');
  }

  function hideLive(){
    const wrap=$('previewWrap');
    const live=$('sl-live-canvas');
    wrap?.classList.remove('sl-live-ready');
    live?.setAttribute('aria-hidden','true');
  }

  function allowLive(){
    $('sl-live-canvas')?.removeAttribute('aria-hidden');
  }

  window.addEventListener('safelight:toolchange',event=>{
    requestedPage=event.detail?.page||'';
    hideLive();
    requestAnimationFrame(()=>{
      const actual=currentTool();
      if(actual&&requestedPage&&actual!==requestedPage)hideLive();
    });
  });

  window.addEventListener('safelight:live-render',event=>{
    const rendered=event.detail?.tool||'';
    const actual=currentTool();
    const expected=requestedPage||actual;
    if(!rendered||rendered!==actual||(expected&&rendered!==expected)){
      hideLive();
      return;
    }
    allowLive();
  });
})();
