import type { MotionObjectId, Vector3Tuple } from "./deskLayout";

export const ACT1_DYNAMIC_VISUAL_IDS = ["redMarble", "eraser"] as const satisfies readonly MotionObjectId[];

export type Act1DynamicVisualId = (typeof ACT1_DYNAMIC_VISUAL_IDS)[number];

export function getVisualPhysicsDelta(visualPosition: Vector3Tuple, physicsPosition: Vector3Tuple): number {
  return Math.hypot(
    visualPosition[0] - physicsPosition[0],
    visualPosition[1] - physicsPosition[1],
    visualPosition[2] - physicsPosition[2],
  );
}
