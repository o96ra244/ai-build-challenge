"use client";

import { useEffect, useRef, useState } from "react";

import {
  CABIN_MODULES,
  FRONT_MODULES,
  INITIAL_SELECTION,
  REAR_MODULES,
  getSelectionLabel,
  updateSelection,
  type ExperienceMode,
  type ModuleCategory,
  type RoverModuleDefinition,
  type RoverSelection,
} from "./roverModel";
import type { CourseStatus, LowPolyRoverScene } from "./LowPolyRoverScene";
import styles from "./page.module.css";

type RuntimeStatus = "loading" | "ready" | "error";

type ModuleOption = RoverModuleDefinition;

const MODULE_GROUPS: readonly {
  readonly category: ModuleCategory;
  readonly legend: string;
  readonly modules: readonly ModuleOption[];
}[] = [
  { category: "front", legend: "Front / フロント", modules: FRONT_MODULES },
  { category: "cabin", legend: "Cabin / キャビン", modules: CABIN_MODULES },
  { category: "rear", legend: "Rear / リア", modules: REAR_MODULES },
];

const COURSE_STATUS_LABEL: Record<CourseStatus, string> = {
  ready: "COURSE READY",
  running: "RUNNING",
  clear: "COURSE CLEAR",
};

export function LowPolyRoverGarage() {
  const canvasHostRef = useRef<HTMLDivElement>(null);
  const sceneRef = useRef<LowPolyRoverScene | null>(null);
  const initialSelectionRef = useRef<RoverSelection>(INITIAL_SELECTION);
  const [runtimeStatus, setRuntimeStatus] = useState<RuntimeStatus>("loading");
  const [runtimeError, setRuntimeError] = useState("");
  const [webGpuApiAvailable, setWebGpuApiAvailable] = useState<boolean | null>(null);
  const [selection, setSelection] = useState<RoverSelection>(INITIAL_SELECTION);
  const [mode, setMode] = useState<ExperienceMode>("garage");
  const [autoRotate, setAutoRotate] = useState(false);
  const [reducedMotion, setReducedMotion] = useState(false);
  const [courseStatus, setCourseStatus] = useState<CourseStatus>("ready");
  const [statusMessage, setStatusMessage] = useState("3Dを準備しています。初期構成はツインランプ / バブルキャノピー / カーゴラックです。");

  useEffect(() => {
    const container = canvasHostRef.current;
    if (!container) {
      return;
    }

    let disposed = false;
    let scene: LowPolyRoverScene | null = null;
    const mediaQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
    const reduced = mediaQuery.matches;
    setReducedMotion(reduced);
    setAutoRotate(!reduced);

    const handleMotionPreference = (): void => {
      const nextReducedMotion = mediaQuery.matches;
      setReducedMotion(nextReducedMotion);
      sceneRef.current?.setReducedMotion(nextReducedMotion);
      setStatusMessage(
        nextReducedMotion
          ? "動きを控えめにしました。自動回転とコースの砂ぼこりを停止します。"
          : "通常の動きへ戻しました。自動回転は明示的に再開できます。",
      );
    };
    mediaQuery.addEventListener("change", handleMotionPreference);

    void import("./LowPolyRoverScene")
      .then(async ({ LowPolyRoverScene: Scene }) => {
        if (disposed) {
          return null;
        }

        scene = new Scene(container, {
          reducedMotion: mediaQuery.matches,
          selection: initialSelectionRef.current,
          onAutoRotateChange: (nextAutoRotate) => {
            setAutoRotate(nextAutoRotate);
          },
          onCourseStatusChange: (nextStatus) => {
            setCourseStatus(nextStatus);
            if (nextStatus === "running") {
              setStatusMessage("テストコースを1周しています。車輪と機体が走行します。");
            } else if (nextStatus === "clear") {
              setStatusMessage("1周完了。もう一度走るか、Garageへ戻れます。");
            }
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
        setStatusMessage("準備完了。Garageで部品を選ぶか、TEST COURSEへ切り替えられます。");
        return result;
      })
      .catch((error: unknown) => {
        if (disposed) {
          return;
        }

        const message = error instanceof Error ? error.message : "3Dシーンを初期化できませんでした。";
        setRuntimeError(message);
        setRuntimeStatus("error");
        setStatusMessage("3D表示を開始できませんでした。下のエラー内容を確認してください。");
      });

    return () => {
      disposed = true;
      mediaQuery.removeEventListener("change", handleMotionPreference);
      scene?.dispose();
      sceneRef.current = null;
    };
  }, []);

  useEffect(() => {
    sceneRef.current?.setSelection(selection);
  }, [selection]);

  const isReady = runtimeStatus === "ready";
  const courseRunning = mode === "course" && courseStatus === "running";
  const radioDisabled = !isReady || mode === "course" || courseRunning;
  const selectionLabel = getSelectionLabel(selection);

  const handleModeChange = (nextMode: ExperienceMode): void => {
    if (!isReady || courseRunning || nextMode === mode) {
      return;
    }

    sceneRef.current?.setMode(nextMode);
    setMode(nextMode);
    setCourseStatus("ready");
    setStatusMessage(
      nextMode === "course"
        ? "TEST COURSEを準備しました。固定カメラで1周の走行を開始できます。"
        : "Garageへ戻りました。自動回転は明示的に再開できます。",
    );
  };

  const handleSelectionChange = (category: ModuleCategory, id: string): void => {
    if (radioDisabled) {
      return;
    }

    const nextSelection = updateSelection(selection, category, id);
    if (nextSelection[category] === selection[category]) {
      return;
    }

    setSelection(nextSelection);
    const changedModule = MODULE_GROUPS.find((group) => group.category === category)?.modules.find(
      (module) => module.id === id,
    );
    setStatusMessage(`${category === "front" ? "Front" : category === "cabin" ? "Cabin" : "Rear"}を${changedModule?.label ?? "選択した部品"}へ交換しました。`);
  };

  const toggleAutoRotate = (): void => {
    const nextAutoRotate = !autoRotate;
    sceneRef.current?.setAutoRotate(nextAutoRotate);
    setStatusMessage(nextAutoRotate ? "Garageの自動回転を始めました。" : "Garageの自動回転を止めました。");
  };

  const resetScene = (): void => {
    sceneRef.current?.reset();
    setStatusMessage("Garageの視点を初期位置へ戻しました。現在の構成は維持しています。");
  };

  const zoom = (direction: "in" | "out"): void => {
    sceneRef.current?.zoomBy(direction);
    setStatusMessage(direction === "in" ? "ローバーへ近づきました。" : "ローバーから離れました。");
  };

  const startCourse = (): void => {
    if (!sceneRef.current || !isReady || mode !== "course" || courseRunning) {
      return;
    }

    sceneRef.current.startCourse();
  };

  return (
    <section className={styles.experience} aria-labelledby="garage-title">
      <div className={styles.experienceHeader}>
        <div>
          <p className={styles.kicker}>INTERACTIVE 3D GARAGE / COURSE</p>
          <h2 id="garage-title">組み替えて、コースへ出す</h2>
          <p className={styles.experienceLead}>
            Front・Cabin・Rearを1つずつ選び、12種類の部品から64通りのローバーを組み立てます。
          </p>
        </div>
        <p className={`${styles.runtimeBadge} ${runtimeStatus === "error" ? styles.runtimeBadgeError : ""}`}>
          <span className={styles.runtimeDot} aria-hidden="true" />
          {runtimeStatus === "loading" ? "3Dを準備中" : runtimeStatus === "error" ? "初期化エラー" : "3Dシーン準備完了"}
        </p>
      </div>

      <div className={styles.modeToggle} role="group" aria-label="体験モード">
        <p className={styles.controlLabel}>EXPERIENCE MODE</p>
        <div className={styles.modeButtons}>
          <button
            type="button"
            className={mode === "garage" ? styles.modeButtonActive : styles.modeButton}
            onClick={() => handleModeChange("garage")}
            disabled={!isReady || courseRunning}
            aria-pressed={mode === "garage"}
          >
            GARAGE
          </button>
          <button
            type="button"
            className={mode === "course" ? styles.modeButtonActive : styles.modeButton}
            onClick={() => handleModeChange("course")}
            disabled={!isReady || courseRunning}
            aria-pressed={mode === "course"}
          >
            TEST COURSE
          </button>
        </div>
      </div>

      <div className={styles.workspace}>
        <div className={styles.stageColumn}>
          <div className={styles.stageShell}>
            <div
              ref={canvasHostRef}
              className={styles.canvasHost}
              aria-label="低ポリローバーを操作する3Dステージ"
              aria-describedby="canvas-help"
            >
              {runtimeStatus === "loading" && <p className={styles.canvasOverlay}>ローバーを組み立てています…</p>}
              {runtimeStatus === "error" && (
                <p className={styles.canvasError} role="alert">
                  3D表示を開始できませんでした。{runtimeError}
                </p>
              )}
              <p id="canvas-help" className={styles.canvasHint}>
                {mode === "garage" ? "ドラッグでOrbit / ホイール・ピンチでZoom / パンなし" : "固定カメラの低ポリコース / 1周・自由運転なし"}
              </p>
            </div>

            <div className={styles.controlPanel}>
              <div className={styles.controlHeader}>
                <p className={styles.controlLabel}>{mode === "garage" ? "GARAGE CONTROLS" : "TEST COURSE CONTROLS"}</p>
                <p className={styles.statusMessage} aria-live="polite">{statusMessage}</p>
              </div>
              {mode === "garage" ? (
                <div className={styles.controlRows}>
                  <div className={styles.primaryControls}>
                    <button type="button" onClick={resetScene} disabled={!isReady}>視点をリセット</button>
                    <button type="button" onClick={toggleAutoRotate} disabled={!isReady} aria-pressed={autoRotate}>
                      {autoRotate ? "自動回転 ON" : "自動回転 OFF"}
                    </button>
                  </div>
                  <div className={styles.zoomControls} aria-label="ズーム操作">
                    <span>ズーム</span>
                    <button type="button" onClick={() => zoom("out")} disabled={!isReady} aria-label="ローバーから離れる">−</button>
                    <button type="button" onClick={() => zoom("in")} disabled={!isReady} aria-label="ローバーへ近づく">＋</button>
                  </div>
                </div>
              ) : (
                <div className={styles.courseControls}>
                  <button type="button" className={styles.primaryButton} onClick={startCourse} disabled={!isReady || courseRunning}>
                    {courseRunning ? "走行中…" : courseStatus === "clear" ? "もう一度走る" : "コースを走る"}
                  </button>
                  <p className={styles.courseState} aria-live="polite">
                    <strong>{COURSE_STATUS_LABEL[courseStatus]}</strong>
                    <span>{courseRunning ? "部品とモードは走行終了まで固定" : "固定カメラ / 1周コース"}</span>
                  </p>
                </div>
              )}
              <div className={styles.statusDetails}>
                <span>{mode === "garage" ? "GARAGE" : COURSE_STATUS_LABEL[courseStatus]}</span>
                <span>{mode === "garage" ? (autoRotate ? "自動回転 ON" : "自動回転 OFF") : "固定カメラ"}</span>
                <span>{reducedMotion ? "動きを控えめに設定中" : "通常の動き"}</span>
                <span>{webGpuApiAvailable === null ? "GPU APIを確認中" : webGpuApiAvailable ? "WebGPU API利用可能" : "互換描画を使用"}</span>
              </div>
            </div>
          </div>
        </div>

        {mode === "garage" && (
          <section className={styles.configurationPanel} aria-label="ローバー構成パネル">
            <div className={styles.configurationHeader}>
              <div>
                <p className={styles.controlLabel}>MODULE DOCK</p>
                <h3>3カテゴリから1つずつ選ぶ</h3>
              </div>
              <p className={styles.combinationCount}>64 <span>通り</span></p>
            </div>
            <p className={styles.selectionSummary}>
              <span>現在の構成</span>
              <strong>{selectionLabel}</strong>
            </p>

            <div className={styles.moduleGroups}>
              {MODULE_GROUPS.map((group) => (
                <fieldset className={styles.moduleGroup} key={group.category} disabled={radioDisabled}>
                  <legend>{group.legend}</legend>
                  <div className={styles.moduleOptions}>
                    {group.modules.map((module) => {
                      const selected = selection[group.category] === module.id;
                      return (
                        <label className={`${styles.moduleOption} ${selected ? styles.moduleOptionSelected : ""}`} key={module.id}>
                          <input
                            className={styles.radioInput}
                            type="radio"
                            name={`rover-${group.category}`}
                            value={module.id}
                            checked={selected}
                            onChange={() => handleSelectionChange(group.category, module.id)}
                          />
                          <span className={styles.radioMark} aria-hidden="true">{selected ? "✓" : ""}</span>
                          <span className={styles.moduleCopy}>
                            <strong>{module.label}</strong>
                          </span>
                        </label>
                      );
                    })}
                  </div>
                </fieldset>
              ))}
            </div>

            <p className={styles.configurationNote} aria-live="polite">
              部品を選ぶと対象カテゴリだけが短く入れ替わります。Courseへ切り替えると現在の構成で走行します。
            </p>
          </section>
        )}
      </div>
    </section>
  );
}
