(function(){
  'use strict';
  if(window.safelightThemeSettingsLoaded)return;
  window.safelightThemeSettingsLoaded=true;

  const STORAGE_KEY='safelight-theme';
  const root=document.documentElement;
  const THEMES=new Set(['light','dark']);

  function installLightPolish(){
    if(document.querySelector('link[data-sl-light-polish]'))return;
    const link=document.createElement('link');
    link.rel='stylesheet';
    link.href='css/theme-light-polish.css?v=1';
    link.dataset.slLightPolish='1';
    document.head.appendChild(link);
  }

  function storedTheme(){
    try{const value=localStorage.getItem(STORAGE_KEY);return THEMES.has(value)?value:null}catch(_){return null}
  }

  function updateThemeColor(theme){
    const meta=document.querySelector('meta[name="theme-color"]');
    if(meta)meta.setAttribute('content',theme==='light'?'#f6f7f8':'#09090b');
  }

  function syncControls(){
    const theme=root.dataset.theme||'dark';
    document.querySelectorAll('[data-sl-theme-choice]').forEach(button=>{
      const selected=button.dataset.slThemeChoice===theme;
      button.classList.toggle('active',selected);
      button.setAttribute('aria-pressed',selected?'true':'false');
    });
    const status=document.getElementById('sl-theme-status');
    if(status)status.textContent=theme==='light'?'День':'Ночь';
  }

  function applyTheme(theme,persist){
    const next=THEMES.has(theme)?theme:'dark';
    root.dataset.theme=next;
    root.style.colorScheme=next;
    updateThemeColor(next);
    if(persist!==false){try{localStorage.setItem(STORAGE_KEY,next)}catch(_){}}
    syncControls();
    window.dispatchEvent(new CustomEvent('safelight:themechange',{detail:{theme:next}}));
  }

  installLightPolish();
  applyTheme(storedTheme()||'dark',false);

  function gearIcon(){
    return '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9.7 3.8 10.4 2h3.2l.7 1.8 1.7.7 1.8-.8 2.3 2.3-.8 1.8.7 1.7 1.8.7v3.2l-1.8.7-.7 1.7.8 1.8-2.3 2.3-1.8-.8-1.7.7-.7 1.8h-3.2l-.7-1.8-1.7-.7-1.8.8-2.3-2.3.8-1.8-.7-1.7-1.8-.7V10l1.8-.7.7-1.7-.8-1.8 2.3-2.3 1.8.8z"/><circle cx="12" cy="12" r="3"/></svg>';
  }

  function sunIcon(){return '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="3.5"/><path d="M12 2v3M12 19v3M4.9 4.9 7 7M17 17l2.1 2.1M2 12h3M19 12h3M4.9 19.1 7 17M17 7l2.1-2.1"/></svg>'}
  function moonIcon(){return '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M19.2 15.8A8 8 0 0 1 8.2 4.8 8.1 8.1 0 1 0 19.2 15.8z"/></svg>'}

  function closeSettings(){
    const wrap=document.getElementById('sl-settings-wrap');
    const toggle=document.getElementById('sl-settings-toggle');
    wrap?.classList.remove('open');
    toggle?.setAttribute('aria-expanded','false');
  }

  function installSettings(attempt){
    if(document.getElementById('sl-settings-wrap')){syncControls();return}
    const topbar=document.querySelector('.sl-topbar');
    if(!topbar){if((attempt||0)<160)setTimeout(()=>installSettings((attempt||0)+1),40);return}

    const wrap=document.createElement('div');
    wrap.className='sl-settings-wrap';
    wrap.id='sl-settings-wrap';
    wrap.innerHTML=`
      <button class="sl-tool-action sl-settings-toggle" id="sl-settings-toggle" type="button" aria-label="Настройки" title="Настройки" aria-haspopup="menu" aria-expanded="false">
        ${gearIcon()}
      </button>
      <div class="sl-settings-menu" id="sl-settings-menu" role="menu" aria-label="Настройки Safelight">
        <div class="sl-settings-head"><span>Настройки</span></div>
        <div class="sl-settings-row">
          <div class="sl-settings-copy"><b>Тема</b><small>Интерфейс Safelight</small></div>
          <span class="sl-theme-status" id="sl-theme-status">Ночь</span>
        </div>
        <div class="sl-theme-switch" role="group" aria-label="День или ночь">
          <button type="button" data-sl-theme-choice="light" aria-pressed="false">${sunIcon()}<span>День</span></button>
          <button type="button" data-sl-theme-choice="dark" aria-pressed="false">${moonIcon()}<span>Ночь</span></button>
        </div>
      </div>`;

    const history=document.getElementById('sl-history-wrap');
    if(history)topbar.insertBefore(wrap,history);else topbar.appendChild(wrap);

    const toggle=wrap.querySelector('#sl-settings-toggle');
    toggle.addEventListener('click',event=>{
      event.stopPropagation();
      const open=!wrap.classList.contains('open');
      document.getElementById('sl-history-wrap')?.classList.remove('open');
      document.getElementById('sl-history-toggle')?.setAttribute('aria-expanded','false');
      wrap.classList.toggle('open',open);
      toggle.setAttribute('aria-expanded',open?'true':'false');
    });

    wrap.querySelectorAll('[data-sl-theme-choice]').forEach(button=>button.addEventListener('click',()=>{
      applyTheme(button.dataset.slThemeChoice,true);
      setTimeout(closeSettings,120);
    }));

    document.addEventListener('click',event=>{if(!event.target.closest('#sl-settings-wrap'))closeSettings()});
    document.addEventListener('keydown',event=>{if(event.key==='Escape')closeSettings()});
    syncControls();
  }

  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>installSettings(0),{once:true});
  else installSettings(0);

  window.safelightTheme=Object.freeze({
    get:()=>root.dataset.theme||'dark',
    set:theme=>applyTheme(theme,true)
  });
})();