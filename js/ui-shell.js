(function () {
  "use strict";

  if (window.safelightUiShellLoaded) return;
  window.safelightUiShellLoaded = true;

  const css = document.createElement("link");
  css.rel = "stylesheet";
  css.href = "css/app-shell.css?v=2";
  document.head.appendChild(css);

  const TOOL_INFO = {
    compress: ["Сжатие", "Уменьшайте вес изображения и контролируйте качество результата."],
    slice: ["Нарезка", "Разделяйте изображение на сетку или полосы и экспортируйте ZIP."],
    convert: ["Конвертация", "PNG, JPEG, WebP, HEIC и PDF без отправки файла на сервер."],
    resize: ["Размер", "Изменяйте разрешение с сохранением пропорций или вручную."],
    crop: ["Обрезка", "Получайте фрагмент нужного размера из исходного изображения."],
    adjust: ["Коррекция", "Яркость, контраст, насыщенность и чёрно-белый режим."],
    transform: ["Трансформация", "Поворот и отражение исходного изображения."],
    watermark: ["Водяной знак", "Добавляйте текстовый watermark прямо поверх изображения."],
    batch: ["Пакетная обработка", "Обрабатывайте несколько файлов с общими настройками."],
    metadata: ["Метаданные", "Проверяйте сведения о файле и очищайте их пересохранением."],
    favicon: ["Favicon", "Создавайте набор иконок для сайта из одного изображения."],
  };

  const GROUPS = [
    ["Основные", ["compress", "convert", "resize", "crop", "adjust", "slice"]],
    ["Редактирование", ["transform", "watermark"]],
    ["Инструменты", ["batch", "metadata", "favicon"]],
  ];

  function icon(path) {
    return '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="' + path + '"/></svg>';
  }

  function waitForApp() {
    const advancedReady = ["panel-transform", "panel-watermark", "panel-batch", "panel-metadata", "panel-favicon"].every((id) => document.getElementById(id));
    const baseReady = document.getElementById("stage") && document.getElementById("previewImg") && document.getElementById("fileInput");
    if (!advancedReady || !baseReady || typeof window.safelightActivate !== "function") {
      setTimeout(waitForApp, 40);
      return;
    }
    buildShell();
  }

  function buildShell() {
    if (document.querySelector(".sl-app")) return;

    const stage = document.getElementById("stage");
    const readout = document.getElementById("readout");
    const preview = document.getElementById("previewImg");
    const fileInput = document.getElementById("fileInput");
    const dropzone = document.getElementById("dropzone");
    const filemeta = document.getElementById("filemeta");
    if (!stage || !readout || !preview || !fileInput) return;

    fileInput.multiple = true;
    fileInput.setAttribute("accept", "image/*,application/pdf,.pdf,.heic,.heif,image/heic,image/heif");

    const shell = document.createElement("div");
    shell.className = "sl-app";
    shell.innerHTML = `
      <header class="sl-topbar">
        <button class="sl-brand" type="button" aria-label="На главную">
          ${icon("M12 2.8 19 5.7v5.6c0 4.6-2.7 8.2-7 10-4.3-1.8-7-5.4-7-10V5.7zM8.8 12.1l2.1 2.1 4.5-5")}
          <span>Safelight</span>
        </button>
        <button class="sl-add" id="sl-add-images" type="button">
          ${icon("M12 5v14M5 12h14")}
          <span>Добавить</span>
        </button>
        <div class="sl-filehead" aria-live="polite">
          <strong id="sl-file-name">Файл не выбран</strong>
          <span class="dot">•</span><span class="sl-dims" id="sl-file-dims">—</span>
          <span class="dot">•</span><span id="sl-file-size">—</span>
        </div>
        <div class="sl-top-spacer"></div>
        <div class="sl-local">${icon("M12 3 19 6v5c0 4.2-2.5 7.5-7 9.3C7.5 18.5 5 15.2 5 11V6zM9 12l2 2 4-5")}<span>Без отправки на сервер</span><i class="sl-live-dot"></i></div>
        <button class="sl-tool-action" id="sl-reset" type="button" title="Сбросить настройки текущего инструмента">${icon("M4 7v5h5M5.5 11A7 7 0 1 0 8 5.2")}<span>Сбросить</span></button>
        <button class="sl-export" id="sl-export" type="button">${icon("M12 15V4m0 0L8 8m4-4 4 4M5 13v6h14v-6")}<span>Экспорт</span></button>
      </header>
      <div class="sl-app-body">
        <aside class="sl-sidebar"><div class="sl-sidebar-inner"><div id="sl-tool-nav"></div><div class="sl-privacy">${icon("M12 3 19 6v5c0 4.2-2.5 7.5-7 9.3C7.5 18.5 5 15.2 5 11V6zM9 12l2 2 4-5")}<span>Файлы остаются на вашем устройстве. Safelight не загружает изображения на сервер.</span></div></div></aside>
        <section class="sl-center">
          <div class="sl-stage-host"></div>
          <div class="sl-readout-host"></div>
          <div class="sl-filmstrip" id="sl-filmstrip"></div>
        </section>
        <aside class="sl-inspector">
          <div class="sl-inspector-head"><div class="sl-inspector-eyebrow">Инструмент</div><h2 class="sl-inspector-title" id="sl-inspector-title">Сжатие</h2><p class="sl-inspector-desc" id="sl-inspector-desc"></p></div>
          <div class="sl-inspector-panels" id="sl-inspector-panels"></div>
          <div class="sl-inspector-note">${icon("M12 9v4m0 3h.01M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18")}<span><b>Предпросмотр не меняет оригинал</b>Каждый инструмент использует собственное изолированное состояние. Экспорт находится только в верхней панели.</span></div>
        </aside>
      </div>
      <div class="sl-export-hint" id="sl-export-hint"></div>`;

    document.body.insertBefore(shell, document.getElementById("workspace"));
    shell.querySelector(".sl-stage-host").appendChild(stage);
    shell.querySelector(".sl-readout-host").appendChild(readout);

    const panelHost = shell.querySelector("#sl-inspector-panels");
    document.querySelectorAll(".panel").forEach((panel) => panelHost.appendChild(panel));

    buildSidebar(shell);
    wireToolbar(shell);
    wireFileTray(shell, fileInput, dropzone, stage, preview);
    syncInspector();
    syncFileMeta(shell, filemeta);

    window.addEventListener("safelight:toolchange", () => setTimeout(() => {
      syncInspector();
      syncExportAvailability();
    }, 0));

    new MutationObserver(() => syncExportAvailability()).observe(panelHost, {
      subtree: true,
      attributes: true,
      attributeFilter: ["class", "disabled"],
      childList: true,
      characterData: true,
    });

    new MutationObserver(() => {
      syncFileMeta(shell, filemeta);
      syncExportAvailability();
    }).observe(preview, { attributes: true, attributeFilter: ["src"] });

    syncExportAvailability();
  }

  function buildSidebar(shell) {
    const host = shell.querySelector("#sl-tool-nav");
    GROUPS.forEach(([label, ids]) => {
      const group = document.createElement("div");
      group.className = "sl-nav-group";
      const heading = document.createElement("div");
      heading.className = "sl-nav-label";
      heading.textContent = label;
      group.appendChild(heading);

      ids.forEach((id) => {
        const source = document.querySelector('.top-nav-link[data-page="' + id + '"]');
        if (!source) return;
        const button = source.cloneNode(true);
        button.classList.remove("nav-dropdown-item", "advanced-nav");
        button.classList.add("sl-tool");
        button.removeAttribute("role");
        button.onclick = null;
        button.addEventListener("click", (event) => {
          event.preventDefault();
          window.safelightActivate(id);
        });
        group.appendChild(button);
      });
      host.appendChild(group);
    });
  }

  function currentTool() {
    const panel = document.querySelector("#sl-inspector-panels .panel.active");
    return panel ? panel.id.replace("panel-", "") : null;
  }

  function syncInspector() {
    const tool = currentTool() || "compress";
    const info = TOOL_INFO[tool] || ["Инструмент", "Обработка изображения в браузере."];
    const title = document.getElementById("sl-inspector-title");
    const desc = document.getElementById("sl-inspector-desc");
    if (title) title.textContent = info[0];
    if (desc) desc.textContent = info[1];
    document.querySelectorAll(".sl-sidebar .sl-tool").forEach((button) => button.classList.toggle("active", button.dataset.page === tool));
  }

  function wireToolbar(shell) {
    const fileInput = document.getElementById("fileInput");
    shell.querySelector(".sl-brand").addEventListener("click", () => window.safelightActivate("home"));
    shell.querySelector("#sl-add-images").addEventListener("click", () => fileInput?.click());
    shell.querySelector("#sl-reset").addEventListener("click", resetCurrentTool);
  }

  function resetCurrentTool() {
    const panel = document.querySelector("#sl-inspector-panels .panel.active");
    if (!panel) return;

    panel.querySelectorAll("input,select").forEach((control) => {
      if (control.type === "file") return;
      if (control.type === "checkbox" || control.type === "radio") control.checked = control.defaultChecked;
      else if (control.tagName === "SELECT") {
        const selected = [...control.options].findIndex((option) => option.defaultSelected);
        control.selectedIndex = selected >= 0 ? selected : 0;
      } else if (control.defaultValue !== undefined) control.value = control.defaultValue;
      control.dispatchEvent(new Event("input", { bubbles: true }));
      control.dispatchEvent(new Event("change", { bubbles: true }));
    });

    panel.querySelectorAll(".result.show").forEach((result) => result.classList.remove("show"));
    panel.querySelectorAll(".status-line").forEach((status) => (status.textContent = ""));
    if (window.safelightTransformState && currentTool() === "transform") {
      window.safelightTransformState.angle = 0;
      window.safelightTransformState.h = false;
      window.safelightTransformState.v = false;
    }
    syncExportAvailability();
  }

  function syncExportAvailability() {
    const button = document.getElementById("sl-export");
    if (!button) return;
    const tool = currentTool();
    const hasSource = !!document.getElementById("previewImg")?.src;
    const batchHasFiles = (document.getElementById("batch-files")?.files?.length || 0) > 0;
    button.disabled = !tool || (!hasSource && !(tool === "batch" && batchHasFiles));
  }

  function fileKey(file) {
    return [file.name, file.size, file.lastModified].join(":");
  }

  function wireFileTray(shell, fileInput, dropzone, stage, preview) {
    const tray = shell.querySelector("#sl-filmstrip");
    const files = new Map();
    const urls = new Map();
    let selected = null;

    function addFiles(list) {
      const incoming = [...(list || [])].filter((file) => file.type.startsWith("image/") || file.type === "application/pdf" || /\.(pdf|heic|heif)$/i.test(file.name));
      incoming.forEach((file) => {
        const key = fileKey(file);
        if (!files.has(key)) files.set(key, file);
      });
      if (incoming.length) selected = fileKey(incoming[0]);
      render();
    }

    function getThumb(file) {
      const key = fileKey(file);
      if (urls.has(key)) return urls.get(key);
      if (!file.type.startsWith("image/") || /\.(heic|heif)$/i.test(file.name)) return null;
      const url = URL.createObjectURL(file);
      urls.set(key, url);
      return url;
    }

    function selectFile(file) {
      if (!file) return;
      selected = fileKey(file);
      render();
      try {
        const transfer = new DataTransfer();
        transfer.items.add(file);
        fileInput.files = transfer.files;
        fileInput.dispatchEvent(new Event("change", { bubbles: true }));
      } catch (_) {
        if (dropzone && typeof DragEvent === "function") {
          const transfer = new DataTransfer();
          transfer.items.add(file);
          dropzone.dispatchEvent(new DragEvent("drop", { bubbles: true, cancelable: true, dataTransfer: transfer }));
        }
      }
    }

    function render() {
      tray.innerHTML = "";
      if (!files.size) {
        const empty = document.createElement("div");
        empty.className = "sl-empty-tray";
        empty.textContent = "Добавленные изображения появятся здесь";
        tray.appendChild(empty);
      }
      files.forEach((file, key) => {
        const item = document.createElement("button");
        item.type = "button";
        item.className = "sl-thumb" + (selected === key ? " active" : "");
        item.title = file.name;
        const src = getThumb(file);
        if (src) item.innerHTML = '<img src="' + src + '" alt=""><span class="sl-name"></span>';
        else item.innerHTML = '<div class="sl-pdf-thumb">' + (/\.(heic|heif)$/i.test(file.name) ? 'HEIC' : 'PDF') + '</div><span class="sl-name"></span>';
        item.querySelector(".sl-name").textContent = file.name;
        item.addEventListener("click", () => selectFile(file));
        tray.appendChild(item);
      });

      const add = document.createElement("button");
      add.type = "button";
      add.className = "sl-add-thumb";
      add.innerHTML = "<b>+</b><span>Добавить</span>";
      add.addEventListener("click", () => fileInput.click());
      tray.appendChild(add);
    }

    fileInput.addEventListener("change", (event) => addFiles(event.target.files), true);
    dropzone?.addEventListener("drop", (event) => addFiles(event.dataTransfer?.files), true);

    stage.addEventListener("dragover", (event) => {
      event.preventDefault();
      stage.classList.add("drag");
    });
    stage.addEventListener("dragleave", () => stage.classList.remove("drag"));
    stage.addEventListener("drop", (event) => {
      event.preventDefault();
      stage.classList.remove("drag");
      const dropped = [...(event.dataTransfer?.files || [])].filter((file) => file.type.startsWith("image/") || file.type === "application/pdf" || /\.(pdf|heic|heif)$/i.test(file.name));
      addFiles(dropped);
      if (dropped[0]) selectFile(dropped[0]);
    });
    stage.addEventListener("click", (event) => {
      if (preview.src || event.target.closest("input,button")) return;
      fileInput.click();
    });

    new MutationObserver(() => render()).observe(preview, { attributes: true, attributeFilter: ["src"] });
    window.addEventListener("beforeunload", () => urls.forEach((url) => URL.revokeObjectURL(url)));
    render();
  }

  function syncFileMeta(shell, filemeta) {
    const name = document.getElementById("meta-name")?.textContent?.trim() || "—";
    const dims = document.getElementById("meta-dims")?.textContent?.trim() || "—";
    const size = document.getElementById("meta-size")?.textContent?.trim() || "—";
    const nameOut = shell.querySelector("#sl-file-name");
    const dimsOut = shell.querySelector("#sl-file-dims");
    const sizeOut = shell.querySelector("#sl-file-size");
    if (nameOut) nameOut.textContent = name === "—" ? "Файл не выбран" : name;
    if (dimsOut) dimsOut.textContent = dims;
    if (sizeOut) sizeOut.textContent = size;

    if (filemeta && !filemeta.dataset.slObserved) {
      filemeta.dataset.slObserved = "1";
      new MutationObserver(() => syncFileMeta(shell, filemeta)).observe(filemeta, { subtree: true, childList: true, characterData: true });
    }
  }

  waitForApp();
})();