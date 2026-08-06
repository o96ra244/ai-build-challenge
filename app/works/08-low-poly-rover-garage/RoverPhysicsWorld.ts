import {
  getYardZone,
  isInsideYardBounds,
  YARD_BOUNDS,
  YARD_OBJECTS,
  YARD_START,
  type YardObjectDefinition,
  type YardShape,
  type YardSurface,
} from "./testYard";
import {
  getRapierEngineForce,
  getRapierSteeringAngle,
  getBrakeForce,
  getWheelFrictionSlip,
  VEHICLE_CONFIG,
  WHEEL_CONFIGS,
} from "./vehicleConfig";
import { sanitizeDriveInput, type DriveInput } from "./driveModel";
import { getSemanticSpeed } from "./driveModel";

export type RapierModule = typeof import("@dimforge/rapier3d-compat");

export type PhysicsRotation = {
  readonly x: number;
  readonly y: number;
  readonly z: number;
  readonly w: number;
};

export type DynamicPropSnapshot = {
  readonly id: string;
  readonly x: number;
  readonly y: number;
  readonly z: number;
  readonly rotation: PhysicsRotation;
};

export type RoverPhysicsSnapshot = {
  readonly x: number;
  readonly y: number;
  readonly z: number;
  readonly rotation: PhysicsRotation;
  readonly speed: number;
  readonly groundedWheels: number;
  readonly wheelRotations: readonly number[];
  readonly wheelSuspensionLengths: readonly number[];
  readonly surface: YardSurface;
  readonly zoneLabel: string;
  readonly airborne: boolean;
  readonly insideBounds: boolean;
};

function finiteOr(value: number, fallback = 0): number {
  return Number.isFinite(value) ? (Object.is(value, -0) ? 0 : value) : fallback;
}

function finiteRotation(rotation: { readonly x: number; readonly y: number; readonly z: number; readonly w: number }): PhysicsRotation {
  return {
    x: finiteOr(rotation.x),
    y: finiteOr(rotation.y),
    z: finiteOr(rotation.z),
    w: finiteOr(rotation.w, 1),
  };
}

function objectQuaternion(rapier: RapierModule, rotation: readonly [number, number, number]): InstanceType<RapierModule["Quaternion"]> {
  const [x, y, z] = rotation;
  const cx = Math.cos(x / 2);
  const sx = Math.sin(x / 2);
  const cy = Math.cos(y / 2);
  const sy = Math.sin(y / 2);
  const cz = Math.cos(z / 2);
  const sz = Math.sin(z / 2);
  return new rapier.Quaternion(
    sx * cy * cz - cx * sy * sz,
    cx * sy * cz + sx * cy * sz,
    cx * cy * sz - sx * sy * cz,
    cx * cy * cz + sx * sy * sz,
  );
}

function createCollider(
  rapier: RapierModule,
  shape: YardShape,
): import("@dimforge/rapier3d-compat").ColliderDesc {
  switch (shape.type) {
    case "box":
      return rapier.ColliderDesc.cuboid(shape.size[0] / 2, shape.size[1] / 2, shape.size[2] / 2);
    case "cylinder": {
      const descriptor = rapier.ColliderDesc.cylinder(shape.height / 2, shape.radius);
      if (shape.axis === "x") {
        descriptor.setRotation(new rapier.Quaternion(0, 0, Math.SQRT1_2, Math.SQRT1_2));
      }
      return descriptor;
    }
    case "rock":
      return rapier.ColliderDesc.roundCuboid(
        shape.size[0] / 2,
        shape.size[1] / 2,
        shape.size[2] / 2,
        shape.roundness,
      );
    case "ramp":
      return rapier.ColliderDesc.trimesh(
        new Float32Array(shapeVertices(shape)),
        new Uint32Array([0, 2, 1, 1, 2, 3, 0, 1, 5, 0, 5, 4, 2, 4, 5, 2, 5, 3, 0, 4, 2, 1, 3, 5]),
      );
  }
}

function shapeVertices(shape: Extract<YardShape, { readonly type: "ramp" }>): readonly number[] {
  const halfWidth = shape.width / 2;
  const halfDepth = shape.depth / 2;
  const highZ = shape.risingToward === "front" ? -halfDepth : halfDepth;
  const lowZ = -highZ;
  return [
    -halfWidth, 0, lowZ,
    halfWidth, 0, lowZ,
    -halfWidth, 0, highZ,
    halfWidth, 0, highZ,
    -halfWidth, shape.height, highZ,
    halfWidth, shape.height, highZ,
  ];
}

function setSurface(
  descriptor: import("@dimforge/rapier3d-compat").ColliderDesc,
  friction: number,
  restitution = 0.02,
): import("@dimforge/rapier3d-compat").ColliderDesc {
  return descriptor.setFriction(friction).setRestitution(restitution);
}

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

export class RoverPhysicsWorld {
  private readonly rapier: RapierModule;
  private readonly world: import("@dimforge/rapier3d-compat").World;
  private readonly chassis: import("@dimforge/rapier3d-compat").RigidBody;
  private readonly vehicle: import("@dimforge/rapier3d-compat").DynamicRayCastVehicleController;
  private readonly dynamicBodies: readonly {
    readonly definition: YardObjectDefinition;
    readonly body: import("@dimforge/rapier3d-compat").RigidBody;
  }[];
  private accumulator = 0;
  private disposed = false;
  private currentSnapshot: RoverPhysicsSnapshot;

  public constructor(rapier: RapierModule) {
    this.rapier = rapier;
    this.world = new rapier.World(new rapier.Vector3(0, VEHICLE_CONFIG.gravity, 0));
    this.world.timestep = VEHICLE_CONFIG.fixedTimestep;
    this.world.integrationParameters.dt = VEHICLE_CONFIG.fixedTimestep;
    this.world.numSolverIterations = 8;
    this.world.maxCcdSubsteps = 4;

    const dynamicBodies: {
      readonly definition: YardObjectDefinition;
      readonly body: import("@dimforge/rapier3d-compat").RigidBody;
    }[] = [];
    for (const object of YARD_OBJECTS) {
      if (object.bodyType === "none" || !object.collider) {
        continue;
      }
      const bodyDescription = object.bodyType === "dynamic"
        ? rapier.RigidBodyDesc.dynamic()
          .setCanSleep(true)
          .setCcdEnabled(true)
          .setLinearDamping(1.8)
          .setAngularDamping(4.5)
          .setAdditionalMass(object.kind === "crate" ? 18 : 1)
        : rapier.RigidBodyDesc.fixed();
      bodyDescription.setTranslation(object.position[0], object.position[1], object.position[2]);
      bodyDescription.setRotation(objectQuaternion(rapier, object.rotation));
      const body = this.world.createRigidBody(bodyDescription);
      const friction = object.kind === "crate" ? 0.72 : object.kind === "ground" ? 1.05 : 0.96;
      const collider = setSurface(createCollider(rapier, object.collider), friction, object.kind === "crate" ? 0.04 : 0.01);
      this.world.createCollider(collider, body);
      if (object.bodyType === "dynamic") {
        dynamicBodies.push({ definition: object, body });
      }
    }
    this.dynamicBodies = dynamicBodies;

    const chassisDescription = rapier.RigidBodyDesc.dynamic()
      .setTranslation(YARD_START.x, YARD_START.y, YARD_START.z)
      .setAdditionalMassProperties(
        VEHICLE_CONFIG.chassisMass,
        new rapier.Vector3(0, VEHICLE_CONFIG.centerOfMassY, 0),
        new rapier.Vector3(1200, 980, 1450),
        new rapier.Quaternion(0, 0, 0, 1),
      )
      .setLinearDamping(VEHICLE_CONFIG.linearDamping)
      .setAngularDamping(VEHICLE_CONFIG.angularDamping)
      .setCanSleep(false)
      .setCcdEnabled(true)
      .setSoftCcdPrediction(0.42);
    this.chassis = this.world.createRigidBody(chassisDescription);
    const chassisCollider = rapier.ColliderDesc.roundCuboid(2.25, 0.48, 1.25, 0.18)
      .setFriction(0.96)
      .setRestitution(0.04);
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
  }

  public get snapshot(): RoverPhysicsSnapshot {
    return this.currentSnapshot;
  }

  public getDynamicPropSnapshots(): readonly DynamicPropSnapshot[] {
    return this.dynamicBodies.map(({ definition, body }) => {
      const position = body.translation();
      return {
        id: definition.id,
        x: finiteOr(position.x),
        y: finiteOr(position.y),
        z: finiteOr(position.z),
        rotation: finiteRotation(body.rotation()),
      };
    });
  }

  public advance(realDeltaSeconds: number, requestedInput: DriveInput): RoverPhysicsSnapshot {
    if (this.disposed) {
      return this.currentSnapshot;
    }
    const safeDelta = Number.isFinite(realDeltaSeconds) ? Math.max(0, Math.min(0.05, realDeltaSeconds)) : 0;
    this.accumulator = Math.min(VEHICLE_CONFIG.maxAccumulator, this.accumulator + safeDelta);
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

  public resetToStart(): RoverPhysicsSnapshot {
    if (this.disposed) {
      return this.currentSnapshot;
    }
    this.chassis.setTranslation(new this.rapier.Vector3(YARD_START.x, YARD_START.y, YARD_START.z), true);
    this.chassis.setRotation(new this.rapier.Quaternion(0, 0, 0, 1), true);
    this.chassis.setLinvel(new this.rapier.Vector3(0, 0, 0), true);
    this.chassis.setAngvel(new this.rapier.Vector3(0, 0, 0), true);
    for (const { definition, body } of this.dynamicBodies) {
      body.setTranslation(new this.rapier.Vector3(...definition.position), true);
      body.setRotation(objectQuaternion(this.rapier, definition.rotation), true);
      body.setLinvel(new this.rapier.Vector3(0, 0, 0), true);
      body.setAngvel(new this.rapier.Vector3(0, 0, 0), true);
    }
    this.clearWheelForces();
    this.accumulator = 0;
    this.currentSnapshot = this.readSnapshot();
    return this.currentSnapshot;
  }

  public recoverToStart(): RoverPhysicsSnapshot {
    return this.resetToStart();
  }

  public stopVehicle(): RoverPhysicsSnapshot {
    if (this.disposed) {
      return this.currentSnapshot;
    }
    this.clearWheelForces();
    this.chassis.setLinvel(new this.rapier.Vector3(0, 0, 0), true);
    this.chassis.setAngvel(new this.rapier.Vector3(0, 0, 0), true);
    this.accumulator = 0;
    this.currentSnapshot = this.readSnapshot();
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
    const velocity = this.chassis.linvel();
    const signedSpeed = getSemanticSpeed(before.rotation, velocity);
    const steeringAngle = getRapierSteeringAngle(input.steering, signedSpeed);
    const engineForce = getRapierEngineForce(input.throttle, signedSpeed, before.surface);
    const brakeForce = getBrakeForce(input.throttle, signedSpeed, before.surface);
    const frictionSlip = getWheelFrictionSlip(before.surface);
    for (const wheel of WHEEL_CONFIGS) {
      this.vehicle.setWheelEngineForce(wheel.index, wheel.driven ? engineForce / 4 : 0);
      this.vehicle.setWheelBrake(wheel.index, wheel.braked ? brakeForce : 0);
      this.vehicle.setWheelSteering(wheel.index, wheel.steerable ? steeringAngle : 0);
      this.vehicle.setWheelFrictionSlip(wheel.index, frictionSlip);
    }
    this.vehicle.updateVehicle(VEHICLE_CONFIG.fixedTimestep);
    this.world.step();
    this.limitSpeed();
    this.currentSnapshot = this.readSnapshot();
  }

  private limitSpeed(): void {
    const rotation = finiteRotation(this.chassis.rotation());
    const speed = getSemanticSpeed(rotation, this.chassis.linvel());
    const limit = speed < 0 ? VEHICLE_CONFIG.maxReverseSpeed : VEHICLE_CONFIG.maxForwardSpeed;
    if (Math.abs(speed) <= limit) {
      return;
    }
    const velocity = this.chassis.linvel();
    const scale = limit / Math.max(Math.abs(speed), Math.hypot(velocity.x, velocity.z));
    this.chassis.setLinvel(new this.rapier.Vector3(
      finiteOr(velocity.x * scale),
      finiteOr(velocity.y),
      finiteOr(velocity.z * scale),
    ), true);
  }

  private clearWheelForces(): void {
    for (const wheel of WHEEL_CONFIGS) {
      this.vehicle.setWheelEngineForce(wheel.index, 0);
      this.vehicle.setWheelBrake(wheel.index, 0);
      this.vehicle.setWheelSteering(wheel.index, 0);
    }
  }

  private readSnapshot(): RoverPhysicsSnapshot {
    const position = this.chassis.translation();
    const rotation = finiteRotation(this.chassis.rotation());
    const velocity = this.chassis.linvel();
    const speed = getSemanticSpeed(rotation, velocity);
    const zone = getYardZone(position.x, position.z);
    const wheelRotations: number[] = [];
    const wheelSuspensionLengths: number[] = [];
    let groundedWheels = 0;
    for (const wheel of WHEEL_CONFIGS) {
      if (this.vehicle.wheelIsInContact(wheel.index)) {
        groundedWheels += 1;
      }
      wheelRotations.push(finiteOr(-(this.vehicle.wheelRotation(wheel.index) ?? 0)));
      wheelSuspensionLengths.push(finiteOr(
        this.vehicle.wheelSuspensionLength(wheel.index) ?? VEHICLE_CONFIG.suspensionRestLength,
        VEHICLE_CONFIG.suspensionRestLength,
      ));
    }
    return {
      x: finiteOr(position.x),
      y: finiteOr(position.y, YARD_START.y),
      z: finiteOr(position.z),
      rotation,
      speed: finiteOr(speed),
      groundedWheels,
      wheelRotations,
      wheelSuspensionLengths,
      surface: zone.surface,
      zoneLabel: zone.label,
      airborne: groundedWheels === 0 || Math.abs(velocity.y) > 1.3,
      insideBounds: isInsideYardBounds(position.x, position.z, 1.4),
    };
  }
}

export function getPhysicsWorldDimensions(): { readonly width: number; readonly depth: number } {
  return {
    width: YARD_BOUNDS.maxX - YARD_BOUNDS.minX,
    depth: YARD_BOUNDS.maxZ - YARD_BOUNDS.minZ,
  };
}
