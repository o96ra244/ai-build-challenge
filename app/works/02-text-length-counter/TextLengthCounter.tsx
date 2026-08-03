"use client";

import { useMemo, useRef, useState } from "react";

import { analyzeText } from "./text-metrics";
import styles from "./page.module.css";

const numberFormatter = new Intl.NumberFormat("ja-JP");

export function TextLengthCounter() {
  const [text, setText] = useState("");
  const [announcement, setAnnouncement] = useState("");
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const metrics = useMemo(() => analyzeText(text), [text]);

  function clearInput() {
    setText("");
    setAnnouncement("入力をクリアしました");
    textareaRef.current?.focus();
  }

  return (
    <div className={styles.counterGrid}>
      <section className={styles.inputPanel} aria-labelledby="input-title">
        <h2 id="input-title">文章を入力</h2>
        <label className={styles.label} htmlFor="text-input">
          文章
        </label>
        <p className={styles.inputDescription} id="text-input-description">
          入力内容はブラウザ内だけで処理され、保存や外部送信は行われません。
        </p>
        <textarea
          aria-describedby="text-input-description"
          className={styles.textarea}
          id="text-input"
          onChange={(event) => {
            setText(event.target.value);
            setAnnouncement("");
          }}
          placeholder="ここに文章を入力してください"
          ref={textareaRef}
          value={text}
        />
        <button
          className={styles.clearButton}
          disabled={text === ""}
          onClick={clearInput}
          type="button"
        >
          入力をクリア
        </button>
        <p className={styles.visuallyHidden} aria-live="polite" aria-atomic="true">
          {announcement}
        </p>
      </section>

      <section className={styles.resultPanel} aria-labelledby="result-title">
        <p className={styles.resultEyebrow}>RESULT</p>
        <h2 id="result-title">文章のボリューム</h2>
        <dl className={styles.metrics}>
          <Metric label="空白込み" value={numberFormatter.format(metrics.charactersWithWhitespace)} unit="文字" />
          <Metric label="空白を除く" value={numberFormatter.format(metrics.charactersWithoutWhitespace)} unit="文字" />
          <Metric label="行数" value={numberFormatter.format(metrics.lines)} unit="行" />
          <Metric label="読了時間" value={metrics.readingTime} />
        </dl>
      </section>
    </div>
  );
}

type MetricProps = {
  label: string;
  value: string;
  unit?: string;
};

function Metric({ label, value, unit }: MetricProps) {
  return (
    <div className={styles.metric}>
      <dt>{label}</dt>
      <dd>
        <span className={styles.metricValue}>{value}</span>
        {unit ? <span className={styles.metricUnit}>{unit}</span> : null}
      </dd>
    </div>
  );
}
