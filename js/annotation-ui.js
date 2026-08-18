(function(){
  'use strict';
  if(window.safelightAnnotationUiLoaded)return;
  window.safelightAnnotationUiLoaded=true;
  const $=id=>document.getElementById(id);
  const labels={arrow:'стрелка',line:'линия',rect:'прямоугольник',ellipse:'круг',marker:'маркер',text:'текст',number:'номер'};

  function active(){return !!$('panel-annotation')?.classList.contains('active')}
  function state(){return window.safelightAnnotationTools?.state||null}
  function selected(){const s=state();return s?.objects?.find(o=>o.id===s.selectedId)||null}
  function syncInspector(){
    if(!active())return;
    const title=$('sl-inspector-title'),desc=$('sl-inspector-desc');
    if(title)title.textContent='Аннотации';
    if(desc)desc.textContent='Текст, стрелки, линии, фигуры, маркеры и нумерация прямо поверх изображения.';
  }
  function syncSelection(){
    if(!active())return;const s=state(),o=selected();syncInspector();if(!s)return;
    const label=$('ann-selected-label');
    if(label){const index=o?s.objects.findIndex(x=>x.id===o.id):-1;label.textContent=o?`${labels[o.type]||o.type} · слой ${index+1}/${s.objects.length}`:'ничего не выбрано'}
    if(!o)return;
    s.color=o.color||s.color;s.thickness=o.thickness??s.thickness;s.opacity=o.opacity??s.opacity;s.fontSize=o.fontSize??s.fontSize;s.fill=!!o.fill;if(o.type==='text')s.text=o.text||'';
    if($('ann-color'))$('ann-color').value=s.color;
    if($('ann-thickness'))$('ann-thickness').value=String(s.thickness);
    if($('ann-opacity'))$('ann-opacity').value=String(Math.round(s.opacity*100));
    if($('ann-font'))$('ann-font').value=String(Math.round(s.fontSize));
    if($('ann-fill'))$('ann-fill').checked=s.fill;
    if($('ann-text')&&o.type==='text')$('ann-text').value=s.text;
    if($('ann-thickness-val'))$('ann-thickness-val').textContent=Math.round(s.thickness)+' px';
    if($('ann-opacity-val'))$('ann-opacity-val').textContent=Math.round(s.opacity*100)+'%';
    if($('ann-font-val'))$('ann-font-val').textContent=Math.round(s.fontSize)+' px';
  }

  window.addEventListener('safelight:toolchange',e=>{if(e.detail?.page==='annotation')setTimeout(syncSelection,20)});
  document.addEventListener('pointerdown',e=>{if(e.target.closest('#sl-ann-surface'))setTimeout(syncSelection,0)},true);
  document.addEventListener('click',e=>{if(e.target.closest('#panel-annotation'))setTimeout(syncSelection,0)},true);
})();
