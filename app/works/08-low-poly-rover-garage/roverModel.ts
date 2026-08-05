export type Vector3Tuple = readonly [number, number, number];

export type ModuleCategory = "front" | "cabin" | "rear";

export type ExperienceMode = "garage" | "course";

export type FrontModuleId = "twin-lamp" | "drill-nose" | "scout-sensor" | "utility-winch";
export type CabinModuleId = "bubble-canopy" | "armored-cab" | "open-cockpit" | "offset-capsule";
export type RearModuleId = "cargo-rack" | "turbine-pack" | "tool-tank" | "coil-generator";
export type RoverModuleId = FrontModuleId | CabinModuleId | RearModuleId;

export type RoverModuleDefinition = {
  readonly id: RoverModuleId;
  readonly category: ModuleCategory;
  readonly label: string;
  readonly description: string;
  readonly mountPosition: Vector3Tuple;
  readonly mountRotation: Vector3Tuple;
  readonly mountScale: Vector3Tuple;
  readonly transitionDirection: Vector3Tuple;
};

export type RoverSelection = {
  readonly front: FrontModuleId;
  readonly cabin: CabinModuleId;
  readonly rear: RearModuleId;
};

export type CameraPreset = {
  readonly position: Vector3Tuple;
  readonly target: Vector3Tuple;
  readonly fov: number;
  readonly minDistance: number;
  readonly maxDistance: number;
};

export type ModuleTransitionMode = "enter" | "exit";

export type ModuleTransitionTransform = {
  readonly position: Vector3Tuple;
  readonly scale: Vector3Tuple;
};

export type CourseDriveState = {
  readonly position: Vector3Tuple;
  readonly rotation: Vector3Tuple;
  readonly travel: number;
  readonly dustIntensity: number;
};

const FRONT_MOUNT: Vector3Tuple = [0, 1.82, 2.42];
const CABIN_MOUNT: Vector3Tuple = [0, 2.05, 0];
const REAR_MOUNT: Vector3Tuple = [0, 1.72, -2.32];

export const FRONT_MODULES = [
  {
    id: "twin-lamp",
    category: "front",
    label: "ツインランプ",
    description: "丸型ライトと太いバンパー",
    mountPosition: FRONT_MOUNT,
    mountRotation: [0, 0, 0],
    mountScale: [1, 1, 1],
    transitionDirection: [0, 0, 1],
  },
  {
    id: "drill-nose",
    category: "front",
    label: "ドリルノーズ",
    description: "保護フレーム付きの低ポリドリル",
    mountPosition: FRONT_MOUNT,
    mountRotation: [0, 0, 0],
    mountScale: [1, 1, 1],
    transitionDirection: [0, 0, 1],
  },
  {
    id: "scout-sensor",
    category: "front",
    label: "スカウトセンサー",
    description: "ドームと太めのアンテナ",
    mountPosition: FRONT_MOUNT,
    mountRotation: [0, 0, 0],
    mountScale: [1, 1, 1],
    transitionDirection: [0, 0, 1],
  },
  {
    id: "utility-winch",
    category: "front",
    label: "ユーティリティウインチ",
    description: "露出ドラムと太いケーブルガイド付きバンパー",
    mountPosition: FRONT_MOUNT,
    mountRotation: [0, 0, 0],
    mountScale: [1, 1, 1],
    transitionDirection: [0, 0, 1],
  },
] as const satisfies readonly RoverModuleDefinition[];

export const CABIN_MODULES = [
  {
    id: "bubble-canopy",
    category: "cabin",
    label: "バブルキャノピー",
    description: "淡いガラス色の丸いキャビン",
    mountPosition: CABIN_MOUNT,
    mountRotation: [0, 0, 0],
    mountScale: [1, 1, 1],
    transitionDirection: [0, 1, 0],
  },
  {
    id: "armored-cab",
    category: "cabin",
    label: "アーマードキャブ",
    description: "横長窓を備えた面構成のキャビン",
    mountPosition: CABIN_MOUNT,
    mountRotation: [0, 0, 0],
    mountScale: [1, 1, 1],
    transitionDirection: [0, 1, 0],
  },
  {
    id: "open-cockpit",
    category: "cabin",
    label: "オープンコックピット",
    description: "ロールバーと座席の開放型キャビン",
    mountPosition: CABIN_MOUNT,
    mountRotation: [0, 0, 0],
    mountScale: [1, 1, 1],
    transitionDirection: [0, 1, 0],
  },
  {
    id: "offset-capsule",
    category: "cabin",
    label: "オフセットカプセル",
    description: "片側へ寄せた丸窓カプセルと反対側の吸気ドーム",
    mountPosition: CABIN_MOUNT,
    mountRotation: [0, 0, 0],
    mountScale: [1, 1, 1],
    transitionDirection: [0, 1, 0],
  },
] as const satisfies readonly RoverModuleDefinition[];

export const REAR_MODULES = [
  {
    id: "cargo-rack",
    category: "rear",
    label: "カーゴラック",
    description: "固定箱を載せた荷台",
    mountPosition: REAR_MOUNT,
    mountRotation: [0, 0, 0],
    mountScale: [1, 1, 1],
    transitionDirection: [0, 0, -1],
  },
  {
    id: "turbine-pack",
    category: "rear",
    label: "タービンパック",
    description: "円形タービンと排気管のパック",
    mountPosition: REAR_MOUNT,
    mountRotation: [0, 0, 0],
    mountScale: [1, 1, 1],
    transitionDirection: [0, 0, -1],
  },
  {
    id: "tool-tank",
    category: "rear",
    label: "ツールタンク",
    description: "工具ケース付きの横向きタンク",
    mountPosition: REAR_MOUNT,
    mountRotation: [0, 0, 0],
    mountScale: [1, 1, 1],
    transitionDirection: [0, 0, -1],
  },
  {
    id: "coil-generator",
    category: "rear",
    label: "コイルジェネレーター",
    description: "高さの違う二連コイルと中央ジェネレーター",
    mountPosition: REAR_MOUNT,
    mountRotation: [0, 0, 0],
    mountScale: [1, 1, 1],
    transitionDirection: [0, 0, -1],
  },
] as const satisfies readonly RoverModuleDefinition[];

export const MODULES_BY_CATEGORY = {
  front: FRONT_MODULES,
  cabin: CABIN_MODULES,
  rear: REAR_MODULES,
} as const;

export const INITIAL_SELECTION: RoverSelection = {
  front: "twin-lamp",
  cabin: "bubble-canopy",
  rear: "cargo-rack",
};

export const ROVER_MODULES = [...FRONT_MODULES, ...CABIN_MODULES, ...REAR_MODULES] as const;

function finiteOr(value: number, fallback = 0): number {
  if (!Number.isFinite(value)) {
    return fallback;
  }

  return value === 0 ? 0 : value;
}

function finiteTuple(tuple: Vector3Tuple, fallback = 0): Vector3Tuple {
  return [
    finiteOr(tuple[0], fallback),
    finiteOr(tuple[1], fallback),
    finiteOr(tuple[2], fallback),
  ];
}

export function isFiniteTuple(tuple: Vector3Tuple): boolean {
  return tuple.every((value) => Number.isFinite(value));
}

export function getModuleDefinition(
  category: ModuleCategory,
  id: string,
): RoverModuleDefinition | undefined {
  return MODULES_BY_CATEGORY[category].find((module) => module.id === id);
}

export function normalizeSelection(
  selection?: Partial<Record<ModuleCategory, string>> | null,
): RoverSelection {
  const front = getModuleDefinition("front", selection?.front ?? "")?.id;
  const cabin = getModuleDefinition("cabin", selection?.cabin ?? "")?.id;
  const rear = getModuleDefinition("rear", selection?.rear ?? "")?.id;

  return {
    front: (front as FrontModuleId | undefined) ?? INITIAL_SELECTION.front,
    cabin: (cabin as CabinModuleId | undefined) ?? INITIAL_SELECTION.cabin,
    rear: (rear as RearModuleId | undefined) ?? INITIAL_SELECTION.rear,
  };
}

export function updateSelection(
  selection: RoverSelection,
  category: ModuleCategory,
  id: string,
): RoverSelection {
  const next = normalizeSelection(selection);
  const definition = getModuleDefinition(category, id);
  if (!definition) {
    return next;
  }

  if (category === "front") {
    return { ...next, front: definition.id as FrontModuleId };
  }
  if (category === "cabin") {
    return { ...next, cabin: definition.id as CabinModuleId };
  }
  return { ...next, rear: definition.id as RearModuleId };
}

export function getSelectionLabel(selection: RoverSelection): string {
  const safeSelection = normalizeSelection(selection);
  const front = getModuleDefinition("front", safeSelection.front);
  const cabin = getModuleDefinition("cabin", safeSelection.cabin);
  const rear = getModuleDefinition("rear", safeSelection.rear);

  return `${front?.label ?? "ツインランプ"} / ${cabin?.label ?? "バブルキャノピー"} / ${rear?.label ?? "カーゴラック"}`;
}

export function getCombinationCount(): number {
  return FRONT_MODULES.length * CABIN_MODULES.length * REAR_MODULES.length;
}

export function clampProgress(value: number): number {
  if (Number.isNaN(value) || value === -Infinity) {
    return 0;
  }
  if (value === Infinity) {
    return 1;
  }

  return Math.min(1, Math.max(0, value)) || 0;
}

export function easeProgress(value: number): number {
  const progress = clampProgress(value);
  return 1 - (1 - progress) ** 3;
}

export function getModuleTransitionDuration(reducedMotion: boolean): number {
  return reducedMotion ? 90 : 420;
}

export function getModuleTransitionTransform(
  definition: RoverModuleDefinition,
  progress: number,
  mode: ModuleTransitionMode,
): ModuleTransitionTransform {
  const eased = easeProgress(progress);
  const offsetFactor = mode === "enter" ? 1 - eased : eased;
  const scaleFactor = mode === "enter" ? 0.72 + eased * 0.28 : 1 - eased * 0.28;
  const offsetDistance = 0.78 * offsetFactor;
  const position = finiteTuple([
    definition.mountPosition[0] + definition.transitionDirection[0] * offsetDistance,
    definition.mountPosition[1] + definition.transitionDirection[1] * offsetDistance,
    definition.mountPosition[2] + definition.transitionDirection[2] * offsetDistance,
  ]);
  const scale = finiteTuple([
    definition.mountScale[0] * scaleFactor,
    definition.mountScale[1] * scaleFactor,
    definition.mountScale[2] * scaleFactor,
  ], 1);

  return { position, scale };
}

export function getCameraPreset(
  mode: ExperienceMode,
  viewportWidth: number,
  viewportHeight: number,
): CameraPreset {
  const safeWidth = Number.isFinite(viewportWidth) && viewportWidth > 0 ? viewportWidth : 1;
  const safeHeight = Number.isFinite(viewportHeight) && viewportHeight > 0 ? viewportHeight : 1;
  const aspect = safeWidth / safeHeight;
  const isMobile = safeWidth < 700 || aspect < 0.78;

  if (mode === "course") {
    return {
      position: isMobile ? [10.4, 8.4, 13.2] : [11.8, 9.4, 13.8],
      target: [0, 0.1, 0],
      fov: isMobile ? 53 : 48,
      minDistance: 12,
      maxDistance: 28,
    };
  }

  return {
    position: isMobile ? [8.2, 6.8, 12.6] : [7.8, 5.7, 9.6],
    target: [0, 1.45, 0],
    fov: isMobile ? 48 : 43,
    minDistance: 6.4,
    maxDistance: 16.8,
  };
}

export function getCourseDuration(reducedMotion: boolean): number {
  return reducedMotion ? 1500 : 7800;
}

export function getCourseDriveState(progress: number, reducedMotion: boolean): CourseDriveState {
  const safeProgress = clampProgress(progress);
  const wrappedProgress = safeProgress === 1 ? 0 : safeProgress;
  const angle = wrappedProgress * Math.PI * 2;
  const sinAngle = Math.sin(angle);
  const cosAngle = Math.cos(angle);
  const sinDoubleAngle = Math.sin(angle * 2);
  const cosTripleAngle = Math.cos(angle * 3);
  const x = 5.05 * sinAngle + 0.28 * sinDoubleAngle;
  const z = 4.45 * cosAngle + 0.22 * cosTripleAngle;
  const dx = 5.05 * cosAngle * Math.PI * 2 + 0.28 * Math.cos(angle * 2) * Math.PI * 4;
  const dz = -4.45 * sinAngle * Math.PI * 2 - 0.22 * Math.sin(angle * 3) * Math.PI * 6;
  const tangentLength = Math.max(0.001, Math.hypot(dx, dz));
  const bobAmount = reducedMotion ? 0.012 : 0.055;
  const pitchAmount = reducedMotion ? 0.008 : 0.028;
  const courseHump = Math.sin(angle * 0.5) ** 2;
  const bob = finiteOr(courseHump * bobAmount + Math.sin(angle * 4) * bobAmount * 0.28 + Math.sin(angle * 7) * bobAmount * 0.12);
  const pitch = finiteOr(courseHump * pitchAmount * 0.5 + Math.cos(angle * 4) * pitchAmount + Math.cos(angle * 7) * pitchAmount * 0.25 - pitchAmount * 1.25);
  const travel = finiteOr(safeProgress * 30.9);
  const dustIntensity = reducedMotion
    ? 0
    : finiteOr(0.24 + (Math.sin(angle * 3 - 0.45) ** 2) * 0.42);

  return {
    position: [finiteOr(x), bob, finiteOr(z)],
    rotation: [pitch, finiteOr(Math.atan2(dx / tangentLength, dz / tangentLength)), 0],
    travel,
    dustIntensity,
  };
}

export function getWheelRotation(distance: number, radius: number): number {
  if (!Number.isFinite(distance) || !Number.isFinite(radius) || radius <= 0) {
    return 0;
  }

  return finiteOr(distance / radius);
}

export function clampDeltaSeconds(value: number, maximum = 0.05): number {
  const safeMaximum = Number.isFinite(maximum) && maximum > 0 ? maximum : 0.05;
  if (Number.isNaN(value) || value === -Infinity) {
    return 0;
  }
  if (value === Infinity) {
    return safeMaximum;
  }

  return Math.min(safeMaximum, Math.max(0, value)) || 0;
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

export function getOrbitDampingFactor(reducedMotion: boolean): number {
  return reducedMotion ? 0.14 : 0.08;
}
