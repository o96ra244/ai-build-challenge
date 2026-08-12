import * as THREE from "three";

import { sampleGuideTarget, sampleSecondaryTarget, type MachineTracks } from "./courseTracks";
import { getCurrentStage, getCurrentStageProgress, type CourseId, type SequenceState } from "./machineSequence";

export type MechanismMotion = {
  readonly stageId: string;
  readonly stageProgress: number;
  readonly release: number;
  readonly helix: number;
  readonly rocker: number;
  readonly paddleBank: number;
  readonly hammer: number;
  readonly pendulum: number;
  readonly gearTrain: number;
  readonly rack: number;
  readonly gate: number;
  readonly drop: number;
  readonly funnel: number;
  readonly balance: number;
  readonly secondMarble: boolean;
  readonly orbit: number;
  readonly turbine: number;
};

function clamp(value: number): number {
  return Number.isFinite(value) ? Math.min(1, Math.max(0, value)) : 0;
}

function stageProgress(state: SequenceState): number {
  return state.phase === "complete" ? 1 : clamp(getCurrentStageProgress(state));
}

export function getMechanismMotion(state: SequenceState): MechanismMotion {
  const stage = getCurrentStage(state);
  const progress = stageProgress(state);
  return {
    stageId: stage.id,
    stageProgress: progress,
    release: state.phase === "ready" ? 0 : stage.id === "release" ? progress : 1,
    helix: stage.id === "helix" ? progress : stage.id === "rocker" || stage.id === "paddle-bank" || stage.id === "hammer" || stage.id === "return" ? 1 : 0,
    rocker: stage.id === "rocker" ? progress : stage.id === "paddle-bank" || stage.id === "hammer" || stage.id === "return" ? 1 : 0,
    paddleBank: stage.id === "paddle-bank" ? progress : stage.id === "hammer" || stage.id === "return" ? 1 : 0,
    hammer: stage.id === "hammer" ? progress : stage.id === "return" ? 1 : 0,
    pendulum: state.phase === "running" && stage.id === "pendulum" ? progress : 0,
    gearTrain: stage.id === "gear-train" ? progress : stage.id === "lift-gate" || stage.id === "drop" || stage.id === "return" ? 1 : 0,
    rack: stage.id === "lift-gate" ? progress : stage.id === "drop" || stage.id === "return" ? 1 : 0,
    gate: stage.id === "lift-gate" ? progress : stage.id === "drop" || stage.id === "return" ? 1 : 0,
    drop: stage.id === "drop" ? progress : stage.id === "return" ? 1 : 0,
    funnel: stage.id === "glass-funnel" ? progress : stage.id === "balance" || stage.id === "second-marble" || stage.id === "orbit-rail" || stage.id === "turbine" || stage.id === "return" ? 1 : 0,
    balance: stage.id === "balance" ? progress : stage.id === "second-marble" || stage.id === "orbit-rail" || stage.id === "turbine" || stage.id === "return" ? 1 : 0,
    secondMarble: state.course === "C" && (stage.id === "second-marble" || stage.id === "orbit-rail" || stage.id === "turbine" || stage.id === "return"),
    orbit: stage.id === "orbit-rail" ? progress : stage.id === "turbine" || stage.id === "return" ? 1 : 0,
    turbine: stage.id === "turbine" ? progress : stage.id === "return" ? 1 : 0,
  };
}

export function getPhysicsGuideTarget(
  state: SequenceState,
  tracks: MachineTracks,
  target: THREE.Vector3,
): readonly [number, number, number] {
  const stage = getCurrentStage(state);
  if (state.phase === "ready") {
    const point = sampleGuideTarget(state.course, "release", 0, tracks);
    target.set(point.x, point.y, point.z);
  } else {
    const point = sampleGuideTarget(state.course, stage.id, stageProgress(state), tracks);
    target.set(point.x, point.y, point.z);
  }
  return [target.x, target.y, target.z];
}

export function getSecondaryPhysicsGuideTarget(
  state: SequenceState,
  tracks: MachineTracks,
  target: THREE.Vector3,
): readonly [number, number, number] {
  const stage = getCurrentStage(state);
  const point = sampleSecondaryTarget(stage.id, stageProgress(state), tracks);
  target.set(point.x, point.y, point.z);
  return [target.x, target.y, target.z];
}

export function isMechanismTriggered(state: SequenceState, course: CourseId, stageId: string): boolean {
  return state.course === course && state.phase === "running" && getCurrentStage(state).id === stageId;
}
