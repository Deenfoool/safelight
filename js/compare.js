(function(){
'use strict';

const wrap=document.getElementById('previewWrap');
const source=document.getElementById('previewImg');
if(!wrap||!source)return;

const style=document.createElement('style');
style.textContent=`
.compare-preview{position:absolute;inset:0;pointer-events:none;overflow:hidden;border-radius:2px;display:none}
.compare-preview.show{display:block}
.compare-preview .compare-after{position:absolute;inset:0;width:100%;height:100%;display:block;object-fit:contain;object-position:center;filter:none}
.compare-preview .compare-clip{position:absolute;inset:0;overflow:hidden;width:50%;height:100%;border-right:2px solid var(--accent);box-shadow:4px 0 18px rgba(0,0,0,.22)}
.compare-preview .compare-after-clipped{position:absolute;inset:0;width:100%;height:100%;object-fit:contain;object-position:center;display:block}
.compare-preview .compare-label{position:absolute;top:12px;padding:5px 9px;border:1px solid rgba(255,255,255,.1);background:rgba(9,9,11,.78);backdrop-filter:blur(7px);border-radius:5px;color:#fff;font:600 10px var(--mono);letter-spacing:.08em;text-transform:uppercase;z-index:3}
.compare-preview .compare-label.before{left:12px}.compare-preview .compare-label.after{right:12px}
.compare-preview .compare-handle{position:absolute;top:50%;left:50%;width:34px;height:34px;transform:translate(-50%,-50%);border:2px solid var(--accent);background:var(--bg);border-radius:50%;display:flex;align-items:center;justify-content:center;z-index:4;box-shadow:0 0 0 5px rgba(9,9,11,.28),0 4px 18px rgba(0,0,0,.45)}
.compare-preview .compare-handle:before,.compare-preview .compare-handle:after{content:'';width:7px;height:7px;border-top:2px solid var(--accent);border-right:2px solid var(--accent);position:absolute}.compare-preview .compare-handle:before{transform:rotate(-135deg);left:7px}.compare-preview .compare-handle:after{transform:rotate(45deg);right:7px}
.compare-preview .compare-range{position:absolute;left:0;right:0;bottom:10px;width:100%;height:28px;z-index:5;opacity:0;cursor:ew-resize;pointer-events:auto}
.compare-preview .compare-bar{position:absolute;left:14px;right:14px;bottom:23px;height:3px;border-radius:3px;background:rgba(255,255,255,.2);z-index:2;pointer-events:none}.compare-preview .compare-bar-fill{height:100%;width:50%;background:var(--accent);border-radius:3px}
.compare-preview .compare-hint{position:absolute;left:50%;bottom:32px;transform:translateX(-50%);font:500 9px var(--mono);color:rgba(255,255,255,.72);background:rgba(9,9,11,.7);padding:4px 7px;border-radius:4px;z-index:4;white-space:nowrap}
@media(max-width:640px){.compare-preview .compare-label{top:8px;padding:4px 7px;font-size:8px}.compare-preview .compare-handle{width:30px;height:30px}.compare-preview .compare-hint{display:none}}
`;
document.head.appendChild(style);

const compare=document.createElement('div');
compare.className='compare-preview';
compare.innerHTML=`
  <img class="compare-after" alt="После обработки">
  <div class="compare-clip"><img class="compare-after-clipped" alt="После обработки"></div>
  <span class="compare-label before">До</span><span class="compare-label after">После</span>
  <div class="compare-bar"><div class="compare-bar-fill"></div></div>
  <div class="compare-handle" aria-hidden="true"></div>
  <div class="compare-hint">перетащите ползунок</div>
  <input class="compare-range" type="range" min="0" max="100" value="50" aria-label="Сравнение до и после">
`;
wrap.appendChild(compare);
const after=compare.querySelector('.compare-after');
const clipped=compare.querySelector('.compare-after-clipped');
const clip=compare.querySelector('.compare-clip');
const range=compare.querySelector('.compare-range');
const handle=compare.querySelector('.compare-handle');
const fill=compare.querySelector('.compare-bar-fill');
let activeUrl=null,buildToken=0;

function setPosition(v){
  const n=Math.max(0,Math.min(100,Number(v)||0));
  clip.style.width=n+'%';
  handle.style.left=n+'%';
  fill.style.width=n+'%';
}
range.addEventListener('input',()=>setPosition(range.value));
setPosition(50);

function makeCanvasImage(){
  return new Promise((resolve,reject)=>{
    const im=new Image();
    im.onload=()=>resolve(im);
    im.onerror=reject;
    im.src=source.currentSrc||source.src;
  });
}
function blobUrl(blob){
  if(activeUrl)URL.revokeObjectURL(activeUrl);
  activeUrl=URL.createObjectURL(blob);
  return activeUrl;
}
function canvasBlob(canvas,mime,quality){
  return new Promise((resolve,reject)=>canvas.toBlob(b=>b?resolve(b):reject(new Error('Не удалось создать предпросмотр')),mime,quality));
}
function mimeFor(fmt){return fmt==='png'?'image/png':fmt==='webp'?'image/webp':'image/jpeg'}
function qualityFor(fmt,id){return fmt==='png'?undefined:Number(document.getElementById(id)?.value||92)/100}

async function buildAfter(){
  const panel=document.querySelector('.panel.active');
  if(!panel||!source.src||!source.complete)return null;
  const im=await makeCanvasImage();
  const canvas=document.createElement('canvas'),ctx=canvas.getContext('2d');
  const id=panel.id;

  if(id==='panel-resize'){
    const w=Math.max(1,Number(document.getElementById('r-width')?.value)||im.naturalWidth);
    const h=Math.max(1,Number(document.getElementById('r-height')?.value)||im.naturalHeight);
    canvas.width=w;canvas.height=h;ctx.imageSmoothingEnabled=true;ctx.imageSmoothingQuality='high';ctx.drawImage(im,0,0,w,h);
    return canvasBlob(canvas,'image/png');
  }
  if(id==='panel-crop'){
    const w=Math.min(im.naturalWidth,Math.max(1,Number(document.getElementById('cr-width')?.value)||im.naturalWidth));
    const h=Math.min(im.naturalHeight,Math.max(1,Number(document.getElementById('cr-height')?.value)||im.naturalHeight));
    let x=Math.floor((im.naturalWidth-w)/2),y=Math.floor((im.naturalHeight-h)/2);
    const pos=document.getElementById('cr-position')?.value;if(pos==='top')y=0;if(pos==='bottom')y=im.naturalHeight-h;
    canvas.width=w;canvas.height=h;ctx.drawImage(im,x,y,w,h,0,0,w,h);return canvasBlob(canvas,'image/png');
  }
  if(id==='panel-adjust'){
    const b=Number(document.getElementById('a-bright')?.value||0),c=Number(document.getElementById('a-contrast')?.value||0),s=Number(document.getElementById('a-sat')?.value||0),gray=document.getElementById('a-gray')?.checked;
    canvas.width=im.naturalWidth;canvas.height=im.naturalHeight;ctx.filter=`brightness(${100+b}%) contrast(${100+c}%) saturate(${100+s}%)`;ctx.drawImage(im,0,0);ctx.filter='none';
    if(gray){const data=ctx.getImageData(0,0,canvas.width,canvas.height);for(let i=0;i<data.data.length;i+=4){const v=Math.round(.299*data.data[i]+.587*data.data[i+1]+.114*data.data[i+2]);data.data[i]=data.data[i+1]=data.data[i+2]=v}ctx.putImageData(data,0,0)}
    return canvasBlob(canvas,mimeFor(document.getElementById('a-format')?.value||'jpeg'),.92);
  }
  if(id==='panel-compress'){
    canvas.width=im.naturalWidth;canvas.height=im.naturalHeight;ctx.drawImage(im,0,0);
    const fmt=document.getElementById('c-format')?.value||'webp';return canvasBlob(canvas,mimeFor(fmt),qualityFor(fmt,'c-quality'));
  }
  if(id==='panel-convert'){
    canvas.width=im.naturalWidth;canvas.height=im.naturalHeight;ctx.drawImage(im,0,0);
    const fmt=document.getElementById('v-format')?.value||'jpeg';return canvasBlob(canvas,mimeFor(fmt),qualityFor(fmt,'v-quality'));
  }
  return null;
}

async function showCompare(){
  const token=++buildToken;
  try{
    const blob=await buildAfter();
    if(token!==buildToken||!blob)return;
    const url=blobUrl(blob);
    after.src=url;clipped.src=url;
    compare.classList.add('show');
    requestAnimationFrame(()=>setPosition(range.value));
  }catch(e){console.warn('Safelight compare preview:',e)}
}
function hideCompare(){buildToken++;compare.classList.remove('show');if(activeUrl){URL.revokeObjectURL(activeUrl);activeUrl=null}after.removeAttribute('src');clipped.removeAttribute('src')}

const observer=new MutationObserver(mutations=>{
  for(const m of mutations){
    if(m.type==='attributes'&&m.attributeName==='class'&&m.target.classList.contains('result')){
      if(m.target.classList.contains('show'))setTimeout(showCompare,40);else hideCompare();
    }
  }
});
document.querySelectorAll('.result').forEach(el=>observer.observe(el,{attributes:true}));

const originalSrcObserver=new MutationObserver(()=>hideCompare());
originalSrcObserver.observe(source,{attributes:true,attributeFilter:['src']});

document.querySelectorAll('.panel').forEach(panel=>panel.addEventListener('click',e=>{if(e.target.closest('.btn.primary'))setTimeout(showCompare,80)}));
document.addEventListener('click',e=>{if(e.target.matches('.nav-dropdown-item,.top-nav-link'))setTimeout(()=>{if(!document.querySelector('.result.show'))hideCompare()},50)});
window.addEventListener('resize',()=>{if(compare.classList.contains('show'))setPosition(range.value)});
})();
