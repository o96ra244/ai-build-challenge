import type { SurfaceType } from "./frontierWorld";

export type WheelIndex = 0 | 1 | 2 | 3;

export type WheelConfig = {
  readonly index: WheelIndex;
  readonly x: number;
  readonly y: number;
  readonly z: number;
  readonly steerable: boolean;
};

export type SurfaceTuning = {
  readonly traction: number;
  readonly engineMultiplier: number;
  readonly brakeMultiplier: number;
  readonly label: string;
};

export const VEHICLE_CONFIG = {
  chassisMass: 720,
  centerOfMassY: -0.45,
  wheelRadius: 0.82,
  suspensionRestLength: 0.72,
  suspensionMaxTravel: 0.42,
  suspensionStiffness: 34,
  suspensionCompression: 4.2,
  suspensionRelaxation: 4.8,
  suspensionMaxForce: 9000,
  wheelFrictionSlip: 2.2,
  sideFrictionStiffness: 2.1,
  maxEngineForce: 5200,
  maxReverseForce: 2500,
  maxBrakeForce: 2000,
  maxSteeringAngle: 0.46,
  maxForwardSpeed: 12.5,
  maxReverseSpeed: 4.4,
  fixedTimestep: 1 / 60,
  maxAccumulator: 0.1,
  maxSubsteps: 4,
  gravity: -24,
} as const;

export const WHEEL_CONFIGS: readonly WheelConfig[] = [
  { index: 0, x: -2.28, y: -0.46, z: 1.42, steerable: true },
  { index: 1, x: 2.28, y: -0.46, z: 1.42, steerable: true },
  { index: 2, x: -2.28, y: -0.46, z: -1.42, steerable: false },
  { index: 3, x: 2.28, y: -0.46, z: -1.42, steerable: false },
] as const;

export const SURFACE_TUNING: Record<SurfaceType, SurfaceTuning> = {
  meadow: { traction: 1.04, engineMultiplier: 1, brakeMultiplier: 1, label: "MEADOW" },
  dirt: { traction: 1, engineMultiplier: 1.02, brakeMultiplier: 1, label: "DIRT" },
  stone: { traction: 1.18, engineMultiplier: 0.96, brakeMultiplier: 1.08, label: "STONE" },
  "loose-soil": { traction: 0.68, engineMultiplier: 0.72, brakeMultiplier: 0.82, label: "LOOSE SOIL" },
};

function clamp(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) {
    return min;
  }
  return Math.min(max, Math.max(min, value)) || 0;
}

export function getSurfaceTuning(surface: SurfaceType): SurfaceTuning {
  return SURFACE_TUNING[surface] ?? SURFACE_TUNING.meadow;
}

export function getSteeringAngle(steering: number, signedSpeed: number): number {
  const safeSteering = clamp(steering, -1, 1);
  const speedScale = Math.min(1, Math.max(0.3, Math.abs(Number.isFinite(signedSpeed) ? signedSpeed : 0) / 4));
  const reverseSign = Number.isFinite(signedSpeed) && signedSpeed < -0.2 ? -1 : 1;
  return clamp(safeSteering * VEHICLE_CONFIG.maxSteeringAngle * speedScale * reverseSign, -VEHICLE_CONFIG.maxSteeringAngle, VEHICLE_CONFIG.maxSteeringAngle);
}

export function getEngineForce(throttle: number, signedSpeed: number, surface: SurfaceType): number {
  const tuning = getSurfaceTuning(surface);
  if (throttle > 0 && signedSpeed < VEHICLE_CONFIG.maxForwardSpeed) {
    return VEHICLE_CONFIG.maxEngineForce * tuning.engineMultiplier;
  }
  if (throttle < 0 && signedSpeed > -VEHICLE_CONFIG.maxReverseSpeed) {
    return -VEHICLE_CONFIG.maxReverseForce * tuning.engineMultiplier;
  }
  return 0;
}

export function getBrakeForce(throttle: number, signedSpeed: number, surface: SurfaceType): number {
  const tuning = getSurfaceTuning(surface);
  if (throttle === 0) {
    return 0;
  }
  const braking = throttle < 0 && signedSpeed > 0.45;
  const reverseBraking = throttle > 0 && signedSpeed < -0.45;
  return braking || reverseBraking ? VEHICLE_CONFIG.maxBrakeForce * tuning.brakeMultiplier : 0;
}

export function getWheelFrictionSlip(surface: SurfaceType): number {
  return VEHICLE_CONFIG.wheelFrictionSlip * getSurfaceTuning(surface).traction;
}

export function isValidVehicleConfig(): boolean {
  return Object.values(VEHICLE_CONFIG).every((value) => Number.isFinite(value))
    && VEHICLE_CONFIG.fixedTimestep > 0
    && VEHICLE_CONFIG.maxAccumulator > 0
    && VEHICLE_CONFIG.maxSubsteps > 0
    && WHEEL_CONFIGS.length === 4
    && Object.values(SURFACE_TUNING).every((tuning) => Object.values(tuning).every((value) => typeof value === "string" || Number.isFinite(value)));
}
