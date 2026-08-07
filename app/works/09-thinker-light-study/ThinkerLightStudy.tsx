"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";

import type { ThinkerLightScene } from "./ThinkerLightScene";
import {
  getLightingPreset,
  INITIAL_PRESET_ID,
  LIGHTING_PRESETS,
  type LightingPresetId,
} from "./lightingPresets";
import styles from "./page.module.css";

type RuntimeStatus = "loading" | "ready" | "error";

const MODEL_SOURCE = "https://commons.wikimedia.org/wiki/File:Scan_the_World_-_The_Thinker_(Auguste_Rodin).stl";
const LICENSE_SOURCE = "https://creativecommons.org/licenses/by-sa/4.0/";

export function ThinkerLightStudy() {
  const canvasHostRef = useRef<HTMLDivElement>(null);
  const sceneRef = useRef<ThinkerLightScene | null>(null);
  const [runtimeStatus, setRuntimeStatus] = useState<RuntimeStatus>("loading");
  const [runtimeError, setRuntimeError] = useState("");
  const [progress, setProgress] = useState<number | null>(null);
  const [webGpuApiAvailable, setWebGpuApiAvailable] = useState<boolean | null>(null);
  const [selectiveBloom, setSelectiveBloom] = useState(false);
  const [presetId, setPresetId] = useState<LightingPresetId>(INITIAL_PRESET_ID);
  const [holdLight, setHoldLight] = useState(false);
  const [reducedMotion, setReducedMotion] = useState(false);
  const [hintVisible, setHintVisible] = useState(true);
  const [lightStrength, setLightStrength] = useState(1.12);
  const [statusMessage, setStatusMessage] = useState("ポインターを動かして主光源を導けます。距離に応じて強さが変わります。");

  useEffect(() => {
    const container = canvasHostRef.current;
    if (!container) {
      return;
    }

    let disposed = false;
    let scene: ThinkerLightScene | null = null;
    const mediaQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
    setReducedMotion(mediaQuery.matches);
    const handleMotionPreference = (): void => {
      const nextReducedMotion = mediaQuery.matches;
      setReducedMotion(nextReducedMotion);
      sceneRef.current?.setReducedMotion(nextReducedMotion);
      setStatusMessage(nextReducedMotion ? "動きを控えめに設定しています。照明操作は利用できます。" : "通常の照明遷移へ戻しました。");
    };
    mediaQuery.addEventListener("change", handleMotionPreference);

    void import("./ThinkerLightScene")
      .then(async ({ ThinkerLightScene: Scene }) => {
        if (disposed) {
          return null;
        }
        scene = new Scene(container, {
          reducedMotion: mediaQuery.matches,
          presetId: INITIAL_PRESET_ID,
          onLightChange: (strength) => {
            if (!disposed) {
              setLightStrength(strength);
            }
          },
        });
        sceneRef.current = scene;
        const result = await scene.init((nextProgress) => {
          if (!disposed) {
            setProgress(nextProgress);
          }
        });
        if (disposed) {
          scene.dispose();
          return null;
        }
        setWebGpuApiAvailable(result.webGpuApiAvailable);
        setSelectiveBloom(result.selectiveBloom);
        if (!result.modelLoaded) {
          setRuntimeError(result.errorMessage ?? "最適化済みのローカルモデルを読み込めませんでした。");
          setRuntimeStatus("error");
          return result;
        }
        setProgress(1);
        setRuntimeStatus("ready");
        return result;
      })
      .catch((error: unknown) => {
        if (disposed) {
          return;
        }
        setRuntimeError(error instanceof Error ? error.message : "3D表示を開始できませんでした。");
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

  const selectPreset = (nextPreset: LightingPresetId): void => {
    if (runtimeStatus !== "ready") {
      return;
    }
    setPresetId(nextPreset);
    sceneRef.current?.setPreset(nextPreset);
    setStatusMessage(`${nextPreset.toUpperCase()}へ照明を切り替えています。`);
    setHintVisible(false);
  };

  const toggleHoldLight = (): void => {
    const nextHoldLight = !holdLight;
    setHoldLight(nextHoldLight);
    sceneRef.current?.setHoldLight(nextHoldLight);
    setStatusMessage(nextHoldLight ? "HOLD LIGHT：基準位置へ戻し、照明を固定しました。" : "HOLD LIGHTを解除し、主光源の操作を再開しました。");
  };

  const rotateView = (deltaYaw: number, label: string): void => {
    sceneRef.current?.rotateView(deltaYaw);
    setStatusMessage(`${label}：ドラッグでも造形物を回転できます。`);
    setHintVisible(false);
  };

  const zoomView = (deltaScale: number, label: string): void => {
    sceneRef.current?.zoomView(deltaScale);
    setStatusMessage(`${label}：ホイールでも拡大縮小できます。`);
    setHintVisible(false);
  };

  const resetView = (): void => {
    sceneRef.current?.resetView();
    setStatusMessage("VIEW RESET：正面の展示構図へ戻しました。");
    setHintVisible(false);
  };

  const selectedPreset = getLightingPreset(presetId);
  const isReady = runtimeStatus === "ready";
  const runtimeLabel = runtimeStatus === "loading"
    ? "LOADING LOCAL MODEL"
    : runtimeStatus === "error"
      ? "MODEL UNAVAILABLE"
      : webGpuApiAvailable && selectiveBloom
        ? "WEBGPU / SELECTIVE BLOOM"
        : webGpuApiAvailable
          ? "WEBGPU / DIRECT RENDER"
          : "WEBGL 2 / FALLBACK";

  return (
    <section className={styles.experience} aria-labelledby="thinker-title">
      <div className={styles.canvasHost} ref={canvasHostRef} aria-describedby="thinker-description">
        {runtimeStatus === "loading" && (
          <div className={styles.canvasOverlay} role="status">
            <span className={styles.loaderMark} aria-hidden="true" />
            <span>{progress !== null ? `彫刻を読み込んでいます ${Math.round(progress * 100)}%` : "彫刻を準備しています…"}</span>
          </div>
        )}
        {runtimeStatus === "error" && (
          <div className={styles.canvasError} role="alert">
            <strong>3Dモデルを表示できませんでした。</strong>
            <span>ローカルの最適化assetを確認して再読み込みしてください。</span>
            <span className={styles.errorDetail}>{runtimeError}</span>
          </div>
        )}
        {hintVisible && isReady && !holdLight && (
          <p className={styles.canvasHint}>MOVE TO DIRECT · LIGHT RESPONSE FOLLOWS DISTANCE</p>
        )}
      </div>

      <div className={styles.uiLayer}>
        <header className={styles.headerBlock}>
          <div className={styles.headerMeta}>
            <span>09 / 15</span>
            <span className={styles.metaRule} aria-hidden="true" />
            <span>LIGHTING STUDY</span>
          </div>
          <p className={styles.eyebrow}>THE THINKER</p>
          <h1 id="thinker-title">
            <span>LIGHT</span>
            <span>STUDY</span>
          </h1>
          <p id="thinker-description" className={styles.lead}>
            同じ彫刻でも、光の角度と色で表情は変わる。
          </p>
          <p className={styles.subtitle}>
            A lighting study using a digital reproduction of Auguste Rodin’s The Thinker.
          </p>
        </header>

        <div className={styles.statusCluster} aria-live="polite">
          <span className={`${styles.statusDot} ${runtimeStatus === "error" ? styles.statusDotError : ""}`} aria-hidden="true" />
          <span>{runtimeLabel}</span>
          <span className={styles.statusDivider} aria-hidden="true" />
          <span>{reducedMotion ? "MOTION RESTRAINED" : holdLight ? "LIGHT HELD" : "LIVE LIGHT"}</span>
        </div>

        {isReady && (
          <div className={styles.lightReadout} aria-hidden="true">
            <span>KEY LIGHT</span>
            <strong>× {lightStrength.toFixed(2)}</strong>
            <span>{holdLight ? "HELD" : "DISTANCE RESPONSE"}</span>
          </div>
        )}

        <p className={styles.srOnly} aria-live="polite">{statusMessage}</p>

        <div className={styles.credit}>
          <span>MODEL: “The Thinker” / Auguste Rodin · 3D scan by Scan the World · </span>
          <a href={MODEL_SOURCE} target="_blank" rel="noreferrer">SOURCE</a>
          <span> · </span>
          <a href={LICENSE_SOURCE} target="_blank" rel="noreferrer">CC BY-SA 4.0</a>
          <span className={styles.creditNote}>Digital reproduction / lighting study · not official</span>
        </div>

        <div className={styles.footerControls}>
          <div className={styles.modeDock} aria-label="照明モード">
            <span className={styles.dockLabel}>LIGHT / 03</span>
            <div className={styles.modeButtons}>
              {LIGHTING_PRESETS.map((preset, index) => {
                const selected = preset.id === presetId;
                return (
                  <button
                    type="button"
                    key={preset.id}
                    className={`${styles.modeButton} ${selected ? styles.modeButtonSelected : ""}`}
                    aria-pressed={selected}
                    disabled={!isReady}
                    onClick={() => selectPreset(preset.id)}
                  >
                    <span className={styles.modeIndex}>{selected ? "●" : "0"}{index + 1}</span>
                    <span>{preset.label}</span>
                    <span className={styles.selectedWord}>{selected ? "SELECTED" : ""}</span>
                  </button>
                );
              })}
            </div>
            <p className={styles.modePurpose}>{selectedPreset.purpose}</p>
          </div>

          <div className={styles.viewDock} aria-label="造形物の表示操作">
            <span className={styles.dockLabel}>VIEW</span>
            <div className={styles.viewButtons}>
              <button
                type="button"
                className={styles.viewButton}
                aria-label="造形物を縮小"
                disabled={!isReady}
                onClick={() => zoomView(-0.06, "ZOOM OUT")}
              >
                −
              </button>
              <button
                type="button"
                className={styles.viewButton}
                aria-label="造形物を左へ回転"
                disabled={!isReady}
                onClick={() => rotateView(-0.28, "ROTATE LEFT")}
              >
                ↶
              </button>
              <button
                type="button"
                className={`${styles.viewButton} ${styles.viewButtonReset}`}
                aria-label="造形物の表示をリセット"
                disabled={!isReady}
                onClick={resetView}
              >
                RESET
              </button>
              <button
                type="button"
                className={styles.viewButton}
                aria-label="造形物を右へ回転"
                disabled={!isReady}
                onClick={() => rotateView(0.28, "ROTATE RIGHT")}
              >
                ↷
              </button>
              <button
                type="button"
                className={styles.viewButton}
                aria-label="造形物を拡大"
                disabled={!isReady}
                onClick={() => zoomView(0.06, "ZOOM IN")}
              >
                ＋
              </button>
            </div>
          </div>

          <button
            type="button"
            className={`${styles.holdButton} ${holdLight ? styles.holdButtonSelected : ""}`}
            aria-pressed={holdLight}
            disabled={!isReady}
            onClick={toggleHoldLight}
          >
            <span className={styles.holdIcon} aria-hidden="true" />
            <span>HOLD LIGHT</span>
            <span className={styles.holdState}>{holdLight ? "ON" : "OFF"}</span>
          </button>
        </div>

        <Link className={styles.indexLink} href="/" aria-label="作品一覧へ戻る">INDEX ↗</Link>
      </div>
    </section>
  );
}
