import * as THREE from "three";
import { MeshStandardNodeMaterial, WebGPURenderer } from "three/webgpu";

import {
  addBox,
  addMesh,
  createBaseProfile,
  createBranchGeometry,
  createFoliagePadGeometry,
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
  private readonly materials = createSnowGlobeMaterials();
  private readonly resizeObserver: ResizeObserver;
  private renderer: WebGPURenderer | null = null;
  private disposed = false;
  private reducedMotion: boolean;
  private lastWidth = 1440;
  private lastHeight = 900;
  private readonly handleResize = (): void => this.resize();

  public constructor(container: HTMLElement, reducedMotion: boolean) {
    this.container = container;
    this.reducedMotion = reducedMotion;
    this.scene.background = new THREE.Color(0x030405);
    this.scene.environment = this.materials.environment;
    this.scene.environmentIntensity = 0.48;
    this.scene.fog = new THREE.Fog(0x050608, 9, 22);
    this.scene.add(this.globeRoot);
    this.buildBackdrop();
    this.buildLighting();
    this.buildBase();
    this.buildInterior();
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
      this.container.appendChild(renderer.domElement);
      this.resizeObserver.observe(this.container);
      window.addEventListener("resize", this.handleResize, { passive: true });
      document.addEventListener("visibilitychange", this.handleVisibility, { passive: true });
      this.resize();
      this.renderOnce();
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
    if (this.renderer && this.reducedMotion) {
      this.renderOnce();
    }
  }

  public dispose(): void {
    if (this.disposed) {
      return;
    }
    this.disposed = true;
    this.resizeObserver.disconnect();
    window.removeEventListener("resize", this.handleResize);
    document.removeEventListener("visibilitychange", this.handleVisibility);
    const renderer = this.renderer;
    renderer?.setAnimationLoop(null);
    if (renderer?.domElement.parentElement === this.container) {
      this.container.removeChild(renderer.domElement);
    }
    disposeSceneResources(this.scene, this.materials);
    renderer?.dispose();
    this.renderer = null;
  }

  private readonly handleVisibility = (): void => {
    if (!this.disposed && document.visibilityState === "visible") {
      this.renderOnce();
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
    const base = markShadow(addMesh(this.globeRoot, createBaseProfile(), this.materials.walnut), true, true);
    base.name = "dark walnut lathed base";

    const lowerShadowRing = markShadow(
      addMesh(
        this.globeRoot,
        new THREE.TorusGeometry(2.08, 0.055, 12, 96),
        this.materials.walnutDark,
        [0, 0.25, 0],
      ),
      true,
      true,
    );
    lowerShadowRing.rotation.x = Math.PI / 2;

    const shoulderRing = addMesh(
      this.globeRoot,
      new THREE.TorusGeometry(2.01, 0.035, 12, 96),
      this.materials.walnutDark,
      [0, 0.83, 0],
    );
    shoulderRing.rotation.x = Math.PI / 2;

    const brassRing = addMesh(
      this.globeRoot,
      new THREE.TorusGeometry(1.84, 0.026, 12, 96),
      this.materials.brass,
      [0, 0.98, 0],
    );
    brassRing.rotation.x = Math.PI / 2;
    brassRing.castShadow = true;

    const topInset = markShadow(
      addMesh(
        this.globeRoot,
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
      addMesh(this.globeRoot, createTerrainGeometry(2.8), this.materials.snow, [0, 0, 0]),
      false,
      true,
    );
    terrain.name = "rolling snow terrain";

    const rearMound = markShadow(
      addMesh(
        this.globeRoot,
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
        this.globeRoot,
        createSnowMoundGeometry(),
        this.materials.snowShadow,
        [-0.08, 1.0, 0.56],
      ),
      false,
      true,
    );
    foregroundMound.scale.set(1.22, 0.2, 0.55);

    const cabin = new THREE.Group();
    cabin.position.set(-0.58, 1.03, 0.16);
    this.globeRoot.add(cabin);
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
      position: new THREE.Vector3(-1.18, 1.01, -0.75),
      height: 1.86,
      width: 1.28,
      material: this.materials.treeDeep,
      tierCount: 4,
      seed: 0x20b,
    });
    this.buildTree({
      position: new THREE.Vector3(1.45, 1.0, -0.83),
      height: 1.64,
      width: 1.14,
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
        this.globeRoot,
        new THREE.IcosahedronGeometry(size, 1),
        this.materials.snow,
        [x, y, z],
      );
      fleck.name = "static suspended snow fleck";
      fleck.castShadow = false;
      fleck.receiveShadow = false;
    });
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
    this.globeRoot.add(tree);
    const random = seededRandom(spec.seed);
    const trunkHeight = spec.height * 0.83;
    const trunk = markShadow(
      addMesh(tree, new THREE.CylinderGeometry(0.075, 0.14, trunkHeight, 9), this.materials.twig, [0, trunkHeight / 2, 0]),
      true,
      true,
    );
    trunk.name = spec.hero ? "hero tapered trunk" : "secondary tapered trunk";

    const foliageGeometry = createFoliagePadGeometry();
    const snowGeometry = createSnowPatchGeometry();
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

        const padPosition = start.clone().addScaledVector(direction.normalize(), branchLength * 0.56);
        padPosition.y -= 0.04 + progress * 0.03;
        const foliagePad = markShadow(addMesh(tree, foliageGeometry.clone(), spec.material, padPosition), true, true);
        foliagePad.scale.set(branchLength * 0.44, 0.105 + (1 - progress) * 0.035, 0.16 + (1 - progress) * 0.045);
        foliagePad.rotation.y = angle;
        foliagePad.rotation.z = (random() - 0.5) * 0.34;

        const tipPosition = start.clone().addScaledVector(direction.normalize(), branchLength * 0.84);
        tipPosition.y -= 0.065 + progress * 0.035;
        const foliageTip = markShadow(addMesh(tree, foliageGeometry.clone(), spec.material, tipPosition), true, true);
        foliageTip.scale.set(branchLength * 0.22, 0.075 + (1 - progress) * 0.025, 0.11 + (1 - progress) * 0.03);
        foliageTip.rotation.y = angle + (random() - 0.5) * 0.22;
        foliageTip.rotation.z = (random() - 0.5) * 0.42;

        if (random() > (spec.hero ? 0.48 : 0.58) && tier < spec.tierCount - 1) {
          const snowPosition = padPosition.clone();
          snowPosition.y += 0.12 + random() * 0.045;
          const snowPatch = markShadow(addMesh(tree, snowGeometry.clone(), this.materials.snow, snowPosition), false, true);
          snowPatch.scale.set(branchLength * 0.17, 0.045 + random() * 0.016, 0.09 + random() * 0.028);
          snowPatch.rotation.y = angle;
          snowPatch.rotation.z = (random() - 0.5) * 0.16;
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
      addMesh(tree, new THREE.IcosahedronGeometry(0.22, 1), spec.material, [0, spec.height * 0.84, 0]),
      true,
      true,
    );
    crown.scale.set(0.74, 1.42, 0.74);
    const crownSnow = markShadow(
      addMesh(tree, new THREE.IcosahedronGeometry(0.2, 1), this.materials.snow, [0, spec.height * 0.88, 0.01]),
      false,
      true,
    );
    crownSnow.scale.set(0.38, 0.26, 0.34);

    const rootMound = markShadow(
      addMesh(tree, createSnowMoundGeometry(), this.materials.snowShadow, [0, 0.035, 0]),
      false,
      true,
    );
    rootMound.scale.set(spec.width * 0.52, 0.075, spec.width * 0.38);
  }

  private buildGlass(): void {
    const glass = addMesh(
      this.globeRoot,
      new THREE.SphereGeometry(2.58, 96, 64),
      this.materials.glass,
      [0, 3.16, 0],
    );
    glass.name = "near-colorless physical glass shell";
    glass.renderOrder = 10;
    glass.castShadow = false;
    glass.receiveShadow = false;

    const collar = addMesh(
      this.globeRoot,
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
    this.configureCamera(width, height);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.7));
    this.renderer.setSize(width, height, false);
    this.renderOnce();
  }

  private configureCamera(width: number, height: number): void {
    const mobile = width < 640;
    const crop = height < 720 && width / height > 1.35;
    if (mobile) {
      this.camera.fov = 31;
      this.camera.position.set(4.75, 4.95, 15.45);
      this.globeRoot.scale.setScalar(0.78);
      this.globeRoot.position.set(0, 0.12, 0);
      this.camera.lookAt(0, 2.75, 0);
    } else {
      this.camera.fov = crop ? 31.2 : 33;
      this.camera.position.set(6.45, 5.1, 12.85);
      this.globeRoot.scale.setScalar(1);
      this.globeRoot.position.set(0.2, 0, 0);
      this.camera.lookAt(0.2, 2.78, 0);
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
