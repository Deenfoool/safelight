(function () {
  "use strict";

  const wrap = document.getElementById("previewWrap");
  const source = document.getElementById("previewImg");
  if (!wrap || !source) return;

  const style = document.createElement("style");
  style.id = "safelight-compare-style";
  style.textContent = `
  .compare-preview{position:absolute;inset:0;display:none;overflow:hidden;border-radius:2px;z-index:10;isolation:isolate;background:#09090b}
  .compare-preview.show{display:block}
  .compare-preview .cp-slider,.compare-preview .cp-special{position:absolute;inset:0}
  .compare-preview .cp-before,.compare-preview .cp-after{position:absolute;inset:0;width:100%;height:100%;object-fit:contain;object-position:center;display:block;pointer-events:none}
  .compare-preview .cp-after{clip-path:inset(0 0 0 50%)}
  .compare-preview .cp-divider{position:absolute;top:0;bottom:0;left:50%;width:2px;transform:translateX(-50%);background:var(--accent);box-shadow:0 0 14px rgba(74,222,128,.45);z-index:4;pointer-events:none}
  .compare-preview .cp-handle{position:absolute;top:50%;left:50%;width:36px;height:36px;transform:translate(-50%,-50%);border:2px solid var(--accent);background:#09090b;border-radius:50%;z-index:7;box-shadow:0 0 0 4px rgba(9,9,11,.35),0 5px 18px rgba(0,0,0,.5);pointer-events:none}
  .compare-preview .cp-handle:before,.compare-preview .cp-handle:after{content:'';position:absolute;top:12px;width:8px;height:8px;border-top:2px solid var(--accent);border-right:2px solid var(--accent)}
  .compare-preview .cp-handle:before{transform:rotate(-135deg);left:6px}.compare-preview .cp-handle:after{transform:rotate(45deg);right:6px}
  .compare-preview .cp-range{position:absolute;inset:0;width:100%;height:100%;margin:0;opacity:0;cursor:ew-resize;z-index:20}
  .compare-preview .cp-label{position:absolute;top:12px;padding:5px 9px;border:1px solid rgba(255,255,255,.12);background:rgba(9,9,11,.82);backdrop-filter:blur(8px);border-radius:5px;color:#fff;font:600 10px var(--mono);letter-spacing:.08em;text-transform:uppercase;z-index:6;pointer-events:none}
  .compare-preview .cp-label.before{left:12px}.compare-preview .cp-label.after{right:12px}
  .compare-preview .cp-special{display:none;padding:16px;overflow:auto;background:#09090b}
  .compare-preview.special .cp-slider{display:none}.compare-preview.special .cp-special{display:flex}
  .cp-pair{display:grid;grid-template-columns:1fr 1fr;gap:12px;width:100%;align-items:stretch}
  .cp-card{min-width:0;background:rgba(16,16,18,.96);border:1px solid rgba(255,255,255,.09);border-radius:10px;padding:12px;color:#fff;font:12px var(--sans);box-shadow:0 10px 30px rgba(0,0,0,.2)}
  .cp-card h3{margin:0 0 8px;font:700 10px var(--mono);letter-spacing:.08em;color:var(--text-dim)}
  .cp-card img{display:block;width:100%;height:100%;max-height:38vh;object-fit:contain;background:#0d0d0f;border-radius:6px}
  .cp-card .cp-meta{margin-top:8px;color:var(--text-dim);font:10px var(--mono);line-height:1.5}
  .cp-grid{display:grid;gap:3px;width:min(70%,420px);aspect-ratio:1/1;margin:auto}
  .cp-grid span{border:1px solid var(--accent);background:rgba(74,222,128,.12);display:block}
  .cp-status{margin:auto;color:var(--text-dim);line-height:1.7}.cp-status b{color:var(--text)}
  .cp-favicon{display:flex;align-items:flex-end;justify-content:center;gap:14px;margin:auto;flex-wrap:wrap}
  .cp-favicon div{display:flex;flex-direction:column;align-items:center;gap:5px;color:var(--text-dim);font:9px var(--mono)}
  .cp-favicon img{background:#fff;image-rendering:auto;border-radius:5px;border:1px solid rgba(255,255,255,.1)}
  @media(max-width:640px){.compare-preview .cp-handle{width:30px;height:30px}.compare-preview .cp-handle:before,.compare-preview .cp-handle:after{top:9px}.compare-preview .cp-label{top:8px;padding:4px 7px;font-size:8px}.cp-pair{grid-template-columns:1fr;gap:8px}.cp-card{padding:9px}}
  `;
  document.head.appendChild(style);

  const compare = document.createElement("div");
  compare.className = "compare-preview";
  compare.innerHTML = `
    <div class="cp-slider">
      <img class="cp-before" alt="До">
      <img class="cp-after" alt="После">
      <div class="cp-divider"></div>
      <span class="cp-label before">До</span>
      <span class="cp-label after">После</span>
      <div class="cp-handle" aria-hidden="true"></div>
      <input class="cp-range" type="range" min="0" max="100" value="50" aria-label="Сравнение до и после">
    </div>
    <div class="cp-special"></div>`;
  wrap.appendChild(compare);

  const before = compare.querySelector(".cp-before");
  const after = compare.querySelector(".cp-after");
  const range = compare.querySelector(".cp-range");
  const divider = compare.querySelector(".cp-divider");
  const handle = compare.querySelector(".cp-handle");
  const special = compare.querySelector(".cp-special");

  let buildToken = 0;
  const urls = new Set();

  function activeTool() {
    const panel = document.querySelector(".panel.active");
    return panel ? panel.id.replace("panel-", "") : null;
  }

  function sourceReady() {
    return !!(source.src && source.complete && wrap.style.display !== "none");
  }

  function escapeHtml(value) {
    return String(value ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;");
  }

  function setPosition(value) {
    const n = Math.max(0, Math.min(100, Number(value) || 0));
    after.style.clipPath = `inset(0 0 0 ${n}%)`;
    divider.style.left = n + "%";
    handle.style.left = n + "%";
  }

  range.addEventListener("input", () => setPosition(range.value));
  setPosition(50);

  function revokeUrls(except) {
    for (const url of [...urls]) {
      if (url === except) continue;
      URL.revokeObjectURL(url);
      urls.delete(url);
    }
  }

  function ownUrl(blob) {
    const url = URL.createObjectURL(blob);
    urls.add(url);
    return url;
  }

  function imageFrom(src) {
    return new Promise((resolve, reject) => {
      const im = new Image();
      im.onload = () => resolve(im);
      im.onerror = () => reject(new Error("Не удалось открыть изображение для предпросмотра"));
      im.src = src;
    });
  }

  function canvasBlob(canvas, type = "image/png", quality) {
    return new Promise((resolve, reject) => {
      canvas.toBlob(
        (blob) => (blob ? resolve(blob) : reject(new Error("Не удалось создать предпросмотр"))),
        type,
        quality
      );
    });
  }

  function mimeFor(fmt) {
    if (fmt === "png") return "image/png";
    if (fmt === "webp") return "image/webp";
    return "image/jpeg";
  }

  function showSlider(afterBlob) {
    revokeUrls();
    compare.classList.remove("special");
    before.src = source.src;
    after.src = ownUrl(afterBlob);
    range.value = "50";
    compare.classList.add("show");
    requestAnimationFrame(() => setPosition(50));
  }

  function showPair(afterBlob, beforeMeta, afterMeta, beforeSrc) {
    const keep = beforeSrc && urls.has(beforeSrc) ? beforeSrc : null;
    revokeUrls(keep);
    const a = beforeSrc || source.src;
    const b = ownUrl(afterBlob);
    compare.classList.add("special", "show");
    special.innerHTML = `
      <div class="cp-pair">
        <div class="cp-card"><h3>ДО</h3><img src="${escapeHtml(a)}" alt="До"><div class="cp-meta">${escapeHtml(beforeMeta || "Исходник")}</div></div>
        <div class="cp-card"><h3>ПОСЛЕ</h3><img src="${escapeHtml(b)}" alt="После"><div class="cp-meta">${escapeHtml(afterMeta || "Результат")}</div></div>
      </div>`;
  }

  function showSpecial(html) {
    revokeUrls();
    compare.classList.add("special", "show");
    special.innerHTML = html;
  }

  function hide() {
    buildToken++;
    compare.classList.remove("show", "special");
    special.innerHTML = "";
    before.removeAttribute("src");
    after.removeAttribute("src");
    revokeUrls();
  }

  async function renderBaseTool(tool) {
    const im = await imageFrom(source.src);
    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d");

    if (tool === "compress" || tool === "convert") {
      const prefix = tool === "compress" ? "c" : "v";
      const fmt = document.getElementById(prefix + "-format")?.value || "webp";
      if (tool === "convert" && fmt === "pdf") return null;
      canvas.width = im.naturalWidth;
      canvas.height = im.naturalHeight;
      if (fmt === "jpeg") {
        ctx.fillStyle = "#fff";
        ctx.fillRect(0, 0, canvas.width, canvas.height);
      }
      ctx.drawImage(im, 0, 0);
      const q = fmt === "png" ? undefined : Number(document.getElementById(prefix + "-quality")?.value || 92) / 100;
      return { mode: "slider", blob: await canvasBlob(canvas, mimeFor(fmt), q) };
    }

    if (tool === "resize") {
      const w = Math.max(1, Number(document.getElementById("r-width")?.value) || im.naturalWidth);
      const h = Math.max(1, Number(document.getElementById("r-height")?.value) || im.naturalHeight);
      canvas.width = w;
      canvas.height = h;
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = "high";
      ctx.drawImage(im, 0, 0, w, h);
      return { mode: "pair", blob: await canvasBlob(canvas, "image/png"), beforeMeta: im.naturalWidth + " × " + im.naturalHeight + " px", afterMeta: w + " × " + h + " px" };
    }

    if (tool === "crop") {
      const w = Math.min(im.naturalWidth, Math.max(1, Number(document.getElementById("cr-width")?.value) || im.naturalWidth));
      const h = Math.min(im.naturalHeight, Math.max(1, Number(document.getElementById("cr-height")?.value) || im.naturalHeight));
      let x = Math.floor((im.naturalWidth - w) / 2);
      let y = Math.floor((im.naturalHeight - h) / 2);
      const p = document.getElementById("cr-position")?.value;
      if (p === "top") y = 0;
      if (p === "bottom") y = im.naturalHeight - h;
      canvas.width = w;
      canvas.height = h;
      ctx.drawImage(im, x, y, w, h, 0, 0, w, h);
      return { mode: "pair", blob: await canvasBlob(canvas, "image/png"), beforeMeta: im.naturalWidth + " × " + im.naturalHeight + " px", afterMeta: w + " × " + h + " px" };
    }

    if (tool === "adjust") {
      const bright = Number(document.getElementById("a-bright")?.value || 0);
      const contrast = Number(document.getElementById("a-contrast")?.value || 0);
      const sat = Number(document.getElementById("a-sat")?.value || 0);
      const gray = document.getElementById("a-gray")?.checked;
      const fmt = document.getElementById("a-format")?.value || "jpeg";
      canvas.width = im.naturalWidth;
      canvas.height = im.naturalHeight;
      if (fmt === "jpeg") {
        ctx.fillStyle = "#fff";
        ctx.fillRect(0, 0, canvas.width, canvas.height);
      }
      ctx.filter = `brightness(${100 + bright}%) contrast(${100 + contrast}%) saturate(${100 + sat}%)`;
      ctx.drawImage(im, 0, 0);
      ctx.filter = "none";
      if (gray) {
        const data = ctx.getImageData(0, 0, canvas.width, canvas.height);
        for (let i = 0; i < data.data.length; i += 4) {
          const v = Math.round(0.299 * data.data[i] + 0.587 * data.data[i + 1] + 0.114 * data.data[i + 2]);
          data.data[i] = data.data[i + 1] = data.data[i + 2] = v;
        }
        ctx.putImageData(data, 0, 0);
      }
      return { mode: "slider", blob: await canvasBlob(canvas, mimeFor(fmt), fmt === "png" ? undefined : 0.92) };
    }

    return null;
  }

  async function renderTransform() {
    const im = await imageFrom(source.src);
    const state = window.safelightTransformState || { angle: 0, h: false, v: false };
    const swap = state.angle % 180 !== 0;
    const canvas = document.createElement("canvas");
    canvas.width = swap ? im.naturalHeight : im.naturalWidth;
    canvas.height = swap ? im.naturalWidth : im.naturalHeight;
    const ctx = canvas.getContext("2d");
    ctx.translate(canvas.width / 2, canvas.height / 2);
    ctx.rotate((state.angle * Math.PI) / 180);
    ctx.scale(state.h ? -1 : 1, state.v ? -1 : 1);
    ctx.drawImage(im, -im.naturalWidth / 2, -im.naturalHeight / 2);
    return { mode: "pair", blob: await canvasBlob(canvas, "image/png"), beforeMeta: im.naturalWidth + " × " + im.naturalHeight + " px", afterMeta: canvas.width + " × " + canvas.height + " px · " + state.angle + "°" };
  }

  async function renderWatermark() {
    const im = await imageFrom(source.src);
    const canvas = document.createElement("canvas");
    canvas.width = im.naturalWidth;
    canvas.height = im.naturalHeight;
    const ctx = canvas.getContext("2d");
    ctx.drawImage(im, 0, 0);
    const size = Math.max(8, Math.min(1000, Number(document.getElementById("wm-size")?.value) || 48));
    const text = document.getElementById("wm-text")?.value.trim() || "Safelight";
    const opacity = Math.max(1, Math.min(100, Number(document.getElementById("wm-opacity")?.value) || 45)) / 100;
    const p = document.getElementById("wm-pos")?.value || "br";
    const pad = size * 0.55;
    ctx.font = "600 " + size + "px Inter,Arial,sans-serif";
    ctx.fillStyle = "rgba(255,255,255," + opacity + ")";
    ctx.shadowColor = "rgba(0,0,0,.5)";
    ctx.shadowBlur = Math.max(2, size / 10);
    const m = ctx.measureText(text);
    let x = pad;
    let y = size + pad;
    if (p.includes("r")) x = canvas.width - m.width - pad;
    if (p === "center") { x = (canvas.width - m.width) / 2; y = (canvas.height + size) / 2; }
    if (p === "br" || p === "bl") y = canvas.height - pad;
    x = Math.max(0, Math.min(canvas.width - m.width, x));
    y = Math.max(size, Math.min(canvas.height, y));
    ctx.fillText(text, x, y);
    return { mode: "slider", blob: await canvasBlob(canvas, "image/png") };
  }

  async function renderBatch() {
    const input = document.getElementById("batch-files");
    const files = [...(input?.files || [])];
    if (!files.length) {
      showSpecial('<div class="cp-card cp-status">Выберите изображения — здесь появится пример результата для первого файла.</div>');
      return;
    }
    revokeUrls();
    const beforeUrl = ownUrl(files[0]);
    const im = await imageFrom(beforeUrl);
    const fmt = document.getElementById("b-format")?.value || "webp";
    const quality = Math.max(1, Math.min(100, Number(document.getElementById("b-quality")?.value) || 85)) / 100;
    const maxWidth = Math.max(0, Number(document.getElementById("b-width")?.value) || 0);
    let w = im.naturalWidth;
    let h = im.naturalHeight;
    if (maxWidth && w > maxWidth) { h = Math.max(1, Math.round((h * maxWidth) / w)); w = maxWidth; }
    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d");
    if (fmt === "jpeg") { ctx.fillStyle = "#fff"; ctx.fillRect(0, 0, w, h); }
    ctx.drawImage(im, 0, 0, w, h);
    const result = await canvasBlob(canvas, mimeFor(fmt), fmt === "png" ? undefined : quality);
    showPair(result, im.naturalWidth + " × " + im.naturalHeight, w + " × " + h + " · " + fmt.toUpperCase(), beforeUrl);
  }

  async function build(tool = activeTool()) {
    const ticket = ++buildToken;
    if (!tool || !sourceReady()) return;

    try {
      if (["compress", "convert", "resize", "crop", "adjust"].includes(tool)) {
        if (tool === "convert" && document.getElementById("v-format")?.value === "pdf") { hide(); return; }
        const result = await renderBaseTool(tool);
        if (ticket !== buildToken || !result) return;
        if (result.mode === "slider") showSlider(result.blob);
        else showPair(result.blob, result.beforeMeta, result.afterMeta);
        return;
      }

      if (tool === "transform") {
        const result = await renderTransform();
        if (ticket !== buildToken) return;
        showPair(result.blob, result.beforeMeta, result.afterMeta);
        return;
      }

      if (tool === "watermark") {
        const result = await renderWatermark();
        if (ticket !== buildToken) return;
        showSlider(result.blob);
        return;
      }

      if (tool === "slice") {
        let rows = Math.max(1, Number(document.getElementById("s-rows")?.value) || 2);
        let cols = Math.max(1, Number(document.getElementById("s-cols")?.value) || 2);
        if (window.sliceMode === "horizontal") cols = 1;
        if (window.sliceMode === "vertical") rows = 1;
        showSpecial(`<div class="cp-grid" style="grid-template-columns:repeat(${cols},1fr);grid-template-rows:repeat(${rows},1fr)">${Array(rows * cols).fill("<span></span>").join("")}</div>`);
        return;
      }

      if (tool === "batch") { await renderBatch(); return; }

      if (tool === "metadata") {
        const name = document.getElementById("meta-name")?.textContent || "—";
        const size = document.getElementById("meta-size")?.textContent || "—";
        const type = document.getElementById("meta-type")?.textContent || "—";
        const dims = document.getElementById("meta-dims")?.textContent || "—";
        showSpecial(`<div class="cp-pair"><div class="cp-card"><h3>ДО</h3><div class="cp-status"><b>${escapeHtml(name)}</b><br>${escapeHtml(type)}<br>${escapeHtml(size)}<br>${escapeHtml(dims)}<br>EXIF / служебные данные: возможно присутствуют</div></div><div class="cp-card"><h3>ПОСЛЕ</h3><div class="cp-status"><b>${escapeHtml(name)}</b><br>PNG<br>пересохранено<br>${escapeHtml(dims)}<br>EXIF / комментарии исходника не переносятся</div></div></div>`);
        return;
      }

      if (tool === "favicon") {
        const im = await imageFrom(source.src);
        if (ticket !== buildToken) return;
        const html = [32, 180, 512].map((n) => {
          const c = document.createElement("canvas");
          c.width = c.height = n;
          const ctx = c.getContext("2d");
          const scale = Math.min(n / im.naturalWidth, n / im.naturalHeight);
          const w = im.naturalWidth * scale;
          const h = im.naturalHeight * scale;
          ctx.drawImage(im, (n - w) / 2, (n - h) / 2, w, h);
          return `<div><img width="${Math.min(96, n)}" height="${Math.min(96, n)}" src="${c.toDataURL("image/png")}"><span>${n}×${n}</span></div>`;
        }).join("");
        showSpecial('<div class="cp-favicon">' + html + "</div>");
      }
    } catch (error) {
      console.warn("Safelight preview:", error);
      hide();
    }
  }

  function schedule(tool, delay = 60) {
    const current = tool || activeTool();
    setTimeout(() => { if (current === activeTool()) build(current); }, delay);
  }

  const resultObserver = new MutationObserver((mutations) => {
    for (const mutation of mutations) {
      if (mutation.type !== "attributes" || mutation.attributeName !== "class") continue;
      const el = mutation.target;
      if (!el.classList.contains("result")) continue;
      if (el.classList.contains("show")) schedule(activeTool(), 20);
      else if (el.closest(".panel.active")) hide();
    }
  });
  document.querySelectorAll(".result").forEach((el) => resultObserver.observe(el, { attributes: true }));

  function observeStatus(id, successText, tool) {
    const el = document.getElementById(id);
    if (!el) return;
    new MutationObserver(() => {
      if ((el.textContent || "").includes(successText) && activeTool() === tool) schedule(tool, 30);
    }).observe(el, { childList: true, characterData: true, subtree: true });
  }

  observeStatus("tr-status", "Предпросмотр обновлён", "transform");
  observeStatus("wm-status", "Готово", "watermark");
  observeStatus("b-status", "Готово", "batch");
  observeStatus("meta-status", "Готово", "metadata");
  observeStatus("f-status", "Готово", "favicon");

  document.addEventListener("change", (event) => {
    const target = event.target;
    if (!target) return;
    if (target.id === "batch-files" && activeTool() === "batch") schedule("batch", 20);
    if (["s-rows", "s-cols"].includes(target.id) && activeTool() === "slice") schedule("slice", 0);
    if (target.closest(".panel.active") && !["batch-files", "s-rows", "s-cols"].includes(target.id)) hide();
  });

  document.addEventListener("input", (event) => {
    const target = event.target;
    if (!target?.closest(".panel.active")) return;
    if (["s-rows", "s-cols"].includes(target.id) && activeTool() === "slice") schedule("slice", 0);
    else hide();
  });

  window.addEventListener("safelight:toolchange", hide);
  new MutationObserver(hide).observe(source, { attributes: true, attributeFilter: ["src"] });
  window.addEventListener("resize", () => {
    if (compare.classList.contains("show") && !compare.classList.contains("special")) setPosition(range.value);
  });

  window.safelightCompare = { hide, refresh: () => build(activeTool()) };
})();
