export type DriveInput = {
  readonly throttle: -1 | 0 | 1;
  /** -1 = left, 1 = right. This is the single steering contract. */
  readonly steering: -1 | 0 | 1;
};

export type QuaternionLike = {
  readonly x: number;
  readonly y: number;
  readonly z: number;
  readonly w: number;
};

export type Vector3Like = {
  readonly x: number;
  readonly y: number;
  readonly z: number;
};

export type PressedDriveKeys = {
  readonly throttleForward: boolean;
  readonly throttleReverse: boolean;
  readonly steerLeft: boolean;
  readonly steerRight: boolean;
};

export type DriveKeyAction =
  | "throttle-forward"
  | "throttle-reverse"
  | "steer-left"
  | "steer-right"
  | "pause"
  | "reset";

export const EMPTY_PRESSED_KEYS: PressedDriveKeys = {
  throttleForward: false,
  throttleReverse: false,
  steerLeft: false,
  steerRight: false,
};

export const EMPTY_DRIVE_INPUT: DriveInput = { throttle: 0, steering: 0 };

export const DRIVE_CONFIG = {
  maxForwardSpeed: 12,
  maxReverseSpeed: 4.5,
  maxDeltaSeconds: 0.05,
} as const;

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
  return {
    throttle: input?.throttle === 1 ? 1 : input?.throttle === -1 ? -1 : 0,
    steering: input?.steering === 1 ? 1 : input?.steering === -1 ? -1 : 0,
  };
}

export function getSpeedDisplay(speed: number): string {
  return (Number.isFinite(speed) ? Math.max(0, Math.abs(speed)) : 0).toFixed(1);
}

function rotateVectorByQuaternion(vector: readonly [number, number, number], rotation: QuaternionLike): readonly [number, number, number] {
  const x = Number.isFinite(rotation.x) ? rotation.x : 0;
  const y = Number.isFinite(rotation.y) ? rotation.y : 0;
  const z = Number.isFinite(rotation.z) ? rotation.z : 0;
  const w = Number.isFinite(rotation.w) ? rotation.w : 1;
  const uvx = y * vector[2] - z * vector[1];
  const uvy = z * vector[0] - x * vector[2];
  const uvz = x * vector[1] - y * vector[0];
  const uuvx = y * uvz - z * uvy;
  const uuvy = z * uvx - x * uvz;
  const uuvz = x * uvy - y * uvx;
  const factor = 2 * w;
  return [
    vector[0] + uvx * factor + uuvx * 2,
    vector[1] + uvy * factor + uuvy * 2,
    vector[2] + uvz * factor + uuvz * 2,
  ];
}

export function getSemanticAxes(rotation: QuaternionLike): {
  readonly forward: readonly [number, number, number];
  readonly right: readonly [number, number, number];
  readonly up: readonly [number, number, number];
} {
  return {
    forward: rotateVectorByQuaternion([0, 0, -1], rotation),
    right: rotateVectorByQuaternion([1, 0, 0], rotation),
    up: rotateVectorByQuaternion([0, 1, 0], rotation),
  };
}

export function getSemanticSpeed(rotation: QuaternionLike, velocity: Vector3Like): number {
  const { forward } = getSemanticAxes(rotation);
  const safeVelocity = [
    Number.isFinite(velocity.x) ? velocity.x : 0,
    Number.isFinite(velocity.y) ? velocity.y : 0,
    Number.isFinite(velocity.z) ? velocity.z : 0,
  ] as const;
  return safeVelocity[0] * forward[0] + safeVelocity[1] * forward[1] + safeVelocity[2] * forward[2];
}

export function getPlanarDot(
  displacement: readonly [number, number, number],
  axis: readonly [number, number, number],
): number {
  return displacement[0] * axis[0] + displacement[2] * axis[2];
}
