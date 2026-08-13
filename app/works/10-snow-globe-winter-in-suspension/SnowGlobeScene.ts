import * as THREE from "three";
import { WebGPURenderer } from "three/webgpu";

import {
  clamp,
  classifyGesture,
  expApproach,
  getDrawingBufferSize,
  getFlowVector,
  getLayerConfig,
  getQualityProfile,
  getShakeImpulse,
  reflectVelocity,
  releaseAccumulation,
  updateAccumulation,
  type AccumulationState,
  type ParticleLayer,
  type QualityProfile,
  type ShakeImpulse,
} from "./snowGlobeMath";

const GLOBE_CENTER_Y = 3.34;
const GLOBE_RADIUS = 2.48;
const INNER_RADIUS = 2.3;
const GROUND_Y = -1.62;
const HUT_X = 0.26;
const HUT_Z = 0.28;
const HUT_ROOF_Z_MIN = -0.48;
const HUT_ROOF_Z_MAX = 0.9;
const TREE_X = -1.06;
const TREE_Z = -0.36;

type BackendLabel = "webgpu" | "webgl2";

export type SnowGlobeSceneOptions = {
  readonly reducedMotion: boolean;
  readonly onStatusChange?: (status: SceneStatus) => void;
};

export type SnowGlobeSceneInitResult = {
  readonly webGpuApiAvailable: boolean;
  readonly backend: BackendLabel;
};

export type SceneStatus = "loading" | "quiet" | "turning" | "swirling";

type Particle = {
  readonly layer: ParticleLayer;
  readonly phase: number;
  readonly seed: number;
  readonly scale: number;
  readonly position: THREE.Vector3;
  readonly velocity: THREE.Vector3;
  settled: boolean;
  surface: "roof" | "branches" | "ground" | null;
};

type ParticleBucket = {
  readonly particles: Particle[];
  readonly mesh: THREE.InstancedMesh | THREE.Points;
  readonly geometry: THREE.BufferGeometry;
};

type SurfaceHit = {
  readonly surface: "roof" | "branches" | "ground";
  readonly normal: THREE.Vector3;
};

function seededRandom(seed: number): number {
  let value = seed + 0x6d2b79f5;
  value = Math.imul(value ^ (value >>> 15), value | 1);
  value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
  return ((value ^ (value >>> 14)) >>> 0) / 4_294_967_296;
}

function randomSigned(seed: number): number {
  return seededRandom(seed) * 2 - 1;
}

function addMesh(
  parent: THREE.Object3D,
  geometry: THREE.BufferGeometry,
  material: THREE.Material,
  position: readonly [number, number, number] = [0, 0, 0],
): THREE.Mesh {
  const mesh = new THREE.Mesh(geometry, material);
  mesh.position.set(...position);
  parent.add(mesh);
  return mesh;
}

function createWoodMaterial(color: number, roughness: number): THREE.MeshStandardMaterial {
  return new THREE.MeshStandardMaterial({
    color,
    roughness,
    metalness: 0.04,
  });
}

function createSnowMaterial(color = 0xe8f2f7): THREE.MeshStandardMaterial {
  return new THREE.MeshStandardMaterial({
    color,
    roughness: 0.82,
    metalness: 0,
  });
}

function setOpacity(material: THREE.Material, opacity: number): void {
  const transparentMaterial = material as THREE.Material & { opacity?: number };
  if (typeof transparentMaterial.opacity === "number") {
    transparentMaterial.opacity = opacity;
    transparentMaterial.needsUpdate = true;
  }
}

function disposeSceneResources(scene: THREE.Scene): void {
  const geometries = new Set<THREE.BufferGeometry>();
  const materials = new Set<THREE.Material>();

  scene.traverse((object) => {
    if (
      object instanceof THREE.Mesh
      || object instanceof THREE.Line
      || object instanceof THREE.LineSegments
      || object instanceof THREE.Points
    ) {
      geometries.add(object.geometry);
      if (Array.isArray(object.material)) {
        object.material.forEach((material) => materials.add(material));
      } else {
        materials.add(object.material);
      }
    }
  });

  geometries.forEach((geometry) => geometry.dispose());
  materials.forEach((material) => material.dispose());
}

export class SnowGlobeScene {
  private readonly container: HTMLElement;
  private readonly options: SnowGlobeSceneOptions;
  private readonly scene = new THREE.Scene();
  private readonly camera = new THREE.PerspectiveCamera(34, 1, 0.1, 40);
  private readonly globeGroup = new THREE.Group();
  private readonly worldGroup = new THREE.Group();
  private readonly particleGroup = new THREE.Group();
  private readonly flowGroup = new THREE.Group();
  private readonly particleBuckets: ParticleBucket[] = [];
  private readonly flowRings: THREE.Mesh[] = [];
  private readonly roofSnow: THREE.Mesh[] = [];
  private readonly branchSnow: THREE.Mesh[] = [];
  private readonly warmWindows: THREE.Mesh[] = [];
  private readonly pointerStart = new THREE.Vector2();
  private readonly pointerLast = new THREE.Vector2();
  private readonly tempMatrix = new THREE.Matrix4();
  private readonly tempQuaternion = new THREE.Quaternion();
  private readonly tempEuler = new THREE.Euler();
  private readonly tempVector = new THREE.Vector3();
  private readonly tempVectorB = new THREE.Vector3();
  private readonly targetRotation = new THREE.Vector3(0, 0, 0);
  private readonly rotationKick = new THREE.Vector3(0, 0, 0);
  private readonly flowVelocity = new THREE.Vector3(0, 0, 0);
  private readonly warmWindowMaterial = new THREE.MeshStandardMaterial({
    color: 0xffa451,
    emissive: 0xff6b25,
    emissiveIntensity: 4.4,
    roughness: 0.28,
    metalness: 0,
  });
  private readonly glitterMaterial = new THREE.MeshStandardMaterial({
    color: 0xd9c082,
    emissive: 0x4b3314,
    emissiveIntensity: 0.9,
    roughness: 0.18,
    metalness: 0.78,
  });
  private readonly dustMaterial = new THREE.PointsMaterial({
    color: 0xcbe4f2,
    size: 0.038,
    sizeAttenuation: true,
    transparent: true,
    opacity: 0.32,
    depthWrite: false,
  });
  private readonly snowMaterial = createSnowMaterial();
  private readonly glassMaterial = new THREE.MeshPhysicalMaterial({
    color: 0xbfe2f4,
    transmission: 0.72,
    thickness: 0.18,
    roughness: 0.1,
    ior: 1.46,
    transparent: true,
    opacity: 0.3,
    depthWrite: false,
    side: THREE.DoubleSide,
  });
  private readonly glassHighlightMaterial = new THREE.MeshBasicMaterial({
    color: 0xd9f4ff,
    transparent: true,
    opacity: 0.17,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  });
  private readonly innerAtmosphereMaterial = new THREE.MeshBasicMaterial({
    color: 0x89bfe4,
    transparent: true,
    opacity: 0.035,
    side: THREE.BackSide,
    depthWrite: false,
  });
  private readonly floorMaterial = new THREE.MeshStandardMaterial({
    color: 0x080b12,
    roughness: 0.7,
    metalness: 0.12,
  });
  private readonly walnutMaterial = createWoodMaterial(0x24130f, 0.34);
  private readonly walnutLightMaterial = createWoodMaterial(0x422117, 0.42);
  private readonly brassMaterial = new THREE.MeshStandardMaterial({
    color: 0xb78745,
    roughness: 0.22,
    metalness: 0.86,
  });
  private readonly darkMetalMaterial = new THREE.MeshStandardMaterial({
    color: 0x191b20,
    roughness: 0.33,
    metalness: 0.74,
  });
  private readonly treeMaterial = new THREE.MeshStandardMaterial({
    color: 0x183c3b,
    roughness: 0.78,
    metalness: 0,
  });
  private readonly treeShadowMaterial = new THREE.MeshStandardMaterial({
    color: 0x0e282b,
    roughness: 0.9,
    metalness: 0,
  });
  private readonly roofMaterial = new THREE.MeshStandardMaterial({
    color: 0x34282a,
    roughness: 0.64,
    metalness: 0.06,
  });
  private readonly cabinMaterial = createWoodMaterial(0x633722, 0.58);
  private readonly cabinDarkMaterial = createWoodMaterial(0x301b18, 0.66);
  private readonly rendererRef: { current: WebGPURenderer | null } = { current: null };
  private resizeObserver: ResizeObserver | null = null;
  private intersectionObserver: IntersectionObserver | null = null;
  private profile: QualityProfile = getQualityProfile(1440, 900, 1);
  private accumulation: AccumulationState = {
    roof: 0.46,
    branches: 0.3,
    ground: 0.62,
  };
  private reducedMotion: boolean;
  private pointerActive = false;
  private pointerId = -1;
  private pointerDownAt = 0;
  private dragDistance = 0;
  private dragDeltaX = 0;
  private dragDeltaY = 0;
  private disposed = false;
  private pageVisible = typeof document === "undefined" || document.visibilityState === "visible";
  private inViewport = true;
  private animationLoopActive = false;
  private lastTime = 0;
  private elapsed = 0;
  private swirlStrength = 0;
  private shakeAge = 12;
  private quietAnnounced = false;
  private readonly render = (time: number): void => this.renderFrame(time);
  private readonly handleResize = (): void => this.resize();
  private readonly handleVisibility = (): void => {
    this.pageVisible = document.visibilityState === "visible";
    this.lastTime = 0;
    this.updateLoopState();
  };
  private readonly handlePointerDown = (event: PointerEvent): void => {
    if (!event.isPrimary || (event.pointerType !== "mouse" && event.pointerType !== "touch" && event.pointerType !== "pen")) {
      return;
    }

    this.pointerActive = true;
    this.pointerId = event.pointerId;
    this.pointerStart.set(event.clientX, event.clientY);
    this.pointerLast.copy(this.pointerStart);
    this.pointerDownAt = performance.now();
    this.dragDistance = 0;
    this.dragDeltaX = 0;
    this.dragDeltaY = 0;
    this.rendererRef.current?.domElement.setPointerCapture(event.pointerId);
    this.options.onStatusChange?.("turning");
    this.quietAnnounced = false;
    this.updateLoopState();
  };
  private readonly handlePointerMove = (event: PointerEvent): void => {
    if (!this.pointerActive || event.pointerId !== this.pointerId) {
      return;
    }

    const deltaX = event.clientX - this.pointerLast.x;
    const deltaY = event.clientY - this.pointerLast.y;
    this.pointerLast.set(event.clientX, event.clientY);
    this.dragDistance += Math.hypot(deltaX, deltaY);
    this.dragDeltaX += deltaX;
    this.dragDeltaY += deltaY;
    this.targetRotation.y = clamp(this.targetRotation.y + deltaX * 0.0038, -0.5, 0.5);
    this.targetRotation.x = clamp(this.targetRotation.x + deltaY * 0.0022, -0.2, 0.2);
    this.updateLoopState();
  };
  private readonly handlePointerUp = (event: PointerEvent): void => {
    if (!this.pointerActive || event.pointerId !== this.pointerId) {
      return;
    }

    const durationMs = Math.max(1, performance.now() - this.pointerDownAt);
    const speed = this.dragDistance / durationMs;
    const gesture = classifyGesture({
      distance: this.dragDistance,
      durationMs,
      speed,
    });
    this.pointerActive = false;
    this.rendererRef.current?.domElement.releasePointerCapture(event.pointerId);

    if (gesture === "tap") {
      this.shake({ x: 0.46, y: 0.2, strength: 1.35 });
    } else if (gesture === "flick") {
      this.shake(getShakeImpulse(this.dragDeltaX, this.dragDeltaY, durationMs));
    } else {
      this.options.onStatusChange?.("quiet");
      this.updateLoopState();
    }
  };
  private readonly handlePointerCancel = (event: PointerEvent): void => {
    if (this.pointerActive && event.pointerId === this.pointerId) {
      this.pointerActive = false;
      this.updateLoopState();
    }
  };

  public constructor(container: HTMLElement, options: SnowGlobeSceneOptions) {
    this.container = container;
    this.options = options;
    this.reducedMotion = options.reducedMotion;
    this.globeGroup.position.y = GLOBE_CENTER_Y;
    this.globeGroup.add(this.worldGroup, this.particleGroup, this.flowGroup);
    this.scene.add(this.globeGroup);
    this.buildExhibitionSpace();
    this.buildPedestal();
    this.buildWinterWorld();
    this.buildGlass();
    this.buildParticles();
    this.applyAccumulation();
  }

  public async init(): Promise<SnowGlobeSceneInitResult> {
    const viewport = this.getViewportSize();
    this.profile = getQualityProfile(viewport.width, viewport.height, window.devicePixelRatio || 1);
    this.configureCamera(viewport.width, viewport.height);
    this.configureShadows();

    const webGpuApiAvailable = this.hasWebGpuApi();
    let renderer = new WebGPURenderer({
      antialias: true,
      alpha: false,
      forceWebGL: !webGpuApiAvailable,
    });
    let backend: BackendLabel = webGpuApiAvailable ? "webgpu" : "webgl2";

    try {
      await renderer.init();
    } catch (error: unknown) {
      renderer.dispose();
      if (!webGpuApiAvailable) {
        throw error;
      }
      renderer = new WebGPURenderer({ antialias: true, alpha: false, forceWebGL: true });
      await renderer.init();
      backend = "webgl2";
    }

    if (this.disposed) {
      renderer.dispose();
      return { webGpuApiAvailable, backend };
    }

    const backendObject = renderer.backend as unknown as { isWebGLBackend?: boolean };
    backend = backendObject.isWebGLBackend === true ? "webgl2" : "webgpu";
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.05;
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.domElement.setAttribute("aria-hidden", "true");
    renderer.domElement.setAttribute("role", "presentation");
    renderer.domElement.style.display = "block";
    renderer.domElement.style.width = "100%";
    renderer.domElement.style.height = "100%";
    this.rendererRef.current = renderer;
    this.container.appendChild(renderer.domElement);
    this.resize();
    renderer.domElement.addEventListener("pointerdown", this.handlePointerDown, { passive: true });
    renderer.domElement.addEventListener("pointermove", this.handlePointerMove, { passive: true });
    renderer.domElement.addEventListener("pointerup", this.handlePointerUp, { passive: true });
    renderer.domElement.addEventListener("pointercancel", this.handlePointerCancel, { passive: true });
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
    this.renderOnce();
    this.updateLoopState();
    return { webGpuApiAvailable, backend };
  }

  public shake(impulse: ShakeImpulse = { x: 0.46, y: 0.2, strength: 1.35 }): void {
    if (this.disposed) {
      return;
    }

    const safeStrength = clamp(impulse.strength, 0.4, 2.4);
    this.accumulation = releaseAccumulation(this.accumulation, safeStrength);
    this.flowVelocity.set(
      clamp(impulse.x * (0.78 + safeStrength * 0.26), -1.5, 1.5),
      clamp(impulse.y * 0.32, -0.55, 0.55),
      clamp(-impulse.x * 0.24 + impulse.y * 0.16, -0.55, 0.55),
    );
    this.swirlStrength = 0.88 + safeStrength * 0.56;
    this.shakeAge = 0;
    this.rotationKick.set(-impulse.y * 0.12, impulse.x * 0.24, impulse.y * 0.06);
    this.quietAnnounced = false;
    this.options.onStatusChange?.("swirling");
    this.releaseParticles(safeStrength);
    this.updateLoopState();
  }

  public nudgeTurn(direction: "left" | "right"): void {
    if (this.disposed) {
      return;
    }

    const delta = direction === "left" ? -0.12 : 0.12;
    this.targetRotation.y = clamp(this.targetRotation.y + delta, -0.5, 0.5);
    this.options.onStatusChange?.("turning");
    this.quietAnnounced = false;
    this.updateLoopState();
  }

  public setReducedMotion(enabled: boolean): void {
    if (this.disposed || this.reducedMotion === enabled) {
      return;
    }

    this.reducedMotion = enabled;
    if (enabled) {
      this.swirlStrength = Math.min(this.swirlStrength, 0.72);
      this.rotationKick.multiplyScalar(0.35);
    }
    this.updateLoopState();
  }

  public dispose(): void {
    if (this.disposed) {
      return;
    }

    this.disposed = true;
    const renderer = this.rendererRef.current;
    renderer?.setAnimationLoop(null);
    this.animationLoopActive = false;
    renderer?.domElement.removeEventListener("pointerdown", this.handlePointerDown);
    renderer?.domElement.removeEventListener("pointermove", this.handlePointerMove);
    renderer?.domElement.removeEventListener("pointerup", this.handlePointerUp);
    renderer?.domElement.removeEventListener("pointercancel", this.handlePointerCancel);
    this.resizeObserver?.disconnect();
    this.intersectionObserver?.disconnect();
    window.removeEventListener("resize", this.handleResize);
    document.removeEventListener("visibilitychange", this.handleVisibility);
    if (renderer?.domElement.parentElement === this.container) {
      this.container.removeChild(renderer.domElement);
    }
    disposeSceneResources(this.scene);
    renderer?.dispose();
    this.rendererRef.current = null;
  }

  private buildExhibitionSpace(): void {
    this.scene.background = new THREE.Color(0x070a12);
    this.scene.fog = new THREE.FogExp2(0x080c17, 0.024);

    const floor = addMesh(this.scene, new THREE.PlaneGeometry(30, 26), this.floorMaterial, [0, -0.02, 0]);
    floor.rotation.x = -Math.PI / 2;
    floor.receiveShadow = true;

    const floorPool = addMesh(
      this.scene,
      new THREE.CircleGeometry(4.2, 96),
      new THREE.MeshBasicMaterial({ color: 0x102338, transparent: true, opacity: 0.3, depthWrite: false }),
      [0, 0.005, 0],
    );
    floorPool.rotation.x = -Math.PI / 2;

    const backGlow = addMesh(
      this.scene,
      new THREE.CircleGeometry(4.5, 96),
      new THREE.MeshBasicMaterial({ color: 0x172c4b, transparent: true, opacity: 0.16, depthWrite: false }),
      [0, 3.5, -4.8],
    );
    backGlow.scale.set(1.2, 0.92, 1);
    backGlow.rotation.y = Math.PI;
  }

  private buildPedestal(): void {
    const pedestalGroup = new THREE.Group();
    pedestalGroup.position.y = 0;
    this.scene.add(pedestalGroup);

    const lower = addMesh(
      pedestalGroup,
      new THREE.CylinderGeometry(2.08, 2.28, 0.46, 72),
      this.walnutMaterial,
      [0, 0.27, 0],
    );
    lower.castShadow = true;
    lower.receiveShadow = true;

    const bevel = addMesh(
      pedestalGroup,
      new THREE.CylinderGeometry(1.96, 2.08, 0.24, 72),
      this.walnutLightMaterial,
      [0, 0.62, 0],
    );
    bevel.castShadow = true;
    bevel.receiveShadow = true;

    const topPlate = addMesh(
      pedestalGroup,
      new THREE.CylinderGeometry(1.88, 1.96, 0.24, 72),
      this.walnutMaterial,
      [0, 0.82, 0],
    );
    topPlate.castShadow = true;
    topPlate.receiveShadow = true;

    for (const [radius, tube, y] of [
      [2.12, 0.035, 0.44],
      [1.99, 0.022, 0.7],
      [1.87, 0.032, 0.95],
    ] as const) {
      const ring = addMesh(
        pedestalGroup,
        new THREE.TorusGeometry(radius, tube, 8, 96),
        this.brassMaterial,
        [0, y, 0],
      );
      ring.rotation.x = Math.PI / 2;
      ring.castShadow = true;
    }

    const inset = addMesh(
      pedestalGroup,
      new THREE.CylinderGeometry(1.72, 1.78, 0.08, 72),
      this.darkMetalMaterial,
      [0, 1.02, 0],
    );
    inset.receiveShadow = true;
  }

  private buildWinterWorld(): void {
    const groundSnow = addMesh(
      this.worldGroup,
      new THREE.SphereGeometry(2.15, 64, 24, 0, Math.PI * 2, 0, Math.PI / 2),
      createSnowMaterial(0xd5e5ed),
      [0, -1.92, -0.12],
    );
    groundSnow.scale.y = 0.3;
    groundSnow.receiveShadow = true;
    groundSnow.name = "ground-snow-accumulation";
    this.groundSnowMesh = groundSnow;

    const farHill = addMesh(
      this.worldGroup,
      new THREE.ConeGeometry(1.35, 1.65, 7, 1),
      createSnowMaterial(0xb9cedc),
      [-0.5, -0.48, -1.16],
    );
    farHill.scale.set(1.35, 1, 0.62);
    farHill.rotation.y = 0.36;
    farHill.receiveShadow = true;

    const farHillShadow = addMesh(
      this.worldGroup,
      new THREE.ConeGeometry(0.75, 0.85, 7, 1),
      createSnowMaterial(0x8eaabe),
      [0.82, -0.88, -1.02],
    );
    farHillShadow.scale.set(1.28, 1, 0.5);
    farHillShadow.rotation.y = -0.4;

    this.buildCabin();
    this.buildConifer(TREE_X, TREE_Z, 2.62, true, 1);
    this.buildConifer(1.28, -0.46, 1.68, false, 2);
    this.buildConifer(-1.72, -0.54, 1.44, false, 3);
    this.buildConifer(1.64, -0.9, 1.05, false, 4);
    this.buildLighting();
  }

  private buildCabin(): void {
    const cabin = new THREE.Group();
    cabin.position.set(HUT_X, 0, HUT_Z);
    this.worldGroup.add(cabin);

    const walls = addMesh(cabin, new THREE.BoxGeometry(1.34, 0.76, 0.94), this.cabinMaterial, [0, -1.2, 0]);
    walls.castShadow = true;
    walls.receiveShadow = true;

    const frontBeam = addMesh(cabin, new THREE.BoxGeometry(1.42, 0.11, 0.1), this.cabinDarkMaterial, [0, -0.82, 0.5]);
    frontBeam.castShadow = true;
    const sideBeam = addMesh(cabin, new THREE.BoxGeometry(0.1, 0.82, 1.02), this.cabinDarkMaterial, [-0.63, -1.18, 0]);
    sideBeam.castShadow = true;

    const roofLeft = addMesh(cabin, new THREE.BoxGeometry(0.86, 0.13, 1.14), this.roofMaterial, [-0.36, -0.68, 0.03]);
    roofLeft.rotation.z = -0.54;
    roofLeft.castShadow = true;
    const roofRight = addMesh(cabin, new THREE.BoxGeometry(0.86, 0.13, 1.14), this.roofMaterial, [0.36, -0.68, 0.03]);
    roofRight.rotation.z = 0.54;
    roofRight.castShadow = true;

    const snowLeft = addMesh(cabin, new THREE.BoxGeometry(0.91, 0.13, 1.17), this.snowMaterial, [-0.36, -0.595, 0.03]);
    snowLeft.rotation.z = -0.54;
    const snowRight = addMesh(cabin, new THREE.BoxGeometry(0.91, 0.13, 1.17), this.snowMaterial, [0.36, -0.595, 0.03]);
    snowRight.rotation.z = 0.54;
    this.roofSnow.push(snowLeft, snowRight);

    const door = addMesh(cabin, new THREE.BoxGeometry(0.28, 0.52, 0.05), this.cabinDarkMaterial, [0.42, -1.28, 0.5]);
    door.castShadow = true;
    const doorKnob = addMesh(cabin, new THREE.SphereGeometry(0.025, 12, 8), this.brassMaterial, [0.33, -1.27, 0.54]);
    doorKnob.castShadow = true;

    for (const x of [-0.3, 0.03]) {
      const window = addMesh(cabin, new THREE.BoxGeometry(0.23, 0.2, 0.035), this.warmWindowMaterial, [x, -1.13, 0.515]);
      this.warmWindows.push(window);
      const vertical = addMesh(cabin, new THREE.BoxGeometry(0.025, 0.22, 0.05), this.cabinDarkMaterial, [x, -1.13, 0.54]);
      const horizontal = addMesh(cabin, new THREE.BoxGeometry(0.25, 0.025, 0.05), this.cabinDarkMaterial, [x, -1.13, 0.54]);
      vertical.castShadow = true;
      horizontal.castShadow = true;
    }

    const chimney = addMesh(cabin, new THREE.CylinderGeometry(0.1, 0.1, 0.5, 18), this.cabinDarkMaterial, [0.26, -0.3, -0.16]);
    chimney.castShadow = true;
    const chimneyCap = addMesh(cabin, new THREE.CylinderGeometry(0.13, 0.12, 0.07, 18), this.snowMaterial, [0.26, -0.04, -0.16]);
    chimneyCap.castShadow = true;

    const snowLedge = addMesh(cabin, new THREE.BoxGeometry(1.38, 0.11, 0.98), this.snowMaterial, [0, -0.78, 0.03]);
    snowLedge.scale.y = 0.16;
    snowLedge.name = "cabin-grounded-snow-ledger";
    this.roofSnow.push(snowLedge);
  }

  private buildConifer(x: number, z: number, height: number, main: boolean, seed: number): void {
    const tree = new THREE.Group();
    tree.position.set(x, 0, z);
    this.worldGroup.add(tree);

    const trunk = addMesh(tree, new THREE.CylinderGeometry(main ? 0.11 : 0.07, main ? 0.15 : 0.1, height * 0.42, 18), this.cabinDarkMaterial, [0, GROUND_Y + height * 0.21, 0]);
    trunk.castShadow = true;

    const layerCount = main ? 4 : 3;
    for (let index = 0; index < layerCount; index += 1) {
      const progress = index / Math.max(1, layerCount - 1);
      const layerHeight = height * (main ? 0.82 : 0.76) * (0.44 - progress * 0.045);
      const radius = height * (main ? 0.36 : 0.31) * (1 - progress * 0.19);
      const y = GROUND_Y + height * (0.38 + progress * 0.43);
      const foliage = addMesh(
        tree,
        new THREE.ConeGeometry(radius, layerHeight, main ? 24 : 18, 1),
        index % 2 === 0 ? this.treeMaterial : this.treeShadowMaterial,
        [0, y, 0],
      );
      foliage.rotation.y = seededRandom(seed * 13 + index) * Math.PI;
      foliage.castShadow = true;
      foliage.receiveShadow = true;

      const snowCap = addMesh(
        tree,
        new THREE.ConeGeometry(radius * 0.78, layerHeight * 0.2, main ? 24 : 18, 1),
        this.snowMaterial,
        [randomSigned(seed + index) * 0.035, y + layerHeight * 0.44, randomSigned(seed + index * 2) * 0.025],
      );
      snowCap.scale.y = 0.55;
      snowCap.castShadow = true;
      this.branchSnow.push(snowCap);
    }
  }

  private buildLighting(): void {
    const hemisphere = new THREE.HemisphereLight(0x9ec4df, 0x151018, 1.35);
    const coldKey = new THREE.DirectionalLight(0xb6d8f2, 2.8);
    coldKey.position.set(-4.8, 7.6, 5.2);
    coldKey.target.position.set(0, 2.1, 0);
    coldKey.castShadow = true;
    coldKey.shadow.camera.left = -5.5;
    coldKey.shadow.camera.right = 5.5;
    coldKey.shadow.camera.top = 6.5;
    coldKey.shadow.camera.bottom = -1.2;
    coldKey.shadow.camera.near = 0.1;
    coldKey.shadow.camera.far = 20;

    const blueRim = new THREE.PointLight(0x5d9fd1, 8, 12, 2);
    blueRim.position.set(-4.2, 4.5, -3.4);
    const warm = new THREE.PointLight(0xff8d45, 3.4, 5.2, 1.8);
    warm.position.set(HUT_X, GLOBE_CENTER_Y - 1.12, HUT_Z + 0.68);
    warm.castShadow = true;
    warm.shadow.mapSize.set(512, 512);
    const softFill = new THREE.PointLight(0x294c72, 3.2, 9, 2);
    softFill.position.set(2.8, GLOBE_CENTER_Y + 1.2, 3.4);

    this.scene.add(hemisphere, coldKey, coldKey.target, blueRim, softFill, warm);
  }

  private buildGlass(): void {
    const innerAtmosphere = new THREE.Mesh(new THREE.SphereGeometry(INNER_RADIUS, 72, 48), this.innerAtmosphereMaterial);
    innerAtmosphere.name = "liquid-volume";
    this.worldGroup.add(innerAtmosphere);

    const glassShell = new THREE.Mesh(new THREE.SphereGeometry(GLOBE_RADIUS, 96, 64), this.glassMaterial);
    glassShell.name = "thick-glass-shell";
    glassShell.renderOrder = 10;
    this.globeGroup.add(glassShell);

    const equator = addMesh(
      this.globeGroup,
      new THREE.TorusGeometry(GLOBE_RADIUS * 0.98, 0.014, 8, 128),
      this.glassHighlightMaterial,
      [0, GLOBE_CENTER_Y, 0],
    );
    equator.position.y = 0;
    equator.rotation.x = Math.PI / 2;
    equator.renderOrder = 11;

    const highlightCurve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(-1.38, 1.58, 1.55),
      new THREE.Vector3(-1.92, 0.82, 1.49),
      new THREE.Vector3(-2.04, -0.1, 1.22),
      new THREE.Vector3(-1.84, -0.92, 0.92),
    ]);
    const highlight = new THREE.Mesh(
      new THREE.TubeGeometry(highlightCurve, 44, 0.018, 8, false),
      this.glassHighlightMaterial,
    );
    highlight.name = "glass-specular-highlight";
    highlight.renderOrder = 12;
    this.globeGroup.add(highlight);

    const topHighlight = addMesh(
      this.globeGroup,
      new THREE.TorusGeometry(0.72, 0.014, 8, 90, Math.PI * 0.82),
      this.glassHighlightMaterial,
      [-1.08, 1.34, 0.78],
    );
    topHighlight.rotation.set(0.32, -0.28, -0.55);
    topHighlight.renderOrder = 12;
  }

  private buildParticles(): void {
    const snowGeometry = new THREE.SphereGeometry(1, 8, 6);
    const snowMesh = new THREE.InstancedMesh(snowGeometry, this.snowMaterial, this.profile.snowCount);
    snowMesh.name = "snow-flakes";
    snowMesh.frustumCulled = false;
    this.particleGroup.add(snowMesh);
    this.particleBuckets.push({
      particles: this.createParticles("snow", this.profile.snowCount, 17),
      mesh: snowMesh,
      geometry: snowGeometry,
    });

    const glitterGeometry = new THREE.OctahedronGeometry(1, 0);
    const glitterMesh = new THREE.InstancedMesh(glitterGeometry, this.glitterMaterial, this.profile.glitterCount);
    glitterMesh.name = "mica-glitter";
    glitterMesh.frustumCulled = false;
    this.particleGroup.add(glitterMesh);
    this.particleBuckets.push({
      particles: this.createParticles("glitter", this.profile.glitterCount, 41),
      mesh: glitterMesh,
      geometry: glitterGeometry,
    });

    const dustGeometry = new THREE.BufferGeometry();
    const dustParticles = this.createParticles("dust", this.profile.dustCount, 73);
    const dustPositions = new Float32Array(dustParticles.length * 3);
    dustParticles.forEach((particle, index) => {
      dustPositions[index * 3] = particle.position.x;
      dustPositions[index * 3 + 1] = particle.position.y;
      dustPositions[index * 3 + 2] = particle.position.z;
    });
    dustGeometry.setAttribute("position", new THREE.BufferAttribute(dustPositions, 3));
    const dustMesh = new THREE.Points(dustGeometry, this.dustMaterial);
    dustMesh.name = "fine-snow-dust";
    dustMesh.frustumCulled = false;
    this.particleGroup.add(dustMesh);
    this.particleBuckets.push({ particles: dustParticles, mesh: dustMesh, geometry: dustGeometry });

    for (const [radius, tilt, color] of [
      [1.84, 0.22, 0x74a8cf],
      [1.72, -0.46, 0xb0d8ee],
      [1.48, 0.78, 0x7fbed8],
    ] as const) {
      const ring = addMesh(
        this.flowGroup,
        new THREE.TorusGeometry(radius, 0.011, 5, 96),
        new THREE.MeshBasicMaterial({
          color,
          transparent: true,
          opacity: 0.035,
          depthWrite: false,
          blending: THREE.AdditiveBlending,
        }),
        [0, 0, 0],
      );
      ring.rotation.x = Math.PI / 2 + tilt;
      ring.rotation.z = tilt * 0.35;
      this.flowRings.push(ring);
    }
  }

  private createParticles(layer: ParticleLayer, count: number, seed: number): Particle[] {
    const particles: Particle[] = [];
    const config = getLayerConfig(layer);

    for (let index = 0; index < count; index += 1) {
      const base = seed + index * 37;
      const angle = seededRandom(base) * Math.PI * 2;
      const radius = Math.sqrt(seededRandom(base + 1)) * 1.95;
      const y = randomSigned(base + 2) * 1.55;
      const position = new THREE.Vector3(
        Math.cos(angle) * radius * 0.86,
        y,
        Math.sin(angle) * radius * 0.86,
      );
      const settled = layer === "snow" && index % 7 === 0;
      if (settled) {
        position.y = GROUND_Y + config.radius;
      }
      particles.push({
        layer,
        phase: seededRandom(base + 3) * Math.PI * 2,
        seed: base,
        scale: 0.6 + seededRandom(base + 4) * 0.8,
        position,
        velocity: new THREE.Vector3(
          randomSigned(base + 5) * 0.06,
          -0.02 - seededRandom(base + 6) * 0.08,
          randomSigned(base + 7) * 0.06,
        ),
        settled,
        surface: settled ? "ground" : null,
      });
    }

    return particles;
  }

  private releaseParticles(intensity: number): void {
    for (const bucket of this.particleBuckets) {
      for (const [index, particle] of bucket.particles.entries()) {
        if (particle.layer !== "snow" || (!particle.settled && index % 3 !== 0)) {
          continue;
        }
        particle.settled = false;
        particle.surface = null;
        particle.position.y = Math.max(particle.position.y + 0.12, GROUND_Y + 0.1);
        particle.velocity.set(
          this.flowVelocity.x * 0.45 + randomSigned(particle.seed + 51) * 0.26,
          0.16 + seededRandom(particle.seed + 52) * 0.45 + intensity * 0.12,
          this.flowVelocity.z * 0.45 + randomSigned(particle.seed + 53) * 0.26,
        );
      }
    }
  }

  private updateParticles(deltaSeconds: number): void {
    const flowVelocityTuple = [this.flowVelocity.x, this.flowVelocity.y, this.flowVelocity.z] as const;
    const activeSwirl = this.swirlStrength;
    const motionScale = this.reducedMotion ? 0.34 : 1;

    for (const bucket of this.particleBuckets) {
      for (const particle of bucket.particles) {
        const config = getLayerConfig(particle.layer);
        if (particle.settled && this.shakeAge > 0.8) {
          continue;
        }

        const flow = getFlowVector(
          [particle.position.x, particle.position.y, particle.position.z],
          flowVelocityTuple,
          activeSwirl,
          particle.layer,
          this.elapsed,
          particle.phase,
        );
        const desired = this.tempVector.set(flow[0], flow[1], flow[2]);
        const dragAlpha = 1 - Math.exp(-config.drag * deltaSeconds * motionScale);
        particle.velocity.lerp(desired, dragAlpha);
        particle.velocity.y -= config.gravity * deltaSeconds * (this.shakeAge > 5 ? 0.3 : 0.7) * motionScale;
        particle.position.addScaledVector(particle.velocity, deltaSeconds * motionScale);
        this.resolveParticleCollision(particle, config.bounce, deltaSeconds);
      }
    }

    this.updateParticleMeshes();
  }

  private resolveParticleCollision(particle: Particle, bounce: number, deltaSeconds: number): void {
    const config = getLayerConfig(particle.layer);
    const distance = particle.position.length();
    const wallLimit = INNER_RADIUS - config.radius;
    if (distance > wallLimit) {
      const normal = particle.position.clone().normalize();
      particle.position.copy(normal).multiplyScalar(wallLimit);
      const reflected = reflectVelocity(
        [particle.velocity.x, particle.velocity.y, particle.velocity.z],
        [normal.x, normal.y, normal.z],
        bounce,
        particle.layer === "glitter" ? 0.96 : 0.86,
      );
      particle.velocity.set(...reflected);
    }

    const hit = this.getSurfaceHit(particle.position, particle.velocity);
    if (!hit) {
      return;
    }

    const impact = Math.max(0.08, -particle.velocity.dot(hit.normal));
    particle.velocity.reflect(hit.normal).multiplyScalar(particle.layer === "dust" ? 0.18 : 0.42);
    particle.velocity.addScaledVector(hit.normal, 0.015);
    particle.position.addScaledVector(hit.normal, config.radius * 0.72);

    if (particle.layer === "snow") {
      this.accumulation = updateAccumulation(this.accumulation, hit.surface, impact, deltaSeconds);
      if (impact < 0.38 && this.shakeAge > 0.65) {
        particle.settled = true;
        particle.surface = hit.surface;
        particle.velocity.multiplyScalar(0.05);
      }
    }
  }

  private getSurfaceHit(position: THREE.Vector3, velocity: THREE.Vector3): SurfaceHit | null {
    if (velocity.y >= 0.06) {
      return null;
    }

    if (
      position.x > HUT_X - 0.82
      && position.x < HUT_X + 0.82
      && position.z > HUT_Z + HUT_ROOF_Z_MIN
      && position.z < HUT_Z + HUT_ROOF_Z_MAX
      && position.y > -0.84
    ) {
      const roofHeight = -0.59 + (0.78 - Math.min(0.78, Math.abs(position.x - HUT_X))) * 0.36;
      if (position.y < roofHeight + 0.08) {
        position.y = roofHeight + 0.08;
        return { surface: "roof", normal: new THREE.Vector3(0, 1, 0) };
      }
    }

    const treeDistance = Math.hypot(position.x - TREE_X, position.z - TREE_Z);
    if (treeDistance < 0.56 && position.y > -1.38 && position.y < 0.98) {
      const branchLevel = Math.round((position.y + 1.1) / 0.48);
      const branchY = -1.1 + branchLevel * 0.48;
      if (Math.abs(position.y - branchY) < 0.15) {
        position.y = branchY + 0.12;
        return { surface: "branches", normal: new THREE.Vector3(0, 1, 0) };
      }
    }

    if (position.y < GROUND_Y + 0.05 && Math.hypot(position.x, position.z + 0.1) < 1.95) {
      position.y = GROUND_Y + 0.05;
      return { surface: "ground", normal: new THREE.Vector3(0, 1, 0) };
    }

    return null;
  }

  private updateParticleMeshes(): void {
    for (const bucket of this.particleBuckets) {
      if (bucket.mesh instanceof THREE.InstancedMesh) {
        for (const [index, particle] of bucket.particles.entries()) {
          const scale = getLayerConfig(particle.layer).radius * particle.scale * (particle.settled ? 0.82 : 1);
          if (particle.layer === "glitter") {
            this.tempEuler.set(
              this.elapsed * (1.5 + particle.scale) + particle.phase,
              this.elapsed * 0.92 + particle.phase * 0.6,
              this.elapsed * 0.68,
            );
            this.tempQuaternion.setFromEuler(this.tempEuler);
          } else {
            this.tempQuaternion.identity();
          }
          this.tempMatrix.compose(particle.position, this.tempQuaternion, this.tempVectorB.set(scale, scale, scale));
          bucket.mesh.setMatrixAt(index, this.tempMatrix);
        }
        bucket.mesh.instanceMatrix.needsUpdate = true;
      } else {
        const positionAttribute = bucket.geometry.getAttribute("position") as THREE.BufferAttribute;
        for (const [index, particle] of bucket.particles.entries()) {
          positionAttribute.setXYZ(index, particle.position.x, particle.position.y, particle.position.z);
        }
        positionAttribute.needsUpdate = true;
      }
    }
  }

  private updateVisualState(deltaSeconds: number): void {
    const decay = Math.exp(-deltaSeconds * (this.reducedMotion ? 5.4 : 2.15));
    this.swirlStrength *= decay;
    this.flowVelocity.multiplyScalar(Math.exp(-deltaSeconds * (this.reducedMotion ? 4.2 : 1.55)));
    this.rotationKick.multiplyScalar(Math.exp(-deltaSeconds * (this.reducedMotion ? 6 : 2.4)));
    this.shakeAge += deltaSeconds;

    const springSpeed = this.reducedMotion ? 4.5 : 8.2;
    this.globeGroup.rotation.x = expApproach(this.globeGroup.rotation.x, this.targetRotation.x, deltaSeconds, springSpeed) + this.rotationKick.x * Math.sin(this.shakeAge * 9) * Math.exp(-this.shakeAge * 1.2);
    this.globeGroup.rotation.y = expApproach(this.globeGroup.rotation.y, this.targetRotation.y, deltaSeconds, springSpeed) + this.rotationKick.y * Math.sin(this.shakeAge * 7.2) * Math.exp(-this.shakeAge * 1.1);
    this.globeGroup.rotation.z = this.rotationKick.z * Math.sin(this.shakeAge * 7.8) * Math.exp(-this.shakeAge * 1.15);

    const heroPulse = Math.exp(-Math.pow((this.shakeAge - 0.72) / 0.45, 2));
    this.glitterMaterial.emissiveIntensity = 0.75 + heroPulse * 2.4 + this.swirlStrength * 0.18;
    this.warmWindowMaterial.emissiveIntensity = 4.2 + heroPulse * 2.1;
    setOpacity(this.innerAtmosphereMaterial, 0.028 + heroPulse * 0.025);
    this.flowRings.forEach((ring, index) => {
      ring.rotation.y += deltaSeconds * (0.24 + index * 0.08) * (this.reducedMotion ? 0.3 : 1);
      ring.rotation.x += deltaSeconds * (index % 2 === 0 ? 0.08 : -0.06) * (this.reducedMotion ? 0.3 : 1);
      setOpacity(ring.material as THREE.Material, 0.022 + this.swirlStrength * 0.028 + heroPulse * 0.028);
      ring.scale.setScalar(1 + this.swirlStrength * 0.08 + heroPulse * 0.035);
    });
    this.applyAccumulation();

    if (this.shakeAge > 3.4 && this.swirlStrength < 0.06 && !this.quietAnnounced) {
      this.quietAnnounced = true;
      this.options.onStatusChange?.("quiet");
    }
  }

  private applyAccumulation(): void {
    const roofScale = 0.38 + this.accumulation.roof * 1.05;
    this.roofSnow.forEach((mesh, index) => {
      mesh.scale.y = index === this.roofSnow.length - 1 ? 0.12 + this.accumulation.roof * 0.28 : roofScale;
      mesh.position.y = index === this.roofSnow.length - 1 ? -0.79 + this.accumulation.roof * 0.025 : mesh.position.y;
    });
    this.branchSnow.forEach((mesh, index) => {
      const variation = 0.86 + (index % 3) * 0.08;
      mesh.scale.y = (0.38 + this.accumulation.branches * variation) * 0.55;
      mesh.scale.x = 0.92 + this.accumulation.branches * 0.18;
    });
    if (this.groundSnowMesh) {
      this.groundSnowMesh.scale.y = 0.24 + this.accumulation.ground * 0.1;
    }
  }

  private groundSnowMesh: THREE.Mesh | null = null;

  private renderFrame(time: number): void {
    const renderer = this.rendererRef.current;
    if (this.disposed || !renderer) {
      return;
    }

    const deltaSeconds = this.lastTime === 0 ? 0 : clamp((time - this.lastTime) / 1000, 0, 0.05);
    this.lastTime = time;
    this.elapsed += deltaSeconds;
    this.updateParticles(deltaSeconds);
    this.updateVisualState(deltaSeconds);
    renderer.render(this.scene, this.camera);

    if (!this.shouldAnimate()) {
      renderer.setAnimationLoop(null);
      this.animationLoopActive = false;
    }
  }

  private renderOnce(): void {
    const renderer = this.rendererRef.current;
    if (!renderer || this.disposed) {
      return;
    }
    this.updateParticleMeshes();
    renderer.render(this.scene, this.camera);
  }

  private updateLoopState(): void {
    const renderer = this.rendererRef.current;
    if (!renderer || this.disposed) {
      return;
    }
    const shouldAnimate = this.shouldAnimate();
    if (shouldAnimate && !this.animationLoopActive) {
      this.animationLoopActive = true;
      this.lastTime = 0;
      renderer.setAnimationLoop(this.render);
    } else if (!shouldAnimate && this.animationLoopActive) {
      renderer.setAnimationLoop(null);
      this.animationLoopActive = false;
    }
  }

  private shouldAnimate(): boolean {
    return this.pageVisible && this.inViewport;
  }

  private resize(): void {
    const renderer = this.rendererRef.current;
    if (!renderer || this.disposed) {
      return;
    }

    const viewport = this.getViewportSize();
    this.configureCamera(viewport.width, viewport.height);
    const drawingBuffer = getDrawingBufferSize(
      viewport.width,
      viewport.height,
      window.devicePixelRatio || 1,
      this.profile,
    );
    renderer.setPixelRatio(drawingBuffer.pixelRatio);
    renderer.setSize(viewport.width, viewport.height, false);
    this.renderOnce();
  }

  private configureCamera(width: number, height: number): void {
    const narrow = width <= 600;
    this.camera.aspect = width / Math.max(1, height);
    this.camera.fov = narrow ? 38 : 34;
    this.camera.position.set(narrow ? 5.5 : 6.5, narrow ? 4.65 : 4.85, narrow ? 11.4 : 9.8);
    this.camera.lookAt(0, narrow ? 2.55 : 2.5, 0);
    this.camera.updateProjectionMatrix();
  }

  private configureShadows(): void {
    this.scene.traverse((object) => {
      if (
        (object instanceof THREE.DirectionalLight || object instanceof THREE.PointLight || object instanceof THREE.SpotLight)
        && object.castShadow
      ) {
        object.shadow.mapSize.set(this.profile.shadowMapSize, this.profile.shadowMapSize);
        object.shadow.bias = -0.00035;
        object.shadow.normalBias = 0.018;
      }
    });
  }

  private getViewportSize(): { readonly width: number; readonly height: number } {
    const rect = this.container.getBoundingClientRect();
    return {
      width: Math.max(1, Math.floor(rect.width || window.innerWidth)),
      height: Math.max(1, Math.floor(rect.height || window.innerHeight)),
    };
  }

  private hasWebGpuApi(): boolean {
    if (typeof navigator === "undefined") {
      return false;
    }
    return typeof (navigator as Navigator & { gpu?: unknown }).gpu !== "undefined";
  }
}
