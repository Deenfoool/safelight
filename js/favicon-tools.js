(function(){
  'use strict';
  if(window.safelightFaviconToolsLoaded)return;
  window.safelightFaviconToolsLoaded=true;

  const PREVIEW_SIZES=[180,128,64,32,16];
  const EXPORT_SIZES=[16,32,48,64,128,180,192,512];
  const ICO_SIZES=[16,32,48,64,128,256];
  const $=id=>document.getElementById(id);
  let sourceImage=null;
  let sourceSrc='';
  let masterCache=null;
  let masterKey='';
  let smartBoundsCache=null;
  let smartBoundsSrc='';
  let renderQueued=0;

  function active(){return !!document.querySelector('#panel-favicon.active')||document.querySelector('.sl-tool.active')?.dataset.page==='favicon'}
  function clamp(value,min,max){return Math.max(min,Math.min(max,value))}
  function num(id,fallback){const value=Number($(id)?.value);return Number.isFinite(value)?value:fallback}
  function state(){
    return {
      fit:$('fav-fit')?.value||'auto',
      scale:clamp(num('fav-scale',100),50,250),
      x:clamp(num('fav-x',0),-100,100),
      y:clamp(num('fav-y',0),-100,100),
      padding:clamp(num('fav-padding',8),0,35),
      background:$('fav-bg-mode')?.value||'transparent',
      backgroundColor:$('fav-bg-color')?.value||'#ffffff',
      shape:$('fav-shape')?.value||'square',
      radius:clamp(num('fav-radius',18),0,50),
      optimize:$('fav-optimize')?.checked!==false,
      siteName:($('fav-site-name')?.value||'').trim(),
      basePath:($('fav-base-path')?.value||'/').trim()||'/'
    };
  }
  function stateKey(){const s=state();return [sourceSrc,s.fit,s.scale,s.x,s.y,s.padding,s.background,s.backgroundColor,s.shape,s.radius,s.optimize].join('|')}
  function invalidate(){masterCache=null;masterKey='';scheduleRender()}

  function normalizedPath(value){
    let path=(value||'/').trim()||'/';
    if(!path.endsWith('/'))path+='/';
    return path;
  }
  function htmlSnippet(){
    const path=normalizedPath(state().basePath);
    return [
      `<link rel="icon" href="${path}favicon.ico" sizes="any">`,
      `<link rel="icon" type="image/png" sizes="32x32" href="${path}favicon-32x32.png">`,
      `<link rel="icon" type="image/png" sizes="16x16" href="${path}favicon-16x16.png">`,
      `<link rel="apple-touch-icon" sizes="180x180" href="${path}apple-touch-icon.png">`,
      `<link rel="manifest" href="${path}site.webmanifest">`
    ].join('\n');
  }
  function manifestText(){
    const s=state(),path=normalizedPath(s.basePath),name=s.siteName||'Website';
    return JSON.stringify({
      name,short_name:name.length>20?name.slice(0,20):name,
      icons:[
        {src:`${path}android-chrome-192x192.png`,sizes:'192x192',type:'image/png'},
        {src:`${path}android-chrome-512x512.png`,sizes:'512x512',type:'image/png'}
      ],
      theme_color:s.background==='color'?s.backgroundColor:'#ffffff',
      background_color:s.background==='color'?s.backgroundColor:'#ffffff',
      display:'standalone'
    },null,2);
  }
  function updateCode(){
    const code=$('fav-code');if(code)code.textContent=htmlSnippet();
  }

  function injectControls(){
    const panel=$('panel-favicon');
    const card=panel?.querySelector('.panel-card');
    if(!card||$('fav-controls'))return;
    const controls=document.createElement('div');
    controls.id='fav-controls';
    controls.className='fav-controls';
    controls.innerHTML=`
      <div class="fav-section-title">Композиция</div>
      <div class="field-row fav-field-grid">
        <div class="field"><label>Кадрирование</label><select id="fav-fit"><option value="auto" selected>Авто — убрать поля</option><option value="contain">Вписать целиком</option><option value="cover">Заполнить квадрат</option></select></div>
        <div class="field"><label>Форма</label><select id="fav-shape"><option value="square" selected>Квадрат</option><option value="rounded">Скруглённый</option><option value="circle">Круг</option></select></div>
      </div>
      <div class="slider-row"><div class="top"><span>Масштаб</span><b id="fav-scale-val">100%</b></div><input id="fav-scale" type="range" min="50" max="250" value="100"></div>
      <div class="slider-row"><div class="top"><span>Безопасный отступ</span><b id="fav-padding-val">8%</b></div><input id="fav-padding" type="range" min="0" max="35" value="8"></div>
      <div class="fav-pan-grid">
        <div class="slider-row"><div class="top"><span>По горизонтали</span><b id="fav-x-val">0</b></div><input id="fav-x" type="range" min="-100" max="100" value="0"></div>
        <div class="slider-row"><div class="top"><span>По вертикали</span><b id="fav-y-val">0</b></div><input id="fav-y" type="range" min="-100" max="100" value="0"></div>
      </div>
      <div class="fav-section-title">Фон и форма</div>
      <div class="field-row fav-field-grid">
        <div class="field"><label>Фон</label><select id="fav-bg-mode"><option value="transparent" selected>Прозрачный</option><option value="color">Цвет</option></select></div>
        <div class="field fav-color-field"><label>Цвет</label><input id="fav-bg-color" type="color" value="#ffffff"></div>
      </div>
      <div class="slider-row fav-radius-row"><div class="top"><span>Скругление</span><b id="fav-radius-val">18%</b></div><input id="fav-radius" type="range" min="0" max="50" value="18"></div>
      <label class="check-row fav-optimize"><input type="checkbox" id="fav-optimize" checked> Улучшать читаемость 16×16 и 32×32</label>
      <div class="fav-drag-note">Подсказка: перетаскивайте превью 180×180 для позиционирования, колесом меняйте масштаб.</div>
      <div class="fav-section-title">Пакет для сайта</div>
      <div class="field-row fav-field-grid">
        <div class="field fav-wide"><label>Название сайта</label><input id="fav-site-name" type="text" placeholder="Website"></div>
        <div class="field"><label>Путь к иконкам</label><input id="fav-base-path" type="text" value="/"></div>
      </div>
      <div class="fav-code-head"><span>HTML для &lt;head&gt;</span><button type="button" class="btn ghost" id="fav-copy-code">Скопировать</button></div>
      <pre class="fav-code" id="fav-code"></pre>
      <div class="fav-package-note">ZIP содержит PNG 16/32/48/64/128/180/192/512, настоящий favicon.ico, site.webmanifest и готовый HTML-фрагмент.</div>`;
    card.appendChild(controls);

    const refreshLabels=()=>{
      if($('fav-scale-val'))$('fav-scale-val').textContent=$('fav-scale').value+'%';
      if($('fav-padding-val'))$('fav-padding-val').textContent=$('fav-padding').value+'%';
      if($('fav-x-val'))$('fav-x-val').textContent=$('fav-x').value;
      if($('fav-y-val'))$('fav-y-val').textContent=$('fav-y').value;
      if($('fav-radius-val'))$('fav-radius-val').textContent=$('fav-radius').value+'%';
      controls.classList.toggle('fav-bg-color-on',$('fav-bg-mode').value==='color');
      controls.classList.toggle('fav-radius-on',$('fav-shape').value==='rounded');
      updateCode();
    };
    controls.addEventListener('input',()=>{refreshLabels();invalidate()});
    controls.addEventListener('change',()=>{refreshLabels();invalidate()});
    $('fav-copy-code')?.addEventListener('click',async()=>{
      const text=htmlSnippet();
      try{await navigator.clipboard.writeText(text);hint('HTML-код скопирован.')}catch(_){
        const area=document.createElement('textarea');area.value=text;document.body.appendChild(area);area.select();document.execCommand('copy');area.remove();hint('HTML-код скопирован.');
      }
    });
    refreshLabels();
  }

  function ensurePreview(){
    const wrap=$('previewWrap');if(!wrap)return null;
    let suite=$('sl-favicon-suite');if(suite)return suite;
    suite=document.createElement('div');
    suite.id='sl-favicon-suite';
    suite.className='sl-favicon-suite';
    suite.innerHTML=`
      <div class="fav-preview-board">
        <div class="fav-preview-lineup">${PREVIEW_SIZES.map(size=>`<div class="fav-preview-item" data-size="${size}"><div class="fav-icon-slot"><canvas width="${size}" height="${size}" aria-label="Favicon ${size}×${size}"></canvas></div><div class="fav-preview-size">${size}×${size}</div></div>`).join('')}</div>
      </div>
      <div class="fav-contexts">
        <div class="fav-context fav-browser"><div class="fav-context-label">Вкладка браузера</div><div class="fav-tab"><canvas width="16" height="16"></canvas><span>${escapeHtml(document.title.split('—')[0].trim()||'Website')}</span><i>×</i></div></div>
        <div class="fav-context fav-bookmark"><div class="fav-context-label">Закладка</div><div class="fav-bookmark-row"><canvas width="32" height="32"></canvas><div><b>Website</b><small>example.com</small></div></div></div>
        <div class="fav-context fav-app"><div class="fav-context-label">Ярлык приложения</div><canvas width="64" height="64"></canvas></div>
      </div>`;
    wrap.appendChild(suite);
    bindDrag(suite.querySelector('.fav-preview-item[data-size="180"] canvas'));
    return suite;
  }
  function escapeHtml(value){return String(value).replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]))}

  function syncSource(){
    const img=$('previewImg');
    const src=img?.src||'';
    if(!src){sourceImage=null;sourceSrc='';invalidate();return}
    if(src===sourceSrc&&sourceImage)return;
    const image=new Image();
    image.onload=()=>{sourceImage=image;sourceSrc=src;smartBoundsCache=null;smartBoundsSrc='';invalidate()};
    image.onerror=()=>{sourceImage=null;sourceSrc='';invalidate()};
    image.src=src;
  }

  function smartBounds(){
    if(!sourceImage)return null;
    if(smartBoundsCache&&smartBoundsSrc===sourceSrc)return smartBoundsCache;
    const max=192,scale=Math.min(1,max/Math.max(sourceImage.naturalWidth,sourceImage.naturalHeight));
    const w=Math.max(1,Math.round(sourceImage.naturalWidth*scale)),h=Math.max(1,Math.round(sourceImage.naturalHeight*scale));
    const canvas=document.createElement('canvas');canvas.width=w;canvas.height=h;
    const ctx=canvas.getContext('2d',{willReadFrequently:true});ctx.drawImage(sourceImage,0,0,w,h);
    const data=ctx.getImageData(0,0,w,h).data;
    const corners=[[0,0],[w-1,0],[0,h-1],[w-1,h-1]];
    let br=0,bg=0,bb=0,ba=0;
    corners.forEach(([x,y])=>{const i=(y*w+x)*4;br+=data[i];bg+=data[i+1];bb+=data[i+2];ba+=data[i+3]});
    br/=4;bg/=4;bb/=4;ba/=4;
    let minX=w,minY=h,maxX=-1,maxY=-1;
    const transparentBg=ba<48;
    for(let y=0;y<h;y++)for(let x=0;x<w;x++){
      const i=(y*w+x)*4,a=data[i+3];
      if(a<12)continue;
      const dr=data[i]-br,dg=data[i+1]-bg,db=data[i+2]-bb;
      const distance=Math.sqrt(dr*dr+dg*dg+db*db);
      const foreground=transparentBg?a>28:distance>34||Math.abs(a-ba)>32;
      if(foreground){if(x<minX)minX=x;if(x>maxX)maxX=x;if(y<minY)minY=y;if(y>maxY)maxY=y}
    }
    if(maxX<minX||maxY<minY){smartBoundsCache=null;smartBoundsSrc=sourceSrc;return null}
    const bw=maxX-minX+1,bh=maxY-minY+1;
    if(bw*bh>w*h*.985){smartBoundsCache=null;smartBoundsSrc=sourceSrc;return null}
    const margin=Math.max(1,Math.round(Math.max(bw,bh)*.035));
    minX=Math.max(0,minX-margin);minY=Math.max(0,minY-margin);maxX=Math.min(w-1,maxX+margin);maxY=Math.min(h-1,maxY+margin);
    smartBoundsCache={x:minX/scale,y:minY/scale,w:(maxX-minX+1)/scale,h:(maxY-minY+1)/scale};
    smartBoundsSrc=sourceSrc;
    return smartBoundsCache;
  }

  function roundRectPath(ctx,x,y,w,h,r){
    r=Math.min(r,w/2,h/2);ctx.beginPath();ctx.moveTo(x+r,y);ctx.arcTo(x+w,y,x+w,y+h,r);ctx.arcTo(x+w,y+h,x,y+h,r);ctx.arcTo(x,y+h,x,y,r);ctx.arcTo(x,y,x+w,y,r);ctx.closePath();
  }
  function renderMaster(){
    if(!sourceImage)return null;
    const key=stateKey();if(masterCache&&masterKey===key)return masterCache;
    const s=state(),size=512,out=document.createElement('canvas');out.width=out.height=size;
    const ctx=out.getContext('2d');ctx.clearRect(0,0,size,size);
    ctx.save();
    if(s.shape==='circle'){ctx.beginPath();ctx.arc(size/2,size/2,size/2,0,Math.PI*2);ctx.clip()}
    else if(s.shape==='rounded'){roundRectPath(ctx,0,0,size,size,size*s.radius/100);ctx.clip()}
    if(s.background==='color'){ctx.fillStyle=s.backgroundColor;ctx.fillRect(0,0,size,size)}

    const bounds=s.fit==='auto'?(smartBounds()||{x:0,y:0,w:sourceImage.naturalWidth,h:sourceImage.naturalHeight}):{x:0,y:0,w:sourceImage.naturalWidth,h:sourceImage.naturalHeight};
    const safe=size*(1-s.padding*2/100);
    const fitMode=s.fit==='cover'?'cover':'contain';
    const baseScale=fitMode==='cover'?Math.max(safe/bounds.w,safe/bounds.h):Math.min(safe/bounds.w,safe/bounds.h);
    const drawScale=baseScale*(s.scale/100);
    const dw=bounds.w*drawScale,dh=bounds.h*drawScale;
    const dx=(size-dw)/2+(s.x/100)*(size*.42);
    const dy=(size-dh)/2+(s.y/100)*(size*.42);
    ctx.imageSmoothingEnabled=true;ctx.imageSmoothingQuality='high';
    ctx.drawImage(sourceImage,bounds.x,bounds.y,bounds.w,bounds.h,dx,dy,dw,dh);
    ctx.restore();
    masterCache=out;masterKey=key;return out;
  }
  function downsample(master,size){
    let current=master;
    while(current.width/2>size*1.35){
      const next=document.createElement('canvas');next.width=next.height=Math.max(size,Math.round(current.width/2));
      const ctx=next.getContext('2d');ctx.imageSmoothingEnabled=true;ctx.imageSmoothingQuality='high';ctx.drawImage(current,0,0,next.width,next.height);current=next;
    }
    if(current.width!==size){const next=document.createElement('canvas');next.width=next.height=size;const ctx=next.getContext('2d');ctx.imageSmoothingEnabled=true;ctx.imageSmoothingQuality='high';ctx.drawImage(current,0,0,size,size);current=next}
    return current;
  }
  function sharpen(canvas,amount){
    const ctx=canvas.getContext('2d',{willReadFrequently:true}),w=canvas.width,h=canvas.height;
    if(w<3||h<3)return canvas;
    const src=ctx.getImageData(0,0,w,h),out=ctx.createImageData(w,h),a=amount;
    out.data.set(src.data);
    for(let y=1;y<h-1;y++)for(let x=1;x<w-1;x++){
      const i=(y*w+x)*4;
      for(let c=0;c<3;c++){
        const center=src.data[i+c]*(1+4*a);
        const sides=(src.data[i-4+c]+src.data[i+4+c]+src.data[i-w*4+c]+src.data[i+w*4+c])*a;
        out.data[i+c]=clamp(Math.round(center-sides),0,255);
      }
      out.data[i+3]=src.data[i+3];
    }
    ctx.putImageData(out,0,0);return canvas;
  }
  function buildIcon(size){
    const master=renderMaster();if(!master)return null;
    const out=downsample(master,size);
    if(state().optimize&&size<=32)sharpen(out,size<=16?.20:.12);
    return out;
  }

  function copyCanvasTo(target,source){
    if(!target||!source)return;target.width=source.width;target.height=source.height;const ctx=target.getContext('2d');ctx.clearRect(0,0,target.width,target.height);ctx.drawImage(source,0,0);
  }
  function render(){
    const wrap=$('previewWrap');
    if(!wrap)return;
    if(!active()){wrap.classList.remove('sl-favicon-suite-ready');return}
    syncSource();
    if(!sourceImage){wrap.classList.remove('sl-favicon-suite-ready');return}
    const suite=ensurePreview();if(!suite)return;
    PREVIEW_SIZES.forEach(size=>copyCanvasTo(suite.querySelector(`.fav-preview-item[data-size="${size}"] canvas`),buildIcon(size)));
    copyCanvasTo(suite.querySelector('.fav-tab canvas'),buildIcon(16));
    copyCanvasTo(suite.querySelector('.fav-bookmark-row canvas'),buildIcon(32));
    copyCanvasTo(suite.querySelector('.fav-app>canvas'),buildIcon(64));
    const site=state().siteName||'Website';
    const tab=suite.querySelector('.fav-tab span');if(tab)tab.textContent=site;
    const bm=suite.querySelector('.fav-bookmark-row b');if(bm)bm.textContent=site;
    wrap.classList.add('sl-favicon-suite-ready');
    if($('ro-dims'))$('ro-dims').textContent='180 · 128 · 64 · 32 · 16 px';
    if($('ro-format'))$('ro-format').textContent='ICON';
    updateCode();
  }
  function scheduleRender(){cancelAnimationFrame(renderQueued);renderQueued=requestAnimationFrame(render)}

  function bindDrag(canvas){
    if(!canvas||canvas.dataset.favDrag)return;canvas.dataset.favDrag='1';canvas.style.touchAction='none';
    let dragging=false,startX=0,startY=0,startPX=0,startPY=0;
    canvas.addEventListener('pointerdown',e=>{dragging=true;startX=e.clientX;startY=e.clientY;startPX=num('fav-x',0);startPY=num('fav-y',0);canvas.setPointerCapture?.(e.pointerId)});
    canvas.addEventListener('pointermove',e=>{if(!dragging)return;const rect=canvas.getBoundingClientRect();const x=clamp(startPX+(e.clientX-startX)/Math.max(1,rect.width)*100,-100,100),y=clamp(startPY+(e.clientY-startY)/Math.max(1,rect.height)*100,-100,100);if($('fav-x'))$('fav-x').value=Math.round(x);if($('fav-y'))$('fav-y').value=Math.round(y);$('fav-x')?.dispatchEvent(new Event('input',{bubbles:true}));$('fav-y')?.dispatchEvent(new Event('input',{bubbles:true}))});
    const stop=e=>{dragging=false;try{canvas.releasePointerCapture?.(e.pointerId)}catch(_){}};
    canvas.addEventListener('pointerup',stop);canvas.addEventListener('pointercancel',stop);
    canvas.addEventListener('wheel',e=>{if(!active())return;e.preventDefault();const input=$('fav-scale');if(!input)return;input.value=clamp(Number(input.value)+(e.deltaY<0?5:-5),50,250);input.dispatchEvent(new Event('input',{bubbles:true}))},{passive:false});
  }

  async function canvasPng(canvas){return new Promise((resolve,reject)=>canvas.toBlob(blob=>blob?resolve(blob):reject(new Error('Не удалось создать PNG')),'image/png'))}
  async function buildIco(){
    const parts=[];
    for(const size of ICO_SIZES){const canvas=buildIcon(size);const blob=await canvasPng(canvas);parts.push({size,buffer:await blob.arrayBuffer()})}
    const header=6+parts.length*16,total=header+parts.reduce((sum,p)=>sum+p.buffer.byteLength,0),out=new ArrayBuffer(total),view=new DataView(out);let offset=0;
    view.setUint16(0,0,true);view.setUint16(2,1,true);view.setUint16(4,parts.length,true);offset=6;let imageOffset=header;
    parts.forEach(part=>{view.setUint8(offset,part.size>=256?0:part.size);view.setUint8(offset+1,part.size>=256?0:part.size);view.setUint8(offset+2,0);view.setUint8(offset+3,0);view.setUint16(offset+4,1,true);view.setUint16(offset+6,32,true);view.setUint32(offset+8,part.buffer.byteLength,true);view.setUint32(offset+12,imageOffset,true);new Uint8Array(out,imageOffset,part.buffer.byteLength).set(new Uint8Array(part.buffer));imageOffset+=part.buffer.byteLength;offset+=16});
    return new Blob([out],{type:'image/x-icon'});
  }
  function download(blob,name){const url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=name;document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),4000)}
  async function exportPackage(){
    if(!window.JSZip)throw new Error('Локальный ZIP-модуль не загрузился');
    if(!sourceImage)throw new Error('Сначала загрузите изображение');
    const zip=new JSZip();
    for(const size of EXPORT_SIZES){const blob=await canvasPng(buildIcon(size));let name=`favicon-${size}x${size}.png`;if(size===180)name='apple-touch-icon.png';if(size===192)name='android-chrome-192x192.png';if(size===512)name='android-chrome-512x512.png';zip.file(name,blob)}
    zip.file('favicon.ico',await buildIco());
    zip.file('site.webmanifest',manifestText());
    zip.file('favicon-snippet.html',htmlSnippet()+'\n');
    zip.file('README.txt','Safelight Favicon Generator\n\n1. Скопируйте файлы в папку сайта.\n2. Вставьте содержимое favicon-snippet.html в <head>.\n3. При необходимости измените пути в site.webmanifest.\n');
    download(await zip.generateAsync({type:'blob'}),'safelight-favicon-package.zip');
  }
  async function exportIco(){if(!sourceImage)throw new Error('Сначала загрузите изображение');download(await buildIco(),'favicon.ico')}
  async function exportPng512(){if(!sourceImage)throw new Error('Сначала загрузите изображение');download(await canvasPng(buildIcon(512)),'favicon-512x512.png')}
  function hint(text){const el=$('sl-export-hint');if(!el)return;el.textContent=text;el.classList.add('show');clearTimeout(hint.timer);hint.timer=setTimeout(()=>el.classList.remove('show'),3000)}

  function enhanceExportMenu(){
    if(!active())return;
    const menu=document.querySelector('.sl-export-menu');if(!menu)return;
    menu.innerHTML='<div class="sl-export-menu-title">Favicon Generator</div>'+
      '<button class="sl-export-option" type="button" data-export="favicon-zip"><span>Полный пакет</span><span>ZIP</span></button>'+
      '<button class="sl-export-option" type="button" data-export="favicon-ico"><span>favicon.ico</span><span>ICO</span></button>'+
      '<button class="sl-export-option" type="button" data-export="favicon-png-512"><span>PNG 512×512</span><span>PNG</span></button>'+
      '<div class="sl-export-sep"></div><div class="sl-export-menu-note">Пакет создаётся локально и включает manifest и HTML-код.</div>';
  }
  function installExportOverride(){
    document.addEventListener('click',event=>{
      if(event.target.closest('#sl-export')&&active())setTimeout(enhanceExportMenu,0);
    },true);
    document.addEventListener('click',async event=>{
      const option=event.target.closest('.sl-export-option[data-export^="favicon-"]');if(!option||!active())return;
      event.preventDefault();event.stopImmediatePropagation();document.querySelector('.sl-export-wrap')?.classList.remove('open');
      try{if(option.dataset.export==='favicon-zip')await exportPackage();else if(option.dataset.export==='favicon-ico')await exportIco();else if(option.dataset.export==='favicon-png-512')await exportPng512();hint('Экспорт favicon готов.')}catch(error){console.error('Safelight favicon export:',error);hint(error.message||'Не удалось экспортировать favicon')}
    },true);
  }

  function boot(){
    const panel=$('panel-favicon'),wrap=$('previewWrap'),preview=$('previewImg');
    if(!panel||!wrap||!preview||!document.querySelector('.sl-app')){setTimeout(boot,50);return}
    injectControls();ensurePreview();installExportOverride();syncSource();
    new MutationObserver(()=>{syncSource();scheduleRender()}).observe(preview,{attributes:true,attributeFilter:['src']});
    window.addEventListener('safelight:toolchange',()=>setTimeout(scheduleRender,0));
    window.addEventListener('safelight:live-render',event=>{if(event.detail?.tool==='favicon')scheduleRender()});
    scheduleRender();
  }

  window.safelightFaviconTools=Object.freeze({buildIcon,exportPackage,buildIco,htmlSnippet,manifestText,state});
  boot();
})();
