(function(){
  'use strict';
  if(window.safelightWatermarkRendererLoaded)return;
  window.safelightWatermarkRendererLoaded=true;

  const $=id=>document.getElementById(id);
  let sourceCache={src:'',image:null},logoCache={src:'',image:null},bridgeBusy=false;

  function currentTool(){return document.querySelector('#sl-inspector-panels .panel.active')?.id.replace(/^panel-/,'')||''}
  function imageFrom(src){return new Promise((resolve,reject)=>{const image=new Image();image.onload=()=>resolve(image);image.onerror=()=>reject(new Error('Не удалось открыть изображение'));image.src=src})}
  async function cachedImage(cache,src,label){if(!src)throw new Error(label||'Изображение не выбрано');if(cache.src===src&&cache.image?.naturalWidth)return cache.image;const image=await imageFrom(src);cache.src=src;cache.image=image;return image}
  function state(){
    const direct=window.safelightDirectState?.watermark?.();
    if(direct)return direct;
    return{kind:'text',text:($('wm-text')?.value||'Safelight').trim()||'Safelight',opacity:Math.max(1,Math.min(100,Number($('wm-opacity')?.value)||45))/100,rotation:Number($('wm-rotation')?.value)||0,font:'system-ui,Arial,sans-serif',color:$('wm-color')?.value||'#ffffff',outlineColor:$('wm-outline-color')?.value||'#000000',outlineWidth:Number($('wm-outline-width')?.value)||0,size:Number($('wm-size')?.value)||48,logoScale:Number($('wm-logo-scale')?.value)||18,patternX:Number($('wm-pattern-x')?.value)||28,patternY:Number($('wm-pattern-y')?.value)||22,stagger:$('wm-pattern-stagger')?.checked!==false,x:.78,y:.82,fill:false,assetUrl:''}
  }
  function prepareText(ctx,s){ctx.font=`600 ${Math.max(8,s.size||48)}px ${s.font||'system-ui,Arial,sans-serif'}`;ctx.textAlign='center';ctx.textBaseline='middle';ctx.lineJoin='round';ctx.fillStyle=s.color||'#ffffff';ctx.strokeStyle=s.outlineColor||'#000000';ctx.lineWidth=Math.max(0,Number(s.outlineWidth)||0)*2}
  function drawText(ctx,s,x,y){ctx.save();ctx.translate(x,y);ctx.rotate((Number(s.rotation)||0)*Math.PI/180);ctx.globalAlpha=Math.max(.01,Math.min(1,Number(s.opacity)||.45));prepareText(ctx,s);if(ctx.lineWidth>0)ctx.strokeText(s.text||'Safelight',0,0);ctx.fillText(s.text||'Safelight',0,0);ctx.restore()}
  function drawLogo(ctx,s,logo,x,y,width){const height=width*(logo.naturalHeight/Math.max(1,logo.naturalWidth));ctx.save();ctx.translate(x,y);ctx.rotate((Number(s.rotation)||0)*Math.PI/180);ctx.globalAlpha=Math.max(.01,Math.min(1,Number(s.opacity)||.45));ctx.imageSmoothingEnabled=true;ctx.imageSmoothingQuality='high';ctx.drawImage(logo,-width/2,-height/2,width,height);ctx.restore();return{width,height}}
  function patternSteps(out,ctx,s,logo){
    let itemWidth=0,itemHeight=0;
    if(s.kind==='image'){const w=out.width*Math.max(3,Math.min(80,Number(s.logoScale)||18))/100;itemWidth=w;itemHeight=w*(logo.naturalHeight/Math.max(1,logo.naturalWidth))}
    else{prepareText(ctx,s);itemWidth=ctx.measureText(s.text||'Safelight').width;itemHeight=Math.max(8,Number(s.size)||48)}
    return{itemWidth,itemHeight,stepX:Math.max(itemWidth*1.25,out.width*Math.max(8,Math.min(70,Number(s.patternX)||28))/100),stepY:Math.max(itemHeight*2,out.height*Math.max(8,Math.min(70,Number(s.patternY)||22))/100)}
  }
  async function render(){
    const preview=$('previewImg');if(!preview?.src)throw new Error('Сначала загрузите изображение');
    const source=await cachedImage(sourceCache,preview.src,'Сначала загрузите изображение'),s=state();
    let logo=null;if(s.kind==='image')logo=await cachedImage(logoCache,s.assetUrl,'Сначала выберите логотип');
    const out=document.createElement('canvas');out.width=source.naturalWidth;out.height=source.naturalHeight;const ctx=out.getContext('2d');ctx.clearRect(0,0,out.width,out.height);ctx.drawImage(source,0,0);
    if(s.fill){
      const pattern=patternSteps(out,ctx,s,logo);let row=0;
      for(let y=pattern.stepY*.5;y<out.height+pattern.stepY*.5;y+=pattern.stepY,row++){
        const offset=s.stagger&&row%2?pattern.stepX*.5:0;
        for(let x=pattern.stepX*.5-offset;x<out.width+pattern.stepX*.5;x+=pattern.stepX){if(s.kind==='image')drawLogo(ctx,s,logo,x,y,Math.min(pattern.itemWidth,pattern.stepX*.82));else drawText(ctx,s,x,y)}
      }
      return out;
    }
    const x=Math.max(0,Math.min(1,Number(s.x)||.78))*out.width,y=Math.max(0,Math.min(1,Number(s.y)||.82))*out.height;
    if(s.kind==='image')drawLogo(ctx,s,logo,x,y,out.width*Math.max(3,Math.min(80,Number(s.logoScale)||18))/100);else drawText(ctx,s,x,y);
    return out
  }
  function invalidate(){sourceCache={src:'',image:null}}
  function canvasBlob(canvas,type,quality){return new Promise((resolve,reject)=>canvas.toBlob(blob=>blob?resolve(blob):reject(new Error('Не удалось подготовить файл')),type,quality))}
  function baseName(){return(($('meta-name')?.textContent||'safelight').trim().replace(/\.[^.]+$/,'')||'safelight')}
  function download(blob,name){const url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=name;document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),4000)}
  function hint(text){const el=$('sl-export-hint');if(!el)return;el.textContent=text;el.classList.add('show');clearTimeout(hint.timer);hint.timer=setTimeout(()=>el.classList.remove('show'),2800)}
  function primeLive(canvas){let live=$('sl-live-canvas');const wrap=$('previewWrap');if(!live&&wrap){live=document.createElement('canvas');live.id='sl-live-canvas';live.className='sl-live-canvas';wrap.appendChild(live)}if(!live)throw new Error('Предпросмотр результата недоступен');live.width=canvas.width;live.height=canvas.height;const ctx=live.getContext('2d');ctx.clearRect(0,0,live.width,live.height);ctx.drawImage(canvas,0,0);wrap?.classList.add('sl-live-ready');window.dispatchEvent(new CustomEvent('safelight:live-render',{detail:{tool:'watermark',width:canvas.width,height:canvas.height}}))}
  async function exportResult(format){
    let canvas=await render();
    if(format==='jpeg'){const opaque=document.createElement('canvas');opaque.width=canvas.width;opaque.height=canvas.height;const ctx=opaque.getContext('2d');ctx.fillStyle='#fff';ctx.fillRect(0,0,opaque.width,opaque.height);ctx.drawImage(canvas,0,0);canvas=opaque;download(await canvasBlob(canvas,'image/jpeg',.94),baseName()+'-watermark.jpg');return}
    if(format==='webp'){download(await canvasBlob(canvas,'image/webp',.92),baseName()+'-watermark.webp');return}
    if(format==='png'){download(await canvasBlob(canvas,'image/png'),baseName()+'-watermark.png');return}
    if(format==='pdf'){
      if(!window.jspdf?.jsPDF)throw new Error('PDF-модуль не загрузился');const{jsPDF}=window.jspdf,orientation=canvas.width>canvas.height?'landscape':'portrait',doc=new jsPDF({orientation,unit:'mm',format:'a4'}),pageW=doc.internal.pageSize.getWidth(),pageH=doc.internal.pageSize.getHeight(),margin=10,scale=Math.min((pageW-margin*2)/canvas.width,(pageH-margin*2)/canvas.height),w=canvas.width*scale,h=canvas.height*scale;
      doc.addImage(canvas.toDataURL('image/png'),'PNG',(pageW-w)/2,(pageH-h)/2,w,h,undefined,'FAST');download(doc.output('blob'),baseName()+'-watermark.pdf');return
    }
    throw new Error('Неподдерживаемый формат экспорта')
  }
  function installBridge(){
    document.addEventListener('click',event=>{
      if(currentTool()!=='watermark')return;
      if(event.target.closest('#sl-apply')){
        event.preventDefault();event.stopImmediatePropagation();if(bridgeBusy)return;bridgeBusy=true;
        render().then(canvas=>{primeLive(canvas);return window.safelightApplyTools?.apply?.()}).catch(error=>{console.error('Safelight watermark apply:',error);hint(error.message||'Не удалось применить водяной знак')}).finally(()=>bridgeBusy=false);return
      }
      const option=event.target.closest('.sl-export-option[data-export]');if(!option)return;const format=option.dataset.export;if(!['jpeg','webp','png','pdf'].includes(format))return;
      event.preventDefault();event.stopImmediatePropagation();document.querySelector('.sl-export-wrap')?.classList.remove('open');if(bridgeBusy)return;bridgeBusy=true;
      exportResult(format).then(()=>hint('Водяной знак экспортирован.')).catch(error=>{console.error('Safelight watermark export:',error);hint(error.message||'Не удалось экспортировать водяной знак')}).finally(()=>bridgeBusy=false)
    },true)
  }
  const preview=$('previewImg');if(preview)new MutationObserver(invalidate).observe(preview,{attributes:true,attributeFilter:['src']});
  window.safelightWatermarkTools=Object.freeze({render,state,hasLogo:()=>!!state().assetUrl,export:exportResult});installBridge();
})();
