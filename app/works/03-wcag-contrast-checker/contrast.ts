export type HexValidationResult =
  | { valid: true; value: string }
  | { valid: false; error: string };

export type ContrastCriterion = {
  id: "aa-normal" | "aa-large" | "aaa-normal" | "aaa-large" | "non-text";
  label: string;
  requiredRatio: number;
  passed: boolean;
};

export function normalizeHex(rawValue: string, label = "色"): HexValidationResult {
  const value = rawValue.trim();

  if (value === "") {
    return { valid: false, error: `${label}を入力してください。` };
  }

  if (!value.startsWith("#")) {
    return { valid: false, error: `${label}は#から始めてください。` };
  }

  const digits = value.slice(1);

  if (digits.length !== 3 && digits.length !== 6) {
    return { valid: false, error: `${label}は#RGBまたは#RRGGBB形式で入力してください。` };
  }

  if (!/^[0-9a-f]+$/iu.test(digits)) {
    return { valid: false, error: `${label}には0〜9とA〜Fだけを使用してください。` };
  }

  const expanded = digits.length === 3 ? [...digits].map((digit) => digit.repeat(2)).join("") : digits;

  return { valid: true, value: `#${expanded.toUpperCase()}` };
}

export function linearizeSrgb(value: number): number {
  return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
}

export function getRelativeLuminance(hex: string): number {
  const normalized = normalizeHex(hex);

  if (!normalized.valid) {
    throw new Error(normalized.error);
  }

  const red = Number.parseInt(normalized.value.slice(1, 3), 16) / 255;
  const green = Number.parseInt(normalized.value.slice(3, 5), 16) / 255;
  const blue = Number.parseInt(normalized.value.slice(5, 7), 16) / 255;

  return (
    0.2126 * linearizeSrgb(red) +
    0.7152 * linearizeSrgb(green) +
    0.0722 * linearizeSrgb(blue)
  );
}

export function getContrastRatio(foreground: string, background: string): number {
  const foregroundLuminance = getRelativeLuminance(foreground);
  const backgroundLuminance = getRelativeLuminance(background);
  const lighter = Math.max(foregroundLuminance, backgroundLuminance);
  const darker = Math.min(foregroundLuminance, backgroundLuminance);

  return (lighter + 0.05) / (darker + 0.05);
}

export function passesRatio(ratio: number, requiredRatio: number): boolean {
  return ratio >= requiredRatio;
}

export function getContrastCriteria(ratio: number): readonly ContrastCriterion[] {
  return [
    { id: "aa-normal", label: "AA・通常文字", requiredRatio: 4.5, passed: passesRatio(ratio, 4.5) },
    { id: "aa-large", label: "AA・大きな文字", requiredRatio: 3, passed: passesRatio(ratio, 3) },
    { id: "aaa-normal", label: "AAA・通常文字", requiredRatio: 7, passed: passesRatio(ratio, 7) },
    { id: "aaa-large", label: "AAA・大きな文字", requiredRatio: 4.5, passed: passesRatio(ratio, 4.5) },
    { id: "non-text", label: "UI部品・グラフィック", requiredRatio: 3, passed: passesRatio(ratio, 3) },
  ];
}

export function formatContrastRatio(ratio: number): string {
  const truncated = Math.floor((ratio + Number.EPSILON) * 100) / 100;
  return truncated.toFixed(2);
}
