"use client";

import { ChangeEvent, useCallback, useEffect, useRef, useState } from "react";

import {
  calculateProgress,
  createEndTime,
  formatRemainingTime,
  getNextPhase,
  getRemainingMilliseconds,
  minutesToMilliseconds,
  Phase,
  validateMinutes,
} from "./timer";
import styles from "./page.module.css";

type TimerStatus = "idle" | "running" | "paused";
type FieldName = "work" | "break";
type FieldErrors = Partial<Record<FieldName, string>>;

const INITIAL_WORK_MINUTES = "25";
const INITIAL_BREAK_MINUTES = "5";
const UPDATE_INTERVAL_MS = 250;

const PHASE_LABELS: Record<Phase, string> = {
  work: "作業",
  break: "休憩",
};

const STATUS_LABELS: Record<TimerStatus, string> = {
  idle: "停止中",
  running: "実行中",
  paused: "一時停止中",
};

export function PomodoroTimer() {
  const [phase, setPhase] = useState<Phase>("work");
  const [status, setStatus] = useState<TimerStatus>("idle");
  const [workMinutes, setWorkMinutes] = useState(INITIAL_WORK_MINUTES);
  const [breakMinutes, setBreakMinutes] = useState(INITIAL_BREAK_MINUTES);
  const [remainingMilliseconds, setRemainingMilliseconds] = useState(
    minutesToMilliseconds(Number(INITIAL_WORK_MINUTES)),
  );
  const [totalMilliseconds, setTotalMilliseconds] = useState(
    minutesToMilliseconds(Number(INITIAL_WORK_MINUTES)),
  );
  const [endTime, setEndTime] = useState<number | null>(null);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [announcement, setAnnouncement] = useState("");

  const workInputRef = useRef<HTMLInputElement>(null);
  const breakInputRef = useRef<HTMLInputElement>(null);
  const completionHandledRef = useRef(false);
  const originalTitleRef = useRef<string | null>(null);

  const formattedRemaining = formatRemainingTime(remainingMilliseconds);
  const progress = calculateProgress(totalMilliseconds, remainingMilliseconds);
  const phaseLabel = PHASE_LABELS[phase];
  const settingsDisabled = status !== "idle";

  const getValidatedSettings = useCallback(() => {
    const workValidation = validateMinutes(workMinutes, "作業時間", 120);
    const breakValidation = validateMinutes(breakMinutes, "休憩時間", 60);
    const nextErrors: FieldErrors = {};

    if (!workValidation.valid) nextErrors.work = workValidation.error;
    if (!breakValidation.valid) nextErrors.break = breakValidation.error;

    setErrors(nextErrors);

    if (!workValidation.valid) {
      workInputRef.current?.focus();
      setAnnouncement(`入力エラー。${workValidation.error}`);
      return null;
    }

    if (!breakValidation.valid) {
      breakInputRef.current?.focus();
      setAnnouncement(`入力エラー。${breakValidation.error}`);
      return null;
    }

    return { work: workValidation.value, break: breakValidation.value };
  }, [breakMinutes, workMinutes]);

  const finishCurrentPhase = useCallback(() => {
    if (completionHandledRef.current) return;

    completionHandledRef.current = true;
    const nextPhase = getNextPhase(phase);
    const nextRawMinutes = nextPhase === "work" ? workMinutes : breakMinutes;
    const nextMaximum = nextPhase === "work" ? 120 : 60;
    const nextValidation = validateMinutes(
      nextRawMinutes,
      `${PHASE_LABELS[nextPhase]}時間`,
      nextMaximum,
    );
    const nextDuration = minutesToMilliseconds(nextValidation.valid ? nextValidation.value : 1);

    setPhase(nextPhase);
    setStatus("idle");
    setEndTime(null);
    setRemainingMilliseconds(nextDuration);
    setTotalMilliseconds(nextDuration);
    setAnnouncement(
      phase === "work"
        ? "作業時間が終了しました。休憩を開始できます。"
        : "休憩時間が終了しました。作業を開始できます。",
    );
  }, [breakMinutes, phase, workMinutes]);

  const updateFromCurrentTime = useCallback(() => {
    if (endTime === null || completionHandledRef.current) return;

    const nextRemaining = getRemainingMilliseconds(endTime, Date.now());
    setRemainingMilliseconds(nextRemaining);

    if (nextRemaining === 0) finishCurrentPhase();
  }, [endTime, finishCurrentPhase]);

  useEffect(() => {
    if (status !== "running" || endTime === null) return;

    updateFromCurrentTime();
    const intervalId = window.setInterval(updateFromCurrentTime, UPDATE_INTERVAL_MS);

    function handleVisibilityChange() {
      if (document.visibilityState === "visible") updateFromCurrentTime();
    }

    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      window.clearInterval(intervalId);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [endTime, status, updateFromCurrentTime]);

  useEffect(() => {
    if (originalTitleRef.current === null) originalTitleRef.current = document.title;
    const originalTitle = originalTitleRef.current;

    if (status === "running") {
      document.title = `${formattedRemaining} | ${phaseLabel} | ポモドーロ・ミニ`;
    } else {
      document.title = originalTitle;
    }

    return () => {
      document.title = originalTitle;
    };
  }, [formattedRemaining, phaseLabel, status]);

  function handlePrimaryAction() {
    if (status === "running") {
      if (endTime === null) return;
      const nextRemaining = getRemainingMilliseconds(endTime, Date.now());

      if (nextRemaining === 0) {
        setRemainingMilliseconds(0);
        finishCurrentPhase();
        return;
      }

      setRemainingMilliseconds(nextRemaining);
      setEndTime(null);
      setStatus("paused");
      setAnnouncement(`タイマーを一時停止しました。残り${formatRemainingTime(nextRemaining)}です。`);
      return;
    }

    if (status === "paused") {
      completionHandledRef.current = false;
      setEndTime(createEndTime(Date.now(), remainingMilliseconds));
      setStatus("running");
      setAnnouncement("タイマーを再開しました。");
      return;
    }

    const settings = getValidatedSettings();
    if (!settings) return;

    const duration = minutesToMilliseconds(settings[phase]);
    completionHandledRef.current = false;
    setRemainingMilliseconds(duration);
    setTotalMilliseconds(duration);
    setEndTime(createEndTime(Date.now(), duration));
    setStatus("running");
    setAnnouncement(`${phaseLabel}タイマーを開始しました。`);
  }

  function handleReset() {
    const rawValue = phase === "work" ? workMinutes : breakMinutes;
    const maximum = phase === "work" ? 120 : 60;
    const validation = validateMinutes(rawValue, `${phaseLabel}時間`, maximum);

    if (!validation.valid) {
      setErrors((current) => ({ ...current, [phase]: validation.error }));
      (phase === "work" ? workInputRef : breakInputRef).current?.focus();
      setAnnouncement(`入力エラー。${validation.error}`);
      return;
    }

    const duration = minutesToMilliseconds(validation.value);
    completionHandledRef.current = false;
    setStatus("idle");
    setEndTime(null);
    setRemainingMilliseconds(duration);
    setTotalMilliseconds(duration);
    setAnnouncement(`${phaseLabel}タイマーをリセットしました。`);
  }

  function handlePhaseSwitch() {
    const nextPhase = getNextPhase(phase);
    const rawValue = nextPhase === "work" ? workMinutes : breakMinutes;
    const maximum = nextPhase === "work" ? 120 : 60;
    const validation = validateMinutes(rawValue, `${PHASE_LABELS[nextPhase]}時間`, maximum);

    if (!validation.valid) {
      setStatus("idle");
      setEndTime(null);
      setErrors((current) => ({ ...current, [nextPhase]: validation.error }));
      (nextPhase === "work" ? workInputRef : breakInputRef).current?.focus();
      setAnnouncement(`入力エラー。${validation.error}`);
      return;
    }

    const duration = minutesToMilliseconds(validation.value);
    completionHandledRef.current = false;
    setPhase(nextPhase);
    setStatus("idle");
    setEndTime(null);
    setRemainingMilliseconds(duration);
    setTotalMilliseconds(duration);
    setAnnouncement(`${PHASE_LABELS[nextPhase]}に切り替えました。タイマーは停止中です。`);
  }

  function handleSettingChange(field: FieldName, event: ChangeEvent<HTMLInputElement>) {
    const value = event.target.value;
    const maximum = field === "work" ? 120 : 60;
    const label = field === "work" ? "作業時間" : "休憩時間";
    const validation = validateMinutes(value, label, maximum);

    if (field === "work") setWorkMinutes(value);
    else setBreakMinutes(value);

    if (errors[field]) {
      setErrors((current) => {
        const nextErrors = { ...current };
        if (validation.valid) delete nextErrors[field];
        else nextErrors[field] = validation.error;
        return nextErrors;
      });
    }

    if (status === "idle" && phase === field && validation.valid) {
      const duration = minutesToMilliseconds(validation.value);
      setRemainingMilliseconds(duration);
      setTotalMilliseconds(duration);
    }
  }

  const primaryButtonLabel =
    status === "running"
      ? "一時停止"
      : status === "paused"
        ? "タイマーを再開"
        : "タイマーを開始";

  return (
    <section className={styles.timerPanel} aria-labelledby="timer-title">
      <div className={styles.timerHeader}>
        <div>
          <p className={styles.phaseLabel}>現在のフェーズ</p>
          <h2 id="timer-title">{phaseLabel}</h2>
        </div>
        <p className={styles.statusBadge}>{STATUS_LABELS[status]}</p>
      </div>

      <div className={styles.timerDisplay}>
        <p className={styles.remainingLabel}>残り時間</p>
        <p className={styles.remainingTime} aria-label={`残り時間 ${formattedRemaining}`}>
          {formattedRemaining}
        </p>
        <div
          aria-label={`${phaseLabel}タイマーの進捗`}
          aria-valuemax={100}
          aria-valuemin={0}
          aria-valuenow={Math.round(progress)}
          aria-valuetext={`${Math.round(progress)}パーセント完了`}
          className={styles.progressTrack}
          role="progressbar"
        >
          <span className={styles.progressBar} style={{ width: `${progress}%` }} />
        </div>
      </div>

      <fieldset className={styles.settings} disabled={settingsDisabled}>
        <legend>時間設定</legend>
        <p className={styles.settingsNote}>
          1分単位の整数で設定します。設定はタイマーが停止中のときだけ変更できます。
        </p>
        {settingsDisabled ? (
          <p className={styles.disabledReason}>変更するには、現在のタイマーをリセットしてください。</p>
        ) : (
          <p className={styles.disabledReason} aria-hidden="true">&nbsp;</p>
        )}
        <div className={styles.fieldGrid}>
          <MinuteField
            description="1〜120の整数"
            error={errors.work}
            id="work-minutes"
            inputRef={workInputRef}
            label="作業時間"
            max={120}
            onChange={(event) => handleSettingChange("work", event)}
            value={workMinutes}
          />
          <MinuteField
            description="1〜60の整数"
            error={errors.break}
            id="break-minutes"
            inputRef={breakInputRef}
            label="休憩時間"
            max={60}
            onChange={(event) => handleSettingChange("break", event)}
            value={breakMinutes}
          />
        </div>
      </fieldset>

      <div className={styles.actions}>
        <button className={styles.primaryButton} onClick={handlePrimaryAction} type="button">
          {primaryButtonLabel}
        </button>
        <button className={styles.secondaryButton} onClick={handleReset} type="button">
          リセット
        </button>
        <button className={styles.secondaryButton} onClick={handlePhaseSwitch} type="button">
          {phase === "work" ? "休憩に切り替える" : "作業に切り替える"}
        </button>
      </div>

      <p className={styles.stateDescription}>
        {status === "idle"
          ? `${phaseLabel}タイマーは停止中です。時間を設定して開始できます。`
          : status === "paused"
            ? `${phaseLabel}タイマーは一時停止中です。再開またはリセットできます。`
            : `${phaseLabel}タイマーを実行しています。設定を変えるにはリセットしてください。`}
      </p>
      <p className={styles.visuallyHidden} aria-atomic="true" aria-live="polite">
        {announcement}
      </p>
    </section>
  );
}
type MinuteFieldProps = {
  description: string;
  error?: string;
  id: string;
  inputRef: React.RefObject<HTMLInputElement | null>;
  label: string;
  max: number;
  onChange: (event: ChangeEvent<HTMLInputElement>) => void;
  value: string;
};

function MinuteField({
  description,
  error,
  id,
  inputRef,
  label,
  max,
  onChange,
  value,
}: MinuteFieldProps) {
  const descriptionId = `${id}-description`;
  const errorId = `${id}-error`;
  const describedBy = error ? `${descriptionId} ${errorId}` : descriptionId;

  return (
    <div className={styles.field}>
      <label htmlFor={id}>{label}</label>
      <div className={styles.inputWithUnit}>
        <input
          aria-describedby={describedBy}
          aria-invalid={error ? "true" : undefined}
          id={id}
          inputMode="numeric"
          maxLength={3}
          onChange={onChange}
          pattern="[0-9]*"
          ref={inputRef}
          type="text"
          value={value}
        />
        <span>分</span>
      </div>
      <p className={styles.fieldDescription} id={descriptionId}>
        {description}（最大{max}分）
      </p>
      <p className={styles.error} id={error ? errorId : undefined}>
        {error ? <><span aria-hidden="true">!</span> {error}</> : null}
      </p>
    </div>
  );
}
