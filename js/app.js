(function () {
  "use strict";

  let imgW = 0;
  let imgH = 0;
  window.sliceMode = "grid";

  const $ = (id) => document.getElementById(id);

  function formatBytes(bytes) {
    if (bytes < 1024) return bytes + " B";
    if (bytes < 1048576) return (bytes / 1024).toFixed(1) + " KB";
    return (bytes / 1048576).toFixed(2) + " MB";
  }

  function resetResultPanels() {
    ["c-result", "v-result", "r-result", "cr-result", "a-result"].forEach((id) => $(id)?.classList.remove("show"));
    ["c-status", "v-status", "r-status", "cr-status", "a-status", "s-status"].forEach((id) => {
      const el = $(id);
      if (el) el.textContent = "";
    });
  }

  const dropzone = $("dropzone");
  const fileInput = $("fileInput");
  const filemeta = $("filemeta");
  const stageEmpty = $("stageEmpty");
  const previewWrap = $("previewWrap");
  const previewImg = $("previewImg");
  const gridOverlay = $("gridOverlay");
  const readout = $("readout");

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
    if (!file.type.startsWith("image/")) {
      alert("Пожалуйста, выберите файл изображения.");
      return;
    }

    const sourceUrl = URL.createObjectURL(file);
    const image = new Image();

    image.onload = function () {
      URL.revokeObjectURL(sourceUrl);
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

      $("t-name").textContent = file.name;
      $("t-name2").textContent = file.name;
      $("t-status").textContent = "готово — изображение загружено";
      $("t-dims").textContent = imgW + "x" + imgH + " px, " + (file.type.replace("image/", "") || "—").toUpperCase();
      $("t-size").textContent = formatBytes(file.size);

      resetResultPanels();
      $("r-width").value = imgW;
      $("r-height").value = imgH;
      $("cr-width").value = imgW;
      $("cr-height").value = imgH;

      document.querySelectorAll(".af").forEach((el) => el.classList.remove("show"));
      requestAnimationFrame(() => setTimeout(() => document.querySelectorAll(".af").forEach((el) => el.classList.add("show")), 60));
      renderGridOverlay();
    };

    image.onerror = function () {
      URL.revokeObjectURL(sourceUrl);
      alert("Не удалось загрузить изображение.");
    };

    image.src = sourceUrl;
  }

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
    for (let col = 1; col < cols; col++) {
      const line = document.createElement("div");
      line.className = "grid-line v";
      line.style.left = (col / cols) * 100 + "%";
      gridOverlay.appendChild(line);
    }
    for (let row = 1; row < rows; row++) {
      const line = document.createElement("div");
      line.className = "grid-line h";
      line.style.top = (row / rows) * 100 + "%";
      gridOverlay.appendChild(line);
    }
  }

  $("s-mode").querySelectorAll("button").forEach((button) => {
    button.addEventListener("click", () => {
      $("s-mode").querySelectorAll("button").forEach((item) => item.classList.remove("active"));
      button.classList.add("active");
      window.sliceMode = button.dataset.mode;
      $("s-rows-field").style.display = window.sliceMode === "vertical" ? "none" : "flex";
      $("s-cols-field").style.display = window.sliceMode === "horizontal" ? "none" : "flex";
      renderGridOverlay();
    });
  });

  [$("s-rows"), $("s-cols")].forEach((control) => control.addEventListener("input", renderGridOverlay));

  $("s-format").addEventListener("change", () => {
    $("s-quality-row").style.display = $("s-format").value === "png" ? "none" : "flex";
  });
  $("s-quality").addEventListener("input", () => $("s-quality-val").textContent = $("s-quality").value + "%");

  $("c-format").addEventListener("change", () => {
    $("c-quality").disabled = $("c-format").value === "png";
  });
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

  [$("a-bright"), $("a-contrast"), $("a-sat")].forEach((control, index) => {
    control.addEventListener("input", () => {
      const id = index === 0 ? "a-bright-val" : index === 1 ? "a-contrast-val" : "a-sat-val";
      $(id).textContent = control.value;
    });
  });
})();