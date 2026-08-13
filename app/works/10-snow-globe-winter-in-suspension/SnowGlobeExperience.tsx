"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";

import type { SceneStatus, SnowGlobeScene } from "./SnowGlobeScene";
import styles from "./page.module.css";

type RuntimeStatus = "loading" | "ready" | "error";

const STATUS_LABELS: Record<SceneStatus, string> = {
  loading: "冬景色を組み立てています。",
  quiet: "静かな雪が残っています。もう一度、振れます。",
  turning: "ドームを眺めています。速く振ると雪が舞います。",
  swirling: "液体の渦が立ち上がっています。",
};

export function SnowGlobeExperience() {
  const canvasHostRef = useRef<HTMLDivElement>(null);
  const sceneRef = useRef<SnowGlobeScene | null>(null);
  const [runtimeStatus, setRuntimeStatus] = useState<RuntimeStatus>("loading");
  const [runtimeError, setRuntimeError] = useState("");
  const [backend, setBackend] = useState<"webgpu" | "webgl2" | null>(null);
  const [sceneStatus, setSceneStatus] = useState<SceneStatus>("loading");
  const [reducedMotion, setReducedMotion] = useState(false);
  const [hintVisible, setHintVisible] = useState(true);

  useEffect(() => {
    const container = canvasHostRef.current;
    if (!container) {
      return;
    }

    let disposed = false;
    let scene: SnowGlobeScene | null = null;
    const mediaQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
    setReducedMotion(mediaQuery.matches);

    const handleMotionPreference = (): void => {
      const nextReducedMotion = mediaQuery.matches;
      setReducedMotion(nextReducedMotion);
      sceneRef.current?.setReducedMotion(nextReducedMotion);
    };
    mediaQuery.addEventListener("change", handleMotionPreference);

    const handleKeyDown = (event: KeyboardEvent): void => {
      const target = event.target;
      if (
        target instanceof HTMLInputElement
        || target instanceof HTMLTextAreaElement
        || target instanceof HTMLSelectElement
        || target instanceof HTMLElement && target.isContentEditable
      ) {
        return;
      }

      if (event.code === "Space" && target instanceof HTMLButtonElement) {
        return;
      }

      if (event.code === "Space") {
        event.preventDefault();
        setHintVisible(false);
        sceneRef.current?.shake();
        setSceneStatus("swirling");
      } else if (event.key === "ArrowLeft" || event.key === "ArrowRight") {
        event.preventDefault();
        setHintVisible(false);
        sceneRef.current?.nudgeTurn(event.key === "ArrowLeft" ? "left" : "right");
        setSceneStatus("turning");
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    const hideHint = (): void => setHintVisible(false);
    const hintTimer = window.setTimeout(hideHint, 6400);
    container.addEventListener("pointerdown", hideHint, { passive: true });

    void import("./SnowGlobeScene")
      .then(async ({ SnowGlobeScene: Scene }) => {
        if (disposed) {
          return null;
        }
        scene = new Scene(container, {
          reducedMotion: mediaQuery.matches,
          onStatusChange: (status) => {
            if (!disposed) {
              setSceneStatus(status);
            }
          },
        });
        sceneRef.current = scene;
        const result = await scene.init();
        if (disposed) {
          scene.dispose();
          return null;
        }
        setBackend(result.backend);
        setSceneStatus("quiet");
        setRuntimeStatus("ready");
        return result;
      })
      .catch((error: unknown) => {
        if (disposed) {
          return;
        }
        setRuntimeError(error instanceof Error ? error.message : "3Dシーンを開始できませんでした。");
        setRuntimeStatus("error");
      });

    return () => {
      disposed = true;
      window.clearTimeout(hintTimer);
      mediaQuery.removeEventListener("change", handleMotionPreference);
      window.removeEventListener("keydown", handleKeyDown);
      container.removeEventListener("pointerdown", hideHint);
      scene?.dispose();
      sceneRef.current = null;
    };
  }, []);

  const shake = (): void => {
    setHintVisible(false);
    sceneRef.current?.shake();
    setSceneStatus("swirling");
  };

  const isReady = runtimeStatus === "ready";
  const statusMessage = isReady ? STATUS_LABELS[sceneStatus] : STATUS_LABELS.loading;

  return (
    <section className={styles.experience} aria-labelledby="snow-globe-title">
      <div
        ref={canvasHostRef}
        className={styles.canvasHost}
        aria-describedby="snow-globe-description snow-globe-hint"
      >
        {runtimeStatus === "loading" && (
          <div className={styles.canvasOverlay} role="status">
            <span className={styles.loaderMark} aria-hidden="true" />
            <span>冬の小さな世界を準備しています…</span>
          </div>
        )}
        {runtimeStatus === "error" && (
          <div className={styles.canvasError} role="alert">
            <strong>スノードームを表示できませんでした。</strong>
            <span>WebGPUとWebGL2の表示環境を確認して、再読み込みしてください。</span>
            <span className={styles.errorDetail}>{runtimeError}</span>
          </div>
        )}
        {hintVisible && (
          <p id="snow-globe-hint" className={styles.canvasHint}>
            ゆっくりドラッグで眺める · 速く振るか SHAKE · Spaceでも振れます
          </p>
        )}
      </div>

      <div className={styles.uiLayer}>
        <header className={styles.headerBlock}>
          <p className={styles.headerMeta}>10 / 15 · INTERACTIVE OBJECT</p>
          <h1 id="snow-globe-title">
            <span>SNOW GLOBE</span>
            <span>WINTER IN SUSPENSION</span>
          </h1>
          <p id="snow-globe-description" className={styles.lead}>
            小さな冬を、液体ごと揺らす。雪は屋根と枝に積もり、次のひと振りでまた舞い上がります。
          </p>
        </header>

        <div className={styles.runtimeBadge} aria-label={`描画方式: ${backend === "webgpu" ? "WebGPU" : backend === "webgl2" ? "WebGL2 fallback" : "準備中"}`}>
          <span className={styles.runtimeDot} aria-hidden="true" />
          <span>{backend === "webgpu" ? "WEBGPU" : backend === "webgl2" ? "WEBGL2 FALLBACK" : "PREPARING"}</span>
        </div>

        <p className={styles.srOnly} aria-live="polite">{statusMessage}</p>

        <div className={styles.bottomDock}>
          <div className={styles.statusPanel} aria-hidden="true">
            <span className={styles.statusKicker}>THE WORLD IS {sceneStatus === "swirling" ? "STIRRED" : "QUIET"}</span>
            <span>{statusMessage}</span>
          </div>

          <div className={styles.actionDock}>
            <button
              type="button"
              className={styles.shakeButton}
              onClick={shake}
              disabled={!isReady}
              aria-label="スノードームを振る"
            >
              <span>SHAKE</span>
              <span className={styles.shakeGlyph} aria-hidden="true">↗</span>
            </button>
            <div className={styles.turnControls} aria-label="ドームを少し回す">
              <button type="button" onClick={() => sceneRef.current?.nudgeTurn("left")} disabled={!isReady} aria-label="ドームを左へ回す">←</button>
              <button type="button" onClick={() => sceneRef.current?.nudgeTurn("right")} disabled={!isReady} aria-label="ドームを右へ回す">→</button>
            </div>
          </div>
        </div>

        <div className={styles.footerLine}>
          <span>{reducedMotion ? "MOTION RESTRAINED" : "LIQUID / SNOW / MICA"}</span>
          <Link href="/" prefetch={false}>INDEX ↗</Link>
        </div>
      </div>
    </section>
  );
}
