import { describe, expect, it } from "vitest";

import { EMPTY_DRIVE_INPUT } from "./driveModel";
import { loadRapier, RoverPhysicsWorld } from "./RoverPhysicsWorld";

describe("RoverPhysicsWorld", () => {
  it("creates a Rapier heightfield and four-wheel dynamic vehicle", async () => {
    const rapier = await loadRapier();
    const physics = new RoverPhysicsWorld(rapier);
    const start = physics.snapshot;
    expect(physics.snapshot.groundedWheels).toBeGreaterThanOrEqual(0);
    expect(physics.snapshot.wheelRotations).toHaveLength(4);
    for (let index = 0; index < 120; index += 1) {
      physics.advance(1 / 60, index < 60 ? { throttle: 1, steering: 0 } : EMPTY_DRIVE_INPUT);
    }
    const snapshot = physics.snapshot;
    expect(snapshot.z).toBeGreaterThan(start.z + 1);
    expect(snapshot.y).toBeGreaterThan(-2);
    expect(snapshot.groundedWheels).toBeGreaterThanOrEqual(2);
    expect(Number.isFinite(snapshot.x)).toBe(true);
    expect(Number.isFinite(snapshot.y)).toBe(true);
    expect(Number.isFinite(snapshot.z)).toBe(true);
    expect(snapshot.wheelSuspensionLengths.every((value) => Number.isFinite(value))).toBe(true);
    physics.recoverToLastSafe();
    expect(Number.isFinite(physics.snapshot.x)).toBe(true);
    physics.dispose();
  });

  it("maps left and right inputs to matching heading changes", async () => {
    const rapier = await loadRapier();
    const leftPhysics = new RoverPhysicsWorld(rapier);
    const leftStart = leftPhysics.snapshot;
    for (let index = 0; index < 120; index += 1) {
      leftPhysics.advance(1 / 60, { throttle: 1, steering: -1 });
    }
    const left = leftPhysics.snapshot;
    const rightPhysics = new RoverPhysicsWorld(rapier);
    const rightStart = rightPhysics.snapshot;
    for (let index = 0; index < 120; index += 1) {
      rightPhysics.advance(1 / 60, { throttle: 1, steering: 1 });
    }
    const right = rightPhysics.snapshot;
    expect(left.heading).toBeLessThan(leftStart.heading - 0.1);
    expect(right.heading).toBeGreaterThan(rightStart.heading + 0.1);
    leftPhysics.dispose();
    rightPhysics.dispose();
  });

  it("supports acceleration, coasting, braking, reverse, and reset", async () => {
    const rapier = await loadRapier();
    const physics = new RoverPhysicsWorld(rapier);
    for (let index = 0; index < 60; index += 1) {
      physics.advance(1 / 60, { throttle: 1, steering: 0 });
    }
    const forward = physics.snapshot;
    expect(forward.speed).toBeGreaterThan(0.2);
    for (let index = 0; index < 60; index += 1) {
      physics.advance(1 / 60, { throttle: 0, steering: 0 });
    }
    const coasting = physics.snapshot;
    expect(coasting.speed).toBeLessThan(forward.speed);
    for (let index = 0; index < 30; index += 1) {
      physics.advance(1 / 60, { throttle: -1, steering: 0 });
    }
    const braking = physics.snapshot;
    expect(braking.speed).toBeLessThan(coasting.speed);
    for (let index = 0; index < 120; index += 1) {
      physics.advance(1 / 60, { throttle: -1, steering: 0 });
    }
    const reverse = physics.snapshot;
    expect(reverse.speed).toBeLessThan(0);
    expect(reverse.z).toBeLessThan(braking.z);
    physics.resetToStart();
    expect(physics.snapshot.speed).toBeCloseTo(0);
    expect(physics.snapshot.x).toBeCloseTo(-122);
    expect(physics.snapshot.z).toBeCloseTo(-78);
    physics.dispose();
  });
});
