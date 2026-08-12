import * as THREE from "three";

import { COURSE_X, type MachineTracks } from "./courseTracks";
import { createGearGeometry, createRoundedBlock } from "./machineGeometry";
import type { MachineMaterials } from "./machineMaterials";
import { addBearingHousing, addFastener, addMesh, addRailPair, addRodBetween } from "./machinePrimitives";

export type ClockworkAssembly = {
  readonly group: THREE.Group;
  readonly gears: readonly THREE.Group[];
  readonly gearTeeth: readonly number[];
  readonly pendulum: THREE.Group;
  readonly rack: THREE.Group;
  readonly liftGate: THREE.Group;
  readonly dropCollar: THREE.Mesh;
};

export function createClockworkAssembly(
  tracks: MachineTracks,
  materials: MachineMaterials,
  railSegments: number,
  railRadialSegments: number,
): ClockworkAssembly {
  const group = new THREE.Group();
  group.name = "clockwork-assembly";
  const b = COURSE_X.B;

  addRailPair(group, tracks.switchback, 0.28, materials.brass, Math.round(railSegments * 0.72), Math.max(12, railRadialSegments - 2), 0);
  for (const progress of [0.16, 0.38, 0.61, 0.84]) {
    const point = tracks.switchback.getPointAt(progress);
    addRodBetween(group, new THREE.Vector3(point.x, point.y - 0.54, -1.02), point, 0.042, materials.graphite, 18);
    addBearingHousing(group, [point.x, point.y, point.z - 0.17], materials, 0.58, Math.PI / 2);
  }

  const housing = new THREE.Group();
  housing.position.set(b + 0.2, 4.42, 0.58);
  addMesh(housing, createRoundedBlock(3.2, 2.9, 0.22, 0.06, 4), materials.graphite, [0, 0, 0], false, true);
  addMesh(housing, createRoundedBlock(2.84, 2.54, 0.08, 0.025, 2), materials.paintedMetal, [0, 0, 0.16], false, false);
  for (const [x, y] of [[-1.08, 0.88], [0.12, 0.53], [1.0, 0.12], [0.48, -0.72]] as const) {
    addFastener(housing, [x, y, 0.21], materials, "z", 0.65);
  }
  group.add(housing);

  const gearSpecs: readonly [number, number, number, number][] = [
    [b - 1.05, 5.45, 0.74, 22],
    [b + 0.15, 5.18, 0.55, 17],
    [b + 1.02, 4.72, 0.4, 13],
    [b + 0.35, 4.1, 0.31, 11],
  ];
  const gears: THREE.Group[] = [];
  const gearTeeth: number[] = [];
  for (const [x, y, radius, teeth] of gearSpecs) {
    const gear = new THREE.Group();
    gear.name = `clockwork-gear-${teeth}`;
    addMesh(gear, createGearGeometry(teeth, radius * 0.5, radius * 0.76, radius, 0.24), materials.brass, [0, 0, 0]);
    addMesh(gear, new THREE.CylinderGeometry(radius * 0.25, radius * 0.25, 0.34, 36), materials.chromeDark, [0, 0, 0.16], false, false).rotation.x = Math.PI / 2;
    addMesh(gear, createTubeRing(radius * 0.36), materials.brassBright, [0, 0, 0.3], false, false).rotation.x = Math.PI / 2;
    addBearingHousing(gear, [0, 0, 0.34], materials, radius * 0.9, Math.PI / 2);
    gear.position.set(x, y, 0.84);
    gears.push(gear);
    gearTeeth.push(teeth);
    group.add(gear);
  }

  const pendulum = new THREE.Group();
  pendulum.name = "clockwork-pendulum";
  pendulum.position.set(b - 0.95, 7.0, 0.6);
  addBearingHousing(pendulum, [0, 0, 0.18], materials, 0.9, Math.PI / 2);
  addMesh(pendulum, new THREE.CylinderGeometry(0.052, 0.052, 2.26, 24), materials.brassBright, [0, -1.12, 0]);
  addMesh(pendulum, new THREE.CylinderGeometry(0.4, 0.4, 0.18, 40), materials.ivory, [0, -2.22, 0]);
  addMesh(pendulum, new THREE.TorusGeometry(0.42, 0.065, 16, 48), materials.brass, [0, -2.22, 0], false, false).rotation.x = Math.PI / 2;
  group.add(pendulum);

  const rack = new THREE.Group();
  rack.name = "rack-and-pinion";
  rack.position.set(b + 1.05, 3.42, 0.85);
  addMesh(rack, createRoundedBlock(0.22, 1.45, 0.24, 0.04, 3), materials.brassBright, [0, 0.72, 0]);
  for (let index = 0; index < 9; index += 1) {
    addMesh(rack, createRoundedBlock(0.34, 0.075, 0.3, 0.016, 2), materials.ivory, [0.18, 0.11 + index * 0.16, 0], false, false);
  }
  addBearingHousing(rack, [0, 0.72, 0.26], materials, 0.66, Math.PI / 2);
  group.add(rack);

  const liftGate = new THREE.Group();
  liftGate.name = "clockwork-lift-gate";
  liftGate.position.set(b + 0.2, 3.02, 0.18);
  addMesh(liftGate, createRoundedBlock(1.02, 0.2, 0.64, 0.07, 4), materials.brassBright, [0, 0, 0]);
  addMesh(liftGate, new THREE.CylinderGeometry(0.09, 0.09, 0.92, 28), materials.chromeDark, [0, 0.1, 0.25]);
  addBearingHousing(liftGate, [0, 0.1, 0.4], materials, 0.65, Math.PI / 2);
  const dropCollar = addMesh(group, new THREE.TorusGeometry(0.31, 0.06, 14, 44), materials.brassBright, [b + 0.2, 2.42, 0.14], false, false);
  dropCollar.rotation.x = Math.PI / 2;
  group.add(liftGate);

  return { group, gears, gearTeeth, pendulum, rack, liftGate, dropCollar };
}

function createTubeRing(radius: number): THREE.TorusGeometry {
  return new THREE.TorusGeometry(radius, 0.035, 12, 48);
}

export type ClockworkMotion = {
  readonly pendulum: number;
  readonly gearTrain: number;
  readonly rack: number;
  readonly gate: number;
  readonly drop: number;
};

export function updateClockworkAssembly(assembly: ClockworkAssembly, motion: ClockworkMotion): void {
  assembly.pendulum.rotation.z = Math.sin(motion.pendulum * Math.PI * 2) * 0.42;
  const gearTurn = motion.gearTrain * Math.PI * 1.72;
  assembly.gears.forEach((gear, index) => {
    const ratio = assembly.gearTeeth[0] / assembly.gearTeeth[index];
    gear.rotation.z = (index % 2 === 0 ? 1 : -1) * gearTurn * ratio;
  });
  assembly.rack.position.y = 3.42 + motion.rack * 0.72;
  assembly.liftGate.rotation.z = motion.gate * -0.62;
  assembly.dropCollar.rotation.z = motion.drop * Math.PI * 1.3;
}
