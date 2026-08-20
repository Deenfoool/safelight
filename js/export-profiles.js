(function () {
  "use strict";

  if (window.safelightExportProfilesLoaded) return;
  window.safelightExportProfilesLoaded = true;

  const STORAGE_KEY = "safelight-export-profiles-v1";
  const SELECTED_KEY = "safelight-export-profile-selected-v1";
  const BUILT_INS = Object.freeze([
    { id: "web", name: "Веб", format: "webp", quality: 82, maxSide: 1920, background: "transparent", backgroundColor: "#ffffff", prefix: "", suffix: "-web", builtin: true },
    { id: "share", name: "Для отправки", format: "jpeg", quality: 86, maxSide: 1600, background: "white", backgroundColor: "#ffffff", prefix: "", suffix: "-share", builtin: true },
    { id: "lossless", name: "Без потерь", format: "png", quality: 100, maxSide: 0, background: "transparent", backgroundColor: "#ffffff", prefix: "", suffix: "-clean", builtin: true },
  ]);
  const $ = (id) => document.getElementById(id);
  let custom = loadCustom();
  let selectedId = readSelected();
  let dialog = null;

  function clamp(value, min, max) { return Math.max(min, Math.min(max, value)); }
  function cleanText(value, max) { return String(value || "").replace(/[\\/:*?"<>|\u0000-\u001f]/g, "-").trim().slice(0, max || 80); }
  function normalize(input, fallbackId) {
    const format = ["webp", "jpeg", "png"].includes(input?.format) ? input.format : "webp";
    const background = ["transparent", "white", "custom"].includes(input?.background) ? input.background : "transparent";
    return {
      id: cleanText(input?.id || fallbackId || `custom-${Date.now()}`, 100),
      name: cleanText(input?.name || "Мой профиль", 48),
      format,
      quality: clamp(Math.round(Number(input?.quality) || 85), 1, 100),
      maxSide: clamp(Math.round(Number(input?.maxSide) || 0), 0, 16384),
      background,
      backgroundColor: /^#[0-9a-f]{6}$/i.test(input?.backgroundColor || "") ? input.backgroundColor : "#ffffff",
      prefix: cleanText(input?.prefix, 48),
      suffix: cleanText(input?.suffix, 48),
      builtin: false,
    };
  }
  function loadCustom() {
    try {
      const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
      return Array.isArray(parsed) ? parsed.map((item, index) => normalize(item, `custom-${index + 1}`)) : [];
    } catch (_) { return []; }
  }
  function saveCustom() {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(custom)); } catch (_) {}
  }
  function readSelected() {
    try { return localStorage.getItem(SELECTED_KEY) || "web"; } catch (_) { return "web"; }
  }
  function all() { return [...BUILT_INS, ...custom]; }
  function current() { return all().find((item) => item.id === selectedId) || BUILT_INS[0]; }
  function select(id) {
    selectedId = all().some((item) => item.id === id) ? id : BUILT_INS[0].id;
    try { localStorage.setItem(SELECTED_KEY, selectedId); } catch (_) {}
    refreshUi();
    window.dispatchEvent(new CustomEvent("safelight:export-profile-change", { detail: { profile: current() } }));
    return current();
  }
  function summary(profile) {
    const item = profile || current();
    return `${item.format.toUpperCase()} · ${item.maxSide ? item.maxSide + " px" : "исходный размер"}`;
  }
  function baseName() {
    const name = ($("meta-name")?.textContent || "safelight").trim();
    return cleanText(name.replace(/\.[^.]+$/, "") || "safelight", 100);
  }
  function extension(format) { return format === "jpeg" ? "jpg" : format; }
  function fileName(profile) {
    const stem = cleanText(profile.prefix + baseName() + profile.suffix, 140) || "safelight";
    return `${stem}.${extension(profile.format)}`;
  }
  function canvasBlob(canvas, type, quality) {
    return new Promise((resolve, reject) => canvas.toBlob((blob) => blob ? resolve(blob) : reject(new Error("Не удалось подготовить профиль экспорта")), type, quality));
  }
  function download(blob, filename) {
    const url = URL.createObjectURL(blob), anchor = document.createElement("a");
    anchor.href = url; anchor.download = filename; document.body.appendChild(anchor); anchor.click(); anchor.remove();
    setTimeout(() => URL.revokeObjectURL(url), 8000);
  }
  function prepareCanvas(source, profile) {
    const maxSide = Number(profile.maxSide) || 0;
    const scale = maxSide > 0 ? Math.min(1, maxSide / Math.max(source.width, source.height)) : 1;
    const fill = profile.format === "jpeg" || profile.background !== "transparent";
    if (scale === 1 && !fill) return source;
    const width = Math.max(1, Math.round(source.width * scale)), height = Math.max(1, Math.round(source.height * scale));
    const out = document.createElement("canvas"); out.width = width; out.height = height;
    const context = out.getContext("2d", { alpha: profile.format !== "jpeg" && profile.background === "transparent" });
    if (fill) {
      context.fillStyle = profile.background === "custom" ? profile.backgroundColor : "#ffffff";
      context.fillRect(0, 0, width, height);
    }
    context.imageSmoothingEnabled = true; context.imageSmoothingQuality = "high";
    context.drawImage(source, 0, 0, width, height);
    return out;
  }
  function currentTool() {
    const active = document.querySelector(".sl-sidebar .sl-tool.active") || document.querySelector("#sl-inspector-panels .panel.active");
    return String(active?.dataset.page || active?.id?.replace(/^panel-/, "") || "compress").replace(/-ui$/, "");
  }
  async function resultCanvas(tool) {
    if (tool === "crop" && window.safelightCropTools?.render) return window.safelightCropTools.render();
    if (tool === "adjust" && window.safelightAdjustTools?.render) return window.safelightAdjustTools.render();
    if (tool === "canvas" && window.safelightCanvasTools?.render) return window.safelightCanvasTools.render();
    if (tool === "annotation" && window.safelightAnnotationTools?.render) return window.safelightAnnotationTools.render();
    if (tool === "background" && window.safelightBackgroundRemovalTools?.render) return window.safelightBackgroundRemovalTools.render();
    if (tool === "privacy" && window.safelightPrivacyEffects?.render) return window.safelightPrivacyEffects.render();
    if (tool === "watermark" && window.safelightWatermarkTools?.render) return window.safelightWatermarkTools.render();
    if (window.safelightLiveEditor?.renderFull) return window.safelightLiveEditor.renderFull(tool);
    throw new Error("Полноразмерный результат ещё не готов");
  }
  async function run() {
    const profile = current(), tool = currentTool();
    const source = await resultCanvas(tool);
    if (!source?.width || !source?.height) throw new Error("Сначала загрузите изображение");
    const prepared = prepareCanvas(source, profile);
    const mime = profile.format === "png" ? "image/png" : profile.format === "jpeg" ? "image/jpeg" : "image/webp";
    const blob = await canvasBlob(prepared, mime, profile.format === "png" ? undefined : profile.quality / 100);
    download(blob, fileName(profile));
    return { blob, width: prepared.width, height: prepared.height, profile: { ...profile } };
  }

  function option(label, value, selected) {
    const item = document.createElement("option"); item.value = value; item.textContent = label; item.selected = selected; return item;
  }
  function fillSelect(selectElement) {
    if (!selectElement) return;
    selectElement.replaceChildren(...all().map((item) => option(item.name, item.id, item.id === selectedId)));
  }
  function ensureDialog() {
    if (dialog) return dialog;
    dialog = document.createElement("div"); dialog.className = "sl-profile-modal"; dialog.hidden = true;
    dialog.innerHTML = `<div class="sl-profile-dialog" role="dialog" aria-modal="true" aria-labelledby="sl-profile-title">
      <div class="sl-profile-head"><div><small>Локальные настройки</small><h2 id="sl-profile-title">Профили экспорта</h2></div><button type="button" data-profile-close aria-label="Закрыть">×</button></div>
      <label class="sl-profile-field"><span>Профиль</span><select id="sl-profile-select"></select></label>
      <label class="sl-profile-field"><span>Название</span><input id="sl-profile-name" type="text" maxlength="48"></label>
      <div class="sl-profile-grid"><label class="sl-profile-field"><span>Формат</span><select id="sl-profile-format"><option value="webp">WebP</option><option value="jpeg">JPEG</option><option value="png">PNG</option></select></label><label class="sl-profile-field"><span>Макс. сторона</span><input id="sl-profile-size" type="number" min="0" max="16384" step="1"><small>0 — исходный размер</small></label></div>
      <label class="sl-profile-field"><span>Качество <b id="sl-profile-quality-value">85%</b></span><input id="sl-profile-quality" type="range" min="1" max="100" value="85"></label>
      <div class="sl-profile-grid"><label class="sl-profile-field"><span>Фон</span><select id="sl-profile-background"><option value="transparent">Прозрачный</option><option value="white">Белый</option><option value="custom">Свой цвет</option></select></label><label class="sl-profile-field"><span>Цвет</span><input id="sl-profile-color" type="color" value="#ffffff"></label></div>
      <div class="sl-profile-grid"><label class="sl-profile-field"><span>Префикс</span><input id="sl-profile-prefix" type="text" maxlength="48"></label><label class="sl-profile-field"><span>Суффикс</span><input id="sl-profile-suffix" type="text" maxlength="48"></label></div>
      <div class="sl-profile-clean"><b>Метаданные удаляются</b><span>Профиль создаёт новую локально перекодированную копию без EXIF и GPS.</span></div>
      <div class="sl-profile-actions"><button type="button" class="danger" data-profile-delete>Удалить</button><button type="button" data-profile-close>Отмена</button><button type="button" class="primary" data-profile-save>Сохранить профиль</button></div>
    </div>`;
    document.body.appendChild(dialog);
    dialog.addEventListener("click", (event) => { if (event.target === dialog || event.target.closest("[data-profile-close]")) close(); });
    $("sl-profile-select")?.addEventListener("change", (event) => { select(event.target.value); fillForm(current()); });
    $("sl-profile-quality")?.addEventListener("input", () => { $("sl-profile-quality-value").textContent = $("sl-profile-quality").value + "%"; });
    $("sl-profile-background")?.addEventListener("change", syncDialogFields);
    $("sl-profile-format")?.addEventListener("change", syncDialogFields);
    dialog.querySelector("[data-profile-save]")?.addEventListener("click", saveForm);
    dialog.querySelector("[data-profile-delete]")?.addEventListener("click", deleteCurrent);
    return dialog;
  }
  function fillForm(profile) {
    fillSelect($("sl-profile-select"));
    $("sl-profile-name").value = profile.name; $("sl-profile-format").value = profile.format;
    $("sl-profile-size").value = String(profile.maxSide); $("sl-profile-quality").value = String(profile.quality);
    $("sl-profile-quality-value").textContent = profile.quality + "%"; $("sl-profile-background").value = profile.background;
    $("sl-profile-color").value = profile.backgroundColor; $("sl-profile-prefix").value = profile.prefix; $("sl-profile-suffix").value = profile.suffix;
    dialog.querySelector("[data-profile-delete]").hidden = !!profile.builtin;
    dialog.querySelector("[data-profile-save]").textContent = profile.builtin ? "Сохранить копию" : "Сохранить";
    syncDialogFields();
  }
  function syncDialogFields() {
    const format = $("sl-profile-format")?.value, background = $("sl-profile-background");
    if (format === "jpeg" && background?.value === "transparent") background.value = "white";
    $("sl-profile-color").disabled = background?.value !== "custom";
    $("sl-profile-quality").disabled = format === "png";
  }
  function formValue() {
    return normalize({
      name: $("sl-profile-name")?.value, format: $("sl-profile-format")?.value, maxSide: $("sl-profile-size")?.value,
      quality: $("sl-profile-quality")?.value, background: $("sl-profile-background")?.value, backgroundColor: $("sl-profile-color")?.value,
      prefix: $("sl-profile-prefix")?.value, suffix: $("sl-profile-suffix")?.value,
    });
  }
  function saveForm() {
    const active = current(), value = formValue();
    if (active.builtin) value.id = `custom-${Date.now()}`; else value.id = active.id;
    const index = custom.findIndex((item) => item.id === value.id);
    if (index >= 0) custom[index] = value; else custom.push(value);
    saveCustom(); select(value.id); fillForm(value);
  }
  function deleteCurrent() {
    const active = current(); if (active.builtin) return;
    custom = custom.filter((item) => item.id !== active.id); saveCustom(); select("web"); fillForm(current());
  }
  function open() { ensureDialog(); fillForm(current()); dialog.hidden = false; document.body.classList.add("sl-profile-open"); $("sl-profile-select")?.focus(); }
  function close() { if (!dialog) return; dialog.hidden = true; document.body.classList.remove("sl-profile-open"); }

  function injectMenu(menu) {
    if (!menu || menu.querySelector(".sl-export-profile-menu")) return;
    const tool = currentTool(); if (["batch", "metadata", "favicon", "slice"].includes(tool)) return;
    const block = document.createElement("div"); block.className = "sl-export-profile-menu";
    const copy = document.createElement("span"), name = document.createElement("b"), meta = document.createElement("small"), edit = document.createElement("button"), runButton = document.createElement("button");
    copy.className = "sl-export-profile-copy"; name.textContent = current().name; meta.textContent = summary(); copy.append(name, meta);
    edit.type = "button"; edit.dataset.exportProfileOpen = "1"; edit.textContent = "Настроить";
    runButton.type = "button"; runButton.className = "sl-export-profile-run"; runButton.dataset.exportProfileRun = "1"; runButton.textContent = "Экспортировать по профилю";
    block.append(copy, edit, runButton);
    menu.querySelector(".sl-export-menu-title")?.insertAdjacentElement("afterend", block);
  }
  function ensureBatchBlock() {
    const panel = $("panel-batch"), firstSection = panel?.querySelector(".sl-batch-section");
    if (!panel || !firstSection || panel.querySelector(".sl-batch-profile")) return;
    const block = document.createElement("div"); block.className = "sl-batch-profile";
    block.innerHTML = '<label><span>Профиль экспорта</span><select id="b-profile"></select></label><div><button type="button" data-b-profile-apply>Применить</button><button type="button" data-b-profile-edit>Настроить</button></div>';
    firstSection.parentNode.insertBefore(block, firstSection);
    block.querySelector("#b-profile")?.addEventListener("change", (event) => select(event.target.value));
    block.querySelector("[data-b-profile-apply]")?.addEventListener("click", () => applyToBatch(current()));
    block.querySelector("[data-b-profile-edit]")?.addEventListener("click", open);
    fillSelect(block.querySelector("#b-profile"));
  }
  function setControl(id, value) {
    const element = $(id); if (!element) return;
    element.value = String(value); element.dispatchEvent(new Event("input", { bubbles: true })); element.dispatchEvent(new Event("change", { bubbles: true }));
  }
  function applyToBatch(profile) {
    const item = profile || current();
    setControl("b-format", item.format); setControl("b-quality", item.quality); setControl("b-resize-mode", item.maxSide ? "longest" : "none");
    if (item.maxSide) setControl("b-size", item.maxSide);
    setControl("b-background", item.background); setControl("b-bg-color", item.backgroundColor); setControl("b-prefix", item.prefix); setControl("b-suffix", item.suffix);
    const status = $("b-status"); if (status) status.textContent = `Профиль «${item.name}» применён ко всей очереди.`;
  }
  function refreshUi() {
    document.querySelectorAll("#b-profile").forEach(fillSelect);
    document.querySelectorAll(".sl-export-profile-menu").forEach((block) => {
      block.querySelector("b").textContent = current().name; block.querySelector("small").textContent = summary();
    });
    if (dialog && !dialog.hidden) fillForm(current());
  }
  function install() {
    ensureDialog(); ensureBatchBlock();
    const menu = document.querySelector(".sl-export-menu");
    if (menu) {
      new MutationObserver(() => queueMicrotask(() => injectMenu(menu))).observe(menu, { childList: true });
      injectMenu(menu);
    }
    document.addEventListener("click", (event) => {
      if (event.target.closest("[data-export-profile-open]")) { event.preventDefault(); event.stopImmediatePropagation(); open(); return; }
      if (event.target.closest("[data-export-profile-run]")) {
        event.preventDefault(); event.stopImmediatePropagation(); document.querySelector(".sl-export-wrap")?.classList.remove("open");
        const button = $("sl-export"); if (button) button.disabled = true;
        run().then((result) => {
          const hint = $("sl-export-hint"); if (hint) { hint.textContent = `Профиль «${result.profile.name}»: ${result.width} × ${result.height}`; hint.classList.add("show"); setTimeout(() => hint.classList.remove("show"), 3000); }
        }).catch((error) => { console.error("Safelight profile export:", error); const hint = $("sl-export-hint"); if (hint) { hint.textContent = error.message || "Не удалось экспортировать профиль"; hint.classList.add("show"); } }).finally(() => {
          if (!button) return;
          button.disabled = currentTool() === "batch" ? !window.safelightBatchTools?.hasFiles?.() : !$("previewImg")?.src;
        });
      }
    }, true);
    window.addEventListener("safelight:toolchange", () => setTimeout(ensureBatchBlock, 0));
  }

  window.safelightExportProfiles = Object.freeze({ all: () => all().map((item) => ({ ...item })), current: () => ({ ...current() }), select, summary, open, close, run, prepareCanvas, applyToBatch });
  install();
})();
