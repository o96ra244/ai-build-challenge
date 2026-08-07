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
  readonly shadowMapSize: number;
  readonly bloomResolutionScale: number;
};

export type DrawingBufferSize = {
  readonly width: number;
  readonly height: number;
  readonly pixelRatio: number;
};

export type LightingLoopState = {
  readonly pageVisible: boolean;
  readonly inViewport: boolean;
  readonly holdLight: boolean;
  readonly holdSettling: boolean;
  readonly transitionActive: boolean;
  readonly pointerNeedsRender: boolean;
  readonly pointerDistance: number;
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

export function getPointerLightStrength(pointer: PointerPoint): number {
  const distance = Math.min(1, Math.hypot(pointer.x, pointer.y) / Math.SQRT2);
  return 1.12 + distance * 0.68;
}

export function smoothPointer(current: PointerPoint, target: PointerPoint, deltaSeconds: number, speed = 8): PointerPoint {
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
      shadowMapSize: 512,
      bloomResolutionScale: 0.3,
    };
  }

  if (safeDpr >= 2.5 || cssPixels >= 1_500_000) {
    return {
      level: "medium",
      pixelRatio: Math.min(safeDpr, 1.25),
      maxPixels: 1_600_000,
      shadowMapSize: 768,
      bloomResolutionScale: 0.42,
    };
  }

  return {
    level: "high",
    pixelRatio: Math.min(safeDpr, 1.5),
    maxPixels: 2_400_000,
    shadowMapSize: 1024,
    bloomResolutionScale: 0.5,
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
  if (reducedMotion || durationMs <= 0) {
    return 1;
  }
  return clamp(elapsedMs / durationMs, 0, 1);
}

export function shouldAnimateLighting(state: LightingLoopState): boolean {
  if (!state.pageVisible || !state.inViewport || state.holdLight && !state.holdSettling) {
    return false;
  }
  return state.holdSettling || state.transitionActive || state.pointerNeedsRender || state.pointerDistance > 0.001;
}
