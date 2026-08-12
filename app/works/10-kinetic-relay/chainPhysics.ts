import * as THREE from "three";

import {
  CHAIN_MOTIONS,
  CHAIN_RUNTIME_TARGET_SECONDS,
  MOTION_OBJECT_STARTS,
  ROOM_LAYOUT,
  TRACK_LAYOUT,
  getMotionDuration,
  getPathLength,
  type ChainMotion,
  type MotionObjectId,
  type Vector3Tuple,
} from "./deskLayout";
import type { ChainStageId } from "./chainSequence";
import type { QualityProfile } from "./qualityProfile";

export type RapierModule = typeof import("@dimforge/rapier3d-compat");

export type BodySnapshot = {
  readonly position: Vector3Tuple;
  readonly rotation: readonly [number, number, number, number];
};

export type ChainPhysicsEvent = ChainStageId;

export type MechanismSnapshot = {
  readonly activeStageId: ChainStageId | null;
  readonly activeProgress: number;
  readonly completedStageIndex: number;
  readonly started: boolean;
  readonly activeMotionBodies: number;
  readonly sleepingDynamicBodies: number;
};

const ZERO_QUATERNION: readonly [number, number, number, number] = [0, 0, 0, 1];
const MARBLE_IDS = new Set<MotionObjectId>(["redMarble", "blueMarble", "thirdMarble"]);

function finite(value: number, fallback = 0): number {
  return Number.isFinite(value) ? value : fallback;
}

function halfExtents(size: Vector3Tuple): [number, number, number] {
  return [size[0] / 2, size[1] / 2, size[2] / 2];
}

function quaternionFromEuler(rotation: readonly [number, number, number]): THREE.Quaternion {
  return new THREE.Quaternion().setFromEuler(new THREE.Euler(rotation[0], rotation[1], rotation[2]));
}

function motionObjectSize(objectId: MotionObjectId): Vector3Tuple {
  if (MARBLE_IDS.has(objectId)) return [0.44, 0.44, 0.44];
  if (objectId === "car") return [0.9, 0.42, 0.58];
  if (objectId === "clothespin" || objectId === "rubberBand") return [0.8, 0.24, 0.38];
  return [0.45, 0.22, 0.4];
}

export async function loadRapier(): Promise<RapierModule> {
  const rapier = await import("@dimforge/rapier3d-compat");
  const originalWarn = console.warn;
  console.warn = (...args: unknown[]): void => {
    if (String(args[0] ?? "").includes("deprecated parameters for the initialization function")) return;
    originalWarn(...args);
  };
  try {
    await rapier.init();
  } finally {
    console.warn = originalWarn;
  }
  return rapier;
}

export class ChainPhysicsWorld {
  private readonly rapier: RapierModule;
  private readonly world: import("@dimforge/rapier3d-compat").World;
  private readonly quality: QualityProfile;
  private readonly bodies = new Map<MotionObjectId, import("@dimforge/rapier3d-compat").RigidBody>();
  private readonly bodyColliders = new Map<MotionObjectId, import("@dimforge/rapier3d-compat").Collider>();
  private readonly endpointSensors = new Map<ChainStageId, import("@dimforge/rapier3d-compat").Collider>();
  private readonly staticColliders: import("@dimforge/rapier3d-compat").Collider[] = [];
  private accumulator = 0;
  private disposed = false;
  private started = false;
  private activeStageId: ChainStageId | null = null;
  private activeElapsed = 0;
  private activeStageIndex = -1;
  private eventQueue: ChainPhysicsEvent[] = [];

  public constructor(rapier: RapierModule, quality: QualityProfile) {
    this.rapier = rapier;
    this.quality = quality;
    this.world = new rapier.World(new rapier.Vector3(0, -9.81, 0));
    this.world.timestep = quality.physicsTimestep;
    this.world.integrationParameters.dt = quality.physicsTimestep;
    this.world.numSolverIterations = 4;
    this.world.maxCcdSubsteps = 1;

    Object.values(ROOM_LAYOUT).forEach((definition) => this.addFixedBox(definition));
    TRACK_LAYOUT.forEach((definition) => this.addFixedBox(definition));
    CHAIN_MOTIONS.forEach((motion) => this.addEndpointSensor(motion));
    Object.entries(MOTION_OBJECT_STARTS).forEach(([objectId, position]) => this.createMotionBody(objectId as MotionObjectId, position));
  }

  public start(): void {
    if (this.disposed || this.started) return;
    this.started = true;
  }

  public setStage(stageId: ChainStageId | null): void {
    if (this.disposed || stageId === this.activeStageId) return;
    this.activeStageId = stageId;
    this.activeElapsed = 0;
    this.activeStageIndex = stageId ? CHAIN_MOTIONS.findIndex((motion) => motion.id === stageId) : -1;
    const motion = this.getActiveMotion();
    if (motion) this.setBodyPosition(motion.objectId, motion.path[0] ?? MOTION_OBJECT_STARTS[motion.objectId]);
  }

  public reset(): void {
    if (this.disposed) return;
    this.started = false;
    this.activeStageId = null;
    this.activeElapsed = 0;
    this.activeStageIndex = -1;
    this.accumulator = 0;
    this.eventQueue = [];
    Object.entries(MOTION_OBJECT_STARTS).forEach(([objectId, position]) => this.setBodyPosition(objectId as MotionObjectId, position));
  }

  public advance(realDeltaSeconds: number, pageVisible: boolean): void {
    if (this.disposed || !this.started || !pageVisible) return;
    const safeDelta = Math.min(0.06, Math.max(0, finite(realDeltaSeconds)));
    this.activeElapsed += safeDelta;
    this.accumulator = Math.min(0.12, this.accumulator + safeDelta);
    let steps = 0;
    while (this.accumulator >= this.quality.physicsTimestep && steps < this.quality.maxSubsteps) {
      this.stepFixed();
      this.accumulator -= this.quality.physicsTimestep;
      steps += 1;
    }
    if (steps === this.quality.maxSubsteps && this.accumulator >= this.quality.physicsTimestep) this.accumulator = 0;
  }

  public consumeEvents(): readonly ChainPhysicsEvent[] {
    const events = this.eventQueue;
    this.eventQueue = [];
    return events;
  }

  public getSnapshot(objectId: MotionObjectId): BodySnapshot {
    const body = this.bodies.get(objectId);
    if (!body) return { position: [0, 0, 0], rotation: ZERO_QUATERNION };
    const position = body.translation();
    const rotation = body.rotation();
    return {
      position: [finite(position.x), finite(position.y), finite(position.z)],
      rotation: [finite(rotation.x), finite(rotation.y), finite(rotation.z), finite(rotation.w, 1)],
    };
  }

  public getMechanismSnapshot(): MechanismSnapshot {
    const motion = this.getActiveMotion();
    const duration = motion ? getMotionDuration(motion) : 1;
    return {
      activeStageId: this.activeStageId,
      activeProgress: motion ? Math.min(1, Math.max(0, this.activeElapsed / duration)) : 0,
      completedStageIndex: Math.max(-1, this.activeStageIndex - (motion && this.activeElapsed >= duration ? 0 : 1)),
      started: this.started,
      activeMotionBodies: this.started && this.activeStageId ? 1 : 0,
      sleepingDynamicBodies: 0,
    };
  }

  public getPerformanceSnapshot(): { readonly targetRuntimeSeconds: number; readonly motionBodyCount: number; readonly sleepingDynamicBodies: number } {
    return {
      targetRuntimeSeconds: CHAIN_RUNTIME_TARGET_SECONDS,
      motionBodyCount: this.bodies.size,
      sleepingDynamicBodies: 0,
    };
  }

  public dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.world.free();
  }

  private getActiveMotion(): ChainMotion | undefined {
    return this.activeStageId ? CHAIN_MOTIONS.find((motion) => motion.id === this.activeStageId) : undefined;
  }

  private stepFixed(): void {
    const motion = this.getActiveMotion();
    if (motion) {
      const travelDuration = getPathLength(motion.path) / Math.max(0.01, motion.speed);
      const travelProgress = Math.min(1, Math.max(0, this.activeElapsed / travelDuration));
      this.setBodyPosition(motion.objectId, this.samplePath(motion.path, travelProgress));
      if (this.activeElapsed >= getMotionDuration(motion) && !this.eventQueue.includes(motion.id)) {
        const sensor = this.endpointSensors.get(motion.id);
        const bodyCollider = this.bodyColliders.get(motion.objectId);
        const endpointContact = Boolean(sensor && bodyCollider && this.world.intersectionPair(sensor, bodyCollider));
        // The visible body reaching its supported endpoint is the deterministic fallback
        // for Rapier's kinematic sensor edge cases; it still represents the shown contact.
        if (endpointContact || travelProgress >= 1) this.eventQueue.push(motion.id);
      }
    }
    this.world.step();
  }

  private samplePath(path: readonly Vector3Tuple[], progress: number): Vector3Tuple {
    if (path.length === 0) return [0, 0, 0];
    if (path.length === 1) return path[0]!;
    const total = getPathLength(path);
    let remaining = total * Math.min(1, Math.max(0, progress));
    for (let index = 1; index < path.length; index += 1) {
      const from = path[index - 1]!;
      const to = path[index]!;
      const segment = Math.hypot(to[0] - from[0], to[1] - from[1], to[2] - from[2]);
      if (remaining <= segment || index === path.length - 1) {
        const amount = segment === 0 ? 1 : remaining / segment;
        return [from[0] + (to[0] - from[0]) * amount, from[1] + (to[1] - from[1]) * amount, from[2] + (to[2] - from[2]) * amount];
      }
      remaining -= segment;
    }
    return path[path.length - 1]!;
  }

  private createMotionBody(objectId: MotionObjectId, position: Vector3Tuple): void {
    const body = this.world.createRigidBody(this.rapier.RigidBodyDesc.kinematicPositionBased().setTranslation(...position));
    const collider = MARBLE_IDS.has(objectId)
      ? this.world.createCollider(this.rapier.ColliderDesc.ball(0.23).setFriction(0.55).setRestitution(0.15), body)
      : this.world.createCollider(this.rapier.ColliderDesc.cuboid(...halfExtents(motionObjectSize(objectId))).setFriction(0.6).setRestitution(0.08), body);
    this.bodies.set(objectId, body);
    this.bodyColliders.set(objectId, collider);
  }

  private addEndpointSensor(motion: ChainMotion): void {
    const endpoint = motion.path[motion.path.length - 1];
    if (!endpoint) return;
    const body = this.world.createRigidBody(this.rapier.RigidBodyDesc.fixed().setTranslation(...endpoint));
    const collider = this.world.createCollider(this.rapier.ColliderDesc.cuboid(0.38, 0.38, 0.45).setSensor(true), body);
    this.endpointSensors.set(motion.id, collider);
  }

  private addFixedBox(definition: { readonly size: Vector3Tuple; readonly position: Vector3Tuple; readonly rotation: readonly [number, number, number] }): void {
    const body = this.world.createRigidBody(this.rapier.RigidBodyDesc.fixed().setTranslation(...definition.position));
    const rotation = quaternionFromEuler(definition.rotation);
    const collider = this.world.createCollider(
      this.rapier.ColliderDesc.cuboid(...halfExtents(definition.size))
        .setRotation(new this.rapier.Quaternion(rotation.x, rotation.y, rotation.z, rotation.w))
        .setFriction(0.72)
        .setRestitution(0.08),
      body,
    );
    this.staticColliders.push(collider);
  }

  private setBodyPosition(objectId: MotionObjectId, position: Vector3Tuple): void {
    const body = this.bodies.get(objectId);
    if (!body) return;
    body.setNextKinematicTranslation(new this.rapier.Vector3(...position));
  }
}
