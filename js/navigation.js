(function(){
'use strict';
const nav=document.querySelector('.top-nav-links');
const panels={compress:document.getElementById('panel-compress'),slice:document.getElementById('panel-slice'),convert:document.getElementById('panel-convert'),resize:document.getElementById('panel-resize'),crop:document.getElementById('panel-crop'),adjust:document.getElementById('panel-adjust')};
const title=document.querySelector('#workspace .page-title h1'),description=document.querySelector('#workspace .page-title p');
const info={compress:['Сжатие изображений','Уменьшайте вес PNG, JPEG и WebP с контролем качества.'],slice:['Нарезка изображений','Разделяйте изображение на сетку или полосы и скачивайте ZIP-архив.'],convert:['Конвертация изображений','Конвертируйте PNG, JPEG, WebP, HEIC и PDF прямо в браузере.'],resize:['Изменение размера','Меняйте разрешение изображения с сохранением пропорций или свободно.'],crop:['Обрезка изображений','Выравнивайте горизонт, используйте композиционные сетки и задавайте кадр точно в пикселях.'],adjust:['Расширенная коррекция','Экспозиция, света, тени, баланс белого, гамма, резкость и эффекты.']};
const advancedIds=new Set(['transform','watermark','background','batch','metadata','favicon']);
let editorRuntimePromise=null;
function closeMenus(){document.querySelectorAll('.nav-group.open').forEach(g=>{g.classList.remove('open');g.querySelector('.nav-group-toggle')?.setAttribute('aria-expanded','false')})}
function refreshGroups(active){document.querySelectorAll('.nav-group').forEach(g=>{const ids=(g.dataset.groupIds||'').split(',');const selected=(!!active&&ids.includes(active))||[...g.querySelectorAll('.nav-dropdown-item')].some(b=>b.classList.contains('active'));g.classList.toggle('active',!!selected)})}
function setBasicTool(tool){document.querySelectorAll('.panel').forEach(p=>p.classList.remove('active'));panels[tool]?.classList.add('active');if(title&&info[tool])title.textContent=info[tool][0];if(description&&info[tool])description.textContent=info[tool][1];const grid=document.getElementById('gridOverlay');if(grid)grid.style.display=tool==='slice'?'block':'none'}
function syncHomeNav(page){if(nav)nav.style.display=page==='home'?'none':''}
function emitToolChange(page){window.dispatchEvent(new CustomEvent('safelight:toolchange',{detail:{page}}))}
async function activate(page){
  if(page!=='home'){
    try{await ensureEditorRuntime()}catch(error){
      console.error('Safelight: editor runtime unavailable',error);
      const heroStatus=document.getElementById('hero-runtime-status');
      if(heroStatus)heroStatus.textContent='Не удалось загрузить редактор. Проверьте соединение и попробуйте ещё раз.';
      return false;
    }
  }
  closeMenus();
  syncHomeNav(page);
  document.body.classList.remove('sl-palette-active','sl-privacy-active','sl-crop-active','sl-annotation-active','sl-bg-active');
  document.querySelectorAll('.top-nav-link').forEach(b=>b.classList.toggle('active',b.dataset.page===page));
  document.body.classList.toggle('page-home',page==='home');
  document.body.classList.toggle('page-tool',page!=='home');

  if(page==='home'){
    document.querySelectorAll('.panel').forEach(p=>p.classList.remove('active'));
    refreshGroups('home');
    window.scrollTo({top:0,behavior:'smooth'});
    emitToolChange('home');
    return true;
  }

  if(advancedIds.has(page)&&window.safelightSetAdvanced){
    window.safelightSetAdvanced(page);
    refreshGroups(page);
    emitToolChange(page);
    return true;
  }

  setBasicTool(page);
  refreshGroups(page);
  window.scrollTo({top:0,behavior:'smooth'});
  emitToolChange(page);
  return true;
}
function makeGroup(label,icon,ids){const wrap=document.createElement('div');wrap.className='nav-group';wrap.dataset.groupIds=ids.join(',');const toggle=document.createElement('button');toggle.type='button';toggle.className='nav-group-toggle';toggle.setAttribute('aria-expanded','false');toggle.innerHTML='<span class="nav-group-icon"><svg viewBox="0 0 24 24"><path d="'+icon+'"/></svg></span><span>'+label+'</span><span class="nav-chevron">⌄</span>';const menu=document.createElement('div');menu.className='nav-dropdown';menu.setAttribute('role','menu');ids.forEach(id=>{const item=nav.querySelector('.top-nav-link[data-page="'+id+'"]');if(!item)return;item.classList.add('nav-dropdown-item');item.setAttribute('role','menuitem');menu.appendChild(item)});toggle.addEventListener('click',e=>{e.stopPropagation();const wasOpen=wrap.classList.contains('open');closeMenus();if(!wasOpen){wrap.classList.add('open');toggle.setAttribute('aria-expanded','true')}});wrap.append(toggle,menu);nav.appendChild(wrap)}
function buildGroups(){if(!nav||nav.dataset.grouped)return;const buttons=[...nav.querySelectorAll(':scope > .top-nav-link')],ids=new Set(buttons.map(b=>b.dataset.page)),required=['compress','slice','convert','resize','crop','adjust','transform','watermark','background','batch','metadata','favicon'];if(!required.every(id=>ids.has(id)))return;nav.dataset.grouped='1';nav.querySelector(':scope > [data-page="home"]')?.addEventListener('click',e=>{e.preventDefault();activate('home')});[['Основные','M4 5h16v14H4zM8 9h8M8 13h5',['compress','slice','convert','resize','crop']],['Редактирование','M4 20 8 19l10-10-3-3L5 16zM14 5l3 3',['adjust','transform','background','watermark']],['Пакетная обработка','M4 5h7v6H4zM13 5h7v6h-7zM4 13h7v6H4zM13 13h7v6h-7z',['batch']],['Инструменты','M12 3 14 8l5 .5-4 3.5 1.5 5L12 14l-4.5 3 1.5-5-4-3.5L10 8z',['metadata','favicon']]].forEach(g=>makeGroup(g[0],g[1],g[2]));nav.querySelectorAll('.nav-dropdown-item').forEach(item=>item.addEventListener('click',e=>{e.preventDefault();e.stopPropagation();activate(item.dataset.page)}));refreshGroups('home')}
const hero=document.getElementById('hero-cta');if(hero)hero.addEventListener('click',()=>{
  /* Open the native picker while the trusted user gesture is still active.
     The editor runtime can finish loading while the picker is on screen. */
  document.getElementById('fileInput')?.click();
  hero.disabled=true;hero.setAttribute('aria-busy','true');
  activate('compress').finally(()=>{hero.disabled=false;hero.removeAttribute('aria-busy')});
});
document.addEventListener('click',e=>{if(!e.target.closest('.nav-group'))closeMenus()});const observer=new MutationObserver(buildGroups);if(nav)observer.observe(nav,{childList:true});[0,150,500].forEach(d=>setTimeout(buildGroups,d));window.safelightActivate=activate;activate('home');
function loadScriptOnce(src){return new Promise((resolve,reject)=>{const script=document.createElement('script');script.src=src;script.async=false;script.onload=()=>resolve();script.onerror=()=>{script.remove();reject(new Error('Не удалось загрузить '+src))};document.body.appendChild(script)})}
async function loadScript(src,retries=1){let lastError=null;for(let attempt=0;attempt<=retries;attempt++){try{const retrySrc=attempt?src+(src.includes('?')?'&':'?')+'retry='+attempt:src;await loadScriptOnce(retrySrc);return}catch(error){lastError=error;if(attempt<retries)await new Promise(resolve=>setTimeout(resolve,180))}}throw lastError}
function loadStyle(src){if([...document.styleSheets].some(s=>s.href&&s.href.includes(src.split('?')[0])))return;const link=document.createElement('link');link.rel='stylesheet';link.href=src;document.head.appendChild(link)}
function ensureEditorRuntime(){
  if(editorRuntimePromise)return editorRuntimePromise;
  const styles=[
    'css/live-editor.css?v=5','css/direct-manipulation.css?v=3','css/watermark-tools.css?v=1',
    'css/editor-polish.css?v=2','css/favicon-tools.css?v=3','css/adjust-tools.css?v=3',
    'css/canvas-tools.css?v=2','css/crop-tools.css?v=2','css/background-removal.css?v=1',
    'css/apply-tools.css?v=2','css/inspector-motion.css?v=2','css/annotation-tools.css?v=2',
    'css/ui-motion.css?v=2'
  ];
  styles.forEach(loadStyle);
  editorRuntimePromise=(async()=>{
    await loadScript('js/advanced.js?v=15');
    await loadScript('js/ui-shell.js?v=7');
    await loadScript('js/metadata-tools.js?v=2');
    await loadScript('js/privacy-effects.js?v=4');
    await loadScript('js/palette-tools.js?v=2');
    await loadScript('js/background-removal.js?v=1');
    await loadScript('js/background-removal-shell.js?v=1');
    await loadScript('js/inspector-motion.js?v=3');
    await loadScript('js/source-cleanup.js?v=2');
    await loadScript('js/live-editor.js?v=7');
    await loadScript('js/preview-render-guard.js?v=2');
    await loadScript('js/crop-tools.js?v=3');
    await loadScript('js/adjust-tools.js?v=2');
    await loadScript('js/canvas-tools.js?v=2');
    await loadScript('js/annotation-tools.js?v=1');
    await loadScript('js/annotation-ui.js?v=1');
    await loadScript('js/favicon-tools.js?v=1');
    await loadScript('js/favicon-background.js?v=1');
    await loadScript('js/direct-manipulation.js?v=5');
    await loadScript('js/watermark-renderer.js?v=1');
    await loadScript('js/editor-polish.js?v=5');
    await loadScript('js/apply-tools.js?v=6');
    await loadScript('js/ui-motion.js?v=2');
  })().catch(error=>{editorRuntimePromise=null;throw error});
  return editorRuntimePromise;
}
loadStyle('css/visual-polish.css?v=6');
loadStyle('css/theme-settings.css?v=1');
loadStyle('css/theme-transition.css?v=1');
loadScript('js/theme-settings.js?v=1').catch(error=>console.error(error));
loadScript('js/theme-transition.js?v=1').catch(error=>console.error(error));
loadScript('js/visual-polish.js?v=5').catch(error=>console.error(error));
})();
