(function(){
  'use strict';
  if(window.safelightThemeTransitionLoaded)return;
  window.safelightThemeTransitionLoaded=true;

  const root=document.documentElement;
  const reduceMotion=()=>window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches;
  let busy=false;

  function origin(){
    const toggle=document.getElementById('sl-settings-toggle');
    const rect=toggle?.getBoundingClientRect();
    if(rect&&rect.width&&rect.height)return{x:rect.left+rect.width/2,y:rect.top+rect.height/2};
    return{x:window.innerWidth-40,y:36};
  }

  function radius(x,y){
    return Math.ceil(Math.hypot(Math.max(x,window.innerWidth-x),Math.max(y,window.innerHeight-y)))+4;
  }

  function closeSettings(){
    document.getElementById('sl-settings-wrap')?.classList.remove('open');
    document.getElementById('sl-settings-toggle')?.setAttribute('aria-expanded','false');
  }

  function setTransitionVars(x,y,r,next){
    root.style.setProperty('--sl-theme-x',x+'px');
    root.style.setProperty('--sl-theme-y',y+'px');
    root.style.setProperty('--sl-theme-radius',r+'px');
    root.classList.add(next==='dark'?'sl-theme-to-dark':'sl-theme-to-light','sl-theme-transitioning');
  }

  function clearTransitionState(){
    root.classList.remove('sl-theme-to-dark','sl-theme-to-light','sl-theme-transitioning');
    root.style.removeProperty('--sl-theme-x');
    root.style.removeProperty('--sl-theme-y');
    root.style.removeProperty('--sl-theme-radius');
    busy=false;
  }

  async function fallback(next,x,y,r){
    const layer=document.createElement('div');
    layer.className='sl-theme-fallback-layer';
    const toDark=next==='dark';
    layer.style.background=toDark?'#09090b':'#09090b';
    document.body.appendChild(layer);

    try{
      if(toDark){
        layer.style.clipPath=`circle(0px at ${x}px ${y}px)`;
        const animation=layer.animate(
          [{clipPath:`circle(0px at ${x}px ${y}px)`},{clipPath:`circle(${r}px at ${x}px ${y}px)`}],
          {duration:560,easing:'cubic-bezier(.22,1,.36,1)',fill:'forwards'}
        );
        await animation.finished.catch(()=>{});
        window.safelightTheme?.set(next);
      }else{
        layer.style.clipPath=`circle(${r}px at ${x}px ${y}px)`;
        window.safelightTheme?.set(next);
        const animation=layer.animate(
          [{clipPath:`circle(${r}px at ${x}px ${y}px)`},{clipPath:`circle(0px at ${x}px ${y}px)`}],
          {duration:520,easing:'cubic-bezier(.4,0,.2,1)',fill:'forwards'}
        );
        await animation.finished.catch(()=>{});
      }
    }finally{
      layer.remove();
      clearTransitionState();
    }
  }

  function switchTheme(next){
    const current=root.dataset.theme||'dark';
    if(busy||next===current||!window.safelightTheme?.set)return;

    const point=origin();
    const r=radius(point.x,point.y);
    busy=true;
    closeSettings();

    if(reduceMotion()){
      window.safelightTheme.set(next);
      busy=false;
      return;
    }

    setTransitionVars(point.x,point.y,r,next);

    if(typeof document.startViewTransition==='function'){
      let transition;
      try{
        transition=document.startViewTransition(()=>window.safelightTheme.set(next));
      }catch(_){
        fallback(next,point.x,point.y,r);
        return;
      }
      Promise.resolve(transition.finished).catch(()=>{}).finally(clearTransitionState);
      return;
    }

    fallback(next,point.x,point.y,r);
  }

  document.addEventListener('click',event=>{
    const button=event.target.closest?.('[data-sl-theme-choice]');
    if(!button)return;
    const next=button.dataset.slThemeChoice;
    const current=root.dataset.theme||'dark';
    if(next===current)return;
    event.preventDefault();
    event.stopImmediatePropagation();
    switchTheme(next);
  },true);
})();
