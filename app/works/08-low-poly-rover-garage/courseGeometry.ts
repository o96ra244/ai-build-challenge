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
  minX: -60,
  maxX: 60,
  minZ: -45,
  maxZ: 45,
} as const;

export const TRACK_WIDTH = 5.4;

/** A fixed, closed, non-elliptical route inside the larger free-drive field. */
export const COURSE_CENTERLINE: readonly Point2[] = [
  [0, 34],
  [20, 34],
  [37, 24],
  [46, 8],
  [40, -12],
  [24, -27],
  [3, -25],
  [-28, -34],
  [-48, -16],
  [-43, 5],
  [-25, 26],
  [-7, 37],
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
  { id: "stone-east", x: 29, z: 30.5, radius: 1.2 },
  { id: "stone-south-east", x: 43, z: 1, radius: 1.35 },
  { id: "tire-south", x: 33, z: -33, radius: 0.95 },
  { id: "stone-south-west", x: -15, z: -39, radius: 1.3 },
  { id: "stone-west", x: -54, z: -7, radius: 1.2 },
  { id: "tire-north-west", x: -53, z: 13, radius: 0.92 },
  { id: "stone-north", x: -20, z: 41, radius: 1.15 },
  { id: "post-north-east", x: 11, z: 26, radius: 0.62 },
  { id: "stone-field-east", x: 34, z: -16, radius: 1.2 },
  { id: "stone-field-center", x: 4, z: 12, radius: 1.1 },
  { id: "tire-field-west", x: -25, z: -4, radius: 0.95 },
  { id: "stone-field-south", x: -4, z: -8, radius: 1.15 },
] as const;

const TERRAIN_HILLS: readonly {
  readonly x: number;
  readonly z: number;
  readonly height: number;
  readonly spreadX: number;
  readonly spreadZ: number;
}[] = [
  { x: -30, z: 21, height: 5.8, spreadX: 11, spreadZ: 12 },
  { x: 28, z: 23, height: 4.2, spreadX: 13, spreadZ: 11 },
  { x: -25, z: -20, height: 4.6, spreadX: 12, spreadZ: 10 },
  { x: 30, z: -22, height: 3.7, spreadX: 10, spreadZ: 12 },
  { x: 0, z: 0, height: 1.5, spreadX: 24, spreadZ: 18 },
] as const;

const TERRAIN_STEPS: readonly {
  readonly x: number;
  readonly z: number;
  readonly width: number;
  readonly depth: number;
  readonly height: number;
  readonly edge: number;
}[] = [
  { x: -28, z: 22, width: 14, depth: 16, height: 1.25, edge: 1.5 },
  { x: 17, z: -10, width: 18, depth: 12, height: 0.95, edge: 1.7 },
  { x: -12, z: -27, width: 16, depth: 10, height: 1.1, edge: 1.6 },
] as const;

function smoothStep(value: number): number {
  const t = Math.max(0, Math.min(1, finiteOr(value)));
  return t * t * (3 - 2 * t);
}

function softRectBand(value: number, halfExtent: number, edge: number): number {
  const safeHalfExtent = Math.max(0.1, finiteOr(halfExtent, 1));
  const safeEdge = Math.max(0.1, finiteOr(edge, 1));
  return smoothStep((safeHalfExtent + safeEdge - Math.abs(finiteOr(value))) / safeEdge);
}

export function getTerrainHeight(x: number, z: number): number {
  const safeX = finiteOr(x);
  const safeZ = finiteOr(z);
  let height = 0.9 * Math.sin(safeX * 0.075)
    + 0.7 * Math.cos(safeZ * 0.09)
    + 0.5 * Math.sin((safeX - safeZ) * 0.12)
    + 0.35 * Math.cos((safeX + safeZ) * 0.17);

  for (const hill of TERRAIN_HILLS) {
    const dx = (safeX - hill.x) / hill.spreadX;
    const dz = (safeZ - hill.z) / hill.spreadZ;
    height += hill.height * Math.exp(-0.5 * (dx * dx + dz * dz));
  }

  for (const step of TERRAIN_STEPS) {
    height += step.height
      * softRectBand(safeX - step.x, step.width / 2, step.edge)
      * softRectBand(safeZ - step.z, step.depth / 2, step.edge);
  }

  return finiteOr(height);
}

export function getTerrainNormal(x: number, z: number): Vector3Tuple {
  const safeX = finiteOr(x);
  const safeZ = finiteOr(z);
  const sample = 0.65;
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
