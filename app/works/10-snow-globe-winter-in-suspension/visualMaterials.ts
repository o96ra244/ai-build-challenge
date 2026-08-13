import * as THREE from "three";
import {
  MeshBasicNodeMaterial,
  MeshPhysicalNodeMaterial,
  MeshStandardNodeMaterial,
} from "three/webgpu";
import {
  color,
  float,
  mix,
  normalView,
  positionLocal,
  positionViewDirection,
  smoothstep,
} from "three/tsl";

type TextureRecord = THREE.Texture;

export type SnowGlobeMaterials = {
  readonly walnut: MeshPhysicalNodeMaterial;
  readonly walnutDark: MeshPhysicalNodeMaterial;
  readonly brass: MeshPhysicalNodeMaterial;
  readonly cabinWood: MeshStandardNodeMaterial;
  readonly cabinWoodDark: MeshStandardNodeMaterial;
  readonly roof: MeshStandardNodeMaterial;
  readonly treeHero: MeshStandardNodeMaterial;
  readonly treeDeep: MeshStandardNodeMaterial;
  readonly treePale: MeshStandardNodeMaterial;
  readonly twig: MeshStandardNodeMaterial;
  readonly snow: MeshPhysicalNodeMaterial;
  readonly snowShadow: MeshPhysicalNodeMaterial;
  readonly stone: MeshStandardNodeMaterial;
  readonly window: MeshPhysicalNodeMaterial;
  readonly door: MeshStandardNodeMaterial;
  readonly glass: MeshPhysicalNodeMaterial;
  readonly backdrop: MeshBasicNodeMaterial;
  readonly floor: MeshPhysicalNodeMaterial;
  readonly environment: THREE.Texture;
  readonly textures: readonly TextureRecord[];
};

function createCanvas(width: number, height: number): HTMLCanvasElement {
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  return canvas;
}

function createTexture(canvas: HTMLCanvasElement, repeat = false): THREE.CanvasTexture {
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 4;
  if (repeat) {
    texture.wrapS = THREE.RepeatWrapping;
    texture.wrapT = THREE.MirroredRepeatWrapping;
    texture.repeat.set(1.45, 1);
  }
  texture.needsUpdate = true;
  return texture;
}

function seededRandom(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = Math.imul(1664525, state) + 1013904223;
    return (state >>> 0) / 4294967296;
  };
}

function createWalnutTexture(): THREE.CanvasTexture {
  const canvas = createCanvas(768, 384);
  const context = canvas.getContext("2d");
  if (!context) {
    throw new Error("木目テクスチャの描画コンテキストを作成できませんでした。");
  }

  const random = seededRandom(0x10a5e);
  const base = context.createLinearGradient(0, 0, canvas.width, canvas.height);
  base.addColorStop(0, "#2d1a13");
  base.addColorStop(0.36, "#47281b");
  base.addColorStop(0.68, "#382016");
  base.addColorStop(1, "#21110d");
  context.fillStyle = base;
  context.fillRect(0, 0, canvas.width, canvas.height);

  for (let index = 0; index < 118; index += 1) {
    const startX = random() * canvas.width;
    const wave = 4 + random() * 14;
    const amplitude = 2 + random() * 11;
    const width = 0.4 + random() * 2.4;
    const light = random() > 0.58;
    context.beginPath();
    context.moveTo(startX, 0);
    for (let y = 0; y <= canvas.height; y += 18) {
      const x = startX + Math.sin(y / 52 + wave) * amplitude + Math.sin(y / 19 + wave * 0.7) * 2.5;
      context.lineTo(x, y);
    }
    context.strokeStyle = light ? "rgba(152, 91, 59, 0.075)" : "rgba(5, 3, 3, 0.16)";
    context.lineWidth = width;
    context.stroke();
  }

  for (let index = 0; index < 240; index += 1) {
    const x = random() * canvas.width;
    const y = random() * canvas.height;
    const size = 0.5 + random() * 2.2;
    context.fillStyle = random() > 0.5 ? "rgba(185, 120, 76, 0.08)" : "rgba(0, 0, 0, 0.09)";
    context.fillRect(x, y, size, size * (1.5 + random()));
  }

  return createTexture(canvas, true);
}

function createCabinWoodTexture(): THREE.CanvasTexture {
  const canvas = createCanvas(512, 256);
  const context = canvas.getContext("2d");
  if (!context) {
    throw new Error("キャビン木材テクスチャの描画コンテキストを作成できませんでした。");
  }
  const random = seededRandom(0xcab10);
  context.fillStyle = "#40342c";
  context.fillRect(0, 0, canvas.width, canvas.height);
  for (let index = 0; index < 38; index += 1) {
    const y = random() * canvas.height;
    context.strokeStyle = index % 3 === 0 ? "rgba(222, 190, 145, 0.12)" : "rgba(20, 13, 10, 0.18)";
    context.lineWidth = 1 + random() * 2;
    context.beginPath();
    context.moveTo(0, y);
    context.bezierCurveTo(
      canvas.width * 0.28,
      y + (random() - 0.5) * 14,
      canvas.width * 0.72,
      y + (random() - 0.5) * 16,
      canvas.width,
      y + (random() - 0.5) * 11,
    );
    context.stroke();
  }
  return createTexture(canvas, true);
}

function createSnowTexture(): THREE.CanvasTexture {
  const canvas = createCanvas(256, 256);
  const context = canvas.getContext("2d");
  if (!context) {
    throw new Error("雪テクスチャの描画コンテキストを作成できませんでした。");
  }
  const random = seededRandom(0x5a0b);
  const gradient = context.createLinearGradient(0, 0, 256, 256);
  gradient.addColorStop(0, "#eef4f3");
  gradient.addColorStop(0.48, "#dbe6e8");
  gradient.addColorStop(1, "#f4f7f4");
  context.fillStyle = gradient;
  context.fillRect(0, 0, 256, 256);
  for (let index = 0; index < 720; index += 1) {
    const value = random();
    const shade = value > 0.58 ? "rgba(132, 157, 165, 0.06)" : "rgba(255, 255, 255, 0.1)";
    context.fillStyle = shade;
    const size = 0.4 + value * 2.2;
    context.fillRect(random() * 256, random() * 256, size, size);
  }
  return createTexture(canvas, true);
}

function createEnvironmentTexture(): THREE.CanvasTexture {
  const canvas = createCanvas(768, 384);
  const context = canvas.getContext("2d");
  if (!context) {
    throw new Error("環境テクスチャの描画コンテキストを作成できませんでした。");
  }

  const gradient = context.createLinearGradient(0, 0, 0, canvas.height);
  gradient.addColorStop(0, "#070a10");
  gradient.addColorStop(0.25, "#222b38");
  gradient.addColorStop(0.52, "#0a0e15");
  gradient.addColorStop(0.82, "#211914");
  gradient.addColorStop(1, "#050607");
  context.fillStyle = gradient;
  context.fillRect(0, 0, canvas.width, canvas.height);

  const coldPanel = context.createRadialGradient(180, 148, 8, 180, 148, 270);
  coldPanel.addColorStop(0, "rgba(216, 228, 238, 0.42)");
  coldPanel.addColorStop(0.22, "rgba(159, 181, 201, 0.16)");
  coldPanel.addColorStop(1, "rgba(0, 0, 0, 0)");
  context.fillStyle = coldPanel;
  context.fillRect(0, 0, canvas.width, canvas.height);

  const warmPanel = context.createRadialGradient(580, 258, 8, 580, 258, 230);
  warmPanel.addColorStop(0, "rgba(175, 125, 82, 0.1)");
  warmPanel.addColorStop(1, "rgba(0, 0, 0, 0)");
  context.fillStyle = warmPanel;
  context.fillRect(0, 0, canvas.width, canvas.height);

  const texture = createTexture(canvas);
  texture.mapping = THREE.EquirectangularReflectionMapping;
  texture.needsUpdate = true;
  return texture;
}

function createBackdropMaterial(): MeshBasicNodeMaterial {
  const material = new MeshBasicNodeMaterial({ color: 0xffffff, fog: false });
  const height = positionLocal.y.div(10).add(0.5).clamp(0, 1);
  const lower = mix(color(0x030405), color(0x131821), smoothstep(0.12, 0.56, height));
  material.colorNode = mix(lower, color(0x050607), smoothstep(0.72, 1, height));
  return material;
}

export function createSnowGlobeMaterials(): SnowGlobeMaterials {
  const walnutTexture = createWalnutTexture();
  const cabinWoodTexture = createCabinWoodTexture();
  const snowTexture = createSnowTexture();
  const environment = createEnvironmentTexture();

  const walnut = new MeshPhysicalNodeMaterial({
    color: 0x553321,
    map: walnutTexture,
    roughness: 0.44,
    metalness: 0.08,
    clearcoat: 0.14,
    clearcoatRoughness: 0.28,
  });
  const walnutDark = new MeshPhysicalNodeMaterial({
    color: 0x352015,
    map: walnutTexture,
    roughness: 0.56,
    metalness: 0.06,
    clearcoat: 0.12,
    clearcoatRoughness: 0.35,
  });
  const brass = new MeshPhysicalNodeMaterial({
    color: 0x8b785f,
    roughness: 0.39,
    metalness: 0.82,
    clearcoat: 0.12,
    clearcoatRoughness: 0.2,
  });
  const cabinWood = new MeshStandardNodeMaterial({
    color: 0x8b694f,
    map: cabinWoodTexture,
    roughness: 0.72,
    metalness: 0.02,
  });
  const cabinWoodDark = new MeshStandardNodeMaterial({
    color: 0x4b3326,
    map: cabinWoodTexture,
    roughness: 0.8,
    metalness: 0.01,
  });
  const roof = new MeshStandardNodeMaterial({
    color: 0x343739,
    roughness: 0.72,
    metalness: 0.04,
  });
  const treeHero = new MeshStandardNodeMaterial({
    color: 0x4b6a5d,
    roughness: 0.86,
    metalness: 0.01,
  });
  const treeDeep = new MeshStandardNodeMaterial({
    color: 0x35574f,
    roughness: 0.9,
    metalness: 0.01,
  });
  const treePale = new MeshStandardNodeMaterial({
    color: 0x58786a,
    roughness: 0.9,
    metalness: 0.01,
  });
  const twig = new MeshStandardNodeMaterial({
    color: 0x493b2e,
    roughness: 0.92,
    metalness: 0,
  });
  const snow = new MeshPhysicalNodeMaterial({
    color: 0xe9f0ef,
    map: snowTexture,
    roughness: 0.86,
    metalness: 0,
    sheen: 0.2,
    sheenColor: 0xb8cbd0,
    sheenRoughness: 0.72,
  });
  const snowShadow = new MeshPhysicalNodeMaterial({
    color: 0xbfcfd2,
    map: snowTexture,
    roughness: 0.92,
    metalness: 0,
    sheen: 0.12,
    sheenColor: 0x9eb8bf,
    sheenRoughness: 0.8,
  });
  const stone = new MeshStandardNodeMaterial({
    color: 0x4a4c4a,
    roughness: 0.94,
    metalness: 0,
  });
  const window = new MeshPhysicalNodeMaterial({
    color: 0xd77638,
    emissive: 0xf47f32,
    emissiveIntensity: 2.35,
    roughness: 0.28,
    metalness: 0,
  });
  const door = new MeshStandardNodeMaterial({
    color: 0x251913,
    map: cabinWoodTexture,
    roughness: 0.78,
    metalness: 0,
  });
  const glass = new MeshPhysicalNodeMaterial({
    color: 0xffffff,
    roughness: 0.035,
    metalness: 0,
    transmission: 0.68,
    thickness: 0.045,
    ior: 1.46,
    clearcoat: 0.3,
    clearcoatRoughness: 0.06,
    specularIntensity: 0.46,
    transparent: true,
    opacity: 0.3,
    depthWrite: false,
  });
  const edgeFactor = normalView
    .dot(positionViewDirection)
    .abs()
    .oneMinus()
    .clamp(0, 1);
  const edgeResponse = edgeFactor.pow(3).mul(0.13);
  glass.opacity = 1;
  glass.opacityNode = mix(float(0.07), float(0.52), edgeFactor.pow(2));
  glass.emissiveNode = color(0xdce9e9).mul(edgeResponse);
  const floor = new MeshPhysicalNodeMaterial({
    color: 0x080a0d,
    roughness: 0.54,
    metalness: 0.18,
    clearcoat: 0.12,
    clearcoatRoughness: 0.32,
  });
  const backdrop = createBackdropMaterial();

  return {
    walnut,
    walnutDark,
    brass,
    cabinWood,
    cabinWoodDark,
    roof,
    treeHero,
    treeDeep,
    treePale,
    twig,
    snow,
    snowShadow,
    stone,
    window,
    door,
    glass,
    backdrop,
    floor,
    environment,
    textures: [walnutTexture, cabinWoodTexture, snowTexture, environment],
  };
}
