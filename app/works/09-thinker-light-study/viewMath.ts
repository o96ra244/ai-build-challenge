export type ViewTransform = {
  readonly yaw: number;
  readonly pitch: number;
  readonly scale: number;
};

export const DEFAULT_VIEW_TRANSFORM: ViewTransform = {
  yaw: 0,
  pitch: 0,
  scale: 1,
};

export const VIEW_YAW_MIN = -0.55;
export const VIEW_YAW_MAX = 0.55;
export const VIEW_PITCH_MIN = -0.1;
export const VIEW_PITCH_MAX = 0.1;
export const VIEW_SCALE_MIN = 0.9;
export const VIEW_SCALE_MAX = 1.12;

function clampViewValue(value: number, min: number, max: number, fallback: number): number {
  const safeValue = Number.isFinite(value) ? value : fallback;
  return Math.min(max, Math.max(min, safeValue));
}

export function clampViewYaw(yaw: number): number {
  return clampViewValue(yaw, VIEW_YAW_MIN, VIEW_YAW_MAX, DEFAULT_VIEW_TRANSFORM.yaw);
}

export function clampViewPitch(pitch: number): number {
  return clampViewValue(pitch, VIEW_PITCH_MIN, VIEW_PITCH_MAX, DEFAULT_VIEW_TRANSFORM.pitch);
}

export function clampViewScale(scale: number): number {
  return clampViewValue(scale, VIEW_SCALE_MIN, VIEW_SCALE_MAX, DEFAULT_VIEW_TRANSFORM.scale);
}

export function updateViewTransform(
  current: ViewTransform,
  delta: Partial<ViewTransform>,
): ViewTransform {
  const yawDelta = typeof delta.yaw === "number" && Number.isFinite(delta.yaw) ? delta.yaw : 0;
  const pitchDelta = typeof delta.pitch === "number" && Number.isFinite(delta.pitch) ? delta.pitch : 0;
  const scaleDelta = typeof delta.scale === "number" && Number.isFinite(delta.scale) ? delta.scale : 0;
  return {
    yaw: clampViewYaw(clampViewYaw(current.yaw) + yawDelta),
    pitch: clampViewPitch(clampViewPitch(current.pitch) + pitchDelta),
    scale: clampViewScale(clampViewScale(current.scale) + scaleDelta),
  };
}

export function resetViewTransform(): ViewTransform {
  return DEFAULT_VIEW_TRANSFORM;
}
