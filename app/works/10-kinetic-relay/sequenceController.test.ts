import * as THREE from "three";
import { describe, expect, it } from "vitest";

import { createMachineTracks, sampleGuideTarget, sampleSecondaryTarget } from "./courseTracks";
import { COURSE_IDS, createInitialSequence, getCourseTotalDuration, startSequence } from "./machineSequence";
import { getMechanismMotion, getPhysicsGuideTarget, getSecondaryPhysicsGuideTarget } from "./sequenceController";

describe("sequenceController", () => {
  it("keeps each course in the intended 18-28 second exhibition window", () => {
    const durations = COURSE_IDS.map((course) => getCourseTotalDuration(course));
    expect(durations[0]).toBeGreaterThanOrEqual(18);
    expect(durations[1]).toBeGreaterThanOrEqual(18);
    expect(durations[2]).toBeLessThanOrEqual(28);
  });

  it("keeps mechanisms stopped until the stage that causes them", () => {
    const ready = getMechanismMotion(createInitialSequence("B"));
    expect(ready.gearTrain).toBe(0);
    expect(ready.pendulum).toBe(0);
    const running = startSequence(createInitialSequence("B"));
    expect(getMechanismMotion(running).gearTrain).toBe(0);
  });

  it("generates finite physical guide targets from shared route definitions", () => {
    const tracks = createMachineTracks();
    const target = new THREE.Vector3();
    const state = startSequence(createInitialSequence("A"));
    const guide = getPhysicsGuideTarget(state, tracks, target);
    expect(guide.every(Number.isFinite)).toBe(true);
    expect(sampleGuideTarget("A", "helix", 0.5, tracks).y).toBeLessThan(7.2);
    const secondary = getSecondaryPhysicsGuideTarget(state, tracks, new THREE.Vector3());
    expect(secondary.every(Number.isFinite)).toBe(true);
    expect(sampleSecondaryTarget("orbit-rail", 0.5, tracks).x).toBeGreaterThan(3);
  });
});
