(function(){
  'use strict';
  if(window.safelightInspectorMotionLoaded)return;
  window.safelightInspectorMotionLoaded=true;

  let fallbackTimer=0;
  let activeInspector=null;
  let activeHandler=null;

  function clearActive(){
    clearTimeout(fallbackTimer);
    if(activeInspector&&activeHandler)activeInspector.removeEventListener('animationend',activeHandler);
    if(activeInspector)activeInspector.classList.remove('sl-inspector-entering');
    activeInspector=null;
    activeHandler=null;
  }

  function animateInspector(page){
    if(page==='home'){clearActive();return}
    const inspector=document.querySelector('.sl-app .sl-inspector');
    if(!inspector)return;

    clearActive();
    inspector.classList.remove('sl-inspector-entering');
    void inspector.offsetWidth;

    requestAnimationFrame(()=>{
      inspector.classList.add('sl-inspector-entering');
      activeInspector=inspector;
      activeHandler=event=>{
        if(event.target!==inspector||event.animationName!=='slInspectorEnter')return;
        clearActive();
      };
      inspector.addEventListener('animationend',activeHandler);
      fallbackTimer=setTimeout(clearActive,700);
    });
  }

  window.addEventListener('safelight:toolchange',event=>{
    const page=event.detail?.page||'';
    requestAnimationFrame(()=>animateInspector(page));
  });
})();
