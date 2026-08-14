(function () {
  "use strict";

  const nav = document.querySelector(".top-nav-links");
  const panels = {
    compress: document.getElementById("panel-compress"),
    slice: document.getElementById("panel-slice"),
    convert: document.getElementById("panel-convert"),
    resize: document.getElementById("panel-resize"),
    crop: document.getElementById("panel-crop"),
    adjust: document.getElementById("panel-adjust"),
  };
  const title = document.querySelector("#workspace .page-title h1");
  const description = document.querySelector("#workspace .page-title p");

  const info = {
    compress: ["Сжатие изображений", "Уменьшайте вес PNG, JPEG и WebP с контролем качества."],
    slice: ["Нарезка изображений", "Разделяйте изображение на сетку или полосы и скачивайте ZIP-архив."],
    convert: ["Конвертация изображений", "Конвертируйте PNG, JPEG, WebP и PDF локально в браузере."],
    resize: ["Изменение размера", "Меняйте разрешение изображения с сохранением пропорций или свободно."],
    crop: ["Обрезка изображений", "Получайте фрагмент нужного размера из исходного изображения."],
    adjust: ["Коррекция изображения", "Настраивайте яркость, контраст, насыщенность и чёрно-белый режим."],
  };

  const advancedIds = new Set(["transform", "watermark", "batch", "metadata", "favicon"]);

  function closeMenus() {
    document.querySelectorAll(".nav-group.open").forEach((group) => {
      group.classList.remove("open");
      group.querySelector(".nav-group-toggle")?.setAttribute("aria-expanded", "false");
    });
  }

  function refreshGroups(active) {
    document.querySelectorAll(".nav-group").forEach((group) => {
      const ids = (group.dataset.groupIds || "").split(",");
      const selected =
        (!!active && ids.includes(active)) ||
        [...group.querySelectorAll(".nav-dropdown-item")].some((button) => button.classList.contains("active"));
      group.classList.toggle("active", !!selected);
    });
  }

  function setBasicTool(tool) {
    Object.entries(panels).forEach(([name, panel]) => {
      if (panel) panel.classList.toggle("active", name === tool);
    });
    if (title && info[tool]) title.textContent = info[tool][0];
    if (description && info[tool]) description.textContent = info[tool][1];
    const grid = document.getElementById("gridOverlay");
    if (grid) grid.style.display = tool === "slice" ? "block" : "none";
  }

  function activate(page) {
    closeMenus();

    // Every tool gets an isolated preview. Nothing rendered by the previous tool
    // is allowed to remain visually on top of the immutable source image.
    window.dispatchEvent(new CustomEvent("safelight:toolchange", { detail: { page } }));

    document.querySelectorAll(".top-nav-link").forEach((button) =>
      button.classList.toggle("active", button.dataset.page === page)
    );
    document.body.classList.toggle("page-home", page === "home");
    document.body.classList.toggle("page-tool", page !== "home");

    if (page === "home") {
      document.querySelectorAll(".panel").forEach((panel) => panel.classList.remove("active"));
      refreshGroups("home");
      window.scrollTo({ top: 0, behavior: "smooth" });
      return;
    }

    if (advancedIds.has(page) && window.safelightSetAdvanced) {
      window.safelightSetAdvanced(page);
      refreshGroups(page);
      return;
    }

    setBasicTool(page);
    refreshGroups(page);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function makeGroup(label, icon, ids) {
    const wrap = document.createElement("div");
    wrap.className = "nav-group";
    wrap.dataset.groupIds = ids.join(",");

    const toggle = document.createElement("button");
    toggle.type = "button";
    toggle.className = "nav-group-toggle";
    toggle.setAttribute("aria-expanded", "false");
    toggle.innerHTML =
      '<span class="nav-group-icon"><svg viewBox="0 0 24 24"><path d="' +
      icon +
      '"/></svg></span><span>' +
      label +
      '</span><span class="nav-chevron">⌄</span>';

    const menu = document.createElement("div");
    menu.className = "nav-dropdown";
    menu.setAttribute("role", "menu");

    ids.forEach((id) => {
      const item = nav.querySelector('.top-nav-link[data-page="' + id + '"]');
      if (!item) return;
      item.classList.add("nav-dropdown-item");
      item.setAttribute("role", "menuitem");
      menu.appendChild(item);
    });

    toggle.addEventListener("click", (event) => {
      event.stopPropagation();
      const wasOpen = wrap.classList.contains("open");
      closeMenus();
      if (!wasOpen) {
        wrap.classList.add("open");
        toggle.setAttribute("aria-expanded", "true");
      }
    });

    wrap.append(toggle, menu);
    nav.appendChild(wrap);
  }

  function buildGroups() {
    if (!nav || nav.dataset.grouped) return;
    const buttons = [...nav.querySelectorAll(":scope > .top-nav-link")];
    const ids = new Set(buttons.map((button) => button.dataset.page));
    const required = [
      "compress",
      "slice",
      "convert",
      "resize",
      "crop",
      "adjust",
      "transform",
      "watermark",
      "batch",
      "metadata",
      "favicon",
    ];
    if (!required.every((id) => ids.has(id))) return;

    nav.dataset.grouped = "1";
    nav.querySelector(':scope > [data-page="home"]')?.addEventListener("click", () => activate("home"));

    const groups = [
      ["Основные", "M4 5h16v14H4zM8 9h8M8 13h5", ["compress", "slice", "convert", "resize", "crop"]],
      ["Редактирование", "M4 20 8 19l10-10-3-3L5 16zM14 5l3 3", ["adjust", "transform", "watermark"]],
      ["Пакетная обработка", "M4 5h7v6H4zM13 5h7v6h-7zM4 13h7v6H4zM13 13h7v6h-7z", ["batch"]],
      ["Инструменты", "M12 3 14 8l5 .5-4 3.5 1.5 5L12 14l-4.5 3 1.5-5-4-3.5L10 8z", ["metadata", "favicon"]],
    ];
    groups.forEach(([label, icon, groupIds]) => makeGroup(label, icon, groupIds));

    nav.querySelectorAll(".nav-dropdown-item").forEach((item) =>
      item.addEventListener("click", (event) => {
        event.preventDefault();
        event.stopPropagation();
        activate(item.dataset.page);
      })
    );
    refreshGroups("home");
  }

  const hero = document.getElementById("hero-cta");
  if (hero) {
    hero.addEventListener("click", () => {
      activate("compress");
      setTimeout(() => document.getElementById("dropzone")?.click(), 250);
    });
  }

  document.addEventListener("click", (event) => {
    if (!event.target.closest(".nav-group")) closeMenus();
  });

  const observer = new MutationObserver(buildGroups);
  if (nav) observer.observe(nav, { childList: true });
  [0, 150, 500].forEach((delay) => setTimeout(buildGroups, delay));

  window.safelightActivate = activate;
  activate("home");

  function loadScript(src, onload) {
    const script = document.createElement("script");
    script.src = src;
    script.onerror = () => console.error("Safelight: failed to load", src);
    if (onload) script.onload = onload;
    document.body.appendChild(script);
  }

  loadScript("js/advanced.js?v=7", () => {
    loadScript("js/compare.js?v=5", () => {
      loadScript("js/hardening.js?v=1");
    });
  });
})();
