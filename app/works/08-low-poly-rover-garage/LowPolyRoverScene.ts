import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { WebGPURenderer } from "three/webgpu";

import { getSemanticAxes, type DriveInput } from "./driveModel";
import {
  getCameraPreset,
  getModuleDefinition,
  getYardCameraPreset,
  INITIAL_SELECTION,
  normalizeSelection,
  type ModuleVisual,
  type RoverModuleDefinition,
  type RoverSelection,
  type Vector3Tuple,
} from "./roverModel";
import {
  getShapeVertices,
  YARD_OBJECTS,
  type YardObjectDefinition,
  type YardShape,
} from "./testYard";
import {
  loadRapier,
  RoverPhysicsWorld,
  type DynamicPropSnapshot,
  type RoverPhysicsSnapshot,
} from "./RoverPhysicsWorld";
import { VEHICLE_CONFIG, WHEEL_CONFIGS } from "./vehicleConfig";

export type ExperienceMode = "garage" | "yard";
export type RoverStatus = "DRIVING" | "PAUSED" | "RECOVER";

export type RoverHud = {
  readonly speed: number;
  readonly groundedWheels: number;
  readonly surface: string;
  readonly zoneLabel: string;
  readonly status: RoverStatus;
  readonly airborne: boolean;
  readonly insideBounds: boolean;
};

export type LowPolyRoverSceneOptions = {
  readonly reducedMotion: boolean;
  readonly selection: RoverSelection;
  readonly onHudChange: (hud: RoverHud) => void;
  readonly onAutoRotateChange: (enabled: boolean) => void;
};

export type LowPolyRoverSceneInitResult = {
  readonly webGpuApiAvailable: boolean;
};

type WheelVisual = {
  readonly group: THREE.Group;
};

const COLORS = {
  background: 0xe6e2d5,
  body: 0x294f55,
  bodyLight: 0x6c9b99,
  dark: 0x192c31,
  rubber: 0x1d2527,
  metal: 0xbcc2b1,
  glass: 0x9bd5d1,
  orange: 0xe4773e,
  yellow: 0xf2c65b,
  wood: 0x916044,
  rock: 0x7d8078,
  crate: 0xc8894f,
  ramp: 0xb9824f,
  fence: 0x3c5854,
  ground: 0x708a79,
  pad: 0x3a6e6d,
} as const;

const ZERO: Vector3Tuple = [0, 0, 0];
const UP = new THREE.Vector3(0, 1, 0);

function createMaterial(
  color: number,
  options: { readonly roughness?: number; readonly metalness?: number; readonly transparent?: boolean; readonly opacity?: number } = {},
): THREE.MeshStandardMaterial {
  return new THREE.MeshStandardMaterial({
    color,
    flatShading: true,
    roughness: options.roughness ?? 0.84,
    metalness: options.metalness ?? 0.05,
    transparent: options.transparent ?? false,
    opacity: options.opacity ?? 1,
  });
}

function addMesh(
  parent: THREE.Object3D,
  geometry: THREE.BufferGeometry,
  material: THREE.Material,
  position: Vector3Tuple = ZERO,
  rotation: Vector3Tuple = ZERO,
  scale: Vector3Tuple = [1, 1, 1],
): THREE.Mesh {
  const mesh = new THREE.Mesh(geometry, material);
  mesh.position.set(...position);
  mesh.rotation.set(...rotation);
  mesh.scale.set(...scale);
  parent.add(mesh);
  return mesh;
}

function addBox(
  parent: THREE.Object3D,
  size: Vector3Tuple,
  position: Vector3Tuple,
  color: number,
  rotation: Vector3Tuple = ZERO,
): THREE.Mesh {
  return addMesh(parent, new THREE.BoxGeometry(...size), createMaterial(color), position, rotation);
}

function addCylinder(
  parent: THREE.Object3D,
  radius: number,
  height: number,
  segments: number,
  position: Vector3Tuple,
  color: number,
  rotation: Vector3Tuple = ZERO,
): THREE.Mesh {
  return addMesh(parent, new THREE.CylinderGeometry(radius, radius, height, segments), createMaterial(color), position, rotation);
}

function addBeam(
  parent: THREE.Object3D,
  start: Vector3Tuple,
  end: Vector3Tuple,
  radius: number,
  color: number,
): THREE.Mesh {
  const startVector = new THREE.Vector3(...start);
  const endVector = new THREE.Vector3(...end);
  const direction = endVector.clone().sub(startVector);
  const mesh = addMesh(
    parent,
    new THREE.CylinderGeometry(radius, radius, direction.length(), 6),
    createMaterial(color, { metalness: 0.16 }),
    startVector.clone().add(endVector).multiplyScalar(0.5).toArray() as Vector3Tuple,
  );
  mesh.quaternion.setFromUnitVectors(UP, direction.normalize());
  return mesh;
}

function disposeObjectChildren(root: THREE.Object3D): void {
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
  root.clear();
}

function getYardColor(object: YardObjectDefinition): number {
  switch (object.visual) {
    case "ground": return COLORS.ground;
    case "pad": return COLORS.pad;
    case "ramp": return COLORS.ramp;
    case "whoop": return COLORS.ground;
    case "log": return COLORS.wood;
    case "crate": return COLORS.crate;
    case "rock": return COLORS.rock;
    case "fence": return COLORS.fence;
    case "decoration": return COLORS.metal;
  }
}

function createRampGeometry(shape: Extract<YardShape, { readonly type: "ramp" }>): THREE.BufferGeometry {
  const geometry = new THREE.BufferGeometry();
  const vertices = getShapeVertices(shape) ?? [];
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(vertices, 3));
  geometry.setIndex([0, 2, 1, 1, 2, 3, 0, 1, 5, 0, 5, 4, 2, 4, 5, 2, 5, 3, 0, 4, 2, 1, 3, 5]);
  geometry.computeVertexNormals();
  return geometry;
}

function createYardGeometry(shape: YardShape): THREE.BufferGeometry {
  switch (shape.type) {
    case "box":
      return new THREE.BoxGeometry(...shape.size);
    case "cylinder":
      return new THREE.CylinderGeometry(shape.radius, shape.radius, shape.height, shape.axis === "x" ? 10 : 12);
    case "rock":
      return new THREE.DodecahedronGeometry(1, 0);
    case "ramp":
      return createRampGeometry(shape);
  }
}

function applyYardShapeTransform(mesh: THREE.Mesh, shape: YardShape): void {
  if (shape.type === "cylinder" && shape.axis === "x") {
    mesh.rotation.z = Math.PI / 2;
  }
  if (shape.type === "rock") {
    mesh.scale.set(shape.size[0] / 2, shape.size[1] / 2, shape.size[2] / 2);
  }
}

function getModuleAccent(definition: RoverModuleDefinition): number {
  return definition.accent;
}

export class LowPolyRoverScene {
  private readonly container: HTMLElement;
  private readonly options: LowPolyRoverSceneOptions;
  private readonly scene = new THREE.Scene();
  private readonly camera = new THREE.PerspectiveCamera();
  private readonly roverRoot = new THREE.Group();
  private readonly moduleRoot = new THREE.Group();
  private readonly garageRoot = new THREE.Group();
  private readonly yardRoot = new THREE.Group();
  private readonly wheelVisuals: WheelVisual[] = [];
  private readonly dynamicPropGroups = new Map<string, THREE.Group>();
  private reducedMotion: boolean;
  private selection: RoverSelection;
  private renderer: WebGPURenderer | null = null;
  private controls: OrbitControls | null = null;
  private resizeObserver: ResizeObserver | null = null;
  private intersectionObserver: IntersectionObserver | null = null;
  private physics: RoverPhysicsWorld | null = null;
  private physicsLoadPromise: Promise<void> | null = null;
  private driveInput: DriveInput = { throttle: 0, steering: 0 };
  private disposed = false;
  private pageVisible = typeof document === "undefined" || document.visibilityState === "visible";
  private inViewport = true;
  private animationLoopActive = false;
  private lastTime = 0;
  private lastHudTime = 0;
  private controlsActiveUntil = 0;
  private autoRotate = false;
  private paused = false;
  private status: RoverStatus = "DRIVING";
  private mode: ExperienceMode = "garage";
  private moduleAnimationProgress = 1;
  private yardCameraReady = false;

  private readonly handleResize = (): void => this.resize();
  private readonly handleControlsChange = (): void => {
    this.controlsActiveUntil = performance.now() + 300;
    this.updateLoopState();
  };
  private readonly handleVisibility = (): void => {
    this.pageVisible = document.visibilityState === "visible";
    this.lastTime = 0;
    if (!this.pageVisible) {
      this.clearDriveInput();
      this.physics?.stopVehicle();
    }
    this.updateLoopState();
  };
  private readonly render = (time: number): void => this.renderFrame(time);

  public constructor(container: HTMLElement, options: LowPolyRoverSceneOptions) {
    this.container = container;
    this.options = options;
    this.reducedMotion = options.reducedMotion;
    this.selection = normalizeSelection(options.selection ?? INITIAL_SELECTION);
  }

  public async init(): Promise<LowPolyRoverSceneInitResult> {
    this.scene.background = new THREE.Color(COLORS.background);
    this.scene.fog = new THREE.Fog(COLORS.background, 22, 64);
    this.buildLighting();
    this.buildGarage();
    this.buildYard();
    this.buildRover();
    this.setSelection(this.selection);

    const viewport = this.getViewportSize();
    const preset = getCameraPreset(viewport.width, viewport.height);
    this.camera.aspect = viewport.width / viewport.height;
    this.camera.fov = preset.fov;
    this.camera.near = 0.1;
    this.camera.far = 100;
    this.camera.position.set(...preset.position);
    this.camera.lookAt(...preset.target);
    this.camera.updateProjectionMatrix();

    const renderer = new WebGPURenderer({ antialias: true, alpha: false });
    await renderer.init();
    if (this.disposed) {
      renderer.dispose();
      return { webGpuApiAvailable: this.hasWebGpuApi() };
    }
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, viewport.width < 720 ? 1.25 : 1.5));
    renderer.setSize(viewport.width, viewport.height, false);
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.04;
    renderer.domElement.setAttribute("aria-hidden", "true");
    renderer.domElement.setAttribute("role", "presentation");
    renderer.domElement.style.display = "block";
    renderer.domElement.style.width = "100%";
    renderer.domElement.style.height = "100%";
    this.renderer = renderer;
    this.container.appendChild(renderer.domElement);

    this.controls = new OrbitControls(this.camera, renderer.domElement);
    this.controls.target.set(...preset.target);
    this.controls.enablePan = false;
    this.controls.enableDamping = true;
    this.controls.dampingFactor = this.reducedMotion ? 0.14 : 0.08;
    this.controls.minDistance = preset.minDistance;
    this.controls.maxDistance = preset.maxDistance;
    this.controls.minPolarAngle = 0.42;
    this.controls.maxPolarAngle = Math.PI * 0.48;
    this.controls.autoRotate = false;
    this.controls.autoRotateSpeed = 0.36;
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
    disposeObjectChildren(this.moduleRoot);
    const definitions = [
      getModuleDefinition("front", this.selection.front),
      getModuleDefinition("cabin", this.selection.cabin),
      getModuleDefinition("rear", this.selection.rear),
    ];
    definitions.forEach((definition) => {
      if (definition) {
        this.buildModule(definition);
      }
    });
    this.moduleAnimationProgress = this.reducedMotion ? 1 : 0;
    this.moduleRoot.scale.set(this.reducedMotion ? 1 : 0.94, this.reducedMotion ? 1 : 0.94, this.reducedMotion ? 1 : 0.94);
    this.controlsActiveUntil = performance.now() + (this.reducedMotion ? 100 : 300);
    this.updateLoopState();
  }

  public async setMode(nextMode: ExperienceMode): Promise<void> {
    if (this.disposed || this.mode === nextMode) {
      return;
    }
    this.clearDriveInput();
    if (nextMode === "yard") {
      await this.ensurePhysics();
      if (this.disposed || !this.physics) {
        return;
      }
      this.physics.resetToStart();
      this.paused = false;
      this.status = "DRIVING";
    } else {
      this.physics?.dispose();
      this.physics = null;
      this.paused = false;
      this.status = "DRIVING";
    }
    this.mode = nextMode;
    this.garageRoot.visible = nextMode === "garage";
    this.yardRoot.visible = nextMode === "yard";
    if (this.controls) {
      const viewport = this.getViewportSize();
      const preset = nextMode === "garage"
        ? getCameraPreset(viewport.width, viewport.height)
        : getYardCameraPreset(viewport.width, viewport.height);
      this.camera.position.set(...preset.position);
      this.camera.fov = preset.fov;
      this.camera.updateProjectionMatrix();
      this.controls.target.set(...preset.target);
      this.controls.minDistance = preset.minDistance;
      this.controls.maxDistance = preset.maxDistance;
      this.controls.enabled = nextMode === "garage";
      this.controls.autoRotate = nextMode === "garage" && this.autoRotate;
      this.controls.update();
    }
    this.yardCameraReady = false;
    if (nextMode === "yard") {
      this.syncRover(this.physics?.snapshot ?? null, 0);
      this.emitHud(true);
    } else {
      this.roverRoot.position.set(0, 2.05, 0);
      this.roverRoot.quaternion.identity();
      this.emitHud(true);
    }
    this.options.onAutoRotateChange(nextMode === "garage" && this.autoRotate);
    this.updateLoopState();
  }

  public setDriveInput(input: DriveInput): void {
    if (this.mode === "yard" && !this.paused) {
      this.driveInput = input;
    }
  }

  public clearDriveInput(): void {
    this.driveInput = { throttle: 0, steering: 0 };
  }

  public setPaused(nextPaused: boolean): void {
    if (this.disposed || this.mode !== "yard" || this.paused === nextPaused) {
      return;
    }
    this.paused = nextPaused;
    this.clearDriveInput();
    if (nextPaused) {
      this.physics?.stopVehicle();
      this.status = "PAUSED";
    } else {
      this.status = "DRIVING";
      this.lastTime = 0;
    }
    this.emitHud(true);
    this.updateLoopState();
  }

  public recover(): void {
    if (this.disposed || this.mode !== "yard" || !this.physics) {
      return;
    }
    this.clearDriveInput();
    this.paused = false;
    this.status = "RECOVER";
    this.physics.recoverToStart();
    this.yardCameraReady = false;
    this.syncRover(this.physics.snapshot, 0);
    this.emitHud(true);
    this.status = "DRIVING";
    this.updateLoopState();
  }

  public setAutoRotate(enabled: boolean): void {
    if (this.disposed || this.mode !== "garage") {
      return;
    }
    this.autoRotate = this.reducedMotion ? false : enabled;
    if (this.controls) {
      this.controls.autoRotate = this.autoRotate;
    }
    this.options.onAutoRotateChange(this.autoRotate);
    this.updateLoopState();
  }

  public setReducedMotion(enabled: boolean): void {
    if (this.disposed) {
      return;
    }
    this.reducedMotion = enabled;
    if (this.controls) {
      this.controls.dampingFactor = enabled ? 0.14 : 0.08;
      if (enabled) {
        this.autoRotate = false;
        this.controls.autoRotate = false;
        this.options.onAutoRotateChange(false);
      }
    }
    this.updateLoopState();
  }

  public zoomBy(direction: "in" | "out"): void {
    if (this.disposed || this.mode !== "garage" || !this.controls) {
      return;
    }
    const target = this.controls.target;
    const offset = this.camera.position.clone().sub(target);
    const factor = direction === "in" ? 0.82 : 1.22;
    const distance = THREE.MathUtils.clamp(offset.length() * factor, this.controls.minDistance, this.controls.maxDistance);
    this.camera.position.copy(target).add(offset.normalize().multiplyScalar(distance));
    this.controls.update();
    this.controlsActiveUntil = performance.now() + 260;
    this.updateLoopState();
  }

  public reset(): void {
    if (this.disposed) {
      return;
    }
    this.clearDriveInput();
    if (this.mode === "yard") {
      this.recover();
      return;
    }
    const viewport = this.getViewportSize();
    const preset = getCameraPreset(viewport.width, viewport.height);
    this.camera.position.set(...preset.position);
    this.camera.fov = preset.fov;
    this.camera.updateProjectionMatrix();
    this.controls?.target.set(...preset.target);
    this.controls?.update();
    this.controlsActiveUntil = performance.now() + 420;
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
    document.removeEventListener("visibilitychange", this.handleVisibility);
    this.physics?.dispose();
    disposeObjectChildren(this.scene);
    this.renderer?.dispose();
    if (this.renderer?.domElement.parentElement === this.container) {
      this.container.removeChild(this.renderer.domElement);
    }
    this.renderer = null;
    this.controls = null;
  }

  private buildLighting(): void {
    this.scene.add(new THREE.HemisphereLight(0xfff8e8, 0x405b5a, 2.15));
    const key = new THREE.DirectionalLight(0xffd5a0, 3.1);
    key.position.set(-12, 17, 10);
    this.scene.add(key);
    const fill = new THREE.DirectionalLight(0x9bcdd0, 1.2);
    fill.position.set(12, 8, -14);
    this.scene.add(fill);
  }

  private buildGarage(): void {
    this.garageRoot.name = "garage-mode";
    addCylinder(this.garageRoot, 5.8, 0.18, 8, [0, 0, 0], COLORS.fence);
    addMesh(this.garageRoot, new THREE.TorusGeometry(5.1, 0.08, 6, 16), createMaterial(COLORS.yellow, { metalness: 0.25 }), [0, 0.14, 0], [Math.PI / 2, 0, 0]);
    addBox(this.garageRoot, [1.1, 0.72, 0.9], [-4.4, 0.48, 1.3], COLORS.crate);
    addBox(this.garageRoot, [0.9, 0.48, 0.78], [4.1, 0.34, -1.8], COLORS.rock, [0.08, 0.32, -0.12]);
    for (const x of [-5.7, 5.7]) {
      addCylinder(this.garageRoot, 0.18, 3.8, 6, [x, 1.9, -3.7], COLORS.fence);
      addBeam(this.garageRoot, [x, 3.7, -3.7], [x * 0.8, 2.1, -3.7], 0.12, COLORS.fence);
    }
    this.scene.add(this.garageRoot);
  }

  private buildYard(): void {
    this.yardRoot.name = "test-yard-mode";
    for (const object of YARD_OBJECTS) {
      const group = new THREE.Group();
      group.name = `yard-${object.id}`;
      group.position.set(...object.position);
      group.rotation.set(...object.rotation);
      group.scale.set(...object.scale);
      if (object.visual === "pad") {
        addCylinder(group, 3.2, 0.08, 12, [0, 0, 0], COLORS.pad);
        addMesh(group, new THREE.TorusGeometry(2.7, 0.07, 5, 12), createMaterial(COLORS.yellow, { metalness: 0.15 }), [0, 0.06, 0], [Math.PI / 2, 0, 0]);
        addBox(group, [0.16, 0.1, 4.8], [0, 0.08, 0], COLORS.yellow);
      } else if (object.collider) {
        const geometry = createYardGeometry(object.collider);
        const material = createMaterial(getYardColor(object), { roughness: object.visual === "fence" ? 0.72 : 0.9, metalness: object.visual === "fence" ? 0.22 : 0.02 });
        const mesh = addMesh(group, geometry, material);
        applyYardShapeTransform(mesh, object.collider);
        if (object.visual === "crate" && object.collider.type === "box") {
          addBox(group, [object.collider.size[0] * 0.8, 0.1, 0.12], [0, object.collider.size[1] * 0.16, -object.collider.size[2] / 2 - 0.01], COLORS.yellow);
        }
        if (object.visual === "rock") {
          mesh.castShadow = true;
        }
      }
      this.yardRoot.add(group);
      if (object.bodyType === "dynamic") {
        this.dynamicPropGroups.set(object.id, group);
      }
    }
    this.yardRoot.visible = false;
    this.scene.add(this.yardRoot);
  }

  private buildRover(): void {
    this.roverRoot.name = "rover";
    addBox(this.roverRoot, [4.5, 0.96, 2.5], [0, 0, 0], COLORS.body);
    addBox(this.roverRoot, [4.08, 0.22, 2.72], [0, -0.5, 0], COLORS.dark);
    addBox(this.roverRoot, [3.55, 0.18, 2.1], [0, 0.55, 0], COLORS.bodyLight);
    for (const wheel of WHEEL_CONFIGS) {
      const group = new THREE.Group();
      group.name = `wheel-${wheel.index}`;
      group.position.set(wheel.x, wheel.y, wheel.z);
      addMesh(group, new THREE.CylinderGeometry(VEHICLE_CONFIG.wheelRadius, VEHICLE_CONFIG.wheelRadius, VEHICLE_CONFIG.wheelWidth, 10), createMaterial(COLORS.rubber, { roughness: 0.98 }), ZERO, [0, 0, Math.PI / 2]);
      addMesh(group, new THREE.CylinderGeometry(0.28, 0.28, VEHICLE_CONFIG.wheelWidth + 0.04, 8), createMaterial(COLORS.metal, { metalness: 0.28 }), ZERO, [0, 0, Math.PI / 2]);
      this.roverRoot.add(group);
      this.wheelVisuals.push({ group });
    }
    this.roverRoot.add(this.moduleRoot);
    this.roverRoot.position.set(0, 2.05, 0);
    this.scene.add(this.roverRoot);
  }

  private buildModule(definition: RoverModuleDefinition): void {
    const group = new THREE.Group();
    group.name = `module-${definition.id}`;
    if (definition.category === "front") {
      group.position.set(0, 0.42, -1.35);
      this.buildFrontModule(group, definition.visual, getModuleAccent(definition));
    } else if (definition.category === "cabin") {
      group.position.set(0, 0.42, 0);
      this.buildCabinModule(group, definition.visual, getModuleAccent(definition));
    } else {
      group.position.set(0, 0.32, 1.38);
      this.buildRearModule(group, definition.visual, getModuleAccent(definition));
    }
    this.moduleRoot.add(group);
  }

  private buildFrontModule(group: THREE.Group, visual: ModuleVisual, accent: number): void {
    if (visual === "lamp-bar") {
      addBox(group, [3.7, 0.24, 0.3], [0, 0, -0.5], COLORS.metal);
      for (const x of [-1.25, -0.42, 0.42, 1.25]) {
        addMesh(group, new THREE.SphereGeometry(0.22, 6, 4), createMaterial(accent, { roughness: 0.3 }), [x, 0.25, -0.58]);
      }
      return;
    }
    if (visual === "scoop") {
      addBox(group, [3.9, 0.35, 0.28], [0, -0.16, -0.64], accent, [0, 0.12, 0]);
      addBeam(group, [-1.55, 0.12, -0.54], [-1.95, -0.12, -0.7], 0.1, COLORS.metal);
      addBeam(group, [1.55, 0.12, -0.54], [1.95, -0.12, -0.7], 0.1, COLORS.metal);
      return;
    }
    if (visual === "sensor") {
      addMesh(group, new THREE.CylinderGeometry(0.66, 0.82, 0.72, 6), createMaterial(accent, { metalness: 0.12 }), [0, 0.28, -0.58]);
      addCylinder(group, 0.08, 0.9, 6, [0, 0.88, -0.58], COLORS.metal);
      addMesh(group, new THREE.OctahedronGeometry(0.18, 0), createMaterial(COLORS.yellow), [0, 1.38, -0.58]);
      return;
    }
    addBox(group, [3.8, 0.26, 0.34], [0, 0.02, -0.62], COLORS.metal);
    addCylinder(group, 0.46, 0.3, 8, [0, 0.2, -0.78], accent, [Math.PI / 2, 0, 0]);
    addMesh(group, new THREE.TorusGeometry(0.34, 0.06, 5, 8), createMaterial(COLORS.yellow), [0, 0.2, -0.95], [Math.PI / 2, 0, 0]);
  }

  private buildCabinModule(group: THREE.Group, visual: ModuleVisual, accent: number): void {
    if (visual === "bubble") {
      addMesh(group, new THREE.SphereGeometry(1.12, 9, 5, 0, Math.PI * 2, 0, Math.PI * 0.62), createMaterial(COLORS.glass, { roughness: 0.28, transparent: true, opacity: 0.82 }), [0, 0.32, 0], ZERO, [1.18, 0.9, 1.08]);
      addBox(group, [2, 0.12, 1.8], [0, -0.42, 0], COLORS.dark);
      return;
    }
    if (visual === "armored") {
      addBox(group, [2.25, 1.16, 1.75], [0, 0.1, 0], COLORS.bodyLight);
      addBox(group, [1.45, 0.44, 0.12], [0, 0.32, -0.9], accent);
      addBox(group, [1.9, 0.1, 0.1], [0, 0.68, -0.42], COLORS.metal);
      return;
    }
    if (visual === "cockpit") {
      addBox(group, [1, 0.45, 0.88], [0, -0.06, 0.1], accent);
      addBeam(group, [-1.02, -0.32, -0.7], [-1.02, 0.9, -0.6], 0.11, COLORS.metal);
      addBeam(group, [1.02, -0.32, -0.7], [1.02, 0.9, -0.6], 0.11, COLORS.metal);
      addBeam(group, [-1.02, 0.9, -0.6], [1.02, 0.9, -0.6], 0.11, COLORS.metal);
      addBox(group, [0.62, 0.18, 0.82], [0, 0.28, 0.2], COLORS.dark);
      return;
    }
    addMesh(group, new THREE.SphereGeometry(0.95, 8, 5), createMaterial(COLORS.glass, { roughness: 0.3, transparent: true, opacity: 0.78 }), [-0.34, 0.3, 0], ZERO, [1.05, 0.9, 1.12]);
    addBox(group, [0.6, 0.5, 1.1], [0.92, 0.04, 0.08], accent);
    addCylinder(group, 0.12, 0.8, 6, [0.95, 0.62, 0.16], COLORS.metal);
  }

  private buildRearModule(group: THREE.Group, visual: ModuleVisual, accent: number): void {
    if (visual === "rack") {
      addBox(group, [2.55, 0.18, 1.72], [0, 0.05, 0.2], COLORS.metal);
      for (const x of [-1.12, 1.12]) {
        addBeam(group, [x, 0.08, -0.48], [x, 0.9, 0.68], 0.1, accent);
        addBeam(group, [x, 0.9, 0.68], [x, 0, 1.1], 0.1, accent);
      }
      addBox(group, [1.28, 0.58, 0.82], [0, 0.42, 0.32], COLORS.crate);
      return;
    }
    if (visual === "turbine") {
      addCylinder(group, 0.82, 0.42, 8, [0, 0.38, 0.62], COLORS.dark, [Math.PI / 2, 0, 0]);
      addMesh(group, new THREE.TorusGeometry(0.62, 0.09, 6, 10), createMaterial(accent, { metalness: 0.18 }), [0, 0.38, 0.86], [Math.PI / 2, 0, 0]);
      addCylinder(group, 0.14, 0.86, 6, [0, 0.4, 1.05], accent, [Math.PI / 2, 0, 0]);
      return;
    }
    if (visual === "tank") {
      addCylinder(group, 0.48, 1.72, 8, [0, 0.42, 0.42], accent, [Math.PI / 2, 0, 0]);
      addBox(group, [1.5, 0.56, 0.76], [0, 0.22, 0.95], COLORS.bodyLight);
      addCylinder(group, 0.14, 0.9, 6, [0.88, 0.62, 0.16], COLORS.metal);
      return;
    }
    addBox(group, [1.75, 0.18, 0.72], [0, 0.1, 0.6], COLORS.dark);
    for (const x of [-0.62, 0.62]) {
      addMesh(group, new THREE.TorusGeometry(0.44, 0.1, 6, 8), createMaterial(accent, { metalness: 0.22 }), [x, 0.52, 0.52], [Math.PI / 2, 0, 0]);
    }
    addBox(group, [0.42, 0.56, 0.42], [0, 0.35, 0.55], COLORS.metal);
  }

  private async ensurePhysics(): Promise<void> {
    if (this.physics || this.disposed) {
      return;
    }
    if (this.physicsLoadPromise) {
      return this.physicsLoadPromise;
    }
    this.physicsLoadPromise = (async () => {
      const rapier = await loadRapier();
      if (this.disposed) {
        return;
      }
      this.physics = new RoverPhysicsWorld(rapier);
    })();
    try {
      await this.physicsLoadPromise;
    } finally {
      this.physicsLoadPromise = null;
    }
  }

  private renderFrame(time: number): void {
    if (this.disposed || !this.renderer) {
      return;
    }
    const safeTime = Number.isFinite(time) ? time : 0;
    const deltaSeconds = this.lastTime === 0 ? 0 : Math.min(0.05, Math.max(0, (safeTime - this.lastTime) / 1000));
    this.lastTime = safeTime;

    if (this.moduleAnimationProgress < 1) {
      this.moduleAnimationProgress = Math.min(1, this.moduleAnimationProgress + deltaSeconds / 0.2);
      const eased = 1 - Math.pow(1 - this.moduleAnimationProgress, 3);
      const scale = 0.94 + eased * 0.06;
      this.moduleRoot.scale.set(scale, scale, scale);
    }

    if (this.mode === "yard" && this.physics) {
      const snapshot = this.paused || !this.pageVisible
        ? this.physics.snapshot
        : this.physics.advance(deltaSeconds, this.driveInput);
      this.syncRover(snapshot, deltaSeconds);
      this.updateDynamicProps(this.physics.getDynamicPropSnapshots());
      this.updateYardCamera(snapshot, deltaSeconds);
      if (safeTime - this.lastHudTime >= 100 || this.lastHudTime === 0) {
        this.lastHudTime = safeTime;
        this.emitHud(false, snapshot);
      }
    } else if (this.mode === "garage") {
      this.controls?.update();
    }

    this.renderer.render(this.scene, this.camera);
    if (!this.shouldAnimate(safeTime)) {
      this.renderer.setAnimationLoop(null);
      this.animationLoopActive = false;
    }
  }

  private syncRover(snapshot: RoverPhysicsSnapshot | null, deltaSeconds: number): void {
    if (!snapshot) {
      return;
    }
    void deltaSeconds;
    this.roverRoot.position.set(snapshot.x, snapshot.y, snapshot.z);
    this.roverRoot.quaternion.set(snapshot.rotation.x, snapshot.rotation.y, snapshot.rotation.z, snapshot.rotation.w);
    for (const [index, wheel] of this.wheelVisuals.entries()) {
      const suspensionLength = snapshot.wheelSuspensionLengths[index] ?? VEHICLE_CONFIG.suspensionRestLength;
      const suspensionDelta = THREE.MathUtils.clamp(suspensionLength - VEHICLE_CONFIG.suspensionRestLength, -VEHICLE_CONFIG.suspensionMaxTravel, VEHICLE_CONFIG.suspensionMaxTravel);
      wheel.group.position.y = WHEEL_CONFIGS[index]?.y - suspensionDelta;
      wheel.group.rotation.x = snapshot.wheelRotations[index] ?? 0;
    }
  }

  private updateDynamicProps(snapshots: readonly DynamicPropSnapshot[]): void {
    for (const snapshot of snapshots) {
      const group = this.dynamicPropGroups.get(snapshot.id);
      if (!group) {
        continue;
      }
      group.position.set(snapshot.x, snapshot.y, snapshot.z);
      group.quaternion.set(snapshot.rotation.x, snapshot.rotation.y, snapshot.rotation.z, snapshot.rotation.w);
    }
  }

  private updateYardCamera(snapshot: RoverPhysicsSnapshot, deltaSeconds: number): void {
    const axes = getSemanticAxes(snapshot.rotation);
    const forward = new THREE.Vector3(axes.forward[0], 0, axes.forward[2]).normalize();
    const rear = forward.clone().multiplyScalar(-1);
    const distance = 8.2 + Math.min(2.2, Math.abs(snapshot.speed) * 0.12);
    const goal = new THREE.Vector3(snapshot.x, snapshot.y + 4.4, snapshot.z).addScaledVector(rear, distance);
    const target = new THREE.Vector3(snapshot.x, snapshot.y + 0.8, snapshot.z).addScaledVector(forward, 2.4);
    if (!this.yardCameraReady) {
      this.camera.position.copy(goal);
      this.yardCameraReady = true;
    } else {
      const alpha = 1 - Math.exp(-Math.max(0.05, deltaSeconds) * (this.reducedMotion ? 5 : 8));
      this.camera.position.lerp(goal, alpha);
    }
    this.camera.lookAt(target);
  }

  private emitHud(force: boolean, snapshot = this.physics?.snapshot): void {
    if (!snapshot || (!force && this.mode !== "yard")) {
      return;
    }
    this.options.onHudChange({
      speed: snapshot.speed,
      groundedWheels: snapshot.groundedWheels,
      surface: snapshot.surface.replace("-", " ").toUpperCase(),
      zoneLabel: snapshot.zoneLabel,
      status: this.status,
      airborne: snapshot.airborne,
      insideBounds: snapshot.insideBounds,
    });
  }

  private resize(): void {
    if (!this.renderer) {
      return;
    }
    const viewport = this.getViewportSize();
    this.camera.aspect = viewport.width / viewport.height;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(viewport.width, viewport.height, false);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, viewport.width < 720 ? 1.25 : 1.5));
  }

  private shouldAnimate(time: number): boolean {
    if (!this.renderer || this.disposed || !this.pageVisible || !this.inViewport) {
      return false;
    }
    if (this.mode === "yard") {
      return !this.paused;
    }
    return this.autoRotate || this.moduleAnimationProgress < 1 || Boolean(this.controls?.autoRotate) || time < this.controlsActiveUntil;
  }

  private updateLoopState(): void {
    if (!this.renderer || this.disposed) {
      return;
    }
    if (this.shouldAnimate(performance.now())) {
      if (!this.animationLoopActive) {
        this.renderer.setAnimationLoop(this.render);
        this.animationLoopActive = true;
      }
      return;
    }
    this.renderer.render(this.scene, this.camera);
  }

  private getViewportSize(): { readonly width: number; readonly height: number } {
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
