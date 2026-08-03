export type Phase = "work" | "break";

export type MinuteValidationResult =
  | { valid: true; value: number }
  | { valid: false; error: string };

export const DIAL_START_ANGLE = 135;
export const DIAL_SWEEP_ANGLE = 270;
export const DIAL_SCROLL_THRESHOLD = 16;

export type DialDirection = -1 | 0 | 1;
export type DialDeltaMode = 0 | 1 | 2;

export type DialAccumulatorResult = {
  accumulator: number;
  step: DialDirection;
};

export type DialDeltaResult = DialAccumulatorResult & {
  passThrough: boolean;
};

export function normalizeDialScrollDelta(
  deltaX: number,
  deltaY: number,
  deltaMode: DialDeltaMode,
  pageHeight: number,
): number {
  const safeDeltaX = Number.isFinite(deltaX) ? deltaX : 0;
  const safeDeltaY = Number.isFinite(deltaY) ? deltaY : 0;
  const safePageHeight = Number.isFinite(pageHeight) && pageHeight > 0 ? pageHeight : 1;
  const multiplier = deltaMode === 1 ? 16 : deltaMode === 2 ? safePageHeight : 1;
  const normalizedX = safeDeltaX * multiplier;
  const normalizedY = safeDeltaY * multiplier;

  return Math.abs(normalizedY) >= Math.abs(normalizedX) ? -normalizedY : normalizedX;
}

export function getDialDirection(delta: number): DialDirection {
  if (!Number.isFinite(delta) || delta === 0) return 0;
  return delta > 0 ? 1 : -1;
}

export function canStepDialValue(
  value: number,
  direction: DialDirection,
  minimum: number,
  maximum: number,
): boolean {
  if (direction === 0) return false;
  return direction > 0 ? value < maximum : value > minimum;
}

export function accumulateDialDelta(
  previousAccumulator: number,
  delta: number,
  threshold = DIAL_SCROLL_THRESHOLD,
): DialAccumulatorResult {
  const safePrevious = Number.isFinite(previousAccumulator) ? previousAccumulator : 0;
  const safeDelta = Number.isFinite(delta) ? delta : 0;
  const safeThreshold = Number.isFinite(threshold) && threshold > 0 ? threshold : 1;
  const reversed = safePrevious !== 0 && safeDelta !== 0 && Math.sign(safePrevious) !== Math.sign(safeDelta);
  const accumulator = (reversed ? 0 : safePrevious) + safeDelta;

  if (Math.abs(accumulator) < safeThreshold) {
    return { accumulator, step: 0 };
  }

  return { accumulator: 0, step: accumulator > 0 ? 1 : -1 };
}

export function shouldPassThroughDialScroll(
  value: number,
  direction: DialDirection,
  minimum: number,
  maximum: number,
): boolean {
  return direction !== 0 && !canStepDialValue(value, direction, minimum, maximum);
}

export function resolveDialDelta(
  value: number,
  previousAccumulator: number,
  delta: number,
  minimum: number,
  maximum: number,
): DialDeltaResult {
  const direction = getDialDirection(delta);

  if (shouldPassThroughDialScroll(value, direction, minimum, maximum)) {
    return { accumulator: 0, step: 0, passThrough: true };
  }

  const result = accumulateDialDelta(previousAccumulator, delta);
  return { ...result, passThrough: false };
}

export function clampDialValue(value: number, minimum: number, maximum: number): number {
  const finiteValue = Number.isFinite(value) ? value : minimum;
  return Math.min(maximum, Math.max(minimum, Math.round(finiteValue)));
}

export function stepDialValue(
  value: number,
  step: number,
  minimum: number,
  maximum: number,
): number {
  return clampDialValue(value + step, minimum, maximum);
}

export function dialValueToProgress(value: number, minimum: number, maximum: number): number {
  if (maximum <= minimum) return 0;
  return (clampDialValue(value, minimum, maximum) - minimum) / (maximum - minimum);
}

export function dialProgressToValue(progress: number, minimum: number, maximum: number): number {
  const safeProgress = Number.isFinite(progress) ? Math.min(1, Math.max(0, progress)) : 0;
  return clampDialValue(minimum + safeProgress * (maximum - minimum), minimum, maximum);
}

export function normalizeAngle(angle: number): number {
  if (!Number.isFinite(angle)) return 0;
  return ((angle % 360) + 360) % 360;
}

export function pointerAngleToDialProgress(angle: number): number {
  const relativeAngle = normalizeAngle(angle - DIAL_START_ANGLE);

  if (relativeAngle <= DIAL_SWEEP_ANGLE) {
    return relativeAngle / DIAL_SWEEP_ANGLE;
  }

  const distanceFromMaximum = relativeAngle - DIAL_SWEEP_ANGLE;
  const distanceFromMinimum = 360 - relativeAngle;
  return distanceFromMaximum <= distanceFromMinimum ? 1 : 0;
}

export function pointerAngleToDialValue(
  angle: number,
  minimum: number,
  maximum: number,
): number {
  return dialProgressToValue(pointerAngleToDialProgress(angle), minimum, maximum);
}

export function dialValueToAngle(value: number, minimum: number, maximum: number): number {
  return DIAL_START_ANGLE + dialValueToProgress(value, minimum, maximum) * DIAL_SWEEP_ANGLE;
}

export function validateMinutes(
  rawValue: string,
  label: string,
  maximum: number,
): MinuteValidationResult {
  const value = rawValue.trim();

  if (value === "") {
    return { valid: false, error: `${label}を入力してください。` };
  }

  if (/^[+-]?\d+\.\d+$/.test(value)) {
    return {
      valid: false,
      error: `${label}は小数ではなく1〜${maximum}の整数で入力してください。`,
    };
  }

  if (!/^\d+$/.test(value)) {
    return {
      valid: false,
      error: `${label}は半角数字で1〜${maximum}の整数を入力してください。`,
    };
  }

  const numericValue = Number(value);

  if (
    !Number.isFinite(numericValue) ||
    !Number.isInteger(numericValue) ||
    numericValue < 1 ||
    numericValue > maximum
  ) {
    return {
      valid: false,
      error: `${label}は1〜${maximum}の整数で入力してください。`,
    };
  }

  return { valid: true, value: numericValue };
}
export function minutesToMilliseconds(minutes: number): number {
  return minutes * 60 * 1000;
}

export function createEndTime(now: number, remainingMilliseconds: number): number {
  return now + Math.max(0, remainingMilliseconds);
}

export function getRemainingMilliseconds(endTime: number, now: number): number {
  return Math.max(0, endTime - now);
}

export function formatRemainingTime(milliseconds: number): string {
  const safeMilliseconds = Number.isFinite(milliseconds) ? Math.max(0, milliseconds) : 0;
  const totalSeconds = Math.ceil(safeMilliseconds / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;

  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

export function calculateProgress(totalMilliseconds: number, remainingMilliseconds: number): number {
  if (!Number.isFinite(totalMilliseconds) || totalMilliseconds <= 0) {
    return 0;
  }

  const elapsedRatio = (totalMilliseconds - remainingMilliseconds) / totalMilliseconds;
  return Math.min(100, Math.max(0, elapsedRatio * 100));
}

export function getNextPhase(phase: Phase): Phase {
  return phase === "work" ? "break" : "work";
}
