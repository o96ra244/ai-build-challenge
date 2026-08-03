export const MIN_PIXEL_VALUE = 1;
export const MAX_PIXEL_VALUE = 100_000;

export type ResizeBasis = "width" | "height";

export type Dimensions = {
  width: number;
  height: number;
};

export type ValidationResult =
  | { valid: true; value: number }
  | { valid: false; error: string };

export function validatePixelValue(rawValue: string, label: string): ValidationResult {
  const value = rawValue.trim();

  if (value === "") {
    return { valid: false, error: `${label}を入力してください。` };
  }

  if (/^[+-]?\d+\.\d+$/.test(value)) {
    return {
      valid: false,
      error: `${label}は小数ではなく1〜${MAX_PIXEL_VALUE}の整数で入力してください。`,
    };
  }

  if (!/^\d+$/.test(value)) {
    return {
      valid: false,
      error: `${label}は1〜${MAX_PIXEL_VALUE}の整数で入力してください。`,
    };
  }

  const numberValue = Number(value);

  if (
    !Number.isFinite(numberValue) ||
    !Number.isInteger(numberValue) ||
    numberValue < MIN_PIXEL_VALUE ||
    numberValue > MAX_PIXEL_VALUE
  ) {
    return {
      valid: false,
      error: `${label}は1〜${MAX_PIXEL_VALUE}の整数で入力してください。`,
    };
  }

  return { valid: true, value: numberValue };
}

export function calculateResizedDimensions(
  original: Dimensions,
  basis: ResizeBasis,
  targetValue: number,
): Dimensions {
  if (basis === "width") {
    return {
      width: targetValue,
      height: Math.max(1, Math.round((targetValue * original.height) / original.width)),
    };
  }

  return {
    width: Math.max(1, Math.round((targetValue * original.width) / original.height)),
    height: targetValue,
  };
}

export function greatestCommonDivisor(left: number, right: number): number {
  let a = Math.abs(left);
  let b = Math.abs(right);

  while (b !== 0) {
    const remainder = a % b;
    a = b;
    b = remainder;
  }

  return a;
}

export function simplifyAspectRatio(dimensions: Dimensions): Dimensions {
  const divisor = greatestCommonDivisor(dimensions.width, dimensions.height);

  return {
    width: dimensions.width / divisor,
    height: dimensions.height / divisor,
  };
}

export function formatSize(dimensions: Dimensions): string {
  return `${dimensions.width} × ${dimensions.height} px`;
}

export function formatAspectRatio(dimensions: Dimensions): string {
  return `${dimensions.width} : ${dimensions.height}`;
}

export function formatAspectRatioCss(dimensions: Dimensions): string {
  return `aspect-ratio: ${dimensions.width} / ${dimensions.height};`;
}
