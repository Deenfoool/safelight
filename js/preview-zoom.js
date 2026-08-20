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
    hud.hidden = !hasSource || Math.abs(state.zoom - 1) < EPSILON;
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
    if (state.zoom <= 1) {
      state.panX = 0;
      state.panY = 0;
    }
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

  function installHud() {
    hud = document.createElement("div");
    hud.className = "sl-preview-zoom-hud";
    hud.hidden = true;
    hud.innerHTML = '<span class="sl-preview-zoom-value" aria-live="polite">100%</span><button type="button" aria-label="Сбросить масштаб изображения" title="Сбросить масштаб до 100%">100%</button>';
    value = hud.querySelector(".sl-preview-zoom-value");
    hud.querySelector("button")?.addEventListener("click", reset);
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
    window.addEventListener("safelight:source-file", reset);
    window.addEventListener("resize", notifyGeometry, { passive: true });
    $("previewImg")?.addEventListener("load", updateHud);

    window.safelightPreviewZoom = Object.freeze({
      get: () => ({ ...state }),
      set: (zoom) => setZoom(zoom),
      reset,
      min: MIN_ZOOM,
      max: MAX_ZOOM,
    });
    apply();
  }

  install();
})();
