(function () {
  "use strict";

  if (window.safelightBatchToolsLoaded) return;
  window.safelightBatchToolsLoaded = true;

  const MAX_SIDE = 16384;
  const MAX_PIXELS = 100000000;
  const state = {
    entries: [],
    running: false,
    cancelRequested: false,
    nextId: 1,
    thumbUrls: new Map(),
  };

  const $ = (id) => document.getElementById(id);
  const isHeic = (file) => !!file && (/\.(heic|heif)$/i.test(file.name || "") || /^image\/hei[cf]/i.test(file.type || ""));
  const isSupported = (file) => !!file && ((file.type || "").startsWith("image/") || /\.(png|jpe?g|webp|gif|bmp|avif|heic|heif)$/i.test(file.name || ""));

  function formatBytes(bytes) {
    const value = Number(bytes) || 0;
    if (value < 1024) return value + " B";
    if (value < 1048576) return (value / 1024).toFixed(1) + " KB";
    return (value / 1048576).toFixed(2) + " MB";
  }

  function fileKey(file) {
    return [file.name, file.size, file.lastModified].join(":");
  }

  function baseName(name) {
    return String(name || "image").replace(/\.[^.]+$/, "") || "image";
  }

  function cleanName(value) {
    return String(value || "")
      .replace(/[\\/:*?"<>|\u0000-\u001f]/g, "-")
      .replace(/\s+/g, " ")
      .trim()
      .slice(0, 100);
  }

  function currentTool() {
    const active = document.querySelector(".sl-sidebar .sl-tool.active") || document.querySelector("#sl-inspector-panels .panel.active");
    return active?.dataset.page || active?.id?.replace(/^panel-/, "") || "";
  }

  function totalSourceSize() {
    return state.entries.reduce((total, entry) => total + (entry.file.size || 0), 0);
  }

  function setStatus(text) {
    const status = $("b-status");
    if (status) status.textContent = text;
  }

  function setProgress(value) {
    const percent = Math.max(0, Math.min(100, Math.round(Number(value) || 0)));
    const bar = $("b-bar");
    const progress = $("b-progress");
    if (bar) bar.style.width = percent + "%";
    if (progress) progress.setAttribute("aria-valuenow", String(percent));
  }

  function setToolbarAvailability() {
    const button = $("sl-export");
    if (!button || currentTool() !== "batch") return;
    button.disabled = state.running || !state.entries.length;
  }

  function updateControls() {
    const hasFiles = state.entries.length > 0;
    const clear = $("b-clear");
    const run = $("b-download");
    const cancel = $("b-cancel");
    const input = $("batch-files");
    if (clear) clear.disabled = state.running || !hasFiles;
    if (run) run.disabled = state.running || !hasFiles;
    if (cancel) cancel.hidden = !state.running;
    if (input) input.disabled = state.running;
    document.querySelectorAll("#panel-batch input:not([type=file]), #panel-batch select").forEach((control) => {
      if (control.type === "checkbox" && control.disabled && control.id !== "b-no-upscale") return;
      control.disabled = state.running;
    });
    document.querySelectorAll("#b-queue .sl-batch-remove").forEach((button) => (button.disabled = state.running));
    if (!state.running) syncSettingsUi();
    setToolbarAvailability();
  }

  function syncInputFiles() {
    const input = $("batch-files");
    if (!input || typeof DataTransfer === "undefined") return;
    try {
      const transfer = new DataTransfer();
      state.entries.forEach((entry) => transfer.items.add(entry.file));
      input.files = transfer.files;
    } catch (_) {
      // The queue remains authoritative on browsers that do not allow assigning FileList.
    }
  }

  function thumbnailFor(entry) {
    if (isHeic(entry.file)) return null;
    if (state.thumbUrls.has(entry.id)) return state.thumbUrls.get(entry.id);
    const url = URL.createObjectURL(entry.file);
    state.thumbUrls.set(entry.id, url);
    return url;
  }

  function revokeThumbnail(id) {
    const url = state.thumbUrls.get(id);
    if (url) URL.revokeObjectURL(url);
    state.thumbUrls.delete(id);
  }

  function renderQueue() {
    const queue = $("b-queue");
    const count = $("b-count");
    const summary = $("b-summary");
    if (count) count.textContent = String(state.entries.length);
    if (summary) summary.textContent = state.entries.length
      ? formatBytes(totalSourceSize()) + " исходных данных · обработка остаётся на устройстве"
      : "Добавьте PNG, JPEG, WebP или HEIC";
    if (!queue) return;
    queue.replaceChildren();
    if (!state.entries.length) {
      const empty = document.createElement("div");
      empty.className = "sl-batch-empty";
      empty.textContent = "Очередь пока пуста";
      queue.appendChild(empty);
      updateControls();
      return;
    }

    state.entries.forEach((entry) => {
      const item = document.createElement("div");
      item.className = "sl-batch-item " + entry.status;
      item.dataset.batchId = String(entry.id);
      item.setAttribute("role", "listitem");

      const thumb = document.createElement("div");
      thumb.className = "sl-batch-thumb";
      const source = thumbnailFor(entry);
      if (source) {
        const image = document.createElement("img");
        image.src = source;
        image.alt = "";
        thumb.appendChild(image);
      } else {
        thumb.textContent = isHeic(entry.file) ? "HEIC" : "IMG";
      }

      const copy = document.createElement("div");
      copy.className = "sl-batch-copy";
      const name = document.createElement("b");
      name.textContent = entry.file.name;
      const detail = document.createElement("small");
      detail.textContent = entry.detail || formatBytes(entry.file.size);
      copy.append(name, detail);

      const remove = document.createElement("button");
      remove.type = "button";
      remove.className = "sl-batch-remove";
      remove.dataset.batchRemove = String(entry.id);
      remove.setAttribute("aria-label", "Удалить " + entry.file.name + " из очереди");
      remove.textContent = "×";
      remove.disabled = state.running;
      item.append(thumb, copy, remove);
      queue.appendChild(item);
    });
    updateControls();
  }

  function emitChange() {
    window.dispatchEvent(new CustomEvent("safelight:batch-change", { detail: { count: state.entries.length } }));
  }

  function resetEntries() {
    state.entries.forEach((entry) => {
      entry.status = "pending";
      entry.detail = formatBytes(entry.file.size);
    });
  }

  function addFiles(list) {
    if (state.running) return;
    const existing = new Set(state.entries.map((entry) => fileKey(entry.file)));
    let added = 0;
    let rejected = 0;
    [...(list || [])].forEach((file) => {
      if (!isSupported(file)) {
        rejected++;
        return;
      }
      const key = fileKey(file);
      if (existing.has(key)) return;
      existing.add(key);
      state.entries.push({ id: state.nextId++, file, status: "pending", detail: formatBytes(file.size) });
      added++;
    });
    syncInputFiles();
    resetEntries();
    setProgress(0);
    renderQueue();
    emitChange();
    if (rejected) setStatus("Часть файлов пропущена: формат не поддерживается.");
    else if (added) setStatus("Готово к обработке: " + state.entries.length + ".");
  }

  function removeEntry(id) {
    if (state.running) return;
    const index = state.entries.findIndex((entry) => entry.id === id);
    if (index < 0) return;
    revokeThumbnail(state.entries[index].id);
    state.entries.splice(index, 1);
    syncInputFiles();
    setProgress(0);
    renderQueue();
    emitChange();
    setStatus(state.entries.length ? "Файл удалён из очереди." : "Добавьте изображения, чтобы начать.");
  }

  function clearQueue() {
    if (state.running) return;
    state.entries.forEach((entry) => revokeThumbnail(entry.id));
    state.entries = [];
    syncInputFiles();
    setProgress(0);
    renderQueue();
    emitChange();
    setStatus("Очередь очищена.");
  }

  function syncSettingsUi() {
    const format = $("b-format")?.value || "webp";
    const mode = $("b-resize-mode")?.value || "none";
    const resizing = mode !== "none";
    const sizeField = $("b-size-field");
    const upscale = $("b-upscale-row");
    const qualityRow = $("b-quality-row");
    const quality = $("b-quality");
    if (sizeField) sizeField.hidden = !resizing;
    if (upscale) upscale.hidden = !resizing;
    if (qualityRow) qualityRow.classList.toggle("muted", format === "png" || format === "heic");
    if (quality) quality.disabled = state.running || format === "png" || format === "heic";
    if ($("b-quality-val")) $("b-quality-val").textContent = (quality?.value || "85") + "%";
  }

  function settings() {
    const format = ["webp", "jpeg", "png", "heic"].includes($("b-format")?.value) ? $("b-format").value : "webp";
    const mode = ["none", "longest", "width", "height"].includes($("b-resize-mode")?.value) ? $("b-resize-mode").value : "none";
    return {
      format,
      mode,
      size: Math.max(1, Math.min(MAX_SIDE, Math.round(Number($("b-size")?.value) || 1920))),
      noUpscale: $("b-no-upscale")?.checked !== false,
      quality: Math.max(0.01, Math.min(1, (Number($("b-quality")?.value) || 85) / 100)),
      prefix: cleanName($("b-prefix")?.value),
      suffix: cleanName($("b-suffix")?.value),
    };
  }

  function outputDimensions(width, height, options) {
    let scale = 1;
    if (options.mode === "longest") scale = options.size / Math.max(width, height);
    if (options.mode === "width") scale = options.size / width;
    if (options.mode === "height") scale = options.size / height;
    if (options.mode === "none") scale = 1;
    if (options.noUpscale) scale = Math.min(1, scale);
    const outputWidth = Math.max(1, Math.round(width * scale));
    const outputHeight = Math.max(1, Math.round(height * scale));
    if (outputWidth > MAX_SIDE || outputHeight > MAX_SIDE || outputWidth * outputHeight > MAX_PIXELS) {
      throw new Error("результат слишком большой для браузера");
    }
    return { width: outputWidth, height: outputHeight };
  }

  function imageFromFile(file) {
    return new Promise((resolve, reject) => {
      const url = URL.createObjectURL(file);
      const image = new Image();
      image.onload = () => resolve({ source: image, width: image.naturalWidth, height: image.naturalHeight, close: () => URL.revokeObjectURL(url) });
      image.onerror = () => {
        URL.revokeObjectURL(url);
        reject(new Error("не удалось открыть изображение"));
      };
      image.src = url;
    });
  }

  async function openImage(file) {
    let source = file;
    if (isHeic(file)) {
      const decode = window.safelightHeicCodec?.decodeFile;
      if (typeof decode !== "function") throw new Error("HEIC-кодек не загрузился");
      source = await decode(file);
    }
    if (typeof createImageBitmap === "function") {
      try {
        const bitmap = await createImageBitmap(source, { imageOrientation: "from-image" });
        return { source: bitmap, width: bitmap.width, height: bitmap.height, close: () => bitmap.close?.() };
      } catch (_) {
        try {
          const bitmap = await createImageBitmap(source);
          return { source: bitmap, width: bitmap.width, height: bitmap.height, close: () => bitmap.close?.() };
        } catch (_) {
          // Continue with the image element fallback.
        }
      }
    }
    return imageFromFile(source);
  }

  function canvasBlob(canvas, type, quality) {
    return new Promise((resolve, reject) => {
      canvas.toBlob((blob) => blob ? resolve(blob) : reject(new Error("браузер не смог закодировать результат")), type, quality);
    });
  }

  async function encodeCanvas(canvas, options) {
    if (options.format === "heic") {
      const encode = window.safelightHeicCodec?.encodeCanvas;
      if (typeof encode !== "function") throw new Error("HEIC-кодек не загрузился");
      return encode(canvas);
    }
    const mime = options.format === "png" ? "image/png" : options.format === "jpeg" ? "image/jpeg" : "image/webp";
    return canvasBlob(canvas, mime, options.format === "png" ? undefined : options.quality);
  }

  async function processFile(file, options) {
    const opened = await openImage(file);
    try {
      const output = outputDimensions(opened.width, opened.height, options);
      const canvas = document.createElement("canvas");
      canvas.width = output.width;
      canvas.height = output.height;
      const context = canvas.getContext("2d", { alpha: options.format !== "jpeg" });
      context.imageSmoothingEnabled = true;
      context.imageSmoothingQuality = "high";
      if (options.format === "jpeg") {
        context.fillStyle = "#ffffff";
        context.fillRect(0, 0, canvas.width, canvas.height);
      }
      context.drawImage(opened.source, 0, 0, canvas.width, canvas.height);
      return { blob: await encodeCanvas(canvas, options), width: canvas.width, height: canvas.height };
    } finally {
      opened.close();
    }
  }

  function extensionFor(format) {
    return format === "jpeg" ? "jpg" : format;
  }

  function uniqueOutputName(file, options, names) {
    const stem = cleanName(options.prefix + baseName(file.name) + options.suffix) || "image-safelight";
    const ext = extensionFor(options.format);
    let candidate = stem + "." + ext;
    let index = 2;
    while (names.has(candidate.toLowerCase())) candidate = stem + "-" + index++ + "." + ext;
    names.add(candidate.toLowerCase());
    return candidate;
  }

  function download(blob, filename) {
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = filename;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    setTimeout(() => URL.revokeObjectURL(url), 10000);
  }

  async function exportBatch() {
    if (state.running) return null;
    if (!state.entries.length) throw new Error("Сначала добавьте изображения в очередь");
    if (!window.JSZip) throw new Error("Локальный ZIP-модуль не загрузился");

    const options = settings();
    if (options.format === "heic" && typeof window.safelightHeicCodec?.encodeCanvas !== "function") {
      throw new Error("HEIC-кодек не загрузился");
    }

    state.running = true;
    state.cancelRequested = false;
    resetEntries();
    renderQueue();
    updateControls();
    setProgress(0);

    const zip = new JSZip();
    const names = new Set();
    const errors = [];
    let successCount = 0;
    let sourceBytes = 0;
    let outputBytes = 0;

    try {
      for (let index = 0; index < state.entries.length; index++) {
        if (state.cancelRequested) break;
        const entry = state.entries[index];
        entry.status = "processing";
        entry.detail = "Обработка " + (index + 1) + " из " + state.entries.length + "…";
        renderQueue();
        setStatus("Обрабатываю «" + entry.file.name + "»…");
        try {
          const result = await processFile(entry.file, options);
          if (state.cancelRequested) break;
          const name = uniqueOutputName(entry.file, options, names);
          zip.file(name, result.blob);
          successCount++;
          sourceBytes += entry.file.size || 0;
          outputBytes += result.blob.size || 0;
          entry.status = "done";
          entry.detail = result.width + " × " + result.height + " · " + formatBytes(result.blob.size);
        } catch (error) {
          entry.status = "error";
          entry.detail = error?.message || "ошибка обработки";
          errors.push(entry.file.name + ": " + entry.detail);
        }
        renderQueue();
        setProgress(((index + 1) / state.entries.length) * 82);
      }

      if (state.cancelRequested) {
        state.entries.forEach((entry) => {
          if (entry.status === "processing") {
            entry.status = "pending";
            entry.detail = "Отменено";
          }
        });
        setStatus("Обработка отменена. Файлы не скачивались.");
        setProgress(0);
        return null;
      }
      if (!successCount) throw new Error("Не удалось обработать ни одного изображения");
      if (errors.length) zip.file("safelight-errors.txt", "Не удалось обработать:\n\n" + errors.join("\n"));

      setStatus("Собираю ZIP на устройстве…");
      const archive = await zip.generateAsync({ type: "blob" }, (metadata) => setProgress(82 + metadata.percent * 0.18));
      download(archive, "safelight-batch-" + successCount + ".zip");
      setProgress(100);
      const saved = sourceBytes > 0 ? Math.round((1 - outputBytes / sourceBytes) * 100) : 0;
      const sizeNote = saved > 0 ? " · файлы меньше примерно на " + saved + "%" : "";
      const errorNote = errors.length ? " · ошибок: " + errors.length : "";
      setStatus("Готово: " + successCount + " из " + state.entries.length + " добавлено в ZIP" + sizeNote + errorNote + ".");
      return { archive, successCount, errorCount: errors.length, outputBytes };
    } catch (error) {
      setStatus(error?.message || "Не удалось обработать файлы");
      throw error;
    } finally {
      state.running = false;
      state.cancelRequested = false;
      updateControls();
      renderQueue();
    }
  }

  function menuItems() {
    const options = settings();
    const label = state.entries.length + " файл" + (state.entries.length === 1 ? "" : state.entries.length < 5 ? "а" : "ов");
    return [{ value: "batch-zip", label: "Скачать ZIP", meta: label + " · " + options.format.toUpperCase() }];
  }

  function install() {
    const input = $("batch-files");
    const drop = $("batch-drop");
    if (!input || !drop) {
      setTimeout(install, 60);
      return;
    }
    if (input.dataset.batchReady === "1") return;
    input.dataset.batchReady = "1";

    input.addEventListener("click", () => {
      if (!state.running) input.value = "";
    });
    input.addEventListener("change", (event) => addFiles(event.target.files));
    ["dragenter", "dragover"].forEach((name) => drop.addEventListener(name, (event) => {
      event.preventDefault();
      if (!state.running) drop.classList.add("drag");
    }));
    ["dragleave", "drop"].forEach((name) => drop.addEventListener(name, (event) => {
      event.preventDefault();
      drop.classList.remove("drag");
    }));
    drop.addEventListener("drop", (event) => addFiles(event.dataTransfer?.files));
    $("b-queue")?.addEventListener("click", (event) => {
      const button = event.target.closest("[data-batch-remove]");
      if (button) removeEntry(Number(button.dataset.batchRemove));
    });
    $("b-clear")?.addEventListener("click", clearQueue);
    $("b-download")?.addEventListener("click", () => exportBatch().catch((error) => setStatus(error.message || "Не удалось обработать файлы")));
    $("b-cancel")?.addEventListener("click", () => {
      state.cancelRequested = true;
      setStatus("Останавливаю после текущего файла…");
    });
    ["b-format", "b-resize-mode", "b-quality"].forEach((id) => {
      $(id)?.addEventListener("input", syncSettingsUi);
      $(id)?.addEventListener("change", syncSettingsUi);
    });
    window.addEventListener("safelight:toolchange", (event) => {
      if (event.detail?.page === "batch") setTimeout(() => {
        syncSettingsUi();
        setToolbarAvailability();
      }, 0);
    });
    window.addEventListener("beforeunload", () => state.entries.forEach((entry) => revokeThumbnail(entry.id)));
    syncSettingsUi();
    renderQueue();
  }

  window.safelightBatchTools = Object.freeze({
    addFiles,
    clear: clearQueue,
    export: exportBatch,
    hasFiles: () => state.entries.length > 0,
    menuItems,
    state: () => ({ running: state.running, count: state.entries.length, entries: state.entries.map((entry) => ({ name: entry.file.name, status: entry.status, detail: entry.detail })) }),
  });

  install();
})();
