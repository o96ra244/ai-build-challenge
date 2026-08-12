import type { CourseId, SequenceState } from "./machineSequence";

export type CameraPreset = {
  readonly position: readonly [number, number, number];
  readonly target: readonly [number, number, number];
  readonly fov: number;
};

export type CameraShot = CameraPreset & {
  readonly id: string;
  readonly duration: number;
};

const HERO: CameraPreset = {
  position: [14.8, 10.6, 18.8],
  target: [0, 4.95, 0.05],
  fov: 34,
};

const MOBILE_HERO: CameraPreset = {
  position: [17.5, 12.5, 35.5],
  target: [0, 4.9, 0.05],
  fov: 43,
};

const SHOTS: Record<CourseId, readonly CameraShot[]> = {
  A: [
    { id: "machine-hero", duration: 2.2, position: [14.8, 10.6, 18.8], target: [0, 4.95, 0.05], fov: 34 },
    { id: "selector-close", duration: 2.0, position: [8.6, 8.4, 12.8], target: [-2.2, 7.55, 0.4], fov: 31 },
    { id: "release-gate", duration: 2.6, position: [5.6, 7.0, 10.2], target: [-4.2, 7.15, 0.05], fov: 31 },
    { id: "helix-three-quarter", duration: 5.0, position: [7.6, 6.0, 12.6], target: [-4.1, 5.55, 0.06], fov: 34 },
    { id: "rocker-paddles", duration: 5.0, position: [5.4, 4.7, 9.2], target: [-2.7, 3.98, 0.16], fov: 32 },
    { id: "hammer-return", duration: 4.2, position: [7.9, 4.3, 11.8], target: [-1.5, 2.1, -0.12], fov: 34 },
    { id: "common-goal", duration: 2.8, position: [6.2, 3.2, 9.6], target: [0, 1.5, -0.55], fov: 32 },
    { id: "machine-hero-out", duration: 1.8, position: [14.8, 10.6, 18.8], target: [0, 4.95, 0.05], fov: 34 },
  ],
  B: [
    { id: "machine-hero", duration: 2.2, position: [14.8, 10.6, 18.8], target: [0, 4.95, 0.05], fov: 34 },
    { id: "selector-close", duration: 2.0, position: [8.4, 8.3, 12.6], target: [0, 7.55, 0.45], fov: 31 },
    { id: "switchback", duration: 4.4, position: [6.8, 6.3, 11.8], target: [0, 5.8, 0.1], fov: 34 },
    { id: "pendulum", duration: 3.4, position: [5.6, 7.1, 10.8], target: [-0.85, 5.18, 0.48], fov: 31 },
    { id: "gear-train", duration: 5.0, position: [4.6, 5.2, 8.8], target: [0.25, 4.62, 0.65], fov: 30 },
    { id: "rack-drop", duration: 4.4, position: [5.3, 4.0, 9.2], target: [0.7, 3.05, 0.45], fov: 31 },
    { id: "common-goal", duration: 2.8, position: [6.2, 3.2, 9.6], target: [0, 1.5, -0.55], fov: 32 },
    { id: "machine-hero-out", duration: 1.8, position: [14.8, 10.6, 18.8], target: [0, 4.95, 0.05], fov: 34 },
  ],
  C: [
    { id: "machine-hero", duration: 2.2, position: [14.8, 10.6, 18.8], target: [0, 4.95, 0.05], fov: 34 },
    { id: "selector-close", duration: 2.0, position: [8.5, 8.3, 12.6], target: [2.1, 7.55, 0.45], fov: 31 },
    { id: "glass-funnel", duration: 5.4, position: [8.4, 7.4, 13.6], target: [4.8, 5.88, 0.04], fov: 32 },
    { id: "balance", duration: 3.6, position: [6.4, 5.25, 10.4], target: [5.12, 4.36, 0.18], fov: 30 },
    { id: "orbit-rail", duration: 5.0, position: [7.2, 4.65, 11.2], target: [4.6, 3.45, 0.08], fov: 32 },
    { id: "turbine-return", duration: 4.2, position: [6.6, 3.6, 10.2], target: [3.9, 2.55, 0.12], fov: 31 },
    { id: "common-goal", duration: 2.8, position: [6.2, 3.2, 9.6], target: [0, 1.5, -0.55], fov: 32 },
    { id: "machine-hero-out", duration: 1.8, position: [14.8, 10.6, 18.8], target: [0, 4.95, 0.05], fov: 34 },
  ],
};

export function getHeroCamera(width: number, height: number): CameraPreset {
  return width < 720 || height < 620 ? MOBILE_HERO : HERO;
}

export function getSelectorCamera(width: number, height: number): CameraPreset {
  const mobile = width < 720 || height < 620;
  return mobile
    ? { position: [10.4, 8.5, 17.8], target: [0, 7.62, 0.42], fov: 38 }
    : { position: [8.6, 8.15, 12.9], target: [0, 7.62, 0.42], fov: 31 };
}

export function getFocusCamera(course: CourseId, width: number, height: number): CameraPreset {
  const shot: CameraPreset = course === "A"
    ? { position: [8.8, 6.3, 12.5], target: [-3.4, 5.0, 0.04], fov: 33 }
    : course === "B"
      ? { position: [7.4, 6.2, 11.7], target: [0, 4.8, 0.28], fov: 32 }
      : { position: [8.7, 6.2, 12.8], target: [3.35, 4.7, 0.12], fov: 33 };
  if (width >= 720 && height >= 620) return shot;
  return {
    position: [shot.position[0] * 0.86, shot.position[1] * 0.92, shot.position[2] * 1.22],
    target: [shot.target[0], shot.target[1] - 0.12, shot.target[2]],
    fov: shot.fov + 7,
  };
}

export function getCameraShots(course: CourseId): readonly CameraShot[] {
  return SHOTS[course];
}

export function getCameraShot(course: CourseId, elapsed: number): CameraShot {
  const shots = getCameraShots(course);
  let remaining = Number.isFinite(elapsed) ? Math.max(0, elapsed) : 0;
  for (const shot of shots) {
    if (remaining <= shot.duration) return shot;
    remaining -= shot.duration;
  }
  return shots[shots.length - 1] ?? { id: "machine-hero", duration: 1, ...HERO };
}

export function getCameraPreset(
  course: CourseId,
  phase: SequenceState["phase"],
  width: number,
  height: number,
  reducedMotion: boolean,
  elapsed = 0,
): CameraPreset {
  if (phase !== "running" || reducedMotion) return getHeroCamera(width, height);
  return getCameraShot(course, elapsed);
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
