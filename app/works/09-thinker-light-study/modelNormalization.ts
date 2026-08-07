export type Vec3Tuple = readonly [number, number, number];

export type ModelBounds = {
  readonly min: Vec3Tuple;
  readonly max: Vec3Tuple;
  readonly size: Vec3Tuple;
  readonly center: Vec3Tuple;
  readonly maxDimension: number;
};

export type ModelNormalization = {
  readonly rotationX: number;
  readonly scale: number;
  readonly translation: Vec3Tuple;
};

export type CameraFraming = {
  readonly position: Vec3Tuple;
  readonly target: Vec3Tuple;
  readonly fov: number;
};

const SOURCE_TO_WORLD_ROTATION_X = -Math.PI / 2;

export function getModelBounds(positions: ArrayLike<number>): ModelBounds {
  const min: [number, number, number] = [Infinity, Infinity, Infinity];
  const max: [number, number, number] = [-Infinity, -Infinity, -Infinity];

  for (let index = 0; index + 2 < positions.length; index += 3) {
    const x = Number.isFinite(positions[index]) ? positions[index] : 0;
    const y = Number.isFinite(positions[index + 1]) ? positions[index + 1] : 0;
    const z = Number.isFinite(positions[index + 2]) ? positions[index + 2] : 0;
    min[0] = Math.min(min[0], x);
    min[1] = Math.min(min[1], y);
    min[2] = Math.min(min[2], z);
    max[0] = Math.max(max[0], x);
    max[1] = Math.max(max[1], y);
    max[2] = Math.max(max[2], z);
  }

  const safeMin: Vec3Tuple = min.every(Number.isFinite)
    ? min.map((value) => value === 0 ? 0 : value) as [number, number, number]
    : [0, 0, 0];
  const safeMax: Vec3Tuple = max.every(Number.isFinite)
    ? max.map((value) => value === 0 ? 0 : value) as [number, number, number]
    : [0, 0, 0];
  const size: Vec3Tuple = [
    Math.max(0, safeMax[0] - safeMin[0]),
    Math.max(0, safeMax[1] - safeMin[1]),
    Math.max(0, safeMax[2] - safeMin[2]),
  ];
  const center: Vec3Tuple = [
    (safeMin[0] + safeMax[0]) / 2,
    (safeMin[1] + safeMax[1]) / 2,
    (safeMin[2] + safeMax[2]) / 2,
  ];

  return {
    min: safeMin,
    max: safeMax,
    size,
    center,
    maxDimension: Math.max(size[0], size[1], size[2]),
  };
}

export function getOrientedModelBounds(bounds: ModelBounds): ModelBounds {
  return getModelBounds([
    bounds.min[0], bounds.max[2], -bounds.max[1],
    bounds.min[0], bounds.min[2], -bounds.max[1],
    bounds.max[0], bounds.max[2], -bounds.max[1],
    bounds.max[0], bounds.min[2], -bounds.max[1],
    bounds.min[0], bounds.max[2], -bounds.min[1],
    bounds.min[0], bounds.min[2], -bounds.min[1],
    bounds.max[0], bounds.max[2], -bounds.min[1],
    bounds.max[0], bounds.min[2], -bounds.min[1],
  ]);
}

export function getModelNormalization(bounds: ModelBounds, targetHeight = 4.8): ModelNormalization {
  const oriented = getOrientedModelBounds(bounds);
  const height = Math.max(0.0001, oriented.size[1]);
  const scale = Number.isFinite(targetHeight) && targetHeight > 0 ? targetHeight / height : 1;
  const translation: Vec3Tuple = [
    -oriented.center[0] * scale,
    -oriented.min[1] * scale,
    -oriented.center[2] * scale,
  ].map((value) => value === 0 ? 0 : value) as [number, number, number];
  return {
    rotationX: SOURCE_TO_WORLD_ROTATION_X,
    scale: Number.isFinite(scale) ? scale : 1,
    translation,
  };
}

export function getCameraFraming(width: number, height: number): CameraFraming {
  const aspectRatio = width / Math.max(1, height);
  const isMobile = width <= 760 || aspectRatio < 0.8;
  return isMobile
    ? {
        position: [5.6, 3.15, 11.8],
        target: [0, 2.45, 0],
        fov: 31,
      }
    : {
        position: [5.7, 3.65, 10],
        target: [0, 2.34, 0],
        fov: 30,
      };
}
