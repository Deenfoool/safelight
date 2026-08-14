(function () {
  "use strict";

  if (window.safelightDirectManipulationLoaded) return;
  window.safelightDirectManipulationLoaded = true;

  const $ = (id) => document.getElementById(id);
  const sliceState = { vertical: [], horizontal: [], rows: 0, cols: 0, mode: "grid" };
  const watermarkState = { x: 0.78, y: 0.82, fill: false };
  let overlay = null;
  let activeDrag = null;
  let transformSummary = null;

  function currentTool() {
    const panel = document.querySelector("#sl-inspector-panels .panel.active") || document.querySelector(".panel.active");
    return panel ? panel.id.replace("panel-", "") : null;
  }

  function sourceImageElement() {
    return $("previewImg");
  }

  function sourceReady() {
    const image = sourceImageElement();
    return !!(image && image.src);
  }

  function imageFrom(src) {
    return new Promise((resolve, reject) => {
      const image = new Image();
      image.onload = () => resolve(image);
      image.onerror = () => reject(new Error("Не удалось открыть исходное изображение"));
      image.src = src;
    });
  }

  function canvasBlob(canvas, type, quality) {
    return new Promise((resolve, reject) => canvas.toBlob((blob) => blob ? resolve(blob) : reject(new Error("Не удалось подготовить файл")), type, quality));
  }

  function mimeFor(format) {
    if (format === "png") return "image/png";
    if (format === "webp") return "image/webp";
    return "image/jpeg";
  }

  function extFor(format) {
    return format === "jpeg" ? "jpg" : format;
  }

  function baseName() {
    return (($("meta-name")?.textContent || "safelight").trim().replace(/\.[^.]+$/, "") || "safelight");
  }

  function download(blob, filename) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 4000);
  }

  function getOverlay() {
    const wrap = $("previewWrap");
    if (!wrap) return null;
    if (!overlay || !overlay.isConnected) {
      overlay = document.createElement("div");
      overlay.className = "sl-direct-overlay";
      wrap.appendChild(overlay);
    }
    return overlay;
  }

  function targetRect() {
    const image = sourceImageElement();
    const wrap = $("previewWrap");
    if (!image || !wrap) return null;
    const imageRect = image.getBoundingClientRect();
    const wrapRect = wrap.getBoundingClientRect();
    if (!imageRect.width || !imageRect.height) return null;
    return {
      left: imageRect.left - wrapRect.left,
      top: imageRect.top - wrapRect.top,
      width: imageRect.width,
      height: imageRect.height,
      page: imageRect
    };
  }

  function evenlySpaced(count) {
    return Array.from({ length: Math.max(0, count - 1) }, (_, index) => (index + 1) / count);
  }

  function currentSliceCounts() {
    let rows = Math.max(1, Math.min(20, Number($("s-rows")?.value) || 1));
    let cols = Math.max(1, Math.min(20, Number($("s-cols")?.value) || 1));
    const mode = window.sliceMode || "grid";
    if (mode === "horizontal") cols = 1;
    if (mode === "vertical") rows = 1;
    return { rows, cols, mode };
  }

  function ensureSliceState(force) {
    const { rows, cols, mode } = currentSliceCounts();
    if (force || sliceState.rows !== rows || sliceState.cols !== cols || sliceState.mode !== mode) {
      sliceState.rows = rows;
      sliceState.cols = cols;
      sliceState.mode = mode;
      sliceState.vertical = evenlySpaced(cols);
      sliceState.horizontal = evenlySpaced(rows);
    }
  }

  function clampLine(list, index, value) {
    const gap = 0.025;
    const min = index === 0 ? gap : list[index - 1] + gap;
    const max = index === list.length - 1 ? 1 - gap : list[index + 1] - gap;
    return Math.max(min, Math.min(max, value));
  }

  function createSliceLine(direction, index, value, rect) {
    const line = document.createElement("button");
    line.type = "button";
    line.className = "sl-slice-guide " + direction;
    line.dataset.direction = direction;
    line.dataset.index = String(index);
    line.setAttribute("aria-label", direction === "vertical" ? "Переместить вертикальную линию" : "Переместить горизонтальную линию");
    if (direction === "vertical") {
      line.style.left = rect.left + rect.width * value + "px";
      line.style.top = rect.top + "px";
      line.style.height = rect.height + "px";
    } else {
      line.style.left = rect.left + "px";
      line.style.top = rect.top + rect.height * value + "px";
      line.style.width = rect.width + "px";
    }
    line.addEventListener("pointerdown", (event) => {
      event.preventDefault();
      event.stopPropagation();
      activeDrag = { type: "slice", direction, index };
      line.setPointerCapture?.(event.pointerId);
      document.body.classList.add("sl-dragging-guide");
    });
    return line;
  }

  function renderSliceOverlay() {
    const host = getOverlay();
    if (!host) return;
    host.innerHTML = "";
    if (currentTool() !== "slice" || !sourceReady()) return;
    ensureSliceState(false);
    const rect = targetRect();
    if (!rect) return;
    const frame = document.createElement("div");
    frame.className = "sl-slice-frame";
    frame.style.left = rect.left + "px";
    frame.style.top = rect.top + "px";
    frame.style.width = rect.width + "px";
    frame.style.height = rect.height + "px";
    host.appendChild(frame);
    sliceState.vertical.forEach((value, index) => host.appendChild(createSliceLine("vertical", index, value, rect)));
    sliceState.horizontal.forEach((value, index) => host.appendChild(createSliceLine("horizontal", index, value, rect)));
  }

  function watermarkFontSize(rect) {
    const image = sourceImageElement();
    const sourceWidth = image?.naturalWidth || rect.width;
    const size = Math.max(8, Math.min(1000, Number($("wm-size")?.value) || 48));
    return Math.max(9, size * (rect.width / Math.max(1, sourceWidth)));
  }

  function watermarkText() {
    return (($("wm-text")?.value || "Safelight").trim() || "Safelight");
  }

  function watermarkOpacity() {
    return Math.max(1, Math.min(100, Number($("wm-opacity")?.value) || 45)) / 100;
  }

  function renderWatermarkOverlay() {
    const host = getOverlay();
    if (!host) return;
    host.innerHTML = "";
    if (currentTool() !== "watermark" || !sourceReady()) return;
    const rect = targetRect();
    if (!rect) return;
    const text = watermarkText();
    const fontSize = watermarkFontSize(rect);
    const opacity = watermarkOpacity();

    if (watermarkState.fill) {
      const fill = document.createElement("div");
      fill.className = "sl-watermark-fill";
      fill.style.left = rect.left + "px";
      fill.style.top = rect.top + "px";
      fill.style.width = rect.width + "px";
      fill.style.height = rect.height + "px";
      const cols = Math.max(3, Math.ceil(rect.width / Math.max(130, fontSize * 5.5)));
      const rows = Math.max(3, Math.ceil(rect.height / Math.max(90, fontSize * 3.5)));
      for (let row = 0; row < rows; row++) {
        for (let col = 0; col < cols; col++) {
          const span = document.createElement("span");
          span.textContent = text;
          span.style.fontSize = fontSize + "px";
          span.style.opacity = String(opacity);
          span.style.left = ((col + 0.5) / cols) * 100 + "%";
          span.style.top = ((row + 0.5) / rows) * 100 + "%";
          fill.appendChild(span);
        }
      }
      host.appendChild(fill);
      return;
    }

    const drag = document.createElement("button");
    drag.type = "button";
    drag.className = "sl-watermark-drag";
    drag.textContent = text;
    drag.style.left = rect.left + rect.width * watermarkState.x + "px";
    drag.style.top = rect.top + rect.height * watermarkState.y + "px";
    drag.style.fontSize = fontSize + "px";
    drag.style.opacity = String(opacity);
    drag.setAttribute("aria-label", "Перетащить водяной знак");
    drag.addEventListener("pointerdown", (event) => {
      event.preventDefault();
      event.stopPropagation();
      activeDrag = { type: "watermark" };
      drag.setPointerCapture?.(event.pointerId);
      document.body.classList.add("sl-dragging-watermark");
    });
    host.appendChild(drag);
  }

  function renderInteractiveOverlay() {
    const wrap = $("previewWrap");
    if (!wrap) return;
    const tool = currentTool();
    wrap.classList.toggle("sl-interactive-slice", tool === "slice");
    wrap.classList.toggle("sl-interactive-watermark", tool === "watermark");
    if (tool === "slice") renderSliceOverlay();
    else if (tool === "watermark") renderWatermarkOverlay();
    else if (overlay) overlay.innerHTML = "";
  }

  function onPointerMove(event) {
    if (!activeDrag) return;
    const rect = targetRect();
    if (!rect) return;
    if (activeDrag.type === "slice") {
      const list = activeDrag.direction === "vertical" ? sliceState.vertical : sliceState.horizontal;
      const raw = activeDrag.direction === "vertical"
        ? (event.clientX - rect.page.left) / rect.page.width
        : (event.clientY - rect.page.top) / rect.page.height;
      list[activeDrag.index] = clampLine(list, activeDrag.index, raw);
      renderSliceOverlay();
      return;
    }
    if (activeDrag.type === "watermark") {
      watermarkState.x = Math.max(0.02, Math.min(0.98, (event.clientX - rect.page.left) / rect.page.width));
      watermarkState.y = Math.max(0.02, Math.min(0.98, (event.clientY - rect.page.top) / rect.page.height));
      renderWatermarkOverlay();
    }
  }

  function stopPointerDrag() {
    activeDrag = null;
    document.body.classList.remove("sl-dragging-guide", "sl-dragging-watermark");
  }

  function installWatermarkMode() {
    const panel = $("panel-watermark");
    if (!panel || $("wm-fill")) return;
    const position = $("wm-pos");
    position?.closest(".field")?.classList.add("sl-hidden-position-field");
    const row = document.createElement("label");
    row.className = "sl-wm-fill-row";
    row.innerHTML = '<input id="wm-fill" type="checkbox"><span><b>Заполнить всё изображение</b><small>Повторить водяной знак по всей площади вместо одного перетаскиваемого элемента.</small></span>';
    const anchor = panel.querySelector(".field-row") || panel.querySelector(".panel-card");
    anchor.insertAdjacentElement("afterend", row);
    $("wm-fill").addEventListener("change", (event) => {
      watermarkState.fill = event.target.checked;
      renderWatermarkOverlay();
    });
    ["wm-text", "wm-size", "wm-opacity"].forEach((id) => {
      $(id)?.addEventListener("input", renderWatermarkOverlay);
      $(id)?.addEventListener("change", renderWatermarkOverlay);
    });
  }

  function polishTransform() {
    const panel = $("panel-transform");
    const actions = panel?.querySelector(".transform-actions");
    if (!panel || !actions || actions.dataset.polished === "1") return;
    actions.dataset.polished = "1";

    const buttons = {};
    actions.querySelectorAll("[data-tr]").forEach((button) => buttons[button.dataset.tr] = button);
    const shell = document.createElement("div");
    shell.className = "sl-transform-shell";
    const rotate = document.createElement("div");
    rotate.className = "sl-transform-block";
    rotate.innerHTML = '<div class="sl-transform-label"><span>Поворот</span><b id="sl-transform-angle">0°</b></div><div class="sl-transform-grid rotate"></div>';
    const rotateGrid = rotate.querySelector(".sl-transform-grid");
    [["ccw", "↶", "90° влево"], ["cw", "↷", "90° вправо"], ["180", "↻", "180°"]].forEach(([key, icon, label]) => {
      const button = buttons[key];
      if (!button) return;
      button.innerHTML = `<span class="sl-tr-symbol">${icon}</span><span>${label}</span>`;
      rotateGrid.appendChild(button);
    });

    const flip = document.createElement("div");
    flip.className = "sl-transform-block";
    flip.innerHTML = '<div class="sl-transform-label"><span>Отражение</span><b>переключатели</b></div><div class="sl-transform-grid flip"></div>';
    const flipGrid = flip.querySelector(".sl-transform-grid");
    [["h", "↔", "По горизонтали"], ["v", "↕", "По вертикали"]].forEach(([key, icon, label]) => {
      const button = buttons[key];
      if (!button) return;
      button.innerHTML = `<span class="sl-tr-symbol">${icon}</span><span>${label}</span>`;
      flipGrid.appendChild(button);
    });

    shell.append(rotate, flip);
    actions.replaceWith(shell);
    transformSummary = rotate.querySelector("#sl-transform-angle");
    panel.addEventListener("click", (event) => {
      if (!event.target.closest("[data-tr]")) return;
      setTimeout(updateTransformVisuals, 0);
    });
    updateTransformVisuals();
  }

  function updateTransformVisuals() {
    const state = window.safelightTransformState || { angle: 0, h: false, v: false };
    if (transformSummary) transformSummary.textContent = (Number(state.angle) || 0) + "°";
    const panel = $("panel-transform");
    panel?.querySelector('[data-tr="h"]')?.classList.toggle("active", !!state.h);
    panel?.querySelector('[data-tr="v"]')?.classList.toggle("active", !!state.v);
  }

  function moveExportIntoInspector() {
    const inspector = document.querySelector(".sl-inspector");
    const note = inspector?.querySelector(".sl-inspector-note");
    const wrap = document.querySelector(".sl-export-wrap");
    if (!inspector || !note || !wrap || wrap.classList.contains("sl-inspector-export")) return false;
    wrap.classList.add("sl-inspector-export");
    note.parentNode.insertBefore(wrap, note);
    const text = note.querySelector("span");
    if (text) text.innerHTML = '<b>Оригинал остаётся неизменным</b>Все действия выполняются над рабочим результатом. Исходный файл не перезаписывается, пока вы сами не сохраните экспорт.';
    return true;
  }

  async function ensureJsPdf() {
    if (window.jspdf?.jsPDF) return true;
    const load = (src) => new Promise((resolve, reject) => {
      const script = document.createElement("script");
      script.src = src;
      script.onload = resolve;
      script.onerror = reject;
      document.head.appendChild(script);
    });
    try { await load("./vendor/jspdf.umd.min.js"); }
    catch (_) {
      try { await load("https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.2/jspdf.umd.min.js"); }
      catch (_) { return false; }
    }
    return !!window.jspdf?.jsPDF;
  }

  async function exportCanvas(canvas, format, suffix) {
    if (format === "pdf") {
      if (!(await ensureJsPdf())) throw new Error("PDF модуль не загрузился");
      const { jsPDF } = window.jspdf;
      const orientation = canvas.width > canvas.height ? "landscape" : "portrait";
      const doc = new jsPDF({ orientation, unit: "mm", format: "a4" });
      const pageW = doc.internal.pageSize.getWidth(), pageH = doc.internal.pageSize.getHeight(), margin = 10;
      const scale = Math.min((pageW - margin * 2) / canvas.width, (pageH - margin * 2) / canvas.height);
      const width = canvas.width * scale, height = canvas.height * scale;
      doc.addImage(canvas.toDataURL("image/jpeg", 0.94), "JPEG", (pageW - width) / 2, (pageH - height) / 2, width, height, undefined, "FAST");
      download(doc.output("blob"), baseName() + suffix + ".pdf");
      return;
    }
    let output = canvas;
    if (format === "jpeg") {
      output = document.createElement("canvas");
      output.width = canvas.width; output.height = canvas.height;
      const ctx = output.getContext("2d");
      ctx.fillStyle = "#fff"; ctx.fillRect(0, 0, output.width, output.height); ctx.drawImage(canvas, 0, 0);
    }
    download(await canvasBlob(output, mimeFor(format), format === "png" ? undefined : 0.92), baseName() + suffix + "." + extFor(format));
  }

  function drawWatermark(ctx, width, height) {
    const size = Math.max(8, Math.min(1000, Number($("wm-size")?.value) || 48));
    const text = watermarkText();
    const opacity = watermarkOpacity();
    ctx.save();
    ctx.font = `600 ${size}px Inter,Arial,sans-serif`;
    ctx.fillStyle = `rgba(255,255,255,${opacity})`;
    ctx.shadowColor = "rgba(0,0,0,.55)";
    ctx.shadowBlur = Math.max(2, size / 10);
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";

    if (!watermarkState.fill) {
      ctx.fillText(text, watermarkState.x * width, watermarkState.y * height);
      ctx.restore();
      return;
    }

    const metrics = ctx.measureText(text);
    const stepX = Math.max(metrics.width + size * 2.4, size * 7);
    const stepY = size * 3.4;
    const diagonal = Math.hypot(width, height);
    ctx.translate(width / 2, height / 2);
    ctx.rotate(-Math.PI / 6);
    for (let y = -diagonal; y <= diagonal; y += stepY) {
      for (let x = -diagonal; x <= diagonal; x += stepX) {
        ctx.fillText(text, x, y);
      }
    }
    ctx.restore();
  }

  async function exportWatermark(format) {
    const image = await imageFrom(sourceImageElement().src);
    const canvas = document.createElement("canvas");
    canvas.width = image.naturalWidth; canvas.height = image.naturalHeight;
    const ctx = canvas.getContext("2d");
    ctx.drawImage(image, 0, 0);
    drawWatermark(ctx, canvas.width, canvas.height);
    await exportCanvas(canvas, format, "-watermark");
  }

  function sliceBoundaries() {
    ensureSliceState(false);
    return {
      x: [0, ...sliceState.vertical, 1],
      y: [0, ...sliceState.horizontal, 1]
    };
  }

  async function exportSlice(format) {
    if (!window.JSZip) throw new Error("ZIP модуль не загрузился");
    const image = await imageFrom(sourceImageElement().src);
    const { x, y } = sliceBoundaries();
    const zip = new JSZip();
    for (let row = 0; row < y.length - 1; row++) {
      for (let col = 0; col < x.length - 1; col++) {
        const x0 = Math.round(x[col] * image.naturalWidth), x1 = Math.round(x[col + 1] * image.naturalWidth);
        const y0 = Math.round(y[row] * image.naturalHeight), y1 = Math.round(y[row + 1] * image.naturalHeight);
        const tile = document.createElement("canvas");
        tile.width = Math.max(1, x1 - x0); tile.height = Math.max(1, y1 - y0);
        tile.getContext("2d").drawImage(image, x0, y0, tile.width, tile.height, 0, 0, tile.width, tile.height);
        const blob = await canvasBlob(tile, mimeFor(format), format === "png" ? undefined : 0.92);
        zip.file(`${baseName()}-${row + 1}-${col + 1}.${extFor(format)}`, blob);
      }
    }
    download(await zip.generateAsync({ type: "blob" }), baseName() + "-tiles.zip");
  }

  function showHint(text) {
    const hint = $("sl-export-hint");
    if (!hint) return;
    hint.textContent = text;
    hint.classList.add("show");
    clearTimeout(showHint.timer);
    showHint.timer = setTimeout(() => hint.classList.remove("show"), 2800);
  }

  function interceptSpecialExports() {
    document.addEventListener("click", async (event) => {
      const option = event.target.closest(".sl-export-option[data-export]");
      if (!option) return;
      const tool = currentTool();
      if (tool !== "slice" && tool !== "watermark") return;
      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation();
      option.closest(".sl-export-wrap")?.classList.remove("open");
      try {
        if (!sourceReady()) throw new Error("Сначала загрузите изображение");
        const value = option.dataset.export;
        if (tool === "slice") await exportSlice(value.replace(/^slice-/, ""));
        else await exportWatermark(value);
        showHint("Экспорт готов.");
      } catch (error) {
        console.error("Safelight direct export:", error);
        showHint(error.message || "Не удалось экспортировать файл");
      }
    }, true);
  }

  function bindInspector() {
    const inspector = document.querySelector(".sl-inspector");
    if (!inspector) return;
    inspector.addEventListener("input", (event) => {
      if (currentTool() === "slice" && event.target.matches("#s-rows,#s-cols")) {
        ensureSliceState(true);
        requestAnimationFrame(renderSliceOverlay);
      }
      if (currentTool() === "watermark" && event.target.matches("#wm-text,#wm-size,#wm-opacity")) requestAnimationFrame(renderWatermarkOverlay);
    }, true);
    inspector.addEventListener("click", (event) => {
      if (event.target.closest("#s-mode button")) setTimeout(() => { ensureSliceState(true); renderSliceOverlay(); }, 0);
    });
  }

  function boot() {
    if (!document.querySelector(".sl-app") || !document.querySelector(".sl-export-wrap") || !$("previewWrap")) {
      setTimeout(boot, 50);
      return;
    }
    installWatermarkMode();
    polishTransform();
    moveExportIntoInspector();
    interceptSpecialExports();
    bindInspector();

    document.addEventListener("pointermove", onPointerMove, { passive: true });
    document.addEventListener("pointerup", stopPointerDrag);
    document.addEventListener("pointercancel", stopPointerDrag);
    window.addEventListener("resize", () => requestAnimationFrame(renderInteractiveOverlay), { passive: true });
    window.addEventListener("safelight:toolchange", () => setTimeout(() => {
      moveExportIntoInspector();
      updateTransformVisuals();
      renderInteractiveOverlay();
    }, 0));
    window.addEventListener("safelight:live-render", () => requestAnimationFrame(renderInteractiveOverlay));
    new MutationObserver(() => requestAnimationFrame(renderInteractiveOverlay)).observe(sourceImageElement(), { attributes: true, attributeFilter: ["src"] });
    renderInteractiveOverlay();
  }

  boot();
})();
