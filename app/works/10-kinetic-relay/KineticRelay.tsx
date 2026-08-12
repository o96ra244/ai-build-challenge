"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";

import type { DeskChainReactionScene, DeskChainUiState } from "./DeskChainReactionScene";
import styles from "./page.module.css";

const DEFAULT_STATE: DeskChainUiState = {
  runtimeStatus: "loading",
  backend: "pending",
  phase: "ready",
  stageLabel: "STOPPER → RED MARBLE",
  stageIndex: 0,
  stageCount: 3,
  progress: 0,
  statusText: "READY — EXPLORE THE DESK",
  canStart: false,
  cameraMode: "follow",
};

export function KineticRelay() {
  const canvasHostRef = useRef<HTMLDivElement>(null);
  const sceneRef = useRef<DeskChainReactionScene | null>(null);
  const [state, setState] = useState<DeskChainUiState>(DEFAULT_STATE);
  const [loadingMessage, setLoadingMessage] = useState("夕方の子ども部屋を準備しています");
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
  const stageNumber = isComplete ? state.stageCount : state.stageIndex + 1;

  return (
    <main className={styles.experience} aria-labelledby="kinetic-relay-title">
      <div className={styles.canvasHost} ref={canvasHostRef} aria-describedby="kinetic-relay-description" />

      <div className={styles.uiLayer}>
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

        <header className={styles.header}>
          <p className={styles.workNumber}>WORK 10 <span>/ 15</span></p>
          <h1 id="kinetic-relay-title" className={styles.title}>
            <span className={styles.titleMain}>KINETIC RELAY</span>
            <em className={styles.titleSub}>DESK CHAIN REACTION</em>
          </h1>
          <p id="kinetic-relay-description" className={styles.description}>
            ACT 1 physics quality prototype。ビー玉が本と定規の坂を転がり、消しゴムへ衝突します。
          </p>
        </header>

        <div className={styles.topRight}>
          <Link href="/" className={styles.indexLink} aria-label="作品一覧へ戻る">INDEX ↗</Link>
        </div>

        <section className={styles.statusPanel} aria-label="Chain reaction status">
          <p className={styles.statusText} aria-live="polite">{state.statusText}</p>
          <p className={styles.stageText}>{String(stageNumber).padStart(2, "0")} / {String(state.stageCount).padStart(2, "0")} · {state.stageLabel}</p>
          <div className={styles.progressTrack} aria-hidden="true"><span style={{ width: `${state.progress * 100}%` }} /></div>
        </section>

        <nav className={styles.controlBar} aria-label="Chain reaction and camera controls">
          <button type="button" className={styles.primaryButton} disabled={!state.canStart} onClick={() => sceneRef.current?.start()}>START</button>
          <button type="button" className={styles.secondaryButton} disabled={!isRunning && !isComplete && !isError} onClick={() => sceneRef.current?.restart()}>RESTART</button>
          <button type="button" className={styles.secondaryButton} aria-pressed={state.cameraMode === "follow"} onClick={() => sceneRef.current?.toggleCameraMode()}>
            {state.cameraMode === "follow" ? "FOLLOW" : "FREE"}
          </button>
          <button type="button" className={styles.secondaryButton} onClick={() => sceneRef.current?.home()}>HOME</button>
        </nav>

        <p className={styles.hint}>DRAG ROTATE · WHEEL / PINCH ZOOM</p>
      </div>
    </main>
  );
}
