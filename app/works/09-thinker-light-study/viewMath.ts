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

export const VIEW_SCALE_MIN = 0.82;
export const VIEW_SCALE_MAX = 1.2;

export function clampViewScale(scale: number): number {
  const safeScale = Number.isFinite(scale) ? scale : DEFAULT_VIEW_TRANSFORM.scale;
  return Math.min(VIEW_SCALE_MAX, Math.max(VIEW_SCALE_MIN, safeScale));
}

export function updateViewTransform(
  current: ViewTransform,
  delta: Partial<ViewTransform>,
): ViewTransform {
  const yawDelta = typeof delta.yaw === "number" && Number.isFinite(delta.yaw) ? delta.yaw : 0;
  const pitchDelta = typeof delta.pitch === "number" && Number.isFinite(delta.pitch) ? delta.pitch : 0;
  const scaleDelta = typeof delta.scale === "number" && Number.isFinite(delta.scale) ? delta.scale : 0;
  return {
    yaw: current.yaw + yawDelta,
    pitch: Math.min(0.24, Math.max(-0.2, current.pitch + pitchDelta)),
    scale: clampViewScale(current.scale + scaleDelta),
  };
}

export function resetViewTransform(): ViewTransform {
  return DEFAULT_VIEW_TRANSFORM;
}
