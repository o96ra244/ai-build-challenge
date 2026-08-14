import * as THREE from "three";
import { MeshStandardNodeMaterial, WebGPURenderer } from "three/webgpu";

import {
  addBox,
  addMesh,
  createBaseProfile,
  createBranchGeometry,
  createConiferBoughGeometry,
  createGableGeometry,
  createSlopedSlabGeometry,
  createSnowEaveGeometry,
  createSnowMoundGeometry,
  createSnowPatchGeometry,
  createTerrainGeometry,
} from "./visualGeometry";
import { createSnowGlobeMaterials, type SnowGlobeMaterials } from "./visualMaterials";

export type SnowGlobeVisualSceneInitResult = {
  readonly ready: boolean;
  readonly errorMessage?: string;
};

type TreeSpec = {
  readonly position: THREE.Vector3;
  readonly height: number;
  readonly width: number;
  readonly material: MeshStandardNodeMaterial;
  readonly tierCount: number;
  readonly seed: number;
  readonly hero?: boolean;
};

type SnowParticle = {
  readonly position: THREE.Vector3;
  readonly home: THREE.Vector3;
  readonly velocity: THREE.Vector3;
  readonly phase: number;
  readonly size: number;
  burstAge: number;
  zoneIndex: number;
  isBurst: boolean;
};

type GlitterParticle = {
  readonly position: THREE.Vector3;
  readonly phase: number;
  readonly speed: number;
  readonly size: number;
};

type AccumulationZone = {
  readonly mesh: THREE.Mesh;
  readonly anchor: THREE.Vector3;
  readonly baseScale: THREE.Vector3;
  amount: number;
};

function seededRandom(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = Math.imul(1664525, state) + 1013904223;
    return (state >>> 0) / 4294967296;
  };
}

function markShadow(mesh: THREE.Mesh, cast = true, receive = true): THREE.Mesh {
  mesh.castShadow = cast;
  mesh.receiveShadow = receive;
  return mesh;
}

function disposeSceneResources(scene: THREE.Scene, materials: SnowGlobeMaterials): void {
  const geometries = new Set<THREE.BufferGeometry>();
  const sceneMaterials = new Set<THREE.Material>();
  scene.traverse((object) => {
    if (object instanceof THREE.Mesh || object instanceof THREE.Line || object instanceof THREE.Points) {
      geometries.add(object.geometry);
      if (Array.isArray(object.material)) {
        object.material.forEach((material) => sceneMaterials.add(material));
      } else {
        sceneMaterials.add(object.material);
      }
    }
  });
  geometries.forEach((geometry) => geometry.dispose());
  sceneMaterials.forEach((material) => material.dispose());
  materials.textures.forEach((texture) => texture.dispose());
}

export class SnowGlobeVisualScene {
  private readonly container: HTMLElement;
  private readonly scene = new THREE.Scene();
  private readonly camera = new THREE.PerspectiveCamera(33, 1, 0.1, 80);
  private readonly globeRoot = new THREE.Group();
  private readonly globeBody = new THREE.Group();
  private readonly motionRoot = new THREE.Group();
  private readonly particleRoot = new THREE.Group();
  private readonly materials = createSnowGlobeMaterials();
  private readonly resizeObserver: ResizeObserver;
  private readonly accumulationZones: AccumulationZone[] = [];
  private readonly snowParticles: SnowParticle[] = [];
  private readonly glitterParticles: GlitterParticle[] = [];
  private readonly particleDummy = new THREE.Object3D();
  private readonly glitterDummy = new THREE.Object3D();
  private readonly pointerStart = new THREE.Vector2();
  private readonly pointerLast = new THREE.Vector2();
  private readonly pointerVelocity = new THREE.Vector2();
  private snowMesh: THREE.InstancedMesh | null = null;
  private glitterMesh: THREE.InstancedMesh | null = null;
  private renderer: WebGPURenderer | null = null;
  private disposed = false;
  private reducedMotion: boolean;
  private animationRunning = false;
  private lastFrameTime = 0;
  private animationTime = 0;
  private particleCount = 420;
  private glitterCount = 88;
  private ambientSnowCount = 5;
  private ambientGlitterCount = 12;
  private pointerId: number | null = null;
  private dragging = false;
  private pointerMoved = false;
  private dragStartedAt = 0;
  private pointerLastTime = 0;
  private globeYaw = 0;
  private globePitch = 0;
  private globeRoll = 0;
  private globeYawVelocity = 0;
  private globePitchVelocity = 0;
  private globeRollVelocity = 0;
  private shakeElapsed = 0;
  private shakeDuration = 0;
  private shakeEnergy = 0;
  private burstCursor = 0;
  private readonly liquidOffset = new THREE.Vector3();
  private readonly liquidVelocity = new THREE.Vector3();
  private readonly inputImpulse = new THREE.Vector3();
  private readonly effectRandom = seededRandom(0x51a9);
  private lastWidth = 1440;
  private lastHeight = 900;
  private readonly handleResize = (): void => this.resize();
  private readonly handleAnimationFrame = (time: number): void => this.animate(time);
  private readonly handlePointerDown = (event: PointerEvent): void => this.pointerDown(event);
  private readonly handlePointerMove = (event: PointerEvent): void => this.pointerMove(event);
  private readonly handlePointerUp = (event: PointerEvent): void => this.pointerUp(event);
  private readonly handlePointerCancel = (event: PointerEvent): void => this.pointerCancel(event);
  private readonly handleKeyDown = (event: KeyboardEvent): void => this.keyDown(event);

  public constructor(container: HTMLElement, reducedMotion: boolean) {
    this.container = container;
    this.reducedMotion = reducedMotion;
    this.scene.background = new THREE.Color(0x030405);
    this.scene.environment = this.materials.environment;
    this.scene.environmentIntensity = 0.48;
    this.scene.fog = new THREE.Fog(0x050608, 9, 22);
    this.scene.add(this.globeRoot);
    this.globeRoot.add(this.globeBody);
    this.globeBody.add(this.motionRoot, this.particleRoot);
    this.globeBody.name = "globe body tilt and settle";
    this.motionRoot.name = "fixed interior world inside globe";
    this.particleRoot.name = "liquid lag particle field";
    this.buildBackdrop();
    this.buildLighting();
    this.buildBase();
    this.buildInterior();
    this.buildParticles();
    this.buildGlass();
    this.resizeObserver = new ResizeObserver(this.handleResize);
  }

  public async init(): Promise<SnowGlobeVisualSceneInitResult> {
    try {
      const renderer = new WebGPURenderer({ antialias: true, alpha: false });
      await renderer.init();
      if (this.disposed) {
        renderer.dispose();
        return { ready: false, errorMessage: "表示準備中に画面が閉じられました。" };
      }

      this.renderer = renderer;
      renderer.outputColorSpace = THREE.SRGBColorSpace;
      renderer.toneMapping = THREE.ACESFilmicToneMapping;
      renderer.toneMappingExposure = 1.32;
      renderer.shadowMap.enabled = true;
      renderer.shadowMap.type = THREE.VSMShadowMap;
      renderer.domElement.setAttribute("aria-hidden", "true");
      renderer.domElement.setAttribute("role", "presentation");
      renderer.domElement.style.display = "block";
      renderer.domElement.style.width = "100%";
      renderer.domElement.style.height = "100%";
      renderer.domElement.style.touchAction = "none";
      renderer.domElement.style.cursor = "grab";
      renderer.domElement.addEventListener("pointerdown", this.handlePointerDown);
      renderer.domElement.addEventListener("pointermove", this.handlePointerMove);
      renderer.domElement.addEventListener("pointerup", this.handlePointerUp);
      renderer.domElement.addEventListener("pointercancel", this.handlePointerCancel);
      this.container.appendChild(renderer.domElement);
      this.resizeObserver.observe(this.container);
      window.addEventListener("resize", this.handleResize, { passive: true });
      window.addEventListener("keydown", this.handleKeyDown);
      document.addEventListener("visibilitychange", this.handleVisibility, { passive: true });
      this.resize();
      this.renderOnce();
      if (!this.reducedMotion) {
        this.startAnimationLoop();
      }
      return { ready: true };
    } catch (error: unknown) {
      return {
        ready: false,
        errorMessage: error instanceof Error ? error.message : "WebGPUの静止画レンダーを開始できませんでした。",
      };
    }
  }

  public setReducedMotion(enabled: boolean): void {
    this.reducedMotion = enabled;
    if (this.reducedMotion && this.shakeElapsed <= 0 && !this.dragging) {
      this.stopAnimationLoop();
      this.renderOnce();
      return;
    }
    this.startAnimationLoop();
  }

  public shake(): void {
    this.beginShake(new THREE.Vector3(0.84, 0.48, 0.22));
  }

  public dispose(): void {
    if (this.disposed) {
      return;
    }
    this.disposed = true;
    this.stopAnimationLoop();
    this.resizeObserver.disconnect();
    window.removeEventListener("resize", this.handleResize);
    window.removeEventListener("keydown", this.handleKeyDown);
    document.removeEventListener("visibilitychange", this.handleVisibility);
    const renderer = this.renderer;
    renderer?.domElement.removeEventListener("pointerdown", this.handlePointerDown);
    renderer?.domElement.removeEventListener("pointermove", this.handlePointerMove);
    renderer?.domElement.removeEventListener("pointerup", this.handlePointerUp);
    renderer?.domElement.removeEventListener("pointercancel", this.handlePointerCancel);
    if (renderer?.domElement.parentElement === this.container) {
      this.container.removeChild(renderer.domElement);
    }
    disposeSceneResources(this.scene, this.materials);
    renderer?.dispose();
    this.renderer = null;
  }

  private readonly handleVisibility = (): void => {
    if (this.disposed || !this.renderer) {
      return;
    }
    if (document.visibilityState === "hidden") {
      this.stopAnimationLoop();
      return;
    }
    this.renderOnce();
    if (!this.reducedMotion || this.shakeElapsed > 0 || this.dragging) {
      this.startAnimationLoop();
    }
  };

  private buildBackdrop(): void {
    const backdrop = addMesh(
      this.scene,
      new THREE.PlaneGeometry(32, 18),
      this.materials.backdrop,
      [0, 6.2, -7.4],
    );
    backdrop.renderOrder = -10;

    const floor = addMesh(
      this.scene,
      new THREE.PlaneGeometry(32, 32),
      this.materials.floor,
      [0, -0.04, 0],
    );
    floor.rotation.x = -Math.PI / 2;
    floor.receiveShadow = true;
  }

  private buildLighting(): void {
    const hemisphere = new THREE.HemisphereLight(0xb9c6d3, 0x0a0b0d, 0.95);
    this.scene.add(hemisphere);

    const key = new THREE.DirectionalLight(0xc4d1de, 3.2);
    key.position.set(-4.6, 8.6, 6.8);
    key.target.position.set(0, 2.45, 0);
    key.castShadow = true;
    key.shadow.mapSize.set(2048, 2048);
    key.shadow.camera.near = 0.5;
    key.shadow.camera.far = 26;
    key.shadow.camera.left = -6;
    key.shadow.camera.right = 6;
    key.shadow.camera.top = 8;
    key.shadow.camera.bottom = -2;
    key.shadow.bias = -0.00035;
    key.shadow.normalBias = 0.025;
    this.scene.add(key, key.target);

    const softKey = new THREE.SpotLight(0xd5e0e8, 6.4, 16, Math.PI / 5, 0.82, 1.15);
    softKey.position.set(-4.3, 5.6, 5.3);
    softKey.lookAt(0, 2.65, 0);
    this.scene.add(softKey);

    const rim = new THREE.SpotLight(0x9aafc2, 4.6, 15, Math.PI / 7, 0.64, 1.35);
    rim.position.set(4.8, 6.4, -4.6);
    rim.target.position.set(0.35, 3.2, 0);
    this.scene.add(rim, rim.target);

    const fill = new THREE.PointLight(0x9aabb9, 2.1, 12, 1.7);
    fill.position.set(-4.5, 2.3, 4.2);
    this.scene.add(fill);

    const baseFill = new THREE.SpotLight(0xa9bac6, 1.85, 9, Math.PI / 4.2, 0.8, 1.45);
    baseFill.position.set(1.2, 3.7, 4.4);
    baseFill.target.position.set(0.1, 0.55, 0);
    this.scene.add(baseFill, baseFill.target);
  }

  private buildBase(): void {
    const base = markShadow(addMesh(this.globeBody, createBaseProfile(), this.materials.walnut), true, true);
    base.name = "dark walnut lathed base";

    const lowerShadowRing = markShadow(
      addMesh(
        this.globeBody,
        new THREE.TorusGeometry(2.08, 0.055, 12, 96),
        this.materials.walnutDark,
        [0, 0.25, 0],
      ),
      true,
      true,
    );
    lowerShadowRing.rotation.x = Math.PI / 2;

    const shoulderRing = addMesh(
      this.globeBody,
      new THREE.TorusGeometry(2.01, 0.035, 12, 96),
      this.materials.walnutDark,
      [0, 0.83, 0],
    );
    shoulderRing.rotation.x = Math.PI / 2;

    const brassRing = addMesh(
      this.globeBody,
      new THREE.TorusGeometry(1.84, 0.026, 12, 96),
      this.materials.brass,
      [0, 0.98, 0],
    );
    brassRing.rotation.x = Math.PI / 2;
    brassRing.castShadow = true;

    const topInset = markShadow(
      addMesh(
        this.globeBody,
        new THREE.CylinderGeometry(1.72, 1.72, 0.1, 96),
        this.materials.walnutDark,
        [0, 1.0, 0],
      ),
      false,
      true,
    );
    topInset.name = "base top inset";
  }

  private buildInterior(): void {
    const terrain = markShadow(
      addMesh(this.motionRoot, createTerrainGeometry(2.8), this.materials.snow, [0, 0, 0]),
      false,
      true,
    );
    terrain.name = "rolling snow terrain";

    const rearMound = markShadow(
      addMesh(
        this.motionRoot,
        createSnowMoundGeometry(),
        this.materials.snowShadow,
        [0.05, 1.0, -1.33],
      ),
      false,
      true,
    );
    rearMound.scale.set(2.05, 0.38, 0.74);

    const foregroundMound = markShadow(
      addMesh(
        this.motionRoot,
        createSnowMoundGeometry(),
        this.materials.snowShadow,
        [-0.08, 1.0, 0.56],
      ),
      false,
      true,
    );
    foregroundMound.scale.set(1.22, 0.2, 0.55);

    const groundSnowZones = [
      { position: [-0.96, 1.1, 0.58] as const, scale: [0.62, 0.05, 0.24] as const, rotation: 0.12 },
      { position: [0.86, 1.1, 0.48] as const, scale: [0.52, 0.045, 0.2] as const, rotation: -0.32 },
      { position: [0.34, 1.16, -1.08] as const, scale: [0.74, 0.05, 0.22] as const, rotation: 0.58 },
    ];
    groundSnowZones.forEach(({ position, scale, rotation }) => {
      const patch = markShadow(
        addMesh(this.motionRoot, createSnowPatchGeometry(), this.materials.snow, position),
        false,
        true,
      );
      patch.name = "localized ground snow accumulation";
      patch.scale.set(scale[0], scale[1], scale[2]);
      patch.rotation.y = rotation;
      this.registerAccumulation(patch);
    });

    const cabin = new THREE.Group();
    cabin.position.set(-0.58, 1.03, 0.16);
    this.motionRoot.add(cabin);
    this.buildCabin(cabin);

    this.buildTree({
      position: new THREE.Vector3(0.68, 1.02, -0.08),
      height: 2.95,
      width: 1.82,
      material: this.materials.treeHero,
      tierCount: 6,
      seed: 0x109,
      hero: true,
    });
    this.buildTree({
      position: new THREE.Vector3(-1.12, 1.01, -0.82),
      height: 1.82,
      width: 1.18,
      material: this.materials.treeDeep,
      tierCount: 4,
      seed: 0x20b,
    });
    this.buildTree({
      position: new THREE.Vector3(1.32, 1.0, -0.92),
      height: 1.56,
      width: 1.04,
      material: this.materials.treePale,
      tierCount: 4,
      seed: 0x30d,
    });

    const suspendedSnow = [
      [0.06, 2.08, 0.56, 0.028],
      [-0.78, 3.15, 0.22, 0.022],
      [0.98, 2.72, -0.26, 0.024],
      [-0.28, 4.12, -0.42, 0.018],
      [0.54, 3.72, 0.42, 0.016],
    ] as const;
    suspendedSnow.forEach(([x, y, z, size]) => {
      const fleck = addMesh(
        this.motionRoot,
        new THREE.IcosahedronGeometry(size, 1),
        this.materials.snow,
        [x, y, z],
      );
      fleck.name = "static suspended snow fleck";
      fleck.castShadow = false;
      fleck.receiveShadow = false;
    });
  }

  private registerAccumulation(mesh: THREE.Mesh): void {
    const bounds = new THREE.Box3().setFromObject(mesh);
    const anchor = bounds.getCenter(new THREE.Vector3());
    anchor.y = bounds.max.y - Math.max(0.015, (bounds.max.y - bounds.min.y) * 0.12);
    this.globeBody.worldToLocal(anchor);
    this.accumulationZones.push({
      mesh,
      anchor,
      baseScale: mesh.scale.clone(),
      amount: 1,
    });
  }

  private buildParticles(): void {
    const random = seededRandom(0x7a11);
    const snowMesh = new THREE.InstancedMesh(
      new THREE.IcosahedronGeometry(1, 1),
      this.materials.particleSnow,
      420,
    );
    snowMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    snowMesh.frustumCulled = false;
    snowMesh.renderOrder = 4;
    this.snowMesh = snowMesh;
    this.particleRoot.add(snowMesh);

    for (let index = 0; index < 420; index += 1) {
      const quietFleck = index < 12;
      const position = new THREE.Vector3(
        (random() - 0.5) * (quietFleck ? 2.5 : 3.55),
        quietFleck ? 2.2 + random() * 2.25 : 1.34 + random() * 3.58,
        (random() - 0.5) * (quietFleck ? 2.1 : 3.0),
      );
      this.snowParticles.push({
        position,
        home: position.clone(),
        velocity: new THREE.Vector3(),
        phase: random() * Math.PI * 2,
        size: 0.009 + random() * 0.015 + (random() > 0.9 ? 0.012 : 0),
        burstAge: 0,
        zoneIndex: -1,
        isBurst: false,
      });
    }

    const glitterMesh = new THREE.InstancedMesh(
      new THREE.OctahedronGeometry(1, 0),
      this.materials.glitter,
      88,
    );
    glitterMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    glitterMesh.frustumCulled = false;
    glitterMesh.renderOrder = 6;
    this.glitterMesh = glitterMesh;
    this.particleRoot.add(glitterMesh);

    for (let index = 0; index < 88; index += 1) {
      this.glitterParticles.push({
        position: new THREE.Vector3(
          (random() - 0.5) * 3.7,
          1.52 + random() * 3.5,
          (random() - 0.5) * 3.1,
        ),
        phase: random() * Math.PI * 2,
        speed: 0.42 + random() * 1.2,
        size: 0.012 + random() * 0.018,
      });
    }

    this.setParticleQuality(this.lastWidth);
    this.updateParticleMatrices(0);
  }

  private setParticleQuality(width: number): void {
    const mobile = width < 640;
    const compact = width < 1100;
    this.particleCount = mobile ? 180 : compact ? 270 : 420;
    this.glitterCount = mobile ? 34 : compact ? 58 : 88;
    this.ambientSnowCount = mobile ? 2 : compact ? 3 : 5;
    this.ambientGlitterCount = mobile ? 6 : compact ? 8 : 12;
    if (this.snowMesh) {
      this.snowMesh.count = this.particleCount;
    }
    if (this.glitterMesh) {
      this.glitterMesh.count = this.glitterCount;
    }
  }

  private startAnimationLoop(): void {
    if (!this.renderer || this.disposed || this.animationRunning) {
      return;
    }
    this.animationRunning = true;
    this.lastFrameTime = 0;
    this.renderer.setAnimationLoop(this.handleAnimationFrame);
  }

  private stopAnimationLoop(): void {
    if (!this.animationRunning) {
      return;
    }
    this.renderer?.setAnimationLoop(null);
    this.animationRunning = false;
    this.lastFrameTime = 0;
  }

  private animate(time: number): void {
    if (!this.renderer || this.disposed) {
      return;
    }
    const delta = this.lastFrameTime === 0
      ? 1 / 60
      : THREE.MathUtils.clamp((time - this.lastFrameTime) / 1000, 0.001, 0.05);
    this.lastFrameTime = time;
    this.animationTime += delta;
    this.updateMotion(delta);
    this.updateSnowParticles(delta, this.animationTime);
    this.updateAccumulation();
    this.updateParticleMatrices(this.animationTime);
    this.renderOnce();

    if (
      this.reducedMotion
      && this.shakeElapsed <= 0
      && !this.dragging
      && Math.abs(this.globeYawVelocity) < 0.004
      && Math.abs(this.globePitchVelocity) < 0.004
      && Math.abs(this.globeRollVelocity) < 0.004
    ) {
      this.stopAnimationLoop();
      this.renderOnce();
    }
  }

  private updateMotion(delta: number): void {
    if (!this.dragging) {
      this.globeYaw += this.globeYawVelocity * delta;
      this.globePitch = THREE.MathUtils.clamp(
        this.globePitch + this.globePitchVelocity * delta,
        -0.12,
        0.12,
      );
      this.globeRoll += this.globeRollVelocity * delta;
      const damping = Math.exp(-(this.reducedMotion ? 8.5 : 2.8) * delta);
      this.globeYawVelocity *= damping;
      this.globePitchVelocity *= damping;
      this.globeRollVelocity *= damping;
    }
    this.globeYaw = THREE.MathUtils.clamp(this.globeYaw, -0.22, 0.22);
    this.globePitch = THREE.MathUtils.clamp(this.globePitch, -0.12, 0.12);
    this.globeRoll = THREE.MathUtils.clamp(this.globeRoll, -0.07, 0.07);

    const impulseDamping = Math.exp(-(this.reducedMotion ? 6.4 : 3.6) * delta);
    this.inputImpulse.multiplyScalar(impulseDamping);
    const liquidTarget = new THREE.Vector3(
      this.inputImpulse.x * 0.42,
      this.inputImpulse.y * 0.28,
      -this.inputImpulse.x * 0.16,
    );
    this.liquidVelocity.lerp(liquidTarget, 1 - Math.exp(-3.2 * delta));
    this.liquidOffset.addScaledVector(this.liquidVelocity, delta);
    this.liquidOffset.multiplyScalar(Math.exp(-1.25 * delta));
    this.particleRoot.position.set(
      this.liquidOffset.x * 0.18,
      THREE.MathUtils.clamp(this.liquidOffset.y * 0.12, -0.015, 0.025),
      this.liquidOffset.z * 0.12,
    );
    this.particleRoot.rotation.set(
      this.liquidOffset.y * 0.08,
      this.liquidOffset.x * 0.06,
      this.liquidOffset.x * 0.11,
    );

    let shakePitch = 0;
    let shakeYaw = 0;
    let shakeRoll = 0;
    let bodyShiftX = 0;
    let bodyShiftY = 0;
    if (this.shakeDuration > 0) {
      this.shakeElapsed += delta;
      const progress = THREE.MathUtils.clamp(this.shakeElapsed / this.shakeDuration, 0, 1);
      const envelope = Math.sin(Math.PI * progress) ** 0.72 * (1 - progress * 0.52) * this.shakeEnergy;
      const phase = progress * Math.PI * 9;
      shakePitch = Math.sin(phase * 1.08) * envelope * 0.024;
      shakeYaw = Math.sin(phase * 0.92 + 0.7) * envelope * 0.032;
      shakeRoll = Math.cos(phase * 0.84) * envelope * 0.028;
      bodyShiftX = Math.sin(phase * 1.08) * envelope * 0.018;
      bodyShiftY = Math.sin(phase * 0.92 + 0.7) * envelope * 0.012;
      if (progress >= 1) {
        this.shakeElapsed = 0;
        this.shakeDuration = 0;
        this.shakeEnergy = 0;
      }
    }
    this.globeBody.position.set(
      THREE.MathUtils.clamp(this.inputImpulse.x * 0.008 + bodyShiftX, -0.026, 0.026),
      THREE.MathUtils.clamp(this.inputImpulse.y * 0.005 + bodyShiftY, -0.018, 0.018),
      0,
    );
    this.globeBody.rotation.set(
      THREE.MathUtils.clamp(this.globePitch + shakePitch, -0.14, 0.14),
      THREE.MathUtils.clamp(this.globeYaw + shakeYaw, -0.24, 0.24),
      THREE.MathUtils.clamp(this.globeRoll + shakeRoll, -0.07, 0.07),
    );
    this.motionRoot.rotation.set(0, 0, 0);
  }

  private updateSnowParticles(delta: number, time: number): void {
    const ceiling = 5.16;
    const floor = 1.08;
    const gravity = this.reducedMotion ? 0.42 : 0.88;
    const flowX = this.liquidVelocity.x * 0.62;
    const flowZ = this.liquidVelocity.z * 0.62;

    for (let index = 0; index < this.particleCount; index += 1) {
      const particle = this.snowParticles[index];
      if (particle.isBurst) {
        particle.burstAge += delta;
        particle.velocity.y -= gravity * (particle.burstAge < 0.28 ? 0.72 : 1.7) * delta;
        particle.velocity.x += flowX * delta;
        particle.velocity.z += flowZ * delta;
        particle.velocity.multiplyScalar(Math.exp(-0.28 * delta));
        particle.position.addScaledVector(particle.velocity, delta);
        if (particle.position.y > ceiling) {
          particle.position.y = ceiling;
          particle.velocity.y *= -0.24;
        }
        if (particle.position.y <= floor || particle.burstAge >= (this.reducedMotion ? 0.95 : 2.4)) {
          if (particle.zoneIndex >= 0 && particle.zoneIndex < this.accumulationZones.length) {
            const zone = this.accumulationZones[particle.zoneIndex];
            zone.amount = Math.min(1, zone.amount + 0.08);
            particle.position.copy(zone.anchor);
          } else {
            particle.position.copy(particle.home);
          }
          particle.velocity.set(0, 0, 0);
          particle.zoneIndex = -1;
          particle.isBurst = false;
          particle.burstAge = 0;
        }
        continue;
      }

      particle.position.copy(particle.home);
      particle.velocity.set(0, 0, 0);
      if (index < this.ambientSnowCount) {
        particle.position.x += Math.sin(time * 0.16 + particle.phase) * 0.004;
        particle.position.z += Math.cos(time * 0.13 + particle.phase) * 0.003;
      }
    }
  }

  private updateParticleMatrices(time: number): void {
    if (this.snowMesh) {
      const burstScale = this.lastWidth < 640 ? 2.1 : 1.42;
      for (let index = 0; index < this.particleCount; index += 1) {
        const particle = this.snowParticles[index];
        const visible = particle.isBurst || index < this.ambientSnowCount;
        const scale = visible
          ? particle.size * (particle.isBurst ? burstScale : 0.72)
          : 0.0001;
        this.particleDummy.position.copy(particle.position);
        this.particleDummy.rotation.set(
          time * (0.28 + particle.phase * 0.02),
          time * (0.18 + particle.phase * 0.01),
          particle.phase,
        );
        this.particleDummy.scale.setScalar(scale);
        this.particleDummy.updateMatrix();
        this.snowMesh.setMatrixAt(index, this.particleDummy.matrix);
      }
      this.snowMesh.instanceMatrix.needsUpdate = true;
    }

    if (this.glitterMesh) {
      const heroPulse = this.shakeDuration > 0
        ? Math.exp(-((this.shakeElapsed - 0.48) ** 2) / 0.018) * this.shakeEnergy
        : 0;
      this.materials.glitter.opacity = 0.16 + heroPulse * 0.3;
      for (let index = 0; index < this.glitterCount; index += 1) {
        const glitter = this.glitterParticles[index];
        const pulse = Math.max(0, Math.sin(time * glitter.speed + glitter.phase));
        const glint = pulse ** 12;
        const visible = this.shakeDuration > 0 || index < this.ambientGlitterCount;
        const scale = visible
          ? glitter.size * (0.2 + glint * (0.95 + heroPulse * 2))
          : 0.0001;
        this.glitterDummy.position.copy(glitter.position);
        this.glitterDummy.rotation.set(0, 0, glitter.phase + time * glitter.speed * 0.16);
        this.glitterDummy.scale.setScalar(scale);
        this.glitterDummy.updateMatrix();
        this.glitterMesh.setMatrixAt(index, this.glitterDummy.matrix);
      }
      this.glitterMesh.instanceMatrix.needsUpdate = true;
    }
  }

  private updateAccumulation(): void {
    this.accumulationZones.forEach((zone) => {
      const amount = THREE.MathUtils.clamp(zone.amount, 0.04, 1);
      zone.mesh.visible = amount > 0.045;
      zone.mesh.scale.set(
        zone.baseScale.x,
        zone.baseScale.y * amount,
        zone.baseScale.z,
      );
    });
  }

  private beginShake(impulse: THREE.Vector3): void {
    if (this.disposed) {
      return;
    }
    this.shakeElapsed = 0;
    this.shakeDuration = this.reducedMotion ? 0.95 : 2.6;
    this.shakeEnergy = THREE.MathUtils.clamp(this.shakeEnergy + impulse.length() * 0.58, 0.72, 1.45);
    this.inputImpulse.add(impulse);
    this.globeYawVelocity += impulse.x * 0.045;
    this.globePitchVelocity -= impulse.y * 0.028;
    this.globeRollVelocity += impulse.x * 0.06;
    this.releaseAccumulation();
    this.startAnimationLoop();
  }

  private releaseAccumulation(): void {
    if (this.accumulationZones.length === 0 || this.snowParticles.length === 0) {
      return;
    }
    const releaseLimit = Math.floor(this.particleCount * 0.72);
    let releasedCount = 0;
    for (let zoneIndex = 0; zoneIndex < this.accumulationZones.length; zoneIndex += 1) {
      if (releasedCount >= releaseLimit) {
        break;
      }
      const zone = this.accumulationZones[zoneIndex];
      if (zone.amount <= 0.08) {
        continue;
      }
      zone.amount *= 0.4 + this.effectRandom() * 0.1;
      for (let release = 0; release < 2 && releasedCount < releaseLimit; release += 1) {
        let particle: SnowParticle | null = null;
        for (let attempt = 0; attempt < this.snowParticles.length; attempt += 1) {
          const candidate = this.snowParticles[this.burstCursor % this.snowParticles.length];
          this.burstCursor += 1;
          if (!candidate.isBurst) {
            particle = candidate;
            break;
          }
        }
        if (!particle) {
          continue;
        }
        particle.position.copy(zone.anchor);
        particle.position.x += (this.effectRandom() - 0.5) * 0.22;
        particle.position.y += this.effectRandom() * 0.08;
        particle.position.z += (this.effectRandom() - 0.5) * 0.18;
        particle.velocity.set(
          (this.effectRandom() - 0.5) * 0.48 + this.inputImpulse.x * 0.3,
          0.8 + this.effectRandom() * 0.9,
          (this.effectRandom() - 0.5) * 0.42 + this.inputImpulse.z * 0.2,
        );
        particle.zoneIndex = zoneIndex;
        particle.burstAge = 0;
        particle.isBurst = true;
        releasedCount += 1;
      }
    }
  }

  private pointerDown(event: PointerEvent): void {
    if (this.disposed || this.pointerId !== null) {
      return;
    }
    this.pointerId = event.pointerId;
    this.dragging = true;
    this.pointerMoved = false;
    this.dragStartedAt = performance.now();
    this.pointerLastTime = this.dragStartedAt;
    this.pointerStart.set(event.clientX, event.clientY);
    this.pointerLast.copy(this.pointerStart);
    this.pointerVelocity.set(0, 0);
    this.renderer?.domElement.setPointerCapture(event.pointerId);
    this.renderer?.domElement.style.setProperty("cursor", "grabbing");
    this.startAnimationLoop();
  }

  private pointerMove(event: PointerEvent): void {
    if (!this.dragging || this.pointerId !== event.pointerId) {
      return;
    }
    const now = performance.now();
    const deltaSeconds = Math.max(0.008, (now - this.pointerLastTime) / 1000);
    this.pointerLastTime = now;
    const deltaX = event.clientX - this.pointerLast.x;
    const deltaY = event.clientY - this.pointerLast.y;
    this.pointerLast.set(event.clientX, event.clientY);
    this.pointerVelocity.set(deltaX / deltaSeconds, deltaY / deltaSeconds);
    if (this.pointerStart.distanceTo(this.pointerLast) > 5) {
      this.pointerMoved = true;
    }
    this.globeYaw = THREE.MathUtils.clamp(this.globeYaw + deltaX * 0.0007, -0.18, 0.18);
    this.globePitch = THREE.MathUtils.clamp(this.globePitch - deltaY * 0.00065, -0.1, 0.1);
    this.globeYawVelocity = this.pointerVelocity.x * 0.00016;
    this.globePitchVelocity = -this.pointerVelocity.y * 0.00012;
    this.globeRollVelocity = -this.pointerVelocity.x * 0.00004;
    this.inputImpulse.x += deltaX * 0.0012;
    this.inputImpulse.y -= deltaY * 0.0008;
    this.startAnimationLoop();
  }

  private pointerUp(event: PointerEvent): void {
    if (this.pointerId !== event.pointerId) {
      return;
    }
    const speed = this.pointerVelocity.length();
    const duration = performance.now() - this.dragStartedAt;
    const impulse = new THREE.Vector3(
      THREE.MathUtils.clamp(this.pointerVelocity.x * 0.00165, -1.2, 1.2),
      THREE.MathUtils.clamp(-this.pointerVelocity.y * 0.00125, -0.85, 0.85),
      THREE.MathUtils.clamp(Math.abs(this.pointerVelocity.x) * 0.00042, 0, 0.32),
    );
    this.dragging = false;
    this.pointerId = null;
    const element = this.renderer?.domElement;
    if (element?.hasPointerCapture(event.pointerId)) {
      element.releasePointerCapture(event.pointerId);
    }
    this.renderer?.domElement.style.setProperty("cursor", "grab");
    if (!this.pointerMoved || (speed < 70 && duration < 420)) {
      this.beginShake(new THREE.Vector3(0.84, 0.48, 0.22));
    } else if (speed > 260) {
      this.beginShake(impulse);
    } else {
      this.startAnimationLoop();
    }
  }

  private pointerCancel(event: PointerEvent): void {
    if (this.pointerId !== event.pointerId) {
      return;
    }
    this.dragging = false;
    this.pointerId = null;
    this.renderer?.domElement.style.setProperty("cursor", "grab");
    this.startAnimationLoop();
  }

  private keyDown(event: KeyboardEvent): void {
    if (event.target instanceof HTMLButtonElement) {
      return;
    }
    if (event.code === "Space") {
      event.preventDefault();
      this.shake();
      return;
    }
    if (event.code === "ArrowLeft" || event.code === "ArrowRight") {
      event.preventDefault();
      this.globeYaw = THREE.MathUtils.clamp(
        this.globeYaw + (event.code === "ArrowLeft" ? -0.035 : 0.035),
        -0.18,
        0.18,
      );
      this.globeYawVelocity = event.code === "ArrowLeft" ? -0.015 : 0.015;
      this.startAnimationLoop();
    }
  }

  private buildCabin(cabin: THREE.Group): void {
    const foundation = markShadow(
      addBox(cabin, this.materials.stone, [1.74, 0.14, 1.14], [0, 0.09, 0]),
      true,
      true,
    );
    foundation.name = "small cabin foundation";

    const walls = markShadow(
      addBox(cabin, this.materials.cabinWood, [1.66, 0.98, 1.06], [0, 0.62, 0]),
      true,
      true,
    );
    walls.name = "thick timber cabin walls";

    const courseHeights = [0.25, 0.43, 0.61, 0.79, 0.97];
    courseHeights.forEach((height, index) => {
      const frontCourse = addBox(
        cabin,
        this.materials.cabinWoodDark,
        [1.42 - (index % 2) * 0.05, 0.026, 0.035],
        [0, height, 0.55],
      );
      frontCourse.castShadow = true;
      const sideCourse = addBox(
        cabin,
        this.materials.cabinWoodDark,
        [0.035, 0.026, 0.86 - (index % 2) * 0.05],
        [0.84, height, 0],
      );
      sideCourse.castShadow = true;

      const frontLog = markShadow(
        addMesh(
          cabin,
          new THREE.CylinderGeometry(0.075, 0.09, 1.5 - (index % 2) * 0.05, 8),
          this.materials.cabinWood,
          [0, height, 0.55],
        ),
        true,
        true,
      );
      frontLog.rotation.z = Math.PI / 2;
      const sideLog = markShadow(
        addMesh(
          cabin,
          new THREE.CylinderGeometry(0.075, 0.09, 0.9 - (index % 2) * 0.04, 8),
          this.materials.cabinWood,
          [0.84, height, 0],
        ),
        true,
        true,
      );
      sideLog.rotation.x = Math.PI / 2;
    });

    [-0.78, 0.78].forEach((x) => {
      markShadow(addBox(cabin, this.materials.cabinWoodDark, [0.12, 1.12, 0.12], [x, 0.62, 0.53]));
    });
    [-0.51, 0.51].forEach((z) => {
      markShadow(addBox(cabin, this.materials.cabinWoodDark, [1.54, 0.12, 0.1], [0, 1.1, z]));
    });

    const gable = markShadow(
      addMesh(cabin, createGableGeometry(1.66, 0.62, 1.06), this.materials.cabinWood, [0, 1.1, 0]),
      true,
      true,
    );
    gable.name = "extruded front gable";

    const leftRoof = markShadow(
      addMesh(
        cabin,
        createSlopedSlabGeometry(
          new THREE.Vector2(-0.97, 1.11),
          new THREE.Vector2(0, 1.78),
          1.38,
          0.16,
        ),
        this.materials.roof,
        [0, 0, 0],
      ),
      true,
      true,
    );
    const rightRoof = markShadow(
      addMesh(
        cabin,
        createSlopedSlabGeometry(
          new THREE.Vector2(0.97, 1.11),
          new THREE.Vector2(0, 1.78),
          1.38,
          0.16,
        ),
        this.materials.roof,
        [0, 0, 0],
      ),
      true,
      true,
    );
    leftRoof.name = "left roof slab with eave";
    rightRoof.name = "right roof slab with eave";

    const leftSnow = markShadow(
      addMesh(
        cabin,
        createSlopedSlabGeometry(
          new THREE.Vector2(-0.98, 1.2),
          new THREE.Vector2(0, 1.82),
          1.3,
          0.1,
        ),
        this.materials.snow,
        [0, 0, 0.01],
      ),
      false,
      true,
    );
    const rightSnow = markShadow(
      addMesh(
        cabin,
        createSlopedSlabGeometry(
          new THREE.Vector2(0.98, 1.2),
          new THREE.Vector2(0, 1.82),
          1.3,
          0.1,
        ),
        this.materials.snow,
        [0, 0, 0.01],
      ),
      false,
      true,
    );
    leftSnow.name = "drifted left roof snow";
    rightSnow.name = "drifted right roof snow";
    this.registerAccumulation(leftSnow);
    this.registerAccumulation(rightSnow);

    [-1, 1].forEach((side) => {
      const eave = addBox(cabin, this.materials.cabinWoodDark, [0.09, 0.11, 1.48], [side * 0.93, 1.11, 0]);
      eave.castShadow = true;
      const snowOverhang = markShadow(
        addMesh(
          cabin,
          createSnowEaveGeometry(1.05, 0.16, 0.1),
          this.materials.snow,
          [side * 0.97, 1.17, 0],
        ),
        false,
        true,
      );
      snowOverhang.name = "rounded eave snow load";
    });

    const windowRecess = addBox(cabin, this.materials.cabinWoodDark, [0.62, 0.5, 0.09], [0.38, 0.66, 0.555]);
    windowRecess.castShadow = true;
    const windowPanel = markShadow(
      addBox(cabin, this.materials.window, [0.43, 0.31, 0.025], [0.38, 0.67, 0.61]),
      false,
      false,
    );
    windowPanel.name = "recessed warm amber window";
    [
      [0.38, 0.67, 0.628, 0.035, 0.36, 0.025],
      [0.38, 0.67, 0.592, 0.42, 0.035, 0.025],
      [0.38, 0.67, 0.648, 0.42, 0.035, 0.025],
      [0.17, 0.67, 0.61, 0.035, 0.34, 0.03],
      [0.59, 0.67, 0.61, 0.035, 0.34, 0.03],
    ].forEach(([x, y, z, width, height, depth]) => {
      addBox(cabin, this.materials.cabinWoodDark, [width, height, depth], [x, y, z]);
    });

    const door = markShadow(addBox(cabin, this.materials.door, [0.4, 0.72, 0.1], [-0.44, 0.53, 0.57]), true, true);
    door.name = "deep timber door";
    addBox(cabin, this.materials.cabinWoodDark, [0.46, 0.06, 0.06], [-0.44, 0.17, 0.63]);
    addBox(cabin, this.materials.cabinWoodDark, [0.46, 0.06, 0.06], [-0.44, 0.89, 0.63]);
    const latch = addMesh(
      cabin,
      new THREE.SphereGeometry(0.035, 10, 8),
      this.materials.brass,
      [-0.28, 0.53, 0.64],
    );
    latch.scale.set(1, 1, 0.45);

    const chimney = markShadow(
      addMesh(cabin, new THREE.CylinderGeometry(0.13, 0.16, 0.52, 8), this.materials.stone, [-0.5, 1.92, -0.24]),
      true,
      true,
    );
    chimney.name = "stone chimney";
    addMesh(cabin, new THREE.CylinderGeometry(0.19, 0.16, 0.09, 8), this.materials.roof, [-0.5, 2.2, -0.24]);

    const practical = new THREE.PointLight(0xffa15b, 2.9, 3.6, 2);
    practical.position.set(0.34, 0.72, 0.42);
    practical.intensity = 4.2;
    practical.castShadow = false;
    cabin.add(practical);
  }

  private buildTree(spec: TreeSpec): void {
    const tree = new THREE.Group();
    tree.position.copy(spec.position);
    this.motionRoot.add(tree);
    const random = seededRandom(spec.seed);
    const trunkHeight = spec.height * 0.83;
    const trunk = markShadow(
      addMesh(tree, new THREE.CylinderGeometry(0.075, 0.14, trunkHeight, 9), this.materials.twig, [0, trunkHeight / 2, 0]),
      true,
      true,
    );
    trunk.name = spec.hero ? "hero tapered trunk" : "secondary tapered trunk";

    for (let tier = 0; tier < spec.tierCount; tier += 1) {
      const progress = tier / Math.max(1, spec.tierCount - 1);
      const y = spec.height * (0.16 + progress * 0.68);
      const tierWidth = spec.width * (0.58 - progress * 0.31) * (0.93 + random() * 0.1);
      const branchCount = spec.hero ? 7 : 5;
      const angleOffset = random() * Math.PI * 2;
      for (let branchIndex = 0; branchIndex < branchCount; branchIndex += 1) {
        const angle = angleOffset + (branchIndex / branchCount) * Math.PI * 2 + (random() - 0.5) * 0.17;
        const branchLength = tierWidth * (0.68 + random() * 0.32);
        const direction = new THREE.Vector3(
          Math.cos(angle),
          (random() - 0.5) * 0.17 - progress * 0.05,
          Math.sin(angle),
        );
        const start = new THREE.Vector3(0, y + (random() - 0.5) * 0.19, 0);
        const branch = markShadow(
          addMesh(
            tree,
            createBranchGeometry(start, direction, branchLength, 0.045 + progress * 0.045, 0.045 - progress * 0.014),
            spec.material,
          ),
          true,
          true,
        );
        branch.name = "irregular radial bough";

        const boughWidth = tierWidth * (0.32 - progress * 0.11);
        const boughRotation = new THREE.Euler(
          0,
          angle,
          -0.08 - progress * 0.13 + (random() - 0.5) * 0.045,
        );
        const foliageBough = markShadow(
          addMesh(
            tree,
            createConiferBoughGeometry(branchLength, boughWidth, 0.16 - progress * 0.045),
            spec.material,
            start,
          ),
          true,
          true,
        );
        foliageBough.name = "layered conifer bough";
        foliageBough.rotation.copy(boughRotation);

        const tipPosition = start.clone().addScaledVector(direction.normalize(), branchLength * 0.52);
        tipPosition.y -= 0.04 + progress * 0.035;
        const foliageTip = markShadow(
          addMesh(
            tree,
            createConiferBoughGeometry(branchLength * 0.48, boughWidth * 0.44, 0.1),
            spec.material,
            tipPosition,
          ),
          true,
          true,
        );
        foliageTip.name = "pointed conifer tip bough";
        foliageTip.rotation.copy(boughRotation);
        foliageTip.rotation.z -= 0.035;

        if (random() > (spec.hero ? 0.48 : 0.58) && tier < spec.tierCount - 1) {
          const snowPosition = start.clone().addScaledVector(direction.normalize(), branchLength * 0.18);
          snowPosition.y += boughWidth * 0.18 + random() * 0.025;
          const snowPatch = markShadow(
            addMesh(
              tree,
              createConiferBoughGeometry(branchLength * 0.58, boughWidth * 0.34, 0.065),
              this.materials.snow,
              snowPosition,
            ),
            false,
            true,
          );
          snowPatch.name = "snow resting on conifer bough";
          snowPatch.rotation.copy(boughRotation);
          snowPatch.rotation.z -= 0.02;
          this.registerAccumulation(snowPatch);
        }

        if (tier > 1 && branchIndex % (spec.hero ? 2 : 3) === 0) {
          const twigStart = start.clone().addScaledVector(direction.normalize(), branchLength * 0.58);
          const twigAngle = angle + (random() > 0.5 ? 0.52 : -0.52);
          const twigDirection = new THREE.Vector3(Math.cos(twigAngle), 0.16, Math.sin(twigAngle));
          const smallTwig = markShadow(
            addMesh(tree, createBranchGeometry(twigStart, twigDirection, branchLength * 0.27, 0.025, 0.024), this.materials.twig),
            true,
            true,
          );
          smallTwig.name = "hero branchlet";
        }
      }
    }

    const crown = markShadow(
      addMesh(
        tree,
        createConiferBoughGeometry(spec.width * 0.26, spec.width * 0.16, 0.12),
        spec.material,
        [0, spec.height * 0.84, 0],
      ),
      true,
      true,
    );
    crown.name = "pointed conifer crown";
    crown.rotation.set(0, random() * Math.PI * 2, -0.22);
    const crownSnow = markShadow(
      addMesh(
        tree,
        createConiferBoughGeometry(spec.width * 0.16, spec.width * 0.08, 0.065),
        this.materials.snow,
        [0, spec.height * 0.88, 0.01],
      ),
      false,
      true,
    );
    crownSnow.name = "snow on pointed crown";
    crownSnow.rotation.copy(crown.rotation);
    this.registerAccumulation(crownSnow);

    const rootMound = markShadow(
      addMesh(tree, createSnowMoundGeometry(), this.materials.snowShadow, [0, 0.035, 0]),
      false,
      true,
    );
    rootMound.scale.set(spec.width * 0.52, 0.075, spec.width * 0.38);
  }

  private buildGlass(): void {
    const glass = addMesh(
      this.globeBody,
      new THREE.SphereGeometry(2.58, 96, 64),
      this.materials.glass,
      [0, 3.16, 0],
    );
    glass.name = "near-colorless physical glass shell";
    glass.renderOrder = 10;
    glass.castShadow = false;
    glass.receiveShadow = false;

    const collar = addMesh(
      this.globeBody,
      new THREE.TorusGeometry(1.79, 0.016, 10, 96),
      this.materials.brass,
      [0, 1.01, 0],
    );
    collar.rotation.x = Math.PI / 2;
    collar.renderOrder = 11;
  }

  private resize(): void {
    if (this.disposed || !this.renderer) {
      return;
    }
    const width = Math.max(1, this.container.clientWidth);
    const height = Math.max(1, this.container.clientHeight);
    this.lastWidth = width;
    this.lastHeight = height;
    this.setParticleQuality(width);
    this.updateParticleMatrices(this.animationTime);
    this.configureCamera(width, height);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.7));
    this.renderer.setSize(width, height, false);
    this.renderOnce();
  }

  private configureCamera(width: number, height: number): void {
    const mobile = width < 640;
    const crop = height < 720 && width / height > 1.35;
    if (mobile) {
      this.camera.fov = 32;
      this.camera.position.set(4.9, 5.05, 16.15);
      this.globeRoot.scale.setScalar(0.72);
      this.globeRoot.position.set(-0.06, 0.1, 0);
      this.camera.lookAt(-0.06, 2.75, 0);
    } else {
      this.camera.fov = crop ? 32.2 : 33.4;
      this.camera.position.set(6.6, 5.18, 13.25);
      this.globeRoot.scale.setScalar(crop ? 0.88 : 0.93);
      this.globeRoot.position.set(crop ? 0.04 : 0.08, 0, 0);
      this.camera.lookAt(crop ? 0.04 : 0.08, 2.78, 0);
    }
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
  }

  private renderOnce(): void {
    if (!this.renderer || this.disposed) {
      return;
    }
    this.renderer.render(this.scene, this.camera);
  }
}
