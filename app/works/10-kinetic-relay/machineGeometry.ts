import * as THREE from "three";
import { RoundedBoxGeometry } from "three/addons/geometries/RoundedBoxGeometry.js";

export type Vector3Tuple = readonly [number, number, number];

export function createRoundedBlock(
  width: number,
  height: number,
  depth: number,
  radius = Math.min(width, height, depth) * 0.08,
  segments = 4,
): RoundedBoxGeometry {
  return new RoundedBoxGeometry(width, height, depth, segments, Math.max(0.01, radius));
}

export function createTubeRail(
  curve: THREE.Curve<THREE.Vector3>,
  radius: number,
  tubularSegments = 192,
  radialSegments = 20,
): THREE.TubeGeometry {
  return new THREE.TubeGeometry(curve, tubularSegments, radius, radialSegments, false);
}

export function createGearProfile(
  teeth: number,
  innerRadius: number,
  rootRadius: number,
  outerRadius: number,
): readonly Vector3Tuple[] {
  const safeTeeth = Math.max(3, Math.floor(teeth));
  const step = (Math.PI * 2) / safeTeeth;
  const points: Vector3Tuple[] = [];
  for (let index = 0; index < safeTeeth; index += 1) {
    const start = index * step - step * 0.5;
    const samples: readonly [number, number][] = [
      [start, innerRadius],
      [start + step * 0.1, rootRadius],
      [start + step * 0.21, outerRadius],
      [start + step * 0.68, outerRadius],
      [start + step * 0.79, rootRadius],
      [start + step * 0.9, innerRadius],
    ];
    for (const [angle, radius] of samples) {
      points.push([Math.cos(angle) * radius, Math.sin(angle) * radius, 0]);
    }
  }
  return points;
}

export function createGearGeometry(
  teeth: number,
  innerRadius: number,
  rootRadius: number,
  outerRadius: number,
  depth = 0.18,
): THREE.ExtrudeGeometry {
  const points = createGearProfile(teeth, innerRadius, rootRadius, outerRadius);
  const shape = new THREE.Shape();
  points.forEach(([x, y], index) => {
    if (index === 0) {
      shape.moveTo(x, y);
    } else {
      shape.lineTo(x, y);
    }
  });
  shape.closePath();
  const geometry = new THREE.ExtrudeGeometry(shape, {
    depth,
    bevelEnabled: true,
    bevelSegments: 3,
    bevelSize: 0.035,
    bevelThickness: 0.035,
    curveSegments: 4,
  });
  geometry.center();
  geometry.computeVertexNormals();
  return geometry;
}

export function createFunnelGeometry(segments = 128): THREE.LatheGeometry {
  const profile = [
    new THREE.Vector2(0.08, 0),
    new THREE.Vector2(0.3, 0.04),
    new THREE.Vector2(0.86, 0.13),
    new THREE.Vector2(1.35, 0.34),
    new THREE.Vector2(1.62, 0.7),
    new THREE.Vector2(1.56, 1.08),
    new THREE.Vector2(1.3, 1.42),
    new THREE.Vector2(0.94, 1.68),
    new THREE.Vector2(0.48, 1.86),
    new THREE.Vector2(0.12, 1.94),
  ];
  const geometry = new THREE.LatheGeometry(profile, Math.max(32, segments));
  geometry.computeVertexNormals();
  return geometry;
}

export function createLabelSprite(
  label: string,
  color: string,
  width = 2.2,
  height = 0.48,
): THREE.Sprite {
  const canvas = document.createElement("canvas");
  canvas.width = 768;
  canvas.height = 160;
  const context = canvas.getContext("2d");
  if (context) {
    context.clearRect(0, 0, canvas.width, canvas.height);
    context.fillStyle = "rgba(4, 7, 11, 0.82)";
    context.fillRect(2, 2, canvas.width - 4, canvas.height - 4);
    context.strokeStyle = "rgba(214, 179, 111, 0.56)";
    context.lineWidth = 4;
    context.strokeRect(4, 4, canvas.width - 8, canvas.height - 8);
    context.fillStyle = color;
    context.font = "600 46px 'SFMono-Regular', 'Roboto Mono', monospace";
    context.textAlign = "center";
    context.textBaseline = "middle";
    context.fillText(label, canvas.width / 2, canvas.height / 2 + 3);
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.needsUpdate = true;
  const material = new THREE.SpriteMaterial({ map: texture, transparent: true, depthWrite: false });
  const sprite = new THREE.Sprite(material);
  sprite.scale.set(width, height, 1);
  return sprite;
}

export function createStudGeometry(radius = 0.075, depth = 0.07): THREE.CylinderGeometry {
  return new THREE.CylinderGeometry(radius, radius * 1.08, depth, 32, 2);
}

export function createWasherGeometry(
  innerRadius = 0.13,
  outerRadius = 0.24,
): THREE.TorusGeometry {
  return new THREE.TorusGeometry((innerRadius + outerRadius) / 2, (outerRadius - innerRadius) / 2, 16, 48);
}
