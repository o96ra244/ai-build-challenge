"use client";

import { useCallback, useEffect, useRef, useState, type PointerEvent } from "react";

import {
  CABIN_MODULES,
  FRONT_MODULES,
  getCombinationCount,
  getSelectionLabel,
  INITIAL_SELECTION,
  REAR_MODULES,
  updateSelection,
  type ModuleCategory,
  type RoverModuleDefinition,
  type RoverSelection,
} from "./roverModel";
import {
  EMPTY_PRESSED_KEYS,
  getDriveInputFromPressed,
  getSpeedDisplay,
  mapDriveKey,
  setPressedDriveKey,
  type PressedDriveKeys,
} from "./driveModel";
import type { ExperienceMode, LowPolyRoverScene, RoverHud } from "./LowPolyRoverScene";
import styles from "./page.module.css";

type RuntimeStatus = "loading" | "ready" | "error";
type YardLoadStatus = "idle" | "loading" | "ready" | "error";
type MobileDriveAction = "steer-left" | "steer-right" | "throttle-forward" | "throttle-reverse";

const INITIAL_HUD: RoverHud = {
  speed: 0,
  groundedWheels: 0,
  surface: "START PAD",
  zoneLabel: "START PAD",
  status: "DRIVING",
  airborne: false,
  insideBounds: true,
};

const MODULE_GROUPS: readonly {
  readonly category: ModuleCategory;
  readonly title: string;
  readonly modules: readonly RoverModuleDefinition[];
}[] = [
  { category: "front", title: "FRONT MODULE", modules: FRONT_MODULES },
  { category: "cabin", title: "CABIN MODULE", modules: CABIN_MODULES },
  { category: "rear", title: "REAR MODULE", modules: REAR_MODULES },
];

const MOBILE_ACTION_LABEL: Record<MobileDriveAction, string> = {
  "steer-left": "左へ曲がる",
  "steer-right": "右へ曲がる",
  "throttle-forward": "アクセル・前進",
  "throttle-reverse": "ブレーキ・後退",
};

const MOBILE_ACTION_TEXT: Record<MobileDriveAction, string> = {
  "steer-left": "LEFT",
  "steer-right": "RIGHT",
  "throttle-forward": "ACCEL",
  "throttle-reverse": "BRAKE / REV",
};

function isEditableTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) {
    return false;
  }
  return target.isContentEditable
    || ["INPUT", "TEXTAREA", "SELECT", "BUTTON", "A"].includes(target.tagName)
    || Boolean(target.closest("button, a, input, textarea, select, [contenteditable='true']"));
}

export function LowPolyRoverGarage() {
  const canvasHostRef = useRef<HTMLDivElement>(null);
  const sceneRef = useRef<LowPolyRoverScene | null>(null);
  const modeRef = useRef<ExperienceMode>("garage");
  const pressedKeysRef = useRef<PressedDriveKeys>(EMPTY_PRESSED_KEYS);
  const mobilePointersRef = useRef<Map<number, { readonly action: MobileDriveAction; readonly element: HTMLButtonElement }>>(new Map());
  const [runtimeStatus, setRuntimeStatus] = useState<RuntimeStatus>("loading");
  const [runtimeError, setRuntimeError] = useState("");
  const [webGpuApiAvailable, setWebGpuApiAvailable] = useState<boolean | null>(null);
  const [mode, setMode] = useState<ExperienceMode>("garage");
  const [yardLoadStatus, setYardLoadStatus] = useState<YardLoadStatus>("idle");
  const [selection, setSelection] = useState<RoverSelection>(INITIAL_SELECTION);
  const [hud, setHud] = useState<RoverHud>(INITIAL_HUD);
  const [autoRotate, setAutoRotate] = useState(false);
  const [reducedMotion, setReducedMotion] = useState(false);
  const [paused, setPaused] = useState(false);
  const [announcement, setAnnouncement] = useState("GARAGEを準備しています。");
  const [mobilePressed, setMobilePressed] = useState<Record<MobileDriveAction, boolean>>({
    "steer-left": false,
    "steer-right": false,
    "throttle-forward": false,
    "throttle-reverse": false,
  });

  const syncDriveInput = useCallback((): void => {
    const pointerActions = mobilePointersRef.current;
    const pressed = pressedKeysRef.current;
    sceneRef.current?.setDriveInput(getDriveInputFromPressed({
      throttleForward: pressed.throttleForward || [...pointerActions.values()].some(({ action }) => action === "throttle-forward"),
      throttleReverse: pressed.throttleReverse || [...pointerActions.values()].some(({ action }) => action === "throttle-reverse"),
      steerLeft: pressed.steerLeft || [...pointerActions.values()].some(({ action }) => action === "steer-left"),
      steerRight: pressed.steerRight || [...pointerActions.values()].some(({ action }) => action === "steer-right"),
    }));
  }, []);

  const clearAllInput = useCallback((): void => {
    pressedKeysRef.current = EMPTY_PRESSED_KEYS;
    for (const [pointerId, pointer] of mobilePointersRef.current) {
      if (pointer.element.hasPointerCapture(pointerId)) {
        pointer.element.releasePointerCapture(pointerId);
      }
    }
    mobilePointersRef.current.clear();
    setMobilePressed({
      "steer-left": false,
      "steer-right": false,
      "throttle-forward": false,
      "throttle-reverse": false,
    });
    sceneRef.current?.clearDriveInput();
  }, []);

  useEffect(() => {
    const container = canvasHostRef.current;
    if (!container) {
      return;
    }

    let disposed = false;
    let scene: LowPolyRoverScene | null = null;
    const mediaQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
    setReducedMotion(mediaQuery.matches);
    const handleMotionPreference = (): void => {
      const nextReducedMotion = mediaQuery.matches;
      setReducedMotion(nextReducedMotion);
      sceneRef.current?.setReducedMotion(nextReducedMotion);
      setAnnouncement(nextReducedMotion ? "動きを控えめにしました。自動回転は停止しました。" : "通常の動きへ戻しました。自動回転は再開しません。");
    };
    mediaQuery.addEventListener("change", handleMotionPreference);

    void import("./LowPolyRoverScene")
      .then(async ({ LowPolyRoverScene: Scene }) => {
        if (disposed) {
          return;
        }
        scene = new Scene(container, {
          reducedMotion: mediaQuery.matches,
          selection: INITIAL_SELECTION,
          onHudChange: setHud,
          onAutoRotateChange: setAutoRotate,
        });
        sceneRef.current = scene;
        const result = await scene.init();
        if (disposed) {
          scene.dispose();
          return;
        }
        setWebGpuApiAvailable(result.webGpuApiAvailable);
        setRuntimeStatus("ready");
        setAnnouncement("GARAGE準備完了。12モジュールからローバーを組み替えられます。");
      })
      .catch((error: unknown) => {
        if (disposed) {
          return;
        }
        setRuntimeError(error instanceof Error ? error.message : "3Dシーンを初期化できませんでした。");
        setRuntimeStatus("error");
        setAnnouncement("3D表示を開始できませんでした。");
      });

    return () => {
      disposed = true;
      mediaQuery.removeEventListener("change", handleMotionPreference);
      clearAllInput();
      scene?.dispose();
      sceneRef.current = null;
    };
  }, [clearAllInput]);

  useEffect(() => {
    sceneRef.current?.setSelection(selection);
  }, [selection]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent): void => {
      if (modeRef.current !== "yard" || yardLoadStatus !== "ready" || isEditableTarget(event.target)) {
        return;
      }
      const action = mapDriveKey(event.key);
      if (!action) {
        return;
      }
      if (action === "pause") {
        if (!event.repeat) {
          event.preventDefault();
          clearAllInput();
          const nextPaused = !paused;
          setPaused(nextPaused);
          sceneRef.current?.setPaused(nextPaused);
          setAnnouncement(nextPaused ? "PAUSED。Pで再開できます。" : "DRIVINGを再開しました。");
        }
        return;
      }
      if (action === "reset") {
        if (!event.repeat) {
          event.preventDefault();
          clearAllInput();
          sceneRef.current?.recover();
          setPaused(false);
          setAnnouncement("ローバーをSTART PADへ戻しました。");
        }
        return;
      }
      if (event.key.startsWith("Arrow")) {
        event.preventDefault();
      }
      pressedKeysRef.current = setPressedDriveKey(pressedKeysRef.current, action, true);
      syncDriveInput();
    };

    const handleKeyUp = (event: KeyboardEvent): void => {
      if (modeRef.current !== "yard" || isEditableTarget(event.target)) {
        return;
      }
      const action = mapDriveKey(event.key);
      if (action && action !== "reset" && action !== "pause") {
        pressedKeysRef.current = setPressedDriveKey(pressedKeysRef.current, action, false);
        syncDriveInput();
      }
    };

    const clearOnWindowBlur = (): void => clearAllInput();
    const clearOnVisibilityChange = (): void => {
      if (document.visibilityState !== "visible") {
        clearAllInput();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("keyup", handleKeyUp);
    window.addEventListener("blur", clearOnWindowBlur);
    document.addEventListener("visibilitychange", clearOnVisibilityChange);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("keyup", handleKeyUp);
      window.removeEventListener("blur", clearOnWindowBlur);
      document.removeEventListener("visibilitychange", clearOnVisibilityChange);
    };
  }, [clearAllInput, paused, syncDriveInput, yardLoadStatus]);

  const handleModeChange = (nextMode: ExperienceMode): void => {
    if (runtimeStatus !== "ready" || nextMode === mode || yardLoadStatus === "loading") {
      return;
    }
    clearAllInput();
    modeRef.current = nextMode;
    setMode(nextMode);
    if (nextMode === "yard") {
      setYardLoadStatus("loading");
      setAnnouncement("TEST YARDを準備しています。Rapier物理を読み込み中です。");
      void sceneRef.current?.setMode("yard")
        .then(() => {
          setYardLoadStatus("ready");
          setPaused(false);
          setAnnouncement("TEST YARD準備完了。WASD／矢印キー、または4つの操作ボタンで走行できます。");
        })
        .catch((error: unknown) => {
          modeRef.current = "garage";
          setMode("garage");
          setYardLoadStatus("error");
          setRuntimeError(error instanceof Error ? error.message : "物理ワールドを読み込めませんでした。");
          setAnnouncement("TEST YARDを読み込めませんでした。GARAGEへ戻って再試行してください。");
        });
      return;
    }
    setYardLoadStatus("idle");
    setPaused(false);
    setAnnouncement("GARAGEへ戻りました。選択した構成を確認できます。");
    void sceneRef.current?.setMode("garage");
  };

  const handleSelectionChange = (category: ModuleCategory, id: string): void => {
    const nextSelection = updateSelection(selection, category, id);
    setSelection(nextSelection);
    setAnnouncement(`${getSelectionLabel(nextSelection)}へ組み替えました。`);
  };

  const updateMobilePressed = (action: MobileDriveAction): void => {
    setMobilePressed((previous) => ({
      ...previous,
      [action]: [...mobilePointersRef.current.values()].some(({ action: activeAction }) => activeAction === action),
    }));
  };

  const handlePointerDown = (action: MobileDriveAction) => (event: PointerEvent<HTMLButtonElement>): void => {
    if (mode !== "yard" || yardLoadStatus !== "ready" || paused) {
      return;
    }
    try {
      event.currentTarget.setPointerCapture(event.pointerId);
    } catch {
      // Synthetic pointer events may not implement pointer capture.
    }
    mobilePointersRef.current.set(event.pointerId, { action, element: event.currentTarget });
    updateMobilePressed(action);
    syncDriveInput();
  };

  const handlePointerRelease = (event: PointerEvent<HTMLButtonElement>): void => {
    const active = mobilePointersRef.current.get(event.pointerId);
    mobilePointersRef.current.delete(event.pointerId);
    try {
      if (event.currentTarget.hasPointerCapture(event.pointerId)) {
        event.currentTarget.releasePointerCapture(event.pointerId);
      }
    } catch {
      // The pointer may already have been released by the browser.
    }
    if (active) {
      updateMobilePressed(active.action);
    }
    syncDriveInput();
  };

  const handlePause = (): void => {
    if (!yardReady) {
      return;
    }
    const nextPaused = !paused;
    clearAllInput();
    setPaused(nextPaused);
    sceneRef.current?.setPaused(nextPaused);
    setAnnouncement(nextPaused ? "PAUSED。操作を解除しました。" : "DRIVINGを再開しました。");
  };

  const handleRecover = (): void => {
    if (!yardReady) {
      return;
    }
    clearAllInput();
    sceneRef.current?.recover();
    setPaused(false);
    setAnnouncement("ローバーをSTART PADへ戻しました。速度と入力をリセットしました。");
  };

  const handleReset = (): void => {
    clearAllInput();
    sceneRef.current?.reset();
    setAnnouncement(mode === "yard" ? "ローバーをSTART PADへ戻しました。" : "GARAGEの視点を初期位置へ戻しました。");
  };

  const handleAutoRotate = (): void => {
    const next = !autoRotate;
    sceneRef.current?.setAutoRotate(next);
    setAnnouncement(next ? "GARAGEの自動回転を始めました。" : "GARAGEの自動回転を止めました。");
  };

  const isReady = runtimeStatus === "ready";
  const yardReady = mode === "yard" && yardLoadStatus === "ready";
  const selectionLabel = getSelectionLabel(selection);

  return (
    <section className={styles.experience} aria-labelledby="rover-title">
      <div className={styles.experienceHeader}>
        <div>
          <p className={styles.kicker}>LOW POLY / PHYSICS PLAYGROUND</p>
          <h2 id="rover-title">Build it. Drive it.</h2>
          <p className={styles.experienceLead}>GARAGEで構成を選び、同じローバーを小さなTEST YARDへ持ち込みます。</p>
        </div>
        <p className={`${styles.runtimeBadge} ${runtimeStatus === "error" ? styles.runtimeBadgeError : ""}`}>
          <span className={styles.runtimeDot} aria-hidden="true" />
          {runtimeStatus === "loading" ? "3Dを準備中" : runtimeStatus === "error" ? "初期化エラー" : webGpuApiAvailable ? "WEBGPU READY" : "WEBGPU FALLBACK"}
        </p>
      </div>

      <div className={styles.modeToggle} aria-label="作品モード">
        <p className={styles.controlLabel}>SELECT MODE</p>
        <div className={styles.modeButtons}>
          <button type="button" className={mode === "garage" ? styles.modeButtonActive : styles.modeButton} onClick={() => handleModeChange("garage")} disabled={!isReady || yardLoadStatus === "loading"} aria-pressed={mode === "garage"}>GARAGE</button>
          <button type="button" className={mode === "yard" ? styles.modeButtonActive : styles.modeButton} onClick={() => handleModeChange("yard")} disabled={!isReady || yardLoadStatus === "loading"} aria-pressed={mode === "yard"}>TEST YARD</button>
        </div>
      </div>

      <div className={styles.workspace}>
        <div className={styles.stageColumn}>
          <div className={styles.stageShell}>
            <div
              ref={canvasHostRef}
              className={`${styles.canvasHost} ${mode === "yard" ? styles.yardCanvas : styles.garageCanvas}`}
              aria-label={mode === "yard" ? "坂、起伏、丸太、箱、岩、ジャンプ台を備えたローバーの物理試験場" : "12モジュールからローバーを組み立てる3Dガレージ"}
              aria-describedby="rover-stage-help"
            >
              {runtimeStatus === "loading" && <p className={styles.canvasOverlay}>ローバーを組み立てています…</p>}
              {runtimeStatus === "error" && <p className={styles.canvasError} role="alert">3D表示を開始できませんでした。{runtimeError}</p>}
              {mode === "yard" && yardLoadStatus === "loading" && <p className={styles.canvasOverlay}>TEST YARDの物理を準備しています…</p>}
              {mode === "yard" && (
                <div className={styles.hud} aria-label="走行ステータス">
                  <div className={styles.hudHeader}><span>TEST YARD</span><strong>{hud.status}</strong></div>
                  <div className={styles.hudGrid}>
                    <span>SPEED<strong>{getSpeedDisplay(hud.speed)} u/s</strong></span>
                    <span>WHEELS<strong>{hud.groundedWheels} / 4</strong></span>
                    <span>SURFACE<strong>{hud.surface}</strong></span>
                  </div>
                  <p className={styles.hudZone}>{hud.zoneLabel}{hud.airborne ? " / AIRBORNE" : ""}</p>
                </div>
              )}
              <p id="rover-stage-help" className={styles.canvasHint}>{mode === "yard" ? "WASD／矢印キーで走行。Pで一時停止、RでSTART PADへ復帰。" : "ドラッグでOrbit・ホイールまたはピンチでZoom"}</p>
            </div>
            {mode === "yard" && (
              <div className={styles.driveControls} aria-label="モバイル走行操作">
                {(["steer-left", "throttle-forward", "throttle-reverse", "steer-right"] as const).map((action) => (
                  <button key={action} type="button" aria-label={MOBILE_ACTION_LABEL[action]} aria-pressed={mobilePressed[action]} disabled={!yardReady || paused} onPointerDown={handlePointerDown(action)} onPointerUp={handlePointerRelease} onPointerCancel={handlePointerRelease} onLostPointerCapture={handlePointerRelease}>{MOBILE_ACTION_TEXT[action]}</button>
                ))}
              </div>
            )}
          </div>
        </div>

        <aside className={styles.configurationPanel} aria-label="ローバー構成と操作">
          <div className={styles.panelHeader}>
            <div><p className={styles.controlLabel}>{mode === "garage" ? "CONFIGURATION" : "FIELD CONTROLS"}</p><h3>{mode === "garage" ? `${getCombinationCount()} builds / 12 modules` : "Same rover. New ground."}</h3></div>
            <p className={styles.selectionCount}>{mode === "garage" ? "64" : "YARD"}</p>
          </div>

          {mode === "garage" ? (
            <div className={styles.moduleGroups}>
              {MODULE_GROUPS.map((group) => (
                <fieldset className={styles.moduleGroup} key={group.category}>
                  <legend>{group.title}</legend>
                  <div className={styles.moduleOptions}>
                    {group.modules.map((module) => (
                      <label className={styles.moduleOption} key={module.id}>
                        <input type="radio" name={`rover-${group.category}`} value={module.id} checked={selection[group.category] === module.id} onChange={() => handleSelectionChange(group.category, module.id)} />
                        <span><strong>{module.label}</strong><small>{module.description}</small></span>
                      </label>
                    ))}
                  </div>
                </fieldset>
              ))}
            </div>
          ) : (
            <div className={styles.yardGuide}>
              <p>坂、連続する低い起伏、丸太、押せる箱、固定岩、ジャンプ台を試験区画ごとに配置しています。</p>
              <p className={styles.currentBuild}>CURRENT ROVER<strong>{selectionLabel}</strong></p>
              <dl>
                <div><dt>前進</dt><dd>W / ↑</dd></div>
                <div><dt>ブレーキ・後退</dt><dd>S / ↓</dd></div>
                <div><dt>左旋回</dt><dd>A / ←</dd></div>
                <div><dt>右旋回</dt><dd>D / →</dd></div>
                <div><dt>一時停止</dt><dd>P</dd></div>
                <div><dt>復帰</dt><dd>R</dd></div>
              </dl>
            </div>
          )}

          {mode === "garage" ? (
            <>
              <div className={styles.garageCameraControls} aria-label="Garage camera controls">
                <button type="button" onClick={() => sceneRef.current?.zoomBy("out")} disabled={!isReady}>− Zoom out</button>
                <button type="button" onClick={() => sceneRef.current?.zoomBy("in")} disabled={!isReady}>＋ Zoom in</button>
              </div>
              <div className={styles.panelActions}>
                <button type="button" onClick={handleReset} disabled={!isReady}>Reset view</button>
                <button type="button" onClick={handleAutoRotate} disabled={!isReady} aria-pressed={autoRotate}>{autoRotate ? "Stop auto rotate" : "Auto rotate"}</button>
              </div>
            </>
          ) : (
            <div className={styles.panelActions}>
              <button type="button" onClick={handlePause} disabled={!yardReady} aria-pressed={paused}>{paused ? "Resume" : "Pause"}</button>
              <button type="button" onClick={handleRecover} disabled={!yardReady}>Recover</button>
              <button type="button" onClick={() => handleModeChange("garage")} disabled={!isReady}>Back to Garage</button>
            </div>
          )}
          <p className={styles.selectionSummary} aria-live="polite">{mode === "garage" ? selectionLabel : announcement}</p>
          <p className={styles.statusMessage} aria-live="polite">{announcement}</p>
        </aside>
      </div>

      <p className={styles.motionNote}>{reducedMotion ? "reduced-motion: 自動回転OFF・カメラ追従を抑制中" : "reduced-motion: 通常の動き"}</p>
    </section>
  );
}
