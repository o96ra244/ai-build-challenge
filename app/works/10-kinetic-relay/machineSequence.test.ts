import { describe, expect, it } from "vitest";

import {
  COURSE_DEFINITIONS,
  COURSE_IDS,
  advanceSequence,
  createInitialSequence,
  getCurrentStage,
  getCurrentStageProgress,
  getRunProgress,
  getCourseTotalDuration,
  resetSequence,
  startSequence,
} from "./machineSequence";

describe("machineSequence", () => {
  it("defines three named courses with the required mechanism stages", () => {
    expect(COURSE_IDS).toEqual(["A", "B", "C"]);
    expect(COURSE_DEFINITIONS.A.stages.map((stage) => stage.label)).toEqual([
      "RELEASE GATE", "HELIX DESCENT", "ROCKER IMPACT", "PADDLE BANK", "HAMMER RELEASE", "RETURN MANIFOLD",
    ]);
    expect(COURSE_DEFINITIONS.B.stages.map((stage) => stage.label)).toContain("GEAR TRAIN ENGAGE");
    expect(COURSE_DEFINITIONS.C.stages.map((stage) => stage.label)).toContain("GLASS FUNNEL");
  });

  it("starts on course A and keeps ready state until START", () => {
    const initial = createInitialSequence();
    expect(initial.course).toBe("A");
    expect(initial.phase).toBe("ready");
    expect(getCurrentStage(initial).label).toBe("RELEASE GATE");
    expect(getCurrentStageProgress(initial)).toBe(0);
    expect(startSequence(initial).phase).toBe("running");
  });

  it("advances every course through every stage to COMPLETE", () => {
    for (const course of COURSE_IDS) {
      let state = startSequence(createInitialSequence(course));
      const entered: string[] = [];
      for (let index = 0; index < 140 && state.phase === "running"; index += 1) {
        const result = advanceSequence(state, 0.25);
        state = result.state;
        entered.push(...result.enteredStages.map((stage) => stage.label));
      }
      expect(state.phase).toBe("complete");
      expect(getRunProgress(state)).toBe(1);
      expect(state.totalElapsed).toBeCloseTo(getCourseTotalDuration(course));
      expect(entered).toContain("RETURN MANIFOLD");
    }
  });

  it("does not advance a ready or complete state", () => {
    const ready = createInitialSequence("B");
    expect(advanceSequence(ready, 10).state).toEqual(ready);
    let complete = startSequence(ready);
    for (let index = 0; index < 140 && complete.phase === "running"; index += 1) {
      complete = advanceSequence(complete, 0.25).state;
    }
    expect(advanceSequence(complete, 10).state).toEqual(complete);
    expect(resetSequence("C").phase).toBe("ready");
  });
});
