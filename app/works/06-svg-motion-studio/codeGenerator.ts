import { getMotion, MotionId, MotionSettings, normalizeSettings, TriggerId } from "./motions";

export type GeneratorInput = { svg: string; motionId: MotionId; trigger: TriggerId; settings: MotionSettings };

function stateAttribute(motionId: MotionId): { name: string; value: string } {
  if (motionId === "spin") return { name: "aria-busy", value: "true" };
  if (motionId === "pop") return { name: "aria-pressed", value: "true" };
  return { name: "aria-expanded", value: "true" };
}

export function generateHtml({ svg, motionId, trigger }: GeneratorInput): string {
  const icon = `<span class="svg-motion" aria-hidden="true">\n${svg}\n</span>`;
  if (trigger === "state-attribute") {
    const state = stateAttribute(motionId);
    if (motionId === "spin") return `<button class="svg-motion-control" type="button" aria-busy="true">\n${icon}\n  処理中\n</button>`;
    return `<button class="svg-motion-control" type="button" ${state.name}="${state.value}" aria-label="状態を切り替える">\n${icon}\n</button>`;
  }
  if (trigger === "always") return `<span class="svg-motion-control" aria-label="装飾アイコン">\n${icon}\n</span>`;
  return `<button class="svg-motion-control" type="button" aria-label="アイコンを操作する">\n${icon}\n</button>`;
}

function keyframes(id: MotionId, settings: MotionSettings): string {
  const t = settings.translate; const s = settings.scale; const r = settings.rotation; const o = settings.opacity; const axis = settings.flipAxis;
  const frames: Record<MotionId, string> = {
    press: `0%, 100% { transform: scale(1); }\n  50% { transform: scale(${s}); }`,
    pop: `0% { transform: scale(${Math.max(.5, 2 - s).toFixed(2)}); }\n  65% { transform: scale(${s}); }\n  100% { transform: scale(1); }`,
    lift: `0%, 100% { transform: translateY(0) scale(1); }\n  50% { transform: translateY(-${t}%) scale(${s}); }`,
    shake: `0%, 100% { transform: translateX(0); }\n  25% { transform: translateX(-${t}%); }\n  75% { transform: translateX(${t}%); }`,
    wiggle: `0%, 100% { transform: rotate(0); }\n  30% { transform: rotate(-${r}deg); }\n  70% { transform: rotate(${r}deg); }`,
    pulse: `0%, 100% { transform: scale(1); opacity: 1; }\n  50% { transform: scale(${s}); opacity: ${o}; }`,
    "rotate-90": `from { transform: rotate(0); }\n  to { transform: rotate(${r}deg); }`,
    "rotate-180": `from { transform: rotate(0); }\n  to { transform: rotate(${r}deg); }`,
    flip: `from { transform: rotate${axis}(0); }\n  to { transform: rotate${axis}(180deg); }`,
    "fade-scale": `from { transform: scale(${s}); opacity: ${o}; }\n  to { transform: scale(1); opacity: 1; }`,
    spin: `from { transform: rotate(0); }\n  to { transform: rotate(${r}deg); }`,
    float: `from { transform: translateY(0); }\n  to { transform: translateY(-${t}%); }`,
  };
  return frames[id];
}

export function triggerSelector(trigger: TriggerId, motionId: MotionId): string {
  if (trigger === "hover-focus") return ".svg-motion-control:hover .svg-motion > svg,\n.svg-motion-control:focus-visible .svg-motion > svg";
  if (trigger === "active") return ".svg-motion-control:active .svg-motion > svg";
  if (trigger === "click-class") return ".svg-motion-control.is-animated .svg-motion > svg";
  if (trigger === "always") return ".svg-motion-control .svg-motion > svg";
  const state = stateAttribute(motionId);
  return `.svg-motion-control[${state.name}="${state.value}"] .svg-motion > svg`;
}

export function generateCss(input: GeneratorInput): string {
  const motion = getMotion(input.motionId);
  const settings = normalizeSettings(input.settings, motion);
  const name = `svg-motion-${motion.id}`;
  return `.svg-motion-control {\n  display: inline-flex;\n  align-items: center;\n  gap: 0.5em;\n}\n\n.svg-motion {\n  display: inline-flex;\n  width: 1em;\n  height: 1em;\n}\n\n.svg-motion > svg {\n  display: block;\n  width: 100%;\n  height: 100%;\n  transform-origin: center;\n}\n\n${triggerSelector(input.trigger, motion.id)} {\n  animation: ${name} ${settings.duration}ms ${settings.easing} ${settings.delay}ms ${settings.iterations} ${settings.direction} both;\n}\n\n@keyframes ${name} {\n  ${keyframes(motion.id, settings)}\n}\n\n@media (prefers-reduced-motion: reduce) {\n  .svg-motion > svg {\n    animation: none;\n    transition: none;\n  }\n}`;
}

export function accessibilityNotes(input: GeneratorInput): readonly { level: "good" | "warning"; text: string }[] {
  const settings = normalizeSettings(input.settings, getMotion(input.motionId));
  const notes: { level: "good" | "warning"; text: string }[] = [
    { level: "good", text: "生成CSSにはprefers-reduced-motion対応が含まれます。" },
  ];
  if (input.trigger === "hover-focus") notes.push({ level: "good", text: "マウスのHoverとキーボードのFocusの両方で動作します。" });
  if (input.trigger === "always") notes.push({ level: "warning", text: "常時アニメーションは装飾または処理中表示に限定し、停止手段も検討してください。" });
  if (settings.iterations === "infinite") notes.push({ level: "warning", text: "無限ループは注意を引き続けるため、装飾または処理中表示に限定してください。" });
  if (settings.duration < 150) notes.push({ level: "warning", text: "再生時間が短いため、動きが急に見えないか確認してください。" });
  if (settings.translate > 30 || settings.scale > 1.5 || settings.rotation > 270) notes.push({ level: "warning", text: "動きが大きいため、値を下げた案も比較してください。" });
  if (["state", "loading"].some((purpose) => getMotion(input.motionId).purposes.includes(purpose as "state" | "loading"))) notes.push({ level: "warning", text: "動きだけで状態を伝えず、可視テキストやaria-liveも併用してください。" });
  return notes;
}
