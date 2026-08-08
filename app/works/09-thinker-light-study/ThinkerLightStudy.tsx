"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";

import type { ThinkerLightScene } from "./ThinkerLightScene";
import {
  INITIAL_PRESET_ID,
  LIGHTING_PRESETS,
  type LightingPresetId,
} from "./lightingPresets";
import type { LightPositionDirection } from "./lightingMath";
import styles from "./page.module.css";

type RuntimeStatus = "loading" | "ready" | "error";

const MODEL_SOURCE = "https://commons.wikimedia.org/wiki/File:Scan_the_World_-_The_Thinker_(Auguste_Rodin).stl";
const LICENSE_SOURCE = "https://creativecommons.org/licenses/by-sa/4.0/";
const ATTRIBUTION_PATH = "/works/09-thinker-light-study/attribution";

const LIGHT_POSITION_CONTROLS: readonly {
  readonly direction: LightPositionDirection;
  readonly label: string;
  readonly glyph: string;
}[] = [
  { direction: "up", label: "主光源を上へ移動", glyph: "↑" },
  { direction: "left", label: "主光源を左へ移動", glyph: "←" },
  { direction: "center", label: "主光源を中央へ戻す", glyph: "●" },
  { direction: "right", label: "主光源を右へ移動", glyph: "→" },
  { direction: "down", label: "主光源を下へ移動", glyph: "↓" },
];

export function ThinkerLightStudy() {
  const canvasHostRef = useRef<HTMLDivElement>(null);
  const sceneRef = useRef<ThinkerLightScene | null>(null);
  const [runtimeStatus, setRuntimeStatus] = useState<RuntimeStatus>("loading");
  const [runtimeError, setRuntimeError] = useState("");
  const [progress, setProgress] = useState<number | null>(null);
  const [presetId, setPresetId] = useState<LightingPresetId>(INITIAL_PRESET_ID);
  const [hintVisible, setHintVisible] = useState(true);
  const [interactionHint, setInteractionHint] = useState("MOVE POINTER TO MOVE LIGHT");
  const [statusMessage, setStatusMessage] = useState("彫刻上でポインターを動かすと主光源が移動します。");

  useEffect(() => {
    const container = canvasHostRef.current;
    if (!container) {
      return;
    }

    let disposed = false;
    let scene: ThinkerLightScene | null = null;
    const mediaQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
    setInteractionHint(
      navigator.maxTouchPoints > 0 || "ontouchstart" in window
        ? "TAP THE SCULPTURE TO MOVE LIGHT"
        : "MOVE POINTER TO MOVE LIGHT",
    );
    const handleMotionPreference = (): void => {
      const nextReducedMotion = mediaQuery.matches;
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
    container.addEventListener("pointermove", hideHint, { passive: true });
    container.addEventListener("pointerdown", hideHint, { passive: true });
    const hintTimer = window.setTimeout(hideHint, 7200);

    return () => {
      disposed = true;
      window.clearTimeout(hintTimer);
      container.removeEventListener("pointermove", hideHint);
      container.removeEventListener("pointerdown", hideHint);
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

  const nudgeLightPosition = (direction: LightPositionDirection, label: string): void => {
    if (!isReady) {
      return;
    }
    sceneRef.current?.nudgeLightPosition(direction);
    setStatusMessage(`${label}：主光源を移動しました。`);
    setHintVisible(false);
  };

  const isReady = runtimeStatus === "ready";

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
        {hintVisible && isReady && (
          <p className={styles.canvasHint}>{interactionHint}</p>
        )}
      </div>

      <div className={styles.uiLayer}>
        <header className={styles.headerBlock}>
          <div className={styles.headerMeta}>
            <span>09 / 15</span>
          </div>
          <h1 id="thinker-title">
            <span>THE THINKER</span>
            <span>LIGHT STUDY</span>
          </h1>
          <p id="thinker-description" className={styles.srOnly}>
            同じ彫刻でも、光の角度と色で表情は変わる。
          </p>
        </header>

        <p className={styles.srOnly} aria-live="polite">{statusMessage}</p>

        <div className={styles.credit}>
          <a href={MODEL_SOURCE} target="_blank" rel="noreferrer">The Thinker</a>
          <span> · </span>
          <a href={MODEL_SOURCE} target="_blank" rel="noreferrer">Scan the World</a>
          <span> · </span>
          <a href={LICENSE_SOURCE} target="_blank" rel="noreferrer">CC BY-SA 4.0</a>
          <span> · </span>
          <Link href={ATTRIBUTION_PATH} prefetch={false}>Credits</Link>
        </div>

        <div className={styles.footerControls}>
          <div className={styles.modeDock} aria-label="照明モード">
            <span className={styles.dockLabel}>LIGHTING MODES</span>
            <div className={styles.modeButtons}>
              {LIGHTING_PRESETS.map((preset) => {
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
                    <span>{preset.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          <details className={styles.lightPositionDisclosure}>
            <summary className={styles.lightPositionSummary}>LIGHT POSITION</summary>
            <div className={styles.lightPositionButtons} role="group" aria-label="主光源位置操作">
              {LIGHT_POSITION_CONTROLS.map((control) => (
                <button
                  type="button"
                  key={control.direction}
                  className={styles.lightPositionButton}
                  aria-label={control.label}
                  disabled={!isReady}
                  onClick={() => nudgeLightPosition(control.direction, control.label)}
                >
                  {control.glyph}
                </button>
              ))}
            </div>
          </details>
        </div>

        <Link className={styles.indexLink} href="/" aria-label="作品一覧へ戻る">INDEX ↗</Link>
      </div>
    </section>
  );
}
