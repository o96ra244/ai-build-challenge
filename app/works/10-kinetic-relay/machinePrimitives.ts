import * as THREE from "three";

import { createRoundedBlock, createStudGeometry, createWasherGeometry, type Vector3Tuple } from "./machineGeometry";
import type { MachineMaterials } from "./machineMaterials";

export function addMesh(
  parent: THREE.Object3D,
  geometry: THREE.BufferGeometry,
  material: THREE.Material,
  position: Vector3Tuple = [0, 0, 0],
  castShadow = true,
  receiveShadow = true,
): THREE.Mesh {
  const mesh = new THREE.Mesh(geometry, material);
  mesh.position.set(...position);
  mesh.castShadow = castShadow;
  mesh.receiveShadow = receiveShadow;
  parent.add(mesh);
  return mesh;
}

export function addRodBetween(
  parent: THREE.Object3D,
  start: THREE.Vector3,
  end: THREE.Vector3,
  radius: number,
  material: THREE.Material,
  segments = 32,
): THREE.Mesh {
  const direction = new THREE.Vector3().subVectors(end, start);
  const mesh = addMesh(
    parent,
    new THREE.CylinderGeometry(radius, radius * 1.04, Math.max(0.02, direction.length()), segments, 2),
    material,
  );
  mesh.position.copy(start).add(end).multiplyScalar(0.5);
  mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), direction.normalize());
  return mesh;
}

export function addBearingHousing(
  parent: THREE.Object3D,
  position: Vector3Tuple,
  materials: MachineMaterials,
  scale = 1,
  rotationY = 0,
): THREE.Group {
  const housing = new THREE.Group();
  housing.position.set(...position);
  housing.rotation.y = rotationY;
  addMesh(housing, createRoundedBlock(0.58 * scale, 0.42 * scale, 0.46 * scale, 0.08 * scale, 5), materials.graphite, [0, 0, 0]);
  const face = addMesh(housing, new THREE.CylinderGeometry(0.2 * scale, 0.2 * scale, 0.08 * scale, 40), materials.chrome, [0, 0, 0.27 * scale]);
  face.rotation.x = Math.PI / 2;
  const washer = addMesh(housing, createWasherGeometry(0.12 * scale, 0.23 * scale), materials.brassBright, [0, 0, 0.32 * scale], false, false);
  washer.rotation.x = Math.PI / 2;
  const axle = addMesh(housing, new THREE.CylinderGeometry(0.08 * scale, 0.08 * scale, 0.42 * scale, 24), materials.chromeDark, [0, 0, 0.38 * scale], false, false);
  axle.rotation.x = Math.PI / 2;
  parent.add(housing);
  return housing;
}

export function addFastener(
  parent: THREE.Object3D,
  position: Vector3Tuple,
  materials: MachineMaterials,
  axis: "x" | "y" | "z" = "z",
  scale = 1,
): THREE.Group {
  const fastener = new THREE.Group();
  fastener.position.set(...position);
  const stud = addMesh(fastener, createStudGeometry(0.075 * scale, 0.09 * scale), materials.brassBright, [0, 0, 0], false, false);
  const washer = addMesh(fastener, createWasherGeometry(0.1 * scale, 0.17 * scale), materials.chromeDark, [0, 0, 0], false, false);
  if (axis === "x") {
    stud.rotation.z = Math.PI / 2;
    washer.rotation.y = Math.PI / 2;
  } else if (axis === "z") {
    stud.rotation.x = Math.PI / 2;
    washer.rotation.x = Math.PI / 2;
  }
  void washer;
  parent.add(fastener);
  return fastener;
}

export function addRailPair(
  parent: THREE.Object3D,
  source: THREE.CatmullRomCurve3,
  separation: number,
  material: THREE.Material,
  tubularSegments: number,
  radialSegments: number,
  zOffset = 0,
): THREE.Group {
  const pair = new THREE.Group();
  const points = source.getPoints(Math.max(8, Math.round(tubularSegments / 3)));
  const left = new THREE.CatmullRomCurve3(points.map((point) => new THREE.Vector3(point.x, point.y, point.z - separation / 2 + zOffset)));
  const right = new THREE.CatmullRomCurve3(points.map((point) => new THREE.Vector3(point.x, point.y, point.z + separation / 2 + zOffset)));
  const railGeometry = (curve: THREE.CatmullRomCurve3): THREE.TubeGeometry => new THREE.TubeGeometry(curve, tubularSegments, 0.075, radialSegments, false);
  addMesh(pair, railGeometry(left), material);
  addMesh(pair, railGeometry(right), material);
  parent.add(pair);
  return pair;
}

export function addPanelSeam(
  parent: THREE.Object3D,
  position: Vector3Tuple,
  size: Vector3Tuple,
  materials: MachineMaterials,
  rotation: Vector3Tuple = [0, 0, 0],
): THREE.Mesh {
  const seam = addMesh(parent, createRoundedBlock(...size, 0.015, 2), materials.chromeDark, position, false, false);
  seam.rotation.set(...rotation);
  return seam;
}

export function addRouteBrace(
  parent: THREE.Object3D,
  point: THREE.Vector3,
  backZ: number,
  materials: MachineMaterials,
): THREE.Group {
  const brace = new THREE.Group();
  addRodBetween(brace, new THREE.Vector3(point.x, point.y - 0.42, backZ), point, 0.045, materials.brass, 20);
  addBearingHousing(brace, point.toArray() as Vector3Tuple, materials, 0.72, Math.PI / 2);
  parent.add(brace);
  return brace;
}
