"use client";

import { useEffect, useRef, useState } from "react";

import type { LowPolyTreeScene } from "./LowPolyTreeScene";
import styles from "./page.module.css";

type RuntimeStatus = "loading" | "ready" | "error";

export function LowPolyTreeExplorer() {
  const canvasHostRef = useRef<HTMLDivElement>(null);
  const sceneRef = useRef<LowPolyTreeScene | null>(null);
  const [runtimeStatus, setRuntimeStatus] = useState<RuntimeStatus>("loading");
  const [runtimeError, setRuntimeError] = useState("");
  const [webGpuApiAvailable, setWebGpuApiAvailable] = useState<boolean | null>(null);
  const [exploded, setExploded] = useState(false);
  const [autoRotate, setAutoRotate] = useState(false);
  const [reducedMotion, setReducedMotion] = useState(false);
  const [statusMessage, setStatusMessage] = useState(
    "ドラッグで回転・ホイールまたはピンチで拡大できます。",
  );

  useEffect(() => {
    const container = canvasHostRef.current;
    if (!container) {
      return;
    }

    let disposed = false;
    let scene: LowPolyTreeScene | null = null;
    const mediaQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
    const reduced = mediaQuery.matches;
    setReducedMotion(reduced);
    setAutoRotate(!reduced);

    const handleMotionPreference = (): void => {
      const nextReducedMotion = mediaQuery.matches;
      setReducedMotion(nextReducedMotion);
      sceneRef.current?.setReducedMotion(nextReducedMotion);
    };
    mediaQuery.addEventListener("change", handleMotionPreference);

    void import("./LowPolyTreeScene")
      .then(async ({ LowPolyTreeScene: Scene }) => {
        if (disposed) {
          return null;
        }

        scene = new Scene(container, {
          reducedMotion: mediaQuery.matches,
          onExplodedChange: (nextExploded) => {
            setExploded(nextExploded);
            setStatusMessage(nextExploded ? "木をパーツごとに分解しています。" : "木を組み立てた状態へ戻しました。");
          },
          onAutoRotateChange: (nextAutoRotate) => {
            setAutoRotate(nextAutoRotate);
            setStatusMessage(nextAutoRotate ? "自動回転を始めました。" : "自動回転を止めました。");
          },
        });
        sceneRef.current = scene;
        const result = await scene.init();
        if (disposed) {
          scene.dispose();
          return null;
        }

        setWebGpuApiAvailable(result.webGpuApiAvailable);
        setRuntimeStatus("ready");
        return result;
      })
      .catch((error: unknown) => {
        if (disposed) {
          return;
        }

        const message = error instanceof Error ? error.message : "3Dシーンを初期化できませんでした。";
        setRuntimeError(message);
        setRuntimeStatus("error");
      });

    return () => {
      disposed = true;
      mediaQuery.removeEventListener("change", handleMotionPreference);
      scene?.dispose();
      sceneRef.current = null;
    };
  }, []);

  const toggleExploded = (): void => {
    sceneRef.current?.setExploded(!exploded);
  };

  const toggleAutoRotate = (): void => {
    sceneRef.current?.setAutoRotate(!autoRotate);
  };

  const resetScene = (): void => {
    sceneRef.current?.reset();
    setStatusMessage("視点、分解状態、自動回転を初期状態へ戻しました。");
  };

  const zoom = (direction: "in" | "out"): void => {
    sceneRef.current?.zoomBy(direction);
    setStatusMessage(direction === "in" ? "木へ近づきました。" : "木から離れました。");
  };

  const isReady = runtimeStatus === "ready";

  return (
    <section className={styles.experience} aria-labelledby="explorer-title">
      <div className={styles.experienceHeader}>
        <div>
          <p className={styles.kicker}>INTERACTIVE 3D SCENE</p>
          <h2 id="explorer-title">触れて、分解して、眺める</h2>
          <p className={styles.experienceLead}>
            低ポリゴンの木を回転・拡大し、パーツを分解して構造を眺められます。
          </p>
        </div>
        <p className={`${styles.runtimeBadge} ${runtimeStatus === "error" ? styles.runtimeBadgeError : ""}`}>
          <span className={styles.runtimeDot} aria-hidden="true" />
          {runtimeStatus === "loading" ? "3Dを準備中" : runtimeStatus === "error" ? "初期化エラー" : "WebGPURenderer"}
        </p>
      </div>

      <div className={styles.stageShell}>
        <div
          ref={canvasHostRef}
          className={styles.canvasHost}
          aria-label="低ポリゴンツリーを操作する3Dステージ"
          aria-describedby="canvas-help"
        >
          {runtimeStatus === "loading" && <p className={styles.canvasOverlay}>木を組み立てています…</p>}
          {runtimeStatus === "error" && (
            <p className={styles.canvasError} role="alert">
              3D表示を開始できませんでした。{runtimeError}
            </p>
          )}
          <p id="canvas-help" className={styles.canvasHint}>
            ドラッグで回転・ホイールまたはピンチで拡大
          </p>
        </div>

        <div className={styles.controlPanel}>
          <div className={styles.controlHeader}>
            <p className={styles.controlLabel}>TREE CONTROLS</p>
            <p className={styles.statusMessage} aria-live="polite">{statusMessage}</p>
          </div>
          <div className={styles.controlRows}>
            <div className={styles.primaryControls}>
              <button type="button" className={styles.primaryButton} onClick={toggleExploded} disabled={!isReady} aria-pressed={exploded}>
                {exploded ? "組み立てる" : "分解する"}
              </button>
              <button type="button" onClick={resetScene} disabled={!isReady}>
                視点をリセット
              </button>
              <button type="button" onClick={toggleAutoRotate} disabled={!isReady} aria-pressed={autoRotate}>
                {autoRotate ? "自動回転を止める" : "自動回転を始める"}
              </button>
            </div>
            <div className={styles.zoomControls} aria-label="ズーム操作">
              <span>ズーム</span>
              <button type="button" onClick={() => zoom("out")} disabled={!isReady} aria-label="木から離れる">−</button>
              <button type="button" onClick={() => zoom("in")} disabled={!isReady} aria-label="木へ近づく">＋</button>
            </div>
          </div>
          <div className={styles.statusDetails}>
            <span>{exploded ? "分解表示" : "組み立て表示"}</span>
            <span>{autoRotate ? "自動回転 ON" : "自動回転 OFF"}</span>
            <span>{reducedMotion ? "動きを控えめに設定中" : "通常の動き"}</span>
            <span>{webGpuApiAvailable === null ? "GPU APIを確認中" : webGpuApiAvailable ? "WebGPU API利用可能" : "WebGL 2フォールバック対象"}</span>
          </div>
        </div>
      </div>
    </section>
  );
}
