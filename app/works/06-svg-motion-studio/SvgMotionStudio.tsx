"use client";

import { useState } from "react";

import { accessibilityNotes, generateCss, generateHtml } from "./codeGenerator";
import { BUILT_IN_ICONS, ICON_CATEGORIES } from "./icons";
import { getMotion, INITIAL_MOTION, MotionId, MotionSettings, motionsForPurpose, normalizeSettings, PURPOSES, PurposeId, SETTING_RANGES, TRIGGERS, TriggerId } from "./motions";
import { SvgValidationResult, validateSvg } from "./svgValidation";
import styles from "./page.module.css";

const SAMPLE_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" stroke-width="2">
  <circle cx="12" cy="12" r="9" />
  <path d="m8 12 2.5 2.5L16 9" />
</svg>`;

type SourceMode = "built-in" | "custom";
type Background = "light" | "dark" | "checkered";

export function SvgMotionStudio() {
  const [sourceMode, setSourceMode] = useState<SourceMode>("built-in");
  const [iconId, setIconId] = useState("arrow-right");
  const [iconCategory, setIconCategory] = useState<(typeof ICON_CATEGORIES)[number]>("ナビゲーション");
  const [customInput, setCustomInput] = useState("");
  const [approvedCustom, setApprovedCustom] = useState<string | null>(null);
  const [validation, setValidation] = useState<SvgValidationResult | null>(null);
  const [purpose, setPurpose] = useState<PurposeId>("interaction");
  const [motionId, setMotionId] = useState<MotionId>("lift");
  const [trigger, setTrigger] = useState<TriggerId>("hover-focus");
  const [settings, setSettings] = useState<MotionSettings>(INITIAL_MOTION.defaults);
  const [size, setSize] = useState(40);
  const [background, setBackground] = useState<Background>("light");
  const [playing, setPlaying] = useState(true);
  const [runKey, setRunKey] = useState(0);
  const [stateOn, setStateOn] = useState(true);
  const [announcement, setAnnouncement] = useState("");
  const [codeTab, setCodeTab] = useState<"HTML" | "CSS">("HTML");

  const icon = BUILT_IN_ICONS.find((item) => item.id === iconId) ?? BUILT_IN_ICONS[0];
  const activeSvg = sourceMode === "built-in" ? icon.svg : approvedCustom;
  const canGenerate = activeSvg !== null;
  const motion = getMotion(motionId);
  const input = activeSvg ? { svg: activeSvg, motionId, trigger, settings } : null;
  const htmlCode = input ? generateHtml(input) : "SVGを検証するとHTMLを生成します。";
  const cssCode = input ? generateCss(input) : "SVGを検証するとCSSを生成します。";
  const notes = input ? accessibilityNotes(input) : [];
  const visibleNotes = notes.some((note) => note.level === "warning") ? notes.filter((note) => note.level === "warning").slice(0, 1) : notes.slice(0, 1);
  const candidates = motionsForPurpose(purpose);
  const info = sourceMode === "built-in" ? validateSvg(icon.svg) : validation;

  const previewDoc = (() => {
    if (!input) return "";
    const state = motionId === "spin" ? "aria-busy" : motionId === "pop" ? "aria-pressed" : "aria-expanded";
    const stateMarkup = trigger === "state-attribute" ? `${state}="${stateOn ? "true" : "false"}"` : "";
    const activeClass = playing && trigger === "click-class" ? " is-animated" : "";
    const paused = playing ? "" : ".svg-motion > svg{animation-play-state:paused!important}";
    return `<!doctype html><html><head><meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; img-src 'none'; font-src 'none'; connect-src 'none'"><style>html,body{height:100%;margin:0}body{display:grid;place-items:center;color:${background === "dark" ? "#fff" : "#14241d"};background:${background === "dark" ? "#17221d" : background === "checkered" ? "repeating-conic-gradient(#e1e5e3 0 25%,#fff 0 50%) 50%/20px 20px" : "#fff"}.svg-motion-control{font:inherit;color:inherit;background:transparent;border:2px solid transparent;border-radius:12px;padding:20px;cursor:pointer}.svg-motion-control:focus-visible{outline:4px solid #f4a62a;outline-offset:3px}.svg-motion{font-size:${size}px}${cssCode}${paused}</style></head><body><button type="button" class="svg-motion-control${activeClass}" ${stateMarkup} aria-label="モーションプレビュー"><span class="svg-motion" aria-hidden="true">${activeSvg}</span></button></body></html>`;
  })();

  function choosePurpose(next: PurposeId) {
    setPurpose(next);
    const nextMotion = motionsForPurpose(next)[0];
    setMotionId(nextMotion.id);
    setSettings(nextMotion.defaults);
  }

  function chooseMotion(nextId: MotionId) {
    const next = getMotion(nextId);
    setMotionId(nextId);
    setSettings(next.defaults);
  }

  function updateNumber(key: keyof Pick<MotionSettings, "duration" | "delay" | "translate" | "scale" | "rotation" | "opacity">, value: number) {
    setSettings((current) => normalizeSettings({ ...current, [key]: value }, motion));
  }

  function checkCustom() {
    const result = validateSvg(customInput);
    setValidation(result);
    setApprovedCustom(result.valid ? customInput : null);
    setAnnouncement(result.valid ? "SVGを検証しました。原文を変更せず使用します。" : "このツールでは処理できない記述を検出しました。");
  }

  async function copy(code: string, label: string) {
    if (!canGenerate) return;
    try { await navigator.clipboard.writeText(code); setAnnouncement(`${label}をコピーしました。`); }
    catch { setAnnouncement(`${label}をコピーできませんでした。コードを選択してコピーしてください。`); }
  }

  return <section className={styles.workspace} aria-label="SVGモーション設定ワークスペース">
    <div className={styles.leftColumn}>
    <section className={styles.mainResult} aria-labelledby="preview-title">
      <div className={styles.resultHeading}>
        <div><p className={styles.kicker}>LIVE PREVIEW</p><h2 id="preview-title">{sourceMode === "built-in" ? icon.name : "Custom SVG"} × {motion.name}</h2></div>
        <div className={styles.summaryBadges} aria-label="現在の設定"><span>{PURPOSES.find((item) => item.id === purpose)?.name}</span><span>{TRIGGERS.find((item) => item.id === trigger)?.name}</span></div>
      </div>
      <div className={styles.previewToolbar}>
        <div role="group" aria-label="プレビューサイズ">{[24, 40, 64].map((value) => <button aria-pressed={size === value} key={value} onClick={() => setSize(value)} type="button">{value}px</button>)}</div>
        <div role="group" aria-label="プレビュー背景">{([['light','明るい'],['dark','暗い'],['checkered','透明']] as const).map(([value, label]) => <button aria-pressed={background === value} key={value} onClick={() => setBackground(value)} type="button">{label}</button>)}</div>
      </div>
      <div className={styles.motionPreview}>{canGenerate ? <iframe key={`${runKey}-${stateOn}`} sandbox="" srcDoc={previewDoc} title="モーションプレビュー"/> : <p>使用可能なSVGを選択または検証してください。</p>}</div>
      <div className={styles.previewActions}>
        <p className={styles.previewHelp}>{trigger === "hover-focus" ? "対象へマウスを乗せるか、Tabキーでフォーカスしてください。" : trigger === "active" ? "対象を押している間に動作します。" : trigger === "click-class" ? "実行ボタンでクラスを付け直します。" : trigger === "state-attribute" ? "状態ボタンでaria属性を切り替えます。" : "開始・停止できます。"}</p>
        <div className={styles.buttonRow}><button onClick={() => setPlaying(true)} type="button">再生</button><button onClick={() => setPlaying(false)} type="button">停止</button><button onClick={() => { setPlaying(true); setRunKey((value) => value + 1); }} type="button">再実行</button>{trigger === "click-class" ? <button className={styles.primaryButton} onClick={() => { setPlaying(true); setRunKey((value) => value + 1); }} type="button">アニメーションを実行</button> : null}{trigger === "state-attribute" ? <button className={styles.primaryButton} aria-pressed={stateOn} onClick={() => setStateOn((value) => !value)} type="button">状態を切り替える</button> : null}</div>
      </div>
    </section>
    <section className={styles.a11ySummary} aria-labelledby="a11y-title"><div><p className={styles.kicker}>ACCESSIBILITY</p><h2 id="a11y-title">実装前の確認</h2></div><div className={styles.notes}>{visibleNotes.map((note) => <p className={note.level === "warning" ? styles.warning : styles.good} key={note.text}><strong>{note.level === "warning" ? "! 注意" : "✓ 良い設定"}</strong><span>{note.text}</span></p>)}</div><p className={styles.disclaimer}>医療的な安全性やWCAGへの完全準拠を保証するものではありません。</p></section>
    <section className={styles.codeSection} aria-labelledby="code-title"><div className={styles.codeHeading}><div><p className={styles.kicker}>IMPLEMENTATION</p><h2 id="code-title">生成コード</h2></div><p><strong>SVG本体：変更なし</strong> ／ ラッパーとCSSを追加</p></div><div className={styles.codeTabs} role="group" aria-label="生成コード"><button aria-pressed={codeTab === "HTML"} onClick={() => setCodeTab("HTML")} type="button">HTML</button><button aria-pressed={codeTab === "CSS"} onClick={() => setCodeTab("CSS")} type="button">CSS</button></div><div className={styles.codePanel}><div><h3>{codeTab}</h3><button disabled={!canGenerate} onClick={() => copy(codeTab === "HTML" ? htmlCode : cssCode, codeTab)} type="button">{codeTab}をコピー</button></div><pre tabIndex={0}><code>{codeTab === "HTML" ? htmlCode : cssCode}</code></pre></div><div className={styles.copyActions}><button disabled={!canGenerate} onClick={() => copy(htmlCode, "HTML")} type="button">HTMLをコピー</button><button disabled={!canGenerate} onClick={() => copy(cssCode, "CSS")} type="button">CSSをコピー</button></div><p className={styles.liveRegion} aria-live="polite" aria-atomic="true">{announcement}</p></section>
    </div>

    <aside className={styles.settingsPanel} aria-labelledby="settings-title">
      <div className={styles.panelHeading}><p className={styles.kicker}>SETTINGS</p><h2 id="settings-title">モーション設定</h2></div>
      <section className={styles.settingGroup} aria-labelledby="source-title">
        <h3 id="source-title">SVG</h3>
        <div className={styles.sourceTabs} role="group" aria-label="SVGの入力方法"><button aria-pressed={sourceMode === "built-in"} onClick={() => setSourceMode("built-in")} type="button">内蔵アイコン</button><button aria-pressed={sourceMode === "custom"} onClick={() => setSourceMode("custom")} type="button">自分のSVG</button></div>
        {sourceMode === "built-in" ? <fieldset className={styles.cleanFieldset}>
          <legend className={styles.srOnly}>内蔵アイコン</legend>
          <div className={styles.categoryButtons} role="group" aria-label="アイコンカテゴリ">{ICON_CATEGORIES.map((category) => <button aria-pressed={iconCategory === category} key={category} onClick={() => setIconCategory(category)} type="button">{category}</button>)}</div>
          <div className={styles.iconGrid}>{BUILT_IN_ICONS.filter((item) => item.category === iconCategory).map((item) => <label className={styles.iconCard} key={item.id}><input checked={iconId === item.id} name="built-in-icon" onChange={() => setIconId(item.id)} type="radio" value={item.id}/><span className={styles.selectedMark} aria-hidden="true">✓</span><span className={styles.iconImage} aria-hidden="true" dangerouslySetInnerHTML={{ __html: item.svg }}/><span className={styles.iconName}>{item.name}</span></label>)}</div>
        </fieldset> : <div className={styles.customInput}><label htmlFor="custom-svg">SVGコード</label><textarea aria-describedby="custom-svg-hint custom-svg-error" aria-invalid={validation && !validation.valid ? "true" : undefined} id="custom-svg" onChange={(event) => { setCustomInput(event.target.value); setValidation(null); setApprovedCustom(null); }} spellCheck={false} value={customInput}/><p id="custom-svg-hint">ブラウザ内だけで処理し、確認後に使用します。</p><div className={styles.buttonRow}><button onClick={() => { setCustomInput(SAMPLE_SVG); setValidation(null); setApprovedCustom(null); }} type="button">サンプルを挿入</button><button onClick={() => { setCustomInput(""); setValidation(null); setApprovedCustom(null); }} type="button">クリア</button><button className={styles.primaryButton} onClick={checkCustom} type="button">SVGを確認</button></div><div className={styles.errorArea} id="custom-svg-error" role={validation && !validation.valid ? "alert" : undefined}>{validation && !validation.valid ? <><strong>このツールでは処理できない記述を検出しました。</strong><ul>{validation.errors.map((error) => <li key={error}>{error}</li>)}</ul></> : null}</div></div>}
        <dl className={styles.svgInfo}><div><dt>検証</dt><dd>{canGenerate ? "使用可能" : "未検証または拒否"}</dd></div><div><dt>viewBox</dt><dd>{info?.valid ? info.viewBox ?? "なし" : "—"}</dd></div><div><dt>寸法属性</dt><dd>{info?.valid ? `${info.hasWidth ? "widthあり" : "widthなし"} / ${info.hasHeight ? "heightあり" : "heightなし"}` : "—"}</dd></div></dl>
        <p className={styles.preserveNote}><strong>SVG本体：変更なし</strong><span>外側のラッパーとCSSだけを追加</span></p>
      </section>

      <section className={styles.settingGroup} aria-labelledby="purpose-title"><fieldset className={styles.cleanFieldset}><legend id="purpose-title">用途</legend><div className={styles.purposeList}>{PURPOSES.map((item) => <label className={styles.optionRow} key={item.id}><input checked={purpose === item.id} name="purpose" onChange={() => choosePurpose(item.id)} type="radio"/><span><strong>{item.name}</strong><small>{item.description}</small></span></label>)}</div></fieldset></section>
      <section className={styles.settingGroup} aria-labelledby="motion-title"><fieldset className={styles.cleanFieldset}><legend id="motion-title">モーション</legend><div className={styles.motionGrid}>{candidates.map((item) => <label className={styles.motionOption} key={item.id}><input checked={motionId === item.id} name="motion" onChange={() => chooseMotion(item.id)} type="radio"/><span><strong>{item.name}</strong><small>{item.description}</small></span></label>)}</div><p className={styles.motionRecommendation}>推奨：{motion.recommendation}</p></fieldset></section>
      <section className={styles.settingGroup} aria-labelledby="detail-title"><h3 id="detail-title">発火条件・詳細設定</h3><div className={styles.settingsGrid}><SelectField label="発火条件" value={trigger} onChange={(value) => setTrigger(value as TriggerId)} options={TRIGGERS.map((item) => [item.id, item.name])}/><NumberField label="再生時間" unit="ms" value={settings.duration} range={SETTING_RANGES.duration} onChange={(value) => updateNumber("duration", value)}/><NumberField label="遅延" unit="ms" value={settings.delay} range={SETTING_RANGES.delay} onChange={(value) => updateNumber("delay", value)}/><SelectField label="easing" value={settings.easing} onChange={(value) => setSettings({ ...settings, easing: value })} options={[["ease-out", "ease-out"], ["ease-in-out", "ease-in-out"], ["linear", "linear"], ["cubic-bezier(.2,.8,.2,1)", "滑らか"]]}/><SelectField label="繰り返し" value={String(settings.iterations)} onChange={(value) => setSettings(normalizeSettings({ ...settings, iterations: value === "infinite" ? "infinite" : Number(value) }, motion))} options={[...[1,2,3,5,10].map((value) => [String(value), `${value}回`] as [string,string]), ...(motion.allowInfinite ? [["infinite", "無限"] as [string,string]] : [])]}/><SelectField label="方向" value={settings.direction} onChange={(value) => setSettings({ ...settings, direction: value as MotionSettings["direction"] })} options={[["normal", "通常"], ["reverse", "逆再生"], ["alternate", "交互"]]}/>{motion.controls.includes("translate") ? <NumberField label="移動量" unit="%" value={settings.translate} range={SETTING_RANGES.translate} onChange={(value) => updateNumber("translate", value)}/> : null}{motion.controls.includes("scale") ? <NumberField label="拡大率" unit="倍" value={settings.scale} range={SETTING_RANGES.scale} step={.01} onChange={(value) => updateNumber("scale", value)}/> : null}{motion.controls.includes("rotation") ? <NumberField label="回転角度" unit="deg" value={settings.rotation} range={SETTING_RANGES.rotation} onChange={(value) => updateNumber("rotation", value)}/> : null}{motion.controls.includes("opacity") ? <NumberField label="opacity" unit="" value={settings.opacity} range={SETTING_RANGES.opacity} step={.01} onChange={(value) => updateNumber("opacity", value)}/> : null}{motion.controls.includes("flipAxis") ? <SelectField label="反転軸" value={settings.flipAxis} onChange={(value) => setSettings({ ...settings, flipAxis: value as MotionSettings["flipAxis"] })} options={[["X", "X軸"], ["Y", "Y軸"]]}/> : null}</div></section>
    </aside>

  </section>;
}

function NumberField({ label, unit, value, range, step = 1, onChange }: { label: string; unit: string; value: number; range: { min: number; max: number }; step?: number; onChange: (value: number) => void }) { const id = `setting-${label}`; return <label className={styles.field} htmlFor={id}><span>{label}</span><span className={styles.inputUnit}><input id={id} max={range.max} min={range.min} onChange={(event) => onChange(Number(event.target.value))} step={step} type="number" value={value}/><i>{unit}</i></span><small>{range.min}〜{range.max}{unit}</small></label>; }
function SelectField({ label, value, options, onChange }: { label: string; value: string; options: readonly (readonly [string,string])[]; onChange: (value: string) => void }) { const id = `setting-${label}`; return <label className={styles.field} htmlFor={id}><span>{label}</span><select id={id} onChange={(event) => onChange(event.target.value)} value={value}>{options.map(([optionValue, text]) => <option key={optionValue} value={optionValue}>{text}</option>)}</select></label>; }
