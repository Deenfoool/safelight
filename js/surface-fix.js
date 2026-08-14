(function(){
'use strict';
if(window.safelightSurfaceFixLoaded)return;
window.safelightSurfaceFixLoaded=true;

const $=id=>document.getElementById(id);

function ensureLiveCanvas(){
  const wrap=$('previewWrap');
  if(!wrap)return null;
  let live=$('sl-live-canvas');
  if(!live){
    live=document.createElement('canvas');
    live.id='sl-live-canvas';
    live.className='sl-live-canvas';
    live.setAttribute('aria-label','Текущий результат обработки');
    wrap.appendChild(live);
  }
  return live;
}

function paintSourceIntoLive(){
  const preview=$('previewImg');
  const wrap=$('previewWrap');
  if(!preview?.src||!wrap||!preview.naturalWidth||!preview.naturalHeight)return false;
  const live=ensureLiveCanvas();
  if(!live)return false;
  live.width=preview.naturalWidth;
  live.height=preview.naturalHeight;
  const ctx=live.getContext('2d');
  ctx.clearRect(0,0,live.width,live.height);
  ctx.drawImage(preview,0,0,live.width,live.height);
  wrap.classList.add('sl-live-ready');
  return true;
}

function enforcePalette(){
  const wrap=$('previewWrap');
  if(!wrap)return;
  wrap.classList.remove('sl-live-ready');
}

function setMode(page){
  const palette=page==='palette';
  const privacy=page==='privacy';
  document.body.classList.toggle('sl-palette-active',palette);
  document.body.classList.toggle('sl-privacy-active',privacy);

  if(palette){
    enforcePalette();
    requestAnimationFrame(enforcePalette);
    setTimeout(enforcePalette,0);
    setTimeout(enforcePalette,80);
  }

  if(privacy){
    paintSourceIntoLive();
    requestAnimationFrame(paintSourceIntoLive);
  }
}

/* Capture the sidebar click before tool listeners run so no duplicate frame can be painted. */
document.addEventListener('click',event=>{
  const tool=event.target.closest?.('.sl-sidebar [data-page]');
  if(!tool)return;
  const page=tool.dataset.page;
  if(page==='privacy'||page==='palette')setMode(page);
},true);

window.addEventListener('safelight:toolchange',event=>{
  const page=event.detail?.page||'';
  setMode(page);
});

function boot(){
  const preview=$('previewImg');
  if(!preview){setTimeout(boot,60);return;}

  preview.addEventListener('load',()=>{
    if(document.body.classList.contains('sl-privacy-active'))paintSourceIntoLive();
    if(document.body.classList.contains('sl-palette-active'))enforcePalette();
  });

  new MutationObserver(()=>{
    if(document.body.classList.contains('sl-privacy-active'))requestAnimationFrame(paintSourceIntoLive);
    if(document.body.classList.contains('sl-palette-active'))requestAnimationFrame(enforcePalette);
  }).observe(preview,{attributes:true,attributeFilter:['src']});

  /* Repair stale classes after PWA/back-forward restoration. */
  const activePanel=document.querySelector('#sl-inspector-panels .panel.active')||document.querySelector('.panel.active');
  const page=activePanel?.id?.replace('panel-','')||'';
  if(page==='privacy'||page==='palette')setMode(page);
}

boot();
})();
