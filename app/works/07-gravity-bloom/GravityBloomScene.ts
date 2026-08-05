import * as THREE from "three";
import { WebGPURenderer } from "three/webgpu";

import {
  DEFAULT_PARTICLE_BOUNDS,
  DEFAULT_SIMULATION_CONFIG,
  type ParticleBounds,
  type ParticleField,
  type Point3,
  calculateParticleCount,
  clampDeltaTime,
  countCapturedParticles,
  createParticleField,
  normalizedPointerToWorld,
  releaseParticleField,
  resetCapturedParticles,
  updateParticleField,
} from "./simulation";
import {
  MAX_CHARGE_MS,
  chargeRatio,
  isBloomEligible,
} from "./game";

export type GravityBloomRelease = {
  readonly validBloom: boolean;
  readonly chargeMs: number;
  readonly capturedCount: number;
  readonly releaseId: number;
};

export type GravityBloomSceneOptions = {
  readonly onChargeStateChange: (charging: boolean) => void;
  readonly onRelease: (release: GravityBloomRelease) => void;
  readonly onStartChallenge: () => void;
  readonly onReset: () => void;
  readonly onEscape: () => void;
};

export type GravityBloomSceneInitResult = {
  readonly webGpuApiAvailable: boolean;
};

type ShockwaveEffect = {
  readonly line: THREE.Line;
  readonly material: THREE.LineBasicMaterial;
  elapsed: number;
  duration: number;
  active: boolean;
};

type FlowerEffect = {
  readonly group: THREE.Group;
  readonly petalMaterial: THREE.LineBasicMaterial;
  readonly ringMaterial: THREE.LineBasicMaterial;
  readonly coreMaterial: THREE.MeshBasicMaterial;
  elapsed: number;
  duration: number;
  active: boolean;
};

const PARTICLE_SEED = 0x47_52_41_56;
const SHOCKWAVE_POOL_SIZE = 4;
const FLOWER_POOL_SIZE = 4;
const CAMERA_FOV = 50;
const CAMERA_Z = 10;
const CLEAR_COLOR = 0x050816;

function createCircleGeometry(radius: number, segments: number): THREE.BufferGeometry {
  const positions = new Float32Array((segments + 1) * 3);

  for (let index = 0; index <= segments; index += 1) {
    const angle = (index / segments) * Math.PI * 2;
    const offset = index * 3;
    positions[offset] = Math.cos(angle) * radius;
    positions[offset + 1] = Math.sin(angle) * radius;
    positions[offset + 2] = 0;
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
  return geometry;
}

function createPetalGeometry(angle: number): THREE.BufferGeometry {
  const steps = 6;
  const positions = new Float32Array(steps * 3);
  const directionX = Math.cos(angle);
  const directionY = Math.sin(angle);
  const tangentX = -directionY;
  const tangentY = directionX;

  for (let index = 0; index < steps; index += 1) {
    const progress = index / (steps - 1);
    const radius = 0.12 + progress * 0.98;
    const petalCurve = Math.sin(progress * Math.PI) * 0.16;
    const offset = index * 3;
    positions[offset] = directionX * radius + tangentX * petalCurve;
    positions[offset + 1] = directionY * radius + tangentY * petalCurve;
    positions[offset + 2] = 0.02 + progress * 0.04;
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
  return geometry;
}

function viewportBounds(width: number, height: number): ParticleBounds {
  const aspect = width / Math.max(height, 1);
  const visibleHeight = 2 * Math.tan((CAMERA_FOV * Math.PI) / 360) * CAMERA_Z;

  return {
    x: Math.max(3.2, Math.min(7.8, visibleHeight * aspect * 0.44)),
    y: Math.max(2.35, Math.min(4.2, visibleHeight * 0.44)),
    z: DEFAULT_PARTICLE_BOUNDS.z,
  };
}

function finiteTime(value: number): number {
  return Number.isFinite(value) ? value : performance.now();
}

export class GravityBloomScene {
  private readonly container: HTMLElement;
  private readonly options: GravityBloomSceneOptions;
  private readonly scene = new THREE.Scene();
  private readonly camera = new THREE.PerspectiveCamera(CAMERA_FOV, 1, 0.1, 80);
  private readonly particleGroup = new THREE.Group();
  private readonly coreGroup = new THREE.Group();
  private readonly targetWorld: Point3 = { x: 0, y: 0, z: 0 };
  private readonly targetVector = new THREE.Vector3();
  private readonly corePosition = new THREE.Vector3();
  private readonly keyboardKeys = new Set<string>();
  private readonly shockwaves: ShockwaveEffect[] = [];
  private readonly flowers: FlowerEffect[] = [];
  private readonly reducedMotion: boolean;
  private particleField: ParticleField;
  private simulationConfig = DEFAULT_SIMULATION_CONFIG;
  private positionAttribute: THREE.BufferAttribute | null = null;
  private colorAttribute: THREE.BufferAttribute | null = null;
  private particleColors: Float32Array | null = null;
  private renderer: WebGPURenderer | null = null;
  private canvas: HTMLCanvasElement | null = null;
  private resizeObserver: ResizeObserver | null = null;
  private intersectionObserver: IntersectionObserver | null = null;
  private isInViewport = true;
  private animationLoopRunning = false;
  private lastFrameAt = 0;
  private elapsedSeconds = 0;
  private activePointerId: number | null = null;
  private keyboardSpaceDown = false;
  private isCharging = false;
  private chargeStartedAt = 0;
  private releaseId = 0;
  private resetCount = 0;
  private disposed = false;
  private chargeRing: THREE.Line | null = null;
  private chargeRingMaterial: THREE.LineBasicMaterial | null = null;
  private coreMaterial: THREE.MeshBasicMaterial | null = null;
  private coreHaloMaterial: THREE.MeshBasicMaterial | null = null;

  private readonly animate = (time: number) => {
    if (this.disposed || !this.renderer) {
      return;
    }

    const now = finiteTime(time);
    const delta = clampDeltaTime((now - this.lastFrameAt) / 1000);
    this.lastFrameAt = now;

    if (document.visibilityState !== "visible" || !this.isInViewport) {
      return;
    }

    this.elapsedSeconds += delta;
    this.updateKeyboardTarget(delta);
    updateParticleField(
      this.particleField,
      this.targetWorld,
      delta,
      this.isCharging,
      this.simulationConfig,
    );
    this.updateParticleColors();
    this.updateCore(delta, now);
    this.updateEffects(delta);

    this.positionAttribute?.setUsage(THREE.DynamicDrawUsage);
    if (this.positionAttribute) {
      this.positionAttribute.needsUpdate = true;
    }
    if (this.colorAttribute) {
      this.colorAttribute.needsUpdate = true;
    }
    this.renderer.render(this.scene, this.camera);
  };

  private readonly handleResize = () => {
    this.resize();
  };

  private readonly handleVisibilityChange = () => {
    this.lastFrameAt = performance.now();
    const visible = document.visibilityState === "visible";
    if (!visible) {
      this.cancelCharge();
    }
    this.setAnimationLoopRunning(visible && this.isInViewport);
  };

  private readonly handleWindowBlur = () => {
    this.cancelCharge();
  };

  private readonly handleIntersection = (entries: IntersectionObserverEntry[]) => {
    const entry = entries[0];
    this.isInViewport = entry?.isIntersecting ?? true;
    this.lastFrameAt = performance.now();
    this.setAnimationLoopRunning(this.isInViewport && document.visibilityState === "visible");
  };

  private readonly handleKeyDown = (event: KeyboardEvent) => {
    const key = event.key.length === 1 ? event.key.toLowerCase() : event.key;

    if (["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", "w", "a", "s", "d"].includes(key)) {
      this.keyboardKeys.add(key);
      event.preventDefault();
      return;
    }

    if (key === " " || key === "Spacebar") {
      event.preventDefault();
      if (!event.repeat && !this.keyboardSpaceDown) {
        this.keyboardSpaceDown = true;
        this.beginCharge();
      }
      return;
    }

    if (event.repeat) {
      return;
    }

    if (key === "Enter") {
      event.preventDefault();
      this.options.onStartChallenge();
    } else if (key === "r") {
      event.preventDefault();
      this.reset();
      this.options.onReset();
    } else if (key === "Escape") {
      event.preventDefault();
      this.keyboardSpaceDown = false;
      this.cancelCharge();
      this.options.onEscape();
    }
  };

  private readonly handleKeyUp = (event: KeyboardEvent) => {
    const key = event.key.length === 1 ? event.key.toLowerCase() : event.key;

    if (["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", "w", "a", "s", "d"].includes(key)) {
      this.keyboardKeys.delete(key);
      event.preventDefault();
      return;
    }

    if (key === " " || key === "Spacebar") {
      event.preventDefault();
      this.keyboardSpaceDown = false;
      this.finishCharge();
    }
  };

  private readonly handleCanvasPointerDown = (event: PointerEvent) => {
    if (!this.canvas || !event.isPrimary || this.activePointerId !== null) {
      return;
    }

    event.preventDefault();
    this.container.focus({ preventScroll: true });
    this.activePointerId = event.pointerId;
    this.updateTargetFromPointer(event);
    this.canvas.setPointerCapture?.(event.pointerId);
    this.beginCharge();
  };

  private readonly handleCanvasPointerMove = (event: PointerEvent) => {
    if (event.pointerType === "touch" && this.activePointerId !== event.pointerId) {
      return;
    }

    if (this.activePointerId === null || this.activePointerId === event.pointerId || event.pointerType === "mouse") {
      this.updateTargetFromPointer(event);
    }
  };

  private readonly handleCanvasPointerUp = (event: PointerEvent) => {
    if (this.activePointerId !== event.pointerId) {
      return;
    }

    this.releasePointerCapture(event.pointerId);
    this.finishCharge();
  };

  private readonly handleCanvasPointerCancel = (event: PointerEvent) => {
    if (this.activePointerId !== event.pointerId) {
      return;
    }

    this.releasePointerCapture(event.pointerId);
    this.finishCharge();
  };

  private readonly handleWindowPointerUp = (event: PointerEvent) => {
    if (this.activePointerId !== event.pointerId) {
      return;
    }

    this.releasePointerCapture(event.pointerId);
    this.finishCharge();
  };

  constructor(container: HTMLElement, options: GravityBloomSceneOptions) {
    this.container = container;
    this.options = options;
    this.reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const width = Math.max(container.clientWidth, 720);
    const height = Math.max(container.clientHeight, 560);
    const particleCount = calculateParticleCount({
      width,
      height,
      pixelRatio: window.devicePixelRatio,
      hardwareConcurrency: navigator.hardwareConcurrency,
      reducedMotion: this.reducedMotion,
    });
    this.particleField = createParticleField(particleCount, PARTICLE_SEED, DEFAULT_PARTICLE_BOUNDS);
    this.simulationConfig = {
      ...DEFAULT_SIMULATION_CONFIG,
      bounds: viewportBounds(width, height),
    };
    this.camera.position.set(0, 0, CAMERA_Z);
    this.camera.lookAt(0, 0, 0);
    this.scene.background = new THREE.Color(CLEAR_COLOR);
    this.scene.fog = new THREE.FogExp2(CLEAR_COLOR, 0.035);
    this.buildScene();
    this.installNonRendererListeners();
  }

  public async init(): Promise<GravityBloomSceneInitResult> {
    const renderer = new WebGPURenderer({
      antialias: true,
      alpha: false,
    });
    this.renderer = renderer;

    try {
      await renderer.init();
    } catch (error) {
      renderer.dispose();
      this.renderer = null;
      if (this.disposed) {
        return { webGpuApiAvailable: false };
      }
      throw error;
    }

    if (this.disposed) {
      renderer.dispose();
      return { webGpuApiAvailable: false };
    }

    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
    renderer.setClearColor(CLEAR_COLOR, 1);
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.domElement.setAttribute("aria-hidden", "true");
    renderer.domElement.style.display = "block";
    renderer.domElement.style.width = "100%";
    renderer.domElement.style.height = "100%";
    renderer.domElement.style.touchAction = "none";
    this.canvas = renderer.domElement;
    this.container.appendChild(renderer.domElement);
    this.canvas.addEventListener("pointerdown", this.handleCanvasPointerDown);
    this.canvas.addEventListener("pointermove", this.handleCanvasPointerMove);
    this.canvas.addEventListener("pointerup", this.handleCanvasPointerUp);
    this.canvas.addEventListener("pointercancel", this.handleCanvasPointerCancel);
    this.resize();
    this.lastFrameAt = performance.now();
    this.setAnimationLoopRunning(true);

    return {
      webGpuApiAvailable: "gpu" in navigator,
    };
  }

  public startChallenge(): void {
    this.cancelCharge();
    this.resetParticles();
  }

  public reset(): void {
    this.cancelCharge();
    this.keyboardKeys.clear();
    this.keyboardSpaceDown = false;
    this.activePointerId = null;
    this.targetWorld.x = 0;
    this.targetWorld.y = 0;
    this.targetWorld.z = 0;
    this.corePosition.set(0, 0, 0);
    this.resetParticles();
    this.clearEffects();
  }

  public dispose(): void {
    if (this.disposed) {
      return;
    }

    this.disposed = true;
    this.animationLoopRunning = false;
    if (this.renderer) {
      void this.renderer.setAnimationLoop(null);
    }
    this.removeRendererListeners();
    this.removeNonRendererListeners();
    this.resizeObserver?.disconnect();
    this.intersectionObserver?.disconnect();
    this.resizeObserver = null;
    this.intersectionObserver = null;
    this.scene.traverse((object) => {
      const renderable = object as THREE.Mesh | THREE.Line | THREE.Points;
      renderable.geometry?.dispose();
      const material = renderable.material;
      if (Array.isArray(material)) {
        material.forEach((item) => item.dispose());
      } else {
        material?.dispose();
      }
    });
    this.scene.clear();
    this.renderer?.dispose();
    this.renderer = null;
    this.canvas?.remove();
    this.canvas = null;
  }

  private buildScene(): void {
    this.buildParticles();
    this.buildCore();
    this.buildEffectPools();
    this.scene.add(this.particleGroup, this.coreGroup);
  }

  private buildParticles(): void {
    const geometry = new THREE.BufferGeometry();
    this.positionAttribute = new THREE.BufferAttribute(this.particleField.positions, 3);
    this.positionAttribute.setUsage(THREE.DynamicDrawUsage);
    this.particleColors = new Float32Array(this.particleField.count * 3);
    this.colorAttribute = new THREE.BufferAttribute(this.particleColors, 3);
    this.updateParticleColors();
    geometry.setAttribute("position", this.positionAttribute);
    geometry.setAttribute("color", this.colorAttribute);
    const material = new THREE.PointsMaterial({
      size: this.reducedMotion ? 0.075 : 0.068,
      vertexColors: true,
      transparent: true,
      opacity: 0.9,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      sizeAttenuation: true,
    });
    this.particleGroup.add(new THREE.Points(geometry, material));
  }

  private buildCore(): void {
    const coreGeometry = new THREE.SphereGeometry(0.14, 18, 18);
    this.coreMaterial = new THREE.MeshBasicMaterial({
      color: 0xfff2c6,
      transparent: true,
      opacity: 0.96,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    const core = new THREE.Mesh(coreGeometry, this.coreMaterial);
    const haloGeometry = new THREE.CircleGeometry(0.42, 48);
    this.coreHaloMaterial = new THREE.MeshBasicMaterial({
      color: 0xffb45e,
      transparent: true,
      opacity: 0.12,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      side: THREE.DoubleSide,
    });
    const halo = new THREE.Mesh(haloGeometry, this.coreHaloMaterial);
    const ringGeometry = createCircleGeometry(1, 64);
    this.chargeRingMaterial = new THREE.LineBasicMaterial({
      color: 0x7bdcff,
      transparent: true,
      opacity: 0.18,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    this.chargeRing = new THREE.Line(ringGeometry, this.chargeRingMaterial);
    this.chargeRing.scale.setScalar(1.5);
    this.coreGroup.add(halo, this.chargeRing, core);
  }

  private buildEffectPools(): void {
    for (let index = 0; index < SHOCKWAVE_POOL_SIZE; index += 1) {
      const material = new THREE.LineBasicMaterial({
        color: 0x9deaff,
        transparent: true,
        opacity: 0,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      });
      const line = new THREE.Line(createCircleGeometry(1, 64), material);
      line.visible = false;
      this.scene.add(line);
      this.shockwaves.push({
        line,
        material,
        elapsed: 0,
        duration: this.reducedMotion ? 0.62 : 1.05,
        active: false,
      });
    }

    for (let index = 0; index < FLOWER_POOL_SIZE; index += 1) {
      const group = new THREE.Group();
      const petalMaterial = new THREE.LineBasicMaterial({
        color: index % 2 === 0 ? 0xffa85c : 0xff80c8,
        transparent: true,
        opacity: 0,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      });
      const ringMaterial = new THREE.LineBasicMaterial({
        color: 0xaff7ff,
        transparent: true,
        opacity: 0,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      });
      const coreMaterial = new THREE.MeshBasicMaterial({
        color: 0xfff5cc,
        transparent: true,
        opacity: 0,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      });

      for (let petal = 0; petal < 8; petal += 1) {
        group.add(new THREE.Line(createPetalGeometry((petal / 8) * Math.PI * 2), petalMaterial));
      }
      group.add(new THREE.Line(createCircleGeometry(0.82, 48), ringMaterial));
      group.add(new THREE.Mesh(new THREE.SphereGeometry(0.12, 12, 12), coreMaterial));
      group.visible = false;
      this.scene.add(group);
      this.flowers.push({
        group,
        petalMaterial,
        ringMaterial,
        coreMaterial,
        elapsed: 0,
        duration: this.reducedMotion ? 0.72 : 1.12,
        active: false,
      });
    }
  }

  private installNonRendererListeners(): void {
    this.container.addEventListener("keydown", this.handleKeyDown);
    this.container.addEventListener("keyup", this.handleKeyUp);
    window.addEventListener("pointerup", this.handleWindowPointerUp);
    window.addEventListener("pointercancel", this.handleWindowPointerUp);
    window.addEventListener("blur", this.handleWindowBlur);
    document.addEventListener("visibilitychange", this.handleVisibilityChange);
    this.resizeObserver = new ResizeObserver(this.handleResize);
    this.resizeObserver.observe(this.container);
    this.intersectionObserver = new IntersectionObserver(this.handleIntersection, { threshold: 0.01 });
    this.intersectionObserver.observe(this.container);
  }

  private removeNonRendererListeners(): void {
    this.container.removeEventListener("keydown", this.handleKeyDown);
    this.container.removeEventListener("keyup", this.handleKeyUp);
    window.removeEventListener("pointerup", this.handleWindowPointerUp);
    window.removeEventListener("pointercancel", this.handleWindowPointerUp);
    window.removeEventListener("blur", this.handleWindowBlur);
    document.removeEventListener("visibilitychange", this.handleVisibilityChange);
  }

  private removeRendererListeners(): void {
    this.canvas?.removeEventListener("pointerdown", this.handleCanvasPointerDown);
    this.canvas?.removeEventListener("pointermove", this.handleCanvasPointerMove);
    this.canvas?.removeEventListener("pointerup", this.handleCanvasPointerUp);
    this.canvas?.removeEventListener("pointercancel", this.handleCanvasPointerCancel);
  }

  private resize(): void {
    if (!this.renderer) {
      return;
    }

    const width = Math.max(1, this.container.clientWidth);
    const height = Math.max(1, this.container.clientHeight);
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
    this.simulationConfig = {
      ...this.simulationConfig,
      bounds: viewportBounds(width, height),
    };
    this.renderer.setSize(width, height, false);
  }

  private setAnimationLoopRunning(running: boolean): void {
    if (!this.renderer || this.animationLoopRunning === running) {
      return;
    }

    this.animationLoopRunning = running;
    this.lastFrameAt = performance.now();
    void this.renderer.setAnimationLoop(running ? this.animate : null);
  }

  private updateParticleColors(): void {
    if (!this.particleColors) {
      return;
    }

    for (let index = 0; index < this.particleField.count; index += 1) {
      const offset = index * 3;
      const brightness = this.particleField.brightness[index] * (this.particleField.captured[index] ? 1.5 : 1);
      const colorCycle = index % 5;
      this.particleColors[offset] = brightness * (colorCycle === 0 ? 0.95 : 0.26);
      this.particleColors[offset + 1] = brightness * (colorCycle === 1 || colorCycle === 4 ? 0.85 : 0.52);
      this.particleColors[offset + 2] = brightness;
    }
  }

  private updateCore(delta: number, now: number): void {
    const smoothing = 1 - Math.exp(-11 * delta);
    this.targetVector.set(this.targetWorld.x, this.targetWorld.y, this.targetWorld.z);
    this.corePosition.lerp(this.targetVector, smoothing);
    this.coreGroup.position.copy(this.corePosition);

    const currentCharge = this.isCharging ? chargeRatio(now - this.chargeStartedAt) : 0;
    const pulse = this.reducedMotion ? 0 : Math.sin(this.elapsedSeconds * 3.4) * 0.035;
    const coreScale = 1 + pulse + currentCharge * 0.45;
    const ringScale = 1.5 + currentCharge * 0.72;
    this.coreGroup.scale.setScalar(coreScale);
    this.chargeRing?.scale.setScalar(ringScale);
    if (this.chargeRingMaterial) {
      this.chargeRingMaterial.opacity = this.isCharging ? 0.24 + currentCharge * 0.22 : 0.15;
    }
    if (this.coreHaloMaterial) {
      this.coreHaloMaterial.opacity = 0.12 + currentCharge * 0.16;
    }
    if (this.coreMaterial) {
      this.coreMaterial.opacity = 0.9 + currentCharge * 0.1;
    }
  }

  private updateEffects(delta: number): void {
    for (const effect of this.shockwaves) {
      if (!effect.active) {
        continue;
      }

      effect.elapsed += delta;
      const progress = Math.min(1, effect.elapsed / effect.duration);
      effect.line.scale.setScalar(0.15 + progress * (this.reducedMotion ? 1.35 : 2.7));
      effect.material.opacity = (1 - progress) * (this.reducedMotion ? 0.52 : 0.75);
      if (progress >= 1) {
        effect.active = false;
        effect.line.visible = false;
      }
    }

    for (const effect of this.flowers) {
      if (!effect.active) {
        continue;
      }

      effect.elapsed += delta;
      const progress = Math.min(1, effect.elapsed / effect.duration);
      const eased = 1 - Math.pow(1 - progress, 2);
      effect.group.scale.setScalar(0.22 + eased * (this.reducedMotion ? 0.95 : 1.55));
      effect.group.rotation.z = this.reducedMotion ? 0 : effect.elapsed * 0.65;
      const opacity = Math.sin(Math.min(progress, 0.82) / 0.82 * Math.PI * 0.5) * (1 - progress * 0.58);
      effect.petalMaterial.opacity = opacity * 0.88;
      effect.ringMaterial.opacity = opacity * 0.66;
      effect.coreMaterial.opacity = opacity;
      if (progress >= 1) {
        effect.active = false;
        effect.group.visible = false;
      }
    }
  }

  private updateKeyboardTarget(delta: number): void {
    let directionX = 0;
    let directionY = 0;

    if (this.keyboardKeys.has("ArrowLeft") || this.keyboardKeys.has("a")) {
      directionX -= 1;
    }
    if (this.keyboardKeys.has("ArrowRight") || this.keyboardKeys.has("d")) {
      directionX += 1;
    }
    if (this.keyboardKeys.has("ArrowUp") || this.keyboardKeys.has("w")) {
      directionY += 1;
    }
    if (this.keyboardKeys.has("ArrowDown") || this.keyboardKeys.has("s")) {
      directionY -= 1;
    }

    if (directionX === 0 && directionY === 0) {
      return;
    }

    const length = Math.sqrt(directionX * directionX + directionY * directionY);
    const speed = 5.1 * delta / length;
    this.targetWorld.x += directionX * speed;
    this.targetWorld.y += directionY * speed;
    this.targetWorld.x = Math.min(Math.max(this.targetWorld.x, -this.simulationConfig.bounds.x * 0.9), this.simulationConfig.bounds.x * 0.9);
    this.targetWorld.y = Math.min(Math.max(this.targetWorld.y, -this.simulationConfig.bounds.y * 0.9), this.simulationConfig.bounds.y * 0.9);
  }

  private updateTargetFromPointer(event: PointerEvent): void {
    const rect = this.container.getBoundingClientRect();
    const point = normalizedPointerToWorld(
      {
        clientX: event.clientX,
        clientY: event.clientY,
        left: rect.left,
        top: rect.top,
        width: rect.width,
        height: rect.height,
      },
      this.simulationConfig.bounds,
    );
    this.targetWorld.x = point.x;
    this.targetWorld.y = point.y;
    this.targetWorld.z = point.z;
  }

  private beginCharge(): void {
    if (this.isCharging || this.disposed) {
      return;
    }

    this.isCharging = true;
    this.chargeStartedAt = performance.now();
    this.options.onChargeStateChange(true);
  }

  private finishCharge(): void {
    if (!this.isCharging) {
      this.activePointerId = null;
      return;
    }

    const chargeMs = Math.min(MAX_CHARGE_MS, Math.max(0, performance.now() - this.chargeStartedAt));
    const capturedCount = countCapturedParticles(this.particleField);
    const validBloom = isBloomEligible(chargeMs, capturedCount);
    const ratio = chargeRatio(chargeMs);
    releaseParticleField(this.particleField, this.targetWorld, ratio, this.simulationConfig);
    this.spawnShockwave(ratio);
    if (validBloom) {
      this.spawnFlower(ratio);
    }

    this.isCharging = false;
    this.activePointerId = null;
    this.options.onChargeStateChange(false);
    this.options.onRelease({
      validBloom,
      chargeMs,
      capturedCount,
      releaseId: this.releaseId++,
    });
  }

  private cancelCharge(): void {
    if (!this.isCharging) {
      resetCapturedParticles(this.particleField);
      this.activePointerId = null;
      return;
    }

    this.isCharging = false;
    this.keyboardSpaceDown = false;
    this.activePointerId = null;
    resetCapturedParticles(this.particleField);
    this.options.onChargeStateChange(false);
  }

  private releasePointerCapture(pointerId: number): void {
    if (this.canvas?.hasPointerCapture?.(pointerId)) {
      this.canvas.releasePointerCapture(pointerId);
    }
  }

  private spawnShockwave(ratio: number): void {
    const effect = this.shockwaves.find((candidate) => !candidate.active) ?? this.shockwaves[0];
    if (!effect) {
      return;
    }

    effect.active = true;
    effect.elapsed = 0;
    effect.line.visible = true;
    effect.line.position.copy(this.corePosition);
    effect.line.scale.setScalar(0.15 + ratio * 0.15);
    effect.material.opacity = this.reducedMotion ? 0.52 : 0.75;
  }

  private spawnFlower(ratio: number): void {
    const effect = this.flowers.find((candidate) => !candidate.active) ?? this.flowers[0];
    if (!effect) {
      return;
    }

    effect.active = true;
    effect.elapsed = 0;
    effect.group.visible = true;
    effect.group.position.copy(this.corePosition);
    effect.group.scale.setScalar(0.22 + ratio * 0.12);
    effect.petalMaterial.opacity = 0.88;
    effect.ringMaterial.opacity = 0.66;
    effect.coreMaterial.opacity = 1;
  }

  private resetParticles(): void {
    const fresh = createParticleField(
      this.particleField.count,
      PARTICLE_SEED + this.resetCount,
      this.simulationConfig.bounds,
    );
    this.resetCount += 1;
    this.particleField.positions.set(fresh.positions);
    this.particleField.velocities.set(fresh.velocities);
    this.particleField.basePositions.set(fresh.basePositions);
    this.particleField.phases.set(fresh.phases);
    this.particleField.sizes.set(fresh.sizes);
    this.particleField.brightness.set(fresh.brightness);
    resetCapturedParticles(this.particleField);
    if (this.positionAttribute) {
      this.positionAttribute.needsUpdate = true;
    }
  }

  private clearEffects(): void {
    for (const effect of this.shockwaves) {
      effect.active = false;
      effect.line.visible = false;
    }
    for (const effect of this.flowers) {
      effect.active = false;
      effect.group.visible = false;
    }
  }
}
