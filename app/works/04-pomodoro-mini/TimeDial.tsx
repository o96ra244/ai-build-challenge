"use client";

import {
  ChangeEvent,
  KeyboardEvent,
  PointerEvent,
  RefObject,
  useEffect,
  useRef,
} from "react";

import {
  accumulateDialDelta,
  DialDeltaMode,
  dialValueToAngle,
  dialValueToProgress,
  getDialDirection,
  normalizeDialScrollDelta,
  pointerAngleToDialValue,
  resolveDialDelta,
  shouldPassThroughDialScroll,
  stepDialValue,
} from "./timer";
import styles from "./page.module.css";

type TimeDialProps = {
  disabled: boolean;
  error?: string;
  id: string;
  inputRef: RefObject<HTMLInputElement | null>;
  label: string;
  maximum: number;
  minimum: number;
  onInputChange: (event: ChangeEvent<HTMLInputElement>) => void;
  onValueChange: (value: number) => void;
  rawValue: string;
  value: number;
  variant: "work" | "break";
};

const CENTER = 130;
const INDICATOR_RADIUS = 101;
const WHEEL_IDLE_RESET_MS = 180;
const WHEEL_BURST_GUARD_MS = 64;
const TICK_COUNT = 31;

type TouchGesture = {
  accumulator: number;
  identifier: number;
  lastY: number;
  mode: "pending" | "dial" | "page";
};

const ticks = Array.from({ length: TICK_COUNT }, (_, index) => {
  const angle = 135 + (270 * index) / (TICK_COUNT - 1);
  const radians = (angle * Math.PI) / 180;
  const isMajor = index % 5 === 0;
  const innerRadius = isMajor ? 105 : 109;
  const outerRadius = 116;

  return {
    x1: CENTER + Math.cos(radians) * innerRadius,
    y1: CENTER + Math.sin(radians) * innerRadius,
    x2: CENTER + Math.cos(radians) * outerRadius,
    y2: CENTER + Math.sin(radians) * outerRadius,
    isMajor,
  };
});

export function TimeDial({
  disabled,
  error,
  id,
  inputRef,
  label,
  maximum,
  minimum,
  onInputChange,
  onValueChange,
  rawValue,
  value,
  variant,
}: TimeDialProps) {
  const dialControlRef = useRef<HTMLDivElement>(null);
  const activePointerIdRef = useRef<number | null>(null);
  const wheelAccumulatorRef = useRef(0);
  const wheelResetTimerRef = useRef<number | null>(null);
  const lastWheelStepAtRef = useRef(0);
  const touchGestureRef = useRef<TouchGesture | null>(null);
  const valueRef = useRef(value);
  const disabledRef = useRef(disabled);
  const onValueChangeRef = useRef(onValueChange);
  const progress = dialValueToProgress(value, minimum, maximum);
  const indicatorAngle = dialValueToAngle(value, minimum, maximum);
  const indicatorRadians = (indicatorAngle * Math.PI) / 180;
  const indicatorX = CENTER + Math.cos(indicatorRadians) * INDICATOR_RADIUS;
  const indicatorY = CENTER + Math.sin(indicatorRadians) * INDICATOR_RADIUS;
  const descriptionId = `${id}-description`;
  const errorId = `${id}-error`;
  const describedBy = error ? `${descriptionId} ${errorId}` : descriptionId;

  useEffect(() => {
    valueRef.current = value;
    disabledRef.current = disabled;
    onValueChangeRef.current = onValueChange;
  }, [disabled, onValueChange, value]);

  useEffect(() => {
    const element = dialControlRef.current;
    if (!element) return;
    const dialElement = element;

    function updateValue(direction: -1 | 1) {
      const nextValue = stepDialValue(valueRef.current, direction, minimum, maximum);
      valueRef.current = nextValue;
      onValueChangeRef.current(nextValue);
    }

    function resetWheelAccumulatorAfterIdle() {
      if (wheelResetTimerRef.current !== null) {
        window.clearTimeout(wheelResetTimerRef.current);
      }
      wheelResetTimerRef.current = window.setTimeout(() => {
        wheelAccumulatorRef.current = 0;
        lastWheelStepAtRef.current = 0;
        wheelResetTimerRef.current = null;
      }, WHEEL_IDLE_RESET_MS);
    }

    function handleNativeWheel(event: globalThis.WheelEvent) {
      if (disabledRef.current) {
        wheelAccumulatorRef.current = 0;
        lastWheelStepAtRef.current = 0;
        return;
      }

      const delta = normalizeDialScrollDelta(
        event.deltaX,
        event.deltaY,
        event.deltaMode as DialDeltaMode,
        dialElement.clientHeight || window.innerHeight,
      );
      const direction = getDialDirection(delta);
      if (direction === 0) return;

      const result = resolveDialDelta(
        valueRef.current,
        wheelAccumulatorRef.current,
        delta,
        minimum,
        maximum,
      );

      if (result.passThrough) {
        wheelAccumulatorRef.current = 0;
        lastWheelStepAtRef.current = 0;
        if (wheelResetTimerRef.current !== null) {
          window.clearTimeout(wheelResetTimerRef.current);
          wheelResetTimerRef.current = null;
        }
        return;
      }

      event.preventDefault();
      if (document.activeElement !== dialElement) dialElement.focus({ preventScroll: true });
      wheelAccumulatorRef.current = result.accumulator;
      resetWheelAccumulatorAfterIdle();
      if (result.step !== 0) {
        const now = Date.now();
        if (now - lastWheelStepAtRef.current >= WHEEL_BURST_GUARD_MS) {
          lastWheelStepAtRef.current = now;
          updateValue(result.step);
        }
      }
    }

    function handleTouchStart(event: globalThis.TouchEvent) {
      if (disabledRef.current || event.touches.length !== 1) {
        touchGestureRef.current = null;
        return;
      }

      const touch = event.touches.item(0);
      if (!touch) return;
      touchGestureRef.current = {
        accumulator: 0,
        identifier: touch.identifier,
        lastY: touch.clientY,
        mode: "pending",
      };
    }

    function handleTouchMove(event: globalThis.TouchEvent) {
      const gesture = touchGestureRef.current;
      if (!gesture || gesture.mode === "page" || disabledRef.current) return;
      if (event.touches.length !== 1) {
        touchGestureRef.current = null;
        return;
      }

      const touch = event.touches.item(0);
      if (!touch || touch.identifier !== gesture.identifier) return;
      const delta = gesture.lastY - touch.clientY;
      gesture.lastY = touch.clientY;
      const direction = getDialDirection(delta);
      if (direction === 0) return;

      if (gesture.mode === "pending") {
        if (shouldPassThroughDialScroll(valueRef.current, direction, minimum, maximum)) {
          gesture.accumulator = 0;
          gesture.mode = "page";
          return;
        }
        gesture.mode = "dial";
        dialElement.focus({ preventScroll: true });
      }

      event.preventDefault();
      const result = accumulateDialDelta(gesture.accumulator, delta);
      gesture.accumulator = result.accumulator;
      if (result.step !== 0 && canMoveInDirection(result.step)) updateValue(result.step);
    }

    function canMoveInDirection(direction: -1 | 1) {
      return !shouldPassThroughDialScroll(valueRef.current, direction, minimum, maximum);
    }

    function finishTouch(event: globalThis.TouchEvent) {
      const gesture = touchGestureRef.current;
      if (!gesture) return;
      for (let index = 0; index < event.changedTouches.length; index += 1) {
        if (event.changedTouches.item(index)?.identifier === gesture.identifier) {
          touchGestureRef.current = null;
          return;
        }
      }
    }

    dialElement.addEventListener("wheel", handleNativeWheel, { passive: false });
    dialElement.addEventListener("touchstart", handleTouchStart, { passive: true });
    dialElement.addEventListener("touchmove", handleTouchMove, { passive: false });
    dialElement.addEventListener("touchend", finishTouch);
    dialElement.addEventListener("touchcancel", finishTouch);

    return () => {
      dialElement.removeEventListener("wheel", handleNativeWheel);
      dialElement.removeEventListener("touchstart", handleTouchStart);
      dialElement.removeEventListener("touchmove", handleTouchMove);
      dialElement.removeEventListener("touchend", finishTouch);
      dialElement.removeEventListener("touchcancel", finishTouch);
      if (wheelResetTimerRef.current !== null) {
        window.clearTimeout(wheelResetTimerRef.current);
        wheelResetTimerRef.current = null;
      }
      wheelAccumulatorRef.current = 0;
      lastWheelStepAtRef.current = 0;
      touchGestureRef.current = null;
    };
  }, [maximum, minimum]);

  function updateFromPointer(event: PointerEvent<HTMLDivElement>) {
    const bounds = event.currentTarget.getBoundingClientRect();
    const centerX = bounds.left + bounds.width / 2;
    const centerY = bounds.top + bounds.height / 2;
    const angle = (Math.atan2(event.clientY - centerY, event.clientX - centerX) * 180) / Math.PI;
    onValueChange(pointerAngleToDialValue(angle, minimum, maximum));
  }

  function handlePointerDown(event: PointerEvent<HTMLDivElement>) {
    if (disabled || event.pointerType === "touch") return;
    event.currentTarget.focus();
    activePointerIdRef.current = event.pointerId;
    event.currentTarget.setPointerCapture(event.pointerId);
    updateFromPointer(event);
  }

  function handlePointerMove(event: PointerEvent<HTMLDivElement>) {
    if (
      disabled ||
      event.pointerType === "touch" ||
      activePointerIdRef.current !== event.pointerId
    ) return;
    updateFromPointer(event);
  }

  function finishPointerInteraction(event: PointerEvent<HTMLDivElement>) {
    if (event.pointerType === "touch") return;
    if (activePointerIdRef.current !== event.pointerId) return;
    activePointerIdRef.current = null;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
  }

  function handleKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (disabled) return;

    const steps: Partial<Record<string, number>> = {
      ArrowUp: 1,
      ArrowRight: 1,
      ArrowDown: -1,
      ArrowLeft: -1,
      PageUp: 5,
      PageDown: -5,
    };

    if (event.key === "Home") {
      event.preventDefault();
      onValueChange(minimum);
      return;
    }

    if (event.key === "End") {
      event.preventDefault();
      onValueChange(maximum);
      return;
    }

    const step = steps[event.key];
    if (step === undefined) return;
    event.preventDefault();
    onValueChange(stepDialValue(value, step, minimum, maximum));
  }

  return (
    <section className={styles.dialCard} data-disabled={disabled} data-variant={variant}>
      <div className={styles.dialHeading}>
        <div>
          <p className={styles.dialMode}>{variant === "work" ? "FOCUS" : "REST"}</p>
          <h3>{label}</h3>
        </div>
        <span className={styles.rangeLabel}>{minimum}〜{maximum}分</span>
      </div>

      <div
        aria-describedby={descriptionId}
        aria-disabled={disabled}
        aria-label={label}
        aria-valuemax={maximum}
        aria-valuemin={minimum}
        aria-valuenow={value}
        aria-valuetext={`${value}分`}
        className={styles.dialControl}
        onBlur={() => {
          wheelAccumulatorRef.current = 0;
          lastWheelStepAtRef.current = 0;
        }}
        onKeyDown={handleKeyDown}
        onLostPointerCapture={() => {
          activePointerIdRef.current = null;
        }}
        onPointerCancel={finishPointerInteraction}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={finishPointerInteraction}
        ref={dialControlRef}
        role="slider"
        tabIndex={disabled ? -1 : 0}
      >
        <svg aria-hidden="true" className={styles.dialSvg} viewBox="0 0 260 260">
          <circle
            className={styles.dialTrack}
            cx={CENTER}
            cy={CENTER}
            pathLength="100"
            r="92"
            strokeDasharray="75 25"
            transform={`rotate(135 ${CENTER} ${CENTER})`}
          />
          <circle
            className={styles.dialActive}
            cx={CENTER}
            cy={CENTER}
            pathLength="100"
            r="92"
            strokeDasharray={`${progress * 75} 100`}
            transform={`rotate(135 ${CENTER} ${CENTER})`}
          />
          <g className={styles.dialTicks}>
            {ticks.map((tick, index) => (
              <line
                className={tick.isMajor ? styles.majorTick : undefined}
                key={index}
                x1={tick.x1}
                x2={tick.x2}
                y1={tick.y1}
                y2={tick.y2}
              />
            ))}
          </g>
          <circle className={styles.dialIndicator} cx={indicatorX} cy={indicatorY} r="7" />
        </svg>
        <span className={styles.dialValue}>
          <strong>{value}</strong>
          <span>分</span>
        </span>
        <span className={styles.minimumLabel}>{minimum}</span>
        <span className={styles.maximumLabel}>{maximum}</span>
      </div>

      <p className={styles.dialDescription} id={descriptionId}>
        円周ドラッグ・上下スクロール・矢印キーで1分ずつ調整
      </p>

      <div className={styles.stepButtons}>
        <button
          disabled={disabled || value <= minimum}
          onClick={() => onValueChange(stepDialValue(value, -1, minimum, maximum))}
          type="button"
        >
          −1分
        </button>
        <button
          disabled={disabled || value >= maximum}
          onClick={() => onValueChange(stepDialValue(value, 1, minimum, maximum))}
          type="button"
        >
          ＋1分
        </button>
      </div>

      <div className={styles.directInput}>
        <label htmlFor={id}>{label}を数値で直接入力</label>
        <div className={styles.inputWithUnit}>
          <input
            aria-describedby={describedBy}
            aria-invalid={error ? "true" : undefined}
            disabled={disabled}
            id={id}
            inputMode="numeric"
            maxLength={3}
            onChange={onInputChange}
            pattern="[0-9]*"
            ref={inputRef}
            type="text"
            value={rawValue}
          />
          <span>分</span>
        </div>
      </div>
      <p className={styles.error} id={error ? errorId : undefined}>
        {error ? <><span aria-hidden="true">!</span> {error}</> : null}
      </p>
    </section>
  );
}
