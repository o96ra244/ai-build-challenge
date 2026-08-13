"use client";

import { useEffect, useRef, useState } from "react";

import { ASSET_SIZE_BYTES, createRuntimeMetadata, formatFileSize } from "./metadata";
import {
  canCommitLoadResult,
  createInitialViewerState,
  transitionViewerState,
  type ViewerState,
} from "./viewerState";
import styles from "./page.module.css";

const SOURCE_URL = "https://superspl.at/scene/2826d2c0";
const LICENSE_URL = "https://creativecommons.org/licenses/by/4.0/";

export function GaussianSplatExplorer() {
  const canvasHostRef = useRef<HTMLDivElement>(null);
  const sceneRef = useRef<import("./GaussianSplatScene").GaussianSplatScene | null>(null);
  const attemptIdRef = useRef(0);
  const [attempt, setAttempt] = useState(0);
  const [state, setState] = useState<ViewerState>(() => createInitialViewerState());

  useEffect(() => {
    const container = canvasHostRef.current;
    if (!container) {
      return;
    }

    const attemptId = attemptIdRef.current + 1;
    attemptIdRef.current = attemptId;
    let disposed = false;
    let scene: import("./GaussianSplatScene").GaussianSplatScene | null = null;
    setState((current) => transitionViewerState(current, { type: "start" }));

    void import("./GaussianSplatScene")
      .then(async ({ GaussianSplatScene }) => {
        if (disposed) {
          return;
        }
        scene = new GaussianSplatScene(container);
        sceneRef.current = scene;
        const result = await scene.init();
        if (!canCommitLoadResult(attemptId, attemptIdRef.current, disposed)) {
          return;
        }
        if (result.status === "ready") {
          setState((current) => transitionViewerState(current, {
            type: "ready",
            metadata: createRuntimeMetadata(result.splatCount, result.backend),
          }));
        } else if (result.status === "unsupported") {
          setState((current) => transitionViewerState(current, { type: "unsupported", message: result.message }));
        } else if (result.status === "error") {
          setState((current) => transitionViewerState(current, { type: "error", message: result.message }));
        }
      })
      .catch((error: unknown) => {
        if (!canCommitLoadResult(attemptId, attemptIdRef.current, disposed)) {
          return;
        }
        const message = error instanceof Error ? error.message : "Gaussian Splat viewer module failed to load.";
        setState((current) => transitionViewerState(current, {
          type: "error",
          message: `ビューアーの初期化に失敗しました。${message}`,
        }));
      });

    return () => {
      disposed = true;
      scene?.dispose();
      if (sceneRef.current === scene) {
        sceneRef.current = null;
      }
    };
  }, [attempt]);

  const isReady = state.status === "ready";
  const isLoading = state.status === "idle" || state.status === "loading";
  const retry = (): void => {
    setState((current) => transitionViewerState(current, { type: "retry" }));
    setAttempt((current) => current + 1);
  };

  return (
    <main className={styles.viewer} aria-labelledby="gaussian-splat-title">
      <div
        className={styles.canvasHost}
        ref={canvasHostRef}
        aria-describedby="gaussian-splat-description gaussian-splat-controls"
      >
        <p id="gaussian-splat-description" className={styles.srOnly}>
          Tomatoesという実写由来のSPZ v4 Gaussian Splatを、ドラッグで回転し、スクロールまたはピンチで拡大縮小して観察できます。パン操作は無効です。
        </p>
        {isLoading && (
          <div className={styles.stateOverlay} role="status" aria-live="polite">
            <div className={styles.loadingCard}>
              <span className={styles.loadingMark} aria-hidden="true" />
              <span>Loading Gaussian splat…</span>
              <small>{formatFileSize(ASSET_SIZE_BYTES)}</small>
            </div>
          </div>
        )}
        {state.status === "error" && (
          <div className={styles.stateOverlay} role="alert" aria-live="assertive">
            <div className={styles.messageCard}>
              <strong>Gaussian Splatを表示できませんでした。</strong>
              <span>{state.message}</span>
              <button type="button" className={styles.retryButton} onClick={retry}>
                Retry
              </button>
            </div>
          </div>
        )}
        {state.status === "unsupported" && (
          <div className={styles.stateOverlay} role="alert" aria-live="assertive">
            <div className={styles.messageCard}>
              <strong>Gaussian Splatを表示できません。</strong>
              <span>{state.message}</span>
            </div>
          </div>
        )}
      </div>

      <div className={styles.uiLayer}>
        <header className={styles.headerBlock}>
          <span className={styles.eyebrow}>WORK 10</span>
          <h1 id="gaussian-splat-title" className={styles.title}>Gaussian Splat Explorer</h1>
          <p className={styles.description}>写真から再構成された3Dスキャンを、ドラッグして自由に観察できます。</p>
          <p id="gaussian-splat-controls" className={styles.controlsHint}>Drag to orbit · Scroll / pinch to zoom</p>
        </header>

        <button
          type="button"
          className={styles.homeButton}
          disabled={!isReady}
          onClick={() => sceneRef.current?.resetCamera()}
        >
          HOME
        </button>

        <div className={styles.metadata} aria-label="Gaussian Splat metadata">
          {isReady ? (
            <>
              <span>{state.metadata.version}</span>
              <span>{state.metadata.splatCount.toLocaleString("en-US")} splats</span>
              <span>{state.metadata.renderer}</span>
              <span>{state.metadata.fileSize}</span>
            </>
          ) : (
            <>
              <span>SPZ v4</span>
              <span>{isLoading ? "Loading" : "Unavailable"}</span>
              <span>{formatFileSize(ASSET_SIZE_BYTES)}</span>
            </>
          )}
        </div>

        <div className={styles.attribution}>
          <span>Scan by Grail</span>
          <span aria-hidden="true"> · </span>
          <a href={SOURCE_URL} target="_blank" rel="noopener noreferrer">Source</a>
          <span aria-hidden="true"> · </span>
          <a href={LICENSE_URL} target="_blank" rel="noopener noreferrer">CC BY 4.0</a>
        </div>
      </div>
    </main>
  );
}
