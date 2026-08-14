(function () {
  "use strict";
  if (window.safelightPrivacyEffectsLoaded) return;
  window.safelightPrivacyEffectsLoaded = true;

  const nav = document.querySelector(".top-nav-links");
  const main = document.querySelector("main.workmain");
  if (!nav || !main) return;

  const state = {
    mode: "blur",
    strength: 18,
    areas: [],
    selectedId: null,
    nextId: 1,
    interaction: null,
    sourceKey: "",
  };

  function addNav() {
    if (nav.querySelector('[data-page="privacy"]')) return;
    const button = document.createElement("button");
    button.type = "button";
    button.className = "top-nav-link advanced-nav";
    button.dataset.page = "privacy";
    button.innerHTML = '<span class="nav-icon" aria-hidden="true"><svg viewBox="0 0 24 24"><path d="M4 7h16v10H4zM8 7v10M12 7v10M16 7v10M4 11h16M4 15h16"/></svg></span><span>Размытие</span>';
    nav.appendChild(button);
  }

  function addPanel() {
    if (document.getElementById("panel-privacy")) return;
    const section = document.createElement("section");
    section.className = "panel";
    section.id = "panel-privacy";
    section.innerHTML = `
      <div class="panel-card sl-pe-panel">
        <h2>РАЗМЫТИЕ / ПИКСЕЛИЗАЦИЯ</h2>
        <p class="desc">Скрывайте лица, номера, документы и другие области прямо на изображении.</p>
        <div class="sl-pe-mode" role="group" aria-label="Режим скрытия">
          <button type="button" class="sl-pe-mode-btn active" data-pe-mode="blur">Размытие</button>
          <button type="button" class="sl-pe-mode-btn" data-pe-mode="pixelate">Пикселизация</button>
        </div>
        <div class="slider-row sl-pe-strength-row">
          <div class="top"><span>Интенсивность</span><b id="pe-strength-value">18</b></div>
          <input id="pe-strength" type="range" min="2" max="64" value="18">
        </div>
        <div class="sl-pe-help"><b>Нарисуйте область на фотографии</b><span>Зажмите мышь и протяните. Готовую область можно двигать и менять её размер за правый нижний угол.</span></div>
        <div class="sl-pe-actions">
          <button type="button" id="pe-delete" class="sl-pe-action" disabled>Удалить выбранную</button>
          <button type="button" id="pe-clear" class="sl-pe-action danger" disabled>Очистить всё</button>
        </div>
        <div class="sl-pe-summary"><span>Областей</span><b id="pe-count">0</b></div>
        <input id="pe-revision" type="hidden" value="0">
      </div>`;
    main.appendChild(section);
  }

  addNav();
  addPanel();

  const $ = (id) => document.getElementById(id);

  function active() {
    return !!document.querySelector("#panel-privacy.active");
  }

  function selected() {
    return state.areas.find((area) => area.id === state.selectedId) || null;
  }

  function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
  }

  function normalizeArea(area) {
    area.x = clamp(area.x, 0, 1);
    area.y = clamp(area.y, 0, 1);
    area.w = clamp(area.w, 0.002, 1 - area.x);
    area.h = clamp(area.h, 0.002, 1 - area.y);
  }

  function bumpRender() {
    const revision = $("pe-revision");
    if (revision) {
      revision.value = String((Number(revision.value) || 0) + 1);
      revision.dispatchEvent(new Event("input", { bubbles: true }));
    }
    renderOverlay();
    updateUi();
  }

  function updateUi() {
    const sel = selected();
    const strength = $("pe-strength");
    const value = $("pe-strength-value");
    if (strength) strength.value = String(sel ? sel.strength : state.strength);
    if (value) value.textContent = String(sel ? sel.strength : state.strength);
    document.querySelectorAll(".sl-pe-mode-btn").forEach((button) => {
      button.classList.toggle("active", button.dataset.peMode === (sel ? sel.mode : state.mode));
    });
    if ($("pe-count")) $("pe-count").textContent = String(state.areas.length);
    if ($("pe-delete")) $("pe-delete").disabled = !sel;
    if ($("pe-clear")) $("pe-clear").disabled = !state.areas.length;
  }

  function imageElement() {
    const live = $("sl-live-canvas");
    if (live && getComputedStyle(live).display !== "none" && live.width && live.height) return live;
    const preview = $("previewImg");
    return preview && preview.src ? preview : null;
  }

  function ensureSurface() {
    const wrap = $("previewWrap");
    if (!wrap) return null;
    let surface = $("sl-privacy-surface");
    if (!surface) {
      surface = document.createElement("div");
      surface.id = "sl-privacy-surface";
      surface.className = "sl-privacy-surface";
      surface.setAttribute("aria-label", "Области размытия и пикселизации");
      wrap.appendChild(surface);
      bindSurface(surface);
    }
    return surface;
  }

  function syncSurface() {
    const wrap = $("previewWrap");
    const surface = ensureSurface();
    const image = imageElement();
    if (!wrap || !surface || !image || !active()) {
      if (surface) surface.classList.remove("show");
      return;
    }
    const wr = wrap.getBoundingClientRect();
    const ir = image.getBoundingClientRect();
    if (!ir.width || !ir.height) {
      surface.classList.remove("show");
      return;
    }
    surface.style.left = (ir.left - wr.left) + "px";
    surface.style.top = (ir.top - wr.top) + "px";
    surface.style.width = ir.width + "px";
    surface.style.height = ir.height + "px";
    surface.classList.add("show");
    renderOverlay();
  }

  function renderOverlay() {
    const surface = $("sl-privacy-surface");
    if (!surface) return;
    const existing = new Map([...surface.querySelectorAll(".sl-pe-area")].map((el) => [Number(el.dataset.id), el]));
    state.areas.forEach((area) => {
      let el = existing.get(area.id);
      if (!el) {
        el = document.createElement("div");
        el.className = "sl-pe-area";
        el.dataset.id = String(area.id);
        el.innerHTML = '<span class="sl-pe-label"></span><i class="sl-pe-resize" data-pe-resize="1"></i>';
        surface.appendChild(el);
      }
      existing.delete(area.id);
      el.classList.toggle("selected", area.id === state.selectedId);
      el.classList.toggle("pixelate", area.mode === "pixelate");
      el.style.left = (area.x * 100) + "%";
      el.style.top = (area.y * 100) + "%";
      el.style.width = (area.w * 100) + "%";
      el.style.height = (area.h * 100) + "%";
      const label = el.querySelector(".sl-pe-label");
      if (label) label.textContent = area.mode === "pixelate" ? "Пиксели " + area.strength : "Размытие " + area.strength;
    });
    existing.forEach((el) => el.remove());
  }

  function pointFromEvent(event, surface) {
    const rect = surface.getBoundingClientRect();
    return {
      x: clamp((event.clientX - rect.left) / Math.max(1, rect.width), 0, 1),
      y: clamp((event.clientY - rect.top) / Math.max(1, rect.height), 0, 1),
    };
  }

  function bindSurface(surface) {
    surface.addEventListener("pointerdown", (event) => {
      if (!active() || event.button !== 0) return;
      const areaEl = event.target.closest(".sl-pe-area");
      const p = pointFromEvent(event, surface);
      surface.setPointerCapture?.(event.pointerId);

      if (!areaEl) {
        const area = {
          id: state.nextId++,
          x: p.x,
          y: p.y,
          w: 0.002,
          h: 0.002,
          mode: state.mode,
          strength: state.strength,
        };
        state.areas.push(area);
        state.selectedId = area.id;
        state.interaction = { type: "draw", id: area.id, sx: p.x, sy: p.y };
        renderOverlay();
        updateUi();
        event.preventDefault();
        return;
      }

      const id = Number(areaEl.dataset.id);
      const area = state.areas.find((item) => item.id === id);
      if (!area) return;
      state.selectedId = id;
      if (event.target.closest("[data-pe-resize]")) {
        state.interaction = { type: "resize", id, sx: p.x, sy: p.y, w: area.w, h: area.h };
      } else {
        state.interaction = { type: "move", id, sx: p.x, sy: p.y, x: area.x, y: area.y };
      }
      renderOverlay();
      updateUi();
      event.preventDefault();
      event.stopPropagation();
    });

    surface.addEventListener("pointermove", (event) => {
      const action = state.interaction;
      if (!action) return;
      const area = state.areas.find((item) => item.id === action.id);
      if (!area) return;
      const p = pointFromEvent(event, surface);
      if (action.type === "draw") {
        area.x = Math.min(action.sx, p.x);
        area.y = Math.min(action.sy, p.y);
        area.w = Math.max(0.002, Math.abs(p.x - action.sx));
        area.h = Math.max(0.002, Math.abs(p.y - action.sy));
      } else if (action.type === "move") {
        area.x = clamp(action.x + (p.x - action.sx), 0, 1 - area.w);
        area.y = clamp(action.y + (p.y - action.sy), 0, 1 - area.h);
      } else if (action.type === "resize") {
        area.w = clamp(action.w + (p.x - action.sx), 0.015, 1 - area.x);
        area.h = clamp(action.h + (p.y - action.sy), 0.015, 1 - area.y);
      }
      normalizeArea(area);
      renderOverlay();
      event.preventDefault();
    });

    function finish(event) {
      const action = state.interaction;
      if (!action) return;
      const area = state.areas.find((item) => item.id === action.id);
      state.interaction = null;
      if (action.type === "draw" && area && (area.w < 0.01 || area.h < 0.01)) {
        state.areas = state.areas.filter((item) => item.id !== area.id);
        if (state.selectedId === area.id) state.selectedId = null;
      }
      try { surface.releasePointerCapture?.(event.pointerId); } catch (_) {}
      bumpRender();
      event.preventDefault();
    }
    surface.addEventListener("pointerup", finish);
    surface.addEventListener("pointercancel", finish);
  }

  function resetAreas() {
    state.areas = [];
    state.selectedId = null;
    state.interaction = null;
    bumpRender();
  }

  document.addEventListener("click", (event) => {
    const mode = event.target.closest("[data-pe-mode]");
    if (mode) {
      const next = mode.dataset.peMode === "pixelate" ? "pixelate" : "blur";
      const sel = selected();
      state.mode = next;
      if (sel) sel.mode = next;
      bumpRender();
      return;
    }
    if (event.target.closest("#pe-delete")) {
      if (state.selectedId != null) {
        state.areas = state.areas.filter((area) => area.id !== state.selectedId);
        state.selectedId = null;
        bumpRender();
      }
      return;
    }
    if (event.target.closest("#pe-clear")) resetAreas();
  });

  document.addEventListener("input", (event) => {
    if (event.target.id !== "pe-strength") return;
    const value = clamp(Number(event.target.value) || 18, 2, 64);
    state.strength = value;
    const sel = selected();
    if (sel) sel.strength = value;
    if ($("pe-strength-value")) $("pe-strength-value").textContent = String(value);
    renderOverlay();
  });

  document.addEventListener("keydown", (event) => {
    if (!active() || state.selectedId == null) return;
    if (event.key === "Delete" || event.key === "Backspace") {
      const tag = event.target?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA") return;
      state.areas = state.areas.filter((area) => area.id !== state.selectedId);
      state.selectedId = null;
      bumpRender();
      event.preventDefault();
    }
  });

  window.addEventListener("safelight:toolchange", (event) => {
    setTimeout(() => {
      if (event.detail?.page !== "privacy") state.selectedId = null;
      syncSurface();
      updateUi();
    }, 0);
  });
  window.addEventListener("safelight:live-render", () => requestAnimationFrame(syncSurface));
  window.addEventListener("resize", () => requestAnimationFrame(syncSurface), { passive: true });

  const preview = $("previewImg");
  if (preview) {
    new MutationObserver(() => {
      const key = preview.src || "";
      if (key && key !== state.sourceKey) {
        state.sourceKey = key;
        state.areas = [];
        state.selectedId = null;
        state.interaction = null;
        updateUi();
        renderOverlay();
      }
      requestAnimationFrame(syncSurface);
    }).observe(preview, { attributes: true, attributeFilter: ["src"] });
    state.sourceKey = preview.src || "";
  }

  async function render(sourceImage) {
    const out = document.createElement("canvas");
    out.width = sourceImage.naturalWidth || sourceImage.width;
    out.height = sourceImage.naturalHeight || sourceImage.height;
    const ctx = out.getContext("2d");
    ctx.drawImage(sourceImage, 0, 0, out.width, out.height);

    for (const area of state.areas) {
      const x = Math.max(0, Math.round(area.x * out.width));
      const y = Math.max(0, Math.round(area.y * out.height));
      const w = Math.max(1, Math.min(out.width - x, Math.round(area.w * out.width)));
      const h = Math.max(1, Math.min(out.height - y, Math.round(area.h * out.height)));
      if (!w || !h) continue;

      const snapshot = document.createElement("canvas");
      snapshot.width = out.width;
      snapshot.height = out.height;
      snapshot.getContext("2d").drawImage(out, 0, 0);

      if (area.mode === "pixelate") {
        const block = Math.max(2, Math.round(area.strength));
        const tiny = document.createElement("canvas");
        tiny.width = Math.max(1, Math.ceil(w / block));
        tiny.height = Math.max(1, Math.ceil(h / block));
        const tx = tiny.getContext("2d");
        tx.imageSmoothingEnabled = true;
        tx.drawImage(snapshot, x, y, w, h, 0, 0, tiny.width, tiny.height);
        ctx.save();
        ctx.imageSmoothingEnabled = false;
        ctx.drawImage(tiny, 0, 0, tiny.width, tiny.height, x, y, w, h);
        ctx.restore();
      } else {
        ctx.save();
        ctx.beginPath();
        ctx.rect(x, y, w, h);
        ctx.clip();
        ctx.filter = "blur(" + Math.max(1, area.strength) + "px)";
        ctx.drawImage(snapshot, 0, 0);
        ctx.filter = "none";
        ctx.restore();
      }
    }
    return out;
  }

  window.safelightPrivacyEffects = {
    render,
    getAreas: () => state.areas.map((area) => ({ ...area })),
    reset: resetAreas,
    syncSurface,
  };

  updateUi();
})();