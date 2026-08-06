import * as THREE from "three";
import { bloom } from "three/addons/tsl/display/BloomNode.js";
import { MeshPhysicalNodeMaterial, MeshStandardNodeMaterial, RenderPipeline, WebGPURenderer } from "three/webgpu";
import {
  emissive,
  float,
  mix,
  mrt,
  normalView,
  output,
  pass,
  positionLocal,
  positionViewDirection,
  smoothstep,
  uniform,
} from "three/tsl";

import {
  createRelicGeometry,
  generateRelicPositions,
} from "./relicGeometry";
import {
  getDrawingBufferSize,
  getQualityProfile,
  normalizePointer,
  smoothPointer,
  type PointerPoint,
  type QualityProfile,
} from "./relicMath";
import {
  getPreset,
  getPresetTransitionDuration,
  interpolatePreset,
  INITIAL_PRESET_ID,
  type RelicPreset,
  type RelicPresetId,
  type Rgb,
  type Vec3Tuple,
} from "./relicPresets";

export type PrismaticRelicSceneOptions = {
  readonly reducedMotion: boolean;
  readonly presetId?: RelicPresetId;
};

export type PrismaticRelicSceneInitResult = {
  readonly webGpuApiAvailable: boolean;
  readonly selectiveBloom: boolean;
};

type VectorUniform = ReturnType<typeof uniform<"vec3", THREE.Vector3>>;

const RELIC_SEED = 903;
const BASE_RELIC_Y = 0.08;
const BASE_RELIC_ROTATION_X = -0.08;
const BASE_RELIC_ROTATION_Z = 0.04;
const ZERO_POINTER: PointerPoint = { x: 0, y: 0 };

function setVectorUniform(uniformNode: VectorUniform, value: Rgb | Vec3Tuple): void {
  uniformNode.value.set(value[0], value[1], value[2]);
}

function setColor(colorValue: THREE.Color, value: Rgb): void {
  colorValue.setRGB(value[0], value[1], value[2]);
}

function addMesh(
  parent: THREE.Object3D,
  geometry: THREE.BufferGeometry,
  material: THREE.Material,
  position: Vec3Tuple = [0, 0, 0],
): THREE.Mesh {
  const mesh = new THREE.Mesh(geometry, material);
  mesh.position.set(position[0], position[1], position[2]);
  parent.add(mesh);
  return mesh;
}

function createGradientMaterial(
  top: VectorUniform,
  middle: VectorUniform,
  bottom: VectorUniform,
): MeshStandardNodeMaterial {
  const material = new MeshStandardNodeMaterial({
    color: 0xffffff,
    roughness: 1,
    metalness: 0,
    side: THREE.DoubleSide,
  });
  const height = positionLocal.y.div(11).add(0.5).clamp(0, 1);
  const lower = mix(bottom, middle, smoothstep(0.05, 0.58, height));
  const gradient = mix(lower, top, smoothstep(0.46, 0.98, height));
  material.colorNode = gradient;
  material.emissiveNode = gradient;
  return material;
}

function createFractureLine(points: readonly Vec3Tuple[], material: THREE.LineBasicMaterial): THREE.Line {
  const geometry = new THREE.BufferGeometry().setFromPoints(
    points.map(([x, y, z]) => new THREE.Vector3(x, y, z)),
  );
  return new THREE.Line(geometry, material);
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

function createParticleGeometry(count: number): THREE.BufferGeometry {
  const positions = new Float32Array(count * 3);
  const relicPositions = generateRelicPositions(191, 2, "outer");
  for (let index = 0; index < count; index += 1) {
    const sourceIndex = (index * 11) % (relicPositions.length / 3);
    const sourceX = relicPositions[sourceIndex * 3] ?? 0;
    const sourceY = relicPositions[sourceIndex * 3 + 1] ?? 0;
    const sourceZ = relicPositions[sourceIndex * 3 + 2] ?? 0;
    const ring = index / Math.max(1, count - 1);
    positions[index * 3] = sourceX * (2.4 + ring * 1.5) + Math.sin(index * 2.7) * 0.8;
    positions[index * 3 + 1] = sourceY * 1.85 + Math.cos(index * 1.9) * 0.55;
    positions[index * 3 + 2] = sourceZ * 1.2 - 1.5 - ring * 1.2;
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  return geometry;
}

export class PrismaticRelicScene {
  private readonly container: HTMLElement;
  private readonly scene = new THREE.Scene();
  private readonly camera = new THREE.PerspectiveCamera(31, 1, 0.1, 100);
  private readonly relicRoot = new THREE.Group();
  private readonly fractureRoot = new THREE.Group();
  private readonly particleRoot = new THREE.Group();
  private readonly shaftRoot = new THREE.Group();
  private readonly pointerUniform = uniform(new THREE.Vector2(0, 0));
  private readonly timeUniform = uniform(0);
  private readonly motionUniform = uniform(0.22);
  private readonly shellColorAUniform = uniform(new THREE.Vector3());
  private readonly shellColorBUniform = uniform(new THREE.Vector3());
  private readonly shellAccentUniform = uniform(new THREE.Vector3());
  private readonly coreColorAUniform = uniform(new THREE.Vector3());
  private readonly coreColorBUniform = uniform(new THREE.Vector3());
  private readonly shellEmissionUniform = uniform(0.06);
  private readonly coreEmissionUniform = uniform(2.7);
  private readonly pointerGlowUniform = uniform(0.8);
  private readonly backgroundTopUniform = uniform(new THREE.Vector3());
  private readonly backgroundMiddleUniform = uniform(new THREE.Vector3());
  private readonly backgroundBottomUniform = uniform(new THREE.Vector3());
  private readonly backgroundPlane: THREE.Mesh;
  private readonly outerMesh: THREE.Mesh;
  private readonly coreMesh: THREE.Mesh;
  private readonly coreAuraMesh: THREE.Mesh;
  private readonly outerMaterial: MeshPhysicalNodeMaterial;
  private readonly coreMaterial: MeshStandardNodeMaterial;
  private readonly outerEdgeMaterial: THREE.LineBasicMaterial;
  private readonly fractureMaterial: THREE.LineBasicMaterial;
  private readonly particleMaterial: THREE.PointsMaterial;
  private readonly shaftMaterials: THREE.MeshBasicMaterial[] = [];
  private readonly floorLight = new THREE.PointLight();
  private readonly keyLight = new THREE.DirectionalLight();
  private readonly rimLight = new THREE.PointLight();
  private readonly coreLight = new THREE.PointLight();
  private readonly backgroundLight = new THREE.HemisphereLight();
  private readonly pedestalMaterial = new THREE.MeshStandardMaterial({
    color: 0x080c1e,
    roughness: 0.32,
    metalness: 0.38,
  });
  private renderer: WebGPURenderer | null = null;
  private renderPipeline: RenderPipeline | null = null;
  private bloomPass: ReturnType<typeof bloom> | null = null;
  private resizeObserver: ResizeObserver | null = null;
  private intersectionObserver: IntersectionObserver | null = null;
  private profile: QualityProfile = getQualityProfile(1440, 900, 1);
  private reducedMotion: boolean;
  private stillMode = false;
  private disposed = false;
  private pageVisible = typeof document === "undefined" || document.visibilityState === "visible";
  private inViewport = true;
  private animationLoopActive = false;
  private lastTime = 0;
  private elapsedSeconds = 0;
  private pointerTarget: PointerPoint = ZERO_POINTER;
  private pointer = new THREE.Vector2();
  private pointerActive = false;
  private currentPreset: RelicPreset;
  private transitionFrom: RelicPreset;
  private transitionTo: RelicPreset;
  private transitionStart = 0;
  private transitionDuration = 0;
  private presetId: RelicPresetId;
  private readonly handleResize = (): void => this.resize();
  private readonly handleVisibility = (): void => {
    this.pageVisible = document.visibilityState === "visible";
    this.lastTime = 0;
    this.updateLoopState();
  };
  private readonly handlePointerMove = (event: PointerEvent): void => {
    if (this.disposed || this.stillMode || !this.renderer) {
      return;
    }
    const rect = this.renderer.domElement.getBoundingClientRect();
    this.pointerTarget = normalizePointer(event.clientX, event.clientY, {
      left: rect.left,
      top: rect.top,
      width: rect.width,
      height: rect.height,
    });
    this.pointerActive = true;
    this.updateLoopState();
  };
  private readonly handlePointerLeave = (): void => {
    this.pointerTarget = ZERO_POINTER;
    this.pointerActive = false;
    this.updateLoopState();
  };
  private readonly render = (time: number): void => this.renderFrame(time);

  public constructor(container: HTMLElement, options: PrismaticRelicSceneOptions) {
    this.container = container;
    this.reducedMotion = options.reducedMotion;
    this.presetId = options.presetId ?? INITIAL_PRESET_ID;
    this.currentPreset = getPreset(this.presetId);
    this.transitionFrom = this.currentPreset;
    this.transitionTo = this.currentPreset;
    this.outerMaterial = this.createOuterMaterial();
    this.coreMaterial = this.createCoreMaterial();
    this.backgroundPlane = addMesh(
      this.scene,
      new THREE.PlaneGeometry(22, 14),
      createGradientMaterial(this.backgroundTopUniform, this.backgroundMiddleUniform, this.backgroundBottomUniform),
      [0, 1.6, -4.4],
    );
    this.backgroundPlane.renderOrder = -10;
    this.outerMesh = addMesh(this.relicRoot, createRelicGeometry(RELIC_SEED, 3, "outer"), this.outerMaterial, [0, 0, 0]);
    this.coreMesh = addMesh(
      this.relicRoot,
      createRelicGeometry(RELIC_SEED + 17, 2, "core"),
      this.coreMaterial,
      [0.04, -0.03, 0.02],
    );
    this.coreAuraMesh = addMesh(
      this.relicRoot,
      new THREE.SphereGeometry(0.86, 24, 16),
      new THREE.MeshBasicMaterial({
        color: 0x4e84ff,
        transparent: true,
        opacity: 0.08,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      }),
      [0, -0.02, 0],
    );
    this.outerEdgeMaterial = new THREE.LineBasicMaterial({
      color: 0x78a8ff,
      transparent: true,
      opacity: 0.1,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    const edges = new THREE.LineSegments(new THREE.EdgesGeometry(this.outerMesh.geometry, 62), this.outerEdgeMaterial);
    edges.renderOrder = 5;
    this.relicRoot.add(edges);
    this.fractureMaterial = new THREE.LineBasicMaterial({
      color: 0x94c5ff,
      transparent: true,
      opacity: 0.2,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    this.buildFractures();
    this.particleMaterial = new THREE.PointsMaterial({
      color: 0x88a5db,
      size: 0.028,
      transparent: true,
      opacity: 0.42,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      sizeAttenuation: true,
    });
    this.particleRoot.add(new THREE.Points(createParticleGeometry(this.profile.particleCount), this.particleMaterial));
    this.buildBackdropAndFloor();
    this.buildLighting();
    this.relicRoot.position.y = BASE_RELIC_Y;
    this.relicRoot.rotation.set(BASE_RELIC_ROTATION_X, 0, BASE_RELIC_ROTATION_Z);
    this.scene.add(this.relicRoot, this.fractureRoot, this.particleRoot, this.shaftRoot);
    this.applyPreset(this.currentPreset);
  }

  public async init(): Promise<PrismaticRelicSceneInitResult> {
    const viewport = this.getViewportSize();
    this.profile = getQualityProfile(viewport.width, viewport.height, window.devicePixelRatio || 1);
    this.syncParticleQuality();
    this.configureCamera(this.currentPreset);
    this.scene.background = new THREE.Color().setRGB(...this.currentPreset.background.middle);
    this.scene.fog = new THREE.Fog(new THREE.Color().setRGB(...this.currentPreset.background.fog), this.currentPreset.background.fogNear, this.currentPreset.background.fogFar);

    const renderer = new WebGPURenderer({ antialias: true, alpha: false });
    await renderer.init();
    if (this.disposed) {
      renderer.dispose();
      return { webGpuApiAvailable: this.hasWebGpuApi(), selectiveBloom: false };
    }
    this.renderer = renderer;
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 0.82 + this.currentPreset.core.intensity * 0.015;
    renderer.domElement.setAttribute("aria-hidden", "true");
    renderer.domElement.setAttribute("role", "presentation");
    renderer.domElement.tabIndex = -1;
    renderer.domElement.style.display = "block";
    renderer.domElement.style.width = "100%";
    renderer.domElement.style.height = "100%";
    this.container.appendChild(renderer.domElement);
    this.resize();
    this.renderer.domElement.addEventListener("pointermove", this.handlePointerMove, { passive: true });
    this.renderer.domElement.addEventListener("pointerleave", this.handlePointerLeave, { passive: true });
    this.renderer.domElement.addEventListener("pointercancel", this.handlePointerLeave, { passive: true });
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
    return {
      webGpuApiAvailable: this.hasWebGpuApi(),
      selectiveBloom: this.renderPipeline !== null,
    };
  }

  public setPreset(id: RelicPresetId): void {
    if (this.disposed || id === this.presetId) {
      return;
    }
    this.presetId = id;
    this.transitionFrom = this.currentPreset;
    this.transitionTo = getPreset(id);
    this.transitionStart = performance.now();
    this.transitionDuration = getPresetTransitionDuration(this.reducedMotion);
    if (this.reducedMotion) {
      this.currentPreset = this.transitionTo;
      this.applyPreset(this.currentPreset);
    }
    this.updateLoopState();
  }

  public setStillMode(enabled: boolean): void {
    if (this.disposed || this.stillMode === enabled) {
      return;
    }
    this.stillMode = enabled;
    this.pointerTarget = ZERO_POINTER;
    this.pointerActive = false;
    if (enabled) {
      this.pointer.set(0, 0);
      this.relicRoot.rotation.set(BASE_RELIC_ROTATION_X, 0, BASE_RELIC_ROTATION_Z);
      this.configureCamera(this.currentPreset);
    }
    this.updateLoopState();
  }

  public setReducedMotion(enabled: boolean): void {
    if (this.disposed || this.reducedMotion === enabled) {
      return;
    }
    this.reducedMotion = enabled;
    if (this.transitionStart > 0 && this.currentPreset.id !== this.transitionTo.id) {
      this.transitionStart = performance.now();
      this.transitionDuration = getPresetTransitionDuration(enabled);
    }
    if (enabled) {
      this.relicRoot.rotation.set(BASE_RELIC_ROTATION_X, 0, BASE_RELIC_ROTATION_Z);
      this.pointer.set(0, 0);
    }
    this.updateLoopState();
  }

  public reset(): void {
    if (this.disposed) {
      return;
    }
    this.pointerTarget = ZERO_POINTER;
    this.pointerActive = false;
    this.pointer.set(0, 0);
    this.relicRoot.rotation.set(BASE_RELIC_ROTATION_X, 0, BASE_RELIC_ROTATION_Z);
    this.configureCamera(this.currentPreset);
    this.updateLoopState();
  }

  public dispose(): void {
    if (this.disposed) {
      return;
    }
    this.disposed = true;
    this.renderer?.setAnimationLoop(null);
    this.animationLoopActive = false;
    this.renderer?.domElement.removeEventListener("pointermove", this.handlePointerMove);
    this.renderer?.domElement.removeEventListener("pointerleave", this.handlePointerLeave);
    this.renderer?.domElement.removeEventListener("pointercancel", this.handlePointerLeave);
    this.resizeObserver?.disconnect();
    this.intersectionObserver?.disconnect();
    window.removeEventListener("resize", this.handleResize);
    document.removeEventListener("visibilitychange", this.handleVisibility);
    const bloomDisposable = this.bloomPass as unknown as { dispose?: () => void } | null;
    bloomDisposable?.dispose?.();
    this.renderPipeline?.dispose();
    disposeSceneResources(this.scene);
    this.renderer?.dispose();
    if (this.renderer?.domElement.parentElement === this.container) {
      this.container.removeChild(this.renderer.domElement);
    }
    this.renderPipeline = null;
    this.bloomPass = null;
    this.renderer = null;
  }

  private createOuterMaterial(): MeshPhysicalNodeMaterial {
    const material = new MeshPhysicalNodeMaterial({
      color: 0xffffff,
      metalness: 0.08,
      roughness: 0.17,
      transmission: 0.64,
      thickness: 0.78,
      ior: 1.46,
      dispersion: 0.14,
      iridescence: 0.42,
      iridescenceIOR: 1.32,
      iridescenceThicknessRange: [160, 460],
      attenuationColor: new THREE.Color(0x102055),
      attenuationDistance: 2.4,
      transparent: true,
      opacity: 0.94,
      depthWrite: false,
    });
    const layer = positionLocal.y.div(2.4).add(0.5).clamp(0, 1);
    const wave = positionLocal.x.mul(3.2)
      .add(positionLocal.z.mul(2.4))
      .add(this.timeUniform.mul(this.motionUniform))
      .sin()
      .mul(0.5)
      .add(0.5);
    const pointerBand = positionLocal.x.mul(this.pointerUniform.x)
      .add(positionLocal.z.mul(this.pointerUniform.y))
      .mul(3.3)
      .sin()
      .mul(0.5)
      .add(0.5);
    const colorMix = layer.mul(0.54).add(wave.mul(0.24)).add(pointerBand.mul(0.22)).clamp(0, 1);
    const facing = normalView.normalize().dot(positionViewDirection.normalize()).abs();
    const rim = float(1).sub(facing).clamp(0, 1).pow(1.8);
    const pointerHighlight = this.pointerUniform.x.mul(positionLocal.x)
      .add(this.pointerUniform.y.mul(positionLocal.z))
      .add(0.5)
      .clamp(0, 1);
    const prismColor = mix(this.shellColorAUniform, this.shellColorBUniform, colorMix);
    const edgeColor = mix(prismColor, this.shellAccentUniform, rim.mul(0.55).add(pointerHighlight.mul(0.2)).clamp(0, 1));
    material.colorNode = prismColor.add(edgeColor.mul(rim.mul(0.32)));
    material.emissiveNode = edgeColor.mul(rim.mul(this.shellEmissionUniform));
    return material;
  }

  private createCoreMaterial(): MeshStandardNodeMaterial {
    const material = new MeshStandardNodeMaterial({
      color: 0xffffff,
      roughness: 0.22,
      metalness: 0.12,
      transparent: true,
      opacity: 0.93,
      depthWrite: false,
    });
    const coreWave = positionLocal.y.mul(3.1).add(this.timeUniform.mul(this.motionUniform.mul(1.8))).sin().mul(0.5).add(0.5);
    const coreColor = mix(this.coreColorAUniform, this.coreColorBUniform, coreWave);
    material.colorNode = coreColor;
    material.emissiveNode = coreColor.mul(this.coreEmissionUniform);
    return material;
  }

  private buildFractures(): void {
    const paths: readonly (readonly Vec3Tuple[])[] = [
      [[-0.54, -0.92, 0.31], [-0.34, -0.54, 0.47], [-0.42, -0.18, 0.5], [-0.19, 0.1, 0.58]],
      [[0.55, 0.88, 0.24], [0.36, 0.55, 0.42], [0.44, 0.18, 0.5], [0.25, -0.08, 0.58]],
      [[-0.73, 0.28, 0.3], [-0.48, 0.24, 0.52], [-0.24, 0.38, 0.56]],
    ];
    paths.forEach((path, index) => {
      const line = createFractureLine(path, this.fractureMaterial);
      line.position.z = 0.02 + index * 0.006;
      line.scale.setScalar(1.02);
      line.renderOrder = 6;
      this.fractureRoot.add(line);
    });
    this.fractureRoot.position.y = BASE_RELIC_Y;
    this.fractureRoot.rotation.set(BASE_RELIC_ROTATION_X, 0, BASE_RELIC_ROTATION_Z);
  }

  private buildBackdropAndFloor(): void {
    const floor = addMesh(
      this.scene,
      new THREE.PlaneGeometry(22, 16),
      new THREE.MeshStandardMaterial({ color: 0x080a18, roughness: 0.36, metalness: 0.22 }),
      [0, -1.42, 0],
    );
    floor.rotation.x = -Math.PI / 2;
    floor.renderOrder = -2;
    const pedestal = addMesh(
      this.scene,
      new THREE.CylinderGeometry(1.55, 1.78, 0.18, 64),
      this.pedestalMaterial,
      [0, -1.32, 0],
    );
    pedestal.renderOrder = 0;
    const pedestalRing = addMesh(
      this.scene,
      new THREE.TorusGeometry(1.38, 0.018, 6, 72),
      new THREE.MeshBasicMaterial({ color: 0x5176c8, transparent: true, opacity: 0.5, blending: THREE.AdditiveBlending }),
      [0, -1.21, 0],
    );
    pedestalRing.rotation.x = Math.PI / 2;
    const shaftDefinitions: readonly { readonly x: number; readonly y: number; readonly z: number; readonly rotation: number }[] = [
      { x: -4.7, y: 1.6, z: -3.65, rotation: -0.12 },
      { x: 4.4, y: 1.15, z: -3.7, rotation: 0.16 },
      { x: -2.8, y: -0.2, z: -3.55, rotation: -0.05 },
    ];
    for (const definition of shaftDefinitions) {
      const material = new THREE.MeshBasicMaterial({
        color: 0x3151a1,
        transparent: true,
        opacity: 0.06,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        side: THREE.DoubleSide,
      });
      const shaft = addMesh(this.shaftRoot, new THREE.PlaneGeometry(0.16, 5.8), material, [definition.x, definition.y, definition.z]);
      shaft.rotation.z = definition.rotation;
      this.shaftMaterials.push(material);
    }
  }

  private buildLighting(): void {
    this.backgroundLight.color.set(0x294a8a);
    this.backgroundLight.groundColor.set(0x080a1a);
    this.backgroundLight.intensity = 0.8;
    this.keyLight.castShadow = false;
    this.rimLight.distance = 14;
    this.rimLight.decay = 1.8;
    this.floorLight.distance = 8;
    this.floorLight.decay = 1.65;
    this.coreLight.distance = 4.8;
    this.coreLight.decay = 1.8;
    this.scene.add(this.backgroundLight, this.keyLight, this.rimLight, this.floorLight, this.coreLight);
  }

  private configureCamera(preset: RelicPreset): void {
    this.camera.position.set(...preset.camera.position);
    this.camera.fov = preset.camera.fov;
    this.camera.updateProjectionMatrix();
    this.camera.lookAt(...preset.camera.target);
  }

  private applyPreset(preset: RelicPreset): void {
    this.currentPreset = preset;
    setVectorUniform(this.shellColorAUniform, preset.shell.colorA);
    setVectorUniform(this.shellColorBUniform, preset.shell.colorB);
    setVectorUniform(this.shellAccentUniform, preset.shell.accent);
    setVectorUniform(this.coreColorAUniform, preset.core.colorA);
    setVectorUniform(this.coreColorBUniform, preset.core.colorB);
    setVectorUniform(this.backgroundTopUniform, preset.background.top);
    setVectorUniform(this.backgroundMiddleUniform, preset.background.middle);
    setVectorUniform(this.backgroundBottomUniform, preset.background.bottom);
    this.motionUniform.value = preset.motionSpeed;
    this.coreEmissionUniform.value = preset.core.intensity;
    this.outerMaterial.transmission = preset.shell.transmission;
    this.outerMaterial.thickness = preset.shell.thickness;
    this.outerMaterial.ior = preset.shell.ior;
    this.outerMaterial.dispersion = preset.shell.dispersion;
    this.outerMaterial.iridescence = preset.shell.iridescence;
    this.outerMaterial.roughness = preset.shell.roughness;
    this.outerMaterial.opacity = preset.shell.opacity;
    setColor(this.outerMaterial.attenuationColor, preset.shell.attenuationColor);
    this.outerMaterial.attenuationDistance = preset.shell.attenuationDistance;
    setColor((this.coreAuraMesh.material as THREE.MeshBasicMaterial).color, preset.core.colorA);
    const coreAuraMaterial = this.coreAuraMesh.material as THREE.MeshBasicMaterial;
    coreAuraMaterial.opacity = 0.065 + preset.core.intensity * 0.012;
    setColor(this.outerEdgeMaterial.color, preset.shell.accent);
    setColor(this.fractureMaterial.color, preset.shell.accent);
    setColor(this.particleMaterial.color, preset.shell.accent);
    this.keyLight.color.setRGB(...preset.lights.keyColor);
    this.keyLight.position.set(...preset.lights.keyPosition);
    this.keyLight.intensity = preset.lights.keyIntensity;
    this.rimLight.color.setRGB(...preset.lights.rimColor);
    this.rimLight.position.set(...preset.lights.rimPosition);
    this.rimLight.intensity = preset.lights.rimIntensity;
    this.floorLight.color.setRGB(...preset.lights.floorColor);
    this.floorLight.position.set(...preset.lights.floorPosition);
    this.floorLight.intensity = preset.lights.floorIntensity;
    this.coreLight.color.setRGB(...preset.core.colorA);
    this.coreLight.intensity = preset.core.intensity * 1.15;
    this.backgroundLight.color.setRGB(...preset.lights.rimColor);
    this.backgroundLight.intensity = preset.lights.backgroundIntensity;
    this.scene.background = new THREE.Color().setRGB(...preset.background.middle);
    if (this.scene.fog instanceof THREE.Fog) {
      this.scene.fog.color.setRGB(...preset.background.fog);
      this.scene.fog.near = preset.background.fogNear;
      this.scene.fog.far = preset.background.fogFar;
    }
    this.shaftMaterials.forEach((material) => {
      material.color.copy(this.rimLight.color);
      material.opacity = this.reducedMotion ? 0.045 : 0.065;
    });
    if (this.renderer) {
      this.renderer.toneMappingExposure = 0.82 + preset.core.intensity * 0.015;
    }
    if (this.bloomPass) {
      this.bloomPass.strength.value = preset.bloomStrength * (this.profile.level === "low" ? 0.82 : 1);
      this.bloomPass.radius.value = preset.bloomRadius;
      this.bloomPass.threshold.value = preset.bloomThreshold;
    }
  }

  private setupPostProcessing(): void {
    if (!this.renderer || !this.hasWebGpuApi()) {
      return;
    }
    try {
      const scenePass = pass(this.scene, this.camera);
      scenePass.setMRT(mrt({ output, emissive }));
      const sceneColor = scenePass.getTextureNode("output");
      this.bloomPass = bloom(scenePass.getTextureNode("emissive"), this.currentPreset.bloomStrength, this.currentPreset.bloomRadius, this.currentPreset.bloomThreshold);
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
    this.elapsedSeconds += deltaSeconds;
    const progress = this.transitionStart > 0
      ? Math.min(1, Math.max(0, (safeTime - this.transitionStart) / Math.max(1, this.transitionDuration)))
      : 1;
    if (this.transitionStart > 0 && progress < 1) {
      this.applyPreset(interpolatePreset(this.transitionFrom, this.transitionTo, progress));
    } else if (this.transitionStart > 0) {
      this.applyPreset(this.transitionTo);
      this.transitionStart = 0;
      this.transitionDuration = 0;
      this.configureCamera(this.currentPreset);
    }

    if (!this.stillMode) {
      const nextPointer = smoothPointer(
        { x: this.pointer.x, y: this.pointer.y },
        this.pointerActive ? this.pointerTarget : ZERO_POINTER,
        deltaSeconds,
        this.reducedMotion ? 10 : 7,
      );
      this.pointer.set(nextPointer.x, nextPointer.y);
      this.pointerUniform.value.set(this.pointer.x, this.pointer.y);
      this.updatePointerLights();
      if (!this.reducedMotion) {
        this.timeUniform.value = this.elapsedSeconds;
        const drift = Math.sin(this.elapsedSeconds * Math.max(0.08, this.currentPreset.motionSpeed)) * 0.035;
        this.relicRoot.rotation.y = drift + this.pointer.x * 0.022;
        this.relicRoot.rotation.x = BASE_RELIC_ROTATION_X + this.pointer.y * 0.014;
        this.fractureRoot.rotation.y = this.relicRoot.rotation.y;
        this.fractureRoot.rotation.x = this.relicRoot.rotation.x;
        this.particleRoot.rotation.y = this.elapsedSeconds * 0.012;
        this.particleRoot.position.x = Math.sin(this.elapsedSeconds * 0.18) * 0.08;
      }
    } else {
      this.pointerUniform.value.set(0, 0);
      this.timeUniform.value = 0;
      this.updatePointerLights();
    }
    this.renderOnce();
    if (!this.shouldAnimate(safeTime)) {
      this.renderer.setAnimationLoop(null);
      this.animationLoopActive = false;
    }
  }

  private updatePointerLights(): void {
    if (this.stillMode) {
      this.coreLight.position.set(0.08, 0.04, 0.65);
      return;
    }
    this.keyLight.position.x = this.currentPreset.lights.keyPosition[0] + this.pointer.x * 1.2;
    this.keyLight.position.y = this.currentPreset.lights.keyPosition[1] + this.pointer.y * 0.8;
    this.rimLight.position.x = this.currentPreset.lights.rimPosition[0] - this.pointer.x * 1.4;
    this.rimLight.position.y = this.currentPreset.lights.rimPosition[1] + this.pointer.y * 0.9;
    this.coreLight.position.set(0.08 + this.pointer.x * 0.72, 0.04 + this.pointer.y * 0.58, 0.65 + this.pointer.x * 0.16);
    this.camera.position.x = this.currentPreset.camera.position[0] + (this.reducedMotion ? 0 : this.pointer.x * 0.08);
    this.camera.position.y = this.currentPreset.camera.position[1] + (this.reducedMotion ? 0 : this.pointer.y * 0.06);
    this.camera.lookAt(...this.currentPreset.camera.target);
  }

  private resize(): void {
    if (!this.renderer || this.disposed) {
      return;
    }
    const viewport = this.getViewportSize();
    this.profile = getQualityProfile(viewport.width, viewport.height, window.devicePixelRatio || 1);
    this.syncParticleQuality();
    const drawingBuffer = getDrawingBufferSize(viewport.width, viewport.height, window.devicePixelRatio || 1, this.profile);
    this.camera.aspect = viewport.width / viewport.height;
    this.camera.updateProjectionMatrix();
    this.renderer.setPixelRatio(drawingBuffer.pixelRatio);
    this.renderer.setSize(viewport.width, viewport.height, false);
    this.bloomPass?.setResolutionScale(this.profile.bloomResolutionScale);
    this.bloomPass?.setSize(drawingBuffer.width, drawingBuffer.height);
    this.updateLoopState();
  }

  private syncParticleQuality(): void {
    const particlePoints = this.particleRoot.children.find(
      (child): child is THREE.Points => child instanceof THREE.Points,
    );
    if (!particlePoints) {
      return;
    }
    const currentCount = particlePoints.geometry.getAttribute("position")?.count ?? 0;
    if (currentCount === this.profile.particleCount) {
      return;
    }
    const previousGeometry = particlePoints.geometry;
    particlePoints.geometry = createParticleGeometry(this.profile.particleCount);
    previousGeometry.dispose();
  }

  private shouldAnimate(time: number): boolean {
    if (this.disposed || !this.renderer || !this.pageVisible || !this.inViewport) {
      return false;
    }
    if (this.transitionStart > 0) {
      return true;
    }
    if (this.stillMode) {
      return false;
    }
    if (!this.reducedMotion) {
      return true;
    }
    return this.pointerActive || this.pointer.lengthSq() > 0.0001 || time < this.lastTime + 80;
  }

  private updateLoopState(): void {
    if (!this.renderer || this.disposed) {
      return;
    }
    if (this.shouldAnimate(performance.now())) {
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
