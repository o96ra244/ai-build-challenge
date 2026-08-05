import {
  clampDeltaSeconds,
  getWheelRotation,
} from "./roverModel";
import {
  COURSE_CHECKPOINTS,
  COURSE_OBSTACLES,
  START_HEADING,
  START_POSITION,
  TERRAIN_BOUNDS,
  TRACK_WIDTH,
  getCourseHeading,
  getTrackDistance,
  type CourseCheckpoint,
  type CourseObstacle,
} from "./courseGeometry";

export type DriveInput = {
  readonly throttle: -1 | 0 | 1;
  readonly steering: -1 | 0 | 1;
};

export type DriveState = {
  readonly x: number;
  readonly z: number;
  readonly heading: number;
  readonly speed: number;
  readonly wheelRotation: number;
  readonly checkpointIndex: number;
  readonly lapComplete: boolean;
};

export type DriveStepResult = {
  readonly state: DriveState;
  readonly onTrack: boolean;
  readonly collided: boolean;
  readonly checkpointPassed: boolean;
  readonly lapCompleted: boolean;
};

export type DriveKeyAction =
  | "throttle-forward"
  | "throttle-reverse"
  | "steer-left"
  | "steer-right"
  | "reset"
  | "pause";

export type PressedDriveKeys = {
  readonly throttleForward: boolean;
  readonly throttleReverse: boolean;
  readonly steerLeft: boolean;
  readonly steerRight: boolean;
};

export type DriveWorld = {
  readonly maxForwardSpeed: number;
  readonly maxReverseSpeed: number;
  readonly acceleration: number;
  readonly reverseAcceleration: number;
  readonly braking: number;
  readonly naturalResistance: number;
  readonly offTrackSpeedRatio: number;
  readonly offTrackResistance: number;
  readonly steeringRate: number;
  readonly vehicleRadius: number;
  readonly obstacles: readonly CourseObstacle[];
  readonly checkpoints: readonly CourseCheckpoint[];
};

export const DEFAULT_DRIVE_WORLD: DriveWorld = {
  maxForwardSpeed: 8.2,
  maxReverseSpeed: 2.5,
  acceleration: 6.2,
  reverseAcceleration: 3.3,
  braking: 9.5,
  naturalResistance: 1.25,
  offTrackSpeedRatio: 0.45,
  offTrackResistance: 4.4,
  steeringRate: 1.08,
  vehicleRadius: 1.15,
  obstacles: COURSE_OBSTACLES,
  checkpoints: COURSE_CHECKPOINTS,
};

export const EMPTY_DRIVE_INPUT: DriveInput = { throttle: 0, steering: 0 };

function finiteOr(value: number, fallback = 0): number {
  if (!Number.isFinite(value)) {
    return fallback;
  }

  return Object.is(value, -0) ? 0 : value;
}

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.min(maximum, Math.max(minimum, finiteOr(value, minimum)));
}

function normalizeSign(value: number): -1 | 0 | 1 {
  if (value > 0) {
    return 1;
  }
  if (value < 0) {
    return -1;
  }
  return 0;
}

function approachZero(value: number, amount: number): number {
  const safeValue = finiteOr(value);
  const safeAmount = Math.max(0, finiteOr(amount));
  if (Math.abs(safeValue) <= safeAmount) {
    return 0;
  }
  return safeValue > 0 ? safeValue - safeAmount : safeValue + safeAmount;
}

function normalizeHeading(value: number): number {
  if (!Number.isFinite(value)) {
    return START_HEADING;
  }
  const wrapped = ((value + Math.PI) % (Math.PI * 2)) - Math.PI;
  return finiteOr(wrapped);
}

function sanitizeCheckpointIndex(value: number, count: number): number {
  return Math.max(0, Math.min(count, Number.isFinite(value) ? Math.floor(value) : 0));
}

function sanitizeState(state: DriveState, world: DriveWorld): DriveState {
  return {
    x: finiteOr(state.x, START_POSITION[0]),
    z: finiteOr(state.z, START_POSITION[1]),
    heading: normalizeHeading(state.heading),
    speed: clamp(state.speed, -world.maxReverseSpeed, world.maxForwardSpeed),
    wheelRotation: finiteOr(state.wheelRotation),
    checkpointIndex: sanitizeCheckpointIndex(state.checkpointIndex, world.checkpoints.length),
    lapComplete: Boolean(state.lapComplete),
  };
}

export function createInitialDriveState(): DriveState {
  return {
    x: finiteOr(START_POSITION[0]),
    z: finiteOr(START_POSITION[1]),
    heading: finiteOr(START_HEADING),
    speed: 0,
    wheelRotation: 0,
    checkpointIndex: 0,
    lapComplete: false,
  };
}

export function getCheckpointResetState(
  checkpointIndex: number,
  world: DriveWorld = DEFAULT_DRIVE_WORLD,
): DriveState {
  const safeIndex = sanitizeCheckpointIndex(checkpointIndex, world.checkpoints.length);
  if (safeIndex === 0) {
    return createInitialDriveState();
  }

  const checkpoint = world.checkpoints[safeIndex - 1] ?? world.checkpoints[0];
  return {
    x: finiteOr(checkpoint?.x, START_POSITION[0]),
    z: finiteOr(checkpoint?.z, START_POSITION[1]),
    heading: finiteOr(checkpoint?.heading, START_HEADING),
    speed: 0,
    wheelRotation: 0,
    checkpointIndex: safeIndex,
    lapComplete: false,
  };
}

export function mapDriveKey(key: string): DriveKeyAction | null {
  const normalized = key.toLowerCase();
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
    : pressed.throttleForward
      ? 1
      : -1;
  const steering = pressed.steerLeft === pressed.steerRight
    ? 0
    : pressed.steerLeft
      ? -1
      : 1;

  return { throttle, steering };
}

function distanceSquared(x: number, z: number, targetX: number, targetZ: number): number {
  return (x - targetX) ** 2 + (z - targetZ) ** 2;
}

type CollisionResult = {
  readonly x: number;
  readonly z: number;
  readonly collided: boolean;
  readonly normalX: number;
  readonly normalZ: number;
};

export function resolveObstacleCollision(
  x: number,
  z: number,
  obstacles: readonly CourseObstacle[] = COURSE_OBSTACLES,
  vehicleRadius = DEFAULT_DRIVE_WORLD.vehicleRadius,
): CollisionResult {
  let nextX = finiteOr(x);
  let nextZ = finiteOr(z);
  let collided = false;
  let normalX = 0;
  let normalZ = 0;
  const safeRadius = Math.max(0.1, finiteOr(vehicleRadius, DEFAULT_DRIVE_WORLD.vehicleRadius));

  for (let pass = 0; pass < 3; pass += 1) {
    for (const obstacle of obstacles) {
      const obstacleX = finiteOr(obstacle.x);
      const obstacleZ = finiteOr(obstacle.z);
      const obstacleRadius = Math.max(0.1, finiteOr(obstacle.radius, 0.5));
      const dx = nextX - obstacleX;
      const dz = nextZ - obstacleZ;
      const distance = Math.hypot(dx, dz);
      const minimumDistance = safeRadius + obstacleRadius;
      if (distance >= minimumDistance) {
        continue;
      }

      const safeDistance = distance > 0.0001 ? distance : 1;
      const nx = distance > 0.0001 ? dx / distance : 1;
      const nz = distance > 0.0001 ? dz / distance : 0;
      nextX = finiteOr(obstacleX + nx * (minimumDistance + 0.001));
      nextZ = finiteOr(obstacleZ + nz * (minimumDistance + 0.001));
      normalX = finiteOr(nx, 1);
      normalZ = finiteOr(nz);
      collided = true;
      if (!Number.isFinite(safeDistance)) {
        nextX = finiteOr(x);
        nextZ = finiteOr(z);
      }
    }
  }

  return { x: nextX, z: nextZ, collided, normalX, normalZ };
}

function hasCrossedGoalLine(previous: DriveState, currentX: number, currentZ: number): boolean {
  const tangentX = Math.sin(START_HEADING);
  const tangentZ = Math.cos(START_HEADING);
  const normalX = -tangentZ;
  const normalZ = tangentX;
  const previousRelativeX = previous.x - START_POSITION[0];
  const previousRelativeZ = previous.z - START_POSITION[1];
  const currentRelativeX = currentX - START_POSITION[0];
  const currentRelativeZ = currentZ - START_POSITION[1];
  const previousAlong = previousRelativeX * tangentX + previousRelativeZ * tangentZ;
  const currentAlong = currentRelativeX * tangentX + currentRelativeZ * tangentZ;
  const previousLateral = previousRelativeX * normalX + previousRelativeZ * normalZ;
  const currentLateral = currentRelativeX * normalX + currentRelativeZ * normalZ;
  const crossedForward = previousAlong < 0 && currentAlong >= 0;
  const staysNearLine = Math.max(Math.abs(previousLateral), Math.abs(currentLateral)) <= TRACK_WIDTH * 0.65;
  return crossedForward && staysNearLine;
}

export function stepDrive(
  inputState: DriveState,
  input: DriveInput,
  deltaSeconds: number,
  world: DriveWorld = DEFAULT_DRIVE_WORLD,
): DriveStepResult {
  const safeWorld: DriveWorld = {
    ...DEFAULT_DRIVE_WORLD,
    ...world,
    obstacles: world.obstacles ?? DEFAULT_DRIVE_WORLD.obstacles,
    checkpoints: world.checkpoints ?? DEFAULT_DRIVE_WORLD.checkpoints,
  };
  const previous = sanitizeState(inputState, safeWorld);
  const safeInput: DriveInput = {
    throttle: normalizeSign(input.throttle),
    steering: normalizeSign(input.steering),
  };
  const dt = clampDeltaSeconds(deltaSeconds);
  const trackBefore = getTrackDistance(previous.x, previous.z);
  const maxForward = Math.max(0.1, finiteOr(safeWorld.maxForwardSpeed, DEFAULT_DRIVE_WORLD.maxForwardSpeed));
  const maxReverse = Math.max(0.1, finiteOr(safeWorld.maxReverseSpeed, DEFAULT_DRIVE_WORLD.maxReverseSpeed));
  const trackRatio = trackBefore.onTrack ? 1 : clamp(safeWorld.offTrackSpeedRatio, 0.1, 1);
  const maxAllowedForward = maxForward * trackRatio;
  const maxAllowedReverse = maxReverse * (trackBefore.onTrack ? 1 : trackRatio);
  const acceleration = Math.max(0, finiteOr(safeWorld.acceleration, DEFAULT_DRIVE_WORLD.acceleration));
  const reverseAcceleration = Math.max(0, finiteOr(safeWorld.reverseAcceleration, DEFAULT_DRIVE_WORLD.reverseAcceleration));
  const braking = Math.max(0, finiteOr(safeWorld.braking, DEFAULT_DRIVE_WORLD.braking));
  const resistance = trackBefore.onTrack
    ? Math.max(0, finiteOr(safeWorld.naturalResistance, DEFAULT_DRIVE_WORLD.naturalResistance))
    : Math.max(0, finiteOr(safeWorld.offTrackResistance, DEFAULT_DRIVE_WORLD.offTrackResistance));

  let speed = previous.speed;
  if (safeInput.throttle > 0) {
    speed = speed < 0
      ? Math.min(0, speed + braking * dt)
      : speed + acceleration * dt;
  } else if (safeInput.throttle < 0) {
    speed = speed > 0
      ? Math.max(0, speed - braking * dt)
      : speed - reverseAcceleration * dt;
  } else {
    speed = approachZero(speed, resistance * dt);
  }
  speed = clamp(speed, -maxAllowedReverse, maxAllowedForward);

  const speedRatio = Math.min(1, Math.abs(speed) / maxForward);
  const steeringDirection = speed >= 0 ? 1 : -1;
  const steeringStrength = speedRatio > 0.015 ? 0.2 + speedRatio * 0.8 : 0;
  const heading = normalizeHeading(
    previous.heading + safeInput.steering * steeringDirection * finiteOr(safeWorld.steeringRate, DEFAULT_DRIVE_WORLD.steeringRate) * steeringStrength * dt,
  );
  const averageSpeed = (previous.speed + speed) * 0.5;
  let nextX = finiteOr(previous.x + Math.sin(heading) * averageSpeed * dt, previous.x);
  let nextZ = finiteOr(previous.z + Math.cos(heading) * averageSpeed * dt, previous.z);

  const collision = resolveObstacleCollision(nextX, nextZ, safeWorld.obstacles, safeWorld.vehicleRadius);
  nextX = clamp(collision.x, TERRAIN_BOUNDS.minX + 0.35, TERRAIN_BOUNDS.maxX - 0.35);
  nextZ = clamp(collision.z, TERRAIN_BOUNDS.minZ + 0.35, TERRAIN_BOUNDS.maxZ - 0.35);
  if (collision.collided) {
    speed *= 0.28;
  }

  const wheelRotation = finiteOr(previous.wheelRotation + getWheelRotation(averageSpeed * dt, 0.82));
  let checkpointIndex = previous.checkpointIndex;
  let checkpointPassed = false;
  const nextCheckpoint = safeWorld.checkpoints[checkpointIndex];
  if (!previous.lapComplete && nextCheckpoint && distanceSquared(nextX, nextZ, nextCheckpoint.x, nextCheckpoint.z) <= nextCheckpoint.radius ** 2) {
    checkpointIndex += 1;
    checkpointPassed = true;
  }

  const lapCompleted = !previous.lapComplete
    && checkpointIndex >= safeWorld.checkpoints.length
    && hasCrossedGoalLine(previous, nextX, nextZ);
  const state: DriveState = {
    x: finiteOr(nextX),
    z: finiteOr(nextZ),
    heading: finiteOr(heading, START_HEADING),
    speed: finiteOr(lapCompleted ? 0 : speed),
    wheelRotation: finiteOr(wheelRotation),
    checkpointIndex: sanitizeCheckpointIndex(checkpointIndex, safeWorld.checkpoints.length),
    lapComplete: previous.lapComplete || lapCompleted,
  };

  return {
    state,
    onTrack: getTrackDistance(state.x, state.z).onTrack,
    collided: collision.collided,
    checkpointPassed,
    lapCompleted,
  };
}

export function formatTrialTime(milliseconds: number): string {
  const safeMilliseconds = Math.max(0, finiteOr(milliseconds));
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

export function getSpeedDisplay(speed: number): number {
  return Math.round(Math.abs(finiteOr(speed)) * 10) / 10;
}

export function getCheckpointLabel(checkpointIndex: number, total = COURSE_CHECKPOINTS.length): string {
  const safeIndex = Math.max(0, Math.min(total, Number.isFinite(checkpointIndex) ? Math.floor(checkpointIndex) : 0));
  return `CHECKPOINT ${safeIndex} / ${total}`;
}

export function getCourseProgressForReset(state: DriveState): DriveState {
  return getCheckpointResetState(state.checkpointIndex);
}

export function getCourseHeadingForCheckpoint(checkpointIndex: number): number {
  const safeIndex = Math.max(0, Math.floor(finiteOr(checkpointIndex)));
  return getCourseHeading(Math.min(safeIndex, COURSE_CHECKPOINTS.length));
}
