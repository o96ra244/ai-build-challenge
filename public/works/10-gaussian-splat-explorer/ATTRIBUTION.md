# Japanese Bee and Meadow attribution

## Japanese Bee Gaussian Splat

- Author: yyouzhen
- Title: Japanese Bee
- Source: [SuperSplat scene ae58ed2c](https://superspl.at/scene/ae58ed2c)
- License: [Creative Commons Attribution 4.0 International](https://creativecommons.org/licenses/by/4.0/)
- Source format: SuperSplat SOG v2 viewer bundle (`sog`, 11,482,650 bytes as listed by the source page)
- Local asset: `japanese-bee.v4.spz`
- Conversion output: SPZ v4, 13,242,688 bytes, 978,285 splats
- Git blob SHA: `c22ecb6c62e8b54d3829942f526ba22c861926ac`

The public viewer SOG files were converted locally with `@playcanvas/splat-transform@3.3.0` using `--spz-version 4`. The resulting SPZ asset is served locally without runtime access to SuperSplat.

The viewer displays the required on-screen attribution: `Scan by yyouzhen · Source · CC BY 4.0`.

## Meadow background

- Asset: Meadow equirectangular tonemapped JPG
- Author: Sergej Majboroda
- Source: [Poly Haven Meadow](https://polyhaven.com/a/meadow)
- License: [CC0](https://polyhaven.com/license)
- Original source: 8K tonemapped JPG, 8192 × 4096
- Local derivative: `meadow-2k.jpg`, 2048 × 1024, 553,041 bytes
- Derivation: resized from the official 8K JPG with the repository's existing `sharp@0.35.3` runtime at JPEG quality 82, progressive and mozjpeg enabled

The background is a static local equirectangular texture. Poly Haven's CC0 license does not require on-screen credit, but the source and derivative settings are recorded here and in `CHALLENGE.md`.
