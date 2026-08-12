import { COURSE_IDS, type CourseId } from "./machineSequence";

export type SelectorPhase = "settled" | "unlocking" | "moving" | "locking" | "settling";

export type SelectorState = {
  readonly currentCourse: CourseId;
  readonly targetCourse: CourseId;
  readonly phase: SelectorPhase;
  readonly progress: number;
  readonly offset: number;
  readonly lockEngaged: boolean;
};

export type SelectorAdvanceResult = {
  readonly state: SelectorState;
  readonly settled: boolean;
};

export const SELECTOR_OFFSETS: Record<CourseId, number> = {
  A: -5.35,
  B: 0,
  C: 5.35,
};

const SELECTOR_DURATION = 1.02;
const REDUCED_SELECTOR_DURATION = 0.14;

function clampProgress(value: number): number {
  return Number.isFinite(value) ? Math.min(1, Math.max(0, value)) : 0;
}

function easeInOut(value: number): number {
  const t = clampProgress(value);
  return t * t * (3 - 2 * t);
}

function finiteDelta(value: number): number {
  return Number.isFinite(value) ? Math.min(1.5, Math.max(0, value)) : 0;
}

export function courseOffset(course: CourseId): number {
  return SELECTOR_OFFSETS[COURSE_IDS.includes(course) ? course : "A"];
}

export function createSelectorState(course: CourseId = "A"): SelectorState {
  const offset = courseOffset(course);
  return {
    currentCourse: course,
    targetCourse: course,
    phase: "settled",
    progress: 1,
    offset,
    lockEngaged: true,
  };
}

export function startSelectorChange(state: SelectorState, targetCourse: CourseId): SelectorState {
  if (state.phase !== "settled" || targetCourse === state.currentCourse) {
    return state;
  }
  return {
    currentCourse: state.currentCourse,
    targetCourse,
    phase: "unlocking",
    progress: 0,
    offset: courseOffset(state.currentCourse),
    lockEngaged: false,
  };
}

export function getSelectorDuration(reducedMotion: boolean): number {
  return reducedMotion ? REDUCED_SELECTOR_DURATION : SELECTOR_DURATION;
}

export function getSelectorOffset(state: SelectorState): number {
  if (state.phase === "settled") {
    return courseOffset(state.currentCourse);
  }
  const start = courseOffset(state.currentCourse);
  const end = courseOffset(state.targetCourse);
  return start + (end - start) * easeInOut(state.progress);
}

export function advanceSelector(state: SelectorState, realDeltaSeconds: number, reducedMotion = false): SelectorAdvanceResult {
  if (state.phase === "settled") {
    return { state, settled: true };
  }
  const progress = clampProgress(state.progress + finiteDelta(realDeltaSeconds) / getSelectorDuration(reducedMotion));
  if (progress >= 1) {
    return {
      state: {
        currentCourse: state.targetCourse,
        targetCourse: state.targetCourse,
        phase: "settled",
        progress: 1,
        offset: courseOffset(state.targetCourse),
        lockEngaged: true,
      },
      settled: true,
    };
  }
  const phase: SelectorPhase = progress < 0.16
    ? "unlocking"
    : progress < 0.78
      ? "moving"
      : progress < 0.94
        ? "locking"
        : "settling";
  return {
    state: {
      ...state,
      phase,
      progress,
      offset: getSelectorOffset({ ...state, progress }),
      lockEngaged: phase === "settling",
    },
    settled: false,
  };
}

export function isSelectorMoving(state: SelectorState): boolean {
  return state.phase !== "settled";
}

export function isSelectorReady(state: SelectorState, course: CourseId): boolean {
  return state.phase === "settled" && state.currentCourse === course && state.lockEngaged;
}
