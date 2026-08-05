"use client";

import { useEffect, useRef, useState } from "react";

import {
  CABIN_MODULES,
  FRONT_MODULES,
  INITIAL_SELECTION,
  REAR_MODULES,
  getSelectionLabel,
  updateSelection,
  type ModuleCategory,
  type RoverModuleDefinition,
  type RoverSelection,
} from "./roverModel";
import type { LowPolyRoverScene } from "./LowPolyRoverScene";
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

export function LowPolyRoverGarage() {
  const canvasHostRef = useRef<HTMLDivElement>(null);
  const sceneRef = useRef<LowPolyRoverScene | null>(null);
  const initialSelectionRef = useRef<RoverSelection>(INITIAL_SELECTION);
  const [runtimeStatus, setRuntimeStatus] = useState<RuntimeStatus>("loading");
  const [runtimeError, setRuntimeError] = useState("");
  const [webGpuApiAvailable, setWebGpuApiAvailable] = useState<boolean | null>(null);
  const [selection, setSelection] = useState<RoverSelection>(INITIAL_SELECTION);
  const [autoRotate, setAutoRotate] = useState(false);
  const [reducedMotion, setReducedMotion] = useState(false);
  const [trialRunning, setTrialRunning] = useState(false);
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
          ? "動きを控えめにしました。自動回転は停止しています。"
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
          onTrialChange: (running) => {
            setTrialRunning(running);
            setStatusMessage(running ? "試運転中です。ローバーと車輪が動いています。" : "試運転が終了し、ローバーが整備位置へ戻りました。");
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
        setStatusMessage("準備完了。部品を選び、ドラッグで眺めて試運転できます。");
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

  const handleSelectionChange = (category: ModuleCategory, id: string): void => {
    if (trialRunning) {
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
    setStatusMessage(nextAutoRotate ? "自動回転を始めました。" : "自動回転を止めました。");
  };

  const resetScene = (): void => {
    sceneRef.current?.reset();
    setStatusMessage("視点を初期位置へ戻しました。現在の構成は維持しています。");
  };

  const zoom = (direction: "in" | "out"): void => {
    sceneRef.current?.zoomBy(direction);
    setStatusMessage(direction === "in" ? "ローバーへ近づきました。" : "ローバーから離れました。");
  };

  const startTrial = (): void => {
    if (!sceneRef.current || runtimeStatus !== "ready" || trialRunning) {
      return;
    }

    setTrialRunning(true);
    setStatusMessage("試運転を開始しました。短い経路を走行しています。");
    sceneRef.current.startTrial();
  };

  const isReady = runtimeStatus === "ready";
  const selectionLabel = getSelectionLabel(selection);
  const radioDisabled = !isReady || trialRunning;

  return (
    <section className={styles.experience} aria-labelledby="garage-title">
      <div className={styles.experienceHeader}>
        <div>
          <p className={styles.kicker}>INTERACTIVE 3D GARAGE</p>
          <h2 id="garage-title">組み替えて、試運転する</h2>
          <p className={styles.experienceLead}>
            Front・Cabin・Rearを1つずつ選び、9種類の部品から27通りのローバーを組み立てます。
          </p>
        </div>
        <p className={`${styles.runtimeBadge} ${runtimeStatus === "error" ? styles.runtimeBadgeError : ""}`}>
          <span className={styles.runtimeDot} aria-hidden="true" />
          {runtimeStatus === "loading" ? "3Dを準備中" : runtimeStatus === "error" ? "初期化エラー" : "3Dシーン準備完了"}
        </p>
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
                ドラッグでOrbit / ホイール・ピンチでZoom / パンなし
              </p>
            </div>

            <div className={styles.controlPanel}>
              <div className={styles.controlHeader}>
                <p className={styles.controlLabel}>ROVER CONTROLS</p>
                <p className={styles.statusMessage} aria-live="polite">{statusMessage}</p>
              </div>
              <div className={styles.controlRows}>
                <div className={styles.primaryControls}>
                  <button type="button" className={styles.primaryButton} onClick={startTrial} disabled={!isReady || trialRunning}>
                    {trialRunning ? "試運転中…" : "試運転する"}
                  </button>
                  <button type="button" onClick={resetScene} disabled={!isReady || trialRunning}>視点をリセット</button>
                  <button type="button" onClick={toggleAutoRotate} disabled={!isReady || trialRunning} aria-pressed={autoRotate}>
                    {autoRotate ? "自動回転 ON" : "自動回転 OFF"}
                  </button>
                </div>
                <div className={styles.zoomControls} aria-label="ズーム操作">
                  <span>ズーム</span>
                  <button type="button" onClick={() => zoom("out")} disabled={!isReady || trialRunning} aria-label="ローバーから離れる">−</button>
                  <button type="button" onClick={() => zoom("in")} disabled={!isReady || trialRunning} aria-label="ローバーへ近づく">＋</button>
                </div>
              </div>
              <div className={styles.statusDetails}>
                <span>{trialRunning ? "試運転中" : "整備台で待機"}</span>
                <span>{autoRotate ? "自動回転 ON" : "自動回転 OFF"}</span>
                <span>{reducedMotion ? "動きを控えめに設定中" : "通常の動き"}</span>
                <span>{webGpuApiAvailable === null ? "GPU APIを確認中" : webGpuApiAvailable ? "WebGPU API利用可能" : "互換描画を使用"}</span>
              </div>
            </div>
          </div>
        </div>

        <aside className={styles.configurationPanel} aria-label="ローバー構成パネル">
          <div className={styles.configurationHeader}>
            <div>
              <p className={styles.controlLabel}>MODULE SELECTOR</p>
              <h3>3つの部品を選ぶ</h3>
            </div>
            <p className={styles.combinationCount}>27 <span>通り</span></p>
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
                          <small>{module.description}</small>
                        </span>
                        {selected && <span className={styles.selectedText}>選択中</span>}
                      </label>
                    );
                  })}
                </div>
              </fieldset>
            ))}
          </div>

          <p className={styles.configurationNote} aria-live="polite">
            {trialRunning ? "試運転中は部品を固定しています。終了後に再び組み替えられます。" : "部品を選ぶと対象カテゴリだけが短く入れ替わります。"}
          </p>
        </aside>
      </div>
    </section>
  );
}
