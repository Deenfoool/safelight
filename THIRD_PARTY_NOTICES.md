# Third-party notices

Safelight's own source code is distributed under the repository's [MIT License](LICENSE). This document records separately licensed code shipped with the application.

The files `vendor/jszip.min.js`, `vendor/pdf.min.js`, and `vendor/jspdf.umd.min.js` are Safelight-specific compatibility runtimes. Despite their historical filenames and API shapes, they are not vendored copies of JSZip, PDF.js, or jsPDF.

## elheif 0.1.0

Safelight redistributes the single-file WebAssembly build at `vendor/elheif/elheif-wasm.js`.

- Upstream: <https://github.com/hpp2334/elheif>
- Package version: `0.1.0`
- Artifact SHA-256: `a2e7c699be9a0025c121a52698968375ef6e472c04d4832d58db0179391e1fe3`
- Wrapper license: MIT

Copyright (c) 2024 hpp2334

Permission is hereby granted, free of charge, to any person obtaining a copy of this software and associated documentation files (the "Software"), to deal in the Software without restriction, including without limitation the rights to use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the Software, and to permit persons to whom the Software is furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.

### Compiled components

The elheif build links static WebAssembly code from these upstream projects:

- [libheif](https://github.com/strukturag/libheif) — GNU Lesser General Public License; sample applications use MIT.
- [libde265](https://github.com/strukturag/libde265) — GNU Lesser General Public License; sample applications use MIT.
- [Kvazaar](https://github.com/ultravideo/kvazaar) — the exact revision included in this artifact is not recorded.

The elheif 0.1.0 build configuration fetched the default branch of all three projects without a tag or commit SHA. Kvazaar changed its license in version 2.1.0 from LGPL-2.1 to BSD-3-Clause, so the current upstream license must not be assumed to describe this bundle.

Before redistributing a production rebuild of this codec, pin every upstream revision, archive the corresponding source, and include the complete applicable license texts and any relinking materials required by the LGPL. This inventory is not a substitute for those distribution requirements.
