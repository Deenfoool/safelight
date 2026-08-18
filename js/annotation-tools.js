(function(){
  'use strict';
  if(window.safelightAnnotationToolsLoaded)return;
  window.safelightAnnotationToolsLoaded=true;

  const $=id=>document.getElementById(id);
  const clamp=(v,min,max)=>Math.max(min,Math.min(max,v));
  const TOOLS=new Set(['select','arrow','line','rect','ellipse','marker','text','number']);
  const state={
    tool:'select',objects:[],selectedId:null,nextId:1,nextNumber:1,
    color:'#4ade80',thickness:5,opacity:1,fontSize:48,fill:false,text:'Текст',
    source:null,sourceSrc:'',history:['[]'],future:[],interaction:null,renderTimer:0
  };

  function active(){return !!$('panel-annotation')?.classList.contains('active')}
  function clone(v){return JSON.parse(JSON.stringify(v))}
  function esc(v){return String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))}
  function selected(){return state.objects.find(o=>o.id===state.selectedId)||null}
  function baseName(){return(($('meta-name')?.textContent||'safelight').trim().replace(/\.[^.]+$/,'')||'safelight')}
  function hint(text){const h=$('sl-export-hint');if(!h)return;h.textContent=text;h.classList.add('show');clearTimeout(h._t);h._t=setTimeout(()=>h.classList.remove('show'),2600)}
  function download(blob,name){const u=URL.createObjectURL(blob),a=document.createElement('a');a.href=u;a.download=name;document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(u),4000)}
  function blob(canvas,type,q){return new Promise((res,rej)=>canvas.toBlob(b=>b?res(b):rej(new Error('Не удалось подготовить файл')),type,q))}

  function panelMarkup(){return `<div class="panel-card sl-ann-panel">
    <h2>АННОТАЦИИ</h2><p class="desc">Рисуйте стрелки, фигуры, текст и маркеры прямо поверх изображения.</p>
    <div class="sl-ann-section"><div class="sl-ann-section-head"><span>Инструменты</span><small>рисуйте прямо на изображении</small></div>
      <div class="sl-ann-tools" role="toolbar" aria-label="Инструменты аннотаций">
        <button type="button" data-ann-tool="select" class="active" title="Выделение">↖ <span>Выбор</span></button>
        <button type="button" data-ann-tool="arrow" title="Стрелка">➜ <span>Стрелка</span></button>
        <button type="button" data-ann-tool="line" title="Линия">╱ <span>Линия</span></button>
        <button type="button" data-ann-tool="rect" title="Прямоугольник">□ <span>Рамка</span></button>
        <button type="button" data-ann-tool="ellipse" title="Круг / эллипс">○ <span>Круг</span></button>
        <button type="button" data-ann-tool="marker" title="Маркер">▰ <span>Маркер</span></button>
        <button type="button" data-ann-tool="text" title="Текст">T <span>Текст</span></button>
        <button type="button" data-ann-tool="number" title="Нумерация">① <span>Номер</span></button>
      </div>
    </div>

    <div class="sl-ann-section"><div class="sl-ann-section-head"><span>Оформление</span><small>для нового или выбранного объекта</small></div>
      <div class="sl-ann-color-row"><label><span>Цвет</span><input id="ann-color" type="color" value="#4ade80"></label><label class="sl-ann-fill"><input id="ann-fill" type="checkbox"><span>Заливка фигур</span></label></div>
      <div class="slider-row"><div class="top"><span>Толщина</span><b id="ann-thickness-val">5 px</b></div><input id="ann-thickness" type="range" min="1" max="30" value="5"></div>
      <div class="slider-row"><div class="top"><span>Прозрачность</span><b id="ann-opacity-val">100%</b></div><input id="ann-opacity" type="range" min="10" max="100" value="100"></div>
      <div class="slider-row"><div class="top"><span>Размер текста</span><b id="ann-font-val">48 px</b></div><input id="ann-font" type="range" min="12" max="200" value="48"></div>
      <div class="field sl-ann-text-field"><label>Текст</label><textarea id="ann-text" rows="3" maxlength="500" placeholder="Введите текст">Текст</textarea></div>
    </div>

    <div class="sl-ann-section"><div class="sl-ann-section-head"><span>Выбранный объект</span><small id="ann-selected-label">ничего не выбрано</small></div>
      <div class="sl-ann-object-actions">
        <button type="button" id="ann-duplicate" disabled>Дублировать</button><button type="button" id="ann-delete" class="danger" disabled>Удалить</button>
        <button type="button" id="ann-layer-up" disabled>Выше</button><button type="button" id="ann-layer-down" disabled>Ниже</button>
      </div>
      <div class="sl-ann-history-actions"><button type="button" id="ann-undo" disabled>↶ Отменить</button><button type="button" id="ann-redo" disabled>↷ Повторить</button><button type="button" id="ann-clear" class="danger" disabled>Очистить всё</button></div>
    </div>
    <div class="sl-ann-help"><b>Как работать</b><span>Выберите инструмент и рисуйте на изображении. В режиме «Выбор» объект можно двигать и менять размер за зелёные ручки. Delete удаляет выбранный объект.</span></div>
  </div>`}

  function createPanel(){
    let p=$('panel-annotation');if(p)return p;
    p=document.createElement('section');p.className='panel';p.id='panel-annotation';p.innerHTML=panelMarkup();
    ($('sl-inspector-panels')||document.querySelector('main.workmain'))?.appendChild(p);bindPanel(p);return p;
  }

  function createSidebarButton(){
    if(document.querySelector('.sl-sidebar [data-page="annotation"]'))return;
    const groups=[...document.querySelectorAll('.sl-sidebar .sl-nav-group')];
    const group=groups.find(g=>g.querySelector('.sl-nav-label')?.textContent.trim()==='Редактирование')||groups[0];if(!group)return;
    const b=document.createElement('button');b.type='button';b.className='top-nav-link sl-tool';b.dataset.page='annotation';
    b.innerHTML='<span class="nav-icon" aria-hidden="true"><svg viewBox="0 0 24 24"><path d="M4 19h16M6 16l8-8 3 3-8 8H6zM14 8l2-2 3 3-2 2"/></svg></span><span>Аннотации</span>';
    b.addEventListener('click',e=>{e.preventDefault();activateAnnotation()});group.appendChild(b);
  }

  function activateAnnotation(){
    document.body.classList.remove('page-home','sl-palette-active','sl-privacy-active');document.body.classList.add('page-tool');
    document.querySelectorAll('.panel').forEach(p=>p.classList.remove('active'));createPanel().classList.add('active');
    document.querySelectorAll('.sl-sidebar .sl-tool').forEach(b=>b.classList.toggle('active',b.dataset.page==='annotation'));
    const title=$('sl-inspector-title'),desc=$('sl-inspector-desc');if(title)title.textContent='Аннотации';if(desc)desc.textContent='Текст, стрелки, линии, фигуры, маркеры и нумерация прямо поверх изображения.';
    $('previewWrap')?.classList.remove('sl-live-ready');
    window.dispatchEvent(new CustomEvent('safelight:toolchange',{detail:{page:'annotation'}}));
    syncSource().then(()=>{ensureSurface();renderSurface();syncSurface()}).catch(()=>{});
  }

  function syncSource(){
    const preview=$('previewImg'),src=preview?.src||'';
    if(!src){state.source=null;state.sourceSrc='';return Promise.resolve(null)}
    if(state.source&&state.sourceSrc===src)return Promise.resolve(state.source);
    return new Promise((resolve,reject)=>{const im=new Image();im.onload=()=>{const changed=!!state.sourceSrc&&state.sourceSrc!==src;state.source=im;state.sourceSrc=src;if(changed)resetAll(false);resolve(im)};im.onerror=()=>reject(new Error('Не удалось открыть изображение'));im.src=src})
  }

  function ensureSurface(){
    const wrap=$('previewWrap');if(!wrap)return null;
    let surface=$('sl-ann-surface');if(surface)return surface;
    surface=document.createElementNS('http://www.w3.org/2000/svg','svg');surface.id='sl-ann-surface';surface.classList.add('sl-ann-surface');surface.setAttribute('aria-label','Аннотации на изображении');surface.setAttribute('role','application');wrap.appendChild(surface);bindSurface(surface);return surface;
  }

  function syncSurface(){
    const wrap=$('previewWrap'),preview=$('previewImg'),surface=ensureSurface();if(!wrap||!preview||!surface||!active()||!preview.src){surface?.classList.remove('show');return}
    const wr=wrap.getBoundingClientRect(),ir=preview.getBoundingClientRect();if(!ir.width||!ir.height){surface.classList.remove('show');return}
    surface.style.left=(ir.left-wr.left)+'px';surface.style.top=(ir.top-wr.top)+'px';surface.style.width=ir.width+'px';surface.style.height=ir.height+'px';surface.setAttribute('viewBox',`0 0 ${Math.max(1,preview.naturalWidth)} ${Math.max(1,preview.naturalHeight)}`);surface.classList.add('show');
  }

  const measureCanvas=document.createElement('canvas'),measureCtx=measureCanvas.getContext('2d');
  function bounds(o){
    if(!o)return{x:0,y:0,w:1,h:1};
    if(o.type==='rect'||o.type==='ellipse'||o.type==='line'||o.type==='arrow')return{x:Math.min(o.x1,o.x2),y:Math.min(o.y1,o.y2),w:Math.max(1,Math.abs(o.x2-o.x1)),h:Math.max(1,Math.abs(o.y2-o.y1))};
    if(o.type==='marker'){const xs=o.points.map(p=>p.x),ys=o.points.map(p=>p.y);return{x:Math.min(...xs),y:Math.min(...ys),w:Math.max(1,Math.max(...xs)-Math.min(...xs)),h:Math.max(1,Math.max(...ys)-Math.min(...ys))}}
    if(o.type==='number'){return{x:o.x-o.radius,y:o.y-o.radius,w:o.radius*2,h:o.radius*2}}
    if(o.type==='text'){
      measureCtx.font=`600 ${o.fontSize}px Arial, sans-serif`;const lines=String(o.text||'Текст').split('\n');const w=Math.max(...lines.map(l=>measureCtx.measureText(l||' ').width),o.fontSize*.7),h=Math.max(o.fontSize*1.2,lines.length*o.fontSize*1.25);return{x:o.x,y:o.y,w,h};
    }
    return{x:0,y:0,w:1,h:1};
  }

  function objectSvg(o){
    const common=`data-ann-id="${o.id}" class="sl-ann-object${o.id===state.selectedId?' selected':''}" opacity="${o.opacity}"`;
    const stroke=esc(o.color),sw=Math.max(1,o.thickness);
    if(o.type==='rect')return `<g ${common}><rect x="${Math.min(o.x1,o.x2)}" y="${Math.min(o.y1,o.y2)}" width="${Math.abs(o.x2-o.x1)}" height="${Math.abs(o.y2-o.y1)}" fill="${o.fill?stroke:'transparent'}" fill-opacity="${o.fill?.18:0}" stroke="${stroke}" stroke-width="${sw}"/></g>`;
    if(o.type==='ellipse'){const x=Math.min(o.x1,o.x2),y=Math.min(o.y1,o.y2),w=Math.abs(o.x2-o.x1),h=Math.abs(o.y2-o.y1);return `<g ${common}><ellipse cx="${x+w/2}" cy="${y+h/2}" rx="${w/2}" ry="${h/2}" fill="${o.fill?stroke:'transparent'}" fill-opacity="${o.fill?.18:0}" stroke="${stroke}" stroke-width="${sw}"/></g>`}
    if(o.type==='line'||o.type==='arrow'){
      let extra='';if(o.type==='arrow'){const a=Math.atan2(o.y2-o.y1,o.x2-o.x1),len=Math.max(12,sw*4.2);const ax=o.x2-Math.cos(a-Math.PI/6)*len,ay=o.y2-Math.sin(a-Math.PI/6)*len,bx=o.x2-Math.cos(a+Math.PI/6)*len,by=o.y2-Math.sin(a+Math.PI/6)*len;extra=`<path d="M${ax} ${ay} L${o.x2} ${o.y2} L${bx} ${by}" fill="none" stroke="${stroke}" stroke-width="${sw}" stroke-linecap="round" stroke-linejoin="round"/>`}
      return `<g ${common}><line x1="${o.x1}" y1="${o.y1}" x2="${o.x2}" y2="${o.y2}" stroke="${stroke}" stroke-width="${sw}" stroke-linecap="round"/>${extra}</g>`;
    }
    if(o.type==='marker'){const d=o.points.map((p,i)=>(i?'L':'M')+p.x+' '+p.y).join(' ');return `<g ${common}><path d="${d}" fill="none" stroke="${stroke}" stroke-width="${Math.max(6,sw*4)}" stroke-linecap="round" stroke-linejoin="round" opacity="${Math.min(.48,o.opacity)}"/></g>`}
    if(o.type==='number'){return `<g ${common}><circle cx="${o.x}" cy="${o.y}" r="${o.radius}" fill="${stroke}"/><text x="${o.x}" y="${o.y}" text-anchor="middle" dominant-baseline="central" fill="#08110c" font-size="${o.radius*1.05}" font-weight="800" font-family="Arial,sans-serif">${o.number}</text></g>`}
    if(o.type==='text'){const lines=String(o.text||'Текст').split('\n');const tspans=lines.map((l,i)=>`<tspan x="${o.x}" y="${o.y+o.fontSize+i*o.fontSize*1.25}">${esc(l||' ')}</tspan>`).join('');return `<g ${common}><text fill="${stroke}" font-size="${o.fontSize}" font-weight="600" font-family="Arial,sans-serif">${tspans}</text></g>`}
    return '';
  }

  function handleRadius(){const s=$('sl-ann-surface'),r=s?.getBoundingClientRect(),w=state.source?.naturalWidth||1;if(!r?.width)return 8;return clamp(7/(r.width/w),6,Math.max(8,w/20))}
  function selectionSvg(o){
    if(!o)return'';const hr=handleRadius();
    if(o.type==='line'||o.type==='arrow')return `<g class="sl-ann-selection"><circle data-ann-handle="start" cx="${o.x1}" cy="${o.y1}" r="${hr}"/><circle data-ann-handle="end" cx="${o.x2}" cy="${o.y2}" r="${hr}"/></g>`;
    const b=bounds(o),x=b.x,y=b.y,w=b.w,h=b.h,pts={nw:[x,y],n:[x+w/2,y],ne:[x+w,y],e:[x+w,y+h/2],se:[x+w,y+h],s:[x+w/2,y+h],sw:[x,y+h],w:[x,y+h/2]};
    return `<g class="sl-ann-selection"><rect x="${x}" y="${y}" width="${w}" height="${h}"/>${Object.entries(pts).map(([k,p])=>`<circle data-ann-handle="${k}" cx="${p[0]}" cy="${p[1]}" r="${hr}"/>`).join('')}</g>`;
  }

  function renderSurface(){
    const surface=ensureSurface();if(!surface)return;surface.innerHTML=state.objects.map(objectSvg).join('')+selectionSvg(selected());updateUi();
  }

  function point(e,surface){const r=surface.getBoundingClientRect(),w=state.source?.naturalWidth||$('previewImg')?.naturalWidth||1,h=state.source?.naturalHeight||$('previewImg')?.naturalHeight||1;return{x:clamp((e.clientX-r.left)/Math.max(1,r.width)*w,0,w),y:clamp((e.clientY-r.top)/Math.max(1,r.height)*h,0,h)}}
  function styleObject(type){return{id:state.nextId++,type,color:state.color,thickness:state.thickness,opacity:state.opacity,fontSize:state.fontSize,fill:state.fill}}

  function commit(){const snap=JSON.stringify(state.objects);if(state.history[state.history.length-1]===snap){updateUi();return}state.history.push(snap);if(state.history.length>60)state.history.shift();state.future=[];updateUi()}
  function undo(){if(state.history.length<=1)return;state.future.push(state.history.pop());state.objects=JSON.parse(state.history[state.history.length-1]);state.selectedId=null;renderSurface()}
  function redo(){if(!state.future.length)return;const snap=state.future.pop();state.history.push(snap);state.objects=JSON.parse(snap);state.selectedId=null;renderSurface()}
  function resetAll(push=true){state.objects=[];state.selectedId=null;state.nextId=1;state.nextNumber=1;state.interaction=null;if(push){commit()}else{state.history=['[]'];state.future=[]}renderSurface()}

  function newBoundsFromHandle(b,h,p,start){let x1=b.x,y1=b.y,x2=b.x+b.w,y2=b.y+b.h,dx=p.x-start.x,dy=p.y-start.y;if(h.includes('w'))x1+=dx;if(h.includes('e'))x2+=dx;if(h.includes('n'))y1+=dy;if(h.includes('s'))y2+=dy;if(h==='n'||h==='s'){x1=b.x;x2=b.x+b.w}if(h==='e'||h==='w'){y1=b.y;y2=b.y+b.h}if(x2-x1<8){if(h.includes('w'))x1=x2-8;else x2=x1+8}if(y2-y1<8){if(h.includes('n'))y1=y2-8;else y2=y1+8}return{x:x1,y:y1,w:x2-x1,h:y2-y1}}
  function mapPoint(p,oldB,newB){return{x:newB.x+(p.x-oldB.x)/Math.max(1,oldB.w)*newB.w,y:newB.y+(p.y-oldB.y)/Math.max(1,oldB.h)*newB.h}}
  function transformToBounds(original,oldB,newB){
    const o=clone(original),sx=newB.w/Math.max(1,oldB.w),sy=newB.h/Math.max(1,oldB.h),scale=Math.max(.1,Math.min(sx,sy));
    if(['rect','ellipse','line','arrow'].includes(o.type)){const a=mapPoint({x:o.x1,y:o.y1},oldB,newB),b=mapPoint({x:o.x2,y:o.y2},oldB,newB);o.x1=a.x;o.y1=a.y;o.x2=b.x;o.y2=b.y}
    else if(o.type==='marker')o.points=o.points.map(p=>mapPoint(p,oldB,newB));
    else if(o.type==='number'){const c=mapPoint({x:o.x,y:o.y},oldB,newB);o.x=c.x;o.y=c.y;o.radius=Math.max(10,o.radius*scale)}
    else if(o.type==='text'){const p=mapPoint({x:o.x,y:o.y},oldB,newB);o.x=p.x;o.y=p.y;o.fontSize=clamp(o.fontSize*scale,8,500)}
    return o;
  }
  function moveObject(original,dx,dy){
    const o=clone(original),b=bounds(o),W=state.source?.naturalWidth||1,H=state.source?.naturalHeight||1;dx=clamp(dx,-b.x,W-(b.x+b.w));dy=clamp(dy,-b.y,H-(b.y+b.h));
    if(['rect','ellipse','line','arrow'].includes(o.type)){o.x1+=dx;o.y1+=dy;o.x2+=dx;o.y2+=dy}else if(o.type==='marker')o.points=o.points.map(p=>({x:p.x+dx,y:p.y+dy}));else{o.x+=dx;o.y+=dy}return o;
  }

  function bindSurface(surface){
    surface.addEventListener('pointerdown',e=>{
      if(!active()||e.button!==0)return;const p=point(e,surface),handle=e.target.closest('[data-ann-handle]')?.dataset.annHandle,idNode=e.target.closest('[data-ann-id]');
      if(handle&&selected()){const o=selected();state.interaction={kind:'resize',id:o.id,handle,start:p,original:clone(o),bounds:bounds(o)};surface.setPointerCapture?.(e.pointerId);e.preventDefault();return}
      if(state.tool==='select'){
        if(idNode){const id=Number(idNode.dataset.annId),o=state.objects.find(x=>x.id===id);state.selectedId=id;state.interaction={kind:'move',id,start:p,original:clone(o)};surface.setPointerCapture?.(e.pointerId);renderSurface();e.preventDefault()}else{state.selectedId=null;renderSurface()}return;
      }
      let o=styleObject(state.tool);
      if(state.tool==='text'){o.x=p.x;o.y=p.y;o.text=state.text||'Текст';state.objects.push(o);state.selectedId=o.id;state.tool='select';commit();renderSurface();return}
      if(state.tool==='number'){o.x=p.x;o.y=p.y;o.radius=Math.max(18,state.fontSize*.48);o.number=state.nextNumber++;state.objects.push(o);state.selectedId=o.id;state.tool='select';commit();renderSurface();return}
      if(state.tool==='marker'){o.points=[p,p];o.opacity=Math.min(.48,state.opacity)}else{o.x1=p.x;o.y1=p.y;o.x2=p.x;o.y2=p.y}
      state.objects.push(o);state.selectedId=o.id;state.interaction={kind:'draw',id:o.id,start:p};surface.setPointerCapture?.(e.pointerId);renderSurface();e.preventDefault();
    });

    surface.addEventListener('pointermove',e=>{
      const it=state.interaction;if(!it)return;const p=point(e,surface),idx=state.objects.findIndex(o=>o.id===it.id);if(idx<0)return;
      if(it.kind==='draw'){const o=state.objects[idx];if(o.type==='marker'){const last=o.points[o.points.length-1];if(Math.hypot(p.x-last.x,p.y-last.y)>2)o.points.push(p)}else{o.x2=p.x;o.y2=p.y}}
      else if(it.kind==='move')state.objects[idx]=moveObject(it.original,p.x-it.start.x,p.y-it.start.y);
      else if(it.kind==='resize'){
        if(it.handle==='start'||it.handle==='end'){const o=clone(it.original);if(it.handle==='start'){o.x1=p.x;o.y1=p.y}else{o.x2=p.x;o.y2=p.y}state.objects[idx]=o}
        else state.objects[idx]=transformToBounds(it.original,it.bounds,newBoundsFromHandle(it.bounds,it.handle,p,it.start));
      }
      renderSurface();e.preventDefault();
    });

    const finish=e=>{if(!state.interaction)return;state.interaction=null;try{surface.releasePointerCapture?.(e.pointerId)}catch(_){}commit();renderSurface();e.preventDefault()};
    surface.addEventListener('pointerup',finish);surface.addEventListener('pointercancel',finish);
  }

  function applyStyleToSelected(){const o=selected();if(!o)return;o.color=state.color;o.thickness=state.thickness;o.opacity=o.type==='marker'?Math.min(.48,state.opacity):state.opacity;o.fontSize=state.fontSize;o.fill=state.fill;if(o.type==='text')o.text=state.text||'Текст';renderSurface()}
  function updateUi(){
    document.querySelectorAll('[data-ann-tool]').forEach(b=>b.classList.toggle('active',b.dataset.annTool===state.tool));
    if($('ann-thickness-val'))$('ann-thickness-val').textContent=state.thickness+' px';if($('ann-opacity-val'))$('ann-opacity-val').textContent=Math.round(state.opacity*100)+'%';if($('ann-font-val'))$('ann-font-val').textContent=Math.round(state.fontSize)+' px';
    const o=selected(),label=$('ann-selected-label');if(label)label.textContent=o?({arrow:'стрелка',line:'линия',rect:'прямоугольник',ellipse:'круг',marker:'маркер',text:'текст',number:'номер'}[o.type]||o.type):'ничего не выбрано';
    ['ann-duplicate','ann-delete','ann-layer-up','ann-layer-down'].forEach(id=>{if($(id))$(id).disabled=!o});if($('ann-clear'))$('ann-clear').disabled=!state.objects.length;if($('ann-undo'))$('ann-undo').disabled=state.history.length<=1;if($('ann-redo'))$('ann-redo').disabled=!state.future.length;
  }

  function bindPanel(panel){
    panel.addEventListener('click',e=>{
      const tb=e.target.closest('[data-ann-tool]');if(tb){state.tool=TOOLS.has(tb.dataset.annTool)?tb.dataset.annTool:'select';state.selectedId=null;renderSurface();return}
      if(e.target.closest('#ann-delete')){const id=state.selectedId;if(id!=null){state.objects=state.objects.filter(o=>o.id!==id);state.selectedId=null;commit();renderSurface()}return}
      if(e.target.closest('#ann-duplicate')){const o=selected();if(o){const c=moveObject(o,18,18);c.id=state.nextId++;if(c.type==='number')c.number=state.nextNumber++;state.objects.push(c);state.selectedId=c.id;commit();renderSurface()}return}
      if(e.target.closest('#ann-layer-up')){const i=state.objects.findIndex(o=>o.id===state.selectedId);if(i>=0&&i<state.objects.length-1){[state.objects[i],state.objects[i+1]]=[state.objects[i+1],state.objects[i]];commit();renderSurface()}return}
      if(e.target.closest('#ann-layer-down')){const i=state.objects.findIndex(o=>o.id===state.selectedId);if(i>0){[state.objects[i],state.objects[i-1]]=[state.objects[i-1],state.objects[i]];commit();renderSurface()}return}
      if(e.target.closest('#ann-undo')){undo();return}if(e.target.closest('#ann-redo')){redo();return}if(e.target.closest('#ann-clear')){resetAll(true);return}
    });
    panel.addEventListener('input',e=>{
      if(e.target.id==='ann-color')state.color=e.target.value;if(e.target.id==='ann-thickness')state.thickness=clamp(Number(e.target.value)||5,1,30);if(e.target.id==='ann-opacity')state.opacity=clamp(Number(e.target.value)||100,10,100)/100;if(e.target.id==='ann-font')state.fontSize=clamp(Number(e.target.value)||48,12,200);if(e.target.id==='ann-text')state.text=e.target.value;applyStyleToSelected();updateUi();
    });
    panel.addEventListener('change',e=>{if(e.target.id==='ann-fill'){state.fill=e.target.checked;applyStyleToSelected()}if(['ann-color','ann-thickness','ann-opacity','ann-font','ann-text','ann-fill'].includes(e.target.id)&&selected())commit()});
  }

  async function buildCanvas(){
    const src=await syncSource();if(!src)throw new Error('Сначала загрузите изображение');const out=document.createElement('canvas');out.width=src.naturalWidth;out.height=src.naturalHeight;const ctx=out.getContext('2d');ctx.drawImage(src,0,0,out.width,out.height);
    state.objects.forEach(o=>drawCanvasObject(ctx,o));return out;
  }

  function drawCanvasObject(ctx,o){
    ctx.save();ctx.globalAlpha=o.type==='marker'?Math.min(.48,o.opacity):o.opacity;ctx.strokeStyle=o.color;ctx.fillStyle=o.color;ctx.lineWidth=Math.max(1,o.thickness);ctx.lineCap='round';ctx.lineJoin='round';
    if(o.type==='rect'){const x=Math.min(o.x1,o.x2),y=Math.min(o.y1,o.y2),w=Math.abs(o.x2-o.x1),h=Math.abs(o.y2-o.y1);if(o.fill){ctx.save();ctx.globalAlpha*=.18;ctx.fillRect(x,y,w,h);ctx.restore()}ctx.strokeRect(x,y,w,h)}
    else if(o.type==='ellipse'){const x=Math.min(o.x1,o.x2),y=Math.min(o.y1,o.y2),w=Math.abs(o.x2-o.x1),h=Math.abs(o.y2-o.y1);ctx.beginPath();ctx.ellipse(x+w/2,y+h/2,w/2,h/2,0,0,Math.PI*2);if(o.fill){ctx.save();ctx.globalAlpha*=.18;ctx.fill();ctx.restore()}ctx.stroke()}
    else if(o.type==='line'||o.type==='arrow'){ctx.beginPath();ctx.moveTo(o.x1,o.y1);ctx.lineTo(o.x2,o.y2);ctx.stroke();if(o.type==='arrow'){const a=Math.atan2(o.y2-o.y1,o.x2-o.x1),len=Math.max(12,o.thickness*4.2);ctx.beginPath();ctx.moveTo(o.x2-Math.cos(a-Math.PI/6)*len,o.y2-Math.sin(a-Math.PI/6)*len);ctx.lineTo(o.x2,o.y2);ctx.lineTo(o.x2-Math.cos(a+Math.PI/6)*len,o.y2-Math.sin(a+Math.PI/6)*len);ctx.stroke()}}
    else if(o.type==='marker'){if(o.points.length>1){ctx.lineWidth=Math.max(6,o.thickness*4);ctx.beginPath();ctx.moveTo(o.points[0].x,o.points[0].y);o.points.slice(1).forEach(p=>ctx.lineTo(p.x,p.y));ctx.stroke()}}
    else if(o.type==='text'){ctx.textBaseline='top';ctx.font=`600 ${o.fontSize}px Arial, sans-serif`;String(o.text||'Текст').split('\n').forEach((line,i)=>ctx.fillText(line||' ',o.x,o.y+i*o.fontSize*1.25))}
    else if(o.type==='number'){ctx.beginPath();ctx.arc(o.x,o.y,o.radius,0,Math.PI*2);ctx.fill();ctx.fillStyle='#08110c';ctx.globalAlpha=1;ctx.font=`800 ${o.radius*1.05}px Arial, sans-serif`;ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillText(String(o.number),o.x,o.y+1)}
    ctx.restore();
  }

  async function exportResult(format){
    const canvas=await buildCanvas(),quality=.94;
    if(format==='pdf'){
      if(!window.jspdf?.jsPDF)throw new Error('Локальный PDF-модуль не загрузился');const{jsPDF}=window.jspdf,doc=new jsPDF({orientation:canvas.width>canvas.height?'landscape':'portrait',unit:'mm',format:'a4'}),pw=doc.internal.pageSize.getWidth(),ph=doc.internal.pageSize.getHeight(),m=10,sc=Math.min((pw-m*2)/canvas.width,(ph-m*2)/canvas.height),w=canvas.width*sc,h=canvas.height*sc;doc.addImage(canvas.toDataURL('image/jpeg',.94),'JPEG',(pw-w)/2,(ph-h)/2,w,h,undefined,'FAST');download(doc.output('blob'),baseName()+'-annotated.pdf');return;
    }
    if(format==='heic'){
      if(!window.safelightHeicCodec?.encodeCanvas)throw new Error('HEIC-кодек ещё не загрузился');const b=await window.safelightHeicCodec.encodeCanvas(canvas);download(b,baseName()+'-annotated.heic');return;
    }
    let out=canvas;if(format==='jpeg'){out=document.createElement('canvas');out.width=canvas.width;out.height=canvas.height;const x=out.getContext('2d');x.fillStyle='#fff';x.fillRect(0,0,out.width,out.height);x.drawImage(canvas,0,0)}
    const mime=format==='png'?'image/png':format==='webp'?'image/webp':'image/jpeg';download(await blob(out,mime,format==='png'?undefined:quality),baseName()+'-annotated.'+(format==='jpeg'?'jpg':format));
  }

  document.addEventListener('keydown',e=>{
    if(!active())return;const tag=e.target?.tagName;if(tag==='INPUT'||tag==='TEXTAREA'||tag==='SELECT')return;
    if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='z'){e.shiftKey?redo():undo();e.preventDefault();return}if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='y'){redo();e.preventDefault();return}
    if((e.key==='Delete'||e.key==='Backspace')&&state.selectedId!=null){state.objects=state.objects.filter(o=>o.id!==state.selectedId);state.selectedId=null;commit();renderSurface();e.preventDefault()}
  },true);

  document.addEventListener('click',e=>{
    const option=e.target.closest('.sl-export-option[data-export]');if(!option||!active())return;const f=option.dataset.export;if(!['webp','jpeg','png','heic','pdf'].includes(f))return;e.preventDefault();e.stopPropagation();e.stopImmediatePropagation();option.closest('.sl-export-wrap')?.classList.remove('open');const btn=$('sl-export');if(btn)btn.disabled=true;exportResult(f).then(()=>hint('Экспорт аннотаций готов.')).catch(err=>{console.error(err);hint(err.message||'Не удалось экспортировать')}).finally(()=>{if(btn)btn.disabled=false})
  },true);

  window.addEventListener('resize',()=>requestAnimationFrame(syncSurface),{passive:true});
  window.addEventListener('safelight:toolchange',e=>{if(e.detail?.page==='annotation')setTimeout(()=>{syncSource().then(()=>{renderSurface();syncSurface()}).catch(()=>{})},0);else $('sl-ann-surface')?.classList.remove('show')});
  new MutationObserver(()=>{if(active()){syncSource().then(()=>{renderSurface();syncSurface()}).catch(()=>{})}}).observe($('previewImg')||document.documentElement,{attributes:true,attributeFilter:['src']});

  function install(){createPanel();const app=document.querySelector('.sl-app');if(!app){setTimeout(install,60);return}const p=$('panel-annotation');if(p&&p.parentElement?.id!=='sl-inspector-panels')$('sl-inspector-panels')?.appendChild(p);createSidebarButton();ensureSurface();renderSurface();syncSurface()}

  window.safelightAnnotationTools=Object.freeze({render:buildCanvas,clear:()=>resetAll(false),activate:activateAnnotation,get state(){return state}});
  install();
})();
