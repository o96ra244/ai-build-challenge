export type TrackMode = "auto-fit" | "auto-fill";

export type GridSettings = {
  minimumCardWidth: number;
  gap: number;
  maximumColumns: number;
  horizontalGutter: number;
  cardCount: number;
  mode: TrackMode;
};

export type NumericFieldName =
  | "minimumCardWidth"
  | "gap"
  | "maximumColumns"
  | "horizontalGutter"
  | "cardCount";

export type NumericFieldDefinition = {
  label: string;
  minimum: number;
  maximum: number;
};

export type ValidationResult =
  | { valid: true; value: number }
  | { valid: false; error: string };

export type GridResult = {
  previewWidth: number;
  availableWidth: number;
  capacity: number;
  trackCount: number;
  cardWidth: number;
  emptyTrackCount: number;
  maximumGridWidth: number;
};

export type Breakpoint = {
  columns: number;
  requiredGridWidth: number;
  requiredOuterWidth: number;
};

export const FIELD_DEFINITIONS: Record<NumericFieldName, NumericFieldDefinition> = {
  minimumCardWidth: { label: "カードの最小幅", minimum: 120, maximum: 800 },
  gap: { label: "カード間の余白", minimum: 0, maximum: 120 },
  maximumColumns: { label: "最大列数", minimum: 1, maximum: 8 },
  horizontalGutter: { label: "ページ左右の余白", minimum: 0, maximum: 120 },
  cardCount: { label: "カード数", minimum: 1, maximum: 12 },
};

export const INITIAL_SETTINGS: GridSettings = {
  minimumCardWidth: 240,
  gap: 24,
  maximumColumns: 4,
  horizontalGutter: 16,
  cardCount: 3,
  mode: "auto-fit",
};

export const INITIAL_PREVIEW_WIDTH = 1200;

export function parseIntegerString(rawValue: string): number | null {
  const value = rawValue.trim();
  if (!/^\d+$/.test(value)) return null;

  const parsed = Number(value);
  return Number.isSafeInteger(parsed) && Number.isFinite(parsed) ? parsed : null;
}

export function validateIntegerInput(
  rawValue: string,
  definition: NumericFieldDefinition,
): ValidationResult {
  const value = rawValue.trim();
  if (value === "") {
    return { valid: false, error: `${definition.label}を入力してください。` };
  }

  const parsed = parseIntegerString(value);
  if (parsed === null) {
    return {
      valid: false,
      error: `${definition.label}は${definition.minimum}〜${definition.maximum}の整数で入力してください。`,
    };
  }

  if (parsed < definition.minimum || parsed > definition.maximum) {
    return {
      valid: false,
      error: `${definition.label}は${definition.minimum}〜${definition.maximum}の範囲で入力してください。`,
    };
  }

  return { valid: true, value: parsed };
}

export function calculateMaximumGridWidth(settings: Pick<GridSettings, "minimumCardWidth" | "gap" | "maximumColumns">): number {
  return settings.maximumColumns * settings.minimumCardWidth + (settings.maximumColumns - 1) * settings.gap;
}

export function calculateAvailableWidth(previewWidth: number, horizontalGutter: number, maximumGridWidth: number): number {
  return Math.max(0, Math.min(previewWidth - horizontalGutter * 2, maximumGridWidth));
}

export function calculateCapacity(availableWidth: number, minimumCardWidth: number, gap: number, maximumColumns: number): number {
  const rawCapacity = Math.floor((availableWidth + gap) / (minimumCardWidth + gap));
  return Math.min(maximumColumns, Math.max(1, rawCapacity));
}

export function calculateTrackCount(capacity: number, cardCount: number, mode: TrackMode): number {
  return mode === "auto-fit" ? Math.min(capacity, cardCount) : capacity;
}

export function calculateCardWidth(availableWidth: number, gap: number, trackCount: number): number {
  return (availableWidth - gap * (trackCount - 1)) / trackCount;
}

export function calculateEmptyTrackCount(trackCount: number, cardCount: number, mode: TrackMode): number {
  return mode === "auto-fill" ? Math.max(0, trackCount - cardCount) : 0;
}

export function calculateBreakpoints(settings: Pick<GridSettings, "minimumCardWidth" | "gap" | "maximumColumns" | "horizontalGutter">): Breakpoint[] {
  return Array.from({ length: Math.max(0, settings.maximumColumns - 1) }, (_, index) => {
    const columns = index + 2;
    const requiredGridWidth = columns * settings.minimumCardWidth + (columns - 1) * settings.gap;
    return {
      columns,
      requiredGridWidth,
      requiredOuterWidth: requiredGridWidth + settings.horizontalGutter * 2,
    };
  });
}

export function calculateGridResult(settings: GridSettings, previewWidth: number): GridResult {
  const maximumGridWidth = calculateMaximumGridWidth(settings);
  const availableWidth = calculateAvailableWidth(previewWidth, settings.horizontalGutter, maximumGridWidth);
  const capacity = calculateCapacity(availableWidth, settings.minimumCardWidth, settings.gap, settings.maximumColumns);
  const trackCount = calculateTrackCount(capacity, settings.cardCount, settings.mode);

  return {
    previewWidth,
    availableWidth,
    capacity,
    trackCount,
    cardWidth: calculateCardWidth(availableWidth, settings.gap, trackCount),
    emptyTrackCount: calculateEmptyTrackCount(trackCount, settings.cardCount, settings.mode),
    maximumGridWidth,
  };
}

export function formatNumber(value: number): string {
  const normalized = Object.is(value, -0) || Math.abs(value) < 0.005 ? 0 : value;
  return String(Number(normalized.toFixed(2)));
}

export function generateCss(settings: GridSettings): string {
  const maximumGridWidth = calculateMaximumGridWidth(settings);
  return `.grid-shell {
  padding-inline: ${settings.horizontalGutter}px;
}

.card-grid {
  --card-min-width: ${settings.minimumCardWidth}px;
  --card-gap: ${settings.gap}px;

  display: grid;
  grid-template-columns:
    repeat(${settings.mode}, minmax(min(100%, var(--card-min-width)), 1fr));
  gap: var(--card-gap);
  max-width: ${maximumGridWidth}px;
  margin-inline: auto;
}`;
}

export function generateHtml(cardCount: number): string {
  const cards = Array.from(
    { length: cardCount },
    (_, index) => `    <article class="card">Card ${index + 1}</article>`,
  ).join("\n");

  return `<div class="grid-shell">
  <div class="card-grid">
${cards}
  </div>
</div>`;
}
