import { describe, expect, it } from "vitest";

import { CHAIN_MOTIONS } from "./deskLayout";

describe("chain causality", () => {
  it("declares a visible cause for every stage and does not use unrelated launch impulses", async () => {
    expect(CHAIN_MOTIONS.every((motion) => motion.cause.length > 0 && (motion.control === "physics" ? (motion.physicsDuration ?? 0) > 0 : motion.path.length >= 2))).toBe(true);
    const physicsSource = await import("node:fs/promises").then((fs) => fs.readFile(new URL("./chainPhysics.ts", import.meta.url), "utf8"));
    expect(physicsSource).not.toContain("applyImpulse");
  });
});
