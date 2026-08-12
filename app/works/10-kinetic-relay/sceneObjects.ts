import * as THREE from "three";

import type { MaterialKey, Vector3Tuple } from "./deskLayout";

export type MaterialSet = Record<MaterialKey | "ink" | "pencil" | "yellow" | "red" | "blue" | "brass" | "bell", THREE.MeshStandardMaterial>;
export type GeometryCache = Map<string, THREE.BoxGeometry>;

export function createMaterial(
  color: number,
  options: { readonly roughness?: number; readonly metalness?: number; readonly transparent?: boolean; readonly opacity?: number } = {},
): THREE.MeshStandardMaterial {
  return new THREE.MeshStandardMaterial({
    color,
    roughness: options.roughness ?? 0.78,
    metalness: options.metalness ?? 0.03,
    transparent: options.transparent ?? false,
    opacity: options.opacity ?? 1,
  });
}

export function getBoxGeometry(cache: GeometryCache, id: string, size: Vector3Tuple): THREE.BoxGeometry {
  const key = `${id}:${size.join(",")}`;
  const existing = cache.get(key);
  if (existing) return existing;
  const geometry = new THREE.BoxGeometry(...size);
  cache.set(key, geometry);
  return geometry;
}

export function addBox(
  parent: THREE.Object3D,
  cache: GeometryCache,
  material: THREE.Material,
  id: string,
  size: Vector3Tuple,
  position: Vector3Tuple,
  rotation: Vector3Tuple = [0, 0, 0],
  shadow = true,
): THREE.Mesh {
  const mesh = new THREE.Mesh(getBoxGeometry(cache, id, size), material);
  mesh.position.set(...position);
  mesh.rotation.set(...rotation);
  mesh.castShadow = shadow;
  mesh.receiveShadow = shadow;
  parent.add(mesh);
  return mesh;
}

export function addCylinder(
  parent: THREE.Object3D,
  material: THREE.Material,
  radiusTop: number,
  radiusBottom: number,
  height: number,
  position: Vector3Tuple,
  rotation: Vector3Tuple = [0, 0, 0],
  segments = 12,
): THREE.Mesh {
  const mesh = new THREE.Mesh(new THREE.CylinderGeometry(radiusTop, radiusBottom, height, segments), material);
  mesh.position.set(...position);
  mesh.rotation.set(...rotation);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  parent.add(mesh);
  return mesh;
}

export function addBeam(parent: THREE.Object3D, start: Vector3Tuple, end: Vector3Tuple, radius: number, material: THREE.Material): THREE.Mesh {
  const startVector = new THREE.Vector3(...start);
  const direction = new THREE.Vector3(...end).sub(startVector);
  const mesh = new THREE.Mesh(new THREE.CylinderGeometry(radius, radius, direction.length(), 8), material);
  mesh.position.copy(startVector.clone().add(direction).multiplyScalar(0.5));
  mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), direction.normalize());
  mesh.castShadow = true;
  parent.add(mesh);
  return mesh;
}

export function disposeSceneResources(scene: THREE.Scene): void {
  const geometries = new Set<THREE.BufferGeometry>();
  const materials = new Set<THREE.Material>();
  const textures = new Set<THREE.Texture>();
  scene.traverse((object) => {
    if (!(object instanceof THREE.Mesh || object instanceof THREE.Sprite)) return;
    geometries.add(object.geometry);
    const objectMaterials = Array.isArray(object.material) ? object.material : [object.material];
    objectMaterials.forEach((material) => {
      materials.add(material);
      if (material instanceof THREE.MeshStandardMaterial && material.map) textures.add(material.map);
      if (material instanceof THREE.SpriteMaterial && material.map) textures.add(material.map);
    });
  });
  geometries.forEach((geometry) => geometry.dispose());
  materials.forEach((material) => material.dispose());
  textures.forEach((texture) => texture.dispose());
}
