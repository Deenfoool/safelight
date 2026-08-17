(function () {
  "use strict";

  // ---- State ----
  let originalFile = null;
  let originalSize = 0;
  let imgW = 0;
  let imgH = 0;

  let compressedBlob = null;
  let compressedExt = "";
  let resizeBlob = null;
  let cropBlob = null;
  let adjustBlob = null;

  const sourceCanvas = document.createElement("canvas");
  const sourceCtx = sourceCanvas.getContext("2d");

  let statOps = 0;
  let statSavedBytes = 0;
  let statTiles = 0;

  window.sliceMode = "grid";

  // ---- Helpers ----
  const $ = (id) => document.getElementById(id);

  function formatBytes(bytes) {
    if (bytes < 1024) return bytes + " B";
    if (bytes < 1048576) return (bytes / 1024).toFixed(1) + " KB";
    return (bytes / 1048576).toFixed(2) + " MB";
  }

  function mimeFor(fmt) {
    if (fmt === "png") return "image/png";
    if (fmt === "webp") return "image/webp";
    return "image/jpeg";
  }

  function extFor(fmt) {
    if (fmt === "png") return "png";
    if (fmt === "webp") return "webp";
    return "jpg";
  }

  function downloadBlob(blob, filename) {
    if (!blob) return;
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 4000);
  }

  function baseName(name) {
    const i = name.lastIndexOf(".");
    return i > 0 ? name.slice(0, i) : name;
  }

  function bumpStats() {
    $("stat-ops").textContent = statOps;
    $("stat-saved").textContent = statSavedBytes > 0 ? formatBytes(statSavedBytes) : "0 KB";
    $("stat-tiles").textContent = statTiles;
  }

  function markOperation() {
    statOps++;
    bumpStats();
  }

  function canvasToBlob(canvas, mime, quality) {
    return new Promise((resolve, reject) => {
      canvas.toBlob(
        (blob) => (blob ? resolve(blob) : reject(new Error("toBlob failed"))),
        mime,
        quality
      );
    });
  }

  function resetResultPanels() {
    ["c-result", "v-result", "r-result", "cr-result", "a-result"].forEach((id) => {
      const el = $(id);
      if (el) el.classList.remove("show");
    });
    ["c-status", "v-status", "r-status", "cr-status", "a-status", "s-status"].forEach((id) => {
      const el = $(id);
      if (el) el.textContent = "";
    });
  }

  // ---- Upload ----
  const dropzone = $("dropzone");
  const fileInput = $("fileInput");
  const filemeta = $("filemeta");
  const stageEmpty = $("stageEmpty");
  const previewWrap = $("previewWrap");
  const previewImg = $("previewImg");
  const gridOverlay = $("gridOverlay");
  const readout = $("readout");

  ["dragover", "dragenter"].forEach((ev) =>
    dropzone.addEventListener(ev, (e) => {
      e.preventDefault();
      dropzone.classList.add("drag");
    })
  );
  ["dragleave", "drop"].forEach((ev) =>
    dropzone.addEventListener(ev, (e) => {
      e.preventDefault();
      dropzone.classList.remove("drag");
    })
  );

  // dropzone is a <label>, so the browser already opens fileInput when clicked.
  // Do not call fileInput.click() here: doing both opens the picker twice.
  dropzone.addEventListener("drop", (e) => {
    const f = e.dataTransfer.files[0];
    if (f) handleFile(f);
  });

  fileInput.addEventListener("change", (e) => {
    if (e.target.files[0]) handleFile(e.target.files[0]);
    e.target.value = "";
  });

  function handleFile(file) {
    if (!file.type.startsWith("image/")) {
      alert("Пожалуйста, выберите файл изображения.");
      return;
    }

    originalFile = file;
    originalSize = file.size;

    const url = URL.createObjectURL(file);
    const img = new Image();

    img.onload = function () {
      URL.revokeObjectURL(url);
      imgW = img.naturalWidth;
      imgH = img.naturalHeight;

      sourceCanvas.width = imgW;
      sourceCanvas.height = imgH;
      sourceCtx.imageSmoothingEnabled = true;
      sourceCtx.imageSmoothingQuality = "high";
      sourceCtx.clearRect(0, 0, imgW, imgH);
      sourceCtx.drawImage(img, 0, 0, imgW, imgH);

      previewImg.src = URL.createObjectURL(file);
      stageEmpty.style.display = "none";
      previewWrap.style.display = "inline-block";
      readout.style.display = "flex";

      $("meta-name").textContent = file.name;
      $("meta-size").textContent = formatBytes(file.size);
      $("meta-type").textContent = file.type || "—";
      $("meta-dims").textContent = imgW + " × " + imgH;
      filemeta.classList.add("show");

      $("ro-dims").textContent = imgW + " × " + imgH + " px";
      $("ro-size").textContent = formatBytes(file.size);
      $("ro-format").textContent = (file.type.replace("image/", "") || "—").toUpperCase();

      $("t-name").textContent = file.name;
      $("t-name2").textContent = file.name;
      $("t-status").textContent = "готово — изображение загружено";
      $("t-dims").textContent =
        imgW + "x" + imgH + " px, " + (file.type.replace("image/", "") || "—").toUpperCase();
      $("t-size").textContent = formatBytes(file.size);

      resetResultPanels();

      $("r-width").value = imgW;
      $("r-height").value = imgH;
      $("cr-width").value = imgW;
      $("cr-height").value = imgH;

      document.querySelectorAll(".af").forEach((el) => el.classList.remove("show"));
      requestAnimationFrame(() =>
        setTimeout(() => document.querySelectorAll(".af").forEach((el) => el.classList.add("show")), 60)
      );

      renderGridOverlay();
    };

    img.onerror = function () {
      URL.revokeObjectURL(url);
      alert("Не удалось загрузить изображение.");
    };

    img.src = url;
  }

  // ---- Slice helpers ----
  function currentGrid() {
    let rows = Math.max(1, Math.min(20, Number($("s-rows").value) || 1));
    let cols = Math.max(1, Math.min(20, Number($("s-cols").value) || 1));
    if (window.sliceMode === "horizontal") cols = 1;
    if (window.sliceMode === "vertical") rows = 1;
    return { rows, cols };
  }

  function renderGridOverlay() {
    gridOverlay.innerHTML = "";
    if (!imgW) return;
    const { rows, cols } = currentGrid();
    for (let c = 1; c < cols; c++) {
      const line = document.createElement("div");
      line.className = "grid-line v";
      line.style.left = (c / cols) * 100 + "%";
      gridOverlay.appendChild(line);
    }
    for (let r = 1; r < rows; r++) {
      const line = document.createElement("div");
      line.className = "grid-line h";
      line.style.top = (r / rows) * 100 + "%";
      gridOverlay.appendChild(line);
    }
  }

  function boundaries(total, n) {
    const arr = [0];
    const step = Math.floor(total / n);
    for (let i = 1; i < n; i++) arr.push(i * step);
    arr.push(total);
    return arr;
  }

  // ---- Slice UI ----
  $("s-mode").querySelectorAll("button").forEach((btn) =>
    btn.addEventListener("click", () => {
      $("s-mode").querySelectorAll("button").forEach((b) => b.classList.remove("active"));
      btn.classList.add("active");
      window.sliceMode = btn.dataset.mode;
      $("s-rows-field").style.display = window.sliceMode === "vertical" ? "none" : "flex";
      $("s-cols-field").style.display = window.sliceMode === "horizontal" ? "none" : "flex";
      renderGridOverlay();
    })
  );

  [$("s-rows"), $("s-cols")].forEach((el) => el.addEventListener("input", renderGridOverlay));

  $("s-format").addEventListener("change", () => {
    $("s-quality-row").style.display = $("s-format").value === "png" ? "none" : "flex";
  });
  $("s-quality").addEventListener("input", () => {
    $("s-quality-val").textContent = $("s-quality").value + "%";
  });

  // ---- Compress ----
  $("c-format").addEventListener("change", () => {
    $("c-quality").disabled = $("c-format").value === "png";
  });
  $("c-quality").addEventListener("input", () => {
    $("c-quality-val").textContent = $("c-quality").value + "%";
  });
  $("c-quality").disabled = false;

  $("c-run").addEventListener("click", () => {
    if (!originalFile) return;
    $("c-run").disabled = true;
    $("c-status").textContent = "Сжимаю…";

    const fmt = $("c-format").value;
    const q = Number($("c-quality").value) / 100;

    setTimeout(() => {
      sourceCanvas.toBlob(
        (blob) => {
          $("c-run").disabled = false;
          if (!blob) {
            $("c-status").textContent = "Не удалось обработать изображение.";
            return;
          }
          compressedBlob = blob;
          compressedExt = extFor(fmt);
          const diff = originalSize - blob.size;
          const pct = originalSize ? Math.round((diff / originalSize) * 100) : 0;
          $("c-before").textContent = formatBytes(originalSize);
          $("c-after").textContent = formatBytes(blob.size);
          $("c-savings").textContent = (diff >= 0 ? "−" : "+") + Math.abs(pct) + "%";
          $("c-savings").classList.toggle("negative", diff < 0);
          if (diff > 0) statSavedBytes += diff;
          $("c-result").classList.add("show");
          $("c-status").textContent = "Готово.";
          markOperation();
        },
        mimeFor(fmt),
        fmt === "png" ? undefined : q
      );
    }, 30);
  });

  $("c-download").addEventListener("click", () =>
    downloadBlob(compressedBlob, baseName(originalFile.name) + "-compressed." + compressedExt)
  );

  // ---- Slice ----
  $("s-run").addEventListener("click", async () => {
    if (!originalFile) return;
    if (typeof JSZip === "undefined") {
      $("s-status").textContent = "ZIP-библиотека не загрузилась.";
      return;
    }

    $("s-run").disabled = true;
    const { rows, cols } = currentGrid();
    const fmt = $("s-format").value;
    const q = Number($("s-quality").value) / 100;
    const mime = mimeFor(fmt);
    const ext = extFor(fmt);

    $("s-status").textContent = "Нарезаю " + rows + "×" + cols + "…";

    try {
      const xs = boundaries(imgW, cols);
      const ys = boundaries(imgH, rows);
      const zip = new JSZip();
      const canvas = document.createElement("canvas");
      const ctx = canvas.getContext("2d");
      let count = 0;

      for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
          const x0 = xs[c];
          const x1 = xs[c + 1];
          const y0 = ys[r];
          const y1 = ys[r + 1];
          const w = x1 - x0;
          const h = y1 - y0;
          canvas.width = w;
          canvas.height = h;
          ctx.clearRect(0, 0, w, h);
          ctx.drawImage(sourceCanvas, x0, y0, w, h, 0, 0, w, h);
          const blob = await canvasToBlob(canvas, mime, fmt === "png" ? undefined : q);
          zip.file("tile_r" + (r + 1) + "_c" + (c + 1) + "." + ext, blob);
          count++;
          $("s-status").textContent = "Обработано " + count + " / " + rows * cols + "…";
        }
      }

      const zipBlob = await zip.generateAsync({ type: "blob" });
      downloadBlob(zipBlob, baseName(originalFile.name) + "-slices.zip");
      $("s-status").textContent = "Готово — " + rows * cols + " фрагментов.";
      statTiles += rows * cols;
      markOperation();
    } catch (err) {
      $("s-status").textContent = "Ошибка: " + (err.message || "неизвестная ошибка");
    } finally {
      $("s-run").disabled = false;
    }
  });

  // Converter execution is owned by hardening.js. Keep only the quality readout here.
  $("v-quality").addEventListener("input", () => {
    $("v-quality-val").textContent = $("v-quality").value + "%";
  });

  // ---- Resize ----
  function syncResizeHeight() {
    if ($("r-lock").value === "lock" && imgW && imgH) {
      const w = Math.max(1, Number($("r-width").value) || imgW);
      $("r-height").value = Math.max(1, Math.round((w * imgH) / imgW));
    }
  }

  $("r-width").addEventListener("input", syncResizeHeight);
  $("r-lock").addEventListener("change", syncResizeHeight);

  $("r-run").addEventListener("click", () => {
    if (!originalFile) return;

    const w = Math.max(1, Number($("r-width").value) || imgW);
    const h = Math.max(1, Number($("r-height").value) || imgH);
    const c = document.createElement("canvas");
    const ctx = c.getContext("2d");
    c.width = w;
    c.height = h;
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = "high";
    ctx.drawImage(sourceCanvas, 0, 0, w, h);

    c.toBlob((blob) => {
      if (!blob) {
        $("r-status").textContent = "Не удалось изменить размер.";
        return;
      }
      resizeBlob = blob;
      $("r-before").textContent = imgW + " × " + imgH;
      $("r-after").textContent = w + " × " + h;
      $("r-result").classList.add("show");
      $("r-status").textContent = "Готово.";
      markOperation();
    }, "image/png");
  });

  $("r-download").addEventListener("click", () =>
    downloadBlob(resizeBlob, baseName(originalFile.name) + "-resized.png")
  );

  // ---- Crop ----
  $("cr-run").addEventListener("click", () => {
    if (!originalFile) return;

    const w = Math.min(imgW, Math.max(1, Number($("cr-width").value) || imgW));
    const h = Math.min(imgH, Math.max(1, Number($("cr-height").value) || imgH));
    const pos = $("cr-position").value;
    let x = Math.floor((imgW - w) / 2);
    let y = Math.floor((imgH - h) / 2);
    if (pos === "top") y = 0;
    if (pos === "bottom") y = imgH - h;

    const c = document.createElement("canvas");
    const ctx = c.getContext("2d");
    c.width = w;
    c.height = h;
    ctx.drawImage(sourceCanvas, x, y, w, h, 0, 0, w, h);

    c.toBlob((blob) => {
      if (!blob) {
        $("cr-status").textContent = "Не удалось обрезать.";
        return;
      }
      cropBlob = blob;
      $("cr-after").textContent = w + " × " + h;
      $("cr-result").classList.add("show");
      $("cr-status").textContent = "Готово.";
      markOperation();
    }, "image/png");
  });

  $("cr-download").addEventListener("click", () =>
    downloadBlob(cropBlob, baseName(originalFile.name) + "-crop.png")
  );

  // ---- Adjust ----
  [$("a-bright"), $("a-contrast"), $("a-sat")].forEach((el, i) =>
    el.addEventListener("input", () => {
      const id = i === 0 ? "a-bright-val" : i === 1 ? "a-contrast-val" : "a-sat-val";
      $(id).textContent = el.value;
    })
  );

  $("a-run").addEventListener("click", () => {
    if (!originalFile) return;

    const bright = Number($("a-bright").value);
    const contrast = Number($("a-contrast").value);
    const sat = Number($("a-sat").value);
    const gray = $("a-gray").checked;
    const fmt = $("a-format").value;
    const q = 0.92;

    const c = document.createElement("canvas");
    const ctx = c.getContext("2d");
    c.width = imgW;
    c.height = imgH;
    ctx.filter =
      "brightness(" + (100 + bright) + "%) contrast(" + (100 + contrast) + "%) saturate(" + (100 + sat) + "%)";
    ctx.drawImage(sourceCanvas, 0, 0);

    if (gray) {
      const data = ctx.getImageData(0, 0, imgW, imgH);
      for (let i = 0; i < data.data.length; i += 4) {
        const v = Math.round(0.299 * data.data[i] + 0.587 * data.data[i + 1] + 0.114 * data.data[i + 2]);
        data.data[i] = data.data[i + 1] = data.data[i + 2] = v;
      }
      ctx.putImageData(data, 0, 0);
    }

    c.toBlob(
      (blob) => {
        if (!blob) {
          $("a-status").textContent = "Не удалось применить коррекцию.";
          return;
        }
        adjustBlob = blob;
        $("a-result").classList.add("show");
        $("a-status").textContent = "Готово.";
        markOperation();
      },
      mimeFor(fmt),
      fmt === "png" ? undefined : q
    );
  });

  $("a-download").addEventListener("click", () =>
    downloadBlob(adjustBlob, baseName(originalFile.name) + "-adjusted." + extFor($("a-format").value))
  );

  bumpStats();
})();