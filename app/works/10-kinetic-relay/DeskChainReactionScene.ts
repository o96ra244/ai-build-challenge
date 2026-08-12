import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";

import {
  CHAIN_MOTIONS,
  BLOCK_COLORS,
  BLOCK_STARTS,
  GOAL_LAYOUT,
  MOTION_OBJECT_STARTS,
  ROOM_LAYOUT,
  TRACK_LAYOUT,
  type ChainMotion,
  type MotionObjectId,
} from "./deskLayout";
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
import { ChainPhysicsWorld, loadRapier, type BodySnapshot } from "./chainPhysics";
import { clampTarget, getFollowTarget, getHomeCamera, type CameraMode, type CameraPreset } from "./cameraDirector";
import { addBeam, addBox, addCylinder, createMaterial, disposeSceneResources, type GeometryCache, type MaterialSet } from "./sceneObjects";
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
  readonly cameraMode: CameraMode;
};

export type DeskChainReactionSceneOptions = {
  readonly reducedMotion: boolean;
  readonly onLoadingState?: (message: string) => void;
  readonly onStateChange?: (state: DeskChainUiState) => void;
};

const COLORS = {
  wall: 0xe6dbc6,
  desk: 0x9c603f,
  deskEdge: 0x70412d,
  book: 0xc9b693,
  paper: 0xf2eadb,
  ruler: 0xe2cb91,
  ink: 0x32474b,
  pencil: 0xd66b45,
  yellow: 0xe6b94c,
  red: 0xc93f43,
  blue: 0x3f74a6,
  green: 0x6d8b73,
  wood: 0xb97b4f,
  woodDark: 0x75452f,
  rubber: 0xc9848c,
  metal: 0x707c7b,
  brass: 0xc9994b,
  bell: 0xd2a64e,
  goal: 0xf2c84e,
  dark: 0x26373c,
} as const;

export class DeskChainReactionScene {
  private readonly container: HTMLElement;
  private readonly options: DeskChainReactionSceneOptions;
  private readonly scene = new THREE.Scene();
  private readonly camera = new THREE.PerspectiveCamera(48, 1, 0.1, 70);
  private readonly root = new THREE.Group();
  private readonly roomRoot = new THREE.Group();
  private readonly deskRoot = new THREE.Group();
  private readonly trackRoot = new THREE.Group();
  private readonly propRoot = new THREE.Group();
  private readonly motionRoot = new THREE.Group();
  private readonly geometryCache: GeometryCache = new Map();
  private readonly materials: MaterialSet;
  private readonly motionMeshes = new Map<MotionObjectId, THREE.Object3D>();
  private readonly blockMeshes: THREE.Mesh[] = [];
  private readonly stringLine: THREE.Mesh;
  private readonly goalFlag: THREE.Group;
  private readonly bell: THREE.Group;
  private readonly goalTag: THREE.Sprite;
  private readonly handleResize = (): void => this.resize();
  private readonly handleVisibility = (): void => {
    this.pageVisible = document.visibilityState === "visible";
    this.lastTime = 0;
    this.updateLoopState();
  };
  private readonly handleControlsStart = (): void => {
    if (this.suppressControlInput) return;
    if (this.cameraMode !== "free") {
      this.cameraMode = "free";
      this.publishState(true);
    }
    this.controlsActiveUntil = performance.now() + 500;
    this.updateLoopState();
  };
  private readonly handleControlsChange = (): void => {
    if (this.suppressControlInput) return;
    this.controlsActiveUntil = performance.now() + 360;
    this.updateLoopState();
  };
  private readonly render = (time: number): void => this.renderFrame(time);
  private renderer: THREE.WebGLRenderer | null = null;
  private controls: OrbitControls | null = null;
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
  private lastUiKey = "";
  private controlsActiveUntil = 0;
  private celebrationProgress = 0;
  private cameraMode: CameraMode = "follow";
  private suppressControlInput = false;
  private cameraHome: CameraPreset;
  private animationFrameId = 0;

  public constructor(container: HTMLElement, options: DeskChainReactionSceneOptions) {
    this.container = container;
    this.options = options;
    this.reducedMotion = options.reducedMotion;
    this.materials = this.createMaterials();
    this.cameraHome = getHomeCamera(1440, 900);
    this.scene.background = new THREE.Color(COLORS.wall);
    this.scene.fog = new THREE.Fog(COLORS.wall, 18, 42);
    this.root.add(this.roomRoot, this.deskRoot, this.trackRoot, this.propRoot, this.motionRoot);
    this.scene.add(this.root);

    this.buildRoom();
    this.buildDesk();
    this.buildTracks();
    this.buildProps();
    this.buildMotionObjects();
    this.stringLine = addBeam(this.propRoot, [-2.5, 0.9, -1.4], [-2.5, 4.55, -3.75], 0.018, this.materials.yellow);
    this.goalFlag = this.buildGoalFlag();
    this.bell = this.buildBell();
    this.goalTag = this.buildGoalTag();
    this.camera.position.set(...this.cameraHome.position);
    this.camera.lookAt(...this.cameraHome.target);
  }

  public async init(): Promise<void> {
    this.options.onLoadingState?.("夕方の子ども部屋を準備しています");
    const viewport = this.getViewportSize();
    this.quality = getQualityProfile(viewport.width, viewport.height, window.devicePixelRatio || 1);
    this.cameraHome = getHomeCamera(viewport.width, viewport.height);
    this.camera.position.set(...this.cameraHome.position);
    this.camera.lookAt(...this.cameraHome.target);
    this.configureLighting();
    this.renderer = new THREE.WebGLRenderer({ antialias: this.quality.antialias, alpha: false, powerPreference: "low-power" });
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.04;
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFShadowMap;
    this.renderer.domElement.setAttribute("aria-hidden", "true");
    this.renderer.domElement.setAttribute("role", "presentation");
    this.renderer.domElement.style.display = "block";
    this.renderer.domElement.style.width = "100%";
    this.renderer.domElement.style.height = "100%";
    this.container.appendChild(this.renderer.domElement);

    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.target.set(...this.cameraHome.target);
    this.controls.enablePan = false;
    this.controls.enableDamping = true;
    this.controls.dampingFactor = this.reducedMotion ? 0.16 : 0.08;
    this.controls.minDistance = this.cameraHome.minDistance;
    this.controls.maxDistance = this.cameraHome.maxDistance;
    this.controls.minPolarAngle = this.cameraHome.minPolarAngle;
    this.controls.maxPolarAngle = this.cameraHome.maxPolarAngle;
    this.controls.addEventListener("start", this.handleControlsStart);
    this.controls.addEventListener("change", this.handleControlsChange);
    this.suppressControlInput = true;
    this.controls.update();
    this.suppressControlInput = false;

    this.resizeObserver = new ResizeObserver(this.handleResize);
    this.resizeObserver.observe(this.container);
    this.intersectionObserver = new IntersectionObserver(([entry]) => {
      const rect = entry?.boundingClientRect;
      this.inViewport = Boolean(entry?.isIntersecting || (rect && rect.bottom > 0 && rect.top < window.innerHeight));
      this.updateLoopState();
    }, { threshold: 0.01 });
    this.intersectionObserver.observe(this.container);
    window.addEventListener("resize", this.handleResize, { passive: true });
    document.addEventListener("visibilitychange", this.handleVisibility);
    this.resize();
    this.options.onLoadingState?.("長い机上連鎖の物理を読み込んでいます");
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
    this.physics.setStage(getCurrentStage(this.chainState).id);
    this.celebrationProgress = 0;
    this.publishState(true);
    this.updateLoopState();
  }

  public restart(): void {
    if (this.disposed || !this.physics) return;
    this.physics.reset();
    this.chainState = resetChain();
    this.celebrationProgress = 0;
    this.cameraMode = "follow";
    this.setHomeCamera();
    this.publishState(true);
    this.renderOnce();
    this.updateLoopState();
  }

  public setCameraMode(mode: CameraMode): void {
    if (this.disposed) return;
    this.cameraMode = mode;
    this.controlsActiveUntil = performance.now() + 420;
    this.publishState(true);
    this.updateLoopState();
  }

  public toggleCameraMode(): void {
    this.setCameraMode(this.cameraMode === "follow" ? "free" : "follow");
  }

  public home(): void {
    if (this.disposed || !this.controls) return;
    this.cameraMode = "free";
    this.setHomeCamera();
    this.publishState(true);
    this.updateLoopState();
  }

  public setReducedMotion(enabled: boolean): void {
    if (this.disposed) return;
    this.reducedMotion = enabled;
    if (this.controls) this.controls.dampingFactor = enabled ? 0.16 : 0.08;
    this.publishState(true);
    this.updateLoopState();
  }

  public dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.loopActive = false;
    window.cancelAnimationFrame(this.animationFrameId);
    this.controls?.removeEventListener("start", this.handleControlsStart);
    this.controls?.removeEventListener("change", this.handleControlsChange);
    this.controls?.dispose();
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

  private createMaterials(): MaterialSet {
    return {
      wall: createMaterial(COLORS.wall, { roughness: 0.93 }),
      desk: createMaterial(COLORS.desk, { roughness: 0.84 }),
      deskEdge: createMaterial(COLORS.deskEdge, { roughness: 0.86 }),
      book: createMaterial(COLORS.book, { roughness: 0.92 }),
      ruler: createMaterial(COLORS.ruler, { roughness: 0.78 }),
      paper: createMaterial(COLORS.paper, { roughness: 0.98 }),
      wood: createMaterial(COLORS.wood, { roughness: 0.87 }),
      woodDark: createMaterial(COLORS.woodDark, { roughness: 0.9 }),
      rubber: createMaterial(COLORS.rubber, { roughness: 0.9 }),
      metal: createMaterial(COLORS.metal, { roughness: 0.55, metalness: 0.52 }),
      blue: createMaterial(COLORS.blue, { roughness: 0.24, metalness: 0.08 }),
      green: createMaterial(COLORS.green, { roughness: 0.84 }),
      goal: createMaterial(COLORS.goal, { roughness: 0.74 }),
      dark: createMaterial(COLORS.dark, { roughness: 0.72 }),
      ink: createMaterial(COLORS.ink, { roughness: 0.72 }),
      pencil: createMaterial(COLORS.pencil, { roughness: 0.66 }),
      yellow: createMaterial(COLORS.yellow, { roughness: 0.68 }),
      red: createMaterial(COLORS.red, { roughness: 0.16, metalness: 0.1 }),
      brass: createMaterial(COLORS.brass, { roughness: 0.36, metalness: 0.72 }),
      bell: createMaterial(COLORS.bell, { roughness: 0.26, metalness: 0.82 }),
    };
  }

  private buildRoom(): void {
    [ROOM_LAYOUT.backWall, ROOM_LAYOUT.leftWall, ROOM_LAYOUT.floor, ROOM_LAYOUT.upperShelf, ROOM_LAYOUT.upperShelfEdge, ROOM_LAYOUT.lowerShelf, ROOM_LAYOUT.lowerShelfEdge].forEach((definition) => {
      addBox(this.roomRoot, this.geometryCache, this.materials[definition.material], definition.id, definition.size, definition.position, definition.rotation);
    });
    for (let index = 0; index < 7; index += 1) {
      addBox(this.roomRoot, this.geometryCache, index % 2 ? this.materials.blue : this.materials.green, `upper-book-${index}`, [0.55, 1.35, 0.72], [-2.6 + index * 0.82, 4.8, -3.95], [0, (index - 3) * 0.025, 0]);
    }
    for (let index = 0; index < 4; index += 1) {
      addBox(this.roomRoot, this.geometryCache, this.materials.book, `lower-book-${index}`, [0.65, 0.95, 0.78], [-8.75 + index * 0.76, 3.2, -4.05], [0, (index - 1) * 0.04, 0]);
    }
    addBox(this.roomRoot, this.geometryCache, this.materials.paper, "wall-drawing", [2.1, 1.4, 0.03], [7.4, 5.2, -5.65], [0, 0, -0.04], false);
  }

  private buildDesk(): void {
    addBox(this.deskRoot, this.geometryCache, this.materials.desk, "desk-top", ROOM_LAYOUT.deskTop.size, ROOM_LAYOUT.deskTop.position);
    addBox(this.deskRoot, this.geometryCache, this.materials.deskEdge, "desk-front", ROOM_LAYOUT.deskFront.size, ROOM_LAYOUT.deskFront.position);
    addBox(this.deskRoot, this.geometryCache, this.materials.paper, "notebook", [2.8, 0.06, 1.8], [-1.6, 0.2, 2.0], [0, 0, -0.05]);
    addBox(this.deskRoot, this.geometryCache, this.materials.blue, "notebook-cover", [2.9, 0.035, 1.9], [-1.6, 0.16, 2.0], [0, 0, -0.05]);
    addBox(this.deskRoot, this.geometryCache, this.materials.paper, "loose-paper", [1.5, 0.04, 1.0], [0.2, 0.22, 2.9], [0, 0, 0.1]);
    addCylinder(this.deskRoot, this.materials.blue, 0.55, 0.42, 1.05, [6.9, 0.55, 2.6], [0, 0, 0], 16);
    [-0.18, 0, 0.18].forEach((offset, index) => addCylinder(this.deskRoot, index === 1 ? this.materials.yellow : this.materials.pencil, 0.04, 0.04, 1.8, [6.9 + offset, 1.45, 2.6], [offset * 0.5, 0, offset], 8));
  }

  private buildTracks(): void {
    TRACK_LAYOUT.forEach((definition) => addBox(this.trackRoot, this.geometryCache, this.materials[definition.material], definition.id, definition.size, definition.position, definition.rotation));
    addBox(this.trackRoot, this.geometryCache, this.materials.book, "ramp-pages", [4.5, 0.18, 1.7], [-6.35, 0.7, -1.7], [0, 0, 0.02]);
    addBox(this.trackRoot, this.geometryCache, this.materials.paper, "ramp-pages-top", [4.2, 0.14, 1.5], [-6.35, 0.98, -1.7], [0, 0, 0.02]);
    const tube = addCylinder(this.trackRoot, this.materials.paper, 0.56, 0.56, 2.4, [7.2, 3.25, -3.45], [0, Math.PI / 2, 0], 16);
    tube.castShadow = true;
    const tape = new THREE.Mesh(new THREE.TorusGeometry(0.8, 0.2, 8, 20), this.materials.goal);
    tape.position.set(2.65, 2.95, -1.9);
    tape.rotation.x = Math.PI / 2;
    tape.castShadow = true;
    this.trackRoot.add(tape);
    addCylinder(this.trackRoot, this.materials.woodDark, 0.16, 0.16, 0.75, [10.25, 0.35, -0.95], [Math.PI / 2, 0, 0], 10);
    addCylinder(this.trackRoot, this.materials.woodDark, 0.13, 0.13, 0.62, [5.75, 0.44, 1.15], [Math.PI / 2, 0, 0], 10);
  }

  private buildProps(): void {
    const binder = new THREE.Group();
    addBox(binder, this.geometryCache, this.materials.metal, "binder-arm", [0.12, 0.9, 0.12], [0, 0.45, 0], [0, 0, -0.2]);
    addCylinder(binder, this.materials.metal, 0.13, 0.13, 0.6, [0, 0.3, 0], [Math.PI / 2, 0, 0], 10);
    binder.position.set(...MOTION_OBJECT_STARTS.binderClip);
    this.propRoot.add(binder);
    this.motionMeshes.set("binderClip", binder);

    const tapeRoll = new THREE.Mesh(new THREE.TorusGeometry(0.62, 0.21, 8, 20), this.materials.goal);
    tapeRoll.position.set(...MOTION_OBJECT_STARTS.tapeRoll);
    tapeRoll.rotation.x = Math.PI / 2;
    tapeRoll.castShadow = true;
    this.propRoot.add(tapeRoll);
    this.motionMeshes.set("tapeRoll", tapeRoll);

    const pencils = new THREE.Group();
    [this.materials.pencil, this.materials.yellow, this.materials.red, this.materials.blue].forEach((material, index) => addCylinder(pencils, material, 0.06, 0.06, 1.4, [index * 0.28, 0.12, 0], [0, 0, index * 0.05], 8));
    pencils.position.set(...MOTION_OBJECT_STARTS.coloredPencils);
    this.propRoot.add(pencils);
    this.motionMeshes.set("coloredPencils", pencils);

    const cup = new THREE.Group();
    const cupBody = new THREE.Mesh(new THREE.CylinderGeometry(0.46, 0.34, 0.78, 16, 1, true), this.materials.paper);
    cupBody.castShadow = true;
    cup.add(cupBody);
    cup.add(addCylinder(cup, this.materials.paper, 0.35, 0.35, 0.06, [0, -0.4, 0], [0, 0, 0], 16));
    cup.position.set(...MOTION_OBJECT_STARTS.paperCup);
    this.propRoot.add(cup);
    this.motionMeshes.set("paperCup", cup);

    const stringGate = new THREE.Group();
    addBox(stringGate, this.geometryCache, this.materials.woodDark, "string-gate", [0.18, 0.95, 0.18], [0, 0.45, 0]);
    stringGate.position.set(...MOTION_OBJECT_STARTS.stringGate);
    this.propRoot.add(stringGate);
    this.motionMeshes.set("stringGate", stringGate);
  }

  private buildMotionObjects(): void {
    const redMarble = new THREE.Mesh(new THREE.SphereGeometry(0.24, 16, 12), this.materials.red);
    redMarble.castShadow = true;
    this.motionRoot.add(redMarble);
    this.motionMeshes.set("redMarble", redMarble);
    const blueMarble = new THREE.Mesh(new THREE.SphereGeometry(0.24, 16, 12), this.materials.blue);
    blueMarble.castShadow = true;
    this.motionRoot.add(blueMarble);
    this.motionMeshes.set("blueMarble", blueMarble);
    const thirdMarble = new THREE.Mesh(new THREE.SphereGeometry(0.24, 16, 12), this.materials.yellow);
    thirdMarble.castShadow = true;
    this.motionRoot.add(thirdMarble);
    this.motionMeshes.set("thirdMarble", thirdMarble);

    const eraser = addBox(this.motionRoot, this.geometryCache, this.materials.rubber, "eraser", [0.7, 0.3, 0.48], MOTION_OBJECT_STARTS.eraser);
    this.motionMeshes.set("eraser", eraser);
    const pencil = new THREE.Group();
    addCylinder(pencil, this.materials.pencil, 0.075, 0.075, 1.65, [0, 0, 0], [0, 0, Math.PI / 2], 8);
    addCylinder(pencil, this.materials.rubber, 0.08, 0.08, 0.18, [-0.88, 0, 0], [0, 0, Math.PI / 2], 8);
    pencil.position.set(...MOTION_OBJECT_STARTS.pencil);
    this.motionRoot.add(pencil);
    this.motionMeshes.set("pencil", pencil);

    const clothespin = new THREE.Group();
    addBox(clothespin, this.geometryCache, this.materials.wood, "clothespin-a", [0.72, 0.12, 0.22], [-0.2, 0, 0], [0, 0, 0.08]);
    addBox(clothespin, this.geometryCache, this.materials.wood, "clothespin-b", [0.72, 0.12, 0.22], [0.2, 0, 0], [0, 0, -0.08]);
    addCylinder(clothespin, this.materials.metal, 0.09, 0.09, 0.32, [0, 0, 0], [Math.PI / 2, 0, 0], 10);
    clothespin.position.set(...MOTION_OBJECT_STARTS.clothespin);
    this.motionRoot.add(clothespin);
    this.motionMeshes.set("clothespin", clothespin);

    const band = new THREE.Mesh(new THREE.TorusGeometry(0.44, 0.025, 6, 20), this.materials.rubber);
    band.rotation.x = Math.PI / 2;
    band.position.set(...MOTION_OBJECT_STARTS.rubberBand);
    band.castShadow = true;
    this.motionRoot.add(band);
    this.motionMeshes.set("rubberBand", band);

    BLOCK_STARTS.forEach((position, index) => {
      const block = addBox(this.motionRoot, this.geometryCache, createMaterial(Number.parseInt(BLOCK_COLORS[index % BLOCK_COLORS.length]!.slice(1), 16)), `block-${index}`, [0.3, 0.85, 0.54], position);
      this.blockMeshes.push(block);
    });
    const blockChain = new THREE.Group();
    blockChain.position.set(...MOTION_OBJECT_STARTS.blockChain);
    this.blockMeshes.forEach((block) => {
      const worldPosition = block.position.clone();
      blockChain.add(block);
      block.position.copy(worldPosition.sub(new THREE.Vector3(...MOTION_OBJECT_STARTS.blockChain)));
    });
    this.motionRoot.add(blockChain);
    this.motionMeshes.set("firstBlock", this.blockMeshes[0]!);
    this.motionMeshes.set("blockChain", blockChain);

    const chock = addBox(this.motionRoot, this.geometryCache, this.materials.rubber, "car-chock", [0.18, 0.72, 0.8], MOTION_OBJECT_STARTS.carChock);
    this.motionMeshes.set("carChock", chock);
    const car = new THREE.Group();
    addBox(car, this.geometryCache, this.materials.red, "car-body", [0.9, 0.22, 0.55], [0, 0, 0]);
    addBox(car, this.geometryCache, this.materials.blue, "car-cabin", [0.42, 0.3, 0.4], [-0.06, 0.24, 0]);
    [-0.3, 0.3].forEach((x) => [-0.25, 0.25].forEach((z) => addCylinder(car, this.materials.dark, 0.11, 0.11, 0.09, [x, -0.16, z], [Math.PI / 2, 0, 0], 10)));
    car.position.set(...MOTION_OBJECT_STARTS.car);
    this.motionRoot.add(car);
    this.motionMeshes.set("car", car);

    const seesaw = new THREE.Group();
    addBox(seesaw, this.geometryCache, this.materials.ruler, "seesaw-ruler", [3.5, 0.14, 0.42], [0, 0, 0]);
    addCylinder(seesaw, this.materials.woodDark, 0.16, 0.16, 0.78, [0, -0.24, 0], [Math.PI / 2, 0, 0], 10);
    seesaw.position.set(...MOTION_OBJECT_STARTS.seesaw);
    this.motionRoot.add(seesaw);
    this.motionMeshes.set("seesaw", seesaw);
    const blueGate = addBox(this.motionRoot, this.geometryCache, this.materials.woodDark, "blue-gate", [0.16, 0.78, 0.78], MOTION_OBJECT_STARTS.blueGate);
    this.motionMeshes.set("blueGate", blueGate);

    const balance = new THREE.Group();
    addBox(balance, this.geometryCache, this.materials.ruler, "balance-ruler", [2.4, 0.12, 0.34], [0, 0, 0]);
    addCylinder(balance, this.materials.woodDark, 0.14, 0.14, 0.6, [0, -0.22, 0], [Math.PI / 2, 0, 0], 10);
    balance.position.set(...MOTION_OBJECT_STARTS.balance);
    this.motionRoot.add(balance);
    this.motionMeshes.set("balance", balance);
    const striker = addBeam(this.motionRoot, [0, 0.35, 0], [0, -0.35, 0], 0.045, this.materials.dark);
    striker.position.set(...MOTION_OBJECT_STARTS.striker);
    this.motionMeshes.set("striker", striker);
  }

  private buildBell(): THREE.Group {
    const group = new THREE.Group();
    addCylinder(group, this.materials.dark, 0.55, 0.55, 0.18, [0, 0, 0], [0, 0, 0], 16);
    addCylinder(group, this.materials.bell, 0.4, 0.52, 0.44, [0, 0.28, 0], [0, 0, 0], 16);
    addCylinder(group, this.materials.bell, 0.1, 0.1, 0.16, [0, 0.57, 0], [0, 0, 0], 10);
    group.position.set(...GOAL_LAYOUT.bell);
    this.propRoot.add(group);
    this.motionMeshes.set("bell", group);
    return group;
  }

  private buildGoalFlag(): THREE.Group {
    const flag = new THREE.Group();
    addCylinder(flag, this.materials.dark, 0.025, 0.025, 1.6, [0, 0.8, 0], [0, 0, 0], 8);
    addBox(flag, this.geometryCache, this.materials.goal, "goal-flag", [0.85, 0.42, 0.04], [0.38, 1.35, 0]);
    flag.position.set(...GOAL_LAYOUT.flag);
    flag.scale.y = 0.08;
    this.propRoot.add(flag);
    return flag;
  }

  private buildGoalTag(): THREE.Sprite {
    const canvas = document.createElement("canvas");
    canvas.width = 200;
    canvas.height = 80;
    const context = canvas.getContext("2d");
    if (context) {
      context.fillStyle = "#f2c84e";
      context.fillRect(0, 0, canvas.width, canvas.height);
      context.fillStyle = "#26373c";
      context.font = "bold 34px Arial";
      context.textAlign = "center";
      context.textBaseline = "middle";
      context.fillText("GOAL", canvas.width / 2, canvas.height / 2 + 2);
    }
    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    const tag = new THREE.Sprite(new THREE.SpriteMaterial({ map: texture, transparent: true }));
    tag.scale.set(1.55, 0.62, 1);
    tag.position.set(...GOAL_LAYOUT.tag);
    this.propRoot.add(tag);
    return tag;
  }

  private configureLighting(): void {
    const key = new THREE.DirectionalLight(0xffd3a0, 3.0);
    key.position.set(-8, 14, 10);
    key.target.position.set(0, 1, -1);
    key.castShadow = true;
    key.shadow.mapSize.set(this.quality.shadowMapSize, this.quality.shadowMapSize);
    key.shadow.camera.left = -15;
    key.shadow.camera.right = 15;
    key.shadow.camera.top = 14;
    key.shadow.camera.bottom = -8;
    key.shadow.camera.near = 1;
    key.shadow.camera.far = 38;
    key.shadow.bias = -0.00025;
    this.scene.add(key, key.target);
    this.scene.add(new THREE.HemisphereLight(0xfff0d8, 0x665145, 1.9));
    this.scene.add(new THREE.AmbientLight(0xfff3de, 0.28));
  }

  private processPhysicsEvents(): void {
    if (!this.physics) return;
    for (const event of this.physics.consumeEvents()) {
      const previous = this.chainState;
      this.chainState = triggerChainEvent(this.chainState, event);
      if (this.chainState !== previous) {
        if (this.chainState.phase === "running") this.physics.setStage(getCurrentStage(this.chainState).id);
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
    if (this.chainState.phase === "running") {
      this.physics?.advance(delta, true);
      this.processPhysicsEvents();
      const result = advanceChain(this.chainState, delta);
      this.chainState = result.state;
      if (result.timedOut) this.publishState(true);
    }
    if (this.chainState.phase === "complete") this.celebrationProgress = Math.min(1, this.celebrationProgress + delta / 1.2);
    this.updateDynamicVisuals();
    this.updateFollowTarget(delta);
    this.controls?.update();
    this.renderer.render(this.scene, this.camera);
    this.publishState(false);
    this.updateLoopState();
    if (this.loopActive) this.animationFrameId = window.requestAnimationFrame(this.render);
  }

  private updateDynamicVisuals(): void {
    const mechanisms = this.physics?.getMechanismSnapshot();
    if (!mechanisms) return;
    const activeStage = mechanisms.activeStageId ? CHAIN_MOTIONS.find((motion) => motion.id === mechanisms.activeStageId) : undefined;
    if (activeStage) {
      const snapshot = this.physics?.getSnapshot(activeStage.objectId);
      if (snapshot) this.applySnapshot(this.motionMeshes.get(activeStage.objectId), snapshot);
      this.applyMechanismMotion(activeStage, mechanisms.activeProgress);
    }
    this.goalFlag.scale.y = Math.max(0.08, this.celebrationProgress);
    this.bell.rotation.z = this.celebrationProgress * 0.1;
    this.goalTag.material.opacity = 0.86 + this.celebrationProgress * 0.14;
  }

  private applyMechanismMotion(motion: ChainMotion, progress: number): void {
    const mesh = this.motionMeshes.get(motion.objectId);
    if (!mesh) return;
    if (motion.kind === "clothespin") mesh.rotation.z = progress * -0.26;
    if (motion.kind === "rubberBand") mesh.scale.set(1 - progress * 0.5, 1, 1 - progress * 0.25);
    if (motion.kind === "blocks") mesh.rotation.z = progress * 0.18;
    if (motion.kind === "seesaw") mesh.rotation.z = progress * -0.38;
    if (motion.kind === "balance") mesh.rotation.z = progress * -0.34;
    if (motion.kind === "gate") mesh.rotation.z = progress * -0.38;
    if (motion.kind === "cup") mesh.rotation.z = progress * -0.42;
    if (motion.kind === "bell") mesh.rotation.z = progress * 0.08;
    if (motion.objectId === "stringGate") this.stringLine.scale.y = 1 - progress * 0.16;
  }

  private applySnapshot(mesh: THREE.Object3D | undefined, snapshot: BodySnapshot): void {
    if (!mesh) return;
    const position = new THREE.Vector3(...snapshot.position);
    if (mesh.parent) mesh.parent.worldToLocal(position);
    mesh.position.copy(position);
    mesh.quaternion.set(snapshot.rotation[0], snapshot.rotation[1], snapshot.rotation[2], snapshot.rotation[3]);
  }

  private updateFollowTarget(delta: number): void {
    if (this.cameraMode !== "follow" || !this.controls || this.chainState.phase !== "running") return;
    const target = clampTarget(getFollowTarget(getCurrentStage(this.chainState).id));
    this.controls.target.lerp(new THREE.Vector3(...target), Math.min(1, delta * (this.reducedMotion ? 1.2 : 0.65)));
  }

  private setHomeCamera(): void {
    const controls = this.controls;
    if (!controls) return;
    this.suppressControlInput = true;
    this.camera.position.set(...this.cameraHome.position);
    this.camera.fov = this.cameraHome.fov;
    this.camera.updateProjectionMatrix();
    controls.target.set(...this.cameraHome.target);
    controls.minDistance = this.cameraHome.minDistance;
    controls.maxDistance = this.cameraHome.maxDistance;
    controls.minPolarAngle = this.cameraHome.minPolarAngle;
    controls.maxPolarAngle = this.cameraHome.maxPolarAngle;
    controls.update();
    this.suppressControlInput = false;
  }

  private publishState(force: boolean): void {
    const stage = getCurrentStage(this.chainState);
    const progress = this.chainState.phase === "ready" ? 0 : getStageProgress(this.chainState);
    const key = [this.chainState.phase, this.chainState.stageIndex, Math.floor(progress * 10), this.physics ? "ready" : "loading", this.cameraMode].join("|");
    if (!force && key === this.lastUiKey) return;
    this.lastUiKey = key;
    const statusText = this.chainState.phase === "ready"
      ? "READY — EXPLORE THE DESK"
      : this.chainState.phase === "running"
        ? `${stage.shortLabel}`
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
      cameraMode: this.cameraMode,
    });
  }

  private updateLoopState(): void {
    if (this.disposed) return;
    const controlsSettling = performance.now() < this.controlsActiveUntil;
    const active = this.pageVisible && this.inViewport && (this.chainState.phase === "running" || (this.chainState.phase === "complete" && this.celebrationProgress < 1) || controlsSettling);
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
