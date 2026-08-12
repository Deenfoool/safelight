(function(){
"use strict";
const nav=document.querySelector(".top-nav-links");
const navLinks=document.querySelectorAll(".top-nav-link");
const panels={compress:document.getElementById("panel-compress"),slice:document.getElementById("panel-slice"),convert:document.getElementById("panel-convert"),resize:document.getElementById("panel-resize"),crop:document.getElementById("panel-crop"),adjust:document.getElementById("panel-adjust")};
const title=document.querySelector("#workspace .page-title h1"),description=document.querySelector("#workspace .page-title p");
const info={compress:["Сжатие изображений","Уменьшайте вес PNG, JPEG и WebP с контролем качества."],slice:["Нарезка изображений","Разделяйте изображение на сетку или полосы и скачивайте ZIP-архив."],convert:["Конвертация изображений","Пересохраняйте изображения между PNG, JPEG и WebP."],resize:["Изменение размера","Меняйте разрешение изображения с сохранением пропорций или свободно."],crop:["Обрезка изображений","Получайте фрагмент нужного размера из исходного изображения."],adjust:["Коррекция изображения","Настраивайте яркость, контраст, насыщенность и чёрно-белый режим."]};
function setTool(tool){Object.entries(panels).forEach(([name,panel])=>{if(panel)panel.classList.toggle("active",name===tool)});if(title&&info[tool])title.textContent=info[tool][0];if(description&&info[tool])description.textContent=info[tool][1];const grid=document.getElementById("gridOverlay");if(grid)grid.style.display=tool==="slice"?"block":"none";refreshGroups(tool)}
function setPage(page,tool){document.body.classList.toggle("page-home",page==="home");document.body.classList.toggle("page-tool",page!=="home");navLinks.forEach(link=>link.classList.toggle("active",link.dataset.page===(page==="home"?"home":tool)));if(page!=="home")setTool(tool||"compress");else refreshGroups("home");window.scrollTo({top:0,behavior:"smooth"})}
navLinks.forEach(link=>link.addEventListener("click",()=>{const p=link.dataset.page;setPage(p==="home"?"home":"tool",p==="home"?null:p)}));
const hero=document.getElementById("hero-cta");if(hero)hero.addEventListener("click",()=>{setPage("tool","compress");setTimeout(()=>document.getElementById("dropzone").click(),250)});
function groupNav(){if(!nav||nav.dataset.grouped==="1")return;const buttons=[...nav.querySelectorAll(".top-nav-link")];if(buttons.length<12)return;const groups=[
{label:"Основные",icon:"M4 5h16v14H4zM8 9h8M8 13h5",ids:["compress","slice","convert","resize","crop"]},
{label:"Редактирование",icon:"M4 20 8 19l10-10-3-3L5 16zM14 5l3 3",ids:["adjust","transform","watermark"]},
{label:"Пакетная обработка",icon:"M4 5h7v6H4zM13 5h7v6h-7zM4 13h7v6H4zM13 13h7v6h-7z",ids:["batch"]},
{label:"Инструменты",icon:"M12 3 14 8l5 .5-4 3.5 1.5 5L12 14l-4.5 3 1.5-5-4-3.5L10 8z",ids:["metadata","favicon"]}
];
const home=nav.querySelector('[data-page="home"]');groups.forEach(g=>{const wrap=document.createElement("div");wrap.className="nav-group";wrap.dataset.groupIds=g.ids.join(",");const toggle=document.createElement("button");toggle.className="nav-group-toggle";toggle.type="button";toggle.innerHTML='<span class="nav-group-icon"><svg viewBox="0 0 24 24"><path d="'+g.icon+'"/></svg></span><span>'+g.label+'</span><span class="nav-chevron">⌄</span>';const menu=document.createElement("div");menu.className="nav-dropdown";buttons.filter(b=>g.ids.includes(b.dataset.page)).forEach(b=>menu.appendChild(b));wrap.append(toggle,menu);toggle.addEventListener("click",e=>{e.stopPropagation();document.querySelectorAll(".nav-group.open").forEach(x=>{if(x!==wrap)x.classList.remove("open")});wrap.classList.toggle("open")});if(home)home.after(wrap);else nav.appendChild(wrap)});nav.dataset.grouped="1";document.addEventListener("click",()=>document.querySelectorAll(".nav-group.open").forEach(x=>x.classList.remove("open"));refreshGroups();}
function refreshGroups(active){document.querySelectorAll(".nav-group").forEach(g=>{const ids=g.dataset.groupIds.split(",");const selected=active&&ids.includes(active)||[...g.querySelectorAll(".top-nav-link")].some(b=>b.classList.contains("active"));g.classList.toggle("active",selected)});}
const observer=new MutationObserver(()=>{if([...nav.querySelectorAll(".top-nav-link")].length>=12)groupNav()});if(nav)observer.observe(nav,{childList:true});
setTimeout(groupNav,50);
setPage("home");
const advanced=document.createElement("script");advanced.src="js/advanced.js";document.body.appendChild(advanced);
})();
