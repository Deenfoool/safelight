(function(){
  'use strict';
  if(window.safelightCustomScrollbarsLoaded)return;
  window.safelightCustomScrollbarsLoaded=true;

  const configs=[
    {selector:'.sl-inspector',axis:'y'},
    {selector:'.sl-sidebar',axis:'y'},
    {selector:'.sl-filmstrip',axis:'x'}
  ];
  const instances=[];
  let syncRaf=0;

  function clamp(v,min,max){return Math.max(min,Math.min(max,v))}

  function make(target,axis){
    if(!target||target.dataset.slCustomScroll==='1')return null;
    target.dataset.slCustomScroll='1';
    target.classList.add('sl-custom-scroll-target');

    const rail=document.createElement('div');
    rail.className='sl-cscroll sl-cscroll-'+axis;
    rail.setAttribute('aria-hidden','true');
    const thumb=document.createElement('div');
    thumb.className='sl-cscroll-thumb';
    rail.appendChild(thumb);
    document.body.appendChild(rail);

    const state={target,axis,rail,thumb,drag:null,resize:null};

    function metrics(){
      const rect=target.getBoundingClientRect();
      const vertical=axis==='y';
      const client=vertical?target.clientHeight:target.clientWidth;
      const scroll=vertical?target.scrollHeight:target.scrollWidth;
      const pos=vertical?target.scrollTop:target.scrollLeft;
      return{rect,client,scroll,pos,vertical};
    }

    function update(){
      const m=metrics();
      const visible=m.client>0&&m.scroll>m.client+1&&m.rect.width>0&&m.rect.height>0&&m.rect.bottom>0&&m.rect.right>0&&m.rect.top<innerHeight&&m.rect.left<innerWidth;
      rail.classList.toggle('show',visible);
      if(!visible)return;

      if(m.vertical){
        const pad=7,track=Math.max(1,m.rect.height-pad*2);
        const thumbSize=clamp(track*(m.client/m.scroll),42,track);
        const maxThumb=Math.max(0,track-thumbSize);
        const maxScroll=Math.max(1,m.scroll-m.client);
        const offset=maxThumb*(m.pos/maxScroll);
        rail.style.left=Math.round(m.rect.right-11)+'px';
        rail.style.top=Math.round(m.rect.top+pad)+'px';
        rail.style.width='8px';
        rail.style.height=Math.round(track)+'px';
        thumb.style.width='100%';
        thumb.style.height=Math.round(thumbSize)+'px';
        thumb.style.transform='translate3d(0,'+Math.round(offset)+'px,0)';
      }else{
        const pad=8,track=Math.max(1,m.rect.width-pad*2);
        const thumbSize=clamp(track*(m.client/m.scroll),52,track);
        const maxThumb=Math.max(0,track-thumbSize);
        const maxScroll=Math.max(1,m.scroll-m.client);
        const offset=maxThumb*(m.pos/maxScroll);
        rail.style.left=Math.round(m.rect.left+pad)+'px';
        rail.style.top=Math.round(m.rect.bottom-11)+'px';
        rail.style.width=Math.round(track)+'px';
        rail.style.height='8px';
        thumb.style.height='100%';
        thumb.style.width=Math.round(thumbSize)+'px';
        thumb.style.transform='translate3d('+Math.round(offset)+'px,0,0)';
      }
    }

    function schedule(){cancelAnimationFrame(syncRaf);syncRaf=requestAnimationFrame(syncAll)}
    target.addEventListener('scroll',schedule,{passive:true});

    thumb.addEventListener('pointerdown',event=>{
      event.preventDefault();
      event.stopPropagation();
      const m=metrics(),rr=rail.getBoundingClientRect(),tr=thumb.getBoundingClientRect();
      state.drag={start:m.vertical?event.clientY:event.clientX,startScroll:m.pos,track:m.vertical?rr.height:rr.width,thumb:m.vertical?tr.height:tr.width,maxScroll:Math.max(0,m.scroll-m.client)};
      thumb.setPointerCapture?.(event.pointerId);
      document.body.classList.add('sl-cscroll-dragging');
    });

    thumb.addEventListener('pointermove',event=>{
      if(!state.drag)return;
      const d=state.drag;
      const current=axis==='y'?event.clientY:event.clientX;
      const delta=current-d.start;
      const travel=Math.max(1,d.track-d.thumb);
      const next=d.startScroll+(delta/travel)*d.maxScroll;
      if(axis==='y')target.scrollTop=clamp(next,0,d.maxScroll);else target.scrollLeft=clamp(next,0,d.maxScroll);
    });

    function finish(event){
      if(!state.drag)return;
      state.drag=null;
      document.body.classList.remove('sl-cscroll-dragging');
      try{thumb.releasePointerCapture?.(event.pointerId)}catch(_){}
    }
    thumb.addEventListener('pointerup',finish);
    thumb.addEventListener('pointercancel',finish);

    rail.addEventListener('pointerdown',event=>{
      if(event.target===thumb)return;
      const m=metrics(),rr=rail.getBoundingClientRect(),tr=thumb.getBoundingClientRect();
      const pointer=m.vertical?event.clientY-rr.top:event.clientX-rr.left;
      const thumbSize=m.vertical?tr.height:tr.width;
      const travel=Math.max(1,(m.vertical?rr.height:rr.width)-thumbSize);
      const ratio=clamp((pointer-thumbSize/2)/travel,0,1);
      const maxScroll=Math.max(0,m.scroll-m.client);
      if(m.vertical)target.scrollTo({top:ratio*maxScroll,behavior:'smooth'});else target.scrollTo({left:ratio*maxScroll,behavior:'smooth'});
    });

    if('ResizeObserver'in window){state.resize=new ResizeObserver(schedule);state.resize.observe(target)}
    return Object.assign(state,{update});
  }

  function discover(){
    configs.forEach(config=>document.querySelectorAll(config.selector).forEach(target=>{
      if(target.dataset.slCustomScroll==='1')return;
      const instance=make(target,config.axis);if(instance)instances.push(instance);
    }));
    syncAll();
  }

  function syncAll(){
    instances.forEach(instance=>{
      if(!instance.target.isConnected){instance.rail.remove();return}
      instance.update();
    });
  }

  function animateSync(){
    const start=performance.now();
    function frame(now){syncAll();if(now-start<460)requestAnimationFrame(frame)}
    requestAnimationFrame(frame);
  }

  window.addEventListener('resize',()=>requestAnimationFrame(syncAll),{passive:true});
  window.addEventListener('safelight:toolchange',()=>{setTimeout(discover,0);animateSync()});
  new MutationObserver(()=>requestAnimationFrame(discover)).observe(document.documentElement,{childList:true,subtree:true});

  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',discover,{once:true});else discover();
})();
