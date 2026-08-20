(function(){
  'use strict';
  if(window.safelightCropToolsLoaded)return;
  window.safelightCropToolsLoaded=true;

  const $=id=>document.getElementById(id);
  const clamp=(value,min,max)=>Math.max(min,Math.min(max,value));
  const HINT_KEY='safelight:crop-hint-v1';
  const RATIOS={'1:1':1,'5:4':5/4,'4:5':4/5,'4:3':4/3,'3:2':3/2,'2:3':2/3,'16:9':16/9,'9:16':9/16};
  const state={x:0,y:0,w:1,h:1,ratio:'free',grid:'thirds',angle:0};
  let panel=null,overlay=null,frame=null,previewCanvas=null,horizon=null,tip=null,tipArrow=null,sourceImage=null,sourceSrc='',sourceToken=0,drag=null,renderRaf=0,exportBusy=false;

  function active(){return !!panel?.classList.contains('active')}
  function baseName(){return (($('meta-name')?.textContent||'safelight').trim().replace(/\.[^.]+$/,'')||'safelight')}
  function ratioValue(){if(state.ratio==='original'&&sourceImage)return sourceImage.naturalWidth/sourceImage.naturalHeight;return RATIOS[state.ratio]||null}
  function normalizedRatio(){if(!sourceImage)return null;const ratio=ratioValue();return ratio?ratio*(sourceImage.naturalHeight/sourceImage.naturalWidth):null}
  function setBody(value){document.body.classList.toggle('sl-crop-active',!!value);if(!value)document.body.classList.remove('sl-crop-dragging')}
  function cleanAngle(value){const n=Math.round(clamp(Number(value)||0,-45,45)*10)/10;return Math.abs(n)<.05?0:n}
  function coverScale(angle,w,h){const r=Math.abs(angle)*Math.PI/180,c=Math.abs(Math.cos(r)),s=Math.abs(Math.sin(r));return Math.max(c+(h/w)*s,c+(w/h)*s)}

  function panelMarkup(){return `<div class="panel-card sl-crop-panel">
    <h2>ОБРЕЗКА</h2>
    <p class="desc">Выравнивайте горизонт и задавайте кадр прямо на изображении.</p>
    <div class="sl-crop-section">
      <div class="sl-crop-section-head"><span>Горизонт</span><small>−45° … +45°</small></div>
      <div class="sl-crop-angle-row"><input type="range" id="crop-angle" min="-45" max="45" step="0.1" value="0"><input type="number" id="crop-angle-number" min="-45" max="45" step="0.1" value="0"><span>°</span></div>
      <div class="sl-crop-actions sl-crop-angle-actions"><button type="button" class="btn ghost" data-crop-angle-step="-0.5">−0.5°</button><button type="button" class="btn ghost" data-crop-action="straighten-reset">0°</button><button type="button" class="btn ghost" data-crop-angle-step="0.5">+0.5°</button></div>
      <div class="sl-crop-angle-note">Изображение автоматически увеличивается при повороте, чтобы по углам не появлялись пустые области.</div>
    </div>
    <div class="sl-crop-section">
      <div class="sl-crop-section-head"><span>Пропорции</span><small>фиксированное отношение сторон</small></div>
      <div class="sl-crop-ratios"><button type="button" class="btn ghost active" data-crop-ratio="free">Свободно</button><button type="button" class="btn ghost" data-crop-ratio="original">Исходное</button><button type="button" class="btn ghost" data-crop-ratio="1:1">1:1</button><button type="button" class="btn ghost" data-crop-ratio="4:3">4:3</button><button type="button" class="btn ghost" data-crop-ratio="3:2">3:2</button><button type="button" class="btn ghost" data-crop-ratio="16:9">16:9</button><button type="button" class="btn ghost" data-crop-ratio="9:16">9:16</button><button type="button" class="btn ghost" data-crop-ratio="5:4">5:4</button><button type="button" class="btn ghost" data-crop-ratio="4:5">4:5</button></div>
    </div>
    <div class="sl-crop-section">
      <div class="sl-crop-section-head"><span>Сетка</span><small>композиционные направляющие</small></div>
      <div class="sl-crop-grid-switch"><button type="button" class="btn ghost" data-crop-grid="none">Нет</button><button type="button" class="btn ghost active" data-crop-grid="thirds">3×3</button><button type="button" class="btn ghost" data-crop-grid="golden">Золотое сечение</button></div>
    </div>
    <div class="sl-crop-section">
      <div class="sl-crop-section-head"><span>Координаты</span><small>точно в пикселях</small></div>
      <div class="sl-crop-exact-grid"><label><span>X</span><input type="number" id="crop-x" min="0" step="1"></label><label><span>Y</span><input type="number" id="crop-y" min="0" step="1"></label><label><span>Ширина</span><input type="number" id="crop-w" min="1" step="1"></label><label><span>Высота</span><input type="number" id="crop-h" min="1" step="1"></label></div>
      <div class="sl-crop-readout"><span>Результат<b id="crop-size-readout">—</b></span><span>Останется<b id="crop-percent-readout">100%</b></span></div>
    </div>
    <div class="sl-crop-section">
      <div class="sl-crop-actions"><button type="button" class="btn ghost" data-crop-action="full">Во весь кадр</button><button type="button" class="btn ghost" data-crop-action="center">По центру</button><button type="button" class="btn ghost" data-crop-action="reset">Сбросить всё</button><button type="button" class="btn ghost" data-crop-action="help">Как пользоваться</button></div>
    </div>
    <div class="sl-crop-note">Рамка остаётся интерактивной: её можно перемещать и тянуть за края или углы. Поля X/Y/Ширина/Высота синхронизируются с рамкой.</div>
  </div>`}

  function installPanel(){
    if(panel?.isConnected)return panel;
    const legacy=$('panel-crop');panel=document.createElement('section');panel.className='panel';panel.id='panel-crop-ui';panel.innerHTML=panelMarkup();
    if(legacy){legacy.insertAdjacentElement('afterend',panel);legacy.remove()}else $('sl-inspector-panels')?.appendChild(panel);
    bindPanel();return panel
  }

  function sourceElement(){return $('previewImg')}
  function loadSource(){
    const preview=sourceElement(),src=preview?.src||'';
    if(!src){sourceToken++;sourceImage=null;sourceSrc='';return Promise.resolve(null)}
    if(sourceImage&&sourceSrc===src)return Promise.resolve(sourceImage);
    const token=++sourceToken;
    return new Promise((resolve,reject)=>{const image=new Image();image.onload=()=>{if(token!==sourceToken||sourceElement()?.src!==src){resolve(null);return}sourceImage=image;sourceSrc=src;resetState(false);resolve(image)};image.onerror=()=>{if(token===sourceToken)reject(new Error('Не удалось открыть изображение'));else resolve(null)};image.src=src})
  }

  function ensureOverlay(){
    const wrap=$('previewWrap');if(!wrap)return null;if(overlay?.isConnected)return overlay;
    overlay=document.createElement('div');overlay.className='sl-crop-overlay';overlay.innerHTML=`<canvas class="sl-crop-source" id="sl-crop-source" aria-hidden="true"></canvas><div class="sl-crop-horizon" id="sl-crop-horizon" aria-hidden="true"></div><div class="sl-crop-shade crop-shade-top"></div><div class="sl-crop-shade crop-shade-right"></div><div class="sl-crop-shade crop-shade-bottom"></div><div class="sl-crop-shade crop-shade-left"></div><div class="sl-crop-frame" id="sl-crop-frame"><button type="button" class="sl-crop-handle top" data-crop-handle="top" aria-label="Обрезать сверху"></button><button type="button" class="sl-crop-handle right" data-crop-handle="right" aria-label="Обрезать справа"></button><button type="button" class="sl-crop-handle bottom" data-crop-handle="bottom" aria-label="Обрезать снизу"></button><button type="button" class="sl-crop-handle left" data-crop-handle="left" aria-label="Обрезать слева"></button><button type="button" class="sl-crop-handle tl" data-crop-handle="tl" aria-label="Обрезать с верхнего левого угла"></button><button type="button" class="sl-crop-handle tr" data-crop-handle="tr" aria-label="Обрезать с верхнего правого угла"></button><button type="button" class="sl-crop-handle bl" data-crop-handle="bl" aria-label="Обрезать с нижнего левого угла"></button><button type="button" class="sl-crop-handle br" data-crop-handle="br" aria-label="Обрезать с нижнего правого угла"></button><span class="sl-crop-dims" id="sl-crop-dims">—</span></div><div class="sl-crop-tip hidden" id="sl-crop-tip"><b>Обрезка прямо на изображении</b><span>Тяните рамку, выберите сетку или выровняйте горизонт. Все параметры можно задать точно в пикселях.</span><button type="button" class="btn ghost" data-crop-tip-close>Понятно</button></div><div class="sl-crop-tip-arrow hidden" id="sl-crop-tip-arrow"></div>`;
    wrap.appendChild(overlay);frame=$('sl-crop-frame');previewCanvas=$('sl-crop-source');horizon=$('sl-crop-horizon');tip=$('sl-crop-tip');tipArrow=$('sl-crop-tip-arrow');bindOverlay();return overlay
  }

  function targetRect(){const image=sourceElement(),wrap=$('previewWrap');if(!image||!wrap)return null;const ir=image.getBoundingClientRect(),wr=wrap.getBoundingClientRect();if(!ir.width||!ir.height)return null;return{left:ir.left-wr.left,top:ir.top-wr.top,width:ir.width,height:ir.height,page:ir,wrap:wr}}
  function frameRect(rect){return{left:rect.left+state.x*rect.width,top:rect.top+state.y*rect.height,width:state.w*rect.width,height:state.h*rect.height}}
  function scheduleOverlay(){cancelAnimationFrame(renderRaf);renderRaf=requestAnimationFrame(renderOverlay)}

  function renderSource(rect){
    if(!previewCanvas||!sourceImage)return;
    const maxBacking=1800,dpr=Math.max(.5,Math.min(window.devicePixelRatio||1,maxBacking/Math.max(rect.width,rect.height))),cw=Math.max(1,Math.round(rect.width*dpr)),ch=Math.max(1,Math.round(rect.height*dpr));
    if(previewCanvas.width!==cw)previewCanvas.width=cw;if(previewCanvas.height!==ch)previewCanvas.height=ch;
    Object.assign(previewCanvas.style,{left:rect.left+'px',top:rect.top+'px',width:rect.width+'px',height:rect.height+'px'});
    const ctx=previewCanvas.getContext('2d');ctx.clearRect(0,0,cw,ch);ctx.save();ctx.translate(cw/2,ch/2);ctx.rotate(state.angle*Math.PI/180);const scale=coverScale(state.angle,cw,ch);ctx.scale(scale,scale);ctx.imageSmoothingEnabled=true;ctx.imageSmoothingQuality='high';ctx.drawImage(sourceImage,-cw/2,-ch/2,cw,ch);ctx.restore();
  }

  function renderOverlay(){
    if(!active()||!sourceImage)return;ensureOverlay();const rect=targetRect();if(!rect)return;renderSource(rect);const fr=frameRect(rect);
    frame.style.left=fr.left+'px';frame.style.top=fr.top+'px';frame.style.width=fr.width+'px';frame.style.height=fr.height+'px';frame.dataset.grid=state.grid;
    if(horizon){Object.assign(horizon.style,{left:rect.left+'px',top:(rect.top+rect.height/2)+'px',width:rect.width+'px'});horizon.classList.toggle('active',Math.abs(state.angle)>.01)}
    const shades=overlay.querySelectorAll('.sl-crop-shade'),top=shades[0],right=shades[1],bottom=shades[2],left=shades[3];Object.assign(top.style,{left:rect.left+'px',top:rect.top+'px',width:rect.width+'px',height:Math.max(0,fr.top-rect.top)+'px'});Object.assign(bottom.style,{left:rect.left+'px',top:(fr.top+fr.height)+'px',width:rect.width+'px',height:Math.max(0,rect.top+rect.height-(fr.top+fr.height))+'px'});Object.assign(left.style,{left:rect.left+'px',top:fr.top+'px',width:Math.max(0,fr.left-rect.left)+'px',height:fr.height+'px'});Object.assign(right.style,{left:(fr.left+fr.width)+'px',top:fr.top+'px',width:Math.max(0,rect.left+rect.width-(fr.left+fr.width))+'px',height:fr.height+'px'});updateReadout();positionTip(rect,fr)
  }

  function pixelState(){if(!sourceImage)return{x:0,y:0,w:0,h:0};const sw=sourceImage.naturalWidth,sh=sourceImage.naturalHeight,x=clamp(Math.round(state.x*sw),0,sw-1),y=clamp(Math.round(state.y*sh),0,sh-1),w=clamp(Math.round(state.w*sw),1,sw-x),h=clamp(Math.round(state.h*sh),1,sh-y);return{x,y,w,h}}
  function syncExactFields(){const p=pixelState();[['crop-x',p.x],['crop-y',p.y],['crop-w',p.w],['crop-h',p.h]].forEach(([id,value])=>{const el=$(id);if(el&&document.activeElement!==el)el.value=String(value)})}
  function updateReadout(){if(!sourceImage)return;const p=pixelState(),percent=Math.max(1,Math.round(state.w*state.h*100)),text=`${p.w} × ${p.h} px`;if($('sl-crop-dims'))$('sl-crop-dims').textContent=text;if($('crop-size-readout'))$('crop-size-readout').textContent=text;if($('crop-percent-readout'))$('crop-percent-readout').textContent=percent+'%';if($('ro-dims')&&active())$('ro-dims').textContent=text;if($('ro-format')&&active())$('ro-format').textContent=Math.abs(state.angle)>.01?`CROP · ${state.angle>0?'+':''}${state.angle.toFixed(1)}°`:'CROP';syncExactFields()}

  function hintSeen(){try{return localStorage.getItem(HINT_KEY)==='1'}catch(_){return false}}
  function markHintSeen(){try{localStorage.setItem(HINT_KEY,'1')}catch(_){}}
  function showTip(force){if(!active()||!sourceImage||(!force&&hintSeen()))return;ensureOverlay();tip.classList.remove('hidden');tipArrow.classList.remove('hidden');scheduleOverlay()}
  function hideTip(remember){tip?.classList.add('hidden');tipArrow?.classList.add('hidden');if(remember)markHintSeen()}
  function positionTip(rect,fr){if(!tip||tip.classList.contains('hidden'))return;const wrap=$('previewWrap');if(!wrap)return;const maxW=wrap.clientWidth||rect.width;let left=fr.left+Math.min(fr.width*.12,70),top=fr.top+Math.min(fr.height*.12,55);left=clamp(left,8,Math.max(8,maxW-tip.offsetWidth-8));top=Math.max(8,top);tip.style.left=left+'px';tip.style.top=top+'px';const fromX=left+tip.offsetWidth,fromY=top+Math.min(tip.offsetHeight*.58,56),toX=fr.left+fr.width,toY=fr.top+fr.height*.5,dx=toX-fromX,dy=toY-fromY,length=Math.hypot(dx,dy);tipArrow.style.left=fromX+'px';tipArrow.style.top=fromY+'px';tipArrow.style.width=Math.max(12,length)+'px';tipArrow.style.transform=`rotate(${Math.atan2(dy,dx)}rad)`}

  function minFractions(rect){return{w:Math.max(8/(sourceImage?.naturalWidth||1),28/rect.width),h:Math.max(8/(sourceImage?.naturalHeight||1),28/rect.height)}}
  function clampFree(next,min){next.w=clamp(next.w,min.w,1);next.h=clamp(next.h,min.h,1);next.x=clamp(next.x,0,1-next.w);next.y=clamp(next.y,0,1-next.h);return next}
  function resizeFree(handle,start,dx,dy,min){let x=start.x,y=start.y,w=start.w,h=start.h;const isLeft=handle==='left'||handle==='tl'||handle==='bl',isRight=handle==='right'||handle==='tr'||handle==='br',isTop=handle==='top'||handle==='tl'||handle==='tr',isBottom=handle==='bottom'||handle==='bl'||handle==='br';if(isLeft){const nx=clamp(start.x+dx,0,start.x+start.w-min.w);w=start.w+(start.x-nx);x=nx}if(isRight)w=clamp(start.w+dx,min.w,1-start.x);if(isTop){const ny=clamp(start.y+dy,0,start.y+start.h-min.h);h=start.h+(start.y-ny);y=ny}if(isBottom)h=clamp(start.h+dy,min.h,1-start.y);return clampFree({x,y,w,h},min)}
  function fitFixedToBounds(next,nr,min){let w=Math.max(next.w,min.w),h=w/nr;if(h<min.h){h=min.h;w=h*nr}next.x=clamp(next.x,0,Math.max(0,1-w));next.y=clamp(next.y,0,Math.max(0,1-h));if(next.x+w>1){w=1-next.x;h=w/nr}if(next.y+h>1){h=1-next.y;w=h*nr}next.w=Math.max(min.w,w);next.h=Math.max(min.h,h);next.x=clamp(next.x,0,Math.max(0,1-next.w));next.y=clamp(next.y,0,Math.max(0,1-next.h));return next}
  function resizeFixed(handle,start,dx,dy,min){const nr=normalizedRatio();if(!nr)return resizeFree(handle,start,dx,dy,min);const left=start.x,right=start.x+start.w,top=start.y,bottom=start.y+start.h,cx=start.x+start.w/2,cy=start.y+start.h/2;let next={...start};if(['tl','tr','bl','br'].includes(handle)){const anchorX=handle.includes('l')?right:left,anchorY=handle.includes('t')?bottom:top,pointerX=clamp((handle.includes('l')?left:right)+dx,0,1),pointerY=clamp((handle.includes('t')?top:bottom)+dy,0,1);let w=Math.abs(anchorX-pointerX),h=Math.abs(anchorY-pointerY);if(w/Math.max(h,.0001)>nr)w=h*nr;else h=w/nr;w=Math.max(w,min.w);h=Math.max(h,min.h);if(w/h>nr)w=h*nr;else h=w/nr;next.w=w;next.h=h;next.x=handle.includes('l')?anchorX-w:anchorX;next.y=handle.includes('t')?anchorY-h:anchorY}else if(handle==='left'||handle==='right'){let w=handle==='left'?right-clamp(left+dx,0,right-min.w):clamp(start.w+dx,min.w,1-left),h=w/nr;next.w=w;next.h=h;next.x=handle==='left'?right-w:left;next.y=cy-h/2}else{let h=handle==='top'?bottom-clamp(top+dy,0,bottom-min.h):clamp(start.h+dy,min.h,1-top),w=h*nr;next.h=h;next.w=w;next.y=handle==='top'?bottom-h:top;next.x=cx-w/2}return fitFixedToBounds(next,nr,min)}

  function onPointerDown(event){if(!active()||!sourceImage)return;const handle=event.target.closest('[data-crop-handle]'),isFrame=event.target.closest('.sl-crop-frame');if(!handle&&!isFrame)return;event.preventDefault();event.stopPropagation();hideTip(true);const rect=targetRect();if(!rect)return;drag={type:handle?'resize':'move',handle:handle?.dataset.cropHandle||'',startX:event.clientX,startY:event.clientY,start:{...state},rect};document.body.classList.add('sl-crop-dragging');event.target.setPointerCapture?.(event.pointerId)}
  function onPointerMove(event){if(!drag)return;const dx=(event.clientX-drag.startX)/drag.rect.width,dy=(event.clientY-drag.startY)/drag.rect.height,min=minFractions(drag.rect);if(drag.type==='move'){state.x=clamp(drag.start.x+dx,0,1-drag.start.w);state.y=clamp(drag.start.y+dy,0,1-drag.start.h)}else Object.assign(state,state.ratio==='free'?resizeFree(drag.handle,drag.start,dx,dy,min):resizeFixed(drag.handle,drag.start,dx,dy,min));scheduleOverlay()}
  function onPointerUp(){if(!drag)return;drag=null;document.body.classList.remove('sl-crop-dragging');scheduleOverlay()}
  function bindOverlay(){overlay.addEventListener('pointerdown',onPointerDown,true);window.addEventListener('pointermove',onPointerMove,{passive:true});window.addEventListener('pointerup',onPointerUp,{passive:true});overlay.addEventListener('click',event=>{if(event.target.closest('[data-crop-tip-close]')){event.preventDefault();hideTip(true)}})}

  function applyRatio(value){state.ratio=value;panel?.querySelectorAll('[data-crop-ratio]').forEach(button=>button.classList.toggle('active',button.dataset.cropRatio===value));if(value==='free'||!sourceImage){scheduleOverlay();return}const nr=normalizedRatio(),cx=state.x+state.w/2,cy=state.y+state.h/2;let w=state.w,h=w/nr;if(h>state.h){h=state.h;w=h*nr}if(w>1){w=1;h=w/nr}if(h>1){h=1;w=h*nr}state.w=w;state.h=h;state.x=clamp(cx-w/2,0,1-w);state.y=clamp(cy-h/2,0,1-h);scheduleOverlay()}
  function setGrid(value){state.grid=['none','thirds','golden'].includes(value)?value:'thirds';panel?.querySelectorAll('[data-crop-grid]').forEach(button=>button.classList.toggle('active',button.dataset.cropGrid===state.grid));scheduleOverlay()}
  function setAngle(value){state.angle=cleanAngle(value);if($('crop-angle'))$('crop-angle').value=String(state.angle);if($('crop-angle-number'))$('crop-angle-number').value=String(state.angle);scheduleOverlay()}
  function resetState(keepRatio){state.x=0;state.y=0;state.w=1;state.h=1;if(!keepRatio){state.ratio='free';state.grid='thirds';state.angle=0}panel?.querySelectorAll('[data-crop-ratio]').forEach(button=>button.classList.toggle('active',button.dataset.cropRatio===state.ratio));setGrid(state.grid);setAngle(state.angle);if(state.ratio!=='free')applyRatio(state.ratio);else scheduleOverlay()}
  function centerState(){state.x=(1-state.w)/2;state.y=(1-state.h)/2;scheduleOverlay()}

  function applyExactField(changed){
    if(!sourceImage)return;const sw=sourceImage.naturalWidth,sh=sourceImage.naturalHeight,current=pixelState();let x=Number($('crop-x')?.value),y=Number($('crop-y')?.value),w=Number($('crop-w')?.value),h=Number($('crop-h')?.value);x=Number.isFinite(x)?Math.round(x):current.x;y=Number.isFinite(y)?Math.round(y):current.y;w=Number.isFinite(w)?Math.round(w):current.w;h=Number.isFinite(h)?Math.round(h):current.h;const ratio=ratioValue();if(ratio){if(changed==='crop-h')w=Math.max(1,Math.round(h*ratio));else if(changed==='crop-w')h=Math.max(1,Math.round(w/ratio));if(w>sw){w=sw;h=Math.max(1,Math.round(w/ratio))}if(h>sh){h=sh;w=Math.max(1,Math.round(h*ratio))}}
    w=clamp(w,1,sw);h=clamp(h,1,sh);x=clamp(x,0,sw-w);y=clamp(y,0,sh-h);state.x=x/sw;state.y=y/sh;state.w=w/sw;state.h=h/sh;scheduleOverlay()
  }

  function bindPanel(){
    panel.addEventListener('click',event=>{const ratio=event.target.closest('[data-crop-ratio]');if(ratio){event.preventDefault();applyRatio(ratio.dataset.cropRatio);return}const grid=event.target.closest('[data-crop-grid]');if(grid){event.preventDefault();setGrid(grid.dataset.cropGrid);return}const step=event.target.closest('[data-crop-angle-step]');if(step){event.preventDefault();setAngle(state.angle+Number(step.dataset.cropAngleStep));return}const action=event.target.closest('[data-crop-action]')?.dataset.cropAction;if(!action)return;event.preventDefault();if(action==='full')resetState(true);else if(action==='center')centerState();else if(action==='reset')resetState(false);else if(action==='straighten-reset')setAngle(0);else if(action==='help')showTip(true)});
    panel.addEventListener('input',event=>{if(event.target.id==='crop-angle'||event.target.id==='crop-angle-number'){setAngle(event.target.value);return}if(['crop-x','crop-y','crop-w','crop-h'].includes(event.target.id))applyExactField(event.target.id)});
    panel.addEventListener('change',event=>{if(event.target.id==='crop-angle'||event.target.id==='crop-angle-number')setAngle(event.target.value);if(['crop-x','crop-y','crop-w','crop-h'].includes(event.target.id))applyExactField(event.target.id)})
  }

  function activateCrop(){installPanel();document.body.classList.remove('page-home','sl-palette-active','sl-privacy-active');document.body.classList.add('page-tool');setBody(true);document.querySelectorAll('.panel').forEach(item=>item.classList.remove('active'));panel.classList.add('active');document.querySelectorAll('.sl-sidebar .sl-tool,.top-nav-link').forEach(button=>button.classList.toggle('active',button.dataset.page==='crop'));const title=$('sl-inspector-title'),desc=$('sl-inspector-desc');if(title)title.textContent='Обрезка';if(desc)desc.textContent='Горизонт, композиционные сетки, фиксированные пропорции и точный кадр.';$('previewWrap')?.classList.remove('sl-live-ready');window.dispatchEvent(new CustomEvent('safelight:toolchange',{detail:{page:'crop-ui'}}));loadSource().then(image=>{if(active()&&image){ensureOverlay();scheduleOverlay();setTimeout(()=>showTip(false),360)}}).catch(()=>{})}
  function leaveCrop(){cancelAnimationFrame(renderRaf);renderRaf=0;drag=null;setBody(false);hideTip(false)}

  function buildCanvas(){
    if(!sourceImage)throw new Error('Сначала загрузите изображение');const sw=sourceImage.naturalWidth,sh=sourceImage.naturalHeight,p=pixelState(),canvas=document.createElement('canvas');canvas.width=p.w;canvas.height=p.h;const ctx=canvas.getContext('2d');ctx.imageSmoothingEnabled=true;ctx.imageSmoothingQuality='high';ctx.save();ctx.translate(sw/2-p.x,sh/2-p.y);ctx.rotate(state.angle*Math.PI/180);const scale=coverScale(state.angle,sw,sh);ctx.scale(scale,scale);ctx.drawImage(sourceImage,-sw/2,-sh/2,sw,sh);ctx.restore();return canvas
  }
  async function renderCrop(){await loadSource();return buildCanvas()}
  function canvasBlob(canvas,type,quality){return new Promise((resolve,reject)=>canvas.toBlob(blob=>blob?resolve(blob):reject(new Error('Не удалось подготовить файл')),type,quality))}
  function download(blob,name){const url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=name;document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),4000)}
  async function exportCrop(format){if(exportBusy)return;exportBusy=true;try{const canvas=await renderCrop();if(format==='heic'){const encoder=window.safelightHeicCodec?.encodeCanvas;if(typeof encoder!=='function')throw new Error('Локальный HEIC WASM-кодек не загрузился');download(await encoder(canvas),baseName()+'-crop.heic');return}if(format==='pdf'){if(!window.jspdf?.jsPDF)throw new Error('Локальный PDF-модуль не загрузился');const {jsPDF}=window.jspdf,orientation=canvas.width>canvas.height?'landscape':'portrait',doc=new jsPDF({orientation,unit:'mm',format:'a4'}),pw=doc.internal.pageSize.getWidth(),ph=doc.internal.pageSize.getHeight(),margin=10,scale=Math.min((pw-margin*2)/canvas.width,(ph-margin*2)/canvas.height),w=canvas.width*scale,h=canvas.height*scale;doc.addImage(canvas.toDataURL('image/jpeg',.94),'JPEG',(pw-w)/2,(ph-h)/2,w,h,undefined,'FAST');download(doc.output('blob'),baseName()+'-crop.pdf');return}let target=canvas,type='image/png',ext='png',q;if(format==='webp'){type='image/webp';ext='webp';q=.94}else if(format==='jpeg'){type='image/jpeg';ext='jpg';q=.94;const opaque=document.createElement('canvas');opaque.width=canvas.width;opaque.height=canvas.height;const ctx=opaque.getContext('2d');ctx.fillStyle='#fff';ctx.fillRect(0,0,opaque.width,opaque.height);ctx.drawImage(canvas,0,0);target=opaque}download(await canvasBlob(target,type,q),baseName()+'-crop.'+ext)}finally{exportBusy=false}}
  function showExportHint(text){const el=$('sl-export-hint');if(!el)return;el.textContent=text;el.classList.add('show');clearTimeout(showExportHint.t);showExportHint.t=setTimeout(()=>el.classList.remove('show'),3000)}
  function patchExportMenu(){const menu=document.querySelector('.sl-export-menu');if(!menu)return;menu.innerHTML='<div class="sl-export-menu-title">Экспорт обрезки</div><button class="sl-export-option" type="button" data-crop-export="png"><span>PNG</span><span>без потерь</span></button><button class="sl-export-option" type="button" data-crop-export="webp"><span>WebP</span><span>оптимально</span></button><button class="sl-export-option" type="button" data-crop-export="jpeg"><span>JPEG</span><span>совместимо</span></button><button class="sl-export-option" type="button" data-crop-export="heic"><span>HEIC</span><span>HEVC</span></button><button class="sl-export-option" type="button" data-crop-export="pdf"><span>PDF</span><span>документ</span></button><div class="sl-export-sep"></div><div class="sl-export-menu-note">Экспорт учитывает рамку и выравнивание горизонта.</div>'}
  function bindExport(){document.addEventListener('click',event=>{if(!active())return;if(event.target.closest('#sl-export')){event.preventDefault();event.stopImmediatePropagation();const wrap=document.querySelector('.sl-export-wrap');if(!wrap)return;patchExportMenu();wrap.classList.toggle('open');return}const option=event.target.closest('[data-crop-export]');if(option){event.preventDefault();event.stopImmediatePropagation();document.querySelector('.sl-export-wrap')?.classList.remove('open');exportCrop(option.dataset.cropExport).then(()=>showExportHint('Обрезка экспортирована.')).catch(error=>{console.error(error);showExportHint(error.message||'Не удалось экспортировать обрезку')})}},true)}

  function interceptNavigation(){document.addEventListener('click',event=>{const button=event.target.closest('[data-page="crop"]');if(!button)return;event.preventDefault();event.stopImmediatePropagation();activateCrop()},true)}
  function install(){if(!document.querySelector('.sl-app')||!$('sl-inspector-panels')){setTimeout(install,60);return}installPanel();ensureOverlay();interceptNavigation();bindExport();const preview=sourceElement();if(preview)new MutationObserver(()=>{sourceToken++;sourceImage=null;sourceSrc='';loadSource().then(image=>{if(active()&&image){scheduleOverlay();setTimeout(()=>showTip(false),300)}}).catch(()=>{})}).observe(preview,{attributes:true,attributeFilter:['src']});window.addEventListener('resize',scheduleOverlay,{passive:true});window.addEventListener('scroll',scheduleOverlay,{passive:true});window.addEventListener('safelight:zoomchange',scheduleOverlay);window.addEventListener('safelight:toolchange',event=>{if(event.detail?.page==='crop-ui')return;leaveCrop()})}

  window.safelightCropTools=Object.freeze({activate:activateCrop,export:exportCrop,render:renderCrop,state:()=>({...state}),showHelp:()=>showTip(true)});install();
})();
