(function(){
  'use strict';
  if(window.safelightBackgroundRemovalLoaded)return;
  window.safelightBackgroundRemovalLoaded=true;

  const $=id=>document.getElementById(id);
  const clamp=(v,min,max)=>Math.max(min,Math.min(max,v));
  const state={mode:'key',view:'transparent',target:[255,255,255],tolerance:24,feather:2,brushMode:'erase',brushSize:56,brushSoftness:70};
  let panel=null,preview=null,wrap=null,canvas=null,ctx=null;
  let sourceSrc='',sourceImage=null,sourceData=null,resultData=null,mask=null,baseAlpha=null;
  let loadToken=0,pickArmed=false,painting=false,lastPoint=null,dirty=false,busy=false;

  function active(){return !!panel?.classList.contains('active')}
  function status(text){const el=$('bg-status');if(el)el.textContent=text||''}
  function hex(rgb){return '#'+rgb.map(v=>Math.round(v).toString(16).padStart(2,'0')).join('')}
  function rgbFromHex(value){const m=/^#?([\da-f]{2})([\da-f]{2})([\da-f]{2})$/i.exec(String(value||''));return m?[parseInt(m[1],16),parseInt(m[2],16),parseInt(m[3],16)]:[255,255,255]}
  function setLabel(id,text){const el=$(id);if(el)el.textContent=text}

  function section(title,subtitle,body,open){return `<div class="sl-bg-section sl-bg-accordion${open?' open':''}">
    <button type="button" class="sl-bg-section-head" aria-expanded="${open?'true':'false'}"><span><b>${title}</b><small>${subtitle}</small></span><i aria-hidden="true"></i></button>
    <div class="sl-bg-section-body"${open?'':' hidden'}>${body}</div>
  </div>`}
  function slider(id,label,min,max,value,step){return `<div class="slider-row sl-bg-slider"><div class="top"><span>${label}</span><b id="${id}-val">${value}</b></div><input type="range" id="${id}" min="${min}" max="${max}" value="${value}" step="${step||1}"></div>`}

  function panelMarkup(){return `<div class="panel-card sl-bg-panel">
    <h2>УДАЛЕНИЕ ФОНА</h2>
    <p class="desc">Для логотипов, товаров, скриншотов и изображений с однотонным или близким по цвету фоном.</p>
    <div class="sl-bg-mode" role="group" aria-label="Режим удаления фона">
      <button type="button" class="active" data-bg-mode="key">Цветовой ключ</button>
      <button type="button" data-bg-mode="wand">Magic Wand</button>
      <button type="button" data-bg-mode="brush">Кисть</button>
    </div>
    ${section('Цветовой ключ','удалить похожий цвет по всему изображению',`
      <div class="sl-bg-color-row"><input type="color" id="bg-key-color" value="#ffffff" aria-label="Цвет фона"><button type="button" class="btn ghost" data-bg-action="pick">Пипетка</button><span id="bg-key-hex">#ffffff</span></div>
      ${slider('bg-tolerance','Допуск',0,100,24,1)}
      ${slider('bg-feather','Feather края',0,30,2,1)}
      <button type="button" class="btn ghost sl-bg-wide" data-bg-action="apply-key">Удалить выбранный цвет</button>
      <p class="sl-bg-help">Пипетка берёт цвет из исходного изображения. Допуск определяет диапазон похожих оттенков.</p>`,true)}
    ${section('Magic Wand','удалить только связанную область от клика',`
      <div class="sl-bg-wand-note"><b>Кликните по фону на изображении</b><span>Палочка удалит связанную область с учётом текущего допуска и Feather.</span></div>
      <button type="button" class="btn ghost sl-bg-wide" data-bg-action="arm-wand">Активировать палочку</button>`,false)}
    ${section('Кисть','ручная доводка маски',`
      <div class="sl-bg-brush-mode"><button type="button" class="active" data-bg-brush="erase">Стереть</button><button type="button" data-bg-brush="restore">Вернуть</button></div>
      ${slider('bg-brush-size','Размер',1,300,56,1)}
      ${slider('bg-brush-soft','Мягкость',0,100,70,1)}
      <p class="sl-bg-help">«Вернуть» восстанавливает исходную прозрачность пикселей, а не рисует новый цвет.</p>`,false)}
    ${section('Маска и просмотр','проверка краёв и прозрачности',`
      <div class="sl-bg-view"><button type="button" class="active" data-bg-view="transparent">Шахматка</button><button type="button" data-bg-view="white">Белый</button><button type="button" data-bg-view="dark">Тёмный</button><button type="button" data-bg-view="mask">Маска</button></div>
      <div class="sl-bg-actions"><button type="button" class="btn ghost" data-bg-action="feather-mask">Смягчить маску</button><button type="button" class="btn ghost" data-bg-action="invert">Инвертировать</button><button type="button" class="btn ghost" data-bg-action="reset-mask">Сбросить маску</button></div>
      <div class="sl-bg-stat"><span>Удалено</span><b id="bg-removed-stat">0%</b></div>`,false)}
    <div class="status-line" id="bg-status">Загрузите изображение и выберите способ удаления.</div>
  </div>`}

  function installPanel(){
    panel=$('panel-background');if(!panel)return false;
    panel.innerHTML=panelMarkup();bindPanel();return true;
  }

  function ensureCanvas(){
    preview=$('previewImg');wrap=$('previewWrap');if(!preview||!wrap)return false;
    canvas=$('sl-bg-removal-canvas');
    if(!canvas){canvas=document.createElement('canvas');canvas.id='sl-bg-removal-canvas';canvas.className='sl-bg-removal-canvas';canvas.setAttribute('aria-label','Предпросмотр маски удаления фона');wrap.appendChild(canvas)}
    ctx=canvas.getContext('2d',{willReadFrequently:true});
    if(!canvas.dataset.bgBound){canvas.dataset.bgBound='1';bindCanvas()}
    return true;
  }

  function positionCanvas(){
    if(!canvas||!preview||!wrap)return;const ir=preview.getBoundingClientRect(),wr=wrap.getBoundingClientRect();if(!ir.width||!ir.height)return;
    canvas.style.left=(ir.left-wr.left)+'px';canvas.style.top=(ir.top-wr.top)+'px';canvas.style.width=ir.width+'px';canvas.style.height=ir.height+'px';
  }

  function loadSource(){
    if(!ensureCanvas())return Promise.resolve(false);
    const src=preview?.src||'';if(!src){clearSource();return Promise.resolve(false)}
    if(sourceData&&sourceSrc===src){positionCanvas();renderFull();return Promise.resolve(true)}
    const token=++loadToken;status('Читаю изображение…');
    return new Promise((resolve,reject)=>{
      const image=new Image();
      image.onload=()=>{
        if(token!==loadToken||preview?.src!==src){resolve(false);return}
        sourceImage=image;sourceSrc=src;canvas.width=image.naturalWidth;canvas.height=image.naturalHeight;
        const sourceCanvas=document.createElement('canvas');sourceCanvas.width=canvas.width;sourceCanvas.height=canvas.height;const sctx=sourceCanvas.getContext('2d',{willReadFrequently:true});sctx.drawImage(image,0,0);
        sourceData=sctx.getImageData(0,0,canvas.width,canvas.height);resultData=new ImageData(new Uint8ClampedArray(sourceData.data),canvas.width,canvas.height);
        const n=canvas.width*canvas.height;baseAlpha=new Uint8ClampedArray(n);mask=new Uint8ClampedArray(n);
        for(let i=0,p=3;i<n;i++,p+=4){baseAlpha[i]=sourceData.data[p];mask[i]=baseAlpha[i]}
        dirty=false;pickArmed=false;painting=false;lastPoint=null;positionCanvas();renderFull();updateStats();status('Маска готова. Выберите цвет, палочку или кисть.');resolve(true)
      };
      image.onerror=()=>{if(token===loadToken){clearSource();status('Не удалось открыть изображение.');reject(new Error('Не удалось открыть изображение'))}else resolve(false)};
      image.src=src;
    })
  }

  function clearSource(){loadToken++;sourceSrc='';sourceImage=null;sourceData=null;resultData=null;mask=null;baseAlpha=null;dirty=false;if(canvas){canvas.width=1;canvas.height=1;ctx?.clearRect(0,0,1,1)}updateStats()}
  function syncResultAlpha(){if(!resultData||!mask)return;for(let i=0,p=3;i<mask.length;i++,p+=4)resultData.data[p]=mask[i]}
  function renderFull(){
    if(!ctx||!mask||!sourceData)return;positionCanvas();
    if(state.view==='mask'){
      const image=ctx.createImageData(canvas.width,canvas.height),d=image.data;for(let i=0,p=0;i<mask.length;i++,p+=4){const v=mask[i];d[p]=v;d[p+1]=v;d[p+2]=v;d[p+3]=255}ctx.putImageData(image,0,0);
    }else{syncResultAlpha();ctx.putImageData(resultData,0,0)}
    canvas.dataset.view=state.view;
  }
  function renderDirty(x0,y0,x1,y1){
    if(!ctx||!mask||!sourceData)return;const x=Math.max(0,Math.floor(x0)),y=Math.max(0,Math.floor(y0)),right=Math.min(canvas.width,Math.ceil(x1)),bottom=Math.min(canvas.height,Math.ceil(y1)),w=right-x,h=bottom-y;if(w<=0||h<=0)return;
    if(state.view==='mask'){
      const image=ctx.createImageData(w,h),d=image.data;let p=0;for(let yy=y;yy<bottom;yy++)for(let xx=x;xx<right;xx++){const v=mask[yy*canvas.width+xx];d[p++]=v;d[p++]=v;d[p++]=v;d[p++]=255}ctx.putImageData(image,x,y);
    }else{
      for(let yy=y;yy<bottom;yy++)for(let xx=x;xx<right;xx++){const i=yy*canvas.width+xx;resultData.data[i*4+3]=mask[i]}ctx.putImageData(resultData,0,0,x,y,w,h)
    }
  }

  function updateStats(){
    const out=$('bg-removed-stat');if(!out){return}if(!mask||!baseAlpha){out.textContent='0%';return}
    let original=0,remaining=0;for(let i=0;i<mask.length;i++){original+=baseAlpha[i];remaining+=mask[i]}
    const removed=original?clamp((1-remaining/original)*100,0,100):0;out.textContent=(removed<10?removed.toFixed(1):Math.round(removed))+'%';
  }

  function canvasPoint(event){const rect=canvas?.getBoundingClientRect();if(!rect?.width||!rect.height)return null;return{x:clamp(Math.floor((event.clientX-rect.left)/rect.width*canvas.width),0,canvas.width-1),y:clamp(Math.floor((event.clientY-rect.top)/rect.height*canvas.height),0,canvas.height-1)}}
  function sourceRgb(x,y){if(!sourceData)return[255,255,255];const p=(y*canvas.width+x)*4,d=sourceData.data;return[d[p],d[p+1],d[p+2]]}
  function colorDistanceAt(i,target){const p=i*4,d=sourceData.data,dr=d[p]-target[0],dg=d[p+1]-target[1],db=d[p+2]-target[2];return Math.sqrt(dr*dr+dg*dg+db*db)}
  function threshold(){return state.tolerance/100*441.67295593}

  function featherSelection(selection,radius){
    radius=Math.round(radius);if(radius<=0)return selection;
    const a=document.createElement('canvas'),b=document.createElement('canvas');a.width=b.width=canvas.width;a.height=b.height=canvas.height;const actx=a.getContext('2d',{willReadFrequently:true}),bctx=b.getContext('2d',{willReadFrequently:true}),img=actx.createImageData(a.width,a.height),d=img.data;
    for(let i=0,p=0;i<selection.length;i++,p+=4){d[p]=255;d[p+1]=255;d[p+2]=255;d[p+3]=selection[i]}actx.putImageData(img,0,0);bctx.filter=`blur(${radius}px)`;bctx.drawImage(a,0,0);bctx.filter='none';const blurred=bctx.getImageData(0,0,b.width,b.height).data,out=new Uint8ClampedArray(selection.length);for(let i=0,p=3;i<out.length;i++,p+=4)out[i]=blurred[p];return out
  }

  function applySelection(selection,label){
    if(!mask)return;const feathered=featherSelection(selection,state.feather);for(let i=0;i<mask.length;i++){const coverage=feathered[i]/255;if(coverage>0)mask[i]=Math.round(mask[i]*(1-coverage))}dirty=true;renderFull();updateStats();status(label||'Маска обновлена.')
  }

  function applyColorKey(){
    if(!sourceData||busy)return;busy=true;status('Ищу похожие цвета…');requestAnimationFrame(()=>{
      try{const n=mask.length,selection=new Uint8ClampedArray(n),limit=threshold(),soft=Math.max(1,limit*.32+2),target=state.target;for(let i=0;i<n;i++){if(baseAlpha[i]===0)continue;const dist=colorDistanceAt(i,target);if(dist<=limit)selection[i]=255;else if(dist<limit+soft)selection[i]=Math.round(255*(1-(dist-limit)/soft))}applySelection(selection,'Цветовой ключ применён. При необходимости доведите край кистью.')}
      finally{busy=false}
    })
  }

  function floodSelection(sx,sy){
    const w=canvas.width,h=canvas.height,n=w*h,selection=new Uint8ClampedArray(n),target=sourceRgb(sx,sy),limit=threshold();
    const matches=(x,y)=>{if(x<0||y<0||x>=w||y>=h)return false;const i=y*w+x;if(selection[i]||baseAlpha[i]===0)return false;return colorDistanceAt(i,target)<=limit};
    const stack=[[sx,sy]];
    while(stack.length){const point=stack.pop();let x=point[0],y=point[1];while(x>=0&&matches(x,y))x--;x++;let spanUp=false,spanDown=false;for(;x<w&&matches(x,y);x++){const i=y*w+x;selection[i]=255;if(y>0){if(matches(x,y-1)){if(!spanUp){stack.push([x,y-1]);spanUp=true}}else spanUp=false}if(y<h-1){if(matches(x,y+1)){if(!spanDown){stack.push([x,y+1]);spanDown=true}}else spanDown=false}}}
    return selection
  }
  function applyWand(x,y){if(!sourceData||busy)return;busy=true;status('Выделяю связанную область…');requestAnimationFrame(()=>{try{applySelection(floodSelection(x,y),'Magic Wand применён. Кликните ещё раз, чтобы удалить другую область.')}finally{busy=false}})}

  function paintAt(x,y){
    if(!mask||!baseAlpha)return null;const radius=Math.max(.5,state.brushSize/2),soft=state.brushSoftness/100,inner=radius*(1-soft),x0=Math.floor(x-radius-1),y0=Math.floor(y-radius-1),x1=Math.ceil(x+radius+1),y1=Math.ceil(y+radius+1);
    for(let yy=Math.max(0,y0);yy<Math.min(canvas.height,y1);yy++)for(let xx=Math.max(0,x0);xx<Math.min(canvas.width,x1);xx++){
      const dx=xx+.5-x,dy=yy+.5-y,dist=Math.sqrt(dx*dx+dy*dy);if(dist>radius)continue;let power;if(dist<=inner||soft<=.001)power=1;else power=clamp((radius-dist)/Math.max(.001,radius-inner),0,1);power=power*power*(3-2*power);const i=yy*canvas.width+xx,target=state.brushMode==='restore'?baseAlpha[i]:0;mask[i]=Math.round(mask[i]+(target-mask[i])*power)
    }
    dirty=true;return{x0,y0,x1,y1}
  }
  function paintLine(from,to){const dx=to.x-from.x,dy=to.y-from.y,d=Math.hypot(dx,dy),step=Math.max(1,state.brushSize*.16),count=Math.max(1,Math.ceil(d/step));let bounds=null;for(let i=0;i<=count;i++){const t=i/count,b=paintAt(from.x+dx*t,from.y+dy*t);if(!b)continue;if(!bounds)bounds={...b};else{bounds.x0=Math.min(bounds.x0,b.x0);bounds.y0=Math.min(bounds.y0,b.y0);bounds.x1=Math.max(bounds.x1,b.x1);bounds.y1=Math.max(bounds.y1,b.y1)}}if(bounds)renderDirty(bounds.x0,bounds.y0,bounds.x1,bounds.y1)}

  function featherMask(){
    if(!mask||state.feather<=0){status('Увеличьте Feather выше 0.');return}busy=true;status('Смягчаю край маски…');requestAnimationFrame(()=>{try{const selection=new Uint8ClampedArray(mask.length);for(let i=0;i<mask.length;i++)selection[i]=mask[i];const blurred=featherSelection(selection,state.feather);for(let i=0;i<mask.length;i++)mask[i]=Math.min(baseAlpha[i],blurred[i]);dirty=true;renderFull();updateStats();status('Край маски смягчён.')}finally{busy=false}})
  }
  function invertMask(){if(!mask)return;for(let i=0;i<mask.length;i++)mask[i]=Math.min(baseAlpha[i],baseAlpha[i]-mask[i]);dirty=true;renderFull();updateStats();status('Маска инвертирована.')}
  function resetMask(){if(!mask||!baseAlpha)return;mask.set(baseAlpha);dirty=false;renderFull();updateStats();status('Маска сброшена к исходному изображению.')}

  function setMode(mode){state.mode=mode;pickArmed=false;painting=false;lastPoint=null;panel?.querySelectorAll('[data-bg-mode]').forEach(b=>b.classList.toggle('active',b.dataset.bgMode===mode));canvas?.classList.toggle('sl-bg-wand-cursor',mode==='wand');canvas?.classList.toggle('sl-bg-brush-cursor',mode==='brush');status(mode==='wand'?'Кликните по области фона.':mode==='brush'?'Рисуйте по изображению кистью.':'Выберите цвет пипеткой или через поле цвета.')}
  function setView(view){state.view=view;panel?.querySelectorAll('[data-bg-view]').forEach(b=>b.classList.toggle('active',b.dataset.bgView===view));renderFull()}
  function setBrushMode(mode){state.brushMode=mode;panel?.querySelectorAll('[data-bg-brush]').forEach(b=>b.classList.toggle('active',b.dataset.bgBrush===mode));status(mode==='restore'?'Кисть возвращает исходные пиксели.':'Кисть стирает фон в прозрачность.')}
  function setAccordion(section,open){const head=section.querySelector('.sl-bg-section-head'),body=section.querySelector('.sl-bg-section-body');section.classList.toggle('open',open);head?.setAttribute('aria-expanded',open?'true':'false');if(body)body.hidden=!open}

  function updateLabels(){setLabel('bg-tolerance-val',Math.round(state.tolerance));setLabel('bg-feather-val',Math.round(state.feather)+' px');setLabel('bg-brush-size-val',Math.round(state.brushSize)+' px');setLabel('bg-brush-soft-val',Math.round(state.brushSoftness)+'%');setLabel('bg-key-hex',hex(state.target))}

  function bindPanel(){
    panel.addEventListener('click',event=>{
      const head=event.target.closest('.sl-bg-section-head');if(head){event.preventDefault();const section=head.closest('.sl-bg-accordion'),open=head.getAttribute('aria-expanded')==='true';setAccordion(section,!open);return}
      const mode=event.target.closest('[data-bg-mode]');if(mode){event.preventDefault();setMode(mode.dataset.bgMode);return}
      const brush=event.target.closest('[data-bg-brush]');if(brush){event.preventDefault();setBrushMode(brush.dataset.bgBrush);return}
      const view=event.target.closest('[data-bg-view]');if(view){event.preventDefault();setView(view.dataset.bgView);return}
      const action=event.target.closest('[data-bg-action]')?.dataset.bgAction;if(!action)return;event.preventDefault();
      if(action==='pick'){setMode('key');pickArmed=true;canvas?.classList.add('sl-bg-pick-cursor');status('Пипетка активна: кликните по цвету фона на изображении.')}
      else if(action==='apply-key')applyColorKey();
      else if(action==='arm-wand')setMode('wand');
      else if(action==='feather-mask')featherMask();
      else if(action==='invert')invertMask();
      else if(action==='reset-mask')resetMask();
    });
    panel.addEventListener('input',event=>{
      const el=event.target;if(el.id==='bg-tolerance')state.tolerance=Number(el.value)||0;
      else if(el.id==='bg-feather')state.feather=Number(el.value)||0;
      else if(el.id==='bg-brush-size')state.brushSize=Number(el.value)||1;
      else if(el.id==='bg-brush-soft')state.brushSoftness=Number(el.value)||0;
      else if(el.id==='bg-key-color'){state.target=rgbFromHex(el.value);updateLabels()}
      updateLabels();
    },true);
  }

  function bindCanvas(){
    canvas.addEventListener('pointerdown',event=>{
      if(!active()||!sourceData||busy)return;const p=canvasPoint(event);if(!p)return;event.preventDefault();
      if(pickArmed){state.target=sourceRgb(p.x,p.y);const color=$('bg-key-color');if(color)color.value=hex(state.target);pickArmed=false;canvas.classList.remove('sl-bg-pick-cursor');updateLabels();status('Цвет выбран. Нажмите «Удалить выбранный цвет».');return}
      if(state.mode==='wand'){applyWand(p.x,p.y);return}
      if(state.mode==='brush'){painting=true;lastPoint=p;canvas.setPointerCapture?.(event.pointerId);const b=paintAt(p.x,p.y);if(b)renderDirty(b.x0,b.y0,b.x1,b.y1)}
    });
    canvas.addEventListener('pointermove',event=>{if(!painting||state.mode!=='brush'||!sourceData)return;const p=canvasPoint(event);if(!p)return;event.preventDefault();paintLine(lastPoint||p,p);lastPoint=p});
    const stop=()=>{if(!painting)return;painting=false;lastPoint=null;updateStats();status(state.brushMode==='restore'?'Область восстановлена кистью.':'Область стёрта кистью.')};
    canvas.addEventListener('pointerup',stop);canvas.addEventListener('pointercancel',stop);canvas.addEventListener('pointerleave',event=>{if(!event.buttons)stop()});
  }

  function renderResult(){
    if(!sourceData||!mask)throw new Error('Маска удаления фона ещё не готова');syncResultAlpha();const out=document.createElement('canvas');out.width=canvas.width;out.height=canvas.height;out.getContext('2d').putImageData(resultData,0,0);return out
  }
  function reset(){
    if(panel){const tolerance=$('bg-tolerance'),feather=$('bg-feather'),size=$('bg-brush-size'),soft=$('bg-brush-soft'),color=$('bg-key-color');if(tolerance)tolerance.value='24';if(feather)feather.value='2';if(size)size.value='56';if(soft)soft.value='70';if(color)color.value='#ffffff'}
    Object.assign(state,{mode:'key',view:'transparent',target:[255,255,255],tolerance:24,feather:2,brushMode:'erase',brushSize:56,brushSoftness:70});setMode('key');setBrushMode('erase');setView('transparent');updateLabels();resetMask()
  }

  function activate(){document.body.classList.add('sl-bg-active');ensureCanvas();loadSource().then(()=>{positionCanvas();renderFull()}).catch(()=>{})}
  function deactivate(){document.body.classList.remove('sl-bg-active');pickArmed=false;painting=false;lastPoint=null;canvas?.classList.remove('sl-bg-pick-cursor')}

  function install(){
    if(!installPanel()||!ensureCanvas()){setTimeout(install,60);return}
    updateLabels();setMode('key');setBrushMode('erase');setView('transparent');
    window.addEventListener('safelight:toolchange',event=>{const page=String(event.detail?.page||'').replace(/-ui$/,'');if(page==='background')activate();else deactivate()});
    new MutationObserver(()=>{sourceSrc='';sourceData=null;resultData=null;mask=null;baseAlpha=null;if(active())setTimeout(()=>loadSource().catch(()=>{}),0)}).observe(preview,{attributes:true,attributeFilter:['src']});
    window.addEventListener('resize',positionCanvas,{passive:true});window.addEventListener('scroll',positionCanvas,{passive:true});window.addEventListener('safelight:zoomchange',positionCanvas);
    if(active())activate();
  }

  window.safelightBackgroundRemovalTools=Object.freeze({render:async()=>renderResult(),reset,clear:resetMask,state:()=>({...state,dirty})});
  install();
})();
