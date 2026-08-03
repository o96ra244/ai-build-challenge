export type Phase = "work" | "break";

export type MinuteValidationResult =
  | { valid: true; value: number }
  | { valid: false; error: string };

export const DIAL_START_ANGLE = 135;
export const DIAL_SWEEP_ANGLE = 270;

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
