import { clamp } from "./lightingMath";

export type LightingPresetId = "gallery" | "chiaroscuro" | "spectrum";
export type Rgb = readonly [number, number, number];
export type Vec3Tuple = readonly [number, number, number];
export type KeyLightKind = "directional" | "spot";

export type LightingPreset = {
  readonly id: LightingPresetId;
  readonly label: string;
  readonly purpose: string;
  readonly background: {
    readonly top: Rgb;
    readonly middle: Rgb;
    readonly bottom: Rgb;
    readonly fog: Rgb;
    readonly fogNear: number;
    readonly fogFar: number;
  };
  readonly key: {
    readonly kind: KeyLightKind;
    readonly color: Rgb;
    readonly position: Vec3Tuple;
    readonly target: Vec3Tuple;
    readonly intensity: number;
    readonly angle: number;
    readonly penumbra: number;
    readonly distance: number;
    readonly decay: number;
  };
  readonly fill: {
    readonly color: Rgb;
    readonly position: Vec3Tuple;
    readonly intensity: number;
  };
  readonly rim: {
    readonly color: Rgb;
    readonly position: Vec3Tuple;
    readonly intensity: number;
  };
  readonly environmentIntensity: number;
  readonly exposure: number;
  readonly shadowBias: number;
  readonly shadowNormalBias: number;
  readonly bloomStrength: number;
  readonly bloomRadius: number;
  readonly bloomThreshold: number;
};

const GALLERY: LightingPreset = {
  id: "gallery",
  label: "GALLERY",
  purpose: "全体像を読む標準展示",
  background: {
    top: [0.024, 0.029, 0.045],
    middle: [0.07, 0.074, 0.092],
    bottom: [0.008, 0.01, 0.016],
    fog: [0.05, 0.055, 0.07],
    fogNear: 5,
    fogFar: 18,
  },
  key: {
    kind: "directional",
    color: [1, 0.91, 0.82],
    position: [4.8, 6.4, 4.7],
    target: [0, 2.1, 0],
    intensity: 2.9,
    angle: 0.55,
    penumbra: 0.45,
    distance: 14,
    decay: 1.2,
  },
  fill: {
    color: [0.47, 0.58, 0.72],
    position: [-4.2, 2.8, 3.5],
    intensity: 0.78,
  },
  rim: {
    color: [0.68, 0.77, 0.94],
    position: [-4, 3.8, -4],
    intensity: 0.78,
  },
  environmentIntensity: 0.48,
  exposure: 1.02,
  shadowBias: -0.00035,
  shadowNormalBias: 0.018,
  bloomStrength: 0.012,
  bloomRadius: 0.22,
  bloomThreshold: 0.92,
};

const CHIAROSCURO: LightingPreset = {
  ...GALLERY,
  id: "chiaroscuro",
  label: "CHIAROSCURO",
  purpose: "明暗差で姿勢を読む劇場照明",
  background: {
    top: [0.006, 0.007, 0.012],
    middle: [0.014, 0.014, 0.019],
    bottom: [0.0015, 0.0015, 0.003],
    fog: [0.01, 0.011, 0.016],
    fogNear: 4.4,
    fogFar: 13,
  },
  key: {
    kind: "spot",
    color: [1, 0.78, 0.62],
    position: [-4.5, 6.6, 3.2],
    target: [0, 2.5, 0],
    intensity: 8,
    angle: 0.48,
    penumbra: 0.52,
    distance: 14,
    decay: 1.25,
  },
  fill: {
    color: [0.28, 0.36, 0.5],
    position: [4.2, 2.5, 2.2],
    intensity: 0.75,
  },
  rim: {
    color: [0.48, 0.57, 0.78],
    position: [4.2, 3.2, -3.4],
    intensity: 0.46,
  },
  environmentIntensity: 0.38,
  exposure: 1,
  shadowBias: -0.00055,
  shadowNormalBias: 0.025,
  bloomStrength: 0,
  bloomRadius: 0.18,
  bloomThreshold: 1,
};

const SPECTRUM: LightingPreset = {
  ...GALLERY,
  id: "spectrum",
  label: "SPECTRUM",
  purpose: "色光で面の違いを読む現代照明",
  background: {
    top: [0.012, 0.026, 0.058],
    middle: [0.035, 0.024, 0.072],
    bottom: [0.006, 0.008, 0.018],
    fog: [0.025, 0.026, 0.06],
    fogNear: 4.8,
    fogFar: 16,
  },
  key: {
    kind: "directional",
    color: [0.37, 0.83, 0.92],
    position: [4.6, 5.8, 4.3],
    target: [0, 2.15, 0],
    intensity: 4.2,
    angle: 0.55,
    penumbra: 0.45,
    distance: 14,
    decay: 1.2,
  },
  fill: {
    color: [0.7, 0.74, 0.76],
    position: [0, 3.2, 4.1],
    intensity: 0.72,
  },
  rim: {
    color: [0.88, 0.2, 0.58],
    position: [-4.4, 3.5, -3.6],
    intensity: 1.32,
  },
  environmentIntensity: 0.38,
  exposure: 1,
  shadowBias: -0.0004,
  shadowNormalBias: 0.02,
  bloomStrength: 0.045,
  bloomRadius: 0.24,
  bloomThreshold: 0.86,
};

export const LIGHTING_PRESETS: readonly LightingPreset[] = [GALLERY, CHIAROSCURO, SPECTRUM];
export const INITIAL_PRESET_ID: LightingPresetId = "gallery";

function lerpNumber(a: number, b: number, progress: number): number {
  return a + (b - a) * progress;
}

function lerpTuple<T extends Vec3Tuple>(a: T, b: T, progress: number): T {
  return [
    lerpNumber(a[0], b[0], progress),
    lerpNumber(a[1], b[1], progress),
    lerpNumber(a[2], b[2], progress),
  ] as unknown as T;
}

function getPreset(id: LightingPresetId): LightingPreset {
  return LIGHTING_PRESETS.find((preset) => preset.id === id) ?? GALLERY;
}

export function getLightingPreset(id: LightingPresetId): LightingPreset {
  return getPreset(id);
}

export function getLightingTransitionDuration(reducedMotion: boolean): number {
  return reducedMotion ? 90 : 1080;
}

export function interpolateLightingPreset(from: LightingPreset, to: LightingPreset, progress: number): LightingPreset {
  const t = clamp(progress, 0, 1);
  return {
    ...to,
    background: {
      top: lerpTuple(from.background.top, to.background.top, t),
      middle: lerpTuple(from.background.middle, to.background.middle, t),
      bottom: lerpTuple(from.background.bottom, to.background.bottom, t),
      fog: lerpTuple(from.background.fog, to.background.fog, t),
      fogNear: lerpNumber(from.background.fogNear, to.background.fogNear, t),
      fogFar: lerpNumber(from.background.fogFar, to.background.fogFar, t),
    },
    key: {
      kind: t < 0.5 ? from.key.kind : to.key.kind,
      color: lerpTuple(from.key.color, to.key.color, t),
      position: lerpTuple(from.key.position, to.key.position, t),
      target: lerpTuple(from.key.target, to.key.target, t),
      intensity: lerpNumber(from.key.intensity, to.key.intensity, t),
      angle: lerpNumber(from.key.angle, to.key.angle, t),
      penumbra: lerpNumber(from.key.penumbra, to.key.penumbra, t),
      distance: lerpNumber(from.key.distance, to.key.distance, t),
      decay: lerpNumber(from.key.decay, to.key.decay, t),
    },
    fill: {
      color: lerpTuple(from.fill.color, to.fill.color, t),
      position: lerpTuple(from.fill.position, to.fill.position, t),
      intensity: lerpNumber(from.fill.intensity, to.fill.intensity, t),
    },
    rim: {
      color: lerpTuple(from.rim.color, to.rim.color, t),
      position: lerpTuple(from.rim.position, to.rim.position, t),
      intensity: lerpNumber(from.rim.intensity, to.rim.intensity, t),
    },
    environmentIntensity: lerpNumber(from.environmentIntensity, to.environmentIntensity, t),
    exposure: lerpNumber(from.exposure, to.exposure, t),
    shadowBias: lerpNumber(from.shadowBias, to.shadowBias, t),
    shadowNormalBias: lerpNumber(from.shadowNormalBias, to.shadowNormalBias, t),
    bloomStrength: lerpNumber(from.bloomStrength, to.bloomStrength, t),
    bloomRadius: lerpNumber(from.bloomRadius, to.bloomRadius, t),
    bloomThreshold: lerpNumber(from.bloomThreshold, to.bloomThreshold, t),
  };
}
