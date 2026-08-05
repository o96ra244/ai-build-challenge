import type { Vector3Tuple } from "./roverModel";

export type Point2 = readonly [number, number];

export type CourseObstacle = {
  readonly id: string;
  readonly x: number;
  readonly z: number;
  readonly radius: number;
};

export type CourseCheckpoint = {
  readonly index: number;
  readonly x: number;
  readonly z: number;
  readonly radius: number;
  readonly heading: number;
};

export type TrackDistance = {
  readonly distance: number;
  readonly onTrack: boolean;
  readonly segmentIndex: number;
  readonly closest: Point2;
};

export const TERRAIN_BOUNDS = {
  minX: -19.5,
  maxX: 19.5,
  minZ: -14.5,
  maxZ: 14.5,
} as const;

export const TRACK_WIDTH = 5.4;

/** A fixed, closed, non-elliptical route with straights and mixed corners. */
export const COURSE_CENTERLINE: readonly Point2[] = [
  [0, 11],
  [7, 11],
  [13, 7],
  [15, 1],
  [12, -6],
  [6, -10],
  [-2, -9],
  [-11, -11],
  [-17, -5],
  [-15, 2],
  [-9, 8],
  [-3, 12],
] as const;

function finiteOr(value: number, fallback = 0): number {
  if (!Number.isFinite(value)) {
    return fallback;
  }

  return Object.is(value, -0) ? 0 : value;
}

function safePoint(x: number, z: number): Point2 {
  return [finiteOr(x), finiteOr(z)];
}

function normalize2D(x: number, z: number): Point2 {
  const length = Math.hypot(x, z);
  if (!Number.isFinite(length) || length < 0.0001) {
    return [1, 0];
  }

  return [finiteOr(x / length, 1), finiteOr(z / length)];
}

export function getCourseTangent(segmentIndex: number): Point2 {
  const safeIndex = Number.isFinite(segmentIndex)
    ? Math.max(0, Math.min(COURSE_CENTERLINE.length - 1, Math.floor(segmentIndex)))
    : 0;
  const current = COURSE_CENTERLINE[safeIndex] ?? COURSE_CENTERLINE[0];
  const next = COURSE_CENTERLINE[(safeIndex + 1) % COURSE_CENTERLINE.length] ?? COURSE_CENTERLINE[0];
  return normalize2D(next[0] - current[0], next[1] - current[1]);
}

export function getCourseHeading(segmentIndex: number): number {
  const tangent = getCourseTangent(segmentIndex);
  return finiteOr(Math.atan2(tangent[0], tangent[1]));
}

export const START_POSITION: Point2 = COURSE_CENTERLINE[0];
export const START_HEADING = getCourseHeading(0);

export const COURSE_CHECKPOINTS: readonly CourseCheckpoint[] = [2, 5, 8, 10].map((pointIndex, index) => {
  const point = COURSE_CENTERLINE[pointIndex] ?? START_POSITION;
  return {
    index,
    x: point[0],
    z: point[1],
    radius: 2.7,
    heading: getCourseHeading(pointIndex),
  };
});

export const COURSE_OBSTACLES: readonly CourseObstacle[] = [
  { id: "stone-east", x: 10.9, z: 10.9, radius: 0.9 },
  { id: "stone-south-east", x: 15.8, z: -1.5, radius: 1.05 },
  { id: "tire-south", x: 8.1, z: -11.4, radius: 0.82 },
  { id: "stone-south-west", x: -5.3, z: -13.2, radius: 1.05 },
  { id: "stone-west", x: -17.7, z: -7.5, radius: 0.92 },
  { id: "tire-north-west", x: -18.1, z: 1.9, radius: 0.78 },
  { id: "stone-north", x: -7.2, z: 12.8, radius: 0.88 },
  { id: "post-north-east", x: 4.4, z: 9.4, radius: 0.5 },
] as const;

const BUMPS: readonly {
  readonly x: number;
  readonly z: number;
  readonly height: number;
  readonly spread: number;
}[] = [
  { x: 8.2, z: 9.2, height: 0.28, spread: 2.7 },
  { x: 10.5, z: -6.9, height: 0.34, spread: 2.5 },
  { x: -7.8, z: -9.7, height: 0.25, spread: 2.9 },
  { x: -14, z: 3.5, height: 0.3, spread: 2.4 },
] as const;

export function getTerrainHeight(x: number, z: number): number {
  const safeX = finiteOr(x);
  const safeZ = finiteOr(z);
  let height = 0.1 * Math.sin(safeX * 0.24) + 0.08 * Math.cos(safeZ * 0.31);

  for (const bump of BUMPS) {
    const dx = safeX - bump.x;
    const dz = safeZ - bump.z;
    height += bump.height * Math.exp(-(dx * dx + dz * dz) / (2 * bump.spread * bump.spread));
  }

  return finiteOr(height);
}

export function getTerrainNormal(x: number, z: number): Vector3Tuple {
  const safeX = finiteOr(x);
  const safeZ = finiteOr(z);
  const sample = 0.28;
  const dx = (getTerrainHeight(safeX + sample, safeZ) - getTerrainHeight(safeX - sample, safeZ)) / (sample * 2);
  const dz = (getTerrainHeight(safeX, safeZ + sample) - getTerrainHeight(safeX, safeZ - sample)) / (sample * 2);
  const length = Math.hypot(dx, 1, dz);
  if (!Number.isFinite(length) || length < 0.0001) {
    return [0, 1, 0];
  }

  return [finiteOr(-dx / length), finiteOr(1 / length, 1), finiteOr(-dz / length)];
}

function distanceToSegment(
  x: number,
  z: number,
  start: Point2,
  end: Point2,
): { readonly distance: number; readonly closest: Point2 } {
  const dx = end[0] - start[0];
  const dz = end[1] - start[1];
  const lengthSquared = dx * dx + dz * dz;
  const projection = lengthSquared > 0
    ? ((x - start[0]) * dx + (z - start[1]) * dz) / lengthSquared
    : 0;
  const t = Math.max(0, Math.min(1, finiteOr(projection)));
  const closest: Point2 = [
    finiteOr(start[0] + dx * t),
    finiteOr(start[1] + dz * t),
  ];
  return {
    distance: finiteOr(Math.hypot(x - closest[0], z - closest[1])),
    closest,
  };
}

export function getTrackDistance(x: number, z: number): TrackDistance {
  const safeX = finiteOr(x);
  const safeZ = finiteOr(z);
  let closest: Point2 = COURSE_CENTERLINE[0] ?? [0, 0];
  let distance = Number.POSITIVE_INFINITY;
  let segmentIndex = 0;

  for (let index = 0; index < COURSE_CENTERLINE.length; index += 1) {
    const start = COURSE_CENTERLINE[index] ?? COURSE_CENTERLINE[0];
    const end = COURSE_CENTERLINE[(index + 1) % COURSE_CENTERLINE.length] ?? COURSE_CENTERLINE[0];
    const candidate = distanceToSegment(safeX, safeZ, start, end);
    if (candidate.distance < distance) {
      distance = candidate.distance;
      closest = candidate.closest;
      segmentIndex = index;
    }
  }

  const safeDistance = finiteOr(distance);
  return {
    distance: safeDistance,
    onTrack: safeDistance <= TRACK_WIDTH / 2,
    segmentIndex,
    closest: safePoint(closest[0], closest[1]),
  };
}

export function isInsideTerrainBounds(x: number, z: number): boolean {
  const safeX = finiteOr(x);
  const safeZ = finiteOr(z);
  return safeX >= TERRAIN_BOUNDS.minX
    && safeX <= TERRAIN_BOUNDS.maxX
    && safeZ >= TERRAIN_BOUNDS.minZ
    && safeZ <= TERRAIN_BOUNDS.maxZ;
}
