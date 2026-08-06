import { clamp } from "./relicMath";

export type RelicPresetId = "eclipse" | "aurora" | "ember";
export type Rgb = readonly [number, number, number];
export type Vec3Tuple = readonly [number, number, number];

export type RelicPreset = {
  readonly id: RelicPresetId;
  readonly label: string;
  readonly background: {
    readonly top: Rgb;
    readonly middle: Rgb;
    readonly bottom: Rgb;
    readonly fog: Rgb;
    readonly fogNear: number;
    readonly fogFar: number;
  };
  readonly lights: {
    readonly keyColor: Rgb;
    readonly rimColor: Rgb;
    readonly floorColor: Rgb;
    readonly keyPosition: Vec3Tuple;
    readonly rimPosition: Vec3Tuple;
    readonly floorPosition: Vec3Tuple;
    readonly keyIntensity: number;
    readonly rimIntensity: number;
    readonly floorIntensity: number;
    readonly backgroundIntensity: number;
  };
  readonly shell: {
    readonly colorA: Rgb;
    readonly colorB: Rgb;
    readonly accent: Rgb;
    readonly transmission: number;
    readonly thickness: number;
    readonly ior: number;
    readonly dispersion: number;
    readonly iridescence: number;
    readonly roughness: number;
    readonly opacity: number;
    readonly attenuationColor: Rgb;
    readonly attenuationDistance: number;
  };
  readonly core: {
    readonly colorA: Rgb;
    readonly colorB: Rgb;
    readonly intensity: number;
  };
  readonly camera: {
    readonly position: Vec3Tuple;
    readonly target: Vec3Tuple;
    readonly fov: number;
  };
  readonly motionSpeed: number;
  readonly bloomStrength: number;
  readonly bloomRadius: number;
  readonly bloomThreshold: number;
};

const ECLIPSE: RelicPreset = {
  id: "eclipse",
  label: "ECLIPSE",
  background: {
    top: [0.012, 0.02, 0.055],
    middle: [0.025, 0.035, 0.095],
    bottom: [0.006, 0.008, 0.021],
    fog: [0.025, 0.035, 0.095],
    fogNear: 5,
    fogFar: 17,
  },
  lights: {
    keyColor: [0.74, 0.84, 1],
    rimColor: [0.22, 0.45, 1],
    floorColor: [0.16, 0.25, 0.56],
    keyPosition: [4.2, 5.7, 4.8],
    rimPosition: [-4.5, 2.1, -3.5],
    floorPosition: [0.6, -1.7, 1.8],
    keyIntensity: 3.2,
    rimIntensity: 3.8,
    floorIntensity: 1.15,
    backgroundIntensity: 0.48,
  },
  shell: {
    colorA: [0.04, 0.08, 0.2],
    colorB: [0.22, 0.37, 0.75],
    accent: [0.62, 0.8, 1],
    transmission: 0.48,
    thickness: 0.78,
    ior: 1.46,
    dispersion: 0.14,
    iridescence: 0.42,
    roughness: 0.17,
    opacity: 0.94,
    attenuationColor: [0.06, 0.12, 0.38],
    attenuationDistance: 2.4,
  },
  core: {
    colorA: [0.25, 0.5, 1],
    colorB: [0.68, 0.88, 1],
    intensity: 1.45,
  },
  camera: { position: [3.15, 0.8, 6.2], target: [0, 0.25, 0], fov: 31 },
  motionSpeed: 0.22,
  bloomStrength: 0.24,
  bloomRadius: 0.36,
  bloomThreshold: 0.78,
};

const AURORA: RelicPreset = {
  ...ECLIPSE,
  id: "aurora",
  label: "AURORA",
  background: {
    top: [0.018, 0.065, 0.12],
    middle: [0.045, 0.025, 0.14],
    bottom: [0.012, 0.01, 0.045],
    fog: [0.04, 0.04, 0.14],
    fogNear: 4,
    fogFar: 16,
  },
  lights: {
    keyColor: [0.3, 0.9, 0.86],
    rimColor: [0.73, 0.28, 1],
    floorColor: [0.18, 0.5, 0.58],
    keyPosition: [3.6, 4.5, 3.8],
    rimPosition: [-4.2, 1.7, -2.8],
    floorPosition: [-1.1, -1.65, 1.5],
    keyIntensity: 2.8,
    rimIntensity: 3.5,
    floorIntensity: 1.4,
    backgroundIntensity: 0.56,
  },
  shell: {
    colorA: [0.04, 0.34, 0.4],
    colorB: [0.48, 0.12, 0.64],
    accent: [1, 0.38, 0.72],
    transmission: 0.58,
    thickness: 0.64,
    ior: 1.48,
    dispersion: 0.26,
    iridescence: 0.82,
    roughness: 0.13,
    opacity: 0.92,
    attenuationColor: [0.04, 0.3, 0.28],
    attenuationDistance: 2.9,
  },
  core: {
    colorA: [0.08, 0.82, 0.64],
    colorB: [0.92, 0.26, 0.78],
    intensity: 1.85,
  },
  camera: { position: [3.05, 0.65, 6.05], target: [0, 0.2, 0], fov: 30 },
  motionSpeed: 0.3,
  bloomStrength: 0.3,
  bloomRadius: 0.44,
  bloomThreshold: 0.7,
};

const EMBER: RelicPreset = {
  ...ECLIPSE,
  id: "ember",
  label: "EMBER",
  background: {
    top: [0.045, 0.018, 0.018],
    middle: [0.09, 0.028, 0.015],
    bottom: [0.018, 0.006, 0.008],
    fog: [0.08, 0.025, 0.012],
    fogNear: 4.5,
    fogFar: 15,
  },
  lights: {
    keyColor: [1, 0.52, 0.18],
    rimColor: [0.86, 0.12, 0.05],
    floorColor: [0.7, 0.17, 0.045],
    keyPosition: [3.1, 3.2, 3.6],
    rimPosition: [-3.7, 1.2, -2.2],
    floorPosition: [-0.9, -1.75, 1.6],
    keyIntensity: 3.1,
    rimIntensity: 3.7,
    floorIntensity: 1.8,
    backgroundIntensity: 0.5,
  },
  shell: {
    colorA: [0.22, 0.035, 0.018],
    colorB: [0.78, 0.2, 0.035],
    accent: [1, 0.68, 0.24],
    transmission: 0.44,
    thickness: 0.84,
    ior: 1.44,
    dispersion: 0.1,
    iridescence: 0.34,
    roughness: 0.2,
    opacity: 0.95,
    attenuationColor: [0.42, 0.055, 0.012],
    attenuationDistance: 2,
  },
  core: {
    colorA: [1, 0.16, 0.025],
    colorB: [1, 0.78, 0.2],
    intensity: 2.1,
  },
  camera: { position: [3.25, 0.46, 6.25], target: [0, 0.14, 0], fov: 31 },
  motionSpeed: 0.18,
  bloomStrength: 0.27,
  bloomRadius: 0.34,
  bloomThreshold: 0.76,
};

export const RELIC_PRESETS: readonly RelicPreset[] = [ECLIPSE, AURORA, EMBER];
export const INITIAL_PRESET_ID: RelicPresetId = "eclipse";

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

export function getPreset(id: RelicPresetId): RelicPreset {
  return RELIC_PRESETS.find((preset) => preset.id === id) ?? ECLIPSE;
}

export function getPresetTransitionDuration(reducedMotion: boolean): number {
  return reducedMotion ? 90 : 1060;
}

export function interpolatePreset(from: RelicPreset, to: RelicPreset, progress: number): RelicPreset {
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
    lights: {
      keyColor: lerpTuple(from.lights.keyColor, to.lights.keyColor, t),
      rimColor: lerpTuple(from.lights.rimColor, to.lights.rimColor, t),
      floorColor: lerpTuple(from.lights.floorColor, to.lights.floorColor, t),
      keyPosition: lerpTuple(from.lights.keyPosition, to.lights.keyPosition, t),
      rimPosition: lerpTuple(from.lights.rimPosition, to.lights.rimPosition, t),
      floorPosition: lerpTuple(from.lights.floorPosition, to.lights.floorPosition, t),
      keyIntensity: lerpNumber(from.lights.keyIntensity, to.lights.keyIntensity, t),
      rimIntensity: lerpNumber(from.lights.rimIntensity, to.lights.rimIntensity, t),
      floorIntensity: lerpNumber(from.lights.floorIntensity, to.lights.floorIntensity, t),
      backgroundIntensity: lerpNumber(from.lights.backgroundIntensity, to.lights.backgroundIntensity, t),
    },
    shell: {
      colorA: lerpTuple(from.shell.colorA, to.shell.colorA, t),
      colorB: lerpTuple(from.shell.colorB, to.shell.colorB, t),
      accent: lerpTuple(from.shell.accent, to.shell.accent, t),
      transmission: lerpNumber(from.shell.transmission, to.shell.transmission, t),
      thickness: lerpNumber(from.shell.thickness, to.shell.thickness, t),
      ior: lerpNumber(from.shell.ior, to.shell.ior, t),
      dispersion: lerpNumber(from.shell.dispersion, to.shell.dispersion, t),
      iridescence: lerpNumber(from.shell.iridescence, to.shell.iridescence, t),
      roughness: lerpNumber(from.shell.roughness, to.shell.roughness, t),
      opacity: lerpNumber(from.shell.opacity, to.shell.opacity, t),
      attenuationColor: lerpTuple(from.shell.attenuationColor, to.shell.attenuationColor, t),
      attenuationDistance: lerpNumber(from.shell.attenuationDistance, to.shell.attenuationDistance, t),
    },
    core: {
      colorA: lerpTuple(from.core.colorA, to.core.colorA, t),
      colorB: lerpTuple(from.core.colorB, to.core.colorB, t),
      intensity: lerpNumber(from.core.intensity, to.core.intensity, t),
    },
    camera: {
      position: lerpTuple(from.camera.position, to.camera.position, t),
      target: lerpTuple(from.camera.target, to.camera.target, t),
      fov: lerpNumber(from.camera.fov, to.camera.fov, t),
    },
    motionSpeed: lerpNumber(from.motionSpeed, to.motionSpeed, t),
    bloomStrength: lerpNumber(from.bloomStrength, to.bloomStrength, t),
    bloomRadius: lerpNumber(from.bloomRadius, to.bloomRadius, t),
    bloomThreshold: lerpNumber(from.bloomThreshold, to.bloomThreshold, t),
  };
}
