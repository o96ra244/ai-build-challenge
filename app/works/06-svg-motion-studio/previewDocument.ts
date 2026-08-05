import { generateCss, GeneratorInput } from "./codeGenerator";

export type PreviewBackground = "light" | "dark" | "checkered";

type PreviewDocumentInput = {
  generatorInput: GeneratorInput;
  motionName: string;
  background: PreviewBackground;
  size: number;
  playing: boolean;
  reducedMotion: boolean;
};

const CSP = "default-src 'none'; style-src 'unsafe-inline'; img-src 'none'; font-src 'none'; connect-src 'none'";

export function buildPreviewDocument({ generatorInput, motionName, background, size, playing, reducedMotion }: PreviewDocumentInput): string {
  const { settings, svg } = generatorInput;
  const previewCss = generateCss({
    ...generatorInput,
    trigger: "click-class",
    settings: { ...settings, iterations: settings.iterations === "infinite" ? 1 : settings.iterations },
  });
  const backgroundValue = background === "dark"
    ? "#17221d"
    : background === "checkered"
      ? "repeating-conic-gradient(#e1e5e3 0 25%, #fff 0 50%) 50% / 20px 20px"
      : "#fff";
  const color = background === "dark" ? "#fff" : "#14241d";
  const activeClass = playing && !reducedMotion ? " is-animated" : "";

  return `<!doctype html>
<html>
<head>
<meta http-equiv="Content-Security-Policy" content="${CSP}">
<style>
html,
body {
  height: 100%;
  margin: 0;
}

body {
  display: grid;
  place-items: center;
  color: ${color};
  background: ${backgroundValue};
}

${previewCss}

.svg-motion {
  width: ${size}px !important;
  height: ${size}px !important;
  font-size: ${size}px !important;
}

.svg-motion-control {
  appearance: none !important;
  color: inherit;
  background: transparent !important;
  border: 0 !important;
  border-radius: 16px;
  padding: 28px;
}

.svg-motion-control:focus-visible {
  outline: 4px solid #f4a62a;
  outline-offset: 3px;
}
</style>
</head>
<body>
<button type="button" class="svg-motion-control${activeClass}" aria-label="${motionName}モーションプレビュー">
  <span class="svg-motion" aria-hidden="true">${svg}</span>
</button>
</body>
</html>`;
}
