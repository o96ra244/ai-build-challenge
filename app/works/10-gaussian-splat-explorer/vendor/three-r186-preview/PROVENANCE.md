# Gaussian Splat addon provenance

- Upstream: [Three.js](https://github.com/mrdoob/three.js)
- Fixed commit: `7f855a77b4b1733c923b8201fd1d202ea99b2d16`
- Retrieved: 2026-08-13
- License: Three.js MIT License, copied to `LICENSE`

## Files

The following files are copied from the fixed commit without runtime changes except for the import noted below:

- `gpgpu/CountingSort.js` ← `examples/jsm/gpgpu/CountingSort.js`
- `loaders/SPZLoader.js` ← `examples/jsm/loaders/SPZLoader.js`
- `objects/GaussianSplatMesh.js` ← `examples/jsm/objects/GaussianSplatMesh.js`
- `utils/GaussianSplatUtils.js` ← `examples/jsm/utils/GaussianSplatUtils.js`

`SPZLoader.js` imports `fflate.module.js` and `zstddec.module.js` from the published `three@0.185.1` package via `three/addons/libs/`. No third-party library source is vendored here. A single inline ESLint suppression documents the upstream callback `this` alias in `SPZLoader.load`.
