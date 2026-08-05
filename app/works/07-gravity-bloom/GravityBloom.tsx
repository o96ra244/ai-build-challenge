"use client";

import { useEffect, useRef, useState } from "react";

import {
  advanceChallenge,
  cancelChallenge,
  createGameState,
  getRemainingMs,
  registerBloom,
  resetGame,
  resumeChallenge,
  startChallenge,
  pauseChallenge,
  type GameState,
} from "./game";
import type { GravityBloomScene } from "./GravityBloomScene";
import styles from "./page.module.css";

type RuntimeStatus = "loading" | "ready" | "error";

const initialGameState = createGameState();

function formatSeconds(milliseconds: number): string {
  const seconds = Math.max(0, Math.ceil(milliseconds / 1000));
  return `${String(seconds).padStart(2, "0")}s`;
}

function phaseLabel(state: GameState): string {
  if (state.phase === "challenge") {
    return "30秒チャレンジ";
  }
  if (state.phase === "finished") {
    return "チャレンジ終了";
  }
  return "フリープレイ";
}

export function GravityBloom() {
  const canvasHostRef = useRef<HTMLDivElement>(null);
  const sceneRef = useRef<GravityBloomScene | null>(null);
  const gameRef = useRef<GameState>(initialGameState);
  const [game, setGame] = useState<GameState>(initialGameState);
  const [runtimeStatus, setRuntimeStatus] = useState<RuntimeStatus>("loading");
  const [runtimeError, setRuntimeError] = useState("");
  const [webGpuApiAvailable, setWebGpuApiAvailable] = useState<boolean | null>(null);
  const [charging, setCharging] = useState(false);
  const [reducedMotion, setReducedMotion] = useState(false);
  const [statusMessage, setStatusMessage] = useState(
    "核を動かして、光の粒子を集めてください。",
  );

  useEffect(() => {
    const mediaQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
    const updateReducedMotion = () => setReducedMotion(mediaQuery.matches);
    updateReducedMotion();
    mediaQuery.addEventListener("change", updateReducedMotion);

    return () => mediaQuery.removeEventListener("change", updateReducedMotion);
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      const advance = () => {
        const next = advanceChallenge(gameRef.current, performance.now());
        if (next !== gameRef.current) {
          gameRef.current = next;
          setGame(next);
        }
        timerId = window.setTimeout(advance, 100);
      };
      timerId = window.setTimeout(advance, 100);
    }, 100);
    let timerId = timer;

    const handleVisibility = () => {
      const now = performance.now();
      const next = document.visibilityState === "visible"
        ? resumeChallenge(gameRef.current, now)
        : pauseChallenge(gameRef.current, now);
      if (next !== gameRef.current) {
        gameRef.current = next;
        setGame(next);
      }
    };

    document.addEventListener("visibilitychange", handleVisibility);
    return () => {
      window.clearTimeout(timer);
      window.clearTimeout(timerId);
      document.removeEventListener("visibilitychange", handleVisibility);
    };
  }, []);

  useEffect(() => {
    let disposed = false;
    let scene: GravityBloomScene | null = null;
    const container = canvasHostRef.current;

    if (!container) {
      return;
    }

    void import("./GravityBloomScene")
      .then(({ GravityBloomScene: Scene }) => {
        if (disposed) {
          return null;
        }

        scene = new Scene(container, {
          onChargeStateChange: (nextCharging) => {
            setCharging(nextCharging);
            if (nextCharging) {
              setStatusMessage("チャージ中。粒子を核へ引き寄せています。離すと解放します。");
            }
          },
          onRelease: (release) => {
            const next = registerBloom(gameRef.current, {
              valid: release.validBloom,
              releaseId: release.releaseId,
            });
            gameRef.current = next;
            setGame(next);
            if (release.validBloom) {
              setStatusMessage(
                `ブルーム発生。${release.capturedCount}個の粒子を花状に解放しました。${next.phase === "challenge" ? " +1" : ""}`,
              );
            } else {
              setStatusMessage(
                `${release.capturedCount}個を解放。250ms以上・10個以上でブルームが発生します。`,
              );
            }
          },
          onStartChallenge: () => {
            handleStartChallenge();
          },
          onReset: () => {
            handleReset();
          },
          onEscape: () => {
            const next = cancelChallenge(gameRef.current);
            gameRef.current = next;
            setGame(next);
            setStatusMessage("操作を中断しました。フリープレイに戻ります。");
          },
        });
        sceneRef.current = scene;
        return scene.init();
      })
      .then((result) => {
        if (!result || disposed) {
          return;
        }
        setWebGpuApiAvailable(result.webGpuApiAvailable);
        setRuntimeStatus("ready");
        if (gameRef.current.phase === "challenge") {
          scene?.startChallenge();
        }
      })
      .catch((error: unknown) => {
        if (disposed) {
          return;
        }
        setRuntimeStatus("error");
        setRuntimeError(
          error instanceof Error && error.message
            ? `WebGPURendererの初期化に失敗しました: ${error.message}`
            : "WebGPURendererの初期化に失敗しました。WebGL 2対応ブラウザで再読み込みしてください。",
        );
      });

    return () => {
      disposed = true;
      scene?.dispose();
      scene = null;
      sceneRef.current = null;
    };

    function handleStartChallenge() {
      const current = gameRef.current;
      const next = startChallenge(current, performance.now());
      if (next === current) {
        return;
      }

      sceneRef.current?.startChallenge();
      gameRef.current = next;
      setGame(next);
      setStatusMessage("30秒チャレンジ開始。粒子を集めてブルームを咲かせてください。");
    }

    function handleReset() {
      sceneRef.current?.reset();
      const next = resetGame(gameRef.current);
      gameRef.current = next;
      setGame(next);
      setCharging(false);
      setStatusMessage("粒子とスコアをリセットしました。フリープレイ中です。");
    }
  }, []);

  const handleStartButton = () => {
    const current = gameRef.current;
    const next = startChallenge(current, performance.now());
    if (next === current) {
      return;
    }

    sceneRef.current?.startChallenge();
    gameRef.current = next;
    setGame(next);
    setStatusMessage("30秒チャレンジ開始。粒子を集めてブルームを咲かせてください。");
  };

  const handleResetButton = () => {
    sceneRef.current?.reset();
    const next = resetGame(gameRef.current);
    gameRef.current = next;
    setGame(next);
    setCharging(false);
    setStatusMessage("粒子とスコアをリセットしました。フリープレイ中です。");
  };

  const isChallengeRunning = game.phase === "challenge";
  const startButtonLabel = game.phase === "finished" ? "もう一度挑戦" : "30秒チャレンジ";
  const scoreValue = game.phase === "free" ? "—" : String(game.score);
  const runtimeLabel = runtimeStatus === "loading"
    ? "Three.jsを準備中"
    : runtimeStatus === "error"
      ? "描画を開始できません"
      : "描画中";
  const backendLabel = webGpuApiAvailable === null
    ? "WebGPURenderer"
    : webGpuApiAvailable
      ? "WebGPU API detected · WebGPURenderer"
      : "WebGPU API unavailable · WebGL 2 fallback";

  return (
    <section className={styles.experience} aria-labelledby="play-title">
      <header className={styles.experienceHeader}>
        <div>
          <p className={styles.kicker}>PLAY FIELD / DIRECT MANIPULATION</p>
          <h2 id="play-title">集めて、咲かせる</h2>
          <p className={styles.experienceLead}>
            光の核を動かし、長押しで粒子を集めて、離す。条件を満たすと花状の衝撃波が咲きます。
          </p>
        </div>
        <span className={`${styles.runtimeBadge} ${runtimeStatus === "error" ? styles.runtimeBadgeError : ""}`}>
          <span aria-hidden="true" className={styles.runtimeDot} />
          {runtimeLabel}
        </span>
      </header>

      <div className={styles.stageShell}>
        <div
          ref={canvasHostRef}
          className={styles.canvasHost}
          tabIndex={0}
          role="group"
          aria-label="Gravity Bloomの操作領域"
          aria-describedby="controls-help"
        >
          <div className={styles.canvasHint} aria-hidden="true">
            <span>{charging ? "CHARGING" : "MOVE THE CORE"}</span>
            <small>{charging ? "release to bloom" : "hold + release"}</small>
          </div>
          {runtimeStatus === "loading" ? (
            <p className={styles.stageMessage}>光の粒子を準備しています…</p>
          ) : null}
          {runtimeStatus === "error" ? (
            <p className={styles.stageError} role="alert">{runtimeError}</p>
          ) : null}
        </div>

        <div className={styles.hud} aria-label="プレイ状態">
          <div className={styles.hudItem}>
            <span>MODE</span>
            <strong>{phaseLabel(game)}</strong>
          </div>
          <div className={styles.hudItem}>
            <span>SCORE</span>
            <strong>{scoreValue}</strong>
          </div>
          <div className={styles.hudItem}>
            <span>TIME</span>
            <strong>{isChallengeRunning || game.phase === "finished" ? formatSeconds(getRemainingMs(game)) : "FREE"}</strong>
          </div>
          <div className={styles.hudStatus} aria-live="polite">{statusMessage}</div>
        </div>
      </div>

      <div className={styles.controlRow}>
        <button
          type="button"
          className={styles.primaryButton}
          onClick={handleStartButton}
          disabled={isChallengeRunning || runtimeStatus === "error"}
        >
          {startButtonLabel}
        </button>
        <button type="button" className={styles.secondaryButton} onClick={handleResetButton}>
          リセット
        </button>
        <p className={styles.scoreSummary}>
          {game.phase === "finished" ? `最終スコア ${game.finalScore ?? 0} / 最高 ${game.bestScore}` : "有効なブルームだけが加点されます"}
        </p>
      </div>

      <p id="controls-help" className={styles.controlsHelp}>
        ポインター／タッチで核を移動。長押しでチャージし、離すと解放します。250ms以上かつ10個以上の粒子でブルーム成立。
        キーボードはWASD／矢印で移動、Spaceでチャージ、Enterで開始、Rでリセット、Escapeで中断します。
      </p>

      <div className={styles.techRow}>
        <span>{backendLabel}</span>
        <span>WebGL 2 fallback ready</span>
        <span>{reducedMotion ? "reduced-motion on" : "reduced-motion ready"}</span>
      </div>

      {game.phase === "finished" ? (
        <p className={styles.finishNotice} role="status">
          30秒終了。{game.finalScore ?? 0}回の有効なブルームでした。もう一度挑戦できます。
        </p>
      ) : null}
    </section>
  );
}
