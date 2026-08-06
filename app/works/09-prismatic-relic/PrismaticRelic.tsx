"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";

import type { PrismaticRelicScene } from "./PrismaticRelicScene";
import {
  INITIAL_PRESET_ID,
  RELIC_PRESETS,
  type RelicPresetId,
} from "./relicPresets";
import styles from "./page.module.css";

type RuntimeStatus = "loading" | "ready" | "error";

export function PrismaticRelic() {
  const canvasHostRef = useRef<HTMLDivElement>(null);
  const sceneRef = useRef<PrismaticRelicScene | null>(null);
  const [runtimeStatus, setRuntimeStatus] = useState<RuntimeStatus>("loading");
  const [runtimeError, setRuntimeError] = useState("");
  const [webGpuApiAvailable, setWebGpuApiAvailable] = useState<boolean | null>(null);
  const [selectiveBloom, setSelectiveBloom] = useState(false);
  const [presetId, setPresetId] = useState<RelicPresetId>(INITIAL_PRESET_ID);
  const [stillMode, setStillMode] = useState(false);
  const [reducedMotion, setReducedMotion] = useState(false);
  const [hintVisible, setHintVisible] = useState(true);
  const [statusMessage, setStatusMessage] = useState("ポインターを動かして光の屈折を変えられます。");

  useEffect(() => {
    const container = canvasHostRef.current;
    if (!container) {
      return;
    }

    let disposed = false;
    let scene: PrismaticRelicScene | null = null;
    const mediaQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
    setReducedMotion(mediaQuery.matches);
    const handleMotionPreference = (): void => {
      const nextReducedMotion = mediaQuery.matches;
      setReducedMotion(nextReducedMotion);
      sceneRef.current?.setReducedMotion(nextReducedMotion);
      setStatusMessage(nextReducedMotion ? "動きを控えめに設定しています。光の操作は利用できます。" : "通常の微細な動きを再開しました。");
    };
    mediaQuery.addEventListener("change", handleMotionPreference);

    void import("./PrismaticRelicScene")
      .then(async ({ PrismaticRelicScene: Scene }) => {
        if (disposed) {
          return null;
        }
        scene = new Scene(container, { reducedMotion: mediaQuery.matches, presetId: INITIAL_PRESET_ID });
        sceneRef.current = scene;
        const result = await scene.init();
        if (disposed) {
          scene.dispose();
          return null;
        }
        setWebGpuApiAvailable(result.webGpuApiAvailable);
        setSelectiveBloom(result.selectiveBloom);
        setRuntimeStatus("ready");
        return result;
      })
      .catch((error: unknown) => {
        if (disposed) {
          return;
        }
        const message = error instanceof Error ? error.message : "WebGL 2を含む3D描画を初期化できませんでした。";
        setRuntimeError(message);
        setRuntimeStatus("error");
      });

    const hideHint = (): void => setHintVisible(false);
    container.addEventListener("pointermove", hideHint, { once: true, passive: true });
    const hintTimer = window.setTimeout(hideHint, 7200);

    return () => {
      disposed = true;
      window.clearTimeout(hintTimer);
      container.removeEventListener("pointermove", hideHint);
      mediaQuery.removeEventListener("change", handleMotionPreference);
      scene?.dispose();
      sceneRef.current = null;
    };
  }, []);

  const selectPreset = (nextPreset: RelicPresetId): void => {
    if (runtimeStatus !== "ready") {
      return;
    }
    setPresetId(nextPreset);
    sceneRef.current?.setPreset(nextPreset);
    setStatusMessage(`${nextPreset.toUpperCase()}の光へ移行しています。`);
    setHintVisible(false);
  };

  const toggleStillMode = (): void => {
    const nextStillMode = !stillMode;
    setStillMode(nextStillMode);
    sceneRef.current?.setStillMode(nextStillMode);
    setStatusMessage(nextStillMode ? "STILL MODE：ポスター構図を固定しました。" : "STILL MODEを解除し、光の動きを戻しました。");
  };

  const isReady = runtimeStatus === "ready";
  const runtimeLabel = runtimeStatus === "loading"
    ? "INITIALIZING OPTICS"
    : runtimeStatus === "error"
      ? "3D UNAVAILABLE"
      : webGpuApiAvailable && selectiveBloom
        ? "WEBGPU / SELECTIVE BLOOM"
        : webGpuApiAvailable
          ? "WEBGPU / DIRECT RENDER"
          : "WEBGL 2 / FALLBACK";

  return (
    <section className={styles.experience} aria-labelledby="relic-title">
      <div className={styles.canvasHost} ref={canvasHostRef} aria-describedby="relic-description">
        {runtimeStatus === "loading" && (
          <div className={styles.canvasOverlay} role="status">
            <span className={styles.loaderMark} aria-hidden="true" />
            <span>人工鉱物を成形しています…</span>
          </div>
        )}
        {runtimeStatus === "error" && (
          <div className={styles.canvasError} role="alert">
            <strong>3D表示を開始できませんでした。</strong>
            <span>WebGL 2を利用できるブラウザで再読み込みしてください。</span>
            <span className={styles.errorDetail}>{runtimeError}</span>
          </div>
        )}
        {hintVisible && isReady && !stillMode && (
          <p className={styles.canvasHint}>MOVE TO BEND THE LIGHT</p>
        )}
      </div>

      <div className={styles.uiLayer}>
        <header className={styles.headerBlock}>
          <div className={styles.headerMeta}>
            <span>09 / 15</span>
            <span className={styles.metaRule} aria-hidden="true" />
            <span>OPTICAL STUDY</span>
          </div>
          <p className={styles.eyebrow}>PRISMATIC RELIC</p>
          <h1 id="relic-title">A light-bent relic.</h1>
          <p id="relic-description" className={styles.lead}>
            ポインターで光を曲げる、半透明の人工鉱物。
          </p>
        </header>

        <div className={styles.statusCluster} aria-live="polite">
          <span className={`${styles.statusDot} ${runtimeStatus === "error" ? styles.statusDotError : ""}`} aria-hidden="true" />
          <span>{runtimeLabel}</span>
          <span className={styles.statusDivider} aria-hidden="true" />
          <span>{reducedMotion ? "MOTION RESTRAINED" : stillMode ? "FRAME HELD" : "LIVE OPTICS"}</span>
        </div>

        <p className={styles.srOnly} aria-live="polite">{statusMessage}</p>

        <div className={styles.footerControls}>
          <div className={styles.presetDock} aria-label="光のプリセット">
            <span className={styles.dockLabel}>SPECTRUM / 03</span>
            <div className={styles.presetButtons}>
              {RELIC_PRESETS.map((preset) => {
                const selected = preset.id === presetId;
                return (
                  <button
                    type="button"
                    key={preset.id}
                    className={`${styles.presetButton} ${selected ? styles.presetButtonSelected : ""}`}
                    aria-pressed={selected}
                    disabled={!isReady}
                    onClick={() => selectPreset(preset.id)}
                  >
                    <span className={styles.presetIndex}>{selected ? "●" : "0"}{RELIC_PRESETS.indexOf(preset) + 1}</span>
                    <span>{preset.label}</span>
                    <span className={styles.selectedWord}>{selected ? "SELECTED" : ""}</span>
                  </button>
                );
              })}
            </div>
          </div>

          <button
            type="button"
            className={`${styles.stillButton} ${stillMode ? styles.stillButtonSelected : ""}`}
            aria-pressed={stillMode}
            disabled={!isReady}
            onClick={toggleStillMode}
          >
            <span className={styles.stillIcon} aria-hidden="true" />
            <span>STILL MODE</span>
            <span className={styles.stillState}>{stillMode ? "ON" : "OFF"}</span>
          </button>
        </div>

        <Link className={styles.indexLink} href="/" aria-label="作品一覧へ戻る">INDEX ↗</Link>
      </div>
    </section>
  );
}
