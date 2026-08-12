"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";

import type { DeskChainReactionScene, DeskChainUiState } from "./DeskChainReactionScene";
import styles from "./page.module.css";

const DEFAULT_STATE: DeskChainUiState = {
  runtimeStatus: "loading",
  backend: "pending",
  phase: "ready",
  stageLabel: "RED MARBLE / RAMP",
  stageIndex: 0,
  stageCount: 9,
  progress: 0,
  statusText: "READY — START THE DESK RELAY",
  canStart: false,
};

export function KineticRelay() {
  const canvasHostRef = useRef<HTMLDivElement>(null);
  const sceneRef = useRef<DeskChainReactionScene | null>(null);
  const [state, setState] = useState<DeskChainUiState>(DEFAULT_STATE);
  const [loadingMessage, setLoadingMessage] = useState("夕方の机を準備しています");
  const [runtimeError, setRuntimeError] = useState("");

  useEffect(() => {
    const container = canvasHostRef.current;
    if (!container) return;
    let disposed = false;
    let scene: DeskChainReactionScene | null = null;
    const mediaQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
    const handleMotionPreference = (): void => sceneRef.current?.setReducedMotion(mediaQuery.matches);
    mediaQuery.addEventListener("change", handleMotionPreference);

    void import("./DeskChainReactionScene")
      .then(async ({ DeskChainReactionScene: Scene }) => {
        if (disposed) return;
        scene = new Scene(container, {
          reducedMotion: mediaQuery.matches,
          onLoadingState: (message) => {
            if (!disposed) setLoadingMessage(message);
          },
          onStateChange: (nextState) => {
            if (!disposed) setState(nextState);
          },
        });
        sceneRef.current = scene;
        try {
          await scene.init();
        } catch (error: unknown) {
          if (disposed) return;
          scene.dispose();
          setRuntimeError(error instanceof Error ? error.message : "3D chain reaction could not be initialized.");
          setState((current) => ({ ...current, runtimeStatus: "error", canStart: false, statusText: "ERROR — RESTART REQUIRED" }));
        }
      })
      .catch((error: unknown) => {
        if (disposed) return;
        setRuntimeError(error instanceof Error ? error.message : "3D chain reaction could not be loaded.");
        setState((current) => ({ ...current, runtimeStatus: "error", canStart: false, statusText: "ERROR — RESTART REQUIRED" }));
      });

    return () => {
      disposed = true;
      mediaQuery.removeEventListener("change", handleMotionPreference);
      scene?.dispose();
      sceneRef.current = null;
    };
  }, []);

  const isRunning = state.phase === "running";
  const isComplete = state.phase === "complete";
  const isError = state.runtimeStatus === "error" || state.phase === "error";

  return (
    <main className={styles.experience} aria-labelledby="kinetic-relay-title">
      <div className={styles.canvasHost} ref={canvasHostRef} aria-describedby="kinetic-relay-description">
        {state.runtimeStatus === "loading" && (
          <div className={styles.loadingPanel} role="status" aria-live="polite">
            <span className={styles.loadingMark} aria-hidden="true" />
            <span>{loadingMessage}</span>
          </div>
        )}
        {isError && (
          <div className={styles.errorPanel} role="alert">
            <strong>CHAIN REACTION STOPPED</strong>
            <span>{state.phase === "error" ? state.statusText : "WebGL / Rapier initialization failed."}</span>
            {runtimeError && <small>{runtimeError}</small>}
          </div>
        )}
      </div>

      <div className={styles.uiLayer}>
        <header className={styles.header}>
          <p className={styles.workNumber}>WORK 10 <span>/ 15</span></p>
          <h1 id="kinetic-relay-title" className={styles.title}>
            <span className={styles.titleMain}>KINETIC RELAY</span>
            <em className={styles.titleSub}>DESK CHAIN REACTION</em>
          </h1>
          <p id="kinetic-relay-description" className={styles.description}>
            夕方の子ども部屋。ビー玉、文房具、積み木、ミニカーが、卓上ベルへ原因を手渡します。
          </p>
        </header>

        <div className={styles.topRight}>
          <span className={styles.backendLabel}>DESK STUDY / 10</span>
          <Link href="/" className={styles.indexLink} aria-label="作品一覧へ戻る">INDEX ↗</Link>
        </div>

        <section className={styles.controlPanel} aria-label="Chain reaction controls">
          <div className={styles.panelHeading}>
            <span>ONE DESK / ONE RELAY</span>
            <span className={styles.selectorDot} aria-hidden="true" />
          </div>
          <p className={styles.sequenceHint}>RED MARBLE → ERASER → CLOTHESPIN → BLOCKS → CAR → BELL</p>
          <div className={styles.actionRow}>
            <button type="button" className={styles.startButton} disabled={!state.canStart} onClick={() => sceneRef.current?.start()}>
              START <span aria-hidden="true">↗</span>
            </button>
            {(isRunning || isComplete || isError) && (
              <button type="button" className={styles.restartButton} onClick={() => sceneRef.current?.restart()}>
                RESTART
              </button>
            )}
          </div>
        </section>

        <section className={styles.statusPanel} aria-label="Chain reaction status">
          <p className={styles.statusKicker}>RELAY / LIVE SEQUENCE</p>
          <p className={styles.statusText} aria-live="polite">{state.statusText}</p>
          <div className={styles.progressTrack} aria-hidden="true"><span style={{ width: `${state.progress * 100}%` }} /></div>
          {isRunning && <p className={styles.stageText}>{String(state.stageIndex + 1).padStart(2, "0")} / {String(state.stageCount).padStart(2, "0")} · {state.stageLabel}</p>}
          {isComplete && <p className={styles.completeText}>GOAL BELL · COMPLETE</p>}
        </section>

        <p className={styles.hint}>PRESS START · WATCH EACH CONTACT · RESTART IF THE CHAIN STOPS</p>

        <footer className={styles.footer}>
          <span>WOOD / PAPER / TOYS</span>
          <span>ONE DESK · ONE GOAL BELL</span>
        </footer>
      </div>
    </main>
  );
}
