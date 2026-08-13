export type Vector3Tuple = readonly [number, number, number];

export type BoundingSphereLike = {
  readonly center: Vector3Tuple;
  readonly radius: number;
};

export type CameraFit = {
  readonly target: Vector3Tuple;
  readonly position: Vector3Tuple;
  readonly distance: number;
  readonly minDistance: number;
  readonly maxDistance: number;
  readonly fov: number;
};

const DEFAULT_DIRECTION: Vector3Tuple = [0.84, 0.32, 1.04];

export function getViewerFov(viewportWidth: number): number {
  return viewportWidth < 720 ? 42 : 36;
}

function getSafeRadius(radius: number): number {
  return Number.isFinite(radius) && radius > 0 ? Math.max(radius, 0.0001) : 1;
}

function getSafeAspect(aspect: number): number {
  return Number.isFinite(aspect) && aspect > 0 ? Math.min(Math.max(aspect, 0.2), 4) : 1;
}

function getSafeFov(fov: number): number {
  return Number.isFinite(fov) ? Math.min(Math.max(fov, 20), 70) : 36;
}

function normalizeDirection(direction: Vector3Tuple): Vector3Tuple {
  const length = Math.hypot(direction[0], direction[1], direction[2]);
  if (!Number.isFinite(length) || length <= Number.EPSILON) {
    return [0, 0, 1];
  }
  return [direction[0] / length, direction[1] / length, direction[2] / length];
}

export function getCameraFit(
  sphere: BoundingSphereLike,
  aspect: number,
  fov = 36,
  direction: Vector3Tuple = DEFAULT_DIRECTION,
): CameraFit {
  const radius = getSafeRadius(sphere.radius);
  const safeAspect = getSafeAspect(aspect);
  const safeFov = getSafeFov(fov);
  const verticalHalfFov = (safeFov * Math.PI) / 360;
  const horizontalHalfFov = Math.atan(Math.tan(verticalHalfFov) * safeAspect);
  const limitingHalfFov = Math.max(0.05, Math.min(verticalHalfFov, horizontalHalfFov));
  const distance = Math.max(radius * 1.08, (radius / Math.sin(limitingHalfFov)) * 1.08);
  const safeDirection = normalizeDirection(direction);
  const target: Vector3Tuple = sphere.center.every((value) => Number.isFinite(value)) ? sphere.center : [0, 0, 0];
  const position: Vector3Tuple = [
    target[0] + safeDirection[0] * distance,
    target[1] + safeDirection[1] * distance,
    target[2] + safeDirection[2] * distance,
  ];

  return {
    target,
    position,
    distance,
    minDistance: Math.max(radius * 0.3, distance * 0.28),
    maxDistance: Math.max(distance * 2.3, distance + radius * 1.5),
    fov: safeFov,
  };
}
