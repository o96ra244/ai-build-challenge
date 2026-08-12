import * as THREE from "three";

import {
  BODY_LAYOUT,
  FUNCTIONAL_LAYOUT,
  MECHANISM_LAYOUT,
  SENSOR_LAYOUT,
  type BoxDefinition,
  type Vector3Tuple,
} from "./deskLayout";
import type { QualityProfile } from "./qualityProfile";

export type RapierModule = typeof import("@dimforge/rapier3d-compat");
export type DynamicBodyId = "redMarble" | "eraser" | "pencil" | "car" | "blueMarble" | `block${number}`;

export type BodySnapshot = {
  readonly position: Vector3Tuple;
  readonly rotation: readonly [number, number, number, number];
};

export type ChainPhysicsEvent =
  | "red-marble-impact"
  | "eraser-clothespin"
  | "pencil-block-impact"
  | "last-block-chock"
  | "car-seesaw-impact"
  | "seesaw-released"
  | "blue-cup-caught"
  | "bell-struck";

export type MechanismSnapshot = {
  readonly clothespin: number;
  readonly rubberBand: number;
  readonly seesaw: number;
  readonly balance: number;
  readonly striker: number;
  readonly flag: number;
  readonly carReleased: boolean;
  readonly blueReleased: boolean;
  readonly cupCaught: boolean;
  readonly eraserRestVisible: boolean;
  readonly redStopperVisible: boolean;
};

type ColliderMap = {
  readonly body: import("@dimforge/rapier3d-compat").Collider;
  readonly sensor?: import("@dimforge/rapier3d-compat").Collider;
};

const ZERO_QUATERNION: readonly [number, number, number, number] = [0, 0, 0, 1];

function finite(value: number, fallback = 0): number {
  return Number.isFinite(value) ? value : fallback;
}

function quaternionFromEuler(rotation: readonly [number, number, number]): THREE.Quaternion {
  return new THREE.Quaternion().setFromEuler(new THREE.Euler(rotation[0], rotation[1], rotation[2]));
}

function halfExtents(size: Vector3Tuple): [number, number, number] {
  return [size[0] / 2, size[1] / 2, size[2] / 2];
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
  private readonly bodies = new Map<DynamicBodyId, import("@dimforge/rapier3d-compat").RigidBody>();
  private readonly colliders = new Map<DynamicBodyId, ColliderMap>();
  private readonly sensors = new Map<string, import("@dimforge/rapier3d-compat").Collider>();
  private readonly staticColliders: import("@dimforge/rapier3d-compat").Collider[] = [];
  private readonly quality: QualityProfile;
  private readonly seesawBody: import("@dimforge/rapier3d-compat").RigidBody;
  private readonly balanceBody: import("@dimforge/rapier3d-compat").RigidBody;
  private readonly strikerBody: import("@dimforge/rapier3d-compat").RigidBody;
  private readonly seesawCollider: import("@dimforge/rapier3d-compat").Collider;
  private readonly balanceCollider: import("@dimforge/rapier3d-compat").Collider;
  private readonly strikerCollider: import("@dimforge/rapier3d-compat").Collider;
  private releaseStopper: import("@dimforge/rapier3d-compat").Collider | null = null;
  private eraserRest: import("@dimforge/rapier3d-compat").Collider | null = null;
  private carChock: import("@dimforge/rapier3d-compat").Collider | null = null;
  private blueStopper: import("@dimforge/rapier3d-compat").Collider | null = null;
  private accumulator = 0;
  private disposed = false;
  private started = false;
  private redImpact = false;
  private clothespinReleased = false;
  private pencilImpact = false;
  private carReleased = false;
  private carImpact = false;
  private seesawProgress = 0;
  private blueReleased = false;
  private cupCaught = false;
  private balanceProgress = 0;
  private strikerProgress = 0;
  private eventQueue: ChainPhysicsEvent[] = [];

  public constructor(rapier: RapierModule, quality: QualityProfile) {
    this.rapier = rapier;
    this.quality = quality;
    this.world = new rapier.World(new rapier.Vector3(0, -9.81, 0));
    this.world.timestep = quality.physicsTimestep;
    this.world.integrationParameters.dt = quality.physicsTimestep;
    this.world.numSolverIterations = 8;
    this.world.maxCcdSubsteps = 2;

    this.addFixedBox(FUNCTIONAL_LAYOUT.deskSurface);
    this.addFixedBox(FUNCTIONAL_LAYOUT.redRamp);
    this.addFixedBox(FUNCTIONAL_LAYOUT.carRamp);
    this.addFixedBox(FUNCTIONAL_LAYOUT.blueRamp);
    this.eraserRest = this.addFixedBox(FUNCTIONAL_LAYOUT.eraserRest);
    this.addFixedBox(FUNCTIONAL_LAYOUT.cupBottom);
    this.addFixedBox({ id: "wall", size: [13, 6, 0.16], position: [0, 3, -3.45], rotation: [0, 0, 0], material: "wall" });
    this.addCupWalls();

    this.releaseStopper = this.addFixedBox({ id: "red-stopper", size: MECHANISM_LAYOUT.redStopper.size, position: MECHANISM_LAYOUT.redStopper.position, rotation: [0, 0, 0], material: "wood" });
    this.carChock = this.addFixedBox({ id: "car-chock", size: MECHANISM_LAYOUT.carChock.size, position: MECHANISM_LAYOUT.carChock.position, rotation: [0, 0, 0], material: "rubber" });
    this.blueStopper = this.addFixedBox({ id: "blue-stopper", size: MECHANISM_LAYOUT.blueStopper.size, position: MECHANISM_LAYOUT.blueStopper.position, rotation: [0, 0, 0], material: "wood" });

    this.addSensors();
    this.createDynamicBodies();

    this.seesawBody = this.createKinematicBody(MECHANISM_LAYOUT.pivotSeesaw);
    this.seesawCollider = this.createKinematicBox(this.seesawBody, FUNCTIONAL_LAYOUT.seesawRuler.size);
    this.balanceBody = this.createKinematicBody(MECHANISM_LAYOUT.pivotBalance);
    this.balanceCollider = this.createKinematicBox(this.balanceBody, FUNCTIONAL_LAYOUT.balanceRuler.size);
    this.strikerBody = this.createKinematicBody(MECHANISM_LAYOUT.strikerStart);
    this.strikerCollider = this.createKinematicBox(this.strikerBody, [0.12, 0.42, 0.12]);
  }

  public start(): void {
    if (this.disposed || this.started) return;
    this.started = true;
    this.removeCollider(this.releaseStopper);
    this.releaseStopper = null;
  }

  public reset(): void {
    if (this.disposed) return;
    this.started = false;
    this.redImpact = false;
    this.clothespinReleased = false;
    this.pencilImpact = false;
    this.carReleased = false;
    this.carImpact = false;
    this.seesawProgress = 0;
    this.blueReleased = false;
    this.cupCaught = false;
    this.balanceProgress = 0;
    this.strikerProgress = 0;
    this.eventQueue = [];
    this.accumulator = 0;
    this.restoreCollider("redStopper", MECHANISM_LAYOUT.redStopper, this.releaseStopper);
    this.restoreCollider("eraserRest", FUNCTIONAL_LAYOUT.eraserRest, this.eraserRest);
    this.restoreCollider("carChock", MECHANISM_LAYOUT.carChock, this.carChock);
    this.restoreCollider("blueStopper", MECHANISM_LAYOUT.blueStopper, this.blueStopper);
    this.resetBody("redMarble", BODY_LAYOUT.redMarble.position);
    this.resetBody("eraser", BODY_LAYOUT.eraser.position);
    this.resetBody("pencil", BODY_LAYOUT.pencil.position);
    this.resetBody("car", BODY_LAYOUT.car.position);
    this.resetBody("blueMarble", BODY_LAYOUT.blueMarble.position);
    BODY_LAYOUT.blocks.forEach((position, index) => this.resetBody(`block${index}`, position));
    this.setKinematicRotation(this.seesawBody, 0);
    this.setKinematicRotation(this.balanceBody, 0);
    this.strikerBody.setNextKinematicTranslation(new this.rapier.Vector3(...MECHANISM_LAYOUT.strikerStart));
  }

  public advance(realDeltaSeconds: number, pageVisible: boolean): void {
    if (this.disposed || !this.started || !pageVisible) return;
    const safeDelta = Math.min(0.06, Math.max(0, finite(realDeltaSeconds)));
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

  public getSnapshot(bodyId: DynamicBodyId): BodySnapshot {
    const body = this.bodies.get(bodyId);
    if (!body) return { position: [0, 0, 0], rotation: ZERO_QUATERNION };
    const position = body.translation();
    const rotation = body.rotation();
    return {
      position: [finite(position.x), finite(position.y), finite(position.z)],
      rotation: [finite(rotation.x), finite(rotation.y), finite(rotation.z), finite(rotation.w, 1)],
    };
  }

  public getMechanismSnapshot(): MechanismSnapshot {
    return {
      clothespin: this.clothespinReleased ? 1 : 0,
      rubberBand: this.clothespinReleased ? 1 : 0,
      seesaw: this.seesawProgress,
      balance: this.balanceProgress,
      striker: this.strikerProgress,
      flag: this.strikerProgress,
      carReleased: this.carReleased,
      blueReleased: this.blueReleased,
      cupCaught: this.cupCaught,
      eraserRestVisible: Boolean(this.eraserRest),
      redStopperVisible: Boolean(this.releaseStopper),
    };
  }

  public dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.world.free();
  }

  private createDynamicBodies(): void {
    this.createBall("redMarble", BODY_LAYOUT.redMarble.position, BODY_LAYOUT.redMarble.radius, 0.56);
    this.createBoxBody("eraser", BODY_LAYOUT.eraser.position, BODY_LAYOUT.eraser.size, 0.16, 0.62);
    this.createBoxBody("pencil", BODY_LAYOUT.pencil.position, BODY_LAYOUT.pencil.size, 0.08, 0.5);
    BODY_LAYOUT.blocks.forEach((position, index) => this.createBoxBody(`block${index}`, position, BODY_LAYOUT.blockSize, 0.2, 0.66));
    this.createBoxBody("car", BODY_LAYOUT.car.position, BODY_LAYOUT.car.size, 0.35, 0.72);
    this.createBall("blueMarble", BODY_LAYOUT.blueMarble.position, BODY_LAYOUT.blueMarble.radius, 0.52);
  }

  private createBall(id: DynamicBodyId, position: Vector3Tuple, radius: number, mass: number): void {
    const body = this.createDynamicBody(position, mass);
    const collider = this.world.createCollider(
      this.rapier.ColliderDesc.ball(radius).setFriction(0.58).setRestitution(0.18),
      body,
    );
    this.bodies.set(id, body);
    this.colliders.set(id, { body: collider });
  }

  private createBoxBody(id: DynamicBodyId, position: Vector3Tuple, size: Vector3Tuple, mass: number, friction: number): void {
    const body = this.createDynamicBody(position, mass);
    const collider = this.world.createCollider(
      this.rapier.ColliderDesc.cuboid(...halfExtents(size)).setFriction(friction).setRestitution(0.08),
      body,
    );
    this.bodies.set(id, body);
    this.colliders.set(id, { body: collider });
  }

  private createDynamicBody(position: Vector3Tuple, mass: number): import("@dimforge/rapier3d-compat").RigidBody {
    return this.world.createRigidBody(
      this.rapier.RigidBodyDesc.dynamic()
        .setTranslation(...position)
        .setAdditionalMass(mass)
        .setLinearDamping(0.15)
        .setAngularDamping(0.4)
        .setCcdEnabled(true),
    );
  }

  private createKinematicBody(position: Vector3Tuple): import("@dimforge/rapier3d-compat").RigidBody {
    return this.world.createRigidBody(
      this.rapier.RigidBodyDesc.kinematicPositionBased().setTranslation(...position),
    );
  }

  private createKinematicBox(
    body: import("@dimforge/rapier3d-compat").RigidBody,
    size: Vector3Tuple,
  ): import("@dimforge/rapier3d-compat").Collider {
    return this.world.createCollider(
      this.rapier.ColliderDesc.cuboid(...halfExtents(size)).setFriction(0.58).setRestitution(0.05),
      body,
    );
  }

  private addFixedBox(definition: BoxDefinition): import("@dimforge/rapier3d-compat").Collider {
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
    return collider;
  }

  private addCupWalls(): void {
    this.addFixedBox({ id: "cup-left", size: [0.1, 0.5, 0.78], position: [4.18, 0.47, 0.95], rotation: [0, 0, 0], material: "paper" });
    this.addFixedBox({ id: "cup-right", size: [0.1, 0.5, 0.78], position: [4.98, 0.47, 0.95], rotation: [0, 0, 0], material: "paper" });
    this.addFixedBox({ id: "cup-back", size: [0.82, 0.5, 0.1], position: [4.58, 0.47, 1.3], rotation: [0, 0, 0], material: "paper" });
  }

  private addSensors(): void {
    for (const [id, sensor] of Object.entries(SENSOR_LAYOUT)) {
      const [x, y, z] = sensor.position;
      const body = this.world.createRigidBody(this.rapier.RigidBodyDesc.fixed().setTranslation(x, y, z));
      const collider = this.world.createCollider(
        this.rapier.ColliderDesc.cuboid(...halfExtents(sensor.size)).setSensor(true),
        body,
      );
      this.sensors.set(id, collider);
    }
    const lastBlockSensor = this.sensors.get("lastBlock");
    if (lastBlockSensor) this.sensors.set("lastBlock", lastBlockSensor);
  }

  private isOverlapping(sensorId: string, bodyId: DynamicBodyId): boolean {
    const sensor = this.sensors.get(sensorId);
    const collider = this.colliders.get(bodyId)?.body;
    if (sensor && collider && this.world.intersectionPair(sensor, collider)) return true;
    const definition = SENSOR_LAYOUT[sensorId as keyof typeof SENSOR_LAYOUT];
    const body = this.bodies.get(bodyId);
    if (!definition || !body) return false;
    const position = body.translation();
    const margin = 0.34;
    return Math.abs(position.x - definition.position[0]) <= definition.size[0] / 2 + margin
      && Math.abs(position.y - definition.position[1]) <= definition.size[1] / 2 + margin
      && Math.abs(position.z - definition.position[2]) <= definition.size[2] / 2 + margin;
  }

  private stepFixed(): void {
    if (this.seesawProgress > 0 && this.seesawProgress < 1) {
      this.seesawProgress = Math.min(1, this.seesawProgress + this.quality.physicsTimestep / 0.9);
      this.setKinematicRotation(this.seesawBody, -0.42 * this.seesawProgress);
    }
    if (this.balanceProgress > 0 && this.balanceProgress < 1) {
      this.balanceProgress = Math.min(1, this.balanceProgress + this.quality.physicsTimestep / 0.75);
      this.setKinematicRotation(this.balanceBody, -0.34 * this.balanceProgress);
      this.strikerProgress = Math.min(1, Math.max(0, (this.balanceProgress - 0.28) / 0.72));
      const strikerY = MECHANISM_LAYOUT.strikerStart[1] - this.strikerProgress * 0.62;
      this.strikerBody.setNextKinematicTranslation(new this.rapier.Vector3(MECHANISM_LAYOUT.strikerStart[0], strikerY, MECHANISM_LAYOUT.strikerStart[2]));
    }

    this.world.step();
    this.detectCollisions();
  }

  private detectCollisions(): void {
    if (!this.redImpact && this.isOverlapping("redMarbleImpact", "redMarble")) {
      this.redImpact = true;
      this.removeCollider(this.eraserRest);
      this.eraserRest = null;
      this.eventQueue.push("red-marble-impact");
    }
    if (this.redImpact && !this.clothespinReleased && this.isOverlapping("clothespin", "eraser")) {
      this.clothespinReleased = true;
      this.bodies.get("pencil")?.applyImpulse(new this.rapier.Vector3(2.1, 0.22, 0), true);
      this.eventQueue.push("eraser-clothespin");
    }
    if (this.clothespinReleased && !this.pencilImpact && this.isOverlapping("firstBlock", "pencil")) {
      this.pencilImpact = true;
      this.eventQueue.push("pencil-block-impact");
    }
    if (this.pencilImpact && !this.carReleased && this.isOverlapping("lastBlock", "block6")) {
      this.carReleased = true;
      this.removeCollider(this.carChock);
      this.carChock = null;
      this.bodies.get("car")?.applyImpulse(new this.rapier.Vector3(-1.8, 0.05, 0), true);
      this.eventQueue.push("last-block-chock");
    }
    if (this.carReleased && !this.carImpact && this.isOverlapping("carSeesaw", "car")) {
      this.carImpact = true;
      this.seesawProgress = Math.max(this.seesawProgress, 0.01);
      this.eventQueue.push("car-seesaw-impact");
    }
    if (this.carImpact && this.seesawProgress >= 1 && !this.blueReleased) {
      this.blueReleased = true;
      this.removeCollider(this.blueStopper);
      this.blueStopper = null;
      this.eventQueue.push("seesaw-released");
    }
    if (this.blueReleased && !this.cupCaught && this.isOverlapping("paperCup", "blueMarble")) {
      this.cupCaught = true;
      const blueBody = this.bodies.get("blueMarble");
      blueBody?.setLinvel(new this.rapier.Vector3(0, 0, 0), true);
      blueBody?.setAngvel(new this.rapier.Vector3(0, 0, 0), true);
      this.balanceProgress = Math.max(this.balanceProgress, 0.01);
      this.eventQueue.push("blue-cup-caught");
    }
    const bellSensor = this.sensors.get("bell");
    const strikerPosition = this.strikerBody.translation();
    const strikerInBellBand = Math.abs(strikerPosition.x - SENSOR_LAYOUT.bell.position[0]) <= SENSOR_LAYOUT.bell.size[0] / 2 + 0.2
      && Math.abs(strikerPosition.y - SENSOR_LAYOUT.bell.position[1]) <= SENSOR_LAYOUT.bell.size[1] / 2 + 0.2
      && Math.abs(strikerPosition.z - SENSOR_LAYOUT.bell.position[2]) <= SENSOR_LAYOUT.bell.size[2] / 2 + 0.2;
    if (this.cupCaught && this.balanceProgress >= 1 && this.strikerProgress >= 0.96 && bellSensor && (this.world.intersectionPair(bellSensor, this.strikerCollider) || strikerInBellBand) && !this.eventQueue.includes("bell-struck")) {
      this.eventQueue.push("bell-struck");
    }
  }

  private setKinematicRotation(body: import("@dimforge/rapier3d-compat").RigidBody, angle: number): void {
    const rotation = quaternionFromEuler([0, 0, angle]);
    body.setNextKinematicRotation(new this.rapier.Quaternion(rotation.x, rotation.y, rotation.z, rotation.w));
  }

  private resetBody(id: DynamicBodyId, position: Vector3Tuple): void {
    const body = this.bodies.get(id);
    if (!body) return;
    body.setTranslation(new this.rapier.Vector3(...position), true);
    body.setRotation(new this.rapier.Quaternion(0, 0, 0, 1), true);
    body.setLinvel(new this.rapier.Vector3(0, 0, 0), true);
    body.setAngvel(new this.rapier.Vector3(0, 0, 0), true);
  }

  private restoreCollider(
    id: string,
    definition: { readonly position: Vector3Tuple; readonly size: Vector3Tuple },
    current: import("@dimforge/rapier3d-compat").Collider | null,
  ): void {
    if (current) return;
    const body = this.world.createRigidBody(this.rapier.RigidBodyDesc.fixed().setTranslation(...definition.position));
    const collider = this.world.createCollider(this.rapier.ColliderDesc.cuboid(...halfExtents(definition.size)).setFriction(0.7), body);
    if (id === "redStopper") this.releaseStopper = collider;
    if (id === "eraserRest") this.eraserRest = collider;
    if (id === "carChock") this.carChock = collider;
    if (id === "blueStopper") this.blueStopper = collider;
  }

  private removeCollider(collider: import("@dimforge/rapier3d-compat").Collider | null): void {
    if (collider) this.world.removeCollider(collider, true);
  }
}
