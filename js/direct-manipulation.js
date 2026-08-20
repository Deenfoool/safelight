(function () {
  "use strict";

  if (window.safelightDirectManipulationLoaded) return;
  window.safelightDirectManipulationLoaded = true;

  const $ = (id) => document.getElementById(id);
  const sliceState = { vertical: [], horizontal: [], rows: 0, cols: 0, mode: "grid" };
  const watermarkState = { x: 0.78, y: 0.82, fill: false, kind: "text", assetUrl: "", assetName: "" };
  let overlay = null;
  let activeDrag = null;
  let transformSummary = null;

  function currentTool() {
    const panel = document.querySelector("#sl-inspector-panels .panel.active") || document.querySelector(".panel.active");
    return panel ? panel.id.replace("panel-", "") : null;
  }

  function sourceImageElement() { return $("previewImg"); }
  function sourceReady() { const image = sourceImageElement(); return !!(image && image.src); }

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
    const image = sourceImageElement(), wrap = $("previewWrap");
    if (!image || !wrap) return null;
    const imageRect = image.getBoundingClientRect(), wrapRect = wrap.getBoundingClientRect();
    if (!imageRect.width || !imageRect.height) return null;
    return { left: imageRect.left - wrapRect.left, top: imageRect.top - wrapRect.top, width: imageRect.width, height: imageRect.height, page: imageRect };
  }

  function evenlySpaced(count) { return Array.from({ length: Math.max(0, count - 1) }, (_, index) => (index + 1) / count); }
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
      sliceState.rows = rows; sliceState.cols = cols; sliceState.mode = mode;
      sliceState.vertical = evenlySpaced(cols); sliceState.horizontal = evenlySpaced(rows);
    }
  }
  function clampLine(list, index, value) {
    const gap = 0.025, min = index === 0 ? gap : list[index - 1] + gap, max = index === list.length - 1 ? 1 - gap : list[index + 1] - gap;
    return Math.max(min, Math.min(max, value));
  }
  function createSliceLine(direction, index, value, rect) {
    const line = document.createElement("button");
    line.type = "button"; line.className = "sl-slice-guide " + direction; line.dataset.direction = direction; line.dataset.index = String(index);
    line.setAttribute("aria-label", direction === "vertical" ? "Переместить вертикальную линию" : "Переместить горизонтальную линию");
    if (direction === "vertical") { line.style.left = rect.left + rect.width * value + "px"; line.style.top = rect.top + "px"; line.style.height = rect.height + "px"; }
    else { line.style.left = rect.left + "px"; line.style.top = rect.top + rect.height * value + "px"; line.style.width = rect.width + "px"; }
    line.addEventListener("pointerdown", (event) => { event.preventDefault(); event.stopPropagation(); activeDrag = { type: "slice", direction, index }; line.setPointerCapture?.(event.pointerId); document.body.classList.add("sl-dragging-guide"); });
    return line;
  }
  function renderSliceOverlay() {
    const host = getOverlay(); if (!host) return; host.innerHTML = "";
    if (currentTool() !== "slice" || !sourceReady()) return;
    ensureSliceState(false); const rect = targetRect(); if (!rect) return;
    const frame = document.createElement("div"); frame.className = "sl-slice-frame"; frame.style.left = rect.left + "px"; frame.style.top = rect.top + "px"; frame.style.width = rect.width + "px"; frame.style.height = rect.height + "px"; host.appendChild(frame);
    sliceState.vertical.forEach((value, index) => host.appendChild(createSliceLine("vertical", index, value, rect)));
    sliceState.horizontal.forEach((value, index) => host.appendChild(createSliceLine("horizontal", index, value, rect)));
  }

  const FONT_STACKS = {
    system: 'system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",Arial,sans-serif',
    serif: 'Georgia,"Times New Roman",serif',
    mono: 'ui-monospace,"Cascadia Code",Consolas,"Liberation Mono",monospace',
    rounded: '"Trebuchet MS","Segoe UI",Arial,sans-serif'
  };
  function watermarkText() { return (($("wm-text")?.value || "Safelight").trim() || "Safelight"); }
  function watermarkOpacity() { return Math.max(1, Math.min(100, Number($("wm-opacity")?.value) || 45)) / 100; }
  function watermarkRotation() { return Math.max(-180, Math.min(180, Number($("wm-rotation")?.value) || 0)); }
  function watermarkFont() { return FONT_STACKS[$("wm-font")?.value] || FONT_STACKS.system; }
  function watermarkColor() { return $("wm-color")?.value || "#ffffff"; }
  function watermarkOutlineColor() { return $("wm-outline-color")?.value || "#000000"; }
  function watermarkOutlineWidth() { return Math.max(0, Math.min(16, Number($("wm-outline-width")?.value) || 0)); }
  function watermarkPatternX() { return Math.max(8, Math.min(70, Number($("wm-pattern-x")?.value) || 28)); }
  function watermarkPatternY() { return Math.max(8, Math.min(70, Number($("wm-pattern-y")?.value) || 22)); }
  function watermarkPatternStagger() { return $("wm-pattern-stagger")?.checked !== false; }
  function watermarkLogoScale() { return Math.max(3, Math.min(80, Number($("wm-logo-scale")?.value) || 18)); }
  function watermarkFontSize(rect) {
    const image = sourceImageElement(), sourceWidth = image?.naturalWidth || rect.width, size = Math.max(8, Math.min(320, Number($("wm-size")?.value) || 48));
    return Math.max(9, size * (rect.width / Math.max(1, sourceWidth)));
  }
  function watermarkLogoWidth(rect) { return Math.max(18, rect.width * watermarkLogoScale() / 100); }
  function applyTextStyle(element, fontSize, opacity) {
    element.style.fontSize = fontSize + "px"; element.style.opacity = String(opacity); element.style.color = watermarkColor(); element.style.fontFamily = watermarkFont();
    element.style.setProperty("--wm-rotation", watermarkRotation() + "deg");
    const stroke = watermarkOutlineWidth(); element.style.webkitTextStroke = stroke > 0 ? stroke * Math.max(.35, fontSize / Math.max(1, Number($("wm-size")?.value) || 48)) + "px " + watermarkOutlineColor() : "0 transparent";
  }
  function createPatternItem(rect, x, y, fontSize, opacity, logoWidth) {
    const item = watermarkState.kind === "image" ? document.createElement("img") : document.createElement("span");
    item.className = "sl-watermark-pattern-item " + watermarkState.kind; item.style.left = x + "px"; item.style.top = y + "px"; item.style.setProperty("--wm-rotation", watermarkRotation() + "deg"); item.style.opacity = String(opacity);
    if (watermarkState.kind === "image") { if (!watermarkState.assetUrl) return null; item.src = watermarkState.assetUrl; item.alt = ""; item.style.width = logoWidth + "px"; }
    else { item.textContent = watermarkText(); applyTextStyle(item, fontSize, opacity); }
    return item;
  }
  function renderWatermarkOverlay() {
    const host = getOverlay(); if (!host) return; host.innerHTML = "";
    if (currentTool() !== "watermark" || !sourceReady()) return;
    const rect = targetRect(); if (!rect) return;
    const fontSize = watermarkFontSize(rect), opacity = watermarkOpacity(), logoWidth = watermarkLogoWidth(rect);

    if (watermarkState.fill) {
      const fill = document.createElement("div"); fill.className = "sl-watermark-fill"; fill.style.left = rect.left + "px"; fill.style.top = rect.top + "px"; fill.style.width = rect.width + "px"; fill.style.height = rect.height + "px";
      const stepX = Math.max(watermarkState.kind === "image" ? logoWidth * 1.15 : fontSize * 4.2, rect.width * watermarkPatternX() / 100);
      const stepY = Math.max(watermarkState.kind === "image" ? logoWidth * .85 : fontSize * 2.6, rect.height * watermarkPatternY() / 100);
      let row = 0;
      for (let y = stepY * .5; y < rect.height + stepY * .5; y += stepY, row++) {
        const offset = watermarkPatternStagger() && row % 2 ? stepX * .5 : 0;
        for (let x = stepX * .5 - offset; x < rect.width + stepX * .5; x += stepX) {
          const item = createPatternItem(rect, x, y, fontSize, opacity, Math.min(logoWidth, stepX * .82)); if (item) fill.appendChild(item);
        }
      }
      host.appendChild(fill); return;
    }

    const drag = document.createElement("button"); drag.type = "button"; drag.className = "sl-watermark-drag " + watermarkState.kind;
    drag.style.left = rect.left + rect.width * watermarkState.x + "px"; drag.style.top = rect.top + rect.height * watermarkState.y + "px"; drag.style.setProperty("--wm-rotation", watermarkRotation() + "deg"); drag.style.opacity = String(opacity);
    if (watermarkState.kind === "image") {
      if (watermarkState.assetUrl) { const img = document.createElement("img"); img.src = watermarkState.assetUrl; img.alt = ""; img.style.width = logoWidth + "px"; drag.appendChild(img); }
      else { const placeholder = document.createElement("span"); placeholder.className = "sl-watermark-logo-placeholder"; placeholder.textContent = "Выберите логотип"; drag.appendChild(placeholder); }
    } else { drag.textContent = watermarkText(); applyTextStyle(drag, fontSize, opacity); }
    drag.setAttribute("aria-label", "Перетащить водяной знак");
    drag.addEventListener("pointerdown", (event) => { event.preventDefault(); event.stopPropagation(); activeDrag = { type: "watermark" }; drag.setPointerCapture?.(event.pointerId); document.body.classList.add("sl-dragging-watermark"); });
    host.appendChild(drag);
  }

  function renderInteractiveOverlay() {
    const wrap = $("previewWrap"); if (!wrap) return; const tool = currentTool();
    wrap.classList.toggle("sl-interactive-slice", tool === "slice"); wrap.classList.toggle("sl-interactive-watermark", tool === "watermark");
    if (tool === "slice") renderSliceOverlay(); else if (tool === "watermark") renderWatermarkOverlay(); else if (overlay) overlay.innerHTML = "";
  }

  function onPointerMove(event) {
    if (!activeDrag) return; const rect = targetRect(); if (!rect) return;
    if (activeDrag.type === "slice") {
      const list = activeDrag.direction === "vertical" ? sliceState.vertical : sliceState.horizontal;
      const raw = activeDrag.direction === "vertical" ? (event.clientX - rect.page.left) / rect.page.width : (event.clientY - rect.page.top) / rect.page.height;
      list[activeDrag.index] = clampLine(list, activeDrag.index, raw); renderSliceOverlay(); return;
    }
    if (activeDrag.type === "watermark") {
      watermarkState.x = Math.max(0.02, Math.min(0.98, (event.clientX - rect.page.left) / rect.page.width)); watermarkState.y = Math.max(0.02, Math.min(0.98, (event.clientY - rect.page.top) / rect.page.height));
      renderWatermarkOverlay(); window.dispatchEvent(new CustomEvent("safelight:direct-state"));
    }
  }
  function stopPointerDrag() { activeDrag = null; document.body.classList.remove("sl-dragging-guide", "sl-dragging-watermark"); }

  function updateWatermarkUi() {
    const panel = $("panel-watermark"); if (!panel) return;
    panel.querySelectorAll("[data-wm-kind]").forEach(button => button.classList.toggle("active", button.dataset.wmKind === watermarkState.kind));
    panel.querySelectorAll("[data-wm-section]").forEach(section => section.hidden = section.dataset.wmSection !== watermarkState.kind);
    panel.querySelectorAll("[data-wm-layout]").forEach(button => button.classList.toggle("active", button.dataset.wmLayout === (watermarkState.fill ? "pattern" : "single")));
    const pattern = panel.querySelector(".sl-wm-pattern-controls"), hint = panel.querySelector("[data-wm-single-hint]"); if (pattern) pattern.hidden = !watermarkState.fill; if (hint) hint.hidden = watermarkState.fill;
    const logoName = $("wm-logo-name"); if (logoName) logoName.textContent = watermarkState.assetName || "Файл не выбран";
    const status = $("wm-status"); if (status) status.textContent = watermarkState.kind === "image" ? (watermarkState.assetUrl ? "Логотип готов. Перетащите его или включите паттерн." : "Выберите изображение логотипа.") : "Текстовый водяной знак готов к размещению.";
  }
  function updateWatermarkLabels() {
    const values = [
      ["wm-size-val", Math.round(Number($("wm-size")?.value) || 48) + " px"], ["wm-opacity-val", Math.round(Number($("wm-opacity")?.value) || 45) + "%"],
      ["wm-rotation-val", Math.round(Number($("wm-rotation")?.value) || 0) + "°"], ["wm-outline-width-val", Number($("wm-outline-width")?.value || 0).toFixed(Number($("wm-outline-width")?.value || 0) % 1 ? 1 : 0) + " px"],
      ["wm-logo-scale-val", Math.round(Number($("wm-logo-scale")?.value) || 18) + "%"], ["wm-pattern-x-val", Math.round(Number($("wm-pattern-x")?.value) || 28) + "%"], ["wm-pattern-y-val", Math.round(Number($("wm-pattern-y")?.value) || 22) + "%"],
      ["wm-color-value", $("wm-color")?.value || "#ffffff"]
    ];
    values.forEach(([id, value]) => { if ($(id)) $(id).textContent = value; });
  }
  function notifyWatermarkChange() { updateWatermarkLabels(); updateWatermarkUi(); requestAnimationFrame(renderWatermarkOverlay); window.dispatchEvent(new CustomEvent("safelight:direct-state")); }
  function clearWatermarkAsset() { if (watermarkState.assetUrl) URL.revokeObjectURL(watermarkState.assetUrl); watermarkState.assetUrl = ""; watermarkState.assetName = ""; const input = $("wm-logo-file"); if (input) input.value = ""; }
  function resetWatermarkState() {
    clearWatermarkAsset(); watermarkState.x = .78; watermarkState.y = .82; watermarkState.fill = false; watermarkState.kind = "text";
    updateWatermarkUi(); updateWatermarkLabels(); requestAnimationFrame(renderWatermarkOverlay); window.dispatchEvent(new CustomEvent("safelight:direct-state"));
  }
  function installWatermarkMode() {
    const panel = $("panel-watermark"); if (!panel || panel.dataset.wmEnhanced === "1") return;
    panel.dataset.wmEnhanced = "1";
    panel.addEventListener("click", event => {
      const kind = event.target.closest("[data-wm-kind]"); if (kind) { watermarkState.kind = kind.dataset.wmKind === "image" ? "image" : "text"; notifyWatermarkChange(); return; }
      const layout = event.target.closest("[data-wm-layout]"); if (layout) { watermarkState.fill = layout.dataset.wmLayout === "pattern"; notifyWatermarkChange(); }
    });
    panel.addEventListener("input", event => { if (event.target.matches("#wm-text,#wm-size,#wm-opacity,#wm-color,#wm-font,#wm-outline-color,#wm-outline-width,#wm-rotation,#wm-logo-scale,#wm-pattern-x,#wm-pattern-y,#wm-pattern-stagger")) notifyWatermarkChange(); }, true);
    panel.addEventListener("change", event => { if (event.target.matches("#wm-font,#wm-pattern-stagger")) notifyWatermarkChange(); }, true);
    $("wm-logo-file")?.addEventListener("change", event => {
      const file = event.target.files?.[0]; clearWatermarkAsset();
      if (file && file.type.startsWith("image/")) { watermarkState.assetUrl = URL.createObjectURL(file); watermarkState.assetName = file.name; watermarkState.kind = "image"; }
      notifyWatermarkChange();
    });
    $("sl-reset")?.addEventListener("click", () => { if (currentTool() === "watermark") setTimeout(resetWatermarkState, 0); });
    updateWatermarkUi(); updateWatermarkLabels();
  }

  function polishTransform() {
    const panel = $("panel-transform"), actions = panel?.querySelector(".transform-actions"); if (!panel || !actions || actions.dataset.polished === "1") return;
    actions.dataset.polished = "1"; const buttons = {}; actions.querySelectorAll("[data-tr]").forEach(button => buttons[button.dataset.tr] = button);
    const shell = document.createElement("div"); shell.className = "sl-transform-shell";
    const rotate = document.createElement("div"); rotate.className = "sl-transform-block"; rotate.innerHTML = '<div class="sl-transform-label"><span>Поворот</span><b id="sl-transform-angle">0°</b></div><div class="sl-transform-grid rotate"></div>';
    const rotateGrid = rotate.querySelector(".sl-transform-grid"); [["ccw", "↶", "90° влево"], ["cw", "↷", "90° вправо"], ["180", "↻", "180°"]].forEach(([key, icon, label]) => { const button = buttons[key]; if (!button) return; button.innerHTML = `<span class="sl-tr-symbol">${icon}</span><span>${label}</span>`; rotateGrid.appendChild(button); });
    const flip = document.createElement("div"); flip.className = "sl-transform-block"; flip.innerHTML = '<div class="sl-transform-label"><span>Отражение</span><b>переключатели</b></div><div class="sl-transform-grid flip"></div>';
    const flipGrid = flip.querySelector(".sl-transform-grid"); [["h", "↔", "По горизонтали"], ["v", "↕", "По вертикали"]].forEach(([key, icon, label]) => { const button = buttons[key]; if (!button) return; button.innerHTML = `<span class="sl-tr-symbol">${icon}</span><span>${label}</span>`; flipGrid.appendChild(button); });
    shell.append(rotate, flip); actions.replaceWith(shell); transformSummary = rotate.querySelector("#sl-transform-angle");
    panel.addEventListener("click", event => { if (event.target.closest("[data-tr]")) setTimeout(updateTransformVisuals, 0); }); updateTransformVisuals();
  }
  function updateTransformVisuals() {
    const state = window.safelightTransformState || { angle: 0, h: false, v: false }; if (transformSummary) transformSummary.textContent = (Number(state.angle) || 0) + "°";
    const panel = $("panel-transform"); panel?.querySelector('[data-tr="h"]')?.classList.toggle("active", !!state.h); panel?.querySelector('[data-tr="v"]')?.classList.toggle("active", !!state.v);
  }
  function moveExportIntoInspector() {
    const inspector = document.querySelector(".sl-inspector"), note = inspector?.querySelector(".sl-inspector-note"), wrap = document.querySelector(".sl-export-wrap");
    if (!inspector || !note || !wrap || wrap.classList.contains("sl-inspector-export")) return false;
    wrap.classList.add("sl-inspector-export"); note.parentNode.insertBefore(wrap, note); const text = note.querySelector("span"); if (text) text.innerHTML = '<b>Оригинал остаётся неизменным</b>Все действия выполняются над рабочим результатом. Исходный файл не перезаписывается, пока вы сами не сохраните экспорт.'; return true;
  }

  function getSliceBoundaries() { ensureSliceState(false); return { x: [0, ...sliceState.vertical, 1], y: [0, ...sliceState.horizontal, 1] }; }
  function getWatermarkState() {
    return {
      x: watermarkState.x, y: watermarkState.y, fill: watermarkState.fill, kind: watermarkState.kind, assetUrl: watermarkState.assetUrl, assetName: watermarkState.assetName,
      text: watermarkText(), opacity: watermarkOpacity(), rotation: watermarkRotation(), font: watermarkFont(), color: watermarkColor(), outlineColor: watermarkOutlineColor(), outlineWidth: watermarkOutlineWidth(),
      size: Math.max(8, Math.min(320, Number($("wm-size")?.value) || 48)), logoScale: watermarkLogoScale(), patternX: watermarkPatternX(), patternY: watermarkPatternY(), stagger: watermarkPatternStagger()
    };
  }
  function bindInspector() {
    const inspector = document.querySelector(".sl-inspector"); if (!inspector) return;
    inspector.addEventListener("input", event => {
      if (currentTool() === "slice" && event.target.matches("#s-rows,#s-cols")) { ensureSliceState(true); requestAnimationFrame(renderSliceOverlay); }
      if (currentTool() === "watermark" && event.target.matches("#wm-text,#wm-size,#wm-opacity,#wm-color,#wm-font,#wm-outline-color,#wm-outline-width,#wm-rotation,#wm-logo-scale,#wm-pattern-x,#wm-pattern-y,#wm-pattern-stagger")) requestAnimationFrame(renderWatermarkOverlay);
    }, true);
    inspector.addEventListener("click", event => { if (event.target.closest("#s-mode button")) setTimeout(() => { ensureSliceState(true); renderSliceOverlay(); }, 0); });
  }

  window.safelightDirectState = Object.freeze({ sliceBoundaries: getSliceBoundaries, watermark: getWatermarkState });

  function boot() {
    if (!document.querySelector(".sl-app") || !document.querySelector(".sl-export-wrap") || !$("previewWrap")) { setTimeout(boot, 50); return; }
    installWatermarkMode(); polishTransform(); moveExportIntoInspector(); bindInspector();
    document.addEventListener("pointermove", onPointerMove, { passive: true }); document.addEventListener("pointerup", stopPointerDrag); document.addEventListener("pointercancel", stopPointerDrag);
    window.addEventListener("resize", () => requestAnimationFrame(renderInteractiveOverlay), { passive: true });
    window.addEventListener("safelight:zoomchange", () => requestAnimationFrame(renderInteractiveOverlay));
    window.addEventListener("safelight:toolchange", () => setTimeout(() => { moveExportIntoInspector(); updateTransformVisuals(); renderInteractiveOverlay(); }, 0));
    window.addEventListener("safelight:live-render", () => requestAnimationFrame(renderInteractiveOverlay));
    new MutationObserver(() => requestAnimationFrame(renderInteractiveOverlay)).observe(sourceImageElement(), { attributes: true, attributeFilter: ["src"] });
    window.addEventListener("beforeunload", () => { if (watermarkState.assetUrl) URL.revokeObjectURL(watermarkState.assetUrl); }, { once: true });
    renderInteractiveOverlay();
  }

  boot();
})();
