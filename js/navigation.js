(function(){
  "use strict";

  const navLinks = document.querySelectorAll(".top-nav-link");
  const toolPanels = {
    compress: document.getElementById("panel-compress"),
    slice: document.getElementById("panel-slice"),
    convert: document.getElementById("panel-convert")
  };
  const internalTabs = document.querySelectorAll(".tab-btn");
  const workspace = document.getElementById("workspace");
  const heroCta = document.getElementById("hero-cta");

  function activateTool(tool){
    Object.entries(toolPanels).forEach(([name,panel])=>{
      if(panel) panel.classList.toggle("active", name === tool);
    });

    internalTabs.forEach(btn=>btn.classList.toggle("active", btn.dataset.tab === tool));

    const grid = document.getElementById("gridOverlay");
    if(grid) grid.style.display = tool === "slice" ? "block" : "none";
  }

  function setPage(page, tool){
    document.body.classList.toggle("page-home", page === "home");
    document.body.classList.toggle("page-tool", page === "tool");

    navLinks.forEach(link=>link.classList.toggle("active", link.dataset.page === (page === "home" ? "home" : tool)));

    if(page === "tool"){
      activateTool(tool || "compress");
      window.scrollTo({top:0, behavior:"smooth"});
    }else{
      window.scrollTo({top:0, behavior:"smooth"});
    }
  }

  navLinks.forEach(link=>{
    link.addEventListener("click",()=>{
      const page = link.dataset.page;
      if(page === "home") setPage("home");
      else setPage("tool", page);
    });
  });

  if(heroCta){
    heroCta.addEventListener("click",()=>setPage("tool","compress"));
  }

  document.querySelectorAll(".tool-card").forEach(card=>{
    card.addEventListener("click",()=>setPage("tool", card.dataset.tab));
  });

  setPage("home");
})();
