(function(){
  'use strict';
  if(window.safelightEditorPolishLoaded)return;
  window.safelightEditorPolishLoaded=true;

  function installFavicons(){
    const defs=[
      ['icon','16x16','assets/images/favicon-16.png'],
      ['icon','32x32','assets/images/favicon-32.png'],
      ['icon','48x48','assets/images/favicon-48.png'],
      ['apple-touch-icon','180x180','assets/images/favicon-180.png']
    ];
    document.querySelectorAll('link[data-safelight-icon]').forEach(el=>el.remove());
    defs.forEach(([rel,sizes,href])=>{
      const link=document.createElement('link');
      link.rel=rel;link.sizes=sizes;link.href=href;link.dataset.safelightIcon='1';
      document.head.appendChild(link);
    });
  }

  function applyBranding(app){
    const homeLogo=document.querySelector('body>nav .logo');
    if(homeLogo&&!homeLogo.classList.contains('sl-image-logo')){
      homeLogo.classList.add('sl-image-logo');
      homeLogo.innerHTML='<img src="assets/images/logo-and-text.png" alt="Safelight">';
    }

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
    window.addEventListener('beforeunload',()=>{cancelAnimationFrame(raf);ro.disconnect();},{once:true});
  }

  function loadStyle(src){
    if([...document.styleSheets].some(sheet=>sheet.href&&sheet.href.includes(src.split('?')[0])))return;
    const link=document.createElement('link');link.rel='stylesheet';link.href=src;document.head.appendChild(link);
  }
  function loadScript(src){
    if([...document.scripts].some(script=>script.src&&script.src.includes(src.split('?')[0])))return;
    const script=document.createElement('script');script.src=src;script.onerror=()=>console.error('Safelight: failed to load',src);document.body.appendChild(script);
  }
  function loadAddons(){
    loadStyle('css/privacy-effects.css?v=2');
    loadStyle('css/pwa.css?v=1');
    loadScript('js/privacy-effects.js?v=2');
    loadScript('js/pwa.js?v=1');
  }

  function boot(){
    installFavicons();
    const app=document.querySelector('.sl-app');
    if(!app){setTimeout(boot,40);return;}
    applyBranding(app);
    installEditorGrid(app);
    loadAddons();
  }

  boot();
})();
