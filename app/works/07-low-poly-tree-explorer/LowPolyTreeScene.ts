import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { WebGPURenderer } from "three/webgpu";

import {
  TREE_PARTS,
  getCameraPreset,
  getAutoRotateAfterMotionPreference,
  getExplodeTransitionDuration,
  getExplodedPosition,
  getInitialAutoRotate,
  getOrbitDampingFactor,
  interpolateRotation,
  type TreeGeometrySpec,
  type TreePartDefinition,
} from "./treeModel";

export type LowPolyTreeSceneOptions = {
  readonly reducedMotion: boolean;
  readonly onExplodedChange: (exploded: boolean) => void;
  readonly onAutoRotateChange: (enabled: boolean) => void;
};

export type LowPolyTreeSceneInitResult = {
  readonly webGpuApiAvailable: boolean;
};

type ScenePart = {
  readonly definition: TreePartDefinition;
  readonly group: THREE.Group;
};

const BACKGROUND_COLOR = 0xdbe8df;
const CAMERA_TARGET = new THREE.Vector3(0, 3.35, 0);
const UP_AXIS = new THREE.Vector3(0, 1, 0);
const MATERIAL_COLORS: Record<TreePartDefinition["material"], number> = {
  ground: 0x64735b,
  soil: 0x8a6c4b,
  trunk: 0x84543a,
  branch: 0x9a6342,
  "inner-leaf": 0x3d8361,
  "outer-leaf": 0x6eaa63,
  rock: 0x87948b,
};

function createGeometry(spec: TreeGeometrySpec): THREE.BufferGeometry {
  switch (spec.kind) {
    case "cylinder":
      return new THREE.CylinderGeometry(
        spec.radiusTop,
        spec.radiusBottom,
        spec.depth,
        spec.segments,
        1,
        false,
      );
    case "branch":
      return new THREE.CylinderGeometry(
        spec.radius * 0.72,
        spec.radius,
        new THREE.Vector3(...spec.end).distanceTo(new THREE.Vector3(...spec.start)),
        spec.segments,
        1,
        false,
      );
    case "poly":
      return new THREE.IcosahedronGeometry(spec.radius, spec.detail);
    case "island":
      return new THREE.CylinderGeometry(
        spec.radiusTop,
        spec.radiusBottom,
        spec.height,
        spec.segments,
        1,
        false,
      );
  }
}

function createMaterial(category: TreePartDefinition["material"]): THREE.MeshStandardMaterial {
  return new THREE.MeshStandardMaterial({
    color: MATERIAL_COLORS[category],
    flatShading: true,
    roughness: 0.88,
    metalness: 0,
  });
}

function applyMeshTransform(
  mesh: THREE.Mesh,
  definition: TreePartDefinition,
): void {
  mesh.rotation.set(
    definition.initialRotation[0],
    definition.initialRotation[1],
    definition.initialRotation[2],
  );

  if (definition.geometry.kind !== "branch") {
    return;
  }

  const direction = new THREE.Vector3(
    definition.geometry.end[0] - definition.geometry.start[0],
    definition.geometry.end[1] - definition.geometry.start[1],
    definition.geometry.end[2] - definition.geometry.start[2],
  ).normalize();
  mesh.quaternion.setFromUnitVectors(UP_AXIS, direction);
}

function disposeScene(scene: THREE.Scene): void {
  const geometries = new Set<THREE.BufferGeometry>();
  const materials = new Set<THREE.Material>();

  scene.traverse((object) => {
    if (object instanceof THREE.Mesh) {
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

export class LowPolyTreeScene {
  private readonly container: HTMLElement;
  private readonly options: LowPolyTreeSceneOptions;
  private readonly scene = new THREE.Scene();
  private readonly camera = new THREE.PerspectiveCamera();
  private readonly treeGroup = new THREE.Group();
  private readonly parts: ScenePart[] = [];
  private reducedMotion: boolean;
  private readonly handleResize = (): void => this.resize();
  private readonly handleVisibility = (): void => {
    this.pageVisible = document.visibilityState === "visible";
    this.updateLoopState();
  };
  private readonly render = (time: number): void => this.renderFrame(time);
  private renderer: WebGPURenderer | null = null;
  private controls: OrbitControls | null = null;
  private resizeObserver: ResizeObserver | null = null;
  private intersectionObserver: IntersectionObserver | null = null;
  private pageVisible = document.visibilityState === "visible";
  private inViewport = true;
  private disposed = false;
  private exploded = false;
  private explodeTarget = 0;
  private explodeProgress = 0;
  private lastTime = 0;
  private controlsActiveUntil = 0;
  private animationLoopActive = false;

  public constructor(container: HTMLElement, options: LowPolyTreeSceneOptions) {
    this.container = container;
    this.options = options;
    this.reducedMotion = options.reducedMotion;
  }

  public async init(): Promise<LowPolyTreeSceneInitResult> {
    this.scene.background = new THREE.Color(BACKGROUND_COLOR);
    this.scene.fog = new THREE.Fog(BACKGROUND_COLOR, 15, 26);
    this.buildLighting();
    this.buildTree();

    const viewport = this.getViewportSize();
    const cameraPreset = getCameraPreset(viewport.width, viewport.height);
    this.camera.aspect = viewport.width / viewport.height;
    this.camera.fov = cameraPreset.fov;
    this.camera.near = 0.1;
    this.camera.far = 40;
    this.camera.position.set(...cameraPreset.position);
    this.camera.lookAt(...cameraPreset.target);
    this.camera.updateProjectionMatrix();

    const renderer = new WebGPURenderer({ antialias: true, alpha: false });
    await renderer.init();

    if (this.disposed) {
      renderer.dispose();
      return { webGpuApiAvailable: this.hasWebGpuApi() };
    }

    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
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
    this.controls.minPolarAngle = 0.45;
    this.controls.maxPolarAngle = Math.PI * 0.47;
    this.controls.autoRotate = getInitialAutoRotate(this.reducedMotion);
    this.controls.autoRotateSpeed = 0.42;
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

  public setExploded(exploded: boolean): void {
    if (this.disposed) {
      return;
    }

    this.exploded = exploded;
    this.explodeTarget = exploded ? 1 : 0;
    this.options.onExplodedChange(exploded);
    this.updateLoopState();
  }

  public setAutoRotate(enabled: boolean): void {
    if (this.disposed || !this.controls) {
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
    const nextAutoRotate = getAutoRotateAfterMotionPreference(
      enabled,
      this.controls.autoRotate,
    );
    if (nextAutoRotate !== this.controls.autoRotate) {
      this.controls.autoRotate = nextAutoRotate;
      this.options.onAutoRotateChange(nextAutoRotate);
    }
    this.updateLoopState();
  }

  public zoomBy(direction: "in" | "out"): void {
    if (this.disposed || !this.controls) {
      return;
    }

    const target = this.controls.target;
    const offset = this.camera.position.clone().sub(target);
    const currentDistance = offset.length();
    const nextDistance = THREE.MathUtils.clamp(
      currentDistance * (direction === "in" ? 0.82 : 1.22),
      this.controls.minDistance,
      this.controls.maxDistance,
    );
    offset.setLength(nextDistance);
    this.camera.position.copy(target).add(offset);
    this.controls.update();
    this.updateLoopState();
  }

  public reset(): void {
    if (this.disposed || !this.controls) {
      return;
    }

    const viewport = this.getViewportSize();
    const cameraPreset = getCameraPreset(viewport.width, viewport.height);
    this.camera.position.set(...cameraPreset.position);
    this.camera.fov = cameraPreset.fov;
    this.camera.updateProjectionMatrix();
    this.controls.target.set(...cameraPreset.target);
    this.controls.update();
    this.exploded = false;
    this.explodeTarget = 0;
    const initialAutoRotate = getInitialAutoRotate(this.reducedMotion);
    this.controls.autoRotate = initialAutoRotate;
    this.options.onExplodedChange(false);
    this.options.onAutoRotateChange(initialAutoRotate);
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
    document.removeEventListener("visibilitychange", this.handleVisibility);
    disposeScene(this.scene);
    this.renderer?.dispose();
    if (this.renderer?.domElement.parentElement === this.container) {
      this.container.removeChild(this.renderer.domElement);
    }
    this.renderer = null;
    this.controls = null;
  }

  private readonly handleControlsChange = (): void => {
    this.controlsActiveUntil = performance.now() + 520;
    this.updateLoopState();
  };

  private buildLighting(): void {
    const hemisphere = new THREE.HemisphereLight(0xf6fff6, 0x6f5743, 1.75);
    const keyLight = new THREE.DirectionalLight(0xffe1a8, 3.1);
    keyLight.position.set(5, 9, 6);
    const fillLight = new THREE.DirectionalLight(0xb8d8ef, 1.15);
    fillLight.position.set(-6, 5, -4);
    this.scene.add(hemisphere, keyLight, fillLight);
  }

  private buildTree(): void {
    this.treeGroup.position.set(0, 0, 0);
    this.scene.add(this.treeGroup);

    for (const definition of TREE_PARTS) {
      const group = new THREE.Group();
      group.name = definition.id;
      group.position.set(...definition.initialPosition);
      group.rotation.set(...definition.initialRotation);
      group.scale.set(...definition.initialScale);

      const mesh = new THREE.Mesh(createGeometry(definition.geometry), createMaterial(definition.material));
      mesh.castShadow = false;
      mesh.receiveShadow = false;
      applyMeshTransform(mesh, definition);
      group.add(mesh);
      this.treeGroup.add(group);
      this.parts.push({ definition, group });
    }
  }

  private renderFrame(time: number): void {
    if (this.disposed || !this.renderer || !this.controls) {
      return;
    }

    const deltaSeconds = this.lastTime === 0
      ? 0
      : Math.min(Math.max((time - this.lastTime) / 1000, 0), 0.05);
    this.lastTime = time;
    const transitionDuration = getExplodeTransitionDuration(this.reducedMotion);
    const transitionFactor = deltaSeconds === 0
      ? 1
      : 1 - Math.exp(-(1000 / transitionDuration) * deltaSeconds * 4);
    this.explodeProgress += (this.explodeTarget - this.explodeProgress) * transitionFactor;
    if (Math.abs(this.explodeTarget - this.explodeProgress) < 0.0005) {
      this.explodeProgress = this.explodeTarget;
    }
    this.applyExplodeProgress();
    this.controls.update();
    this.renderer.render(this.scene, this.camera);

    if (!this.shouldAnimate(time)) {
      this.renderer.setAnimationLoop(null);
      this.animationLoopActive = false;
    }
  }

  private applyExplodeProgress(): void {
    for (const scenePart of this.parts) {
      const position = getExplodedPosition(scenePart.definition, this.explodeProgress);
      const rotation = interpolateRotation(
        scenePart.definition.initialRotation,
        [
          scenePart.definition.initialRotation[0] + scenePart.definition.explodeDirection[2] * 0.18,
          scenePart.definition.initialRotation[1] + scenePart.definition.explodeDirection[0] * 0.14,
          scenePart.definition.initialRotation[2] - scenePart.definition.explodeDirection[1] * 0.12,
        ],
        this.explodeProgress,
      );
      scenePart.group.position.set(...position);
      scenePart.group.rotation.set(...rotation);
    }
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
      this.controls?.autoRotate
      || Math.abs(this.explodeTarget - this.explodeProgress) >= 0.0005
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
