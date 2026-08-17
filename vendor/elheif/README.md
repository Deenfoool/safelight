# elheif runtime

Safelight expects the local single-file `elheif` 0.1.0 WebAssembly bundle at:

`vendor/elheif/elheif-wasm.js`

Expected SHA-256:

`a2e7c699be9a0025c121a52698968375ef6e472c04d4832d58db0179391e1fe3`

The package exposes `__init__ELHEIF_MODULE`, `jsDecodeImage` and `jsEncodeImage` and is used only inside Safelight's local HEIC Web Worker.

Upstream package: `elheif` 0.1.0 by hpp2334. Package license: MIT. The bundle is built from libheif, libde265 and kvazaar; keep the relevant upstream notices/licenses when redistributing the vendored runtime.
