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

  card('watermark','ВОДЯНОЙ ЗНАК','Добавляйте текстовый watermark прямо поверх изображения.','<div class="field-row"><div class="field wm-wide"><label>Текст</label><input id="wm-text" value="Safelight"></div><div class="field"><label>Размер</label><input id="wm-size" type="number" min="8" max="1000" value="48"></div><div class="field"><label>Прозрачность</label><input id="wm-opacity" type="number" min="1" max="100" value="45"></div><div class="field"><label>Позиция</label><select id="wm-pos"><option value="br">Низ / право</option><option value="bl">Низ / лево</option><option value="tr">Верх / право</option><option value="tl">Верх / лево</option><option value="center">Центр</option></select></div></div>');
  card('background','УДАЛЕНИЕ ФОНА','Цветовой ключ, Magic Wand и ручная маска прозрачности.','');

  const batch=card('batch','МАССОВАЯ ОБРАБОТКА','Обрабатывайте много изображений и скачивайте один ZIP.','<label class="batch-drop"><span>Выберите несколько изображений</span><input id="batch-files" type="file" accept="image/*" multiple></label><div class="field-row"><div class="field"><label>Качество</label><input id="b-quality" type="number" min="1" max="100" value="85"></div><div class="field"><label>Макс. ширина</label><input id="b-width" type="number" min="0" value="0"></div></div><div class="batch-progress"><div id="b-bar"></div></div>');
  batch.querySelector('#batch-files')?.addEventListener('change',()=>{const bar=batch.querySelector('#b-bar');if(bar)bar.style.width='0%'});
  card('metadata','МЕТАДАННЫЕ','Проверяйте информацию о файле и очищайте её перед экспортом.','<div class="meta-box" id="meta-box">Загрузите изображение.</div>');
  card('favicon','FAVICON GENERATOR','Создавайте набор иконок для сайта из одного изображения.','');

  const titles={
    transform:['Трансформация','Поворот и отражение изображений.'],watermark:['Водяной знак','Добавляйте текстовый watermark прямо поверх изображения.'],
    background:['Удаление фона','Цветовой ключ, Magic Wand, кисть и Feather для маски прозрачности.'],batch:['Массовая обработка','Обрабатывайте множество изображений одним действием.'],
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
