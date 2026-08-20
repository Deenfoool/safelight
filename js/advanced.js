(function(){
  'use strict';
  const nav=document.querySelector('.top-nav-links'),main=document.querySelector('main.workmain');
  if(!nav||!main)return;

  window.safelightTransformState={angle:0,h:false,v:false};
  const tools=[
    ['transform','Трансформация','M5 9V5h4M15 5h4v4M19 15v4h-4M9 19H5v-4M8 8l-3-3m11 11 3 3M16 8l3-3M8 16l-3 3'],
    ['watermark','Водяной знак','M4 5h16v14H4zM8 15l3-3 2 2 2-2 3 3M8 9h.01'],
    ['background','Удаление фона','M4 4h16v16H4zM7 15l3-3 2 2 3-4 2 3M16 5v5M13.5 7.5h5'],
    ['batch','Массовая обработка','M4 5h7v7H4zM13 5h7v7h-7zM4 14h7v5H4zM13 14h7v5h-7z'],
    ['metadata','Метаданные','M6 3h9l3 3v15H6zM15 3v4h4M9 12h6M9 16h6'],
    ['favicon','Favicon','M4 4h16v16H4zM8 16l3-4 2 2 2-3 3 5']
  ];
  tools.forEach(([id,label,path])=>{
    if(nav.querySelector(`[data-page="${id}"]`))return;
    const button=document.createElement('button');button.type='button';button.className='top-nav-link advanced-nav';button.dataset.page=id;
    button.innerHTML=`<span class="nav-icon" aria-hidden="true"><svg viewBox="0 0 24 24"><path d="${path}"/></svg></span><span>${label}</span>`;nav.appendChild(button);
  });

  function card(id,title,desc,html){
    let section=document.getElementById('panel-'+id);if(section)return section;
    section=document.createElement('section');section.className='panel';section.id='panel-'+id;
    section.innerHTML=`<div class="panel-card"><h2>${title}</h2><p class="desc">${desc}</p>${html||''}</div>`;main.appendChild(section);return section;
  }
  function fmt(bytes){bytes=Number(bytes)||0;if(bytes<1024)return bytes+' B';if(bytes<1048576)return(bytes/1024).toFixed(1)+' KB';return(bytes/1048576).toFixed(2)+' MB'}

  const transform=card('transform','ТРАНСФОРМАЦИЯ','Поворачивайте и отражайте изображение прямо в браузере.','<div class="transform-actions"><button type="button" class="btn ghost" data-tr="ccw">↶ 90°</button><button type="button" class="btn ghost" data-tr="cw">↷ 90°</button><button type="button" class="btn ghost" data-tr="180">180°</button><button type="button" class="btn ghost" data-tr="h">↔ Горизонталь</button><button type="button" class="btn ghost" data-tr="v">↕ Вертикаль</button></div>');
  transform.querySelectorAll('[data-tr]').forEach(button=>button.addEventListener('click',()=>{const action=button.dataset.tr,state=window.safelightTransformState;if(action==='ccw')state.angle=(state.angle+270)%360;if(action==='cw')state.angle=(state.angle+90)%360;if(action==='180')state.angle=(state.angle+180)%360;if(action==='h')state.h=!state.h;if(action==='v')state.v=!state.v}));

  card('watermark','ВОДЯНОЙ ЗНАК','Текст или логотип с точным оформлением, поворотом и повторяющимся паттерном.',`
    <div class="sl-wm-type" role="group" aria-label="Тип водяного знака">
      <button type="button" class="active" data-wm-kind="text">Текст</button>
      <button type="button" data-wm-kind="image">Логотип</button>
    </div>
    <div class="sl-wm-section" data-wm-section="text">
      <div class="sl-wm-section-title"><span>Текст</span><small>содержание и шрифт</small></div>
      <div class="field"><label>Надпись</label><input id="wm-text" value="Safelight" maxlength="180"></div>
      <div class="sl-wm-grid two">
        <div class="field"><label>Шрифт</label><select id="wm-font"><option value="system">Системный</option><option value="serif">С засечками</option><option value="mono">Моноширинный</option><option value="rounded">Мягкий</option></select></div>
        <div class="field"><label>Цвет</label><div class="sl-wm-color"><input id="wm-color" type="color" value="#ffffff"><span id="wm-color-value">#ffffff</span></div></div>
      </div>
      <div class="slider-row"><div class="top"><span>Размер</span><b id="wm-size-val">48 px</b></div><input id="wm-size" type="range" min="8" max="320" value="48"></div>
      <div class="sl-wm-outline-row">
        <div class="field"><label>Обводка</label><input id="wm-outline-color" type="color" value="#000000"></div>
        <div class="slider-row"><div class="top"><span>Толщина</span><b id="wm-outline-width-val">0 px</b></div><input id="wm-outline-width" type="range" min="0" max="16" value="0" step="0.5"></div>
      </div>
    </div>
    <div class="sl-wm-section sl-wm-logo-section" data-wm-section="image" hidden>
      <div class="sl-wm-section-title"><span>Логотип</span><small>PNG, WebP, SVG или другое изображение</small></div>
      <label class="sl-wm-logo-drop"><input id="wm-logo-file" type="file" accept="image/*,.svg"><span><b>Выбрать логотип</b><small id="wm-logo-name">Файл не выбран</small></span></label>
      <div class="slider-row"><div class="top"><span>Размер логотипа</span><b id="wm-logo-scale-val">18%</b></div><input id="wm-logo-scale" type="range" min="3" max="80" value="18"></div>
    </div>
    <div class="sl-wm-section">
      <div class="sl-wm-section-title"><span>Оформление</span><small>общие параметры</small></div>
      <div class="slider-row"><div class="top"><span>Прозрачность</span><b id="wm-opacity-val">45%</b></div><input id="wm-opacity" type="range" min="1" max="100" value="45"></div>
      <div class="slider-row"><div class="top"><span>Поворот</span><b id="wm-rotation-val">0°</b></div><input id="wm-rotation" type="range" min="-180" max="180" value="0"></div>
    </div>
    <div class="sl-wm-section">
      <div class="sl-wm-section-title"><span>Размещение</span><small>один знак или паттерн</small></div>
      <div class="sl-wm-layout" role="group" aria-label="Режим размещения">
        <button type="button" class="active" data-wm-layout="single">Один</button>
        <button type="button" data-wm-layout="pattern">Паттерн</button>
      </div>
      <p class="sl-wm-help" data-wm-single-hint>Перетаскивайте знак прямо по изображению.</p>
      <div class="sl-wm-pattern-controls" hidden>
        <div class="slider-row"><div class="top"><span>Шаг по X</span><b id="wm-pattern-x-val">28%</b></div><input id="wm-pattern-x" type="range" min="8" max="70" value="28"></div>
        <div class="slider-row"><div class="top"><span>Шаг по Y</span><b id="wm-pattern-y-val">22%</b></div><input id="wm-pattern-y" type="range" min="8" max="70" value="22"></div>
        <label class="sl-wm-stagger"><input id="wm-pattern-stagger" type="checkbox" checked><span><b>Смещать соседние ряды</b><small>Создаёт более равномерный диагональный рисунок.</small></span></label>
      </div>
    </div>
    <div class="status-line" id="wm-status">Текстовый водяной знак готов к размещению.</div>
  `);
  card('background','УДАЛЕНИЕ ФОНА','Цветовой ключ, Magic Wand и ручная маска прозрачности.','');

  card('batch','ПАКЕТНАЯ ОБРАБОТКА','Обрабатывайте несколько изображений с общими настройками и скачивайте результат одним ZIP.',`
    <div class="sl-batch-panel">
      <label class="batch-drop" id="batch-drop">
        <input id="batch-files" type="file" accept="image/*,.heic,.heif,image/heic,image/heif" multiple>
        <span class="sl-batch-drop-icon" aria-hidden="true">+</span>
        <span><b>Добавить изображения</b><small>Перетащите сюда или выберите файлы</small></span>
      </label>

      <div class="sl-batch-queue-head">
        <span><b id="b-count">0</b> файлов</span>
        <button type="button" id="b-clear" class="sl-batch-link" disabled>Очистить</button>
      </div>
      <div class="sl-batch-queue" id="b-queue" role="list">
        <div class="sl-batch-empty">Очередь пока пуста</div>
      </div>
      <div class="sl-batch-summary" id="b-summary">Добавьте PNG, JPEG, WebP или HEIC</div>

      <div class="sl-batch-section">
        <div class="sl-batch-section-head"><span>Результат</span><small>общие настройки для всей очереди</small></div>
        <div class="field-row sl-batch-two">
          <div class="field"><label for="b-format">Формат</label><select id="b-format"><option value="webp" selected>WebP</option><option value="jpeg">JPEG</option><option value="png">PNG</option><option value="heic">HEIC</option></select></div>
          <div class="field"><label for="b-resize-mode">Размер</label><select id="b-resize-mode"><option value="none" selected>Не изменять</option><option value="longest">Длинная сторона</option><option value="width">По ширине</option><option value="height">По высоте</option></select></div>
        </div>
        <div class="field sl-batch-size-field" id="b-size-field" hidden><label for="b-size">Целевой размер, px</label><input id="b-size" type="number" min="1" max="16384" value="1920"></div>
        <label class="check-row sl-batch-upscale" id="b-upscale-row" hidden><input id="b-no-upscale" type="checkbox" checked><span><b>Не увеличивать маленькие изображения</b><small>Изменяется только размер файлов крупнее заданного</small></span></label>
        <div class="slider-row" id="b-quality-row"><div class="top"><span>Качество</span><b id="b-quality-val">85%</b></div><input id="b-quality" type="range" min="1" max="100" value="85"></div>
        <div class="field-row sl-batch-two">
          <div class="field"><label for="b-background">Фон прозрачности</label><select id="b-background"><option value="transparent" selected>Сохранить</option><option value="white">Белый</option><option value="custom">Свой цвет</option></select></div>
          <div class="field" id="b-bg-color-field" hidden><label for="b-bg-color">Цвет фона</label><input id="b-bg-color" type="color" value="#ffffff"></div>
        </div>
      </div>

      <div class="sl-batch-section">
        <div class="sl-batch-section-head"><span>Имена файлов</span><small>исходное имя сохраняется в середине</small></div>
        <div class="field-row sl-batch-two">
          <div class="field"><label for="b-prefix">Префикс</label><input id="b-prefix" type="text" maxlength="48" placeholder="например, web-"></div>
          <div class="field"><label for="b-suffix">Суффикс</label><input id="b-suffix" type="text" maxlength="48" value="-safelight"></div>
        </div>
        <label class="check-row sl-batch-privacy"><input type="checkbox" checked disabled><span><b>Метаданные будут удалены</b><small>EXIF, GPS и данные камеры не попадут в новые файлы</small></span></label>
      </div>

      <div class="batch-progress" id="b-progress" role="progressbar" aria-label="Прогресс пакетной обработки" aria-valuemin="0" aria-valuemax="100" aria-valuenow="0"><div id="b-bar"></div></div>
      <div class="status-line sl-batch-status" id="b-status" role="status" aria-live="polite">Добавьте изображения, чтобы начать.</div>
      <div class="sl-batch-actions">
        <button type="button" class="btn primary" id="b-download" disabled>Обработать и скачать ZIP</button>
        <button type="button" class="btn ghost" id="b-cancel" hidden>Отменить</button>
      </div>
    </div>
  `);
  card('metadata','МЕТАДАННЫЕ','Проверяйте информацию о файле и очищайте её перед экспортом.','<div class="meta-box" id="meta-box">Загрузите изображение.</div>');
  card('favicon','FAVICON GENERATOR','Создавайте набор иконок для сайта из одного изображения.','');

  const titles={
    transform:['Трансформация','Поворот и отражение изображений.'],watermark:['Водяной знак','Текст или логотип с цветом, обводкой, поворотом и повторяющимся паттерном.'],
    background:['Удаление фона','Цветовой ключ, Magic Wand, кисть и Feather для маски прозрачности.'],batch:['Пакетная обработка','Обрабатывайте несколько изображений с общими настройками и ZIP-экспортом.'],
    metadata:['Метаданные','Проверяйте и очищайте данные изображения.'],favicon:['Favicon Generator','Создавайте набор иконок для сайта.']
  };
  function setAdvanced(id){
    document.body.classList.remove('page-home');document.body.classList.add('page-tool');
    document.querySelectorAll('.top-nav-link').forEach(button=>button.classList.toggle('active',button.dataset.page===id));
    document.querySelectorAll('.panel').forEach(panel=>panel.classList.toggle('active',panel.id==='panel-'+id));
    const value=titles[id],title=document.querySelector('#workspace .page-title h1'),desc=document.querySelector('#workspace .page-title p');if(value&&title)title.textContent=value[0];if(value&&desc)desc.textContent=value[1];
    const grid=document.getElementById('gridOverlay');if(grid)grid.style.display='none';window.scrollTo({top:0,behavior:'smooth'});
  }
  window.safelightSetAdvanced=setAdvanced;

  (function initPdfInput(){
    const fileInput=document.getElementById('fileInput'),dropzone=document.getElementById('dropzone'),panel=document.getElementById('panel-convert');if(!fileInput||!dropzone||!panel)return;
    const accept=new Set((fileInput.accept||'').split(',').map(value=>value.trim()).filter(Boolean));accept.add('application/pdf');accept.add('.pdf');fileInput.accept=[...accept].join(',');
    const isPdf=file=>!!(file&&((file.type||'').toLowerCase()==='application/pdf'||/\.pdf$/i.test(file.name||'')));
    const setStatus=text=>{const status=panel.querySelector('#v-status');if(status)status.textContent=text};
    async function renderPdfPage(file){if(!window.pdfjsLib?.getDocument)throw new Error('PDF-модуль не загрузился');const data=await file.arrayBuffer(),doc=await window.pdfjsLib.getDocument({data}).promise,page=await doc.getPage(1),viewport=page.getViewport({scale:1.5}),canvas=document.createElement('canvas');canvas.width=Math.ceil(viewport.width);canvas.height=Math.ceil(viewport.height);await page.render({canvasContext:canvas.getContext('2d'),viewport}).promise;return{canvas,pages:doc.numPages}}
    async function handlePdf(file){setStatus('Читаю PDF…');try{const result=await renderPdfPage(file),preview=document.getElementById('previewImg');preview.src=result.canvas.toDataURL('image/png');document.getElementById('previewWrap').style.display='inline-block';document.getElementById('stageEmpty').style.display='none';document.getElementById('readout').style.display='flex';document.getElementById('meta-name').textContent=file.name;document.getElementById('meta-size').textContent=fmt(file.size);document.getElementById('meta-type').textContent='application/pdf';document.getElementById('meta-dims').textContent=result.canvas.width+' × '+result.canvas.height;document.getElementById('ro-dims').textContent=result.canvas.width+' × '+result.canvas.height+' px';document.getElementById('ro-size').textContent=fmt(file.size);document.getElementById('ro-format').textContent='PDF';setStatus('PDF загружен: '+result.pages+' стр. · обработка без сети');document.querySelectorAll('.result').forEach(element=>element.classList.remove('show'))}catch(error){console.error('Safelight PDF:',error);setStatus('Не удалось прочитать PDF: '+(error.message||'неподдерживаемая структура'))}}
    fileInput.addEventListener('change',event=>{const file=event.target.files?.[0];if(isPdf(file))handlePdf(file)},true);dropzone.addEventListener('drop',event=>{const file=event.dataTransfer.files?.[0];if(isPdf(file))handlePdf(file)},true);
  })();
})();
