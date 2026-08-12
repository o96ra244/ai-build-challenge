import { describe, expect, it } from "vitest";

import {
  CHAIN_STAGES,
  advanceChain,
  createInitialChain,
  getRunProgress,
  startChain,
  triggerChainEvent,
} from "./chainSequence";

describe("chainSequence", () => {
  it("defines one nine-stage desk relay", () => {
    expect(CHAIN_STAGES.map((stage) => stage.id)).toEqual([
      "marble", "eraser", "blocks", "car", "seesaw", "blue-marble", "bell", "bell", "bell",
    ].slice(0, CHAIN_STAGES.length));
    expect(CHAIN_STAGES.length).toBe(7);
  });

  it("waits for collision events instead of advancing on elapsed time", () => {
    let state = startChain(createInitialChain());
    state = advanceChain(state, 0.4).state;
    expect(state.stageIndex).toBe(0);
    expect(triggerChainEvent(state, "red-marble-impact").stageIndex).toBe(1);
    expect(triggerChainEvent(state, "bell-struck")).toEqual(state);
  });

  it("reaches complete only after ordered contact events", () => {
    let state = startChain(createInitialChain());
    const events = [
      "red-marble-impact", "eraser-clothespin", "last-block-chock", "car-seesaw-impact",
      "seesaw-released", "blue-cup-caught", "bell-struck",
    ] as const;
    for (const event of events) state = triggerChainEvent(state, event);
    expect(state.phase).toBe("complete");
    expect(getRunProgress(state)).toBe(1);
  });

  it("fails a stage timeout without forcing completion", () => {
    const state = startChain(createInitialChain());
    let result = advanceChain(state, 0.2);
    for (let index = 0; index < 27; index += 1) result = advanceChain(result.state, 0.2);
    expect(result.timedOut).toBe(true);
    expect(result.state.phase).toBe("error");
    expect(result.state.errorMessage).toContain("RESTART");
  });
});
