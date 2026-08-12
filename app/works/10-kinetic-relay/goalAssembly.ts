import * as THREE from "three";

import { COMMON_GOAL, type MachineTracks } from "./courseTracks";
import { createFunnelGeometry, createRoundedBlock, createTubeRail } from "./machineGeometry";
import type { MachineMaterials } from "./machineMaterials";
import { addFastener, addMesh, addRodBetween } from "./machinePrimitives";

export type GoalAssembly = {
  readonly group: THREE.Group;
  readonly bell: THREE.Group;
  readonly ring: THREE.Mesh;
  readonly clapper: THREE.Mesh;
};

export function createGoalAssembly(tracks: MachineTracks, materials: MachineMaterials, railSegments: number, railRadialSegments: number): GoalAssembly {
  const group = new THREE.Group();
  group.name = "common-goal";
  const [x, y, z] = COMMON_GOAL;
  addMesh(group, createRoundedBlock(4.1, 0.24, 1.2, 0.08, 5), materials.graphite, [x, 1.05, z]);
  addMesh(group, createRoundedBlock(3.2, 0.08, 0.72, 0.025, 2), materials.brass, [x, 1.22, z], false, false);
  for (const px of [-1.55, -0.78, 0.78, 1.55]) {
    addFastener(group, [x + px, 1.25, z + 0.4], materials, "z", 0.82);
  }

  const bell = new THREE.Group();
  bell.name = "goal-bell";
  addMesh(bell, createFunnelGeometry(112), materials.brassBright, [x, y + 0.45, z], true, false).rotation.x = Math.PI;
  addMesh(bell, new THREE.TorusGeometry(1.05, 0.12, 24, 112), materials.chrome, [x, y - 0.18, z], true, false).rotation.x = Math.PI / 2;
  addMesh(bell, new THREE.CylinderGeometry(0.1, 0.1, 0.82, 32), materials.chromeDark, [x, y - 0.48, z]);
  const clapper = addMesh(bell, new THREE.SphereGeometry(0.2, 36, 24), materials.brass, [x, y - 0.96, z]);
  addMesh(bell, createRoundedBlock(1.25, 0.12, 0.82, 0.04, 3), materials.graphite, [x, y + 1.62, z]);
  addRodBetween(bell, new THREE.Vector3(x - 0.48, y + 1.62, z), new THREE.Vector3(x + 0.48, y + 1.62, z), 0.045, materials.chrome, 22);
  group.add(bell);

  const ring = addMesh(group, new THREE.TorusGeometry(1.26, 0.046, 16, 96), materials.warmGlow, [x, y - 0.03, z + 0.12], false, false);
  ring.rotation.x = Math.PI / 2;

  for (const [course, track] of [["A", tracks.returnA], ["B", tracks.returnB], ["C", tracks.returnC]] as const) {
    addMesh(group, createTubeRail(track, 0.075, Math.round(railSegments * 0.7), Math.max(12, railRadialSegments - 3)), course === "B" ? materials.brass : materials.chrome, [0, 0, 0]);
  }
  addMesh(group, createTubeRail(new THREE.CatmullRomCurve3([
    new THREE.Vector3(-1.9, 1.76, 0.04),
    new THREE.Vector3(-0.82, 1.48, 0.02),
    new THREE.Vector3(0, 1.42, 0.02),
    new THREE.Vector3(0.82, 1.48, 0.02),
    new THREE.Vector3(1.9, 1.76, 0.04),
  ]), 0.06, Math.round(railSegments * 0.4), Math.max(10, railRadialSegments - 5)), materials.chromeDark, [0, 0, 0]);

  const label = createGoalLabel();
  label.position.set(x, 0.55, 1.68);
  group.add(label);
  return { group, bell, ring, clapper };
}

function createGoalLabel(): THREE.Sprite {
  const canvas = document.createElement("canvas");
  canvas.width = 768;
  canvas.height = 160;
  const context = canvas.getContext("2d");
  if (context) {
    context.fillStyle = "rgba(7, 11, 15, 0.82)";
    context.fillRect(2, 2, canvas.width - 4, canvas.height - 4);
    context.strokeStyle = "rgba(230, 182, 92, 0.72)";
    context.lineWidth = 4;
    context.strokeRect(4, 4, canvas.width - 8, canvas.height - 8);
    context.fillStyle = "#f0c375";
    context.font = "600 44px 'SFMono-Regular', 'Roboto Mono', monospace";
    context.textAlign = "center";
    context.textBaseline = "middle";
    context.fillText("COMMON GOAL", canvas.width / 2, canvas.height / 2 + 2);
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  const material = new THREE.SpriteMaterial({ map: texture, transparent: true, depthWrite: false });
  const sprite = new THREE.Sprite(material);
  sprite.scale.set(2.2, 0.46, 1);
  return sprite;
}

export function updateGoalAssembly(assembly: GoalAssembly, pulse: number): void {
  const safePulse = Math.max(0, Math.min(1, pulse));
  assembly.ring.scale.setScalar(0.94 + safePulse * 0.16);
  (assembly.ring.material as THREE.MeshBasicMaterial).opacity = 0.16 + safePulse * 0.72;
  assembly.bell.rotation.z = Math.sin(safePulse * Math.PI * 5) * Math.exp(-safePulse * 2) * 0.08;
  assembly.clapper.rotation.z = Math.sin(safePulse * Math.PI * 7) * Math.exp(-safePulse * 2.4) * 0.12;
}
