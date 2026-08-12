export type QualityProfile = {
  readonly level: "desktop" | "mobile";
  readonly pixelRatio: number;
  readonly maxPixels: number;
  readonly shadowMapSize: number;
  readonly railSegments: number;
  readonly railRadialSegments: number;
  readonly gearSegments: number;
  readonly antialias: boolean;
};

function finitePositive(value: number, fallback: number): number {
  return Number.isFinite(value) && value > 0 ? value : fallback;
}

export function getQualityProfile(width: number, height: number, devicePixelRatio: number): QualityProfile {
  const safeWidth = finitePositive(width, 390);
  const safeHeight = finitePositive(height, 844);
  const mobile = safeWidth < 720 || safeHeight < 620;
  const dpr = Math.min(2, Math.max(1, finitePositive(devicePixelRatio, 1)));
  return mobile
    ? {
        level: "mobile",
        pixelRatio: Math.min(1.25, dpr),
        maxPixels: 1_050_000,
        shadowMapSize: 768,
        railSegments: 128,
        railRadialSegments: 16,
        gearSegments: 48,
        antialias: true,
      }
    : {
        level: "desktop",
        pixelRatio: Math.min(1.75, dpr),
        maxPixels: 2_650_000,
        shadowMapSize: 2048,
        railSegments: 224,
        railRadialSegments: 24,
        gearSegments: 64,
        antialias: true,
      };
}

export function getDrawingBufferSize(
  width: number,
  height: number,
  devicePixelRatio: number,
  profile: QualityProfile,
): { readonly width: number; readonly height: number; readonly pixelRatio: number } {
  const safeWidth = Math.max(1, Math.round(finitePositive(width, 390)));
  const safeHeight = Math.max(1, Math.round(finitePositive(height, 844)));
  const requestedRatio = Math.min(profile.pixelRatio, Math.max(1, finitePositive(devicePixelRatio, 1)));
  const requestedPixels = safeWidth * safeHeight * requestedRatio * requestedRatio;
  const scale = requestedPixels > profile.maxPixels ? Math.sqrt(profile.maxPixels / requestedPixels) : 1;
  const pixelRatio = Math.max(0.7, requestedRatio * scale);
  return {
    width: Math.max(1, Math.round(safeWidth * pixelRatio)),
    height: Math.max(1, Math.round(safeHeight * pixelRatio)),
    pixelRatio,
  };
}
