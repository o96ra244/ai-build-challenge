import {
  CLIMBABLE_OBSTACLES,
  DYNAMIC_PROPS,
  FIXED_OBSTACLES,
  FRONTIER_BOUNDS,
  FRONTIER_START,
  HEIGHTFIELD_COLUMNS,
  HEIGHTFIELD_HEIGHTS,
  HEIGHTFIELD_ROWS,
  FRONTIER_DEPTH,
  FRONTIER_WIDTH,
  getFrontierArea,
  getFrontierHeight,
  getSurfaceType,
  isInsideFrontierBounds,
  type SurfaceType,
} from "./frontierWorld";
import { clampFrontierDeltaSeconds, sanitizeDriveInput, type DriveInput } from "./driveModel";
import {
  getBrakeForce,
  getEngineForce,
  getSteeringAngle,
  getSurfaceTuning,
  getWheelFrictionSlip,
  VEHICLE_CONFIG,
  WHEEL_CONFIGS,
} from "./vehicleConfig";

export type RapierModule = typeof import("@dimforge/rapier3d-compat");

export type PhysicsSnapshot = {
  readonly x: number;
  readonly y: number;
  readonly z: number;
  readonly rotation: { readonly x: number; readonly y: number; readonly z: number; readonly w: number };
  readonly heading: number;
  readonly speed: number;
  readonly groundedWheels: number;
  readonly wheelRotations: readonly number[];
  readonly wheelSuspensionLengths: readonly number[];
  readonly surface: SurfaceType;
  readonly traction: number;
  readonly areaLabel: string;
  readonly recoveryReady: boolean;
  readonly rolloverSeconds: number;
  readonly insideBounds: boolean;
};

export type DynamicPropSnapshot = {
  readonly x: number;
  readonly y: number;
  readonly z: number;
  readonly rotation: { readonly x: number; readonly y: number; readonly z: number; readonly w: number };
};

export async function loadRapier(): Promise<RapierModule> {
  const rapier = await import("@dimforge/rapier3d-compat");
  const originalWarn = console.warn;
  console.warn = (...args: unknown[]): void => {
    if (String(args[0] ?? "").includes("deprecated parameters for the initialization function")) {
      return;
    }
    originalWarn(...args);
  };
  try {
    await rapier.init();
  } finally {
    console.warn = originalWarn;
  }
  return rapier;
}

function finiteOr(value: number, fallback = 0): number {
  if (!Number.isFinite(value)) {
    return fallback;
  }
  return Object.is(value, -0) ? 0 : value;
}

function finiteRotation(rotation: { readonly x: number; readonly y: number; readonly z: number; readonly w: number }): PhysicsSnapshot["rotation"] {
  return {
    x: finiteOr(rotation.x),
    y: finiteOr(rotation.y),
    z: finiteOr(rotation.z),
    w: finiteOr(rotation.w, 1),
  };
}

function upVectorY(rotation: PhysicsSnapshot["rotation"]): number {
  return finiteOr(1 - 2 * (rotation.x * rotation.x + rotation.z * rotation.z), 1);
}

function createFixedCollider(
  rapier: RapierModule,
  world: import("@dimforge/rapier3d-compat").World,
  x: number,
  y: number,
  z: number,
  radius: number,
  height: number,
  kind: "round" | "box" = "round",
): void {
  const body = world.createRigidBody(
    rapier.RigidBodyDesc.fixed().setTranslation(x, y, z),
  );
  const descriptor = kind === "box"
    ? rapier.ColliderDesc.cuboid(radius, Math.max(0.2, height), radius)
    : rapier.ColliderDesc.roundCuboid(radius, Math.max(0.2, height), radius, Math.min(0.35, radius * 0.25));
  descriptor.setFriction(1.05).setRestitution(0.04);
  world.createCollider(descriptor, body);
}

export class RoverPhysicsWorld {
  private readonly rapier: RapierModule;
  private readonly world: import("@dimforge/rapier3d-compat").World;
  private readonly chassis: import("@dimforge/rapier3d-compat").RigidBody;
  private readonly vehicle: import("@dimforge/rapier3d-compat").DynamicRayCastVehicleController;
  private readonly dynamicBodies: readonly import("@dimforge/rapier3d-compat").RigidBody[];
  private accumulator = 0;
  private disposed = false;
  private recoverySeconds = 0;
  private lastSafeTranslation = { x: FRONTIER_START.x, y: 4, z: FRONTIER_START.z };
  private lastSafeRotation = { x: 0, y: 0, z: 0, w: 1 };
  private previousSnapshot: PhysicsSnapshot;
  private currentSnapshot: PhysicsSnapshot;

  public constructor(rapier: RapierModule) {
    this.rapier = rapier;
    this.world = new rapier.World(new rapier.Vector3(0, VEHICLE_CONFIG.gravity, 0));
    this.world.timestep = VEHICLE_CONFIG.fixedTimestep;
    this.world.integrationParameters.dt = VEHICLE_CONFIG.fixedTimestep;
    this.world.maxCcdSubsteps = 2;
    this.world.numSolverIterations = 6;

    const terrain = rapier.ColliderDesc.heightfield(
      HEIGHTFIELD_ROWS - 1,
      HEIGHTFIELD_COLUMNS - 1,
      HEIGHTFIELD_HEIGHTS,
      new rapier.Vector3(FRONTIER_WIDTH, 1, FRONTIER_DEPTH),
    );
    terrain.setFriction(1.0).setRestitution(0.02);
    this.world.createCollider(terrain);

    for (const obstacle of FIXED_OBSTACLES) {
      createFixedCollider(
        rapier,
        this.world,
        obstacle.x,
        getFrontierHeight(obstacle.x, obstacle.z) + obstacle.height / 2,
        obstacle.z,
        obstacle.radius,
        obstacle.height / 2,
      );
    }
    for (const obstacle of CLIMBABLE_OBSTACLES) {
      createFixedCollider(
        rapier,
        this.world,
        obstacle.x,
        getFrontierHeight(obstacle.x, obstacle.z) + obstacle.height / 2,
        obstacle.z,
        obstacle.radius,
        obstacle.height / 2,
      );
    }

    const wallHeight = 8;
    createFixedCollider(rapier, this.world, FRONTIER_BOUNDS.minX - 2, 4, 0, 2, wallHeight, "box");
    createFixedCollider(rapier, this.world, FRONTIER_BOUNDS.maxX + 2, 4, 0, 2, wallHeight, "box");
    createFixedCollider(rapier, this.world, 0, 4, FRONTIER_BOUNDS.minZ - 2, 2, wallHeight, "box");
    createFixedCollider(rapier, this.world, 0, 4, FRONTIER_BOUNDS.maxZ + 2, 2, wallHeight, "box");

    const propBodies: import("@dimforge/rapier3d-compat").RigidBody[] = [];
    for (const prop of DYNAMIC_PROPS) {
      const body = this.world.createRigidBody(
        rapier.RigidBodyDesc.dynamic()
          .setTranslation(prop.x, getFrontierHeight(prop.x, prop.z) + prop.height + 0.5, prop.z)
          .setAdditionalMass(prop.mass)
          .setLinearDamping(0.9)
          .setAngularDamping(1.2)
          .setCanSleep(true)
          .setCcdEnabled(true),
      );
      const collider = rapier.ColliderDesc.roundCuboid(
        prop.radius * 0.84,
        prop.height * 0.5,
        prop.radius * 0.84,
        Math.min(0.2, prop.radius * 0.2),
      );
      collider.setMass(prop.mass).setFriction(0.95).setRestitution(0.12);
      this.world.createCollider(collider, body);
      propBodies.push(body);
    }
    this.dynamicBodies = propBodies;

    const startHeight = getFrontierHeight(FRONTIER_START.x, FRONTIER_START.z);
    const chassisDescription = rapier.RigidBodyDesc.dynamic()
      .setTranslation(FRONTIER_START.x, startHeight + 2.35, FRONTIER_START.z)
      .setAdditionalMassProperties(
        VEHICLE_CONFIG.chassisMass,
        new rapier.Vector3(0, VEHICLE_CONFIG.centerOfMassY, 0),
        new rapier.Vector3(1200, 980, 1450),
        new rapier.Quaternion(0, 0, 0, 1),
      )
      .setLinearDamping(0.28)
      .setAngularDamping(2.6)
      .setCanSleep(false)
      .setCcdEnabled(true)
      .setSoftCcdPrediction(0.45);
    this.chassis = this.world.createRigidBody(chassisDescription);
    const chassisCollider = rapier.ColliderDesc.roundCuboid(2.42, 0.72, 1.32, 0.24);
    chassisCollider.setDensity(0).setFriction(0.95).setRestitution(0.08);
    this.world.createCollider(chassisCollider, this.chassis);

    this.vehicle = this.world.createVehicleController(this.chassis);
    this.vehicle.indexUpAxis = 1;
    this.vehicle.setIndexForwardAxis = 2;
    for (const wheel of WHEEL_CONFIGS) {
      this.vehicle.addWheel(
        new rapier.Vector3(wheel.x, wheel.y, wheel.z),
        new rapier.Vector3(0, -1, 0),
        new rapier.Vector3(1, 0, 0),
        VEHICLE_CONFIG.suspensionRestLength,
        VEHICLE_CONFIG.wheelRadius,
      );
      this.vehicle.setWheelMaxSuspensionTravel(wheel.index, VEHICLE_CONFIG.suspensionMaxTravel);
      this.vehicle.setWheelSuspensionStiffness(wheel.index, VEHICLE_CONFIG.suspensionStiffness);
      this.vehicle.setWheelSuspensionCompression(wheel.index, VEHICLE_CONFIG.suspensionCompression);
      this.vehicle.setWheelSuspensionRelaxation(wheel.index, VEHICLE_CONFIG.suspensionRelaxation);
      this.vehicle.setWheelMaxSuspensionForce(wheel.index, VEHICLE_CONFIG.suspensionMaxForce);
      this.vehicle.setWheelFrictionSlip(wheel.index, VEHICLE_CONFIG.wheelFrictionSlip);
      this.vehicle.setWheelSideFrictionStiffness(wheel.index, VEHICLE_CONFIG.sideFrictionStiffness);
    }

    this.currentSnapshot = this.readSnapshot();
    this.previousSnapshot = this.currentSnapshot;
    this.lastSafeTranslation = { x: this.currentSnapshot.x, y: this.currentSnapshot.y, z: this.currentSnapshot.z };
    this.lastSafeRotation = { ...this.currentSnapshot.rotation };
  }

  public get snapshot(): PhysicsSnapshot {
    return this.currentSnapshot;
  }

  public getDynamicPropSnapshots(): readonly DynamicPropSnapshot[] {
    return this.dynamicBodies.map((body) => {
      const translation = body.translation();
      const rotation = finiteRotation(body.rotation());
      return {
        x: finiteOr(translation.x),
        y: finiteOr(translation.y),
        z: finiteOr(translation.z),
        rotation,
      };
    });
  }

  public advance(realDeltaSeconds: number, requestedInput: DriveInput): PhysicsSnapshot {
    if (this.disposed) {
      return this.currentSnapshot;
    }

    this.accumulator = Math.min(
      VEHICLE_CONFIG.maxAccumulator,
      this.accumulator + clampFrontierDeltaSeconds(realDeltaSeconds),
    );
    const input = sanitizeDriveInput(requestedInput);
    let steps = 0;
    while (this.accumulator >= VEHICLE_CONFIG.fixedTimestep && steps < VEHICLE_CONFIG.maxSubsteps) {
      this.stepFixed(input);
      this.accumulator -= VEHICLE_CONFIG.fixedTimestep;
      steps += 1;
    }
    if (steps === VEHICLE_CONFIG.maxSubsteps && this.accumulator >= VEHICLE_CONFIG.fixedTimestep) {
      this.accumulator = 0;
    }
    return this.currentSnapshot;
  }

  public recoverToLastSafe(): PhysicsSnapshot {
    if (this.disposed) {
      return this.currentSnapshot;
    }
    this.chassis.setTranslation(new this.rapier.Vector3(
      this.lastSafeTranslation.x,
      this.lastSafeTranslation.y + 0.35,
      this.lastSafeTranslation.z,
    ), true);
    this.chassis.setRotation(new this.rapier.Quaternion(
      this.lastSafeRotation.x,
      this.lastSafeRotation.y,
      this.lastSafeRotation.z,
      this.lastSafeRotation.w,
    ), true);
    this.chassis.setLinvel(new this.rapier.Vector3(0, 0, 0), true);
    this.chassis.setAngvel(new this.rapier.Vector3(0, 0, 0), true);
    for (const wheel of WHEEL_CONFIGS) {
      this.vehicle.setWheelEngineForce(wheel.index, 0);
      this.vehicle.setWheelBrake(wheel.index, 0);
      this.vehicle.setWheelSteering(wheel.index, 0);
    }
    this.accumulator = 0;
    this.recoverySeconds = 0;
    this.previousSnapshot = this.readSnapshot();
    this.currentSnapshot = this.previousSnapshot;
    return this.currentSnapshot;
  }

  public resetToStart(): PhysicsSnapshot {
    this.lastSafeTranslation = {
      x: FRONTIER_START.x,
      y: getFrontierHeight(FRONTIER_START.x, FRONTIER_START.z) + 2.35,
      z: FRONTIER_START.z,
    };
    this.lastSafeRotation = { x: 0, y: 0, z: 0, w: 1 };
    return this.recoverToLastSafe();
  }

  public clearInput(): void {
    for (const wheel of WHEEL_CONFIGS) {
      this.vehicle.setWheelEngineForce(wheel.index, 0);
      this.vehicle.setWheelBrake(wheel.index, 0);
      this.vehicle.setWheelSteering(wheel.index, 0);
    }
  }

  public stopVehicle(): PhysicsSnapshot {
    if (this.disposed) {
      return this.currentSnapshot;
    }
    this.clearInput();
    this.chassis.setLinvel(new this.rapier.Vector3(0, 0, 0), true);
    this.chassis.setAngvel(new this.rapier.Vector3(0, 0, 0), true);
    this.accumulator = 0;
    this.previousSnapshot = this.readSnapshot();
    this.currentSnapshot = this.previousSnapshot;
    return this.currentSnapshot;
  }

  public dispose(): void {
    if (this.disposed) {
      return;
    }
    this.stopVehicle();
    this.disposed = true;
    this.world.removeVehicleController(this.vehicle);
    this.world.free();
  }

  private stepFixed(input: DriveInput): void {
    const before = this.readSnapshot();
    const signedSpeed = this.getSemanticSpeed();
    const surface = before.surface;
    const steeringAngle = getSteeringAngle(input.steering, signedSpeed);
    const engineForce = -getEngineForce(input.throttle, signedSpeed, surface);
    const brakeForce = getBrakeForce(input.throttle, signedSpeed, surface);
    const frictionSlip = getWheelFrictionSlip(surface);
    for (const wheel of WHEEL_CONFIGS) {
      this.vehicle.setWheelEngineForce(wheel.index, engineForce / 4);
      this.vehicle.setWheelBrake(wheel.index, brakeForce);
      this.vehicle.setWheelSteering(wheel.index, wheel.steerable ? steeringAngle : 0);
      this.vehicle.setWheelFrictionSlip(wheel.index, frictionSlip);
    }

    this.vehicle.updateVehicle(VEHICLE_CONFIG.fixedTimestep);
    this.world.step();
    this.limitSpeed();
    const next = this.readSnapshot();
    this.updateRecoveryAndSafePosition(next);
    this.previousSnapshot = this.currentSnapshot;
    this.currentSnapshot = next;
  }

  private limitSpeed(): void {
    const velocity = this.chassis.linvel();
    const signedSpeed = this.getSemanticSpeed();
    const limit = signedSpeed >= 0 ? VEHICLE_CONFIG.maxForwardSpeed : VEHICLE_CONFIG.maxReverseSpeed;
    if (Math.abs(signedSpeed) <= limit || Math.abs(signedSpeed) < 0.001) {
      return;
    }
    const horizontalLength = Math.hypot(velocity.x, velocity.z);
    if (!Number.isFinite(horizontalLength) || horizontalLength < 0.001) {
      return;
    }
    const scale = limit / Math.max(Math.abs(signedSpeed), horizontalLength);
    this.chassis.setLinvel(new this.rapier.Vector3(
      finiteOr(velocity.x * scale),
      finiteOr(velocity.y),
      finiteOr(velocity.z * scale),
    ), true);
  }

  private updateRecoveryAndSafePosition(snapshot: PhysicsSnapshot): void {
    const upright = upVectorY(snapshot.rotation) > 0.42;
    if (snapshot.groundedWheels === 0 || !upright || !snapshot.insideBounds) {
      this.recoverySeconds = Math.min(10, this.recoverySeconds + VEHICLE_CONFIG.fixedTimestep);
    } else {
      this.recoverySeconds = 0;
    }
    if (snapshot.groundedWheels >= 2 && upright && snapshot.insideBounds && Math.abs(snapshot.speed) < VEHICLE_CONFIG.maxForwardSpeed * 1.15) {
      this.lastSafeTranslation = { x: snapshot.x, y: snapshot.y, z: snapshot.z };
      this.lastSafeRotation = { ...snapshot.rotation };
    }
  }

  private readSnapshot(): PhysicsSnapshot {
    const translation = this.chassis.translation();
    const rotation = finiteRotation(this.chassis.rotation());
    const signedSpeed = this.getSemanticSpeed();
    const surface = getSurfaceType(translation.x, translation.z);
    const tuning = getSurfaceTuning(surface);
    const wheelRotations: number[] = [];
    const wheelSuspensionLengths: number[] = [];
    let groundedWheels = 0;
    for (const wheel of WHEEL_CONFIGS) {
      if (this.vehicle.wheelIsInContact(wheel.index)) {
        groundedWheels += 1;
      }
      wheelRotations.push(finiteOr(-(this.vehicle.wheelRotation(wheel.index) ?? 0)));
      wheelSuspensionLengths.push(finiteOr(this.vehicle.wheelSuspensionLength(wheel.index) ?? VEHICLE_CONFIG.suspensionRestLength));
    }
    const heading = finiteOr(Math.atan2(
      2 * (rotation.w * rotation.y + rotation.x * rotation.z),
      1 - 2 * (rotation.y * rotation.y + rotation.z * rotation.z),
    ));
    return {
      x: finiteOr(translation.x),
      y: finiteOr(translation.y, getFrontierHeight(FRONTIER_START.x, FRONTIER_START.z) + 2.35),
      z: finiteOr(translation.z),
      rotation,
      heading,
      speed: signedSpeed,
      groundedWheels,
      wheelRotations,
      wheelSuspensionLengths,
      surface,
      traction: finiteOr(tuning.traction, 1),
      areaLabel: getFrontierArea(translation.x, translation.z).label,
      recoveryReady: this.recoverySeconds >= 2,
      rolloverSeconds: finiteOr(this.recoverySeconds),
      insideBounds: isInsideFrontierBounds(translation.x, translation.z, 2),
    };
  }

  private getSemanticSpeed(): number {
    const rotation = finiteRotation(this.chassis.rotation());
    const velocity = this.chassis.linvel();
    const forwardX = 2 * (rotation.x * rotation.z + rotation.w * rotation.y);
    const forwardZ = 1 - 2 * (rotation.x * rotation.x + rotation.y * rotation.y);
    return finiteOr(velocity.x * forwardX + velocity.z * forwardZ);
  }
}

export function getPhysicsWorldDimensions(): { readonly width: number; readonly depth: number } {
  return { width: FRONTIER_WIDTH, depth: FRONTIER_DEPTH };
}
