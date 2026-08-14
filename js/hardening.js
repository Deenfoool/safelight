(function () {
  "use strict";

  const preview = document.getElementById("previewImg");
  const metaType = document.getElementById("meta-type");
  const format = document.getElementById("v-format");
  const qualityRow = document.getElementById("v-quality-row");
  const result = document.getElementById("v-result");
  const status = document.getElementById("v-status");
  const beforeText = document.getElementById("v-before");
  const afterText = document.getElementById("v-after");
  const downloadButton = document.getElementById("v-download");

  if (!preview) return;

  let converterBlob = null;
  let converterExt = "";
  let converterUrl = null;

  const style = document.createElement("style");
  style.id = "safelight-hardening-style";
  style.textContent = `
    #pdf-page-result{display:none;margin-top:12px;padding:14px;background:var(--bg-elevated);border:1px solid var(--border-soft);border-radius:10px}
    #pdf-page-result.show{display:block}
    #pdf-page-result .pdf-page-title{font:600 10px var(--mono);letter-spacing:.08em;color:var(--text-dim);margin-bottom:10px;text-transform:uppercase}
    #pdf-page-result .pdf-page-sheet{width:min(72%,420px);aspect-ratio:210/297;margin:auto;background:#fff;border-radius:3px;box-shadow:0 18px 45px rgba(0,0,0,.35);display:flex;align-items:center;justify-content:center;padding:7%;overflow:hidden}
    #pdf-page-result .pdf-page-sheet img{display:block;max-width:100%;max-height:100%;object-fit:contain;box-shadow:none;border-radius:0}
    #pdf-page-result .pdf-page-meta{margin-top:10px;text-align:center;color:var(--text-dim);font:10px var(--mono)}
  `;
  document.head.appendChild(style);

  function currentType() {
    return (metaType?.textContent || "").trim().toLowerCase();
  }

  function isPdfSource() {
    return currentType() === "application/pdf" || currentType() === "pdf";
  }

  function setStatus(text) {
    if (status) status.textContent = text;
  }

  function formatBytes(bytes) {
    bytes = Number(bytes) || 0;
    if (bytes < 1024) return bytes + " B";
    if (bytes < 1048576) return (bytes / 1024).toFixed(1) + " KB";
    return (bytes / 1048576).toFixed(2) + " MB";
  }

  function mimeFor(fmt) {
    if (fmt === "png") return "image/png";
    if (fmt === "webp") return "image/webp";
    return "image/jpeg";
  }

  function loadImage(src) {
    return new Promise((resolve, reject) => {
      const im = new Image();
      im.onload = () => resolve(im);
      im.onerror = () => reject(new Error("Не удалось открыть исходник"));
      im.src = src;
    });
  }

  function canvasBlob(canvas, type, quality) {
    return new Promise((resolve, reject) => {
      canvas.toBlob(
        (blob) => (blob ? resolve(blob) : reject(new Error("Не удалось создать файл"))),
        type,
        quality
      );
    });
  }

  function revokeConverterUrl() {
    if (converterUrl) {
      URL.revokeObjectURL(converterUrl);
      converterUrl = null;
    }
  }

  function download(blob, name) {
    if (!blob) return;
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = name;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 4000);
  }

  function ensurePdfPagePreview() {
    let box = document.getElementById("pdf-page-result");
    if (box) return box;
    box = document.createElement("div");
    box.id = "pdf-page-result";
    box.innerHTML = '<div class="pdf-page-title">Предпросмотр PDF-страницы</div><div class="pdf-page-sheet"><img alt="PDF preview"></div><div class="pdf-page-meta"></div>';
    result?.insertAdjacentElement("afterend", box);
    return box;
  }

  function showPdfPagePreview(src, text) {
    window.safelightCompare?.hide();
    const legacy = document.getElementById("pdf-preview");
    if (legacy) legacy.classList.remove("show");
    const box = ensurePdfPagePreview();
    box.querySelector("img").src = src;
    box.querySelector(".pdf-page-meta").textContent = text || "";
    box.classList.add("show");
  }

  function hidePdfPagePreview() {
    document.getElementById("pdf-page-result")?.classList.remove("show");
    document.getElementById("pdf-preview")?.classList.remove("show");
  }

  function setConverterResult(blob, ext, beforeLabel, afterLabel) {
    converterBlob = blob;
    converterExt = ext;
    if (beforeText) beforeText.textContent = beforeLabel;
    if (afterText) afterText.textContent = afterLabel;
    result?.classList.add("show");
  }

  function loadScript(src) {
    return new Promise((resolve, reject) => {
      const existing = [...document.scripts].find((s) => s.src === new URL(src, document.baseURI).href);
      if (existing) {
        if (existing.dataset.loaded === "1") return resolve();
        existing.addEventListener("load", () => resolve(), { once: true });
        existing.addEventListener("error", () => reject(new Error("script-load")), { once: true });
        return;
      }
      const script = document.createElement("script");
      script.src = src;
      script.onload = () => {
        script.dataset.loaded = "1";
        resolve();
      };
      script.onerror = () => reject(new Error("script-load"));
      document.head.appendChild(script);
    });
  }

  async function ensureJsPdf() {
    if (window.jspdf?.jsPDF) return true;
    try {
      await loadScript("./vendor/jspdf.umd.min.js");
    } catch (_) {
      return false;
    }
    return !!window.jspdf?.jsPDF;
  }

  async function convertCurrent() {
    if (!preview.src) {
      setStatus("Сначала загрузите изображение или PDF.");
      return;
    }

    const run = document.getElementById("v-run");
    const target = format?.value || "jpeg";
    if (run) run.disabled = true;
    setStatus("Конвертирую…");
    hidePdfPagePreview();
    window.safelightCompare?.hide();

    try {
      const im = await loadImage(preview.src);

      if (target === "pdf") {
        if (isPdfSource()) {
          setStatus("Исходник уже PDF. Выберите PNG, JPEG или WebP.");
          return;
        }
        if (!(await ensureJsPdf())) throw new Error("Локальный PDF-модуль не загрузился");

        const canvas = document.createElement("canvas");
        canvas.width = im.naturalWidth;
        canvas.height = im.naturalHeight;
        const ctx = canvas.getContext("2d");
        ctx.fillStyle = "#fff";
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(im, 0, 0);
        const jpeg = canvas.toDataURL("image/jpeg", 0.94);

        const { jsPDF } = window.jspdf;
        const orientation = im.naturalWidth > im.naturalHeight ? "landscape" : "portrait";
        const doc = new jsPDF({ orientation, unit: "mm", format: "a4" });
        const pageW = doc.internal.pageSize.getWidth();
        const pageH = doc.internal.pageSize.getHeight();
        const margin = 10;
        const scale = Math.min((pageW - margin * 2) / im.naturalWidth, (pageH - margin * 2) / im.naturalHeight);
        const w = im.naturalWidth * scale;
        const h = im.naturalHeight * scale;
        doc.addImage(jpeg, "JPEG", (pageW - w) / 2, (pageH - h) / 2, w, h, undefined, "FAST");
        const blob = doc.output("blob");
        setConverterResult(blob, "pdf", "IMAGE", "PDF · " + formatBytes(blob.size));
        showPdfPagePreview(preview.src, "A4 · изображение вписано без растяжения");
        setStatus("Готово. PDF создан локально.");
        return;
      }

      const canvas = document.createElement("canvas");
      canvas.width = im.naturalWidth;
      canvas.height = im.naturalHeight;
      const ctx = canvas.getContext("2d");
      if (target === "jpeg") {
        ctx.fillStyle = "#fff";
        ctx.fillRect(0, 0, canvas.width, canvas.height);
      }
      ctx.drawImage(im, 0, 0);
      const quality = target === "png" ? undefined : Number(document.getElementById("v-quality")?.value || 92) / 100;
      const blob = await canvasBlob(canvas, mimeFor(target), quality);
      const ext = target === "jpeg" ? "jpg" : target;
      const from = isPdfSource() ? "PDF · страница 1" : (currentType().replace("image/", "") || "SOURCE").toUpperCase();
      setConverterResult(blob, ext, from, target.toUpperCase() + " · " + formatBytes(blob.size));
      setStatus(isPdfSource() ? "Готово. Конвертирована первая страница PDF." : "Готово.");
      setTimeout(() => window.safelightCompare?.refresh(), 30);
    } catch (error) {
      console.error("Safelight converter:", error);
      setStatus("Ошибка конвертации: " + (error.message || "неизвестная ошибка"));
    } finally {
      if (run) run.disabled = false;
    }
  }

  function resetPerSourceState() {
    converterBlob = null;
    converterExt = "";
    revokeConverterUrl();
    hidePdfPagePreview();
    window.safelightCompare?.hide();
    result?.classList.remove("show");

    if (window.safelightTransformState) {
      window.safelightTransformState.angle = 0;
      window.safelightTransformState.h = false;
      window.safelightTransformState.v = false;
    }

    const trDownload = document.getElementById("tr-download");
    const wmDownload = document.getElementById("wm-download");
    if (trDownload) trDownload.disabled = true;
    if (wmDownload) wmDownload.disabled = true;
  }

  function updateQualityVisibility() {
    if (!qualityRow || !format) return;
    qualityRow.style.display = format.value === "png" || format.value === "pdf" ? "none" : "flex";
  }

  format?.addEventListener("change", () => {
    updateQualityVisibility();
    converterBlob = null;
    result?.classList.remove("show");
    hidePdfPagePreview();
  });
  updateQualityVisibility();

  document.addEventListener(
    "click",
    (event) => {
      const run = event.target.closest?.("#v-run");
      if (run) {
        event.preventDefault();
        event.stopImmediatePropagation();
        convertCurrent();
        return;
      }

      const dl = event.target.closest?.("#v-download");
      if (dl && converterBlob) {
        event.preventDefault();
        event.stopImmediatePropagation();
        download(converterBlob, "safelight-converted." + converterExt);
        return;
      }

      if (isPdfSource()) {
        const blocked = event.target.closest?.("#c-run,#s-run,#r-run,#cr-run,#a-run");
        if (blocked) {
          event.preventDefault();
          event.stopImmediatePropagation();
          const map = {
            "c-run": "c-status",
            "s-run": "s-status",
            "r-run": "r-status",
            "cr-run": "cr-status",
            "a-run": "a-status",
          };
          const out = document.getElementById(map[blocked.id]);
          if (out) out.textContent = "PDF поддерживается здесь через вкладку «Конвертация». Для других операций сначала преобразуйте страницу в PNG/JPEG/WebP.";
        }
      }
    },
    true
  );

  const trStatus = document.getElementById("tr-status");
  if (trStatus) {
    new MutationObserver(() => {
      const button = document.getElementById("tr-download");
      if (button && trStatus.textContent.includes("Предпросмотр обновлён")) button.disabled = false;
    }).observe(trStatus, { childList: true, characterData: true, subtree: true });
  }
  const wmStatus = document.getElementById("wm-status");
  if (wmStatus) {
    new MutationObserver(() => {
      const button = document.getElementById("wm-download");
      if (button && wmStatus.textContent.includes("Готово")) button.disabled = false;
    }).observe(wmStatus, { childList: true, characterData: true, subtree: true });
  }

  window.addEventListener("safelight:toolchange", (event) => {
    window.safelightCompare?.hide();
    if (event.detail?.page !== "convert") hidePdfPagePreview();
  });

  new MutationObserver(() => {
    setTimeout(resetPerSourceState, 0);
  }).observe(preview, { attributes: true, attributeFilter: ["src"] });

  const statLabels = [...document.querySelectorAll(".stat .label")];
  const toolsLabel = statLabels.find((el) => el.textContent.trim() === "инструментов");
  if (toolsLabel?.previousElementSibling) toolsLabel.previousElementSibling.textContent = "13";

  const aboutTags = document.querySelector("#about .tags");
  if (aboutTags && ![...aboutTags.children].some((el) => el.textContent.includes("PDF"))) {
    const tag = document.createElement("span");
    tag.className = "tag";
    tag.textContent = "PDF";
    aboutTags.appendChild(tag);
  }

  resetPerSourceState();
})();
