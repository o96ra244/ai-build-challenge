import type { Vector3Tuple } from "./roverModel";

export type Point2 = readonly [number, number];

export type YardSurface =
  | "start-pad"
  | "slope"
  | "whoops"
  | "log"
  | "crates"
  | "rocks"
  | "jump"
  | "boundary"
  | "yard";

export type YardObjectKind =
  | "ground"
  | "start-pad"
  | "slope"
  | "whoop"
  | "log"
  | "crate"
  | "rock"
  | "jump-ramp"
  | "fence"
  | "decoration";

export type YardShape =
  | { readonly type: "box"; readonly size: Vector3Tuple }
  | { readonly type: "cylinder"; readonly radius: number; readonly height: number; readonly axis: "x" | "y" }
  | { readonly type: "rock"; readonly size: Vector3Tuple; readonly roundness: number }
  | {
    readonly type: "ramp";
    readonly width: number;
    readonly height: number;
    readonly depth: number;
    readonly risingToward: "front" | "back";
  };

export type YardObjectDefinition = {
  readonly id: string;
  readonly kind: YardObjectKind;
  readonly position: Vector3Tuple;
  readonly rotation: Vector3Tuple;
  readonly scale: Vector3Tuple;
  readonly bodyType: "fixed" | "dynamic" | "none";
  readonly collider: YardShape | null;
  readonly visual: "ground" | "pad" | "ramp" | "whoop" | "log" | "crate" | "rock" | "fence" | "decoration";
};

export const YARD_BOUNDS = {
  minX: -24,
  maxX: 24,
  minZ: -18,
  maxZ: 18,
} as const;

export const YARD_WIDTH = YARD_BOUNDS.maxX - YARD_BOUNDS.minX;
export const YARD_DEPTH = YARD_BOUNDS.maxZ - YARD_BOUNDS.minZ;

export const YARD_START = {
  x: 0,
  y: 1.9,
  z: 14,
  heading: 0,
} as const;

const box = (size: Vector3Tuple): YardShape => ({ type: "box", size });
const cylinder = (radius: number, height: number, axis: "x" | "y"): YardShape => ({ type: "cylinder", radius, height, axis });
const rock = (size: Vector3Tuple): YardShape => ({ type: "rock", size, roundness: 0.2 });
const ramp = (width: number, height: number, depth: number, risingToward: "front" | "back"): YardShape => ({
  type: "ramp",
  width,
  height,
  depth,
  risingToward,
});

function definition(
  id: string,
  kind: YardObjectKind,
  position: Vector3Tuple,
  shape: YardShape | null,
  bodyType: YardObjectDefinition["bodyType"],
  visual: YardObjectDefinition["visual"],
  rotation: Vector3Tuple = [0, 0, 0],
): YardObjectDefinition {
  return { id, kind, position, rotation, scale: [1, 1, 1], bodyType, collider: shape, visual };
}

/**
 * The dimensions below are the single source used by both Three.js geometry
 * and Rapier colliders. The yard intentionally fits in one readable screen.
 */
export const YARD_OBJECTS: readonly YardObjectDefinition[] = [
  definition("yard-floor", "ground", [0, -0.35, 0], box([YARD_WIDTH, 0.7, YARD_DEPTH]), "fixed", "ground"),
  definition("start-pad", "start-pad", [0, 0.04, 14], null, "none", "pad"),
  definition("slope-up", "slope", [0, 0, 7], ramp(7.5, 1.65, 7, "front"), "fixed", "ramp"),
  definition("slope-down", "slope", [-12, 0, 7], ramp(6.8, 1.35, 6, "back"), "fixed", "ramp"),
  definition("whoop-01", "whoop", [8, 0.36, 10], cylinder(0.36, 4.8, "x"), "fixed", "whoop"),
  definition("whoop-02", "whoop", [8, 0.36, 6.8], cylinder(0.36, 4.8, "x"), "fixed", "whoop"),
  definition("whoop-03", "whoop", [8, 0.36, 3.6], cylinder(0.36, 4.8, "x"), "fixed", "whoop"),
  definition("log-crossing", "log", [-9, 0.56, -1.2], cylinder(0.56, 5.8, "x"), "fixed", "log"),
  definition("crate-a", "crate", [7, 0.65, -3.4], box([1.8, 1.3, 1.8]), "dynamic", "crate", [0, 0.08, 0]),
  definition("crate-b", "crate", [10, 0.65, -5.1], box([1.8, 1.3, 1.8]), "dynamic", "crate", [0, -0.12, 0]),
  definition("crate-c", "crate", [6.3, 0.65, -6.3], box([1.8, 1.3, 1.8]), "dynamic", "crate", [0, 0.2, 0]),
  definition("rock-a", "rock", [-10, 0.72, -7.1], rock([3.4, 1.45, 2.8]), "fixed", "rock", [0, -0.16, 0]),
  definition("rock-b", "rock", [-5.7, 0.62, -8.8], rock([2.8, 1.25, 2.5]), "fixed", "rock", [0, 0.24, 0]),
  definition("jump-ramp", "jump-ramp", [0.5, 0, -11.2], ramp(6, 1.55, 5.2, "front"), "fixed", "ramp"),
  definition("fence-west", "fence", [-23.65, 0.65, 0], box([0.7, 1.3, YARD_DEPTH]), "fixed", "fence"),
  definition("fence-east", "fence", [23.65, 0.65, 0], box([0.7, 1.3, YARD_DEPTH]), "fixed", "fence"),
  definition("fence-north", "fence", [0, 0.65, -17.65], box([YARD_WIDTH, 1.3, 0.7]), "fixed", "fence"),
  definition("fence-south", "fence", [0, 0.65, 17.65], box([YARD_WIDTH, 1.3, 0.7]), "fixed", "fence"),
] as const;

export const RAMP_INDICES: readonly number[] = [
  0, 2, 1, 1, 2, 3,
  0, 1, 5, 0, 5, 4,
  2, 4, 5, 2, 5, 3,
  0, 4, 2,
  1, 3, 5,
];

export function getRampVertices(shape: Extract<YardShape, { readonly type: "ramp" }>): readonly number[] {
  const halfWidth = shape.width / 2;
  const halfDepth = shape.depth / 2;
  const highZ = shape.risingToward === "front" ? -halfDepth : halfDepth;
  const lowZ = -highZ;
  return [
    -halfWidth, 0, lowZ,
    halfWidth, 0, lowZ,
    -halfWidth, 0, highZ,
    halfWidth, 0, highZ,
    -halfWidth, shape.height, highZ,
    halfWidth, shape.height, highZ,
  ];
}

export function getShapeVertices(shape: YardShape): readonly number[] | null {
  return shape.type === "ramp" ? getRampVertices(shape) : null;
}

export function getYardObject(id: string): YardObjectDefinition | undefined {
  return YARD_OBJECTS.find((object) => object.id === id);
}

export function getDynamicYardObjects(): readonly YardObjectDefinition[] {
  return YARD_OBJECTS.filter((object) => object.bodyType === "dynamic");
}

export function getFixedYardObjects(): readonly YardObjectDefinition[] {
  return YARD_OBJECTS.filter((object) => object.bodyType === "fixed");
}

function finiteOr(value: number, fallback = 0): number {
  return Number.isFinite(value) ? value : fallback;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, finiteOr(value, min)));
}

export function clampToYardBounds(x: number, z: number, margin = 1.8): Point2 {
  const safeMargin = Math.max(0, finiteOr(margin));
  return [
    clamp(x, YARD_BOUNDS.minX + safeMargin, YARD_BOUNDS.maxX - safeMargin),
    clamp(z, YARD_BOUNDS.minZ + safeMargin, YARD_BOUNDS.maxZ - safeMargin),
  ];
}

export function isInsideYardBounds(x: number, z: number, margin = 0): boolean {
  const safeMargin = Math.max(0, finiteOr(margin));
  return Number.isFinite(x)
    && Number.isFinite(z)
    && x >= YARD_BOUNDS.minX + safeMargin
    && x <= YARD_BOUNDS.maxX - safeMargin
    && z >= YARD_BOUNDS.minZ + safeMargin
    && z <= YARD_BOUNDS.maxZ - safeMargin;
}

export type YardZone = {
  readonly surface: YardSurface;
  readonly label: string;
};

export function getYardZone(x: number, z: number): YardZone {
  if (x > -3.5 && x < 3.5 && z > 11) {
    return { surface: "start-pad", label: "START PAD" };
  }
  if (x > -4.2 && x < 4.2 && z > 3.2 && z < 10.8) {
    return { surface: "slope", label: "UP / DOWN SLOPE" };
  }
  if (x > 5.2 && x < 10.8 && z > 1.8 && z < 11.8) {
    return { surface: "whoops", label: "LOW WHOOPS" };
  }
  if (x > -12.2 && x < -5.8 && z > -3.3 && z < 0.8) {
    return { surface: "log", label: "LOG CROSSING" };
  }
  if (x > 4.5 && x < 12.2 && z > -7.6 && z < -2.2) {
    return { surface: "crates", label: "CRATE LANE" };
  }
  if (x > -13.5 && x < -3.2 && z > -11.2 && z < -5.2) {
    return { surface: "rocks", label: "ROCK GATE" };
  }
  if (x > -3 && x < 4.2 && z > -14.2 && z < -8.1) {
    return { surface: "jump", label: "JUMP RAMP" };
  }
  if (!isInsideYardBounds(x, z, 1)) {
    return { surface: "boundary", label: "BOUNDARY" };
  }
  return { surface: "yard", label: "YARD FLOOR" };
}
