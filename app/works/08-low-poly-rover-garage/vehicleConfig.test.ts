import { describe, expect, it } from "vitest";

import {
  COORDINATE_CONTRACT,
  getBrakeForce,
  getEngineForce,
  getRapierEngineForce,
  getRapierSteeringAngle,
  getSteeringAngle,
  getWheelFrictionSlip,
  isValidVehicleConfig,
  VEHICLE_CONFIG,
  WHEEL_CONFIGS,
} from "./vehicleConfig";

describe("vehicleConfig", () => {
  it("defines a four-wheel drive vehicle with two steerable front wheels", () => {
    expect(isValidVehicleConfig()).toBe(true);
    expect(WHEEL_CONFIGS).toHaveLength(4);
    expect(WHEEL_CONFIGS.filter((wheel) => wheel.steerable)).toHaveLength(2);
    expect(WHEEL_CONFIGS.every((wheel) => wheel.driven && wheel.braked)).toBe(true);
    expect(VEHICLE_CONFIG.fixedTimestep).toBeCloseTo(1 / 60);
    expect(VEHICLE_CONFIG.maxSubsteps).toBe(4);
    expect(VEHICLE_CONFIG.wheelRadius).toBeGreaterThan(0);
    expect(VEHICLE_CONFIG.suspensionMaxTravel).toBeGreaterThan(0);
  });

  it("keeps the local coordinate contract and applies Rapier sign conversion only in the adapter", () => {
    expect(COORDINATE_CONTRACT.localForward).toEqual([0, 0, -1]);
    expect(COORDINATE_CONTRACT.localRight).toEqual([1, 0, 0]);
    expect(getSteeringAngle(-1, 4)).toBeLessThan(0);
    expect(getSteeringAngle(1, 4)).toBeGreaterThan(0);
    expect(getRapierSteeringAngle(-1, 4)).toBeGreaterThan(0);
    expect(getRapierSteeringAngle(1, 4)).toBeLessThan(0);
  });

  it("tunes forward, reverse, braking, and surfaces separately", () => {
    expect(getEngineForce(1, 0, "yard")).toBeGreaterThan(0);
    expect(getEngineForce(-1, 0, "yard")).toBeGreaterThan(0);
    expect(getRapierEngineForce(1, 0, "yard")).toBeGreaterThan(0);
    expect(getBrakeForce(-1, 5, "rocks")).toBeGreaterThan(0);
    expect(getBrakeForce(1, -2, "rocks")).toBeGreaterThan(0);
    expect(getEngineForce(1, 0, "whoops")).toBeLessThan(getEngineForce(1, 0, "yard"));
    expect(getWheelFrictionSlip("whoops")).toBeLessThan(getWheelFrictionSlip("rocks"));
    expect(VEHICLE_CONFIG.maxReverseSpeed).toBeLessThan(VEHICLE_CONFIG.maxForwardSpeed);
    expect(VEHICLE_CONFIG.maxReverseForce).toBeLessThan(VEHICLE_CONFIG.maxEngineForce);
  });
});
