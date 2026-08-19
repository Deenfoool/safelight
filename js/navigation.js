(function(){
'use strict';
const nav=document.querySelector('.top-nav-links');
const panels={compress:document.getElementById('panel-compress'),slice:document.getElementById('panel-slice'),convert:document.getElementById('panel-convert'),resize:document.getElementById('panel-resize'),crop:document.getElementById('panel-crop'),adjust:document.getElementById('panel-adjust')};
const title=document.querySelector('#workspace .page-title h1'),description=document.querySelector('#workspace .page-title p');
const info={compress:['Сжатие изображений','Уменьшайте вес PNG, JPEG и WebP с контролем качества.'],slice:['Нарезка изображений','Разделяйте изображение на сетку или полосы и скачивайте ZIP-архив.'],convert:['Конвертация изображений','Конвертируйте PNG, JPEG, WebP, HEIC и PDF прямо в браузере.'],resize:['Изменение размера','Меняйте разрешение изображения с сохранением пропорций или свободно.'],crop:['Обрезка изображений','Тяните края и углы рамки прямо на изображении и сразу видьте будущий кадр.'],adjust:['Расширенная коррекция','Экспозиция, света, тени, баланс белого, гамма, резкость и эффекты.']};
const advancedIds=new Set(['transform','watermark','batch','metadata','favicon']);
function closeMenus(){document.querySelectorAll('.nav-group.open').forEach(g=>{g.classList.remove('open');g.querySelector('.nav-group-toggle')?.setAttribute('aria-expanded','false')})}
function refreshGroups(active){document.querySelectorAll('.nav-group').forEach(g=>{const ids=(g.dataset.groupIds||'').split(',');const selected=(!!active&&ids.includes(active))||[...g.querySelectorAll('.nav-dropdown-item')].some(b=>b.classList.contains('active'));g.classList.toggle('active',!!selected)})}
function setBasicTool(tool){document.querySelectorAll('.panel').forEach(p=>p.classList.remove('active'));panels[tool]?.classList.add('active');if(title&&info[tool])title.textContent=info[tool][0];if(description&&info[tool])description.textContent=info[tool][1];const grid=document.getElementById('gridOverlay');if(grid)grid.style.display=tool==='slice'?'block':'none'}
function syncHomeNav(page){if(nav)nav.style.display=page==='home'?'none':''}
function emitToolChange(page){window.dispatchEvent(new CustomEvent('safelight:toolchange',{detail:{page}}))}
function activate(page){
  closeMenus();
  syncHomeNav(page);
  document.body.classList.remove('sl-palette-active','sl-privacy-active','sl-crop-active','sl-annotation-active');
  document.querySelectorAll('.top-nav-link').forEach(b=>b.classList.toggle('active',b.dataset.page===page));
  document.body.classList.toggle('page-home',page==='home');
  document.body.classList.toggle('page-tool',page!=='home');

  if(page==='home'){
    document.querySelectorAll('.panel').forEach(p=>p.classList.remove('active'));
    refreshGroups('home');
    window.scrollTo({top:0,behavior:'smooth'});
    emitToolChange('home');
    return;
  }

  if(advancedIds.has(page)&&window.safelightSetAdvanced){
    window.safelightSetAdvanced(page);
    refreshGroups(page);
    emitToolChange(page);
    return;
  }

  setBasicTool(page);
  refreshGroups(page);
  window.scrollTo({top:0,behavior:'smooth'});
  emitToolChange(page);
}
function makeGroup(label,icon,ids){const wrap=document.createElement('div');wrap.className='nav-group';wrap.dataset.groupIds=ids.join(',');const toggle=document.createElement('button');toggle.type='button';toggle.className='nav-group-toggle';toggle.setAttribute('aria-expanded','false');toggle.innerHTML='<span class="nav-group-icon"><svg viewBox="0 0 24 24"><path d="'+icon+'"/></svg></span><span>'+label+'</span><span class="nav-chevron">⌄</span>';const menu=document.createElement('div');menu.className='nav-dropdown';menu.setAttribute('role','menu');ids.forEach(id=>{const item=nav.querySelector('.top-nav-link[data-page="'+id+'"]');if(!item)return;item.classList.add('nav-dropdown-item');item.setAttribute('role','menuitem');menu.appendChild(item)});toggle.addEventListener('click',e=>{e.stopPropagation();const wasOpen=wrap.classList.contains('open');closeMenus();if(!wasOpen){wrap.classList.add('open');toggle.setAttribute('aria-expanded','true')}});wrap.append(toggle,menu);nav.appendChild(wrap)}
function buildGroups(){if(!nav||nav.dataset.grouped)return;const buttons=[...nav.querySelectorAll(':scope > .top-nav-link')],ids=new Set(buttons.map(b=>b.dataset.page)),required=['compress','slice','convert','resize','crop','adjust','transform','watermark','batch','metadata','favicon'];if(!required.every(id=>ids.has(id)))return;nav.dataset.grouped='1';nav.querySelector(':scope > [data-page="home"]')?.addEventListener('click',e=>{e.preventDefault();activate('home')});[['Основные','M4 5h16v14H4zM8 9h8M8 13h5',['compress','slice','convert','resize','crop']],['Редактирование','M4 20 8 19l10-10-3-3L5 16zM14 5l3 3',['adjust','transform','watermark']],['Пакетная обработка','M4 5h7v6H4zM13 5h7v6h-7zM4 13h7v6H4zM13 13h7v6h-7z',['batch']],['Инструменты','M12 3 14 8l5 .5-4 3.5 1.5 5L12 14l-4.5 3 1.5-5-4-3.5L10 8z',['metadata','favicon']]].forEach(g=>makeGroup(g[0],g[1],g[2]));nav.querySelectorAll('.nav-dropdown-item').forEach(item=>item.addEventListener('click',e=>{e.preventDefault();e.stopPropagation();activate(item.dataset.page)}));refreshGroups('home')}
const hero=document.getElementById('hero-cta');if(hero)hero.addEventListener('click',()=>{activate('compress');setTimeout(()=>{const add=document.getElementById('sl-add-images');if(add)add.click();else document.getElementById('dropzone')?.click()},250)});
document.addEventListener('click',e=>{if(!e.target.closest('.nav-group'))closeMenus()});const observer=new MutationObserver(buildGroups);if(nav)observer.observe(nav,{childList:true});[0,150,500].forEach(d=>setTimeout(buildGroups,d));window.safelightActivate=activate;activate('home');
function loadScript(src,onload){const script=document.createElement('script');script.src=src;script.onerror=()=>console.error('Safelight: failed to load',src);if(onload)script.onload=onload;document.body.appendChild(script)}
function loadStyle(src){if([...document.styleSheets].some(s=>s.href&&s.href.includes(src.split('?')[0])))return;const link=document.createElement('link');link.rel='stylesheet';link.href=src;document.head.appendChild(link)}
loadStyle('css/visual-polish.css?v=5');loadScript('js/visual-polish.js?v=4');
loadScript('js/advanced.js?v=13',()=>{
  loadStyle('css/live-editor.css?v=5');
  loadStyle('css/direct-manipulation.css?v=3');
  loadStyle('css/editor-polish.css?v=2');
  loadStyle('css/favicon-tools.css?v=3');
  loadStyle('css/adjust-tools.css?v=1');
  loadStyle('css/canvas-tools.css?v=2');
  loadStyle('css/crop-tools.css?v=1');
  loadStyle('css/apply-tools.css?v=1');
  loadStyle('css/inspector-motion.css?v=2');
  loadStyle('css/annotation-tools.css?v=2');
  loadStyle('css/ui-motion.css?v=2');
  loadScript('js/ui-shell.js?v=5',()=>{
    loadScript('js/inspector-motion.js?v=3');
    loadScript('js/source-cleanup.js?v=2',()=>{
      loadScript('js/live-editor.js?v=7',()=>{
        loadScript('js/preview-render-guard.js?v=2',()=>{
          loadScript('js/crop-tools.js?v=2',()=>{
            loadScript('js/adjust-tools.js?v=1',()=>{
              loadScript('js/canvas-tools.js?v=2',()=>{
                loadScript('js/annotation-tools.js?v=1',()=>{
                  loadScript('js/annotation-ui.js?v=1',()=>{
                    loadScript('js/favicon-tools.js?v=1',()=>{
                      loadScript('js/favicon-background.js?v=1',()=>{
                        loadScript('js/direct-manipulation.js?v=4',()=>{
                          loadScript('js/editor-polish.js?v=5',()=>{
                            loadScript('js/apply-tools.js?v=3',()=>{
                              loadScript('js/ui-motion.js?v=2');
                            });
                          });
                        });
                      });
                    });
                  });
                });
              });
            });
          });
        });
      });
    });
  });
});
})();