"use client";

import Image from "next/image";
import { useEffect, useState } from "react";

import { accessibilityNotes, generateCss, generateHtml } from "./codeGenerator";
import { BUILT_IN_ICONS, ICON_CATEGORIES } from "./icons";
import { getMotion, INITIAL_MOTION, MOTIONS, MotionId, MotionSettings, normalizeSettings, QuickTriggerId, quickSettings, SETTING_RANGES, SPEED_OPTIONS, SpeedId, STRENGTH_OPTIONS, StrengthId, supportsQuickTrigger, TRIGGERS, TriggerId } from "./motions";
import { buildPreviewDocument, PreviewBackground } from "./previewDocument";
import { SvgValidationResult, validateSvg } from "./svgValidation";
import styles from "./page.module.css";

const SAMPLE_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" stroke-width="2">
  <circle cx="12" cy="12" r="9" />
  <path d="m8 12 2.5 2.5L16 9" />
</svg>`;

const MOTION_TAGS: Record<MotionId, string> = { press: "操作", pop: "操作・完了", lift: "Hover", shake: "注意", wiggle: "通知", pulse: "注目", "rotate-90": "開閉", "rotate-180": "開閉", flip: "切替", "fade-scale": "状態変化", spin: "処理中", float: "装飾" };
const MOTION_CLASSES: Record<MotionId, string> = { press: styles.motionPress, pop: styles.motionPop, lift: styles.motionLift, shake: styles.motionShake, wiggle: styles.motionWiggle, pulse: styles.motionPulse, "rotate-90": styles.motionRotate90, "rotate-180": styles.motionRotate180, flip: styles.motionFlip, "fade-scale": styles.motionFadeScale, spin: styles.motionSpin, float: styles.motionFloat };
const GALLERY_KEYFRAMES = `
@keyframes svg-gallery-press { 50% { transform: scale(.9); } }
@keyframes svg-gallery-pop { 0% { transform: scale(.7); } 60% { transform: scale(1.16); } 100% { transform: scale(1); } }
@keyframes svg-gallery-lift { 50% { transform: translateY(-12%) scale(1.08); } }
@keyframes svg-gallery-shake { 25% { transform: translateX(-10%); } 50% { transform: translateX(10%); } 75% { transform: translateX(-5%); } }
@keyframes svg-gallery-wiggle { 25% { transform: rotate(-14deg); } 50% { transform: rotate(14deg); } 75% { transform: rotate(-7deg); } }
@keyframes svg-gallery-pulse { 50% { transform: scale(1.1); opacity: .65; } }
@keyframes svg-gallery-rotate-90 { 100% { transform: rotate(90deg); } }
@keyframes svg-gallery-rotate-180 { 100% { transform: rotate(180deg); } }
@keyframes svg-gallery-flip { 100% { transform: rotateY(180deg); } }
@keyframes svg-gallery-fade-scale { 0% { transform: scale(.72); opacity: .25; } 100% { transform: scale(1); opacity: 1; } }
@keyframes svg-gallery-spin { 100% { transform: rotate(360deg); } }
@keyframes svg-gallery-float { 50% { transform: translateY(-12%); } }
`;

type SourceMode = "built-in" | "custom";
type QuickChoice<T extends string> = T | "custom";

export function SvgMotionStudio() {
  const [sourceMode, setSourceMode] = useState<SourceMode>("built-in");
  const [iconId, setIconId] = useState("arrow-right");
  const [iconCategory, setIconCategory] = useState<(typeof ICON_CATEGORIES)[number]>("ナビゲーション");
  const [customInput, setCustomInput] = useState("");
  const [approvedCustom, setApprovedCustom] = useState<string | null>(null);
  const [validation, setValidation] = useState<SvgValidationResult | null>(null);
  const [motionId, setMotionId] = useState<MotionId>("lift");
  const [trigger, setTrigger] = useState<TriggerId>("hover-focus");
  const [speed, setSpeed] = useState<QuickChoice<SpeedId>>("normal");
  const [strength, setStrength] = useState<QuickChoice<StrengthId>>("normal");
  const [settings, setSettings] = useState<MotionSettings>(INITIAL_MOTION.defaults);
  const [size, setSize] = useState(64);
  const [background, setBackground] = useState<PreviewBackground>("light");
  const [playing, setPlaying] = useState(true);
  const [runKey, setRunKey] = useState(0);
  const [galleryRun, setGalleryRun] = useState(0);
  const [selectionRun, setSelectionRun] = useState(0);
  const [announcement, setAnnouncement] = useState("");
  const [codeTab, setCodeTab] = useState<"HTML" | "CSS">("HTML");
  const [reducedMotion, setReducedMotion] = useState(false);
  const [svgUrl, setSvgUrl] = useState("");

  const icon = BUILT_IN_ICONS.find((item) => item.id === iconId) ?? BUILT_IN_ICONS[0];
  const activeSvg = sourceMode === "built-in" ? icon.svg : approvedCustom;
  const canGenerate = activeSvg !== null;
  const motion = getMotion(motionId);
  const input = activeSvg ? { svg: activeSvg, motionId, trigger, settings } : null;
  const htmlCode = input ? generateHtml(input) : "SVGを検証するとHTMLを生成します。";
  const cssCode = input ? generateCss(input) : "SVGを検証するとCSSを生成します。";
  const notes = input ? accessibilityNotes(input) : [];
  const warnings = notes.filter((note) => note.level === "warning").slice(0, 1);

  useEffect(() => {
    const query = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => setReducedMotion(query.matches);
    update();
    query.addEventListener("change", update);
    return () => query.removeEventListener("change", update);
  }, []);

  useEffect(() => {
    if (!activeSvg) {
      const emptyFrame = window.requestAnimationFrame(() => setSvgUrl(""));
      return () => window.cancelAnimationFrame(emptyFrame);
    }
    const url = URL.createObjectURL(new Blob([activeSvg], { type: "image/svg+xml" }));
    const frame = window.requestAnimationFrame(() => setSvgUrl(url));
    return () => { window.cancelAnimationFrame(frame); URL.revokeObjectURL(url); };
  }, [activeSvg]);

  const previewDoc = input ? buildPreviewDocument({ generatorInput: input, motionName: motion.name, background, size, playing, reducedMotion }) : "";

  function replay() { setPlaying(true); setRunKey((value) => value + 1); }

  function chooseMotion(nextId: MotionId) {
    const next = getMotion(nextId);
    const nextTrigger = trigger === "always" && !supportsQuickTrigger(next, "always") ? "hover-focus" : trigger;
    setMotionId(nextId);
    setTrigger(nextTrigger);
    setSpeed("normal");
    setStrength("normal");
    setSettings(next.defaults);
    setSelectionRun((value) => value + 1);
    replay();
  }

  function chooseSpeed(next: SpeedId) {
    const nextStrength = strength === "custom" ? "normal" : strength;
    setSpeed(next); setStrength(nextStrength);
    setSettings(quickSettings(motion, next, nextStrength)); replay();
  }

  function chooseStrength(next: StrengthId) {
    const nextSpeed = speed === "custom" ? "normal" : speed;
    setStrength(next); setSpeed(nextSpeed);
    setSettings(quickSettings(motion, nextSpeed, next)); replay();
  }

  function chooseQuickTrigger(next: QuickTriggerId) {
    if (!supportsQuickTrigger(motion, next)) { setAnnouncement(`${motion.name}ではAlwaysを使用できません。`); return; }
    setTrigger(next); replay();
  }

  function updateNumber(key: keyof Pick<MotionSettings, "duration" | "delay" | "translate" | "scale" | "rotation" | "opacity">, value: number) {
    setSettings((current) => normalizeSettings({ ...current, [key]: value }, motion));
    setSpeed("custom"); setStrength("custom");
  }

  function checkCustom() {
    const result = validateSvg(customInput);
    setValidation(result);
    setApprovedCustom(result.valid ? customInput : null);
    if (result.valid) setSourceMode("custom");
    setAnnouncement(result.valid ? "SVGを検証しました。原文を変更せず使用します。" : "このツールでは処理できない記述を検出しました。");
  }

  async function copy(code: string, label: string) {
    if (!canGenerate) return;
    try { await navigator.clipboard.writeText(code); setAnnouncement(`${label}をコピーしました。`); }
    catch { setAnnouncement(`${label}をコピーできませんでした。コードを選択してコピーしてください。`); }
  }

  function playAll() {
    if (reducedMotion) { setAnnouncement("端末の動きを減らす設定により、一括再生を停止しています。"); return; }
    setGalleryRun((value) => value + 1);
    setAnnouncement("12種類のモーションを再生しました。");
  }

  return <>
    <style>{GALLERY_KEYFRAMES}</style>
    <section className={styles.playground} aria-label="SVGモーションプレイグラウンド">
      <div className={styles.heroPreview}>
        <div className={styles.previewHeading}><div><p className={styles.kicker}>SELECTED MOTION</p><h2>{motion.name}</h2><p>{motion.description}</p></div><span className={styles.motionTag}>{MOTION_TAGS[motion.id]}</span></div>
        <div className={styles.motionPreview}>{canGenerate ? <iframe key={`${runKey}-${background}-${size}`} sandbox="" srcDoc={previewDoc} title="選択中モーションのプレビュー"/> : <p>使用可能なSVGを選択または検証してください。</p>}</div>
        <div className={styles.previewToolbar}>
          <div className={styles.previewActions}><button onClick={replay} type="button">再実行</button><button onClick={() => setPlaying(false)} type="button">停止</button></div>
          <div role="group" aria-label="プレビューサイズ">{[24, 40, 64].map((value) => <button aria-pressed={size === value} key={value} onClick={() => { setSize(value); replay(); }} type="button">{value}px</button>)}</div>
          <div role="group" aria-label="プレビュー背景">{([['light','明るい'],['dark','暗い'],['checkered','透明']] as const).map(([value, label]) => <button aria-pressed={background === value} key={value} onClick={() => { setBackground(value); replay(); }} type="button">{label}</button>)}</div>
        </div>
        <div className={styles.statusRow}><span>✓ reduced-motion対応</span><span>✓ SVG本体は変更なし</span>{trigger === "hover-focus" ? <span>✓ Hover / Focus対応</span> : null}</div>
        {warnings.map((note) => <p className={styles.warning} key={note.text}><strong>! 注意</strong>{note.text}</p>)}
      </div>

      <aside className={styles.quickPanel} aria-labelledby="quick-title">
        <div className={styles.quickHeading}><p className={styles.kicker}>QUICK SETUP</p><h2 id="quick-title">SVGと動きを調整</h2></div>
        <section className={styles.sourceSummary} aria-labelledby="source-title"><h3 id="source-title">SVG</h3><div className={styles.currentSource}>{svgUrl ? <Image alt="" height={48} src={svgUrl} unoptimized width={48}/> : null}<div><strong>{sourceMode === "built-in" ? icon.name : "Custom SVG"}</strong><span>{canGenerate ? "検証済み" : "未検証"}</span></div></div>
          <details className={styles.pickerDetails}><summary>アイコンを変更</summary><fieldset className={styles.cleanFieldset}><legend className={styles.srOnly}>内蔵アイコン</legend><div className={styles.categoryButtons} role="group" aria-label="アイコンカテゴリ">{ICON_CATEGORIES.map((category) => <button aria-pressed={iconCategory === category} key={category} onClick={() => setIconCategory(category)} type="button">{category}</button>)}</div><div className={styles.iconGrid}>{BUILT_IN_ICONS.filter((item) => item.category === iconCategory).map((item) => <label className={styles.iconCard} key={item.id}><input checked={sourceMode === "built-in" && iconId === item.id} name="built-in-icon" onChange={() => { setIconId(item.id); setSourceMode("built-in"); replay(); }} type="radio" value={item.id}/><span className={styles.selectedMark} aria-hidden="true">✓</span><span className={styles.iconImage} aria-hidden="true" dangerouslySetInnerHTML={{ __html: item.svg }}/><span className={styles.iconName}>{item.name}</span></label>)}</div></fieldset></details>
          <details className={styles.pickerDetails}><summary>自分のSVGを貼る</summary><div className={styles.customInput}><label htmlFor="custom-svg">SVGコード</label><textarea aria-describedby="custom-svg-hint custom-svg-error" aria-invalid={validation && !validation.valid ? "true" : undefined} id="custom-svg" onChange={(event) => { setCustomInput(event.target.value); setValidation(null); setApprovedCustom(null); }} spellCheck={false} value={customInput}/><p id="custom-svg-hint">入力内容はブラウザ内だけで検証します。</p><div className={styles.buttonRow}><button onClick={() => { setCustomInput(SAMPLE_SVG); setValidation(null); }} type="button">サンプル</button><button onClick={() => { setCustomInput(""); setValidation(null); setApprovedCustom(null); }} type="button">クリア</button><button className={styles.primaryButton} onClick={checkCustom} type="button">SVGを確認</button></div><div className={styles.errorArea} id="custom-svg-error" role={validation && !validation.valid ? "alert" : undefined}>{validation && !validation.valid ? <><strong>このツールでは処理できない記述を検出しました。</strong><ul>{validation.errors.map((error) => <li key={error}>{error}</li>)}</ul></> : null}</div></div></details>
        </section>
        <fieldset className={styles.quickGroup}><legend>Speed {speed === "custom" ? <small>カスタム</small> : null}</legend><div>{SPEED_OPTIONS.map((item) => <button aria-pressed={speed === item.id} key={item.id} onClick={() => chooseSpeed(item.id)} type="button">{item.name}</button>)}</div></fieldset>
        <fieldset className={styles.quickGroup}><legend>Strength {strength === "custom" ? <small>カスタム</small> : null}</legend><div>{STRENGTH_OPTIONS.map((item) => <button aria-pressed={strength === item.id} key={item.id} onClick={() => chooseStrength(item.id)} type="button">{item.name}</button>)}</div></fieldset>
        <fieldset className={styles.quickGroup}><legend>Trigger</legend><div>{([['hover-focus','Hover / Focus'],['click-class','Click'],['always','Always']] as const).map(([id,label]) => <button aria-disabled={!supportsQuickTrigger(motion, id)} aria-pressed={trigger === id} key={id} onClick={() => chooseQuickTrigger(id)} type="button">{label}</button>)}</div></fieldset>
      </aside>
    </section>

    <section className={styles.gallerySection} aria-labelledby="gallery-title">
      <div className={styles.galleryHeading}><div><p className={styles.kicker}>MOTION GALLERY</p><h2 id="gallery-title">12種類の動きを比べる</h2><p>同じSVGで違いを確認し、気に入った動きを選べます。</p></div><button className={styles.primaryButton} onClick={playAll} type="button">すべて再生</button></div>
      <fieldset className={styles.cleanFieldset}><legend className={styles.srOnly}>モーションを選択</legend><div className={`${styles.motionGallery} ${galleryRun > 0 ? styles.playAll : ""}`} key={galleryRun}>{MOTIONS.map((item) => <label className={`${styles.motionCard} ${item.id === motionId ? styles.selectionReplay : ""}`} key={item.id}><input checked={motionId === item.id} name="motion" onChange={() => chooseMotion(item.id)} onClick={() => { if (motionId === item.id) { setSelectionRun((value) => value + 1); replay(); } }} type="radio"/><span className={styles.motionCardVisual} key={item.id === motionId ? selectionRun : 0}>{svgUrl ? <Image alt="" className={`${styles.galleryIcon} ${MOTION_CLASSES[item.id]}`} height={54} src={svgUrl} unoptimized width={54}/> : null}</span><span className={styles.motionCardText}><strong>{item.name}</strong><small>{MOTION_TAGS[item.id]}</small></span><span className={styles.cardCheck} aria-hidden="true">✓</span></label>)}</div></fieldset>
    </section>

    <section className={styles.outputArea}>
      <details className={styles.advanced}><summary><span><strong>細かく調整する</strong><small>再生時間・遅延・easingなど（任意）</small></span><span aria-hidden="true" className={styles.disclosureIcon}>↓</span></summary><div className={styles.settingsGrid}><SelectField label="正確な発火条件" value={trigger} onChange={(value) => setTrigger(value as TriggerId)} options={TRIGGERS.filter((item) => item.id !== "always" || supportsQuickTrigger(motion, "always")).map((item) => [item.id, item.name])}/><NumberField label="再生時間" unit="ms" value={settings.duration} range={SETTING_RANGES.duration} onChange={(value) => updateNumber("duration", value)}/><NumberField label="遅延" unit="ms" value={settings.delay} range={SETTING_RANGES.delay} onChange={(value) => updateNumber("delay", value)}/><SelectField label="easing" value={settings.easing} onChange={(value) => setSettings({ ...settings, easing: value })} options={[["ease-out", "ease-out"], ["ease-in-out", "ease-in-out"], ["linear", "linear"], ["cubic-bezier(.2,.8,.2,1)", "滑らか"]]}/><SelectField label="繰り返し" value={String(settings.iterations)} onChange={(value) => setSettings(normalizeSettings({ ...settings, iterations: value === "infinite" ? "infinite" : Number(value) }, motion))} options={[...[1,2,3,5,10].map((value) => [String(value), `${value}回`] as [string,string]), ...(motion.allowInfinite ? [["infinite", "無限"] as [string,string]] : [])]}/><SelectField label="方向" value={settings.direction} onChange={(value) => setSettings({ ...settings, direction: value as MotionSettings["direction"] })} options={[["normal", "通常"], ["reverse", "逆再生"], ["alternate", "交互"]]}/>{motion.controls.includes("translate") ? <NumberField label="移動量" unit="%" value={settings.translate} range={SETTING_RANGES.translate} onChange={(value) => updateNumber("translate", value)}/> : null}{motion.controls.includes("scale") ? <NumberField label="拡大率" unit="倍" value={settings.scale} range={SETTING_RANGES.scale} step={.01} onChange={(value) => updateNumber("scale", value)}/> : null}{motion.controls.includes("rotation") ? <NumberField label="回転角度" unit="deg" value={settings.rotation} range={SETTING_RANGES.rotation} onChange={(value) => updateNumber("rotation", value)}/> : null}{motion.controls.includes("opacity") ? <NumberField label="opacity" unit="" value={settings.opacity} range={SETTING_RANGES.opacity} step={.01} onChange={(value) => updateNumber("opacity", value)}/> : null}{motion.controls.includes("flipAxis") ? <SelectField label="反転軸" value={settings.flipAxis} onChange={(value) => setSettings({ ...settings, flipAxis: value as MotionSettings["flipAxis"] })} options={[["X", "X軸"], ["Y", "Y軸"]]}/> : null}</div></details>
      <section className={styles.codeSection} aria-labelledby="code-title"><div className={styles.codeHeading}><div><p className={styles.kicker}>IMPLEMENTATION</p><h2 id="code-title">実装コード</h2></div><div className={styles.copyActions}><button disabled={!canGenerate} onClick={() => copy(htmlCode, "HTML")} type="button">HTMLをコピー</button><button disabled={!canGenerate} onClick={() => copy(cssCode, "CSS")} type="button">CSSをコピー</button></div></div><details className={styles.codeDetails}><summary>コードを見る</summary><div className={styles.codeTabs} role="group" aria-label="生成コード"><button aria-pressed={codeTab === "HTML"} onClick={() => setCodeTab("HTML")} type="button">HTML</button><button aria-pressed={codeTab === "CSS"} onClick={() => setCodeTab("CSS")} type="button">CSS</button></div><div className={styles.codePanel}><div><h3>{codeTab}</h3><button disabled={!canGenerate} onClick={() => copy(codeTab === "HTML" ? htmlCode : cssCode, codeTab)} type="button">{codeTab}をコピー</button></div><pre tabIndex={0}><code>{codeTab === "HTML" ? htmlCode : cssCode}</code></pre></div></details><p className={styles.liveRegion} aria-live="polite" aria-atomic="true">{announcement}</p></section>
    </section>
  </>;
}

function NumberField({ label, unit, value, range, step = 1, onChange }: { label: string; unit: string; value: number; range: { min: number; max: number }; step?: number; onChange: (value: number) => void }) { const id = `setting-${label}`; return <label className={styles.field} htmlFor={id}><span>{label}</span><span className={styles.inputUnit}><input id={id} max={range.max} min={range.min} onChange={(event) => onChange(Number(event.target.value))} step={step} type="number" value={value}/><i>{unit}</i></span><small>{range.min}〜{range.max}{unit}</small></label>; }
function SelectField({ label, value, options, onChange }: { label: string; value: string; options: readonly (readonly [string,string])[]; onChange: (value: string) => void }) { const id = `setting-${label}`; return <label className={styles.field} htmlFor={id}><span>{label}</span><select id={id} onChange={(event) => onChange(event.target.value)} value={value}>{options.map(([optionValue, text]) => <option key={optionValue} value={optionValue}>{text}</option>)}</select></label>; }
