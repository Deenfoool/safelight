(function () {
  "use strict";

  let imgW = 0;
  let imgH = 0;
  let sourceLoadToken = 0;
  window.sliceMode = "grid";

  const $ = (id) => document.getElementById(id);

  function formatBytes(bytes) {
    if (bytes < 1024) return bytes + " B";
    if (bytes < 1048576) return (bytes / 1024).toFixed(1) + " KB";
    return (bytes / 1048576).toFixed(2) + " MB";
  }

  function syncDimensionControls(width, height) {
    if ($("r-width")) $("r-width").value = width;
    if ($("r-height")) $("r-height").value = height;
    // Старый crop UI может быть уже физически удалён новым crop-tools.js.
    if ($("cr-width")) $("cr-width").value = width;
    if ($("cr-height")) $("cr-height").value = height;
  }

  const dropzone = $("dropzone");
  const fileInput = $("fileInput");
  const filemeta = $("filemeta");
  const stageEmpty = $("stageEmpty");
  const previewWrap = $("previewWrap");
  const previewImg = $("previewImg");
  const readout = $("readout");

  window.addEventListener("safelight:source-intent", () => {
    sourceLoadToken++;
  });

  ["dragover", "dragenter"].forEach((eventName) => {
    dropzone.addEventListener(eventName, (event) => {
      event.preventDefault();
      dropzone.classList.add("drag");
    });
  });

  ["dragleave", "drop"].forEach((eventName) => {
    dropzone.addEventListener(eventName, (event) => {
      event.preventDefault();
      dropzone.classList.remove("drag");
    });
  });

  dropzone.addEventListener("drop", (event) => {
    const file = event.dataTransfer.files[0];
    if (file) handleFile(file);
  });

  fileInput.addEventListener("change", (event) => {
    if (event.target.files[0]) handleFile(event.target.files[0]);
    event.target.value = "";
  });

  function handleFile(file) {
    const isPdf = (file.type || "").toLowerCase() === "application/pdf" || /\.pdf$/i.test(file.name || "");
    if (isPdf) return;
    if (!file.type.startsWith("image/")) {
      alert("Пожалуйста, выберите файл изображения.");
      return;
    }

    const token = ++sourceLoadToken;
    const sourceUrl = URL.createObjectURL(file);
    const image = new Image();

    image.onload = function () {
      URL.revokeObjectURL(sourceUrl);
      if (token !== sourceLoadToken) return;

      imgW = image.naturalWidth;
      imgH = image.naturalHeight;

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

      syncDimensionControls(imgW, imgH);
      window.dispatchEvent(new CustomEvent("safelight:source-file", { detail: { width: imgW, height: imgH, size: file.size, type: file.type, name: file.name } }));

      document.querySelectorAll(".af").forEach((el) => el.classList.remove("show"));
      requestAnimationFrame(() => setTimeout(() => document.querySelectorAll(".af").forEach((el) => el.classList.add("show")), 60));
    };

    image.onerror = function () {
      URL.revokeObjectURL(sourceUrl);
      if (token !== sourceLoadToken) return;
      alert("Не удалось загрузить изображение.");
    };

    image.src = sourceUrl;
  }

  window.addEventListener("safelight:working-source", (event) => {
    const width = Math.max(1, Math.round(Number(event.detail?.width) || previewImg.naturalWidth || imgW || 1));
    const height = Math.max(1, Math.round(Number(event.detail?.height) || previewImg.naturalHeight || imgH || 1));
    imgW = width;
    imgH = height;
    syncDimensionControls(width, height);
  });

  $("s-mode").querySelectorAll("button").forEach((button) => {
    button.addEventListener("click", () => {
      $("s-mode").querySelectorAll("button").forEach((item) => item.classList.remove("active"));
      button.classList.add("active");
      window.sliceMode = button.dataset.mode;
      $("s-rows-field").style.display = window.sliceMode === "vertical" ? "none" : "flex";
      $("s-cols-field").style.display = window.sliceMode === "horizontal" ? "none" : "flex";
    });
  });

  $("s-quality").addEventListener("input", () => $("s-quality-val").textContent = $("s-quality").value + "%");
  $("c-quality").addEventListener("input", () => $("c-quality-val").textContent = $("c-quality").value + "%");
  $("v-quality").addEventListener("input", () => $("v-quality-val").textContent = $("v-quality").value + "%");

  function syncResizeHeight() {
    if ($("r-lock").value === "lock" && imgW && imgH) {
      const width = Math.max(1, Number($("r-width").value) || imgW);
      $("r-height").value = Math.max(1, Math.round((width * imgH) / imgW));
    }
  }

  $("r-width").addEventListener("input", syncResizeHeight);
  $("r-lock").addEventListener("change", syncResizeHeight);

  [$("a-bright"), $("a-contrast"), $("a-sat")].filter(Boolean).forEach((control, index) => {
    control.addEventListener("input", () => {
      const id = index === 0 ? "a-bright-val" : index === 1 ? "a-contrast-val" : "a-sat-val";
      if ($(id)) $(id).textContent = control.value;
    });
  });
})();
