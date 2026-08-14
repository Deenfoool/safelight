(function () {
  "use strict";

  const nav = document.querySelector(".top-nav-links");
  const main = document.querySelector("main.workmain");
  if (!nav || !main) return;

  window.safelightTransformState = { angle: 0, h: false, v: false };

  const tools = [
    { id: "transform", label: "Трансформация", icon: "M5 9V5h4M15 5h4v4M19 15v4h-4M9 19H5v-4M8 8l-3-3m11 11 3 3M16 8l3-3M8 16l-3 3" },
    { id: "watermark", label: "Водяной знак", icon: "M4 5h16v14H4zM8 15l3-3 2 2 2-2 3 3M8 9h.01" },
    { id: "batch", label: "Массовая обработка", icon: "M4 5h7v7H4zM13 5h7v7h-7zM4 14h7v5H4zM13 14h7v5h-7z" },
    { id: "metadata", label: "Метаданные", icon: "M6 3h9l3 3v15H6zM15 3v4h4M9 12h6M9 16h6" },
    { id: "favicon", label: "Favicon", icon: "M4 4h16v16H4zM8 16l3-4 2 2 2-3 3 5" },
  ];

  function addNav(t) {
    if (nav.querySelector('[data-page="' + t.id + '"]')) return;
    const b = document.createElement("button");
    b.type = "button";
    b.className = "top-nav-link advanced-nav";
    b.dataset.page = t.id;
    b.innerHTML = '<span class="nav-icon" aria-hidden="true"><svg viewBox="0 0 24 24"><path d="' + t.icon + '"/></svg></span><span>' + t.label + "</span>";
    nav.appendChild(b);
  }
  tools.forEach(addNav);

  function card(id, title, desc, html) {
    const s = document.createElement("section");
    s.className = "panel";
    s.id = "panel-" + id;
    s.innerHTML = '<div class="panel-card"><h2>' + title + '</h2><p class="desc">' + desc + "</p>" + html + "</div>";
    main.appendChild(s);
    return s;
  }

  function ready() {
    const wrap = document.getElementById("previewWrap");
    const img = document.getElementById("previewImg");
    return !!(wrap && img && wrap.style.display !== "none" && img.src);
  }

  function getImage() {
    return new Promise((resolve, reject) => {
      if (!ready()) return reject(new Error("no-image"));
      const im = new Image();
      im.onload = () => resolve(im);
      im.onerror = reject;
      im.src = document.getElementById("previewImg").src;
    });
  }

  function dl(blob, name) {
    if (!blob) return;
    const u = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = u;
    a.download = name;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(u), 3000);
  }

  function fmt(n) {
    n = Number(n) || 0;
    if (n < 1024) return n + " B";
    if (n < 1048576) return (n / 1024).toFixed(1) + " KB";
    return (n / 1048576).toFixed(2) + " MB";
  }

  function canvasBlob(c, type, q) {
    return new Promise((resolve, reject) => c.toBlob((b) => (b ? resolve(b) : reject(new Error("toBlob-failed"))), type, q));
  }

  const transform = card(
    "transform",
    "ТРАНСФОРМАЦИЯ",
    "Поворачивайте и отражайте изображение локально.",
    '<div class="transform-actions">' +
      '<button type="button" class="btn ghost" data-tr="ccw">↶ 90°</button>' +
      '<button type="button" class="btn ghost" data-tr="cw">↷ 90°</button>' +
      '<button type="button" class="btn ghost" data-tr="180">180°</button>' +
      '<button type="button" class="btn ghost" data-tr="h">↔ Горизонталь</button>' +
      '<button type="button" class="btn ghost" data-tr="v">↕ Вертикаль</button>' +
      "</div>" +
      '<button type="button" class="btn primary" id="tr-download">Скачать PNG</button>' +
      '<div class="status-line" id="tr-status"></div>'
  );

  let trBlob = null;
  transform.querySelectorAll("[data-tr]").forEach((b) => b.addEventListener("click", async () => {
    const status = transform.querySelector("#tr-status");
    if (!ready()) { status.textContent = "Сначала загрузите изображение."; return; }
    const a = b.dataset.tr, state = window.safelightTransformState;
    if (a === "ccw") state.angle = (state.angle + 270) % 360;
    if (a === "cw") state.angle = (state.angle + 90) % 360;
    if (a === "180") state.angle = (state.angle + 180) % 360;
    if (a === "h") state.h = !state.h;
    if (a === "v") state.v = !state.v;
    try {
      const im = await getImage(), swap = state.angle % 180 !== 0, c = document.createElement("canvas");
      c.width = swap ? im.naturalHeight : im.naturalWidth;
      c.height = swap ? im.naturalWidth : im.naturalHeight;
      const x = c.getContext("2d");
      x.translate(c.width / 2, c.height / 2); x.rotate((state.angle * Math.PI) / 180); x.scale(state.h ? -1 : 1, state.v ? -1 : 1); x.drawImage(im, -im.naturalWidth / 2, -im.naturalHeight / 2);
      trBlob = await canvasBlob(c, "image/png"); status.textContent = "Предпросмотр обновлён.";
    } catch (e) { trBlob = null; status.textContent = "Не удалось преобразовать изображение."; }
  }));
  transform.querySelector("#tr-download").addEventListener("click", () => {
    if (!trBlob) { transform.querySelector("#tr-status").textContent = "Сначала примените трансформацию."; return; }
    dl(trBlob, "safelight-transform.png");
  });

  const wm = card(
    "watermark",
    "ВОДЯНОЙ ЗНАК",
    "Добавляйте текстовый watermark прямо в браузере.",
    '<div class="field-row">' +
      '<div class="field wm-wide"><label>Текст</label><input id="wm-text" value="Safelight"></div>' +
      '<div class="field"><label>Размер</label><input id="wm-size" type="number" min="8" max="1000" value="48"></div>' +
      '<div class="field"><label>Прозрачность</label><input id="wm-opacity" type="number" min="1" max="100" value="45"></div>' +
      '<div class="field"><label>Позиция</label><select id="wm-pos"><option value="br">Низ / право</option><option value="bl">Низ / лево</option><option value="tr">Верх / право</option><option value="tl">Верх / лево</option><option value="center">Центр</option></select></div></div>' +
      '<button type="button" class="btn primary" id="wm-run">Нанести водяной знак</button>' +
      '<button type="button" class="btn ghost" id="wm-download">Скачать</button>' +
      '<div class="status-line" id="wm-status"></div>'
  );

  let wmBlob = null;
  wm.querySelector("#wm-run").addEventListener("click", async () => {
    const status = wm.querySelector("#wm-status");
    if (!ready()) { status.textContent = "Сначала загрузите изображение."; return; }
    try {
      const im = await getImage(), c = document.createElement("canvas"); c.width = im.naturalWidth; c.height = im.naturalHeight;
      const x = c.getContext("2d"); x.drawImage(im, 0, 0);
      const size = Math.max(8, Math.min(1000, +wm.querySelector("#wm-size").value || 48));
      const text = wm.querySelector("#wm-text").value.trim() || "Safelight";
      const op = Math.max(1, Math.min(100, +wm.querySelector("#wm-opacity").value || 45)) / 100;
      const p = wm.querySelector("#wm-pos").value, pad = size * 0.55;
      x.font = "600 " + size + "px system-ui,Arial,sans-serif"; x.fillStyle = "rgba(255,255,255," + op + ")"; x.shadowColor = "rgba(0,0,0,.5)"; x.shadowBlur = Math.max(2, size / 10);
      const m = x.measureText(text); let px = pad, py = size + pad;
      if (p.includes("r")) px = c.width - m.width - pad;
      if (p === "center") { px = (c.width - m.width) / 2; py = (c.height + size) / 2; }
      if (p === "br" || p === "bl") py = c.height - pad;
      px = Math.max(0, Math.min(c.width - m.width, px)); py = Math.max(size, Math.min(c.height, py)); x.fillText(text, px, py);
      wmBlob = await canvasBlob(c, "image/png"); status.textContent = "Готово.";
    } catch (e) { wmBlob = null; status.textContent = "Не удалось создать водяной знак."; }
  });
  wm.querySelector("#wm-download").addEventListener("click", () => {
    if (!wmBlob) { wm.querySelector("#wm-status").textContent = "Сначала нанесите водяной знак."; return; }
    dl(wmBlob, "safelight-watermark.png");
  });

  const batch = card(
    "batch",
    "МАССОВАЯ ОБРАБОТКА",
    "Обрабатывайте много изображений и скачивайте один ZIP.",
    '<label class="batch-drop"><span>Выберите несколько изображений</span><input id="batch-files" type="file" accept="image/*" multiple></label>' +
      '<div class="field-row"><div class="field"><label>Формат</label><select id="b-format"><option value="webp" selected>WebP</option><option value="jpeg">JPEG</option><option value="png">PNG</option></select></div>' +
      '<div class="field"><label>Качество</label><input id="b-quality" type="number" min="1" max="100" value="85"></div>' +
      '<div class="field"><label>Макс. ширина</label><input id="b-width" type="number" min="0" value="0"></div></div>' +
      '<button type="button" class="btn primary" id="b-run">Обработать всё и скачать ZIP</button><div class="batch-progress"><div id="b-bar"></div></div><div class="status-line" id="b-status"></div>'
  );
  let bfs = [];
  batch.querySelector("#batch-files").addEventListener("change", (e) => {
    bfs = [...e.target.files].filter((f) => f.type.startsWith("image/")); batch.querySelector("#b-bar").style.width = "0%";
    batch.querySelector("#b-status").textContent = bfs.length ? "Выбрано: " + bfs.length + " файлов." : "Подходящих изображений не найдено.";
  });
  batch.querySelector("#b-run").addEventListener("click", async () => {
    const status = batch.querySelector("#b-status"), run = batch.querySelector("#b-run");
    if (!bfs.length) { status.textContent = "Сначала выберите файлы."; return; }
    if (!window.JSZip) { status.textContent = "Локальный ZIP-модуль не загрузился."; return; }
    run.disabled = true;
    try {
      const z = new JSZip(), fmtv = batch.querySelector("#b-format").value, q = Math.max(1, Math.min(100, +batch.querySelector("#b-quality").value || 85)) / 100, maxW = Math.max(0, +batch.querySelector("#b-width").value || 0);
      const mime = fmtv === "png" ? "image/png" : fmtv === "webp" ? "image/webp" : "image/jpeg", ext = fmtv === "jpeg" ? "jpg" : fmtv;
      for (let i = 0; i < bfs.length; i++) {
        const im = await createImageBitmap(bfs[i]), c = document.createElement("canvas"), s = maxW && im.width > maxW ? maxW / im.width : 1;
        c.width = Math.max(1, Math.round(im.width * s)); c.height = Math.max(1, Math.round(im.height * s)); c.getContext("2d").drawImage(im, 0, 0, c.width, c.height);
        const blob = await canvasBlob(c, mime, fmtv === "png" ? undefined : q); z.file(bfs[i].name.replace(/\.[^.]+$/, "") + "-optimized." + ext, blob); im.close?.();
        batch.querySelector("#b-bar").style.width = Math.round(((i + 1) / bfs.length) * 100) + "%"; status.textContent = "Обработано " + (i + 1) + " / " + bfs.length;
      }
      dl(await z.generateAsync({ type: "blob" }), "safelight-batch.zip"); status.textContent = "Готово. ZIP скачан.";
    } catch (e) { status.textContent = "Ошибка обработки: " + (e.message || "неизвестная ошибка"); } finally { run.disabled = false; }
  });

  const metadata = card("metadata", "МЕТАДАННЫЕ", "Проверяйте информацию о файле и очищайте её пересохранением.", '<div class="meta-box" id="meta-box">Загрузите изображение.</div><button type="button" class="btn primary" id="meta-clean">Очистить и скачать PNG</button><div class="status-line" id="meta-status"></div>');
  metadata.querySelector("#meta-clean").addEventListener("click", async () => {
    const status = metadata.querySelector("#meta-status"); if (!ready()) { status.textContent = "Сначала загрузите изображение."; return; }
    try { const im = await getImage(), c = document.createElement("canvas"); c.width = im.naturalWidth; c.height = im.naturalHeight; c.getContext("2d").drawImage(im, 0, 0); dl(await canvasBlob(c, "image/png"), "safelight-clean.png"); status.textContent = "Готово. Результат пересохранён через Canvas без исходных метаданных."; }
    catch (e) { status.textContent = "Не удалось очистить метаданные."; }
  });

  const favicon = card("favicon", "FAVICON GENERATOR", "Создавайте набор иконок для сайта из одного изображения.", '<button type="button" class="btn primary" id="f-run">Создать favicon-пакет</button><div class="code-box" id="f-code"></div><div class="status-line" id="f-status"></div>');
  favicon.querySelector("#f-run").addEventListener("click", async () => {
    const status = favicon.querySelector("#f-status"); if (!ready()) { status.textContent = "Сначала загрузите изображение."; return; } if (!window.JSZip) { status.textContent = "Локальный ZIP-модуль не загрузился."; return; }
    try {
      const im = await getImage(), z = new JSZip();
      for (const n of [16, 32, 48, 180, 192, 512]) { const c = document.createElement("canvas"); c.width = c.height = n; const x = c.getContext("2d"); x.fillStyle = "#fff"; x.fillRect(0, 0, n, n); const scale = Math.min(n / im.naturalWidth, n / im.naturalHeight), w = im.naturalWidth * scale, h = im.naturalHeight * scale; x.drawImage(im, (n - w) / 2, (n - h) / 2, w, h); z.file("favicon-" + n + ".png", await canvasBlob(c, "image/png")); }
      dl(await z.generateAsync({ type: "blob" }), "safelight-favicon-pack.zip"); favicon.querySelector("#f-code").textContent = '<link rel="icon" href="favicon-32.png">\n<link rel="apple-touch-icon" href="favicon-180.png">'; status.textContent = "Готово. Пакет скачан.";
    } catch (e) { status.textContent = "Не удалось создать favicon-пакет."; }
  });

  function setAdvanced(id) {
    document.body.classList.remove("page-home"); document.body.classList.add("page-tool");
    document.querySelectorAll(".top-nav-link").forEach((b) => b.classList.toggle("active", b.dataset.page === id));
    document.querySelectorAll(".panel").forEach((p) => p.classList.toggle("active", p.id === "panel-" + id));
    const titles = { transform: ["Трансформация", "Поворот и отражение изображений."], watermark: ["Водяной знак", "Добавляйте текстовый watermark локально."], batch: ["Массовая обработка", "Обрабатывайте множество изображений одним действием."], metadata: ["Метаданные", "Проверяйте и очищайте данные изображения."], favicon: ["Favicon Generator", "Создавайте набор иконок для сайта."] };
    const t = titles[id]; if (t) { document.querySelector("#workspace .page-title h1").textContent = t[0]; document.querySelector("#workspace .page-title p").textContent = t[1]; }
    const grid = document.getElementById("gridOverlay"); if (grid) grid.style.display = "none";
    if (id === "metadata" && ready()) {
      const name = document.getElementById("meta-name").textContent, type = document.getElementById("meta-type").textContent, size = document.getElementById("meta-size").textContent, dims = document.getElementById("meta-dims").textContent;
      document.getElementById("meta-box").innerHTML = "<div>Файл <b>" + name + "</b></div><div>Тип <b>" + type + "</b></div><div>Размер <b>" + size + "</b></div><div>Размеры <b>" + dims + "</b></div><small>Canvas-пересохранение удаляет исходные EXIF/комментарии из результата.</small>";
    }
    window.scrollTo({ top: 0, behavior: "smooth" });
  }
  window.safelightSetAdvanced = setAdvanced;

  /* Local PDF input bridge. The renderer is shipped in /vendor and no network library loading is performed. */
  (function initPdfInput() {
    const fileInput = document.getElementById("fileInput"), dropzone = document.getElementById("dropzone"), panel = document.getElementById("panel-convert"), format = document.getElementById("v-format");
    if (!fileInput || !dropzone || !panel) return;
    fileInput.setAttribute("accept", "image/*,application/pdf,.pdf");
    if (format && ![...format.options].some((o) => o.value === "pdf")) { const o = document.createElement("option"); o.value = "pdf"; o.textContent = "PDF"; format.appendChild(o); }

    function isPdf(f) { return !!(f && ((f.type || "").toLowerCase() === "application/pdf" || /\.pdf$/i.test(f.name || ""))); }
    function setStatus(text) { const e = panel.querySelector("#v-status"); if (e) e.textContent = text; }

    async function renderPdfPage(file) {
      if (!window.pdfjsLib?.getDocument) throw new Error("Локальный PDF-модуль не загрузился");
      const data = await file.arrayBuffer(), doc = await window.pdfjsLib.getDocument({ data }).promise, page = await doc.getPage(1), viewport = page.getViewport({ scale: 1.5 }), c = document.createElement("canvas");
      c.width = Math.ceil(viewport.width); c.height = Math.ceil(viewport.height); await page.render({ canvasContext: c.getContext("2d"), viewport }).promise; return { canvas: c, pages: doc.numPages };
    }

    async function handlePdf(file) {
      setStatus("Читаю PDF локально…");
      try {
        const r = await renderPdfPage(file), preview = document.getElementById("previewImg");
        preview.src = r.canvas.toDataURL("image/png"); document.getElementById("previewWrap").style.display = "inline-block"; document.getElementById("stageEmpty").style.display = "none"; document.getElementById("readout").style.display = "flex";
        document.getElementById("meta-name").textContent = file.name; document.getElementById("meta-size").textContent = fmt(file.size); document.getElementById("meta-type").textContent = "application/pdf"; document.getElementById("meta-dims").textContent = r.canvas.width + " × " + r.canvas.height;
        document.getElementById("ro-dims").textContent = r.canvas.width + " × " + r.canvas.height + " px"; document.getElementById("ro-size").textContent = fmt(file.size); document.getElementById("ro-format").textContent = "PDF";
        document.getElementById("t-name").textContent = file.name; document.getElementById("t-name2").textContent = file.name; document.getElementById("t-status").textContent = "готово — PDF прочитан локально"; document.getElementById("t-dims").textContent = r.canvas.width + "x" + r.canvas.height + " px, PDF"; document.getElementById("t-size").textContent = fmt(file.size);
        setStatus("PDF загружен: " + r.pages + " стр. · обработка без сети"); document.querySelectorAll(".result").forEach((e) => e.classList.remove("show"));
      } catch (e) { console.error("Safelight PDF:", e); setStatus("Не удалось прочитать PDF: " + (e.message || "неподдерживаемая структура")); }
    }

    fileInput.addEventListener("change", (e) => { const f = e.target.files && e.target.files[0]; if (!isPdf(f)) return; e.stopImmediatePropagation(); e.preventDefault(); handlePdf(f); fileInput.value = ""; }, true);
    dropzone.addEventListener("drop", (e) => { const f = e.dataTransfer.files && e.dataTransfer.files[0]; if (!isPdf(f)) return; e.stopImmediatePropagation(); e.preventDefault(); dropzone.classList.remove("drag"); handlePdf(f); }, true);
  })();
})();
