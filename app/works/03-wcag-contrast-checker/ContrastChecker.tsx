"use client";

import { FormEvent, useRef, useState } from "react";

import {
  formatContrastRatio,
  getContrastCriteria,
  getContrastRatio,
  normalizeHex,
} from "./contrast";
import styles from "./page.module.css";

type FieldName = "foreground" | "background";
type FieldErrors = Partial<Record<FieldName, string>>;
type Result = { foreground: string; background: string; ratio: number };

const INITIAL_FOREGROUND = "#2563EB";
const INITIAL_BACKGROUND = "#FFFFFF";
const INITIAL_RESULT: Result = {
  foreground: INITIAL_FOREGROUND,
  background: INITIAL_BACKGROUND,
  ratio: getContrastRatio(INITIAL_FOREGROUND, INITIAL_BACKGROUND),
};

export function ContrastChecker() {
  const [foreground, setForeground] = useState(INITIAL_FOREGROUND);
  const [background, setBackground] = useState(INITIAL_BACKGROUND);
  const [result, setResult] = useState<Result | null>(INITIAL_RESULT);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [announcement, setAnnouncement] = useState("");
  const foregroundRef = useRef<HTMLInputElement>(null);
  const backgroundRef = useRef<HTMLInputElement>(null);

  function calculate(nextForeground: string, nextBackground: string, announce = true): boolean {
    const foregroundValidation = normalizeHex(nextForeground, "前景色");
    const backgroundValidation = normalizeHex(nextBackground, "背景色");
    const nextErrors: FieldErrors = {};

    if (!foregroundValidation.valid) nextErrors.foreground = foregroundValidation.error;
    if (!backgroundValidation.valid) nextErrors.background = backgroundValidation.error;

    setErrors(nextErrors);
    setAnnouncement("");

    if (!foregroundValidation.valid || !backgroundValidation.valid) {
      setResult(null);
      if (!foregroundValidation.valid) foregroundRef.current?.focus();
      else backgroundRef.current?.focus();
      return false;
    }

    const ratio = getContrastRatio(foregroundValidation.value, backgroundValidation.value);
    const criteria = getContrastCriteria(ratio);
    const passedCount = criteria.filter((criterion) => criterion.passed).length;

    setForeground(foregroundValidation.value);
    setBackground(backgroundValidation.value);
    setResult({
      foreground: foregroundValidation.value,
      background: backgroundValidation.value,
      ratio,
    });
    if (announce) {
      setAnnouncement(
        `コントラスト比は${formatContrastRatio(ratio)}対1です。5項目中${passedCount}項目に合格しました。`,
      );
    }
    return true;
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    calculate(foreground, background);
  }

  function changeText(field: FieldName, value: string) {
    if (field === "foreground") setForeground(value);
    else setBackground(value);
    setErrors((current) => ({ ...current, [field]: undefined }));
    setAnnouncement("");
    setResult(null);
  }

  function changeColor(field: FieldName, value: string) {
    const normalized = value.toUpperCase();
    const nextForeground = field === "foreground" ? normalized : foreground;
    const nextBackground = field === "background" ? normalized : background;
    setForeground(nextForeground);
    setBackground(nextBackground);
    calculate(nextForeground, nextBackground);
  }

  function swapColors() {
    setForeground(background);
    setBackground(foreground);
    calculate(background, foreground);
  }

  const criteria = result ? getContrastCriteria(result.ratio) : [];

  return (
    <div className={styles.toolGrid}>
      <section className={styles.inputPanel} aria-labelledby="input-title">
        <h2 id="input-title">2色を入力</h2>
        <form className={styles.form} noValidate onSubmit={handleSubmit}>
          <fieldset className={styles.fieldset}>
            <legend>コントラストを確認する色</legend>
            <p className={styles.formatNote}>#RGBまたは#RRGGBB形式（例: #2563EB）</p>
            <ColorField
              error={errors.foreground}
              id="foreground"
              label="前景色（文字色）"
              onColorChange={(value) => changeColor("foreground", value)}
              onTextChange={(value) => changeText("foreground", value)}
              inputRef={foregroundRef}
              value={foreground}
            />
            <ColorField
              error={errors.background}
              id="background"
              label="背景色"
              onColorChange={(value) => changeColor("background", value)}
              onTextChange={(value) => changeText("background", value)}
              inputRef={backgroundRef}
              value={background}
            />
          </fieldset>
          <div className={styles.actions}>
            <button className={styles.primaryButton} type="submit">
              コントラストを確認
            </button>
            <button className={styles.secondaryButton} onClick={swapColors} type="button">
              前景色と背景色を入れ替える
            </button>
          </div>
        </form>
      </section>

      <div className={styles.outputColumn}>
        <section className={styles.resultPanel} aria-labelledby="result-title">
          <p className={styles.resultEyebrow}>RESULT</p>
          <h2 id="result-title">WCAG 2.2 適合目安</h2>
          {result ? (
            <>
              <p className={styles.ratio}>
                <strong>{formatContrastRatio(result.ratio)}</strong>
                <span> : 1</span>
              </p>
              <ul className={styles.criteriaList}>
                {criteria.map((criterion) => (
                  <li key={criterion.id}>
                    <div>
                      <strong>{criterion.label}</strong>
                      <span>必要 {criterion.requiredRatio}:1 以上</span>
                    </div>
                    <span className={criterion.passed ? styles.pass : styles.fail}>
                      {criterion.passed ? "✓ 合格" : "× 不合格"}
                    </span>
                  </li>
                ))}
              </ul>
              <p className={styles.largeTextNote}>
                大きな文字の目安は、通常ウェイトで約24px以上、太字で約18.5px以上です。
              </p>
            </>
          ) : (
            <div className={styles.invalidResult} role="status">
              <strong>入力内容を確認してください</strong>
              <span>有効な2色を入力すると、比率と判定を表示します。</span>
            </div>
          )}
        </section>

        <section className={styles.previewSection} aria-labelledby="preview-title">
          <h2 id="preview-title">配色プレビュー</h2>
          {result ? (
            <div
              className={styles.preview}
              style={{ color: result.foreground, backgroundColor: result.background }}
            >
              <p className={styles.previewHeading}>大きな文字の見出し例</p>
              <p>通常サイズの本文です。実際の配色で読みやすさを視覚的に確認できます。</p>
              <span className={styles.previewControl}>UI部品の境界例</span>
            </div>
          ) : (
            <div className={styles.previewPlaceholder}>有効な色を入力するとプレビューを表示します。</div>
          )}
        </section>
      </div>

      <p className={styles.visuallyHidden} aria-live="polite" aria-atomic="true">
        {announcement}
      </p>
    </div>
  );
}

type ColorFieldProps = {
  error?: string;
  id: string;
  inputRef: React.RefObject<HTMLInputElement | null>;
  label: string;
  onColorChange: (value: string) => void;
  onTextChange: (value: string) => void;
  value: string;
};

function ColorField({ error, id, inputRef, label, onColorChange, onTextChange, value }: ColorFieldProps) {
  const descriptionId = `${id}-description`;
  const errorId = `${id}-error`;
  const validation = normalizeHex(value);
  const colorValue = validation.valid ? validation.value : "#000000";

  return (
    <div className={styles.field}>
      <label htmlFor={`${id}-text`}>{label}</label>
      <div className={styles.colorInputRow}>
        <input
          aria-describedby={`${descriptionId}${error ? ` ${errorId}` : ""}`}
          aria-invalid={error ? "true" : undefined}
          id={`${id}-text`}
          onChange={(event) => onTextChange(event.target.value)}
          ref={inputRef}
          spellCheck="false"
          type="text"
          value={value}
        />
        <label className={styles.colorPickerLabel} htmlFor={`${id}-picker`}>
          <span>{label}を選択</span>
          <input
            aria-label={`${label}をカラーピッカーで選択`}
            id={`${id}-picker`}
            onChange={(event) => onColorChange(event.target.value)}
            type="color"
            value={colorValue}
          />
        </label>
      </div>
      <p className={styles.fieldDescription} id={descriptionId}>3桁または6桁のHEX色を入力してください。</p>
      <p className={styles.error} id={errorId}>{error ? `! ${error}` : ""}</p>
    </div>
  );
}
