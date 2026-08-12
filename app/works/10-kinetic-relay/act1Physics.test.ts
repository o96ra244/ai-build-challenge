import { readFile } from "node:fs/promises";

import { describe, expect, it } from "vitest";

import {
  CHAIN_MOTIONS,
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

  it("runs only stopper, ruler ramp, and eraser impact", () => {
    expect(CHAIN_STAGES.map((stage) => stage.id)).toEqual(["stopper", "red-ramp", "red-impact"]);
    expect(CHAIN_MOTIONS.slice(0, 3).every((motion) => motion.control === "physics")).toBe(true);
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
    expect(ACT1_DYNAMIC_VISUAL_IDS).toEqual(["redMarble", "eraser"]);
    expect(getVisualPhysicsDelta([1, 2, 3], [1.0005, 2, 3])).toBeCloseTo(0.0005, 7);
    expect(sceneSource).toContain("ACT1_DYNAMIC_VISUAL_IDS");
    expect(sceneSource).toContain("getVisualPhysicsDelta");
    expect(sceneSource).toContain("physics.advance(simulationDelta, true)");
    expect(sceneSource).toContain('this.chainState.phase === "settling"');
  });

  it("opens the stopper through visible pivot steps before emitting its event", async () => {
    const rapier = await loadRapier();
    const physics = new ChainPhysicsWorld(rapier, getQualityProfile(1440, 900, 1));
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
    let currentStage: "stopper" | "red-ramp" | "red-impact" = "stopper";
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
      if (postImpactSteps >= 30) break;
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
});
