import { describe, expect, it } from "vitest";

import { getBrakeForce, getEngineForce, getSteeringAngle, getWheelFrictionSlip, isValidVehicleConfig, VEHICLE_CONFIG, WHEEL_CONFIGS } from "./vehicleConfig";

describe("vehicleConfig", () => {
  it("keeps the Rapier vehicle values finite and within the requested scale", () => {
    expect(isValidVehicleConfig()).toBe(true);
    expect(WHEEL_CONFIGS).toHaveLength(4);
    expect(VEHICLE_CONFIG.chassisMass).toBe(720);
    expect(VEHICLE_CONFIG.wheelRadius).toBe(0.82);
    expect(VEHICLE_CONFIG.fixedTimestep).toBeCloseTo(1 / 60);
    expect(VEHICLE_CONFIG.maxAccumulator).toBe(0.1);
    expect(VEHICLE_CONFIG.maxSubsteps).toBe(4);
  });

  it("uses -1 for left and +1 for right, including reverse steering", () => {
    expect(getSteeringAngle(-1, 6)).toBeLessThan(0);
    expect(getSteeringAngle(1, 6)).toBeGreaterThan(0);
    expect(getSteeringAngle(-1, -3)).toBeGreaterThan(0);
    expect(getSteeringAngle(1, -3)).toBeLessThan(0);
  });

  it("provides four-wheel engine force, braking, and surface traction", () => {
    expect(getEngineForce(1, 0, "meadow")).toBeGreaterThan(0);
    expect(getEngineForce(-1, 0, "meadow")).toBeLessThan(0);
    expect(getBrakeForce(-1, 5, "stone")).toBeGreaterThan(0);
    expect(getBrakeForce(1, -2, "stone")).toBeGreaterThan(0);
    expect(getEngineForce(1, 0, "loose-soil")).toBeLessThan(getEngineForce(1, 0, "meadow"));
    expect(getWheelFrictionSlip("loose-soil")).toBeLessThan(getWheelFrictionSlip("stone"));
  });
});
