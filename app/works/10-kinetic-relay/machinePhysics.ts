import type { CourseId } from "./machineSequence";

export const PHYSICS_CONFIG = {
  fixedTimestep: 1 / 60,
  maxSubsteps: 4,
  maxAccumulator: 0.12,
  maxFrameDelta: 0.05,
  gravity: -9.81,
  guideStiffness: 4.8,
  maxGuideSpeed: 13,
} as const;

export type PhysicsVector = readonly [number, number, number];

export type PhysicsGuideMap = Readonly<Partial<Record<CourseId, PhysicsVector>>>;

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
  A: [-5.35, 8.15, 0],
  B: [0, 8.15, 0],
  C: [5.35, 8.15, 0],
};

export class MachinePhysicsWorld {
  private readonly rapier: RapierModule;
  private readonly world: import("@dimforge/rapier3d-compat").World;
  private readonly marbles: Record<CourseId, import("@dimforge/rapier3d-compat").RigidBody>;
  private readonly initialPositions: Record<CourseId, PhysicsVector>;
  private readonly guideTargets: Record<CourseId, PhysicsVector> = { ...INITIAL_MARBLE_POSITIONS };
  private accumulator = 0;
  private disposed = false;

  public constructor(rapier: RapierModule) {
    this.rapier = rapier;
    this.initialPositions = { ...INITIAL_MARBLE_POSITIONS };
    this.world = new rapier.World(new rapier.Vector3(0, PHYSICS_CONFIG.gravity, 0));
    this.world.timestep = PHYSICS_CONFIG.fixedTimestep;
    this.world.integrationParameters.dt = PHYSICS_CONFIG.fixedTimestep;
    this.world.numSolverIterations = 8;
    this.world.maxCcdSubsteps = 4;

    const floorBody = this.world.createRigidBody(rapier.RigidBodyDesc.fixed().setTranslation(0, -0.45, 0));
    this.world.createCollider(
      rapier.ColliderDesc.cuboid(9.4, 0.22, 5.8).setFriction(0.84).setRestitution(0.06),
      floorBody,
    );

    this.marbles = {} as Record<CourseId, import("@dimforge/rapier3d-compat").RigidBody>;
    for (const course of ["A", "B", "C"] as const) {
      const [x, y, z] = this.initialPositions[course];
      const body = this.world.createRigidBody(
        rapier.RigidBodyDesc.dynamic()
          .setTranslation(x, y, z)
          .setGravityScale(0)
          .setAdditionalMass(0.6)
          .setLinearDamping(3.1)
          .setAngularDamping(2.2)
          .setCanSleep(false)
          .setCcdEnabled(true)
          .setSoftCcdPrediction(0.25),
      );
      this.world.createCollider(
        rapier.ColliderDesc.ball(0.22).setFriction(0.55).setRestitution(0.18),
        body,
      );
      this.marbles[course] = body;
    }
  }

  public setGuideTargets(targets: PhysicsGuideMap): void {
    for (const course of ["A", "B", "C"] as const) {
      const target = targets[course];
      if (target && target.every(Number.isFinite)) {
        this.guideTargets[course] = target;
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

  public getSnapshot(course: CourseId): MarblePhysicsSnapshot {
    const body = this.marbles[course];
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
      const body = this.marbles[course];
      const [x, y, z] = this.initialPositions[course];
      body.setTranslation(new this.rapier.Vector3(x, y, z), true);
      body.setRotation(new this.rapier.Quaternion(0, 0, 0, 1), true);
      body.setLinvel(new this.rapier.Vector3(0, 0, 0), true);
      body.setAngvel(new this.rapier.Vector3(0, 0, 0), true);
      this.guideTargets[course] = [x, y, z];
    }
    this.accumulator = 0;
  }

  public dispose(): void {
    if (this.disposed) {
      return;
    }
    this.disposed = true;
    this.world.free();
  }

  private stepFixed(): void {
    for (const course of ["A", "B", "C"] as const) {
      const body = this.marbles[course];
      const target = this.guideTargets[course];
      const position = body.translation();
      const velocity = body.linvel();
      const desired = new this.rapier.Vector3(
        (target[0] - position.x) * PHYSICS_CONFIG.guideStiffness,
        (target[1] - position.y) * PHYSICS_CONFIG.guideStiffness,
        (target[2] - position.z) * PHYSICS_CONFIG.guideStiffness,
      );
      const impulse = new this.rapier.Vector3(
        (desired.x - velocity.x) * 0.6,
        (desired.y - velocity.y) * 0.6,
        (desired.z - velocity.z) * 0.6,
      );
      body.applyImpulse(impulse, true);
      const nextVelocity = body.linvel();
      const speed = Math.hypot(nextVelocity.x, nextVelocity.y, nextVelocity.z);
      if (speed > PHYSICS_CONFIG.maxGuideSpeed) {
        const scale = PHYSICS_CONFIG.maxGuideSpeed / speed;
        body.setLinvel(
          new this.rapier.Vector3(nextVelocity.x * scale, nextVelocity.y * scale, nextVelocity.z * scale),
          true,
        );
      }
    }
    this.world.step();
  }
}
