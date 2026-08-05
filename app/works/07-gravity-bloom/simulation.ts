export type Point3 = {
  x: number;
  y: number;
  z: number;
};

export type ParticleBounds = {
  readonly x: number;
  readonly y: number;
  readonly z: number;
};

export type ParticleField = {
  readonly count: number;
  readonly positions: Float32Array;
  readonly velocities: Float32Array;
  readonly basePositions: Float32Array;
  readonly phases: Float32Array;
  readonly sizes: Float32Array;
  readonly brightness: Float32Array;
  readonly captured: Uint8Array;
};

export type ParticleSimulationConfig = {
  readonly attractionRadius: number;
  readonly attractionStrength: number;
  readonly maxAcceleration: number;
  readonly maxSpeed: number;
  readonly driftStrength: number;
  readonly returnStrength: number;
  readonly releaseImpulse: number;
  readonly bounds: ParticleBounds;
};

export type ParticleCountOptions = {
  readonly width: number;
  readonly height: number;
  readonly pixelRatio: number;
  readonly hardwareConcurrency?: number;
  readonly reducedMotion?: boolean;
};

export type PointerViewport = {
  readonly clientX: number;
  readonly clientY: number;
  readonly left: number;
  readonly top: number;
  readonly width: number;
  readonly height: number;
};

export const DEFAULT_PARTICLE_BOUNDS: ParticleBounds = {
  x: 4.7,
  y: 3,
  z: 2.6,
};

export const DEFAULT_SIMULATION_CONFIG: ParticleSimulationConfig = {
  attractionRadius: 1.5,
  attractionStrength: 4,
  maxAcceleration: 5,
  maxSpeed: 3.4,
  driftStrength: 0.12,
  returnStrength: 0.22,
  releaseImpulse: 2.1,
  bounds: DEFAULT_PARTICLE_BOUNDS,
};

const EPSILON = 0.0001;
const MAX_DELTA_SECONDS = 0.05;
const TAU = Math.PI * 2;

function finiteOr(value: number, fallback: number): number {
  return Number.isFinite(value) ? value : fallback;
}

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.min(Math.max(value, minimum), maximum);
}

export function createSeededRandom(seed: number): () => number {
  let state = (Number.isFinite(seed) ? Math.floor(seed) : 1) >>> 0;

  if (state === 0) {
    state = 0x6d2b79f5;
  }

  return () => {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    return state / 0x100000000;
  };
}

export function createParticleField(
  requestedCount: number,
  seed: number,
  bounds: ParticleBounds = DEFAULT_PARTICLE_BOUNDS,
): ParticleField {
  const count = Number.isFinite(requestedCount)
    ? Math.max(0, Math.floor(requestedCount))
    : 0;
  const random = createSeededRandom(seed);
  const positions = new Float32Array(count * 3);
  const velocities = new Float32Array(count * 3);
  const basePositions = new Float32Array(count * 3);
  const phases = new Float32Array(count);
  const sizes = new Float32Array(count);
  const brightness = new Float32Array(count);
  const captured = new Uint8Array(count);
  const safeBounds = {
    x: Math.max(0, finiteOr(bounds.x, DEFAULT_PARTICLE_BOUNDS.x)),
    y: Math.max(0, finiteOr(bounds.y, DEFAULT_PARTICLE_BOUNDS.y)),
    z: Math.max(0, finiteOr(bounds.z, DEFAULT_PARTICLE_BOUNDS.z)),
  };

  for (let index = 0; index < count; index += 1) {
    const offset = index * 3;
    const x = (random() * 2 - 1) * safeBounds.x * 0.96;
    const y = (random() * 2 - 1) * safeBounds.y * 0.96;
    const z = (random() * 2 - 1) * safeBounds.z * 0.96;

    positions[offset] = x;
    positions[offset + 1] = y;
    positions[offset + 2] = z;
    basePositions[offset] = x;
    basePositions[offset + 1] = y;
    basePositions[offset + 2] = z;
    velocities[offset] = (random() * 2 - 1) * 0.12;
    velocities[offset + 1] = (random() * 2 - 1) * 0.12;
    velocities[offset + 2] = (random() * 2 - 1) * 0.12;
    phases[index] = random() * TAU;
    sizes[index] = 0.65 + random() * 0.85;
    brightness[index] = 0.45 + random() * 0.55;
  }

  return {
    count,
    positions,
    velocities,
    basePositions,
    phases,
    sizes,
    brightness,
    captured,
  };
}

export function clampDeltaTime(
  deltaSeconds: number,
  maximum = MAX_DELTA_SECONDS,
): number {
  if (!Number.isFinite(deltaSeconds) || deltaSeconds <= 0) {
    return 0;
  }

  const safeMaximum = Number.isFinite(maximum) && maximum > 0 ? maximum : MAX_DELTA_SECONDS;
  return Math.min(deltaSeconds, safeMaximum);
}

export function calculateAttractionStrength(
  distance: number,
  radius: number,
  strength: number,
  maxAcceleration: number,
): number {
  const safeDistance = Math.max(0, finiteOr(distance, 0));
  const safeRadius = Math.max(0, finiteOr(radius, 0));
  const safeStrength = Math.max(0, finiteOr(strength, 0));
  const safeMaximum = Math.max(0, finiteOr(maxAcceleration, 0));

  if (safeRadius <= EPSILON || safeDistance >= safeRadius) {
    return 0;
  }

  const falloff = 1 - safeDistance / safeRadius;
  return Math.min(safeMaximum, safeStrength * falloff * falloff);
}

export function calculateAttraction(
  position: Point3,
  target: Point3,
  radius: number,
  strength: number,
  maxAcceleration: number,
): Point3 {
  const x = finiteOr(target.x, 0) - finiteOr(position.x, 0);
  const y = finiteOr(target.y, 0) - finiteOr(position.y, 0);
  const z = finiteOr(target.z, 0) - finiteOr(position.z, 0);
  const distance = Math.sqrt(x * x + y * y + z * z);
  const acceleration = calculateAttractionStrength(distance, radius, strength, maxAcceleration);

  if (acceleration <= 0 || distance <= EPSILON) {
    return { x: 0, y: 0, z: 0 };
  }

  return {
    x: (x / distance) * acceleration,
    y: (y / distance) * acceleration,
    z: (z / distance) * acceleration,
  };
}

export function updateParticleField(
  field: ParticleField,
  target: Point3,
  deltaSeconds: number,
  charging: boolean,
  config: ParticleSimulationConfig = DEFAULT_SIMULATION_CONFIG,
): void {
  const delta = clampDeltaTime(deltaSeconds);
  const bounds = config.bounds;
  const radius = Math.max(0, finiteOr(config.attractionRadius, 0));
  const radiusSquared = radius * radius;
  const safeStrength = Math.max(0, finiteOr(config.attractionStrength, 0));
  const safeMaxAcceleration = Math.max(0, finiteOr(config.maxAcceleration, 0));
  const safeMaxSpeed = Math.max(0, finiteOr(config.maxSpeed, 0));
  const safeDrift = Math.max(0, finiteOr(config.driftStrength, 0));
  const safeReturn = Math.max(0, finiteOr(config.returnStrength, 0));
  const targetX = finiteOr(target.x, 0);
  const targetY = finiteOr(target.y, 0);
  const targetZ = finiteOr(target.z, 0);

  for (let index = 0; index < field.count; index += 1) {
    const offset = index * 3;
    let x = finiteOr(field.positions[offset], 0);
    let y = finiteOr(field.positions[offset + 1], 0);
    let z = finiteOr(field.positions[offset + 2], 0);
    let velocityX = finiteOr(field.velocities[offset], 0);
    let velocityY = finiteOr(field.velocities[offset + 1], 0);
    let velocityZ = finiteOr(field.velocities[offset + 2], 0);
    const phase = finiteOr(field.phases[index], 0) + delta * (0.24 + field.brightness[index] * 0.08);
    const baseX = field.basePositions[offset];
    const baseY = field.basePositions[offset + 1];
    const baseZ = field.basePositions[offset + 2];

    field.phases[index] = phase % TAU;
    velocityX += ((baseX - x) * safeReturn + Math.sin(phase * 1.3) * safeDrift) * delta;
    velocityY += ((baseY - y) * safeReturn + Math.cos(phase * 0.9) * safeDrift) * delta;
    velocityZ += ((baseZ - z) * safeReturn + Math.sin(phase * 0.7) * safeDrift * 0.6) * delta;

    const offsetX = targetX - x;
    const offsetY = targetY - y;
    const offsetZ = targetZ - z;
    const distanceSquared = offsetX * offsetX + offsetY * offsetY + offsetZ * offsetZ;

    if (charging && distanceSquared <= radiusSquared) {
      const distance = Math.sqrt(distanceSquared);
      const acceleration = calculateAttractionStrength(
        distance,
        radius,
        safeStrength,
        safeMaxAcceleration,
      );

      field.captured[index] = 1;
      if (distance > EPSILON && acceleration > 0) {
        velocityX += (offsetX / distance) * acceleration * delta;
        velocityY += (offsetY / distance) * acceleration * delta;
        velocityZ += (offsetZ / distance) * acceleration * delta;
      }
    } else {
      field.captured[index] = 0;
    }

    const speed = Math.sqrt(velocityX * velocityX + velocityY * velocityY + velocityZ * velocityZ);
    if (speed > safeMaxSpeed && safeMaxSpeed > 0) {
      const speedRatio = safeMaxSpeed / speed;
      velocityX *= speedRatio;
      velocityY *= speedRatio;
      velocityZ *= speedRatio;
    }

    x += velocityX * delta;
    y += velocityY * delta;
    z += velocityZ * delta;

    if (x > bounds.x) {
      x = bounds.x;
      velocityX = -Math.abs(velocityX) * 0.55;
    } else if (x < -bounds.x) {
      x = -bounds.x;
      velocityX = Math.abs(velocityX) * 0.55;
    }
    if (y > bounds.y) {
      y = bounds.y;
      velocityY = -Math.abs(velocityY) * 0.55;
    } else if (y < -bounds.y) {
      y = -bounds.y;
      velocityY = Math.abs(velocityY) * 0.55;
    }
    if (z > bounds.z) {
      z = bounds.z;
      velocityZ = -Math.abs(velocityZ) * 0.55;
    } else if (z < -bounds.z) {
      z = -bounds.z;
      velocityZ = Math.abs(velocityZ) * 0.55;
    }

    field.positions[offset] = x;
    field.positions[offset + 1] = y;
    field.positions[offset + 2] = z;
    field.velocities[offset] = velocityX;
    field.velocities[offset + 1] = velocityY;
    field.velocities[offset + 2] = velocityZ;
  }
}

export function releaseParticleField(
  field: ParticleField,
  center: Point3,
  chargeRatio: number,
  config: ParticleSimulationConfig = DEFAULT_SIMULATION_CONFIG,
): number {
  const ratio = clamp(finiteOr(chargeRatio, 0), 0, 1);
  const impulse = Math.max(0, finiteOr(config.releaseImpulse, 0)) * (0.55 + ratio * 0.75);
  const maxSpeed = Math.max(0, finiteOr(config.maxSpeed, 0));
  const centerX = finiteOr(center.x, 0);
  const centerY = finiteOr(center.y, 0);
  const centerZ = finiteOr(center.z, 0);
  let releasedCount = 0;

  for (let index = 0; index < field.count; index += 1) {
    if (field.captured[index] === 0) {
      continue;
    }

    const offset = index * 3;
    const x = field.positions[offset] - centerX;
    const y = field.positions[offset + 1] - centerY;
    const z = field.positions[offset + 2] - centerZ;
    const distance = Math.sqrt(x * x + y * y + z * z);
    const phase = field.phases[index];
    const directionX = distance > EPSILON ? x / distance : Math.cos(phase);
    const directionY = distance > EPSILON ? y / distance : Math.sin(phase);
    const directionZ = distance > EPSILON ? z / distance : Math.sin(phase * 0.7) * 0.35;
    let velocityX = field.velocities[offset] + directionX * impulse;
    let velocityY = field.velocities[offset + 1] + directionY * impulse;
    let velocityZ = field.velocities[offset + 2] + directionZ * impulse;
    const speed = Math.sqrt(velocityX * velocityX + velocityY * velocityY + velocityZ * velocityZ);

    if (speed > maxSpeed && maxSpeed > 0) {
      const speedRatio = maxSpeed / speed;
      velocityX *= speedRatio;
      velocityY *= speedRatio;
      velocityZ *= speedRatio;
    }

    field.velocities[offset] = velocityX;
    field.velocities[offset + 1] = velocityY;
    field.velocities[offset + 2] = velocityZ;
    field.captured[index] = 0;
    releasedCount += 1;
  }

  return releasedCount;
}

export function countCapturedParticles(field: ParticleField): number {
  let count = 0;

  for (let index = 0; index < field.count; index += 1) {
    count += field.captured[index] === 1 ? 1 : 0;
  }

  return count;
}

export function resetCapturedParticles(field: ParticleField): void {
  field.captured.fill(0);
}

export function calculateParticleCount(options: ParticleCountOptions): number {
  const width = Math.max(1, finiteOr(options.width, 1));
  const height = Math.max(1, finiteOr(options.height, 1));
  const pixelRatio = Math.max(1, finiteOr(options.pixelRatio, 1));
  const shortEdge = Math.min(width, height);
  const mobileViewport = shortEdge < 700;
  const lowPower = pixelRatio > 2 || (options.hardwareConcurrency !== undefined && options.hardwareConcurrency <= 4);
  const area = width * height;

  if (options.reducedMotion) {
    return clamp(Math.round(area / 900), 300, 500);
  }

  const minimum = mobileViewport || lowPower ? 450 : 900;
  const maximum = mobileViewport || lowPower ? 800 : 1600;
  const density = mobileViewport ? 650 : 800;
  return clamp(Math.round(area / density), minimum, maximum);
}

export function normalizedPointerToWorld(
  pointer: PointerViewport,
  bounds: ParticleBounds = DEFAULT_PARTICLE_BOUNDS,
): Point3 {
  const width = Math.max(1, finiteOr(pointer.width, 1));
  const height = Math.max(1, finiteOr(pointer.height, 1));
  const normalizedX = clamp((finiteOr(pointer.clientX, pointer.left) - pointer.left) / width * 2 - 1, -1, 1);
  const normalizedY = clamp((finiteOr(pointer.clientY, pointer.top) - pointer.top) / height * 2 - 1, -1, 1);

  return {
    x: normalizedX * bounds.x * 0.9,
    y: -normalizedY * bounds.y * 0.9,
    z: 0,
  };
}
