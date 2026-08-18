(function(){
  'use strict';
  if(window.safelightEditorPolishLoaded)return;
  window.safelightEditorPolishLoaded=true;

  const FAVICON_PREVIEW_SIZES=[16,32,180];

  function applyBranding(app){
    app.querySelector('.sl-topbar .sl-add')?.remove();

    const brand=app.querySelector('.sl-brand');
    if(brand&&!brand.dataset.assetBrand){
      brand.dataset.assetBrand='1';
      brand.innerHTML='<img class="sl-brand-logo" src="assets/images/logo.png" alt=""><span>Safelight</span>';
    }

    const exportButton=app.querySelector('#sl-export');
    if(exportButton){
      const old=exportButton.querySelector('svg');
      const svg=document.createElementNS('http://www.w3.org/2000/svg','svg');
      svg.setAttribute('viewBox','0 0 24 24');
      svg.setAttribute('aria-hidden','true');
      svg.innerHTML='<path d="M12 4v10M8.5 7.5 12 4l3.5 3.5M5 13.5V19h14v-5.5"/>';
      if(old)old.replaceWith(svg);else exportButton.prepend(svg);
    }
  }

  function installEditorGrid(app){
    if(app.querySelector('#sl-editor-grid'))return;
    const canvas=document.createElement('canvas');
    canvas.id='sl-editor-grid';
    canvas.setAttribute('aria-hidden','true');
    app.prepend(canvas);
    const ctx=canvas.getContext('2d');
    if(!ctx)return;

    const spacing=72;
    let width=0,height=0,dpr=1,raf=0;

    function resize(){
      const rect=app.getBoundingClientRect();
      width=Math.max(window.innerWidth,Math.round(rect.width)||0);
      height=Math.max(window.innerHeight,Math.round(rect.height)||0);
      dpr=Math.min(window.devicePixelRatio||1,2);
      canvas.width=Math.max(1,Math.floor(width*dpr));
      canvas.height=Math.max(1,Math.floor(height*dpr));
      canvas.style.width=width+'px';canvas.style.height=height+'px';
      ctx.setTransform(dpr,0,0,dpr,0,0);
    }

    function point(col,row,t){
      const x=col*spacing,y=row*spacing;
      const wave1=Math.sin(x*.010+t*.00075+Math.sin(y*.006))*15;
      const wave2=Math.cos(y*.012-t*.00055+Math.cos(x*.005))*12;
      const ripple=Math.sin((x+y)*.004-t*.0009)*8;
      return{x:x+wave1+ripple,y:y+wave2+ripple*.45};
    }

    function draw(t){
      ctx.clearRect(0,0,width,height);
      if(document.body.classList.contains('page-tool')){
        const cols=Math.ceil(width/spacing)+3,rows=Math.ceil(height/spacing)+3;
        ctx.lineWidth=1;
        for(let row=-1;row<rows;row++){
          ctx.beginPath();
          for(let col=-1;col<cols;col++){
            const p=point(col,row,t);
            if(col===-1)ctx.moveTo(p.x,p.y);else ctx.lineTo(p.x,p.y);
          }
          ctx.strokeStyle='rgba(163,230,53,0.14)';ctx.stroke();
        }
        for(let col=-1;col<cols;col++){
          ctx.beginPath();
          for(let row=-1;row<rows;row++){
            const p=point(col,row,t);
            if(row===-1)ctx.moveTo(p.x,p.y);else ctx.lineTo(p.x,p.y);
          }
          ctx.strokeStyle='rgba(163,230,53,0.14)';ctx.stroke();
        }
        [[width*.18,height*.24],[width*.72,height*.38],[width*.47,height*.78]].forEach(([sx,sy],i)=>{
          const pulse=(Math.sin(t*.0011+i*2.2)+1)*.5;
          const radius=110+pulse*95;
          const glow=ctx.createRadialGradient(sx,sy,0,sx,sy,radius);
          glow.addColorStop(0,'rgba(163,230,53,0.060)');
          glow.addColorStop(1,'rgba(163,230,53,0)');
          ctx.fillStyle=glow;ctx.fillRect(sx-radius,sy-radius,radius*2,radius*2);
        });
      }
      raf=requestAnimationFrame(draw);
    }

    resize();
    const ro=new ResizeObserver(resize);ro.observe(app);
    window.addEventListener('resize',resize,{passive:true});
    window.addEventListener('safelight:toolchange',()=>setTimeout(resize,0));
    raf=requestAnimationFrame(draw);
    window.addEventListener('beforeunload',()=>{cancelAnimationFrame(raf);ro.disconnect()},{once:true});
  }

  function installFaviconPreviewStyles(){
    if(document.getElementById('sl-favicon-preview-styles'))return;
    const style=document.createElement('style');
    style.id='sl-favicon-preview-styles';
    style.textContent=`
      .sl-favicon-preview{display:none;width:min(900px,calc(100% - 36px));grid-template-columns:repeat(3,minmax(0,1fr));gap:18px;align-items:stretch}
      .sl-app .preview-wrap.sl-favicon-preview-ready>#previewImg,.sl-app .preview-wrap.sl-favicon-preview-ready>#sl-live-canvas{display:none!important}
      .sl-app .preview-wrap.sl-favicon-preview-ready>.sl-favicon-preview{display:grid}
      .sl-favicon-card{min-width:0;min-height:250px;padding:14px 14px 18px;border:1px solid rgba(255,255,255,.10);border-radius:12px;background:linear-gradient(180deg,rgba(20,20,24,.90),rgba(12,12,15,.82));box-shadow:0 18px 45px rgba(0,0,0,.22);display:flex;flex-direction:column}
      .sl-favicon-size{color:#d4d4d8;font:700 11px/1 var(--mono);letter-spacing:.04em;text-align:left}
      .sl-favicon-surface{flex:1;min-height:190px;margin-top:12px;border:1px solid rgba(255,255,255,.07);border-radius:9px;background:linear-gradient(45deg,#151518 25%,transparent 25%,transparent 75%,#151518 75%),linear-gradient(45deg,#151518 25%,#0f0f12 25%,#0f0f12 75%,#151518 75%);background-position:0 0,8px 8px;background-size:16px 16px;display:grid;place-items:center;overflow:hidden}
      .sl-favicon-surface canvas{display:block;background:#fff;box-shadow:0 12px 34px rgba(0,0,0,.34);max-width:none!important;max-height:none!important;border-radius:2px}
      .sl-favicon-card[data-size="16"] canvas{width:112px;height:112px;image-rendering:pixelated}
      .sl-favicon-card[data-size="32"] canvas{width:144px;height:144px;image-rendering:pixelated}
      .sl-favicon-card[data-size="180"] canvas{width:180px;height:180px}
      @media(max-width:900px){.sl-favicon-preview{width:min(640px,calc(100% - 28px));grid-template-columns:1fr}.sl-favicon-card{min-height:220px}.sl-favicon-surface{min-height:160px}.sl-favicon-card[data-size="16"] canvas{width:96px;height:96px}.sl-favicon-card[data-size="32"] canvas{width:128px;height:128px}.sl-favicon-card[data-size="180"] canvas{width:160px;height:160px}}
    `;
    document.head.appendChild(style);
  }

  function faviconActive(){
    return !!document.querySelector('#panel-favicon.active');
  }

  function ensureFaviconPreview(){
    const wrap=document.getElementById('previewWrap');
    if(!wrap)return null;
    let gallery=document.getElementById('sl-favicon-preview');
    if(gallery)return gallery;
    gallery=document.createElement('div');
    gallery.id='sl-favicon-preview';
    gallery.className='sl-favicon-preview';
    gallery.setAttribute('aria-label','Предпросмотр размеров favicon');
    gallery.innerHTML=FAVICON_PREVIEW_SIZES.map(size=>`<div class="sl-favicon-card" data-size="${size}"><div class="sl-favicon-size">${size} × ${size}</div><div class="sl-favicon-surface"><canvas width="${size}" height="${size}" aria-label="Favicon ${size} на ${size}"></canvas></div></div>`).join('');
    wrap.appendChild(gallery);
    return gallery;
  }

  function drawFaviconPreview(canvas,size,image){
    canvas.width=size;
    canvas.height=size;
    const ctx=canvas.getContext('2d');
    if(!ctx)return;
    ctx.clearRect(0,0,size,size);
    ctx.fillStyle='#fff';
    ctx.fillRect(0,0,size,size);
    ctx.imageSmoothingEnabled=true;
    ctx.imageSmoothingQuality='high';
    const scale=Math.min(size/image.naturalWidth,size/image.naturalHeight);
    const width=image.naturalWidth*scale;
    const height=image.naturalHeight*scale;
    ctx.drawImage(image,(size-width)/2,(size-height)/2,width,height);
  }

  function renderFaviconPreviews(){
    const wrap=document.getElementById('previewWrap');
    if(!wrap)return;
    if(!faviconActive()){
      wrap.classList.remove('sl-favicon-preview-ready');
      return;
    }
    const image=document.getElementById('previewImg');
    if(!image?.src)return;

    const draw=()=>{
      if(!faviconActive()||!image.naturalWidth||!image.naturalHeight)return;
      const gallery=ensureFaviconPreview();
      if(!gallery)return;
      FAVICON_PREVIEW_SIZES.forEach(size=>{
        const canvas=gallery.querySelector(`.sl-favicon-card[data-size="${size}"] canvas`);
        if(canvas)drawFaviconPreview(canvas,size,image);
      });
      wrap.classList.add('sl-favicon-preview-ready');
      const dims=document.getElementById('ro-dims');
      const format=document.getElementById('ro-format');
      if(dims)dims.textContent='16 × 16 · 32 × 32 · 180 × 180 px';
      if(format)format.textContent='ICON';
    };

    if(image.complete&&image.naturalWidth)draw();
    else image.addEventListener('load',draw,{once:true});
  }

  function installFaviconPreview(){
    installFaviconPreviewStyles();
    ensureFaviconPreview();
    const wrap=document.getElementById('previewWrap');
    const image=document.getElementById('previewImg');

    window.addEventListener('safelight:toolchange',()=>setTimeout(renderFaviconPreviews,0));
    window.addEventListener('safelight:live-render',event=>{
      if(event.detail?.tool==='favicon')requestAnimationFrame(renderFaviconPreviews);
      else wrap?.classList.remove('sl-favicon-preview-ready');
    });

    if(image){
      new MutationObserver(()=>setTimeout(renderFaviconPreviews,0)).observe(image,{attributes:true,attributeFilter:['src']});
    }
    renderFaviconPreviews();
  }

  function boot(){
    const app=document.querySelector('.sl-app');
    if(!app){setTimeout(boot,40);return;}
    applyBranding(app);
    installEditorGrid(app);
    installFaviconPreview();
  }

  boot();
})();