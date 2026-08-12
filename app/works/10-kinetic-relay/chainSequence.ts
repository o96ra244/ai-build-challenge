import { CHAIN_MOTIONS, getMotionDuration } from "./deskLayout";

export const CHAIN_STAGES = CHAIN_MOTIONS.map((motion) => ({
  ...motion,
  timeout: getMotionDuration(motion) + 2.5,
})) as readonly (typeof CHAIN_MOTIONS[number] & { readonly timeout: number })[];

export type ChainStage = (typeof CHAIN_STAGES)[number];
export type ChainStageId = ChainStage["id"];
export type ChainPhase = "ready" | "running" | "complete" | "error";
export type ChainEvent = ChainStageId;

export type ChainState = {
  readonly phase: ChainPhase;
  readonly stageIndex: number;
  readonly stageElapsed: number;
  readonly totalElapsed: number;
  readonly errorMessage: string;
};

export type ChainAdvanceResult = {
  readonly state: ChainState;
  readonly timedOut: boolean;
};

function finiteDelta(value: number): number {
  return Number.isFinite(value) ? Math.min(0.2, Math.max(0, value)) : 0;
}

export function createInitialChain(): ChainState {
  return { phase: "ready", stageIndex: 0, stageElapsed: 0, totalElapsed: 0, errorMessage: "" };
}

export function startChain(state: ChainState): ChainState {
  if (state.phase === "running") return state;
  return { ...createInitialChain(), phase: "running" };
}

export function resetChain(): ChainState {
  return createInitialChain();
}

export function getCurrentStage(state: ChainState): ChainStage {
  return CHAIN_STAGES[Math.min(CHAIN_STAGES.length - 1, Math.max(0, state.stageIndex))] ?? CHAIN_STAGES[0]!;
}

export function getStageProgress(state: ChainState): number {
  const stage = getCurrentStage(state);
  const duration = getMotionDuration(stage);
  return state.phase === "complete" ? 1 : Math.min(1, Math.max(0, state.stageElapsed / duration));
}

export function getRunProgress(state: ChainState): number {
  const stagePortion = (state.stageIndex + getStageProgress(state)) / CHAIN_STAGES.length;
  return state.phase === "complete" ? 1 : Math.min(1, Math.max(0, stagePortion));
}

export function advanceChain(state: ChainState, deltaSeconds: number): ChainAdvanceResult {
  if (state.phase !== "running") return { state, timedOut: false };
  const delta = finiteDelta(deltaSeconds);
  const nextElapsed = state.stageElapsed + delta;
  const timedOut = nextElapsed > getCurrentStage(state).timeout;
  if (!timedOut) {
    return {
      state: { ...state, stageElapsed: nextElapsed, totalElapsed: state.totalElapsed + delta },
      timedOut: false,
    };
  }
  return {
    state: {
      ...state,
      phase: "error",
      stageElapsed: getCurrentStage(state).timeout,
      errorMessage: `連鎖が「${getCurrentStage(state).label}」で止まりました。RESTARTで再試行してください。`,
    },
    timedOut: true,
  };
}

function nextStage(state: ChainState): ChainState {
  const nextIndex = state.stageIndex + 1;
  if (nextIndex >= CHAIN_STAGES.length) {
    return { ...state, phase: "complete", stageIndex: CHAIN_STAGES.length - 1, stageElapsed: 0 };
  }
  return { ...state, stageIndex: nextIndex, stageElapsed: 0 };
}

export function triggerChainEvent(state: ChainState, event: ChainEvent): ChainState {
  if (state.phase !== "running") return state;
  const stage = getCurrentStage(state);
  if (stage.id !== event) return state;
  return nextStage(state);
}
