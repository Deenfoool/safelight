(function(){
  'use strict';
  if(window.safelightInspectorMotionLoaded)return;
  window.safelightInspectorMotionLoaded=true;

  let timer=0;
  function animateInspector(page){
    if(page==='home')return;
    const inspector=document.querySelector('.sl-app .sl-inspector');
    if(!inspector)return;
    clearTimeout(timer);
    inspector.classList.remove('sl-inspector-entering');
    void inspector.offsetWidth;
    requestAnimationFrame(()=>{
      inspector.classList.add('sl-inspector-entering');
      timer=setTimeout(()=>inspector.classList.remove('sl-inspector-entering'),340);
    });
  }

  window.addEventListener('safelight:toolchange',event=>{
    const page=event.detail?.page||'';
    requestAnimationFrame(()=>animateInspector(page));
  });
})();
