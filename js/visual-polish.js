(function(){
  'use strict';
  if(window.safelightVisualPolishLoaded)return;
  window.safelightVisualPolishLoaded=true;

  function installHomeLinks(){
    const row=document.querySelector('.hero .cta-row');
    if(!row||row.querySelector('.home-external-link'))return;
    const links=[
      {
        href:'https://github.com/Deenfoool/safelight',
        label:'GitHub',
        path:'M9 18c-4 1.5-4-2-5-2m10 4v-3.5c0-1 .1-1.4-.5-2 2.8-.3 5.7-1.4 5.7-6A4.7 4.7 0 0 0 19 5.2 4.4 4.4 0 0 0 18.7 2S17.6 1.7 15 3.2a11 11 0 0 0-6 0C6.4 1.7 5.3 2 5.3 2A4.4 4.4 0 0 0 5 5.2 4.7 4.7 0 0 0 3.8 8.5c0 4.6 2.9 5.7 5.7 6-.4.5-.5 1-.5 2V20'
      },
      {
        href:'https://deenfoool.github.io/portfolio/',
        label:'Портфолио',
        path:'M8 7V5a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M4 7h16v12H4zM4 12h16M10 12v2h4v-2'
      }
    ];
    links.forEach(item=>{
      const a=document.createElement('a');
      a.className='btn ghost home-external-link';
      a.href=item.href;
      a.target='_blank';
      a.rel='noopener noreferrer';
      a.innerHTML='<span>'+item.label+'</span><svg viewBox="0 0 24 24" aria-hidden="true"><path d="'+item.path+'"/></svg>';
      row.appendChild(a);
    });
  }

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

  installHomeLinks();
  buildAmbient();
})();