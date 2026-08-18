(function(){
'use strict';
if(window.safelightPaletteLoaded)return;
window.safelightPaletteLoaded=true;

const $=id=>document.getElementById(id);
const state={colors:[],picked:null,sourceKey:'',sourceImage:null,sourceToken:0,analysisToken:0};
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));

function active(){return !!document.querySelector('#panel-palette.active')}
function rgbHex(r,g,b){return '#'+[r,g,b].map(v=>clamp(Math.round(v),0,255).toString(16).padStart(2,'0')).join('').toUpperCase()}
function rgbHsl(r,g,b){r/=255;g/=255;b/=255;const max=Math.max(r,g,b),min=Math.min(r,g,b),d=max-min;let h=0,s=0;const l=(max+min)/2;if(d){s=d/(1-Math.abs(2*l-1));if(max===r)h=60*(((g-b)/d)%6);else if(max===g)h=60*((b-r)/d+2);else h=60*((r-g)/d+4);if(h<0)h+=360}return{h:Math.round(h),s:Math.round(s*100),l:Math.round(l*100)}}
function colorObj(r,g,b,weight){const hsl=rgbHsl(r,g,b);return{r:Math.round(r),g:Math.round(g),b:Math.round(b),hex:rgbHex(r,g,b),hsl,weight:weight||0}}
function distance(a,b){const dr=a.r-b.r,dg=a.g-b.g,db=a.b-b.b;return Math.sqrt(dr*dr+dg*dg+db*db)}
function baseName(){return(($('meta-name')?.textContent||'safelight').trim().replace(/\.[^.]+$/,'')||'safelight')}

function status(text){const el=$('palette-status');if(!el)return;el.textContent=text;clearTimeout(status.t);status.t=setTimeout(()=>{if(el.textContent===text)el.textContent=''},2200)}
function copy(text){if(!text)return;const done=()=>status('Скопировано: '+text);const fallback=()=>{const t=document.createElement('textarea');t.value=text;t.style.position='fixed';t.style.opacity='0';document.body.appendChild(t);t.select();try{document.execCommand('copy')}catch(_){}t.remove();done()};if(navigator.clipboard?.writeText)navigator.clipboard.writeText(text).then(done).catch(fallback);else fallback()}

function makePanel(){
  if($('panel-palette'))return $('panel-palette');
  const panel=document.createElement('section');
  panel.className='panel';panel.id='panel-palette';
  panel.innerHTML=`<div class="panel-card sl-palette-panel"><h2>ПАЛИТРА ИЗОБРАЖЕНИЯ</h2><p class="desc">Извлекайте основные цвета и берите точный цвет пипеткой прямо с изображения.</p><label class="sl-palette-count"><span>Количество цветов</span><select id="palette-count"><option value="3">3</option><option value="5" selected>5</option><option value="8">8</option><option value="12">12</option></select></label><div class="sl-palette-list" id="palette-list"><div class="sl-palette-empty">Загрузите изображение, чтобы получить палитру.</div></div><div class="sl-palette-eyedropper"><div class="sl-palette-eyedropper-head"><b>Пипетка</b><span>Нажмите по изображению</span></div><div class="sl-palette-picked" id="palette-picked"><span class="sl-palette-picked-swatch" id="palette-picked-swatch"></span><span class="sl-palette-picked-values"><b id="palette-picked-hex">—</b><small id="palette-picked-meta">RGB — · HSL —</small></span></div></div><div class="sl-palette-status" id="palette-status"></div></div>`;
  ($('sl-inspector-panels')||document.querySelector('main.workmain'))?.appendChild(panel);
  return panel;
}

function makeSidebarButton(){
  if(document.querySelector('.sl-sidebar [data-page="palette"]'))return;
  const groups=[...document.querySelectorAll('.sl-sidebar .sl-nav-group')];
  const group=groups.find(g=>g.querySelector('.sl-nav-label')?.textContent.trim()==='Инструменты')||groups.at(-1);if(!group)return;
  const b=document.createElement('button');b.type='button';b.className='top-nav-link sl-tool';b.dataset.page='palette';
  b.innerHTML='<span class="nav-icon" aria-hidden="true"><svg viewBox="0 0 24 24"><path d="M12 3a9 9 0 1 0 0 18h1.2a1.8 1.8 0 0 0 0-3.6h-.7a1.5 1.5 0 0 1 0-3H15a6 6 0 0 0 0-12z"/><circle cx="7.5" cy="10" r="1"/><circle cx="10" cy="6.8" r="1"/><circle cx="15" cy="7.2" r="1"/><circle cx="17" cy="11" r="1"/></svg></span><span>Палитра</span>';
  b.addEventListener('click',e=>{e.preventDefault();activatePalette()});group.appendChild(b);
}

function setInspector(){if(!active())return;const t=$('sl-inspector-title'),d=$('sl-inspector-desc');if(t)t.textContent='Палитра изображения';if(d)d.textContent='Основные цвета, HEX/RGB/HSL и пипетка по исходному изображению.'}
function activatePalette(){document.body.classList.remove('page-home');document.body.classList.add('page-tool','sl-palette-active');document.querySelectorAll('.panel').forEach(p=>p.classList.remove('active'));makePanel().classList.add('active');document.querySelectorAll('.sl-sidebar .sl-tool').forEach(b=>b.classList.toggle('active',b.dataset.page==='palette'));$('previewWrap')?.classList.remove('sl-live-ready');window.dispatchEvent(new CustomEvent('safelight:toolchange',{detail:{page:'palette'}}));setTimeout(()=>{setInspector();ensureMarker();analyze()},0)}

function imageFrom(src){return new Promise((resolve,reject)=>{const im=new Image();im.onload=()=>resolve(im);im.onerror=()=>reject(new Error('Не удалось открыть изображение'));im.src=src})}
async function sourceImage(){
  const preview=$('previewImg'),src=preview?.src||'';
  if(!src)throw new Error('Сначала загрузите изображение');
  if(state.sourceImage&&state.sourceKey===src)return state.sourceImage;
  const token=++state.sourceToken;
  const im=await imageFrom(src);
  if(token!==state.sourceToken||$('previewImg')?.src!==src)return null;
  state.sourceImage=im;state.sourceKey=src;return im;
}

function extract(im,count){
  const max=180,scale=Math.min(1,max/Math.max(im.naturalWidth,im.naturalHeight)),w=Math.max(1,Math.round(im.naturalWidth*scale)),h=Math.max(1,Math.round(im.naturalHeight*scale));
  const canvas=document.createElement('canvas');canvas.width=w;canvas.height=h;const ctx=canvas.getContext('2d',{willReadFrequently:true});ctx.drawImage(im,0,0,w,h);
  const data=ctx.getImageData(0,0,w,h).data,buckets=new Map();
  for(let i=0;i<data.length;i+=4){if(data[i+3]<160)continue;const r=data[i],g=data[i+1],b=data[i+2],key=((r>>3)<<10)|((g>>3)<<5)|(b>>3),cur=buckets.get(key)||[0,0,0,0];cur[0]+=r;cur[1]+=g;cur[2]+=b;cur[3]++;buckets.set(key,cur)}
  const candidates=[...buckets.values()].map(v=>colorObj(v[0]/v[3],v[1]/v[3],v[2]/v[3],v[3])).sort((a,b)=>b.weight-a.weight),out=[];
  for(const threshold of[78,58,40,24,0]){for(const color of candidates){if(out.length>=count)break;if(out.some(c=>c.hex===color.hex))continue;if(threshold===0||out.every(c=>distance(c,color)>=threshold))out.push(color)}if(out.length>=count)break}
  return out.slice(0,count);
}

async function analyze(){
  const preview=$('previewImg');
  if(!preview?.src){state.colors=[];renderColors();return}
  const token=++state.analysisToken;
  try{
    const im=await sourceImage();
    if(!im||token!==state.analysisToken)return;
    const colors=extract(im,Number($('palette-count')?.value)||5);
    if(token!==state.analysisToken||$('previewImg')?.src!==state.sourceKey)return;
    state.colors=colors;renderColors();
  }catch(error){if(token!==state.analysisToken)return;console.error('Safelight palette:',error);state.colors=[];renderColors();status('Не удалось прочитать цвета изображения.')}
}

function renderColors(){
  const list=$('palette-list');if(!list)return;
  if(!state.colors.length){list.innerHTML='<div class="sl-palette-empty">Загрузите изображение, чтобы получить палитру.</div>';return}
  list.innerHTML=state.colors.map(c=>`<button type="button" class="sl-palette-color" data-palette-hex="${c.hex}" title="Скопировать ${c.hex}"><span class="sl-palette-swatch" style="background:${c.hex}"></span><span class="sl-palette-values"><b>${c.hex}</b><small>RGB ${c.r}, ${c.g}, ${c.b} · HSL ${c.hsl.h}°, ${c.hsl.s}%, ${c.hsl.l}%</small></span><span class="sl-palette-copy">копировать</span></button>`).join('');
}

function ensureMarker(){const wrap=$('previewWrap');if(!wrap)return null;let marker=$('sl-palette-marker');if(!marker){marker=document.createElement('i');marker.id='sl-palette-marker';marker.className='sl-palette-marker';wrap.appendChild(marker)}return marker}
function clearPicked(){state.picked=null;const marker=$('sl-palette-marker');marker?.classList.remove('show');if($('palette-picked-hex'))$('palette-picked-hex').textContent='—';if($('palette-picked-meta'))$('palette-picked-meta').textContent='RGB — · HSL —';if($('palette-picked-swatch'))$('palette-picked-swatch').style.background='transparent'}
function renderPicked(){const c=state.picked;if(!c)return;if($('palette-picked-swatch'))$('palette-picked-swatch').style.background=c.hex;if($('palette-picked-hex'))$('palette-picked-hex').textContent=c.hex;if($('palette-picked-meta'))$('palette-picked-meta').textContent=`RGB ${c.r}, ${c.g}, ${c.b} · HSL ${c.hsl.h}°, ${c.hsl.s}%, ${c.hsl.l}%`}

function bindStage(){
  const wrap=$('previewWrap');if(!wrap||wrap.dataset.paletteBound)return;wrap.dataset.paletteBound='1';
  wrap.addEventListener('click',async event=>{
    if(!active())return;const img=$('previewImg'),src=img?.src||'';if(!src)return;const rect=img.getBoundingClientRect();if(event.clientX<rect.left||event.clientX>rect.right||event.clientY<rect.top||event.clientY>rect.bottom)return;
    const clickToken=state.sourceToken;
    try{
      const im=await sourceImage();if(!im||!active()||$('previewImg')?.src!==src||clickToken>state.sourceToken)return;
      const u=clamp((event.clientX-rect.left)/Math.max(1,rect.width),0,1),v=clamp((event.clientY-rect.top)/Math.max(1,rect.height),0,1),sx=Math.min(im.naturalWidth-1,Math.floor(u*im.naturalWidth)),sy=Math.min(im.naturalHeight-1,Math.floor(v*im.naturalHeight));
      const c=document.createElement('canvas');c.width=c.height=1;const ctx=c.getContext('2d',{willReadFrequently:true});ctx.drawImage(im,sx,sy,1,1,0,0,1,1);const d=ctx.getImageData(0,0,1,1).data;state.picked=colorObj(d[0],d[1],d[2],1);renderPicked();
      const wr=wrap.getBoundingClientRect(),m=ensureMarker();m.style.left=(event.clientX-wr.left)+'px';m.style.top=(event.clientY-wr.top)+'px';m.classList.add('show');
    }catch(error){console.error('Safelight palette pipette:',error)}
  });
}

function textBlob(text,type){return new Blob([text],{type:type||'text/plain;charset=utf-8'})}
function download(blob,name){const url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=name;document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),3000)}
function paletteData(){return state.colors.map((c,i)=>({name:'color-'+(i+1),hex:c.hex,rgb:[c.r,c.g,c.b],hsl:[c.hsl.h,c.hsl.s,c.hsl.l]}))}
async function pngPalette(){
  if(!state.colors.length)throw new Error('Сначала загрузите изображение');
  const w=1200,row=104,h=160+state.colors.length*row,canvas=document.createElement('canvas');canvas.width=w;canvas.height=h;const ctx=canvas.getContext('2d');ctx.fillStyle='#09090b';ctx.fillRect(0,0,w,h);ctx.fillStyle='#f4f4f5';ctx.font='700 42px sans-serif';ctx.fillText('Safelight · Палитра изображения',64,70);ctx.fillStyle='#71717a';ctx.font='22px sans-serif';ctx.fillText(baseName(),64,108);
  state.colors.forEach((col,i)=>{const y=146+i*row;ctx.fillStyle=col.hex;ctx.fillRect(64,y,150,72);ctx.strokeStyle='rgba(255,255,255,.15)';ctx.strokeRect(64,y,150,72);ctx.fillStyle='#f4f4f5';ctx.font='700 28px monospace';ctx.fillText(col.hex,244,y+31);ctx.fillStyle='#9a9aa3';ctx.font='20px monospace';ctx.fillText(`RGB ${col.r}, ${col.g}, ${col.b}   HSL ${col.hsl.h}°, ${col.hsl.s}%, ${col.hsl.l}%`,244,y+61)});
  return new Promise((resolve,reject)=>canvas.toBlob(blob=>blob?resolve(blob):reject(new Error('Не удалось создать PNG')),'image/png'));
}
async function exportPalette(kind){
  if(!state.colors.length)throw new Error('Сначала загрузите изображение');const data=paletteData(),name=baseName()+'-palette';
  if(kind==='css')download(textBlob(':root {\n'+data.map((c,i)=>`  --color-${i+1}: ${c.hex};`).join('\n')+'\n}\n','text/css;charset=utf-8'),name+'.css');
  else if(kind==='json')download(textBlob(JSON.stringify(data,null,2),'application/json'),name+'.json');
  else if(kind==='txt')download(textBlob(data.map(c=>`${c.hex}  RGB ${c.rgb.join(', ')}  HSL ${c.hsl[0]}°, ${c.hsl[1]}%, ${c.hsl[2]}%`).join('\n')),name+'.txt');
  else if(kind==='png')download(await pngPalette(),name+'.png');
  status('Палитра экспортирована.');
}

function patchExportMenu(){const menu=document.querySelector('.sl-export-menu');if(!menu||!active())return;menu.innerHTML='<div class="sl-export-menu-title">Экспорт палитры</div><button class="sl-export-option" type="button" data-export="palette-css"><span>CSS variables</span><span>.css</span></button><button class="sl-export-option" type="button" data-export="palette-json"><span>JSON</span><span>.json</span></button><button class="sl-export-option" type="button" data-export="palette-txt"><span>Список цветов</span><span>.txt</span></button><button class="sl-export-option" type="button" data-export="palette-png"><span>Карточка палитры</span><span>PNG</span></button><div class="sl-export-sep"></div><div class="sl-export-menu-note">Цвета вычисляются локально. Клик по цвету копирует HEX.</div>'}

function bindPanel(){
  if(document.body.dataset.palettePanelBound)return;document.body.dataset.palettePanelBound='1';
  document.addEventListener('change',e=>{if(e.target.id==='palette-count'&&active())analyze()},true);
  document.addEventListener('click',e=>{const card=e.target.closest('[data-palette-hex]');if(card&&active()){copy(card.dataset.paletteHex);return}if(e.target.closest('#palette-picked')&&active()&&state.picked)copy(state.picked.hex)},true);
  document.addEventListener('click',e=>{
    if(e.target.closest('#sl-export')&&active()){setTimeout(patchExportMenu,0);return}
    const option=e.target.closest('.sl-export-option[data-export]');if(!option||!active())return;const value=option.dataset.export||'';if(!value.startsWith('palette-'))return;
    e.preventDefault();e.stopPropagation();e.stopImmediatePropagation();option.closest('.sl-export-wrap')?.classList.remove('open');exportPalette(value.slice(8)).catch(error=>{console.error(error);status(error.message||'Не удалось экспортировать палитру')});
  },true);
}

window.addEventListener('safelight:toolchange',event=>{
  if(event.detail?.page!=='palette'){document.body.classList.remove('sl-palette-active');$('sl-palette-marker')?.classList.remove('show');return}
  setTimeout(()=>{setInspector();$('previewWrap')?.classList.remove('sl-live-ready');analyze()},0);
});

const preview=$('previewImg');
if(preview)new MutationObserver(()=>{
  state.sourceToken++;state.analysisToken++;state.sourceImage=null;state.sourceKey='';state.colors=[];clearPicked();renderColors();
  if(active())setTimeout(analyze,0);
}).observe(preview,{attributes:true,attributeFilter:['src']});

function install(){makePanel();const app=document.querySelector('.sl-app');if(!app){setTimeout(install,70);return}const panel=$('panel-palette');if(panel&&panel.parentElement?.id!=='sl-inspector-panels')$('sl-inspector-panels')?.appendChild(panel);makeSidebarButton();bindStage();bindPanel();setInspector()}

window.safelightPalette=Object.freeze({activate:activatePalette,analyze,getColors:()=>state.colors.map(c=>({...c}))});
install();
})();
