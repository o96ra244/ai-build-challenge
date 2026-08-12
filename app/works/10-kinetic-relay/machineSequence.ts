export const COURSE_IDS = ["A", "B", "C"] as const;
export type CourseId = (typeof COURSE_IDS)[number];

export type CourseStage = {
  readonly id: string;
  readonly label: string;
  readonly duration: number;
};

export type CourseDefinition = {
  readonly id: CourseId;
  readonly name: string;
  readonly subtitle: string;
  readonly material: "chrome" | "brass" | "glass";
  readonly stages: readonly CourseStage[];
};

export const COURSE_DEFINITIONS: Record<CourseId, CourseDefinition> = {
  A: {
    id: "A",
    name: "HELIX",
    subtitle: "CHROME / GRAPHITE",
    material: "chrome",
    stages: [
      { id: "release", label: "RELEASE GATE", duration: 1.55 },
      { id: "helix", label: "HELIX DESCENT", duration: 4.35 },
      { id: "rocker", label: "ROCKER IMPACT", duration: 2.85 },
      { id: "paddle-bank", label: "PADDLE BANK", duration: 4.15 },
      { id: "hammer", label: "HAMMER RELEASE", duration: 3.2 },
      { id: "return", label: "RETURN MANIFOLD", duration: 3.65 },
    ],
  },
  B: {
    id: "B",
    name: "CLOCKWORK",
    subtitle: "DIRECTIONAL BRASS / IVORY",
    material: "brass",
    stages: [
      { id: "release", label: "RELEASE GATE", duration: 1.55 },
      { id: "switchback", label: "SWITCHBACK", duration: 3.45 },
      { id: "pendulum", label: "PENDULUM TRIGGER", duration: 3.35 },
      { id: "gear-train", label: "GEAR TRAIN ENGAGE", duration: 4.65 },
      { id: "lift-gate", label: "RACK LIFT", duration: 3.45 },
      { id: "drop", label: "VERTICAL DROP", duration: 2.1 },
      { id: "return", label: "RETURN MANIFOLD", duration: 3.4 },
    ],
  },
  C: {
    id: "C",
    name: "ORBIT",
    subtitle: "GLASS / CHROME",
    material: "glass",
    stages: [
      { id: "release", label: "RELEASE GATE", duration: 1.55 },
      { id: "glass-funnel", label: "GLASS FUNNEL", duration: 4.25 },
      { id: "balance", label: "BALANCE IMPACT", duration: 3.1 },
      { id: "second-marble", label: "SECOND MARBLE", duration: 2.55 },
      { id: "orbit-rail", label: "ORBIT RAIL", duration: 4.45 },
      { id: "turbine", label: "TURBINE TRANSFER", duration: 4.0 },
      { id: "return", label: "RETURN MANIFOLD", duration: 3.45 },
    ],
  },
};

export type SequencePhase = "ready" | "running" | "complete";

export type SequenceState = {
  readonly course: CourseId;
  readonly phase: SequencePhase;
  readonly stageIndex: number;
  readonly stageElapsed: number;
  readonly totalElapsed: number;
};

export type SequenceAdvanceResult = {
  readonly state: SequenceState;
  readonly enteredStages: readonly CourseStage[];
  readonly completed: boolean;
};

const MAX_SEQUENCE_DELTA = 0.25;

function finiteDelta(value: number): number {
  return Number.isFinite(value) ? Math.min(MAX_SEQUENCE_DELTA, Math.max(0, value)) : 0;
}

function clampCourse(course: CourseId): CourseId {
  return COURSE_IDS.includes(course) ? course : "A";
}

export function getCourseDefinition(course: CourseId): CourseDefinition {
  return COURSE_DEFINITIONS[clampCourse(course)];
}

export function getCourseTotalDuration(course: CourseId): number {
  return getCourseDefinition(course).stages.reduce((total, stage) => total + stage.duration, 0);
}

export function createInitialSequence(course: CourseId = "A"): SequenceState {
  const safeCourse = clampCourse(course);
  return {
    course: safeCourse,
    phase: "ready",
    stageIndex: 0,
    stageElapsed: 0,
    totalElapsed: 0,
  };
}

export function startSequence(state: SequenceState): SequenceState {
  if (state.phase === "running") {
    return state;
  }
  return {
    ...createInitialSequence(state.course),
    phase: "running",
  };
}

export function resetSequence(course: CourseId): SequenceState {
  return createInitialSequence(course);
}

export function getCurrentStage(state: SequenceState): CourseStage {
  const stages = getCourseDefinition(state.course).stages;
  return stages[Math.min(stages.length - 1, Math.max(0, state.stageIndex))] ?? stages[0];
}

export function getCurrentStageProgress(state: SequenceState): number {
  const duration = getCurrentStage(state).duration;
  if (!Number.isFinite(duration) || duration <= 0) {
    return state.phase === "complete" ? 1 : 0;
  }
  return Math.min(1, Math.max(0, state.stageElapsed / duration));
}

export function getRunProgress(state: SequenceState): number {
  const definition = getCourseDefinition(state.course);
  const before = definition.stages
    .slice(0, state.stageIndex)
    .reduce((total, stage) => total + stage.duration, 0);
  const total = getCourseTotalDuration(state.course);
  return total > 0 ? Math.min(1, Math.max(0, (before + state.stageElapsed) / total)) : 0;
}

export function advanceSequence(state: SequenceState, realDeltaSeconds: number): SequenceAdvanceResult {
  if (state.phase !== "running") {
    return { state, enteredStages: [], completed: state.phase === "complete" };
  }

  const definition = getCourseDefinition(state.course);
  let stageIndex = state.stageIndex;
  let stageElapsed = state.stageElapsed;
  let totalElapsed = state.totalElapsed;
  let remaining = finiteDelta(realDeltaSeconds);
  const enteredStages: CourseStage[] = [];

  while (remaining > 0 && stageIndex < definition.stages.length) {
    const stage = definition.stages[stageIndex];
    const timeLeft = Math.max(0, stage.duration - stageElapsed);
    const consumed = Math.min(timeLeft, remaining);
    stageElapsed += consumed;
    totalElapsed += consumed;
    remaining -= consumed;

    if (stageElapsed >= stage.duration - 1e-9) {
      stageIndex += 1;
      if (stageIndex < definition.stages.length) {
        stageElapsed = 0;
        enteredStages.push(definition.stages[stageIndex]);
      }
    }
  }

  if (stageIndex >= definition.stages.length) {
    const lastIndex = definition.stages.length - 1;
    return {
      state: {
        course: state.course,
        phase: "complete",
        stageIndex: lastIndex,
        stageElapsed: definition.stages[lastIndex]?.duration ?? 0,
        totalElapsed: getCourseTotalDuration(state.course),
      },
      enteredStages,
      completed: true,
    };
  }

  return {
    state: {
      course: state.course,
      phase: "running",
      stageIndex,
      stageElapsed,
      totalElapsed,
    },
    enteredStages,
    completed: false,
  };
}
