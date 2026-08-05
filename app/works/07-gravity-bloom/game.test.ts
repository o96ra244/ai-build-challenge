import { describe, expect, it } from "vitest";

import {
  CHALLENGE_DURATION_MS,
  MAX_CHARGE_MS,
  MIN_CHARGE_MS,
  MIN_CAPTURED_PARTICLES,
  advanceChallenge,
  cancelChallenge,
  createGameState,
  getRemainingMs,
  isBloomEligible,
  pauseChallenge,
  registerBloom,
  resetGame,
  resumeChallenge,
  startChallenge,
} from "./game";

describe("Gravity Bloom game rules", () => {
  it("チャージ時間を0〜最大値へ制限する", () => {
    expect(isBloomEligible(-1, MIN_CAPTURED_PARTICLES)).toBe(false);
    expect(isBloomEligible(MIN_CHARGE_MS - 1, MIN_CAPTURED_PARTICLES)).toBe(false);
    expect(isBloomEligible(MIN_CHARGE_MS, MIN_CAPTURED_PARTICLES)).toBe(true);
    expect(isBloomEligible(MAX_CHARGE_MS + 1000, MIN_CAPTURED_PARTICLES)).toBe(true);
    expect(isBloomEligible(MIN_CHARGE_MS, MIN_CAPTURED_PARTICLES - 1)).toBe(false);
  });

  it("フリープレイの有効ブルームは成立するが加点されない", () => {
    const free = createGameState();

    expect(isBloomEligible(MIN_CHARGE_MS, MIN_CAPTURED_PARTICLES)).toBe(true);
    expect(registerBloom(free, { valid: true, releaseId: 1 })).toEqual(free);
  });

  it("freeからchallengeを開始すると時刻とスコアをリセットする", () => {
    const started = startChallenge(
      { ...createGameState(4), score: 9, finalScore: 9 },
      1000,
    );

    expect(started.phase).toBe("challenge");
    expect(started.elapsedMs).toBe(0);
    expect(started.score).toBe(0);
    expect(started.finalScore).toBeNull();
    expect(started.bestScore).toBe(4);
    expect(startChallenge(started, 1100)).toEqual(started);
  });

  it("有効なブルーム1回だけを1点として扱う", () => {
    const started = startChallenge(createGameState(), 1000);
    const scored = registerBloom(started, { valid: true, releaseId: 7 });
    const duplicate = registerBloom(scored, { valid: true, releaseId: 7 });
    const invalid = registerBloom(duplicate, { valid: false, releaseId: 8 });

    expect(scored.score).toBe(1);
    expect(duplicate.score).toBe(1);
    expect(invalid.score).toBe(1);
  });

  it("チャレンジの残り時間を実時間差分で進め、終了後は加点しない", () => {
    const started = startChallenge(createGameState(), 1000);
    const halfway = advanceChallenge(started, 16_000);
    const finished = advanceChallenge(halfway, 31_000);
    const afterFinished = registerBloom(finished, { valid: true, releaseId: 3 });

    expect(halfway.elapsedMs).toBe(15_000);
    expect(getRemainingMs(halfway)).toBe(15_000);
    expect(finished.phase).toBe("finished");
    expect(finished.elapsedMs).toBe(CHALLENGE_DURATION_MS);
    expect(getRemainingMs(finished)).toBe(0);
    expect(afterFinished.score).toBe(0);
  });

  it("非表示時間をpause/resumeで除外する", () => {
    const started = startChallenge(createGameState(), 1000);
    const paused = pauseChallenge(started, 5000);
    const whileHidden = advanceChallenge(paused, 25_000);
    const resumed = resumeChallenge(whileHidden, 25_000);
    const afterResume = advanceChallenge(resumed, 26_000);

    expect(paused.clockPaused).toBe(true);
    expect(whileHidden.elapsedMs).toBe(0);
    expect(afterResume.elapsedMs).toBe(1000);
  });

  it("終了後に再挑戦でき、resetとEscape相当の中断でfreeへ戻る", () => {
    const started = startChallenge(createGameState(), 0);
    const finished = advanceChallenge(started, CHALLENGE_DURATION_MS);
    const retried = startChallenge(finished, 40_000);
    const cancelled = cancelChallenge(retried);
    const reset = resetGame({ ...cancelled, bestScore: 3, score: 2 });

    expect(finished.phase).toBe("finished");
    expect(retried.phase).toBe("challenge");
    expect(retried.score).toBe(0);
    expect(cancelled.phase).toBe("free");
    expect(reset.phase).toBe("free");
    expect(reset.score).toBe(0);
    expect(reset.bestScore).toBe(3);
  });
});
