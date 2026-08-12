import { describe, expect, it } from "vitest";

import { BLOCK_STARTS, CHAIN_MOTIONS, CHAIN_RUNTIME_TARGET_SECONDS, getMotionDuration, getPathLength, ROOM_LAYOUT, TRACK_LAYOUT } from "./deskLayout";

describe("deskLayout", () => {
  it("defines a room-scale route with 20 or more meaningful motions", () => {
    expect(CHAIN_MOTIONS.length).toBeGreaterThanOrEqual(20);
    expect(TRACK_LAYOUT.length).toBeGreaterThanOrEqual(12);
    expect(CHAIN_RUNTIME_TARGET_SECONDS).toBeGreaterThanOrEqual(80);
    expect(ROOM_LAYOUT.deskTop.size[0]).toBeGreaterThan(ROOM_LAYOUT.upperShelf.size[0]);
  });

  it("keeps every motion physically readable with a path, cause, and duration", () => {
    CHAIN_MOTIONS.forEach((motion) => {
      expect(motion.cause.length).toBeGreaterThan(10);
      if (motion.control === "physics") expect(motion.physicsDuration ?? 0).toBeGreaterThan(0);
      else expect(getPathLength(motion.path)).toBeGreaterThan(0);
      expect(getMotionDuration(motion)).toBeGreaterThan(0);
      expect(motion.focus.every(Number.isFinite)).toBe(true);
    });
  });

  it("provides a long ten-block center domino chain", () => {
    expect(BLOCK_STARTS).toHaveLength(10);
    expect(BLOCK_STARTS[0]![0]).toBeLessThan(BLOCK_STARTS[9]![0]);
  });
});
