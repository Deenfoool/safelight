(function(){
  'use strict';
  if(window.safelightWatermarkRendererLoaded)return;
  window.safelightWatermarkRendererLoaded=true;

  const $=id=>document.getElementById(id);
  let sourceCache={src:'',image:null};
  let logoCache={src:'',image:null};

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
        for(let x=pattern.stepX*.5-offset;x<out.width+pattern.stepX*.5;x+=pattern.stepX){
          if(s.kind==='image')drawLogo(ctx,s,logo,x,y,Math.min(pattern.itemWidth,pattern.stepX*.82));else drawText(ctx,s,x,y);
        }
      }
      return out;
    }
    const x=Math.max(0,Math.min(1,Number(s.x)||.78))*out.width,y=Math.max(0,Math.min(1,Number(s.y)||.82))*out.height;
    if(s.kind==='image')drawLogo(ctx,s,logo,x,y,out.width*Math.max(3,Math.min(80,Number(s.logoScale)||18))/100);else drawText(ctx,s,x,y);
    return out
  }
  function invalidate(){sourceCache={src:'',image:null}}
  const preview=$('previewImg');if(preview)new MutationObserver(invalidate).observe(preview,{attributes:true,attributeFilter:['src']});
  window.safelightWatermarkTools=Object.freeze({render,state,hasLogo:()=>!!state().assetUrl});
})();
