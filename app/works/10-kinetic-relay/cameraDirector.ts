import { CHAIN_STAGES, type ChainStageId } from "./chainSequence";
import type { Vector3Tuple } from "./deskLayout";

export type CameraMode = "follow" | "free";

export type CameraPreset = {
  readonly position: readonly [number, number, number];
  readonly target: readonly [number, number, number];
  readonly fov: number;
  readonly minDistance: number;
  readonly maxDistance: number;
  readonly minPolarAngle: number;
  readonly maxPolarAngle: number;
};

export type TargetBounds = {
  readonly min: readonly [number, number, number];
  readonly max: readonly [number, number, number];
};

const HOME: CameraPreset = {
  position: [0.2, 10.2, 19.5],
  target: [0.1, 1.8, -0.7],
  fov: 48,
  minDistance: 7,
  maxDistance: 30,
  minPolarAngle: 0.28,
  maxPolarAngle: Math.PI * 0.49,
};

const MOBILE_HOME: CameraPreset = {
  position: [0.4, 9.8, 24],
  target: [0.2, 2.1, -0.8],
  fov: 62,
  minDistance: 8,
  maxDistance: 32,
  minPolarAngle: 0.3,
  maxPolarAngle: Math.PI * 0.49,
};

const FOLLOW_PRESETS: Partial<Record<ChainStageId, CameraPreset>> = {
  stopper: {
    position: [-7.0, 3.0, 3.4],
    target: [-7.6, 1.25, -1.35],
    fov: 42,
    minDistance: 2,
    maxDistance: 12,
    minPolarAngle: 0.3,
    maxPolarAngle: Math.PI * 0.49,
  },
  "red-ramp": {
    position: [1.8, 1.4, -4.0],
    target: [-5.0, 1.1, -1.7],
    fov: 50,
    minDistance: 2.4,
    maxDistance: 10,
    minPolarAngle: 0.3,
    maxPolarAngle: Math.PI * 0.49,
  },
  "red-impact": {
    position: [1.8, 1.2, -4.0],
    target: [-3.0, 0.72, -1.7],
    fov: 46,
    minDistance: 2.4,
    maxDistance: 10,
    minPolarAngle: 0.3,
    maxPolarAngle: Math.PI * 0.49,
  },
  clothespin: {
    position: [1.8, 1.1, -4.0],
    target: [-2.7, 0.68, -1.7],
    fov: 42,
    minDistance: 2.2,
    maxDistance: 9,
    minPolarAngle: 0.3,
    maxPolarAngle: Math.PI * 0.49,
  },
};

export const ORBIT_TARGET_BOUNDS: TargetBounds = {
  min: [-8.8, 0.1, -4.8],
  max: [8.2, 5.1, 3.4],
};

export function getHomeCamera(width: number, height: number): CameraPreset {
  return width < 720 || height < 620 ? MOBILE_HOME : HOME;
}

export function getHeroCamera(width: number, height: number): CameraPreset {
  return getHomeCamera(width, height);
}

export function getFollowTarget(stage: ChainStageId): Vector3Tuple {
  return CHAIN_STAGES.find((candidate) => candidate.id === stage)?.focus ?? HOME.target;
}

export function getFollowCamera(stage: ChainStageId): CameraPreset {
  return FOLLOW_PRESETS[stage] ?? HOME;
}

export function clampTarget(target: Vector3Tuple, bounds: TargetBounds = ORBIT_TARGET_BOUNDS): Vector3Tuple {
  return [
    Math.min(bounds.max[0], Math.max(bounds.min[0], target[0])),
    Math.min(bounds.max[1], Math.max(bounds.min[1], target[1])),
    Math.min(bounds.max[2], Math.max(bounds.min[2], target[2])),
  ];
}

export function interpolateCamera(from: CameraPreset, to: CameraPreset, amount: number): CameraPreset {
  const t = Math.min(1, Math.max(0, Number.isFinite(amount) ? amount : 0));
  const eased = t * t * (3 - 2 * t);
  const lerp = (a: number, b: number): number => a + (b - a) * eased;
  return {
    position: [lerp(from.position[0], to.position[0]), lerp(from.position[1], to.position[1]), lerp(from.position[2], to.position[2])],
    target: [lerp(from.target[0], to.target[0]), lerp(from.target[1], to.target[1]), lerp(from.target[2], to.target[2])],
    fov: lerp(from.fov, to.fov),
    minDistance: lerp(from.minDistance, to.minDistance),
    maxDistance: lerp(from.maxDistance, to.maxDistance),
    minPolarAngle: lerp(from.minPolarAngle, to.minPolarAngle),
    maxPolarAngle: lerp(from.maxPolarAngle, to.maxPolarAngle),
  };
}
