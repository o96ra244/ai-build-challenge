import { beforeAll, describe, expect, it } from "vitest";

import { getPlanarDot, getSemanticAxes } from "./driveModel";
import { loadRapier, RoverPhysicsWorld, type RapierModule } from "./RoverPhysicsWorld";

describe("RoverPhysicsWorld", () => {
  let rapier: RapierModule;

  beforeAll(async () => {
    rapier = await loadRapier();
  });

  it("creates a fixed-step Rapier world with four ray-cast wheels", () => {
    const physics = new RoverPhysicsWorld(rapier);
    expect(physics.snapshot.wheelRotations).toHaveLength(4);
    expect(physics.snapshot.wheelSuspensionLengths).toHaveLength(4);
    physics.dispose();
  });

  it("accelerates, coasts, brakes, reverses, and clears velocity on recover", () => {
    const physics = new RoverPhysicsWorld(rapier);
    const start = physics.snapshot;
    for (let index = 0; index < 120; index += 1) {
      physics.advance(1 / 60, { throttle: 1, steering: 0 });
    }
    const forward = physics.snapshot;
    expect(forward.z).toBeLessThan(start.z - 0.5);
    expect(forward.speed).toBeGreaterThan(0.2);

    for (let index = 0; index < 60; index += 1) {
      physics.advance(1 / 60, { throttle: 0, steering: 0 });
    }
    const coasting = physics.snapshot;
    expect(coasting.speed).toBeLessThan(forward.speed);

    for (let index = 0; index < 30; index += 1) {
      physics.advance(1 / 60, { throttle: -1, steering: 0 });
    }
    expect(physics.snapshot.speed).toBeLessThan(coasting.speed);

    physics.recoverToStart();
    for (let index = 0; index < 45; index += 1) {
      physics.advance(1 / 60, { throttle: -1, steering: 0 });
    }
    expect(physics.snapshot.speed).toBeLessThan(0);
    expect(physics.snapshot.z).toBeGreaterThan(14.05);

    physics.recoverToStart();
    expect(physics.snapshot.speed).toBeCloseTo(0);
    expect(physics.snapshot.x).toBeCloseTo(0);
    expect(physics.snapshot.z).toBeCloseTo(14);
    physics.dispose();
  });

  it("uses displacement projected onto the initial right vector for left/right evidence", () => {
    const leftPhysics = new RoverPhysicsWorld(rapier);
    const leftStart = leftPhysics.snapshot;
    const leftAxes = getSemanticAxes(leftStart.rotation);
    for (let index = 0; index < 150; index += 1) {
      leftPhysics.advance(1 / 60, { throttle: 1, steering: -1 });
    }
    const left = leftPhysics.snapshot;
    const leftDot = getPlanarDot([left.x - leftStart.x, 0, left.z - leftStart.z], leftAxes.right);

    const rightPhysics = new RoverPhysicsWorld(rapier);
    const rightStart = rightPhysics.snapshot;
    const rightAxes = getSemanticAxes(rightStart.rotation);
    for (let index = 0; index < 150; index += 1) {
      rightPhysics.advance(1 / 60, { throttle: 1, steering: 1 });
    }
    const right = rightPhysics.snapshot;
    const rightDot = getPlanarDot([right.x - rightStart.x, 0, right.z - rightStart.z], rightAxes.right);

    expect(leftDot).toBeLessThan(-0.1);
    expect(rightDot).toBeGreaterThan(0.1);
    expect(Math.abs(leftDot)).toBeGreaterThan(0.1);
    expect(Math.abs(rightDot)).toBeGreaterThan(0.1);
    leftPhysics.dispose();
    rightPhysics.dispose();
  });

  it("keeps transforms finite while the vehicle crosses varied inputs and disposes cleanly", () => {
    const physics = new RoverPhysicsWorld(rapier);
    for (let index = 0; index < 600; index += 1) {
      const throttle = index % 180 < 110 ? 1 : index % 180 < 145 ? 0 : -1;
      const steering = index % 120 < 40 ? -1 : index % 120 < 80 ? 1 : 0;
      physics.advance(1 / 60, { throttle, steering });
      const snapshot = physics.snapshot;
      expect([snapshot.x, snapshot.y, snapshot.z, snapshot.speed, ...snapshot.wheelSuspensionLengths].every(Number.isFinite)).toBe(true);
    }
    expect(physics.snapshot.groundedWheels).toBeGreaterThanOrEqual(0);
    physics.dispose();
    expect(physics.snapshot.x).toBe(Number.isFinite(physics.snapshot.x) ? physics.snapshot.x : 0);
  });
});
