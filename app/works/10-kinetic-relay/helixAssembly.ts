import * as THREE from "three";

import { COURSE_X, createParallelCurve, type MachineTracks } from "./courseTracks";
import { createRoundedBlock, createTubeRail } from "./machineGeometry";
import type { MachineMaterials } from "./machineMaterials";
import { addBearingHousing, addFastener, addMesh, addRodBetween } from "./machinePrimitives";

export type HelixAssembly = {
  readonly group: THREE.Group;
  readonly rocker: THREE.Group;
  readonly paddles: readonly THREE.Group[];
  readonly hammer: THREE.Group;
  readonly releaseGate: THREE.Group;
};

export function createHelixAssembly(tracks: MachineTracks, materials: MachineMaterials, railSegments: number, railRadialSegments: number): HelixAssembly {
  const group = new THREE.Group();
  group.name = "helix-assembly";
  const railGroup = new THREE.Group();
  const outerRail = createParallelCurve(tracks.helix, [0, 0, -0.16], 80);
  const innerRail = createParallelCurve(tracks.helix, [0, 0, 0.16], 80);
  addMesh(railGroup, createTubeRail(outerRail, 0.085, railSegments, railRadialSegments), materials.chrome);
  addMesh(railGroup, createTubeRail(innerRail, 0.085, railSegments, railRadialSegments), materials.chrome);
  const helixEnd = tracks.helix.getPointAt(1);
  const supportProgress = [0.12, 0.34, 0.56, 0.78, 0.95];
  for (const progress of supportProgress) {
    const point = tracks.helix.getPointAt(progress);
    const support = new THREE.Group();
    addRodBetween(support, new THREE.Vector3(point.x, point.y - 0.62, -1.05), point, 0.045, materials.graphite, 20);
    addBearingHousing(support, [point.x, point.y, point.z - 0.18], materials, 0.62, Math.PI / 2);
    group.add(support);
  }
  group.add(railGroup);

  const entry = new THREE.Group();
  entry.position.set(COURSE_X.A, 7.55, 0.03);
  addMesh(entry, createRoundedBlock(1.12, 0.2, 0.72, 0.05, 4), materials.graphite, [0, 0, 0]);
  addMesh(entry, createRoundedBlock(0.82, 0.08, 0.44, 0.02, 2), materials.brass, [0, 0.14, 0], false, false);
  addBearingHousing(entry, [0, 0.18, 0.37], materials, 0.72, Math.PI / 2);
  const gateArm = addMesh(entry, new THREE.CylinderGeometry(0.055, 0.055, 0.72, 20), materials.chrome, [0, 0.42, 0.18]);
  gateArm.rotation.z = Math.PI / 2;
  addFastener(entry, [0, 0.42, 0.48], materials, "z", 0.8);
  group.add(entry);
  const releaseGate = new THREE.Group();
  releaseGate.position.copy(entry.position);
  releaseGate.position.y -= 0.06;
  addMesh(releaseGate, createRoundedBlock(0.16, 0.58, 0.4, 0.04, 3), materials.brassBright, [0, 0.12, 0.18]);
  addMesh(releaseGate, new THREE.CylinderGeometry(0.08, 0.08, 0.42, 24), materials.chromeDark, [0, 0.42, 0.18]);
  group.add(releaseGate);

  const rocker = new THREE.Group();
  rocker.name = "helix-rocker";
  rocker.position.copy(helixEnd).add(new THREE.Vector3(0.45, -0.03, 0.12));
  const rockerBeam = addMesh(rocker, createRoundedBlock(2.1, 0.18, 0.42, 0.06, 4), materials.brassBright, [0, 0, 0]);
  rockerBeam.castShadow = true;
  addMesh(rocker, new THREE.CylinderGeometry(0.2, 0.2, 0.48, 40), materials.chromeDark, [0, -0.12, 0]);
  addBearingHousing(rocker, [0, -0.12, 0.28], materials, 0.8, Math.PI / 2);
  addMesh(rocker, new THREE.CylinderGeometry(0.28, 0.28, 0.18, 32), materials.ivory, [-0.78, 0.17, 0]);
  addMesh(rocker, new THREE.CylinderGeometry(0.19, 0.19, 0.16, 32), materials.brass, [0.78, 0.16, 0]);
  group.add(rocker);

  const paddleBank = new THREE.Group();
  const paddles: THREE.Group[] = [];
  const paddleCount = 12;
  for (let index = 0; index < paddleCount; index += 1) {
    const t = index / (paddleCount - 1);
    const point = tracks.paddles.getPointAt(t);
    const paddle = new THREE.Group();
    paddle.name = `precision-paddle-${index + 1}`;
    paddle.position.copy(point);
    paddle.rotation.y = -0.18 + t * 0.42;
    addMesh(paddle, createRoundedBlock(0.22, 0.72, 0.18, 0.04, 4), index % 2 === 0 ? materials.ivory : materials.brass, [0, 0.36, 0]);
    addMesh(paddle, new THREE.CylinderGeometry(0.07, 0.07, 0.26, 24), materials.chromeDark, [0, 0.74, 0]);
    addFastener(paddle, [0, 0.77, 0.13], materials, "z", 0.72);
    paddles.push(paddle);
    paddleBank.add(paddle);
  }
  addRodBetween(paddleBank, tracks.paddles.getPointAt(0).clone().add(new THREE.Vector3(0, 0.48, 0)), tracks.paddles.getPointAt(1).clone().add(new THREE.Vector3(0, 0.48, 0)), 0.045, materials.chromeDark, 24);
  group.add(paddleBank);

  const hammer = new THREE.Group();
  hammer.name = "helix-hammer";
  hammer.position.set(COURSE_X.A + 3.24, 3.42, 0.28);
  addBearingHousing(hammer, [0, 0.5, 0], materials, 0.86);
  const hammerArm = addMesh(hammer, new THREE.CylinderGeometry(0.075, 0.075, 1.62, 28), materials.chromeDark, [0, 1.16, 0]);
  addMesh(hammer, createRoundedBlock(0.62, 0.4, 0.46, 0.1, 5), materials.brassBright, [0, 1.96, 0]);
  addMesh(hammer, new THREE.CylinderGeometry(0.13, 0.13, 0.5, 32), materials.chrome, [0, 0.5, 0]);
  const spring = addMesh(hammer, new THREE.TorusGeometry(0.22, 0.035, 12, 48), materials.brass, [0.24, 1.1, 0.2], false, false);
  spring.rotation.y = Math.PI / 2;
  hammer.add(hammerArm);
  group.add(hammer);

  return { group, rocker, paddles, hammer, releaseGate };
}

export type HelixMotion = {
  readonly release: number;
  readonly rocker: number;
  readonly paddleBank: number;
  readonly hammer: number;
};

export function updateHelixAssembly(assembly: HelixAssembly, motion: HelixMotion): void {
  assembly.releaseGate.rotation.z = -0.18 + motion.release * 0.58;
  assembly.rocker.rotation.z = -0.08 + motion.rocker * 0.64;
  for (const [index, paddle] of assembly.paddles.entries()) {
    const hit = Math.min(1, Math.max(0, motion.paddleBank * assembly.paddles.length - index));
    paddle.rotation.z = (index % 2 === 0 ? -1 : 1) * hit * 0.96;
  }
  assembly.hammer.rotation.z = -motion.hammer * 1.18;
}
