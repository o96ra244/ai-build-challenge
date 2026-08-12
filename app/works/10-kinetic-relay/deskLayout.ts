export type Vector3Tuple = readonly [number, number, number];
export type RotationTuple = readonly [number, number, number];

export type BoxDefinition = {
  readonly id: string;
  readonly size: Vector3Tuple;
  readonly position: Vector3Tuple;
  readonly rotation: RotationTuple;
  readonly material: "desk" | "book" | "ruler" | "paper" | "wood" | "rubber" | "metal" | "wall" | "blue";
};

export const FUNCTIONAL_LAYOUT = {
  deskSurface: {
    id: "desk-surface",
    size: [12, 0.24, 7] as const,
    position: [0, -0.12, 0] as const,
    rotation: [0, 0, 0] as const,
    material: "desk",
  },
  redRamp: {
    id: "red-marble-ramp",
    size: [4.3, 0.18, 1.25] as const,
    position: [-3.15, 1.34, -1.1] as const,
    rotation: [0, 0, -0.44] as const,
    material: "ruler",
  },
  eraserRest: {
    id: "eraser-rest",
    size: [0.82, 0.08, 0.86] as const,
    position: [-0.88, 0.16, -1.1] as const,
    rotation: [0, 0, 0] as const,
    material: "paper",
  },
  carRamp: {
    id: "toy-car-book-ramp",
    size: [3.15, 0.22, 1.28] as const,
    position: [3.68, 0.62, -0.18] as const,
    rotation: [0, 0, 0.34] as const,
    material: "book",
  },
  blueRamp: {
    id: "blue-marble-ramp",
    size: [1.9, 0.16, 0.92] as const,
    position: [3.55, 0.53, 0.95] as const,
    rotation: [0, 0, -0.16] as const,
    material: "ruler",
  },
  seesawRuler: {
    id: "seesaw-ruler",
    size: [2.55, 0.1, 0.38] as const,
    position: [2.9, 0.33, -0.18] as const,
    rotation: [0, 0, 0] as const,
    material: "ruler",
  },
  balanceRuler: {
    id: "balance-ruler",
    size: [2.2, 0.1, 0.34] as const,
    position: [4.65, 0.3, 0.95] as const,
    rotation: [0, 0, 0] as const,
    material: "ruler",
  },
  cupBottom: {
    id: "paper-cup-bottom",
    size: [0.76, 0.1, 0.76] as const,
    position: [4.58, 0.22, 0.95] as const,
    rotation: [0, 0, 0] as const,
    material: "paper",
  },
} satisfies Record<string, BoxDefinition>;

export const SENSOR_LAYOUT = {
  redMarbleImpact: { size: [0.7, 0.7, 1.2] as const, position: [-0.95, 0.48, -1.1] as const },
  clothespin: { size: [1.25, 0.9, 1.3] as const, position: [-0.3, 0.35, -1.1] as const },
  firstBlock: { size: [0.42, 0.72, 0.82] as const, position: [1.45, 0.4, -1.1] as const },
  lastBlock: { size: [0.32, 0.72, 0.82] as const, position: [4.48, 0.4, -1.1] as const },
  carSeesaw: { size: [0.8, 0.75, 1.35] as const, position: [2.02, 0.5, -0.18] as const },
  paperCup: { size: [0.9, 0.75, 0.92] as const, position: [4.58, 0.48, 0.95] as const },
  bell: { size: [0.72, 0.9, 0.76] as const, position: [5.42, 0.58, -0.02] as const },
} as const;

export const BODY_LAYOUT = {
  redMarble: { position: [-5.0, 2.4, -1.1] as const, radius: 0.22 },
  eraser: { position: [-0.9, 0.48, -1.1] as const, size: [0.62, 0.26, 0.42] as const },
  pencil: { position: [0.58, 0.2, -1.1] as const, size: [1.6, 0.12, 0.12] as const },
  blocks: [
    [1.48, 0.38, -1.1],
    [1.9, 0.38, -1.1],
    [2.32, 0.38, -1.1],
    [2.74, 0.38, -1.1],
    [3.16, 0.38, -1.1],
    [3.58, 0.38, -1.1],
    [4.0, 0.38, -1.1],
  ] as const,
  blockSize: [0.28, 0.7, 0.5] as const,
  car: { position: [4.82, 1.14, -0.18] as const, size: [0.82, 0.3, 0.48] as const },
  blueMarble: { position: [2.72, 0.77, 0.95] as const, radius: 0.2 },
} as const;

export const MECHANISM_LAYOUT = {
  redStopper: { position: [-4.84, 2.45, -1.1] as const, size: [0.16, 0.48, 1.0] as const },
  carChock: { position: [4.88, 0.76, -0.18] as const, size: [0.16, 0.7, 0.76] as const },
  blueStopper: { position: [2.62, 0.75, 0.95] as const, size: [0.14, 0.52, 0.72] as const },
  pivotSeesaw: [2.9, 0.35, -0.18] as const,
  pivotBalance: [4.65, 0.34, 0.95] as const,
  strikerStart: [5.34, 1.0, -0.02] as const,
} as const;

export const ROOM_LAYOUT = {
  wall: { size: [13, 6, 0.16] as const, position: [0, 3.0, -3.45] as const },
  shelf: { size: [2.1, 2.25, 0.42] as const, position: [-4.85, 1.15, -3.08] as const },
  shelfTop: { size: [2.5, 0.18, 0.58] as const, position: [-4.85, 2.35, -3.02] as const },
} as const;

export const BLOCK_COLORS = ["#c88b57", "#d7a76d", "#a66c4b", "#d4b276", "#b77a50", "#c9965d", "#ab704b"] as const;
