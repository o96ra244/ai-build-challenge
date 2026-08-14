"use client";

import { useEffect, useRef, useState } from "react";

import type { SnowGlobeVisualScene } from "./SnowGlobeVisualScene";
import styles from "./page.module.css";

type RuntimeStatus = "loading" | "ready" | "error";

export function SnowGlobeVisualPrototype() {
  const canvasHostRef = useRef<HTMLDivElement>(null);
  const sceneRef = useRef<SnowGlobeVisualScene | null>(null);
  const [runtimeStatus, setRuntimeStatus] = useState<RuntimeStatus>("loading");
  const [runtimeError, setRuntimeError] = useState("");

  useEffect(() => {
    const container = canvasHostRef.current;
    if (!container) {
      return;
    }

    let disposed = false;
    let scene: SnowGlobeVisualScene | null = null;
    const mediaQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
    const handleMotionPreference = (): void => {
      sceneRef.current?.setReducedMotion(mediaQuery.matches);
    };
    mediaQuery.addEventListener("change", handleMotionPreference);

    void import("./SnowGlobeVisualScene")
      .then(async ({ SnowGlobeVisualScene: Scene }) => {
        if (disposed) {
          return null;
        }
        scene = new Scene(container, mediaQuery.matches);
        sceneRef.current = scene;
        const result = await scene.init();
        if (disposed) {
          scene.dispose();
          return null;
        }
        if (!result.ready) {
          setRuntimeError(result.errorMessage ?? "3D表示を開始できませんでした。");
          setRuntimeStatus("error");
          return result;
        }
        setRuntimeStatus("ready");
        return result;
      })
      .catch((error: unknown) => {
        if (disposed) {
          return;
        }
        setRuntimeError(error instanceof Error ? error.message : "静止画レンダーを開始できませんでした。");
        setRuntimeStatus("error");
      });

    return () => {
      disposed = true;
      mediaQuery.removeEventListener("change", handleMotionPreference);
      scene?.dispose();
      sceneRef.current = null;
    };
  }, []);

  return (
    <main className={styles.page} aria-labelledby="snow-globe-title">
      <div
        ref={canvasHostRef}
        className={styles.canvasHost}
        aria-describedby="snow-globe-description snow-globe-instructions"
      >
        {runtimeStatus === "loading" && (
          <div className={styles.canvasStatus} role="status">
            静かな冬景色を準備しています…
          </div>
        )}
        {runtimeStatus === "error" && (
          <div className={styles.canvasError} role="alert">
            <strong>この展示を表示できませんでした。</strong>
            <span>WebGPU対応ブラウザで再読み込みしてください。</span>
            <small>{runtimeError}</small>
          </div>
        )}
      </div>

      <div className={styles.uiLayer}>
        <header className={styles.titleBlock}>
          <p className={styles.eyebrow}>10 / 15</p>
          <h1 id="snow-globe-title">
            <span>SNOW</span>
            <span>GLOBE</span>
          </h1>
          <p id="snow-globe-description" className={styles.subtitle}>Winter in Suspension</p>
        </header>
        <div className={styles.interactionBlock}>
          <p id="snow-globe-instructions" className={styles.interactionHint}>DRAG TO TURN · FLICK / SPACE TO SHAKE</p>
          <button
            type="button"
            className={styles.shakeButton}
            aria-label="スノードームを振る"
            onClick={() => sceneRef.current?.shake()}
          >
            SHAKE
          </button>
        </div>
        <p className={styles.prototypeLabel}>VISUAL PROTOTYPE</p>
      </div>
    </main>
  );
}
