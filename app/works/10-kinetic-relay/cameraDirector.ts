import type { ChainStageId } from "./chainSequence";

export type CameraPreset = {
  readonly position: readonly [number, number, number];
  readonly target: readonly [number, number, number];
  readonly fov: number;
};

const HERO: CameraPreset = {
  position: [10.4, 8.4, 14.2],
  target: [0.15, 0.85, -0.15],
  fov: 38,
};

const MOBILE_HERO: CameraPreset = {
  position: [8.5, 9.5, 23],
  target: [2, 0.8, -0.1],
  fov: 60,
};

const TARGETS: Record<ChainStageId, readonly [number, number, number]> = {
  marble: [-3.65, 1.1, -1.0],
  eraser: [-0.55, 0.55, -1.05],
  blocks: [2.35, 0.7, -0.85],
  car: [3.2, 0.9, -0.2],
  seesaw: [2.75, 0.55, -0.05],
  "blue-marble": [3.65, 0.7, 0.72],
  bell: [4.95, 0.68, 0.18],
};

export function getHeroCamera(width: number, height: number): CameraPreset {
  return width < 720 || height < 620 ? MOBILE_HERO : HERO;
}

export function getStageCamera(stage: ChainStageId, width: number, height: number, reducedMotion: boolean): CameraPreset {
  const hero = getHeroCamera(width, height);
  if (reducedMotion) return hero;
  const target = TARGETS[stage];
  const mobile = width < 720 || height < 620;
  const position: [number, number, number] = mobile
    ? [target[0] + 7.8, target[1] + 6.8, target[2] + 13.5]
    : [target[0] + 7.0, target[1] + 5.3, target[2] + 9.8];
  return { position, target, fov: mobile ? 43 : 36 };
}

export function interpolateCamera(from: CameraPreset, to: CameraPreset, amount: number): CameraPreset {
  const t = Math.min(1, Math.max(0, Number.isFinite(amount) ? amount : 0));
  const eased = t * t * (3 - 2 * t);
  const lerp = (a: number, b: number): number => a + (b - a) * eased;
  return {
    position: [lerp(from.position[0], to.position[0]), lerp(from.position[1], to.position[1]), lerp(from.position[2], to.position[2])],
    target: [lerp(from.target[0], to.target[0]), lerp(from.target[1], to.target[1]), lerp(from.target[2], to.target[2])],
    fov: lerp(from.fov, to.fov),
  };
}
