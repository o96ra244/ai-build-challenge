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
    envMapIntensity: 1.45,
    ...options,
  });
}

function createSurfaceTexture(mode: "brush" | "grain" | "paint"): THREE.CanvasTexture {
  const canvas = document.createElement("canvas");
  canvas.width = 512;
  canvas.height = 128;
  const context = canvas.getContext("2d");
  if (context) {
    const image = context.createImageData(canvas.width, canvas.height);
    for (let y = 0; y < canvas.height; y += 1) {
      for (let x = 0; x < canvas.width; x += 1) {
        const index = (y * canvas.width + x) * 4;
        const wave = Math.sin((x * (mode === "brush" ? 0.55 : 0.13)) + y * 0.42) * 6;
        const noise = ((x * 17 + y * 31 + x * y * 3) % 19) - 9;
        const value = mode === "paint" ? 132 + noise * 0.35 : 142 + wave + noise;
        image.data[index] = value;
        image.data[index + 1] = value;
        image.data[index + 2] = value;
        image.data[index + 3] = 255;
      }
    }
    context.putImageData(image, 0, 0);
    if (mode === "brush") {
      context.globalAlpha = 0.2;
      context.strokeStyle = "#ffffff";
      context.lineWidth = 1;
      for (let y = -128; y < 256; y += 7) {
        context.beginPath();
        context.moveTo(0, y);
        context.lineTo(canvas.width, y + 72);
        context.stroke();
      }
      context.globalAlpha = 1;
    }
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.NoColorSpace;
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(3.2, 1.1);
  texture.anisotropy = 4;
  texture.needsUpdate = true;
  return texture;
}

function createStudioEnvironment(): THREE.CanvasTexture {
  const canvas = document.createElement("canvas");
  canvas.width = 1536;
  canvas.height = 768;
  const context = canvas.getContext("2d");
  if (context) {
    const gradient = context.createLinearGradient(0, 0, 0, canvas.height);
    gradient.addColorStop(0, "#0b121b");
    gradient.addColorStop(0.24, "#2b3a47");
    gradient.addColorStop(0.46, "#b3b7ad");
    gradient.addColorStop(0.54, "#525e63");
    gradient.addColorStop(0.77, "#1b262d");
    gradient.addColorStop(1, "#05090e");
    context.fillStyle = gradient;
    context.fillRect(0, 0, canvas.width, canvas.height);

    const panels = [
      { x: 80, width: 260, color: "rgba(255, 244, 211, 0.62)" },
      { x: 420, width: 110, color: "rgba(122, 205, 220, 0.34)" },
      { x: 690, width: 330, color: "rgba(255, 239, 195, 0.42)" },
      { x: 1130, width: 150, color: "rgba(146, 215, 224, 0.3)" },
    ];
    for (const panel of panels) {
      const panelGradient = context.createLinearGradient(panel.x, 0, panel.x + panel.width, 0);
      panelGradient.addColorStop(0, "rgba(0,0,0,0)");
      panelGradient.addColorStop(0.35, panel.color);
      panelGradient.addColorStop(0.65, panel.color);
      panelGradient.addColorStop(1, "rgba(0,0,0,0)");
      context.fillStyle = panelGradient;
      context.fillRect(panel.x, 50, panel.width, 470);
    }
    context.globalAlpha = 0.18;
    context.strokeStyle = "#f6e7c4";
    context.lineWidth = 2;
    for (let x = 0; x < canvas.width; x += 96) {
      context.beginPath();
      context.moveTo(x, 0);
      context.lineTo(x + 230, canvas.height);
      context.stroke();
    }
    context.globalAlpha = 1;
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.mapping = THREE.EquirectangularReflectionMapping;
  texture.needsUpdate = true;
  return texture;
}

export function createMachineMaterials(environment: THREE.Texture | null): MachineMaterials {
  const chromeRoughness = createSurfaceTexture("grain");
  const brassRoughness = createSurfaceTexture("brush");
  const paintRoughness = createSurfaceTexture("paint");
  const brushedNormal = createSurfaceTexture("brush");
  const chrome = physical(0xd7e4e8, 0.16, 0.98, {
    clearcoat: 0.82,
    clearcoatRoughness: 0.08,
    roughnessMap: chromeRoughness,
    normalMap: brushedNormal,
    normalScale: new THREE.Vector2(0.025, 0.025),
  });
  const chromeDark = physical(0x53626c, 0.24, 0.95, {
    clearcoat: 0.6,
    clearcoatRoughness: 0.14,
    roughnessMap: chromeRoughness,
  });
  const brass = physical(0xb47832, 0.3, 0.93, {
    clearcoat: 0.38,
    clearcoatRoughness: 0.16,
    roughnessMap: brassRoughness,
    normalMap: brushedNormal,
    normalScale: new THREE.Vector2(0.045, 0.02),
    anisotropy: 0.32,
  });
  const brassBright = physical(0xe5b760, 0.22, 0.96, {
    clearcoat: 0.62,
    clearcoatRoughness: 0.1,
    roughnessMap: brassRoughness,
    normalMap: brushedNormal,
    normalScale: new THREE.Vector2(0.028, 0.012),
    anisotropy: 0.24,
  });
  const paintedMetal = physical(0x101820, 0.34, 0.62, {
    clearcoat: 0.74,
    clearcoatRoughness: 0.2,
    roughnessMap: paintRoughness,
  });
  const graphite = physical(0x202a33, 0.45, 0.48, {
    clearcoat: 0.4,
    clearcoatRoughness: 0.28,
    roughnessMap: paintRoughness,
  });
  const ivory = physical(0xd8c7a6, 0.36, 0.1, { clearcoat: 0.46, clearcoatRoughness: 0.2 });
  const glass = physical(0xb9e7eb, 0.1, 0.03, {
    transparent: true,
    opacity: 0.78,
    transmission: 0.9,
    thickness: 0.2,
    ior: 1.46,
    clearcoat: 0.95,
    clearcoatRoughness: 0.04,
    attenuationColor: new THREE.Color(0x76bac5),
    attenuationDistance: 3.8,
    side: THREE.DoubleSide,
    depthWrite: false,
  });
  const rubber = new THREE.MeshStandardMaterial({ color: 0x080d12, roughness: 0.86, metalness: 0.06 });
  const warmGlow = new THREE.MeshBasicMaterial({ color: 0xffb449, transparent: true, opacity: 0.84, toneMapped: false });
  const coolGlow = new THREE.MeshBasicMaterial({ color: 0x6de0eb, transparent: true, opacity: 0.76, toneMapped: false });
  const indicatorOff = new THREE.MeshStandardMaterial({ color: 0x111a20, roughness: 0.52, metalness: 0.55, emissive: 0x000000 });

  if (environment) {
    for (const material of [chrome, chromeDark, brass, brassBright, paintedMetal, graphite, ivory, glass]) {
      material.envMap = environment;
    }
  }
  return {
    chrome,
    chromeDark,
    brass,
    brassBright,
    paintedMetal,
    graphite,
    ivory,
    glass,
    rubber,
    warmGlow,
    coolGlow,
    indicatorOff,
  };
}

export { createStudioEnvironment };
