import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { WebGPURenderer } from "three/webgpu";

import {
  clampDeltaSeconds,
  clampProgress,
  getAutoRotateAfterMotionPreference,
  getCameraPreset,
  getInitialAutoRotate,
  getModuleDefinition,
  getModuleTransitionDuration,
  getModuleTransitionTransform,
  getOrbitDampingFactor,
  normalizeSelection,
  type ModuleCategory,
  type ModuleTransitionMode,
  type ExperienceMode,
  type RoverModuleDefinition,
  type RoverSelection,
  type Vector3Tuple,
} from "./roverModel";
import {
  EMPTY_DRIVE_INPUT,
  getVisitedAreaCount,
  type DriveInput,
} from "./driveModel";
import {
  CLIMBABLE_OBSTACLES,
  DYNAMIC_PROPS,
  FIXED_OBSTACLES,
  FRONTIER_AREAS,
  FRONTIER_LANDMARKS,
  HEIGHTFIELD_COLUMNS,
  HEIGHTFIELD_HEIGHTS,
  HEIGHTFIELD_ROWS,
  WAYSTONES,
  getFrontierArea,
  getFrontierHeight,
  getHeightfieldIndex,
  getSurfaceType,
  type FrontierAreaId,
  type FrontierMode as DataFrontierMode,
} from "./frontierWorld";
import {
  loadRapier,
  RoverPhysicsWorld,
  type PhysicsSnapshot,
} from "./RoverPhysicsWorld";
import { VEHICLE_CONFIG, WHEEL_CONFIGS } from "./vehicleConfig";

export type LowPolyRoverSceneOptions = {
  readonly reducedMotion: boolean;
  readonly selection: RoverSelection;
  readonly onAutoRotateChange: (enabled: boolean) => void;
  readonly onFrontierStatusChange: (status: FrontierRunStatus) => void;
  readonly onFrontierCountdownChange: (countdown: number | null) => void;
  readonly onFrontierHudChange: (hud: FrontierHud) => void;
  readonly onFrontierWaystone: (id: string, label: string) => void;
  readonly onFrontierComplete: (elapsedMilliseconds: number) => void;
  readonly onFrontierAnnouncement: (message: string) => void;
};

export type FrontierMode = DataFrontierMode;

export type FrontierRunStatus = "ready" | "countdown" | "running" | "paused" | "clear";

export type FrontierHud = {
  readonly mode: FrontierMode;
  readonly status: FrontierRunStatus;
  readonly areaLabel: string;
  readonly surface: string;
  readonly speed: number;
  readonly groundedWheels: number;
  readonly traction: number;
  readonly visitedAreas: number;
  readonly visitedAreaIds: readonly FrontierAreaId[];
  readonly waystoneCount: number;
  readonly visitedWaystoneIds: readonly string[];
  readonly nextWaystoneDistance: number | null;
  readonly elapsedMilliseconds: number;
  readonly x: number;
  readonly z: number;
  readonly heading: number;
  readonly recoveryReady: boolean;
  readonly rolloverSeconds: number;
};

type DynamicPropInstance = {
  readonly bodyIndex: number;
  readonly group: THREE.Group;
};

type WaystoneVisual = {
  readonly group: THREE.Group;
  readonly ring: THREE.Mesh;
};

export type LowPolyRoverSceneInitResult = {
  readonly webGpuApiAvailable: boolean;
};

type ModuleInstance = {
  readonly category: ModuleCategory;
  readonly definition: RoverModuleDefinition;
  readonly group: THREE.Group;
  readonly turbineRotor: THREE.Group | null;
  mode: ModuleTransitionMode;
  progress: number;
  target: 0 | 1;
};

type ModuleBuildResult = {
  readonly group: THREE.Group;
  readonly turbineRotor: THREE.Group | null;
};

const BACKGROUND_COLOR = 0xe9dfcf;
const UP_AXIS = new THREE.Vector3(0, 1, 0);
const CAMERA_TARGET = new THREE.Vector3(0, 1.45, 0);
const WHEEL_RADIUS = 0.82;

const COLORS = {
  frame: 0x354e50,
  body: 0x3c7d78,
  bodyLight: 0x6db6a3,
  rubber: 0x293438,
  hub: 0xf1b45e,
  pipe: 0xd58b45,
  metal: 0x869295,
  darkMetal: 0x465b5d,
  glass: 0x8fc9c3,
  window: 0x2e575e,
  light: 0xf8d477,
  orange: 0xe37c3b,
  yellow: 0xe4b842,
  navy: 0x3b4c66,
  pad: 0x8d9b94,
  padLine: 0xd4b66a,
  soil: 0x806247,
  crate: 0xc9864c,
  crateDark: 0x805536,
} as const;

function createMaterial(
  color: number,
  options: { readonly metalness?: number; readonly roughness?: number } = {},
): THREE.MeshStandardMaterial {
  return new THREE.MeshStandardMaterial({
    color,
    flatShading: true,
    metalness: options.metalness ?? 0.08,
    roughness: options.roughness ?? 0.78,
  });
}

function addMesh(
  parent: THREE.Group,
  geometry: THREE.BufferGeometry,
  material: THREE.Material,
  position: Vector3Tuple = [0, 0, 0],
  rotation: Vector3Tuple = [0, 0, 0],
  scale: Vector3Tuple = [1, 1, 1],
): THREE.Mesh {
  const mesh = new THREE.Mesh(geometry, material);
  mesh.position.set(...position);
  mesh.rotation.set(...rotation);
  mesh.scale.set(...scale);
  mesh.castShadow = false;
  mesh.receiveShadow = false;
  parent.add(mesh);
  return mesh;
}

function addBox(
  parent: THREE.Group,
  size: Vector3Tuple,
  position: Vector3Tuple,
  color: number,
  rotation: Vector3Tuple = [0, 0, 0],
  scale: Vector3Tuple = [1, 1, 1],
): THREE.Mesh {
  return addMesh(
    parent,
    new THREE.BoxGeometry(...size),
    createMaterial(color),
    position,
    rotation,
    scale,
  );
}

function addCylinder(
  parent: THREE.Group,
  radiusTop: number,
  radiusBottom: number,
  height: number,
  segments: number,
  position: Vector3Tuple,
  color: number,
  rotation: Vector3Tuple = [0, 0, 0],
): THREE.Mesh {
  return addMesh(
    parent,
    new THREE.CylinderGeometry(radiusTop, radiusBottom, height, segments),
    createMaterial(color),
    position,
    rotation,
  );
}

function addBeam(
  parent: THREE.Group,
  start: Vector3Tuple,
  end: Vector3Tuple,
  radius: number,
  color: number,
): THREE.Mesh {
  const startVector = new THREE.Vector3(...start);
  const endVector = new THREE.Vector3(...end);
  const direction = endVector.clone().sub(startVector);
  const length = Math.max(0.001, direction.length());
  const midpoint = startVector.clone().add(endVector).multiplyScalar(0.5);
  const mesh = addMesh(
    parent,
    new THREE.CylinderGeometry(radius, radius, length, 6),
    createMaterial(color),
    [midpoint.x, midpoint.y, midpoint.z],
  );
  mesh.quaternion.setFromUnitVectors(UP_AXIS, direction.normalize());
  return mesh;
}

function disposeObject(root: THREE.Object3D): void {
  const geometries = new Set<THREE.BufferGeometry>();
  const materials = new Set<THREE.Material>();

  root.traverse((object) => {
    if (!(object instanceof THREE.Mesh)) {
      return;
    }

    geometries.add(object.geometry);
    if (Array.isArray(object.material)) {
      object.material.forEach((material) => materials.add(material));
    } else {
      materials.add(object.material);
    }
  });

  geometries.forEach((geometry) => geometry.dispose());
  materials.forEach((material) => material.dispose());
}

function disposeScene(scene: THREE.Scene): void {
  disposeObject(scene);
}

function reverseTransitionProgress(progress: number, mode: ModuleTransitionMode): number {
  const eased = 1 - (1 - clampProgress(progress)) ** 3;
  const reversed = mode === "enter"
    ? 1 - eased ** (1 / 3)
    : 1 - (1 - eased) ** (1 / 3);
  return clampProgress(reversed);
}

function createTerrainGeometry(): THREE.BufferGeometry {
  const positions: number[] = [];
  const indices: number[] = [];
  const colors: number[] = [];
  const surfaceColors: Record<string, THREE.Color> = {
    meadow: new THREE.Color(0x86bb82),
    dirt: new THREE.Color(0xb7865e),
    stone: new THREE.Color(0x98a4a3),
    "loose-soil": new THREE.Color(0xd19a66),
  };

  for (let row = 0; row < HEIGHTFIELD_ROWS; row += 1) {
    const z = -120 + 240 * row / (HEIGHTFIELD_ROWS - 1);
    for (let column = 0; column < HEIGHTFIELD_COLUMNS; column += 1) {
      const x = -160 + 320 * column / (HEIGHTFIELD_COLUMNS - 1);
      positions.push(x, HEIGHTFIELD_HEIGHTS[getHeightfieldIndex(column, row)] ?? getFrontierHeight(x, z), z);
      const color = surfaceColors[getSurfaceType(x, z)] ?? surfaceColors.meadow;
      colors.push(color.r, color.g, color.b);
    }
  }

  for (let row = 0; row < HEIGHTFIELD_ROWS - 1; row += 1) {
    for (let column = 0; column < HEIGHTFIELD_COLUMNS - 1; column += 1) {
      const current = row * HEIGHTFIELD_COLUMNS + column;
      const nextRow = (row + 1) * HEIGHTFIELD_COLUMNS + column;
      indices.push(current, nextRow, current + 1, current + 1, nextRow, nextRow + 1);
    }
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute("color", new THREE.Float32BufferAttribute(colors, 3));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  return geometry;
}

export class LowPolyRoverScene {
  private readonly container: HTMLElement;
  private readonly options: LowPolyRoverSceneOptions;
  private readonly scene = new THREE.Scene();
  private readonly camera = new THREE.PerspectiveCamera();
  private readonly roverGroup = new THREE.Group();
  private readonly moduleRoot = new THREE.Group();
  private readonly garageRoot = new THREE.Group();
  private readonly frontierRoot = new THREE.Group();
  private readonly dustRoot = new THREE.Group();
  private readonly moduleInstances: ModuleInstance[] = [];
  private readonly wheelSpinGroups: THREE.Group[] = [];
  private readonly dustParticles: THREE.Mesh[] = [];
  private readonly dynamicPropInstances: DynamicPropInstance[] = [];
  private readonly waystoneVisuals = new Map<string, WaystoneVisual>();
  private reducedMotion: boolean;
  private selection: RoverSelection;
  private mode: ExperienceMode = "garage";
  private readonly handleResize = (): void => this.resize();
  private readonly handleVisibility = (): void => {
    this.pageVisible = document.visibilityState === "visible";
    if (!this.pageVisible) {
      this.pauseFrontier();
    }
    this.updateLoopState();
  };
  private readonly handleWindowBlur = (): void => {
    this.pauseFrontier();
  };
  private readonly render = (time: number): void => this.renderFrame(time);
  private renderer: WebGPURenderer | null = null;
  private controls: OrbitControls | null = null;
  private resizeObserver: ResizeObserver | null = null;
  private intersectionObserver: IntersectionObserver | null = null;
  private pageVisible = document.visibilityState === "visible";
  private inViewport = true;
  private disposed = false;
  private lastTime = 0;
  private controlsActiveUntil = 0;
  private animationLoopActive = false;
  private frontierMode: FrontierMode = "free-roam";
  private frontierStatus: FrontierRunStatus = "running";
  private frontierPausedFrom: FrontierRunStatus = "running";
  private countdownElapsed = 0;
  private countdownValue = 0;
  private frontierElapsedMilliseconds = 0;
  private frontierHudLastSentAt = 0;
  private driveInput: DriveInput = EMPTY_DRIVE_INPUT;
  private cameraInitialized = false;
  private physics: RoverPhysicsWorld | null = null;
  private frontierLoading = false;
  private frontierLoadToken = 0;
  private waystoneIds: readonly string[] = [];
  private exploredAreaIds: readonly FrontierAreaId[] = [];

  public constructor(container: HTMLElement, options: LowPolyRoverSceneOptions) {
    this.container = container;
    this.options = options;
    this.reducedMotion = options.reducedMotion;
    this.selection = normalizeSelection(options.selection);
  }

  public async init(): Promise<LowPolyRoverSceneInitResult> {
    this.scene.background = new THREE.Color(BACKGROUND_COLOR);
    this.scene.fog = new THREE.Fog(BACKGROUND_COLOR, 46, 360);
    this.buildLighting();
    this.buildGarage();
    this.buildFixedChassis();
    this.scene.add(this.roverGroup);
    this.roverGroup.add(this.moduleRoot);
    this.roverGroup.add(this.dustRoot);
    this.buildInitialModules();

    const viewport = this.getViewportSize();
    const cameraPreset = getCameraPreset(this.mode, viewport.width, viewport.height);
    this.camera.aspect = viewport.width / viewport.height;
    this.camera.fov = cameraPreset.fov;
    this.camera.near = 0.1;
    this.camera.far = 240;
    this.camera.position.set(...cameraPreset.position);
    this.camera.lookAt(...cameraPreset.target);
    this.camera.updateProjectionMatrix();

    const renderer = new WebGPURenderer({ antialias: true, alpha: false });
    await renderer.init();

    if (this.disposed) {
      renderer.dispose();
      return { webGpuApiAvailable: this.hasWebGpuApi() };
    }

    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, viewport.width < 700 ? 1.25 : 1.5));
    renderer.setSize(viewport.width, viewport.height, false);
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.domElement.setAttribute("aria-hidden", "true");
    renderer.domElement.setAttribute("role", "presentation");
    renderer.domElement.style.display = "block";
    renderer.domElement.style.width = "100%";
    renderer.domElement.style.height = "100%";
    this.renderer = renderer;
    this.container.appendChild(renderer.domElement);

    this.controls = new OrbitControls(this.camera, renderer.domElement);
    this.controls.target.copy(CAMERA_TARGET);
    this.controls.enablePan = false;
    this.controls.enableDamping = true;
    this.controls.dampingFactor = getOrbitDampingFactor(this.reducedMotion);
    this.controls.minDistance = cameraPreset.minDistance;
    this.controls.maxDistance = cameraPreset.maxDistance;
    this.controls.minPolarAngle = 0.52;
    this.controls.maxPolarAngle = Math.PI * 0.47;
    this.controls.autoRotate = getInitialAutoRotate(this.reducedMotion);
    this.controls.autoRotateSpeed = 0.34;
    this.controls.addEventListener("change", this.handleControlsChange);
    this.controls.update();

    this.resizeObserver = new ResizeObserver(this.handleResize);
    this.resizeObserver.observe(this.container);
    this.intersectionObserver = new IntersectionObserver(
      ([entry]) => {
        this.inViewport = entry?.isIntersecting ?? true;
        this.updateLoopState();
      },
      { threshold: 0.01 },
    );
    this.intersectionObserver.observe(this.container);
    window.addEventListener("resize", this.handleResize, { passive: true });
    window.addEventListener("blur", this.handleWindowBlur);
    document.addEventListener("visibilitychange", this.handleVisibility);

    renderer.render(this.scene, this.camera);
    this.updateLoopState();
    return { webGpuApiAvailable: this.hasWebGpuApi() };
  }

  public setSelection(selection: RoverSelection): void {
    if (this.disposed) {
      return;
    }

    this.selection = normalizeSelection(selection);
    const categories: readonly ModuleCategory[] = ["front", "cabin", "rear"];
    for (const category of categories) {
      const wantedId = this.selection[category];
      const active = this.moduleInstances.find(
        (instance) => instance.category === category
          && instance.definition.id === wantedId
          && instance.target === 1,
      );
      if (active) {
        continue;
      }

      const reusable = this.moduleInstances.find(
        (instance) => instance.category === category && instance.definition.id === wantedId,
      );
      for (const instance of this.moduleInstances) {
        if (instance.category !== category || instance === reusable || instance.target === 0) {
          continue;
        }
        instance.progress = reverseTransitionProgress(instance.progress, instance.mode);
        instance.mode = "exit";
        instance.target = 0;
      }

      if (reusable) {
        reusable.progress = reverseTransitionProgress(reusable.progress, reusable.mode);
        reusable.mode = "enter";
        reusable.target = 1;
        continue;
      }

      const definition = getModuleDefinition(category, wantedId);
      if (!definition) {
        continue;
      }

      const built = this.createModule(definition);
      const instance: ModuleInstance = {
        category,
        definition,
        group: built.group,
        turbineRotor: built.turbineRotor,
        mode: "enter",
        progress: 0,
        target: 1,
      };
      this.moduleInstances.push(instance);
      this.moduleRoot.add(instance.group);
      this.applyModuleTransform(instance);
    }
    this.updateLoopState();
  }

  public setAutoRotate(enabled: boolean): void {
    if (this.disposed || !this.controls || this.mode === "frontier") {
      return;
    }

    this.controls.autoRotate = enabled;
    this.options.onAutoRotateChange(enabled);
    this.updateLoopState();
  }

  public setReducedMotion(enabled: boolean): void {
    if (this.disposed) {
      return;
    }

    this.reducedMotion = enabled;
    if (!this.controls) {
      return;
    }

    this.controls.dampingFactor = getOrbitDampingFactor(enabled);
    const nextAutoRotate = this.mode === "frontier"
      ? false
      : getAutoRotateAfterMotionPreference(enabled, this.controls.autoRotate);
    if (nextAutoRotate !== this.controls.autoRotate) {
      this.controls.autoRotate = nextAutoRotate;
      this.options.onAutoRotateChange(nextAutoRotate);
    }
    this.updateLoopState();
  }

  public async setMode(mode: ExperienceMode): Promise<void> {
    if (this.disposed || !this.controls || this.mode === mode) {
      return;
    }

    this.clearDriveInput();
    this.mode = mode;
    this.garageRoot.visible = mode === "garage";
    this.frontierRoot.visible = mode === "frontier";
    this.dustRoot.visible = false;
    this.wheelSpinGroups.forEach((group) => group.rotation.set(0, 0, 0));
    const viewport = this.getViewportSize();
    const cameraPreset = getCameraPreset(mode, viewport.width, viewport.height);
    this.camera.position.set(...cameraPreset.position);
    this.camera.fov = cameraPreset.fov;
    this.camera.updateProjectionMatrix();
    this.controls.target.set(...cameraPreset.target);
    this.controls.enabled = mode === "garage";
    this.controls.minDistance = cameraPreset.minDistance;
    this.controls.maxDistance = cameraPreset.maxDistance;
    this.controls.autoRotate = false;
    this.controls.update();
    if (mode === "frontier") {
      await this.ensureFrontier();
      if (this.disposed) {
        return;
      }
      this.frontierStatus = "running";
      this.frontierMode = "free-roam";
      this.frontierElapsedMilliseconds = 0;
      this.waystoneIds = [];
      this.resetWaystoneVisuals();
      this.cameraInitialized = false;
      this.syncRover(this.physics?.snapshot ?? null, 0);
      this.emitFrontierHud(true);
      this.options.onFrontierCountdownChange(null);
      this.options.onFrontierStatusChange("running");
    } else {
      this.frontierStatus = "ready";
      this.disposeFrontierPhysics();
      this.roverGroup.position.set(0, 0, 0);
      this.roverGroup.quaternion.identity();
      this.wheelSpinGroups.forEach((group) => {
        group.position.y = 0.88;
        group.rotation.set(0, 0, 0);
      });
    }
    this.options.onAutoRotateChange(false);
    this.controlsActiveUntil = performance.now() + (this.reducedMotion ? 80 : 300);
    this.updateLoopState();
  }

  public setDriveInput(input: DriveInput): void {
    if (this.disposed || this.mode !== "frontier" || (this.frontierStatus !== "countdown" && this.frontierStatus !== "running")) {
      return;
    }

    this.driveInput = input;
  }

  public clearDriveInput(): void {
    this.driveInput = EMPTY_DRIVE_INPUT;
    this.physics?.clearInput();
  }

  public setFrontierMode(mode: FrontierMode): void {
    if (this.disposed || this.mode !== "frontier" || this.frontierMode === mode) {
      return;
    }

    this.frontierMode = mode;
    this.clearDriveInput();
    this.frontierElapsedMilliseconds = 0;
    this.waystoneIds = [];
    this.resetWaystoneVisuals();
    this.physics?.resetToStart();
    this.frontierStatus = mode === "free-roam" ? "running" : "ready";
    this.countdownValue = 0;
    this.countdownElapsed = 0;
    this.options.onFrontierCountdownChange(null);
    this.options.onFrontierStatusChange(this.frontierStatus);
    this.syncRover(this.physics?.snapshot ?? null, 0);
    this.emitFrontierHud(true);
    this.updateLoopState();
  }

  public startWaystoneRun(): void {
    if (this.disposed || !this.renderer || this.mode !== "frontier" || this.frontierMode !== "waystone-run") {
      return;
    }

    this.physics?.resetToStart();
    this.clearDriveInput();
    this.waystoneIds = [];
    this.resetWaystoneVisuals();
    this.frontierElapsedMilliseconds = 0;
    this.countdownElapsed = 0;
    this.countdownValue = 3;
    this.frontierHudLastSentAt = 0;
    this.frontierStatus = "countdown";
    this.cameraInitialized = false;
    this.wheelSpinGroups.forEach((group) => group.rotation.set(0, 0, 0));
    this.syncRover(this.physics?.snapshot ?? null, 0);
    this.options.onFrontierCountdownChange(this.countdownValue);
    this.options.onFrontierStatusChange("countdown");
    this.emitFrontierHud(true);
    this.updateLoopState();
  }

  public pauseFrontier(): void {
    if (this.disposed || this.mode !== "frontier" || (this.frontierStatus !== "countdown" && this.frontierStatus !== "running")) {
      return;
    }

    this.frontierPausedFrom = this.frontierStatus;
    this.frontierStatus = "paused";
    this.driveInput = EMPTY_DRIVE_INPUT;
    this.physics?.stopVehicle();
    this.dustRoot.visible = false;
    this.options.onFrontierStatusChange("paused");
    this.options.onFrontierAnnouncement("PAUSED。再開操作が必要です。");
    this.controlsActiveUntil = performance.now() + 180;
    this.updateLoopState();
  }

  public resumeFrontier(): void {
    if (this.disposed || this.mode !== "frontier" || this.frontierStatus !== "paused") {
      return;
    }

    this.frontierStatus = this.frontierPausedFrom;
    this.options.onFrontierStatusChange(this.frontierStatus);
    if (this.frontierStatus === "countdown") {
      this.options.onFrontierCountdownChange(this.countdownValue);
    }
    this.updateLoopState();
  }

  public recoverFrontier(): void {
    if (this.disposed || this.mode !== "frontier" || (this.frontierStatus !== "running" && this.frontierStatus !== "paused") || !this.physics) {
      return;
    }

    this.clearDriveInput();
    this.physics.recoverToLastSafe();
    this.syncRover(this.physics.snapshot, 0);
    this.options.onFrontierAnnouncement("最後の安全地点へ復帰しました。速度と入力をリセットしました。");
    this.emitFrontierHud(true);
    this.controlsActiveUntil = performance.now() + 180;
    this.updateLoopState();
  }

  public restartWaystoneRun(): void {
    if (this.disposed || this.mode !== "frontier" || this.frontierMode !== "waystone-run" || this.frontierStatus === "running" || this.frontierStatus === "countdown") {
      return;
    }

    this.startWaystoneRun();
  }

  public zoomBy(direction: "in" | "out"): void {
    if (this.disposed || !this.controls || this.mode === "frontier") {
      return;
    }

    const offset = this.camera.position.clone().sub(this.controls.target);
    const currentDistance = offset.length();
    const nextDistance = THREE.MathUtils.clamp(
      currentDistance * (direction === "in" ? 0.82 : 1.22),
      this.controls.minDistance,
      this.controls.maxDistance,
    );
    offset.setLength(nextDistance);
    this.camera.position.copy(this.controls.target).add(offset);
    this.controls.update();
    this.updateLoopState();
  }

  public reset(): void {
    if (this.disposed || !this.controls || this.mode === "frontier") {
      return;
    }

    const viewport = this.getViewportSize();
    const cameraPreset = getCameraPreset("garage", viewport.width, viewport.height);
    this.camera.position.set(...cameraPreset.position);
    this.camera.fov = cameraPreset.fov;
    this.camera.updateProjectionMatrix();
    this.controls.target.set(...cameraPreset.target);
    this.controls.update();
    this.controls.autoRotate = false;
    this.options.onAutoRotateChange(false);
    this.controlsActiveUntil = performance.now() + 520;
    this.updateLoopState();
  }

  public dispose(): void {
    if (this.disposed) {
      return;
    }

    this.disposed = true;
    this.renderer?.setAnimationLoop(null);
    this.animationLoopActive = false;
    this.controls?.removeEventListener("change", this.handleControlsChange);
    this.controls?.dispose();
    this.resizeObserver?.disconnect();
    this.intersectionObserver?.disconnect();
    window.removeEventListener("resize", this.handleResize);
    window.removeEventListener("blur", this.handleWindowBlur);
    document.removeEventListener("visibilitychange", this.handleVisibility);
    disposeScene(this.scene);
    this.renderer?.dispose();
    if (this.renderer?.domElement.parentElement === this.container) {
      this.container.removeChild(this.renderer.domElement);
    }
    this.renderer = null;
    this.controls = null;
    this.disposeFrontierPhysics();
    this.moduleInstances.length = 0;
  }

  private readonly handleControlsChange = (): void => {
    this.controlsActiveUntil = performance.now() + 520;
    this.updateLoopState();
  };

  private buildLighting(): void {
    const hemisphere = new THREE.HemisphereLight(0xfff7e8, 0x445657, 1.85);
    const keyLight = new THREE.DirectionalLight(0xffdf9d, 3.2);
    keyLight.position.set(6, 9, 7);
    const fillLight = new THREE.DirectionalLight(0xb8dce1, 1.25);
    fillLight.position.set(-6, 5, -4);
    this.scene.add(hemisphere, keyLight, fillLight);
  }

  private buildGarage(): void {
    const garage = this.garageRoot;
    garage.name = "garage-set-dressing";
    addCylinder(garage, 5.5, 5.9, 0.18, 8, [0, 0.08, 0], COLORS.pad);
    addMesh(
      garage,
      new THREE.TorusGeometry(4.65, 0.055, 6, 8),
      createMaterial(COLORS.padLine),
      [0, 0.2, 0],
      [Math.PI / 2, 0, 0],
    );
    addBox(garage, [1.2, 0.7, 0.8], [-4.45, 0.52, -1.6], COLORS.crateDark, [0, 0.1, 0]);
    addBox(garage, [1, 0.62, 0.72], [-4.45, 1.18, -1.6], COLORS.crate, [0, -0.04, 0]);
    addBox(garage, [0.8, 0.45, 0.62], [4.2, 0.34, 1.65], COLORS.crate, [0, 0.18, 0]);
    addCylinder(garage, 0.25, 0.25, 0.7, 6, [4.25, 0.65, 1.65], COLORS.orange);
    addCylinder(garage, 0.22, 0.22, 0.55, 6, [-4.3, 0.38, 1.75], COLORS.orange);
    addCylinder(garage, 0.22, 0.22, 0.55, 6, [-4.8, 0.38, 1.9], COLORS.yellow);
    this.scene.add(garage);
  }

  private async ensureFrontier(): Promise<void> {
    if (this.physics || this.frontierLoading || this.disposed) {
      return;
    }

    this.frontierLoading = true;
    const token = ++this.frontierLoadToken;
    try {
      const rapier = await loadRapier();
      if (this.disposed || token !== this.frontierLoadToken) {
        return;
      }

      this.physics = new RoverPhysicsWorld(rapier);
      this.buildFrontier();
    } finally {
      this.frontierLoading = false;
    }
  }

  private disposeFrontierPhysics(): void {
    this.frontierLoadToken += 1;
    this.frontierLoading = false;
    this.physics?.dispose();
    this.physics = null;
    this.frontierRoot.visible = false;
    this.dustRoot.visible = false;
  }

  private buildFrontier(): void {
    const frontier = this.frontierRoot;
    if (frontier.children.length > 0) {
      frontier.visible = true;
      return;
    }
    frontier.name = "frontier-world-320x240";
    frontier.visible = true;

    const terrainMaterial = new THREE.MeshStandardMaterial({
      vertexColors: true,
      flatShading: true,
      roughness: 0.98,
      metalness: 0,
    });
    addMesh(frontier, createTerrainGeometry(), terrainMaterial);

    for (const area of FRONTIER_AREAS) {
      const ring = new THREE.Mesh(
        new THREE.RingGeometry(12, 12.35, 8),
        createMaterial(area.surface === "stone" ? 0x728b91 : area.surface === "loose-soil" ? 0xd39a64 : 0x5f9b79),
      );
      ring.position.set(area.center[0], getFrontierHeight(area.center[0], area.center[1]) + 0.08, area.center[1]);
      ring.rotation.x = -Math.PI / 2;
      frontier.add(ring);
    }

    for (const waystone of WAYSTONES) {
      const terrain = getFrontierHeight(waystone.x, waystone.z);
      const marker = new THREE.Group();
      marker.name = `waystone-${waystone.id}`;
      addCylinder(marker, 0.54, 0.66, 2.2, 6, [0, 1.1, 0], COLORS.bodyLight);
      addMesh(marker, new THREE.OctahedronGeometry(0.7, 0), createMaterial(COLORS.yellow, { metalness: 0.18 }), [0, 2.55, 0]);
      const ring = addMesh(marker, new THREE.TorusGeometry(2.8, 0.08, 6, 10), createMaterial(COLORS.orange), [0, 0.16, 0], [Math.PI / 2, 0, 0]);
      marker.position.set(waystone.x, terrain, waystone.z);
      frontier.add(marker);
      this.waystoneVisuals.set(waystone.id, { group: marker, ring });
    }

    for (const obstacle of [...CLIMBABLE_OBSTACLES, ...FIXED_OBSTACLES]) {
      const terrain = getFrontierHeight(obstacle.x, obstacle.z);
      const material = obstacle.kind === "pillar" || obstacle.kind === "ruin"
        ? createMaterial(0x728a91, { roughness: 1 })
        : createMaterial(obstacle.kind === "log" ? 0x8a5d43 : 0x9b896e, { roughness: 1 });
      if (obstacle.kind === "log") {
        addCylinder(frontier, obstacle.radius * 0.55, obstacle.radius * 0.65, obstacle.radius * 2.2, 7, [obstacle.x, terrain + obstacle.height * 0.55, obstacle.z], 0x8a5d43, [0, 0, Math.PI / 2]);
      } else {
        addMesh(frontier, new THREE.IcosahedronGeometry(obstacle.radius, 0), material, [obstacle.x, terrain + obstacle.height * 0.62, obstacle.z], [0.12, obstacle.x * 0.03, -0.08], [1, 0.72, 0.9]);
      }
    }

    for (const prop of DYNAMIC_PROPS) {
      const group = new THREE.Group();
      group.name = prop.id;
      if (prop.kind === "box") {
        addBox(group, [prop.radius * 1.5, prop.height, prop.radius * 1.5], [0, 0, 0], COLORS.crate, [0, 0.12, 0]);
        addBox(group, [prop.radius * 1.1, 0.12, prop.radius * 0.15], [0, prop.height * 0.52, 0], COLORS.yellow);
      } else if (prop.kind === "log") {
        addCylinder(group, prop.radius * 0.45, prop.radius * 0.5, prop.radius * 2, 7, [0, 0, 0], 0x8a5d43, [0, 0, Math.PI / 2]);
      } else {
        addMesh(group, new THREE.IcosahedronGeometry(prop.radius, 0), createMaterial(0xa48e76, { roughness: 1 }), [0, 0, 0], [0.12, 0.24, -0.08], [1, 0.75, 0.9]);
      }
      frontier.add(group);
      this.dynamicPropInstances.push({ bodyIndex: this.dynamicPropInstances.length, group });
    }

    for (const landmark of FRONTIER_LANDMARKS) {
      const group = new THREE.Group();
      group.name = landmark.id;
      const y = getFrontierHeight(landmark.x, landmark.z);
      if (landmark.kind === "camp") {
        addBox(group, [5.4, 0.18, 4.4], [0, 0.1, 0], COLORS.pad);
        addMesh(group, new THREE.ConeGeometry(3.1, 3.8, 4), createMaterial(0xd67b55), [0, 2.0, 0], [0, Math.PI / 4, 0]);
        addCylinder(group, 0.08, 0.08, 4.8, 6, [3.8, 2.4, 0], COLORS.frame);
        addBox(group, [1.2, 0.62, 0.08], [3.8, 4.3, 0], COLORS.yellow);
      } else if (landmark.kind === "spiral-tree") {
        addCylinder(group, 0.6, 0.85, 5.6, 7, [0, 2.8, 0], 0x75523f);
        addMesh(group, new THREE.SphereGeometry(2.9, 8, 5), createMaterial(0x4f9a79), [0, 6.2, 0], [0, 0, 0], [1.1, 1.3, 1.1]);
        addMesh(group, new THREE.TorusGeometry(2.2, 0.18, 5, 8), createMaterial(0xe0b34f), [0, 6.2, 0], [Math.PI / 2, 0, 0]);
      } else if (landmark.kind === "crystal") {
        for (const offset of [-2.1, 0, 2.1]) {
          addMesh(group, new THREE.ConeGeometry(0.9, 6.8 + Math.abs(offset), 6), createMaterial(0x7fc7d3, { metalness: 0.12, roughness: 0.32 }), [offset, 3.2, Math.abs(offset) * 0.45], [0.08, offset * 0.05, -0.08]);
        }
      } else if (landmark.kind === "wind-tower") {
        addCylinder(group, 0.42, 0.7, 7, 6, [0, 3.5, 0], 0x8b7a61);
        addBeam(group, [-3.5, 5.5, 0], [3.5, 5.5, 0], 0.12, COLORS.yellow);
        addBeam(group, [0, 5.5, -3.5], [0, 5.5, 3.5], 0.12, COLORS.orange);
      } else if (landmark.kind === "stonework") {
        addCylinder(group, 0.72, 0.9, 6.4, 6, [-2.8, 3.2, 0], 0x718791);
        addCylinder(group, 0.72, 0.9, 6.4, 6, [2.8, 3.2, 0], 0x718791);
        addBeam(group, [-2.8, 6.3, 0], [2.8, 6.3, 0], 0.34, 0x718791);
      } else {
        addBeam(group, [-4.5, 0.3, 0], [-2.5, 6.6, 0], 0.28, 0x8d7c88);
        addBeam(group, [4.5, 0.3, 0], [2.5, 6.6, 0], 0.28, 0x8d7c88);
        addBeam(group, [-2.5, 6.6, 0], [2.5, 6.6, 0], 0.32, 0x8d7c88);
      }
      group.position.set(landmark.x, y, landmark.z);
      group.scale.setScalar(landmark.scale);
      frontier.add(group);
    }

    if (this.dustParticles.length === 0) {
      for (let index = 0; index < 8; index += 1) {
        const particle = addMesh(
          this.dustRoot,
          new THREE.SphereGeometry(0.16 + (index % 3) * 0.05, 6, 4),
          new THREE.MeshStandardMaterial({ color: 0xf1d3a2, flatShading: true, transparent: true, opacity: 0.26, depthWrite: false }),
        );
        particle.visible = false;
        this.dustParticles.push(particle);
      }
    }
    this.scene.add(frontier);
  }

  private buildFixedChassis(): void {
    const chassis = new THREE.Group();
    chassis.name = "fixed-chassis";
    addBox(chassis, [4.5, 0.42, 2.18], [0, 1.35, 0], COLORS.frame);
    addMesh(
      chassis,
      new THREE.SphereGeometry(1, 10, 6),
      createMaterial(COLORS.body),
      [0, 1.67, 0],
      [0, 0, 0],
      [2.2, 0.68, 1.12],
    );
    addBox(chassis, [3.45, 0.18, 1.68], [0, 2.08, 0], COLORS.bodyLight, [0, 0.03, 0]);
    addBox(chassis, [2.5, 0.12, 1.42], [0.2, 2.2, 0], COLORS.yellow, [0, -0.02, 0]);
    addBeam(chassis, [-2.05, 1.2, -1.02], [2.05, 1.2, -1.02], 0.1, COLORS.pipe);
    addBeam(chassis, [-2.05, 1.2, 1.02], [2.05, 1.2, 1.02], 0.1, COLORS.pipe);
    addBeam(chassis, [-2.1, 1.2, -1.02], [-2.1, 1.65, -0.3], 0.085, COLORS.pipe);
    addBeam(chassis, [2.1, 1.2, 1.02], [2.1, 1.65, 0.3], 0.085, COLORS.pipe);

    for (const z of [-1.42, 1.42]) {
      addCylinder(chassis, 0.13, 0.13, 4.55, 6, [0, 0.95, z], COLORS.darkMetal, [0, 0, Math.PI / 2]);
      for (const x of [-1, 1]) {
        const suspensionX = x * 1.96;
        addBeam(chassis, [x * 1.05, 1.18, z], [suspensionX, 0.83, z], 0.1, COLORS.metal);
        addBeam(chassis, [x * 1.25, 1.3, z + x * 0.12], [suspensionX, 0.92, z - x * 0.12], 0.07, COLORS.pipe);
      }
    }

    addBox(chassis, [0.42, 0.14, 1.35], [-2.45, 1.02, 0], COLORS.hub);
    addBox(chassis, [0.42, 0.14, 1.35], [2.45, 1.02, 0], COLORS.hub);
    for (const x of [-1.65, -0.55, 0.55, 1.65]) {
      addMesh(chassis, new THREE.SphereGeometry(0.09, 6, 4), createMaterial(COLORS.yellow), [x, 2.13, 0.82]);
    }
    addBox(chassis, [0.2, 0.7, 0.2], [-1.55, 2.28, -0.78], COLORS.orange, [0.12, 0.05, -0.06]);
    addBox(chassis, [0.2, 0.48, 0.2], [1.45, 2.2, -0.78], COLORS.pipe, [-0.16, -0.04, 0.08]);
    this.buildWheels(chassis);
    this.roverGroup.add(chassis);
  }

  private buildWheels(parent: THREE.Group): void {
    for (const wheel of WHEEL_CONFIGS) {
      const wheelSpinGroup = new THREE.Group();
      wheelSpinGroup.position.set(wheel.x, 0.88, wheel.z);
      const tire = addMesh(
        wheelSpinGroup,
        new THREE.CylinderGeometry(WHEEL_RADIUS, WHEEL_RADIUS, 0.48, 12),
        createMaterial(COLORS.rubber, { roughness: 0.95 }),
        [0, 0, 0],
        [0, 0, Math.PI / 2],
      );
      tire.scale.set(1, 1, 0.92);
      addCylinder(
        wheelSpinGroup,
        0.34,
        0.34,
        0.52,
        10,
        [0, 0, 0],
        COLORS.hub,
        [0, 0, Math.PI / 2],
      );
      addCylinder(
        wheelSpinGroup,
        0.13,
        0.13,
        0.56,
        8,
        [0, 0, 0],
        COLORS.darkMetal,
        [0, 0, Math.PI / 2],
      );
      parent.add(wheelSpinGroup);
      this.wheelSpinGroups.push(wheelSpinGroup);
    }
  }

  private buildInitialModules(): void {
    const categories: readonly ModuleCategory[] = ["front", "cabin", "rear"];
    for (const category of categories) {
      const definition = getModuleDefinition(category, this.selection[category]);
      if (!definition) {
        continue;
      }

      const built = this.createModule(definition);
      const instance: ModuleInstance = {
        category,
        definition,
        group: built.group,
        turbineRotor: built.turbineRotor,
        mode: "enter",
        progress: 1,
        target: 1,
      };
      this.moduleInstances.push(instance);
      this.moduleRoot.add(instance.group);
      this.applyModuleTransform(instance);
    }
  }

  private createModule(definition: RoverModuleDefinition): ModuleBuildResult {
    const group = new THREE.Group();
    group.name = `${definition.category}-${definition.id}`;
    let turbineRotor: THREE.Group | null = null;

    if (definition.category === "front") {
      this.buildFrontModule(group, definition.id);
    } else if (definition.category === "cabin") {
      this.buildCabinModule(group, definition.id);
    } else {
      turbineRotor = this.buildRearModule(group, definition.id);
    }

    return { group, turbineRotor };
  }

  private buildFrontModule(group: THREE.Group, id: RoverModuleDefinition["id"]): void {
    if (id === "twin-lamp") {
      addBox(group, [3.65, 0.35, 0.42], [0, 0.02, 0.38], COLORS.orange);
      addBox(group, [0.85, 0.3, 0.16], [0, -0.1, 0.6], COLORS.darkMetal);
      for (const x of [-1.18, 1.18]) {
        addMesh(
          group,
          new THREE.SphereGeometry(0.34, 8, 6),
          createMaterial(COLORS.light, { roughness: 0.34 }),
          [x, 0.28, 0.5],
        );
        addCylinder(group, 0.42, 0.42, 0.12, 8, [x, 0.28, 0.35], COLORS.darkMetal, [Math.PI / 2, 0, 0]);
      }
      return;
    }

    if (id === "drill-nose") {
      addBox(group, [3.35, 0.26, 0.32], [0, -0.04, 0.22], COLORS.frame);
      addMesh(
        group,
        new THREE.TorusGeometry(0.86, 0.13, 6, 8),
        createMaterial(COLORS.metal, { metalness: 0.35 }),
        [0, 0.22, 0.42],
      );
      addMesh(
        group,
        new THREE.ConeGeometry(0.72, 1.35, 8),
        createMaterial(COLORS.yellow, { metalness: 0.18 }),
        [0, 0.22, 0.78],
        [Math.PI / 2, 0, 0],
      );
      for (const x of [-1.15, 1.15]) {
        addMesh(group, new THREE.SphereGeometry(0.28, 8, 6), createMaterial(COLORS.light), [x, 0.22, 0.46]);
      }
      return;
    }

    if (id === "utility-winch") {
      addBox(group, [3.85, 0.42, 0.38], [0, -0.04, 0.42], COLORS.orange);
      addBox(group, [3.2, 0.16, 0.62], [0, -0.24, 0.62], COLORS.frame);
      addCylinder(group, 0.55, 0.55, 1.65, 10, [0, 0.34, 0.72], COLORS.pipe, [0, 0, Math.PI / 2]);
      addCylinder(group, 0.7, 0.7, 0.12, 10, [-0.86, 0.34, 0.72], COLORS.yellow, [0, 0, Math.PI / 2]);
      addCylinder(group, 0.7, 0.7, 0.12, 10, [0.86, 0.34, 0.72], COLORS.yellow, [0, 0, Math.PI / 2]);
      addBeam(group, [0, 0.28, 1.02], [0, 0.28, 1.48], 0.1, COLORS.darkMetal);
      addMesh(group, new THREE.TorusGeometry(0.22, 0.07, 5, 8), createMaterial(COLORS.metal), [0, 0.24, 1.55], [Math.PI / 2, 0, 0]);
      addMesh(group, new THREE.SphereGeometry(0.38, 8, 5), createMaterial(COLORS.light, { roughness: 0.34 }), [-1.22, 0.3, 0.66]);
      addMesh(group, new THREE.SphereGeometry(0.25, 8, 5), createMaterial(COLORS.light, { roughness: 0.34 }), [1.16, 0.17, 0.7]);
      for (const x of [-1.35, -0.45, 0.45, 1.35]) {
        addMesh(group, new THREE.SphereGeometry(0.08, 6, 4), createMaterial(COLORS.yellow), [x, 0.2, 0.36]);
      }
      return;
    }

    addCylinder(group, 0.78, 0.88, 0.22, 8, [0, -0.03, 0.28], COLORS.darkMetal);
    addMesh(
      group,
      new THREE.SphereGeometry(0.74, 8, 5, 0, Math.PI * 2, 0, Math.PI / 2),
      createMaterial(COLORS.glass, { roughness: 0.42 }),
      [0, 0.22, 0.28],
    );
    addMesh(group, new THREE.SphereGeometry(0.26, 8, 6), createMaterial(COLORS.light), [-1.12, 0.2, 0.45]);
    addMesh(group, new THREE.SphereGeometry(0.2, 8, 6), createMaterial(COLORS.light), [1.02, 0.06, 0.5]);
    addCylinder(group, 0.11, 0.15, 1.2, 6, [0.62, 0.86, 0.18], COLORS.pipe);
    addMesh(group, new THREE.SphereGeometry(0.16, 6, 4), createMaterial(COLORS.orange), [0.62, 1.48, 0.18]);
  }

  private buildCabinModule(group: THREE.Group, id: RoverModuleDefinition["id"]): void {
    if (id === "bubble-canopy") {
      addBox(group, [1.3, 0.16, 1.3], [0, -0.48, 0], COLORS.darkMetal);
      addBox(group, [0.62, 0.68, 0.62], [0, -0.12, -0.1], COLORS.navy);
      addBox(group, [0.78, 0.1, 0.52], [0, 0.15, 0.14], COLORS.orange);
      addMesh(
        group,
        new THREE.SphereGeometry(1.15, 10, 6, 0, Math.PI * 2, 0, Math.PI * 0.62),
        createMaterial(COLORS.glass, { roughness: 0.4 }),
        [0, 0.2, 0],
        [0, 0, 0],
        [1.26, 0.82, 1.08],
      );
      return;
    }

    if (id === "armored-cab") {
      addBox(group, [2.65, 1.38, 2.08], [0, 0.12, 0], COLORS.body);
      addBox(group, [2.2, 0.18, 1.86], [0, 0.87, 0], COLORS.frame);
      addBox(group, [0.07, 0.42, 1.08], [-1.36, 0.34, 0], COLORS.window);
      addBox(group, [0.07, 0.42, 1.08], [1.36, 0.34, 0], COLORS.window);
      addBox(group, [1.7, 0.42, 0.07], [0, 0.34, 1.06], COLORS.window);
      addCylinder(group, 0.24, 0.24, 0.38, 6, [0, 1.08, -0.12], COLORS.metal);
      addCylinder(group, 0.12, 0.12, 0.16, 6, [0, 1.32, -0.12], COLORS.yellow);
      return;
    }

    if (id === "offset-capsule") {
      addBox(group, [1.45, 0.18, 1.55], [0, -0.5, 0], COLORS.darkMetal);
      addMesh(
        group,
        new THREE.SphereGeometry(1.18, 10, 6, 0, Math.PI * 2, 0, Math.PI * 0.64),
        createMaterial(COLORS.bodyLight, { roughness: 0.42 }),
        [-0.48, 0.18, 0],
        [0, 0, 0],
        [1.12, 0.92, 1.08],
      );
      addMesh(group, new THREE.SphereGeometry(0.48, 8, 5), createMaterial(COLORS.window, { roughness: 0.38 }), [-0.48, 0.24, 0.98]);
      addCylinder(group, 0.42, 0.5, 0.28, 8, [0.9, 0.14, -0.16], COLORS.metal);
      addCylinder(group, 0.25, 0.25, 0.2, 8, [0.9, 0.38, -0.16], COLORS.yellow);
      addBeam(group, [-1.22, -0.35, -0.76], [-1.22, 1.0, -0.72], 0.15, COLORS.pipe);
      addBeam(group, [0.55, -0.38, -0.82], [0.62, 0.94, -0.76], 0.15, COLORS.pipe);
      addBox(group, [0.45, 0.12, 0.72], [0.92, 0.58, 0.18], COLORS.orange, [0, 0.16, 0]);
      return;
    }

    addBox(group, [1.35, 0.18, 1.45], [0, -0.46, 0], COLORS.darkMetal);
    addBox(group, [0.72, 0.7, 0.7], [0, -0.05, -0.12], COLORS.navy);
    addBox(group, [0.9, 0.12, 0.58], [0, 0.3, 0.08], COLORS.orange);
    addBeam(group, [-1.05, -0.38, -0.72], [-1.05, 1.12, -0.62], 0.14, COLORS.pipe);
    addBeam(group, [1.05, -0.38, -0.72], [1.05, 1.12, -0.62], 0.14, COLORS.pipe);
    addBeam(group, [-1.05, 1.12, -0.62], [1.05, 1.12, -0.62], 0.14, COLORS.pipe);
    addCylinder(group, 0.08, 0.11, 0.58, 6, [0.55, 0.18, 0.34], COLORS.yellow, [0, 0, 0.18]);
    addMesh(group, new THREE.SphereGeometry(0.13, 6, 4), createMaterial(COLORS.orange), [0.62, 0.47, 0.32]);
  }

  private buildRearModule(group: THREE.Group, id: RoverModuleDefinition["id"]): THREE.Group | null {
    if (id === "cargo-rack") {
      addBox(group, [2.85, 0.22, 1.8], [0, -0.42, 0], COLORS.darkMetal);
      addBox(group, [0.85, 0.85, 0.88], [-0.68, 0.12, 0.04], COLORS.crate);
      addBox(group, [0.82, 0.72, 0.78], [0.68, 0.08, 0.04], COLORS.crateDark);
      addBeam(group, [-1.3, -0.25, -0.72], [-1.3, 0.86, -0.72], 0.12, COLORS.pipe);
      addBeam(group, [1.3, -0.25, -0.72], [1.3, 0.86, -0.72], 0.12, COLORS.pipe);
      addBeam(group, [-1.3, 0.86, -0.72], [1.3, 0.86, -0.72], 0.12, COLORS.pipe);
      addBox(group, [0.16, 0.98, 1.88], [-1.05, 0.2, 0], COLORS.yellow);
      addBox(group, [0.16, 0.92, 1.88], [1.05, 0.17, 0], COLORS.yellow);
      return null;
    }

    if (id === "turbine-pack") {
      addBox(group, [2.5, 0.35, 1.8], [0, -0.28, 0], COLORS.frame);
      addCylinder(group, 0.86, 0.86, 0.48, 10, [0, 0.18, 0.04], COLORS.metal, [Math.PI / 2, 0, 0]);
      addMesh(
        group,
        new THREE.TorusGeometry(0.68, 0.1, 6, 10),
        createMaterial(COLORS.orange, { metalness: 0.2 }),
        [0, 0.18, 0.31],
        [Math.PI / 2, 0, 0],
      );
      const rotor = new THREE.Group();
      rotor.position.set(0, 0.18, 0.38);
      addCylinder(rotor, 0.16, 0.16, 0.18, 8, [0, 0, 0], COLORS.darkMetal, [Math.PI / 2, 0, 0]);
      for (const rotation of [0, Math.PI / 3, (Math.PI * 2) / 3]) {
        addBox(rotor, [0.12, 0.65, 0.08], [0, 0.3, 0], COLORS.yellow, [0, 0, rotation]);
      }
      group.add(rotor);
      addBeam(group, [-0.9, 0.1, -0.25], [-1.42, 0.1, -0.74], 0.16, COLORS.pipe);
      addBeam(group, [0.9, 0.1, -0.25], [1.42, 0.1, -0.74], 0.16, COLORS.pipe);
      addBox(group, [0.16, 0.9, 0.38], [-1.08, 0.16, 0.22], COLORS.bodyLight, [0.1, 0, 0.08]);
      addBox(group, [0.16, 0.9, 0.38], [1.08, 0.16, 0.22], COLORS.bodyLight, [-0.1, 0, -0.08]);
      return rotor;
    }

    if (id === "coil-generator") {
      addBox(group, [2.65, 0.36, 1.78], [0, -0.3, 0], COLORS.frame);
      addBox(group, [0.82, 0.74, 0.78], [0, 0.22, 0.08], COLORS.bodyLight);
      addBox(group, [0.42, 0.52, 0.62], [0, 0.42, 0.08], COLORS.yellow);
      for (const [x, y, radius] of [[-0.78, 0.18, 0.62], [0.78, 0.34, 0.72]] as const) {
        addCylinder(group, radius, radius, 0.72, 10, [x, y, 0.02], COLORS.metal, [Math.PI / 2, 0, 0]);
        addMesh(group, new THREE.TorusGeometry(radius * 0.82, 0.08, 5, 10), createMaterial(COLORS.orange), [x, y, 0.42], [Math.PI / 2, 0, 0]);
      }
      addBeam(group, [-0.62, 0.16, 0.38], [-0.2, 0.44, 0.62], 0.11, COLORS.pipe);
      addBeam(group, [0.64, 0.34, 0.38], [0.2, 0.48, 0.62], 0.11, COLORS.pipe);
      addCylinder(group, 0.2, 0.24, 0.7, 6, [1.15, 0.5, -0.48], COLORS.darkMetal);
      addCylinder(group, 0.28, 0.28, 0.12, 6, [1.15, 0.86, -0.48], COLORS.orange);
      return null;
    }

    addCylinder(group, 0.66, 0.66, 2.1, 10, [0, 0.18, 0], COLORS.metal, [0, 0, Math.PI / 2]);
    addCylinder(group, 0.5, 0.5, 0.14, 10, [0, 0.18, 1.08], COLORS.darkMetal, [0, 0, Math.PI / 2]);
    addBox(group, [0.55, 0.82, 0.72], [1.02, 0.03, 0], COLORS.crateDark);
    addBox(group, [0.12, 0.48, 0.86], [1.34, 0.03, 0], COLORS.yellow);
    addBeam(group, [0.82, 0.48, 0.35], [1.48, 0.76, 0.62], 0.1, COLORS.pipe);
    addBeam(group, [0.82, 0.48, -0.35], [1.48, 0.76, -0.62], 0.1, COLORS.pipe);
    return null;
  }

  private applyModuleTransform(instance: ModuleInstance): void {
    const transform = getModuleTransitionTransform(
      instance.definition,
      instance.progress,
      instance.mode,
    );
    instance.group.position.set(...transform.position);
    instance.group.rotation.set(...instance.definition.mountRotation);
    instance.group.scale.set(...transform.scale);
  }

  private updateModuleTransitions(deltaSeconds: number): void {
    const step = deltaSeconds === 0
      ? 0
      : Math.min(1, deltaSeconds * 1000 / getModuleTransitionDuration(this.reducedMotion));
    for (const instance of [...this.moduleInstances]) {
      if (instance.target === 1) {
        instance.progress = Math.min(1, instance.progress + step);
      } else {
        instance.progress = Math.max(0, instance.progress - step);
      }
      this.applyModuleTransform(instance);
      if (instance.target === 0 && instance.progress <= 0) {
        this.removeModuleInstance(instance);
      }
    }
  }

  private removeModuleInstance(instance: ModuleInstance): void {
    const index = this.moduleInstances.indexOf(instance);
    if (index < 0) {
      return;
    }

    this.moduleInstances.splice(index, 1);
    this.moduleRoot.remove(instance.group);
    disposeObject(instance.group);
  }

  private renderFrame(time: number): void {
    if (this.disposed || !this.renderer || !this.controls) {
      return;
    }

    const safeTime = Number.isFinite(time) ? time : performance.now();
    const deltaSeconds = this.lastTime === 0
      ? 0
      : clampDeltaSeconds((safeTime - this.lastTime) / 1000);
    this.lastTime = safeTime;
    this.updateModuleTransitions(deltaSeconds);

    if (this.mode === "frontier" && this.physics) {
      if (this.frontierStatus === "countdown") {
      this.countdownElapsed += deltaSeconds * 1000;
      const nextCountdown = this.countdownElapsed >= 3000
        ? 0
        : Math.max(1, 3 - Math.floor(this.countdownElapsed / 1000));
      if (nextCountdown !== this.countdownValue) {
        this.countdownValue = nextCountdown;
        this.options.onFrontierCountdownChange(nextCountdown > 0 ? nextCountdown : null);
      }
      if (this.countdownElapsed >= 3000) {
        this.frontierStatus = "running";
        this.frontierElapsedMilliseconds = 0;
        this.options.onFrontierCountdownChange(0);
        this.options.onFrontierStatusChange("running");
        this.emitFrontierHud(true);
      }
    }

      const physicsActive = this.frontierStatus === "running";
      const snapshot = physicsActive
        ? this.physics.advance(deltaSeconds, this.driveInput)
        : this.physics.snapshot;
      if (physicsActive) {
        this.trackExploredArea(snapshot);
      }
      if (physicsActive && this.frontierMode === "waystone-run") {
        this.frontierElapsedMilliseconds += deltaSeconds * 1000;
        this.checkWaystones(snapshot);
      }
      this.syncRover(snapshot, deltaSeconds);
      this.updateFrontierCamera(deltaSeconds);
      this.updateDynamicProps();
      this.updateDust(snapshot, safeTime);
      if (safeTime - this.frontierHudLastSentAt >= 100) {
        this.emitFrontierHud();
      }
    } else {
      this.dustRoot.visible = false;
    }

    if (this.mode === "garage") {
      this.controls.update();
    }
    this.renderer.render(this.scene, this.camera);

    if (!this.shouldAnimate(safeTime)) {
      this.renderer.setAnimationLoop(null);
      this.animationLoopActive = false;
    }
  }

  private syncRover(snapshot: PhysicsSnapshot | null, deltaSeconds: number): void {
    if (!snapshot) {
      return;
    }
    const visualOriginY = 1.35;
    this.roverGroup.position.set(snapshot.x, snapshot.y - visualOriginY, snapshot.z);
    this.roverGroup.quaternion.set(snapshot.rotation.x, snapshot.rotation.y, snapshot.rotation.z, snapshot.rotation.w);
    for (const [index, group] of this.wheelSpinGroups.entries()) {
      const suspensionLength = snapshot.wheelSuspensionLengths[index] ?? VEHICLE_CONFIG.suspensionRestLength;
      const suspensionDelta = Number.isFinite(suspensionLength) ? suspensionLength - VEHICLE_CONFIG.suspensionRestLength : 0;
      group.position.y = 0.88 - suspensionDelta;
      group.rotation.x = snapshot.wheelRotations[index] ?? 0;
    }
    for (const instance of this.moduleInstances) {
      if (instance.definition.id !== "turbine-pack" || instance.target !== 1 || !instance.turbineRotor) {
        continue;
      }
      const turbineMotion = Math.min(1, Math.abs(snapshot.speed) / 5) * Math.max(0, deltaSeconds) * 2.4;
      instance.turbineRotor.rotation.z += this.driveInput.throttle === 1 && this.frontierStatus === "running" ? turbineMotion : turbineMotion * 0.12;
    }
  }

  private updateDust(state: PhysicsSnapshot, time: number): void {
    const active = this.mode === "frontier"
      && this.frontierStatus === "running"
      && !this.reducedMotion
      && this.driveInput.throttle === 1
      && Math.abs(state.speed) > 1.1;
    this.dustRoot.visible = active;
    if (!active) {
      this.dustParticles.forEach((particle) => {
        particle.visible = false;
      });
      return;
    }

    const intensity = Math.min(1, Math.abs(state.speed) / 8) * (state.surface === "loose-soil" ? 1.08 : 0.78);
    this.dustParticles.forEach((particle, index) => {
      const phase = time * 0.004 * (1 + (index % 3) * 0.12) + index * 0.73;
      const localX = -0.4 - index * 0.1 + Math.sin(phase) * 0.12;
      const localZ = -0.62 - (index % 3) * 0.14;
      const height = 0.22 + (index % 4) * 0.12 + Math.abs(Math.sin(phase)) * 0.18;
      particle.position.set(localX, height, localZ);
      particle.rotation.y = phase * 0.08;
      const scale = 0.45 + intensity * (0.45 + (index % 3) * 0.12);
      particle.scale.setScalar(scale);
      particle.visible = true;
    });
  }

  private checkWaystones(snapshot: PhysicsSnapshot): void {
    if (this.frontierMode !== "waystone-run" || this.frontierStatus !== "running") {
      return;
    }
    for (const waystone of WAYSTONES) {
      if (this.waystoneIds.includes(waystone.id)) {
        continue;
      }
      if (Math.hypot(snapshot.x - waystone.x, snapshot.z - waystone.z) > waystone.radius) {
        continue;
      }
      this.waystoneIds = [...this.waystoneIds, waystone.id];
      this.markWaystoneVisual(waystone.id);
      this.options.onFrontierWaystone(waystone.id, waystone.label);
      this.options.onFrontierAnnouncement(`${waystone.label} Waystoneを起動しました。`);
      if (this.waystoneIds.length >= WAYSTONES.length) {
        this.finishWaystoneRun();
      }
      break;
    }
  }

  private finishWaystoneRun(): void {
    this.frontierStatus = "clear";
    this.driveInput = EMPTY_DRIVE_INPUT;
    this.physics?.stopVehicle();
    this.dustRoot.visible = false;
    this.options.onFrontierStatusChange("clear");
    this.options.onFrontierComplete(this.frontierElapsedMilliseconds);
    this.options.onFrontierAnnouncement(`WAYSTONE RUN COMPLETE。タイム ${this.frontierElapsedMilliseconds.toFixed(0)}ms`);
    this.emitFrontierHud(true);
    this.options.onAutoRotateChange(false);
    this.controlsActiveUntil = performance.now() + 420;
  }

  private trackExploredArea(snapshot: PhysicsSnapshot): void {
    const areaId = getFrontierArea(snapshot.x, snapshot.z).id;
    if (this.exploredAreaIds.includes(areaId)) {
      return;
    }
    this.exploredAreaIds = [...this.exploredAreaIds, areaId];
  }

  private resetWaystoneVisuals(): void {
    for (const visual of this.waystoneVisuals.values()) {
      visual.group.scale.setScalar(1);
      visual.ring.scale.setScalar(1);
      visual.ring.visible = true;
    }
  }

  private markWaystoneVisual(id: string): void {
    const visual = this.waystoneVisuals.get(id);
    if (!visual) {
      return;
    }
    visual.group.scale.setScalar(0.78);
    visual.ring.scale.setScalar(0.52);
    visual.ring.visible = false;
  }

  private emitFrontierHud(force = false): void {
    const time = performance.now();
    if (!force && time - this.frontierHudLastSentAt < 100) {
      return;
    }
    this.frontierHudLastSentAt = Number.isFinite(time) ? time : 0;
    const snapshot = this.physics?.snapshot;
    if (!snapshot) {
      return;
    }
    const remainingWaystones = WAYSTONES.filter((waystone) => !this.waystoneIds.includes(waystone.id));
    const nextWaystoneDistance = remainingWaystones.length === 0
      ? null
      : Math.min(...remainingWaystones.map((waystone) => Math.hypot(snapshot.x - waystone.x, snapshot.z - waystone.z)));
    this.options.onFrontierHudChange({
      mode: this.frontierMode,
      status: this.frontierStatus,
      areaLabel: snapshot.areaLabel,
      surface: snapshot.surface.toUpperCase(),
      speed: Math.abs(snapshot.speed),
      groundedWheels: snapshot.groundedWheels,
      traction: snapshot.traction,
      visitedAreas: this.frontierMode === "free-roam" ? this.exploredAreaIds.length : getVisitedAreaCount(this.waystoneIds, WAYSTONES),
      visitedAreaIds: this.exploredAreaIds,
      waystoneCount: this.waystoneIds.length,
      visitedWaystoneIds: this.waystoneIds,
      nextWaystoneDistance: Number.isFinite(nextWaystoneDistance) ? nextWaystoneDistance : null,
      elapsedMilliseconds: Math.max(0, Number.isFinite(this.frontierElapsedMilliseconds) ? this.frontierElapsedMilliseconds : 0),
      x: snapshot.x,
      z: snapshot.z,
      heading: snapshot.heading,
      recoveryReady: snapshot.recoveryReady,
      rolloverSeconds: snapshot.rolloverSeconds,
    });
  }

  private updateFrontierCamera(deltaSeconds: number): void {
    const snapshot = this.physics?.snapshot;
    if (!snapshot) {
      return;
    }
    const viewport = this.getViewportSize();
    const mobile = viewport.width < 700 || viewport.width / Math.max(1, viewport.height) < 0.78;
    const forwardX = Math.sin(snapshot.heading);
    const forwardZ = Math.cos(snapshot.heading);
    const desiredPosition = this.reducedMotion
      ? new THREE.Vector3(0, 146, 168)
      : new THREE.Vector3(
        snapshot.x - forwardX * (mobile ? 20 : 30) + forwardZ * (mobile ? 5 : 8),
        snapshot.y + (mobile ? 17 : 24),
        snapshot.z - forwardZ * (mobile ? 20 : 30) - forwardX * (mobile ? 5 : 8),
      );
    const desiredTarget = this.reducedMotion
      ? new THREE.Vector3(0, 0, 0)
      : new THREE.Vector3(snapshot.x + forwardX * 11, snapshot.y - 0.45, snapshot.z + forwardZ * 11);
    const blend = !this.cameraInitialized
      ? 1
      : 1 - Math.exp(-Math.max(0, clampDeltaSeconds(deltaSeconds)) * (this.reducedMotion ? 1.2 : 3.4));
    this.camera.position.lerp(desiredPosition, blend);
    this.controls?.target.lerp(desiredTarget, blend);
    this.camera.lookAt(this.controls?.target ?? desiredTarget);
    this.cameraInitialized = true;
  }

  private updateDynamicProps(): void {
    const snapshots = this.physics?.getDynamicPropSnapshots() ?? [];
    for (const instance of this.dynamicPropInstances) {
      const snapshot = snapshots[instance.bodyIndex];
      if (!snapshot) {
        continue;
      }
      instance.group.position.set(snapshot.x, snapshot.y, snapshot.z);
      instance.group.quaternion.set(snapshot.rotation.x, snapshot.rotation.y, snapshot.rotation.z, snapshot.rotation.w);
    }
  }

  private isFrontierActive(): boolean {
    return this.mode === "frontier" && (this.frontierStatus === "countdown" || this.frontierStatus === "running");
  }

  private resize(): void {
    if (this.disposed || !this.renderer) {
      return;
    }

    const viewport = this.getViewportSize();
    this.camera.aspect = viewport.width / viewport.height;
    this.camera.updateProjectionMatrix();
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
    this.renderer.setSize(viewport.width, viewport.height, false);
    this.controlsActiveUntil = performance.now() + 320;
    this.updateLoopState();
  }

  private updateLoopState(): void {
    if (this.disposed || !this.renderer) {
      return;
    }

    const active = this.pageVisible && this.inViewport;
    if (!active) {
      if (this.animationLoopActive) {
        this.renderer.setAnimationLoop(null);
        this.animationLoopActive = false;
      }
      return;
    }

    if (this.shouldAnimate(performance.now()) && !this.animationLoopActive) {
      this.lastTime = 0;
      this.renderer.setAnimationLoop(this.render);
      this.animationLoopActive = true;
    } else if (!this.shouldAnimate(performance.now()) && this.animationLoopActive) {
      this.renderer.setAnimationLoop(null);
      this.animationLoopActive = false;
    }
  }

  private shouldAnimate(time: number): boolean {
    return Boolean(
      (this.mode === "garage" && this.controls?.autoRotate)
      || this.isFrontierActive()
      || this.moduleInstances.some((instance) => instance.target !== instance.progress)
      || time < this.controlsActiveUntil,
    );
  }

  private getViewportSize(): { width: number; height: number } {
    const rect = this.container.getBoundingClientRect();
    return {
      width: Math.max(1, Math.floor(rect.width)),
      height: Math.max(1, Math.floor(rect.height)),
    };
  }

  private hasWebGpuApi(): boolean {
    return typeof navigator !== "undefined" && "gpu" in navigator;
  }
}
