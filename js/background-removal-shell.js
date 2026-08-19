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
  function boot(){
    if(!document.querySelector('.sl-app')||!$('panel-background')){setTimeout(boot,50);return}
    installSidebar();syncText();
    window.addEventListener('safelight:toolchange',()=>setTimeout(()=>{installSidebar();syncText()},0));
    $('sl-reset')?.addEventListener('click',()=>{if(current())window.safelightBackgroundRemovalTools?.reset?.()});
  }
  boot();
})();
