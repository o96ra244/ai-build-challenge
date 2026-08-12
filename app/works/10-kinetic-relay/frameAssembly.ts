import * as THREE from "three";

import { COURSE_X } from "./courseTracks";
import { createRoundedBlock } from "./machineGeometry";
import type { MachineMaterials } from "./machineMaterials";
import { addFastener, addMesh, addPanelSeam, addRodBetween } from "./machinePrimitives";

export type FrameAssembly = {
  readonly group: THREE.Group;
  readonly base: THREE.Mesh;
};

export function createFrameAssembly(materials: MachineMaterials): FrameAssembly {
  const group = new THREE.Group();
  group.name = "machine-frame";

  const base = addMesh(group, createRoundedBlock(16.6, 0.58, 5.25, 0.18, 6), materials.paintedMetal, [0, 0, 0]);
  base.receiveShadow = true;
  addMesh(group, createRoundedBlock(15.85, 0.13, 4.55, 0.045, 3), materials.graphite, [0, 0.35, 0.08], false, true);
  addMesh(group, createRoundedBlock(15.9, 8.35, 0.24, 0.08, 4), materials.graphite, [0, 4.74, -1.78], false, true);

  const postXs = [-7.62, 7.62];
  for (const x of postXs) {
    for (const z of [-1.22, 1.46]) {
      addMesh(group, createRoundedBlock(0.46, 8.65, 0.46, 0.1, 5), materials.paintedMetal, [x, 4.62, z]);
      addMesh(group, new THREE.CylinderGeometry(0.26, 0.26, 0.22, 48), materials.brass, [x, 0.46, z]);
      addMesh(group, new THREE.CylinderGeometry(0.21, 0.21, 0.22, 48), materials.brassBright, [x, 8.96, z]);
    }
  }

  addMesh(group, createRoundedBlock(15.7, 0.44, 0.54, 0.1, 4), materials.paintedMetal, [0, 9.0, 1.42]);
  addMesh(group, createRoundedBlock(15.0, 0.14, 0.16, 0.03, 2), materials.brass, [0, 9.27, 1.42], false, false);
  addMesh(group, createRoundedBlock(15.6, 0.44, 0.54, 0.1, 4), materials.paintedMetal, [0, 0.7, -1.18]);
  addMesh(group, createRoundedBlock(15.0, 0.12, 0.15, 0.03, 2), materials.brass, [0, 0.93, -1.18], false, false);

  const spine = addMesh(group, createRoundedBlock(0.62, 7.65, 0.45, 0.12, 5), materials.paintedMetal, [0, 4.75, -1.25]);
  spine.receiveShadow = true;
  addPanelSeam(group, [0, 4.75, -1.01], [0.08, 6.68, 0.025], materials);

  for (const x of [...Object.values(COURSE_X), -2.32, 2.32]) {
    addRodBetween(group, new THREE.Vector3(x, 1.05, 1.18), new THREE.Vector3(x, 8.56, 1.18), 0.055, materials.brass, 24);
    addPanelSeam(group, [x, 4.72, -1.0], [0.035, 6.9, 0.018], materials);
  }

  for (const x of Object.values(COURSE_X)) {
    addMesh(group, createRoundedBlock(3.82, 0.12, 0.08, 0.02, 2), materials.brass, [x, 7.72, 1.04], false, false);
    addMesh(group, createRoundedBlock(3.72, 0.08, 0.08, 0.02, 2), materials.chromeDark, [x, 1.18, 1.0], false, false);
  }

  const fastenerRows = [1.26, 8.32];
  for (const y of fastenerRows) {
    for (const x of [-6.95, -4.05, -1.1, 1.1, 4.05, 6.95]) {
      addFastener(group, [x, y, -1.0], materials, "z", 0.92);
    }
  }

  const sideBracePairs: readonly [number, number][] = [
    [-6.55, -1.2], [-3.1, -1.2], [3.1, -1.2], [6.55, -1.2],
  ];
  for (const [x, z] of sideBracePairs) {
    addRodBetween(group, new THREE.Vector3(x, 1.1, z), new THREE.Vector3(x + (x < 0 ? 0.48 : -0.48), 8.45, z), 0.04, materials.chromeDark, 20);
  }

  const upperHousing = new THREE.Group();
  upperHousing.position.set(0, 7.78, 0.8);
  addMesh(upperHousing, createRoundedBlock(11.85, 0.5, 1.15, 0.12, 5), materials.graphite, [0, 0, 0]);
  addMesh(upperHousing, createRoundedBlock(11.2, 0.07, 0.68, 0.02, 2), materials.paintedMetal, [0, 0.3, 0.03], false, false);
  for (const x of [-5.2, -2.6, 0, 2.6, 5.2]) {
    addFastener(upperHousing, [x, 0.08, 0.42], materials, "z", 0.78);
  }
  group.add(upperHousing);

  const lowerManifold = new THREE.Group();
  lowerManifold.position.set(0, 1.25, 0.52);
  addMesh(lowerManifold, createRoundedBlock(12.9, 0.38, 1.08, 0.12, 5), materials.graphite, [0, 0, 0]);
  addMesh(lowerManifold, createRoundedBlock(11.9, 0.08, 0.55, 0.025, 2), materials.brass, [0, 0.24, 0.02], false, false);
  for (const x of [-5.2, -2.6, 0, 2.6, 5.2]) {
    addFastener(lowerManifold, [x, 0.08, 0.42], materials, "z", 0.72);
  }
  group.add(lowerManifold);

  const junction = new THREE.Group();
  junction.position.set(0, 7.35, 1.0);
  addMesh(junction, new THREE.CylinderGeometry(0.58, 0.64, 0.22, 64), materials.chrome, [0, 0, 0]);
  addMesh(junction, new THREE.TorusGeometry(0.7, 0.055, 16, 64), materials.brassBright, [0, 0, 0.13], false, false).rotation.x = Math.PI / 2;
  addMesh(junction, new THREE.CylinderGeometry(0.2, 0.2, 0.38, 32), materials.graphite, [0, 0.17, 0]);
  addRodBetween(junction, new THREE.Vector3(-0.8, 0, 0), new THREE.Vector3(0.8, 0, 0), 0.045, materials.chromeDark, 20);
  group.add(junction);

  return { group, base };
}
