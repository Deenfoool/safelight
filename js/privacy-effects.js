(function () {
  "use strict";

  if (window.safelightPrivacyEffectsLoaded) return;
  window.safelightPrivacyEffectsLoaded = true;

  const MODES = new Set(["blur", "pixelate", "black"]);
  const SHAPES = new Set(["rect", "ellipse", "free"]);
  const MIN_AREA = 0.012;
  const $ = (id) => document.getElementById(id);
  const state = {
    mode: "blur",
    shape: "rect",
    strength: 18,
    areas: [],
    selectedId: null,
    nextId: 1,
    interaction: null,
    sourceKey: "",
    sourceImage: null,
    sourceToken: 0,
    renderTimer: 0,
    renderToken: 0,
    lastCanvas: null,
    faceBusy: false,
  };

  function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
  }

  function active() {
    return !!document.querySelector("#panel-privacy.active");
  }

  function selected() {
    return state.areas.find((area) => area.id === state.selectedId) || null;
  }

  function modeLabel(mode) {
    if (mode === "pixelate") return "Пикселизация";
    if (mode === "black") return "Чёрная заливка";
    return "Размытие";
  }

  function shapeLabel(shape) {
    if (shape === "ellipse") return "Эллипс";
    if (shape === "free") return "Лассо";
    return "Прямоугольник";
  }

  function makePanel() {
    if ($("panel-privacy")) return $("panel-privacy");
    const section = document.createElement("section");
    section.className = "panel";
    section.id = "panel-privacy";
    section.innerHTML = `<div class="panel-card sl-pe-panel">
      <h2>ПРОДВИНУТАЯ ЦЕНЗУРА</h2>
      <p class="desc">Скрывайте лица, номера, документы и любые произвольные области.</p>

      <div class="sl-pe-section-head"><span>Способ скрытия</span><small>для новой или выбранной маски</small></div>
      <div class="sl-pe-mode" role="group" aria-label="Способ скрытия">
        <button type="button" class="sl-pe-mode-btn active" data-pe-mode="blur">Размытие</button>
        <button type="button" class="sl-pe-mode-btn" data-pe-mode="pixelate">Пиксели</button>
        <button type="button" class="sl-pe-mode-btn" data-pe-mode="black">Заливка</button>
      </div>

      <div class="sl-pe-section-head"><span>Форма области</span><small>рисуйте прямо на изображении</small></div>
      <div class="sl-pe-shape" role="group" aria-label="Форма области цензуры">
        <button type="button" class="sl-pe-shape-btn active" data-pe-shape="rect">Прямоугольник</button>
        <button type="button" class="sl-pe-shape-btn" data-pe-shape="ellipse">Эллипс</button>
        <button type="button" class="sl-pe-shape-btn" data-pe-shape="free">Лассо</button>
      </div>

      <div class="slider-row sl-pe-strength-row" id="pe-strength-row">
        <div class="top"><span>Интенсивность</span><b id="pe-strength-value">18</b></div>
        <input id="pe-strength" type="range" min="2" max="64" value="18">
      </div>

      <div class="sl-pe-auto">
        <button type="button" id="pe-detect-faces" class="sl-pe-detect"><span aria-hidden="true">◎</span> Найти лица</button>
        <small id="pe-face-status" role="status" aria-live="polite">Локально, если браузер поддерживает FaceDetector</small>
      </div>

      <div class="sl-pe-help">
        <b>Нарисуйте область на изображении</b>
        <span id="pe-help-text">Протяните рамку. Затем перемещайте её и меняйте размер за любую ручку.</span>
      </div>

      <div class="sl-pe-list-head"><span>Маски</span><b id="pe-count">0</b></div>
      <div class="sl-pe-list" id="pe-list" role="listbox" aria-label="Области цензуры">
        <div class="sl-pe-list-empty">Областей пока нет</div>
      </div>

      <div class="sl-pe-actions">
        <button type="button" id="pe-duplicate" class="sl-pe-action" disabled>Дублировать</button>
        <button type="button" id="pe-delete" class="sl-pe-action" disabled>Удалить</button>
        <button type="button" id="pe-clear" class="sl-pe-action danger" disabled>Очистить всё</button>
      </div>
      <div class="sl-pe-shortcuts">Delete — удалить · стрелки — сдвинуть · Esc — снять выбор</div>
    </div>`;
    const host = $("sl-inspector-panels") || document.querySelector("main.workmain");
    host?.appendChild(section);
    return section;
  }

  function makeSidebarButton() {
    if (document.querySelector('.sl-sidebar [data-page="privacy"]')) return;
    const groups = [...document.querySelectorAll(".sl-sidebar .sl-nav-group")];
    const group = groups.find((item) => item.querySelector(".sl-nav-label")?.textContent.trim() === "Редактирование") || groups[0];
    if (!group) return;
    const button = document.createElement("button");
    button.type = "button";
    button.className = "top-nav-link sl-tool";
    button.dataset.page = "privacy";
    button.innerHTML = '<span class="nav-icon" aria-hidden="true"><svg viewBox="0 0 24 24"><path d="M4 7h16v10H4zM8 7v10M12 7v10M16 7v10M4 11h16M4 15h16"/></svg></span><span>Цензура</span>';
    button.addEventListener("click", (event) => {
      event.preventDefault();
      activatePrivacy();
    });
    group.appendChild(button);
  }

  function setInspectorText() {
    if (!active()) return;
    const title = $("sl-inspector-title");
    const description = $("sl-inspector-desc");
    if (title) title.textContent = "Продвинутая цензура";
    if (description) description.textContent = "Размытие, пикселизация и заливка нескольких областей без загрузки изображения на сервер.";
  }

  function activatePrivacy() {
    document.body.classList.remove("page-home", "sl-palette-active", "sl-crop-active", "sl-annotation-active", "sl-bg-active");
    document.body.classList.add("page-tool", "sl-privacy-active");
    document.querySelectorAll(".panel").forEach((panel) => panel.classList.remove("active"));
    makePanel().classList.add("active");
    document.querySelectorAll(".sl-sidebar .sl-tool").forEach((button) => button.classList.toggle("active", button.dataset.page === "privacy"));
    window.dispatchEvent(new CustomEvent("safelight:toolchange", { detail: { page: "privacy" } }));
    setTimeout(() => {
      setInspectorText();
      scheduleRender(90);
      syncSurface();
    }, 0);
  }

  function installShell() {
    makePanel();
    const app = document.querySelector(".sl-app");
    if (!app) {
      setTimeout(installShell, 60);
      return;
    }
    const panel = $("panel-privacy");
    if (panel && panel.parentElement?.id !== "sl-inspector-panels") $("sl-inspector-panels")?.appendChild(panel);
    makeSidebarButton();
    setInspectorText();
    syncSurface();
  }

  function renderAreaList() {
    const list = $("pe-list");
    if (!list) return;
    list.replaceChildren();
    if (!state.areas.length) {
      const empty = document.createElement("div");
      empty.className = "sl-pe-list-empty";
      empty.textContent = "Областей пока нет";
      list.appendChild(empty);
      return;
    }
    state.areas.forEach((area, index) => {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "sl-pe-list-item" + (area.id === state.selectedId ? " selected" : "");
      button.dataset.peSelect = String(area.id);
      button.setAttribute("role", "option");
      button.setAttribute("aria-selected", area.id === state.selectedId ? "true" : "false");
      const copy = document.createElement("span");
      const title = document.createElement("b");
      title.textContent = index + 1 + ". " + modeLabel(area.mode);
      const detail = document.createElement("small");
      detail.textContent = shapeLabel(area.shape) + " · " + Math.round(area.w * 100) + "% × " + Math.round(area.h * 100) + "%";
      copy.append(title, detail);
      const marker = document.createElement("i");
      marker.className = "mode-" + area.mode;
      marker.setAttribute("aria-hidden", "true");
      button.append(marker, copy);
      list.appendChild(button);
    });
  }

  function updateUi() {
    const area = selected();
    const mode = area?.mode || state.mode;
    const shape = area?.shape || state.shape;
    const strength = area?.strength || state.strength;
    const strengthInput = $("pe-strength");
    const strengthValue = $("pe-strength-value");
    if (strengthInput) {
      strengthInput.value = String(strength);
      strengthInput.disabled = mode === "black";
    }
    if (strengthValue) strengthValue.textContent = mode === "black" ? "—" : String(strength);
    $("pe-strength-row")?.classList.toggle("muted", mode === "black");
    document.querySelectorAll(".sl-pe-mode-btn").forEach((button) => {
      const on = button.dataset.peMode === mode;
      button.classList.toggle("active", on);
      button.setAttribute("aria-pressed", on ? "true" : "false");
    });
    document.querySelectorAll(".sl-pe-shape-btn").forEach((button) => {
      const on = button.dataset.peShape === shape;
      button.classList.toggle("active", on);
      button.setAttribute("aria-pressed", on ? "true" : "false");
    });
    if ($("pe-count")) $("pe-count").textContent = String(state.areas.length);
    if ($("pe-delete")) $("pe-delete").disabled = !area;
    if ($("pe-duplicate")) $("pe-duplicate").disabled = !area;
    if ($("pe-clear")) $("pe-clear").disabled = !state.areas.length;
    if ($("pe-detect-faces")) $("pe-detect-faces").disabled = state.faceBusy;
    const help = $("pe-help-text");
    if (help) help.textContent = shape === "free"
      ? "Обведите объект непрерывной линией. После создания лассо можно двигать и масштабировать."
      : "Протяните область. Затем перемещайте её и меняйте размер за любую из восьми ручек.";
    renderAreaList();
  }

  function imageElement() {
    const live = $("sl-live-canvas");
    if (live && getComputedStyle(live).display !== "none" && live.width && live.height) return live;
    const preview = $("previewImg");
    return preview?.src ? preview : null;
  }

  function ensureSurface() {
    const wrap = $("previewWrap");
    if (!wrap) return null;
    let surface = $("sl-privacy-surface");
    if (!surface) {
      surface = document.createElement("div");
      surface.id = "sl-privacy-surface";
      surface.className = "sl-privacy-surface";
      surface.setAttribute("role", "application");
      surface.setAttribute("aria-label", "Редактор областей цензуры");
      surface.tabIndex = 0;
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
      surface?.classList.remove("show");
      return;
    }
    const wrapRect = wrap.getBoundingClientRect();
    const imageRect = image.getBoundingClientRect();
    if (!imageRect.width || !imageRect.height) {
      surface.classList.remove("show");
      return;
    }
    surface.style.left = imageRect.left - wrapRect.left + "px";
    surface.style.top = imageRect.top - wrapRect.top + "px";
    surface.style.width = imageRect.width + "px";
    surface.style.height = imageRect.height + "px";
    surface.classList.add("show");
    renderOverlay();
  }

  function freePolygon(area) {
    const points = area.points?.length ? area.points : [{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 1, y: 1 }, { x: 0, y: 1 }];
    return points.map((item) => clamp(item.x, 0, 1) * 100 + "," + clamp(item.y, 0, 1) * 100).join(" ");
  }

  function renderOverlay() {
    const surface = $("sl-privacy-surface");
    if (!surface) return;
    const old = new Map([...surface.querySelectorAll(".sl-pe-area")].map((element) => [Number(element.dataset.id), element]));
    state.areas.forEach((area, index) => {
      let element = old.get(area.id);
      if (!element) {
        element = document.createElement("div");
        element.className = "sl-pe-area";
        element.dataset.id = String(area.id);
        element.setAttribute("role", "button");
        element.innerHTML = '<svg class="sl-pe-free-shape" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true"><polygon></polygon></svg><span class="sl-pe-label"></span>' + ["nw", "n", "ne", "e", "se", "s", "sw", "w"].map((direction) => '<i class="sl-pe-resize ' + direction + '" data-pe-resize="' + direction + '"></i>').join("");
        surface.appendChild(element);
      }
      old.delete(area.id);
      element.className = "sl-pe-area mode-" + area.mode + " shape-" + area.shape + (area.id === state.selectedId ? " selected" : "");
      element.style.left = area.x * 100 + "%";
      element.style.top = area.y * 100 + "%";
      element.style.width = area.w * 100 + "%";
      element.style.height = area.h * 100 + "%";
      element.setAttribute("aria-label", "Маска " + (index + 1) + ": " + modeLabel(area.mode) + ", " + shapeLabel(area.shape));
      const label = element.querySelector(".sl-pe-label");
      if (label) label.textContent = area.mode === "black" ? "Заливка" : modeLabel(area.mode) + " " + area.strength;
      const polygon = element.querySelector("polygon");
      if (polygon) polygon.setAttribute("points", freePolygon(area));
    });
    old.forEach((element) => element.remove());
  }

  function point(event, surface) {
    const rect = surface.getBoundingClientRect();
    return {
      x: clamp((event.clientX - rect.left) / Math.max(1, rect.width), 0, 1),
      y: clamp((event.clientY - rect.top) / Math.max(1, rect.height), 0, 1),
    };
  }

  function normalize(area) {
    area.x = clamp(Number(area.x) || 0, 0, 1);
    area.y = clamp(Number(area.y) || 0, 0, 1);
    area.w = clamp(Number(area.w) || MIN_AREA, 0.002, 1 - area.x);
    area.h = clamp(Number(area.h) || MIN_AREA, 0.002, 1 - area.y);
    if (area.shape === "free") {
      area.points = (area.points?.length ? area.points : [{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 1, y: 1 }, { x: 0, y: 1 }])
        .map((item) => ({ x: clamp(Number(item.x) || 0, 0, 1), y: clamp(Number(item.y) || 0, 0, 1) }));
    }
  }

  function addArea(properties, shouldChange = true) {
    const area = {
      id: state.nextId++,
      x: Number(properties?.x) || 0,
      y: Number(properties?.y) || 0,
      w: Number(properties?.w) || 0.2,
      h: Number(properties?.h) || 0.2,
      mode: MODES.has(properties?.mode) ? properties.mode : state.mode,
      shape: SHAPES.has(properties?.shape) ? properties.shape : state.shape,
      strength: clamp(Number(properties?.strength) || state.strength, 2, 64),
      points: properties?.points?.map((item) => ({ x: item.x, y: item.y })),
    };
    normalize(area);
    state.areas.push(area);
    state.selectedId = area.id;
    if (shouldChange) changed();
    return area;
  }

  function updateFreeArea(area, points) {
    const minX = Math.min(...points.map((item) => item.x));
    const maxX = Math.max(...points.map((item) => item.x));
    const minY = Math.min(...points.map((item) => item.y));
    const maxY = Math.max(...points.map((item) => item.y));
    const width = Math.max(0.002, maxX - minX);
    const height = Math.max(0.002, maxY - minY);
    area.x = minX;
    area.y = minY;
    area.w = width;
    area.h = height;
    area.points = points.map((item) => ({ x: (item.x - minX) / width, y: (item.y - minY) / height }));
    normalize(area);
  }

  function changed() {
    renderOverlay();
    updateUi();
    scheduleRender(90);
  }

  function resizeArea(area, interaction, cursor) {
    let left = interaction.x;
    let top = interaction.y;
    let right = interaction.x + interaction.w;
    let bottom = interaction.y + interaction.h;
    const direction = interaction.direction;
    if (direction.includes("w")) left = clamp(cursor.x, 0, right - MIN_AREA);
    if (direction.includes("e")) right = clamp(cursor.x, left + MIN_AREA, 1);
    if (direction.includes("n")) top = clamp(cursor.y, 0, bottom - MIN_AREA);
    if (direction.includes("s")) bottom = clamp(cursor.y, top + MIN_AREA, 1);
    area.x = left;
    area.y = top;
    area.w = right - left;
    area.h = bottom - top;
    normalize(area);
  }

  function bindSurface(surface) {
    surface.addEventListener("pointerdown", (event) => {
      if (!active() || event.button !== 0) return;
      const element = event.target.closest(".sl-pe-area");
      const cursor = point(event, surface);
      surface.focus({ preventScroll: true });
      surface.setPointerCapture?.(event.pointerId);
      if (!element) {
        const area = addArea({ x: cursor.x, y: cursor.y, w: 0.002, h: 0.002, mode: state.mode, shape: state.shape, strength: state.strength }, false);
        if (area.shape === "free") {
          const points = [cursor];
          updateFreeArea(area, points);
          state.interaction = { type: "free", id: area.id, points };
        } else {
          state.interaction = { type: "draw", id: area.id, startX: cursor.x, startY: cursor.y };
        }
        renderOverlay();
        updateUi();
        event.preventDefault();
        return;
      }
      const id = Number(element.dataset.id);
      const area = state.areas.find((item) => item.id === id);
      if (!area) return;
      state.selectedId = id;
      state.mode = area.mode;
      state.shape = area.shape;
      state.strength = area.strength;
      const handle = event.target.closest("[data-pe-resize]")?.dataset.peResize;
      state.interaction = handle
        ? { type: "resize", id, direction: handle, x: area.x, y: area.y, w: area.w, h: area.h }
        : { type: "move", id, startX: cursor.x, startY: cursor.y, x: area.x, y: area.y };
      renderOverlay();
      updateUi();
      event.preventDefault();
      event.stopPropagation();
    });

    surface.addEventListener("pointermove", (event) => {
      const interaction = state.interaction;
      if (!interaction) return;
      const area = state.areas.find((item) => item.id === interaction.id);
      if (!area) return;
      const cursor = point(event, surface);
      if (interaction.type === "draw") {
        area.x = Math.min(interaction.startX, cursor.x);
        area.y = Math.min(interaction.startY, cursor.y);
        area.w = Math.max(0.002, Math.abs(cursor.x - interaction.startX));
        area.h = Math.max(0.002, Math.abs(cursor.y - interaction.startY));
        normalize(area);
      } else if (interaction.type === "free") {
        const last = interaction.points[interaction.points.length - 1];
        if (!last || Math.hypot(cursor.x - last.x, cursor.y - last.y) > 0.003) interaction.points.push(cursor);
        updateFreeArea(area, interaction.points);
      } else if (interaction.type === "move") {
        area.x = clamp(interaction.x + cursor.x - interaction.startX, 0, 1 - area.w);
        area.y = clamp(interaction.y + cursor.y - interaction.startY, 0, 1 - area.h);
      } else if (interaction.type === "resize") {
        resizeArea(area, interaction, cursor);
      }
      renderOverlay();
      event.preventDefault();
    });

    const finish = (event) => {
      const interaction = state.interaction;
      if (!interaction) return;
      const area = state.areas.find((item) => item.id === interaction.id);
      state.interaction = null;
      const invalidFree = interaction.type === "free" && (interaction.points.length < 3 || !area || area.w < MIN_AREA || area.h < MIN_AREA);
      const invalidBox = interaction.type === "draw" && area && (area.w < MIN_AREA || area.h < MIN_AREA);
      if (invalidFree || invalidBox) {
        state.areas = state.areas.filter((item) => item.id !== interaction.id);
        if (state.selectedId === interaction.id) state.selectedId = null;
      }
      try {
        surface.releasePointerCapture?.(event.pointerId);
      } catch (_) {
        // Pointer capture can already be gone after cancellation.
      }
      changed();
      event.preventDefault();
    };
    surface.addEventListener("pointerup", finish);
    surface.addEventListener("pointercancel", finish);
  }

  function resetAreas() {
    state.areas = [];
    state.selectedId = null;
    state.interaction = null;
    changed();
  }

  function duplicateSelected() {
    const area = selected();
    if (!area) return;
    const offset = 0.025;
    addArea({
      ...area,
      x: clamp(area.x + offset, 0, 1 - area.w),
      y: clamp(area.y + offset, 0, 1 - area.h),
      points: area.points?.map((item) => ({ ...item })),
    });
  }

  function loadSource() {
    const preview = $("previewImg");
    if (!preview?.src) return Promise.reject(new Error("Сначала загрузите изображение"));
    const source = preview.src;
    if (state.sourceImage && state.sourceKey === source) return Promise.resolve(state.sourceImage);
    const token = ++state.sourceToken;
    return new Promise((resolve, reject) => {
      const image = new Image();
      image.onload = () => {
        if (token !== state.sourceToken || $("previewImg")?.src !== source) {
          resolve(null);
          return;
        }
        state.sourceImage = image;
        state.sourceKey = source;
        resolve(image);
      };
      image.onerror = () => {
        if (token === state.sourceToken) reject(new Error("Не удалось открыть изображение"));
        else resolve(null);
      };
      image.src = source;
    });
  }

  function areaPath(context, area, width, height) {
    const x = area.x * width;
    const y = area.y * height;
    const w = area.w * width;
    const h = area.h * height;
    context.beginPath();
    if (area.shape === "ellipse") {
      context.ellipse(x + w / 2, y + h / 2, w / 2, h / 2, 0, 0, Math.PI * 2);
    } else if (area.shape === "free" && area.points?.length) {
      area.points.forEach((item, index) => {
        const px = x + item.x * w;
        const py = y + item.y * h;
        if (!index) context.moveTo(px, py);
        else context.lineTo(px, py);
      });
      context.closePath();
    } else {
      context.rect(x, y, w, h);
    }
  }

  async function buildCanvas() {
    const source = await loadSource();
    if (!source) return null;
    const output = document.createElement("canvas");
    output.width = source.naturalWidth;
    output.height = source.naturalHeight;
    const context = output.getContext("2d");
    context.drawImage(source, 0, 0, output.width, output.height);

    for (const area of state.areas) {
      const x = Math.max(0, Math.round(area.x * output.width));
      const y = Math.max(0, Math.round(area.y * output.height));
      const width = Math.max(1, Math.min(output.width - x, Math.round(area.w * output.width)));
      const height = Math.max(1, Math.min(output.height - y, Math.round(area.h * output.height)));
      context.save();
      areaPath(context, area, output.width, output.height);
      context.clip();
      if (area.mode === "black") {
        context.fillStyle = "#050505";
        context.fillRect(x, y, width, height);
      } else if (area.mode === "pixelate") {
        const block = Math.max(2, Math.round(area.strength));
        const tiny = document.createElement("canvas");
        tiny.width = Math.max(1, Math.ceil(width / block));
        tiny.height = Math.max(1, Math.ceil(height / block));
        tiny.getContext("2d").drawImage(output, x, y, width, height, 0, 0, tiny.width, tiny.height);
        context.imageSmoothingEnabled = false;
        context.drawImage(tiny, 0, 0, tiny.width, tiny.height, x, y, width, height);
      } else {
        const padding = Math.ceil(Math.max(2, area.strength) * 2.5);
        const sourceX = Math.max(0, x - padding);
        const sourceY = Math.max(0, y - padding);
        const sourceWidth = Math.min(output.width - sourceX, width + padding * 2);
        const sourceHeight = Math.min(output.height - sourceY, height + padding * 2);
        const patch = document.createElement("canvas");
        patch.width = Math.max(1, sourceWidth);
        patch.height = Math.max(1, sourceHeight);
        patch.getContext("2d").drawImage(output, sourceX, sourceY, sourceWidth, sourceHeight, 0, 0, patch.width, patch.height);
        context.filter = "blur(" + Math.max(1, area.strength) + "px)";
        context.drawImage(patch, sourceX, sourceY);
        context.filter = "none";
      }
      context.restore();
    }
    return output;
  }

  function overlapRatio(first, second) {
    const left = Math.max(first.x, second.x);
    const top = Math.max(first.y, second.y);
    const right = Math.min(first.x + first.w, second.x + second.w);
    const bottom = Math.min(first.y + first.h, second.y + second.h);
    if (right <= left || bottom <= top) return 0;
    return ((right - left) * (bottom - top)) / Math.min(first.w * first.h, second.w * second.h);
  }

  async function detectFaces() {
    if (state.faceBusy) return;
    const status = $("pe-face-status");
    if (typeof window.FaceDetector !== "function") {
      if (status) status.textContent = "Автопоиск лиц недоступен в этом браузере — используйте ручные маски.";
      return;
    }
    state.faceBusy = true;
    updateUi();
    if (status) status.textContent = "Ищу лица локально…";
    try {
      const source = await loadSource();
      if (!source) throw new Error("Изображение изменилось");
      const canvas = document.createElement("canvas");
      canvas.width = source.naturalWidth;
      canvas.height = source.naturalHeight;
      canvas.getContext("2d").drawImage(source, 0, 0);
      const detector = new window.FaceDetector({ fastMode: true, maxDetectedFaces: 50 });
      const faces = await detector.detect(canvas);
      let added = 0;
      faces.forEach((face) => {
        const box = face.boundingBox;
        if (!box?.width || !box?.height) return;
        const padX = box.width * 0.16;
        const padY = box.height * 0.2;
        const proposal = {
          x: clamp((box.x - padX) / canvas.width, 0, 1),
          y: clamp((box.y - padY) / canvas.height, 0, 1),
          w: clamp((box.width + padX * 2) / canvas.width, MIN_AREA, 1),
          h: clamp((box.height + padY * 2) / canvas.height, MIN_AREA, 1),
          mode: state.mode,
          shape: "ellipse",
          strength: state.strength,
        };
        proposal.w = Math.min(proposal.w, 1 - proposal.x);
        proposal.h = Math.min(proposal.h, 1 - proposal.y);
        if (state.areas.some((area) => overlapRatio(area, proposal) > 0.72)) return;
        addArea(proposal, false);
        added++;
      });
      changed();
      if (status) status.textContent = added ? "Добавлено масок: " + added + ". Проверьте результат вручную." : "Новых лиц не найдено.";
    } catch (error) {
      if (status) status.textContent = error?.message || "Не удалось выполнить локальный поиск лиц.";
    } finally {
      state.faceBusy = false;
      updateUi();
    }
  }

  function scheduleRender(delay) {
    clearTimeout(state.renderTimer);
    if (!active()) return;
    state.renderTimer = setTimeout(renderCurrent, delay ?? 70);
  }

  async function renderCurrent() {
    if (!active()) return;
    const token = ++state.renderToken;
    try {
      const built = await buildCanvas();
      if (!built || token !== state.renderToken || !active()) return;
      const wrap = $("previewWrap");
      if (!wrap) return;
      let live = $("sl-live-canvas");
      if (!live) {
        live = document.createElement("canvas");
        live.id = "sl-live-canvas";
        live.className = "sl-live-canvas";
        wrap.appendChild(live);
      }
      live.width = built.width;
      live.height = built.height;
      const context = live.getContext("2d");
      context.clearRect(0, 0, live.width, live.height);
      context.drawImage(built, 0, 0);
      state.lastCanvas = document.createElement("canvas");
      state.lastCanvas.width = live.width;
      state.lastCanvas.height = live.height;
      state.lastCanvas.getContext("2d").drawImage(live, 0, 0);
      wrap.classList.add("sl-live-ready");
      if ($("ro-dims")) $("ro-dims").textContent = live.width + " × " + live.height + " px";
      if ($("ro-format")) $("ro-format").textContent = "CENSORED";
      requestAnimationFrame(syncSurface);
    } catch (error) {
      if (token === state.renderToken && active()) console.error("Safelight privacy effects:", error);
    }
  }

  function blob(canvas, type, quality) {
    return new Promise((resolve, reject) => canvas.toBlob((result) => result ? resolve(result) : reject(new Error("Не удалось подготовить файл")), type, quality));
  }

  function download(result, name) {
    const url = URL.createObjectURL(result);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = name;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    setTimeout(() => URL.revokeObjectURL(url), 4000);
  }

  function baseName() {
    return (($("meta-name")?.textContent || "safelight").trim().replace(/\.[^.]+$/, "") || "safelight");
  }

  async function exportResult(format) {
    const canvas = await buildCanvas();
    if (!canvas) throw new Error("Изображение изменилось. Повторите экспорт.");
    if (format === "pdf") {
      if (!window.jspdf?.jsPDF) throw new Error("Локальный PDF-модуль не загрузился");
      const { jsPDF } = window.jspdf;
      const documentPdf = new jsPDF({ orientation: canvas.width > canvas.height ? "landscape" : "portrait", unit: "mm", format: "a4" });
      const pageWidth = documentPdf.internal.pageSize.getWidth();
      const pageHeight = documentPdf.internal.pageSize.getHeight();
      const margin = 10;
      const scale = Math.min((pageWidth - margin * 2) / canvas.width, (pageHeight - margin * 2) / canvas.height);
      const width = canvas.width * scale;
      const height = canvas.height * scale;
      documentPdf.addImage(canvas.toDataURL("image/jpeg", 0.94), "JPEG", (pageWidth - width) / 2, (pageHeight - height) / 2, width, height, undefined, "FAST");
      download(documentPdf.output("blob"), baseName() + "-privacy.pdf");
      return;
    }
    let output = canvas;
    if (format === "jpeg") {
      output = document.createElement("canvas");
      output.width = canvas.width;
      output.height = canvas.height;
      const context = output.getContext("2d");
      context.fillStyle = "#ffffff";
      context.fillRect(0, 0, output.width, output.height);
      context.drawImage(canvas, 0, 0);
    }
    const mime = format === "png" ? "image/png" : format === "webp" ? "image/webp" : "image/jpeg";
    download(await blob(output, mime, format === "png" ? undefined : 0.92), baseName() + "-privacy." + (format === "jpeg" ? "jpg" : format));
  }

  function showHint(text) {
    const hint = $("sl-export-hint");
    if (!hint) return;
    hint.textContent = text;
    hint.classList.add("show");
    clearTimeout(showHint.timer);
    showHint.timer = setTimeout(() => hint.classList.remove("show"), 3000);
  }

  document.addEventListener("click", (event) => {
    const modeButton = event.target.closest("[data-pe-mode]");
    if (modeButton) {
      const mode = MODES.has(modeButton.dataset.peMode) ? modeButton.dataset.peMode : "blur";
      state.mode = mode;
      const area = selected();
      if (area) area.mode = mode;
      changed();
      return;
    }
    const shapeButton = event.target.closest("[data-pe-shape]");
    if (shapeButton) {
      const shape = SHAPES.has(shapeButton.dataset.peShape) ? shapeButton.dataset.peShape : "rect";
      state.shape = shape;
      const area = selected();
      if (area) {
        area.shape = shape;
        if (shape === "free" && !area.points?.length) area.points = [{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 1, y: 1 }, { x: 0, y: 1 }];
      }
      changed();
      return;
    }
    const selectButton = event.target.closest("[data-pe-select]");
    if (selectButton) {
      state.selectedId = Number(selectButton.dataset.peSelect);
      const area = selected();
      if (area) {
        state.mode = area.mode;
        state.shape = area.shape;
        state.strength = area.strength;
      }
      renderOverlay();
      updateUi();
      return;
    }
    if (event.target.closest("#pe-detect-faces")) {
      detectFaces();
      return;
    }
    if (event.target.closest("#pe-duplicate")) {
      duplicateSelected();
      return;
    }
    if (event.target.closest("#pe-delete")) {
      if (state.selectedId != null) {
        state.areas = state.areas.filter((area) => area.id !== state.selectedId);
        state.selectedId = null;
        changed();
      }
      return;
    }
    if (event.target.closest("#pe-clear")) {
      resetAreas();
      return;
    }
    if (event.target.closest("#sl-reset") && active()) setTimeout(resetAreas, 0);
  }, true);

  document.addEventListener("input", (event) => {
    if (event.target.id !== "pe-strength") return;
    event.stopPropagation();
    const value = clamp(Number(event.target.value) || 18, 2, 64);
    state.strength = value;
    const area = selected();
    if (area) area.strength = value;
    if ($("pe-strength-value")) $("pe-strength-value").textContent = String(value);
    renderOverlay();
    renderAreaList();
    scheduleRender(100);
  }, true);

  document.addEventListener("keydown", (event) => {
    if (!active()) return;
    const tag = event.target?.tagName;
    const editing = tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT";
    const area = selected();
    if (event.key === "Escape") {
      state.selectedId = null;
      renderOverlay();
      updateUi();
      return;
    }
    if (!area || editing) return;
    if (event.key === "Delete" || event.key === "Backspace") {
      state.areas = state.areas.filter((item) => item.id !== area.id);
      state.selectedId = null;
      changed();
      event.preventDefault();
      return;
    }
    const arrows = new Set(["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"]);
    if (arrows.has(event.key)) {
      const step = event.shiftKey ? 0.02 : 0.003;
      if (event.key === "ArrowLeft") area.x = clamp(area.x - step, 0, 1 - area.w);
      if (event.key === "ArrowRight") area.x = clamp(area.x + step, 0, 1 - area.w);
      if (event.key === "ArrowUp") area.y = clamp(area.y - step, 0, 1 - area.h);
      if (event.key === "ArrowDown") area.y = clamp(area.y + step, 0, 1 - area.h);
      changed();
      event.preventDefault();
    }
  }, true);

  document.addEventListener("click", (event) => {
    const option = event.target.closest(".sl-export-option[data-export]");
    if (!option || !active()) return;
    const format = option.dataset.export;
    if (!["webp", "jpeg", "png", "pdf"].includes(format)) return;
    event.preventDefault();
    event.stopPropagation();
    event.stopImmediatePropagation();
    option.closest(".sl-export-wrap")?.classList.remove("open");
    const button = $("sl-export");
    if (button) button.disabled = true;
    exportResult(format)
      .then(() => showHint("Цензура экспортирована."))
      .catch((error) => {
        console.error(error);
        showHint(error.message || "Не удалось экспортировать файл");
      })
      .finally(() => {
        if (button) button.disabled = false;
      });
  }, true);

  window.addEventListener("safelight:toolchange", (event) => {
    const entering = event.detail?.page === "privacy";
    document.body.classList.toggle("sl-privacy-active", entering);
    if (!entering) {
      clearTimeout(state.renderTimer);
      state.renderToken++;
      state.sourceToken++;
      state.selectedId = null;
      state.interaction = null;
      $("sl-privacy-surface")?.classList.remove("show");
    }
    setTimeout(() => {
      setInspectorText();
      syncSurface();
      updateUi();
      if (entering) scheduleRender(100);
    }, 20);
  });

  window.addEventListener("resize", () => requestAnimationFrame(syncSurface), { passive: true });
  window.addEventListener("safelight:zoomchange", () => requestAnimationFrame(syncSurface));
  const preview = $("previewImg");
  if (preview) {
    new MutationObserver(() => {
      const key = preview.src || "";
      if (key && key !== state.sourceKey) {
        clearTimeout(state.renderTimer);
        state.renderToken++;
        state.sourceToken++;
        state.sourceKey = key;
        state.sourceImage = null;
        state.areas = [];
        state.selectedId = null;
        state.interaction = null;
        updateUi();
        renderOverlay();
        if (active()) scheduleRender(120);
      }
      requestAnimationFrame(syncSurface);
    }).observe(preview, { attributes: true, attributeFilter: ["src"] });
  }

  window.safelightPrivacyEffects = Object.freeze({
    render: async () => buildCanvas(),
    getAreas: () => state.areas.map((area) => ({ ...area, points: area.points?.map((item) => ({ ...item })) })),
    addArea,
    detectFaces,
    reset: resetAreas,
    activate: activatePrivacy,
    select: (id) => {
      state.selectedId = state.areas.some((area) => area.id === id) ? id : null;
      const area = selected();
      if (area) {
        state.mode = area.mode;
        state.shape = area.shape;
        state.strength = area.strength;
      }
      renderOverlay();
      updateUi();
    },
    syncSurface,
  });

  installShell();
  updateUi();
})();
