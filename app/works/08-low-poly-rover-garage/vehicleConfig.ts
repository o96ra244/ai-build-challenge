import type { YardSurface } from "./testYard";

export type WheelIndex = 0 | 1 | 2 | 3;

export type WheelConfig = {
  readonly index: WheelIndex;
  readonly x: number;
  readonly y: number;
  readonly z: number;
  readonly steerable: boolean;
  readonly driven: boolean;
  readonly braked: boolean;
};

/**
 * Coordinate contract shared by the model, camera, input adapter, and Rapier.
 * The visible rover faces local -Z. Rapier's vehicle controller is configured
 * with its Z forward axis; the adapter below records the sign contract at the
 * boundary without changing the semantic input used by UI or tests.
 */
export const COORDINATE_CONTRACT = {
  localForward: [0, 0, -1] as const,
  localRight: [1, 0, 0] as const,
  localUp: [0, 1, 0] as const,
  visualYawOffset: 0,
  rapierForwardAxis: 2,
  steeringSign: -1,
  cameraForward: "local-forward",
} as const;

export const VEHICLE_CONFIG = {
  chassisMass: 720,
  centerOfMassY: -0.46,
  wheelRadius: 0.72,
  wheelWidth: 0.44,
  suspensionRestLength: 0.62,
  suspensionMaxTravel: 0.38,
  suspensionStiffness: 42,
  suspensionCompression: 5.6,
  suspensionRelaxation: 6.8,
  suspensionMaxForce: 12000,
  wheelFrictionSlip: 2.05,
  sideFrictionStiffness: 1.85,
  maxEngineForce: 5400,
  maxReverseForce: 2550,
  maxBrakeForce: 2800,
  maxSteeringAngle: 0.5,
  maxForwardSpeed: 12,
  maxReverseSpeed: 4.5,
  linearDamping: 0.32,
  angularDamping: 3.2,
  fixedTimestep: 1 / 60,
  maxAccumulator: 0.12,
  maxSubsteps: 4,
  gravity: -22,
} as const;

export const WHEEL_CONFIGS: readonly WheelConfig[] = [
  { index: 0, x: -2.08, y: -0.43, z: -0.88, steerable: true, driven: true, braked: true },
  { index: 1, x: 2.08, y: -0.43, z: -0.88, steerable: true, driven: true, braked: true },
  { index: 2, x: -2.08, y: -0.43, z: 0.88, steerable: false, driven: true, braked: true },
  { index: 3, x: 2.08, y: -0.43, z: 0.88, steerable: false, driven: true, braked: true },
] as const;

export type SurfaceTuning = {
  readonly traction: number;
  readonly engineMultiplier: number;
  readonly brakeMultiplier: number;
  readonly label: string;
};

export const SURFACE_TUNING: Record<YardSurface, SurfaceTuning> = {
  "start-pad": { traction: 1.12, engineMultiplier: 1, brakeMultiplier: 1.08, label: "START PAD" },
  slope: { traction: 1.02, engineMultiplier: 0.98, brakeMultiplier: 1, label: "SLOPE" },
  whoops: { traction: 0.94, engineMultiplier: 0.92, brakeMultiplier: 0.96, label: "WHOOPS" },
  log: { traction: 0.9, engineMultiplier: 0.86, brakeMultiplier: 1.02, label: "LOG CROSSING" },
  crates: { traction: 1, engineMultiplier: 0.96, brakeMultiplier: 1, label: "CRATE LANE" },
  rocks: { traction: 1.06, engineMultiplier: 0.9, brakeMultiplier: 1.08, label: "ROCK GATE" },
  jump: { traction: 0.98, engineMultiplier: 0.96, brakeMultiplier: 0.94, label: "JUMP RAMP" },
  boundary: { traction: 1, engineMultiplier: 0.8, brakeMultiplier: 1.2, label: "BOUNDARY" },
  yard: { traction: 1, engineMultiplier: 1, brakeMultiplier: 1, label: "YARD FLOOR" },
};

function clamp(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) {
    return min;
  }
  return Math.min(max, Math.max(min, value));
}

export function getSurfaceTuning(surface: YardSurface): SurfaceTuning {
  return SURFACE_TUNING[surface] ?? SURFACE_TUNING.yard;
}

/** Semantic steering angle. -1 is left and +1 is right. */
export function getSteeringAngle(steering: number, signedSpeed: number): number {
  const safeSteering = clamp(steering, -1, 1);
  const speed = Math.abs(Number.isFinite(signedSpeed) ? signedSpeed : 0);
  const speedScale = 1 - clamp(speed / VEHICLE_CONFIG.maxForwardSpeed, 0, 1) * 0.36;
  return safeSteering * VEHICLE_CONFIG.maxSteeringAngle * Math.max(0.62, speedScale);
}

/** Rapier adapter sign conversion; the semantic contract never changes. */
export function getRapierSteeringAngle(steering: number, signedSpeed: number): number {
  return getSteeringAngle(steering, signedSpeed) * COORDINATE_CONTRACT.steeringSign;
}

export function getEngineForce(throttle: number, signedSpeed: number, surface: YardSurface): number {
  const tuning = getSurfaceTuning(surface);
  const speed = Number.isFinite(signedSpeed) ? signedSpeed : 0;
  if (throttle > 0 && speed < VEHICLE_CONFIG.maxForwardSpeed) {
    return VEHICLE_CONFIG.maxEngineForce * tuning.engineMultiplier;
  }
  if (throttle < 0 && speed > -VEHICLE_CONFIG.maxReverseSpeed) {
    return VEHICLE_CONFIG.maxReverseForce * tuning.engineMultiplier;
  }
  return 0;
}

/** Rapier's controller convention is measured here; the visual -Z contract stays unchanged. */
export function getRapierEngineForce(throttle: number, signedSpeed: number, surface: YardSurface): number {
  const force = getEngineForce(throttle, signedSpeed, surface);
  return throttle < 0 ? -force : force;
}

export function getBrakeForce(throttle: number, signedSpeed: number, surface: YardSurface): number {
  const speed = Number.isFinite(signedSpeed) ? signedSpeed : 0;
  const tuning = getSurfaceTuning(surface);
  const isBrakingForward = throttle < 0 && speed > 0.35;
  const isBrakingReverse = throttle > 0 && speed < -0.35;
  return isBrakingForward || isBrakingReverse
    ? VEHICLE_CONFIG.maxBrakeForce * tuning.brakeMultiplier
    : 0;
}

export function getWheelFrictionSlip(surface: YardSurface): number {
  return VEHICLE_CONFIG.wheelFrictionSlip * getSurfaceTuning(surface).traction;
}

export function isValidVehicleConfig(): boolean {
  const numericValues = Object.values(VEHICLE_CONFIG).every((value) => Number.isFinite(value));
  const wheelsValid = WHEEL_CONFIGS.length === 4
    && WHEEL_CONFIGS.every((wheel) => [wheel.x, wheel.y, wheel.z].every(Number.isFinite));
  const surfacesValid = Object.values(SURFACE_TUNING).every((tuning) => [
    tuning.traction,
    tuning.engineMultiplier,
    tuning.brakeMultiplier,
  ].every(Number.isFinite));
  return numericValues
    && wheelsValid
    && surfacesValid
    && VEHICLE_CONFIG.fixedTimestep > 0
    && VEHICLE_CONFIG.maxSubsteps === 4
    && VEHICLE_CONFIG.wheelRadius > 0
    && VEHICLE_CONFIG.suspensionMaxTravel > 0
    && WHEEL_CONFIGS.filter((wheel) => wheel.steerable).length === 2
    && WHEEL_CONFIGS.every((wheel) => wheel.driven && wheel.braked);
}
