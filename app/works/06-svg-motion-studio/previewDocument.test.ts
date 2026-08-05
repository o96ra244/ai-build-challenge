import { describe, expect, it } from "vitest";

import { INITIAL_MOTION } from "./motions";
import { buildPreviewDocument } from "./previewDocument";

const svg = `<svg viewBox="0 0 24 24">
  <!-- 原文を保持 -->
  <path d="M1 2 L3 4" />
</svg>`;

const document = buildPreviewDocument({
  generatorInput: { svg, motionId: "lift", trigger: "hover-focus", settings: INITIAL_MOTION.defaults },
  motionName: "Lift",
  background: "light",
  size: 64,
  playing: true,
  reducedMotion: false,
});

describe("buildPreviewDocument", () => {
  it("bodyルールを閉じてから生成CSSを配置する", () => {
    const bodyEnd = document.indexOf("background: #fff;\n}");
    const generatedCss = document.indexOf(".svg-motion-control {");
    expect(bodyEnd).toBeGreaterThan(-1);
    expect(generatedCss).toBeGreaterThan(bodyEnd);
  });

  it("click classと選択中モーションのkeyframesを含む", () => {
    expect(document).toContain(".svg-motion-control.is-animated .svg-motion > svg");
    expect(document).toContain("@keyframes svg-motion-lift");
  });

  it("SVG原文を変更せず含める", () => expect(document).toContain(svg));

  it("sandbox向けCSPを維持する", () => {
    expect(document).toContain(`default-src 'none'`);
    expect(document).toContain(`style-src 'unsafe-inline'`);
    expect(document).toContain(`connect-src 'none'`);
  });
});
