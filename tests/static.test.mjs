import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { access, readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

test("every service-worker shell entry exists", async () => {
  const source = await readFile(path.join(root, "sw.js"), "utf8");
  const coreSource = source.match(/const CORE = \[([\s\S]*?)\];/)?.[1];
  assert.ok(coreSource, "CORE cache list was not found");

  const entries = [...coreSource.matchAll(/"\.\/(.*?)"/g)].map((match) => match[1]);
  assert.ok(entries.length > 0, "CORE cache list is empty");
  await Promise.all(entries.filter(Boolean).map((entry) => access(path.join(root, entry))));
});

test("editor runtime scripts referenced by navigation exist", async () => {
  const source = await readFile(path.join(root, "js/navigation.js"), "utf8");
  const scripts = [...source.matchAll(/loadScript\('(js\/[^'?]+\.js)/g)].map((match) => match[1]);
  assert.ok(scripts.length >= 20, "expected the complete editor runtime manifest");
  await Promise.all(scripts.map((entry) => access(path.join(root, entry))));
});

test("offline install is atomic", async () => {
  const source = await readFile(path.join(root, "sw.js"), "utf8");
  assert.match(source, /cache\.addAll\(CORE\)/);
  assert.doesNotMatch(source, /Promise\.allSettled/);
});

test("the documented HEIC artifact checksum is current", async () => {
  const codec = await readFile(path.join(root, "vendor/elheif/elheif-wasm.js"));
  const notices = await readFile(path.join(root, "THIRD_PARTY_NOTICES.md"), "utf8");
  const digest = createHash("sha256").update(codec).digest("hex");
  assert.match(notices, new RegExp(digest));
});

test("batch processing ships a local queue and ZIP pipeline", async () => {
  const panel = await readFile(path.join(root, "js/advanced.js"), "utf8");
  const runtime = await readFile(path.join(root, "js/batch-tools.js"), "utf8");
  const navigation = await readFile(path.join(root, "js/navigation.js"), "utf8");

  for (const id of ["batch-files", "b-queue", "b-format", "b-resize-mode", "b-prefix", "b-suffix", "b-download"]) {
    assert.match(panel, new RegExp(`id=["']${id}["']`), `missing batch control ${id}`);
  }
  assert.match(runtime, /new JSZip\(\)/);
  assert.match(runtime, /safelightHeicCodec\?\.decodeFile/);
  assert.match(runtime, /safelight-errors\.txt/);
  assert.match(runtime, /zip\.generateAsync\(\{ type: "blob" \}/);
  assert.match(navigation, /loadScript\('js\/batch-tools\.js/);
  assert.match(navigation, /css\/batch-tools\.css/);
});

test("advanced censorship supports multiple modes, shapes and face detection fallback", async () => {
  const runtime = await readFile(path.join(root, "js/privacy-effects.js"), "utf8");
  const styles = await readFile(path.join(root, "css/privacy-effects.css"), "utf8");

  for (const mode of ["blur", "pixelate", "black"]) assert.match(runtime, new RegExp(`data-pe-mode=["']${mode}["']`));
  for (const shape of ["rect", "ellipse", "free"]) assert.match(runtime, new RegExp(`data-pe-shape=["']${shape}["']`));
  assert.match(runtime, /window\.FaceDetector/);
  assert.match(runtime, /FaceDetector !== "function"/);
  assert.match(runtime, /data-pe-resize/);
  assert.match(runtime, /safelightPrivacyEffects = Object\.freeze/);
  assert.match(styles, /\.sl-pe-area\.shape-free/);
  assert.match(styles, /\.sl-pe-resize\.nw/);
});
