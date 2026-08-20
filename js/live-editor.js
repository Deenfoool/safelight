(function () {
  "use strict";

  if (window.safelightLiveEditorLoaded) return;
  window.safelightLiveEditorLoaded = true;

  let sourceImage = null;
  let previewSource = null;
  let previewScale = 1;
  let sourceSrc = "";
  let renderToken = 0;
  let renderTimer = 0;
  let exportBusy = false;
  const PREVIEW_MAX_SIDE = 1800;
  const PREVIEW_MAX_PIXELS = 2200000;

  const IMAGE_TOOLS = new Set(["compress", "convert", "resize", "crop", "adjust", "transform", "watermark", "slice", "metadata", "favicon"]);
  const $ = (id) => document.getElementById(id);

  function currentTool() {
    const panel = document.querySelector("#sl-inspector-panels .panel.active") || document.querySelector(".panel.active");
    return panel ? panel.id.replace("panel-", "") : "compress";
  }
  function mimeFor(format) { if (format === "png") return "image/png"; if (format === "webp") return "image/webp"; return "image/jpeg"; }
  function extFor(format) { return format === "jpeg" ? "jpg" : format; }
  function qualityForTool(tool) {
    const map = { compress: "c-quality", convert: "v-quality" };
    const id = map[tool];
    if (!id) return 0.92;
    return Math.max(0.01, Math.min(1, (Number($(id)?.value) || 92) / 100));
  }
  function baseName() {
    const name = ($("meta-name")?.textContent || "safelight").trim();
    return name.replace(/\.[^.]+$/, "") || "safelight";
  }
  function imageFrom(src) {
    return new Promise((resolve, reject) => {
      const image = new Image();
      image.onload = () => resolve(image);
      image.onerror = () => reject(new Error("Не удалось открыть изображение"));
      image.src = src;
    });
  }
  function canvasBlob(canvas, type, quality) {
    return new Promise((resolve, reject) => canvas.toBlob((blob) => blob ? resolve(blob) : reject(new Error("Не удалось подготовить файл")), type, quality));
  }
  function download(blob, filename) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url; a.download = filename;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 4000);
  }
  function sourceReady() { return !!(sourceImage && sourceImage.naturalWidth && sourceImage.naturalHeight); }
  function sourceSize(input) { return { width: input?.naturalWidth || input?.width || 0, height: input?.naturalHeight || input?.height || 0 }; }
  function capScale(width, height) { return Math.min(1, PREVIEW_MAX_SIDE / Math.max(1, width, height), Math.sqrt(PREVIEW_MAX_PIXELS / Math.max(1, width * height))); }
  function rebuildPreviewSource() {
    if (!sourceReady()) { previewSource = null; previewScale = 1; return; }
    previewScale = capScale(sourceImage.naturalWidth, sourceImage.naturalHeight);
    if (previewScale >= .999) { previewSource = null; previewScale = 1; return; }
    const canvas = document.createElement("canvas"); canvas.width = Math.max(1, Math.round(sourceImage.naturalWidth * previewScale)); canvas.height = Math.max(1, Math.round(sourceImage.naturalHeight * previewScale));
    const context = canvas.getContext("2d"); context.imageSmoothingEnabled = true; context.imageSmoothingQuality = "high"; context.drawImage(sourceImage, 0, 0, canvas.width, canvas.height); previewSource = canvas;
  }
  function previewDimensions(width, height, preview) {
    const scale = preview ? capScale(width, height) : 1;
    return { width: Math.max(1, Math.round(width * scale)), height: Math.max(1, Math.round(height * scale)), scale };
  }
  function getLiveCanvas() {
    const wrap = $("previewWrap"); if (!wrap) return null;
    let canvas = $("sl-live-canvas");
    if (!canvas) {
      canvas = document.createElement("canvas"); canvas.id = "sl-live-canvas"; canvas.className = "sl-live-canvas";
      canvas.setAttribute("aria-label", "Текущий результат обработки"); wrap.appendChild(canvas);
    }
    return canvas;
  }
  function clearLiveCanvas() { $("previewWrap")?.classList.remove("sl-live-ready"); }
  function drawSource(canvas, width, height, fillWhite, input) {
    canvas.width = Math.max(1, Math.round(width)); canvas.height = Math.max(1, Math.round(height));
    const ctx = canvas.getContext("2d"); ctx.clearRect(0, 0, canvas.width, canvas.height);
    if (fillWhite) { ctx.fillStyle = "#fff"; ctx.fillRect(0, 0, canvas.width, canvas.height); }
    ctx.drawImage(input || sourceImage, 0, 0, canvas.width, canvas.height); return ctx;
  }
  async function compressionCanvas(quality, input) {
    const size = sourceSize(input), raw = document.createElement("canvas"); drawSource(raw, size.width, size.height, false, input);
    const blob = await canvasBlob(raw, "image/webp", quality); const url = URL.createObjectURL(blob);
    try {
      const compressed = await imageFrom(url); const out = document.createElement("canvas");
      out.width = compressed.naturalWidth; out.height = compressed.naturalHeight; out.getContext("2d").drawImage(compressed, 0, 0); return out;
    } finally { URL.revokeObjectURL(url); }
  }
  function resizeCanvas(input, preview) {
    const width = Math.max(1, Number($("r-width")?.value) || sourceImage.naturalWidth), height = Math.max(1, Number($("r-height")?.value) || sourceImage.naturalHeight), dims = previewDimensions(width, height, preview);
    const out = document.createElement("canvas"); out.width = dims.width; out.height = dims.height;
    const ctx = out.getContext("2d"); ctx.imageSmoothingEnabled = true; ctx.imageSmoothingQuality = "high";
    ctx.drawImage(input, 0, 0, out.width, out.height); return out;
  }
  function cropCanvas(input, preview) {
    const width = Math.min(sourceImage.naturalWidth, Math.max(1, Number($("cr-width")?.value) || sourceImage.naturalWidth));
    const height = Math.min(sourceImage.naturalHeight, Math.max(1, Number($("cr-height")?.value) || sourceImage.naturalHeight));
    let x = Math.floor((sourceImage.naturalWidth - width) / 2); let y = Math.floor((sourceImage.naturalHeight - height) / 2);
    const position = $("cr-position")?.value || "center"; if (position === "top") y = 0; if (position === "bottom") y = sourceImage.naturalHeight - height;
    const inputSize=sourceSize(input),inputScale=inputSize.width/sourceImage.naturalWidth,dims=previewDimensions(width,height,preview),out = document.createElement("canvas"); out.width = dims.width; out.height = dims.height;
    out.getContext("2d").drawImage(input, x*inputScale, y*inputScale, width*inputScale, height*inputScale, 0, 0, out.width, out.height); return out;
  }
  function adjustCanvas(input) {
    const size=sourceSize(input),out = document.createElement("canvas"); out.width = size.width; out.height = size.height;
    const ctx = out.getContext("2d");
    const brightness = Number($("a-bright")?.value || 0), contrast = Number($("a-contrast")?.value || 0), saturation = Number($("a-sat")?.value || 0);
    ctx.filter = `brightness(${100 + brightness}%) contrast(${100 + contrast}%) saturate(${100 + saturation}%)`; ctx.drawImage(input, 0, 0); ctx.filter = "none";
    if ($("a-gray")?.checked) {
      const data = ctx.getImageData(0, 0, out.width, out.height);
      for (let i = 0; i < data.data.length; i += 4) {
        const value = Math.round(0.299 * data.data[i] + 0.587 * data.data[i + 1] + 0.114 * data.data[i + 2]);
        data.data[i] = value; data.data[i + 1] = value; data.data[i + 2] = value;
      }
      ctx.putImageData(data, 0, 0);
    }
    return out;
  }
  function transformCanvas(input) {
    const state = window.safelightTransformState || { angle: 0, h: false, v: false }, angle = Number(state.angle) || 0, swap = angle % 180 !== 0;
    const size=sourceSize(input),out = document.createElement("canvas"); out.width = swap ? size.height : size.width; out.height = swap ? size.width : size.height;
    const ctx = out.getContext("2d"); ctx.translate(out.width / 2, out.height / 2); ctx.rotate((angle * Math.PI) / 180); ctx.scale(state.h ? -1 : 1, state.v ? -1 : 1);
    ctx.drawImage(input, -size.width / 2, -size.height / 2); return out;
  }
  function watermarkCanvas(input) {
    const inputSize=sourceSize(input),sourceRatio=inputSize.width/sourceImage.naturalWidth,out = document.createElement("canvas"); drawSource(out, inputSize.width, inputSize.height, false, input); const ctx = out.getContext("2d");
    const size = Math.max(4, Math.min(1000, Number($("wm-size")?.value) || 48)*sourceRatio);
    const text = ($("wm-text")?.value || "Safelight").trim() || "Safelight";
    const opacity = Math.max(1, Math.min(100, Number($("wm-opacity")?.value) || 45)) / 100;
    const direct = window.safelightDirectState?.watermark?.();
    ctx.font = `600 ${size}px system-ui,Arial,sans-serif`; ctx.fillStyle = `rgba(255,255,255,${opacity})`; ctx.shadowColor = "rgba(0,0,0,.55)"; ctx.shadowBlur = Math.max(2, size / 10);

    if (direct?.fill) {
      const metrics = ctx.measureText(text);
      const stepX = Math.max(metrics.width + size * 2.4, size * 7);
      const stepY = size * 3.4;
      const diagonal = Math.hypot(out.width, out.height);
      ctx.save();
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.translate(out.width / 2, out.height / 2);
      ctx.rotate(-Math.PI / 6);
      for (let y = -diagonal; y <= diagonal; y += stepY) {
        for (let x = -diagonal; x <= diagonal; x += stepX) ctx.fillText(text, x, y);
      }
      ctx.restore();
      return out;
    }

    if (direct) {
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(text, direct.x * out.width, direct.y * out.height);
      return out;
    }

    const position = $("wm-pos")?.value || "br", pad = size * 0.55;
    const metrics = ctx.measureText(text); let x = pad, y = size + pad;
    if (position.includes("r")) x = out.width - metrics.width - pad;
    if (position === "center") { x = (out.width - metrics.width) / 2; y = (out.height + size) / 2; }
    if (position === "br" || position === "bl") y = out.height - pad;
    x = Math.max(0, Math.min(out.width - metrics.width, x)); y = Math.max(size, Math.min(out.height, y)); ctx.fillText(text, x, y); return out;
  }
  function gridBoundaries() {
    let rows = Math.max(1, Math.min(20, Number($("s-rows")?.value) || 1)), cols = Math.max(1, Math.min(20, Number($("s-cols")?.value) || 1));
    if (window.sliceMode === "horizontal") cols = 1; if (window.sliceMode === "vertical") rows = 1;
    return {
      x: Array.from({ length: cols + 1 }, (_, index) => index / cols),
      y: Array.from({ length: rows + 1 }, (_, index) => index / rows)
    };
  }
  function sliceBoundaries() {
    return window.safelightDirectState?.sliceBoundaries?.() || gridBoundaries();
  }
  function sliceCanvas(input) {
    const size=sourceSize(input),out = document.createElement("canvas"); drawSource(out, size.width, size.height, false, input); const ctx = out.getContext("2d");
    const boundaries = sliceBoundaries();
    ctx.save(); ctx.strokeStyle = "rgba(163,230,53,.95)"; ctx.lineWidth = Math.max(1, Math.round(Math.min(out.width, out.height) / 700)); ctx.shadowColor = "rgba(0,0,0,.75)"; ctx.shadowBlur = 2;
    boundaries.x.slice(1, -1).forEach((value) => { const x = out.width * value; ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, out.height); ctx.stroke(); });
    boundaries.y.slice(1, -1).forEach((value) => { const y = out.height * value; ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(out.width, y); ctx.stroke(); });
    ctx.restore(); return out;
  }
  function faviconCanvas(input) {
    const size = 512, out = document.createElement("canvas"); out.width = out.height = size; const ctx = out.getContext("2d");
    ctx.fillStyle = "#fff"; ctx.fillRect(0, 0, size, size);
    const inputSize=sourceSize(input),scale = Math.min(size / inputSize.width, size / inputSize.height), width = inputSize.width * scale, height = inputSize.height * scale;
    ctx.drawImage(input, (size - width) / 2, (size - height) / 2, width, height); return out;
  }
  function drawOriginalCanvas(input) { const size=sourceSize(input),out = document.createElement("canvas"); drawSource(out, size.width, size.height, false, input); return out; }
  async function buildToolCanvas(tool, options) {
    if (!sourceReady()) return null;
    const preview=!!options?.preview,input=preview&&previewSource?previewSource:sourceImage;
    if (tool === "compress") return compressionCanvas(qualityForTool(tool),input);
    if (tool === "convert") return drawOriginalCanvas(input);
    if (tool === "resize") return resizeCanvas(input,preview); if (tool === "crop") return cropCanvas(input,preview); if (tool === "adjust") return adjustCanvas(input);
    if (tool === "transform") return transformCanvas(input); if (tool === "watermark") return watermarkCanvas(input); if (tool === "slice") return sliceCanvas(input);
    if (tool === "favicon") return faviconCanvas(input); return drawOriginalCanvas(input);
  }
  function fullResultDimensions(tool) {
    let width=sourceImage?.naturalWidth||1,height=sourceImage?.naturalHeight||1;
    if(tool==='resize'){width=Math.max(1,Math.round(Number($("r-width")?.value)||width));height=Math.max(1,Math.round(Number($("r-height")?.value)||height))}
    if(tool==='transform'&&(Number(window.safelightTransformState?.angle)||0)%180!==0)[width,height]=[height,width];
    if(tool==='favicon')width=height=512;return{width,height}
  }
  function updateReadout(canvas,tool) {
    if (!canvas) return; const full=fullResultDimensions(tool);if ($("ro-dims")) $("ro-dims").textContent = full.width + " × " + full.height + " px";
    if ($("ro-format")) $("ro-format").textContent = currentTool() === "favicon" ? "ICON" : "LIVE";
  }
  async function renderNow() {
    const token = ++renderToken, tool = currentTool();
    if (!IMAGE_TOOLS.has(tool)) return;
    if (!sourceReady()) { clearLiveCanvas(); return; }
    try {
      const built = await buildToolCanvas(tool,{preview:true}); if (!built || token !== renderToken) return;
      const live = getLiveCanvas(); live.width = built.width; live.height = built.height;
      const ctx = live.getContext("2d"); ctx.clearRect(0, 0, live.width, live.height); ctx.drawImage(built, 0, 0);
      $("previewWrap")?.classList.add("sl-live-ready"); updateReadout(live,tool);const full=fullResultDimensions(tool);
      window.dispatchEvent(new CustomEvent("safelight:live-render", { detail: { tool, width: full.width, height: full.height, previewWidth: live.width, previewHeight: live.height, optimized: live.width!==full.width||live.height!==full.height } }));
    } catch (error) { console.error("Safelight live render:", error); }
  }
  function scheduleRender(delay) { clearTimeout(renderTimer); renderTimer = setTimeout(renderNow, delay == null ? 55 : delay); }
  async function syncSource() {
    const preview = $("previewImg"); if (!preview?.src || preview.src === sourceSrc) return;
    sourceSrc = preview.src; clearLiveCanvas();
    try { sourceImage = await imageFrom(sourceSrc); rebuildPreviewSource(); scheduleRender(0); } catch (error) { sourceImage = null; previewSource=null;previewScale=1;console.error("Safelight source:", error); }
  }
  function installLiveState() {
    const inspector = document.querySelector(".sl-inspector"), panels = $("sl-inspector-panels"); if (!inspector || !panels || $("sl-live-state")) return;
    const state = document.createElement("div"); state.id = "sl-live-state"; state.className = "sl-live-state";
    state.innerHTML = '<i></i><span><b>Изменения применяются сразу.</b> Центральное изображение показывает текущий результат. Исходный файл остаётся нетронутым до экспорта.</span>';
    panels.insertAdjacentElement("beforebegin", state);
    const note = inspector.querySelector(".sl-inspector-note span"); if (note) note.innerHTML = '<b>Оригинал остаётся неизменным</b>Каждый инструмент строит результат от исходного файла. Скачивание выполняется только через «Экспорт».';
  }
  function metadataExportItems() {
    if (typeof window.safelightMetadataExportItems === "function") return window.safelightMetadataExportItems();
    return [
      { value: "jpeg", label: "JPEG", meta: "выборочная очистка" },
      { value: "webp", label: "WebP", meta: "чистый файл" },
      { value: "png", label: "PNG", meta: "чистый файл" }
    ];
  }
  function exportMenuItems(tool) {
    if (tool === "favicon") return [{ value: "favicon-zip", label: "Favicon пакет", meta: "ZIP" }];
    if (tool === "slice") return [{ value: "slice-webp", label: "Нарезка WebP", meta: "ZIP" }, { value: "slice-jpeg", label: "Нарезка JPEG", meta: "ZIP" }, { value: "slice-png", label: "Нарезка PNG", meta: "ZIP" }];
    if (tool === "batch") return window.safelightBatchTools?.menuItems?.() || [{ value: "batch-zip", label: "Скачать ZIP", meta: "пакет" }];
    if (tool === "metadata") return metadataExportItems();
    const items = [{ value: "webp", label: "WebP", meta: "оптимально" }, { value: "jpeg", label: "JPEG", meta: "совместимо" }, { value: "png", label: "PNG", meta: "без потерь" }];
    if (tool === "convert") items.push({ value: "heic", label: "HEIC", meta: "HEVC" });
    items.push({ value: "pdf", label: "PDF", meta: "документ" });
    return items;
  }
  function normalizeExportLabel(button) {
    const label = button?.querySelector("span");
    if (label) label.textContent = "Экспорт";
  }
  function installExportMenu() {
    const button = $("sl-export"); if (!button || button.dataset.liveExport === "1") return; button.dataset.liveExport = "1";
    normalizeExportLabel(button);
    button.innerHTML = button.innerHTML.replace("</span>", '</span><span class="sl-export-caret">⌄</span>');
    const wrap = document.createElement("div"); wrap.className = "sl-export-wrap"; button.parentNode.insertBefore(wrap, button); wrap.appendChild(button);
    const menu = document.createElement("div"); menu.className = "sl-export-menu"; wrap.appendChild(menu);
    function renderMenu() {
      const tool = currentTool();
      const items = exportMenuItems(tool);
      const title = tool === "metadata" ? "Экспорт без лишних данных" : "Экспорт результата";
      const note = tool === "metadata" ? "JPEG учитывает выбранные категории очистки. PNG и WebP создаются без исходных метаданных." : "Файл создаётся локально. Оригинал не изменяется.";
      menu.innerHTML = '<div class="sl-export-menu-title">' + title + '</div>' + items.map((item) => `<button class="sl-export-option" type="button" data-export="${item.value}"><span>${item.label}</span><span>${item.meta}</span></button>`).join("") + '<div class="sl-export-sep"></div><div class="sl-export-menu-note">' + note + '</div>';
    }
    button.addEventListener("click", (event) => { event.preventDefault(); event.stopImmediatePropagation(); if (button.disabled) return; normalizeExportLabel(button); renderMenu(); wrap.classList.toggle("open"); }, true);
    menu.addEventListener("click", async (event) => { const option = event.target.closest("[data-export]"); if (!option) return; event.preventDefault(); wrap.classList.remove("open"); await exportCurrent(option.dataset.export); });
    document.addEventListener("click", (event) => { if (!event.target.closest(".sl-export-wrap")) wrap.classList.remove("open"); });
    window.addEventListener("safelight:toolchange", () => { wrap.classList.remove("open"); setTimeout(() => normalizeExportLabel(button), 0); });
  }
  async function ensureJsPdf() {
    if (window.jspdf?.jsPDF) return true;
    return false;
  }
  async function exportImage(format) {
    const canvas = await buildToolCanvas(currentTool(), { preview: false });
    if (!canvas) throw new Error("Нет изображения для экспорта");
    if (format === "heic") {
      const encoder = window.safelightHeicCodec?.encodeCanvas;
      if (typeof encoder !== "function") throw new Error("Локальный HEIC WASM-кодек не загрузился");
      const blob = await encoder(canvas);
      download(blob, baseName() + "-safelight.heic");
      return;
    }
    if (format === "pdf") {
      if (!(await ensureJsPdf())) throw new Error("Локальный PDF-модуль не загрузился");
      const { jsPDF } = window.jspdf, orientation = canvas.width > canvas.height ? "landscape" : "portrait";
      const doc = new jsPDF({ orientation, unit: "mm", format: "a4" }), pageW = doc.internal.pageSize.getWidth(), pageH = doc.internal.pageSize.getHeight(), margin = 10;
      const scale = Math.min((pageW - margin * 2) / canvas.width, (pageH - margin * 2) / canvas.height), w = canvas.width * scale, h = canvas.height * scale;
      const jpeg = canvas.toDataURL("image/jpeg", 0.94); doc.addImage(jpeg, "JPEG", (pageW - w) / 2, (pageH - h) / 2, w, h, undefined, "FAST");
      download(doc.output("blob"), baseName() + "-safelight.pdf"); return;
    }
    let output = canvas;
    if (format === "jpeg") {
      const opaque = document.createElement("canvas"); opaque.width = output.width; opaque.height = output.height; const ctx = opaque.getContext("2d");
      ctx.fillStyle = "#fff"; ctx.fillRect(0, 0, opaque.width, opaque.height); ctx.drawImage(canvas, 0, 0);
      output = opaque;
    }
    const blob = await canvasBlob(output, mimeFor(format), format === "png" ? undefined : qualityForTool(currentTool()));
    download(blob, baseName() + "-safelight." + extFor(format));
  }
  async function exportSlice(format) {
    if (!window.JSZip) throw new Error("Локальный ZIP-модуль не загрузился");
    const boundaries = sliceBoundaries();
    const width = sourceImage.naturalWidth, height = sourceImage.naturalHeight;
    const quality = Math.max(0.01, Math.min(1, (Number($("s-quality")?.value) || 90) / 100));
    const zip = new JSZip();
    for (let row = 0; row < boundaries.y.length - 1; row++) {
      for (let col = 0; col < boundaries.x.length - 1; col++) {
        const x0 = Math.round(boundaries.x[col] * width), x1 = Math.round(boundaries.x[col + 1] * width);
        const y0 = Math.round(boundaries.y[row] * height), y1 = Math.round(boundaries.y[row + 1] * height);
        const tile = document.createElement("canvas"); tile.width = Math.max(1, x1 - x0); tile.height = Math.max(1, y1 - y0);
        tile.getContext("2d").drawImage(sourceImage, x0, y0, tile.width, tile.height, 0, 0, tile.width, tile.height);
        zip.file(`${baseName()}-${row + 1}-${col + 1}.${extFor(format)}`, await canvasBlob(tile, mimeFor(format), format === "png" ? undefined : quality));
      }
    }
    download(await zip.generateAsync({ type: "blob" }), baseName() + "-tiles.zip");
  }
  async function exportBatch(format) {
    if (typeof window.safelightBatchTools?.export !== "function") throw new Error("Модуль пакетной обработки не загрузился");
    return window.safelightBatchTools.export(format);
  }
  async function exportFavicon() {
    if (!window.JSZip) throw new Error("Локальный ZIP-модуль не загрузился"); const zip = new JSZip();
    for (const size of [16, 32, 48, 180, 192, 512]) {
      const canvas = document.createElement("canvas"); canvas.width = canvas.height = size; const ctx = canvas.getContext("2d"); ctx.fillStyle = "#fff"; ctx.fillRect(0, 0, size, size);
      const scale = Math.min(size / sourceImage.naturalWidth, size / sourceImage.naturalHeight), width = sourceImage.naturalWidth * scale, height = sourceImage.naturalHeight * scale;
      ctx.drawImage(sourceImage, (size - width) / 2, (size - height) / 2, width, height); zip.file("favicon-" + size + ".png", await canvasBlob(canvas, "image/png"));
    }
    download(await zip.generateAsync({ type: "blob" }), "safelight-favicon-pack.zip");
  }
  function showHint(text) {
    const hint = $("sl-export-hint"); if (!hint) return; hint.textContent = text; hint.classList.add("show"); clearTimeout(showHint.timer); showHint.timer = setTimeout(() => hint.classList.remove("show"), 3000);
  }
  async function exportCurrent(value) {
    if (exportBusy) return; exportBusy = true; const button = $("sl-export"); if (button) button.disabled = true;
    try {
      if (currentTool() === "metadata" && typeof window.safelightMetadataExport === "function") {
        await window.safelightMetadataExport(value);
        showHint("Метаданные обработаны. Экспорт готов.");
        return;
      }
      if (value.startsWith("batch-")) await exportBatch(value.slice(6));
      else {
        if (!sourceReady()) throw new Error("Сначала загрузите изображение");
        if (value === "favicon-zip") await exportFavicon(); else if (value.startsWith("slice-")) await exportSlice(value.slice(6)); else await exportImage(value);
      }
      showHint("Экспорт готов.");
    } catch (error) { console.error("Safelight export:", error); showHint(error.message || "Не удалось экспортировать файл"); }
    finally {
      exportBusy = false;
      if (button) button.disabled = currentTool() === "batch" ? !window.safelightBatchTools?.hasFiles?.() : !sourceReady();
    }
  }
  function bindControls() {
    const inspector = document.querySelector(".sl-inspector"); if (!inspector) return;
    const ownsCurrentTool = () => IMAGE_TOOLS.has(currentTool());
    inspector.addEventListener("input", (event) => { if (ownsCurrentTool() && event.target.matches("input,select,textarea")) scheduleRender(); }, true);
    inspector.addEventListener("change", (event) => { if (ownsCurrentTool() && event.target.matches("input,select,textarea")) scheduleRender(0); }, true);
    inspector.addEventListener("click", (event) => { if (ownsCurrentTool() && event.target.closest("[data-tr],#s-mode button")) setTimeout(() => scheduleRender(0), 0); });
    window.addEventListener("safelight:toolchange", () => setTimeout(() => { if (ownsCurrentTool()) scheduleRender(0); }, 0));
    window.addEventListener("safelight:direct-state", () => { if (ownsCurrentTool()) scheduleRender(0); });
  }
  function watchSource() {
    const preview = $("previewImg"); if (!preview) return;
    new MutationObserver(syncSource).observe(preview, { attributes: true, attributeFilter: ["src"] }); if (preview.src) syncSource();
  }
  function boot() {
    if (!document.querySelector(".sl-app") || !$("previewImg")) { setTimeout(boot, 50); return; }
    installLiveState(); installExportMenu(); bindControls(); watchSource();
  }
  window.safelightLiveEditor = Object.freeze({
    renderFull: (tool) => buildToolCanvas(tool || currentTool(), { preview: false }),
    renderPreview: renderNow,
    performance: () => ({
      sourceWidth: sourceImage?.naturalWidth || 0,
      sourceHeight: sourceImage?.naturalHeight || 0,
      previewWidth: previewSource?.width || sourceImage?.naturalWidth || 0,
      previewHeight: previewSource?.height || sourceImage?.naturalHeight || 0,
      previewScale,
      optimized: previewScale < 1
    })
  });
  boot();
})();
