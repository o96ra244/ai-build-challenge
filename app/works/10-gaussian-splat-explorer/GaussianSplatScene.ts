import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { WebGPURenderer } from "three/webgpu";

import { GaussianSplatMesh } from "./vendor/three-r186-preview/objects/GaussianSplatMesh.js";
import { SPZLoader } from "./vendor/three-r186-preview/loaders/SPZLoader.js";
import {
  detectGraphicsCapabilities,
  getRendererBackendLabel,
  selectGraphicsCapability,
  type GraphicsCapabilities,
  type GraphicsCapability,
  type RendererBackend,
} from "./capability";
import { createCleanupRegistry, type CleanupRegistry } from "./cleanupRegistry";
import {
  getCameraFit,
  getViewerFov,
  type BoundingSphereLike,
  type CameraFit,
} from "./cameraFit";
import { ASSET_SIZE_BYTES } from "./metadata";
import { getQualityProfile, type QualityProfile } from "./qualityProfile";

const ASSET_URL = "/works/10-gaussian-splat-explorer/tomatoes.v4.spz";
const CANVAS_LABEL = "TomatoesのGaussian Splatをドラッグとズームで観察する3Dビューア";

export type GaussianSplatSceneInitResult =
  | {
      readonly status: "ready";
      readonly backend: RendererBackend;
      readonly splatCount: number;
    }
  | { readonly status: "unsupported"; readonly message: string }
  | { readonly status: "error"; readonly message: string }
  | { readonly status: "disposed" };

type RendererBackendState = {
  readonly isWebGLBackend?: boolean;
};

function isRendererWebGLBackend(renderer: WebGPURenderer): boolean {
  const backend = renderer.backend as unknown as RendererBackendState;
  return backend.isWebGLBackend === true;
}

function getViewportSize(container: HTMLElement): { readonly width: number; readonly height: number } {
  const rect = container.getBoundingClientRect();
  return {
    width: Math.max(1, Math.floor(rect.width || window.innerWidth)),
    height: Math.max(1, Math.floor(rect.height || window.innerHeight)),
  };
}

function disposeMaterial(material: THREE.Material | THREE.Material[]): void {
  if (Array.isArray(material)) {
    material.forEach((entry) => entry.dispose());
    return;
  }
  material.dispose();
}

function getBoundingSphere(geometry: THREE.BufferGeometry): BoundingSphereLike {
  if (geometry.boundingSphere === null) {
    geometry.computeBoundingSphere();
  }
  const sphere = geometry.boundingSphere;
  if (
    sphere === null
    || !Number.isFinite(sphere.radius)
    || sphere.radius <= 0
    || !sphere.center.toArray().every((value) => Number.isFinite(value))
  ) {
    throw new Error("The decoded SPZ geometry has no valid bounding sphere.");
  }
  return {
    center: sphere.center.toArray() as [number, number, number],
    radius: sphere.radius,
  };
}

export class GaussianSplatScene {
  private readonly container: HTMLElement;
  private readonly scene = new THREE.Scene();
  private readonly camera = new THREE.PerspectiveCamera(36, 1, 0.01, 100);
  private readonly cleanup: CleanupRegistry = createCleanupRegistry();
  private readonly handleResize = (): void => this.resize();
  private readonly handleControlsChange = (): void => {
    if (!this.applyingCameraFit) {
      this.hasUserInteracted = true;
    }
    this.requestRender();
  };
  private readonly handleVisibility = (): void => {
    this.pageVisible = !document.hidden && document.visibilityState === "visible";
    if (!this.pageVisible && this.renderFrameHandle !== null) {
      window.cancelAnimationFrame(this.renderFrameHandle);
      this.renderFrameHandle = null;
    }
    if (this.pageVisible) {
      this.requestRender();
    }
  };
  private readonly onRenderFrame = (): void => {
    this.renderFrameHandle = null;
    if (this.disposed || !this.pageVisible || document.hidden || !this.renderer) {
      return;
    }
    this.renderer.render(this.scene, this.camera);
  };
  private renderer: WebGPURenderer | null = null;
  private controls: OrbitControls | null = null;
  private sourceGeometry: THREE.BufferGeometry | null = null;
  private splatMesh: GaussianSplatMesh | null = null;
  private resizeObserver: ResizeObserver | null = null;
  private abortController: AbortController | null = null;
  private renderFrameHandle: number | null = null;
  private qualityProfile: QualityProfile | null = null;
  private loadedSphere: BoundingSphereLike | null = null;
  private homeView: CameraFit | null = null;
  private disposed = false;
  private pageVisible = typeof document === "undefined" || (!document.hidden && document.visibilityState === "visible");
  private hasUserInteracted = false;
  private applyingCameraFit = false;

  public constructor(container: HTMLElement) {
    this.container = container;
    this.scene.background = new THREE.Color(0x070c10);
    this.cleanup.add(() => this.disposeSceneResources());
  }

  public async init(): Promise<GaussianSplatSceneInitResult> {
    const capabilities = detectGraphicsCapabilities();
    const capability = selectGraphicsCapability(capabilities);
    if (capability === "unsupported") {
      return {
        status: "unsupported",
        message: "このブラウザではGaussian Splat表示を利用できません。WebGPUまたはWebGL 2に対応したブラウザをお試しください。",
      };
    }

    try {
      const renderer = await this.createRenderer(capability, capabilities);
      if (this.disposed) {
        renderer.dispose();
        return { status: "disposed" };
      }
      this.renderer = renderer;
      this.configureRenderer(renderer);
      this.configureControls(renderer);
      this.registerBrowserListeners();
      this.requestRender();

      const geometry = await this.loadGeometry();
      if (this.disposed) {
        geometry.dispose();
        return { status: "disposed" };
      }
      this.sourceGeometry = geometry;
      this.loadedSphere = getBoundingSphere(geometry);
      this.applyResponsiveCameraFit();
      this.splatMesh = new GaussianSplatMesh(geometry, { autoSort: true });
      this.scene.add(this.splatMesh);
      this.requestRender();

      const backend = getRendererBackendLabel(isRendererWebGLBackend(renderer));
      const position = geometry.getAttribute("position");
      return {
        status: "ready",
        backend,
        splatCount: position?.count ?? 0,
      };
    } catch (error: unknown) {
      if (this.disposed) {
        return { status: "disposed" };
      }
      const message = error instanceof Error ? error.message : "Unknown Gaussian Splat error";
      this.dispose();
      return {
        status: "error",
        message: this.getUserFacingErrorMessage(message),
      };
    }
  }

  public resetCamera(): void {
    if (this.disposed || this.homeView === null || this.controls === null) {
      return;
    }
    this.hasUserInteracted = false;
    this.applyCameraFit(this.homeView);
    this.requestRender();
  }

  public dispose(): void {
    if (this.disposed) {
      return;
    }
    this.disposed = true;
    if (this.renderFrameHandle !== null) {
      window.cancelAnimationFrame(this.renderFrameHandle);
      this.renderFrameHandle = null;
    }
    this.cleanup.dispose();
    this.renderer = null;
    this.controls = null;
    this.sourceGeometry = null;
    this.splatMesh = null;
    this.resizeObserver = null;
    this.abortController = null;
  }

  private async createRenderer(
    capability: Exclude<GraphicsCapability, "unsupported">,
    capabilities: GraphicsCapabilities,
  ): Promise<WebGPURenderer> {
    const create = async (forceWebGL: boolean): Promise<WebGPURenderer> => {
      const renderer = new WebGPURenderer({ antialias: true, alpha: false, forceWebGL });
      try {
        await renderer.init();
        return renderer;
      } catch (error: unknown) {
        renderer.dispose();
        throw error;
      }
    };

    if (capability === "webgl2") {
      return create(true);
    }

    try {
      return await create(false);
    } catch (error: unknown) {
      if (!capabilities.webgl2) {
        throw error;
      }
      return create(true);
    }
  }

  private configureRenderer(renderer: WebGPURenderer): void {
    const viewport = getViewportSize(this.container);
    this.qualityProfile = getQualityProfile(viewport.width, viewport.height, window.devicePixelRatio || 1);
    renderer.setPixelRatio(this.qualityProfile.pixelRatio);
    renderer.setSize(viewport.width, viewport.height, false);
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1;
    renderer.domElement.setAttribute("role", "img");
    renderer.domElement.setAttribute("aria-label", CANVAS_LABEL);
    renderer.domElement.setAttribute("aria-describedby", "gaussian-splat-description");
    renderer.domElement.setAttribute("data-renderer-ready", "true");
    renderer.domElement.style.display = "block";
    renderer.domElement.style.width = "100%";
    renderer.domElement.style.height = "100%";
    this.container.appendChild(renderer.domElement);
  }

  private configureControls(renderer: WebGPURenderer): void {
    const controls = new OrbitControls(this.camera, renderer.domElement);
    controls.enablePan = false;
    controls.enableDamping = false;
    controls.enableZoom = true;
    controls.zoomSpeed = 0.8;
    controls.rotateSpeed = 0.72;
    controls.minPolarAngle = 0.18;
    controls.maxPolarAngle = Math.PI - 0.18;
    controls.minDistance = 1;
    controls.maxDistance = 100;
    controls.target.set(0, 0, 0);
    this.controls = controls;
    controls.addEventListener("change", this.handleControlsChange);
    this.cleanup.add(() => {
      controls.removeEventListener("change", this.handleControlsChange);
      controls.dispose();
    });
  }

  private registerBrowserListeners(): void {
    window.addEventListener("resize", this.handleResize, { passive: true });
    document.addEventListener("visibilitychange", this.handleVisibility);
    this.cleanup.add(() => window.removeEventListener("resize", this.handleResize));
    this.cleanup.add(() => document.removeEventListener("visibilitychange", this.handleVisibility));

    if (typeof ResizeObserver !== "undefined") {
      this.resizeObserver = new ResizeObserver(this.handleResize);
      this.resizeObserver.observe(this.container);
      this.cleanup.add(() => this.resizeObserver?.disconnect());
    }
  }

  private async loadGeometry(): Promise<THREE.BufferGeometry> {
    const controller = new AbortController();
    this.abortController = controller;
    this.cleanup.add(() => controller.abort());

    const response = await fetch(ASSET_URL, {
      signal: controller.signal,
      cache: "force-cache",
    });
    if (!response.ok) {
      throw new Error(`Asset request failed with HTTP ${response.status}.`);
    }
    const buffer = await response.arrayBuffer();
    if (buffer.byteLength !== ASSET_SIZE_BYTES) {
      throw new Error(`Asset size mismatch: expected ${ASSET_SIZE_BYTES} bytes.`);
    }

    const loader = new SPZLoader();
    const parsed = loader.parse(buffer);
    return Promise.resolve(parsed);
  }

  private applyResponsiveCameraFit(): void {
    if (this.loadedSphere === null || this.renderer === null) {
      return;
    }
    const viewport = getViewportSize(this.container);
    this.homeView = getCameraFit(
      this.loadedSphere,
      viewport.width / viewport.height,
      getViewerFov(viewport.width),
    );
    this.applyCameraFit(this.homeView);
  }

  private applyCameraFit(fit: CameraFit): void {
    const controls = this.controls;
    this.camera.fov = fit.fov;
    this.camera.near = Math.max(0.01, fit.minDistance * 0.01);
    this.camera.far = Math.max(100, fit.maxDistance * 1.6);
    this.camera.aspect = getViewportSize(this.container).width / getViewportSize(this.container).height;
    this.camera.position.set(...fit.position);
    this.camera.updateProjectionMatrix();
    if (controls) {
      this.applyingCameraFit = true;
      controls.target.set(...fit.target);
      controls.minDistance = fit.minDistance;
      controls.maxDistance = fit.maxDistance;
      controls.update();
      this.applyingCameraFit = false;
    } else {
      this.camera.lookAt(...fit.target);
    }
  }

  private resize(): void {
    if (this.disposed || this.renderer === null) {
      return;
    }
    const viewport = getViewportSize(this.container);
    this.qualityProfile = getQualityProfile(viewport.width, viewport.height, window.devicePixelRatio || 1);
    this.renderer.setPixelRatio(this.qualityProfile.pixelRatio);
    this.renderer.setSize(viewport.width, viewport.height, false);
    this.camera.aspect = viewport.width / viewport.height;
    if (this.loadedSphere !== null) {
      const nextHome = getCameraFit(
        this.loadedSphere,
        this.camera.aspect,
        getViewerFov(viewport.width),
      );
      this.homeView = nextHome;
      this.camera.fov = nextHome.fov;
      this.camera.near = Math.max(0.01, nextHome.minDistance * 0.01);
      this.camera.far = Math.max(100, nextHome.maxDistance * 1.6);
      this.camera.updateProjectionMatrix();
      if (!this.hasUserInteracted) {
        this.applyCameraFit(nextHome);
      }
    } else {
      this.camera.updateProjectionMatrix();
    }
    this.requestRender();
  }

  private requestRender(): void {
    if (this.disposed || this.renderer === null || !this.pageVisible || document.hidden || this.renderFrameHandle !== null) {
      return;
    }
    this.renderFrameHandle = window.requestAnimationFrame(this.onRenderFrame);
  }

  private disposeSceneResources(): void {
    if (this.splatMesh) {
      this.splatMesh.geometry.dispose();
      disposeMaterial(this.splatMesh.material);
    }
    this.sourceGeometry?.dispose();
    this.scene.clear();
    this.renderer?.domElement.remove();
    this.renderer?.dispose();
  }

  private getUserFacingErrorMessage(message: string): string {
    if (message.startsWith("Asset request failed")) {
      return "TomatoesのローカルSPZ assetを取得できませんでした。接続を確認して再試行してください。";
    }
    if (message.startsWith("Asset size mismatch")) {
      return "SPZ assetのサイズを確認できませんでした。ページを再読み込みしてください。";
    }
    if (message.includes("SPZ") || message.includes("decoded")) {
      return "SPZ v4のdecodeに失敗しました。対応ブラウザで再試行してください。";
    }
    if (message.includes("WebGPU") || message.includes("WebGL") || message.includes("renderer")) {
      return "3D rendererの初期化に失敗しました。WebGPUまたはWebGL 2に対応したブラウザで再試行してください。";
    }
    return "Gaussian Splatを表示できませんでした。もう一度お試しください。";
  }
}
