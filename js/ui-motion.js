(function(){
  'use strict';
  if(window.safelightUiMotionLoaded)return;
  window.safelightUiMotionLoaded=true;

  const ICONS={
    select:'<path d="M5 3l7.2 15 1.7-6.1L20 10z"/><path d="m13.8 13.4 4 4"/>',
    arrow:'<path d="M4 17 18 7"/><path d="M12 7h6v6"/>',
    line:'<path d="M5 19 19 5"/>',
    rect:'<rect x="5" y="6" width="14" height="12" rx="1.5"/>',
    ellipse:'<ellipse cx="12" cy="12" rx="7" ry="6"/>',
    marker:'<path d="m6 16 8.7-8.7 2 2L8 18H6z"/><path d="M5 20h14"/><path d="m13.5 8.5 2 2"/>',
    text:'<path d="M5 6h14M12 6v12M8 18h8"/>',
    number:'<circle cx="12" cy="12" r="8"/><path d="M10.5 10 12 9v6M10.5 15h3"/>',
    duplicate:'<rect x="8" y="8" width="10" height="10" rx="1.5"/><path d="M6 15H5a1 1 0 0 1-1-1V6a2 2 0 0 1 2-2h8a1 1 0 0 1 1 1v1"/>',
    trash:'<path d="M5 7h14M9 7V4h6v3M8 10v7M12 10v7M16 10v7M7 7l1 13h8l1-13"/>',
    layerUp:'<path d="m12 4 7 4-7 4-7-4z"/><path d="m5 12 7 4 7-4M5 16l7 4 7-4"/><path d="M12 12V7m0 0-2 2m2-2 2 2"/>',
    layerDown:'<path d="m12 4 7 4-7 4-7-4z"/><path d="m5 12 7 4 7-4M5 16l7 4 7-4"/><path d="M12 12v5m0 0-2-2m2 2 2-2"/>',
    undo:'<path d="M9 7 4 12l5 5M5 12h8a6 6 0 1 1 0 12"/>',
    redo:'<path d="m15 7 5 5-5 5M19 12h-8a6 6 0 1 0 0 12"/>',
    clear:'<path d="m7 6 10 10M17 6 7 16"/><path d="M5 20h14"/>',
    expand:'<path d="M9 5H5v4M15 5h4v4M19 15v4h-4M9 19H5v-4"/>',
    center:'<circle cx="12" cy="12" r="5"/><path d="M12 3v4M12 17v4M3 12h4M17 12h4"/>',
    reset:'<path d="M4 7v5h5M5.5 11A7 7 0 1 0 8 5.2"/>',
    help:'<circle cx="12" cy="12" r="8"/><path d="M9.8 9.5a2.4 2.4 0 0 1 4.6 1c0 1.7-2.4 2-2.4 3.5M12 17h.01"/>',
    check:'<path d="m5 12 4 4L19 6"/>',
    plus:'<path d="M12 5v14M5 12h14"/>',
    copy:'<rect x="8" y="8" width="10" height="10" rx="1.5"/><path d="M6 15H5a1 1 0 0 1-1-1V6a2 2 0 0 1 2-2h8a1 1 0 0 1 1 1v1"/>'
  };

  const ANN={
    select:['select','Выбор'],arrow:['arrow','Стрелка'],line:['line','Линия'],rect:['rect','Рамка'],ellipse:['ellipse','Круг'],marker:['marker','Маркер'],text:['text','Текст'],number:['number','Номер']
  };

  const TEXT_ICONS={
    'Дублировать':'duplicate','Удалить':'trash','Выше':'layerUp','Ниже':'layerDown','↶ Отменить':'undo','Отменить':'undo','↷ Повторить':'redo','Повторить':'redo','Очистить всё':'clear',
    'Во весь кадр':'expand','По центру':'center','Центр':'center','Сбросить':'reset','Как пользоваться':'help','Понятно':'check','Добавить':'plus','Копировать':'copy'
  };

  function svg(name){
    const body=ICONS[name];if(!body)return'';
    return '<svg class="sl-ui-icon" viewBox="0 0 24 24" aria-hidden="true">'+body+'</svg>';
  }

  function hasOwnIcon(button){return [...button.children].some(node=>node.classList?.contains('sl-ui-icon'))}

  function addIcon(button,name){
    if(!button||!ICONS[name]||hasOwnIcon(button))return;
    button.insertAdjacentHTML('afterbegin',svg(name));
    button.classList.add('sl-ui-has-icon');
  }

  function enhanceAnnotations(){
    document.querySelectorAll('#panel-annotation [data-ann-tool]').forEach(button=>{
      const item=ANN[button.dataset.annTool];if(!item)return;
      if(button.dataset.slUiIcon===item[0])return;
      button.innerHTML=svg(item[0])+'<span>'+item[1]+'</span>';
      button.dataset.slUiIcon=item[0];
      button.classList.add('sl-ui-has-icon');
    });
    [['ann-duplicate','duplicate'],['ann-delete','trash'],['ann-layer-up','layerUp'],['ann-layer-down','layerDown'],['ann-undo','undo'],['ann-redo','redo'],['ann-clear','clear']].forEach(([id,name])=>addIcon(document.getElementById(id),name));
  }

  function enhanceKnownButtons(){
    const app=document.querySelector('.sl-app');if(!app)return;
    app.querySelectorAll('button').forEach(button=>{
      if(button.querySelector('svg:not(.sl-ui-icon)'))button.classList.add('sl-ui-native-icon');
      const text=(button.textContent||'').trim().replace(/\s+/g,' ');
      if(TEXT_ICONS[text])addIcon(button,TEXT_ICONS[text]);
    });
    document.querySelectorAll('[data-crop-action="full"]').forEach(b=>addIcon(b,'expand'));
    document.querySelectorAll('[data-crop-action="center"],[data-cv-center]').forEach(b=>addIcon(b,'center'));
    document.querySelectorAll('[data-crop-action="reset"]').forEach(b=>addIcon(b,'reset'));
    document.querySelectorAll('[data-crop-action="help"]').forEach(b=>addIcon(b,'help'));
    document.querySelectorAll('[data-crop-tip-close]').forEach(b=>addIcon(b,'check'));
    document.querySelectorAll('.sl-add-thumb').forEach(button=>{
      button.querySelector(':scope > b')?.remove();
      addIcon(button,'plus');
    });
  }

  function enhance(){enhanceAnnotations();enhanceKnownButtons()}

  function restartClass(node,name,duration){
    if(!node)return;node.classList.remove(name);void node.offsetWidth;node.classList.add(name);setTimeout(()=>node.classList.remove(name),duration||400);
  }

  function animateCurrentTool(page){
    setTimeout(()=>{
      enhance();
      const button=[...document.querySelectorAll('.sl-sidebar .sl-tool')].find(item=>item.dataset.page===page);
      restartClass(button,'sl-ui-tool-pulse',390);
      const panel=document.querySelector('#sl-inspector-panels .panel.active');
      restartClass(panel,'sl-ui-panel-enter',480);
    },0);
  }

  document.addEventListener('pointerdown',event=>{
    const button=event.target.closest('.sl-app button');if(!button||button.disabled)return;
    restartClass(button,'sl-ui-pop',280);
  },true);

  window.addEventListener('safelight:toolchange',event=>animateCurrentTool(event.detail?.page||''));

  function boot(attempt){
    if(!document.querySelector('.sl-app')){if((attempt||0)<80)setTimeout(()=>boot((attempt||0)+1),50);return}
    enhance();
    const active=document.querySelector('.sl-sidebar .sl-tool.active');if(active)animateCurrentTool(active.dataset.page||'');
  }
  boot(0);
})();
