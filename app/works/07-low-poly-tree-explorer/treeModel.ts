export type Vector3Tuple = readonly [number, number, number];

export type TreePartGroup =
  | "ground"
  | "trunk"
  | "branch"
  | "inner-leaf"
  | "outer-leaf"
  | "decoration";

export type MaterialCategory =
  | "ground"
  | "soil"
  | "trunk"
  | "branch"
  | "inner-leaf"
  | "outer-leaf"
  | "rock";

type CylinderGeometrySpec = {
  readonly kind: "cylinder";
  readonly radiusTop: number;
  readonly radiusBottom: number;
  readonly depth: number;
  readonly segments: number;
};

type BranchGeometrySpec = {
  readonly kind: "branch";
  readonly start: Vector3Tuple;
  readonly end: Vector3Tuple;
  readonly radius: number;
  readonly segments: number;
};

type PolyGeometrySpec = {
  readonly kind: "poly";
  readonly radius: number;
  readonly detail: number;
};

type IslandGeometrySpec = {
  readonly kind: "island";
  readonly radiusTop: number;
  readonly radiusBottom: number;
  readonly height: number;
  readonly segments: number;
};

export type TreeGeometrySpec =
  | CylinderGeometrySpec
  | BranchGeometrySpec
  | PolyGeometrySpec
  | IslandGeometrySpec;

export type TreePartDefinition = {
  readonly id: string;
  readonly group: TreePartGroup;
  readonly initialPosition: Vector3Tuple;
  readonly initialRotation: Vector3Tuple;
  readonly initialScale: Vector3Tuple;
  readonly explodeDirection: Vector3Tuple;
  readonly explodeDistance: number;
  readonly geometry: TreeGeometrySpec;
  readonly material: MaterialCategory;
};

export type TreeCameraPreset = {
  readonly position: Vector3Tuple;
  readonly target: Vector3Tuple;
  readonly fov: number;
  readonly minDistance: number;
  readonly maxDistance: number;
};

const ZERO: Vector3Tuple = [0, 0, 0];

function cylinder(
  radiusTop: number,
  radiusBottom: number,
  depth: number,
  segments = 6,
): CylinderGeometrySpec {
  return { kind: "cylinder", radiusTop, radiusBottom, depth, segments };
}

function branch(
  start: Vector3Tuple,
  end: Vector3Tuple,
  radius: number,
): BranchGeometrySpec {
  return { kind: "branch", start, end, radius, segments: 6 };
}

function leaf(radius: number, detail = 0): PolyGeometrySpec {
  return { kind: "poly", radius, detail };
}

function rock(radius: number, detail = 0): PolyGeometrySpec {
  return { kind: "poly", radius, detail };
}

function island(
  radiusTop: number,
  radiusBottom: number,
  height: number,
  segments = 7,
): IslandGeometrySpec {
  return { kind: "island", radiusTop, radiusBottom, height, segments };
}

function midPoint(start: Vector3Tuple, end: Vector3Tuple): Vector3Tuple {
  return [
    (start[0] + end[0]) / 2,
    (start[1] + end[1]) / 2,
    (start[2] + end[2]) / 2,
  ];
}

function part(
  id: string,
  group: TreePartGroup,
  initialPosition: Vector3Tuple,
  explodeDirection: Vector3Tuple,
  explodeDistance: number,
  geometry: TreeGeometrySpec,
  material: MaterialCategory,
  initialRotation: Vector3Tuple = ZERO,
  initialScale: Vector3Tuple = [1, 1, 1],
): TreePartDefinition {
  return {
    id,
    group,
    initialPosition,
    initialRotation,
    initialScale,
    explodeDirection,
    explodeDistance,
    geometry,
    material,
  };
}

export function createTreeParts(): readonly TreePartDefinition[] {
  const branchParts = [
    part(
      "branch-left",
      "branch",
      midPoint([-0.18, 2.9, 0], [-1.75, 4.15, 0.08]),
      [-1, 0.45, 0.12],
      0.82,
      branch([-0.18, 2.9, 0], [-1.75, 4.15, 0.08], 0.2),
      "branch",
    ),
    part(
      "branch-right",
      "branch",
      midPoint([0.2, 3.15, 0], [1.65, 4.35, -0.08]),
      [1, 0.42, -0.12],
      0.8,
      branch([0.2, 3.15, 0], [1.65, 4.35, -0.08], 0.18),
      "branch",
    ),
    part(
      "branch-back",
      "branch",
      midPoint([0.02, 3.75, -0.04], [-0.5, 5.05, -1.15]),
      [-0.2, 0.65, -1],
      0.72,
      branch([0.02, 3.75, -0.04], [-0.5, 5.05, -1.15], 0.16),
      "branch",
    ),
    part(
      "branch-front",
      "branch",
      midPoint([0.08, 3.65, 0.06], [0.55, 4.72, 1.05]),
      [0.42, 0.62, 1],
      0.7,
      branch([0.08, 3.65, 0.06], [0.55, 4.72, 1.05], 0.15),
      "branch",
    ),
    part(
      "branch-top",
      "branch",
      midPoint([-0.04, 4.2, 0], [0.2, 5.75, -0.12]),
      [0.18, 1, -0.08],
      0.62,
      branch([-0.04, 4.2, 0], [0.2, 5.75, -0.12], 0.14),
      "branch",
    ),
  ];

  const leafParts = [
    part(
      "leaf-center",
      "inner-leaf",
      [0, 6.05, 0],
      [0, 0.9, 0],
      0.68,
      leaf(1.2),
      "inner-leaf",
      [0.08, 0.2, -0.06],
      [1.48, 1.32, 1.36],
    ),
    part(
      "leaf-left",
      "outer-leaf",
      [-1.12, 5.22, 0.08],
      [-0.9, 0.55, 0.12],
      0.82,
      leaf(1.04),
      "outer-leaf",
      [-0.1, 0.35, 0.05],
      [1.35, 1.18, 1.2],
    ),
    part(
      "leaf-right",
      "outer-leaf",
      [1.14, 5.38, -0.08],
      [0.95, 0.6, -0.1],
      0.82,
      leaf(1.08),
      "outer-leaf",
      [0.12, -0.28, -0.08],
      [1.38, 1.18, 1.18],
    ),
    part(
      "leaf-back",
      "outer-leaf",
      [-0.42, 5.6, -0.9],
      [-0.24, 0.62, -0.95],
      0.76,
      leaf(0.98),
      "outer-leaf",
      [0.2, 0.1, 0.14],
      [1.26, 1.08, 1.18],
    ),
    part(
      "leaf-front",
      "outer-leaf",
      [0.42, 5.63, 0.9],
      [0.3, 0.65, 0.98],
      0.76,
      leaf(0.96),
      "outer-leaf",
      [-0.1, -0.2, -0.12],
      [1.22, 1.08, 1.16],
    ),
    part(
      "leaf-top",
      "outer-leaf",
      [0.12, 6.9, -0.06],
      [0.12, 1, -0.08],
      0.9,
      leaf(0.92),
      "outer-leaf",
      [0.1, 0.35, 0.1],
      [1.12, 1.25, 1.08],
    ),
    part(
      "leaf-high-left",
      "outer-leaf",
      [-0.8, 6.25, -0.2],
      [-0.7, 0.82, -0.12],
      0.7,
      leaf(0.78),
      "outer-leaf",
      [0, -0.3, 0.12],
      [1.08, 1.06, 1.04],
    ),
    part(
      "leaf-high-right",
      "outer-leaf",
      [0.84, 6.42, 0.12],
      [0.72, 0.9, 0.12],
      0.72,
      leaf(0.8),
      "outer-leaf",
      [0.1, 0.22, -0.14],
      [1.06, 1.08, 1.04],
    ),
  ];

  return [
    part(
      "ground-island",
      "ground",
      [0, 0.24, 0],
      [0, -0.35, 0.15],
      0.42,
      island(2.35, 2.72, 0.48),
      "ground",
    ),
    part(
      "ground-soil",
      "ground",
      [0, 0.51, 0],
      [0, -0.2, 0],
      0.24,
      cylinder(2.28, 2.42, 0.12, 7),
      "soil",
    ),
    part(
      "trunk-main",
      "trunk",
      [0, 2.22, 0],
      [0, 0.9, 0],
      0.5,
      cylinder(0.34, 0.56, 3.55, 6),
      "trunk",
      [0.02, 0, -0.03],
      [1, 1, 1],
    ),
    ...branchParts,
    ...leafParts,
    part(
      "rock-left",
      "decoration",
      [-1.75, 0.78, 0.42],
      [-0.8, -0.2, 0.32],
      0.42,
      rock(0.32),
      "rock",
      [0.2, 0.15, -0.1],
      [1.35, 0.72, 1],
    ),
    part(
      "rock-right",
      "decoration",
      [1.78, 0.74, -0.38],
      [0.82, -0.18, -0.28],
      0.42,
      rock(0.28),
      "rock",
      [-0.1, 0.4, 0.18],
      [1.28, 0.68, 1.05],
    ),
    part(
      "rock-front",
      "decoration",
      [0.8, 0.7, 1.42],
      [0.35, -0.18, 0.72],
      0.36,
      rock(0.22),
      "rock",
      [0.18, -0.25, 0.05],
      [1.1, 0.62, 1.16],
    ),
  ];
}

export const TREE_PARTS = createTreeParts();

export function clampExplodeProgress(value: number): number {
  if (Number.isNaN(value) || value === -Infinity) {
    return 0;
  }
  if (value === Infinity) {
    return 1;
  }
  return Math.min(1, Math.max(0, value)) || 0;
}

export function easeExplodeProgress(value: number): number {
  const progress = clampExplodeProgress(value);
  return 1 - (1 - progress) ** 3;
}

export function interpolateTuple(
  initial: Vector3Tuple,
  explodeDirection: Vector3Tuple,
  explodeDistance: number,
  progress: number,
): Vector3Tuple {
  const safeDistance = Number.isFinite(explodeDistance) && explodeDistance > 0
    ? explodeDistance
    : 0;
  const easedProgress = easeExplodeProgress(progress);
  return [
    initial[0] + explodeDirection[0] * safeDistance * easedProgress,
    initial[1] + explodeDirection[1] * safeDistance * easedProgress,
    initial[2] + explodeDirection[2] * safeDistance * easedProgress,
  ];
}

export function getExplodedPosition(
  partDefinition: TreePartDefinition,
  progress: number,
): Vector3Tuple {
  return interpolateTuple(
    partDefinition.initialPosition,
    partDefinition.explodeDirection,
    partDefinition.explodeDistance,
    progress,
  );
}

export function interpolateRotation(
  initial: Vector3Tuple,
  explodeRotation: Vector3Tuple,
  progress: number,
): Vector3Tuple {
  const easedProgress = easeExplodeProgress(progress);
  return [
    initial[0] + (explodeRotation[0] - initial[0]) * easedProgress,
    initial[1] + (explodeRotation[1] - initial[1]) * easedProgress,
    initial[2] + (explodeRotation[2] - initial[2]) * easedProgress,
  ];
}

export function isFiniteTuple(tuple: Vector3Tuple): boolean {
  return tuple.every((value) => Number.isFinite(value));
}

export function getCameraPreset(viewportWidth: number, viewportHeight: number): TreeCameraPreset {
  const safeWidth = Number.isFinite(viewportWidth) && viewportWidth > 0 ? viewportWidth : 1;
  const safeHeight = Number.isFinite(viewportHeight) && viewportHeight > 0 ? viewportHeight : 1;
  const aspect = safeWidth / safeHeight;
  const isMobile = safeWidth < 700 || aspect < 0.85;

  return {
    position: isMobile ? [8.1, 7.3, 11] : [8, 7.2, 10.1],
    target: [0, 3.35, 0],
    fov: isMobile ? 46 : 44,
    minDistance: 6.4,
    maxDistance: 15.5,
  };
}

export function getExplodeTransitionDuration(reducedMotion: boolean): number {
  return reducedMotion ? 90 : 760;
}

export function getOrbitDampingFactor(reducedMotion: boolean): number {
  return reducedMotion ? 0.14 : 0.08;
}

export function getInitialAutoRotate(reducedMotion: boolean): boolean {
  return !reducedMotion;
}

export function getAutoRotateAfterMotionPreference(
  reducedMotion: boolean,
  currentAutoRotate: boolean,
): boolean {
  return reducedMotion ? false : currentAutoRotate;
}
