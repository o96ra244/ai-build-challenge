import * as THREE from "three";

import {
  advanceChain,
  CHAIN_STAGES,
  createInitialChain,
  getCurrentStage,
  getRunProgress,
  getStageProgress,
  resetChain,
  startChain,
  triggerChainEvent,
  type ChainPhase,
  type ChainState,
} from "./chainSequence";
import {
  BODY_LAYOUT,
  BLOCK_COLORS,
  FUNCTIONAL_LAYOUT,
  MECHANISM_LAYOUT,
  ROOM_LAYOUT,
  type BoxDefinition,
  type Vector3Tuple,
} from "./deskLayout";
import {
  ChainPhysicsWorld,
  loadRapier,
  type BodySnapshot,
  type DynamicBodyId,
  type MechanismSnapshot,
} from "./chainPhysics";
import { getHeroCamera, getStageCamera, interpolateCamera, type CameraPreset } from "./cameraDirector";
import { getDrawingBufferSize, getQualityProfile, type QualityProfile } from "./qualityProfile";

export type ChainRuntimeStatus = "loading" | "ready" | "error";
export type ChainBackend = "WebGL 2" | "pending";

export type DeskChainUiState = {
  readonly runtimeStatus: ChainRuntimeStatus;
  readonly backend: ChainBackend;
  readonly phase: ChainPhase;
  readonly stageLabel: string;
  readonly stageIndex: number;
  readonly stageCount: number;
  readonly progress: number;
  readonly statusText: string;
  readonly canStart: boolean;
};

export type DeskChainReactionSceneOptions = {
  readonly reducedMotion: boolean;
  readonly onLoadingState?: (message: string) => void;
  readonly onStateChange?: (state: DeskChainUiState) => void;
};

const COLORS = {
  wall: 0xe8ddca,
  desk: 0x9a5f3f,
  deskEdge: 0x71432e,
  page: 0xf4eee1,
  pageShadow: 0xd7c9b3,
  ruler: 0xe1cda5,
  ink: 0x354653,
  pencil: 0xd26845,
  pencilYellow: 0xe0b751,
  red: 0xc93f43,
  blue: 0x3c72a2,
  wood: 0xb77a4f,
  woodDark: 0x79472f,
  paper: 0xe8e0d1,
  rubber: 0xd3828a,
  brass: 0xc99a52,
  bell: 0xc69a45,
  metal: 0x6f7a79,
  green: 0x6f8f73,
  goal: 0xf3c84c,
  dark: 0x253238,
} as const;

function createMaterial(
  color: number,
  options: { readonly roughness?: number; readonly metalness?: number; readonly transparent?: boolean; readonly opacity?: number } = {},
): THREE.MeshStandardMaterial {
  return new THREE.MeshStandardMaterial({
    color,
    roughness: options.roughness ?? 0.78,
    metalness: options.metalness ?? 0.03,
    transparent: options.transparent ?? false,
    opacity: options.opacity ?? 1,
  });
}

function addBox(
  parent: THREE.Object3D,
  geometry: THREE.BoxGeometry,
  material: THREE.Material,
  definition: { readonly size: Vector3Tuple; readonly position: Vector3Tuple; readonly rotation: readonly [number, number, number] },
): THREE.Mesh {
  const mesh = new THREE.Mesh(geometry, material);
  mesh.position.set(...definition.position);
  mesh.rotation.set(...definition.rotation);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  parent.add(mesh);
  return mesh;
}

function addCylinder(
  parent: THREE.Object3D,
  geometry: THREE.CylinderGeometry,
  material: THREE.Material,
  position: Vector3Tuple,
  rotation: Vector3Tuple = [0, 0, 0],
): THREE.Mesh {
  const mesh = new THREE.Mesh(geometry, material);
  mesh.position.set(...position);
  mesh.rotation.set(...rotation);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  parent.add(mesh);
  return mesh;
}

function addBeam(parent: THREE.Object3D, start: Vector3Tuple, end: Vector3Tuple, radius: number, material: THREE.Material): THREE.Mesh {
  const startVector = new THREE.Vector3(...start);
  const endVector = new THREE.Vector3(...end);
  const direction = endVector.clone().sub(startVector);
  const mesh = new THREE.Mesh(new THREE.CylinderGeometry(radius, radius, direction.length(), 8), material);
  mesh.position.copy(startVector.clone().add(endVector).multiplyScalar(0.5));
  mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), direction.normalize());
  mesh.castShadow = true;
  parent.add(mesh);
  return mesh;
}

function disposeSceneResources(scene: THREE.Scene): void {
  const geometries = new Set<THREE.BufferGeometry>();
  const materials = new Set<THREE.Material>();
  const textures = new Set<THREE.Texture>();
  scene.traverse((object) => {
    if (object instanceof THREE.Mesh || object instanceof THREE.Sprite) {
      geometries.add(object.geometry);
      const objectMaterials = Array.isArray(object.material) ? object.material : [object.material];
      objectMaterials.forEach((material) => {
        materials.add(material);
        if (material instanceof THREE.MeshStandardMaterial && material.map) textures.add(material.map);
        if (material instanceof THREE.SpriteMaterial && material.map) textures.add(material.map);
      });
    }
  });
  geometries.forEach((geometry) => geometry.dispose());
  materials.forEach((material) => material.dispose());
  textures.forEach((texture) => texture.dispose());
}

export class DeskChainReactionScene {
  private readonly container: HTMLElement;
  private readonly options: DeskChainReactionSceneOptions;
  private readonly scene = new THREE.Scene();
  private readonly camera = new THREE.PerspectiveCamera(38, 1, 0.1, 80);
  private readonly root = new THREE.Group();
  private readonly roomRoot = new THREE.Group();
  private readonly deskRoot = new THREE.Group();
  private readonly chainRoot = new THREE.Group();
  private readonly mechanismRoot = new THREE.Group();
  private readonly dynamicRoot = new THREE.Group();
  private readonly materials: Record<string, THREE.MeshStandardMaterial>;
  private readonly boxGeometries = new Map<string, THREE.BoxGeometry>();
  private readonly dynamicMeshes = new Map<DynamicBodyId, THREE.Object3D>();
  private readonly blockMeshes: THREE.Object3D[] = [];
  private readonly redMarble: THREE.Mesh;
  private readonly blueMarble: THREE.Mesh;
  private readonly eraser: THREE.Mesh;
  private readonly pencil: THREE.Group;
  private readonly toyCar: THREE.Group;
  private readonly seesaw: THREE.Mesh;
  private readonly balanceRuler: THREE.Mesh;
  private readonly clothespin: THREE.Group;
  private readonly rubberBand: THREE.Mesh;
  private readonly redStopper: THREE.Mesh;
  private readonly eraserRest: THREE.Mesh;
  private readonly carChock: THREE.Mesh;
  private readonly blueStopper: THREE.Mesh;
  private readonly striker: THREE.Mesh;
  private readonly bell: THREE.Group;
  private readonly flag: THREE.Group;
  private readonly goalTag: THREE.Sprite;
  private readonly handleResize = (): void => this.resize();
  private readonly handleVisibility = (): void => {
    this.pageVisible = document.visibilityState === "visible";
    this.lastTime = 0;
    this.updateLoopState();
  };
  private renderer: THREE.WebGLRenderer | null = null;
  private physics: ChainPhysicsWorld | null = null;
  private resizeObserver: ResizeObserver | null = null;
  private intersectionObserver: IntersectionObserver | null = null;
  private quality: QualityProfile = getQualityProfile(1440, 900, 1);
  private chainState: ChainState = createInitialChain();
  private reducedMotion: boolean;
  private pageVisible = typeof document === "undefined" || document.visibilityState === "visible";
  private inViewport = true;
  private disposed = false;
  private loopActive = false;
  private lastTime = 0;
  private lastRenderedTime = 0;
  private celebrationProgress = 0;
  private frameCount = 0;
  private lastUiKey = "";
  private cameraFrom: CameraPreset;
  private cameraTo: CameraPreset;
  private cameraBlend = 1;
  private readonly cameraTarget = new THREE.Vector3();
  private animationFrameId = 0;

  private readonly render = (time: number): void => this.renderFrame(time);

  public constructor(container: HTMLElement, options: DeskChainReactionSceneOptions) {
    this.container = container;
    this.options = options;
    this.reducedMotion = options.reducedMotion;
    this.materials = {
      wall: createMaterial(COLORS.wall, { roughness: 0.92 }),
      desk: createMaterial(COLORS.desk, { roughness: 0.82 }),
      deskEdge: createMaterial(COLORS.deskEdge, { roughness: 0.86 }),
      page: createMaterial(COLORS.page, { roughness: 0.95 }),
      pageShadow: createMaterial(COLORS.pageShadow, { roughness: 0.92 }),
      ruler: createMaterial(COLORS.ruler, { roughness: 0.78 }),
      ink: createMaterial(COLORS.ink, { roughness: 0.72 }),
      pencil: createMaterial(COLORS.pencil, { roughness: 0.66 }),
      yellow: createMaterial(COLORS.pencilYellow, { roughness: 0.68 }),
      red: createMaterial(COLORS.red, { roughness: 0.14, metalness: 0.12 }),
      blue: createMaterial(COLORS.blue, { roughness: 0.18, metalness: 0.08 }),
      wood: createMaterial(COLORS.wood, { roughness: 0.88 }),
      woodDark: createMaterial(COLORS.woodDark, { roughness: 0.9 }),
      paper: createMaterial(COLORS.paper, { roughness: 0.98 }),
      rubber: createMaterial(COLORS.rubber, { roughness: 0.9 }),
      brass: createMaterial(COLORS.brass, { roughness: 0.38, metalness: 0.74 }),
      bell: createMaterial(COLORS.bell, { roughness: 0.26, metalness: 0.86 }),
      metal: createMaterial(COLORS.metal, { roughness: 0.55, metalness: 0.52 }),
      green: createMaterial(COLORS.green, { roughness: 0.84 }),
      goal: createMaterial(COLORS.goal, { roughness: 0.76 }),
      dark: createMaterial(COLORS.dark, { roughness: 0.72 }),
    };
    this.cameraFrom = getHeroCamera(1440, 900);
    this.cameraTo = this.cameraFrom;
    this.scene.background = new THREE.Color(COLORS.wall);
    this.scene.fog = new THREE.Fog(COLORS.wall, 18, 38);
    this.root.add(this.roomRoot, this.deskRoot, this.chainRoot, this.mechanismRoot, this.dynamicRoot);
    this.scene.add(this.root);
    this.buildRoom();
    this.buildDesk();
    this.buildFunctionalObjects();
    this.redMarble = this.createMarble(COLORS.red, 0.22, "red-marble");
    this.blueMarble = this.createMarble(COLORS.blue, 0.2, "blue-marble");
    this.eraser = addBox(this.dynamicRoot, this.getBoxGeometry("eraser", BODY_LAYOUT.eraser.size), this.materials.rubber, { ...BODY_LAYOUT.eraser, rotation: [0, 0, 0] });
    this.pencil = this.buildPencil();
    this.toyCar = this.buildToyCar();
    this.buildBlocks();
    this.seesaw = addBox(this.mechanismRoot, this.getBoxGeometry("seesaw", FUNCTIONAL_LAYOUT.seesawRuler.size), this.materials.pageShadow, FUNCTIONAL_LAYOUT.seesawRuler);
    this.balanceRuler = addBox(this.mechanismRoot, this.getBoxGeometry("balance", FUNCTIONAL_LAYOUT.balanceRuler.size), this.materials.pageShadow, FUNCTIONAL_LAYOUT.balanceRuler);
    this.clothespin = this.buildClothespin();
    this.rubberBand = new THREE.Mesh(new THREE.TorusGeometry(0.34, 0.026, 6, 24), this.materials.rubber);
    this.rubberBand.rotation.x = Math.PI / 2;
    this.rubberBand.position.set(0.12, 0.3, -1.1);
    this.rubberBand.castShadow = true;
    this.mechanismRoot.add(this.rubberBand);
    this.redStopper = addBox(this.mechanismRoot, this.getBoxGeometry("red-stopper", MECHANISM_LAYOUT.redStopper.size), this.materials.woodDark, { ...MECHANISM_LAYOUT.redStopper, rotation: [0, 0, 0] });
    this.eraserRest = addBox(this.mechanismRoot, this.getBoxGeometry("eraser-rest", FUNCTIONAL_LAYOUT.eraserRest.size), this.materials.pageShadow, FUNCTIONAL_LAYOUT.eraserRest);
    this.carChock = addBox(this.mechanismRoot, this.getBoxGeometry("car-chock", MECHANISM_LAYOUT.carChock.size), this.materials.rubber, { ...MECHANISM_LAYOUT.carChock, rotation: [0, 0, 0] });
    this.blueStopper = addBox(this.mechanismRoot, this.getBoxGeometry("blue-stopper", MECHANISM_LAYOUT.blueStopper.size), this.materials.woodDark, { ...MECHANISM_LAYOUT.blueStopper, rotation: [0, 0, 0] });
    this.striker = addBeam(this.mechanismRoot, [5.34, 1.0, -0.02], [5.34, 0.43, -0.02], 0.045, this.materials.dark);
    this.bell = this.buildBell();
    this.flag = this.buildFlag();
    this.goalTag = this.buildGoalTag();
    this.dynamicMeshes.set("redMarble", this.redMarble);
    this.dynamicMeshes.set("blueMarble", this.blueMarble);
    this.dynamicMeshes.set("eraser", this.eraser);
    this.dynamicMeshes.set("pencil", this.pencil);
    this.dynamicMeshes.set("car", this.toyCar);
    this.camera.position.set(...this.cameraFrom.position);
    this.cameraTarget.set(...this.cameraFrom.target);
    this.camera.lookAt(...this.cameraFrom.target);
  }

  public async init(): Promise<void> {
    this.options.onLoadingState?.("夕方の机を準備しています");
    const viewport = this.getViewportSize();
    this.quality = getQualityProfile(viewport.width, viewport.height, window.devicePixelRatio || 1);
    this.cameraFrom = getHeroCamera(viewport.width, viewport.height);
    this.cameraTo = this.cameraFrom;
    this.camera.position.set(...this.cameraFrom.position);
    this.cameraTarget.set(...this.cameraFrom.target);
    this.camera.lookAt(...this.cameraFrom.target);
    this.configureLighting();
    this.renderer = new THREE.WebGLRenderer({ antialias: this.quality.antialias, alpha: false, powerPreference: "low-power" });
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.05;
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFShadowMap;
    this.renderer.domElement.setAttribute("aria-hidden", "true");
    this.renderer.domElement.setAttribute("role", "presentation");
    this.renderer.domElement.style.display = "block";
    this.renderer.domElement.style.width = "100%";
    this.renderer.domElement.style.height = "100%";
    this.container.appendChild(this.renderer.domElement);
    this.resizeObserver = new ResizeObserver(this.handleResize);
    this.resizeObserver.observe(this.container);
    this.intersectionObserver = new IntersectionObserver(([entry]) => {
      const rect = entry?.boundingClientRect;
      const intersectsViewport = Boolean(rect && rect.bottom > 0 && rect.top < window.innerHeight);
      this.inViewport = entry ? entry.isIntersecting || intersectsViewport : true;
      this.updateLoopState();
    }, { threshold: 0.01 });
    this.intersectionObserver.observe(this.container);
    window.addEventListener("resize", this.handleResize, { passive: true });
    document.addEventListener("visibilitychange", this.handleVisibility);
    this.resize();
    this.options.onLoadingState?.("連鎖の物理を読み込んでいます");
    const rapier = await loadRapier();
    if (this.disposed) return;
    this.physics = new ChainPhysicsWorld(rapier, this.quality);
    this.publishState(true);
    this.renderOnce();
    this.options.onLoadingState?.("READY");
  }

  public start(): void {
    if (this.disposed || !this.physics || this.chainState.phase !== "ready") return;
    this.physics.start();
    this.chainState = startChain(this.chainState);
    this.celebrationProgress = 0;
    this.moveCameraToCurrentStage(true);
    this.publishState(true);
    this.updateLoopState();
  }

  public restart(): void {
    if (this.disposed || !this.physics) return;
    this.physics.reset();
    this.chainState = resetChain();
    this.celebrationProgress = 0;
    this.cameraFrom = this.getCurrentCamera();
    const viewport = this.getViewportSize();
    this.cameraTo = getHeroCamera(viewport.width, viewport.height);
    this.cameraBlend = this.reducedMotion ? 1 : 0;
    this.resetVisualState();
    this.publishState(true);
    this.renderOnce();
    this.updateLoopState();
  }

  public setReducedMotion(enabled: boolean): void {
    if (this.disposed) return;
    this.reducedMotion = enabled;
    if (enabled) this.cameraBlend = 1;
    this.updateLoopState();
    this.publishState(true);
  }

  public dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.loopActive = false;
    window.cancelAnimationFrame(this.animationFrameId);
    this.resizeObserver?.disconnect();
    this.intersectionObserver?.disconnect();
    window.removeEventListener("resize", this.handleResize);
    document.removeEventListener("visibilitychange", this.handleVisibility);
    this.physics?.dispose();
    this.physics = null;
    this.renderer?.domElement.remove();
    disposeSceneResources(this.scene);
    this.renderer?.dispose();
    this.renderer = null;
  }

  private buildRoom(): void {
    addBox(this.roomRoot, this.getBoxGeometry("wall", ROOM_LAYOUT.wall.size), this.materials.wall, { ...ROOM_LAYOUT.wall, rotation: [0, 0, 0] });
    addBox(this.roomRoot, this.getBoxGeometry("shelf", ROOM_LAYOUT.shelf.size), this.materials.woodDark, { ...ROOM_LAYOUT.shelf, rotation: [0, 0, 0] });
    addBox(this.roomRoot, this.getBoxGeometry("shelf-top", ROOM_LAYOUT.shelfTop.size), this.materials.wood, { ...ROOM_LAYOUT.shelfTop, rotation: [0, 0, 0] });
    for (let index = 0; index < 4; index += 1) {
      addBox(this.roomRoot, this.getBoxGeometry(`shelf-book-${index}`, [0.42, 0.95, 0.68]), index % 2 === 0 ? this.materials.blue : this.materials.green, {
        size: [0.42, 0.95, 0.68], position: [-5.35 + index * 0.48, 2.86, -2.88], rotation: [0, (index - 1.5) * 0.04, 0],
      });
    }
    const paper = addBox(this.roomRoot, this.getBoxGeometry("wall-paper", [1.45, 1.0, 0.025]), this.materials.page, {
      size: [1.45, 1.0, 0.025], position: [2.45, 3.75, -3.32], rotation: [0, 0, -0.04],
    });
    paper.castShadow = false;
  }

  private buildDesk(): void {
    addBox(this.deskRoot, this.getBoxGeometry("desk-top", [12, 0.24, 7]), this.materials.desk, FUNCTIONAL_LAYOUT.deskSurface);
    addBox(this.deskRoot, this.getBoxGeometry("desk-front-edge", [12, 0.2, 0.12]), this.materials.deskEdge, { size: [12, 0.2, 0.12], position: [0, -0.03, 3.45], rotation: [0, 0, 0] });
    addBox(this.deskRoot, this.getBoxGeometry("notebook", [2.25, 0.045, 1.5]), this.materials.page, { size: [2.25, 0.045, 1.5], position: [-1.45, 0.04, 1.15], rotation: [0, 0, -0.05] });
    addBox(this.deskRoot, this.getBoxGeometry("notebook-cover", [2.32, 0.03, 1.55]), this.materials.blue, { size: [2.32, 0.03, 1.55], position: [-1.45, 0.005, 1.15], rotation: [0, 0, -0.05] });
    addBox(this.deskRoot, this.getBoxGeometry("loose-paper", [1.35, 0.035, 0.85]), this.materials.page, { size: [1.35, 0.035, 0.85], position: [0.3, 0.06, 2.0], rotation: [0, 0, 0.08] });
    addBox(this.deskRoot, this.getBoxGeometry("ruler-loose", [2.3, 0.05, 0.12]), this.materials.pageShadow, { size: [2.3, 0.05, 0.12], position: [-0.2, 0.08, 2.6], rotation: [0, 0, 0.18] });
    const pencilCup = addCylinder(this.deskRoot, new THREE.CylinderGeometry(0.42, 0.35, 0.85, 16), this.materials.blue, [4.95, 0.43, 2.15]);
    pencilCup.castShadow = true;
    [-0.14, 0.02, 0.15].forEach((offset, index) => {
      const color = index === 1 ? this.materials.yellow : this.materials.pencil;
      addCylinder(this.deskRoot, new THREE.CylinderGeometry(0.035, 0.035, 1.55, 8), color, [4.95 + offset, 1.12, 2.15], [offset * 0.6, 0, offset]);
    });
  }

  private buildFunctionalObjects(): void {
    const boxes: readonly BoxDefinition[] = [
      FUNCTIONAL_LAYOUT.redRamp,
      FUNCTIONAL_LAYOUT.carRamp,
      FUNCTIONAL_LAYOUT.blueRamp,
      FUNCTIONAL_LAYOUT.eraserRest,
      FUNCTIONAL_LAYOUT.cupBottom,
    ];
    boxes.forEach((definition) => {
      const material = definition.material === "book" ? this.materials.pageShadow : this.materials[definition.material];
      addBox(this.chainRoot, this.getBoxGeometry(definition.id, definition.size), material, definition);
    });
    addBox(this.chainRoot, this.getBoxGeometry("red-book-support", [2.0, 0.34, 1.45]), this.materials.blue, { size: [2.0, 0.34, 1.45], position: [-4.15, 0.26, -1.1], rotation: [0, 0, 0.02] });
    addBox(this.chainRoot, this.getBoxGeometry("red-book-pages", [1.85, 0.16, 1.28]), this.materials.page, { size: [1.85, 0.16, 1.28], position: [-4.15, 0.5, -1.1], rotation: [0, 0, 0.02] });
    addBox(this.chainRoot, this.getBoxGeometry("car-book-cover", [3.35, 0.18, 1.4]), this.materials.green, { size: [3.35, 0.18, 1.4], position: [3.68, 0.5, -0.18], rotation: [0, 0, 0.34] });
    addBox(this.chainRoot, this.getBoxGeometry("car-book-pages", [3.12, 0.12, 1.26]), this.materials.page, { size: [3.12, 0.12, 1.26], position: [3.68, 0.66, -0.18], rotation: [0, 0, 0.34] });
    for (let index = 0; index < 6; index += 1) {
      const t = index / 5;
      const x = -4.8 + t * 3.25;
      const y = 0.35 + (1 - t) * 0.2;
      addBox(this.chainRoot, this.getBoxGeometry(`ruler-tick-${index}`, [0.025, 0.045, 0.52]), this.materials.ink, { size: [0.025, 0.045, 0.52], position: [x, y, -1.1], rotation: [0, 0, -0.44] });
    }
    const cup = new THREE.Mesh(new THREE.CylinderGeometry(0.45, 0.33, 0.82, 16, 1, true), this.materials.paper);
    cup.position.set(4.58, 0.66, 0.95);
    cup.castShadow = true;
    cup.receiveShadow = true;
    this.chainRoot.add(cup);
    addCylinder(this.chainRoot, new THREE.CylinderGeometry(0.33, 0.33, 0.06, 16), this.materials.pageShadow, [4.58, 0.27, 0.95]);
    addCylinder(this.mechanismRoot, new THREE.CylinderGeometry(0.16, 0.16, 0.48, 12), this.materials.woodDark, MECHANISM_LAYOUT.pivotSeesaw, [Math.PI / 2, 0, 0]);
    addCylinder(this.mechanismRoot, new THREE.CylinderGeometry(0.15, 0.15, 0.42, 12), this.materials.woodDark, MECHANISM_LAYOUT.pivotBalance, [Math.PI / 2, 0, 0]);
  }

  private createMarble(color: number, radius: number, name: string): THREE.Mesh {
    const marble = new THREE.Mesh(new THREE.SphereGeometry(radius, 20, 14), color === COLORS.red ? this.materials.red : this.materials.blue);
    marble.name = name;
    marble.castShadow = true;
    marble.receiveShadow = true;
    this.dynamicRoot.add(marble);
    return marble;
  }

  private buildPencil(): THREE.Group {
    const group = new THREE.Group();
    const body = new THREE.Mesh(new THREE.CylinderGeometry(0.075, 0.075, 1.28, 6), this.materials.pencil);
    body.rotation.z = Math.PI / 2;
    body.castShadow = true;
    group.add(body);
    const tip = new THREE.Mesh(new THREE.ConeGeometry(0.075, 0.24, 6), this.materials.wood);
    tip.rotation.z = -Math.PI / 2;
    tip.position.x = 0.76;
    tip.castShadow = true;
    group.add(tip);
    const eraser = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 0.16, 6), this.materials.rubber);
    eraser.rotation.z = Math.PI / 2;
    eraser.position.x = -0.72;
    eraser.castShadow = true;
    group.add(eraser);
    group.position.set(...BODY_LAYOUT.pencil.position);
    this.dynamicRoot.add(group);
    return group;
  }

  private buildBlocks(): void {
    BODY_LAYOUT.blocks.forEach((position, index) => {
      const mesh = addBox(this.dynamicRoot, this.getBoxGeometry("wood-block", BODY_LAYOUT.blockSize), createMaterial(Number.parseInt(BLOCK_COLORS[index].slice(1), 16)), { size: BODY_LAYOUT.blockSize, position, rotation: [0, 0, 0] });
      this.blockMeshes.push(mesh);
      this.dynamicMeshes.set(`block${index}`, mesh);
    });
  }

  private buildToyCar(): THREE.Group {
    const group = new THREE.Group();
    addBox(group, this.getBoxGeometry("car-chassis", [0.82, 0.2, 0.48]), this.materials.red, { size: [0.82, 0.2, 0.48], position: [0, 0, 0], rotation: [0, 0, 0] });
    addBox(group, this.getBoxGeometry("car-cabin", [0.4, 0.24, 0.38]), this.materials.blue, { size: [0.4, 0.24, 0.38], position: [-0.05, 0.2, 0], rotation: [0, 0, 0] });
    for (const x of [-0.28, 0.28]) {
      for (const z of [-0.25, 0.25]) addCylinder(group, new THREE.CylinderGeometry(0.11, 0.11, 0.08, 12), this.materials.dark, [x, -0.13, z], [Math.PI / 2, 0, 0]);
    }
    group.position.set(...BODY_LAYOUT.car.position);
    this.dynamicRoot.add(group);
    return group;
  }

  private buildClothespin(): THREE.Group {
    const group = new THREE.Group();
    addBox(group, this.getBoxGeometry("clothespin-arm", [0.68, 0.12, 0.22]), this.materials.wood, { size: [0.68, 0.12, 0.22], position: [-0.18, 0, 0], rotation: [0, 0, 0.05] });
    addBox(group, this.getBoxGeometry("clothespin-arm-b", [0.68, 0.12, 0.22]), this.materials.wood, { size: [0.68, 0.12, 0.22], position: [0.18, 0, 0], rotation: [0, 0, -0.05] });
    addCylinder(group, new THREE.CylinderGeometry(0.09, 0.09, 0.32, 10), this.materials.metal, [0, 0, 0], [Math.PI / 2, 0, 0]);
    group.position.set(-0.18, 0.34, -1.1);
    this.mechanismRoot.add(group);
    return group;
  }

  private buildBell(): THREE.Group {
    const group = new THREE.Group();
    addCylinder(group, new THREE.CylinderGeometry(0.48, 0.55, 0.16, 18), this.materials.dark, [0, 0, 0]);
    addCylinder(group, new THREE.CylinderGeometry(0.36, 0.46, 0.42, 18), this.materials.bell, [0, 0.25, 0]);
    addCylinder(group, new THREE.CylinderGeometry(0.11, 0.11, 0.14, 12), this.materials.bell, [0, 0.54, 0]);
    const dome = new THREE.Mesh(new THREE.SphereGeometry(0.12, 14, 8), this.materials.bell);
    dome.position.y = 0.62;
    dome.castShadow = true;
    group.add(dome);
    group.position.set(5.42, 0.35, -0.02);
    this.mechanismRoot.add(group);
    return group;
  }

  private buildFlag(): THREE.Group {
    const group = new THREE.Group();
    addCylinder(group, new THREE.CylinderGeometry(0.025, 0.025, 1.45, 8), this.materials.dark, [0, 0.72, 0]);
    addBox(group, this.getBoxGeometry("goal-flag", [0.62, 0.34, 0.04]), this.materials.goal, { size: [0.62, 0.34, 0.04], position: [0.28, 1.22, 0], rotation: [0, 0, 0] });
    group.position.set(5.85, -0.1, 0.2);
    group.scale.y = 0.08;
    this.mechanismRoot.add(group);
    return group;
  }

  private buildGoalTag(): THREE.Sprite {
    const canvas = document.createElement("canvas");
    canvas.width = 160;
    canvas.height = 72;
    const context = canvas.getContext("2d");
    if (context) {
      context.fillStyle = "#f3c84c";
      context.fillRect(0, 0, canvas.width, canvas.height);
      context.fillStyle = "#27353a";
      context.font = "bold 30px Arial";
      context.textAlign = "center";
      context.textBaseline = "middle";
      context.fillText("GOAL", canvas.width / 2, canvas.height / 2 + 2);
    }
    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: texture, transparent: true }));
    sprite.scale.set(1.15, 0.52, 1);
    sprite.position.set(5.25, 1.65, -0.02);
    this.mechanismRoot.add(sprite);
    return sprite;
  }

  private configureLighting(): void {
    const key = new THREE.DirectionalLight(0xffd4a1, 3.2);
    key.position.set(-4, 12, 8);
    key.target.position.set(0, 0, 0);
    key.castShadow = true;
    key.shadow.mapSize.set(this.quality.shadowMapSize, this.quality.shadowMapSize);
    key.shadow.camera.left = -8;
    key.shadow.camera.right = 8;
    key.shadow.camera.top = 9;
    key.shadow.camera.bottom = -5;
    key.shadow.camera.near = 1;
    key.shadow.camera.far = 28;
    key.shadow.bias = -0.00025;
    this.scene.add(key, key.target);
    this.scene.add(new THREE.HemisphereLight(0xfff0d8, 0x6e574c, 1.8));
    this.scene.add(new THREE.AmbientLight(0xfff3de, 0.35));
  }

  private getBoxGeometry(id: string, size: Vector3Tuple): THREE.BoxGeometry {
    const key = `${id}:${size.join(",")}`;
    const existing = this.boxGeometries.get(key);
    if (existing) return existing;
    const geometry = new THREE.BoxGeometry(...size);
    this.boxGeometries.set(key, geometry);
    return geometry;
  }

  private resetVisualState(): void {
    this.redMarble.position.set(...BODY_LAYOUT.redMarble.position);
    this.blueMarble.position.set(...BODY_LAYOUT.blueMarble.position);
    this.eraser.position.set(...BODY_LAYOUT.eraser.position);
    this.pencil.position.set(...BODY_LAYOUT.pencil.position);
    this.toyCar.position.set(...BODY_LAYOUT.car.position);
    this.blockMeshes.forEach((mesh, index) => {
      const position = BODY_LAYOUT.blocks[index];
      if (!position) return;
      mesh.position.set(position[0], position[1], position[2]);
      mesh.rotation.set(0, 0, 0);
    });
    this.seesaw.rotation.set(0, 0, 0);
    this.balanceRuler.rotation.set(0, 0, 0);
    this.clothespin.children[0]?.rotation.set(0, 0, 0.05);
    this.clothespin.children[1]?.rotation.set(0, 0, -0.05);
    this.rubberBand.scale.set(1, 1, 1);
    this.redStopper.visible = true;
    this.eraserRest.visible = true;
    this.carChock.visible = true;
    this.blueStopper.visible = true;
    this.striker.position.set(5.34, 0.715, -0.02);
    this.bell.rotation.set(0, 0, 0);
    this.flag.scale.y = 0.08;
  }

  private updateDynamicVisuals(): MechanismSnapshot | null {
    const physics = this.physics;
    if (!physics) return null;
    const bodyIds: readonly DynamicBodyId[] = ["redMarble", "blueMarble", "eraser", "pencil", "car", "block0", "block1", "block2", "block3", "block4", "block5", "block6"];
    bodyIds.forEach((id) => {
      const mesh = this.dynamicMeshes.get(id);
      if (mesh) {
        const snapshot = physics.getSnapshot(id);
        this.applySnapshot(mesh, snapshot);
      }
    });
    const mechanisms = physics.getMechanismSnapshot();
    this.clothespin.children[0]?.rotation.set(0, 0, 0.05 + mechanisms.clothespin * 0.32);
    this.clothespin.children[1]?.rotation.set(0, 0, -0.05 - mechanisms.clothespin * 0.32);
    this.rubberBand.scale.set(1 - mechanisms.rubberBand * 0.68, 1, 1 - mechanisms.rubberBand * 0.35);
    this.seesaw.rotation.z = -0.42 * mechanisms.seesaw;
    this.balanceRuler.rotation.z = -0.34 * mechanisms.balance;
    this.redStopper.visible = mechanisms.redStopperVisible;
    this.eraserRest.visible = mechanisms.eraserRestVisible;
    this.carChock.visible = !mechanisms.carReleased;
    this.blueStopper.visible = !mechanisms.blueReleased;
    this.striker.position.y = 0.715 - mechanisms.striker * 0.31;
    this.bell.rotation.z = mechanisms.striker * 0.08;
    this.flag.scale.y = Math.max(0.08, this.celebrationProgress);
    return mechanisms;
  }

  private applySnapshot(mesh: THREE.Object3D, snapshot: BodySnapshot): void {
    mesh.position.set(...snapshot.position);
    mesh.quaternion.set(snapshot.rotation[0], snapshot.rotation[1], snapshot.rotation[2], snapshot.rotation[3]);
  }

  private processPhysicsEvents(): void {
    if (!this.physics) return;
    for (const event of this.physics.consumeEvents()) {
      const previous = this.chainState;
      this.chainState = triggerChainEvent(this.chainState, event);
      if (this.chainState !== previous) {
        this.moveCameraToCurrentStage(false);
        this.publishState(true);
      }
    }
  }

  private renderFrame(time: number): void {
    if (!this.renderer || this.disposed || !this.pageVisible || !this.inViewport) return;
    const frameInterval = 1000 / this.quality.targetFps;
    if (this.lastRenderedTime > 0 && time - this.lastRenderedTime < frameInterval) {
      this.animationFrameId = window.requestAnimationFrame(this.render);
      return;
    }
    const delta = this.lastTime > 0 ? Math.min(0.06, Math.max(0, (time - this.lastTime) / 1000)) : 0;
    this.lastTime = time;
    this.lastRenderedTime = time;
    this.frameCount += 1;
    if (this.chainState.phase === "running") {
      this.physics?.advance(delta, true);
      this.processPhysicsEvents();
      const result = advanceChain(this.chainState, delta);
      this.chainState = result.state;
      if (result.timedOut) this.publishState(true);
    }
    if (this.chainState.phase === "complete") this.celebrationProgress = Math.min(1, this.celebrationProgress + delta / 0.8);
    this.updateDynamicVisuals();
    this.updateCamera(delta);
    this.renderer.render(this.scene, this.camera);
    this.publishState(false);
    this.updateLoopState();
    if (this.loopActive) this.animationFrameId = window.requestAnimationFrame(this.render);
  }

  private updateCamera(delta: number): void {
    if (this.reducedMotion) return;
    this.cameraBlend = Math.min(1, this.cameraBlend + delta / 0.75);
    const preset = interpolateCamera(this.cameraFrom, this.cameraTo, this.cameraBlend);
    this.camera.position.lerp(new THREE.Vector3(...preset.position), Math.min(1, delta * 3.2));
    this.cameraTarget.lerp(new THREE.Vector3(...preset.target), Math.min(1, delta * 3.2));
    this.camera.lookAt(this.cameraTarget);
    this.camera.fov += (preset.fov - this.camera.fov) * Math.min(1, delta * 3.2);
    this.camera.updateProjectionMatrix();
  }

  private moveCameraToCurrentStage(immediate: boolean): void {
    const viewport = this.getViewportSize();
    this.cameraFrom = this.getCurrentCamera();
    this.cameraTo = this.chainState.phase === "running"
      ? getStageCamera(getCurrentStage(this.chainState).id, viewport.width, viewport.height, this.reducedMotion)
      : getHeroCamera(viewport.width, viewport.height);
    this.cameraBlend = immediate || this.reducedMotion ? 1 : 0;
  }

  private getCurrentCamera(): CameraPreset {
    return { position: [this.camera.position.x, this.camera.position.y, this.camera.position.z], target: [this.cameraTarget.x, this.cameraTarget.y, this.cameraTarget.z], fov: this.camera.fov };
  }

  private publishState(force: boolean): void {
    const stage = getCurrentStage(this.chainState);
    const progress = this.chainState.phase === "ready" ? 0 : getStageProgress(this.chainState);
    const key = [this.chainState.phase, this.chainState.stageIndex, Math.floor(progress * 10), this.physics ? "ready" : "loading"].join("|");
    if (!force && key === this.lastUiKey) return;
    this.lastUiKey = key;
    const statusText = this.chainState.phase === "ready"
      ? "READY — START THE DESK RELAY"
      : this.chainState.phase === "running"
        ? stage.label
        : this.chainState.phase === "complete"
          ? "COMPLETE — GOAL BELL RUNG"
          : this.chainState.errorMessage || "ERROR — RESTART REQUIRED";
    this.options.onStateChange?.({
      runtimeStatus: this.physics ? "ready" : "loading",
      backend: this.physics ? "WebGL 2" : "pending",
      phase: this.chainState.phase,
      stageLabel: stage.label,
      stageIndex: this.chainState.stageIndex,
      stageCount: CHAIN_STAGES.length,
      progress: this.chainState.phase === "complete" ? 1 : getRunProgress(this.chainState),
      statusText,
      canStart: Boolean(this.physics) && this.chainState.phase === "ready",
    });
  }

  private updateLoopState(): void {
    if (this.disposed) return;
    const active = this.pageVisible && this.inViewport && (this.chainState.phase === "running" || (this.chainState.phase === "complete" && this.celebrationProgress < 1));
    if (active && !this.loopActive) {
      this.loopActive = true;
      this.lastTime = 0;
      this.lastRenderedTime = 0;
      this.animationFrameId = window.requestAnimationFrame(this.render);
    } else if (!active) {
      this.loopActive = false;
    }
  }

  private renderOnce(): void {
    if (!this.renderer || this.disposed) return;
    this.updateDynamicVisuals();
    this.renderer.render(this.scene, this.camera);
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

  private getViewportSize(): { readonly width: number; readonly height: number } {
    return { width: Math.max(1, this.container.clientWidth), height: Math.max(1, this.container.clientHeight) };
  }
}
