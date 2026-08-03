"use client";

import { FormEvent, RefObject, useRef, useState } from "react";

import {
  calculateBreakpoints,
  calculateGridResult,
  FIELD_DEFINITIONS,
  formatNumber,
  generateCss,
  generateHtml,
  GridSettings,
  INITIAL_PREVIEW_WIDTH,
  INITIAL_SETTINGS,
  NumericFieldName,
  TrackMode,
  validateIntegerInput,
} from "./grid";
import styles from "./page.module.css";

type InputValues = Record<NumericFieldName, string>;
type FieldErrors = Partial<Record<NumericFieldName, string>>;

const FIELD_ORDER: NumericFieldName[] = [
  "minimumCardWidth",
  "gap",
  "maximumColumns",
  "horizontalGutter",
  "cardCount",
];

const INITIAL_INPUTS: InputValues = {
  minimumCardWidth: "240",
  gap: "24",
  maximumColumns: "4",
  horizontalGutter: "16",
  cardCount: "3",
};

export function ResponsiveGridPlanner() {
  const [inputs, setInputs] = useState<InputValues>(INITIAL_INPUTS);
  const [mode, setMode] = useState<TrackMode>("auto-fit");
  const [settings, setSettings] = useState<GridSettings>(INITIAL_SETTINGS);
  const [previewWidth, setPreviewWidth] = useState(INITIAL_PREVIEW_WIDTH);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [announcement, setAnnouncement] = useState("");
  const refs: Record<NumericFieldName, RefObject<HTMLInputElement | null>> = {
    minimumCardWidth: useRef<HTMLInputElement>(null),
    gap: useRef<HTMLInputElement>(null),
    maximumColumns: useRef<HTMLInputElement>(null),
    horizontalGutter: useRef<HTMLInputElement>(null),
    cardCount: useRef<HTMLInputElement>(null),
  };

  const result = calculateGridResult(settings, previewWidth);
  const breakpoints = calculateBreakpoints(settings);
  const cssCode = generateCss(settings);
  const htmlCode = generateHtml(settings.cardCount);
  const visibleTracks = Array.from(
    { length: Math.max(settings.cardCount, result.trackCount) },
    (_, index) => ({
    empty: index >= settings.cardCount,
    number: index + 1,
    }),
  );

  function updateInput(field: NumericFieldName, value: string) {
    setInputs((current) => ({ ...current, [field]: value }));
    setErrors((current) => ({ ...current, [field]: undefined }));
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const validations = Object.fromEntries(
      FIELD_ORDER.map((field) => [field, validateIntegerInput(inputs[field], FIELD_DEFINITIONS[field])]),
    ) as Record<NumericFieldName, ReturnType<typeof validateIntegerInput>>;
    const nextErrors: FieldErrors = {};

    for (const field of FIELD_ORDER) {
      const validation = validations[field];
      if (!validation.valid) nextErrors[field] = validation.error;
    }
    setErrors(nextErrors);
    setAnnouncement("");

    const firstInvalid = FIELD_ORDER.find((field) => !validations[field].valid);
    if (firstInvalid) {
      refs[firstInvalid].current?.focus();
      return;
    }

    const values = Object.fromEntries(
      FIELD_ORDER.map((field) => {
        const validation = validations[field];
        return [field, validation.valid ? validation.value : 0];
      }),
    ) as Record<NumericFieldName, number>;
    const nextSettings: GridSettings = { ...values, mode };
    const nextResult = calculateGridResult(nextSettings, previewWidth);
    setSettings(nextSettings);
    setAnnouncement(`設計を更新しました。現在は${nextResult.trackCount}列、カード幅${formatNumber(nextResult.cardWidth)}pxです。`);
  }

  function reset() {
    setInputs(INITIAL_INPUTS);
    setMode("auto-fit");
    setSettings(INITIAL_SETTINGS);
    setPreviewWidth(INITIAL_PREVIEW_WIDTH);
    setErrors({});
    setAnnouncement("初期値に戻しました。");
  }

  async function copyCode(code: string, label: "HTML" | "CSS") {
    try {
      await navigator.clipboard.writeText(code);
      setAnnouncement(`${label}をコピーしました。`);
    } catch {
      setAnnouncement(`${label}をコピーできませんでした。コードを選択してコピーしてください。`);
    }
  }

  const cardBelowMinimum = result.cardWidth < settings.minimumCardWidth;

  return (
    <>
      <div className={styles.workspace}>
        <section className={styles.settingsPanel} aria-labelledby="settings-title">
          <p className={styles.sectionTag}>SETTINGS</p>
          <h2 id="settings-title">グリッドを設定</h2>
          <form className={styles.form} noValidate onSubmit={handleSubmit}>
            <div className={styles.fieldGrid}>
              {FIELD_ORDER.map((field) => (
                <NumberField
                  error={errors[field]}
                  field={field}
                  inputRef={refs[field]}
                  key={field}
                  onChange={(value) => updateInput(field, value)}
                  value={inputs[field]}
                />
              ))}
            </div>

            <fieldset className={styles.modeFieldset}>
              <legend>トラック生成方式</legend>
              <div className={styles.modeOptions}>
                <label>
                  <input checked={mode === "auto-fit"} name="mode" onChange={() => setMode("auto-fit")} type="radio" value="auto-fit" />
                  <span><strong>auto-fit</strong><small>空きトラックを折りたたみ、既存カードを広げる</small></span>
                </label>
                <label>
                  <input checked={mode === "auto-fill"} name="mode" onChange={() => setMode("auto-fill")} type="radio" value="auto-fill" />
                  <span><strong>auto-fill</strong><small>配置可能な空きトラックを残す</small></span>
                </label>
              </div>
            </fieldset>

            <div className={styles.actions}>
              <button className={styles.primaryButton} type="submit">グリッドを設計</button>
              <button className={styles.secondaryButton} onClick={reset} type="button">初期値に戻す</button>
            </div>
          </form>
        </section>

        <section className={styles.previewPanel} aria-labelledby="preview-title">
          <div className={styles.previewHeading}>
            <div><p className={styles.sectionTag}>PREVIEW</p><h2 id="preview-title">グリッドプレビュー</h2></div>
            <span>縮尺プレビュー</span>
          </div>
          <div className={styles.rangeField}>
            <div><label htmlFor="preview-width">プレビュー幅</label><output htmlFor="preview-width">{previewWidth}px</output></div>
            <input id="preview-width" max="1600" min="320" onChange={(event) => setPreviewWidth(Number(event.target.value))} step="1" type="range" value={previewWidth} />
          </div>
          <div className={styles.browserFrame}>
            <div className={styles.browserBar}><span aria-hidden="true">● ● ●</span><strong>{previewWidth}px</strong></div>
            <div className={styles.previewViewport} style={{ paddingInline: `${Math.min(6, settings.horizontalGutter / 10)}%` }}>
              <div className={styles.cardGrid} style={{ gap: `${Math.max(4, Math.min(14, settings.gap / 2))}px`, gridTemplateColumns: `repeat(${result.trackCount}, minmax(0, 1fr))` }}>
                {visibleTracks.map((track) => track.empty ? (
                  <div aria-hidden="true" className={styles.emptyTrack} key={`empty-${track.number}`}>空きトラック</div>
                ) : (
                  <article className={styles.previewCard} key={`card-${track.number}`}>
                    <span>Card {track.number}</span><strong>カードタイトル</strong><i /><i /><i className={styles.shortLine} /><b>ボタン</b>
                  </article>
                ))}
              </div>
            </div>
          </div>
          <p className={styles.previewCaption}>{result.trackCount}列・カード幅 {formatNumber(result.cardWidth)}px{result.emptyTrackCount > 0 ? `・空きトラック ${result.emptyTrackCount}` : ""}</p>
        </section>
      </div>

      <section className={styles.results} aria-labelledby="result-title">
        <p className={styles.sectionTag}>RESULT</p>
        <h2 id="result-title">現在幅の計算結果</h2>
        <dl className={styles.metrics}>
          <Metric label="プレビュー幅" value={`${result.previewWidth}px`} />
          <Metric label="利用可能なグリッド幅" value={`${formatNumber(result.availableWidth)}px`} />
          <Metric label="現在の列数" value={`${result.trackCount}列`} />
          <Metric label="現在のカード幅" value={`${formatNumber(result.cardWidth)}px`} />
          <Metric label="空きトラック数" value={`${result.emptyTrackCount}`} />
          <Metric label="最大グリッド幅" value={`${result.maximumGridWidth}px`} />
        </dl>
        <div className={styles.modeExplanation}>
          <strong>{settings.mode}</strong>
          <p>{settings.mode === "auto-fit" ? "空きトラックを折りたたみます。カード数が少ない場合は、カードが残り幅まで広がります。" : "配置可能なトラックを維持します。カード数が少ない場合は空きトラックと、見た目上の空き領域が残ることがあります。"}</p>
        </div>
        <p className={cardBelowMinimum ? styles.warning : styles.noteText}>
          {cardBelowMinimum ? "! 外枠幅から左右余白を引いた幅がカードの最小幅を下回るため、横スクロールを避ける目的でカード幅も最小幅を下回ります。" : "カード幅は設定した最小幅以上です。親要素が外枠幅より狭い場合は、実際の親要素幅に依存します。"}
        </p>
      </section>

      <section className={styles.breakpoints} aria-labelledby="breakpoints-title">
        <div><p className={styles.sectionTag}>BREAKPOINTS</p><h2 id="breakpoints-title">列数が切り替わる外枠幅</h2></div>
        <p className={styles.noteText}>現在適用中の{settings.mode}・カード{settings.cardCount}枚の設定で、実際に到達する列数を表示しています。</p>
        {breakpoints.length > 0 ? (
          <div className={styles.tableWrap}><table><thead><tr><th scope="col">列数</th><th scope="col">必要な内容幅</th><th scope="col">左右余白を含む目安</th></tr></thead><tbody>{breakpoints.map((point) => <tr key={point.columns}><th scope="row">{point.columns}列</th><td>{point.requiredGridWidth}px</td><td>{point.requiredOuterWidth}px</td></tr>)}</tbody></table></div>
        ) : <p className={styles.noBreakpoints}>現在の設定では列数の切り替わりはありません。</p>}
        <p className={styles.noteText}>ページ全体を利用できる場合の目安です。親要素が狭い場合は、親要素の幅に依存します。</p>
      </section>

      <section className={styles.codeSection} aria-labelledby="code-title">
        <p className={styles.sectionTag}>IMPLEMENTATION</p><h2 id="code-title">実装用HTML・CSS</h2>
        <div className={styles.codeGrid}>
          <CodePanel code={htmlCode} description="現在のカード数を反映した最小構成です。実案件では用途に応じて要素や内容を変更してください。" label="HTML" onCopy={() => copyCode(htmlCode, "HTML")} />
          <CodePanel code={cssCode} description="最大列数をmax-widthで制限し、狭い画面ではカードをコンテナ内へ収めます。" label="CSS" onCopy={() => copyCode(cssCode, "CSS")} />
        </div>
      </section>

      <p className={styles.liveRegion} aria-atomic="true" aria-live="polite">{announcement}</p>
    </>
  );
}

function NumberField({ error, field, inputRef, onChange, value }: { error?: string; field: NumericFieldName; inputRef: RefObject<HTMLInputElement | null>; onChange: (value: string) => void; value: string }) {
  const definition = FIELD_DEFINITIONS[field];
  const id = `grid-${field}`;
  const hintId = `${id}-hint`;
  const errorId = `${id}-error`;
  const hasUnit = field === "minimumCardWidth" || field === "gap" || field === "horizontalGutter";
  return <div className={styles.field}><label htmlFor={id}>{definition.label}</label><div className={styles.inputWithUnit}><input aria-describedby={error ? `${hintId} ${errorId}` : hintId} aria-invalid={error ? "true" : undefined} id={id} inputMode="numeric" onChange={(event) => onChange(event.target.value)} ref={inputRef} type="text" value={value} />{hasUnit ? <span aria-hidden="true">px</span> : null}</div><p className={styles.fieldHint} id={hintId}>{definition.minimum}〜{definition.maximum}{hasUnit ? "px" : ""}の整数</p><p className={styles.error} id={errorId}>{error ? `! ${error}` : ""}</p></div>;
}

function Metric({ label, value }: { label: string; value: string }) {
  return <div><dt>{label}</dt><dd>{value}</dd></div>;
}

function CodePanel({ code, description, label, onCopy }: { code: string; description: string; label: "HTML" | "CSS"; onCopy: () => void }) {
  return <article className={styles.codePanel}><div className={styles.codeHeading}><h3>{label}</h3><button onClick={onCopy} type="button">{label}をコピー</button></div><p>{description}</p><pre tabIndex={0}><code>{code}</code></pre><div className={styles.copyStatus} aria-hidden="true">コピー結果は画面下部で通知されます</div></article>;
}
