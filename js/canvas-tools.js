(function(){
  'use strict';
  if(window.safelightCanvasToolsLoaded)return;
  window.safelightCanvasToolsLoaded=true;

  const $=id=>document.getElementById(id);
  const clamp=(value,min,max)=>Math.max(min,Math.min(max,value));
  let sourceImage=null;
  let sourceSrc='';
  let renderTimer=0;
  let renderToken=0;
  let lastCanvas=null;
  let exportBusy=false;

  function active(){return !!document.querySelector('#panel-canvas.active')}
  function number(id,fallback){const value=Number($(id)?.value);return Number.isFinite(value)?value:fallback}
  function currentState(){return{
    preset:$('cv-preset')?.value||'original',
    width:clamp(Math.round(number('cv-width',sourceImage?.naturalWidth||1)),1,12000),
    height:clamp(Math.round(number('cv-height',sourceImage?.naturalHeight||1)),1,12000),
    fit:$('cv-fit')?.value||'contain',
    position:$('cv-position')?.value||'center',
    top:clamp(Math.round(number('cv-top',0)),0,6000),
    right:clamp(Math.round(number('cv-right',0)),0,6000),
    bottom:clamp(Math.round(number('cv-bottom',0)),0,6000),
    left:clamp(Math.round(number('cv-left',0)),0,6000),
    linked:!!$('cv-link-margins')?.checked,
    background:$('cv-bg-mode')?.value||'transparent',
    backgroundColor:$('cv-bg-color')?.value||'#ffffff',
    border:clamp(Math.round(number('cv-border',0)),0,200),
    borderColor:$('cv-border-color')?.value||'#ffffff',
    radius:clamp(Math.round(number('cv-radius',0)),0,1000),
    shadow:clamp(Math.round(number('cv-shadow',0)),0,100),
    quality:clamp(number('cv-quality',92),1,100)/100
  }}

  function panelMarkup(){return `<div class="panel-card sl-canvas-panel">
    <h2>ХОЛСТ / РАМКИ / ПОЛЯ</h2>
    <p class="desc">Добавляйте пространство вокруг изображения, меняйте пропорции холста, фон и рамку без растягивания оригинала.</p>

    <div class="sl-canvas-section">
      <div class="sl-canvas-section-head"><span>Холст</span><small>готовые пропорции или точный размер</small></div>
      <div class="field"><label>Пропорции</label><select id="cv-preset"><option value="original" selected>Как у исходника</option><option value="1:1">1:1 · квадрат</option><option value="4:3">4:3</option><option value="3:2">3:2</option><option value="16:9">16:9</option><option value="9:16">9:16 · вертикально</option><option value="custom">Свой размер</option></select></div>
      <div class="field-row sl-canvas-size-row"><div class="field"><label>Ширина</label><input id="cv-width" type="number" min="1" max="12000" placeholder="—"></div><div class="field"><label>Высота</label><input id="cv-height" type="number" min="1" max="12000" placeholder="—"></div></div>
      <div class="field-row sl-canvas-fit-row"><div class="field"><label>Изображение</label><select id="cv-fit"><option value="contain" selected>Вписать целиком</option><option value="original">Без масштабирования</option><option value="cover">Заполнить область</option></select></div><div class="field"><label>Позиция</label><select id="cv-position"><option value="tl">Сверху слева</option><option value="tc">Сверху</option><option value="tr">Сверху справа</option><option value="cl">Слева</option><option value="center" selected>По центру</option><option value="cr">Справа</option><option value="bl">Снизу слева</option><option value="bc">Снизу</option><option value="br">Снизу справа</option></select></div></div>
    </div>

    <div class="sl-canvas-section">
      <div class="sl-canvas-section-head"><span>Поля</span><small>отступы внутри холста, px</small></div>
      <label class="check-row sl-canvas-link"><input type="checkbox" id="cv-link-margins" checked> Связать четыре стороны</label>
      <div class="sl-canvas-margin-grid"><div class="field"><label>Сверху</label><input id="cv-top" type="number" min="0" max="6000" value="0"></div><div class="field"><label>Справа</label><input id="cv-right" type="number" min="0" max="6000" value="0"></div><div class="field"><label>Снизу</label><input id="cv-bottom" type="number" min="0" max="6000" value="0"></div><div class="field"><label>Слева</label><input id="cv-left" type="number" min="0" max="6000" value="0"></div></div>
      <div class="sl-canvas-quick-margins"><button class="btn ghost" type="button" data-cv-margin="0">0</button><button class="btn ghost" type="button" data-cv-margin="16">16</button><button class="btn ghost" type="button" data-cv-margin="32">32</button><button class="btn ghost" type="button" data-cv-margin="64">64</button></div>
    </div>

    <div class="sl-canvas-section">
      <div class="sl-canvas-section-head"><span>Фон и рамка</span><small>прозрачность сохраняется в PNG/WebP/HEIC</small></div>
      <div class="field-row sl-canvas-color-row"><div class="field"><label>Фон</label><select id="cv-bg-mode"><option value="transparent" selected>Прозрачный</option><option value="color">Цвет</option></select></div><div class="field sl-canvas-bg-color"><label>Цвет фона</label><input id="cv-bg-color" type="color" value="#ffffff"></div></div>
      <div class="field-row sl-canvas-frame-row"><div class="field"><label>Рамка, px</label><input id="cv-border" type="number" min="0" max="200" value="0"></div><div class="field"><label>Цвет рамки</label><input id="cv-border-color" type="color" value="#ffffff"></div></div>
      <div class="slider-row"><div class="top"><span>Скругление</span><b id="cv-radius-val">0 px</b></div><input id="cv-radius" type="range" min="0" max="300" value="0"></div>
      <div class="slider-row"><div class="top"><span>Тень</span><b id="cv-shadow-val">0%</b></div><input id="cv-shadow" type="range" min="0" max="100" value="0"></div>
      <div class="slider-row"><div class="top"><span>Качество JPEG/WebP</span><b id="cv-quality-val">92%</b></div><input id="cv-quality" type="range" min="1" max="100" value="92"></div>
    </div>

    <div class="sl-canvas-note">Холст меняет итоговый размер файла, но исходное изображение остаётся нетронутым.</div>
  </div>`}

  function createPanel(){
    if($('panel-canvas'))return $('panel-canvas');
    const panel=document.createElement('section');panel.className='panel';panel.id='panel-canvas';panel.innerHTML=panelMarkup();
    const host=$('sl-inspector-panels')||document.querySelector('main.workmain');host?.appendChild(panel);
    bindPanel(panel);return panel;
  }

  function createSidebarButton(){
    if(document.querySelector('.sl-sidebar [data-page="canvas"]'))return;
    const groups=[...document.querySelectorAll('.sl-sidebar .sl-nav-group')];
    const group=groups.find(item=>item.querySelector('.sl-nav-label')?.textContent.trim()==='Редактирование')||groups[0];
    if(!group)return;
    const button=document.createElement('button');button.type='button';button.className='top-nav-link sl-tool';button.dataset.page='canvas';
    button.innerHTML='<span class="nav-icon" aria-hidden="true"><svg viewBox="0 0 24 24"><path d="M4 5h16v14H4zM8 9h8v6H8zM8 3v4M16 3v4M8 17v4M16 17v4M2 9h4M18 9h4M2 15h4M18 15h4"/></svg></span><span>Холст</span>';
    button.addEventListener('click',event=>{event.preventDefault();activateCanvas()});
    group.appendChild(button);
  }

  function activateCanvas(){
    document.body.classList.remove('page-home','sl-palette-active','sl-privacy-active');document.body.classList.add('page-tool');
    document.querySelectorAll('.panel').forEach(panel=>panel.classList.remove('active'));
    createPanel().classList.add('active');
    document.querySelectorAll('.sl-sidebar .sl-tool').forEach(button=>button.classList.toggle('active',button.dataset.page==='canvas'));
    const title=$('sl-inspector-title'),desc=$('sl-inspector-desc');if(title)title.textContent='Холст / рамки / поля';if(desc)desc.textContent='Пропорции, поля, фон, рамка, скругление и позиционирование изображения.';
    window.dispatchEvent(new CustomEvent('safelight:toolchange',{detail:{page:'canvas'}}));
    syncSource().then(()=>{ensureDimensions(false);scheduleRender(0)}).catch(()=>{});
  }

  function syncSource(){
    const preview=$('previewImg'),src=preview?.src||'';
    if(!src){sourceImage=null;sourceSrc='';lastCanvas=null;return Promise.resolve(null)}
    if(sourceImage&&sourceSrc===src)return Promise.resolve(sourceImage);
    return new Promise((resolve,reject)=>{const image=new Image();image.onload=()=>{sourceImage=image;sourceSrc=src;ensureDimensions(true);resolve(image)};image.onerror=()=>reject(new Error('Не удалось открыть изображение'));image.src=src});
  }

  function ratioForPreset(preset){const map={'1:1':1,'4:3':4/3,'3:2':3/2,'16:9':16/9,'9:16':9/16};return map[preset]||null}
  function sizeForRatio(ratio){
    const sw=sourceImage?.naturalWidth||number('cv-width',1),sh=sourceImage?.naturalHeight||number('cv-height',1),sourceRatio=sw/sh;
    if(sourceRatio>=ratio)return{width:sw,height:Math.max(1,Math.round(sw/ratio))};
    return{width:Math.max(1,Math.round(sh*ratio)),height:sh};
  }
  function ensureDimensions(force){
    if(!sourceImage)return;
    const preset=$('cv-preset')?.value||'original';let size=null;
    if(preset==='original')size={width:sourceImage.naturalWidth,height:sourceImage.naturalHeight};
    else if(ratioForPreset(preset))size=sizeForRatio(ratioForPreset(preset));
    else if(force&&(!$('cv-width')?.value||!$('cv-height')?.value))size={width:sourceImage.naturalWidth,height:sourceImage.naturalHeight};
    if(size){if($('cv-width'))$('cv-width').value=size.width;if($('cv-height'))$('cv-height').value=size.height}
    updateControlState();
  }

  function linkedMargin(source){
    if(!$('cv-link-margins')?.checked)return;
    const value=source.value;['cv-top','cv-right','cv-bottom','cv-left'].forEach(id=>{if($(id)!==source)$(id).value=value});
  }
  function updateControlState(){
    const custom=$('cv-preset')?.value==='custom';
    document.querySelector('.sl-canvas-size-row')?.classList.toggle('sl-canvas-custom-size',custom);
    if($('cv-width'))$('cv-width').disabled=!custom;if($('cv-height'))$('cv-height').disabled=!custom;
    document.querySelector('.sl-canvas-bg-color')?.classList.toggle('active',$('cv-bg-mode')?.value==='color');
    if($('cv-radius-val'))$('cv-radius-val').textContent=`${Math.round(number('cv-radius',0))} px`;
    if($('cv-shadow-val'))$('cv-shadow-val').textContent=`${Math.round(number('cv-shadow',0))}%`;
    if($('cv-quality-val'))$('cv-quality-val').textContent=`${Math.round(number('cv-quality',92))}%`;
  }

  function bindPanel(panel){
    panel.addEventListener('input',event=>{
      if(event.target.matches('#cv-top,#cv-right,#cv-bottom,#cv-left'))linkedMargin(event.target);
      updateControlState();scheduleRender();
    },true);
    panel.addEventListener('change',event=>{
      if(event.target.id==='cv-preset')ensureDimensions(false);
      updateControlState();scheduleRender(0);
    },true);
    panel.addEventListener('click',event=>{
      const quick=event.target.closest('[data-cv-margin]');if(!quick)return;
      const value=quick.dataset.cvMargin;['cv-top','cv-right','cv-bottom','cv-left'].forEach(id=>{if($(id))$(id).value=value});
      scheduleRender(0);
    });
  }

  function roundRect(ctx,x,y,w,h,r){r=Math.max(0,Math.min(r,w/2,h/2));ctx.beginPath();ctx.moveTo(x+r,y);ctx.arcTo(x+w,y,x+w,y+h,r);ctx.arcTo(x+w,y+h,x,y+h,r);ctx.arcTo(x,y+h,x,y,r);ctx.arcTo(x,y,x+w,y,r);ctx.closePath()}
  function alignedPosition(position,areaX,areaY,areaW,areaH,w,h){
    let x=areaX+(areaW-w)/2,y=areaY+(areaH-h)/2;
    if(position.includes('l'))x=areaX;if(position.includes('r'))x=areaX+areaW-w;
    if(position.startsWith('t'))y=areaY;if(position.startsWith('b'))y=areaY+areaH-h;
    return{x,y};
  }

  async function buildCanvas(){
    const image=await syncSource();if(!image)return null;const s=currentState();
    const out=document.createElement('canvas');out.width=s.width;out.height=s.height;const ctx=out.getContext('2d');ctx.clearRect(0,0,out.width,out.height);
    if(s.background==='color'){ctx.fillStyle=s.backgroundColor;ctx.fillRect(0,0,out.width,out.height)}

    const areaX=Math.min(s.left,out.width-1),areaY=Math.min(s.top,out.height-1),areaW=Math.max(1,out.width-s.left-s.right),areaH=Math.max(1,out.height-s.top-s.bottom);
    let scale=1;if(s.fit==='contain')scale=Math.min(areaW/image.naturalWidth,areaH/image.naturalHeight);else if(s.fit==='cover')scale=Math.max(areaW/image.naturalWidth,areaH/image.naturalHeight);
    const drawW=Math.max(1,image.naturalWidth*scale),drawH=Math.max(1,image.naturalHeight*scale),pos=alignedPosition(s.position,areaX,areaY,areaW,areaH,drawW,drawH);
    const frame=s.fit==='cover'?{x:areaX,y:areaY,w:areaW,h:areaH}:{x:pos.x,y:pos.y,w:drawW,h:drawH};

    if(s.shadow>0){ctx.save();ctx.shadowColor=`rgba(0,0,0,${0.12+s.shadow/100*.48})`;ctx.shadowBlur=2+s.shadow*.32;ctx.shadowOffsetY=1+s.shadow*.09;ctx.fillStyle='rgba(0,0,0,.01)';roundRect(ctx,frame.x,frame.y,frame.w,frame.h,s.radius);ctx.fill();ctx.restore()}

    ctx.save();
    if(s.fit==='cover'){roundRect(ctx,areaX,areaY,areaW,areaH,s.radius);ctx.clip()}
    else {roundRect(ctx,frame.x,frame.y,frame.w,frame.h,s.radius);ctx.clip()}
    ctx.imageSmoothingEnabled=true;ctx.imageSmoothingQuality='high';ctx.drawImage(image,pos.x,pos.y,drawW,drawH);ctx.restore();

    if(s.border>0){ctx.save();ctx.strokeStyle=s.borderColor;ctx.lineWidth=s.border;roundRect(ctx,frame.x+s.border/2,frame.y+s.border/2,Math.max(1,frame.w-s.border),Math.max(1,frame.h-s.border),Math.max(0,s.radius-s.border/2));ctx.stroke();ctx.restore()}
    return out;
  }

  async function renderNow(){
    if(!active())return null;const token=++renderToken;
    try{const built=await buildCanvas();if(!built||token!==renderToken||!active())return null;let live=$('sl-live-canvas');if(!live){const wrap=$('previewWrap');live=document.createElement('canvas');live.id='sl-live-canvas';live.className='sl-live-canvas';wrap?.appendChild(live)}
      live.width=built.width;live.height=built.height;const ctx=live.getContext('2d');ctx.clearRect(0,0,live.width,live.height);ctx.drawImage(built,0,0);$('previewWrap')?.classList.add('sl-live-ready');lastCanvas=built;
      if($('ro-dims'))$('ro-dims').textContent=`${built.width} × ${built.height} px`;if($('ro-format'))$('ro-format').textContent='CANVAS';return built;
    }catch(error){console.error('Safelight canvas:',error);hint(error.message||'Не удалось построить холст');return null}
  }
  function scheduleRender(delay){clearTimeout(renderTimer);renderTimer=setTimeout(renderNow,delay==null?70:delay)}

  function canvasBlob(canvas,type,quality){return new Promise((resolve,reject)=>canvas.toBlob(blob=>blob?resolve(blob):reject(new Error('Не удалось подготовить файл')),type,quality))}
  function download(blob,name){const url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=name;document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),4000)}
  function baseName(){return (($('meta-name')?.textContent||'safelight').trim().replace(/\.[^.]+$/,'')||'safelight')}
  function hint(text){const el=$('sl-export-hint');if(!el)return;el.textContent=text;el.classList.add('show');clearTimeout(hint.timer);hint.timer=setTimeout(()=>el.classList.remove('show'),3000)}
  async function exportCanvas(format){
    if(exportBusy)return;exportBusy=true;try{const canvas=await renderNow()||lastCanvas;if(!canvas)throw new Error('Сначала загрузите изображение');const s=currentState();
      if(format==='heic'){const encoder=window.safelightHeicCodec?.encodeCanvas;if(typeof encoder!=='function')throw new Error('Локальный HEIC WASM-кодек не загрузился');download(await encoder(canvas),baseName()+'-canvas.heic');return}
      if(format==='pdf'){if(!window.jspdf?.jsPDF)throw new Error('Локальный PDF-модуль не загрузился');const {jsPDF}=window.jspdf,orientation=canvas.width>canvas.height?'landscape':'portrait',doc=new jsPDF({orientation,unit:'mm',format:'a4'}),pw=doc.internal.pageSize.getWidth(),ph=doc.internal.pageSize.getHeight(),margin=10,scale=Math.min((pw-margin*2)/canvas.width,(ph-margin*2)/canvas.height),w=canvas.width*scale,h=canvas.height*scale;doc.addImage(canvas.toDataURL('image/png'),'PNG',(pw-w)/2,(ph-h)/2,w,h,undefined,'FAST');download(doc.output('blob'),baseName()+'-canvas.pdf');return}
      let target=canvas,type='image/png',ext='png',quality=undefined;if(format==='webp'){type='image/webp';ext='webp';quality=s.quality}else if(format==='jpeg'){type='image/jpeg';ext='jpg';quality=s.quality;const opaque=document.createElement('canvas');opaque.width=canvas.width;opaque.height=canvas.height;const ctx=opaque.getContext('2d');ctx.fillStyle=s.background==='color'?s.backgroundColor:'#ffffff';ctx.fillRect(0,0,opaque.width,opaque.height);ctx.drawImage(canvas,0,0);target=opaque}
      download(await canvasBlob(target,type,quality),baseName()+'-canvas.'+ext);
    }finally{exportBusy=false}
  }

  function patchExportMenu(){
    if(!active())return;const menu=document.querySelector('.sl-export-menu');if(!menu)return;
    menu.innerHTML='<div class="sl-export-menu-title">Экспорт холста</div><button class="sl-export-option" type="button" data-export="png"><span>PNG</span><span>прозрачность</span></button><button class="sl-export-option" type="button" data-export="webp"><span>WebP</span><span>оптимально</span></button><button class="sl-export-option" type="button" data-export="jpeg"><span>JPEG</span><span>совместимо</span></button><button class="sl-export-option" type="button" data-export="heic"><span>HEIC</span><span>HEVC</span></button><button class="sl-export-option" type="button" data-export="pdf"><span>PDF</span><span>документ</span></button><div class="sl-export-sep"></div><div class="sl-export-menu-note">Экспортируется текущий холст со всеми полями, рамкой и фоном.</div>';
  }
  function bindExport(){
    document.addEventListener('click',event=>{if(event.target.closest('#sl-export')&&active())setTimeout(patchExportMenu,0)},true);
    document.addEventListener('click',event=>{const option=event.target.closest('.sl-export-option[data-export]');if(!option||!active())return;event.preventDefault();event.stopImmediatePropagation();document.querySelector('.sl-export-wrap')?.classList.remove('open');exportCanvas(option.dataset.export).then(()=>hint('Экспорт холста готов.')).catch(error=>{console.error(error);hint(error.message||'Не удалось экспортировать холст')})},true);
  }

  function install(){
    if(!document.querySelector('.sl-app')||!$('sl-inspector-panels')){setTimeout(install,60);return}
    createPanel();createSidebarButton();bindExport();updateControlState();
    const preview=$('previewImg');if(preview)new MutationObserver(()=>{sourceImage=null;sourceSrc='';syncSource().then(()=>{if(active())scheduleRender(0)}).catch(()=>{})}).observe(preview,{attributes:true,attributeFilter:['src']});
    window.addEventListener('safelight:toolchange',event=>{if(event.detail?.page!=='canvas'&&!active())return;if(active()){syncSource().then(()=>scheduleRender(0)).catch(()=>{})}});
  }

  window.safelightCanvasTools=Object.freeze({activate:activateCanvas,render:renderNow,export:exportCanvas,state:currentState});
  install();
})();