import type { CourseId } from "./machineSequence";

export const PHYSICS_CONFIG = {
  fixedTimestep: 1 / 60,
  maxSubsteps: 4,
  maxAccumulator: 0.12,
  maxFrameDelta: 0.05,
  gravity: -9.81,
  gravityScale: 0.28,
  guideStiffness: 5.8,
  guideGain: 0.74,
  maxGuideSpeed: 8.8,
} as const;

export type PhysicsBodyId = CourseId | "secondary";
export type PhysicsVector = readonly [number, number, number];
export type PhysicsGuideMap = Readonly<Partial<Record<PhysicsBodyId, PhysicsVector>>>;

export type PhysicsStepResult = {
  readonly accumulator: number;
  readonly steps: number;
  readonly droppedTime: number;
};

function finite(value: number, fallback = 0): number {
  return Number.isFinite(value) ? value : fallback;
}

export function advanceFixedAccumulator(
  accumulator: number,
  realDeltaSeconds: number,
  step: () => void,
  pageVisible = true,
): PhysicsStepResult {
  const previous = Math.min(PHYSICS_CONFIG.maxAccumulator, Math.max(0, finite(accumulator)));
  const safeDelta = pageVisible
    ? Math.min(PHYSICS_CONFIG.maxFrameDelta, Math.max(0, finite(realDeltaSeconds)))
    : 0;
  let nextAccumulator = Math.min(PHYSICS_CONFIG.maxAccumulator, previous + safeDelta);
  let steps = 0;
  while (nextAccumulator >= PHYSICS_CONFIG.fixedTimestep && steps < PHYSICS_CONFIG.maxSubsteps) {
    step();
    nextAccumulator -= PHYSICS_CONFIG.fixedTimestep;
    steps += 1;
  }
  let droppedTime = 0;
  if (steps === PHYSICS_CONFIG.maxSubsteps && nextAccumulator >= PHYSICS_CONFIG.fixedTimestep) {
    droppedTime = nextAccumulator;
    nextAccumulator = 0;
  }
  return { accumulator: nextAccumulator, steps, droppedTime };
}

export type RapierModule = typeof import("@dimforge/rapier3d-compat");

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

export type MarblePhysicsSnapshot = {
  readonly x: number;
  readonly y: number;
  readonly z: number;
  readonly vx: number;
  readonly vy: number;
  readonly vz: number;
};

const INITIAL_MARBLE_POSITIONS: Record<CourseId, PhysicsVector> = {
  A: [-4.8, 7.74, 0],
  B: [0, 7.74, 0],
  C: [4.8, 7.74, 0],
};
const INITIAL_SECONDARY_POSITION: PhysicsVector = [4.02, 4.55, 0.28];

export class MachinePhysicsWorld {
  private readonly rapier: RapierModule;
  private readonly world: import("@dimforge/rapier3d-compat").World;
  private readonly marbles: Record<CourseId, import("@dimforge/rapier3d-compat").RigidBody>;
  private readonly secondaryMarble: import("@dimforge/rapier3d-compat").RigidBody;
  private readonly initialPositions: Record<CourseId, PhysicsVector>;
  private accumulator = 0;
  private disposed = false;
  private readonly guideTargets: Record<PhysicsBodyId, PhysicsVector> = {
    ...INITIAL_MARBLE_POSITIONS,
    secondary: INITIAL_SECONDARY_POSITION,
  };

  public constructor(rapier: RapierModule) {
    this.rapier = rapier;
    this.initialPositions = { ...INITIAL_MARBLE_POSITIONS };
    this.world = new rapier.World(new rapier.Vector3(0, PHYSICS_CONFIG.gravity, 0));
    this.world.timestep = PHYSICS_CONFIG.fixedTimestep;
    this.world.integrationParameters.dt = PHYSICS_CONFIG.fixedTimestep;
    this.world.numSolverIterations = 10;
    this.world.maxCcdSubsteps = 4;

    const floorBody = this.world.createRigidBody(rapier.RigidBodyDesc.fixed().setTranslation(0, -0.32, 0));
    this.world.createCollider(
      rapier.ColliderDesc.cuboid(8.8, 0.22, 3.1).setFriction(0.86).setRestitution(0.08),
      floorBody,
    );
    const collectorBody = this.world.createRigidBody(rapier.RigidBodyDesc.fixed().setTranslation(0, 1.12, 0));
    this.world.createCollider(
      rapier.ColliderDesc.cuboid(2.1, 0.05, 0.58).setFriction(0.7).setRestitution(0.12),
      collectorBody,
    );

    this.marbles = {} as Record<CourseId, import("@dimforge/rapier3d-compat").RigidBody>;
    for (const course of ["A", "B", "C"] as const) {
      this.marbles[course] = this.createMarble(this.initialPositions[course]);
    }
    this.secondaryMarble = this.createMarble(INITIAL_SECONDARY_POSITION);
  }

  public setGuideTargets(targets: PhysicsGuideMap): void {
    for (const bodyId of ["A", "B", "C", "secondary"] as const) {
      const target = targets[bodyId];
      if (target && target.every(Number.isFinite)) {
        this.guideTargets[bodyId] = target;
      }
    }
  }

  public advance(realDeltaSeconds: number, targets: PhysicsGuideMap = {}, pageVisible = true): PhysicsStepResult {
    if (this.disposed) {
      return { accumulator: this.accumulator, steps: 0, droppedTime: 0 };
    }
    this.setGuideTargets(targets);
    const result = advanceFixedAccumulator(
      this.accumulator,
      realDeltaSeconds,
      () => this.stepFixed(),
      pageVisible,
    );
    this.accumulator = result.accumulator;
    return result;
  }

  public getSnapshot(bodyId: PhysicsBodyId): MarblePhysicsSnapshot {
    const body = bodyId === "secondary" ? this.secondaryMarble : this.marbles[bodyId];
    const position = body.translation();
    const velocity = body.linvel();
    return {
      x: finite(position.x),
      y: finite(position.y),
      z: finite(position.z),
      vx: finite(velocity.x),
      vy: finite(velocity.y),
      vz: finite(velocity.z),
    };
  }

  public reset(): void {
    if (this.disposed) {
      return;
    }
    for (const course of ["A", "B", "C"] as const) {
      const [x, y, z] = this.initialPositions[course];
      this.resetBody(this.marbles[course], [x, y, z]);
      this.guideTargets[course] = [x, y, z];
    }
    this.resetBody(this.secondaryMarble, INITIAL_SECONDARY_POSITION);
    this.guideTargets.secondary = INITIAL_SECONDARY_POSITION;
    this.accumulator = 0;
  }

  public dispose(): void {
    if (this.disposed) {
      return;
    }
    this.disposed = true;
    this.world.free();
  }

  private createMarble(position: PhysicsVector): import("@dimforge/rapier3d-compat").RigidBody {
    const [x, y, z] = position;
    const body = this.world.createRigidBody(
      this.rapier.RigidBodyDesc.dynamic()
        .setTranslation(x, y, z)
        .setGravityScale(PHYSICS_CONFIG.gravityScale)
        .setAdditionalMass(0.58)
        .setLinearDamping(1.05)
        .setAngularDamping(0.36)
        .setCanSleep(false)
        .setCcdEnabled(true)
        .setSoftCcdPrediction(0.22),
    );
    this.world.createCollider(
      this.rapier.ColliderDesc.ball(0.22).setFriction(0.68).setRestitution(0.24),
      body,
    );
    return body;
  }

  private resetBody(body: import("@dimforge/rapier3d-compat").RigidBody, position: PhysicsVector): void {
    const [x, y, z] = position;
    body.setTranslation(new this.rapier.Vector3(x, y, z), true);
    body.setRotation(new this.rapier.Quaternion(0, 0, 0, 1), true);
    body.setLinvel(new this.rapier.Vector3(0, 0, 0), true);
    body.setAngvel(new this.rapier.Vector3(0, 0, 0), true);
  }

  private stepFixed(): void {
    for (const bodyId of ["A", "B", "C", "secondary"] as const) {
      const body = bodyId === "secondary" ? this.secondaryMarble : this.marbles[bodyId];
      const target = this.guideTargets[bodyId];
      const position = body.translation();
      const velocity = body.linvel();
      const desired = new this.rapier.Vector3(
        (target[0] - position.x) * PHYSICS_CONFIG.guideStiffness,
        (target[1] - position.y) * PHYSICS_CONFIG.guideStiffness,
        (target[2] - position.z) * PHYSICS_CONFIG.guideStiffness,
      );
      const desiredSpeed = Math.hypot(desired.x, desired.y, desired.z);
      if (desiredSpeed > PHYSICS_CONFIG.maxGuideSpeed) {
        const scale = PHYSICS_CONFIG.maxGuideSpeed / desiredSpeed;
        desired.x *= scale;
        desired.y *= scale;
        desired.z *= scale;
      }
      const impulse = new this.rapier.Vector3(
        (desired.x - velocity.x) * PHYSICS_CONFIG.guideGain * PHYSICS_CONFIG.fixedTimestep,
        (desired.y - velocity.y) * PHYSICS_CONFIG.guideGain * PHYSICS_CONFIG.fixedTimestep,
        (desired.z - velocity.z) * PHYSICS_CONFIG.guideGain * PHYSICS_CONFIG.fixedTimestep,
      );
      body.applyImpulse(impulse, true);
      body.applyTorqueImpulse(new this.rapier.Vector3(-velocity.z * 0.018, 0, velocity.x * 0.018), true);
    }
    this.world.step();
  }
}
