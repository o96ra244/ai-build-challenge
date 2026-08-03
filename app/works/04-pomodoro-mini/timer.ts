export type Phase = "work" | "break";

export type MinuteValidationResult =
  | { valid: true; value: number }
  | { valid: false; error: string };

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
