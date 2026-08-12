export type QualityProfile = {
  readonly level: "desktop" | "mobile";
  readonly pixelRatio: number;
  readonly maxPixels: number;
  readonly shadowMapSize: number;
  readonly antialias: boolean;
  readonly targetFps: number;
  readonly physicsTimestep: number;
  readonly maxSubsteps: number;
};

function finitePositive(value: number, fallback: number): number {
  return Number.isFinite(value) && value > 0 ? value : fallback;
}
export function getQualityProfile(width: number, height: number, devicePixelRatio: number): QualityProfile {
  const safeWidth = finitePositive(width, 390);
  const safeHeight = finitePositive(height, 844);
  const mobile = safeWidth < 720 || safeHeight < 620;
  const dpr = Math.min(2.5, Math.max(1, finitePositive(devicePixelRatio, 1)));
  return mobile
    ? {
        level: "mobile",
        pixelRatio: Math.min(1, dpr),
        maxPixels: 650_000,
        shadowMapSize: 512,
        antialias: true,
        targetFps: 30,
        physicsTimestep: 1 / 60,
        maxSubsteps: 2,
      }
    : {
        level: "desktop",
        pixelRatio: Math.min(1.25, dpr),
        maxPixels: 1_700_000,
        shadowMapSize: 1024,
        antialias: true,
        targetFps: 30,
        physicsTimestep: 1 / 60,
        maxSubsteps: 2,
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
