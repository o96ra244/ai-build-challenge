import * as THREE from "three";

export type MachineMaterials = {
  readonly chrome: THREE.MeshPhysicalMaterial;
  readonly chromeDark: THREE.MeshPhysicalMaterial;
  readonly brass: THREE.MeshPhysicalMaterial;
  readonly brassBright: THREE.MeshPhysicalMaterial;
  readonly paintedMetal: THREE.MeshPhysicalMaterial;
  readonly graphite: THREE.MeshPhysicalMaterial;
  readonly ivory: THREE.MeshPhysicalMaterial;
  readonly glass: THREE.MeshPhysicalMaterial;
  readonly rubber: THREE.MeshStandardMaterial;
  readonly warmGlow: THREE.MeshBasicMaterial;
  readonly coolGlow: THREE.MeshBasicMaterial;
  readonly indicatorOff: THREE.MeshStandardMaterial;
};

function physical(
  color: number,
  roughness: number,
  metalness: number,
  options: Partial<THREE.MeshPhysicalMaterialParameters> = {},
): THREE.MeshPhysicalMaterial {
  return new THREE.MeshPhysicalMaterial({
    color,
    roughness,
    metalness,
    envMapIntensity: 1.25,
    ...options,
  });
}

export function createMachineMaterials(environment: THREE.Texture | null): MachineMaterials {
  const chrome = physical(0xd5e2ea, 0.12, 0.98, { clearcoat: 0.75, clearcoatRoughness: 0.08 });
  const chromeDark = physical(0x71808c, 0.22, 0.94, { clearcoat: 0.55, clearcoatRoughness: 0.12 });
  const brass = physical(0xa96927, 0.28, 0.93, { clearcoat: 0.28, clearcoatRoughness: 0.18 });
  const brassBright = physical(0xe3b45c, 0.2, 0.95, { clearcoat: 0.48, clearcoatRoughness: 0.11 });
  const paintedMetal = physical(0x151c25, 0.32, 0.58, { clearcoat: 0.62, clearcoatRoughness: 0.2 });
  const graphite = physical(0x252d36, 0.42, 0.46, { clearcoat: 0.35, clearcoatRoughness: 0.28 });
  const ivory = physical(0xd8cbb0, 0.34, 0.1, { clearcoat: 0.42, clearcoatRoughness: 0.2 });
  const glass = physical(0xaddce4, 0.12, 0.06, {
    transparent: true,
    opacity: 0.72,
    transmission: 0.78,
    thickness: 0.34,
    ior: 1.46,
    clearcoat: 0.75,
    clearcoatRoughness: 0.08,
    side: THREE.DoubleSide,
    depthWrite: false,
  });
  const rubber = new THREE.MeshStandardMaterial({ color: 0x090d12, roughness: 0.8, metalness: 0.08 });
  const warmGlow = new THREE.MeshBasicMaterial({ color: 0xffb94f, transparent: true, opacity: 0.78, toneMapped: false });
  const coolGlow = new THREE.MeshBasicMaterial({ color: 0x74d8e8, transparent: true, opacity: 0.72, toneMapped: false });
  const indicatorOff = new THREE.MeshStandardMaterial({ color: 0x171e24, roughness: 0.5, metalness: 0.5, emissive: 0x000000 });

  if (environment) {
    for (const material of [chrome, chromeDark, brass, brassBright, paintedMetal, graphite, ivory, glass]) {
      material.envMap = environment;
    }
  }
  return { chrome, chromeDark, brass, brassBright, paintedMetal, graphite, ivory, glass, rubber, warmGlow, coolGlow, indicatorOff };
}

export function createStudioEnvironment(): THREE.CanvasTexture {
  const canvas = document.createElement("canvas");
  canvas.width = 1024;
  canvas.height = 512;
  const context = canvas.getContext("2d");
  if (context) {
    const gradient = context.createLinearGradient(0, 0, 0, canvas.height);
    gradient.addColorStop(0, "#1a2430");
    gradient.addColorStop(0.3, "#596575");
    gradient.addColorStop(0.5, "#d0c6ad");
    gradient.addColorStop(0.68, "#29333c");
    gradient.addColorStop(1, "#090d13");
    context.fillStyle = gradient;
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.globalAlpha = 0.2;
    for (let index = 0; index < 8; index += 1) {
      context.fillStyle = index % 2 === 0 ? "#fff3cd" : "#79b9cc";
      context.fillRect(index * 150 + 42, 52, 70, 250);
    }
    context.globalAlpha = 1;
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.mapping = THREE.EquirectangularReflectionMapping;
  texture.needsUpdate = true;
  return texture;
}
