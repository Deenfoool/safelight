(function(){
  "use strict";

  const navLinks = document.querySelectorAll(".top-nav-link");
  const toolPanels = {
    compress: document.getElementById("panel-compress"),
    slice: document.getElementById("panel-slice"),
    convert: document.getElementById("panel-convert")
  };
  const internalTabs = document.querySelectorAll(".tab-btn");
  const title = document.querySelector("#workspace .page-title h1");
  const description = document.querySelector("#workspace .page-title p");

  const toolInfo = {
    compress: {title:"Сжатие изображений",description:"Уменьшайте размер PNG, JPEG и WebP с контролем качества. Обработка происходит полностью в браузере."},
    slice: {title:"Нарезка изображений",description:"Разделяйте изображение на сетку, горизонтальные полосы или вертикальные полосы и скачивайте результат ZIP-архивом."},
    convert: {title:"Конвертация изображений",description:"Пересохраняйте изображения между PNG, JPEG и WebP прямо в браузере, без загрузки исходного файла на сервер."}
  };

  function activateTool(tool){
    Object.entries(toolPanels).forEach(([name,panel])=>{if(panel) panel.classList.toggle("active",name===tool)});
    internalTabs.forEach(btn=>btn.classList.toggle("active",btn.dataset.tab===tool));
    if(title) title.textContent=toolInfo[tool].title;
    if(description) description.textContent=toolInfo[tool].description;
    const grid=document.getElementById("gridOverlay");
    if(grid) grid.style.display=tool==="slice"?"block":"none";
  }

  function setPage(page,tool){
    document.body.classList.toggle("page-home",page==="home");
    document.body.classList.toggle("page-tool",page==="tool");
    navLinks.forEach(link=>link.classList.toggle("active",link.dataset.page===(page==="home"?"home":tool)));
    if(page==="tool") activateTool(tool||"compress");
    window.scrollTo({top:0,behavior:"smooth"});
  }

  navLinks.forEach(link=>link.addEventListener("click",()=>{
    const page=link.dataset.page;
    setPage(page==="home"?"home":"tool",page==="home"?null:page);
  }));

  const heroCta=document.getElementById("hero-cta");
  if(heroCta) heroCta.addEventListener("click",()=>setPage("tool","compress"));

  setPage("home");
})();
