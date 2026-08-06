export type Vector3Tuple = readonly [number, number, number];

export type ModuleCategory = "front" | "cabin" | "rear";

export type FrontModuleId = "lamp-bar" | "scoop" | "sensor" | "winch";
export type CabinModuleId = "bubble" | "armored" | "cockpit" | "capsule";
export type RearModuleId = "rack" | "turbine" | "tank" | "coil";
export type RoverModuleId = FrontModuleId | CabinModuleId | RearModuleId;

export type ModuleVisual =
  | "lamp-bar"
  | "scoop"
  | "sensor"
  | "winch"
  | "bubble"
  | "armored"
  | "cockpit"
  | "capsule"
  | "rack"
  | "turbine"
  | "tank"
  | "coil";

export type RoverModuleDefinition = {
  readonly id: RoverModuleId;
  readonly category: ModuleCategory;
  readonly label: string;
  readonly description: string;
  readonly visual: ModuleVisual;
  readonly accent: number;
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

export const FRONT_MODULES = [
  {
    id: "lamp-bar",
    category: "front",
    label: "LAMP BAR",
    description: "丸型ライトを並べた探索用フロント",
    visual: "lamp-bar",
    accent: 0xf4c35b,
  },
  {
    id: "scoop",
    category: "front",
    label: "SCOOP",
    description: "低い除雪ブレードと保護フレーム",
    visual: "scoop",
    accent: 0xe87543,
  },
  {
    id: "sensor",
    category: "front",
    label: "SENSOR",
    description: "前方を読む六角センサードーム",
    visual: "sensor",
    accent: 0x63c6c2,
  },
  {
    id: "winch",
    category: "front",
    label: "WINCH",
    description: "太いバンパーと中央ウインチ",
    visual: "winch",
    accent: 0xf2a94a,
  },
] as const satisfies readonly RoverModuleDefinition[];

export const CABIN_MODULES = [
  {
    id: "bubble",
    category: "cabin",
    label: "BUBBLE",
    description: "視界を広く取る低ポリ・キャノピー",
    visual: "bubble",
    accent: 0x8ed2d4,
  },
  {
    id: "armored",
    category: "cabin",
    label: "ARMORED",
    description: "角張った窓と厚い装甲パネル",
    visual: "armored",
    accent: 0xb5b4a3,
  },
  {
    id: "cockpit",
    category: "cabin",
    label: "COCKPIT",
    description: "開放型シートとロールケージ",
    visual: "cockpit",
    accent: 0xe9a44d,
  },
  {
    id: "capsule",
    category: "cabin",
    label: "CAPSULE",
    description: "片側へ寄せた観測カプセル",
    visual: "capsule",
    accent: 0x87b8dd,
  },
] as const satisfies readonly RoverModuleDefinition[];

export const REAR_MODULES = [
  {
    id: "rack",
    category: "rear",
    label: "CARGO RACK",
    description: "箱を固定できるシンプルな荷台",
    visual: "rack",
    accent: 0xd98a4b,
  },
  {
    id: "turbine",
    category: "rear",
    label: "TURBINE",
    description: "回転ファンを備えたパワーパック",
    visual: "turbine",
    accent: 0x77c7bf,
  },
  {
    id: "tank",
    category: "rear",
    label: "TOOL TANK",
    description: "工具ケースと横向きタンクの組み合わせ",
    visual: "tank",
    accent: 0xc6a34a,
  },
  {
    id: "coil",
    category: "rear",
    label: "COIL",
    description: "二連コイルのコンパクトな発電機",
    visual: "coil",
    accent: 0xb785d2,
  },
] as const satisfies readonly RoverModuleDefinition[];

export const MODULES_BY_CATEGORY = {
  front: FRONT_MODULES,
  cabin: CABIN_MODULES,
  rear: REAR_MODULES,
} as const;

export const ROVER_MODULES = [...FRONT_MODULES, ...CABIN_MODULES, ...REAR_MODULES] as const;

export const INITIAL_SELECTION: RoverSelection = {
  front: "lamp-bar",
  cabin: "bubble",
  rear: "rack",
};

function finiteOr(value: number, fallback = 0): number {
  return Number.isFinite(value) ? (Object.is(value, -0) ? 0 : value) : fallback;
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

export function getCombinationCount(): number {
  return FRONT_MODULES.length * CABIN_MODULES.length * REAR_MODULES.length;
}

export function getSelectionLabel(selection: RoverSelection): string {
  const safeSelection = normalizeSelection(selection);
  const front = getModuleDefinition("front", safeSelection.front);
  const cabin = getModuleDefinition("cabin", safeSelection.cabin);
  const rear = getModuleDefinition("rear", safeSelection.rear);
  return `${front?.label ?? "LAMP BAR"} / ${cabin?.label ?? "BUBBLE"} / ${rear?.label ?? "CARGO RACK"}`;
}

export function getCameraPreset(viewportWidth: number, viewportHeight: number): CameraPreset {
  const width = Number.isFinite(viewportWidth) && viewportWidth > 0 ? viewportWidth : 1;
  const height = Number.isFinite(viewportHeight) && viewportHeight > 0 ? viewportHeight : 1;
  const isMobile = width < 720 || width / height < 0.8;
  return {
    position: isMobile ? [8.8, 6.6, 10.8] : [9.4, 6.2, 9.6],
    target: [0, 0.55, 0],
    fov: isMobile ? 50 : 44,
    minDistance: isMobile ? 6.4 : 5.8,
    maxDistance: isMobile ? 15.5 : 17,
  };
}

export function getYardCameraPreset(viewportWidth: number, viewportHeight: number): CameraPreset {
  const width = finiteOr(viewportWidth, 1);
  const height = finiteOr(viewportHeight, 1);
  const isMobile = width < 720 || width / Math.max(1, height) < 0.8;
  return {
    position: isMobile ? [8, 6.8, 10] : [10, 7.2, 12],
    target: [0, 0.9, 8],
    fov: isMobile ? 58 : 52,
    minDistance: 4,
    maxDistance: 24,
  };
}
