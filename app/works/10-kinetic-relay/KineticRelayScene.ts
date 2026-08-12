import * as THREE from "three";
import { WebGPURenderer } from "three/webgpu";

import {
  COURSE_DEFINITIONS,
  COURSE_IDS,
  advanceSequence,
  createInitialSequence,
  getCurrentStage,
  getRunProgress,
  startSequence,
  type CourseId,
  type SequencePhase,
  type SequenceState,
} from "./machineSequence";
import {
  loadRapier,
  MachinePhysicsWorld,
  type PhysicsVector,
} from "./machinePhysics";
import {
  advanceSelector,
  createSelectorState,
  courseOffset,
  getSelectorOffset,
  isSelectorReady,
  startSelectorChange,
  type SelectorPhase,
  type SelectorState,
} from "./routeSelector";
import { getCameraPreset, getHeroCamera, getFocusCamera, type CameraPreset } from "./cameraSequence";
import { getDrawingBufferSize, getQualityProfile, type QualityProfile } from "./qualityProfile";
import {
  createFunnelGeometry,
  createGearGeometry,
  createLabelSprite,
  createRoundedBlock,
  createStudGeometry,
  createTubeRail,
} from "./machineGeometry";
import { createMachineMaterials, createStudioEnvironment, type MachineMaterials } from "./machineMaterials";

type Renderer = WebGPURenderer | THREE.WebGLRenderer;
type RendererBackend = "WebGPU" | "WebGL 2 fallback";

export type MachineRuntimeStatus = "loading" | "ready" | "error";

export type MachineUiState = {
  readonly runtimeStatus: MachineRuntimeStatus;
  readonly backend: RendererBackend | "pending";
  readonly selectedCourse: CourseId;
  readonly selectorPhase: SelectorPhase;
  readonly selectorMoving: boolean;
  readonly sequencePhase: SequencePhase;
  readonly stageLabel: string;
  readonly stageIndex: number;
  readonly stageCount: number;
  readonly canStart: boolean;
  readonly statusText: string;
};

export type KineticRelaySceneOptions = {
  readonly reducedMotion: boolean;
  readonly onStateChange?: (state: MachineUiState) => void;
  readonly onLoadingState?: (message: string) => void;
};

export type KineticRelayInitResult = {
  readonly backend: RendererBackend;
  readonly rapierReady: boolean;
  readonly triangles: number;
  readonly drawCalls: number;
  readonly geometries: number;
  readonly textures: number;
};

const GOAL_POSITION = new THREE.Vector3(0, 1.48, -0.68);
const COURSE_X: Record<CourseId, number> = { A: -5.35, B: 0, C: 5.35 };
function finite(value: number, fallback = 0): number {
  return Number.isFinite(value) ? value : fallback;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, finite(value, min)));
}

function smooth(value: number): number {
  const t = clamp(value, 0, 1);
  return t * t * (3 - 2 * t);
}

function addMesh(
  parent: THREE.Object3D,
  geometry: THREE.BufferGeometry,
  material: THREE.Material,
  position: readonly [number, number, number] = [0, 0, 0],
  castShadow = true,
  receiveShadow = true,
): THREE.Mesh {
  const mesh = new THREE.Mesh(geometry, material);
  mesh.position.set(...position);
  mesh.castShadow = castShadow;
  mesh.receiveShadow = receiveShadow;
  parent.add(mesh);
  return mesh;
}

function addRodBetween(
  parent: THREE.Object3D,
  start: THREE.Vector3,
  end: THREE.Vector3,
  radius: number,
  material: THREE.Material,
  segments = 32,
): THREE.Mesh {
  const direction = new THREE.Vector3().subVectors(end, start);
  const mesh = addMesh(
    parent,
    new THREE.CylinderGeometry(radius, radius * 1.04, Math.max(0.02, direction.length()), segments, 2),
    material,
  );
  mesh.position.copy(start).add(end).multiplyScalar(0.5);
  mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), direction.normalize());
  return mesh;
}

function createCurve(points: readonly THREE.Vector3[], closed = false): THREE.CatmullRomCurve3 {
  return new THREE.CatmullRomCurve3(points.map((point) => point.clone()), closed, "centripetal", 0.35);
}

function lerpVector(target: THREE.Vector3, from: THREE.Vector3, to: THREE.Vector3, progress: number): THREE.Vector3 {
  target.copy(from).lerp(to, smooth(progress));
  return target;
}

function createReturnCurve(startX: number): THREE.CatmullRomCurve3 {
  return createCurve([
    new THREE.Vector3(startX, 2.15, 0.15),
    new THREE.Vector3(startX * 0.78, 1.85, -0.12),
    new THREE.Vector3(startX * 0.46, 1.62, -0.52),
    new THREE.Vector3(0, GOAL_POSITION.y, GOAL_POSITION.z),
  ]);
}

function createSpiralCurve(centerX: number, centerY: number, radius: number, turns: number): THREE.CatmullRomCurve3 {
  const points: THREE.Vector3[] = [];
  for (let index = 0; index <= 100; index += 1) {
    const progress = index / 100;
    const angle = -Math.PI * 0.35 + progress * Math.PI * 2 * turns;
    const localRadius = radius * (1 - progress * 0.85);
    points.push(new THREE.Vector3(
      centerX + Math.cos(angle) * localRadius,
      centerY - progress * 1.45,
      Math.sin(angle) * localRadius * 0.74,
    ));
  }
  return createCurve(points);
}

function createEnvironmentLightTexture(): THREE.Texture {
  return createStudioEnvironment();
}

function disposeSceneResources(scene: THREE.Scene, extraTexture: THREE.Texture | null): void {
  const geometries = new Set<THREE.BufferGeometry>();
  const materials = new Set<THREE.Material>();
  const textures = new Set<THREE.Texture>();
  scene.traverse((object) => {
    if (object instanceof THREE.Mesh || object instanceof THREE.Line || object instanceof THREE.Points) {
      geometries.add(object.geometry);
      const objectMaterials = Array.isArray(object.material) ? object.material : [object.material];
      objectMaterials.forEach((material) => {
        materials.add(material);
        if (material instanceof THREE.MeshBasicMaterial || material instanceof THREE.MeshStandardMaterial || material instanceof THREE.MeshPhysicalMaterial) {
          if (material.map) {
            textures.add(material.map);
          }
          if (material instanceof THREE.MeshStandardMaterial && material.emissiveMap) {
            textures.add(material.emissiveMap);
          }
        }
      });
    }
    if (object instanceof THREE.Sprite) {
      geometries.add(object.geometry);
      const material = object.material as THREE.SpriteMaterial;
      materials.add(material);
      if (material.map) {
        textures.add(material.map);
      }
    }
  });
  geometries.forEach((geometry) => geometry.dispose());
  materials.forEach((material) => material.dispose());
  textures.forEach((texture) => texture.dispose());
  extraTexture?.dispose();
}

export class KineticRelayScene {
  private readonly container: HTMLElement;
  private readonly scene = new THREE.Scene();
  private readonly camera = new THREE.PerspectiveCamera(35, 1, 0.1, 80);
  private readonly root = new THREE.Group();
  private readonly machineGroup = new THREE.Group();
  private readonly selectorGroup = new THREE.Group();
  private readonly selectorPlatform = new THREE.Group();
  private readonly selectorRail: THREE.Object3D;
  private readonly selectorLinkage: THREE.Object3D;
  private readonly selectorLockPin: THREE.Mesh;
  private readonly selectorLamp: THREE.Mesh;
  private readonly indicatorMeshes: Record<CourseId, THREE.Mesh> = {} as Record<CourseId, THREE.Mesh>;
  private readonly indicatorMaterials: Record<CourseId, THREE.MeshStandardMaterial> = {} as Record<CourseId, THREE.MeshStandardMaterial>;
  private readonly balls: Record<CourseId, THREE.Mesh> = {} as Record<CourseId, THREE.Mesh>;
  private readonly secondMarble: THREE.Mesh;
  private readonly rockerLever: THREE.Group;
  private readonly hammerGroup: THREE.Group;
  private readonly pendulumGroup: THREE.Group;
  private readonly gearGroups: readonly THREE.Group[];
  private readonly liftGate: THREE.Group;
  private readonly balanceGroup: THREE.Group;
  private readonly turbineGroup: THREE.Group;
  private readonly goalBell: THREE.Group;
  private goalRing!: THREE.Mesh;
  private readonly dominoes: readonly THREE.Group[];
  private readonly helixCurve: THREE.CatmullRomCurve3;
  private readonly switchbackCurve: THREE.CatmullRomCurve3;
  private readonly funnelFeedCurve: THREE.CatmullRomCurve3;
  private readonly funnelSpiralCurve: THREE.CatmullRomCurve3;
  private readonly orbitCurve: THREE.CatmullRomCurve3;
  private readonly returnCurves: Record<CourseId, THREE.CatmullRomCurve3>;
  private readonly dominoCurve: THREE.CatmullRomCurve3;
  private readonly materials: MachineMaterials;
  private readonly environmentTexture: THREE.Texture;
  private readonly options: KineticRelaySceneOptions;
  private readonly handleResize = (): void => this.resize();
  private readonly handleVisibility = (): void => {
    this.pageVisible = document.visibilityState === "visible";
    this.lastTime = 0;
    this.updateLoopState();
  };
  private renderer: Renderer | null = null;
  private physics: MachinePhysicsWorld | null = null;
  private resizeObserver: ResizeObserver | null = null;
  private intersectionObserver: IntersectionObserver | null = null;
  private quality: QualityProfile = getQualityProfile(1440, 900, 1);
  private selectorState: SelectorState = createSelectorState("A");
  private sequenceState: SequenceState = createInitialSequence("A");
  private reducedMotion: boolean;
  private pageVisible = typeof document === "undefined" || document.visibilityState === "visible";
  private inViewport = true;
  private disposed = false;
  private animationLoopActive = false;
  private lastTime = 0;
  private idleTime = 0;
  private completePulse = 0;
  private backend: RendererBackend | "pending" = "pending";
  private cameraFrom: CameraPreset = getHeroCamera(1440, 900);
  private cameraTo: CameraPreset = this.cameraFrom;
  private cameraProgress = 1;
  private lastUiKey = "";

  private readonly render = (time: number): void => this.renderFrame(time);

  public constructor(container: HTMLElement, options: KineticRelaySceneOptions) {
    this.container = container;
    this.options = options;
    this.reducedMotion = options.reducedMotion;
    this.environmentTexture = createEnvironmentLightTexture();
    this.scene.environment = this.environmentTexture;
    this.scene.background = new THREE.Color(0x080d14);
    this.scene.fog = new THREE.Fog(0x080d14, 15, 37);
    this.materials = createMachineMaterials(this.environmentTexture);
    this.helixCurve = this.createHelixCurve();
    this.switchbackCurve = this.createSwitchbackCurve();
    this.funnelFeedCurve = createCurve([
      new THREE.Vector3(COURSE_X.C, 8.12, 0),
      new THREE.Vector3(COURSE_X.C, 7.25, 0),
      new THREE.Vector3(COURSE_X.C, 6.42, 0),
    ]);
    this.funnelSpiralCurve = createSpiralCurve(COURSE_X.C, 6.18, 1.18, 2.1);
    this.orbitCurve = createCurve(
      Array.from({ length: 49 }, (_, index) => {
        const angle = -Math.PI * 0.15 + (index / 48) * Math.PI * 2.2;
        return new THREE.Vector3(COURSE_X.C + Math.cos(angle) * 1.38, 3.3, Math.sin(angle) * 1.38 * 0.66);
      }),
    );
    this.returnCurves = {
      A: createReturnCurve(COURSE_X.A),
      B: createReturnCurve(COURSE_X.B),
      C: createReturnCurve(COURSE_X.C),
    };
    this.dominoCurve = createCurve([
      new THREE.Vector3(COURSE_X.A + 0.1, 3.52, 0.08),
      new THREE.Vector3(COURSE_X.A + 0.95, 3.24, 0.12),
      new THREE.Vector3(COURSE_X.A + 2.55, 3.12, 0.12),
      new THREE.Vector3(COURSE_X.A + 3.6, 2.7, -0.05),
    ]);
    this.rockerLever = new THREE.Group();
    this.hammerGroup = new THREE.Group();
    this.pendulumGroup = new THREE.Group();
    this.liftGate = new THREE.Group();
    this.balanceGroup = new THREE.Group();
    this.turbineGroup = new THREE.Group();
    this.goalBell = new THREE.Group();
    this.selectorRail = new THREE.Group();
    this.selectorLinkage = new THREE.Group();
    this.selectorLockPin = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, 0.75, 32), this.materials.brassBright);
    this.selectorLamp = new THREE.Mesh(new THREE.SphereGeometry(0.14, 24, 16), this.materials.warmGlow);
    this.secondMarble = new THREE.Mesh(new THREE.SphereGeometry(0.2, 56, 32), this.materials.chrome);
    this.buildMachine();
    this.gearGroups = this.buildClockwork();
    this.buildHelixMechanism();
    this.buildOrbitMechanism();
    this.dominoes = this.buildDominoes();
    this.balls.A = new THREE.Mesh(new THREE.SphereGeometry(0.24, 64, 40), this.materials.chrome);
    this.balls.B = new THREE.Mesh(new THREE.SphereGeometry(0.24, 64, 40), this.materials.brassBright);
    this.balls.C = new THREE.Mesh(new THREE.SphereGeometry(0.24, 64, 40), this.materials.chrome);
    for (const course of COURSE_IDS) {
      this.balls[course].position.set(COURSE_X[course], 8.13, 0);
      this.balls[course].castShadow = true;
      this.machineGroup.add(this.balls[course]);
    }
    this.secondMarble.position.set(COURSE_X.C, 4.38, 0);
    this.secondMarble.visible = false;
    this.secondMarble.castShadow = true;
    this.machineGroup.add(this.secondMarble);
    this.camera.position.set(...this.cameraFrom.position);
    this.camera.lookAt(...this.cameraFrom.target);
    this.publishState(true);
  }

  public async init(): Promise<KineticRelayInitResult> {
    this.options.onLoadingState?.("Initializing renderer");
    const viewport = this.getViewportSize();
    this.quality = getQualityProfile(viewport.width, viewport.height, window.devicePixelRatio || 1);
    this.configureLights();
    this.configureShadowQuality();
    this.configureCamera(viewport.width, viewport.height);
    this.renderer = await this.createRenderer();
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.12;
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.domElement.setAttribute("aria-hidden", "true");
    this.renderer.domElement.setAttribute("role", "presentation");
    this.renderer.domElement.style.display = "block";
    this.renderer.domElement.style.width = "100%";
    this.renderer.domElement.style.height = "100%";
    this.container.appendChild(this.renderer.domElement);
    this.resize();
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
    this.options.onLoadingState?.("Preparing physics");
    const rapier = await loadRapier();
    if (this.disposed) {
      return { backend: this.backend === "pending" ? "WebGL 2 fallback" : this.backend, rapierReady: false, triangles: 0, drawCalls: 0, geometries: 0, textures: 0 };
    }
    this.physics = new MachinePhysicsWorld(rapier);
    this.options.onLoadingState?.("Ready");
    this.publishState(true);
    this.renderOnce();
    this.updateLoopState();
    const info = this.renderer.info.render;
    return {
      backend: this.backend === "pending" ? "WebGL 2 fallback" : this.backend,
      rapierReady: true,
      triangles: info.triangles,
      drawCalls: info.calls,
      geometries: this.renderer.info.memory.geometries,
      textures: this.renderer.info.memory.textures,
    };
  }

  public selectCourse(course: CourseId): void {
    if (this.disposed || this.sequenceState.phase === "running" || this.selectorState.phase !== "settled") {
      return;
    }
    if (course === this.selectorState.currentCourse) {
      if (this.sequenceState.phase === "complete") {
        this.resetSequence();
      }
      return;
    }
    this.sequenceState = createInitialSequence(course);
    this.physics?.reset();
    this.selectorState = startSelectorChange(this.selectorState, course);
    this.cameraFrom = this.getCurrentCameraPreset();
    this.cameraTo = getHeroCamera(this.getViewportSize().width, this.getViewportSize().height);
    this.cameraProgress = 0;
    this.publishState(true);
    this.updateLoopState();
  }

  public start(): void {
    if (this.disposed || this.sequenceState.phase !== "ready" || !isSelectorReady(this.selectorState, this.sequenceState.course)) {
      return;
    }
    this.sequenceState = startSequence(this.sequenceState);
    this.cameraFrom = this.getCurrentCameraPreset();
    this.cameraTo = getFocusCamera(this.sequenceState.course, this.getViewportSize().width, this.getViewportSize().height);
    this.cameraProgress = this.reducedMotion ? 1 : 0;
    this.publishState(true);
    this.updateLoopState();
  }

  public restart(): void {
    if (this.disposed || this.selectorState.phase !== "settled") {
      return;
    }
    this.resetSequence();
    this.cameraFrom = this.getCurrentCameraPreset();
    this.cameraTo = getHeroCamera(this.getViewportSize().width, this.getViewportSize().height);
    this.cameraProgress = this.reducedMotion ? 1 : 0;
    this.publishState(true);
    this.updateLoopState();
  }

  public setReducedMotion(enabled: boolean): void {
    this.reducedMotion = enabled;
    if (enabled) {
      this.cameraProgress = 1;
    }
    this.updateLoopState();
    this.publishState(true);
  }

  public dispose(): void {
    if (this.disposed) {
      return;
    }
    this.disposed = true;
    this.animationLoopActive = false;
    this.renderer?.setAnimationLoop(null);
    this.resizeObserver?.disconnect();
    this.intersectionObserver?.disconnect();
    window.removeEventListener("resize", this.handleResize);
    document.removeEventListener("visibilitychange", this.handleVisibility);
    this.physics?.dispose();
    this.physics = null;
    const domElement = this.renderer?.domElement;
    domElement?.remove();
    disposeSceneResources(this.scene, this.environmentTexture);
    this.renderer?.dispose();
    this.renderer = null;
  }

  private async createRenderer(): Promise<Renderer> {
    try {
      const renderer = new WebGPURenderer({ antialias: this.quality.antialias, alpha: false });
      await renderer.init();
      this.backend = "WebGPU";
      return renderer;
    } catch {
      const renderer = new THREE.WebGLRenderer({ antialias: this.quality.antialias, alpha: false });
      this.backend = "WebGL 2 fallback";
      return renderer;
    }
  }

  private buildMachine(): void {
    this.scene.add(this.root);
    this.root.add(this.machineGroup);
    this.buildFrame();
    this.buildSelector();
    this.buildGoal();
    for (const course of COURSE_IDS) {
      const label = createLabelSprite(COURSE_DEFINITIONS[course].name, course === "C" ? "#b9eef2" : course === "B" ? "#f0c77c" : "#dce8ee");
      label.position.set(COURSE_X[course], 8.82, 2.22);
      this.machineGroup.add(label);
      const indicatorMaterial = this.materials.indicatorOff.clone();
      indicatorMaterial.emissive = new THREE.Color(course === "A" ? 0x6cb7d7 : course === "B" ? 0xe2a64f : 0x75dbe1);
      indicatorMaterial.emissiveIntensity = 0.04;
      const indicator = addMesh(
        this.machineGroup,
        new THREE.SphereGeometry(0.14, 24, 16),
        indicatorMaterial,
        [COURSE_X[course], 8.48, 2.26],
        false,
        false,
      );
      this.indicatorMeshes[course] = indicator;
      this.indicatorMaterials[course] = indicatorMaterial;
    }
  }

  private buildFrame(): void {
    const frame = new THREE.Group();
    const base = addMesh(frame, createRoundedBlock(18.2, 0.5, 10.6, 0.18, 5), this.materials.paintedMetal, [0, 0, 0]);
    base.receiveShadow = true;
    addMesh(frame, createRoundedBlock(17.4, 0.16, 9.9, 0.06, 3), this.materials.graphite, [0, 0.31, 0.08], false, true);
    const backPanel = addMesh(frame, createRoundedBlock(17.2, 9.1, 0.18, 0.07, 3), this.materials.graphite, [0, 4.9, -2.65], false, true);
    backPanel.material = this.materials.graphite;
    for (const x of [-8.35, 8.35]) {
      for (const z of [-2.2, 2.2]) {
        addMesh(frame, createRoundedBlock(0.38, 9.1, 0.38, 0.08, 3), this.materials.paintedMetal, [x, 4.75, z]);
        addMesh(frame, new THREE.CylinderGeometry(0.25, 0.25, 0.18, 48), this.materials.brass, [x, 0.44, z]);
        addMesh(frame, new THREE.CylinderGeometry(0.2, 0.2, 0.18, 48), this.materials.brass, [x, 9.2, z]);
      }
    }
    addMesh(frame, createRoundedBlock(17.1, 0.42, 0.42, 0.1, 4), this.materials.paintedMetal, [0, 9.2, 2.18]);
    addMesh(frame, createRoundedBlock(17.1, 0.24, 0.28, 0.06, 3), this.materials.brass, [0, 9.47, 2.18]);
    for (const x of [-7.7, -2.7, 2.7, 7.7]) {
      addRodBetween(frame, new THREE.Vector3(x, 0.55, 2.05), new THREE.Vector3(x + (x < 0 ? 0.55 : -0.55), 8.98, 2.05), 0.085, this.materials.brass, 24);
    }
    for (const x of [-5.35, 0, 5.35]) {
      addMesh(frame, createRoundedBlock(0.18, 7.25, 0.22, 0.04, 3), this.materials.brass, [x - 2.18, 4.38, 1.7]);
      addMesh(frame, createRoundedBlock(0.18, 7.25, 0.22, 0.04, 3), this.materials.brass, [x + 2.18, 4.38, 1.7]);
    }
    const studGeometry = createStudGeometry();
    for (const x of [-7.5, -4.25, -1.1, 1.1, 4.25, 7.5]) {
      for (const y of [1.05, 8.55]) {
        const stud = addMesh(frame, studGeometry, this.materials.brassBright, [x, y, 2.34]);
        stud.rotation.x = Math.PI / 2;
      }
    }
    this.machineGroup.add(frame);
  }

  private buildSelector(): void {
    const selector = this.selectorGroup;
    addMesh(selector, createRoundedBlock(14.8, 0.22, 1.08, 0.08, 4), this.materials.graphite, [0, 8.2, 1.3], false, true);
    addMesh(selector, new THREE.CylinderGeometry(0.08, 0.08, 10.4, 28), this.materials.chromeDark, [0, 8.48, 1.3], false, false).rotation.z = Math.PI / 2;
    this.selectorPlatform.position.set(courseOffset("A"), 8.54, 1.3);
    addMesh(this.selectorPlatform, createRoundedBlock(1.6, 0.28, 1.12, 0.1, 4), this.materials.paintedMetal, [0, 0, 0]);
    const railCurve = createCurve([new THREE.Vector3(-0.55, 0.17, 0), new THREE.Vector3(0.55, 0.17, 0)]);
    this.selectorRail.add(addMesh(this.selectorRail, createTubeRail(railCurve, 0.09, 64, 16), this.materials.chrome, [0, 0, 0]));
    this.selectorPlatform.add(this.selectorRail);
    addMesh(this.selectorPlatform, new THREE.CylinderGeometry(0.16, 0.16, 0.24, 32), this.materials.brassBright, [0, 0.22, 0]);
    this.selectorLockPin.position.set(0, -0.4, 0);
    this.selectorLockPin.rotation.z = Math.PI / 2;
    this.selectorPlatform.add(this.selectorLockPin);
    const pivot = addMesh(this.selectorLinkage, new THREE.CylinderGeometry(0.2, 0.2, 0.3, 40), this.materials.brassBright, [0, 0, 0]);
    pivot.rotation.z = Math.PI / 2;
    addRodBetween(this.selectorLinkage, new THREE.Vector3(-4.8, 8.54, 1.3), new THREE.Vector3(-2.9, 8.54, 1.3), 0.055, this.materials.chrome, 20);
    this.selectorLinkage.position.y = 0;
    selector.add(this.selectorPlatform, this.selectorLinkage);
    this.selectorLamp.position.set(0, 0.28, 0.56);
    this.selectorPlatform.add(this.selectorLamp);
    for (const course of COURSE_IDS) {
      const feed = createCurve([
        new THREE.Vector3(COURSE_X[course], 8.12, 0),
        new THREE.Vector3(COURSE_X[course], 7.72, 0),
      ]);
      selector.add(addMesh(selector, createTubeRail(feed, 0.075, 72, 14), course === "A" ? this.materials.chromeDark : course === "B" ? this.materials.brass : this.materials.chrome, [0, 0, 0]));
    }
    this.machineGroup.add(selector);
  }

  private buildHelixMechanism(): void {
    const group = new THREE.Group();
    const rail = addMesh(group, createTubeRail(this.helixCurve, 0.105, this.quality.railSegments, this.quality.railRadialSegments), this.materials.chrome, [0, 0, 0]);
    rail.castShadow = true;
    for (const progress of [0.15, 0.36, 0.58, 0.8]) {
      const point = this.helixCurve.getPointAt(progress);
      addRodBetween(group, new THREE.Vector3(point.x, 0.5, point.z), point, 0.055, this.materials.graphite, 20);
      addMesh(group, new THREE.TorusGeometry(0.25, 0.045, 16, 40), this.materials.brass, [point.x, point.y, point.z]);
    }
    const end = this.helixCurve.getPointAt(1);
    this.rockerLever.position.copy(end).add(new THREE.Vector3(0.3, -0.08, 0));
    addMesh(this.rockerLever, createRoundedBlock(1.75, 0.18, 0.32, 0.07, 4), this.materials.brassBright, [0, 0, 0]);
    addMesh(this.rockerLever, new THREE.CylinderGeometry(0.2, 0.2, 0.45, 32), this.materials.chromeDark, [0, -0.08, 0]);
    const rockerBall = new THREE.Mesh(new THREE.SphereGeometry(0.23, 48, 32), this.materials.brass);
    rockerBall.position.set(0.6, 0.18, 0);
    this.rockerLever.add(rockerBall);
    group.add(this.rockerLever);
    this.hammerGroup.position.set(COURSE_X.A + 3.85, 2.95, 0.22);
    addMesh(this.hammerGroup, new THREE.CylinderGeometry(0.065, 0.065, 1.9, 28), this.materials.chromeDark, [0, 0.92, 0]);
    addMesh(this.hammerGroup, createRoundedBlock(0.58, 0.38, 0.42, 0.12, 5), this.materials.brassBright, [0, 1.9, 0]);
    addMesh(this.hammerGroup, new THREE.CylinderGeometry(0.14, 0.14, 0.48, 32), this.materials.chrome, [0, 0, 0]);
    group.add(this.hammerGroup);
    this.machineGroup.add(group);
  }

  private buildDominoes(): readonly THREE.Group[] {
    const group = new THREE.Group();
    const dominoGeometry = createRoundedBlock(0.22, 0.82, 0.18, 0.06, 4);
    const dominoes: THREE.Group[] = [];
    for (let index = 0; index < 16; index += 1) {
      const t = index / 15;
      const point = this.dominoCurve.getPointAt(t);
      const domino = new THREE.Group();
      const fin = addMesh(domino, dominoGeometry, index % 2 === 0 ? this.materials.ivory : this.materials.brass, [0, 0.4, 0]);
      fin.castShadow = true;
      domino.position.copy(point);
      domino.rotation.y = -0.12 + t * 0.26;
      dominoes.push(domino);
      group.add(domino);
    }
    this.machineGroup.add(group);
    return dominoes;
  }

  private buildClockwork(): readonly THREE.Group[] {
    const group = new THREE.Group();
    const positions: readonly [number, number, number, number, number][] = [
      [COURSE_X.B - 1.25, 5.35, 0.45, 1.05, 18],
      [COURSE_X.B + 0.12, 5.05, 0.4, 0.76, 14],
      [COURSE_X.B + 1.2, 4.66, 0.33, 0.57, 11],
    ];
    const gears: THREE.Group[] = [];
    for (const [x, y, z, radius, teeth] of positions) {
      const gear = new THREE.Group();
      addMesh(gear, createGearGeometry(teeth, radius * 0.38, radius * 0.86, radius, 0.22), this.materials.brass, [0, 0, 0]);
      const hub = addMesh(gear, new THREE.CylinderGeometry(radius * 0.17, radius * 0.17, 0.32, 32), this.materials.chromeDark, [0, 0, 0]);
      hub.rotation.x = Math.PI / 2;
      gear.position.set(x, y, z);
      gears.push(gear);
      group.add(gear);
    }
    const pendulum = this.pendulumGroup;
    pendulum.position.set(-0.8, 6.72, 0.42);
    addMesh(pendulum, new THREE.CylinderGeometry(0.045, 0.045, 2.2, 24), this.materials.brassBright, [0, -1.1, 0]);
    addMesh(pendulum, new THREE.SphereGeometry(0.31, 40, 24), this.materials.ivory, [0, -2.14, 0]);
    addMesh(pendulum, new THREE.TorusGeometry(0.38, 0.07, 16, 40), this.materials.brass, [0, -2.14, 0]);
    group.add(pendulum);
    const rack = new THREE.Group();
    rack.position.set(1.6, 3.58, 0.56);
    addMesh(rack, createRoundedBlock(0.24, 1.32, 0.22, 0.04, 3), this.materials.brassBright, [0, 0.66, 0]);
    for (let index = 0; index < 8; index += 1) {
      addMesh(rack, createRoundedBlock(0.3, 0.08, 0.27, 0.018, 2), this.materials.ivory, [0.16, index * 0.16 + 0.08, 0]);
    }
    this.liftGate.position.set(1.6, 3.58, 0.2);
    addMesh(this.liftGate, createRoundedBlock(0.9, 0.18, 0.58, 0.06, 4), this.materials.brassBright, [0, 0, 0]);
    addMesh(this.liftGate, new THREE.CylinderGeometry(0.09, 0.09, 0.9, 28), this.materials.chromeDark, [0, 0, 0.2]);
    group.add(rack, this.liftGate);
    this.machineGroup.add(group);
    return gears;
  }

  private buildOrbitMechanism(): void {
    const group = new THREE.Group();
    const funnel = addMesh(group, createFunnelGeometry(this.quality.gearSegments * 2), this.materials.glass, [COURSE_X.C, 4.74, 0], false, false);
    funnel.rotation.x = Math.PI;
    funnel.renderOrder = 2;
    const funnelRim = addMesh(group, new THREE.TorusGeometry(1.57, 0.075, 24, 128), this.materials.chrome, [COURSE_X.C, 4.76, 0], true, false);
    funnelRim.rotation.x = Math.PI / 2;
    const funnelRail = addMesh(group, createTubeRail(this.funnelFeedCurve, 0.08, 128, 18), this.materials.chrome, [0, 0, 0]);
    funnelRail.castShadow = true;
    const spiralRail = addMesh(group, createTubeRail(this.funnelSpiralCurve, 0.055, 160, 16), this.materials.chromeDark, [0, 0, 0]);
    spiralRail.renderOrder = 3;
    const orbitRail = addMesh(group, createTubeRail(this.orbitCurve, 0.09, 176, 20), this.materials.chrome, [0, 0, 0]);
    orbitRail.position.y = 0;
    const orbitSupport = new THREE.Group();
    addRodBetween(orbitSupport, new THREE.Vector3(COURSE_X.C, 1.15, 0), new THREE.Vector3(COURSE_X.C, 3.3, 0), 0.07, this.materials.brass, 24);
    group.add(orbitSupport);
    this.balanceGroup.position.set(COURSE_X.C, 3.86, 0.12);
    addMesh(this.balanceGroup, createRoundedBlock(3.05, 0.2, 0.34, 0.07, 4), this.materials.chromeDark, [0, 0, 0]);
    addMesh(this.balanceGroup, new THREE.CylinderGeometry(0.2, 0.2, 0.48, 36), this.materials.brassBright, [0, -0.1, 0]);
    addMesh(this.balanceGroup, new THREE.SphereGeometry(0.24, 40, 24), this.materials.ivory, [-1.2, 0.2, 0]);
    addMesh(this.balanceGroup, new THREE.SphereGeometry(0.2, 40, 24), this.materials.brass, [1.22, 0.18, 0]);
    group.add(this.balanceGroup);
    this.turbineGroup.position.set(COURSE_X.C, 2.46, 0.3);
    addMesh(this.turbineGroup, new THREE.CylinderGeometry(0.58, 0.58, 0.16, 48), this.materials.brass, [0, 0, 0]).rotation.x = Math.PI / 2;
    for (let index = 0; index < 8; index += 1) {
      const blade = addMesh(this.turbineGroup, createRoundedBlock(0.1, 0.66, 0.08, 0.03, 3), this.materials.chrome, [Math.cos(index * Math.PI / 4) * 0.32, Math.sin(index * Math.PI / 4) * 0.32, 0]);
      blade.rotation.z = index * Math.PI / 4 + 0.35;
    }
    group.add(this.turbineGroup);
    this.machineGroup.add(group);
  }

  private buildGoal(): void {
    const goal = new THREE.Group();
    addMesh(goal, createRoundedBlock(4.4, 0.22, 1.22, 0.08, 4), this.materials.graphite, [0, 1.02, -0.5]);
    const bellBody = addMesh(this.goalBell, createFunnelGeometry(96), this.materials.brassBright, [0, 1.95, -0.86]);
    bellBody.scale.set(0.78, 0.72, 0.78);
    bellBody.rotation.x = Math.PI;
    addMesh(this.goalBell, new THREE.TorusGeometry(0.98, 0.12, 24, 96), this.materials.chrome, [0, 1.33, -0.86]);
    addMesh(this.goalBell, new THREE.CylinderGeometry(0.09, 0.09, 0.72, 32), this.materials.chromeDark, [0, 1.02, -0.86]);
    addMesh(this.goalBell, new THREE.SphereGeometry(0.18, 40, 24), this.materials.brass, [0, 0.68, -0.86]);
    goal.add(this.goalBell);
    this.goalRing = addMesh(goal, new THREE.TorusGeometry(1.25, 0.045, 16, 96), this.materials.warmGlow, [0, 1.42, -0.72], false, false);
    this.goalRing.rotation.x = Math.PI / 2;
    this.goalRing.scale.setScalar(0.92);
    for (const course of COURSE_IDS) {
      const rail = addMesh(goal, createTubeRail(this.returnCurves[course], 0.075, 120, 16), course === "B" ? this.materials.brass : this.materials.chrome, [0, 0, 0]);
      rail.castShadow = true;
    }
    const goalLabel = createLabelSprite("COMMON GOAL", "#f2c26e", 2.2, 0.4);
    goalLabel.position.set(0, 0.55, 1.9);
    goal.add(goalLabel);
    this.machineGroup.add(goal);
  }

  private createHelixCurve(): THREE.CatmullRomCurve3 {
    const points: THREE.Vector3[] = [new THREE.Vector3(COURSE_X.A, 8.12, 0)];
    for (let index = 0; index <= 128; index += 1) {
      const progress = index / 128;
      const angle = -Math.PI * 0.5 + progress * Math.PI * 4.7;
      points.push(new THREE.Vector3(
        COURSE_X.A + Math.cos(angle) * 1.18,
        7.64 - progress * 3.14,
        Math.sin(angle) * 0.88,
      ));
    }
    return createCurve(points);
  }

  private createSwitchbackCurve(): THREE.CatmullRomCurve3 {
    return createCurve([
      new THREE.Vector3(COURSE_X.B, 8.12, 0),
      new THREE.Vector3(COURSE_X.B + 0.62, 7.75, 0),
      new THREE.Vector3(COURSE_X.B - 1.52, 7.2, 0.1),
      new THREE.Vector3(COURSE_X.B + 1.38, 6.57, 0.05),
      new THREE.Vector3(COURSE_X.B - 1.15, 5.92, 0.1),
      new THREE.Vector3(COURSE_X.B + 0.86, 5.46, 0),
      new THREE.Vector3(COURSE_X.B - 0.58, 5.08, 0.2),
      new THREE.Vector3(COURSE_X.B, 4.68, 0.34),
    ]);
  }

  private configureLights(): void {
    const key = new THREE.DirectionalLight(0xffe9c4, 4.6);
    key.position.set(4.8, 14, 11);
    key.target.position.set(0, 4.2, 0);
    key.castShadow = true;
    this.scene.add(key, key.target);
    const softKey = new THREE.SpotLight(0xc4e6ff, 18, 28, Math.PI / 5, 0.5, 1.1);
    softKey.position.set(-8, 10, 8);
    softKey.target.position.set(-2, 4, 0);
    softKey.castShadow = true;
    this.scene.add(softKey, softKey.target);
    const fill = new THREE.HemisphereLight(0x8ab7d0, 0x10151d, 2.1);
    this.scene.add(fill);
    const rim = new THREE.PointLight(0x7fd6e5, 18, 22, 2);
    rim.position.set(0, 7.2, -6.4);
    this.scene.add(rim);
    const warm = new THREE.PointLight(0xffa34f, 11, 12, 2);
    warm.position.set(0, 2.2, 3.2);
    this.scene.add(warm);
  }

  private configureShadowQuality(): void {
    this.scene.traverse((object) => {
      if ((object instanceof THREE.DirectionalLight || object instanceof THREE.SpotLight || object instanceof THREE.PointLight) && object.castShadow) {
        object.shadow.mapSize.set(this.quality.shadowMapSize, this.quality.shadowMapSize);
        object.shadow.bias = -0.00018;
        object.shadow.normalBias = 0.016;
      }
    });
  }

  private configureCamera(width: number, height: number): void {
    const preset = getCameraPreset(this.sequenceState.course, this.sequenceState.phase, width, height, this.reducedMotion);
    this.camera.fov = preset.fov;
    this.camera.aspect = Math.max(0.1, width / Math.max(1, height));
    this.camera.near = 0.1;
    this.camera.far = 80;
    this.camera.updateProjectionMatrix();
    this.camera.position.set(...preset.position);
    this.camera.lookAt(...preset.target);
  }

  private resize(): void {
    if (!this.renderer || this.disposed) {
      return;
    }
    const { width, height } = this.getViewportSize();
    const drawingBuffer = getDrawingBufferSize(width, height, window.devicePixelRatio || 1, this.quality);
    this.renderer.setPixelRatio(drawingBuffer.pixelRatio);
    this.renderer.setSize(width, height, false);
    this.camera.aspect = Math.max(0.1, width / Math.max(1, height));
    this.camera.updateProjectionMatrix();
    this.renderOnce();
  }

  private renderOnce(): void {
    if (!this.renderer || this.disposed) {
      return;
    }
    this.renderer.render(this.scene, this.camera);
  }

  private renderFrame(time: number): void {
    if (!this.renderer || this.disposed || !this.pageVisible || !this.inViewport) {
      return;
    }
    const delta = this.lastTime > 0 ? Math.min(0.05, Math.max(0, (time - this.lastTime) / 1000)) : 0;
    this.lastTime = time;
    this.idleTime += delta;
    this.updateSelector(delta);
    this.updateSequence(delta);
    this.updateMechanisms(delta);
    this.updateCamera(delta);
    this.renderer.render(this.scene, this.camera);
    this.updateLoopState();
  }

  private updateSelector(delta: number): void {
    if (this.selectorState.phase === "settled") {
      return;
    }
    const result = advanceSelector(this.selectorState, delta, this.reducedMotion);
    this.selectorState = result.state;
    this.updateSelectorVisuals();
    if (result.settled) {
      this.sequenceState = createInitialSequence(this.selectorState.currentCourse);
      this.publishState(true);
    } else {
      this.publishState(false);
    }
  }

  private updateSequence(delta: number): void {
    if (this.sequenceState.phase !== "running") {
      return;
    }
    const result = advanceSequence(this.sequenceState, delta);
    this.sequenceState = result.state;
    if (result.enteredStages.length > 0 || result.completed) {
      this.publishState(true);
    }
    if (result.completed) {
      this.completePulse = 0;
      this.cameraFrom = this.getCurrentCameraPreset();
      const viewport = this.getViewportSize();
      this.cameraTo = getHeroCamera(viewport.width, viewport.height);
      this.cameraProgress = this.reducedMotion ? 1 : 0;
    }
  }

  private updateMechanisms(delta: number): void {
    const idleRotation = delta * (this.reducedMotion ? 0.02 : 0.18);
    this.gearGroups.forEach((gear, index) => {
      gear.rotation.z += idleRotation * (index === 1 ? -1.4 : index === 2 ? 2.1 : 0.8);
    });
    this.turbineGroup.rotation.z += idleRotation * 1.6;
    this.selectorGroup.rotation.y = 0.0015 * Math.sin(this.idleTime * 0.7);
    this.updateSelectorVisuals();
    if (this.sequenceState.phase === "running") {
      const progress = getRunProgress(this.sequenceState);
      const course = this.sequenceState.course;
      const position = this.getCourseBallPosition(course, progress, new THREE.Vector3());
      this.balls[course].position.copy(position);
      this.balls[course].visible = true;
      for (const other of COURSE_IDS) {
        if (other !== course) {
          this.balls[other].visible = false;
        }
      }
      this.physics?.advance(delta, { [course]: [position.x, position.y, position.z] as PhysicsVector }, this.pageVisible);
      this.updateCourseMechanism(course, progress);
    } else {
      for (const course of COURSE_IDS) {
        this.balls[course].visible = true;
        this.balls[course].position.set(COURSE_X[course], 8.13, 0);
      }
      this.secondMarble.visible = false;
      this.physics?.advance(delta, {}, this.pageVisible);
      if (this.sequenceState.phase === "complete") {
        this.completePulse = Math.min(1.2, this.completePulse + delta);
        this.goalBell.rotation.z = Math.sin(this.completePulse * 20) * Math.exp(-this.completePulse * 2.5) * 0.08;
      } else {
        this.completePulse = 0;
        this.goalBell.rotation.z = 0;
      }
    }
    this.goalRing.scale.setScalar(0.92 + Math.min(0.18, this.completePulse * 0.16));
    (this.goalRing.material as THREE.MeshBasicMaterial).opacity = this.completePulse > 0 ? 0.7 : 0.15;
  }

  private updateCourseMechanism(course: CourseId, progress: number): void {
    if (course === "A") {
      const rocker = clamp((progress - 0.42) / 0.14, 0, 1);
      this.rockerLever.rotation.z = -0.12 + smooth(rocker) * 0.56;
      this.dominoes.forEach((domino, index) => {
        const dominoProgress = clamp((progress - 0.54) / 0.24, 0, 1);
        const hit = clamp(dominoProgress * this.dominoes.length - index, 0, 1);
        domino.rotation.z = smooth(hit) * (index % 2 === 0 ? -1.15 : 1.05);
      });
      const hammerProgress = clamp((progress - 0.78) / 0.12, 0, 1);
      this.hammerGroup.rotation.z = smooth(hammerProgress) * -1.15;
    } else if (course === "B") {
      const pendulumProgress = clamp((progress - 0.3) / 0.17, 0, 1);
      this.pendulumGroup.rotation.z = Math.sin(this.idleTime * 3.4) * 0.34 * smooth(pendulumProgress);
      const gateProgress = clamp((progress - 0.66) / 0.16, 0, 1);
      this.liftGate.position.y = 3.58 + smooth(gateProgress) * 0.84;
    } else {
      const balanceProgress = clamp((progress - 0.3) / 0.22, 0, 1);
      this.balanceGroup.rotation.z = -0.38 * smooth(balanceProgress);
      this.secondMarble.visible = progress > 0.47;
      if (this.secondMarble.visible) {
        const orbitProgress = clamp((progress - 0.54) / 0.26, 0, 1);
        this.secondMarble.position.copy(this.orbitCurve.getPointAt(orbitProgress));
      }
    }
  }

  private updateSelectorVisuals(): void {
    const offset = getSelectorOffset(this.selectorState);
    this.selectorPlatform.position.x = offset;
    this.selectorLockPin.position.y = this.selectorState.lockEngaged ? -0.4 : -0.12;
    this.selectorLamp.position.x = 0;
    const selected = this.selectorState.targetCourse;
    for (const course of COURSE_IDS) {
      const material = this.indicatorMaterials[course];
      const active = course === selected && this.selectorState.phase === "settled";
      material.emissiveIntensity = active ? 2.6 : course === selected ? 0.7 : 0.04;
    }
    this.selectorLamp.material = this.selectorState.phase === "settled" ? this.materials.warmGlow : this.materials.coolGlow;
  }

  private updateCamera(delta: number): void {
    if (!this.renderer) {
      return;
    }
    if (this.cameraProgress < 1) {
      this.cameraProgress = Math.min(1, this.cameraProgress + delta / (this.reducedMotion ? 0.08 : 0.9));
      const from = this.cameraFrom;
      const to = this.cameraTo;
      const t = smooth(this.cameraProgress);
      this.camera.position.set(
        from.position[0] + (to.position[0] - from.position[0]) * t,
        from.position[1] + (to.position[1] - from.position[1]) * t,
        from.position[2] + (to.position[2] - from.position[2]) * t,
      );
      this.camera.fov = from.fov + (to.fov - from.fov) * t;
      this.camera.updateProjectionMatrix();
      this.camera.lookAt(
        from.target[0] + (to.target[0] - from.target[0]) * t,
        from.target[1] + (to.target[1] - from.target[1]) * t,
        from.target[2] + (to.target[2] - from.target[2]) * t,
      );
    } else if (this.sequenceState.phase === "running" && !this.reducedMotion) {
      const viewport = this.getViewportSize();
      const targetPreset = getFocusCamera(this.sequenceState.course, viewport.width, viewport.height);
      this.camera.position.lerp(new THREE.Vector3(...targetPreset.position), 1 - Math.pow(0.001, delta));
      this.camera.lookAt(...targetPreset.target);
    } else if (this.sequenceState.phase !== "running") {
      const viewport = this.getViewportSize();
      const targetPreset = getHeroCamera(viewport.width, viewport.height);
      this.camera.position.lerp(new THREE.Vector3(...targetPreset.position), 1 - Math.pow(0.001, delta));
      this.camera.lookAt(...targetPreset.target);
    }
  }

  private getCourseBallPosition(course: CourseId, progress: number, target: THREE.Vector3): THREE.Vector3 {
    const p = clamp(progress, 0, 1);
    const start = new THREE.Vector3(COURSE_X[course], 8.13, 0);
    if (course === "A") {
      if (p < 0.07) return lerpVector(target, start, this.helixCurve.getPointAt(0), p / 0.07);
      if (p < 0.44) return target.copy(this.helixCurve.getPointAt((p - 0.07) / 0.37));
      if (p < 0.56) return lerpVector(target, this.helixCurve.getPointAt(1), this.dominoCurve.getPointAt(0), (p - 0.44) / 0.12);
      if (p < 0.78) return target.copy(this.dominoCurve.getPointAt((p - 0.56) / 0.22));
      if (p < 0.88) return lerpVector(target, this.dominoCurve.getPointAt(1), this.returnCurves.A.getPointAt(0), (p - 0.78) / 0.1);
      return target.copy(this.returnCurves.A.getPointAt((p - 0.88) / 0.12));
    }
    if (course === "B") {
      if (p < 0.1) return lerpVector(target, start, this.switchbackCurve.getPointAt(0), p / 0.1);
      if (p < 0.48) return target.copy(this.switchbackCurve.getPointAt((p - 0.1) / 0.38));
      if (p < 0.65) return lerpVector(target, this.switchbackCurve.getPointAt(1), new THREE.Vector3(1.2, 3.75, 0.18), (p - 0.48) / 0.17);
      if (p < 0.82) return lerpVector(target, new THREE.Vector3(1.2, 3.75, 0.18), new THREE.Vector3(0.15, 2.62, 0.1), (p - 0.65) / 0.17);
      if (p < 0.9) return lerpVector(target, new THREE.Vector3(0.15, 2.62, 0.1), this.returnCurves.B.getPointAt(0), (p - 0.82) / 0.08);
      return target.copy(this.returnCurves.B.getPointAt((p - 0.9) / 0.1));
    }
    if (p < 0.1) return lerpVector(target, start, this.funnelFeedCurve.getPointAt(0), p / 0.1);
    if (p < 0.28) return target.copy(this.funnelFeedCurve.getPointAt((p - 0.1) / 0.18));
    if (p < 0.49) return target.copy(this.funnelSpiralCurve.getPointAt((p - 0.28) / 0.21));
    if (p < 0.63) return lerpVector(target, this.funnelSpiralCurve.getPointAt(1), new THREE.Vector3(COURSE_X.C, 3.86, 0), (p - 0.49) / 0.14);
    if (p < 0.84) return target.copy(this.orbitCurve.getPointAt((p - 0.63) / 0.21));
    if (p < 0.9) return lerpVector(target, this.orbitCurve.getPointAt(1), this.returnCurves.C.getPointAt(0), (p - 0.84) / 0.06);
    return target.copy(this.returnCurves.C.getPointAt((p - 0.9) / 0.1));
  }

  private resetSequence(): void {
    this.sequenceState = createInitialSequence(this.selectorState.currentCourse);
    this.physics?.reset();
    this.completePulse = 0;
    this.rockerLever.rotation.z = -0.12;
    this.hammerGroup.rotation.z = 0;
    this.pendulumGroup.rotation.z = 0;
    this.liftGate.position.y = 3.58;
    this.balanceGroup.rotation.z = 0;
    this.secondMarble.visible = false;
    this.dominoes.forEach((domino) => { domino.rotation.z = 0; });
    this.goalBell.rotation.z = 0;
    this.publishState(true);
  }

  private getCurrentCameraPreset(): CameraPreset {
    const viewport = this.getViewportSize();
    return getCameraPreset(this.sequenceState.course, this.sequenceState.phase, viewport.width, viewport.height, this.reducedMotion);
  }

  private getViewportSize(): { readonly width: number; readonly height: number } {
    const rect = this.container.getBoundingClientRect();
    return { width: Math.max(1, rect.width || window.innerWidth), height: Math.max(1, rect.height || window.innerHeight) };
  }

  private updateLoopState(): void {
    if (!this.renderer || this.disposed || !this.pageVisible || !this.inViewport) {
      this.renderer?.setAnimationLoop(null);
      this.animationLoopActive = false;
      return;
    }
    const shouldAnimate = !this.reducedMotion || this.sequenceState.phase === "running" || this.selectorState.phase !== "settled" || this.completePulse > 0;
    if (shouldAnimate && !this.animationLoopActive) {
      this.animationLoopActive = true;
      this.lastTime = 0;
      this.renderer.setAnimationLoop(this.render);
    } else if (!shouldAnimate && this.animationLoopActive) {
      this.renderer.setAnimationLoop(null);
      this.animationLoopActive = false;
    }
  }

  private publishState(force: boolean): void {
    const definition = COURSE_DEFINITIONS[this.selectorState.targetCourse];
    const stage = getCurrentStage(this.sequenceState);
    const statusText = this.sequenceState.phase === "complete"
      ? `${definition.name} COMPLETE`
      : this.selectorState.phase !== "settled"
        ? `ROUTE SELECTOR ${this.selectorState.phase.toUpperCase()}`
        : this.sequenceState.phase === "running"
          ? `${definition.name} ${this.sequenceState.stageIndex + 1} / ${definition.stages.length} ${stage.label}`
          : `${definition.name} READY`;
    const state: MachineUiState = {
      runtimeStatus: this.physics ? "ready" : "loading",
      backend: this.backend,
      selectedCourse: this.selectorState.targetCourse,
      selectorPhase: this.selectorState.phase,
      selectorMoving: this.selectorState.phase !== "settled",
      sequencePhase: this.sequenceState.phase,
      stageLabel: stage.label,
      stageIndex: this.sequenceState.stageIndex,
      stageCount: definition.stages.length,
      canStart: Boolean(this.physics) && this.sequenceState.phase === "ready" && isSelectorReady(this.selectorState, this.sequenceState.course),
      statusText,
    };
    const key = [state.runtimeStatus, state.backend, state.selectedCourse, state.selectorPhase, state.sequencePhase, state.stageIndex, state.statusText].join("|");
    if (force || key !== this.lastUiKey) {
      this.lastUiKey = key;
      this.options.onStateChange?.(state);
    }
  }
}
