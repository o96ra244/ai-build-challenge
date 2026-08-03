export type PurposeId = "interaction" | "attention" | "state" | "loading" | "decoration";
export type MotionId = "press" | "pop" | "lift" | "shake" | "wiggle" | "pulse" | "rotate-90" | "rotate-180" | "flip" | "fade-scale" | "spin" | "float";
export type TriggerId = "hover-focus" | "active" | "click-class" | "state-attribute" | "always";
export type Direction = "normal" | "reverse" | "alternate";
export type FlipAxis = "X" | "Y";

export type MotionSettings = {
  duration: number; delay: number; easing: string; iterations: number | "infinite";
  translate: number; scale: number; rotation: number; direction: Direction;
  opacity: number; flipAxis: FlipAxis;
};

export type Motion = {
  id: MotionId; name: string; description: string; recommendation: string;
  purposes: readonly PurposeId[]; controls: readonly ("translate" | "scale" | "rotation" | "opacity" | "flipAxis")[];
  allowInfinite: boolean; defaults: MotionSettings;
};

export const PURPOSES: readonly { id: PurposeId; name: string; description: string }[] = [
  { id: "interaction", name: "操作への反応", description: "押下、選択、ホバーへの応答" },
  { id: "attention", name: "注意を引く", description: "通知やエラーを短く強調" },
  { id: "state", name: "状態変化を伝える", description: "開閉、切替、更新を補助" },
  { id: "loading", name: "処理中を伝える", description: "待機中であることを補助" },
  { id: "decoration", name: "装飾として動かす", description: "穏やかな視覚的リズム" },
];

export const SETTING_RANGES = {
  duration: { min: 100, max: 5000, default: 240 }, delay: { min: 0, max: 5000, default: 0 },
  translate: { min: 0, max: 50, default: 8 }, scale: { min: 0.5, max: 2, default: 1.08 },
  rotation: { min: 0, max: 360, default: 12 }, opacity: { min: 0.1, max: 1, default: 0.72 },
  iterations: { min: 1, max: 10, default: 1 },
} as const;

const defaults = (overrides: Partial<MotionSettings> = {}): MotionSettings => ({
  duration: 240, delay: 0, easing: "ease-out", iterations: 1, translate: 8,
  scale: 1.08, rotation: 12, direction: "normal", opacity: 0.72, flipAxis: "X", ...overrides,
});

export const MOTIONS: readonly Motion[] = [
  { id: "press", name: "Press", description: "少し縮小して戻る", recommendation: "ボタンの押下", purposes: ["interaction"], controls: ["scale"], allowInfinite: false, defaults: defaults({ scale: .9, duration: 180 }) },
  { id: "pop", name: "Pop", description: "縮小から少し拡大して戻る", recommendation: "操作・完了・選択", purposes: ["interaction", "state"], controls: ["scale"], allowInfinite: false, defaults: defaults({ scale: 1.16, duration: 320 }) },
  { id: "lift", name: "Lift", description: "少し上へ移動して拡大", recommendation: "ホバー・フォーカス", purposes: ["interaction", "decoration"], controls: ["translate", "scale"], allowInfinite: false, defaults: defaults() },
  { id: "shake", name: "Shake", description: "左右へ短く揺れる", recommendation: "エラー・注意", purposes: ["attention"], controls: ["translate"], allowInfinite: false, defaults: defaults({ translate: 10, duration: 360 }) },
  { id: "wiggle", name: "Wiggle", description: "中心から小さく左右回転", recommendation: "通知・注意", purposes: ["attention"], controls: ["rotation"], allowInfinite: false, defaults: defaults({ rotation: 14, duration: 420 }) },
  { id: "pulse", name: "Pulse", description: "軽く拡大し透明度を変える", recommendation: "注目・選択中・新着", purposes: ["attention", "loading", "decoration"], controls: ["scale", "opacity"], allowInfinite: false, defaults: defaults({ duration: 900, scale: 1.1, opacity: .65 }) },
  { id: "rotate-90", name: "Rotate 90", description: "90度回転する", recommendation: "開閉・方向変化", purposes: ["state"], controls: ["rotation"], allowInfinite: false, defaults: defaults({ rotation: 90 }) },
  { id: "rotate-180", name: "Rotate 180", description: "180度回転する", recommendation: "アコーディオン・並び替え", purposes: ["state"], controls: ["rotation"], allowInfinite: false, defaults: defaults({ rotation: 180 }) },
  { id: "flip", name: "Flip", description: "X軸またはY軸で反転", recommendation: "表示の切り替え", purposes: ["state"], controls: ["flipAxis"], allowInfinite: false, defaults: defaults({ duration: 420 }) },
  { id: "fade-scale", name: "Fade Scale", description: "透明度と拡大率を変える", recommendation: "表示・状態更新", purposes: ["state"], controls: ["scale", "opacity"], allowInfinite: false, defaults: defaults({ scale: .72, opacity: .25 }) },
  { id: "spin", name: "Spin", description: "連続回転する", recommendation: "処理中", purposes: ["loading"], controls: ["rotation"], allowInfinite: true, defaults: defaults({ duration: 900, rotation: 360, iterations: "infinite", easing: "linear" }) },
  { id: "float", name: "Float", description: "ゆっくり上下する", recommendation: "装飾", purposes: ["decoration"], controls: ["translate"], allowInfinite: true, defaults: defaults({ duration: 1800, translate: 8, iterations: "infinite", direction: "alternate", easing: "ease-in-out" }) },
];

export const TRIGGERS: readonly { id: TriggerId; name: string }[] = [
  { id: "hover-focus", name: "Hover / Focus" }, { id: "active", name: "Active" },
  { id: "click-class", name: "Click class" }, { id: "state-attribute", name: "State attribute" },
  { id: "always", name: "Always" },
];

export const INITIAL_MOTION = MOTIONS.find((motion) => motion.id === "lift")!;

export function motionsForPurpose(purpose: PurposeId) { return MOTIONS.filter((motion) => motion.purposes.includes(purpose)); }
export function getMotion(id: MotionId) { return MOTIONS.find((motion) => motion.id === id) ?? INITIAL_MOTION; }

export function normalizeSettings(input: Partial<MotionSettings>, motion: Motion): MotionSettings {
  const number = (value: number | undefined, key: keyof typeof SETTING_RANGES) => {
    const range = SETTING_RANGES[key];
    return Number.isFinite(value) ? Math.min(range.max, Math.max(range.min, value!)) : range.default;
  };
  const iterations = input.iterations === "infinite" && motion.allowInfinite ? "infinite" : number(typeof input.iterations === "number" ? input.iterations : undefined, "iterations");
  return { ...motion.defaults, ...input, duration: number(input.duration, "duration"), delay: number(input.delay, "delay"), translate: number(input.translate, "translate"), scale: number(input.scale, "scale"), rotation: number(input.rotation, "rotation"), opacity: number(input.opacity, "opacity"), iterations };
}
