(function(){
  'use strict';
  if(window.safelightVisualPolishLoaded)return;
  window.safelightVisualPolishLoaded=true;

  function buildAmbient(){
    if(!document.getElementById('sl-grid-bg')){
      const canvas=document.createElement('canvas');
      canvas.id='sl-grid-bg';
      canvas.setAttribute('aria-hidden','true');
      document.body.insertBefore(canvas,document.body.firstChild);
    }
    if(!document.querySelector('.sl-noise')){
      const noise=document.createElement('div');
      noise.className='sl-noise';
      noise.setAttribute('aria-hidden','true');
      document.body.appendChild(noise);
    }

    const canvas=document.getElementById('sl-grid-bg');
    if(!canvas||window.matchMedia('(prefers-reduced-motion: reduce)').matches)return;
    const ctx=canvas.getContext('2d');
    if(!ctx)return;
    const spacing=72;
    let width=0,height=0,dpr=1,raf=0;

    function resize(){
      dpr=Math.min(window.devicePixelRatio||1,2);
      width=window.innerWidth;height=window.innerHeight;
      canvas.width=Math.floor(width*dpr);canvas.height=Math.floor(height*dpr);
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
      const cols=Math.ceil(width/spacing)+3,rows=Math.ceil(height/spacing)+3;
      ctx.lineWidth=1;
      for(let row=-1;row<rows;row++){
        ctx.beginPath();
        for(let col=-1;col<cols;col++){
          const p=point(col,row,t);if(col===-1)ctx.moveTo(p.x,p.y);else ctx.lineTo(p.x,p.y);
        }
        ctx.strokeStyle='rgba(163,230,53,0.095)';ctx.stroke();
      }
      for(let col=-1;col<cols;col++){
        ctx.beginPath();
        for(let row=-1;row<rows;row++){
          const p=point(col,row,t);if(row===-1)ctx.moveTo(p.x,p.y);else ctx.lineTo(p.x,p.y);
        }
        ctx.strokeStyle='rgba(163,230,53,0.095)';ctx.stroke();
      }
      [[width*.18,height*.24],[width*.72,height*.38],[width*.47,height*.78]].forEach(([sx,sy],i)=>{
        const pulse=(Math.sin(t*.0011+i*2.2)+1)*.5;
        const radius=90+pulse*80;
        const glow=ctx.createRadialGradient(sx,sy,0,sx,sy,radius);
        glow.addColorStop(0,'rgba(163,230,53,0.045)');
        glow.addColorStop(1,'rgba(163,230,53,0)');
        ctx.fillStyle=glow;ctx.fillRect(sx-radius,sy-radius,radius*2,radius*2);
      });
      raf=requestAnimationFrame(draw);
    }
    resize();
    window.addEventListener('resize',resize,{passive:true});
    raf=requestAnimationFrame(draw);
    window.addEventListener('beforeunload',()=>cancelAnimationFrame(raf),{once:true});
  }

  function replaceTerminal(){
    const old=document.querySelector('#hero .terminal');
    if(!old||document.querySelector('.home-local-card'))return;
    const card=document.createElement('div');
    card.className='home-local-card';
    card.innerHTML=`
      <div class="hlc-top">
        <div class="hlc-mark"><svg viewBox="0 0 24 24"><path d="M12 3 19 6v5c0 4.2-2.5 7.5-7 9.3C7.5 18.5 5 15.2 5 11V6zM9 12l2 2 4-5"/></svg></div>
        <strong>Локальная обработка</strong>
        <span>всё происходит в браузере</span>
        <span class="hlc-badge">0 uploads</span>
      </div>
      <div class="hlc-flow">
        <div class="hlc-node">
          <div class="hlc-label">ИСХОДНИК</div>
          <strong id="t-name">image</strong>
          <span id="t-size">—</span>
        </div>
        <div class="hlc-center">
          <div class="hlc-shield">
            <svg viewBox="0 0 24 24"><path d="M12 3 19 6v5c0 4.2-2.5 7.5-7 9.3C7.5 18.5 5 15.2 5 11V6zM9 12l2 2 4-5"/></svg>
            <b>LOCAL</b>
          </div>
        </div>
        <div class="hlc-node">
          <div class="hlc-label">РЕЗУЛЬТАТ</div>
          <strong id="t-status">ожидаю загрузку файла_</strong>
          <span id="t-dims">—</span>
        </div>
      </div>
      <div class="hlc-tools">
        <span class="hlc-active">Compress</span><span>Convert</span><span>Resize</span><span>Crop</span><span>PDF</span><span>ZIP</span>
        <span class="hlc-filecopy">active: <b id="t-name2">image</b></span>
      </div>
      <div class="hlc-footer"><i></i><span><b>Файл не покидает устройство.</b> Safelight обрабатывает данные локально и отдаёт результат только вам.</span></div>`;
    old.replaceWith(card);
  }

  buildAmbient();
  replaceTerminal();
})();
