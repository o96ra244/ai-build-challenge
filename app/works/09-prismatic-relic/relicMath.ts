export type PointerPoint = {
  readonly x: number;
  readonly y: number;
};

export type PointerRect = {
  readonly left: number;
  readonly top: number;
  readonly width: number;
  readonly height: number;
};

export type QualityLevel = "high" | "medium" | "low";

export type QualityProfile = {
  readonly level: QualityLevel;
  readonly pixelRatio: number;
  readonly maxPixels: number;
  readonly particleCount: number;
  readonly geometryDetail: number;
  readonly bloomResolutionScale: number;
  readonly bloomStrength: number;
};

export type DrawingBufferSize = {
  readonly width: number;
  readonly height: number;
  readonly pixelRatio: number;
};

export function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, Number.isFinite(value) ? value : min));
}

export function normalizePointer(clientX: number, clientY: number, rect: PointerRect): PointerPoint {
  if (rect.width <= 0 || rect.height <= 0 || !Number.isFinite(rect.width) || !Number.isFinite(rect.height)) {
    return { x: 0, y: 0 };
  }

  const normalizedX = (clientX - rect.left) / rect.width;
  const normalizedY = (clientY - rect.top) / rect.height;
  return {
    x: clamp(normalizedX * 2 - 1, -1, 1),
    y: clamp(1 - normalizedY * 2, -1, 1),
  };
}

export function smoothPointer(current: PointerPoint, target: PointerPoint, deltaSeconds: number, speed = 7): PointerPoint {
  const safeDelta = Math.max(0, Number.isFinite(deltaSeconds) ? deltaSeconds : 0);
  const alpha = 1 - Math.exp(-safeDelta * Math.max(0, speed));
  return {
    x: current.x + (target.x - current.x) * alpha,
    y: current.y + (target.y - current.y) * alpha,
  };
}

export function getQualityProfile(width: number, height: number, devicePixelRatio: number): QualityProfile {
  const safeWidth = Math.max(1, Number.isFinite(width) ? width : 1);
  const safeHeight = Math.max(1, Number.isFinite(height) ? height : 1);
  const safeDpr = Math.max(1, Number.isFinite(devicePixelRatio) ? devicePixelRatio : 1);
  const cssPixels = safeWidth * safeHeight;

  if (safeWidth <= 520 || cssPixels <= 420_000) {
    return {
      level: "low",
      pixelRatio: Math.min(safeDpr, 1.1),
      maxPixels: 900_000,
      particleCount: 42,
      geometryDetail: 2,
      bloomResolutionScale: 0.32,
      bloomStrength: 0.38,
    };
  }

  if (safeDpr >= 2.5 || cssPixels >= 1_500_000) {
    return {
      level: "medium",
      pixelRatio: Math.min(safeDpr, 1.25),
      maxPixels: 1_600_000,
      particleCount: 72,
      geometryDetail: 2,
      bloomResolutionScale: 0.42,
      bloomStrength: 0.46,
    };
  }

  return {
    level: "high",
    pixelRatio: Math.min(safeDpr, 1.5),
    maxPixels: 2_400_000,
    particleCount: 96,
    geometryDetail: 3,
    bloomResolutionScale: 0.5,
    bloomStrength: 0.52,
  };
}

export function getDrawingBufferSize(
  width: number,
  height: number,
  devicePixelRatio: number,
  profile: QualityProfile,
): DrawingBufferSize {
  const safeWidth = Math.max(1, Math.floor(Number.isFinite(width) ? width : 1));
  const safeHeight = Math.max(1, Math.floor(Number.isFinite(height) ? height : 1));
  const safeDpr = Math.max(1, Number.isFinite(devicePixelRatio) ? devicePixelRatio : 1);
  const maxRatio = Math.sqrt(profile.maxPixels / (safeWidth * safeHeight));
  const pixelRatio = Math.max(0.75, Math.min(profile.pixelRatio, safeDpr, maxRatio));
  return {
    width: Math.max(1, Math.floor(safeWidth * pixelRatio)),
    height: Math.max(1, Math.floor(safeHeight * pixelRatio)),
    pixelRatio,
  };
}

export function getTransitionProgress(elapsedMs: number, durationMs: number, reducedMotion: boolean): number {
  if (reducedMotion) {
    return 1;
  }
  if (durationMs <= 0) {
    return 1;
  }
  return clamp(elapsedMs / durationMs, 0, 1);
}
