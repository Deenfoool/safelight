(function(){
  'use strict';
  if(window.safelightSliceSelectionLoaded)return;
  window.safelightSliceSelectionLoaded=true;

  const $=id=>document.getElementById(id);
  let selected=null;
  let overlay=null;
  let renderRaf=0;
  let exportBusy=false;

  function currentTool(){
    const panel=document.querySelector('#sl-inspector-panels .panel.active')||document.querySelector('.panel.active');
    return panel?panel.id.replace(/^panel-/,''):'';
  }

  function boundaries(){
    const direct=window.safelightDirectState?.sliceBoundaries?.();
    if(direct?.x?.length>1&&direct?.y?.length>1)return direct;
    let rows=Math.max(1,Math.min(20,Number($('s-rows')?.value)||1));
    let cols=Math.max(1,Math.min(20,Number($('s-cols')?.value)||1));
    if(window.sliceMode==='horizontal')cols=1;
    if(window.sliceMode==='vertical')rows=1;
    return{
      x:Array.from({length:cols+1},(_,i)=>i/cols),
      y:Array.from({length:rows+1},(_,i)=>i/rows)
    };
  }

  function source(){return $('previewImg')}
  function ready(){const image=source();return !!(image?.src&&image.naturalWidth&&image.naturalHeight)}

  function ensureOverlay(){
    const wrap=$('previewWrap');
    if(!wrap)return null;
    if(!overlay||!overlay.isConnected){
      overlay=document.createElement('div');
      overlay.id='sl-slice-select-overlay';
      overlay.className='sl-slice-select-overlay';
      wrap.appendChild(overlay);
    }
    return overlay;
  }

  function imageRect(){
    const image=source(),wrap=$('previewWrap');
    if(!image||!wrap)return null;
    const ir=image.getBoundingClientRect(),wr=wrap.getBoundingClientRect();
    if(!ir.width||!ir.height)return null;
    return{left:ir.left-wr.left,top:ir.top-wr.top,width:ir.width,height:ir.height};
  }

  function normalizedSelection(){
    if(!selected)return null;
    const b=boundaries();
    if(selected.row<0||selected.col<0||selected.row>=b.y.length-1||selected.col>=b.x.length-1)return null;
    return{
      row:selected.row,
      col:selected.col,
      x0:b.x[selected.col],x1:b.x[selected.col+1],
      y0:b.y[selected.row],y1:b.y[selected.row+1]
    };
  }

  function pixelSelection(){
    const image=source(),cell=normalizedSelection();
    if(!image||!cell||!image.naturalWidth||!image.naturalHeight)return null;
    const x0=Math.round(cell.x0*image.naturalWidth),x1=Math.round(cell.x1*image.naturalWidth);
    const y0=Math.round(cell.y0*image.naturalHeight),y1=Math.round(cell.y1*image.naturalHeight);
    return{...cell,x:x0,y:y0,width:Math.max(1,x1-x0),height:Math.max(1,y1-y0)};
  }

  function updatePanel(){
    const cell=pixelSelection();
    const cellEl=$('s-selected-cell'),sizeEl=$('s-selected-size'),hint=$('s-selected-hint'),button=$('s-export-selected');
    if(cell){
      if(cellEl)cellEl.textContent=`Строка ${cell.row+1} · столбец ${cell.col+1}`;
      if(sizeEl)sizeEl.textContent=`${cell.width} × ${cell.height} px`;
      if(hint)hint.textContent='Кликните другую ячейку, чтобы сменить выбор. Двойной клик — быстрый экспорт.';
      if(button){button.disabled=false;button.removeAttribute('aria-disabled')}
    }else{
      if(cellEl)cellEl.textContent='Не выбрано';
      if(sizeEl)sizeEl.textContent='—';
      if(hint)hint.textContent='Нажмите на нужную ячейку прямо на изображении.';
      if(button){button.disabled=true;button.setAttribute('aria-disabled','true')}
    }
  }

  function setSelected(row,col){
    if(selected&&selected.row===row&&selected.col===col)selected=null;
    else selected={row,col};
    render();
    window.dispatchEvent(new CustomEvent('safelight:slice-selection',{detail:{selection:pixelSelection()}}));
  }

  function createCell(row,col,b,rect){
    const button=document.createElement('button');
    button.type='button';
    button.className='sl-slice-cell';
    if(selected?.row===row&&selected?.col===col)button.classList.add('selected');
    button.dataset.row=String(row);button.dataset.col=String(col);
    button.style.left=(b.x[col]*100)+'%';
    button.style.top=(b.y[row]*100)+'%';
    button.style.width=((b.x[col+1]-b.x[col])*100)+'%';
    button.style.height=((b.y[row+1]-b.y[row])*100)+'%';
    button.setAttribute('aria-label',`Выбрать фрагмент: строка ${row+1}, столбец ${col+1}`);
    button.setAttribute('aria-pressed',selected?.row===row&&selected?.col===col?'true':'false');
    const badge=document.createElement('span');badge.className='sl-slice-cell-badge';badge.textContent=`R${row+1} · C${col+1}`;button.appendChild(badge);
    button.addEventListener('click',event=>{event.preventDefault();event.stopPropagation();setSelected(row,col)});
    button.addEventListener('dblclick',event=>{
      event.preventDefault();event.stopPropagation();
      selected={row,col};render();
      exportSelected($('s-selected-format')?.value||'png');
    });
    return button;
  }

  function renderNow(){
    renderRaf=0;
    const host=ensureOverlay();if(!host)return;
    host.innerHTML='';
    const active=currentTool()==='slice'&&ready();
    host.hidden=!active;
    if(!active){updatePanel();return}
    const rect=imageRect();if(!rect)return;
    host.style.left=rect.left+'px';host.style.top=rect.top+'px';host.style.width=rect.width+'px';host.style.height=rect.height+'px';
    const b=boundaries();
    if(selected&&(selected.row>=b.y.length-1||selected.col>=b.x.length-1))selected=null;
    for(let row=0;row<b.y.length-1;row++)for(let col=0;col<b.x.length-1;col++)host.appendChild(createCell(row,col,b,rect));
    updatePanel();
  }

  function render(){
    if(renderRaf)return;
    renderRaf=requestAnimationFrame(renderNow);
  }

  function resetSelection(){selected=null;render();window.dispatchEvent(new CustomEvent('safelight:slice-selection',{detail:{selection:null}}))}

  function installPanel(){
    const panel=$('panel-slice'),card=panel?.querySelector('.panel-card');
    if(!card)return false;
    if($('s-selected-box')){updatePanel();return true}
    const box=document.createElement('div');box.id='s-selected-box';box.className='sl-slice-selected-box';
    box.innerHTML=`
      <div class="sl-slice-selected-head"><span>Выбранный фрагмент</span><small>экспорт одной ячейки</small></div>
      <div class="sl-slice-selected-meta">
        <div><span>Ячейка</span><b id="s-selected-cell">Не выбрано</b></div>
        <div><span>Размер</span><b id="s-selected-size">—</b></div>
      </div>
      <p id="s-selected-hint" class="sl-slice-selected-hint">Нажмите на нужную ячейку прямо на изображении.</p>
      <div class="sl-slice-selected-actions">
        <select id="s-selected-format" aria-label="Формат выбранного фрагмента">
          <option value="png">PNG</option>
          <option value="webp">WebP</option>
          <option value="jpeg">JPEG</option>
        </select>
        <button type="button" class="btn primary" id="s-export-selected" disabled aria-disabled="true">Экспорт фрагмента</button>
      </div>`;
    card.appendChild(box);
    $('s-export-selected')?.addEventListener('click',()=>exportSelected($('s-selected-format')?.value||'png'));
    updatePanel();return true;
  }

  function mime(format){return format==='png'?'image/png':format==='webp'?'image/webp':'image/jpeg'}
  function ext(format){return format==='jpeg'?'jpg':format}
  function baseName(){return(($('meta-name')?.textContent||'safelight').trim().replace(/\.[^.]+$/,'')||'safelight')}
  function quality(){return Math.max(.01,Math.min(1,(Number($('s-quality')?.value)||90)/100))}
  function canvasBlob(canvas,type,q){return new Promise((resolve,reject)=>canvas.toBlob(blob=>blob?resolve(blob):reject(new Error('Не удалось подготовить фрагмент')),type,q))}
  function download(blob,name){const url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=name;document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),4000)}
  function hint(text){const el=$('sl-export-hint');if(!el)return;el.textContent=text;el.classList.add('show');clearTimeout(hint.timer);hint.timer=setTimeout(()=>el.classList.remove('show'),2800)}

  async function exportSelected(format){
    if(exportBusy)return;
    const image=source(),cell=pixelSelection();
    if(!image?.naturalWidth||!cell){hint('Сначала выберите ячейку на изображении.');return}
    exportBusy=true;const button=$('s-export-selected');if(button)button.disabled=true;
    try{
      const tile=document.createElement('canvas');tile.width=cell.width;tile.height=cell.height;
      const ctx=tile.getContext('2d');
      if(format==='jpeg'){ctx.fillStyle='#fff';ctx.fillRect(0,0,tile.width,tile.height)}
      ctx.drawImage(image,cell.x,cell.y,cell.width,cell.height,0,0,tile.width,tile.height);
      const blob=await canvasBlob(tile,mime(format),format==='png'?undefined:quality());
      download(blob,`${baseName()}-r${cell.row+1}-c${cell.col+1}.${ext(format)}`);
      hint(`Фрагмент R${cell.row+1} · C${cell.col+1} экспортирован.`);
    }catch(error){console.error('Safelight selected slice export:',error);hint(error.message||'Не удалось экспортировать фрагмент')}
    finally{exportBusy=false;if(button)button.disabled=!pixelSelection()}
  }

  function bind(){
    const panel=$('panel-slice'),preview=source();
    panel?.addEventListener('input',event=>{if(event.target.matches('#s-rows,#s-cols')){resetSelection();render()}},true);
    panel?.addEventListener('click',event=>{if(event.target.closest('#s-mode button'))setTimeout(()=>{resetSelection();render()},0)},true);
    document.addEventListener('pointermove',()=>{if(document.body.classList.contains('sl-dragging-guide'))render()},{passive:true});
    document.addEventListener('pointerup',()=>{if(currentTool()==='slice')render()},{passive:true});
    window.addEventListener('resize',render,{passive:true});
    window.addEventListener('safelight:zoomchange',render);
    window.addEventListener('safelight:toolchange',event=>{if(event.detail?.page==='slice')setTimeout(()=>{installPanel();render()},0);else render()});
    preview?.addEventListener('load',()=>{resetSelection();setTimeout(render,0)});
  }

  function boot(){
    if(!document.querySelector('.sl-app')||!$('previewWrap')||!$('panel-slice')){setTimeout(boot,50);return}
    installPanel();ensureOverlay();bind();render();
  }

  window.safelightSliceSelection=Object.freeze({
    get:()=>pixelSelection(),
    clear:resetSelection,
    export:exportSelected
  });
  boot();
})();
