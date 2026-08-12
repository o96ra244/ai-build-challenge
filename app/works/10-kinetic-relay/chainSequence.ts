export const CHAIN_STAGES = [
  { id: "marble", label: "RED MARBLE / RAMP", timeout: 5.5 },
  { id: "eraser", label: "ERASER → CLOTHESPIN", timeout: 5.5 },
  { id: "blocks", label: "PENCIL / WOODEN BLOCKS", timeout: 6.5 },
  { id: "car", label: "TOY CAR / BOOK RAMP", timeout: 5.5 },
  { id: "seesaw", label: "RULER SEESAW", timeout: 4.5 },
  { id: "blue-marble", label: "BLUE MARBLE → PAPER CUP", timeout: 5.5 },
  { id: "bell", label: "BALANCE RULER → GOAL BELL", timeout: 4.5 },
] as const;

export type ChainStageId = (typeof CHAIN_STAGES)[number]["id"];
export type ChainPhase = "ready" | "running" | "complete" | "error";
export type ChainEvent =
  | "red-marble-impact"
  | "eraser-clothespin"
  | "pencil-block-impact"
  | "last-block-chock"
  | "car-seesaw-impact"
  | "seesaw-released"
  | "blue-cup-caught"
  | "bell-struck";

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

export function getCurrentStage(state: ChainState): (typeof CHAIN_STAGES)[number] {
  return CHAIN_STAGES[Math.min(CHAIN_STAGES.length - 1, Math.max(0, state.stageIndex))] ?? CHAIN_STAGES[0];
}

export function getStageProgress(state: ChainState): number {
  const stage = getCurrentStage(state);
  return state.phase === "complete" ? 1 : Math.min(1, Math.max(0, state.stageElapsed / stage.timeout));
}

export function getRunProgress(state: ChainState): number {
  const stagePortion = (state.stageIndex + getStageProgress(state)) / CHAIN_STAGES.length;
  return state.phase === "complete" ? 1 : Math.min(1, Math.max(0, stagePortion));
}

export function advanceChain(state: ChainState, deltaSeconds: number): ChainAdvanceResult {
  if (state.phase !== "running") return { state, timedOut: false };
  const nextElapsed = state.stageElapsed + finiteDelta(deltaSeconds);
  const timedOut = nextElapsed > getCurrentStage(state).timeout;
  if (!timedOut) {
    return {
      state: { ...state, stageElapsed: nextElapsed, totalElapsed: state.totalElapsed + finiteDelta(deltaSeconds) },
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
  const valid: Partial<Record<ChainStageId, ChainEvent>> = {
    marble: "red-marble-impact",
    eraser: "eraser-clothespin",
    blocks: "last-block-chock",
    car: "car-seesaw-impact",
    seesaw: "seesaw-released",
    "blue-marble": "blue-cup-caught",
    bell: "bell-struck",
  };
  const stageId = getCurrentStage(state).id;
  if (valid[stageId] !== event) return state;
  return nextStage(state);
}
