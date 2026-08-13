import { readFile } from "node:fs/promises";

import { describe, expect, it } from "vitest";

import {
  CHAIN_MOTIONS,
  CLOTHESPIN_LAYOUT,
  ERASER_SIZE,
  MARBLE_RADIUS,
  RAMP_CLEARANCE,
  RAMP_SUPPORT_BOOKS,
  RULER_RAMP,
  STOPPER_LAYOUT,
  getMarbleInitialCenter,
  worldToRampLocal,
} from "./deskLayout";
import { ChainPhysicsWorld, loadRapier } from "./chainPhysics";
import { CHAIN_STAGES } from "./chainSequence";
import { getQualityProfile } from "./qualityProfile";
import { ACT1_DYNAMIC_VISUAL_IDS, getVisualPhysicsDelta } from "./visualSync";

describe("ACT 1 physics prototype contract", () => {
  function quaternionAngle(first: readonly [number, number, number, number], second: readonly [number, number, number, number]): number {
    const dot = Math.abs(first[0] * second[0] + first[1] * second[1] + first[2] * second[2] + first[3] * second[3]);
    return 2 * Math.acos(Math.min(1, Math.max(-1, dot)));
  }

  it("runs only the first physical link through clothespin opening", () => {
    expect(CHAIN_STAGES.map((stage) => stage.id)).toEqual(["stopper", "red-ramp", "red-impact", "clothespin"]);
    expect(CHAIN_MOTIONS.filter((motion) => CHAIN_STAGES.some((stage) => stage.id === motion.id)).every((motion) => motion.control === "physics")).toBe(true);
  });

  it("derives the marble start above the shared ruler surface", () => {
    const local = worldToRampLocal(getMarbleInitialCenter());
    const surfaceTop = RULER_RAMP.thickness / 2;
    expect(local[1]).toBeGreaterThan(surfaceTop + MARBLE_RADIUS);
    expect(local[1] - surfaceTop - MARBLE_RADIUS).toBeCloseTo(RAMP_CLEARANCE, 6);
  });

  it("shares physical dimensions between the first visual objects and colliders", () => {
    expect(RULER_RAMP.length).toBeGreaterThan(5);
    expect(RULER_RAMP.width).toBeGreaterThan(1);
    expect(RAMP_SUPPORT_BOOKS).toHaveLength(3);
    expect(ERASER_SIZE).toEqual([0.72, 0.3, 0.48]);
    expect(MARBLE_RADIUS).toBe(0.225);
    expect(CLOTHESPIN_LAYOUT.armSize[0]).toBeGreaterThan(0.6);
  });

  it("does not retain fake ACT 1 movement or impulse chaining", async () => {
    const physicsSource = await readFile(new URL("./chainPhysics.ts", import.meta.url), "utf8");
    expect(physicsSource).toContain("RigidBodyDesc.dynamic()");
    expect(physicsSource).toContain("setCcdEnabled(true)");
    expect(physicsSource).toContain("ActiveEvents.COLLISION_EVENTS");
    expect(physicsSource).not.toContain("applyImpulse");
    const dynamicBranchStart = physicsSource.indexOf('if (objectId === "redMarble" || objectId === "eraser")');
    const kinematicBranchStart = physicsSource.indexOf('const body = this.world.createRigidBody(this.rapier.RigidBodyDesc.kinematicPositionBased()', dynamicBranchStart);
    expect(dynamicBranchStart).toBeGreaterThanOrEqual(0);
    expect(kinematicBranchStart).toBeGreaterThan(dynamicBranchStart);
    expect(physicsSource.slice(dynamicBranchStart, kinematicBranchStart)).not.toContain("setNextKinematicTranslation");
  });

  it("defines dynamic visuals independently of the active stage", async () => {
    const sceneSource = await readFile(new URL("./DeskChainReactionScene.ts", import.meta.url), "utf8");
    expect(ACT1_DYNAMIC_VISUAL_IDS).toEqual(["redMarble", "eraser", "clothespin"]);
    expect(getVisualPhysicsDelta([1, 2, 3], [1.0005, 2, 3])).toBeCloseTo(0.0005, 7);
    expect(sceneSource).toContain("ACT1_DYNAMIC_VISUAL_IDS");
    expect(sceneSource).toContain("getVisualPhysicsDelta");
    expect(sceneSource).toContain("physics.advance(simulationDelta, true)");
    expect(sceneSource).toContain('this.chainState.phase === "settling"');
  });

  it("defines the eraser-to-clothespin link as a physical revolute mechanism", async () => {
    const [layoutSource, physicsSource, sceneSource] = await Promise.all([
      readFile(new URL("./deskLayout.ts", import.meta.url), "utf8"),
      readFile(new URL("./chainPhysics.ts", import.meta.url), "utf8"),
      readFile(new URL("./DeskChainReactionScene.ts", import.meta.url), "utf8"),
    ]);
    expect(CLOTHESPIN_LAYOUT.pivotAxis).toEqual([0, 0, 1]);
    expect(CLOTHESPIN_LAYOUT.openingThreshold).toBeGreaterThan(0);
    expect(CLOTHESPIN_LAYOUT.openingThreshold).toBeLessThan(CLOTHESPIN_LAYOUT.maxOpeningAngle);
    expect(layoutSource).toContain("CLOTHESPIN_LAYOUT");
    expect(physicsSource).toContain("JointData.revolute");
    expect(physicsSource).toContain("configureMotorPosition");
    expect(physicsSource).toContain("CONTACT_FORCE_EVENTS");
    expect(physicsSource).toContain("contactPair");
    expect(physicsSource).toContain("CLOTHESPIN_LAYOUT.armSize");
    expect(physicsSource).toContain("CLOTHESPIN_LAYOUT.jawSize");
    expect(physicsSource).toContain("setDensity(0.0001)");
    expect(physicsSource).toContain("CLOTHESPIN_LAYOUT.handleSize");
    expect(physicsSource).toContain("CLOTHESPIN_LAYOUT.handleOffset");
    expect(physicsSource).not.toContain("applyImpulse");
    expect(physicsSource).not.toContain("setNextKinematicTranslation(...MOTION_OBJECT_STARTS.clothespin");
    expect(sceneSource).toContain("CLOTHESPIN_LAYOUT.armSize");
    expect(sceneSource).not.toContain('if (motion.kind === "clothespin") mesh.rotation');
  });

  it("opens the stopper through visible pivot steps before emitting its event", async () => {
    const rapier = await loadRapier();
    const quality = getQualityProfile(1440, 900, 1);
    const physics = new ChainPhysicsWorld(rapier, quality);
    try {
      physics.start();
      physics.setStage("stopper");
      const initial = physics.getStopperSnapshot();
      for (let index = 0; index < 12; index += 1) physics.advance(1 / 60, true);
      const middle = physics.getStopperSnapshot();
      const middleDebug = physics.getAct1DebugSnapshot();
      expect(physics.consumeEvents()).not.toContain("stopper");
      expect(middle.position).toEqual(initial.position);
      expect(middleDebug.stopperOpeningProgress).toBeGreaterThan(0);
      expect(middleDebug.stopperOpeningProgress).toBeLessThan(1);
      expect(quaternionAngle(initial.rotation, middle.rotation)).toBeGreaterThan(0.2);
      for (let index = 0; index < 15; index += 1) physics.advance(1 / 60, true);
      const final = physics.getStopperSnapshot();
      const finalDebug = physics.getAct1DebugSnapshot();
      expect(physics.consumeEvents()).toContain("stopper");
      expect(final.position).toEqual(initial.position);
      expect(finalDebug.stopperOpeningProgress).toBe(1);
      expect(finalDebug.stopperOpeningComplete).toBe(true);
      expect(quaternionAngle(initial.rotation, final.rotation)).toBeGreaterThan(1.1);
      expect(quaternionAngle(initial.rotation, final.rotation)).toBeLessThan(Math.PI / 2);
    } finally {
      physics.dispose();
    }
  });

  it("shares the pivot gate definition and keeps marble control out of the opening", async () => {
    const [layoutSource, physicsSource, sceneSource] = await Promise.all([
      readFile(new URL("./deskLayout.ts", import.meta.url), "utf8"),
      readFile(new URL("./chainPhysics.ts", import.meta.url), "utf8"),
      readFile(new URL("./DeskChainReactionScene.ts", import.meta.url), "utf8"),
    ]);
    expect(STOPPER_LAYOUT.openingAngle).toBeGreaterThanOrEqual(Math.PI / 3);
    expect(STOPPER_LAYOUT.openingAngle).toBeLessThanOrEqual((Math.PI * 80) / 180);
    expect(STOPPER_LAYOUT.openingDuration).toBeCloseTo(0.4, 3);
    expect(layoutSource).toContain("pivotPosition");
    expect(layoutSource).toContain("gateOffset");
    expect(physicsSource).toContain("setNextKinematicRotation");
    expect(physicsSource).toContain("STOPPER_LAYOUT.gateOffset");
    expect(sceneSource).toContain("STOPPER_LAYOUT.gateOffset");
    expect(sceneSource).toContain("getStopperSnapshot");
    const startSource = physicsSource.slice(physicsSource.indexOf("public start"), physicsSource.indexOf("public setStage"));
    expect(startSource).not.toContain("redMarble");
    expect(startSource).not.toContain("setNextKinematicTranslation");
    expect(startSource).not.toContain("setLinvel");
    expect(startSource).not.toContain("applyImpulse");
  });

  it("rolls the marble from gravity into a real eraser collision", async () => {
    const rapier = await loadRapier();
    const physics = new ChainPhysicsWorld(rapier, getQualityProfile(1440, 900, 1));
    const marblePositions: number[][] = [];
    const marbleRotations: number[][] = [];
    const eraserPositions: number[][] = [];
    let currentStage: "stopper" | "red-ramp" | "red-impact" | "clothespin" = "stopper";
    let rampContactEvent = false;
    let eraserContactEvent = false;
    let eraserBeforeImpact: number[] | null = null;
    let eraserAtImpact: number[] | null = null;
    let postImpactSteps = 0;
    let postImpactEraserMoved = false;
    let postImpactMarbleMoved = false;
    let lastPostImpactEraser: number[] | null = null;
    let lastPostImpactMarble: number[] | null = null;

    physics.start();
    physics.setStage(currentStage);
    for (let frame = 0; frame < 900; frame += 1) {
      physics.advance(1 / 60, true);
      const marble = physics.getSnapshot("redMarble");
      const eraser = physics.getSnapshot("eraser");
      marblePositions.push([...marble.position]);
      marbleRotations.push([...marble.rotation]);
      eraserPositions.push([...eraser.position]);
      for (const event of physics.consumeEvents()) {
        if (event === "stopper") {
          currentStage = "red-ramp";
          physics.setStage(currentStage);
        } else if (event === "red-ramp") {
          rampContactEvent = true;
          eraserBeforeImpact = [...physics.getSnapshot("eraser").position];
          currentStage = "red-impact";
          physics.setStage(currentStage);
        } else if (event === "red-impact") {
          eraserContactEvent = true;
          eraserAtImpact = [...physics.getSnapshot("eraser").position];
          currentStage = "clothespin";
          physics.setStage(currentStage);
        }
      }
      if (eraserContactEvent) {
        postImpactSteps += 1;
        if (lastPostImpactEraser) {
          postImpactEraserMoved ||= Math.hypot(eraser.position[0] - lastPostImpactEraser[0], eraser.position[1] - lastPostImpactEraser[1], eraser.position[2] - lastPostImpactEraser[2]) > 0.0001;
        }
        if (lastPostImpactMarble) {
          postImpactMarbleMoved ||= Math.hypot(marble.position[0] - lastPostImpactMarble[0], marble.position[1] - lastPostImpactMarble[1], marble.position[2] - lastPostImpactMarble[2]) > 0.0001;
        }
        lastPostImpactEraser = [...eraser.position];
        lastPostImpactMarble = [...marble.position];
      }
      if (postImpactSteps >= 240) break;
    }

    const initialMarble = marblePositions[0]!;
    const marbleMovedDownstream = Math.max(...marblePositions.map((position) => position[0])) - initialMarble[0];
    const marbleRotated = Math.max(...marbleRotations.map((rotation) => Math.abs(rotation[2] - marbleRotations[0]![2]))) > 0.01;
    const eraserMoved = eraserBeforeImpact && eraserAtImpact
      ? Math.hypot(eraserAtImpact[0] - eraserBeforeImpact[0], eraserAtImpact[1] - eraserBeforeImpact[1], eraserAtImpact[2] - eraserBeforeImpact[2])
      : 0;
    const finiteSnapshots = [...marblePositions, ...eraserPositions].every((position) => position.every(Number.isFinite));

    expect(rampContactEvent).toBe(true);
    expect(eraserContactEvent).toBe(true);
    expect(marbleMovedDownstream).toBeGreaterThan(1);
    expect(marbleRotated).toBe(true);
    expect(eraserMoved).toBeGreaterThan(0.02);
    expect(postImpactSteps).toBeGreaterThanOrEqual(30);
    expect(postImpactEraserMoved).toBe(true);
    expect(postImpactMarbleMoved).toBe(true);
    expect(finiteSnapshots).toBe(true);
    expect(worldToRampLocal(getMarbleInitialCenter())[1]).toBeGreaterThan(RULER_RAMP.thickness / 2 + MARBLE_RADIUS);
    physics.dispose();
  });

  it("opens the clothespin only after physical eraser contact and resets to rest", async () => {
    const rapier = await loadRapier();
    const physics = new ChainPhysicsWorld(rapier, getQualityProfile(1440, 900, 1));
    let currentStage: "stopper" | "red-ramp" | "red-impact" | "clothespin" = "stopper";
    let impactEvent = false;
    let impactFrame = -1;
    let clothespinEvent = false;
    let maximumAngleBeforeContact = 0;
    let maximumAngleAfterContact = 0;
    let contactFrame = -1;
    let clothespinEventFrame = -1;

    try {
      physics.start();
      physics.setStage(currentStage);
      for (let frame = 0; frame < 900; frame += 1) {
        physics.advance(1 / 60, true);
        const debug = physics.getAct1DebugSnapshot();
        if (debug.eraserClothespinContacted && contactFrame < 0) contactFrame = frame;
        if (debug.eraserClothespinContacted) {
          maximumAngleAfterContact = Math.max(maximumAngleAfterContact, debug.clothespinOpeningAngle);
        } else {
          maximumAngleBeforeContact = Math.max(maximumAngleBeforeContact, debug.clothespinOpeningAngle);
        }
        for (const event of physics.consumeEvents()) {
          if (event === "stopper") {
            currentStage = "red-ramp";
            physics.setStage(currentStage);
          } else if (event === "red-ramp") {
            currentStage = "red-impact";
            physics.setStage(currentStage);
          } else if (event === "red-impact") {
            impactEvent = true;
            impactFrame = frame;
            currentStage = "clothespin";
            physics.setStage(currentStage);
          } else if (event === "clothespin") {
            clothespinEvent = true;
            clothespinEventFrame = frame;
          }
        }
        if (clothespinEvent && frame > clothespinEventFrame + 240) break;
      }

      const debug = physics.getAct1DebugSnapshot();
      const clothespin = physics.getSnapshot("clothespin");
      const pivotDelta = Math.hypot(
        clothespin.position[0] - CLOTHESPIN_LAYOUT.pivotPosition[0],
        clothespin.position[1] - CLOTHESPIN_LAYOUT.pivotPosition[1],
        clothespin.position[2] - CLOTHESPIN_LAYOUT.pivotPosition[2],
      );
      expect(impactEvent).toBe(true);
      expect(contactFrame).toBeGreaterThan(0);
      expect(contactFrame).toBeGreaterThan(impactFrame);
      expect(debug.eraserClothespinContactPoint?.every(Number.isFinite)).toBe(true);
      expect(debug.eraserClothespinContactNormal?.every(Number.isFinite)).toBe(true);
      expect(debug.eraserClothespinContactForce).toBeGreaterThan(0);
      expect(maximumAngleBeforeContact).toBeLessThan(0.02);
      expect(maximumAngleAfterContact).toBeGreaterThanOrEqual(CLOTHESPIN_LAYOUT.openingThreshold);
      expect(clothespinEvent).toBe(true);
      expect(clothespinEventFrame).toBeGreaterThan(contactFrame);
      expect(debug.clothespinOpeningAngle).toBeLessThan(0.08);
      expect(debug.clothespinAngularVelocity).toBeLessThan(0.02);
      expect(pivotDelta).toBeLessThan(0.02);

      physics.reset();
      const resetDebug = physics.getAct1DebugSnapshot();
      const resetClothespin = physics.getSnapshot("clothespin");
      expect(resetDebug.eraserClothespinContacted).toBe(false);
      expect(resetDebug.clothespinOpeningAngle).toBeCloseTo(CLOTHESPIN_LAYOUT.restAngle, 4);
      expect(resetClothespin.position[0]).toBeCloseTo(CLOTHESPIN_LAYOUT.pivotPosition[0], 5);
      expect(resetClothespin.position[1]).toBeCloseTo(CLOTHESPIN_LAYOUT.pivotPosition[1], 5);
      expect(resetClothespin.position[2]).toBeCloseTo(CLOTHESPIN_LAYOUT.pivotPosition[2], 5);
      expect(resetDebug.clothespinOpeningComplete).toBe(false);
    } finally {
      physics.dispose();
    }
  });
});
