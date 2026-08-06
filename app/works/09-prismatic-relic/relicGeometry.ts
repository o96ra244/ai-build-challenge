import * as THREE from "three";

export type RelicGeometryKind = "outer" | "core";

export type RelicBounds = {
  readonly min: readonly [number, number, number];
  readonly max: readonly [number, number, number];
  readonly maxRadius: number;
};

function hashNoise(seed: number, index: number): number {
  let value = (Math.imul(Math.trunc(seed), 1_664_525) + Math.imul(index + 1, 1_013_904_223)) >>> 0;
  value ^= value >>> 16;
  value = Math.imul(value, 2_246_822_519) >>> 0;
  value ^= value >>> 13;
  return (value / 4_294_967_295) * 2 - 1;
}

function safeValue(value: number, fallback: number): number {
  return Number.isFinite(value) ? value : fallback;
}

export function generateRelicPositions(
  seed: number,
  detail: number,
  kind: RelicGeometryKind = "outer",
): Float32Array {
  const base = new THREE.IcosahedronGeometry(1, Math.max(0, Math.min(4, Math.floor(detail))));
  const source = base.getAttribute("position");
  const positions = new Float32Array(source.count * 3);

  for (let index = 0; index < source.count; index += 1) {
    const x = source.getX(index);
    const y = source.getY(index);
    const z = source.getZ(index);
    const length = Math.max(0.0001, Math.hypot(x, y, z));
    const nx = x / length;
    const ny = y / length;
    const nz = z / length;
    const noise = hashNoise(seed, index);

    let nextX: number;
    let nextY: number;
    let nextZ: number;
    if (kind === "core") {
      const facet = Math.sin(nx * 5.4 + ny * 2.1 + seed * 0.17) * 0.08;
      const taper = 0.74 + ny * 0.08 + facet + noise * 0.035;
      nextX = nx * (0.58 + taper * 0.18) + ny * 0.08 + noise * 0.035;
      nextY = ny * (0.98 + Math.sin(nz * 4.2 + seed) * 0.08) + Math.sin(nx * 3.2) * 0.035;
      nextZ = nz * (0.45 + taper * 0.12) + nx * 0.045 - noise * 0.025;
    } else {
      const latitude = Math.abs(ny);
      const ridge = Math.sin(nx * 3.7 + nz * 2.4 + seed * 0.11);
      const facet = Math.cos(nz * 5.6 - nx * 1.8 + seed * 0.07);
      const waist = 1 - latitude * 0.08;
      const radius = 1.01 + ridge * 0.095 + facet * 0.06 + noise * 0.045;
      nextX = nx * radius * (0.94 + 0.12 * Math.sin(ny * 2.2 + seed)) + nz * 0.075 * (1 - ny);
      nextY = ny * radius * (1.12 + 0.08 * Math.cos(nx * 3.4 + seed)) + ridge * 0.055 + (1 - waist) * 0.05;
      nextZ = nz * radius * (0.82 + 0.14 * Math.cos(ny * 2.7 - seed)) + nx * 0.055 + noise * 0.025;
    }

    positions[index * 3] = safeValue(nextX, nx);
    positions[index * 3 + 1] = safeValue(nextY, ny);
    positions[index * 3 + 2] = safeValue(nextZ, nz);
  }

  base.dispose();
  return positions;
}

export function createRelicGeometry(
  seed: number,
  detail: number,
  kind: RelicGeometryKind = "outer",
): THREE.BufferGeometry {
  const geometry = new THREE.IcosahedronGeometry(1, Math.max(0, Math.min(4, Math.floor(detail))));
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(generateRelicPositions(seed, detail, kind), 3));
  geometry.computeVertexNormals();
  geometry.computeBoundingBox();
  geometry.computeBoundingSphere();
  return geometry;
}

export function getRelicBounds(positions: ArrayLike<number>): RelicBounds {
  const min: [number, number, number] = [Infinity, Infinity, Infinity];
  const max: [number, number, number] = [-Infinity, -Infinity, -Infinity];
  let maxRadius = 0;

  for (let index = 0; index + 2 < positions.length; index += 3) {
    const x = positions[index] ?? 0;
    const y = positions[index + 1] ?? 0;
    const z = positions[index + 2] ?? 0;
    min[0] = Math.min(min[0], x);
    min[1] = Math.min(min[1], y);
    min[2] = Math.min(min[2], z);
    max[0] = Math.max(max[0], x);
    max[1] = Math.max(max[1], y);
    max[2] = Math.max(max[2], z);
    maxRadius = Math.max(maxRadius, Math.hypot(x, y, z));
  }

  return {
    min,
    max,
    maxRadius: Number.isFinite(maxRadius) ? maxRadius : 0,
  };
}

export function getRelicVertexCount(detail: number): number {
  const geometry = new THREE.IcosahedronGeometry(1, Math.max(0, Math.min(4, Math.floor(detail))));
  const count = geometry.getAttribute("position").count;
  geometry.dispose();
  return count;
}
