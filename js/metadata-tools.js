(function () {
  "use strict";

  if (window.safelightMetadataToolsLoaded) return;
  window.safelightMetadataToolsLoaded = true;

  const $ = (id) => document.getElementById(id);
  const encoder = new TextEncoder();
  const decoder = new TextDecoder("utf-8", { fatal: false });

  let currentFile = null;
  let report = null;
  let analysisToken = 0;

  const TAGS = {
    ifd0: {
      0x010f: "make", 0x0110: "model", 0x0112: "orientation", 0x0131: "software",
      0x0132: "dateTime", 0x013b: "artist", 0x8298: "copyright"
    },
    exif: {
      0x829a: "exposureTime", 0x829d: "fNumber", 0x8827: "iso", 0x9003: "dateOriginal",
      0x920a: "focalLength", 0xa433: "lensMake", 0xa434: "lensModel", 0xa002: "pixelWidth", 0xa003: "pixelHeight"
    }
  };

  function fmtBytes(n) {
    n = Number(n) || 0;
    if (n < 1024) return n + " B";
    if (n < 1048576) return (n / 1024).toFixed(1) + " KB";
    return (n / 1048576).toFixed(2) + " MB";
  }

  function esc(value) {
    return String(value == null ? "" : value)
      .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;").replace(/'/g, "&#39;");
  }

  function safeGet(view, method, offset, little) {
    try {
      if (offset < 0 || offset >= view.byteLength) return null;
      if (method === "getUint8") return view.getUint8(offset);
      if (method === "getInt8") return view.getInt8(offset);
      return view[method](offset, little);
    } catch (_) {
      return null;
    }
  }

  function typeSize(type) {
    return ({ 1: 1, 2: 1, 3: 2, 4: 4, 5: 8, 7: 1, 9: 4, 10: 8 })[type] || 0;
  }

  function readAscii(view, pos, count) {
    if (pos == null || count <= 0 || pos + count > view.byteLength) return "";
    const bytes = new Uint8Array(view.buffer, view.byteOffset + pos, count);
    let end = bytes.indexOf(0);
    if (end < 0) end = bytes.length;
    return decoder.decode(bytes.subarray(0, end)).trim();
  }

  function readTiffValue(view, base, entry, little) {
    const type = safeGet(view, "getUint16", entry + 2, little);
    const count = safeGet(view, "getUint32", entry + 4, little);
    const size = typeSize(type);
    if (!type || count == null || !size || count > 100000) return null;
    const total = size * count;
    let pos = entry + 8;
    if (total > 4) {
      const rel = safeGet(view, "getUint32", entry + 8, little);
      if (rel == null) return null;
      pos = base + rel;
    }
    if (pos < 0 || pos + total > view.byteLength) return null;

    const one = (idx) => {
      const p = pos + idx * size;
      if (type === 1 || type === 7) return safeGet(view, "getUint8", p);
      if (type === 3) return safeGet(view, "getUint16", p, little);
      if (type === 4) return safeGet(view, "getUint32", p, little);
      if (type === 9) return safeGet(view, "getInt32", p, little);
      if (type === 5 || type === 10) {
        const signed = type === 10;
        const num = safeGet(view, signed ? "getInt32" : "getUint32", p, little);
        const den = safeGet(view, signed ? "getInt32" : "getUint32", p + 4, little);
        if (num == null || den == null || den === 0) return null;
        return { num, den, value: num / den };
      }
      return null;
    };

    if (type === 2) return readAscii(view, pos, count);
    if (count === 1) return one(0);
    const values = [];
    for (let i = 0; i < Math.min(count, 64); i++) values.push(one(i));
    return values;
  }

  function parseTiff(buffer, tiffOffset, maxLength) {
    const view = new DataView(buffer);
    const end = Math.min(view.byteLength, (tiffOffset || 0) + (maxLength || view.byteLength));
    const base = tiffOffset || 0;
    if (base + 8 > end) return {};
    const order = String.fromCharCode(view.getUint8(base), view.getUint8(base + 1));
    const little = order === "II";
    if (!little && order !== "MM") return {};
    if (safeGet(view, "getUint16", base + 2, little) !== 42) return {};
    const first = safeGet(view, "getUint32", base + 4, little);
    if (first == null) return {};

    const out = { raw: {}, gps: null };
    let exifOffset = null;
    let gpsOffset = null;

    function readIfd(rel, map, bucket) {
      if (rel == null) return;
      const pos = base + rel;
      if (pos + 2 > end) return;
      const count = safeGet(view, "getUint16", pos, little);
      if (count == null || count > 512) return;
      for (let i = 0; i < count; i++) {
        const entry = pos + 2 + i * 12;
        if (entry + 12 > end) break;
        const tag = safeGet(view, "getUint16", entry, little);
        if (tag == null) continue;
        const value = readTiffValue(view, base, entry, little);
        if (tag === 0x8769 && typeof value === "number") exifOffset = value;
        if (tag === 0x8825 && typeof value === "number") gpsOffset = value;
        const key = map && map[tag];
        if (key && value != null && value !== "") {
          out[key] = value;
          if (bucket) out.raw[bucket + ":" + tag.toString(16)] = value;
        }
      }
    }

    readIfd(first, TAGS.ifd0, "ifd0");
    if (exifOffset != null) readIfd(exifOffset, TAGS.exif, "exif");

    if (gpsOffset != null) {
      const gps = {};
      const pos = base + gpsOffset;
      if (pos + 2 <= end) {
        const count = safeGet(view, "getUint16", pos, little);
        if (count != null && count <= 128) {
          for (let i = 0; i < count; i++) {
            const entry = pos + 2 + i * 12;
            if (entry + 12 > end) break;
            const tag = safeGet(view, "getUint16", entry, little);
            const value = readTiffValue(view, base, entry, little);
            if (tag === 1) gps.latRef = value;
            else if (tag === 2) gps.lat = value;
            else if (tag === 3) gps.lonRef = value;
            else if (tag === 4) gps.lon = value;
            else if (tag === 5) gps.altRef = value;
            else if (tag === 6) gps.alt = value;
          }
        }
      }
      const decimal = (parts, ref) => {
        if (!Array.isArray(parts) || parts.length < 3) return null;
        const vals = parts.slice(0, 3).map((x) => x && typeof x === "object" ? x.value : Number(x));
        if (vals.some((x) => !Number.isFinite(x))) return null;
        let v = vals[0] + vals[1] / 60 + vals[2] / 3600;
        if (/^[SW]$/i.test(String(ref || ""))) v *= -1;
        return v;
      };
      const lat = decimal(gps.lat, gps.latRef);
      const lon = decimal(gps.lon, gps.lonRef);
      const altVal = gps.alt && typeof gps.alt === "object" ? gps.alt.value : Number(gps.alt);
      if (Number.isFinite(lat) && Number.isFinite(lon)) {
        out.gps = {
          lat, lon,
          altitude: Number.isFinite(altVal) ? (Number(gps.altRef) === 1 ? -altVal : altVal) : null
        };
      }
    }
    return out;
  }

  function mergeMeta(target, incoming) {
    Object.keys(incoming || {}).forEach((key) => {
      if (key === "raw") return;
      if (target[key] == null || target[key] === "") target[key] = incoming[key];
    });
  }

  function starts(bytes, pos, text) {
    if (pos + text.length > bytes.length) return false;
    for (let i = 0; i < text.length; i++) if (bytes[pos + i] !== text.charCodeAt(i)) return false;
    return true;
  }

  function parseJpeg(buffer) {
    const view = new DataView(buffer);
    const bytes = new Uint8Array(buffer);
    const out = { format: "JPEG", metaBytes: 0, containers: [], text: {}, exif: {} };
    if (view.byteLength < 4 || view.getUint16(0) !== 0xffd8) return out;
    let pos = 2;
    while (pos + 4 <= view.byteLength) {
      if (bytes[pos] !== 0xff) { pos++; continue; }
      while (pos < bytes.length && bytes[pos] === 0xff) pos++;
      const marker = bytes[pos++];
      if (marker === 0xda || marker === 0xd9) break;
      if (marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7)) continue;
      if (pos + 2 > bytes.length) break;
      const len = view.getUint16(pos, false);
      if (len < 2 || pos + len > bytes.length) break;
      const payload = pos + 2;
      const payloadLen = len - 2;
      if (marker === 0xe1) {
        out.metaBytes += len + 2;
        if (starts(bytes, payload, "Exif\u0000\u0000")) {
          out.containers.push("EXIF");
          mergeMeta(out.exif, parseTiff(buffer, payload + 6, payloadLen - 6));
        } else if (starts(bytes, payload, "http://ns.adobe.com/xap/1.0/")) {
          out.containers.push("XMP");
          out.text.xmp = decoder.decode(bytes.subarray(payload, payload + payloadLen)).slice(0, 12000);
        }
      } else if (marker === 0xed) {
        out.metaBytes += len + 2;
        out.containers.push("IPTC");
      } else if (marker === 0xfe) {
        out.metaBytes += len + 2;
        out.containers.push("Комментарий");
        out.text.comment = decoder.decode(bytes.subarray(payload, payload + payloadLen)).trim();
      }
      pos += len;
    }
    return out;
  }

  function parsePng(buffer) {
    const view = new DataView(buffer);
    const bytes = new Uint8Array(buffer);
    const out = { format: "PNG", metaBytes: 0, containers: [], text: {}, exif: {} };
    if (bytes.length < 8 || !starts(bytes, 1, "PNG")) return out;
    let pos = 8;
    while (pos + 12 <= bytes.length) {
      const len = view.getUint32(pos, false);
      const type = String.fromCharCode(bytes[pos + 4], bytes[pos + 5], bytes[pos + 6], bytes[pos + 7]);
      const data = pos + 8;
      if (len > bytes.length - data - 4) break;
      if (type === "eXIf") {
        out.metaBytes += len + 12;
        out.containers.push("EXIF");
        mergeMeta(out.exif, parseTiff(buffer, data, len));
      } else if (type === "tEXt" || type === "iTXt" || type === "zTXt") {
        out.metaBytes += len + 12;
        out.containers.push(type);
        if (type === "tEXt") {
          const chunk = bytes.subarray(data, data + len);
          const zero = chunk.indexOf(0);
          if (zero > 0) {
            const key = decoder.decode(chunk.subarray(0, zero));
            const val = decoder.decode(chunk.subarray(zero + 1));
            out.text[key] = val;
          }
        }
      } else if (type === "iCCP" || type === "tIME") {
        out.metaBytes += len + 12;
        out.containers.push(type);
      }
      pos += len + 12;
      if (type === "IEND") break;
    }
    return out;
  }

  function parseWebp(buffer) {
    const view = new DataView(buffer);
    const bytes = new Uint8Array(buffer);
    const out = { format: "WebP", metaBytes: 0, containers: [], text: {}, exif: {} };
    if (bytes.length < 12 || !starts(bytes, 0, "RIFF") || !starts(bytes, 8, "WEBP")) return out;
    let pos = 12;
    while (pos + 8 <= bytes.length) {
      const type = String.fromCharCode(bytes[pos], bytes[pos + 1], bytes[pos + 2], bytes[pos + 3]);
      const len = view.getUint32(pos + 4, true);
      const data = pos + 8;
      if (len > bytes.length - data) break;
      if (type === "EXIF") {
        out.metaBytes += len + 8;
        out.containers.push("EXIF");
        const tiff = starts(bytes, data, "Exif\u0000\u0000") ? data + 6 : data;
        mergeMeta(out.exif, parseTiff(buffer, tiff, len - (tiff - data)));
      } else if (type === "XMP ") {
        out.metaBytes += len + 8;
        out.containers.push("XMP");
        out.text.xmp = decoder.decode(bytes.subarray(data, data + len)).slice(0, 12000);
      } else if (type === "ICCP") {
        out.metaBytes += len + 8;
        out.containers.push("ICC");
      }
      pos += 8 + len + (len & 1);
    }
    return out;
  }

  function pickFromXmp(text, names) {
    if (!text) return "";
    for (const name of names) {
      const attr = new RegExp(name.replace(":", "\\:") + "=[\"']([^\"']+)[\"']", "i").exec(text);
      if (attr) return attr[1].trim();
      const tag = new RegExp("<" + name.replace(":", "\\:") + "[^>]*>([^<]+)</", "i").exec(text);
      if (tag) return tag[1].trim();
    }
    return "";
  }

  function rationalNumber(value) {
    if (value && typeof value === "object" && Number.isFinite(value.value)) return value.value;
    const n = Number(value);
    return Number.isFinite(n) ? n : null;
  }

  function normalizeReport(file, parsed) {
    const exif = parsed.exif || {};
    const xmp = parsed.text?.xmp || "";
    const text = parsed.text || {};
    const camera = [exif.make, exif.model].filter(Boolean).join(" ").trim();
    const lens = [exif.lensMake, exif.lensModel].filter(Boolean).join(" ").trim();
    const author = exif.artist || pickFromXmp(xmp, ["dc:creator", "photoshop:AuthorsPosition"]) || text.Author || text.author || "";
    const copyright = exif.copyright || pickFromXmp(xmp, ["dc:rights", "photoshop:Copyright"]) || text.Copyright || text.copyright || "";
    const software = exif.software || pickFromXmp(xmp, ["xmp:CreatorTool", "tiff:Software"]) || text.Software || text.software || "";
    const date = exif.dateOriginal || exif.dateTime || pickFromXmp(xmp, ["exif:DateTimeOriginal", "xmp:CreateDate"]) || text.CreationTime || text["Creation Time"] || "";
    const exposure = rationalNumber(exif.exposureTime);
    const aperture = rationalNumber(exif.fNumber);
    const focal = rationalNumber(exif.focalLength);
    const isoRaw = Array.isArray(exif.iso) ? exif.iso[0] : exif.iso;
    const iso = Number(isoRaw);
    const comment = parsed.text?.comment || text.Comment || text.Description || pickFromXmp(xmp, ["dc:description"]) || "";
    const gps = exif.gps || null;

    let risk = "safe", riskTitle = "Чувствительных данных не найдено";
    if (gps) { risk = "danger"; riskTitle = "Найдена геолокация"; }
    else if (author || copyright || date || camera || lens || software) { risk = "warn"; riskTitle = "В файле есть метаданные"; }

    return {
      file,
      format: parsed.format || (file.type || "image").replace("image/", "").toUpperCase(),
      size: file.size,
      metadataBytes: parsed.metaBytes || 0,
      containers: [...new Set(parsed.containers || [])],
      risk, riskTitle,
      camera, lens, date, author, copyright, software, comment, gps,
      exposure, aperture, focal, iso: Number.isFinite(iso) ? iso : null,
      orientation: exif.orientation || null,
      source: parsed
    };
  }

  async function analyze(file) {
    if (!file || !file.type.startsWith("image/")) {
      currentFile = file || null;
      report = null;
      render();
      return;
    }
    const token = ++analysisToken;
    currentFile = file;
    renderLoading(file);
    try {
      const buffer = await file.arrayBuffer();
      if (token !== analysisToken) return;
      const bytes = new Uint8Array(buffer);
      let parsed;
      if (bytes[0] === 0xff && bytes[1] === 0xd8) parsed = parseJpeg(buffer);
      else if (bytes[0] === 0x89 && starts(bytes, 1, "PNG")) parsed = parsePng(buffer);
      else if (starts(bytes, 0, "RIFF") && starts(bytes, 8, "WEBP")) parsed = parseWebp(buffer);
      else parsed = { format: (file.type || "image").replace("image/", "").toUpperCase(), metaBytes: 0, containers: [], text: {}, exif: {} };
      report = normalizeReport(file, parsed);
      render();
    } catch (error) {
      console.error("Safelight metadata:", error);
      report = null;
      renderError("Не удалось прочитать метаданные этого файла.");
    }
  }

  function row(label, value, sensitive) {
    if (value == null || value === "") return "";
    return '<div class="sl-meta-row' + (sensitive ? " sensitive" : "") + '"><span>' + esc(label) + '</span><b>' + esc(value) + '</b></div>';
  }

  function formatExposure(seconds) {
    if (!Number.isFinite(seconds) || seconds <= 0) return "";
    if (seconds >= 1) return seconds.toFixed(seconds < 10 ? 1 : 0) + " с";
    return "1/" + Math.round(1 / seconds) + " с";
  }

  function gpsText(gps) {
    if (!gps) return "";
    let text = gps.lat.toFixed(6) + ", " + gps.lon.toFixed(6);
    if (Number.isFinite(gps.altitude)) text += " · " + gps.altitude.toFixed(1) + " м";
    return text;
  }

  function renderLoading(file) {
    const box = $("sl-meta-tool");
    if (!box) return;
    box.innerHTML = '<div class="sl-meta-empty"><span class="sl-meta-spinner"></span><b>Читаю метаданные</b><small>' + esc(file.name) + '</small></div>';
  }

  function renderError(message) {
    const box = $("sl-meta-tool");
    if (!box) return;
    box.innerHTML = '<div class="sl-meta-empty error"><b>' + esc(message) + '</b><small>Сам файл остаётся на устройстве.</small></div>';
  }

  function render() {
    const box = $("sl-meta-tool");
    if (!box) return;
    if (!report) {
      box.innerHTML = '<div class="sl-meta-empty"><div class="sl-meta-empty-icon">i</div><b>Загрузите изображение</b><small>Safelight покажет EXIF, GPS, данные камеры, автора и другую встроенную информацию.</small></div>';
      return;
    }

    const r = report;
    const shooting = [
      r.exposure ? formatExposure(r.exposure) : "",
      r.aperture ? "f/" + r.aperture.toFixed(1) : "",
      Number.isFinite(r.iso) ? "ISO " + r.iso : "",
      r.focal ? r.focal.toFixed(r.focal < 10 ? 1 : 0) + " мм" : ""
    ].filter(Boolean).join(" · ");

    const details =
      row("Камера", r.camera) +
      row("Объектив", r.lens) +
      row("Параметры", shooting) +
      row("Дата съёмки", r.date) +
      row("GPS", gpsText(r.gps), !!r.gps) +
      row("Автор", r.author, !!r.author) +
      row("Copyright", r.copyright, !!r.copyright) +
      row("Программа", r.software) +
      row("Комментарий", r.comment, !!r.comment);

    box.innerHTML =
      '<div class="sl-meta-risk ' + r.risk + '">' +
        '<div class="sl-meta-risk-icon">' + (r.risk === "danger" ? "!" : r.risk === "warn" ? "i" : "✓") + '</div>' +
        '<div><b>' + esc(r.riskTitle) + '</b><span>' +
          (r.risk === "danger" ? "Фотография содержит координаты места съёмки. Перед публикацией их лучше удалить." :
           r.risk === "warn" ? "Эти данные могут раскрывать устройство, дату съёмки или автора файла." :
           "В известных контейнерах EXIF/XMP/IPTC чувствительная информация не обнаружена.") +
        '</span></div></div>' +

      '<div class="sl-meta-summary">' +
        '<div><span>Формат</span><b>' + esc(r.format) + '</b></div>' +
        '<div><span>Файл</span><b>' + esc(fmtBytes(r.size)) + '</b></div>' +
        '<div><span>Метаданные</span><b>' + esc(fmtBytes(r.metadataBytes)) + '</b></div>' +
      '</div>' +

      '<div class="sl-meta-section"><div class="sl-meta-section-title">Найдено в файле</div>' +
        (details || '<div class="sl-meta-none">Расширенных EXIF/XMP данных не найдено.</div>') +
        (r.containers.length ? '<div class="sl-meta-containers">' + r.containers.map((x) => '<span>' + esc(x) + '</span>').join("") + '</div>' : "") +
      '</div>' +

      '<div class="sl-meta-section sl-meta-cleaner"><div class="sl-meta-section-title">Очистка при экспорте</div>' +
        '<p>Выберите, какие данные не переносить в новый JPEG. PNG и WebP экспортируются полностью очищенными от исходных метаданных.</p>' +
        '<label class="sl-meta-master"><input type="checkbox" id="meta-remove-all" checked><span><b>Удалить все метаданные</b><small>Самый безопасный вариант для публикации.</small></span></label>' +
        '<div class="sl-meta-toggles">' +
          cleanerToggle("gps", "Геолокация", "GPS-координаты и высота", !!r.gps) +
          cleanerToggle("device", "Камера и объектив", "Марка, модель и объектив", !!(r.camera || r.lens)) +
          cleanerToggle("shooting", "Параметры съёмки", "ISO, выдержка, диафрагма, фокусное", !!shooting) +
          cleanerToggle("date", "Дата и время", "Когда был сделан снимок", !!r.date) +
          cleanerToggle("author", "Автор и copyright", "Имя автора и права", !!(r.author || r.copyright)) +
          cleanerToggle("software", "Программа", "Приложение или редактор", !!r.software) +
        '</div>' +
        '<div class="sl-meta-export-note" id="sl-meta-export-note">При текущих настройках экспорт создаст чистую копию без исходных метаданных.</div>' +
      '</div>';

    bindCleaner();
  }

  function cleanerToggle(key, title, desc, found) {
    return '<label class="sl-meta-toggle' + (found ? " found" : "") + '">' +
      '<input type="checkbox" data-meta-remove="' + key + '" checked>' +
      '<span><b>' + esc(title) + (found ? '<em>найдено</em>' : '') + '</b><small>' + esc(desc) + '</small></span>' +
      '<i></i></label>';
  }

  function bindCleaner() {
    const master = $("meta-remove-all");
    const toggles = [...document.querySelectorAll("#sl-meta-tool [data-meta-remove]")];
    if (!master) return;
    const update = () => {
      const all = toggles.every((el) => el.checked);
      master.checked = all;
      master.indeterminate = !all && toggles.some((el) => el.checked);
      const note = $("sl-meta-export-note");
      if (!note) return;
      const removed = toggles.filter((el) => el.checked).length;
      note.textContent = removed === toggles.length
        ? "При текущих настройках экспорт создаст чистую копию без исходных метаданных."
        : removed === 0
          ? "JPEG сохранит поддерживаемые метаданные. PNG и WebP всё равно создаются как чистые файлы."
          : "JPEG сохранит только категории, которые вы не отметили для удаления.";
    };
    master.addEventListener("change", () => {
      toggles.forEach((el) => { el.checked = master.checked; });
      update();
    });
    toggles.forEach((el) => el.addEventListener("change", update));
    update();
  }

  function removalState() {
    const state = { gps: true, device: true, shooting: true, date: true, author: true, software: true };
    const controls = [...document.querySelectorAll("#sl-meta-tool [data-meta-remove]")];
    if (!controls.length) return state;
    controls.forEach((el) => { state[el.dataset.metaRemove] = el.checked; });
    return state;
  }

  function asciiBytes(text) {
    return [...encoder.encode(String(text || "")), 0];
  }

  function uintBytes(value, bytes) {
    const arr = new Uint8Array(bytes);
    const view = new DataView(arr.buffer);
    if (bytes === 2) view.setUint16(0, Math.max(0, Math.round(value || 0)), true);
    else if (bytes === 4) view.setUint32(0, Math.max(0, Math.round(value || 0)), true);
    else arr[0] = Math.max(0, Math.round(value || 0)) & 255;
    return [...arr];
  }

  function rationalBytes(value) {
    if (!Number.isFinite(value)) return [];
    const den = 1000000;
    return [...uintBytes(Math.round(value * den), 4), ...uintBytes(den, 4)];
  }

  function rationalsBytes(values) {
    return values.flatMap(rationalBytes);
  }

  function decimalToGps(value) {
    const abs = Math.abs(value);
    const deg = Math.floor(abs);
    const minFloat = (abs - deg) * 60;
    const min = Math.floor(minFloat);
    const sec = (minFloat - min) * 60;
    return [deg, min, sec];
  }

  function makeEntry(tag, type, count, bytes) {
    return { tag, type, count, bytes: Array.from(bytes || []) };
  }

  function buildExifPayload(meta, remove) {
    if (!meta) return null;
    const ifd0 = [], exif = [], gps = [];
    const src = meta.source?.exif || {};

    if (!remove.device) {
      if (src.make) { const b = asciiBytes(src.make); ifd0.push(makeEntry(0x010f, 2, b.length, b)); }
      if (src.model) { const b = asciiBytes(src.model); ifd0.push(makeEntry(0x0110, 2, b.length, b)); }
      if (src.lensMake) { const b = asciiBytes(src.lensMake); exif.push(makeEntry(0xa433, 2, b.length, b)); }
      if (src.lensModel) { const b = asciiBytes(src.lensModel); exif.push(makeEntry(0xa434, 2, b.length, b)); }
    }
    if (!remove.software && meta.software) { const b = asciiBytes(meta.software); ifd0.push(makeEntry(0x0131, 2, b.length, b)); }
    if (!remove.author) {
      if (meta.author) { const b = asciiBytes(meta.author); ifd0.push(makeEntry(0x013b, 2, b.length, b)); }
      if (meta.copyright) { const b = asciiBytes(meta.copyright); ifd0.push(makeEntry(0x8298, 2, b.length, b)); }
    }
    if (!remove.date && meta.date) {
      const b = asciiBytes(meta.date);
      ifd0.push(makeEntry(0x0132, 2, b.length, b));
      exif.push(makeEntry(0x9003, 2, b.length, b));
    }
    if (!remove.shooting) {
      if (meta.exposure) exif.push(makeEntry(0x829a, 5, 1, rationalBytes(meta.exposure)));
      if (meta.aperture) exif.push(makeEntry(0x829d, 5, 1, rationalBytes(meta.aperture)));
      if (Number.isFinite(meta.iso)) exif.push(makeEntry(0x8827, 3, 1, uintBytes(meta.iso, 2)));
      if (meta.focal) exif.push(makeEntry(0x920a, 5, 1, rationalBytes(meta.focal)));
    }
    if (!remove.gps && meta.gps) {
      const latVals = decimalToGps(meta.gps.lat), lonVals = decimalToGps(meta.gps.lon);
      gps.push(makeEntry(1, 2, 2, asciiBytes(meta.gps.lat < 0 ? "S" : "N")));
      gps.push(makeEntry(2, 5, 3, rationalsBytes(latVals)));
      gps.push(makeEntry(3, 2, 2, asciiBytes(meta.gps.lon < 0 ? "W" : "E")));
      gps.push(makeEntry(4, 5, 3, rationalsBytes(lonVals)));
      if (Number.isFinite(meta.gps.altitude)) {
        gps.push(makeEntry(5, 1, 1, [meta.gps.altitude < 0 ? 1 : 0]));
        gps.push(makeEntry(6, 5, 1, rationalBytes(Math.abs(meta.gps.altitude))));
      }
    }

    if (!ifd0.length && !exif.length && !gps.length) return null;
    if (exif.length) ifd0.push(makeEntry(0x8769, 4, 1, [0, 0, 0, 0]));
    if (gps.length) ifd0.push(makeEntry(0x8825, 4, 1, [0, 0, 0, 0]));

    ifd0.sort((a, b) => a.tag - b.tag); exif.sort((a, b) => a.tag - b.tag); gps.sort((a, b) => a.tag - b.tag);
    const tableLen = (entries) => 2 + entries.length * 12 + 4;
    const ifd0Offset = 8;
    const exifOffset = exif.length ? ifd0Offset + tableLen(ifd0) : 0;
    const gpsOffset = gps.length ? ifd0Offset + tableLen(ifd0) + tableLen(exif) : 0;
    const dataStart = ifd0Offset + tableLen(ifd0) + tableLen(exif) + tableLen(gps);

    ifd0.forEach((entry) => {
      if (entry.tag === 0x8769) entry.bytes = uintBytes(exifOffset, 4);
      if (entry.tag === 0x8825) entry.bytes = uintBytes(gpsOffset, 4);
    });

    const extra = [...ifd0, ...exif, ...gps].reduce((sum, e) => sum + (e.bytes.length > 4 ? e.bytes.length + (e.bytes.length & 1) : 0), 0);
    const tiff = new Uint8Array(dataStart + extra);
    const view = new DataView(tiff.buffer);
    tiff[0] = 0x49; tiff[1] = 0x49; view.setUint16(2, 42, true); view.setUint32(4, ifd0Offset, true);
    let dataCursor = dataStart;

    function writeIfd(entries, offset) {
      if (!entries.length || !offset) return;
      view.setUint16(offset, entries.length, true);
      entries.forEach((entry, index) => {
        const p = offset + 2 + index * 12;
        view.setUint16(p, entry.tag, true);
        view.setUint16(p + 2, entry.type, true);
        view.setUint32(p + 4, entry.count, true);
        if (entry.bytes.length <= 4) {
          for (let i = 0; i < 4; i++) tiff[p + 8 + i] = entry.bytes[i] || 0;
        } else {
          view.setUint32(p + 8, dataCursor, true);
          tiff.set(entry.bytes, dataCursor);
          dataCursor += entry.bytes.length;
          if (dataCursor & 1) dataCursor++;
        }
      });
      view.setUint32(offset + 2 + entries.length * 12, 0, true);
    }

    writeIfd(ifd0, ifd0Offset);
    writeIfd(exif, exifOffset);
    writeIfd(gps, gpsOffset);

    const prefix = encoder.encode("Exif\u0000\u0000");
    const payload = new Uint8Array(prefix.length + tiff.length);
    payload.set(prefix, 0); payload.set(tiff, prefix.length);
    return payload;
  }

  async function injectExif(jpegBlob, payload) {
    if (!payload) return jpegBlob;
    const source = new Uint8Array(await jpegBlob.arrayBuffer());
    if (source.length < 4 || source[0] !== 0xff || source[1] !== 0xd8) return jpegBlob;
    const segLen = payload.length + 2;
    if (segLen > 65535) return jpegBlob;
    const segment = new Uint8Array(payload.length + 4);
    segment[0] = 0xff; segment[1] = 0xe1; segment[2] = (segLen >> 8) & 255; segment[3] = segLen & 255; segment.set(payload, 4);

    let insert = 2;
    if (source.length > 6 && source[2] === 0xff && source[3] === 0xe0) {
      const len = (source[4] << 8) | source[5];
      if (len >= 2 && 2 + 2 + len <= source.length) insert = 2 + 2 + len;
    }
    const out = new Uint8Array(source.length + segment.length);
    out.set(source.subarray(0, insert), 0);
    out.set(segment, insert);
    out.set(source.subarray(insert), insert + segment.length);
    return new Blob([out], { type: "image/jpeg" });
  }

  function getCanvas() {
    const live = $("sl-live-canvas");
    if (live && live.width && live.height) return live;
    const img = $("previewImg");
    if (!img?.src || !img.naturalWidth) return null;
    const c = document.createElement("canvas");
    c.width = img.naturalWidth; c.height = img.naturalHeight;
    c.getContext("2d").drawImage(img, 0, 0);
    return c;
  }

  function canvasBlob(canvas, type, quality) {
    return new Promise((resolve, reject) => canvas.toBlob((blob) => blob ? resolve(blob) : reject(new Error("Не удалось подготовить файл")), type, quality));
  }

  function download(blob, name) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = name;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 4000);
  }

  function baseName() {
    return (currentFile?.name || $("meta-name")?.textContent || "safelight").replace(/\.[^.]+$/, "") || "safelight";
  }

  async function exportMetadata(format) {
    const canvas = getCanvas();
    if (!canvas) throw new Error("Сначала загрузите изображение");
    const remove = removalState();

    if (format === "jpeg") {
      const opaque = document.createElement("canvas");
      opaque.width = canvas.width; opaque.height = canvas.height;
      const ctx = opaque.getContext("2d");
      ctx.fillStyle = "#fff"; ctx.fillRect(0, 0, opaque.width, opaque.height); ctx.drawImage(canvas, 0, 0);
      let blob = await canvasBlob(opaque, "image/jpeg", 0.94);
      const payload = buildExifPayload(report, remove);
      if (payload) blob = await injectExif(blob, payload);
      download(blob, baseName() + "-privacy.jpg");
      return;
    }
    if (format === "webp") {
      download(await canvasBlob(canvas, "image/webp", 0.92), baseName() + "-privacy.webp");
      return;
    }
    if (format === "png") {
      download(await canvasBlob(canvas, "image/png"), baseName() + "-privacy.png");
      return;
    }
    throw new Error("Для очистки метаданных выберите JPEG, WebP или PNG");
  }

  function installPanel() {
    const panel = $("panel-metadata");
    if (!panel) return false;
    const card = panel.querySelector(".panel-card");
    if (!card || $("sl-meta-tool")) return true;
    card.innerHTML = '<div id="sl-meta-tool" class="sl-meta-tool"></div><div class="status-line" id="meta-status"></div>';
    render();
    return true;
  }

  function captureFile(file) {
    if (!file) return;
    if (file.type.startsWith("image/")) analyze(file);
    else if (/\.pdf$/i.test(file.name)) {
      currentFile = file; report = null;
      renderError("PDF не содержит обрабатываемое изображение EXIF в этом инструменте.");
    }
  }

  document.addEventListener("change", (event) => {
    if (event.target?.id !== "fileInput") return;
    captureFile(event.target.files?.[0]);
  }, true);

  document.addEventListener("drop", (event) => {
    const file = [...(event.dataTransfer?.files || [])].find((f) => f.type.startsWith("image/"));
    if (file) captureFile(file);
  }, true);

  window.safelightMetadataExportItems = function () {
    return [
      { value: "jpeg", label: "JPEG", meta: "выборочная очистка" },
      { value: "webp", label: "WebP", meta: "чистый файл" },
      { value: "png", label: "PNG", meta: "чистый файл" }
    ];
  };
  window.safelightMetadataExport = exportMetadata;
  window.safelightAnalyzeMetadataFile = analyze;

  window.addEventListener("safelight:toolchange", (event) => {
    if (event.detail?.page === "metadata") setTimeout(render, 0);
  });

  function boot() {
    if (!installPanel()) { setTimeout(boot, 50); return; }
    const input = $("fileInput");
    if (input?.files?.[0]) captureFile(input.files[0]);
  }

  boot();
})();