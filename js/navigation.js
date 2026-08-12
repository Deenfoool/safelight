(function(){
"use strict";
const navLinks=document.querySelectorAll(".top-nav-link");
const panels={compress:document.getElementById("panel-compress"),slice:document.getElementById("panel-slice"),convert:document.getElementById("panel-convert"),resize:document.getElementById("panel-resize"),crop:document.getElementById("panel-crop"),adjust:document.getElementById("panel-adjust")};
const title=document.querySelector("#workspace .page-title h1"),description=document.querySelector("#workspace .page-title p");
const info={compress:["Сжатие изображений","Уменьшайте вес PNG, JPEG и WebP с контролем качества."],slice:["Нарезка изображений","Разделяйте изображение на сетку или полосы и скачивайте ZIP-архив."],convert:["Конвертация изображений","Пересохраняйте изображения между PNG, JPEG и WebP."],resize:["Изменение размера","Меняйте разрешение изображения с сохранением пропорций или свободно."],crop:["Обрезка изображений","Получайте фрагмент нужного размера из исходного изображения."],adjust:["Коррекция изображения","Настраивайте яркость, контраст, насыщенность и чёрно-белый режим."]};
function setTool(tool){Object.entries(panels).forEach(([name,panel])=>{if(panel)panel.classList.toggle("active",name===tool)});if(title)title.textContent=info[tool][0];if(description)description.textContent=info[tool][1];const grid=document.getElementById("gridOverlay");if(grid)grid.style.display=tool==="slice"?"block":"none"}
function setPage(page,tool){document.body.classList.toggle("page-home",page==="home");document.body.classList.toggle("page-tool",page!=="home");navLinks.forEach(link=>link.classList.toggle("active",link.dataset.page===(page==="home"?"home":tool)));if(page!=="home")setTool(tool||"compress");window.scrollTo({top:0,behavior:"smooth"})}
navLinks.forEach(link=>link.addEventListener("click",()=>{const p=link.dataset.page;setPage(p==="home"?"home":"tool",p==="home"?null:p)}));
const hero=document.getElementById("hero-cta");if(hero)hero.addEventListener("click",()=>{setPage("tool","compress");setTimeout(()=>document.getElementById("dropzone").click(),250)});
setPage("home");
const advanced=document.createElement("script");advanced.src="js/advanced.js";document.body.appendChild(advanced);
})();
