import { readFile } from "node:fs/promises";

import { describe, expect, it } from "vitest";

import {
  CHAIN_MOTIONS,
  ERASER_SIZE,
  MARBLE_RADIUS,
  RAMP_CLEARANCE,
  RAMP_SUPPORT_BOOKS,
  RULER_RAMP,
  getMarbleInitialCenter,
  worldToRampLocal,
} from "./deskLayout";
import { ChainPhysicsWorld, loadRapier } from "./chainPhysics";
import { CHAIN_STAGES } from "./chainSequence";
import { getQualityProfile } from "./qualityProfile";

describe("ACT 1 physics prototype contract", () => {
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
      if (eraserContactEvent) break;
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
    expect(finiteSnapshots).toBe(true);
    expect(worldToRampLocal(getMarbleInitialCenter())[1]).toBeGreaterThan(RULER_RAMP.thickness / 2 + MARBLE_RADIUS);
    physics.dispose();
  });
});
