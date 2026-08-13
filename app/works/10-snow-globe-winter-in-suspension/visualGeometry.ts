import * as THREE from "three";

export type Vec3Tuple = readonly [number, number, number];

export function addMesh(
  parent: THREE.Object3D,
  geometry: THREE.BufferGeometry,
  material: THREE.Material,
  position: Vec3Tuple | THREE.Vector3 = [0, 0, 0],
): THREE.Mesh {
  const mesh = new THREE.Mesh(geometry, material);
  if (position instanceof THREE.Vector3) {
    mesh.position.copy(position);
  } else {
    mesh.position.set(...position);
  }
  parent.add(mesh);
  return mesh;
}

export function addBox(
  parent: THREE.Object3D,
  material: THREE.Material,
  size: Vec3Tuple,
  position: Vec3Tuple,
): THREE.Mesh {
  return addMesh(parent, new THREE.BoxGeometry(...size), material, position);
}

export function createBaseProfile(): THREE.LatheGeometry {
  return new THREE.LatheGeometry(
    [
      new THREE.Vector2(0, 0.02),
      new THREE.Vector2(2.05, 0.02),
      new THREE.Vector2(2.16, 0.08),
      new THREE.Vector2(2.18, 0.2),
      new THREE.Vector2(2.12, 0.33),
      new THREE.Vector2(2.02, 0.43),
      new THREE.Vector2(2.01, 0.58),
      new THREE.Vector2(2.09, 0.69),
      new THREE.Vector2(2.11, 0.82),
      new THREE.Vector2(2.06, 0.91),
      new THREE.Vector2(1.92, 0.98),
      new THREE.Vector2(1.7, 1.03),
      new THREE.Vector2(0, 1.03),
    ],
    96,
  );
}

export function createTerrainGeometry(size = 4.4, segments = 30): THREE.BufferGeometry {
  const positions: number[] = [];
  const uvs: number[] = [];
  const indices: number[] = [];
  const half = size / 2;

  for (let zIndex = 0; zIndex <= segments; zIndex += 1) {
    const z = (zIndex / segments) * size - half;
    for (let xIndex = 0; xIndex <= segments; xIndex += 1) {
      const x = (xIndex / segments) * size - half;
      const distance = Math.sqrt(x * x + z * z);
      const edgeDrop = Math.max(0, distance - 1.48) * 0.38;
      const rearRidge = Math.exp(-((x + 0.2) ** 2) / 1.8 - ((z + 1.18) ** 2) / 0.5) * 0.23;
      const cabinMound = Math.exp(-((x + 0.58) ** 2) / 0.85 - ((z - 0.04) ** 2) / 0.68) * 0.1;
      const foregroundDip = Math.exp(-((x - 0.45) ** 2) / 0.9 - ((z - 0.75) ** 2) / 0.38) * -0.075;
      const ripple = Math.sin(x * 3.4 + z * 1.8) * 0.018 + Math.cos(z * 4.6 - x * 1.3) * 0.014;
      const y = 1.02 + rearRidge + cabinMound + foregroundDip + ripple - edgeDrop;
      positions.push(x, y, z);
      uvs.push(x / size + 0.5, z / size + 0.5);
    }
  }

  const rowSize = segments + 1;
  for (let zIndex = 0; zIndex < segments; zIndex += 1) {
    for (let xIndex = 0; xIndex < segments; xIndex += 1) {
      const topLeft = zIndex * rowSize + xIndex;
      const topRight = topLeft + 1;
      const bottomLeft = topLeft + rowSize;
      const bottomRight = bottomLeft + 1;
      indices.push(topLeft, bottomLeft, topRight, topRight, bottomLeft, bottomRight);
    }
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute("uv", new THREE.Float32BufferAttribute(uvs, 2));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  return geometry;
}

export function createGableGeometry(width: number, height: number, depth: number): THREE.ExtrudeGeometry {
  const shape = new THREE.Shape();
  shape.moveTo(-width / 2, 0);
  shape.lineTo(width / 2, 0);
  shape.lineTo(width / 2, height * 0.66);
  shape.lineTo(0, height);
  shape.lineTo(-width / 2, height * 0.66);
  shape.closePath();
  const geometry = new THREE.ExtrudeGeometry(shape, {
    depth,
    bevelEnabled: true,
    bevelSegments: 2,
    bevelSize: 0.025,
    bevelThickness: 0.025,
    curveSegments: 3,
  });
  geometry.translate(0, 0, -depth / 2);
  geometry.computeVertexNormals();
  return geometry;
}

export function createSlopedSlabGeometry(
  eave: THREE.Vector2,
  ridge: THREE.Vector2,
  depth: number,
  thickness: number,
): THREE.BufferGeometry {
  const direction = new THREE.Vector2().subVectors(ridge, eave).normalize();
  const normal = new THREE.Vector2(-direction.y, direction.x);
  if (normal.y < 0) {
    normal.negate();
  }
  const halfThickness = thickness / 2;
  const topEave = eave.clone().addScaledVector(normal, halfThickness);
  const topRidge = ridge.clone().addScaledVector(normal, halfThickness);
  const bottomEave = eave.clone().addScaledVector(normal, -halfThickness);
  const bottomRidge = ridge.clone().addScaledVector(normal, -halfThickness);
  const halfDepth = depth / 2;

  const positions = [
    topEave.x, topEave.y, -halfDepth,
    topRidge.x, topRidge.y, -halfDepth,
    topRidge.x, topRidge.y, halfDepth,
    topEave.x, topEave.y, halfDepth,
    bottomEave.x, bottomEave.y, -halfDepth,
    bottomRidge.x, bottomRidge.y, -halfDepth,
    bottomRidge.x, bottomRidge.y, halfDepth,
    bottomEave.x, bottomEave.y, halfDepth,
  ];
  const uvs = [
    0, 0,
    1, 0,
    1, 1,
    0, 1,
    0, 0,
    1, 0,
    1, 1,
    0, 1,
  ];
  const indices = [
    0, 1, 2, 0, 2, 3,
    4, 7, 6, 4, 6, 5,
    0, 4, 5, 0, 5, 1,
    3, 2, 6, 3, 6, 7,
    0, 3, 7, 0, 7, 4,
    1, 5, 6, 1, 6, 2,
  ];
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute("uv", new THREE.Float32BufferAttribute(uvs, 2));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  return geometry;
}

export function createBranchGeometry(
  start: THREE.Vector3,
  direction: THREE.Vector3,
  length: number,
  droop: number,
  radius: number,
): THREE.TubeGeometry {
  const normalized = direction.clone().normalize();
  const end = start.clone().addScaledVector(normalized, length);
  end.y -= droop;
  const shoulder = start.clone().addScaledVector(normalized, length * 0.5);
  shoulder.y += 0.025;
  const curve = new THREE.CatmullRomCurve3([start, shoulder, end]);
  return new THREE.TubeGeometry(curve, 6, radius, 6, false);
}

export function createSnowMoundGeometry(): THREE.SphereGeometry {
  return new THREE.SphereGeometry(1, 24, 14);
}

export function createSnowPatchGeometry(): THREE.OctahedronGeometry {
  return new THREE.OctahedronGeometry(1, 1);
}

export function createFoliagePadGeometry(): THREE.OctahedronGeometry {
  return new THREE.OctahedronGeometry(1, 2);
}
