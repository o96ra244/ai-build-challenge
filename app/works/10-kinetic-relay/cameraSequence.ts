import type { CourseId, SequencePhase } from "./machineSequence";

export type CameraPreset = {
  readonly position: readonly [number, number, number];
  readonly target: readonly [number, number, number];
  readonly fov: number;
};

const HERO: CameraPreset = {
  position: [15.2, 10.8, 19.2],
  target: [0, 4.8, 0],
  fov: 35,
};

const MOBILE_HERO: CameraPreset = {
  position: [14.7, 10.5, 22.8],
  target: [0, 4.9, 0],
  fov: 39,
};

const FOCUS: Record<CourseId, CameraPreset> = {
  A: { position: [10.6, 7.4, 13.8], target: [-4.2, 5.1, 0], fov: 36 },
  B: { position: [8.6, 7.2, 13.2], target: [0, 4.9, 0], fov: 35 },
  C: { position: [10.2, 7.1, 13.6], target: [4.3, 5, 0], fov: 36 },
};

export function getHeroCamera(width: number, height: number): CameraPreset {
  return width < 720 || height < 620 ? MOBILE_HERO : HERO;
}

export function getFocusCamera(course: CourseId, width: number, height: number): CameraPreset {
  const base = FOCUS[course];
  if (width >= 720 && height >= 620) {
    return base;
  }
  return {
    position: [base.position[0] * 0.92, base.position[1] * 0.96, base.position[2] * 1.18],
    target: [base.target[0], base.target[1] - 0.2, base.target[2]],
    fov: base.fov + 6,
  };
}

export function getCameraPreset(
  course: CourseId,
  phase: SequencePhase,
  width: number,
  height: number,
  reducedMotion: boolean,
): CameraPreset {
  if (phase !== "running" || reducedMotion) {
    return getHeroCamera(width, height);
  }
  return getFocusCamera(course, width, height);
}

export function interpolateCamera(from: CameraPreset, to: CameraPreset, progress: number): CameraPreset {
  const t = Number.isFinite(progress) ? Math.min(1, Math.max(0, progress)) : 0;
  const eased = t * t * (3 - 2 * t);
  const lerp = (a: number, b: number): number => a + (b - a) * eased;
  return {
    position: [lerp(from.position[0], to.position[0]), lerp(from.position[1], to.position[1]), lerp(from.position[2], to.position[2])],
    target: [lerp(from.target[0], to.target[0]), lerp(from.target[1], to.target[1]), lerp(from.target[2], to.target[2])],
    fov: lerp(from.fov, to.fov),
  };
}
