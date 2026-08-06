import type { Vector3Tuple } from "./roverModel";

export type Point2 = readonly [number, number];

export const FRONTIER_BOUNDS = {
  minX: -160,
  maxX: 160,
  minZ: -120,
  maxZ: 120,
} as const;

export const FRONTIER_WIDTH = FRONTIER_BOUNDS.maxX - FRONTIER_BOUNDS.minX;
export const FRONTIER_DEPTH = FRONTIER_BOUNDS.maxZ - FRONTIER_BOUNDS.minZ;
export const HEIGHTFIELD_COLUMNS = 81;
export const HEIGHTFIELD_ROWS = 61;

export type SurfaceType = "meadow" | "dirt" | "stone" | "loose-soil";
export type FrontierMode = "free-roam" | "waystone-run";

export type FrontierAreaId =
  | "base-camp-meadow"
  | "spiralwood-grove"
  | "crystal-ravine"
  | "windstep-hills"
  | "ancient-stoneworks"
  | "sky-arch-summit";

export type FrontierArea = {
  readonly id: FrontierAreaId;
  readonly label: string;
  readonly minX: number;
  readonly maxX: number;
  readonly minZ: number;
  readonly maxZ: number;
  readonly center: Point2;
  readonly surface: SurfaceType;
};

export type ClimbableObstacle = {
  readonly id: string;
  readonly kind: "rock" | "ledge" | "log";
  readonly x: number;
  readonly z: number;
  readonly radius: number;
  readonly height: number;
};

export type FixedObstacle = {
  readonly id: string;
  readonly kind: "boulder" | "pillar" | "ruin";
  readonly x: number;
  readonly z: number;
  readonly radius: number;
  readonly height: number;
};

export type DynamicProp = {
  readonly id: string;
  readonly kind: "box" | "rock" | "log";
  readonly x: number;
  readonly z: number;
  readonly radius: number;
  readonly height: number;
  readonly mass: number;
};

export type Waystone = {
  readonly id: string;
  readonly index: number;
  readonly label: string;
  readonly x: number;
  readonly z: number;
  readonly radius: number;
  readonly areaId: FrontierAreaId;
};

export type FrontierLandmark = {
  readonly id: string;
  readonly kind: "camp" | "spiral-tree" | "crystal" | "wind-tower" | "stonework" | "sky-arch";
  readonly x: number;
  readonly z: number;
  readonly scale: number;
  readonly areaId: FrontierAreaId;
};

const AREA_DEFINITIONS: readonly FrontierArea[] = [
  {
    id: "base-camp-meadow",
    label: "BASE CAMP MEADOW",
    minX: -155,
    maxX: -58,
    minZ: -115,
    maxZ: -38,
    center: [-112, -78],
    surface: "meadow",
  },
  {
    id: "spiralwood-grove",
    label: "SPIRALWOOD GROVE",
    minX: -105,
    maxX: -8,
    minZ: -48,
    maxZ: 50,
    center: [-72, 10],
    surface: "meadow",
  },
  {
    id: "crystal-ravine",
    label: "CRYSTAL RAVINE",
    minX: -4,
    maxX: 70,
    minZ: -105,
    maxZ: -30,
    center: [36, -70],
    surface: "stone",
  },
  {
    id: "windstep-hills",
    label: "WINDSTEP HILLS",
    minX: 54,
    maxX: 155,
    minZ: -104,
    maxZ: 2,
    center: [108, -50],
    surface: "loose-soil",
  },
  {
    id: "ancient-stoneworks",
    label: "ANCIENT STONEWORKS",
    minX: 45,
    maxX: 155,
    minZ: 12,
    maxZ: 105,
    center: [105, 60],
    surface: "stone",
  },
  {
    id: "sky-arch-summit",
    label: "SKY ARCH SUMMIT",
    minX: -40,
    maxX: 50,
    minZ: 55,
    maxZ: 115,
    center: [3, 88],
    surface: "loose-soil",
  },
] as const;

export const FRONTIER_AREAS = AREA_DEFINITIONS;

export const FRONTIER_START: { readonly x: number; readonly z: number; readonly heading: number } = {
  x: -122,
  z: -78,
  heading: 0,
} as const;

export const CLIMBABLE_OBSTACLES: readonly ClimbableObstacle[] = [
  { id: "root-01", kind: "log", x: -94, z: -28, radius: 2.6, height: 0.72 },
  { id: "root-02", kind: "log", x: -55, z: 12, radius: 2.4, height: 0.65 },
  { id: "rock-hop-01", kind: "rock", x: -24, z: -10, radius: 2.8, height: 1.15 },
  { id: "rock-hop-02", kind: "rock", x: 12, z: -20, radius: 2.5, height: 0.95 },
  { id: "whoop-01", kind: "ledge", x: 82, z: -82, radius: 3.4, height: 1.1 },
  { id: "whoop-02", kind: "ledge", x: 112, z: -29, radius: 3.1, height: 0.9 },
  { id: "step-01", kind: "rock", x: 73, z: 27, radius: 2.5, height: 0.85 },
  { id: "step-02", kind: "rock", x: 34, z: 73, radius: 2.8, height: 1.2 },
  { id: "summit-rock-01", kind: "rock", x: -20, z: 95, radius: 2.6, height: 1.0 },
  { id: "summit-rock-02", kind: "rock", x: 20, z: 102, radius: 2.4, height: 0.8 },
] as const;

export const FIXED_OBSTACLES: readonly FixedObstacle[] = [
  { id: "stone-pillar-01", kind: "pillar", x: 68, z: 54, radius: 2.2, height: 5.2 },
  { id: "stone-pillar-02", kind: "pillar", x: 91, z: 52, radius: 2.1, height: 4.6 },
  { id: "stone-pillar-03", kind: "pillar", x: 116, z: 72, radius: 2.3, height: 5.4 },
  { id: "ruin-block-01", kind: "ruin", x: 135, z: 35, radius: 3.2, height: 2.4 },
  { id: "ruin-block-02", kind: "ruin", x: 82, z: 89, radius: 3.1, height: 2.6 },
  { id: "boulder-01", kind: "boulder", x: -8, z: -84, radius: 3.4, height: 2.5 },
  { id: "boulder-02", kind: "boulder", x: 52, z: -56, radius: 3.1, height: 2.1 },
  { id: "boulder-03", kind: "boulder", x: -45, z: 72, radius: 3.0, height: 2.2 },
] as const;

export const DYNAMIC_PROPS: readonly DynamicProp[] = [
  { id: "crate-01", kind: "box", x: -139, z: -57, radius: 1.1, height: 1.4, mass: 18 },
  { id: "crate-02", kind: "box", x: -134, z: -57, radius: 1.1, height: 1.4, mass: 18 },
  { id: "crate-03", kind: "box", x: -129, z: -57, radius: 1.1, height: 1.4, mass: 18 },
  { id: "loose-rock-01", kind: "rock", x: -80, z: -18, radius: 1.3, height: 1.2, mass: 22 },
  { id: "loose-rock-02", kind: "rock", x: -36, z: 27, radius: 1.5, height: 1.35, mass: 26 },
  { id: "loose-rock-03", kind: "rock", x: 20, z: -38, radius: 1.4, height: 1.25, mass: 24 },
  { id: "loose-rock-04", kind: "rock", x: 63, z: -8, radius: 1.2, height: 1.0, mass: 20 },
  { id: "log-01", kind: "log", x: 96, z: -71, radius: 2.2, height: 0.8, mass: 30 },
  { id: "log-02", kind: "log", x: 122, z: -66, radius: 2.1, height: 0.85, mass: 30 },
  { id: "crate-04", kind: "box", x: 69, z: 38, radius: 1.2, height: 1.6, mass: 20 },
  { id: "crate-05", kind: "box", x: 75, z: 38, radius: 1.2, height: 1.6, mass: 20 },
  { id: "loose-rock-05", kind: "rock", x: 111, z: 27, radius: 1.4, height: 1.25, mass: 24 },
  { id: "loose-rock-06", kind: "rock", x: 129, z: 84, radius: 1.5, height: 1.4, mass: 26 },
  { id: "log-03", kind: "log", x: 8, z: 67, radius: 2.0, height: 0.75, mass: 28 },
  { id: "crate-06", kind: "box", x: -17, z: 78, radius: 1.1, height: 1.4, mass: 18 },
  { id: "loose-rock-07", kind: "rock", x: -58, z: 94, radius: 1.4, height: 1.25, mass: 22 },
  { id: "crate-07", kind: "box", x: -110, z: -91, radius: 1.1, height: 1.35, mass: 18 },
  { id: "loose-rock-08", kind: "rock", x: -145, z: -84, radius: 1.3, height: 1.1, mass: 20 },
] as const;

export const WAYSTONES: readonly Waystone[] = [
  { id: "waystone-meadow", index: 0, label: "MEADOW", x: -118, z: -78, radius: 5.2, areaId: "base-camp-meadow" },
  { id: "waystone-spiralwood", index: 1, label: "SPIRALWOOD", x: -72, z: 10, radius: 5.2, areaId: "spiralwood-grove" },
  { id: "waystone-crystal", index: 2, label: "CRYSTAL", x: 36, z: -70, radius: 5.2, areaId: "crystal-ravine" },
  { id: "waystone-windstep", index: 3, label: "WINDSTEP", x: 108, z: -50, radius: 5.2, areaId: "windstep-hills" },
  { id: "waystone-stoneworks", index: 4, label: "STONEWORKS", x: 105, z: 60, radius: 5.2, areaId: "ancient-stoneworks" },
  { id: "waystone-summit", index: 5, label: "SUMMIT", x: 3, z: 88, radius: 5.2, areaId: "sky-arch-summit" },
] as const;

export const FRONTIER_LANDMARKS: readonly FrontierLandmark[] = [
  { id: "landmark-camp", kind: "camp", x: -142, z: -95, scale: 1.4, areaId: "base-camp-meadow" },
  { id: "landmark-spiralwood", kind: "spiral-tree", x: -92, z: 28, scale: 1.5, areaId: "spiralwood-grove" },
  { id: "landmark-crystal", kind: "crystal", x: 18, z: -91, scale: 1.5, areaId: "crystal-ravine" },
  { id: "landmark-windstep", kind: "wind-tower", x: 142, z: -78, scale: 1.5, areaId: "windstep-hills" },
  { id: "landmark-stoneworks", kind: "stonework", x: 137, z: 83, scale: 1.4, areaId: "ancient-stoneworks" },
  { id: "landmark-sky-arch", kind: "sky-arch", x: -28, z: 108, scale: 1.6, areaId: "sky-arch-summit" },
] as const;

function finiteOr(value: number, fallback = 0): number {
  if (!Number.isFinite(value)) {
    return fallback;
  }

  return Object.is(value, -0) ? 0 : value;
}

function smoothStep(value: number): number {
  const t = Math.max(0, Math.min(1, finiteOr(value)));
  return t * t * (3 - 2 * t);
}

function softRect(value: number, halfExtent: number, edge: number): number {
  const safeValue = Math.abs(finiteOr(value));
  const safeEdge = Math.max(0.1, finiteOr(edge, 1));
  return smoothStep((Math.max(0.1, finiteOr(halfExtent, 1)) + safeEdge - safeValue) / safeEdge);
}

function gaussian(x: number, z: number, centerX: number, centerZ: number, spreadX: number, spreadZ: number, height: number): number {
  const dx = (x - centerX) / Math.max(0.1, spreadX);
  const dz = (z - centerZ) / Math.max(0.1, spreadZ);
  return height * Math.exp(-0.5 * (dx * dx + dz * dz));
}

export function getFrontierHeight(x: number, z: number): number {
  const safeX = finiteOr(x);
  const safeZ = finiteOr(z);
  let height = 1.1
    + 1.8 * Math.sin(safeX * 0.026)
    + 1.35 * Math.cos(safeZ * 0.031)
    + 0.85 * Math.sin((safeX + safeZ) * 0.044)
    + 0.55 * Math.cos((safeX - safeZ) * 0.067);

  const hills: readonly [number, number, number, number, number][] = [
    [-104, -28, 4.5, 30, 22],
    [-18, 42, 5.8, 24, 28],
    [82, -24, 7.0, 34, 25],
    [116, 76, 5.8, 28, 32],
    [-12, 92, 7.5, 27, 22],
  ];
  for (const [centerX, centerZ, hillHeight, spreadX, spreadZ] of hills) {
    height += gaussian(safeX, safeZ, centerX, centerZ, spreadX, spreadZ, hillHeight);
  }

  const whoops = [
    [-2, -72, 2.0, 12],
    [18, -68, 2.2, 10],
    [38, -64, 1.8, 11],
    [58, -60, 2.1, 12],
  ] as const;
  for (const [centerX, centerZ, bumpHeight, spread] of whoops) {
    height += gaussian(safeX, safeZ, centerX, centerZ, spread, spread * 0.55, bumpHeight);
  }

  height += 1.5 * softRect(safeX - 72, 4.5, 5.2) * softRect(safeZ - 30, 25, 4.8);
  height += 1.2 * softRect(safeX - 31, 25, 5.5) * softRect(safeZ - 70, 4.5, 5.2);
  height += 1.1 * softRect(safeX + 92, 34, 5.2) * softRect(safeZ + 4, 3.5, 4.8);

  return finiteOr(Math.max(-3, Math.min(30, height)));
}

export function getFrontierNormal(x: number, z: number): Vector3Tuple {
  const safeX = finiteOr(x);
  const safeZ = finiteOr(z);
  const sample = 1.8;
  const dx = (getFrontierHeight(safeX + sample, safeZ) - getFrontierHeight(safeX - sample, safeZ)) / (sample * 2);
  const dz = (getFrontierHeight(safeX, safeZ + sample) - getFrontierHeight(safeX, safeZ - sample)) / (sample * 2);
  const length = Math.hypot(dx, 1, dz);
  if (!Number.isFinite(length) || length < 0.0001) {
    return [0, 1, 0];
  }

  return [finiteOr(-dx / length), finiteOr(1 / length, 1), finiteOr(-dz / length)];
}

export function getHeightfieldIndex(column: number, row: number): number {
  const safeColumn = Math.max(0, Math.min(HEIGHTFIELD_COLUMNS - 1, Math.floor(finiteOr(column))));
  const safeRow = Math.max(0, Math.min(HEIGHTFIELD_ROWS - 1, Math.floor(finiteOr(row))));
  return safeColumn * HEIGHTFIELD_ROWS + safeRow;
}

export const HEIGHTFIELD_HEIGHTS = new Float32Array(
  Array.from({ length: HEIGHTFIELD_ROWS * HEIGHTFIELD_COLUMNS }, (_, index) => {
    const column = Math.floor(index / HEIGHTFIELD_ROWS);
    const row = index % HEIGHTFIELD_ROWS;
    const x = FRONTIER_BOUNDS.minX + FRONTIER_WIDTH * column / (HEIGHTFIELD_COLUMNS - 1);
    const z = FRONTIER_BOUNDS.minZ + FRONTIER_DEPTH * row / (HEIGHTFIELD_ROWS - 1);
    return getFrontierHeight(x, z);
  }),
);

export function isInsideFrontierBounds(x: number, z: number, margin = 0): boolean {
  const safeX = finiteOr(x);
  const safeZ = finiteOr(z);
  const safeMargin = Math.max(0, finiteOr(margin));
  return safeX >= FRONTIER_BOUNDS.minX + safeMargin
    && safeX <= FRONTIER_BOUNDS.maxX - safeMargin
    && safeZ >= FRONTIER_BOUNDS.minZ + safeMargin
    && safeZ <= FRONTIER_BOUNDS.maxZ - safeMargin;
}

export function clampToFrontierBounds(x: number, z: number, margin = 2): Point2 {
  const safeMargin = Math.max(0, finiteOr(margin));
  const minX = FRONTIER_BOUNDS.minX + safeMargin;
  const maxX = FRONTIER_BOUNDS.maxX - safeMargin;
  const minZ = FRONTIER_BOUNDS.minZ + safeMargin;
  const maxZ = FRONTIER_BOUNDS.maxZ - safeMargin;
  return [
    finiteOr(Math.max(minX, Math.min(maxX, finiteOr(x, minX))), minX),
    finiteOr(Math.max(minZ, Math.min(maxZ, finiteOr(z, minZ))), minZ),
  ];
}

export function getFrontierArea(x: number, z: number): FrontierArea {
  const safeX = finiteOr(x);
  const safeZ = finiteOr(z);
  const area = FRONTIER_AREAS.find((candidate) => safeX >= candidate.minX
    && safeX <= candidate.maxX
    && safeZ >= candidate.minZ
    && safeZ <= candidate.maxZ);
  if (area) {
    return area;
  }

  let nearest = FRONTIER_AREAS[0];
  let nearestDistance = Number.POSITIVE_INFINITY;
  for (const candidate of FRONTIER_AREAS) {
    const distance = Math.hypot(safeX - candidate.center[0], safeZ - candidate.center[1]);
    if (distance < nearestDistance) {
      nearest = candidate;
      nearestDistance = distance;
    }
  }
  return nearest;
}

export function getSurfaceType(x: number, z: number): SurfaceType {
  const safeX = finiteOr(x);
  const safeZ = finiteOr(z);
  if (safeX > 50 && safeZ > 12) {
    return "stone";
  }
  if (safeZ < -35 && safeX > -8) {
    return "stone";
  }
  if (safeX > 48 || safeZ > 55) {
    return "loose-soil";
  }
  if (Math.sin(safeX * 0.09) + Math.cos(safeZ * 0.07) > 1.1) {
    return "dirt";
  }
  return getFrontierArea(safeX, safeZ).surface;
}

export function worldToMinimap(x: number, z: number): Point2 {
  const clamped = clampToFrontierBounds(x, z, 0);
  return [
    finiteOr((clamped[0] - FRONTIER_BOUNDS.minX) / FRONTIER_WIDTH),
    finiteOr((clamped[1] - FRONTIER_BOUNDS.minZ) / FRONTIER_DEPTH),
  ];
}

export function isFiniteFrontierPoint(point: Point2): boolean {
  return point.every((value) => Number.isFinite(value) && !Object.is(value, -0));
}
