import * as THREE from "three";

import { COURSE_X } from "./courseTracks";
import { createRoundedBlock, createTubeRail } from "./machineGeometry";
import type { MachineMaterials } from "./machineMaterials";
import { addBearingHousing, addFastener, addMesh, addRodBetween } from "./machinePrimitives";
import { getSelectorOffset, type SelectorState } from "./routeSelector";

export type SelectorAssembly = {
  readonly group: THREE.Group;
  readonly platform: THREE.Group;
  readonly lockPin: THREE.Mesh;
  readonly lockCollar: THREE.Mesh;
  readonly linkage: THREE.Group;
  readonly lamp: THREE.Mesh;
  readonly indicatorMaterials: Record<"A" | "B" | "C", THREE.MeshStandardMaterial>;
};

function makeIndicatorMaterial(base: THREE.MeshStandardMaterial, color: number): THREE.MeshStandardMaterial {
  const material = base.clone();
  material.emissive = new THREE.Color(color);
  material.emissiveIntensity = 0.02;
  return material;
}

export function createSelectorAssembly(materials: MachineMaterials): SelectorAssembly {
  const group = new THREE.Group();
  group.name = "route-selector";
  group.position.set(0, 7.84, 0.82);

  addMesh(group, createRoundedBlock(12.65, 0.18, 1.22, 0.06, 4), materials.paintedMetal, [0, 0, 0]);
  addMesh(group, createRoundedBlock(12.2, 0.06, 0.74, 0.02, 2), materials.brass, [0, 0.14, 0], false, false);
  const guide = new THREE.Line(
    new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(-5.8, 0.17, 0), new THREE.Vector3(5.8, 0.17, 0)]),
    new THREE.LineBasicMaterial({ color: 0x70838a, transparent: true, opacity: 0.58 }),
  );
  group.add(guide);

  for (const course of ["A", "B", "C"] as const) {
    const detent = new THREE.Group();
    detent.position.set(COURSE_X[course], 0.12, 0.04);
    addMesh(detent, new THREE.CylinderGeometry(0.28, 0.28, 0.08, 40), materials.graphite, [0, 0, 0], false, false);
    const ring = addMesh(detent, new THREE.TorusGeometry(0.3, 0.026, 12, 40), materials.brassBright, [0, 0.05, 0], false, false);
    ring.rotation.x = Math.PI / 2;
    addFastener(detent, [0, 0.08, 0.05], materials, "y", 0.7);
    group.add(detent);
  }

  const platform = new THREE.Group();
  platform.name = "selector-carrier";
  platform.position.set(COURSE_X.A, 0.34, 0.02);
  addMesh(platform, createRoundedBlock(1.62, 0.32, 1.28, 0.11, 5), materials.paintedMetal, [0, 0, 0]);
  addMesh(platform, createRoundedBlock(1.25, 0.08, 0.92, 0.03, 3), materials.chromeDark, [0, 0.2, 0], false, true);
  const junctionRail = new THREE.CatmullRomCurve3([new THREE.Vector3(-0.52, 0.27, 0), new THREE.Vector3(0.52, 0.27, 0)]);
  addMesh(platform, createTubeRail(junctionRail, 0.09, 52, 16), materials.chrome, [0, 0, 0]);
  const junctionRing = addMesh(platform, new THREE.TorusGeometry(0.42, 0.055, 18, 56), materials.brassBright, [0, 0.29, 0], false, false);
  junctionRing.rotation.x = Math.PI / 2;

  const lockPin = addMesh(platform, new THREE.CylinderGeometry(0.1, 0.11, 0.68, 32), materials.brassBright, [0, -0.38, 0.38]);
  lockPin.rotation.z = Math.PI / 2;
  const lockCollar = addMesh(platform, new THREE.TorusGeometry(0.18, 0.045, 14, 40), materials.chrome, [0, -0.38, 0.39], false, false);
  lockCollar.rotation.x = Math.PI / 2;
  const lamp = addMesh(platform, new THREE.SphereGeometry(0.13, 24, 16), materials.warmGlow, [0, 0.38, 0.5], false, false);

  const linkage = new THREE.Group();
  linkage.name = "selector-linkage";
  linkage.position.set(0, 0.1, 0.5);
  addBearingHousing(linkage, [-2.35, 0, 0], materials, 0.74, Math.PI / 2);
  addBearingHousing(linkage, [2.35, 0, 0], materials, 0.74, Math.PI / 2);
  const linkArm = addRodBetween(linkage, new THREE.Vector3(-2.35, 0.02, 0.18), new THREE.Vector3(2.35, 0.02, 0.18), 0.055, materials.chrome, 24);
  linkArm.name = "selector-coupling-rod";
  const cam = addMesh(linkage, new THREE.CylinderGeometry(0.21, 0.21, 0.28, 40), materials.brassBright, [0, 0.02, 0.18]);
  cam.rotation.x = Math.PI / 2;
  group.add(platform, linkage);

  const indicatorMaterials = {
    A: makeIndicatorMaterial(materials.indicatorOff, 0x67c8e3),
    B: makeIndicatorMaterial(materials.indicatorOff, 0xf2b45b),
    C: makeIndicatorMaterial(materials.indicatorOff, 0x8ceef1),
  };
  for (const course of ["A", "B", "C"] as const) {
    addMesh(group, new THREE.SphereGeometry(0.105, 24, 16), indicatorMaterials[course], [COURSE_X[course], 0.39, 0.48], false, false);
  }

  return { group, platform, lockPin, lockCollar, linkage, lamp, indicatorMaterials };
}

export function updateSelectorAssembly(assembly: SelectorAssembly, state: SelectorState, reducedMotion: boolean): void {
  const offset = getSelectorOffset(state);
  assembly.platform.position.x = offset;
  assembly.lockPin.position.y = state.lockEngaged ? -0.38 : -0.1;
  assembly.lockCollar.rotation.z = state.lockEngaged ? 0 : Math.PI * 0.5;
  assembly.linkage.rotation.z = state.phase === "settled" ? 0 : (state.progress - 0.5) * 0.2;
  const lampMaterial = (assembly.lamp.material as THREE.MeshBasicMaterial);
  assembly.lamp.material = state.phase === "settled" ? lampMaterial : lampMaterial;
  lampMaterial.opacity = state.phase === "settled" ? 0.9 : reducedMotion ? 0.52 : 0.68;
  for (const course of ["A", "B", "C"] as const) {
    const material = assembly.indicatorMaterials[course];
    material.emissiveIntensity = course === state.targetCourse
      ? state.phase === "settled" ? 2.9 : 0.8
      : 0.025;
  }
}
