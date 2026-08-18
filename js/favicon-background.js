(function(){
  'use strict';
  if(window.safelightFaviconBackgroundLoaded)return;
  window.safelightFaviconBackgroundLoaded=true;
  const $=id=>document.getElementById(id);
  const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
  function rgbHex(r,g,b){return '#'+[r,g,b].map(v=>clamp(Math.round(v),0,255).toString(16).padStart(2,'0')).join('')}
  function dominantColor(image){
    const size=72,canvas=document.createElement('canvas');canvas.width=canvas.height=size;
    const ctx=canvas.getContext('2d',{willReadFrequently:true});
    const scale=Math.min(size/image.naturalWidth,size/image.naturalHeight),w=image.naturalWidth*scale,h=image.naturalHeight*scale;
    ctx.clearRect(0,0,size,size);ctx.drawImage(image,(size-w)/2,(size-h)/2,w,h);
    const data=ctx.getImageData(0,0,size,size).data,buckets=new Map();
    for(let i=0;i<data.length;i+=8){
      if(data[i+3]<120)continue;
      const r=data[i],g=data[i+1],b=data[i+2],key=((r>>4)<<8)|((g>>4)<<4)|(b>>4),cur=buckets.get(key)||[0,0,0,0];
      cur[0]+=r;cur[1]+=g;cur[2]+=b;cur[3]++;buckets.set(key,cur);
    }
    let best=null;
    for(const value of buckets.values())if(!best||value[3]>best[3])best=value;
    return best?rgbHex(best[0]/best[3],best[1]/best[3],best[2]/best[3]):'#ffffff';
  }
  async function imageFromPreview(){
    const preview=$('previewImg');if(!preview?.src)throw new Error('Сначала загрузите изображение');
    return new Promise((resolve,reject)=>{const image=new Image();image.onload=()=>resolve(image);image.onerror=reject;image.src=preview.src});
  }
  function applyColor(hex){
    const mode=$('fav-bg-mode'),color=$('fav-bg-color');if(!mode||!color)return;
    mode.value='color';color.value=hex;
    mode.dispatchEvent(new Event('change',{bubbles:true}));color.dispatchEvent(new Event('input',{bubbles:true}));
  }
  function hint(text){const el=$('sl-export-hint');if(!el)return;el.textContent=text;el.classList.add('show');clearTimeout(hint.t);hint.t=setTimeout(()=>el.classList.remove('show'),2400)}
  function install(){
    const field=document.querySelector('#fav-controls .fav-color-field');
    if(!field){setTimeout(install,60);return}
    if($('fav-bg-presets'))return;
    const row=document.createElement('div');row.id='fav-bg-presets';row.className='fav-bg-presets';
    row.innerHTML='<button type="button" class="btn ghost" data-fav-bg="auto">Авто</button><button type="button" class="btn ghost" data-fav-bg="#ffffff">Белый</button><button type="button" class="btn ghost" data-fav-bg="#000000">Чёрный</button>';
    field.parentElement.insertAdjacentElement('afterend',row);
    row.addEventListener('click',async event=>{
      const button=event.target.closest('[data-fav-bg]');if(!button)return;
      try{
        const value=button.dataset.favBg;
        if(value==='auto'){const image=await imageFromPreview();const hex=dominantColor(image);applyColor(hex);hint('Фон подобран из изображения: '+hex.toUpperCase());}
        else applyColor(value);
      }catch(error){hint(error.message||'Не удалось подобрать фон')}
    });
  }
  install();
})();
