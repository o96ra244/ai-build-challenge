import { describe, expect, it } from "vitest";

import { CHAIN_STAGES, advanceChain, createInitialChain, getRunProgress, startChain, triggerChainEvent } from "./chainSequence";

describe("chainSequence", () => {
  it("defines a room-scale relay with at least twenty ordered stages", () => {
    expect(CHAIN_STAGES.length).toBeGreaterThanOrEqual(20);
    expect(CHAIN_STAGES[0]?.id).toBe("stopper");
    expect(CHAIN_STAGES.at(-1)?.id).toBe("bell");
  });

  it("waits for the current visible contact event instead of elapsed time", () => {
    let state = startChain(createInitialChain());
    state = advanceChain(state, 0.4).state;
    expect(state.stageIndex).toBe(0);
    expect(triggerChainEvent(state, "stopper").stageIndex).toBe(1);
    expect(triggerChainEvent(state, "bell")).toEqual(state);
  });

  it("reaches complete only after every ordered motion event", () => {
    let state = startChain(createInitialChain());
    for (const stage of CHAIN_STAGES) state = triggerChainEvent(state, stage.id);
    expect(state.phase).toBe("complete");
    expect(getRunProgress(state)).toBe(1);
  });

  it("fails a long stage timeout without forcing completion", () => {
    const state = startChain(createInitialChain());
    let result = advanceChain(state, 0.2);
    for (let index = 0; index < Math.ceil(CHAIN_STAGES[0]!.timeout / 0.2) + 1; index += 1) {
      result = advanceChain(result.state, 0.2);
      if (result.timedOut) break;
    }
    expect(result.timedOut).toBe(true);
    expect(result.state.phase).toBe("error");
    expect(result.state.errorMessage).toContain("RESTART");
  });
});
