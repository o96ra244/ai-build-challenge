import type { Waystone } from "./frontierWorld";

export type DriveInput = {
  readonly throttle: -1 | 0 | 1;
  /** -1 = left, 1 = right. */
  readonly steering: -1 | 0 | 1;
};

export const EMPTY_DRIVE_INPUT: DriveInput = { throttle: 0, steering: 0 };

export type PressedDriveKeys = {
  readonly throttleForward: boolean;
  readonly throttleReverse: boolean;
  readonly steerLeft: boolean;
  readonly steerRight: boolean;
};

export const EMPTY_PRESSED_KEYS: PressedDriveKeys = {
  throttleForward: false,
  throttleReverse: false,
  steerLeft: false,
  steerRight: false,
};

export type DriveKeyAction =
  | "throttle-forward"
  | "throttle-reverse"
  | "steer-left"
  | "steer-right"
  | "reset"
  | "pause";

export function mapDriveKey(key: string): DriveKeyAction | null {
  const normalized = typeof key === "string" ? key.toLowerCase() : "";
  if (normalized === "w" || normalized === "arrowup") {
    return "throttle-forward";
  }
  if (normalized === "s" || normalized === "arrowdown") {
    return "throttle-reverse";
  }
  if (normalized === "a" || normalized === "arrowleft") {
    return "steer-left";
  }
  if (normalized === "d" || normalized === "arrowright") {
    return "steer-right";
  }
  if (normalized === "r") {
    return "reset";
  }
  if (normalized === "p") {
    return "pause";
  }
  return null;
}

export function getDriveInputFromPressed(pressed: PressedDriveKeys): DriveInput {
  const throttle = pressed.throttleForward === pressed.throttleReverse
    ? 0
    : pressed.throttleForward ? 1 : -1;
  const steering = pressed.steerLeft === pressed.steerRight
    ? 0
    : pressed.steerLeft ? -1 : 1;
  return { throttle, steering };
}

export function setPressedDriveKey(
  pressed: PressedDriveKeys,
  action: DriveKeyAction,
  value: boolean,
): PressedDriveKeys {
  if (action === "throttle-forward") {
    return { ...pressed, throttleForward: value };
  }
  if (action === "throttle-reverse") {
    return { ...pressed, throttleReverse: value };
  }
  if (action === "steer-left") {
    return { ...pressed, steerLeft: value };
  }
  if (action === "steer-right") {
    return { ...pressed, steerRight: value };
  }
  return pressed;
}

export function sanitizeDriveInput(input: DriveInput | null | undefined): DriveInput {
  const throttle = input?.throttle === 1 ? 1 : input?.throttle === -1 ? -1 : 0;
  const steering = input?.steering === 1 ? 1 : input?.steering === -1 ? -1 : 0;
  return { throttle, steering };
}

export function getDriveForwardVector(heading: number): readonly [number, number] {
  const safeHeading = Number.isFinite(heading) ? heading : 0;
  return [Math.sin(safeHeading), Math.cos(safeHeading)];
}

export function formatFrontierTime(milliseconds: number): string {
  const safeMilliseconds = Number.isFinite(milliseconds) && milliseconds > 0 ? milliseconds : 0;
  const totalCentiseconds = Math.floor(safeMilliseconds / 10);
  const centiseconds = totalCentiseconds % 100;
  const totalSeconds = Math.floor(totalCentiseconds / 100);
  const seconds = totalSeconds % 60;
  const minutes = Math.floor(totalSeconds / 60);
  if (minutes > 0) {
    return `${minutes}:${String(seconds).padStart(2, "0")}.${String(centiseconds).padStart(2, "0")}`;
  }
  return `${seconds}.${String(centiseconds).padStart(2, "0")}`;
}

export function getSpeedDisplay(speed: number): string {
  const safeSpeed = Number.isFinite(speed) ? Math.max(0, speed) : 0;
  return safeSpeed.toFixed(1);
}

export type WaystoneRunState = {
  readonly visitedWaystoneIds: readonly string[];
  readonly completed: boolean;
};

export function createWaystoneRunState(): WaystoneRunState {
  return { visitedWaystoneIds: [], completed: false };
}

export function activateWaystone(
  state: WaystoneRunState,
  waystone: Waystone,
  totalWaystones: number,
): { readonly state: WaystoneRunState; readonly activated: boolean; readonly completed: boolean } {
  if (state.completed || state.visitedWaystoneIds.includes(waystone.id)) {
    return { state, activated: false, completed: state.completed };
  }

  const visitedWaystoneIds = [...state.visitedWaystoneIds, waystone.id];
  const completed = visitedWaystoneIds.length >= Math.max(1, Math.floor(totalWaystones));
  return {
    state: { visitedWaystoneIds, completed },
    activated: true,
    completed,
  };
}

export function getVisitedAreaCount(visitedWaystoneIds: readonly string[], waystones: readonly Waystone[]): number {
  const areaIds = new Set<string>();
  for (const waystone of waystones) {
    if (visitedWaystoneIds.includes(waystone.id)) {
      areaIds.add(waystone.areaId);
    }
  }
  return areaIds.size;
}

export function getWaystoneLabel(visitedCount: number, total = 6): string {
  const safeCount = Number.isFinite(visitedCount) ? Math.max(0, Math.min(total, Math.floor(visitedCount))) : 0;
  const safeTotal = Number.isFinite(total) ? Math.max(1, Math.floor(total)) : 6;
  return `WAYSTONE ${safeCount} / ${safeTotal}`;
}

export function clampFrontierDeltaSeconds(value: number): number {
  if (!Number.isFinite(value) || value <= 0) {
    return 0;
  }
  return Math.min(0.05, value);
}
