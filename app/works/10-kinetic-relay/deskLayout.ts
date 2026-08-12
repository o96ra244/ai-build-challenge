export type Vector3Tuple = readonly [number, number, number];
export type RotationTuple = readonly [number, number, number];

export type MaterialKey =
  | "desk"
  | "deskEdge"
  | "book"
  | "ruler"
  | "paper"
  | "wood"
  | "woodDark"
  | "rubber"
  | "metal"
  | "wall"
  | "blue"
  | "green"
  | "goal"
  | "dark";

export type BoxDefinition = {
  readonly id: string;
  readonly size: Vector3Tuple;
  readonly position: Vector3Tuple;
  readonly rotation: RotationTuple;
  readonly material: MaterialKey;
};

export type MotionObjectId =
  | "redMarble"
  | "eraser"
  | "clothespin"
  | "rubberBand"
  | "pencil"
  | "firstBlock"
  | "blockChain"
  | "carChock"
  | "car"
  | "seesaw"
  | "blueGate"
  | "blueMarble"
  | "binderClip"
  | "tapeRoll"
  | "coloredPencils"
  | "paperCup"
  | "stringGate"
  | "thirdMarble"
  | "balance"
  | "striker"
  | "bell";

export type ChainMotion = {
  readonly id: string;
  readonly act: "ACT 1 / LEFT DESK" | "ACT 2 / CENTER DESK" | "ACT 3 / RIGHT DESK" | "ACT 4 / UPPER SHELF" | "ACT 5 / FINAL DESK";
  readonly label: string;
  readonly shortLabel: string;
  readonly cause: string;
  readonly objectId: MotionObjectId;
  readonly path: readonly Vector3Tuple[];
  readonly speed: number;
  readonly settle: number;
  readonly focus: Vector3Tuple;
  readonly kind: "travel" | "clothespin" | "rubberBand" | "blocks" | "gate" | "seesaw" | "cup" | "balance" | "bell";
};

export const ROOM_LAYOUT = {
  floor: { id: "room-floor", size: [25, 0.3, 16] as const, position: [0, -0.28, 0] as const, rotation: [0, 0, 0] as const, material: "desk" as const },
  backWall: { id: "back-wall", size: [25, 9, 0.18] as const, position: [0, 4.5, -5.8] as const, rotation: [0, 0, 0] as const, material: "wall" as const },
  leftWall: { id: "left-wall", size: [0.18, 9, 16] as const, position: [-12.3, 4.5, 0] as const, rotation: [0, 0, 0] as const, material: "wall" as const },
  deskTop: { id: "desk-top", size: [18, 0.3, 8] as const, position: [0, 0, 0] as const, rotation: [0, 0, 0] as const, material: "desk" as const },
  deskFront: { id: "desk-front", size: [18, 0.28, 0.16] as const, position: [0, -0.02, 3.92] as const, rotation: [0, 0, 0] as const, material: "deskEdge" as const },
  upperShelf: { id: "upper-shelf", size: [8.2, 0.28, 1.5] as const, position: [0.6, 4.05, -4.15] as const, rotation: [0, 0, 0] as const, material: "wood" as const },
  upperShelfEdge: { id: "upper-shelf-edge", size: [8.2, 0.18, 0.12] as const, position: [0.6, 3.9, -3.42] as const, rotation: [0, 0, 0] as const, material: "woodDark" as const },
  lowerShelf: { id: "lower-shelf", size: [4.8, 0.24, 1.45] as const, position: [-7.2, 2.55, -4.25] as const, rotation: [0, 0, 0] as const, material: "wood" as const },
  lowerShelfEdge: { id: "lower-shelf-edge", size: [4.8, 0.16, 0.12] as const, position: [-7.2, 2.42, -3.54] as const, rotation: [0, 0, 0] as const, material: "woodDark" as const },
} satisfies Record<string, BoxDefinition>;

export const TRACK_LAYOUT: readonly BoxDefinition[] = [
  { id: "red-book-base", size: [4.5, 0.45, 1.8], position: [-6.35, 0.44, -1.7], rotation: [0, 0, 0.02], material: "book" },
  { id: "red-ramp", size: [5.0, 0.18, 1.25], position: [-6.15, 1.55, -1.7], rotation: [0, 0, -0.25], material: "ruler" },
  { id: "center-track", size: [4.2, 0.12, 0.9], position: [-0.4, 0.26, -1.45], rotation: [0, 0, 0], material: "paper" },
  { id: "block-bridge", size: [4.1, 0.12, 0.8], position: [2.35, 0.28, -1.45], rotation: [0, 0, 0], material: "wood" },
  { id: "car-book-base", size: [4.7, 0.42, 1.7], position: [5.1, 0.42, -0.95], rotation: [0, 0, 0.02], material: "book" },
  { id: "car-ramp", size: [4.8, 0.2, 1.15], position: [5.25, 1.0, -0.95], rotation: [0, 0, 0.12], material: "book" },
  { id: "ruler-bridge-left", size: [2.5, 0.12, 0.12], position: [7.8, 1.6, -0.65], rotation: [0, 0, 0.03], material: "ruler" },
  { id: "ruler-bridge-right", size: [2.5, 0.12, 0.12], position: [7.8, 1.6, -1.25], rotation: [0, 0, 0.03], material: "ruler" },
  { id: "blue-long-ramp", size: [4.0, 0.16, 0.85], position: [9.25, 2.6, -0.7], rotation: [0, 0, 0.24], material: "ruler" },
  { id: "upper-tube-support", size: [2.6, 0.18, 1.0], position: [6.85, 3.35, -3.35], rotation: [0, 0, 0], material: "book" },
  { id: "switchback-a", size: [3.5, 0.14, 0.7], position: [5.15, 3.55, -4.0], rotation: [0, 0, -0.04], material: "ruler" },
  { id: "switchback-b", size: [2.8, 0.14, 0.7], position: [3.9, 3.25, -3.05], rotation: [0, 0, 0.2], material: "ruler" },
  { id: "tape-tunnel-track", size: [3.0, 0.14, 0.7], position: [2.5, 2.9, -1.9], rotation: [0, 0, -0.04], material: "paper" },
  { id: "sketchbook-ramp", size: [3.0, 0.18, 1.2], position: [-0.2, 1.85, -1.4], rotation: [0, 0, -0.18], material: "paper" },
  { id: "upper-marble-shelf", size: [7.0, 0.14, 0.85], position: [0.4, 4.38, -3.75], rotation: [0, 0, 0.02], material: "ruler" },
  { id: "return-chute", size: [3.2, 0.18, 1.0], position: [4.3, 2.2, -1.4], rotation: [0, 0, -0.22], material: "book" },
  { id: "final-ruler", size: [3.6, 0.12, 0.65], position: [5.9, 0.65, 1.1], rotation: [0, 0, 0.02], material: "ruler" },
] as const;

export const MOTION_OBJECT_STARTS: Readonly<Record<MotionObjectId, Vector3Tuple>> = {
  redMarble: [-8.3, 2.85, -1.7],
  eraser: [-4.15, 0.92, -1.7],
  clothespin: [-2.65, 0.42, -1.45],
  rubberBand: [-1.95, 0.38, -1.45],
  pencil: [-1.15, 0.36, -1.45],
  firstBlock: [0.65, 0.62, -1.45],
  blockChain: [1.2, 0.62, -1.45],
  carChock: [4.25, 0.62, -0.95],
  car: [4.55, 1.25, -0.95],
  seesaw: [9.95, 1.55, -0.95],
  blueGate: [10.9, 1.55, -0.65],
  blueMarble: [10.75, 2.45, -0.65],
  binderClip: [1.45, 2.7, -1.75],
  tapeRoll: [0.8, 2.45, -1.45],
  coloredPencils: [-1.5, 1.5, -1.4],
  paperCup: [-2.5, 1.22, -1.4],
  stringGate: [-2.5, 4.55, -3.75],
  thirdMarble: [-2.1, 4.72, -3.75],
  balance: [5.35, 1.0, 1.15],
  striker: [7.35, 1.25, 1.95],
  bell: [8.0, 0.55, 2.1],
};

export const CHAIN_MOTIONS: readonly ChainMotion[] = [
  { id: "stopper", act: "ACT 1 / LEFT DESK", label: "STOPPER → RED MARBLE", shortLabel: "RED MARBLE", cause: "red marble presses the wooden stopper", objectId: "redMarble", path: [[-8.3, 2.85, -1.7], [-8.3, 2.2, -1.7]], speed: 0.5, settle: 0.3, focus: [-8, 1.3, -1.7], kind: "gate" },
  { id: "red-ramp", act: "ACT 1 / LEFT DESK", label: "RED MARBLE / LONG RULER RAMP", shortLabel: "RULER RAMP", cause: "red marble travels down the long ruler ramp", objectId: "redMarble", path: [[-8.3, 2.2, -1.7], [-7.2, 1.95, -1.7], [-5.8, 1.55, -1.7], [-4.35, 1.0, -1.7]], speed: 0.7, settle: 0.6, focus: [-6.2, 1.4, -1.7], kind: "travel" },
  { id: "red-impact", act: "ACT 1 / LEFT DESK", label: "RED MARBLE → ERASER", shortLabel: "ERASER IMPACT", cause: "red marble rolls into the eraser", objectId: "eraser", path: [[-4.15, 0.92, -1.7], [-3.55, 0.92, -1.7]], speed: 0.6, settle: 0.5, focus: [-3.8, 0.8, -1.7], kind: "travel" },
  { id: "eraser-drop", act: "ACT 1 / LEFT DESK", label: "ERASER / SHORT DROP", shortLabel: "ERASER DROP", cause: "the eraser slips from the desk ledge", objectId: "eraser", path: [[-3.55, 0.92, -1.7], [-3.25, 0.52, -1.55], [-2.9, 0.3, -1.45]], speed: 0.5, settle: 0.6, focus: [-3.1, 0.55, -1.5], kind: "travel" },
  { id: "clothespin", act: "ACT 1 / LEFT DESK", label: "ERASER → CLOTHESPIN", shortLabel: "CLOTHESPIN", cause: "the falling eraser pushes the wooden clothespin", objectId: "clothespin", path: [[-2.65, 0.42, -1.45], [-2.05, 0.42, -1.45]], speed: 0.45, settle: 0.6, focus: [-2.35, 0.5, -1.45], kind: "clothespin" },
  { id: "rubber-band", act: "ACT 1 / LEFT DESK", label: "CLOTHESPIN → RUBBER BAND", shortLabel: "RUBBER BAND", cause: "the clothespin releases a stretched rubber band", objectId: "rubberBand", path: [[-1.95, 0.38, -1.45], [-0.65, 0.38, -1.45]], speed: 0.65, settle: 0.5, focus: [-1.3, 0.45, -1.45], kind: "rubberBand" },
  { id: "pencil", act: "ACT 1 / LEFT DESK", label: "RUBBER BAND → PENCIL", shortLabel: "PENCIL", cause: "the contracting band touches and moves the pencil", objectId: "pencil", path: [[-1.15, 0.36, -1.45], [-0.25, 0.36, -1.45], [1.5, 0.36, -1.45]], speed: 0.75, settle: 0.6, focus: [0.2, 0.4, -1.45], kind: "travel" },
  { id: "first-block", act: "ACT 2 / CENTER DESK", label: "PENCIL → FIRST BLOCK", shortLabel: "FIRST BLOCK", cause: "the pencil touches the first wooden block", objectId: "firstBlock", path: [[0.65, 0.62, -1.45], [1.15, 0.42, -1.45]], speed: 0.6, settle: 0.4, focus: [0.95, 0.5, -1.45], kind: "blocks" },
  { id: "block-chain", act: "ACT 2 / CENTER DESK", label: "WOODEN BLOCKS / LONG DOMINO CHAIN", shortLabel: "BLOCK CHAIN", cause: "each fallen block transfers force to the next", objectId: "blockChain", path: [[1.2, 0.62, -1.45], [2.0, 0.62, -1.45], [2.9, 0.62, -1.45], [4.15, 0.62, -1.45]], speed: 0.65, settle: 0.8, focus: [2.6, 0.7, -1.45], kind: "blocks" },
  { id: "chock", act: "ACT 2 / CENTER DESK", label: "LAST BLOCK → WHEEL CHOCK", shortLabel: "WHEEL CHOCK", cause: "the last block knocks the car chock loose", objectId: "carChock", path: [[4.25, 0.62, -0.95], [4.25, 0.22, -0.95]], speed: 0.5, settle: 0.5, focus: [4.25, 0.5, -0.95], kind: "gate" },
  { id: "car-ramp", act: "ACT 2 / CENTER DESK", label: "TOY CAR / BOOK RAMP", shortLabel: "TOY CAR", cause: "the released toy car rolls down the hardcover book ramp", objectId: "car", path: [[4.55, 1.25, -0.95], [5.5, 1.15, -0.95], [6.8, 0.9, -0.9], [7.75, 0.82, -0.8]], speed: 0.75, settle: 0.7, focus: [6.2, 0.95, -0.9], kind: "travel" },
  { id: "car-bridge", act: "ACT 2 / CENTER DESK", label: "TOY CAR / RULER BRIDGE", shortLabel: "RULER BRIDGE", cause: "the toy car crosses two supported rulers", objectId: "car", path: [[7.75, 0.82, -0.8], [8.55, 1.05, -0.65], [9.85, 1.35, -0.65]], speed: 0.75, settle: 0.5, focus: [8.8, 1.1, -0.65], kind: "travel" },
  { id: "seesaw", act: "ACT 2 / CENTER DESK", label: "TOY CAR → RULER SEESAW", shortLabel: "RULER SEESAW", cause: "the car settles onto the pivoting ruler", objectId: "seesaw", path: [[9.95, 1.55, -0.95], [10.5, 1.2, -0.95], [10.95, 0.8, -0.95]], speed: 0.45, settle: 1.0, focus: [10.3, 1.0, -0.9], kind: "seesaw" },
  { id: "blue-gate", act: "ACT 3 / RIGHT DESK", label: "SEESAW → BLUE MARBLE GATE", shortLabel: "BLUE GATE", cause: "the raised seesaw end lifts the marble gate", objectId: "blueGate", path: [[10.9, 1.55, -0.65], [10.9, 2.15, -0.65]], speed: 0.4, settle: 0.6, focus: [10.9, 1.8, -0.65], kind: "gate" },
  { id: "blue-ramp", act: "ACT 3 / RIGHT DESK", label: "BLUE MARBLE / UPPER RAMP", shortLabel: "BLUE MARBLE", cause: "the gate releases the blue marble onto the upper ruler", objectId: "blueMarble", path: [[10.75, 2.45, -0.65], [9.7, 2.75, -0.7], [8.45, 3.25, -1.55]], speed: 0.7, settle: 0.6, focus: [9.4, 2.8, -1.0], kind: "travel" },
  { id: "cardboard-tube", act: "ACT 3 / RIGHT DESK", label: "BLUE MARBLE / CARDBOARD TUBE", shortLabel: "CARDBOARD TUBE", cause: "the marble enters a supported cardboard tube", objectId: "blueMarble", path: [[8.45, 3.25, -1.55], [7.65, 3.25, -2.55], [6.75, 3.25, -3.45]], speed: 0.65, settle: 0.5, focus: [7.5, 3.25, -2.45], kind: "travel" },
  { id: "switchback", act: "ACT 3 / RIGHT DESK", label: "BLUE MARBLE / RULER SWITCHBACK", shortLabel: "SWITCHBACK", cause: "the marble follows the lower ruler switchback", objectId: "blueMarble", path: [[6.75, 3.25, -3.45], [5.6, 3.5, -3.95], [4.45, 3.3, -3.1], [3.85, 2.95, -2.2]], speed: 0.8, settle: 0.6, focus: [5.0, 3.25, -3.1], kind: "travel" },
  { id: "tape-tunnel", act: "ACT 3 / RIGHT DESK", label: "BLUE MARBLE / TAPE ROLL TUNNEL", shortLabel: "TAPE TUNNEL", cause: "the marble passes through a large masking tape roll", objectId: "blueMarble", path: [[3.85, 2.95, -2.2], [2.95, 2.85, -1.9], [1.85, 2.65, -1.65]], speed: 0.6, settle: 0.5, focus: [2.8, 2.7, -1.8], kind: "travel" },
  { id: "binder-gate", act: "ACT 3 / RIGHT DESK", label: "TAPE TUNNEL → BINDER CLIP", shortLabel: "BINDER CLIP", cause: "the marble strikes a binder-clip gate", objectId: "binderClip", path: [[1.45, 2.7, -1.75], [1.1, 2.2, -1.55]], speed: 0.5, settle: 0.5, focus: [1.3, 2.4, -1.65], kind: "gate" },
  { id: "tape-roll", act: "ACT 3 / RIGHT DESK", label: "BINDER CLIP → TAPE ROLL", shortLabel: "TAPE ROLL", cause: "the clip releases the masking tape roll", objectId: "tapeRoll", path: [[0.8, 2.45, -1.45], [0.15, 2.2, -1.45], [-1.2, 1.75, -1.35]], speed: 0.65, settle: 0.6, focus: [-0.2, 1.9, -1.4], kind: "travel" },
  { id: "colored-pencils", act: "ACT 3 / RIGHT DESK", label: "TAPE ROLL → COLORED PENCILS", shortLabel: "COLORED PENCILS", cause: "the tape roll hits a row of colored pencils", objectId: "coloredPencils", path: [[-1.5, 1.5, -1.4], [-2.25, 1.2, -1.4]], speed: 0.5, settle: 0.5, focus: [-1.9, 1.3, -1.4], kind: "blocks" },
  { id: "paper-cup", act: "ACT 4 / UPPER SHELF", label: "COLORED PENCILS → PAPER CUP", shortLabel: "PAPER CUP", cause: "the last pencil tips a paper cup off the shelf", objectId: "paperCup", path: [[-2.5, 1.22, -1.4], [-2.5, 0.82, -1.4]], speed: 0.35, settle: 0.7, focus: [-2.5, 1.0, -1.4], kind: "cup" },
  { id: "string-gate", act: "ACT 4 / UPPER SHELF", label: "CUP → STRING GATE", shortLabel: "STRING GATE", cause: "the cup pulls the visible string taut", objectId: "stringGate", path: [[-2.5, 4.55, -3.75], [-2.5, 5.0, -3.75]], speed: 0.35, settle: 0.7, focus: [-2.5, 4.7, -3.75], kind: "gate" },
  { id: "third-marble", act: "ACT 4 / UPPER SHELF", label: "STRING GATE → THIRD MARBLE", shortLabel: "THIRD MARBLE", cause: "the upper gate releases a yellow marble", objectId: "thirdMarble", path: [[-2.1, 4.72, -3.75], [-1.0, 4.72, -3.75], [0.2, 4.55, -3.75]], speed: 0.65, settle: 0.5, focus: [-0.8, 4.6, -3.75], kind: "travel" },
  { id: "shelf-track", act: "ACT 4 / UPPER SHELF", label: "THIRD MARBLE / UPPER RULER TRACK", shortLabel: "UPPER TRACK", cause: "the third marble rolls across the upper shelf", objectId: "thirdMarble", path: [[0.2, 4.55, -3.75], [1.4, 4.42, -3.75], [3.0, 4.25, -3.75]], speed: 0.65, settle: 0.6, focus: [1.8, 4.4, -3.75], kind: "travel" },
  { id: "return-chute", act: "ACT 4 / UPPER SHELF", label: "THIRD MARBLE / RETURN CHUTE", shortLabel: "RETURN CHUTE", cause: "the marble drops through the paper-tube return", objectId: "thirdMarble", path: [[3.0, 4.25, -3.75], [3.75, 3.5, -3.3], [4.45, 2.6, -2.5], [5.35, 1.25, 0.8]], speed: 0.7, settle: 0.7, focus: [4.2, 3.0, -1.8], kind: "travel" },
  { id: "balance", act: "ACT 5 / FINAL DESK", label: "THIRD MARBLE → BALANCE LEVER", shortLabel: "BALANCE LEVER", cause: "the marble lands on the hanging balance lever", objectId: "balance", path: [[5.35, 1.0, 1.15], [5.9, 0.82, 1.35]], speed: 0.4, settle: 0.8, focus: [5.7, 0.9, 1.3], kind: "balance" },
  { id: "striker", act: "ACT 5 / FINAL DESK", label: "BALANCE → BELL STRIKER", shortLabel: "BELL STRIKER", cause: "the opposite lever arm pushes the striker", objectId: "striker", path: [[7.35, 1.25, 1.95], [7.35, 0.62, 1.95]], speed: 0.4, settle: 0.6, focus: [7.35, 0.9, 1.95], kind: "travel" },
  { id: "bell", act: "ACT 5 / FINAL DESK", label: "GOAL BELL / FINISH FLAG", shortLabel: "GOAL BELL", cause: "the striker hits the desk bell and raises the flag", objectId: "bell", path: [[8.0, 0.55, 2.1], [8.0, 0.72, 2.1]], speed: 0.3, settle: 1.3, focus: [8.0, 0.95, 2.1], kind: "bell" },
] as const;

export const BLOCK_COLORS = ["#c88b57", "#d7a76d", "#a66c4b", "#d4b276", "#b77a50", "#c9965d", "#ab704b", "#d2a36a", "#9b6347", "#c38a55"] as const;

export const BLOCK_STARTS: readonly Vector3Tuple[] = [
  [0.65, 0.62, -1.45], [1.08, 0.62, -1.45], [1.51, 0.62, -1.45], [1.94, 0.62, -1.45], [2.37, 0.62, -1.45], [2.8, 0.62, -1.45], [3.23, 0.62, -1.45], [3.66, 0.62, -1.45], [4.09, 0.62, -1.45], [4.52, 0.62, -1.45],
] as const;

export const GOAL_LAYOUT = {
  bell: [8.0, 0.55, 2.1] as const,
  tag: [8.0, 2.05, 2.1] as const,
  flag: [8.65, 0.3, 2.22] as const,
  base: [8.0, 0.28, 2.1] as const,
} as const;

export const CHAIN_RUNTIME_TARGET_SECONDS = 108;

export function getPathLength(path: readonly Vector3Tuple[]): number {
  let length = 0;
  for (let index = 1; index < path.length; index += 1) {
    const previous = path[index - 1];
    const current = path[index];
    if (!previous || !current) continue;
    length += Math.hypot(current[0] - previous[0], current[1] - previous[1], current[2] - previous[2]);
  }
  return length;
}

export function getMotionDuration(motion: ChainMotion): number {
  return getPathLength(motion.path) / Math.max(0.01, motion.speed) + motion.settle;
}
