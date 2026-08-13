import { describe, expect, it } from "vitest";

import { createCleanupRegistry } from "./cleanupRegistry";

describe("Gaussian Splat cleanup registry", () => {
  it("runs each disposer once and makes repeated dispose safe", () => {
    const registry = createCleanupRegistry();
    let calls = 0;
    registry.add(() => { calls += 1; });
    registry.dispose();
    registry.dispose();
    expect(calls).toBe(1);
  });

  it("removes a disposer when the returned unsubscribe is called", () => {
    const registry = createCleanupRegistry();
    let calls = 0;
    const remove = registry.add(() => { calls += 1; });
    remove();
    registry.dispose();
    expect(calls).toBe(0);
  });

  it("runs a disposer added after close immediately", () => {
    const registry = createCleanupRegistry();
    registry.dispose();
    let calls = 0;
    registry.add(() => { calls += 1; });
    expect(calls).toBe(1);
  });
});
