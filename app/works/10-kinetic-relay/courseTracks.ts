import * as THREE from "three";

import type { CourseId } from "./machineSequence";

export const COURSE_X: Record<CourseId, number> = { A: -4.8, B: 0, C: 4.8 };
export const COMMON_GOAL: readonly [number, number, number] = [0, 1.42, -0.78];
export const MARBLE_RADIUS = 0.22;

export type MachineTracks = {
  readonly start: Record<CourseId, THREE.CatmullRomCurve3>;
  readonly helix: THREE.CatmullRomCurve3;
  readonly rocker: THREE.CatmullRomCurve3;
  readonly paddles: THREE.CatmullRomCurve3;
  readonly returnA: THREE.CatmullRomCurve3;
  readonly switchback: THREE.CatmullRomCurve3;
  readonly pendulum: THREE.CatmullRomCurve3;
  readonly gearTrain: THREE.CatmullRomCurve3;
  readonly drop: THREE.CatmullRomCurve3;
  readonly returnB: THREE.CatmullRomCurve3;
  readonly funnelFeed: THREE.CatmullRomCurve3;
  readonly funnel: THREE.CatmullRomCurve3;
  readonly balance: THREE.CatmullRomCurve3;
  readonly orbit: THREE.CatmullRomCurve3;
  readonly turbine: THREE.CatmullRomCurve3;
  readonly returnC: THREE.CatmullRomCurve3;
  readonly secondaryOrbit: THREE.CatmullRomCurve3;
};

function curve(points: readonly THREE.Vector3[], closed = false): THREE.CatmullRomCurve3 {
  return new THREE.CatmullRomCurve3(points.map((point) => point.clone()), closed, "centripetal", 0.25);
}

function line(start: THREE.Vector3, end: THREE.Vector3): THREE.CatmullRomCurve3 {
  return curve([start, start.clone().lerp(end, 0.48), end]);
}

function offsetPoints(source: THREE.CatmullRomCurve3, offset: readonly [number, number, number], count = 48): THREE.Vector3[] {
  return Array.from({ length: count + 1 }, (_, index) => {
    const point = source.getPointAt(index / count);
    return point.add(new THREE.Vector3(...offset));
  });
}

export function createParallelCurve(
  source: THREE.CatmullRomCurve3,
  offset: readonly [number, number, number],
  count = 96,
): THREE.CatmullRomCurve3 {
  return curve(offsetPoints(source, offset, count));
}

export function createMachineTracks(): MachineTracks {
  const a = COURSE_X.A;
  const b = COURSE_X.B;
  const c = COURSE_X.C;

  const helix = curve(Array.from({ length: 96 }, (_, index) => {
    const t = index / 95;
    const angle = -Math.PI * 0.62 + t * Math.PI * 4.1;
    return new THREE.Vector3(
      a + Math.cos(angle) * (1.12 - t * 0.13),
      7.18 - t * 2.55,
      Math.sin(angle) * (0.72 - t * 0.04) + 0.1,
    );
  }));
  const rockerEnd = new THREE.Vector3(a + 1.68, 4.28, 0.2);
  const rocker = curve([helix.getPointAt(1), new THREE.Vector3(a + 0.6, 4.42, 0.15), rockerEnd]);
  const paddles = curve([
    rockerEnd,
    new THREE.Vector3(a + 2.25, 4.05, 0.16),
    new THREE.Vector3(a + 3.18, 3.72, 0.09),
  ]);
  const returnA = curve([
    paddles.getPointAt(1),
    new THREE.Vector3(a + 2.62, 3.08, -0.08),
    new THREE.Vector3(a + 1.55, 2.35, -0.25),
    new THREE.Vector3(0, COMMON_GOAL[1], COMMON_GOAL[2]),
  ]);

  const switchback = curve([
    new THREE.Vector3(b, 7.18, 0.05),
    new THREE.Vector3(b + 1.12, 6.72, 0.1),
    new THREE.Vector3(b - 1.18, 6.22, 0.15),
    new THREE.Vector3(b + 1.16, 5.65, 0.16),
    new THREE.Vector3(b - 0.92, 5.08, 0.18),
    new THREE.Vector3(b + 0.52, 4.64, 0.2),
  ]);
  const pendulum = curve([
    switchback.getPointAt(1),
    new THREE.Vector3(b + 1.05, 4.32, 0.25),
    new THREE.Vector3(b + 1.28, 4.05, 0.22),
  ]);
  const gearTrain = curve([
    pendulum.getPointAt(1),
    new THREE.Vector3(b + 0.78, 3.72, 0.26),
    new THREE.Vector3(b + 0.22, 3.45, 0.24),
  ]);
  const drop = line(gearTrain.getPointAt(1), new THREE.Vector3(b + 0.22, 2.48, 0.12));
  const returnB = curve([
    drop.getPointAt(1),
    new THREE.Vector3(b + 0.62, 2.02, -0.18),
    new THREE.Vector3(0, COMMON_GOAL[1], COMMON_GOAL[2]),
  ]);

  const funnelFeed = curve([
    new THREE.Vector3(c, 7.18, 0.02),
    new THREE.Vector3(c, 6.72, 0.02),
    new THREE.Vector3(c, 6.32, 0.02),
  ]);
  const funnel = curve(Array.from({ length: 72 }, (_, index) => {
    const t = index / 71;
    const angle = -Math.PI * 0.32 + t * Math.PI * 4.2;
    const radius = 1.13 * (1 - t * 0.86) + 0.1;
    return new THREE.Vector3(c + Math.cos(angle) * radius, 6.17 - t * 1.08, Math.sin(angle) * radius * 0.72);
  }));
  const balance = curve([
    funnel.getPointAt(1),
    new THREE.Vector3(c - 0.28, 4.72, 0.06),
    new THREE.Vector3(c + 0.72, 4.42, 0.08),
  ]);
  const orbit = curve(Array.from({ length: 80 }, (_, index) => {
    const t = index / 79;
    const angle = -Math.PI * 0.22 + t * Math.PI * 2.25;
    return new THREE.Vector3(c + Math.cos(angle) * 1.28, 3.52, Math.sin(angle) * 0.74 + 0.06);
  }));
  const turbine = curve([
    orbit.getPointAt(1),
    new THREE.Vector3(c - 0.04, 3.02, 0.12),
    new THREE.Vector3(c - 0.34, 2.65, 0.08),
  ]);
  const returnC = curve([
    turbine.getPointAt(1),
    new THREE.Vector3(c - 0.72, 2.18, -0.12),
    new THREE.Vector3(0, COMMON_GOAL[1], COMMON_GOAL[2]),
  ]);
  const secondaryOrbit = curve(Array.from({ length: 64 }, (_, index) => {
    const t = index / 63;
    const angle = Math.PI * 0.18 - t * Math.PI * 1.85;
    return new THREE.Vector3(c + Math.cos(angle) * 0.78, 4.55 + Math.sin(angle) * 0.22, 0.28 + Math.sin(angle) * 0.46);
  }));

  const start: Record<CourseId, THREE.CatmullRomCurve3> = {
    A: line(new THREE.Vector3(a, 7.72, 0), helix.getPointAt(0)),
    B: line(new THREE.Vector3(b, 7.72, 0), switchback.getPointAt(0)),
    C: line(new THREE.Vector3(c, 7.72, 0), funnelFeed.getPointAt(0)),
  };

  return {
    start,
    helix,
    rocker,
    paddles,
    returnA,
    switchback,
    pendulum,
    gearTrain,
    drop,
    returnB,
    funnelFeed,
    funnel,
    balance,
    orbit,
    turbine,
    returnC,
    secondaryOrbit,
  };
}

export function sampleCurve(curveToSample: THREE.CatmullRomCurve3, progress: number, target = new THREE.Vector3()): THREE.Vector3 {
  const safeProgress = Number.isFinite(progress) ? Math.min(1, Math.max(0, progress)) : 0;
  return target.copy(curveToSample.getPointAt(safeProgress));
}

export function sampleGuideTarget(
  course: CourseId,
  stageId: string,
  stageProgress: number,
  tracks: MachineTracks,
  target = new THREE.Vector3(),
): THREE.Vector3 {
  const p = Number.isFinite(stageProgress) ? Math.min(1, Math.max(0, stageProgress)) : 0;
  if (stageId === "release") return sampleCurve(tracks.start[course], p, target);
  if (course === "A") {
    if (stageId === "helix") return sampleCurve(tracks.helix, p, target);
    if (stageId === "rocker") return sampleCurve(tracks.rocker, p, target);
    if (stageId === "paddle-bank") return sampleCurve(tracks.paddles, p, target);
    if (stageId === "hammer") return sampleCurve(tracks.paddles, p, target);
    return sampleCurve(tracks.returnA, p, target);
  }
  if (course === "B") {
    if (stageId === "switchback") return sampleCurve(tracks.switchback, p, target);
    if (stageId === "pendulum") return sampleCurve(tracks.pendulum, p, target);
    if (stageId === "gear-train") return sampleCurve(tracks.gearTrain, p, target);
    if (stageId === "lift-gate" || stageId === "drop") return sampleCurve(tracks.drop, p, target);
    return sampleCurve(tracks.returnB, p, target);
  }
  if (stageId === "glass-funnel") return sampleCurve(tracks.funnelFeed, p * 0.35, target).lerp(tracks.funnel.getPointAt(p), Math.min(1, p * 1.55));
  if (stageId === "balance") return sampleCurve(tracks.balance, p, target);
  if (stageId === "second-marble") return sampleCurve(tracks.balance, p, target);
  if (stageId === "orbit-rail") return sampleCurve(tracks.orbit, p, target);
  if (stageId === "turbine") return sampleCurve(tracks.turbine, p, target);
  return sampleCurve(tracks.returnC, p, target);
}

export function sampleSecondaryTarget(stageId: string, stageProgress: number, tracks: MachineTracks, target = new THREE.Vector3()): THREE.Vector3 {
  if (stageId === "second-marble" || stageId === "orbit-rail") {
    return sampleCurve(tracks.secondaryOrbit, stageProgress, target);
  }
  return target.set(COURSE_X.C - 0.78, 4.52, 0.28);
}
