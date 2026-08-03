import { describe, expect, it } from "vitest";
import { generateCss, generateHtml } from "./codeGenerator";
import { getMotion, MotionId, normalizeSettings, TriggerId } from "./motions";

const svg = '<svg viewBox="0 0 24 24">\n<!-- exact -->\n<path d="M.123 4" />\n</svg>';
const makeInput = (motionId: MotionId = "lift", trigger: TriggerId = "hover-focus") => ({ svg, motionId, trigger, settings: getMotion(motionId).defaults });

describe("code generation", () => {
  it("初期HTMLで原文を完全一致のままラッパーへ置く", () => { const html = generateHtml(makeInput()); expect(html).toContain(svg); expect(html).toContain('aria-label="アイコンを操作する"'); expect(html).toContain('class="svg-motion"'); expect(html).not.toContain('<svg class='); });
  it("初期CSSとreduced-motionを生成する", () => { const css = generateCss(makeInput()); expect(css).toContain(":hover"); expect(css).toContain(":focus-visible"); expect(css).toContain("240ms ease-out 0ms 1"); expect(css).toContain("prefers-reduced-motion: reduce"); });
  it.each([["active", ":active"], ["click-class", ".is-animated"], ["always", ".svg-motion-control .svg-motion"]] as const)("%sのセレクタを生成する", (trigger, selector) => expect(generateCss(makeInput("lift", trigger))).toContain(selector));
  it.each([["rotate-180", 'aria-expanded="true"'], ["pop", 'aria-pressed="true"'], ["spin", 'aria-busy="true"']] as const)("%sの状態属性を生成する", (motion, attribute) => expect(generateHtml(makeInput(motion, "state-attribute"))).toContain(attribute));
  it.each(["press", "pop", "lift", "shake", "wiggle", "pulse", "rotate-90", "rotate-180", "flip", "fade-scale", "spin", "float"] as MotionId[])("%sのkeyframesを生成する", (motionId) => expect(generateCss(makeInput(motionId))).toContain(`@keyframes svg-motion-${motionId}`));
  it("各設定をCSSへ反映する", () => { const input = makeInput("lift"); input.settings = { ...input.settings, duration: 500, delay: 120, easing: "linear", iterations: 3, direction: "alternate", translate: 20, scale: 1.4 }; const css = generateCss(input); expect(css).toContain("500ms linear 120ms 3 alternate"); expect(css).toContain("translateY(-20%) scale(1.4)"); });
  it("ShakeとWiggleのinfiniteを安全な値へ正規化する", () => (["shake", "wiggle"] as MotionId[]).forEach((id) => { const input = makeInput(id); input.settings = { ...input.settings, iterations: "infinite" }; expect(generateCss(input)).not.toMatch(/ infinite /); }));
});

describe("boundary normalization", () => {
  it.each([["duration", 100, 100], ["duration", 5000, 5000], ["duration", 99, 100], ["delay", -1, 0], ["scale", 3, 2], ["rotation", 500, 360], ["translate", -1, 0], ["opacity", Number.NaN, .72]] as const)("%s=%sを%sにする", (key, value, expected) => { const result = normalizeSettings({ ...getMotion("lift").defaults, [key]: value }, getMotion("lift")); expect(result[key]).toBe(expected); });
});
