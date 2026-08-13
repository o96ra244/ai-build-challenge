export type GestureKind = "tap" | "slow-drag" | "flick";

export type GestureInput = {
  readonly distance: number;
  readonly durationMs: number;
  readonly speed: number;
};

export type ShakeImpulse = {
  readonly x: number;
  readonly y: number;
  readonly strength: number;
};

export type ParticleLayer = "snow" | "glitter" | "dust";
export type AccumulationSurface = "roof" | "branches" | "ground";

export type QualityLevel = "high" | "medium" | "low";

export type QualityProfile = {
  readonly level: QualityLevel;
  readonly pixelRatio: number;
  readonly maxPixels: number;
  readonly snowCount: number;
  readonly glitterCount: number;
  readonly dustCount: number;
  readonly shadowMapSize: number;
};

export type AccumulationState = {
  readonly roof: number;
  readonly branches: number;
  readonly ground: number;
};

export type LayerConfig = {
  readonly gravity: number;
  readonly drag: number;
  readonly bounce: number;
  readonly swirlScale: number;
  readonly radius: number;
  readonly opacity: number;
};

export type Vector3Tuple = readonly [number, number, number];

export const EMPTY_ACCUMULATION: AccumulationState = {
  roof: 0,
  branches: 0,
  ground: 0,
};

export function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, Number.isFinite(value) ? value : min));
}

export function expApproach(current: number, target: number, deltaSeconds: number, speed: number): number {
  const safeDelta = clamp(deltaSeconds, 0, 0.25);
  const safeSpeed = Math.max(0, Number.isFinite(speed) ? speed : 0);
  return current + (target - current) * (1 - Math.exp(-safeDelta * safeSpeed));
}

export function classifyGesture(input: GestureInput): GestureKind {
  const distance = Math.max(0, Number.isFinite(input.distance) ? input.distance : 0);
  const durationMs = Math.max(0, Number.isFinite(input.durationMs) ? input.durationMs : 0);
  const speed = Math.max(0, Number.isFinite(input.speed) ? input.speed : 0);

  if (distance <= 14 && durationMs <= 720) {
    return "tap";
  }

  if (speed >= 0.48 || (distance >= 90 && durationMs <= 260)) {
    return "flick";
  }

  return "slow-drag";
}

export function getShakeImpulse(deltaX: number, deltaY: number, durationMs: number): ShakeImpulse {
  const safeX = Number.isFinite(deltaX) ? deltaX : 0;
  const safeY = Number.isFinite(deltaY) ? deltaY : 0;
  const safeDuration = Math.max(16, Number.isFinite(durationMs) ? durationMs : 16);
  const distance = Math.hypot(safeX, safeY);
  const speed = distance / safeDuration;
  const strength = clamp(0.48 + speed * 2.4 + distance / 320, 0.48, 2.4);

  return {
    x: clamp(safeX === 0 ? 0 : safeX / 170, -1, 1),
    y: clamp(safeY === 0 ? 0 : -safeY / 170, -1, 1),
    strength,
  };
}

export function getQualityProfile(width: number, height: number, devicePixelRatio: number): QualityProfile {
  const safeWidth = Math.max(1, Number.isFinite(width) ? width : 1);
  const safeHeight = Math.max(1, Number.isFinite(height) ? height : 1);
  const safeDpr = Math.max(1, Number.isFinite(devicePixelRatio) ? devicePixelRatio : 1);
  const cssPixels = safeWidth * safeHeight;

  if (safeWidth <= 540 || cssPixels <= 500_000) {
    return {
      level: "low",
      pixelRatio: Math.min(safeDpr, 1.1),
      maxPixels: 950_000,
      snowCount: 76,
      glitterCount: 24,
      dustCount: 96,
      shadowMapSize: 512,
    };
  }

  if (safeDpr >= 2.5 || cssPixels >= 1_600_000) {
    return {
      level: "medium",
      pixelRatio: Math.min(safeDpr, 1.25),
      maxPixels: 1_700_000,
      snowCount: 112,
      glitterCount: 38,
      dustCount: 148,
      shadowMapSize: 768,
    };
  }

  return {
    level: "high",
    pixelRatio: Math.min(safeDpr, 1.5),
    maxPixels: 2_400_000,
    snowCount: 150,
    glitterCount: 52,
    dustCount: 200,
    shadowMapSize: 1024,
  };
}

export function getDrawingBufferSize(
  width: number,
  height: number,
  devicePixelRatio: number,
  profile: QualityProfile,
): { readonly width: number; readonly height: number; readonly pixelRatio: number } {
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

export function getLayerConfig(layer: ParticleLayer): LayerConfig {
  switch (layer) {
    case "snow":
      return {
        gravity: 0.52,
        drag: 3.2,
        bounce: 0.34,
        swirlScale: 1,
        radius: 0.038,
        opacity: 0.92,
      };
    case "glitter":
      return {
        gravity: 0.25,
        drag: 2.15,
        bounce: 0.66,
        swirlScale: 1.2,
        radius: 0.022,
        opacity: 0.86,
      };
    case "dust":
      return {
        gravity: 0.12,
        drag: 5.4,
        bounce: 0.16,
        swirlScale: 0.76,
        radius: 0.009,
        opacity: 0.3,
      };
  }
}

export function getFlowVector(
  position: Vector3Tuple,
  liquidVelocity: Vector3Tuple,
  swirlStrength: number,
  layer: ParticleLayer,
  time: number,
  phase: number,
): Vector3Tuple {
  const config = getLayerConfig(layer);
  const [x, y, z] = position;
  const radius = Math.max(0.2, Math.hypot(x, y, z));
  const tangentLength = Math.max(0.2, Math.hypot(x, z));
  const tangentX = -z / tangentLength;
  const tangentZ = x / tangentLength;
  const wallLift = clamp(radius / 2.3, 0, 1) * 0.12;
  const wave = Math.sin(time * (0.82 + config.swirlScale * 0.22) + phase) * 0.06;
  const swirl = swirlStrength * config.swirlScale;

  return [
    liquidVelocity[0] * 0.86 + tangentX * swirl + wave,
    liquidVelocity[1] * 0.72 + wallLift * swirl + Math.cos(time + phase) * 0.025,
    liquidVelocity[2] * 0.86 + tangentZ * swirl + Math.sin(time * 0.73 + phase) * 0.06,
  ];
}

export function reflectVelocity(
  velocity: Vector3Tuple,
  normal: Vector3Tuple,
  bounce: number,
  tangentDamping = 0.92,
): Vector3Tuple {
  const dot = velocity[0] * normal[0] + velocity[1] * normal[1] + velocity[2] * normal[2];
  const normalScale = dot < 0 ? -(1 + bounce) * dot : 0;
  const reflected: Vector3Tuple = [
    velocity[0] + normal[0] * normalScale,
    velocity[1] + normal[1] * normalScale,
    velocity[2] + normal[2] * normalScale,
  ];
  const normalComponent = reflected[0] * normal[0] + reflected[1] * normal[1] + reflected[2] * normal[2];

  return [
    reflected[0] * tangentDamping + normal[0] * normalComponent * (1 - tangentDamping),
    reflected[1] * tangentDamping + normal[1] * normalComponent * (1 - tangentDamping),
    reflected[2] * tangentDamping + normal[2] * normalComponent * (1 - tangentDamping),
  ];
}

export function updateAccumulation(
  state: AccumulationState,
  surface: AccumulationSurface,
  impact: number,
  deltaSeconds: number,
): AccumulationState {
  const safeImpact = clamp(impact, 0, 4);
  const safeDelta = clamp(deltaSeconds, 0, 0.1);
  const gain = safeImpact * safeDelta * (surface === "ground" ? 0.18 : 0.28);

  return {
    ...state,
    [surface]: clamp(state[surface] + gain, 0, 1),
  };
}

export function releaseAccumulation(state: AccumulationState, intensity: number): AccumulationState {
  const retained = clamp(1 - Math.max(0, Number.isFinite(intensity) ? intensity : 0) * 0.72, 0.08, 1);

  return {
    roof: state.roof * retained,
    branches: state.branches * retained,
    ground: state.ground * clamp(1 - Math.max(0, Number.isFinite(intensity) ? intensity : 0) * 0.36, 0.36, 1),
  };
}
