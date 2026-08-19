(function(){
  'use strict';
  if(window.safelightBackgroundRemovalShellLoaded)return;
  window.safelightBackgroundRemovalShellLoaded=true;

  const $=id=>document.getElementById(id);
  function current(){return document.querySelector('#sl-inspector-panels .panel.active')?.id==='panel-background'}
  function syncText(){if(!current())return;const title=$('sl-inspector-title'),desc=$('sl-inspector-desc');if(title)title.textContent='Удаление фона';if(desc)desc.textContent='Цветовой ключ, Magic Wand, кисть «стереть / вернуть» и Feather края.'}
  function installSidebar(){
    const host=$('sl-tool-nav'),source=document.querySelector('.top-nav-link[data-page="background"]');if(!host||!source)return false;if(host.querySelector('.sl-tool[data-page="background"]'))return true;
    const group=[...host.querySelectorAll('.sl-nav-group')].find(item=>item.querySelector('.sl-nav-label')?.textContent?.trim()==='Редактирование');if(!group)return false;
    const button=source.cloneNode(true);button.classList.remove('nav-dropdown-item','advanced-nav');button.classList.add('sl-tool');button.removeAttribute('role');button.onclick=null;
    button.addEventListener('click',event=>{event.preventDefault();window.safelightActivate?.('background')});group.appendChild(button);return true
  }
  function baseName(){return(($('meta-name')?.textContent||'safelight').trim().replace(/\.[^.]+$/,'')||'safelight')}
  function canvasBlob(canvas,type,quality){return new Promise((resolve,reject)=>canvas.toBlob(blob=>blob?resolve(blob):reject(new Error('Не удалось подготовить файл')),type,quality))}
  function download(blob,name){const url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=name;document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),4000)}
  function hint(text){const el=$('sl-export-hint');if(!el)return;el.textContent=text;el.classList.add('show');clearTimeout(hint.timer);hint.timer=setTimeout(()=>el.classList.remove('show'),2800)}
  function customizeExportMenu(){if(!current())return;const menu=document.querySelector('.sl-export-menu');if(!menu)return;menu.innerHTML='<div class="sl-export-menu-title">Экспорт с прозрачностью</div><button class="sl-export-option" type="button" data-export="bg-png"><span>PNG</span><span>alpha · без потерь</span></button><button class="sl-export-option" type="button" data-export="bg-webp"><span>WebP</span><span>alpha · компактнее</span></button><div class="sl-export-sep"></div><div class="sl-export-menu-note">JPEG и PDF скрыты, потому что не сохраняют прозрачный фон.</div>'}
  async function exportBackground(format){const render=window.safelightBackgroundRemovalTools?.render;if(typeof render!=='function')throw new Error('Маска удаления фона ещё не готова');const canvas=await render(),type=format==='webp'?'image/webp':'image/png',quality=format==='webp' ? 0.94 : undefined,blob=await canvasBlob(canvas,type,quality);download(blob,baseName()+'-no-bg.'+(format==='webp'?'webp':'png'))}
  function installExportBridge(){
    document.addEventListener('click',event=>{
      if(!current())return;
      if(event.target.closest('#sl-export')){setTimeout(customizeExportMenu,0);return}
      const option=event.target.closest('.sl-export-option[data-export]');if(!option)return;const value=option.dataset.export;if(value!=='bg-png'&&value!=='bg-webp')return;
      event.preventDefault();event.stopImmediatePropagation();document.querySelector('.sl-export-wrap')?.classList.remove('open');exportBackground(value==='bg-webp'?'webp':'png').then(()=>hint('Экспорт с прозрачностью готов.')).catch(error=>{console.error('Safelight background export:',error);hint(error.message||'Не удалось экспортировать результат')})
    },true)
  }
  function boot(){
    if(!document.querySelector('.sl-app')||!$('panel-background')){setTimeout(boot,50);return}
    installSidebar();syncText();installExportBridge();
    window.addEventListener('safelight:toolchange',()=>setTimeout(()=>{installSidebar();syncText()},0));
    $('sl-reset')?.addEventListener('click',()=>{if(current())window.safelightBackgroundRemovalTools?.reset?.()});
  }
  boot();
})();
