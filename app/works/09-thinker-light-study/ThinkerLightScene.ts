import * as THREE from "three";
import { bloom } from "three/addons/tsl/display/BloomNode.js";
import { STLLoader } from "three/addons/loaders/STLLoader.js";
import {
  MeshBasicNodeMaterial,
  MeshStandardNodeMaterial,
  RenderPipeline,
  WebGPURenderer,
} from "three/webgpu";
import {
  color,
  emissive,
  float,
  mix,
  mrt,
  output,
  pass,
  positionLocal,
  smoothstep,
  uniform,
} from "three/tsl";

import {
  getDrawingBufferSize,
  getPointerLightStrength,
  getQualityProfile,
  normalizePointer,
  shouldAnimateLighting,
  smoothPointer,
  type PointerPoint,
  type QualityProfile,
} from "./lightingMath";
import {
  getLightingPreset,
  getLightingTransitionDuration,
  interpolateLightingPreset,
  INITIAL_PRESET_ID,
  type LightingPreset,
  type LightingPresetId,
  type Rgb,
  type Vec3Tuple,
} from "./lightingPresets";
import {
  getCameraFraming,
  getModelBounds,
  getModelNormalization,
} from "./modelNormalization";
import {
  DEFAULT_VIEW_TRANSFORM,
  resetViewTransform,
  updateViewTransform,
  type ViewTransform,
} from "./viewMath";

const MODEL_URL = "/models/09-thinker/the-thinker-optimized.stl";
const MODEL_HEIGHT = 4.8;
const MODEL_BASE_Y = 0.28;
const MODEL_ROTATION_Y = 0.18;
const ZERO_POINTER: PointerPoint = { x: 0, y: 0 };

type Vec3Uniform = ReturnType<typeof uniform<"vec3", THREE.Vector3>>;

export type ThinkerLightSceneOptions = {
  readonly reducedMotion: boolean;
  readonly presetId?: LightingPresetId;
  readonly onLightChange?: (strength: number, active: boolean) => void;
};

export type ThinkerLightSceneInitResult = {
  readonly webGpuApiAvailable: boolean;
  readonly selectiveBloom: boolean;
  readonly modelLoaded: boolean;
  readonly errorMessage?: string;
};

export type ModelLoadProgress = number | null;

function setVectorUniform(node: Vec3Uniform, value: Rgb): void {
  node.value.set(value[0], value[1], value[2]);
}

function addMesh(
  parent: THREE.Object3D,
  geometry: THREE.BufferGeometry,
  material: THREE.Material,
  position: Vec3Tuple = [0, 0, 0],
): THREE.Mesh {
  const mesh = new THREE.Mesh(geometry, material);
  mesh.position.set(...position);
  parent.add(mesh);
  return mesh;
}

function disposeSceneResources(scene: THREE.Scene): void {
  const geometries = new Set<THREE.BufferGeometry>();
  const materials = new Set<THREE.Material>();
  scene.traverse((object) => {
    if (object instanceof THREE.Mesh || object instanceof THREE.Line || object instanceof THREE.Points) {
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

function createGradientMaterial(
  top: Vec3Uniform,
  middle: Vec3Uniform,
  bottom: Vec3Uniform,
): MeshBasicNodeMaterial {
  const material = new MeshBasicNodeMaterial({ color: 0xffffff });
  const height = positionLocal.y.div(10).add(0.5).clamp(0, 1);
  const lower = mix(bottom, middle, smoothstep(0.04, 0.58, height));
  material.colorNode = mix(lower, top, smoothstep(0.46, 0.98, height));
  return material;
}

export class ThinkerLightScene {
  private readonly container: HTMLElement;
  private readonly scene = new THREE.Scene();
  private readonly camera = new THREE.PerspectiveCamera(30, 1, 0.1, 60);
  private readonly modelRoot = new THREE.Group();
  private readonly pointer = new THREE.Vector2();
  private readonly pointerTarget = { x: ZERO_POINTER.x, y: ZERO_POINTER.y };
  private readonly dragStart = { x: 0, y: 0 };
  private readonly dragLast = { x: 0, y: 0 };
  private dragPointerId: number | null = null;
  private dragActive = false;
  private viewTransform: ViewTransform = DEFAULT_VIEW_TRANSFORM;
  private readonly lightMarkerMaterial = new THREE.MeshBasicMaterial({
    color: 0xffd8a3,
    transparent: true,
    opacity: 0.94,
    depthTest: false,
  });
  private readonly lightMarker = new THREE.Mesh(
    new THREE.SphereGeometry(0.032, 12, 8),
    this.lightMarkerMaterial,
  );
  private readonly lightMarkerNdc = new THREE.Vector3();
  private readonly backgroundTopUniform = uniform(new THREE.Vector3());
  private readonly backgroundMiddleUniform = uniform(new THREE.Vector3());
  private readonly backgroundBottomUniform = uniform(new THREE.Vector3());
  private readonly backgroundPlane: THREE.Mesh;
  private readonly modelMaterial: MeshStandardNodeMaterial;
  private readonly directionalKey = new THREE.DirectionalLight();
  private readonly spotKey = new THREE.SpotLight();
  private readonly fillLight = new THREE.PointLight();
  private readonly rimLight = new THREE.PointLight();
  private readonly environmentLight = new THREE.HemisphereLight();
  private readonly directionalKeyTarget = new THREE.Object3D();
  private readonly spotKeyTarget = new THREE.Object3D();
  private readonly floorMaterial = new THREE.MeshStandardMaterial({
    color: 0x090b10,
    roughness: 0.7,
    metalness: 0.12,
  });
  private readonly pedestalMaterial = new THREE.MeshStandardMaterial({
    color: 0x242126,
    roughness: 0.5,
    metalness: 0.3,
  });
  private readonly pedestalRingMaterial = new THREE.MeshBasicMaterial({
    color: 0x73655a,
    transparent: true,
    opacity: 0.34,
  });
  private renderer: WebGPURenderer | null = null;
  private renderPipeline: RenderPipeline | null = null;
  private bloomPass: ReturnType<typeof bloom> | null = null;
  private resizeObserver: ResizeObserver | null = null;
  private intersectionObserver: IntersectionObserver | null = null;
  private modelMesh: THREE.Mesh | null = null;
  private profile: QualityProfile = getQualityProfile(1440, 900, 1);
  private reducedMotion: boolean;
  private holdLight = false;
  private holdSettling = false;
  private disposed = false;
  private pageVisible = typeof document === "undefined" || document.visibilityState === "visible";
  private inViewport = true;
  private animationLoopActive = false;
  private pointerNeedsRender = false;
  private lastTime = 0;
  private pointerActive = false;
  private lastReportedLightStrength = -1;
  private lastReportedLightActive = false;
  private readonly onLightChange: ((strength: number, active: boolean) => void) | undefined;
  private currentPreset: LightingPreset;
  private transitionFrom: LightingPreset;
  private transitionTo: LightingPreset;
  private transitionStart = 0;
  private transitionDuration = 0;
  private presetId: LightingPresetId;
  private readonly handleResize = (): void => this.resize();
  private readonly handleVisibility = (): void => {
    this.pageVisible = document.visibilityState === "visible";
    this.lastTime = 0;
    this.updateLoopState();
  };
  private readonly handlePointerMove = (event: PointerEvent): void => {
    if (this.disposed || !this.renderer) {
      return;
    }
    if (this.dragPointerId === event.pointerId) {
      const deltaX = event.clientX - this.dragLast.x;
      const deltaY = event.clientY - this.dragLast.y;
      if (!this.dragActive && Math.hypot(event.clientX - this.dragStart.x, event.clientY - this.dragStart.y) > 4) {
        this.dragActive = true;
      }
      if (this.dragActive) {
        this.updateView({ yaw: deltaX * 0.006, pitch: deltaY * 0.004 });
      }
      this.dragLast.x = event.clientX;
      this.dragLast.y = event.clientY;
    }
    if (this.holdLight) {
      return;
    }
    const rect = this.renderer.domElement.getBoundingClientRect();
    const next = normalizePointer(event.clientX, event.clientY, {
      left: rect.left,
      top: rect.top,
      width: rect.width,
      height: rect.height,
    });
    this.pointerTarget.x = next.x;
    this.pointerTarget.y = next.y;
    this.pointerActive = true;
    this.pointerNeedsRender = true;
    this.updateLoopState();
  };
  private readonly handlePointerDown = (event: PointerEvent): void => {
    if (this.disposed || !this.renderer || event.button !== 0) {
      return;
    }
    this.dragPointerId = event.pointerId;
    this.dragActive = false;
    this.dragStart.x = event.clientX;
    this.dragStart.y = event.clientY;
    this.dragLast.x = event.clientX;
    this.dragLast.y = event.clientY;
    this.renderer.domElement.setPointerCapture?.(event.pointerId);
  };
  private readonly handlePointerUp = (event: PointerEvent): void => {
    if (this.dragPointerId !== event.pointerId) {
      return;
    }
    this.renderer?.domElement.releasePointerCapture?.(event.pointerId);
    this.dragPointerId = null;
    this.dragActive = false;
  };
  private readonly handlePointerLeave = (): void => {
    this.dragPointerId = null;
    this.dragActive = false;
    this.pointerTarget.x = ZERO_POINTER.x;
    this.pointerTarget.y = ZERO_POINTER.y;
    this.pointerActive = false;
    this.pointerNeedsRender = true;
    this.updateLoopState();
  };
  private readonly handlePointerCancel = (event: PointerEvent): void => {
    this.handlePointerUp(event);
    this.handlePointerLeave();
  };
  private readonly handleWheel = (event: WheelEvent): void => {
    if (this.disposed) {
      return;
    }
    event.preventDefault();
    this.updateView({ scale: event.deltaY < 0 ? 0.06 : -0.06 });
  };
  private readonly render = (time: number): void => this.renderFrame(time);

  public constructor(container: HTMLElement, options: ThinkerLightSceneOptions) {
    this.container = container;
    this.reducedMotion = options.reducedMotion;
    this.onLightChange = options.onLightChange;
    this.presetId = options.presetId ?? INITIAL_PRESET_ID;
    this.currentPreset = getLightingPreset(this.presetId);
    this.transitionFrom = this.currentPreset;
    this.transitionTo = this.currentPreset;
    this.modelMaterial = this.createSculptureMaterial();
    this.backgroundPlane = addMesh(
      this.scene,
      new THREE.PlaneGeometry(22, 13),
      createGradientMaterial(this.backgroundTopUniform, this.backgroundMiddleUniform, this.backgroundBottomUniform),
      [0, 2.9, -4.8],
    );
    this.backgroundPlane.renderOrder = -10;
    this.buildBackdrop();
    this.buildLighting();
    this.modelRoot.position.y = MODEL_BASE_Y;
    this.scene.add(this.modelRoot);
    this.lightMarker.visible = false;
    this.scene.add(this.lightMarker);
    this.applyViewTransform();
    this.applyPreset(this.currentPreset);
  }

  public async init(onProgress?: (progress: ModelLoadProgress) => void): Promise<ThinkerLightSceneInitResult> {
    const viewport = this.getViewportSize();
    this.profile = getQualityProfile(viewport.width, viewport.height, window.devicePixelRatio || 1);
    this.configureShadowQuality();
    this.configureCamera(viewport.width, viewport.height);
    this.scene.background = new THREE.Color().setRGB(...this.currentPreset.background.middle);
    this.scene.fog = new THREE.Fog(
      new THREE.Color().setRGB(...this.currentPreset.background.fog),
      this.currentPreset.background.fogNear,
      this.currentPreset.background.fogFar,
    );

    const renderer = new WebGPURenderer({ antialias: true, alpha: false });
    await renderer.init();
    if (this.disposed) {
      renderer.dispose();
      return { webGpuApiAvailable: this.hasWebGpuApi(), selectiveBloom: false, modelLoaded: false };
    }

    this.renderer = renderer;
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = this.currentPreset.exposure;
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.VSMShadowMap;
    renderer.domElement.setAttribute("aria-hidden", "true");
    renderer.domElement.setAttribute("role", "presentation");
    renderer.domElement.tabIndex = -1;
    renderer.domElement.style.display = "block";
    renderer.domElement.style.width = "100%";
    renderer.domElement.style.height = "100%";
    this.container.appendChild(renderer.domElement);
    this.resize();
    this.renderer.domElement.addEventListener("pointermove", this.handlePointerMove, { passive: true });
    this.renderer.domElement.addEventListener("pointerdown", this.handlePointerDown, { passive: true });
    this.renderer.domElement.addEventListener("pointerup", this.handlePointerUp, { passive: true });
    this.renderer.domElement.addEventListener("pointerleave", this.handlePointerLeave, { passive: true });
    this.renderer.domElement.addEventListener("pointercancel", this.handlePointerCancel, { passive: true });
    this.renderer.domElement.addEventListener("wheel", this.handleWheel, { passive: false });
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
    this.setupPostProcessing();
    this.renderOnce();

    try {
      await this.loadModel(onProgress);
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "モデルを読み込めませんでした。";
      this.renderOnce();
      return {
        webGpuApiAvailable: this.hasWebGpuApi(),
        selectiveBloom: this.renderPipeline !== null,
        modelLoaded: false,
        errorMessage: message,
      };
    }

    if (this.disposed) {
      return { webGpuApiAvailable: this.hasWebGpuApi(), selectiveBloom: false, modelLoaded: false };
    }
    onProgress?.(1);
    this.pointerNeedsRender = true;
    this.renderOnce();
    this.updateLoopState();
    return {
      webGpuApiAvailable: this.hasWebGpuApi(),
      selectiveBloom: this.renderPipeline !== null,
      modelLoaded: true,
    };
  }

  public setPreset(id: LightingPresetId): void {
    if (this.disposed || id === this.presetId) {
      return;
    }
    this.presetId = id;
    this.transitionFrom = this.currentPreset;
    this.transitionTo = getLightingPreset(id);
    if (this.holdLight) {
      this.transitionStart = 0;
      this.transitionDuration = 0;
      this.applyPreset(this.transitionTo);
      this.updateLoopState();
      return;
    }
    this.transitionStart = performance.now();
    this.transitionDuration = getLightingTransitionDuration(this.reducedMotion);
    this.updateLoopState();
  }

  public setHoldLight(enabled: boolean): void {
    if (this.disposed || this.holdLight === enabled) {
      return;
    }
    this.holdLight = enabled;
    this.pointerTarget.x = ZERO_POINTER.x;
    this.pointerTarget.y = ZERO_POINTER.y;
    this.pointerActive = false;
    this.pointerNeedsRender = true;
    this.holdSettling = enabled;
    if (enabled) {
      this.transitionStart = 0;
      this.transitionDuration = 0;
    }
    this.updateLoopState();
  }

  public setReducedMotion(enabled: boolean): void {
    if (this.disposed || this.reducedMotion === enabled) {
      return;
    }
    this.reducedMotion = enabled;
    if (this.transitionStart > 0) {
      this.transitionStart = performance.now();
      this.transitionDuration = getLightingTransitionDuration(enabled);
    }
    if (enabled) {
      this.updateCameraParallax();
    }
    this.updateLoopState();
  }

  public rotateView(deltaYaw: number, deltaPitch = 0): void {
    if (this.disposed) {
      return;
    }
    this.updateView({ yaw: deltaYaw, pitch: deltaPitch });
  }

  public zoomView(deltaScale: number): void {
    if (this.disposed) {
      return;
    }
    this.updateView({ scale: deltaScale });
  }

  public resetView(): void {
    if (this.disposed) {
      return;
    }
    this.viewTransform = resetViewTransform();
    this.applyViewTransform();
    this.pointerNeedsRender = true;
    this.updateLoopState();
  }

  public dispose(): void {
    if (this.disposed) {
      return;
    }
    this.disposed = true;
    const renderer = this.renderer;
    renderer?.setAnimationLoop(null);
    this.animationLoopActive = false;
    renderer?.domElement.removeEventListener("pointermove", this.handlePointerMove);
    renderer?.domElement.removeEventListener("pointerdown", this.handlePointerDown);
    renderer?.domElement.removeEventListener("pointerup", this.handlePointerUp);
    renderer?.domElement.removeEventListener("pointerleave", this.handlePointerLeave);
    renderer?.domElement.removeEventListener("pointercancel", this.handlePointerCancel);
    renderer?.domElement.removeEventListener("wheel", this.handleWheel);
    this.resizeObserver?.disconnect();
    this.intersectionObserver?.disconnect();
    window.removeEventListener("resize", this.handleResize);
    document.removeEventListener("visibilitychange", this.handleVisibility);
    const domElement = renderer?.domElement;
    if (domElement?.parentElement === this.container) {
      this.container.removeChild(domElement);
    }
    const bloomPass = this.bloomPass;
    const renderPipeline = this.renderPipeline;
    const disposeResources = (): void => {
      const bloomDisposable = bloomPass as unknown as { dispose?: () => void } | null;
      bloomDisposable?.dispose?.();
      renderPipeline?.dispose();
      disposeSceneResources(this.scene);
      renderer?.dispose();
    };
    const gpuQueue = (renderer?.backend as unknown as {
      device?: { queue?: { onSubmittedWorkDone?: () => Promise<void> } };
    } | undefined)?.device?.queue;
    const submittedWork = gpuQueue?.onSubmittedWorkDone?.();
    if (submittedWork) {
      void submittedWork.catch(() => undefined).then(disposeResources);
    } else {
      window.setTimeout(disposeResources, 0);
    }
    this.renderPipeline = null;
    this.bloomPass = null;
    this.renderer = null;
  }

  private createSculptureMaterial(): MeshStandardNodeMaterial {
    const material = new MeshStandardNodeMaterial({
      color: 0x6e4c32,
      metalness: 0.74,
      roughness: 0.54,
    });
    const upward = smoothstep(0.8, 4.2, positionLocal.y);
    const fixedSurfaceVariation = positionLocal.x.mul(0.32)
      .add(positionLocal.z.mul(0.18))
      .sin()
      .mul(0.5)
      .add(0.5);
    const patinaMask = upward.mul(0.12).add(fixedSurfaceVariation.mul(0.045)).clamp(0, 0.16);
    material.colorNode = mix(color(0x6e4c32), color(0x45604d), patinaMask);
    material.roughnessNode = float(0.54).add(patinaMask.mul(0.16));
    return material;
  }

  private buildBackdrop(): void {
    const floor = addMesh(
      this.scene,
      new THREE.PlaneGeometry(22, 18),
      this.floorMaterial,
      [0, -0.04, 0],
    );
    floor.rotation.x = -Math.PI / 2;
    floor.receiveShadow = true;
    floor.renderOrder = -2;

    const pedestal = addMesh(
      this.scene,
      new THREE.CylinderGeometry(1.5, 1.66, 0.3, 64),
      this.pedestalMaterial,
      [0, 0.13, 0],
    );
    pedestal.castShadow = true;
    pedestal.receiveShadow = true;

    const ring = addMesh(
      this.scene,
      new THREE.TorusGeometry(1.28, 0.018, 6, 96),
      this.pedestalRingMaterial,
      [0, 0.3, 0],
    );
    ring.rotation.x = Math.PI / 2;
    ring.renderOrder = 2;
  }

  private buildLighting(): void {
    this.directionalKey.castShadow = true;
    this.spotKey.castShadow = true;
    this.spotKey.target = this.spotKeyTarget;
    this.directionalKey.target = this.directionalKeyTarget;
    this.directionalKey.shadow.camera.left = -5.5;
    this.directionalKey.shadow.camera.right = 5.5;
    this.directionalKey.shadow.camera.top = 7;
    this.directionalKey.shadow.camera.bottom = -1;
    this.directionalKey.shadow.camera.near = 0.1;
    this.directionalKey.shadow.camera.far = 22;
    this.spotKey.shadow.camera.near = 0.1;
    this.spotKey.shadow.camera.far = 20;
    this.scene.add(
      this.directionalKey,
      this.spotKey,
      this.fillLight,
      this.rimLight,
      this.environmentLight,
      this.directionalKeyTarget,
      this.spotKeyTarget,
    );
  }

  private configureShadowQuality(): void {
    const shadowLights = [this.directionalKey, this.spotKey];
    shadowLights.forEach((light) => {
      light.shadow.mapSize.set(this.profile.shadowMapSize, this.profile.shadowMapSize);
      light.shadow.bias = this.currentPreset.shadowBias;
      light.shadow.normalBias = this.currentPreset.shadowNormalBias;
      light.shadow.radius = this.profile.level === "low" ? 2 : 3;
    });
  }

  private configureCamera(width: number, height: number): void {
    const framing = getCameraFraming(width, height);
    this.camera.aspect = width / Math.max(1, height);
    this.camera.fov = framing.fov;
    this.camera.position.set(...framing.position);
    this.camera.updateProjectionMatrix();
    this.camera.lookAt(...framing.target);
  }

  private async loadModel(onProgress?: (progress: ModelLoadProgress) => void): Promise<void> {
    const geometry = await new Promise<THREE.BufferGeometry>((resolve, reject) => {
      new STLLoader().load(
        MODEL_URL,
        resolve,
        (event) => {
          if (event.lengthComputable && event.total > 0) {
            onProgress?.(event.loaded / event.total);
          } else {
            onProgress?.(null);
          }
        },
        reject,
      );
    });

    if (this.disposed) {
      geometry.dispose();
      return;
    }

    const position = geometry.getAttribute("position");
    const values = position.array;
    for (let index = 0; index < values.length; index += 1) {
      if (!Number.isFinite(values[index])) {
        geometry.dispose();
        throw new Error("モデルの頂点に不正な数値があります。");
      }
    }
    const bounds = getModelBounds(values);
    const transform = getModelNormalization(bounds, MODEL_HEIGHT);
    geometry.rotateX(transform.rotationX);
    geometry.scale(transform.scale, transform.scale, transform.scale);
    geometry.translate(...transform.translation);
    geometry.computeVertexNormals();
    geometry.computeBoundingBox();
    geometry.computeBoundingSphere();

    this.modelMesh = new THREE.Mesh(geometry, this.modelMaterial);
    this.modelMesh.name = "the-thinker-optimized-local-stl";
    this.modelMesh.castShadow = true;
    this.modelMesh.receiveShadow = true;
    this.modelRoot.add(this.modelMesh);
  }

  private applyPreset(preset: LightingPreset): void {
    this.currentPreset = preset;
    setVectorUniform(this.backgroundTopUniform, preset.background.top);
    setVectorUniform(this.backgroundMiddleUniform, preset.background.middle);
    setVectorUniform(this.backgroundBottomUniform, preset.background.bottom);
    this.scene.background = new THREE.Color().setRGB(...preset.background.middle);
    if (this.scene.fog instanceof THREE.Fog) {
      this.scene.fog.color.setRGB(...preset.background.fog);
      this.scene.fog.near = preset.background.fogNear;
      this.scene.fog.far = preset.background.fogFar;
    }

    const useSpot = preset.key.kind === "spot";
    this.directionalKey.visible = true;
    this.directionalKey.castShadow = !useSpot;
    this.spotKey.visible = useSpot;
    this.spotKey.castShadow = useSpot;
    this.directionalKey.color.setRGB(...preset.key.color);
    this.directionalKey.intensity = useSpot ? preset.key.intensity * 0.22 : preset.key.intensity;
    this.directionalKey.position.set(...preset.key.position);
    this.directionalKeyTarget.position.set(...preset.key.target);
    this.directionalKey.shadow.bias = preset.shadowBias;
    this.directionalKey.shadow.normalBias = preset.shadowNormalBias;
    this.spotKey.color.setRGB(...preset.key.color);
    this.spotKey.intensity = useSpot ? preset.key.intensity : 0;
    this.spotKey.position.set(...preset.key.position);
    this.spotKeyTarget.position.set(...preset.key.target);
    this.spotKey.angle = preset.key.angle;
    this.spotKey.penumbra = preset.key.penumbra;
    this.spotKey.distance = preset.key.distance;
    this.spotKey.decay = preset.key.decay;
    this.spotKey.shadow.bias = preset.shadowBias;
    this.spotKey.shadow.normalBias = preset.shadowNormalBias;

    this.fillLight.color.setRGB(...preset.fill.color);
    this.fillLight.position.set(...preset.fill.position);
    this.fillLight.intensity = preset.fill.intensity;
    this.fillLight.distance = 9;
    this.fillLight.decay = 1.7;
    this.rimLight.color.setRGB(...preset.rim.color);
    this.rimLight.position.set(...preset.rim.position);
    this.rimLight.intensity = preset.rim.intensity;
    this.rimLight.distance = 14;
    this.rimLight.decay = 1.8;
    this.environmentLight.color.setRGB(...preset.rim.color);
    this.environmentLight.groundColor.set(0x08090d);
    this.environmentLight.intensity = preset.environmentIntensity;

    if (this.renderer) {
      this.renderer.toneMappingExposure = preset.exposure;
    }
    if (this.bloomPass) {
      this.bloomPass.strength.value = preset.bloomStrength;
      this.bloomPass.radius.value = preset.bloomRadius;
      this.bloomPass.threshold.value = preset.bloomThreshold;
    }
    this.updateLightingFromPointer();
  }

  private setupPostProcessing(): void {
    if (!this.renderer || !this.hasWebGpuApi()) {
      return;
    }
    try {
      const scenePass = pass(this.scene, this.camera);
      scenePass.setMRT(mrt({ output, emissive }));
      const sceneColor = scenePass.getTextureNode("output");
      this.bloomPass = bloom(
        scenePass.getTextureNode("emissive"),
        this.currentPreset.bloomStrength,
        this.currentPreset.bloomRadius,
        this.currentPreset.bloomThreshold,
      );
      this.bloomPass.setResolutionScale(this.profile.bloomResolutionScale);
      this.renderPipeline = new RenderPipeline(this.renderer);
      this.renderPipeline.outputNode = sceneColor.add(this.bloomPass);
      this.renderPipeline.needsUpdate = true;
    } catch {
      this.bloomPass = null;
      this.renderPipeline = null;
    }
  }

  private renderOnce(): void {
    if (!this.renderer || this.disposed) {
      return;
    }
    if (this.renderPipeline) {
      this.renderPipeline.render();
    } else {
      this.renderer.render(this.scene, this.camera);
    }
  }

  private renderFrame(time: number): void {
    if (!this.renderer || this.disposed) {
      return;
    }
    const safeTime = Number.isFinite(time) ? time : 0;
    const deltaSeconds = this.lastTime === 0 ? 0 : Math.min(0.05, Math.max(0, (safeTime - this.lastTime) / 1000));
    this.lastTime = safeTime;
    const progress = this.transitionStart > 0
      ? Math.min(1, Math.max(0, (safeTime - this.transitionStart) / Math.max(1, this.transitionDuration)))
      : 1;
    if (this.transitionStart > 0 && progress < 1 && !this.holdLight) {
      this.applyPreset(interpolateLightingPreset(this.transitionFrom, this.transitionTo, progress));
    } else if (this.transitionStart > 0) {
      this.applyPreset(this.transitionTo);
      this.transitionStart = 0;
      this.transitionDuration = 0;
    }

    const nextPointer = smoothPointer(
      { x: this.pointer.x, y: this.pointer.y },
      this.holdLight || !this.pointerActive ? ZERO_POINTER : this.pointerTarget,
      deltaSeconds,
      this.reducedMotion ? 14 : 8,
    );
    this.pointer.set(nextPointer.x, nextPointer.y);
    this.updateLightingFromPointer();
    const distance = Math.hypot(this.pointer.x - this.pointerTarget.x, this.pointer.y - this.pointerTarget.y);
    if (distance < 0.0015) {
      this.pointerNeedsRender = false;
      if (this.holdLight) {
        this.holdSettling = false;
      }
    }

    this.renderOnce();
    if (!this.shouldAnimate()) {
      this.renderer.setAnimationLoop(null);
      this.animationLoopActive = false;
    }
  }

  private updateLightingFromPointer(): void {
    const x = this.pointer.x;
    const y = this.pointer.y;
    const pointerDistance = Math.min(1, Math.hypot(x, y) / Math.SQRT2);
    const lightStrength = getPointerLightStrength({ x, y });
    const keyPosition = this.currentPreset.key.position;
    const target = this.currentPreset.key.target;
    const nextKeyPosition: Vec3Tuple = [
      keyPosition[0] * 0.58 + x * 2,
      keyPosition[1] * 0.68 + y * 1.25,
      keyPosition[2] * 0.55 + x * 0.35,
    ];
    const nextTarget: Vec3Tuple = [
      target[0] + x * 0.9,
      target[1] + y * 0.62,
      target[2],
    ];
    const useSpot = this.currentPreset.key.kind === "spot";
    this.directionalKey.intensity = useSpot
      ? this.currentPreset.key.intensity * 0.22 * lightStrength
      : this.currentPreset.key.intensity * lightStrength;
    this.spotKey.intensity = useSpot ? this.currentPreset.key.intensity * lightStrength : 0;
    this.directionalKey.position.set(...nextKeyPosition);
    this.directionalKeyTarget.position.set(...nextTarget);
    this.spotKey.position.set(...nextKeyPosition);
    this.spotKeyTarget.position.set(...nextTarget);
    this.rimLight.position.x = this.currentPreset.rim.position[0] - x * 0.8;
    this.rimLight.position.y = this.currentPreset.rim.position[1] + y * 0.45;
    this.fillLight.position.x = this.currentPreset.fill.position[0] + x * 0.45;
    this.fillLight.position.y = this.currentPreset.fill.position[1] + y * 0.28;
    this.lightMarkerMaterial.color.setRGB(...this.currentPreset.key.color);
    this.lightMarker.scale.setScalar(0.72 + pointerDistance * 0.58);
    this.lightMarker.visible = this.pointerActive && !this.holdLight;
    if (
      this.onLightChange
      && (Math.abs(lightStrength - this.lastReportedLightStrength) >= 0.02 || this.pointerActive !== this.lastReportedLightActive)
    ) {
      this.lastReportedLightStrength = lightStrength;
      this.lastReportedLightActive = this.pointerActive;
      this.onLightChange(lightStrength, this.pointerActive);
    }
    this.updateCameraParallax();
    this.lightMarkerNdc.set(x, y, 0.96).unproject(this.camera);
    this.lightMarker.position.copy(this.lightMarkerNdc);
  }

  private updateView(delta: Partial<ViewTransform>): void {
    this.viewTransform = updateViewTransform(this.viewTransform, delta);
    this.applyViewTransform();
    this.pointerNeedsRender = true;
    this.updateLoopState();
  }

  private applyViewTransform(): void {
    this.modelRoot.rotation.x = this.viewTransform.pitch;
    this.modelRoot.rotation.y = MODEL_ROTATION_Y + this.viewTransform.yaw;
    this.modelRoot.scale.setScalar(this.viewTransform.scale);
  }

  private updateCameraParallax(): void {
    const framing = getCameraFraming(this.getViewportSize().width, this.getViewportSize().height);
    const parallaxX = this.reducedMotion || this.holdLight ? 0 : this.pointer.x * 0.055;
    const parallaxY = this.reducedMotion || this.holdLight ? 0 : this.pointer.y * 0.035;
    this.camera.position.set(framing.position[0] + parallaxX, framing.position[1] + parallaxY, framing.position[2]);
    this.camera.lookAt(...framing.target);
  }

  private resize(): void {
    if (!this.renderer || this.disposed) {
      return;
    }
    const viewport = this.getViewportSize();
    this.profile = getQualityProfile(viewport.width, viewport.height, window.devicePixelRatio || 1);
    const drawingBuffer = getDrawingBufferSize(viewport.width, viewport.height, window.devicePixelRatio || 1, this.profile);
    this.configureCamera(viewport.width, viewport.height);
    this.renderer.setPixelRatio(drawingBuffer.pixelRatio);
    this.renderer.setSize(viewport.width, viewport.height, false);
    this.bloomPass?.setResolutionScale(this.profile.bloomResolutionScale);
    this.configureShadowQuality();
    this.updateCameraParallax();
    this.updateLoopState();
  }

  private shouldAnimate(): boolean {
    return shouldAnimateLighting({
      pageVisible: this.pageVisible,
      inViewport: this.inViewport,
      holdLight: this.holdLight,
      holdSettling: this.holdSettling,
      transitionActive: this.transitionStart > 0,
      pointerNeedsRender: this.pointerNeedsRender,
      pointerDistance: this.pointer.length(),
    });
  }

  private updateLoopState(): void {
    if (!this.renderer || this.disposed) {
      return;
    }
    if (this.shouldAnimate()) {
      if (!this.animationLoopActive) {
        this.lastTime = 0;
        this.renderer.setAnimationLoop(this.render);
        this.animationLoopActive = true;
      }
      return;
    }
    this.renderOnce();
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
