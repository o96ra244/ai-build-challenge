export const CHALLENGE_DURATION_MS = 30_000;
export const MIN_CHARGE_MS = 250;
export const MAX_CHARGE_MS = 2_400;
export const MIN_CAPTURED_PARTICLES = 10;

export type ChallengePhase = "free" | "challenge" | "finished";

export type GameState = {
  readonly phase: ChallengePhase;
  readonly elapsedMs: number;
  readonly score: number;
  readonly finalScore: number | null;
  readonly bestScore: number;
  readonly clockPaused: boolean;
  readonly lastTickAtMs: number | null;
  readonly lastScoredReleaseId: number | null;
};

export type BloomAttempt = {
  readonly valid: boolean;
  readonly releaseId: number;
};

function safeTimestamp(value: number): number {
  return Number.isFinite(value) ? Math.max(0, value) : 0;
}

function safeScore(value: number): number {
  return Number.isFinite(value) ? Math.max(0, Math.floor(value)) : 0;
}

export function createGameState(bestScore = 0): GameState {
  return {
    phase: "free",
    elapsedMs: 0,
    score: 0,
    finalScore: null,
    bestScore: safeScore(bestScore),
    clockPaused: false,
    lastTickAtMs: null,
    lastScoredReleaseId: null,
  };
}

export function clampChargeMs(chargeMs: number): number {
  if (!Number.isFinite(chargeMs)) {
    return 0;
  }

  return Math.min(Math.max(chargeMs, 0), MAX_CHARGE_MS);
}

export function chargeRatio(chargeMs: number): number {
  return clampChargeMs(chargeMs) / MAX_CHARGE_MS;
}

export function isBloomEligible(chargeMs: number, capturedParticleCount: number): boolean {
  return (
    clampChargeMs(chargeMs) >= MIN_CHARGE_MS &&
    Number.isFinite(capturedParticleCount) &&
    capturedParticleCount >= MIN_CAPTURED_PARTICLES
  );
}

export function startChallenge(state: GameState, nowMs: number): GameState {
  if (state.phase === "challenge") {
    return state;
  }

  return {
    ...state,
    phase: "challenge",
    elapsedMs: 0,
    score: 0,
    finalScore: null,
    clockPaused: false,
    lastTickAtMs: safeTimestamp(nowMs),
    lastScoredReleaseId: null,
  };
}

export function advanceChallenge(state: GameState, nowMs: number): GameState {
  if (state.phase !== "challenge" || state.clockPaused || state.lastTickAtMs === null) {
    return state;
  }

  const now = safeTimestamp(nowMs);
  const delta = Math.max(0, now - state.lastTickAtMs);
  const elapsedMs = Math.min(CHALLENGE_DURATION_MS, state.elapsedMs + delta);

  if (elapsedMs >= CHALLENGE_DURATION_MS) {
    const bestScore = Math.max(state.bestScore, state.score);
    return {
      ...state,
      phase: "finished",
      elapsedMs: CHALLENGE_DURATION_MS,
      finalScore: state.score,
      bestScore,
      lastTickAtMs: null,
    };
  }

  return {
    ...state,
    elapsedMs,
    lastTickAtMs: now,
  };
}

export function pauseChallenge(state: GameState, nowMs: number): GameState {
  if (state.phase !== "challenge" || state.clockPaused) {
    return state;
  }

  return {
    ...state,
    clockPaused: true,
    lastTickAtMs: safeTimestamp(nowMs),
  };
}

export function resumeChallenge(state: GameState, nowMs: number): GameState {
  if (state.phase !== "challenge" || !state.clockPaused) {
    return state;
  }

  return {
    ...state,
    clockPaused: false,
    lastTickAtMs: safeTimestamp(nowMs),
  };
}

export function getRemainingMs(state: GameState): number {
  if (state.phase === "free") {
    return CHALLENGE_DURATION_MS;
  }

  return Math.max(0, CHALLENGE_DURATION_MS - state.elapsedMs);
}

export function registerBloom(state: GameState, attempt: BloomAttempt): GameState {
  if (
    state.phase !== "challenge" ||
    !attempt.valid ||
    attempt.releaseId === state.lastScoredReleaseId
  ) {
    return state;
  }

  const score = state.score + 1;
  return {
    ...state,
    score,
    bestScore: Math.max(state.bestScore, score),
    lastScoredReleaseId: attempt.releaseId,
  };
}

export function cancelChallenge(state: GameState): GameState {
  if (state.phase !== "challenge") {
    return state;
  }

  return {
    ...state,
    phase: "free",
    elapsedMs: 0,
    score: 0,
    finalScore: null,
    clockPaused: false,
    lastTickAtMs: null,
    lastScoredReleaseId: null,
  };
}

export function resetGame(state: GameState): GameState {
  return createGameState(state.bestScore);
}
