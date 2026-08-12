import * as THREE from "three";

import { COURSE_X, type MachineTracks } from "./courseTracks";
import { createFunnelGeometry, createRoundedBlock, createTubeRail } from "./machineGeometry";
import type { MachineMaterials } from "./machineMaterials";
import { addBearingHousing, addFastener, addMesh, addRailPair, addRodBetween } from "./machinePrimitives";

export type OrbitAssembly = {
  readonly group: THREE.Group;
  readonly balance: THREE.Group;
  readonly turbine: THREE.Group;
  readonly funnel: THREE.Mesh;
  readonly funnelRim: THREE.Mesh;
};

export function createOrbitAssembly(
  tracks: MachineTracks,
  materials: MachineMaterials,
  railSegments: number,
  railRadialSegments: number,
): OrbitAssembly {
  const group = new THREE.Group();
  group.name = "orbit-assembly";
  const c = COURSE_X.C;

  const funnel = addMesh(group, createFunnelGeometry(Math.max(96, railSegments)), materials.glass, [c, 4.95, 0.06], false, false);
  funnel.rotation.x = Math.PI;
  funnel.renderOrder = 3;
  const funnelRim = addMesh(group, new THREE.TorusGeometry(1.72, 0.09, 24, 128), materials.chrome, [c, 4.94, 0.06], true, false);
  funnelRim.rotation.x = Math.PI / 2;
  const mountingRing = addMesh(group, new THREE.TorusGeometry(1.46, 0.12, 24, 112), materials.brassBright, [c, 4.76, 0.06], true, false);
  mountingRing.rotation.x = Math.PI / 2;
  for (const angle of [0.16, Math.PI * 0.72, Math.PI * 1.38, Math.PI * 1.94]) {
    const point = new THREE.Vector3(c + Math.cos(angle) * 1.58, 4.88, 0.06 + Math.sin(angle) * 0.74);
    addRodBetween(group, new THREE.Vector3(point.x, 4.0, point.z), point, 0.052, materials.chromeDark, 22);
    addFastener(group, [point.x, point.y, point.z], materials, "z", 0.76);
  }
  addRailPair(group, tracks.funnelFeed, 0.26, materials.chrome, Math.round(railSegments * 0.64), Math.max(12, railRadialSegments - 2), 0);
  addMesh(group, createTubeRail(tracks.funnel, 0.052, Math.round(railSegments * 0.8), Math.max(12, railRadialSegments - 4)), materials.chromeDark, [0, 0, 0]);

  const balance = new THREE.Group();
  balance.name = "orbit-balance";
  balance.position.set(c + 0.38, 4.45, 0.16);
  addBearingHousing(balance, [0, 0, 0.2], materials, 0.86, Math.PI / 2);
  addMesh(balance, createRoundedBlock(2.72, 0.18, 0.34, 0.06, 4), materials.chromeDark, [0, 0, 0]);
  addMesh(balance, createRoundedBlock(1.0, 0.08, 0.32, 0.025, 2), materials.brass, [-0.82, 0.16, 0], false, false);
  addMesh(balance, createRoundedBlock(1.0, 0.08, 0.32, 0.025, 2), materials.brass, [0.82, -0.16, 0], false, false);
  addMesh(balance, new THREE.CylinderGeometry(0.25, 0.25, 0.2, 36), materials.ivory, [-1.08, 0.2, 0]);
  addMesh(balance, new THREE.CylinderGeometry(0.21, 0.21, 0.18, 36), materials.brassBright, [1.1, -0.2, 0]);
  const stop = addMesh(balance, createRoundedBlock(0.16, 0.72, 0.2, 0.04, 3), materials.graphite, [1.48, 0, 0.16]);
  stop.rotation.z = Math.PI * 0.08;
  group.add(balance);

  const orbitSupport = new THREE.Group();
  addRailPair(orbitSupport, tracks.orbit, 0.2, materials.chrome, Math.round(railSegments * 0.74), Math.max(12, railRadialSegments - 3), 0);
  for (const point of [tracks.orbit.getPointAt(0.12), tracks.orbit.getPointAt(0.52), tracks.orbit.getPointAt(0.86)]) {
    addRodBetween(orbitSupport, new THREE.Vector3(point.x, 1.65, -1.04), point, 0.045, materials.brass, 20);
    addBearingHousing(orbitSupport, [point.x, point.y, point.z - 0.14], materials, 0.58, Math.PI / 2);
  }
  group.add(orbitSupport);

  const turbine = new THREE.Group();
  turbine.name = "orbit-turbine";
  turbine.position.set(c - 0.36, 2.78, 0.22);
  addBearingHousing(turbine, [0, 0, 0.18], materials, 0.95, Math.PI / 2);
  addMesh(turbine, new THREE.CylinderGeometry(0.56, 0.56, 0.18, 52), materials.brass, [0, 0, 0.1]).rotation.x = Math.PI / 2;
  for (let index = 0; index < 9; index += 1) {
    const blade = addMesh(turbine, createRoundedBlock(0.12, 0.7, 0.08, 0.025, 3), index % 2 === 0 ? materials.chrome : materials.brassBright, [Math.cos(index * Math.PI * 2 / 9) * 0.31, Math.sin(index * Math.PI * 2 / 9) * 0.31, 0.2], false, false);
    blade.rotation.z = index * Math.PI * 2 / 9 + 0.32;
  }
  addMesh(turbine, new THREE.CylinderGeometry(0.13, 0.13, 0.3, 32), materials.chromeDark, [0, 0, 0.36], false, false).rotation.x = Math.PI / 2;
  group.add(turbine);

  const returnCatch = new THREE.Group();
  returnCatch.position.set(c - 0.62, 2.12, 0.02);
  addMesh(returnCatch, createRoundedBlock(1.3, 0.18, 0.7, 0.06, 4), materials.graphite, [0, 0, 0]);
  addMesh(returnCatch, createRoundedBlock(0.9, 0.08, 0.4, 0.025, 2), materials.chrome, [0, 0.14, 0], false, false);
  group.add(returnCatch);

  return { group, balance, turbine, funnel, funnelRim };
}

export type OrbitMotion = {
  readonly balance: number;
  readonly turbine: number;
  readonly funnel: number;
};

export function updateOrbitAssembly(assembly: OrbitAssembly, motion: OrbitMotion): void {
  assembly.balance.rotation.z = -0.36 * motion.balance;
  assembly.turbine.rotation.z = motion.turbine * Math.PI * 2.1;
  assembly.funnelRim.rotation.z = motion.funnel * Math.PI * 0.32;
}
