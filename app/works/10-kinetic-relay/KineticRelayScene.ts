import * as THREE from "three";
import { WebGPURenderer } from "three/webgpu";

import {
  COURSE_DEFINITIONS,
  COURSE_IDS,
  advanceSequence,
  createInitialSequence,
  getCurrentStage,
  startSequence,
  type CourseId,
  type SequencePhase,
  type SequenceState,
} from "./machineSequence";
import {
  loadRapier,
  MachinePhysicsWorld,
  type PhysicsGuideMap,
  type PhysicsVector,
  type MarblePhysicsSnapshot,
} from "./machinePhysics";
import {
  advanceSelector,
  createSelectorState,
  isSelectorReady,
  startSelectorChange,
  type SelectorPhase,
  type SelectorState,
} from "./routeSelector";
import { getCameraPreset, getFocusCamera, getHeroCamera, getSelectorCamera, type CameraPreset } from "./cameraSequence";
import { getDrawingBufferSize, getQualityProfile, type QualityProfile } from "./qualityProfile";
import { COURSE_X, createMachineTracks, type MachineTracks } from "./courseTracks";
import { createFrameAssembly } from "./frameAssembly";
import { createSelectorAssembly, updateSelectorAssembly, type SelectorAssembly } from "./selectorAssembly";
import { createHelixAssembly, updateHelixAssembly, type HelixAssembly } from "./helixAssembly";
import { createClockworkAssembly, updateClockworkAssembly, type ClockworkAssembly } from "./clockworkAssembly";
import { createOrbitAssembly, updateOrbitAssembly, type OrbitAssembly } from "./orbitAssembly";
import { createGoalAssembly, updateGoalAssembly, type GoalAssembly } from "./goalAssembly";
import { getMechanismMotion, getPhysicsGuideTarget, getSecondaryPhysicsGuideTarget } from "./sequenceController";
import { createLabelSprite, createRoundedBlock } from "./machineGeometry";
import { createMachineMaterials, createStudioEnvironment, type MachineMaterials } from "./machineMaterials";
import { addMesh } from "./machinePrimitives";

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

const INITIAL_POSITIONS: Record<CourseId, PhysicsVector> = {
  A: [COURSE_X.A, 7.74, 0],
  B: [COURSE_X.B, 7.74, 0],
  C: [COURSE_X.C, 7.74, 0],
};
const SECONDARY_INITIAL: PhysicsVector = [COURSE_X.C - 0.78, 4.55, 0.28];

function disposeSceneResources(scene: THREE.Scene, environmentTexture: THREE.Texture | null): void {
  const geometries = new Set<THREE.BufferGeometry>();
  const materials = new Set<THREE.Material>();
  const textures = new Set<THREE.Texture>();
  const textureKeys = ["map", "roughnessMap", "normalMap", "metalnessMap", "emissiveMap", "alphaMap", "envMap"] as const;
  scene.traverse((object) => {
    if (object instanceof THREE.Mesh || object instanceof THREE.Line || object instanceof THREE.Points) {
      geometries.add(object.geometry);
      const objectMaterials = Array.isArray(object.material) ? object.material : [object.material];
      for (const material of objectMaterials) {
        materials.add(material);
        for (const key of textureKeys) {
          const texture = material[key];
          if (texture instanceof THREE.Texture) textures.add(texture);
        }
      }
    }
    if (object instanceof THREE.Sprite) {
      geometries.add(object.geometry);
      const material = object.material as THREE.SpriteMaterial;
      materials.add(material);
      if (material.map) textures.add(material.map);
    }
  });
  geometries.forEach((geometry) => geometry.dispose());
  materials.forEach((material) => material.dispose());
  textures.forEach((texture) => texture.dispose());
  environmentTexture?.dispose();
}

export class KineticRelayScene {
  private readonly container: HTMLElement;
  private readonly scene = new THREE.Scene();
  private readonly camera = new THREE.PerspectiveCamera(34, 1, 0.1, 90);
  private readonly root = new THREE.Group();
  private readonly tracks: MachineTracks;
  private readonly materials: MachineMaterials;
  private readonly environmentTexture: THREE.Texture;
  private readonly frame: ReturnType<typeof createFrameAssembly>;
  private readonly selector: SelectorAssembly;
  private readonly helix: HelixAssembly;
  private readonly clockwork: ClockworkAssembly;
  private readonly orbit: OrbitAssembly;
  private readonly goal: GoalAssembly;
  private readonly balls: Record<CourseId, THREE.Mesh>;
  private readonly secondMarble: THREE.Mesh;
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
  private completePulse = 0;
  private backend: RendererBackend | "pending" = "pending";
  private cameraFrom: CameraPreset = getHeroCamera(1440, 900);
  private cameraTo: CameraPreset = this.cameraFrom;
  private cameraProgress = 1;
  private readonly cameraTarget = new THREE.Vector3();
  private readonly guideTarget = new THREE.Vector3();
  private readonly secondaryTarget = new THREE.Vector3();
  private lastUiKey = "";

  private readonly render = (time: number): void => this.renderFrame(time);

  public constructor(container: HTMLElement, options: KineticRelaySceneOptions) {
    this.container = container;
    this.options = options;
    this.reducedMotion = options.reducedMotion;
    this.environmentTexture = createStudioEnvironment();
    this.scene.environment = this.environmentTexture;
    this.scene.background = new THREE.Color(0x070d14);
    this.scene.fog = new THREE.Fog(0x070d14, 17, 38);
    this.materials = createMachineMaterials(this.environmentTexture);
    this.tracks = createMachineTracks();
    this.frame = createFrameAssembly(this.materials);
    this.selector = createSelectorAssembly(this.materials);
    this.helix = createHelixAssembly(this.tracks, this.materials, 188, 20);
    this.clockwork = createClockworkAssembly(this.tracks, this.materials, 168, 18);
    this.orbit = createOrbitAssembly(this.tracks, this.materials, 176, 20);
    this.goal = createGoalAssembly(this.tracks, this.materials, 150, 18);
    this.root.add(this.frame.group, this.selector.group, this.helix.group, this.clockwork.group, this.orbit.group, this.goal.group);
    this.scene.add(this.root);
    this.addCourseMarkers();
    this.balls = {
      A: this.createMarble(this.materials.chrome, "marble-helix"),
      B: this.createMarble(this.materials.brassBright, "marble-clockwork"),
      C: this.createMarble(this.materials.chrome, "marble-orbit"),
    };
    for (const course of COURSE_IDS) {
      this.balls[course].position.set(...INITIAL_POSITIONS[course]);
      this.root.add(this.balls[course]);
    }
    this.secondMarble = this.createMarble(this.materials.ivory, "marble-secondary");
    this.secondMarble.position.set(...SECONDARY_INITIAL);
    this.secondMarble.visible = false;
    this.root.add(this.secondMarble);
    this.updateSelectorVisuals();
    this.updateMechanisms();
    this.camera.position.set(...this.cameraFrom.position);
    this.camera.lookAt(...this.cameraFrom.target);
    this.publishState(true);
  }

  public async init(): Promise<KineticRelayInitResult> {
    this.options.onLoadingState?.("Building studio lighting");
    const viewport = this.getViewportSize();
    this.quality = getQualityProfile(viewport.width, viewport.height, window.devicePixelRatio || 1);
    this.configureLights();
    this.renderer = await this.createRenderer();
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.05;
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.configureShadowQuality();
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
    this.options.onLoadingState?.("Loading rigid-body simulation");
    const rapier = await loadRapier();
    if (this.disposed) {
      return { backend: this.backend === "pending" ? "WebGL 2 fallback" : this.backend, rapierReady: false, triangles: 0, drawCalls: 0, geometries: 0, textures: 0 };
    }
    this.physics = new MachinePhysicsWorld(rapier);
    this.options.onLoadingState?.("Ready");
    this.syncMarbleVisuals();
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
    if (this.disposed || this.sequenceState.phase === "running" || this.selectorState.phase !== "settled") return;
    if (course === this.selectorState.currentCourse) {
      if (this.sequenceState.phase === "complete") this.resetSequence();
      return;
    }
    this.sequenceState = createInitialSequence(course);
    this.physics?.reset();
    this.selectorState = startSelectorChange(this.selectorState, course);
    this.cameraFrom = this.getCurrentCameraPreset();
    const viewport = this.getViewportSize();
    this.cameraTo = getSelectorCamera(viewport.width, viewport.height);
    this.cameraProgress = 0;
    this.updateSelectorVisuals();
    this.publishState(true);
    this.updateLoopState();
  }

  public start(): void {
    if (this.disposed || this.sequenceState.phase !== "ready" || !isSelectorReady(this.selectorState, this.sequenceState.course)) return;
    this.physics?.reset();
    this.sequenceState = startSequence(this.sequenceState);
    this.cameraFrom = this.getCurrentCameraPreset();
    const viewport = this.getViewportSize();
    this.cameraTo = getFocusCamera(this.sequenceState.course, viewport.width, viewport.height);
    this.cameraProgress = this.reducedMotion ? 1 : 0;
    this.publishState(true);
    this.updateLoopState();
  }

  public restart(): void {
    if (this.disposed || this.selectorState.phase !== "settled") return;
    this.resetSequence();
    this.cameraFrom = this.getCurrentCameraPreset();
    const viewport = this.getViewportSize();
    this.cameraTo = getHeroCamera(viewport.width, viewport.height);
    this.cameraProgress = this.reducedMotion ? 1 : 0;
    this.publishState(true);
    this.updateLoopState();
  }

  public setReducedMotion(enabled: boolean): void {
    this.reducedMotion = enabled;
    if (enabled) this.cameraProgress = 1;
    this.updateLoopState();
    this.publishState(true);
  }

  public dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.animationLoopActive = false;
    this.renderer?.setAnimationLoop(null);
    this.resizeObserver?.disconnect();
    this.intersectionObserver?.disconnect();
    window.removeEventListener("resize", this.handleResize);
    document.removeEventListener("visibilitychange", this.handleVisibility);
    this.physics?.dispose();
    this.physics = null;
    this.renderer?.domElement.remove();
    disposeSceneResources(this.scene, this.environmentTexture);
    this.renderer?.dispose();
    this.renderer = null;
  }

  private createRenderer(): Promise<Renderer> {
    return new Promise((resolve) => {
      void (async () => {
        try {
          const renderer = new WebGPURenderer({ antialias: this.quality.antialias, alpha: false });
          await renderer.init();
          this.backend = "WebGPU";
          resolve(renderer);
        } catch {
          const renderer = new THREE.WebGLRenderer({ antialias: this.quality.antialias, alpha: false });
          this.backend = "WebGL 2 fallback";
          resolve(renderer);
        }
      })();
    });
  }

  private createMarble(material: THREE.Material, name: string): THREE.Mesh {
    const marble = new THREE.Mesh(new THREE.SphereGeometry(0.23, 48, 32), material);
    marble.name = name;
    marble.castShadow = true;
    marble.receiveShadow = true;
    return marble;
  }

  private addCourseMarkers(): void {
    const colors: Record<CourseId, string> = { A: "#82d6ec", B: "#f0bf70", C: "#9beff0" };
    for (const course of COURSE_IDS) {
      const label = createLabelSprite(`${course}  ${COURSE_DEFINITIONS[course].name}`, colors[course], 2.24, 0.42);
      label.position.set(COURSE_X[course], 8.62, 1.65);
      this.root.add(label);
      const plate = addMesh(this.root, createRoundedBlock(2.72, 0.05, 0.28, 0.015, 2), this.materials.graphite, [COURSE_X[course], 8.28, 1.55], false, false);
      plate.rotation.x = -Math.PI * 0.08;
    }
  }

  private configureLights(): void {
    const key = new THREE.SpotLight(0xffe8c4, 76, 38, Math.PI / 5, 0.68, 1.2);
    key.position.set(7.8, 14.5, 10.5);
    key.target.position.set(0, 4.6, 0);
    key.castShadow = true;
    this.scene.add(key, key.target);
    const fill = new THREE.SpotLight(0xafdff1, 42, 30, Math.PI / 4.6, 0.8, 1.1);
    fill.position.set(-10.5, 9.0, 8.4);
    fill.target.position.set(-2.5, 4.2, 0.2);
    fill.castShadow = true;
    this.scene.add(fill, fill.target);
    const rim = new THREE.SpotLight(0x72c9d7, 58, 34, Math.PI / 4.2, 0.7, 1.2);
    rim.position.set(0, 10.5, -8.8);
    rim.target.position.set(0, 4.7, -0.8);
    rim.castShadow = true;
    this.scene.add(rim, rim.target);
    const brassAccent = new THREE.PointLight(0xffad56, 20, 14, 2);
    brassAccent.position.set(0, 2.5, 3.7);
    this.scene.add(brassAccent);
    const selectorAccent = new THREE.PointLight(0x79d9e4, 11, 9, 2);
    selectorAccent.position.set(0, 7.9, 2.5);
    this.scene.add(selectorAccent);
    this.scene.add(new THREE.HemisphereLight(0x8baec4, 0x080c12, 1.65));
  }

  private configureShadowQuality(): void {
    this.scene.traverse((object) => {
      if ((object instanceof THREE.SpotLight || object instanceof THREE.DirectionalLight || object instanceof THREE.PointLight) && object.castShadow) {
        object.shadow.mapSize.set(this.quality.shadowMapSize, this.quality.shadowMapSize);
        object.shadow.bias = -0.00016;
        object.shadow.normalBias = 0.014;
      }
    });
  }

  private resize(): void {
    if (!this.renderer || this.disposed) return;
    const { width, height } = this.getViewportSize();
    const drawingBuffer = getDrawingBufferSize(width, height, window.devicePixelRatio || 1, this.quality);
    this.renderer.setPixelRatio(drawingBuffer.pixelRatio);
    this.renderer.setSize(width, height, false);
    this.camera.aspect = Math.max(0.1, width / Math.max(1, height));
    this.camera.updateProjectionMatrix();
    this.renderOnce();
  }

  private renderOnce(): void {
    if (!this.renderer || this.disposed) return;
    this.renderer.render(this.scene, this.camera);
  }

  private renderFrame(time: number): void {
    if (!this.renderer || this.disposed || !this.pageVisible || !this.inViewport) return;
    const delta = this.lastTime > 0 ? Math.min(0.05, Math.max(0, (time - this.lastTime) / 1000)) : 0;
    this.lastTime = time;
    this.updateSelector(delta);
    this.updateSequence(delta);
    this.advancePhysics(delta);
    this.updateMechanisms();
    this.updateCamera(delta);
    this.renderer.render(this.scene, this.camera);
    this.updateLoopState();
  }

  private updateSelector(delta: number): void {
    if (this.selectorState.phase === "settled") return;
    const result = advanceSelector(this.selectorState, delta, this.reducedMotion);
    this.selectorState = result.state;
    this.updateSelectorVisuals();
    if (result.settled) {
      this.sequenceState = createInitialSequence(this.selectorState.currentCourse);
      this.physics?.reset();
      this.cameraFrom = getSelectorCamera(this.getViewportSize().width, this.getViewportSize().height);
      this.cameraTo = getHeroCamera(this.getViewportSize().width, this.getViewportSize().height);
      this.cameraProgress = this.reducedMotion ? 1 : 0;
      this.publishState(true);
    } else {
      this.publishState(false);
    }
  }

  private updateSequence(delta: number): void {
    if (this.sequenceState.phase !== "running") return;
    const result = advanceSequence(this.sequenceState, delta);
    this.sequenceState = result.state;
    if (result.enteredStages.length > 0 || result.completed) this.publishState(true);
    if (result.completed) {
      this.completePulse = 0;
      this.cameraFrom = this.getCurrentCameraPreset();
      this.cameraTo = getHeroCamera(this.getViewportSize().width, this.getViewportSize().height);
      this.cameraProgress = this.reducedMotion ? 1 : 0;
    }
  }

  private advancePhysics(delta: number): void {
    if (!this.physics) return;
    if (this.sequenceState.phase !== "running") {
      const targets: PhysicsGuideMap = this.sequenceState.phase === "ready"
        ? { A: INITIAL_POSITIONS.A, B: INITIAL_POSITIONS.B, C: INITIAL_POSITIONS.C, secondary: SECONDARY_INITIAL }
        : {};
      this.physics.advance(delta, targets, this.pageVisible);
      this.syncMarbleVisuals();
      return;
    }
    const course = this.sequenceState.course;
    const target = getPhysicsGuideTarget(this.sequenceState, this.tracks, this.guideTarget);
    const secondary = getSecondaryPhysicsGuideTarget(this.sequenceState, this.tracks, this.secondaryTarget);
    this.physics.advance(delta, { [course]: target, secondary } as PhysicsGuideMap, this.pageVisible);
    this.syncMarbleVisuals();
  }

  private syncMarbleVisuals(): void {
    const course = this.sequenceState.course;
    for (const id of COURSE_IDS) {
      const snapshot = this.physics?.getSnapshot(id) ?? this.snapshotFromPosition(INITIAL_POSITIONS[id]);
      this.applySnapshot(this.balls[id], snapshot);
      this.balls[id].visible = this.sequenceState.phase === "ready" || (this.sequenceState.phase !== "complete" && id === course) || (this.sequenceState.phase === "complete" && id === course);
    }
    const secondarySnapshot = this.physics?.getSnapshot("secondary") ?? this.snapshotFromPosition(SECONDARY_INITIAL);
    this.applySnapshot(this.secondMarble, secondarySnapshot);
    this.secondMarble.visible = course === "C" && this.sequenceState.phase === "running" && getMechanismMotion(this.sequenceState).secondMarble;
  }

  private snapshotFromPosition(position: PhysicsVector): MarblePhysicsSnapshot {
    return { x: position[0], y: position[1], z: position[2], vx: 0, vy: 0, vz: 0 };
  }

  private applySnapshot(mesh: THREE.Mesh, snapshot: MarblePhysicsSnapshot): void {
    mesh.position.set(snapshot.x, snapshot.y, snapshot.z);
    const speed = Math.min(1, Math.hypot(snapshot.vx, snapshot.vy, snapshot.vz) / 8.8);
    mesh.rotation.x += -snapshot.vz * 0.012;
    mesh.rotation.z += snapshot.vx * 0.012;
    mesh.scale.setScalar(0.98 + speed * 0.025);
  }

  private updateMechanisms(): void {
    const motion = getMechanismMotion(this.sequenceState);
    const isA = this.sequenceState.course === "A";
    const isB = this.sequenceState.course === "B";
    const isC = this.sequenceState.course === "C";
    updateHelixAssembly(this.helix, isA ? motion : { release: 0, rocker: 0, paddleBank: 0, hammer: 0 });
    updateClockworkAssembly(this.clockwork, isB ? motion : { pendulum: 0, gearTrain: 0, rack: 0, gate: 0, drop: 0 });
    updateOrbitAssembly(this.orbit, isC ? motion : { balance: 0, turbine: 0, funnel: 0 });
    if (this.sequenceState.phase === "complete") this.completePulse = Math.min(1, this.completePulse + 0.035);
    else this.completePulse = 0;
    updateGoalAssembly(this.goal, this.completePulse);
    this.syncMarbleVisuals();
  }

  private updateSelectorVisuals(): void {
    updateSelectorAssembly(this.selector, this.selectorState, this.reducedMotion);
  }

  private updateCamera(delta: number): void {
    const viewport = this.getViewportSize();
    if (this.cameraProgress < 1) {
      this.cameraProgress = Math.min(1, this.cameraProgress + delta / (this.reducedMotion ? 0.08 : 0.75));
      const t = this.cameraProgress * this.cameraProgress * (3 - 2 * this.cameraProgress);
      this.camera.position.set(
        this.cameraFrom.position[0] + (this.cameraTo.position[0] - this.cameraFrom.position[0]) * t,
        this.cameraFrom.position[1] + (this.cameraTo.position[1] - this.cameraFrom.position[1]) * t,
        this.cameraFrom.position[2] + (this.cameraTo.position[2] - this.cameraFrom.position[2]) * t,
      );
      this.camera.fov = this.cameraFrom.fov + (this.cameraTo.fov - this.cameraFrom.fov) * t;
      this.cameraTarget.set(
        this.cameraFrom.target[0] + (this.cameraTo.target[0] - this.cameraFrom.target[0]) * t,
        this.cameraFrom.target[1] + (this.cameraTo.target[1] - this.cameraFrom.target[1]) * t,
        this.cameraFrom.target[2] + (this.cameraTo.target[2] - this.cameraFrom.target[2]) * t,
      );
      this.camera.lookAt(this.cameraTarget);
      this.camera.updateProjectionMatrix();
      return;
    }
    const targetPreset = this.sequenceState.phase === "running"
      ? getCameraPreset(this.sequenceState.course, this.sequenceState.phase, viewport.width, viewport.height, this.reducedMotion, this.sequenceState.totalElapsed)
      : getHeroCamera(viewport.width, viewport.height);
    const smoothing = this.reducedMotion ? 1 : 1 - Math.exp(-delta * 2.8);
    this.camera.position.lerp(new THREE.Vector3(...targetPreset.position), smoothing);
    this.camera.fov += (targetPreset.fov - this.camera.fov) * smoothing;
    this.cameraTarget.lerp(new THREE.Vector3(...targetPreset.target), smoothing);
    this.camera.lookAt(this.cameraTarget);
    this.camera.updateProjectionMatrix();
  }

  private resetSequence(): void {
    this.sequenceState = createInitialSequence(this.selectorState.currentCourse);
    this.physics?.reset();
    this.completePulse = 0;
    this.updateSelectorVisuals();
    this.updateMechanisms();
    this.syncMarbleVisuals();
    this.publishState(true);
  }

  private getCurrentCameraPreset(): CameraPreset {
    const viewport = this.getViewportSize();
    return getCameraPreset(this.sequenceState.course, this.sequenceState.phase, viewport.width, viewport.height, this.reducedMotion, this.sequenceState.totalElapsed);
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
    const shouldAnimate = this.cameraProgress < 1 || this.sequenceState.phase === "running" || this.selectorState.phase !== "settled" || this.completePulse > 0;
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
