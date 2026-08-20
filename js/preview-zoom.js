(function () {
  "use strict";

  if (window.safelightPreviewZoomLoaded) return;
  window.safelightPreviewZoomLoaded = true;

  const MIN_ZOOM = 0.25;
  const MAX_ZOOM = 4;
  const EPSILON = 0.001;
  const $ = (id) => document.getElementById(id);
  const state = { zoom: 1, panX: 0, panY: 0 };
  let wrap = null;
  let hud = null;
  let value = null;
  let notifyFrame = 0;
  let spaceHeld = false;
  let drag = null;

  function clamp(number, min, max) {
    return Math.max(min, Math.min(max, number));
  }

  function visibleSurface() {
    const live = $("sl-live-canvas");
    const preview = $("previewImg");
    for (const surface of [live, preview]) {
      if (!surface) continue;
      const style = getComputedStyle(surface);
      const rect = surface.getBoundingClientRect();
      if (style.display !== "none" && style.visibility !== "hidden" && rect.width && rect.height) return surface;
    }
    return preview?.src ? preview : null;
  }

  function pointIsOnSurface(event, surface) {
    const rect = surface?.getBoundingClientRect();
    return !!rect && rect.width > 0 && rect.height > 0
      && event.clientX >= rect.left && event.clientX <= rect.right
      && event.clientY >= rect.top && event.clientY <= rect.bottom;
  }

  function updateHud() {
    if (!hud || !value) return;
    value.textContent = Math.round(state.zoom * 100) + "%";
    const hasSource = !!$("previewImg")?.src;
    hud.hidden = !hasSource;
    hud.querySelector('[data-zoom-action="out"]')?.toggleAttribute("disabled", state.zoom <= MIN_ZOOM + EPSILON);
    hud.querySelector('[data-zoom-action="in"]')?.toggleAttribute("disabled", state.zoom >= MAX_ZOOM - EPSILON);
  }

  function clampPan() {
    const surface = visibleSurface();
    if (!wrap || !surface || state.zoom <= 1) {
      state.panX = 0;
      state.panY = 0;
      return;
    }
    const scaledWidth = surface.offsetWidth * state.zoom;
    const scaledHeight = surface.offsetHeight * state.zoom;
    const maxX = Math.max(0, (scaledWidth - wrap.clientWidth) / 2);
    const maxY = Math.max(0, (scaledHeight - wrap.clientHeight) / 2);
    state.panX = clamp(state.panX, -maxX, maxX);
    state.panY = clamp(state.panY, -maxY, maxY);
  }

  function notifyGeometry() {
    cancelAnimationFrame(notifyFrame);
    notifyFrame = requestAnimationFrame(() => {
      window.dispatchEvent(new CustomEvent("safelight:zoomchange", {
        detail: { zoom: state.zoom, panX: state.panX, panY: state.panY },
      }));
    });
  }

  function apply() {
    if (!wrap) return;
    clampPan();
    wrap.style.setProperty("--sl-preview-zoom", String(state.zoom));
    wrap.style.setProperty("--sl-preview-pan-x", state.panX + "px");
    wrap.style.setProperty("--sl-preview-pan-y", state.panY + "px");
    wrap.classList.toggle("sl-preview-zoomed", Math.abs(state.zoom - 1) >= EPSILON);
    updateHud();
    notifyGeometry();
  }

  function reset() {
    state.zoom = 1;
    state.panX = 0;
    state.panY = 0;
    apply();
  }

  function setZoom(nextZoom, anchor) {
    const next = clamp(Number(nextZoom) || 1, MIN_ZOOM, MAX_ZOOM);
    const surface = visibleSurface();
    if (!surface || Math.abs(next - state.zoom) < EPSILON) return state.zoom;

    if (anchor && state.zoom > 0) {
      const rect = surface.getBoundingClientRect();
      const ratio = next / state.zoom;
      state.panX += (anchor.x - (rect.left + rect.width / 2)) * (1 - ratio);
      state.panY += (anchor.y - (rect.top + rect.height / 2)) * (1 - ratio);
    }

    state.zoom = next;
    apply();
    return state.zoom;
  }

  function wheelPixels(event) {
    if (event.deltaMode === WheelEvent.DOM_DELTA_LINE) return event.deltaY * 16;
    if (event.deltaMode === WheelEvent.DOM_DELTA_PAGE) return event.deltaY * Math.max(1, wrap?.clientHeight || innerHeight);
    return event.deltaY;
  }

  function onWheel(event) {
    const surface = visibleSurface();
    if (!surface || !pointIsOnSurface(event, surface)) return;

    event.preventDefault();
    const factor = Math.exp(-wheelPixels(event) * 0.002);
    setZoom(state.zoom * factor, { x: event.clientX, y: event.clientY });
  }

  function canPan(event) {
    if (event.target.closest?.("button,input,select,textarea")) return false;
    return event.button === 1 || (event.button === 0 && spaceHeld);
  }

  function onPointerDown(event) {
    const surface = visibleSurface();
    if (!surface || state.zoom <= 1 || !canPan(event) || !pointIsOnSurface(event, surface)) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    drag = { pointerId: event.pointerId, x: event.clientX, y: event.clientY, panX: state.panX, panY: state.panY };
    wrap.setPointerCapture?.(event.pointerId);
    wrap.classList.add("sl-preview-panning");
  }

  function onPointerMove(event) {
    if (!drag || drag.pointerId !== event.pointerId) return;
    event.preventDefault();
    state.panX = drag.panX + event.clientX - drag.x;
    state.panY = drag.panY + event.clientY - drag.y;
    apply();
  }

  function stopPan(event) {
    if (!drag || (event?.pointerId != null && event.pointerId !== drag.pointerId)) return;
    drag = null;
    wrap?.classList.remove("sl-preview-panning");
  }

  function onKeyDown(event) {
    if (event.code !== "Space" || event.repeat || event.target?.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(event.target?.tagName || "")) return;
    spaceHeld = true;
    if (state.zoom > 1) { event.preventDefault(); wrap?.classList.add("sl-preview-pan-ready"); }
  }

  function onKeyUp(event) {
    if (event.code !== "Space") return;
    if (spaceHeld && state.zoom > 1) event.preventDefault();
    spaceHeld = false;
    wrap?.classList.remove("sl-preview-pan-ready");
    stopPan();
  }

  function zoomStep(direction) {
    const surface = visibleSurface();
    const rect = surface?.getBoundingClientRect();
    const anchor = rect ? { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 } : null;
    setZoom(state.zoom * (direction > 0 ? 1.25 : 0.8), anchor);
  }

  function installHud() {
    hud = document.createElement("div");
    hud.className = "sl-preview-zoom-hud";
    hud.hidden = true;
    hud.innerHTML = '<button type="button" data-zoom-action="out" aria-label="Уменьшить изображение">−</button><button type="button" class="sl-preview-zoom-value" data-zoom-action="reset" aria-live="polite" aria-label="Сбросить масштаб до 100%">100%</button><button type="button" data-zoom-action="in" aria-label="Увеличить изображение">+</button><button type="button" class="sl-preview-zoom-fit" data-zoom-action="fit">Вписать</button>';
    value = hud.querySelector(".sl-preview-zoom-value");
    hud.addEventListener("click", (event) => {
      const action = event.target.closest("[data-zoom-action]")?.dataset.zoomAction;
      if (action === "in") zoomStep(1);
      else if (action === "out") zoomStep(-1);
      else if (action === "reset" || action === "fit") reset();
    });
    wrap.appendChild(hud);
  }

  function install() {
    wrap = $("previewWrap");
    if (!wrap) {
      setTimeout(install, 60);
      return;
    }

    installHud();
    wrap.addEventListener("wheel", onWheel, { passive: false });
    wrap.addEventListener("pointerdown", onPointerDown, true);
    wrap.addEventListener("pointermove", onPointerMove);
    wrap.addEventListener("pointerup", stopPan);
    wrap.addEventListener("pointercancel", stopPan);
    window.addEventListener("keydown", onKeyDown, true);
    window.addEventListener("keyup", onKeyUp, true);
    window.addEventListener("blur", () => { spaceHeld = false; wrap?.classList.remove("sl-preview-pan-ready"); stopPan(); });
    window.addEventListener("safelight:source-file", reset);
    window.addEventListener("resize", apply, { passive: true });
    $("previewImg")?.addEventListener("load", updateHud);

    window.safelightPreviewZoom = Object.freeze({
      get: () => ({ ...state }),
      set: (zoom) => setZoom(zoom),
      pan: (x, y) => { state.panX = Number(x) || 0; state.panY = Number(y) || 0; apply(); return { ...state }; },
      reset,
      min: MIN_ZOOM,
      max: MAX_ZOOM,
    });
    apply();
  }

  install();
})();
