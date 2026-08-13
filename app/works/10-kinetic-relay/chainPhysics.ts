import * as THREE from "three";

import {
  CHAIN_MOTIONS,
  CHAIN_RUNTIME_TARGET_SECONDS,
  CLOTHESPIN_LAYOUT,
  ERASER_PAD,
  ERASER_SIZE,
  MARBLE_RADIUS,
  MOTION_OBJECT_STARTS,
  RAMP_SUPPORT_BOOKS,
  ROOM_LAYOUT,
  RULER_RAMP,
  STOPPER_LAYOUT,
  TRACK_LAYOUT,
  getMotionDuration,
  getPathLength,
  getRampExitPosition,
  getStopperOpeningProgress,
  worldToRampLocal,
  type ChainMotion,
  type MotionObjectId,
  type Vector3Tuple,
} from "./deskLayout";
import type { ChainStageId } from "./chainSequence";
import type { QualityProfile } from "./qualityProfile";

export type RapierModule = typeof import("@dimforge/rapier3d-compat");
type RapierBody = import("@dimforge/rapier3d-compat").RigidBody;
type RapierCollider = import("@dimforge/rapier3d-compat").Collider;

export type BodySnapshot = {
  readonly position: Vector3Tuple;
  readonly rotation: readonly [number, number, number, number];
};

export type DebugRenderSnapshot = {
  readonly vertices: Float32Array;
  readonly colors: Float32Array;
};

export type Act1DebugSnapshot = {
  readonly marblePosition: Vector3Tuple;
  readonly marbleClearance: number | null;
  readonly marbleMinRampLocal: Vector3Tuple | null;
  readonly marbleMaxSpeed: number;
  readonly marbleRotation: number;
  readonly eraserPosition: Vector3Tuple;
  readonly eraserDisplacement: number;
  readonly eraserContacted: boolean;
  readonly eraserClothespinContacted: boolean;
  readonly eraserClothespinContactPoint: Vector3Tuple | null;
  readonly eraserClothespinContactNormal: Vector3Tuple | null;
  readonly eraserClothespinContactForce: number;
  readonly clothespinPosition: Vector3Tuple;
  readonly clothespinOpeningAngle: number;
  readonly clothespinMaxOpeningAngle: number;
  readonly clothespinAngularVelocity: number;
  readonly clothespinOpeningComplete: boolean;
  readonly stopperOpeningProgress: number;
  readonly stopperOpeningComplete: boolean;
};

export type DynamicSettleSnapshot = {
  readonly marbleLinearSpeed: number;
  readonly eraserLinearSpeed: number;
  readonly marbleAngularSpeed: number;
  readonly eraserAngularSpeed: number;
  readonly clothespinLinearSpeed: number;
  readonly clothespinAngularSpeed: number;
  readonly allSleeping: boolean;
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

export const PHYSICS_MATERIALS = {
  // Marble rolls without instantly spinning out, while still transferring a visible push.
  marble: { friction: 0.55, restitution: 0, mass: 0.055 },
  // Plastic ruler is smoother than the desk, so gravity produces a readable roll.
  ruler: { friction: 0.28, restitution: 0.04 },
  // Rubber eraser absorbs the impact instead of bouncing away.
  eraser: { friction: 0.62, restitution: 0.025, mass: 0.065 },
  // Wood desk and book covers provide a stable, low-bounce support.
  desk: { friction: 0.68, restitution: 0.035 },
} as const;

const ZERO_QUATERNION: readonly [number, number, number, number] = [0, 0, 0, 1];
const MARBLE_IDS = new Set<MotionObjectId>(["redMarble", "blueMarble", "thirdMarble"]);
const ACT1_DYNAMIC_IDS = new Set<MotionObjectId>(["redMarble", "eraser", "clothespin"]);

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
  if (objectId === "redMarble") return [MARBLE_RADIUS * 2, MARBLE_RADIUS * 2, MARBLE_RADIUS * 2];
  if (objectId === "eraser") return ERASER_SIZE;
  if (MARBLE_IDS.has(objectId)) return [MARBLE_RADIUS * 2, MARBLE_RADIUS * 2, MARBLE_RADIUS * 2];
  if (objectId === "car") return [0.9, 0.42, 0.58];
  if (objectId === "clothespin" || objectId === "rubberBand") return [0.8, 0.24, 0.38];
  return [0.45, 0.22, 0.4];
}

function pairMatches(first: number, second: number, expectedFirst: number, expectedSecond: number): boolean {
  return (first === expectedFirst && second === expectedSecond) || (first === expectedSecond && second === expectedFirst);
}

function signedRotationAroundZ(rotation: { readonly x: number; readonly y: number; readonly z: number; readonly w: number }): number {
  return 2 * Math.atan2(rotation.z, rotation.w);
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
    return rapier;
  } finally {
    console.warn = originalWarn;
  }
}

export class ChainPhysicsWorld {
  private readonly rapier: RapierModule;
  private readonly world: import("@dimforge/rapier3d-compat").World;
  private readonly quality: QualityProfile;
  private readonly eventQueue: import("@dimforge/rapier3d-compat").EventQueue;
  private readonly bodies = new Map<MotionObjectId, RapierBody>();
  private readonly bodyColliders = new Map<MotionObjectId, RapierCollider>();
  private readonly endpointSensors = new Map<ChainStageId, RapierCollider>();
  private readonly staticColliders: RapierCollider[] = [];
  private readonly dynamicBodies = new Set<MotionObjectId>();
  private readonly stopperBody: RapierBody;
  private readonly clothespinArmCollider: RapierCollider;
  private readonly rampExitSensor: RapierCollider;
  private readonly redMarbleCollider: RapierCollider;
  private readonly eraserCollider: RapierCollider;
  private accumulator = 0;
  private disposed = false;
  private started = false;
  private activeStageId: ChainStageId | null = null;
  private activeElapsed = 0;
  private activeStageIndex = -1;
  private pendingEvents: ChainPhysicsEvent[] = [];
  private eraserContactObserved = false;
  private eraserClothespinContactObserved = false;
  private eraserClothespinContactPoint: Vector3Tuple | null = null;
  private eraserClothespinContactNormal: Vector3Tuple | null = null;
  private eraserClothespinContactForce = 0;
  private maximumClothespinOpeningAngle = 0;
  private impactEventEmitted = false;
  private clothespinEventEmitted = false;
  private stopperOpeningElapsed = 0;
  private stopperEventEmitted = false;
  private minimumRampClearance = Number.POSITIVE_INFINITY;
  private minimumRampLocal: Vector3Tuple | null = null;
  private maximumMarbleSpeed = 0;
  private maximumMarbleRotation = 0;

  public constructor(rapier: RapierModule, quality: QualityProfile) {
    this.rapier = rapier;
    this.quality = quality;
    this.world = new rapier.World(new rapier.Vector3(0, -9.81, 0));
    this.eventQueue = new rapier.EventQueue(true);
    this.world.timestep = quality.physicsTimestep;
    this.world.integrationParameters.dt = quality.physicsTimestep;
    this.world.integrationParameters.normalizedAllowedLinearError = 0.0001;
    this.world.integrationParameters.normalizedPredictionDistance = 0.001;
    this.world.numSolverIterations = 8;
    this.world.maxCcdSubsteps = 2;

    Object.values(ROOM_LAYOUT).forEach((definition) => this.addFixedBox(definition, PHYSICS_MATERIALS.desk));
    TRACK_LAYOUT.forEach((definition) => this.addFixedBox(definition, definition.material === "ruler" ? PHYSICS_MATERIALS.ruler : PHYSICS_MATERIALS.desk));
    RAMP_SUPPORT_BOOKS.forEach((book) => this.addFixedBox(book, PHYSICS_MATERIALS.desk));
    this.addFixedBox(ERASER_PAD, PHYSICS_MATERIALS.desk);
    this.addRulerRamp();
    this.rampExitSensor = this.addRampExitSensor();
    this.stopperBody = this.addStopper();
    Object.entries(MOTION_OBJECT_STARTS).forEach(([objectId, position]) => {
      if (objectId === "clothespin") return;
      this.createMotionBody(objectId as MotionObjectId, position);
    });
    this.clothespinArmCollider = this.addClothespinMechanism();
    this.redMarbleCollider = this.bodyColliders.get("redMarble")!;
    this.eraserCollider = this.bodyColliders.get("eraser")!;
    CHAIN_MOTIONS.filter((motion) => motion.control !== "physics").forEach((motion) => this.addEndpointSensor(motion));
  }

  public start(): void {
    if (this.disposed || this.started) return;
    this.started = true;
    this.stopperOpeningElapsed = 0;
    this.stopperEventEmitted = false;
    // START only begins the kinematic gate opening. No marble impulse or velocity is applied.
    this.stopperBody.setNextKinematicRotation(this.toRapierQuaternion(STOPPER_LAYOUT.rotation));
  }

  public setStage(stageId: ChainStageId | null): void {
    if (this.disposed || stageId === this.activeStageId) return;
    this.activeStageId = stageId;
    this.activeElapsed = 0;
    this.activeStageIndex = stageId ? CHAIN_MOTIONS.findIndex((motion) => motion.id === stageId) : -1;
    const motion = this.getActiveMotion();
    if (motion && motion.control !== "physics") {
      this.setKinematicBodyPosition(motion.objectId, motion.path[0] ?? MOTION_OBJECT_STARTS[motion.objectId]);
    }
  }

  public reset(): void {
    if (this.disposed) return;
    this.started = false;
    this.activeStageId = null;
    this.activeElapsed = 0;
    this.activeStageIndex = -1;
    this.accumulator = 0;
    this.pendingEvents = [];
    this.eraserContactObserved = false;
    this.eraserClothespinContactObserved = false;
    this.eraserClothespinContactPoint = null;
    this.eraserClothespinContactNormal = null;
    this.eraserClothespinContactForce = 0;
    this.maximumClothespinOpeningAngle = 0;
    this.impactEventEmitted = false;
    this.clothespinEventEmitted = false;
    this.stopperOpeningElapsed = 0;
    this.stopperEventEmitted = false;
    this.minimumRampClearance = Number.POSITIVE_INFINITY;
    this.minimumRampLocal = null;
    this.maximumMarbleSpeed = 0;
    this.maximumMarbleRotation = 0;
    this.eventQueue.clear();
    this.stopperBody.setTranslation(new this.rapier.Vector3(...STOPPER_LAYOUT.pivotPosition), true);
    this.stopperBody.setRotation(this.toRapierQuaternion(STOPPER_LAYOUT.rotation), true);
    Object.entries(MOTION_OBJECT_STARTS).forEach(([objectId, position]) => {
      const typedId = objectId as MotionObjectId;
      const body = this.bodies.get(typedId);
      if (!body) return;
      if (ACT1_DYNAMIC_IDS.has(typedId)) {
        body.setTranslation(new this.rapier.Vector3(...position), true);
        body.setRotation(new this.rapier.Quaternion(0, 0, 0, 1), true);
        body.setLinvel(new this.rapier.Vector3(0, 0, 0), true);
        body.setAngvel(new this.rapier.Vector3(0, 0, 0), true);
        body.wakeUp();
      } else {
        this.setKinematicBodyPosition(typedId, position);
      }
    });
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
    const events = this.pendingEvents;
    this.pendingEvents = [];
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

  public getStopperSnapshot(): BodySnapshot {
    const position = this.stopperBody.translation();
    const rotation = this.stopperBody.rotation();
    return {
      position: [finite(position.x), finite(position.y), finite(position.z)],
      rotation: [finite(rotation.x), finite(rotation.y), finite(rotation.z), finite(rotation.w, 1)],
    };
  }

  public getDynamicSettleSnapshot(): DynamicSettleSnapshot {
    const marble = this.bodies.get("redMarble");
    const eraser = this.bodies.get("eraser");
    const marbleLinear = marble?.linvel();
    const eraserLinear = eraser?.linvel();
    const clothespin = this.bodies.get("clothespin");
    const clothespinLinear = clothespin?.linvel();
    const marbleAngular = marble?.angvel();
    const eraserAngular = eraser?.angvel();
    const clothespinAngular = clothespin?.angvel();
    return {
      marbleLinearSpeed: marbleLinear ? Math.hypot(marbleLinear.x, marbleLinear.y, marbleLinear.z) : 0,
      eraserLinearSpeed: eraserLinear ? Math.hypot(eraserLinear.x, eraserLinear.y, eraserLinear.z) : 0,
      marbleAngularSpeed: marbleAngular ? Math.hypot(marbleAngular.x, marbleAngular.y, marbleAngular.z) : 0,
      eraserAngularSpeed: eraserAngular ? Math.hypot(eraserAngular.x, eraserAngular.y, eraserAngular.z) : 0,
      clothespinLinearSpeed: clothespinLinear ? Math.hypot(clothespinLinear.x, clothespinLinear.y, clothespinLinear.z) : 0,
      clothespinAngularSpeed: clothespinAngular ? Math.hypot(clothespinAngular.x, clothespinAngular.y, clothespinAngular.z) : 0,
      allSleeping: Boolean(marble?.isSleeping() && eraser?.isSleeping() && clothespin?.isSleeping()),
    };
  }

  public getMechanismSnapshot(): MechanismSnapshot {
    const motion = this.getActiveMotion();
    const duration = motion ? getMotionDuration(motion) : 1;
    const activeBody = motion?.objectId;
    let sleepingDynamicBodies = 0;
    this.dynamicBodies.forEach((objectId) => {
      if (this.bodies.get(objectId)?.isSleeping()) sleepingDynamicBodies += 1;
    });
    return {
      activeStageId: this.activeStageId,
      activeProgress: motion ? Math.min(1, Math.max(0, this.activeElapsed / duration)) : 0,
      completedStageIndex: Math.max(-1, this.activeStageIndex - (motion && this.activeElapsed >= duration ? 0 : 1)),
      started: this.started,
      activeMotionBodies: activeBody && this.dynamicBodies.has(activeBody) ? 1 : 0,
      sleepingDynamicBodies,
    };
  }

  public getPerformanceSnapshot(): { readonly targetRuntimeSeconds: number; readonly motionBodyCount: number; readonly sleepingDynamicBodies: number; readonly solverIterations: number; readonly ccdSubsteps: number } {
    let sleepingDynamicBodies = 0;
    this.dynamicBodies.forEach((objectId) => {
      if (this.bodies.get(objectId)?.isSleeping()) sleepingDynamicBodies += 1;
    });
    return {
      targetRuntimeSeconds: CHAIN_RUNTIME_TARGET_SECONDS,
      motionBodyCount: this.bodies.size,
      sleepingDynamicBodies,
      solverIterations: this.world.numSolverIterations,
      ccdSubsteps: this.world.maxCcdSubsteps,
    };
  }

  public getDebugRenderSnapshot(): DebugRenderSnapshot {
    const buffers = this.world.debugRender();
    return { vertices: new Float32Array(buffers.vertices), colors: new Float32Array(buffers.colors) };
  }

  public getAct1DebugSnapshot(): Act1DebugSnapshot {
    const marble = this.getSnapshot("redMarble");
    const eraser = this.getSnapshot("eraser");
    const clothespin = this.getSnapshot("clothespin");
    const clothespinBody = this.bodies.get("clothespin");
    const clothespinAngular = clothespinBody?.angvel();
    const clothespinOpeningAngle = Math.min(CLOTHESPIN_LAYOUT.maxOpeningAngle, Math.abs(signedRotationAroundZ({
      x: clothespin.rotation[0],
      y: clothespin.rotation[1],
      z: clothespin.rotation[2],
      w: clothespin.rotation[3],
    })));
    const local = worldToRampLocal(marble.position);
    const onRamp = local[0] >= -RULER_RAMP.length / 2 + MARBLE_RADIUS
      && local[0] <= RULER_RAMP.length / 2 - MARBLE_RADIUS
      && Math.abs(local[2]) <= RULER_RAMP.width / 2 + MARBLE_RADIUS;
    const clearance = local[1] - RULER_RAMP.thickness / 2 - MARBLE_RADIUS;
    return {
      marblePosition: marble.position,
      marbleClearance: Number.isFinite(this.minimumRampClearance) ? this.minimumRampClearance : (onRamp ? clearance : null),
      marbleMinRampLocal: this.minimumRampLocal,
      marbleMaxSpeed: this.maximumMarbleSpeed,
      marbleRotation: this.maximumMarbleRotation,
      eraserPosition: eraser.position,
      eraserDisplacement: Math.hypot(
        eraser.position[0] - MOTION_OBJECT_STARTS.eraser[0],
        eraser.position[1] - MOTION_OBJECT_STARTS.eraser[1],
        eraser.position[2] - MOTION_OBJECT_STARTS.eraser[2],
      ),
      eraserContacted: this.eraserContactObserved,
      eraserClothespinContacted: this.eraserClothespinContactObserved,
      eraserClothespinContactPoint: this.eraserClothespinContactPoint,
      eraserClothespinContactNormal: this.eraserClothespinContactNormal,
      eraserClothespinContactForce: this.eraserClothespinContactForce,
      clothespinPosition: clothespin.position,
      clothespinOpeningAngle,
      clothespinMaxOpeningAngle: this.maximumClothespinOpeningAngle,
      clothespinAngularVelocity: clothespinAngular ? Math.hypot(clothespinAngular.x, clothespinAngular.y, clothespinAngular.z) : 0,
      clothespinOpeningComplete: this.clothespinEventEmitted,
      stopperOpeningProgress: getStopperOpeningProgress(this.stopperOpeningElapsed),
      stopperOpeningComplete: this.stopperEventEmitted,
    };
  }

  public dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.eventQueue.free();
    this.world.free();
  }

  private getActiveMotion(): ChainMotion | undefined {
    return this.activeStageId ? CHAIN_MOTIONS.find((motion) => motion.id === this.activeStageId) : undefined;
  }

  private stepFixed(): void {
    const stopperOpeningComplete = this.advanceStopperOpening();
    const motion = this.getActiveMotion();
    if (motion && motion.control !== "physics") {
      const travelDuration = getPathLength(motion.path) / Math.max(0.01, motion.speed);
      const travelProgress = Math.min(1, Math.max(0, this.activeElapsed / travelDuration));
      this.setKinematicBodyPosition(motion.objectId, this.sampleKinematicPath(motion.path, travelProgress));
      if (this.activeElapsed >= getMotionDuration(motion) && !this.pendingEvents.includes(motion.id)) {
        const sensor = this.endpointSensors.get(motion.id);
        const bodyCollider = this.bodyColliders.get(motion.objectId);
        const endpointContact = Boolean(sensor && bodyCollider && this.world.intersectionPair(sensor, bodyCollider));
        if (endpointContact || travelProgress >= 1) this.pendingEvents.push(motion.id);
      }
    }
    this.world.step(this.eventQueue);
    if (stopperOpeningComplete && !this.stopperEventEmitted) {
      this.pendingEvents.push("stopper");
      this.stopperEventEmitted = true;
    }
    this.eventQueue.drainCollisionEvents((first, second, started) => {
      if (!started) return;
      if (this.activeStageId === "red-ramp" && pairMatches(first, second, this.redMarbleCollider.handle, this.rampExitSensor.handle)) {
        this.pendingEvents.push("red-ramp");
      }
      if (pairMatches(first, second, this.redMarbleCollider.handle, this.eraserCollider.handle)) this.eraserContactObserved = true;
      if (pairMatches(first, second, this.eraserCollider.handle, this.clothespinArmCollider.handle)) {
        this.eraserClothespinContactObserved = true;
      }
    });
    this.eventQueue.drainContactForceEvents((event) => {
      if (!pairMatches(event.collider1(), event.collider2(), this.eraserCollider.handle, this.clothespinArmCollider.handle)) return;
      this.eraserClothespinContactObserved = true;
      this.eraserClothespinContactForce = Math.max(this.eraserClothespinContactForce, finite(event.totalForceMagnitude()));
    });
    this.observeClothespinContact();
    const clothespinBody = this.bodies.get("clothespin");
    if (clothespinBody) {
      const rotation = clothespinBody.rotation();
      const openingAngle = Math.min(CLOTHESPIN_LAYOUT.maxOpeningAngle, Math.abs(signedRotationAroundZ(rotation)));
      this.maximumClothespinOpeningAngle = Math.max(this.maximumClothespinOpeningAngle, openingAngle);
    }
    const marbleBody = this.bodies.get("redMarble");
    if (marbleBody) {
      const position = marbleBody.translation();
      const local = worldToRampLocal([position.x, position.y, position.z]);
      if (local[0] >= -RULER_RAMP.length / 2 + MARBLE_RADIUS
        && local[0] <= RULER_RAMP.length / 2 - MARBLE_RADIUS
        && Math.abs(local[2]) <= RULER_RAMP.width / 2 + MARBLE_RADIUS) {
        const clearance = local[1] - RULER_RAMP.thickness / 2 - MARBLE_RADIUS;
        if (clearance < this.minimumRampClearance) {
          this.minimumRampClearance = clearance;
          this.minimumRampLocal = local;
        }
      }
      const velocity = marbleBody.linvel();
      this.maximumMarbleSpeed = Math.max(this.maximumMarbleSpeed, Math.hypot(velocity.x, velocity.y, velocity.z));
      const rotation = marbleBody.rotation();
      this.maximumMarbleRotation = Math.max(this.maximumMarbleRotation, 2 * Math.acos(Math.min(1, Math.abs(rotation.w))));
    }
    if (this.activeStageId === "red-impact" && this.eraserContactObserved && !this.impactEventEmitted) {
      this.pendingEvents.push("red-impact");
      this.impactEventEmitted = true;
    }
    if (this.activeStageId === "clothespin"
      && this.eraserClothespinContactObserved
      && this.maximumClothespinOpeningAngle >= CLOTHESPIN_LAYOUT.openingThreshold
      && !this.clothespinEventEmitted) {
      this.pendingEvents.push("clothespin");
      this.clothespinEventEmitted = true;
    }
  }

  private observeClothespinContact(): void {
    this.world.contactPair(this.eraserCollider, this.clothespinArmCollider, (manifold) => {
      if (manifold.numContacts() <= 0 && manifold.numSolverContacts() <= 0) return;
      this.eraserClothespinContactObserved = true;
      if (manifold.numSolverContacts() <= 0) return;
      const point = manifold.solverContactPoint(0);
      const normal = manifold.normal();
      this.eraserClothespinContactPoint = [finite(point.x), finite(point.y), finite(point.z)];
      this.eraserClothespinContactNormal = [finite(normal.x), finite(normal.y), finite(normal.z)];
    });
  }

  private advanceStopperOpening(): boolean {
    if (this.stopperEventEmitted) return true;
    this.stopperOpeningElapsed = Math.min(STOPPER_LAYOUT.openingDuration, this.stopperOpeningElapsed + this.quality.physicsTimestep);
    const progress = getStopperOpeningProgress(this.stopperOpeningElapsed);
    this.stopperBody.setNextKinematicRotation(this.getStopperRotation(progress));
    return progress >= 1;
  }

  private getStopperRotation(progress: number): import("@dimforge/rapier3d-compat").Quaternion {
    const base = quaternionFromEuler(STOPPER_LAYOUT.rotation);
    const opening = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), STOPPER_LAYOUT.openingAngle * STOPPER_LAYOUT.openingDirection * progress);
    base.multiply(opening);
    return new this.rapier.Quaternion(base.x, base.y, base.z, base.w);
  }

  private sampleKinematicPath(path: readonly Vector3Tuple[], progress: number): Vector3Tuple {
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
    if (objectId === "redMarble" || objectId === "eraser") {
      const dynamic = this.rapier.RigidBodyDesc.dynamic()
        .setTranslation(...position)
        .setGravityScale(1)
        .setCanSleep(true)
        .setCcdEnabled(true)
        .setAdditionalSolverIterations(4);
      const body = this.world.createRigidBody(dynamic);
      const isMarble = objectId === "redMarble";
      const role = isMarble ? PHYSICS_MATERIALS.marble : PHYSICS_MATERIALS.eraser;
      const shape = isMarble
        ? this.rapier.ColliderDesc.ball(MARBLE_RADIUS).setMass(role.mass)
        : this.rapier.ColliderDesc.cuboid(...halfExtents(ERASER_SIZE)).setMass(role.mass);
      if (isMarble) shape.setContactSkin(0.006);
      const collider = this.world.createCollider(
        shape
          .setFriction(role.friction)
          .setRestitution(role.restitution)
          .setActiveEvents(isMarble
            ? this.rapier.ActiveEvents.COLLISION_EVENTS
            : this.rapier.ActiveEvents.COLLISION_EVENTS | this.rapier.ActiveEvents.CONTACT_FORCE_EVENTS)
          .setContactForceEventThreshold(isMarble ? 1 : 0.001),
        body,
      );
      this.bodies.set(objectId, body);
      this.bodyColliders.set(objectId, collider);
      this.dynamicBodies.add(objectId);
      return;
    }

    const body = this.world.createRigidBody(this.rapier.RigidBodyDesc.kinematicPositionBased().setTranslation(...position));
    const collider = MARBLE_IDS.has(objectId)
      ? this.world.createCollider(this.rapier.ColliderDesc.ball(MARBLE_RADIUS).setFriction(0.55).setRestitution(0.15), body)
      : this.world.createCollider(this.rapier.ColliderDesc.cuboid(...halfExtents(motionObjectSize(objectId))).setFriction(0.6).setRestitution(0.08), body);
    this.bodies.set(objectId, body);
    this.bodyColliders.set(objectId, collider);
  }

  private addClothespinMechanism(): RapierCollider {
    const baseBody = this.world.createRigidBody(
      this.rapier.RigidBodyDesc.fixed().setTranslation(...CLOTHESPIN_LAYOUT.pivotPosition),
    );
    this.world.createCollider(
      this.rapier.ColliderDesc.cuboid(...halfExtents(CLOTHESPIN_LAYOUT.baseSize))
        .setTranslation(...CLOTHESPIN_LAYOUT.baseOffset)
        .setFriction(PHYSICS_MATERIALS.desk.friction)
        .setRestitution(PHYSICS_MATERIALS.desk.restitution),
      baseBody,
    );
    this.world.createCollider(
      this.rapier.ColliderDesc.cuboid(...halfExtents(CLOTHESPIN_LAYOUT.lowerArmSize))
        .setTranslation(...CLOTHESPIN_LAYOUT.lowerArmCenterOffset)
        .setFriction(PHYSICS_MATERIALS.ruler.friction)
        .setRestitution(PHYSICS_MATERIALS.ruler.restitution),
      baseBody,
    );
    const armBody = this.world.createRigidBody(
      this.rapier.RigidBodyDesc.dynamic()
        .setTranslation(...CLOTHESPIN_LAYOUT.pivotPosition)
        .setGravityScale(0)
        .setCanSleep(false)
        .setCcdEnabled(true)
        .setAdditionalSolverIterations(4),
    );
    const joint = this.world.createImpulseJoint(
      this.rapier.JointData.revolute(
        new this.rapier.Vector3(0, 0, 0),
        new this.rapier.Vector3(0, 0, 0),
        new this.rapier.Vector3(...CLOTHESPIN_LAYOUT.pivotAxis),
      ),
      baseBody,
      armBody,
      true,
    ) as import("@dimforge/rapier3d-compat").RevoluteImpulseJoint;
    joint.setLimits(-CLOTHESPIN_LAYOUT.maxOpeningAngle, CLOTHESPIN_LAYOUT.maxOpeningAngle);
    joint.configureMotorModel(this.rapier.MotorModel.ForceBased);
    joint.configureMotorPosition(CLOTHESPIN_LAYOUT.restAngle, CLOTHESPIN_LAYOUT.motorStiffness, CLOTHESPIN_LAYOUT.motorDamping);

    const activeEvents = this.rapier.ActiveEvents.COLLISION_EVENTS | this.rapier.ActiveEvents.CONTACT_FORCE_EVENTS;
    this.world.createCollider(
      this.rapier.ColliderDesc.cuboid(...halfExtents(CLOTHESPIN_LAYOUT.armSize))
        .setTranslation(...CLOTHESPIN_LAYOUT.armCenterOffset)
        .setDensity(0.0001)
        .setFriction(PHYSICS_MATERIALS.eraser.friction)
        .setRestitution(PHYSICS_MATERIALS.eraser.restitution),
      armBody,
    );
    this.world.createCollider(
      this.rapier.ColliderDesc.cuboid(...halfExtents(CLOTHESPIN_LAYOUT.jawSize))
        .setTranslation(...CLOTHESPIN_LAYOUT.jawOffset)
        .setDensity(0.0001)
        .setFriction(PHYSICS_MATERIALS.eraser.friction)
        .setRestitution(PHYSICS_MATERIALS.eraser.restitution),
      armBody,
    );
    const armCollider = this.world.createCollider(
      this.rapier.ColliderDesc.cuboid(...halfExtents(CLOTHESPIN_LAYOUT.handleSize))
        .setTranslation(...CLOTHESPIN_LAYOUT.handleOffset)
        .setMass(CLOTHESPIN_LAYOUT.armMass)
        .setFriction(PHYSICS_MATERIALS.eraser.friction)
        .setRestitution(PHYSICS_MATERIALS.eraser.restitution)
        .setActiveEvents(activeEvents)
        .setContactForceEventThreshold(0.001),
      armBody,
    );
    this.bodies.set("clothespin", armBody);
    this.bodyColliders.set("clothespin", armCollider);
    this.dynamicBodies.add("clothespin");
    return armCollider;
  }

  private addRulerRamp(): void {
    const body = this.world.createRigidBody(
      this.rapier.RigidBodyDesc.fixed()
        .setTranslation(...RULER_RAMP.position)
        .setRotation(this.toRapierQuaternion(RULER_RAMP.rotation)),
    );
    const collider = this.world.createCollider(
      this.rapier.ColliderDesc.cuboid(RULER_RAMP.length / 2, RULER_RAMP.thickness / 2, RULER_RAMP.width / 2)
        .setFriction(PHYSICS_MATERIALS.ruler.friction)
        .setRestitution(PHYSICS_MATERIALS.ruler.restitution),
      body,
    );
    this.staticColliders.push(collider);
  }

  private addRampExitSensor(): RapierCollider {
    const body = this.world.createRigidBody(
      this.rapier.RigidBodyDesc.fixed()
        .setTranslation(...getRampExitPosition())
        .setRotation(this.toRapierQuaternion(RULER_RAMP.rotation)),
    );
    return this.world.createCollider(
      this.rapier.ColliderDesc.cuboid(0.22, 0.42, RULER_RAMP.width * 0.42)
        .setSensor(true)
        .setActiveEvents(this.rapier.ActiveEvents.COLLISION_EVENTS),
      body,
    );
  }

  private addStopper(): RapierBody {
    const body = this.world.createRigidBody(
      this.rapier.RigidBodyDesc.kinematicPositionBased()
        .setTranslation(...STOPPER_LAYOUT.pivotPosition)
        .setRotation(this.toRapierQuaternion(STOPPER_LAYOUT.rotation)),
    );
    this.world.createCollider(
      this.rapier.ColliderDesc.cuboid(...halfExtents(STOPPER_LAYOUT.size))
        .setTranslation(...STOPPER_LAYOUT.gateOffset)
        .setFriction(PHYSICS_MATERIALS.ruler.friction)
        .setRestitution(PHYSICS_MATERIALS.ruler.restitution),
      body,
    );
    return body;
  }

  private addEndpointSensor(motion: ChainMotion): void {
    const endpoint = motion.path[motion.path.length - 1];
    if (!endpoint) return;
    const body = this.world.createRigidBody(this.rapier.RigidBodyDesc.fixed().setTranslation(...endpoint));
    const collider = this.world.createCollider(this.rapier.ColliderDesc.cuboid(0.38, 0.38, 0.45).setSensor(true), body);
    this.endpointSensors.set(motion.id, collider);
  }

  private addFixedBox(
    definition: { readonly size: Vector3Tuple; readonly position: Vector3Tuple; readonly rotation: readonly [number, number, number] },
    material: { readonly friction: number; readonly restitution: number },
  ): void {
    const body = this.world.createRigidBody(this.rapier.RigidBodyDesc.fixed().setTranslation(...definition.position));
    const collider = this.world.createCollider(
      this.rapier.ColliderDesc.cuboid(...halfExtents(definition.size))
        .setRotation(this.toRapierQuaternion(definition.rotation))
        .setFriction(material.friction)
        .setRestitution(material.restitution),
      body,
    );
    this.staticColliders.push(collider);
  }

  private setKinematicBodyPosition(objectId: MotionObjectId, position: Vector3Tuple): void {
    if (this.dynamicBodies.has(objectId)) return;
    const body = this.bodies.get(objectId);
    if (!body) return;
    body.setNextKinematicTranslation(new this.rapier.Vector3(...position));
  }

  private toRapierQuaternion(rotation: readonly [number, number, number]): import("@dimforge/rapier3d-compat").Quaternion {
    const quaternion = quaternionFromEuler(rotation);
    return new this.rapier.Quaternion(quaternion.x, quaternion.y, quaternion.z, quaternion.w);
  }
}
