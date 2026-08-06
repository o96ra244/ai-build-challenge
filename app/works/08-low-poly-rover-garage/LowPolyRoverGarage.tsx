"use client";

import { useEffect, useRef, useState, type PointerEvent } from "react";

import { FrontierMiniMap } from "./FrontierMiniMap";
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
import {
  EMPTY_PRESSED_KEYS,
  formatFrontierTime,
  getDriveInputFromPressed,
  getSpeedDisplay,
  mapDriveKey,
  setPressedDriveKey,
  type PressedDriveKeys,
} from "./driveModel";
import { FRONTIER_START, type FrontierMode } from "./frontierWorld";
import type { FrontierHud, FrontierRunStatus, LowPolyRoverScene } from "./LowPolyRoverScene";
import styles from "./page.module.css";

type RuntimeStatus = "loading" | "ready" | "error";
type ModuleOption = RoverModuleDefinition;
type MobileDriveAction = "steer-left" | "steer-right" | "throttle-forward" | "throttle-reverse";

const INITIAL_FRONTIER_HUD: FrontierHud = {
  mode: "free-roam",
  status: "ready",
  areaLabel: "BASE CAMP MEADOW",
  surface: "MEADOW",
  speed: 0,
  groundedWheels: 0,
  traction: 1,
  visitedAreas: 0,
  visitedAreaIds: [],
  waystoneCount: 0,
  visitedWaystoneIds: [],
  nextWaystoneDistance: null,
  elapsedMilliseconds: 0,
  x: FRONTIER_START.x,
  z: FRONTIER_START.z,
  heading: FRONTIER_START.heading,
  recoveryReady: false,
  rolloverSeconds: 0,
};

const MOBILE_ACTION_LABEL: Record<MobileDriveAction, string> = {
  "steer-left": "左旋回",
  "steer-right": "右旋回",
  "throttle-forward": "アクセル",
  "throttle-reverse": "ブレーキ／後退",
};

const FRONTIER_STATUS_LABEL: Record<FrontierRunStatus, string> = {
  ready: "READY",
  countdown: "COUNTDOWN",
  running: "RUNNING",
  paused: "PAUSED",
  clear: "WAYSTONE RUN CLEAR",
};

const MODULE_GROUPS: readonly {
  readonly category: ModuleCategory;
  readonly legend: string;
  readonly modules: readonly ModuleOption[];
}[] = [
  { category: "front", legend: "Front / フロント", modules: FRONT_MODULES },
  { category: "cabin", legend: "Cabin / キャビン", modules: CABIN_MODULES },
  { category: "rear", legend: "Rear / リア", modules: REAR_MODULES },
];

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
  const frontierModeRef = useRef<FrontierMode>("free-roam");
  const frontierStatusRef = useRef<FrontierRunStatus>("ready");
  const pressedKeysRef = useRef<PressedDriveKeys>(EMPTY_PRESSED_KEYS);
  const mobilePointersRef = useRef<Map<number, { readonly action: MobileDriveAction; readonly element: HTMLButtonElement }>>(new Map());
  const [runtimeStatus, setRuntimeStatus] = useState<RuntimeStatus>("loading");
  const [runtimeError, setRuntimeError] = useState("");
  const [sceneAttempt, setSceneAttempt] = useState(0);
  const [webGpuApiAvailable, setWebGpuApiAvailable] = useState<boolean | null>(null);
  const [selection, setSelection] = useState<RoverSelection>(INITIAL_SELECTION);
  const [mode, setMode] = useState<ExperienceMode>("garage");
  const [frontierMode, setFrontierMode] = useState<FrontierMode>("free-roam");
  const [frontierLoading, setFrontierLoading] = useState(false);
  const [frontierStatus, setFrontierStatus] = useState<FrontierRunStatus>("ready");
  const [countdown, setCountdown] = useState<number | null>(null);
  const [frontierHud, setFrontierHud] = useState<FrontierHud>(INITIAL_FRONTIER_HUD);
  const [bestTimeMilliseconds, setBestTimeMilliseconds] = useState<number | null>(null);
  const [clearTimeMilliseconds, setClearTimeMilliseconds] = useState<number | null>(null);
  const [autoRotate, setAutoRotate] = useState(false);
  const [reducedMotion, setReducedMotion] = useState(false);
  const [announcement, setAnnouncement] = useState("");
  const [mobilePressed, setMobilePressed] = useState<Record<MobileDriveAction, boolean>>({
    "steer-left": false,
    "steer-right": false,
    "throttle-forward": false,
    "throttle-reverse": false,
  });
  const [statusMessage, setStatusMessage] = useState("3Dを準備しています。初期構成はツインランプ / バブルキャノピー / カーゴラックです。");
  const selectionRef = useRef(selection);

  const syncDriveInput = (): void => {
    const pointerActions = mobilePointersRef.current;
    const keyState = pressedKeysRef.current;
    sceneRef.current?.setDriveInput(getDriveInputFromPressed({
      throttleForward: keyState.throttleForward || [...pointerActions.values()].some((pointer) => pointer.action === "throttle-forward"),
      throttleReverse: keyState.throttleReverse || [...pointerActions.values()].some((pointer) => pointer.action === "throttle-reverse"),
      steerLeft: keyState.steerLeft || [...pointerActions.values()].some((pointer) => pointer.action === "steer-left"),
      steerRight: keyState.steerRight || [...pointerActions.values()].some((pointer) => pointer.action === "steer-right"),
    }));
  };

  const clearAllInput = (): void => {
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
  };

  useEffect(() => {
    const container = canvasHostRef.current;
    if (!container) {
      return;
    }

    let disposed = false;
    let scene: LowPolyRoverScene | null = null;
    const mediaQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
    setReducedMotion(mediaQuery.matches);
    setAutoRotate(!mediaQuery.matches);

    const handleMotionPreference = (): void => {
      const nextReducedMotion = mediaQuery.matches;
      setReducedMotion(nextReducedMotion);
      sceneRef.current?.setReducedMotion(nextReducedMotion);
      setStatusMessage(nextReducedMotion
        ? "動きを控えめにしました。カメラ回転、車体揺れ、砂ぼこりを抑えます。"
        : "通常の動きへ戻しました。Garageの自動回転は明示的に再開できます。");
    };
    mediaQuery.addEventListener("change", handleMotionPreference);

    void import("./LowPolyRoverScene")
      .then(async ({ LowPolyRoverScene: Scene }) => {
        if (disposed) {
          return null;
        }
        scene = new Scene(container, {
          reducedMotion: mediaQuery.matches,
          selection: selectionRef.current,
          onAutoRotateChange: setAutoRotate,
          onFrontierStatusChange: (nextStatus) => {
            frontierStatusRef.current = nextStatus;
            setFrontierStatus(nextStatus);
            if (nextStatus === "paused") {
              clearAllInput();
            }
          },
          onFrontierCountdownChange: (nextCountdown) => {
            setCountdown(nextCountdown);
            if (nextCountdown !== null && nextCountdown > 0) {
              setStatusMessage(`${nextCountdown}。GOまではアクセルを押していても移動しません。`);
            } else if (nextCountdown === 0) {
              setStatusMessage("GO。固定マップを自由に走行できます。");
            }
          },
          onFrontierHudChange: (nextHud) => {
            frontierModeRef.current = nextHud.mode;
            frontierStatusRef.current = nextHud.status;
            setFrontierHud(nextHud);
          },
          onFrontierWaystone: (_id, label) => {
            setStatusMessage(`${label} Waystoneを起動しました。`);
          },
          onFrontierComplete: (elapsedMilliseconds) => {
            setClearTimeMilliseconds(elapsedMilliseconds);
            setBestTimeMilliseconds((previous) => previous === null || elapsedMilliseconds < previous ? elapsedMilliseconds : previous);
          },
          onFrontierAnnouncement: (message) => {
            setAnnouncement(message);
            setStatusMessage(message);
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
        setStatusMessage("準備完了。GARAGEで構成を選ぶか、FRONTIERで固定マップを走行できます。");
        return result;
      })
      .catch((error: unknown) => {
        if (disposed) {
          return;
        }
        setRuntimeError(error instanceof Error ? error.message : "3Dシーンを初期化できませんでした。");
        setRuntimeStatus("error");
        setStatusMessage("3D表示を開始できませんでした。エラー内容を確認してください。");
      });

    return () => {
      disposed = true;
      mediaQuery.removeEventListener("change", handleMotionPreference);
      clearAllInput();
      scene?.dispose();
      sceneRef.current = null;
    };
  }, [sceneAttempt]);

  useEffect(() => {
    selectionRef.current = selection;
    sceneRef.current?.setSelection(selection);
  }, [selection]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent): void => {
      if (modeRef.current !== "frontier" || isEditableTarget(event.target)) {
        return;
      }
      const action = mapDriveKey(event.key);
      if (!action) {
        return;
      }
      const status = frontierStatusRef.current;
      if (event.repeat && (action === "pause" || action === "reset")) {
        return;
      }
      if (action === "pause") {
        if (status === "running" || status === "countdown") {
          event.preventDefault();
          sceneRef.current?.pauseFrontier();
        } else if (status === "paused") {
          event.preventDefault();
          sceneRef.current?.resumeFrontier();
        }
        return;
      }
      if (action === "reset") {
        if (status === "running" || status === "paused") {
          event.preventDefault();
          clearAllInput();
          sceneRef.current?.recoverFrontier();
        }
        return;
      }
      if (status !== "countdown" && status !== "running") {
        return;
      }
      if (event.key.startsWith("Arrow")) {
        event.preventDefault();
      }
      pressedKeysRef.current = setPressedDriveKey(pressedKeysRef.current, action, true);
      syncDriveInput();
    };

    const handleKeyUp = (event: KeyboardEvent): void => {
      if (modeRef.current !== "frontier" || isEditableTarget(event.target)) {
        return;
      }
      const action = mapDriveKey(event.key);
      if (!action) {
        return;
      }
      pressedKeysRef.current = setPressedDriveKey(pressedKeysRef.current, action, false);
      syncDriveInput();
    };

    const handleWindowBlur = (): void => {
      clearAllInput();
      const status = frontierStatusRef.current;
      if (modeRef.current === "frontier" && (status === "running" || status === "countdown")) {
        sceneRef.current?.pauseFrontier();
      }
    };

    const handleVisibility = (): void => {
      if (document.visibilityState !== "visible") {
        handleWindowBlur();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("keyup", handleKeyUp);
    window.addEventListener("blur", handleWindowBlur);
    document.addEventListener("visibilitychange", handleVisibility);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("keyup", handleKeyUp);
      window.removeEventListener("blur", handleWindowBlur);
      document.removeEventListener("visibilitychange", handleVisibility);
      clearAllInput();
    };
  }, []);

  useEffect(() => {
    if (countdown !== 0) {
      return;
    }
    const timeout = window.setTimeout(() => setCountdown(null), 700);
    return () => window.clearTimeout(timeout);
  }, [countdown]);

  const isReady = runtimeStatus === "ready";
  const radioDisabled = !isReady || mode === "frontier";
  const selectionLabel = getSelectionLabel(selection);
  const clearTime = clearTimeMilliseconds ?? frontierHud.elapsedMilliseconds;
  const mobileControlsDisabled = !isReady || mode !== "frontier" || frontierStatus !== "running";

  const handleModeChange = (nextMode: ExperienceMode): void => {
    if (!isReady || nextMode === mode || frontierLoading) {
      return;
    }
    clearAllInput();
    modeRef.current = nextMode;
    setMode(nextMode);
    if (nextMode === "frontier") {
      frontierModeRef.current = "free-roam";
      setFrontierMode("free-roam");
      setFrontierLoading(true);
      setRuntimeError("");
      setClearTimeMilliseconds(null);
      setStatusMessage("FRONTIERを読み込んでいます。Rapierの地形と車両を準備します…");
      void sceneRef.current?.setMode(nextMode)
        .then(() => {
          setFrontierLoading(false);
          setStatusMessage("FREE ROAMを開始しました。丘、岩、段差を自由に攻略できます。");
        })
        .catch((error: unknown) => {
          setFrontierLoading(false);
          setRuntimeError(error instanceof Error ? error.message : "FRONTIERを読み込めませんでした。");
          setStatusMessage("FRONTIERを読み込めませんでした。再度切り替えてください。");
        });
    } else {
      setCountdown(null);
      setFrontierStatus("ready");
      frontierStatusRef.current = "ready";
      void sceneRef.current?.setMode(nextMode);
      setStatusMessage("GARAGEへ戻りました。自動回転は明示的に再開できます。");
    }
  };

  const handleFrontierModeChange = (nextMode: FrontierMode): void => {
    if (mode !== "frontier" || !isReady || frontierLoading) {
      return;
    }
    clearAllInput();
    frontierModeRef.current = nextMode;
    setFrontierMode(nextMode);
    setClearTimeMilliseconds(null);
    sceneRef.current?.setFrontierMode(nextMode);
    setStatusMessage(nextMode === "free-roam"
      ? "FREE ROAMです。チェックポイントやタイマーなしで固定マップを探索できます。"
      : "WAYSTONE RUNを準備しました。6つのWaystoneを好きな順番で起動してください。");
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
    const changedModule = MODULE_GROUPS.find((group) => group.category === category)?.modules.find((module) => module.id === id);
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

  const startOrResumeWaystoneRun = (): void => {
    if (!sceneRef.current || mode !== "frontier") {
      return;
    }
    clearAllInput();
    if (frontierStatus === "paused") {
      sceneRef.current.resumeFrontier();
    } else if (frontierStatus === "ready" || frontierStatus === "clear") {
      setClearTimeMilliseconds(null);
      sceneRef.current.startWaystoneRun();
    }
  };

  const restartWaystoneRun = (): void => {
    clearAllInput();
    setClearTimeMilliseconds(null);
    sceneRef.current?.restartWaystoneRun();
  };

  const pauseOrResume = (): void => {
    if (frontierStatus === "running" || frontierStatus === "countdown") {
      sceneRef.current?.pauseFrontier();
    } else if (frontierStatus === "paused") {
      sceneRef.current?.resumeFrontier();
    }
  };

  const recover = (): void => {
    clearAllInput();
    sceneRef.current?.recoverFrontier();
  };

  const retryScene = (): void => {
    clearAllInput();
    setRuntimeError("");
    setRuntimeStatus("loading");
    setSceneAttempt((attempt) => attempt + 1);
  };

  const retryFrontier = (): void => {
    if (!sceneRef.current || !isReady) {
      return;
    }
    clearAllInput();
    setRuntimeError("");
    setFrontierLoading(true);
    void sceneRef.current.setMode("garage")
      .then(() => sceneRef.current?.setMode("frontier"))
      .then(() => {
        setFrontierLoading(false);
        setStatusMessage("FREE ROAMを開始しました。丘、岩、段差を自由に攻略できます。");
      })
      .catch((error: unknown) => {
        setFrontierLoading(false);
        setRuntimeError(error instanceof Error ? error.message : "FRONTIERを読み込めませんでした。");
        setStatusMessage("FRONTIERを読み込めませんでした。再試行してください。");
      });
  };

  const updateMobilePressed = (action: MobileDriveAction): void => {
    setMobilePressed((previous) => ({
      ...previous,
      [action]: [...mobilePointersRef.current.values()].some((pointer) => pointer.action === action),
    }));
  };

  const handlePointerDown = (action: MobileDriveAction) => (event: PointerEvent<HTMLButtonElement>): void => {
    if (mobileControlsDisabled) {
      return;
    }
    try {
      event.currentTarget.setPointerCapture(event.pointerId);
    } catch {
      // A synthetic pointer has no capturable native pointer.
    }
    mobilePointersRef.current.set(event.pointerId, { action, element: event.currentTarget });
    updateMobilePressed(action);
    syncDriveInput();
  };

  const handlePointerRelease = (event: PointerEvent<HTMLButtonElement>): void => {
    const action = mobilePointersRef.current.get(event.pointerId)?.action;
    mobilePointersRef.current.delete(event.pointerId);
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
    if (action) {
      updateMobilePressed(action);
    }
    syncDriveInput();
  };

  const mobileActions: readonly MobileDriveAction[] = ["steer-left", "steer-right", "throttle-forward", "throttle-reverse"];
  const selectedMode = frontierMode === "free-roam" ? "FREE ROAM" : "WAYSTONE RUN";

  return (
    <section className={styles.experience} aria-labelledby="garage-title">
      <div className={styles.experienceHeader}>
        <div>
          <p className={styles.kicker}>INTERACTIVE 3D GARAGE / ROVER FRONTIER</p>
          <h2 id="garage-title">組み替えて、未知の地形へ</h2>
          <p className={styles.experienceLead}>
            Front・Cabin・Rearを1つずつ選び、12種類の部品から64通りのローバーを組み立てて、GARAGEから固定フロンティアへ持ち込めます。
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
          <button type="button" className={mode === "garage" ? styles.modeButtonActive : styles.modeButton} onClick={() => handleModeChange("garage")} disabled={!isReady || frontierLoading} aria-pressed={mode === "garage"}>GARAGE</button>
          <button type="button" className={mode === "frontier" ? styles.modeButtonActive : styles.modeButton} onClick={() => handleModeChange("frontier")} disabled={!isReady || frontierLoading} aria-pressed={mode === "frontier"}>ROVER FRONTIER</button>
        </div>
      </div>

      <div className={styles.workspace}>
        <div className={styles.stageColumn}>
          <div className={styles.stageShell}>
            <div
              ref={canvasHostRef}
              className={styles.canvasHost}
              aria-label={mode === "frontier" ? "FRONTIERの固定オフロードマップ操作ステージ" : "低ポリローバーを操作するGARAGEの3Dステージ"}
              aria-describedby="canvas-help"
            >
              {runtimeStatus === "loading" && <p className={styles.canvasOverlay}>ローバーを組み立てています…</p>}
              {frontierLoading && <p className={styles.canvasOverlay}>FRONTIERを読み込んでいます…</p>}
              {runtimeStatus === "error" && (
                <div className={styles.canvasError} role="alert">
                  <span>3D表示を開始できませんでした。{runtimeError}</span>
                  <button type="button" onClick={retryScene}>再試行</button>
                </div>
              )}
              {mode === "frontier" && runtimeStatus === "ready" && runtimeError && (
                <div className={styles.canvasError} role="alert">
                  <span>FRONTIERを読み込めませんでした。{runtimeError}</span>
                  <button type="button" onClick={retryFrontier}>再試行</button>
                </div>
              )}
              <p id="canvas-help" className={styles.canvasHint}>
                {mode === "garage" ? "ドラッグでOrbit / ホイール・ピンチでZoom / パンなし" : "WASD／矢印キーで走行・Rで安全地点へ復帰・Pでpause"}
              </p>

              {mode === "frontier" && (
                <div className={styles.frontierHud} aria-label="FRONTIER HUD">
                  <div className={styles.frontierHudHeader}>
                    <strong>ROVER FRONTIER</strong>
                    <span>{frontierMode === "free-roam" ? "FREE ROAM" : FRONTIER_STATUS_LABEL[frontierStatus]}</span>
                  </div>
                  <div className={styles.frontierHudGrid}>
                    <span>AREA<strong>{frontierHud.areaLabel}</strong></span>
                    <span>SURFACE<strong>{frontierHud.surface}</strong></span>
                    <span>SPEED<strong>{getSpeedDisplay(frontierHud.speed)} u/s</strong></span>
                    <span>WHEELS<strong>WHEELS {frontierHud.groundedWheels} / 4</strong></span>
                    <span>TRACTION<strong>{frontierHud.traction.toFixed(2)}</strong></span>
                    {frontierMode === "free-roam" ? (
                      <span>AREAS<strong>{frontierHud.visitedAreas} / 6</strong></span>
                    ) : (
                      <>
                        <span>WAYSTONES<strong>{frontierHud.waystoneCount} / 6</strong></span>
                        <span>NEXT<strong>{frontierHud.nextWaystoneDistance === null ? "—" : `${frontierHud.nextWaystoneDistance.toFixed(0)}u`}</strong></span>
                      </>
                    )}
                    <span>TIME<strong>{frontierMode === "waystone-run" ? formatFrontierTime(frontierHud.elapsedMilliseconds) : "—"}</strong></span>
                    <span>BEST<strong>{bestTimeMilliseconds === null ? "—" : formatFrontierTime(bestTimeMilliseconds)}</strong></span>
                  </div>
                  <FrontierMiniMap x={frontierHud.x} z={frontierHud.z} heading={frontierHud.heading} visitedAreaIds={frontierHud.visitedAreaIds} visitedWaystoneIds={frontierHud.visitedWaystoneIds} />
                  {countdown !== null && <p className={styles.countdownOverlay} aria-live="polite">{countdown === 0 ? "GO" : countdown}</p>}
                  {frontierStatus === "paused" && <p className={styles.frontierOverlayMessage} aria-live="polite">PAUSED / 再開操作が必要です</p>}
                  {frontierStatus === "clear" && (
                    <div className={styles.frontierOverlayMessage} aria-live="polite">
                      <strong>WAYSTONE RUN CLEAR</strong>
                      <span>{formatFrontierTime(clearTime)}</span>
                    </div>
                  )}
                </div>
              )}

              {mode === "frontier" && (
                <div className={styles.mobileControls} aria-label="スマートフォン用FRONTIER操作" aria-describedby="mobile-controls-help">
                  {mobileActions.map((action) => (
                    <button
                      key={action}
                      type="button"
                      className={`${styles.mobileControl} ${mobilePressed[action] ? styles.mobileControlPressed : ""}`}
                      disabled={mobileControlsDisabled}
                      aria-pressed={mobilePressed[action]}
                      onPointerDown={handlePointerDown(action)}
                      onPointerUp={handlePointerRelease}
                      onPointerCancel={handlePointerRelease}
                      onLostPointerCapture={handlePointerRelease}
                      onPointerLeave={handlePointerRelease}
                    >
                      {MOBILE_ACTION_LABEL[action]}
                    </button>
                  ))}
                </div>
              )}
            </div>

            <div className={styles.controlPanel}>
              <div className={styles.controlHeader}>
                <p className={styles.controlLabel}>{mode === "garage" ? "GARAGE CONTROLS" : "FRONTIER CONTROLS"}</p>
                <p className={styles.statusMessage} aria-live={announcement || frontierStatus === "paused" || frontierStatus === "clear" ? "polite" : "off"}>{statusMessage}</p>
              </div>
              {mode === "garage" ? (
                <div className={styles.controlRows}>
                  <div className={styles.primaryControls}>
                    <button type="button" onClick={resetScene} disabled={!isReady}>視点をリセット</button>
                    <button type="button" onClick={toggleAutoRotate} disabled={!isReady} aria-pressed={autoRotate}>{autoRotate ? "自動回転 ON" : "自動回転 OFF"}</button>
                  </div>
                  <div className={styles.zoomControls} aria-label="ズーム操作">
                    <span>ズーム</span>
                    <button type="button" onClick={() => zoom("out")} disabled={!isReady} aria-label="ローバーから離れる">−</button>
                    <button type="button" onClick={() => zoom("in")} disabled={!isReady} aria-label="ローバーへ近づく">＋</button>
                  </div>
                </div>
              ) : (
                <>
                  <div className={styles.frontierSubmode} role="group" aria-label="フロンティアの遊び方">
                    <button type="button" onClick={() => handleFrontierModeChange("free-roam")} aria-pressed={frontierMode === "free-roam"} disabled={!isReady || frontierLoading}>FREE ROAM</button>
                    <button type="button" onClick={() => handleFrontierModeChange("waystone-run")} aria-pressed={frontierMode === "waystone-run"} disabled={!isReady || frontierLoading}>WAYSTONE RUN</button>
                  </div>
                  <div className={styles.frontierControls}>
                    <div className={styles.frontierActionButtons}>
                      {frontierMode === "waystone-run" && <button type="button" className={styles.primaryButton} onClick={startOrResumeWaystoneRun} disabled={!isReady || frontierStatus === "countdown" || frontierStatus === "running"}>{frontierStatus === "paused" ? "再開" : frontierStatus === "clear" ? "もう一度走る" : "スタート"}</button>}
                      <button type="button" onClick={pauseOrResume} disabled={!isReady || (frontierStatus !== "countdown" && frontierStatus !== "running" && frontierStatus !== "paused")}>{frontierStatus === "paused" ? "再開" : "一時停止"}</button>
                      <button type="button" onClick={recover} disabled={!isReady || (frontierStatus !== "running" && frontierStatus !== "paused")}>最後の安全地点へ復帰</button>
                      {frontierMode === "waystone-run" && <button type="button" onClick={restartWaystoneRun} disabled={!isReady || frontierStatus === "countdown" || frontierStatus === "running"}>最初から走る</button>}
                      <button type="button" onClick={() => handleModeChange("garage")} disabled={!isReady || frontierLoading}>Garageへ戻る</button>
                    </div>
                    <p className={styles.frontierState}>
                      <strong>{frontierMode === "free-roam" ? "FREE ROAM" : FRONTIER_STATUS_LABEL[frontierStatus]}</strong>
                      <span>{frontierMode === "free-roam" ? "タイマーや順番指定なし。固定マップを探索できます" : frontierStatus === "clear" ? "6つのWaystoneを起動しました。再走行できます" : "6つのWaystoneを好きな順番で起動します"}</span>
                    </p>
                  </div>
                  <div className={styles.keyboardHelp} aria-label="キーボード操作方法">
                    <strong>KEYBOARD</strong>
                    <span>W／↑ アクセル</span><span>S／↓ ブレーキ・後退</span><span>A／← 左旋回</span><span>D／→ 右旋回</span><span>R 安全地点へ復帰</span><span>P pause</span>
                  </div>
                  <p id="mobile-controls-help" className={styles.mobileControlsHint}>スマートフォンの4つのnative操作buttonは走行中のみ有効です。左右とアクセル・後退を2本指で同時入力できます。button外ではページをスクロールできます。</p>
                  {frontierHud.recoveryReady && <p className={styles.frontierRecoveryHint}>RECOVERY READY / Rまたは復帰buttonで約2秒前の安全地点へ戻せます。</p>}
                </>
              )}
              <div className={styles.statusDetails}>
                <span>{mode === "garage" ? "GARAGE" : selectedMode}</span>
                <span>{mode === "garage" ? (autoRotate ? "自動回転 ON" : "自動回転 OFF") : `${frontierHud.areaLabel} / ${frontierHud.surface}`}</span>
                <span>{reducedMotion ? "動きを控えめに設定中" : "通常の動き"}</span>
                <span>{webGpuApiAvailable === null ? "GPU APIを確認中" : webGpuApiAvailable ? "WebGPU API利用可能" : "互換描画を使用"}</span>
              </div>
            </div>
          </div>
        </div>

        {mode === "garage" && (
          <section className={styles.configurationPanel} aria-label="ローバー構成パネル">
            <div className={styles.configurationHeader}>
              <div><p className={styles.controlLabel}>MODULE DOCK</p><h3>3カテゴリから1つずつ選ぶ</h3></div>
              <p className={styles.combinationCount}>64 <span>通り</span></p>
            </div>
            <p className={styles.selectionSummary}><span>現在の構成</span><strong>{selectionLabel}</strong></p>
            <div className={styles.moduleGroups}>
              {MODULE_GROUPS.map((group) => (
                <fieldset className={styles.moduleGroup} key={group.category} disabled={radioDisabled}>
                  <legend>{group.legend}</legend>
                  <div className={styles.moduleOptions}>
                    {group.modules.map((module) => {
                      const selected = selection[group.category] === module.id;
                      return (
                        <label className={`${styles.moduleOption} ${selected ? styles.moduleOptionSelected : ""}`} key={module.id}>
                          <input className={styles.radioInput} type="radio" name={`rover-${group.category}`} value={module.id} checked={selected} onChange={() => handleSelectionChange(group.category, module.id)} />
                          <span className={styles.radioMark} aria-hidden="true">{selected ? "✓" : ""}</span>
                          <span className={styles.moduleCopy}><strong>{module.label}</strong></span>
                        </label>
                      );
                    })}
                  </div>
                </fieldset>
              ))}
            </div>
            <p className={styles.configurationNote} aria-live="polite">部品を選ぶと対象カテゴリだけが短く入れ替わります。FRONTIERではこの構成をそのまま使用します。</p>
          </section>
        )}
      </div>
    </section>
  );
}
