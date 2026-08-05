import { describe, expect, it } from "vitest";

import {
  COURSE_CHECKPOINTS,
  COURSE_CENTERLINE,
  START_POSITION,
  TERRAIN_BOUNDS,
  TRACK_WIDTH,
  getTerrainHeight,
  getTerrainNormal,
  getTrackDistance,
} from "./courseGeometry";
import {
  DEFAULT_DRIVE_WORLD,
  EMPTY_DRIVE_INPUT,
  createInitialDriveState,
  formatTrialTime,
  getDriveForwardVector,
  getCheckpointLabel,
  getCheckpointResetState,
  getDriveInputFromPressed,
  getSpeedDisplay,
  mapDriveKey,
  resolveObstacleCollision,
  getTerrainTraversal,
  stepDrive,
  type DriveState,
  type DriveWorld,
} from "./driveModel";

function expectFiniteState(state: DriveState): void {
  expect(Object.values(state).every((value) => typeof value !== "number" || Number.isFinite(value))).toBe(true);
  expect(Object.values(state).some((value) => typeof value === "number" && Object.is(value, -0))).toBe(false);
}

function lineWorld(overrides: Partial<DriveWorld> = {}): DriveWorld {
  const startZ = START_POSITION[1];
  return {
    ...DEFAULT_DRIVE_WORLD,
    obstacles: [],
    checkpoints: [
      { index: 0, x: 2, z: startZ, radius: 0.75, heading: Math.PI / 2 },
      { index: 1, x: 4, z: startZ, radius: 0.75, heading: Math.PI / 2 },
      { index: 2, x: 6, z: startZ, radius: 0.75, heading: Math.PI / 2 },
      { index: 3, x: 8, z: startZ, radius: 0.75, heading: Math.PI / 2 },
    ],
    ...overrides,
  };
}

describe("drive input", () => {
  it("initializes with no input and maps keyboard aliases case-insensitively", () => {
    expect(EMPTY_DRIVE_INPUT).toEqual({ throttle: 0, steering: 0 });
    expect(getDriveForwardVector(0)).toEqual([0, 1]);
    expect(getDriveForwardVector(Math.PI / 2)[0]).toBeCloseTo(1, 8);
    expect(mapDriveKey("W")).toBe("throttle-forward");
    expect(mapDriveKey("ArrowUp")).toBe("throttle-forward");
    expect(mapDriveKey("s")).toBe("throttle-reverse");
    expect(mapDriveKey("ARROWDOWN")).toBe("throttle-reverse");
    expect(mapDriveKey("a")).toBe("steer-left");
    expect(mapDriveKey("ArrowLeft")).toBe("steer-left");
    expect(mapDriveKey("D")).toBe("steer-right");
    expect(mapDriveKey("ArrowRight")).toBe("steer-right");
    expect(mapDriveKey("r")).toBe("reset");
    expect(mapDriveKey("P")).toBe("pause");
  });

  it("supports simultaneous actions and cancels opposing actions safely", () => {
    expect(getDriveInputFromPressed({
      throttleForward: true,
      throttleReverse: false,
      steerLeft: false,
      steerRight: true,
    })).toEqual({ throttle: 1, steering: 1 });
    expect(getDriveInputFromPressed({
      throttleForward: true,
      throttleReverse: true,
      steerLeft: true,
      steerRight: true,
    })).toEqual({ throttle: 0, steering: 0 });
  });
});

describe("terrain and track", () => {
  it("keeps deterministic height and finite smooth normals", () => {
    const samples = [[0, 11], [8.2, 9.2], [-7.8, -9.7], [10, -6]] as const;
    const heights = samples.map(([x, z]) => getTerrainHeight(x, z));
    expect(heights).toEqual(samples.map(([x, z]) => getTerrainHeight(x, z)));
    expect(new Set(heights).size).toBeGreaterThan(1);
    expect(Math.max(...heights) - Math.min(...heights)).toBeGreaterThan(0.15);
    expect(Math.abs(getTerrainHeight(8.2, 9.2) - getTerrainHeight(8.3, 9.2))).toBeLessThan(0.1);
    for (const value of [Number.NaN, Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY]) {
      expect(Number.isFinite(getTerrainHeight(value, 0))).toBe(true);
      expect(getTerrainNormal(0, value).every((component) => Number.isFinite(component))).toBe(true);
    }
    const normal = getTerrainNormal(8.2, 9.2);
    expect(normal.every((component) => Number.isFinite(component))).toBe(true);
    expect(Math.hypot(...normal)).toBeGreaterThan(0.98);
    expect(Math.hypot(...normal)).toBeLessThan(1.02);
  });

  it("uses a wide fixed field and changes traversal by speed and approach angle", () => {
    expect(TERRAIN_BOUNDS.maxX - TERRAIN_BOUNDS.minX).toBeCloseTo(120, 5);
    expect(TERRAIN_BOUNDS.maxZ - TERRAIN_BOUNDS.minZ).toBeCloseTo(90, 5);

    const lowSpeedApproach = getTerrainTraversal(-28, 12, -28, 28, 1.6, 0, 0.05);
    const highSpeedApproach = getTerrainTraversal(-28, 12, -28, 28, 7.2, 0, 0.05);
    const sideApproach = getTerrainTraversal(-28, 12, 4, 12, 7.2, Math.PI / 2, 0.05);

    expect(lowSpeedApproach.speedScale).toBeLessThan(highSpeedApproach.speedScale);
    expect(highSpeedApproach.verticalImpulse).toBeGreaterThan(lowSpeedApproach.verticalImpulse);
    expect(highSpeedApproach.approachFactor).toBeGreaterThan(sideApproach.approachFactor);
    expect(highSpeedApproach.stepHeight).toBeGreaterThan(0.2);
    for (const traversal of [lowSpeedApproach, highSpeedApproach, sideApproach]) {
      expect(Object.values(traversal).every((value) => Number.isFinite(value))).toBe(true);
      expect(Object.values(traversal).some((value) => Object.is(value, -0))).toBe(false);
    }
  });

  it("uses the closest segment of a wide closed route", () => {
    const start = COURSE_CENTERLINE[0];
    const end = COURSE_CENTERLINE[1];
    expect(getTrackDistance(start[0], start[1]).onTrack).toBe(true);
    expect(getTrackDistance((start[0] + end[0]) / 2, start[1] + TRACK_WIDTH / 2 - 0.02).onTrack).toBe(true);
    expect(getTrackDistance((start[0] + end[0]) / 2, start[1] + TRACK_WIDTH).onTrack).toBe(false);
    expect(getTrackDistance(0, 0).segmentIndex).toBeGreaterThanOrEqual(0);
    expect(getTrackDistance(TERRAIN_BOUNDS.maxX + 10, TERRAIN_BOUNDS.maxZ + 10).onTrack).toBe(false);
    for (const value of [Number.NaN, Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY]) {
      const distance = getTrackDistance(value, value);
      expect(Number.isFinite(distance.distance)).toBe(true);
      expect(Number.isFinite(distance.closest[0])).toBe(true);
      expect(Number.isFinite(distance.closest[1])).toBe(true);
    }
  });
});

describe("drive step", () => {
  it("does not move at dt zero and accelerates normally", () => {
    const initial = createInitialDriveState();
    const zero = stepDrive(initial, { throttle: 1, steering: 0 }, 0);
    expect(zero.state.x).toBe(initial.x);
    expect(zero.state.z).toBe(initial.z);
    const moving = stepDrive(initial, { throttle: 1, steering: 0 }, 0.05);
    expect(moving.state.speed).toBeGreaterThan(0);
    expect(moving.state.x).toBeGreaterThan(initial.x);
    expectFiniteState(moving.state);
  });

  it("naturally slows, brakes, reverses, and keeps left/right semantics in both directions", () => {
    const forward: DriveState = { ...createInitialDriveState(), speed: 4 };
    const coast = stepDrive(forward, EMPTY_DRIVE_INPUT, 0.05);
    const brake = stepDrive(forward, { throttle: -1, steering: 0 }, 0.05);
    expect(coast.state.speed).toBeLessThan(forward.speed);
    expect(brake.state.speed).toBeLessThan(coast.state.speed);

    const reverse = stepDrive({ ...forward, speed: 0 }, { throttle: -1, steering: 0 }, 0.05);
    expect(reverse.state.speed).toBeLessThan(0);
    const forwardLeft = stepDrive({ ...forward, heading: 0, speed: 4 }, { throttle: 1, steering: -1 }, 0.05);
    const forwardRight = stepDrive({ ...forward, heading: 0, speed: 4 }, { throttle: 1, steering: 1 }, 0.05);
    const reverseLeft = stepDrive({ ...forward, heading: 0, speed: -2 }, { throttle: -1, steering: -1 }, 0.05);
    const reverseRight = stepDrive({ ...forward, heading: 0, speed: -2 }, { throttle: -1, steering: 1 }, 0.05);
    expect(forwardLeft.state.heading).toBeGreaterThan(0);
    expect(forwardRight.state.heading).toBeLessThan(0);
    expect(reverseLeft.state.heading).toBeLessThan(0);
    expect(reverseRight.state.heading).toBeGreaterThan(0);
  });

  it("caps forward and reverse speed and slows off track", () => {
    const fast = stepDrive({ ...createInitialDriveState(), speed: 100 }, { throttle: 1, steering: 0 }, 1);
    expect(fast.state.speed).toBeLessThanOrEqual(DEFAULT_DRIVE_WORLD.maxForwardSpeed);
    const reverse = stepDrive({ ...createInitialDriveState(), speed: -100 }, { throttle: -1, steering: 0 }, 1);
    expect(Math.abs(reverse.state.speed)).toBeLessThanOrEqual(DEFAULT_DRIVE_WORLD.maxReverseSpeed);
    const offTrack = stepDrive({ ...createInitialDriveState(), x: 0, z: 0, speed: 6 }, { throttle: 1, steering: 0 }, 0.05);
    expect(offTrack.onTrack).toBe(false);
    expect(offTrack.state.speed).toBeLessThanOrEqual(DEFAULT_DRIVE_WORLD.maxForwardSpeed * DEFAULT_DRIVE_WORLD.offTrackSpeedRatio);
  });

  it("raises the rover over a fast step and resists a slow approach", () => {
    const slow = stepDrive({ ...createInitialDriveState(), x: -28, z: 12, heading: 0, speed: 1.4 }, { throttle: 1, steering: 0 }, 0.05);
    const fast = stepDrive({ ...createInitialDriveState(), x: -28, z: 12, heading: 0, speed: 7.2 }, { throttle: 1, steering: 0 }, 0.05);
    expect(slow.state.speed).toBeLessThan(fast.state.speed);
    expect(fast.state.verticalOffset).toBeGreaterThanOrEqual(slow.state.verticalOffset);
    expectFiniteState(slow.state);
    expectFiniteState(fast.state);
  });

  it("clamps hostile dt and sanitizes NaN, infinities, and negative zero", () => {
    for (const delta of [Number.NaN, Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY, 10]) {
      const result = stepDrive({
        x: Number.NaN,
        z: Number.POSITIVE_INFINITY,
        heading: Number.NEGATIVE_INFINITY,
        speed: Number.NaN,
        wheelRotation: -0,
        verticalOffset: Number.NaN,
        verticalVelocity: Number.POSITIVE_INFINITY,
        checkpointIndex: Number.NaN,
        lapComplete: false,
      }, { throttle: Number.NaN as -1 | 0 | 1, steering: Number.POSITIVE_INFINITY as -1 | 0 | 1 }, delta);
      expectFiniteState(result.state);
    }
  });

  it("resolves overlapping circular obstacles and reduces speed", () => {
    const obstacle = { id: "test", x: 0, z: START_POSITION[1] + 0.2, radius: 0.8 };
    const collision = resolveObstacleCollision(0, START_POSITION[1], [obstacle], 1.15);
    expect(collision.collided).toBe(true);
    expect(Math.hypot(collision.x - obstacle.x, collision.z - obstacle.z)).toBeGreaterThanOrEqual(1.95);
    const result = stepDrive({ ...createInitialDriveState(), speed: 5 }, { throttle: 1, steering: 0 }, 0.05, lineWorld({ obstacles: [obstacle] }));
    expect(result.collided).toBe(true);
    expect(result.state.speed).toBeLessThan(2);
    expectFiniteState(result.state);
  });
});

describe("checkpoint, goal, and timer", () => {
  it("only passes the next checkpoint in order", () => {
    const world = lineWorld();
    const skipped = stepDrive({ ...createInitialDriveState(), x: 4, z: START_POSITION[1] }, EMPTY_DRIVE_INPUT, 0, world);
    expect(skipped.state.checkpointIndex).toBe(0);
    const first = stepDrive({ ...createInitialDriveState(), x: 2, z: START_POSITION[1] }, EMPTY_DRIVE_INPUT, 0, world);
    expect(first.checkpointPassed).toBe(true);
    expect(first.state.checkpointIndex).toBe(1);
    const reset = getCheckpointResetState(2, world);
    expect(reset.x).toBe(4);
    expect(reset.checkpointIndex).toBe(2);
    expect(reset.verticalOffset).toBe(0);
    expect(reset.verticalVelocity).toBe(0);
    expect(getCheckpointLabel(0)).toBe("CHECKPOINT 0 / 4");
    expect(getCheckpointLabel(4)).toBe("CHECKPOINT 4 / 4");
  });

  it("clears only after the final checkpoint and forward goal crossing", () => {
    const completeState: DriveState = {
      ...createInitialDriveState(),
      x: -0.1,
      z: START_POSITION[1],
      heading: Math.PI / 2,
      speed: 8,
      checkpointIndex: COURSE_CHECKPOINTS.length,
    };
    const complete = stepDrive(completeState, { throttle: 1, steering: 0 }, 0.05);
    expect(complete.lapCompleted).toBe(true);
    expect(complete.state.lapComplete).toBe(true);
    const reverse = stepDrive({ ...completeState, x: 0.1, speed: -2, heading: Math.PI / 2 }, { throttle: -1, steering: 0 }, 0.05);
    expect(reverse.lapCompleted).toBe(false);
    const beforeFinal = stepDrive({ ...completeState, checkpointIndex: COURSE_CHECKPOINTS.length - 1 }, { throttle: 1, steering: 0 }, 0.05);
    expect(beforeFinal.lapCompleted).toBe(false);
  });

  it("remains completable with a conservative waypoint steering controller", () => {
    let state = createInitialDriveState();
    let elapsed = 0;
    for (let step = 0; step < 1800 && !state.lapComplete; step += 1) {
      const target = state.checkpointIndex < COURSE_CHECKPOINTS.length
        ? COURSE_CHECKPOINTS[state.checkpointIndex]
        : { x: START_POSITION[0], z: START_POSITION[1] };
      const desiredHeading = Math.atan2(target.x - state.x, target.z - state.z);
      const difference = ((desiredHeading - state.heading + Math.PI * 3) % (Math.PI * 2)) - Math.PI;
      const steering = Math.abs(difference) < 0.08 ? 0 : difference > 0 ? -1 : 1;
      const result = stepDrive(state, { throttle: 1, steering }, 0.05);
      state = result.state;
      elapsed += 0.05;
    }
    expect(state.lapComplete, JSON.stringify({ state, elapsed })).toBe(true);
    expect(elapsed).toBeGreaterThan(10);
    expect(elapsed).toBeLessThan(60);
  });

  it("formats time and speed without live-storage concerns", () => {
    expect(formatTrialTime(32480)).toBe("32.48");
    expect(formatTrialTime(72480)).toBe("1:12.48");
    expect(formatTrialTime(Number.NaN)).toBe("0.00");
    expect(formatTrialTime(Number.POSITIVE_INFINITY)).toBe("0.00");
    expect(getSpeedDisplay(3.141)).toBe(3.1);
  });
});
