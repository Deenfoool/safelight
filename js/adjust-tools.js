(function(){
  "use strict";
  if(window.safelightAdjustToolsLoaded)return;
  window.safelightAdjustToolsLoaded=true;

  const $=id=>document.getElementById(id);
  const clamp=(v,min,max)=>Math.max(min,Math.min(max,v));
  const CURVE_X=[0,64,128,192,255];
  const PREVIEW_MAX_SIDE=1800,PREVIEW_MAX_PIXELS=2200000;
  let sourceImage=null;
  let sourceSrc="";
  let renderTimer=0;
  let renderToken=0;
  let exporting=false;
  let curveDrag=-1;

  function active(){return !!document.querySelector("#panel-adjust.active")}
  function previewScale(width,height){return Math.min(1,PREVIEW_MAX_SIDE/Math.max(1,width,height),Math.sqrt(PREVIEW_MAX_PIXELS/Math.max(1,width*height)))}
  function number(id,fallback){const value=Number($(id)?.value);return Number.isFinite(value)?value:fallback}
  function curveValues(){
    return [
      0,
      clamp(64+number("a-curve-shadow",0),0,255),
      clamp(128+number("a-curve-mid",0),0,255),
      clamp(192+number("a-curve-high",0),0,255),
      255
    ];
  }
  function state(){return{
    exposure:clamp(number("a-exposure",0),-2,2),
    brightness:clamp(number("a-bright",0),-100,100),
    contrast:clamp(number("a-contrast",0),-100,100),
    highlights:clamp(number("a-highlights",0),-100,100),
    shadows:clamp(number("a-shadows",0),-100,100),
    temperature:clamp(number("a-temp",0),-100,100),
    tint:clamp(number("a-tint",0),-100,100),
    saturation:clamp(number("a-sat",0),-100,100),
    gamma:clamp(number("a-gamma",1),0.5,2),
    levelBlack:clamp(number("a-level-black",0),0,254),
    levelMid:clamp(number("a-level-mid",1),0.2,5),
    levelWhite:clamp(number("a-level-white",255),1,255),
    outputBlack:clamp(number("a-output-black",0),0,254),
    outputWhite:clamp(number("a-output-white",255),1,255),
    curve:curveValues(),
    sharpness:clamp(number("a-sharp",0),0,200),
    sharpRadius:clamp(number("a-sharp-radius",0.8),0.4,3),
    sharpThreshold:clamp(number("a-sharp-threshold",4),0,40),
    denoise:clamp(number("a-denoise",0),0,100),
    denoiseDetail:clamp(number("a-denoise-detail",65),0,100),
    blur:clamp(number("a-blur",0),0,20),
    vignette:clamp(number("a-vignette",0),0,100),
    vignetteFeather:clamp(number("a-vignette-feather",65),0,100),
    sepia:clamp(number("a-sepia",0),0,100),
    grayscale:!!$("a-gray")?.checked
  }}

  function slider(id,label,min,max,value,step){
    return `<div class="slider-row sl-adjust-slider"><div class="top"><span>${label}</span><b id="${id}-val">${value}</b></div><input type="range" id="${id}" min="${min}" max="${max}" value="${value}"${step?` step="${step}"`:""}></div>`;
  }
  function accordion(title,subtitle,body,open){
    return `<div class="sl-adjust-section sl-adjust-accordion${open?" open":""}" data-adjust-section="${title.toLowerCase()}">
      <button type="button" class="sl-adjust-section-head sl-adjust-accordion-toggle" aria-expanded="${open?"true":"false"}">
        <span>${title}</span><span class="sl-adjust-accordion-meta"><small>${subtitle}</small><i aria-hidden="true"></i></span>
      </button>
      <div class="sl-adjust-accordion-body"${open?"":" hidden"}>${body}</div>
    </div>`;
  }

  function installPanel(){
    const panel=$("panel-adjust");
    if(!panel||panel.dataset.advancedAdjust==="1")return false;
    panel.dataset.advancedAdjust="1";
    panel.innerHTML=`<div class="panel-card sl-adjust-panel">
      <h2>РАСШИРЕННАЯ КОРРЕКЦИЯ</h2>
      <p class="desc">Тон, цвет, уровни, кривые и детали изображения с живым предпросмотром.</p>
      <div class="sl-adjust-section sl-adjust-presets-section">
        <div class="sl-adjust-section-head"><span>Технические пресеты</span><small>быстрые рабочие настройки</small></div>
        <div class="sl-adjust-presets">
          <button type="button" class="btn ghost" data-adjust-preset="reset">Сброс</button>
          <button type="button" class="btn ghost" data-adjust-preset="auto">Автоуровни</button>
          <button type="button" class="btn ghost" data-adjust-preset="shadows">Поднять тени</button>
          <button type="button" class="btn ghost" data-adjust-preset="highlights">Сберечь света</button>
          <button type="button" class="btn ghost" data-adjust-preset="web">Резкость для веба</button>
          <button type="button" class="btn ghost" data-adjust-preset="denoise">Убрать шум</button>
        </div>
      </div>

      ${accordion("Свет","экспозиция и диапазон",
        slider("a-exposure","Экспозиция",-2,2,0,0.05)+
        slider("a-bright","Яркость",-100,100,0,1)+
        slider("a-contrast","Контраст",-100,100,0,1)+
        slider("a-highlights","Света",-100,100,0,1)+
        slider("a-shadows","Тени",-100,100,0,1),true)}

      ${accordion("Уровни","чёрная / средняя / белая точка",
        `<div class="sl-levels-chart"><canvas id="a-levels-hist" width="260" height="92" aria-label="Гистограмма яркости"></canvas></div>
         <div class="sl-adjust-inline-actions"><button type="button" class="btn ghost" data-adjust-action="auto-levels">Авто</button><button type="button" class="btn ghost" data-adjust-action="reset-levels">Сбросить уровни</button></div>`+
        slider("a-level-black","Чёрная точка",0,254,0,1)+
        slider("a-level-mid","Средняя точка",0.2,5,1,0.01)+
        slider("a-level-white","Белая точка",1,255,255,1)+
        slider("a-output-black","Выходной чёрный",0,254,0,1)+
        slider("a-output-white","Выходной белый",1,255,255,1),false)}

      ${accordion("Цвет","баланс белого и насыщенность",
        slider("a-temp","Температура",-100,100,0,1)+
        slider("a-tint","Оттенок",-100,100,0,1)+
        slider("a-sat","Насыщенность",-100,100,0,1)+
        slider("a-gamma","Гамма",0.5,2,1,0.01),false)}

      ${accordion("Кривые","тоновая кривая RGB",
        `<div class="sl-curve-wrap">
          <canvas id="a-curve-canvas" width="260" height="150" tabindex="0" aria-label="Тоновая кривая"></canvas>
          <div class="sl-curve-note">Точки на графике можно тянуть вверх и вниз.</div>
        </div>`+
        slider("a-curve-shadow","Тени",-100,100,0,1)+
        slider("a-curve-mid","Средние тона",-100,100,0,1)+
        slider("a-curve-high","Света",-100,100,0,1)+
        `<div class="sl-adjust-inline-actions"><button type="button" class="btn ghost" data-adjust-action="reset-curve">Сбросить кривую</button></div>`,false)}

      ${accordion("Детали","резкость и шумоподавление",
        `<div class="sl-adjust-subhead"><b>Нерезкая маска</b><small>радиус и порог защищают мелкий шум</small></div>`+
        slider("a-sharp","Количество",0,200,0,1)+
        slider("a-sharp-radius","Радиус",0.4,3,0.8,0.1)+
        slider("a-sharp-threshold","Порог",0,40,4,1)+
        `<div class="sl-adjust-divider"></div><div class="sl-adjust-subhead"><b>Шумоподавление</b><small>сглаживает плоские области, сохраняя края</small></div>`+
        slider("a-denoise","Сила",0,100,0,1)+
        slider("a-denoise-detail","Сохранение деталей",0,100,65,1),false)}

      ${accordion("Эффекты","финальная обработка",
        slider("a-blur","Размытие",0,20,0,0.25)+
        slider("a-vignette","Виньетка",0,100,0,1)+
        slider("a-vignette-feather","Мягкость виньетки",0,100,65,1)+
        slider("a-sepia","Сепия",0,100,0,1)+
        `<label class="check-row sl-adjust-check"><input type="checkbox" id="a-gray"> Чёрно-белое</label>`,false)}

      <div class="sl-adjust-note">«Применить» записывает текущую коррекцию в историю как новую рабочую версию.</div>
    </div>`;

    bindPanel(panel);
    bindCurve();
    updateLabels();
    drawCurve();
    return true;
  }

  function fmtSigned(value){const n=Number(value)||0;return n>0?`+${n}`:String(n)}
  function clean(value,digits){return Number(value).toFixed(digits).replace(/\.?0+$/,'')}
  function updateLabels(){
    const set=(id,text)=>{const el=$(id+"-val");if(el)el.textContent=text};
    const ev=number("a-exposure",0);
    set("a-exposure",`${ev>0?"+":""}${clean(ev,2)} EV`);
    ["a-bright","a-contrast","a-highlights","a-shadows","a-temp","a-tint","a-sat","a-curve-shadow","a-curve-mid","a-curve-high"].forEach(id=>set(id,fmtSigned(number(id,0))));
    set("a-gamma",clean(number("a-gamma",1),2));
    set("a-level-black",Math.round(number("a-level-black",0)));
    set("a-level-mid",clean(number("a-level-mid",1),2));
    set("a-level-white",Math.round(number("a-level-white",255)));
    set("a-output-black",Math.round(number("a-output-black",0)));
    set("a-output-white",Math.round(number("a-output-white",255)));
    set("a-sharp",`${Math.round(number("a-sharp",0))}%`);
    set("a-sharp-radius",`${clean(number("a-sharp-radius",0.8),1)} px`);
    set("a-sharp-threshold",Math.round(number("a-sharp-threshold",4)));
    set("a-denoise",`${Math.round(number("a-denoise",0))}%`);
    set("a-denoise-detail",`${Math.round(number("a-denoise-detail",65))}%`);
    set("a-blur",`${clean(number("a-blur",0),2)} px`);
    set("a-vignette",`${Math.round(number("a-vignette",0))}%`);
    set("a-vignette-feather",`${Math.round(number("a-vignette-feather",65))}%`);
    set("a-sepia",`${Math.round(number("a-sepia",0))}%`);
  }

  const DEFAULTS={
    "a-exposure":0,"a-bright":0,"a-contrast":0,"a-highlights":0,"a-shadows":0,
    "a-temp":0,"a-tint":0,"a-sat":0,"a-gamma":1,
    "a-level-black":0,"a-level-mid":1,"a-level-white":255,"a-output-black":0,"a-output-white":255,
    "a-curve-shadow":0,"a-curve-mid":0,"a-curve-high":0,
    "a-sharp":0,"a-sharp-radius":0.8,"a-sharp-threshold":4,
    "a-denoise":0,"a-denoise-detail":65,
    "a-blur":0,"a-vignette":0,"a-vignette-feather":65,"a-sepia":0
  };

  function setValues(values){
    Object.entries(values).forEach(([id,value])=>{const el=$(id);if(el)el.value=String(value)});
    updateLabels();
    drawCurve();
  }
  function clearPresetActive(){document.querySelectorAll("[data-adjust-preset]").forEach(button=>button.classList.remove("active"))}
  function resetAdjustments(render){
    setValues(DEFAULTS);
    if($("a-gray"))$("a-gray").checked=false;
    clearPresetActive();
    if(render!==false)scheduleRender(0);
  }

  const PRESETS={
    shadows:{"a-shadows":30,"a-highlights":-6,"a-curve-shadow":10,"a-level-mid":1.08},
    highlights:{"a-highlights":-32,"a-shadows":8,"a-curve-high":-12,"a-level-mid":0.98},
    web:{"a-contrast":4,"a-sharp":85,"a-sharp-radius":0.8,"a-sharp-threshold":5},
    denoise:{"a-denoise":48,"a-denoise-detail":68,"a-sharp":28,"a-sharp-radius":0.7,"a-sharp-threshold":7}
  };

  async function histogramFromImage(image){
    if(!image?.naturalWidth)return null;
    const maxSide=420,scale=Math.min(1,maxSide/Math.max(image.naturalWidth,image.naturalHeight));
    const canvas=document.createElement("canvas");
    canvas.width=Math.max(1,Math.round(image.naturalWidth*scale));
    canvas.height=Math.max(1,Math.round(image.naturalHeight*scale));
    const ctx=canvas.getContext("2d",{willReadFrequently:true});
    ctx.drawImage(image,0,0,canvas.width,canvas.height);
    const data=ctx.getImageData(0,0,canvas.width,canvas.height).data;
    const bins=new Uint32Array(256);
    let count=0;
    for(let i=0;i<data.length;i+=4){
      if(data[i+3]===0)continue;
      const y=clamp(Math.round(.2126*data[i]+.7152*data[i+1]+.0722*data[i+2]),0,255);
      bins[y]++;count++;
    }
    return{bins,count};
  }

  function percentile(hist,fraction){
    if(!hist?.count)return fraction<.5?0:255;
    const target=hist.count*fraction;
    let sum=0;
    for(let i=0;i<256;i++){sum+=hist.bins[i];if(sum>=target)return i}
    return 255;
  }

  async function applyAutoLevels(){
    const image=await loadSource();
    if(!image)return;
    const hist=await histogramFromImage(image);
    let black=percentile(hist,.006),white=percentile(hist,.994);
    if(white-black<24){black=Math.max(0,black-12);white=Math.min(255,white+12)}
    if(white<=black){black=0;white=255}
    setValues({"a-level-black":black,"a-level-mid":1,"a-level-white":white,"a-output-black":0,"a-output-white":255});
    drawHistogram(hist);
    scheduleRender(0);
  }

  async function applyPreset(name){
    if(name==="reset"){resetAdjustments(true);return}
    if(name==="auto"){resetAdjustments(false);await applyAutoLevels()}
    else{
      resetAdjustments(false);
      setValues(PRESETS[name]||{});
      scheduleRender(0);
    }
    document.querySelectorAll("[data-adjust-preset]").forEach(button=>button.classList.toggle("active",button.dataset.adjustPreset===name));
  }

  function setAccordion(section,open){
    const toggle=section.querySelector(".sl-adjust-accordion-toggle"),body=section.querySelector(".sl-adjust-accordion-body");
    if(!toggle||!body)return;
    section.classList.toggle("open",open);
    toggle.setAttribute("aria-expanded",open?"true":"false");
    body.hidden=!open;
    if(open){
      if(section.dataset.adjustSection==="кривые")requestAnimationFrame(drawCurve);
      if(section.dataset.adjustSection==="уровни")requestAnimationFrame(refreshHistogram);
    }
  }
  function openOnly(section){
    document.querySelectorAll("#panel-adjust .sl-adjust-accordion").forEach(item=>setAccordion(item,item===section));
  }

  function bindPanel(panel){
    panel.addEventListener("input",event=>{
      if(!event.target.matches("input,select"))return;
      updateLabels();
      clearPresetActive();
      if(event.target.id?.startsWith("a-curve-"))drawCurve();
      scheduleRender();
    },true);
    panel.addEventListener("change",event=>{
      if(!event.target.matches("input,select"))return;
      updateLabels();
      if(event.target.id?.startsWith("a-curve-"))drawCurve();
      scheduleRender(0);
    },true);
    panel.addEventListener("click",event=>{
      const toggle=event.target.closest(".sl-adjust-accordion-toggle");
      if(toggle){
        event.preventDefault();
        const section=toggle.closest(".sl-adjust-accordion");
        const wasOpen=toggle.getAttribute("aria-expanded")==="true";
        if(wasOpen)setAccordion(section,false);else openOnly(section);
        return;
      }
      const preset=event.target.closest("[data-adjust-preset]");
      if(preset){event.preventDefault();applyPreset(preset.dataset.adjustPreset);return}
      const action=event.target.closest("[data-adjust-action]");
      if(!action)return;
      event.preventDefault();
      if(action.dataset.adjustAction==="auto-levels")applyAutoLevels();
      if(action.dataset.adjustAction==="reset-levels"){
        setValues({"a-level-black":0,"a-level-mid":1,"a-level-white":255,"a-output-black":0,"a-output-white":255});
        scheduleRender(0);
      }
      if(action.dataset.adjustAction==="reset-curve"){
        setValues({"a-curve-shadow":0,"a-curve-mid":0,"a-curve-high":0});
        scheduleRender(0);
      }
    });
  }

  function themeColors(){
    const light=document.documentElement.dataset.theme==="light";
    return light
      ?{bg:"#f7f8f9",grid:"rgba(31,35,40,.10)",line:"#23884a",point:"#176b39",diag:"rgba(31,35,40,.22)",hist:"rgba(35,136,74,.46)"}
      :{bg:"#111114",grid:"rgba(255,255,255,.08)",line:"#b8ef54",point:"#d4ff7a",diag:"rgba(255,255,255,.22)",hist:"rgba(163,230,53,.40)"};
  }

  function drawCurve(){
    const canvas=$("a-curve-canvas");
    if(!canvas)return;
    const ctx=canvas.getContext("2d"),w=canvas.width,h=canvas.height,c=themeColors(),ys=curveValues();
    ctx.clearRect(0,0,w,h);ctx.fillStyle=c.bg;ctx.fillRect(0,0,w,h);
    ctx.strokeStyle=c.grid;ctx.lineWidth=1;
    for(let i=1;i<4;i++){
      const x=Math.round(w*i/4)+.5,y=Math.round(h*i/4)+.5;
      ctx.beginPath();ctx.moveTo(x,0);ctx.lineTo(x,h);ctx.stroke();
      ctx.beginPath();ctx.moveTo(0,y);ctx.lineTo(w,y);ctx.stroke();
    }
    ctx.strokeStyle=c.diag;ctx.setLineDash([4,4]);ctx.beginPath();ctx.moveTo(0,h);ctx.lineTo(w,0);ctx.stroke();ctx.setLineDash([]);
    ctx.strokeStyle=c.line;ctx.lineWidth=2;ctx.beginPath();
    CURVE_X.forEach((x,i)=>{
      const px=x/255*w,py=h-ys[i]/255*h;
      if(i===0)ctx.moveTo(px,py);else ctx.lineTo(px,py);
    });
    ctx.stroke();
    ctx.fillStyle=c.point;ctx.strokeStyle=c.bg;ctx.lineWidth=2;
    for(let i=1;i<4;i++){
      const px=CURVE_X[i]/255*w,py=h-ys[i]/255*h;
      ctx.beginPath();ctx.arc(px,py,5.2,0,Math.PI*2);ctx.fill();ctx.stroke();
    }
  }

  function bindCurve(){
    const canvas=$("a-curve-canvas");
    if(!canvas||canvas.dataset.bound==="1")return;
    canvas.dataset.bound="1";
    const pick=event=>{
      const rect=canvas.getBoundingClientRect(),x=(event.clientX-rect.left)/rect.width*canvas.width;
      let best=-1,dist=Infinity;
      for(let i=1;i<4;i++){const d=Math.abs(x-CURVE_X[i]/255*canvas.width);if(d<dist){dist=d;best=i}}
      return dist<=30?best:-1;
    };
    const move=event=>{
      if(curveDrag<1)return;
      const rect=canvas.getBoundingClientRect(),y=clamp((event.clientY-rect.top)/rect.height,0,1),output=(1-y)*255;
      const base=CURVE_X[curveDrag],offset=Math.round(clamp(output-base,-100,100));
      const ids=["","a-curve-shadow","a-curve-mid","a-curve-high"],input=$(ids[curveDrag]);
      if(input){input.value=String(offset);updateLabels();drawCurve();clearPresetActive();scheduleRender()}
    };
    canvas.addEventListener("pointerdown",event=>{
      curveDrag=pick(event);
      if(curveDrag>0){canvas.setPointerCapture?.(event.pointerId);move(event)}
    });
    canvas.addEventListener("pointermove",move);
    const stop=()=>{if(curveDrag>0)scheduleRender(0);curveDrag=-1};
    canvas.addEventListener("pointerup",stop);canvas.addEventListener("pointercancel",stop);
    canvas.addEventListener("keydown",event=>{
      const step=event.shiftKey?10:2;
      const ids=["a-curve-shadow","a-curve-mid","a-curve-high"];
      if(!["ArrowUp","ArrowDown"].includes(event.key))return;
      event.preventDefault();
      const index=curveDrag>0?curveDrag-1:1,input=$(ids[index]);
      if(!input)return;
      input.value=String(clamp(number(input.id,0)+(event.key==="ArrowUp"?step:-step),-100,100));
      updateLabels();drawCurve();scheduleRender();
    });
  }

  async function refreshHistogram(){
    try{const image=await loadSource();if(image)drawHistogram(await histogramFromImage(image))}catch(_){}
  }

  function drawHistogram(hist){
    const canvas=$("a-levels-hist");
    if(!canvas||!hist)return;
    const ctx=canvas.getContext("2d"),w=canvas.width,h=canvas.height,c=themeColors();
    ctx.clearRect(0,0,w,h);ctx.fillStyle=c.bg;ctx.fillRect(0,0,w,h);
    ctx.strokeStyle=c.grid;ctx.lineWidth=1;
    for(let i=1;i<4;i++){const x=Math.round(w*i/4)+.5;ctx.beginPath();ctx.moveTo(x,0);ctx.lineTo(x,h);ctx.stroke()}
    let max=1;
    for(const value of hist.bins)if(value>max)max=value;
    ctx.fillStyle=c.hist;
    for(let i=0;i<256;i++){
      const v=Math.log1p(hist.bins[i])/Math.log1p(max),bar=Math.max(0,v*(h-8));
      const x=i/256*w,next=(i+1)/256*w;
      ctx.fillRect(x,h-bar,Math.max(1,next-x+.2),bar);
    }
  }

  function loadSource(){
    const preview=$("previewImg"),src=preview?.src||"";
    if(!src){sourceImage=null;sourceSrc="";return Promise.resolve(null)}
    if(sourceImage&&sourceSrc===src)return Promise.resolve(sourceImage);
    return new Promise((resolve,reject)=>{
      const image=new Image();
      image.onload=()=>{sourceImage=image;sourceSrc=src;refreshHistogram();resolve(image)};
      image.onerror=()=>reject(new Error("Не удалось открыть изображение"));
      image.src=src;
    });
  }

  function gammaLut(gamma){const lut=new Uint8ClampedArray(256),inv=1/gamma;for(let i=0;i<256;i++)lut[i]=Math.round(255*Math.pow(i/255,inv));return lut}
  function curveLut(values){
    const lut=new Uint8ClampedArray(256);
    for(let i=0;i<4;i++){
      const x0=CURVE_X[i],x1=CURVE_X[i+1],y0=values[i],y1=values[i+1],span=Math.max(1,x1-x0);
      for(let x=x0;x<=x1;x++){const t=(x-x0)/span;lut[x]=Math.round(clamp(y0+(y1-y0)*t,0,255))}
    }
    return lut;
  }
  function levelsLut(s){
    const lut=new Uint8ClampedArray(256),black=Math.min(s.levelBlack,s.levelWhite-1),white=Math.max(s.levelWhite,black+1),outBlack=Math.min(s.outputBlack,s.outputWhite-1),outWhite=Math.max(s.outputWhite,outBlack+1);
    for(let i=0;i<256;i++){
      const n=clamp((i-black)/(white-black),0,1);
      const mid=Math.pow(n,1/s.levelMid);
      lut[i]=Math.round(outBlack+mid*(outWhite-outBlack));
    }
    return lut;
  }

  function tonePixels(canvas,s){
    const needsTone=Math.abs(s.gamma-1)>.001||s.temperature!==0||s.tint!==0||s.highlights!==0||s.shadows!==0;
    const needsLevels=s.levelBlack!==0||Math.abs(s.levelMid-1)>.001||s.levelWhite!==255||s.outputBlack!==0||s.outputWhite!==255;
    const needsCurve=s.curve.some((value,index)=>Math.abs(value-CURVE_X[index])>.5);
    if(!needsTone&&!needsLevels&&!needsCurve)return;
    const ctx=canvas.getContext("2d",{willReadFrequently:true}),imageData=ctx.getImageData(0,0,canvas.width,canvas.height),data=imageData.data;
    const gammaTable=Math.abs(s.gamma-1)>.001?gammaLut(s.gamma):null,levelTable=needsLevels?levelsLut(s):null,curveTable=needsCurve?curveLut(s.curve):null,warm=s.temperature*.62,tint=s.tint;
    for(let i=0;i<data.length;i+=4){
      if(data[i+3]===0)continue;
      let r=data[i]+warm+tint*.24,g=data[i+1]-tint*.48,b=data[i+2]-warm+tint*.24;
      r=clamp(r,0,255);g=clamp(g,0,255);b=clamp(b,0,255);
      const lum=(.2126*r+.7152*g+.0722*b)/255,shadowWeight=(1-lum)*(1-lum),highlightWeight=lum*lum,delta=s.shadows*.72*shadowWeight+s.highlights*.72*highlightWeight;
      r=clamp(r+delta,0,255);g=clamp(g+delta,0,255);b=clamp(b+delta,0,255);
      if(gammaTable){r=gammaTable[Math.round(r)];g=gammaTable[Math.round(g)];b=gammaTable[Math.round(b)]}
      if(levelTable){r=levelTable[Math.round(r)];g=levelTable[Math.round(g)];b=levelTable[Math.round(b)]}
      if(curveTable){r=curveTable[Math.round(r)];g=curveTable[Math.round(g)];b=curveTable[Math.round(b)]}
      data[i]=r;data[i+1]=g;data[i+2]=b;
    }
    ctx.putImageData(imageData,0,0);
  }

  function blurredCopy(canvas,radius){
    const out=document.createElement("canvas");out.width=canvas.width;out.height=canvas.height;
    const ctx=out.getContext("2d");ctx.filter=`blur(${radius}px)`;ctx.drawImage(canvas,0,0);ctx.filter="none";return out;
  }

  function denoise(canvas,amount,detail,pixelScale){
    if(amount<=0||canvas.width<2||canvas.height<2)return;
    const radius=Math.max(.25,(.45+amount/100*1.55)*(pixelScale||1)),blurred=blurredCopy(canvas,radius);
    const ctx=canvas.getContext("2d",{willReadFrequently:true}),original=ctx.getImageData(0,0,canvas.width,canvas.height),smooth=blurred.getContext("2d",{willReadFrequently:true}).getImageData(0,0,canvas.width,canvas.height),a=original.data,b=smooth.data;
    const strength=amount/100,edgeLimit=8+detail/100*62;
    for(let i=0;i<a.length;i+=4){
      if(a[i+3]===0)continue;
      const diff=(Math.abs(a[i]-b[i])+Math.abs(a[i+1]-b[i+1])+Math.abs(a[i+2]-b[i+2]))/3;
      const protect=clamp(1-diff/edgeLimit,0,1),mix=strength*protect*.88;
      a[i]=a[i]+(b[i]-a[i])*mix;a[i+1]=a[i+1]+(b[i+1]-a[i+1])*mix;a[i+2]=a[i+2]+(b[i+2]-a[i+2])*mix;
    }
    ctx.putImageData(original,0,0);
  }

  function unsharpMask(canvas,amount,radius,threshold){
    if(amount<=0||canvas.width<2||canvas.height<2)return;
    const blurred=blurredCopy(canvas,radius),ctx=canvas.getContext("2d",{willReadFrequently:true}),original=ctx.getImageData(0,0,canvas.width,canvas.height),soft=blurred.getContext("2d",{willReadFrequently:true}).getImageData(0,0,canvas.width,canvas.height),a=original.data,b=soft.data,strength=amount/100;
    for(let i=0;i<a.length;i+=4){
      if(a[i+3]===0)continue;
      const lumA=.2126*a[i]+.7152*a[i+1]+.0722*a[i+2],lumB=.2126*b[i]+.7152*b[i+1]+.0722*b[i+2];
      if(Math.abs(lumA-lumB)<threshold)continue;
      a[i]=clamp(a[i]+(a[i]-b[i])*strength,0,255);
      a[i+1]=clamp(a[i+1]+(a[i+1]-b[i+1])*strength,0,255);
      a[i+2]=clamp(a[i+2]+(a[i+2]-b[i+2])*strength,0,255);
    }
    ctx.putImageData(original,0,0);
  }

  function vignette(canvas,amount,feather){
    if(amount<=0)return;
    const ctx=canvas.getContext("2d"),w=canvas.width,h=canvas.height,cx=w/2,cy=h/2,radius=Math.sqrt(w*w+h*h)/2,start=.28+feather/100*.34,gradient=ctx.createRadialGradient(cx,cy,radius*start,cx,cy,radius);
    gradient.addColorStop(0,"rgba(0,0,0,0)");
    gradient.addColorStop(Math.min(.94,start+.20),"rgba(0,0,0,0)");
    gradient.addColorStop(1,`rgba(0,0,0,${amount/100*.78})`);
    ctx.save();ctx.fillStyle=gradient;ctx.fillRect(0,0,w,h);ctx.restore();
  }

  async function buildCanvas(options){
    const image=await loadSource();if(!image)return null;
    const s=state(),scale=options?.preview?previewScale(image.naturalWidth,image.naturalHeight):1,canvas=document.createElement("canvas");canvas.width=Math.max(1,Math.round(image.naturalWidth*scale));canvas.height=Math.max(1,Math.round(image.naturalHeight*scale));
    const ctx=canvas.getContext("2d"),exposure=Math.pow(2,s.exposure),brightness=clamp(exposure*(1+s.brightness/100),0,4);
    ctx.filter=`brightness(${brightness}) contrast(${clamp(100+s.contrast,0,200)}%) saturate(${clamp(100+s.saturation,0,200)}%) blur(${s.blur*scale}px) sepia(${s.sepia}%) grayscale(${s.grayscale?100:0}%)`;
    ctx.drawImage(image,0,0,canvas.width,canvas.height);ctx.filter="none";
    tonePixels(canvas,s);
    denoise(canvas,s.denoise,s.denoiseDetail,scale);
    unsharpMask(canvas,s.sharpness,Math.max(.2,s.sharpRadius*scale),s.sharpThreshold);
    vignette(canvas,s.vignette,s.vignetteFeather);
    return canvas;
  }

  async function renderNow(){
    if(!active())return null;
    const token=++renderToken;
    try{
      const built=await buildCanvas({preview:true});
      if(!built||token!==renderToken||!active())return null;
      const live=$("sl-live-canvas");if(!live)return null;
      live.width=built.width;live.height=built.height;
      const ctx=live.getContext("2d");ctx.clearRect(0,0,live.width,live.height);ctx.drawImage(built,0,0);
      $("previewWrap")?.classList.add("sl-live-ready");
      if($("ro-dims"))$("ro-dims").textContent=`${sourceImage.naturalWidth} × ${sourceImage.naturalHeight} px`;
      if($("ro-format"))$("ro-format").textContent="LIVE";
      return built;
    }catch(error){console.error("Safelight advanced adjust:",error);return null}
  }

  function scheduleRender(delay){clearTimeout(renderTimer);renderTimer=setTimeout(renderNow,delay==null?100:delay)}
  function updateInspector(){
    if(!active())return;
    const title=$("sl-inspector-title"),desc=$("sl-inspector-desc");
    if(title)title.textContent="Расширенная коррекция";
    if(desc)desc.textContent="Свет, уровни, кривые, цвет, шумоподавление, нерезкая маска и эффекты.";
  }

  function canvasBlob(canvas,type,quality){return new Promise((resolve,reject)=>canvas.toBlob(blob=>blob?resolve(blob):reject(new Error("Не удалось подготовить файл")),type,quality))}
  function download(blob,name){const url=URL.createObjectURL(blob),a=document.createElement("a");a.href=url;a.download=name;document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),4000)}
  function baseName(){return (($("meta-name")?.textContent||"safelight").trim().replace(/\.[^.]+$/,'')||"safelight")}
  function hint(text){const el=$("sl-export-hint");if(!el)return;el.textContent=text;el.classList.add("show");clearTimeout(hint.timer);hint.timer=setTimeout(()=>el.classList.remove("show"),3000)}

  async function exportAdjusted(format){
    if(exporting)return;exporting=true;
    try{
      const canvas=await buildCanvas({preview:false});if(!canvas)throw new Error("Сначала загрузите изображение");
      if(format==="heic"){
        const encoder=window.safelightHeicCodec?.encodeCanvas;if(typeof encoder!=="function")throw new Error("HEIC WASM-кодек не загрузился");
        download(await encoder(canvas),baseName()+"-safelight.heic");
      }else if(format==="pdf"){
        if(!window.jspdf?.jsPDF)throw new Error("PDF-модуль не загрузился");
        const {jsPDF}=window.jspdf,orientation=canvas.width>canvas.height?"landscape":"portrait",doc=new jsPDF({orientation,unit:"mm",format:"a4"}),pageW=doc.internal.pageSize.getWidth(),pageH=doc.internal.pageSize.getHeight(),margin=10,scale=Math.min((pageW-margin*2)/canvas.width,(pageH-margin*2)/canvas.height),w=canvas.width*scale,h=canvas.height*scale,jpeg=canvas.toDataURL("image/jpeg",.94);
        doc.addImage(jpeg,"JPEG",(pageW-w)/2,(pageH-h)/2,w,h,undefined,"FAST");download(doc.output("blob"),baseName()+"-safelight.pdf");
      }else{
        let output=canvas;
        if(format==="jpeg"){output=document.createElement("canvas");output.width=canvas.width;output.height=canvas.height;const ctx=output.getContext("2d");ctx.fillStyle="#fff";ctx.fillRect(0,0,output.width,output.height);ctx.drawImage(canvas,0,0)}
        const types={png:"image/png",jpeg:"image/jpeg",webp:"image/webp"},blob=await canvasBlob(output,types[format]||"image/png",format==="png"?undefined:.92);
        download(blob,baseName()+"-safelight."+(format==="jpeg"?"jpg":format));
      }
      hint("Экспорт коррекции готов.");
    }catch(error){console.error("Safelight advanced adjust export:",error);hint(error.message||"Не удалось экспортировать результат")}
    finally{exporting=false}
  }

  function patchExportMenu(){
    if(!active())return;
    const menu=document.querySelector(".sl-export-menu");if(!menu)return;
    menu.innerHTML='<div class="sl-export-menu-title">Экспорт коррекции</div><button class="sl-export-option" type="button" data-export="webp"><span>WebP</span><span>оптимально</span></button><button class="sl-export-option" type="button" data-export="jpeg"><span>JPEG</span><span>совместимо</span></button><button class="sl-export-option" type="button" data-export="png"><span>PNG</span><span>без потерь</span></button><button class="sl-export-option" type="button" data-export="heic"><span>HEIC</span><span>HEVC</span></button><button class="sl-export-option" type="button" data-export="pdf"><span>PDF</span><span>документ</span></button><div class="sl-export-sep"></div><div class="sl-export-menu-note">Экспортируется текущий результат коррекции.</div>';
  }

  function installExportOverride(){
    document.addEventListener("click",event=>{if(event.target.closest("#sl-export")&&active())setTimeout(patchExportMenu,0)},true);
    document.addEventListener("click",event=>{
      const option=event.target.closest(".sl-export-option[data-export]");if(!option||!active())return;
      const format=option.dataset.export;if(!["webp","jpeg","png","heic","pdf"].includes(format))return;
      event.preventDefault();event.stopImmediatePropagation();option.closest(".sl-export-wrap")?.classList.remove("open");exportAdjusted(format);
    },true);
  }

  function boot(){
    const panel=$("panel-adjust"),preview=$("previewImg"),app=document.querySelector(".sl-app");
    if(!panel||!preview||!app){setTimeout(boot,50);return}
    installPanel();installExportOverride();
    new MutationObserver(()=>{
      sourceImage=null;sourceSrc="";
      if(active())scheduleRender(0);
    }).observe(preview,{attributes:true,attributeFilter:["src"]});
    window.addEventListener("safelight:toolchange",()=>setTimeout(()=>{updateInspector();if(active()){scheduleRender(0);refreshHistogram();drawCurve()}},20));
    window.addEventListener("safelight:live-render",event=>{if(event.detail?.tool==="adjust")scheduleRender(0)});
    window.addEventListener("safelight:themechange",()=>{drawCurve();refreshHistogram()});
    window.addEventListener("safelight:working-source",event=>{
      if(event.detail?.applied||event.detail?.history){resetAdjustments(false);if(active())scheduleRender(0)}
    });
    window.addEventListener("safelight:source-file",()=>{resetAdjustments(false);if(active())scheduleRender(0)});
    updateInspector();if(active())scheduleRender(0);
  }

  const api=Object.freeze({render:()=>buildCanvas({preview:false}),renderPreview:renderNow,state,applyPreset,reset:()=>resetAdjustments(true),autoLevels:applyAutoLevels});
  window.safelightAdjustTools=api;
  window.safelightAdvancedAdjust=api;
  boot();
})();
