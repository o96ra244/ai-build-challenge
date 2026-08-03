"use client";

import { FormEvent, useRef, useState } from "react";

import {
  calculateResizedDimensions,
  Dimensions,
  formatAspectRatio,
  formatAspectRatioCss,
  formatSize,
  ResizeBasis,
  simplifyAspectRatio,
  validatePixelValue,
} from "./aspect-ratio";
import styles from "./page.module.css";

type FieldName = "originalWidth" | "originalHeight" | "targetValue";
type FieldErrors = Partial<Record<FieldName, string>>;

const initialDimensions = { width: 1280, height: 720 };
const initialRatio = { width: 16, height: 9 };

export function AspectRatioCalculator() {
  const [originalWidth, setOriginalWidth] = useState("1920");
  const [originalHeight, setOriginalHeight] = useState("1080");
  const [basis, setBasis] = useState<ResizeBasis>("width");
  const [targetValue, setTargetValue] = useState("1280");
  const [result, setResult] = useState<Dimensions | null>(initialDimensions);
  const [ratio, setRatio] = useState<Dimensions | null>(initialRatio);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [announcement, setAnnouncement] = useState("");

  const originalWidthRef = useRef<HTMLInputElement>(null);
  const originalHeightRef = useRef<HTMLInputElement>(null);
  const targetValueRef = useRef<HTMLInputElement>(null);

  const targetLabel = basis === "width" ? "変更後の幅" : "変更後の高さ";

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const validations = {
      originalWidth: validatePixelValue(originalWidth, "元の幅"),
      originalHeight: validatePixelValue(originalHeight, "元の高さ"),
      targetValue: validatePixelValue(targetValue, targetLabel),
    };
    const nextErrors: FieldErrors = {};

    for (const field of Object.keys(validations) as FieldName[]) {
      const validation = validations[field];
      if (!validation.valid) {
        nextErrors[field] = validation.error;
      }
    }

    setErrors(nextErrors);
    setAnnouncement("");

    const firstInvalidField = (Object.keys(validations) as FieldName[]).find(
      (field) => !validations[field].valid,
    );

    if (firstInvalidField) {
      setResult(null);
      setRatio(null);
      const refs = {
        originalWidth: originalWidthRef,
        originalHeight: originalHeightRef,
        targetValue: targetValueRef,
      };
      refs[firstInvalidField].current?.focus();
      return;
    }

    const widthValidation = validations.originalWidth;
    const heightValidation = validations.originalHeight;
    const targetValidation = validations.targetValue;

    if (!widthValidation.valid || !heightValidation.valid || !targetValidation.valid) {
      return;
    }

    const original = {
      width: widthValidation.value,
      height: heightValidation.value,
    };
    const nextResult = calculateResizedDimensions(original, basis, targetValidation.value);

    setResult(nextResult);
    setRatio(simplifyAspectRatio(original));
    setAnnouncement(`計算結果を更新しました。${formatSize(nextResult)}です。`);
  }

  async function copyValue(value: string, label: "サイズ" | "CSS") {
    try {
      await navigator.clipboard.writeText(value);
      setAnnouncement(`${label}をコピーしました`);
    } catch {
      setAnnouncement("コピーできませんでした。値を選択してコピーしてください。");
    }
  }

  return (
    <div className={styles.calculatorGrid}>
      <section className={styles.panel} aria-labelledby="input-title">
        <h2 id="input-title">サイズを入力</h2>
        <form className={styles.form} noValidate onSubmit={handleSubmit}>
          <div className={styles.originalSize}>
            <NumberField
              error={errors.originalWidth}
              id="original-width"
              inputRef={originalWidthRef}
              label="元の幅"
              onChange={setOriginalWidth}
              value={originalWidth}
            />
            <NumberField
              error={errors.originalHeight}
              id="original-height"
              inputRef={originalHeightRef}
              label="元の高さ"
              onChange={setOriginalHeight}
              value={originalHeight}
            />
          </div>

          <fieldset className={styles.fieldset}>
            <legend>変更基準</legend>
            <div className={styles.radioGroup}>
              <label>
                <input
                  checked={basis === "width"}
                  name="basis"
                  onChange={() => setBasis("width")}
                  type="radio"
                  value="width"
                />
                <span>幅を指定</span>
              </label>
              <label>
                <input
                  checked={basis === "height"}
                  name="basis"
                  onChange={() => setBasis("height")}
                  type="radio"
                  value="height"
                />
                <span>高さを指定</span>
              </label>
            </div>
          </fieldset>

          <NumberField
            error={errors.targetValue}
            id="target-value"
            inputRef={targetValueRef}
            label={targetLabel}
            onChange={setTargetValue}
            value={targetValue}
          />

          <button className={styles.calculateButton} type="submit">
            リサイズ後のサイズを計算
          </button>
        </form>
      </section>

      <section className={`${styles.panel} ${styles.resultPanel}`} aria-labelledby="result-title">
        <p className={styles.resultEyebrow}>RESULT</p>
        <h2 id="result-title">計算結果</h2>
        {result && ratio ? (
          <div className={styles.resultContent}>
            <div>
              <p className={styles.resultLabel}>リサイズ後</p>
              <p className={styles.resultSize}>{formatSize(result)}</p>
            </div>
            <dl className={styles.resultList}>
              <div>
                <dt>縦横比</dt>
                <dd>{formatAspectRatio(ratio)}</dd>
              </div>
              <div>
                <dt>CSS</dt>
                <dd>
                  <code>{formatAspectRatioCss(ratio)}</code>
                </dd>
              </div>
            </dl>
            <div className={styles.copyActions}>
              <button type="button" onClick={() => copyValue(formatSize(result), "サイズ")}>
                サイズをコピー
              </button>
              <button
                type="button"
                onClick={() => copyValue(formatAspectRatioCss(ratio), "CSS")}
              >
                CSSをコピー
              </button>
            </div>
          </div>
        ) : (
          <div className={styles.invalidResult} role="status">
            <p>入力内容を確認してください</p>
            <span>有効な値を入力して、もう一度計算してください。</span>
          </div>
        )}
        <p className={styles.liveRegion} aria-live="polite" aria-atomic="true">
          {announcement}
        </p>
      </section>
    </div>
  );
}

type NumberFieldProps = {
  error?: string;
  id: string;
  inputRef: React.RefObject<HTMLInputElement | null>;
  label: string;
  onChange: (value: string) => void;
  value: string;
};

function NumberField({ error, id, inputRef, label, onChange, value }: NumberFieldProps) {
  const errorId = `${id}-error`;

  return (
    <div className={styles.field}>
      <label htmlFor={id}>{label}</label>
      <div className={styles.inputWithUnit}>
        <input
          aria-describedby={error ? errorId : undefined}
          aria-invalid={error ? "true" : undefined}
          id={id}
          inputMode="numeric"
          max="100000"
          min="1"
          onChange={(event) => onChange(event.target.value)}
          ref={inputRef}
          step="1"
          type="number"
          value={value}
        />
        <span aria-hidden="true">px</span>
      </div>
      {error ? (
        <p className={styles.error} id={errorId}>
          <span aria-hidden="true">!</span> {error}
        </p>
      ) : null}
    </div>
  );
}
