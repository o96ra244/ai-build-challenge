"use client";

import { useEffect, useRef, useState, type PointerEvent } from "react";

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
  getCheckpointLabel,
  getDriveInputFromPressed,
  mapDriveKey,
  formatTrialTime,
  getSpeedDisplay,
  type DriveKeyAction,
  type PressedDriveKeys,
} from "./driveModel";
import type { LowPolyRoverScene, TrialHud, TrialStatus } from "./LowPolyRoverScene";
import styles from "./page.module.css";

type RuntimeStatus = "loading" | "ready" | "error";
type ModuleOption = RoverModuleDefinition;
type MobileDriveAction = "steer-left" | "steer-right" | "throttle-forward" | "throttle-reverse";

const EMPTY_PRESSED_KEYS: PressedDriveKeys = {
  throttleForward: false,
  throttleReverse: false,
  steerLeft: false,
  steerRight: false,
};

const INITIAL_HUD: TrialHud = {
  elapsedMilliseconds: 0,
  speed: 0,
  checkpointIndex: 0,
  onTrack: true,
};

const MOBILE_ACTION_LABEL: Record<MobileDriveAction, string> = {
  "steer-left": "左旋回",
  "steer-right": "右旋回",
  "throttle-forward": "アクセル",
  "throttle-reverse": "ブレーキ／後退",
};

const TRIAL_STATUS_LABEL: Record<TrialStatus, string> = {
  ready: "READY",
  countdown: "COUNTDOWN",
  running: "RUNNING",
  paused: "PAUSED",
  clear: "COURSE CLEAR",
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

function getPressedKeysForAction(action: DriveKeyAction, pressed: PressedDriveKeys): PressedDriveKeys {
  if (action === "throttle-forward") {
    return { ...pressed, throttleForward: true };
  }
  if (action === "throttle-reverse") {
    return { ...pressed, throttleReverse: true };
  }
  if (action === "steer-left") {
    return { ...pressed, steerLeft: true };
  }
  if (action === "steer-right") {
    return { ...pressed, steerRight: true };
  }
  return pressed;
}

function releasePressedKey(action: DriveKeyAction, pressed: PressedDriveKeys): PressedDriveKeys {
  if (action === "throttle-forward") {
    return { ...pressed, throttleForward: false };
  }
  if (action === "throttle-reverse") {
    return { ...pressed, throttleReverse: false };
  }
  if (action === "steer-left") {
    return { ...pressed, steerLeft: false };
  }
  if (action === "steer-right") {
    return { ...pressed, steerRight: false };
  }
  return pressed;
}

export function LowPolyRoverGarage() {
  const canvasHostRef = useRef<HTMLDivElement>(null);
  const sceneRef = useRef<LowPolyRoverScene | null>(null);
  const initialSelectionRef = useRef<RoverSelection>(INITIAL_SELECTION);
  const modeRef = useRef<ExperienceMode>("garage");
  const trialStatusRef = useRef<TrialStatus>("ready");
  const pressedKeysRef = useRef<PressedDriveKeys>(EMPTY_PRESSED_KEYS);
  const mobilePointersRef = useRef<Map<number, { readonly action: MobileDriveAction; readonly element: HTMLButtonElement }>>(new Map());
  const [runtimeStatus, setRuntimeStatus] = useState<RuntimeStatus>("loading");
  const [runtimeError, setRuntimeError] = useState("");
  const [webGpuApiAvailable, setWebGpuApiAvailable] = useState<boolean | null>(null);
  const [selection, setSelection] = useState<RoverSelection>(INITIAL_SELECTION);
  const [mode, setMode] = useState<ExperienceMode>("garage");
  const [autoRotate, setAutoRotate] = useState(false);
  const [reducedMotion, setReducedMotion] = useState(false);
  const [trialStatus, setTrialStatus] = useState<TrialStatus>("ready");
  const [countdown, setCountdown] = useState<number | null>(null);
  const [trialHud, setTrialHud] = useState<TrialHud>(INITIAL_HUD);
  const [bestTimeMilliseconds, setBestTimeMilliseconds] = useState<number | null>(null);
  const [clearTimeMilliseconds, setClearTimeMilliseconds] = useState<number | null>(null);
  const [mobilePressed, setMobilePressed] = useState<Record<MobileDriveAction, boolean>>({
    "steer-left": false,
    "steer-right": false,
    "throttle-forward": false,
    "throttle-reverse": false,
  });
  const [statusMessage, setStatusMessage] = useState("3Dを準備しています。初期構成はツインランプ / バブルキャノピー / カーゴラックです。");

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
      setStatusMessage(
        nextReducedMotion
          ? "動きを控えめにしました。カメラ回転、車体揺れ、砂ぼこりを抑えます。"
          : "通常の動きへ戻しました。Garageの自動回転は明示的に再開できます。",
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
          onTrialStatusChange: (nextStatus) => {
            trialStatusRef.current = nextStatus;
            setTrialStatus(nextStatus);
            if (nextStatus === "paused") {
              clearAllInput();
              setStatusMessage("一時停止中です。再開ボタンまたはPキーで再開できます。走行は勝手に再開しません。");
            } else if (nextStatus === "running") {
              setStatusMessage("手動走行中です。チェックポイントを順番に通過してください。");
            }
          },
          onCountdownChange: (nextCountdown) => {
            setCountdown(nextCountdown);
            if (nextCountdown !== null && nextCountdown > 0) {
              setStatusMessage(`${nextCountdown}。GOまでアクセルを押していても移動しません。`);
            } else if (nextCountdown === 0) {
              setStatusMessage("GO。ローバーを操作してください。");
            }
          },
          onTrialHudChange: (nextHud) => {
            setTrialHud(nextHud);
          },
          onTrialClear: (elapsedMilliseconds) => {
            setClearTimeMilliseconds(elapsedMilliseconds);
            setBestTimeMilliseconds((previous) => previous === null || elapsedMilliseconds < previous ? elapsedMilliseconds : previous);
            setStatusMessage(`コースクリア。タイム ${formatTrialTime(elapsedMilliseconds)}。もう一度走るかGarageへ戻れます。`);
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
        setStatusMessage("準備完了。Garageで構成を選ぶか、DIRT TRIALで手動走行を始められます。");
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
      clearAllInput();
      scene?.dispose();
      sceneRef.current = null;
    };
  }, []);

  useEffect(() => {
    sceneRef.current?.setSelection(selection);
  }, [selection]);

  useEffect(() => {
    modeRef.current = mode;
    trialStatusRef.current = trialStatus;
    if (countdown !== 0) {
      return;
    }

    const timeout = window.setTimeout(() => setCountdown(null), 700);
    return () => window.clearTimeout(timeout);
  }, [countdown, mode, trialStatus]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent): void => {
      if (modeRef.current !== "course" || isEditableTarget(event.target)) {
        return;
      }

      const action = mapDriveKey(event.key);
      if (!action) {
        return;
      }
      const status = trialStatusRef.current;
      if (event.repeat && (action === "pause" || action === "reset")) {
        return;
      }
      if (action === "pause") {
        if (status === "running" || status === "countdown") {
          event.preventDefault();
          sceneRef.current?.pauseTrial();
        } else if (status === "paused") {
          event.preventDefault();
          sceneRef.current?.resumeTrial();
        }
        return;
      }
      if (action === "reset") {
        if (status === "running" || status === "paused") {
          event.preventDefault();
          clearAllInput();
          sceneRef.current?.resetToCheckpoint();
          setStatusMessage("最後に通過したチェックポイントへ戻しました。速度と入力をリセットしています。");
        }
        return;
      }
      if (status !== "countdown" && status !== "running") {
        return;
      }
      if (event.key.startsWith("Arrow")) {
        event.preventDefault();
      }
      pressedKeysRef.current = getPressedKeysForAction(action, pressedKeysRef.current);
      syncDriveInput();
    };

    const handleKeyUp = (event: KeyboardEvent): void => {
      const action = mapDriveKey(event.key);
      if (!action) {
        return;
      }
      const next = releasePressedKey(action, pressedKeysRef.current);
      if (next === pressedKeysRef.current) {
        return;
      }
      pressedKeysRef.current = next;
      syncDriveInput();
    };

    const handleWindowBlur = (): void => {
      clearAllInput();
      if (modeRef.current === "course" && (trialStatusRef.current === "running" || trialStatusRef.current === "countdown")) {
        sceneRef.current?.pauseTrial();
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

  const isReady = runtimeStatus === "ready";
  const trialActive = mode === "course" && (trialStatus === "countdown" || trialStatus === "running");
  const radioDisabled = !isReady || mode === "course";
  const selectionLabel = getSelectionLabel(selection);
  const clearTime = clearTimeMilliseconds ?? trialHud.elapsedMilliseconds;

  const handleModeChange = (nextMode: ExperienceMode): void => {
    if (!isReady || nextMode === mode) {
      return;
    }
    if (trialActive) {
      setStatusMessage("走行中はGarageへ移動できません。一時停止してから戻ってください。");
      return;
    }

    clearAllInput();
    sceneRef.current?.setMode(nextMode);
    modeRef.current = nextMode;
    setMode(nextMode);
    if (nextMode === "course") {
      trialStatusRef.current = "ready";
      setTrialStatus("ready");
      setCountdown(null);
      setTrialHud(INITIAL_HUD);
      setClearTimeMilliseconds(null);
      setStatusMessage("DIRT TRIALを準備しました。コース全体を見てスタートを押してください。");
    } else {
      setStatusMessage("Garageへ戻りました。構成と視点を確認できます。自動回転は明示的に再開できます。");
    }
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

  const startOrResumeTrial = (): void => {
    if (!sceneRef.current || !isReady || mode !== "course") {
      return;
    }
    setClearTimeMilliseconds(null);
    if (trialStatus === "paused") {
      sceneRef.current.resumeTrial();
    } else if (trialStatus === "ready" || trialStatus === "clear") {
      sceneRef.current.startTrial();
    }
  };

  const restartTrial = (): void => {
    if (!sceneRef.current || !isReady || mode !== "course" || trialStatus === "running" || trialStatus === "countdown") {
      return;
    }
    clearAllInput();
    setClearTimeMilliseconds(null);
    sceneRef.current.restartTrial();
  };

  const resetToCheckpoint = (): void => {
    clearAllInput();
    sceneRef.current?.resetToCheckpoint();
    setStatusMessage("最後に通過したチェックポイントへ戻しました。速度と入力をリセットしています。");
  };

  const pauseOrResume = (): void => {
    if (trialStatus === "running" || trialStatus === "countdown") {
      sceneRef.current?.pauseTrial();
    } else if (trialStatus === "paused") {
      sceneRef.current?.resumeTrial();
    }
  };

  const updateMobilePressed = (action: MobileDriveAction): void => {
    const next = { ...mobilePressed };
    next[action] = [...mobilePointersRef.current.values()].some((pointer) => pointer.action === action);
    setMobilePressed(next);
  };

  const handlePointerDown = (action: MobileDriveAction) => (event: PointerEvent<HTMLButtonElement>): void => {
    if (trialStatusRef.current !== "running") {
      return;
    }
    event.currentTarget.setPointerCapture(event.pointerId);
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

  const mobileControlsDisabled = !isReady || mode !== "course" || trialStatus !== "running";
  const mobileActions: readonly MobileDriveAction[] = ["steer-left", "steer-right", "throttle-forward", "throttle-reverse"];

  return (
    <section className={styles.experience} aria-labelledby="garage-title">
      <div className={styles.experienceHeader}>
        <div>
          <p className={styles.kicker}>INTERACTIVE 3D GARAGE / DIRT TRIAL</p>
          <h2 id="garage-title">組み替えて、走り抜ける</h2>
          <p className={styles.experienceLead}>
            Front・Cabin・Rearを1つずつ選び、12種類の部品から64通りのローバーを組み立てて、広いダートコースを手動で走ります。
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
            disabled={!isReady || trialActive}
            aria-pressed={mode === "garage"}
          >
            GARAGE
          </button>
          <button
            type="button"
            className={mode === "course" ? styles.modeButtonActive : styles.modeButton}
            onClick={() => handleModeChange("course")}
            disabled={!isReady || trialActive}
            aria-pressed={mode === "course"}
          >
            DIRT TRIAL
          </button>
        </div>
      </div>

      <div className={styles.workspace}>
        <div className={styles.stageColumn}>
          <div className={styles.stageShell}>
            <div
              ref={canvasHostRef}
              className={styles.canvasHost}
              aria-label={mode === "course" ? "DIRT TRIALの低ポリダートコース操作ステージ" : "低ポリローバーを操作するGarageの3Dステージ"}
              aria-describedby="canvas-help"
            >
              {runtimeStatus === "loading" && <p className={styles.canvasOverlay}>ローバーを組み立てています…</p>}
              {runtimeStatus === "error" && (
                <p className={styles.canvasError} role="alert">
                  3D表示を開始できませんでした。{runtimeError}
                </p>
              )}
              <p id="canvas-help" className={styles.canvasHint}>
                {mode === "garage" ? "ドラッグでOrbit / ホイール・ピンチでZoom / パンなし" : "WASD／矢印キーで運転・Rでチェックポイントへ戻る・Pでpause"}
              </p>

              {mode === "course" && (
                <div className={styles.trialHud} aria-label="DIRT TRIAL HUD">
                  <div className={styles.trialHudHeader}>
                    <strong>DIRT TRIAL</strong>
                    <span>{TRIAL_STATUS_LABEL[trialStatus]}</span>
                  </div>
                  <div className={styles.trialHudGrid}>
                    <span>TIME<strong>{formatTrialTime(trialHud.elapsedMilliseconds)}</strong></span>
                    <span>BEST<strong>{bestTimeMilliseconds === null ? "—" : formatTrialTime(bestTimeMilliseconds)}</strong></span>
                    <span>{getCheckpointLabel(trialHud.checkpointIndex)}<strong>{trialHud.onTrack ? "ON TRACK" : "OFF TRACK"}</strong></span>
                    <span>SPEED<strong>{getSpeedDisplay(trialHud.speed)} u/s</strong></span>
                  </div>
                  {countdown !== null && (
                    <p className={styles.countdownOverlay} aria-live="polite">{countdown === 0 ? "GO" : countdown}</p>
                  )}
                  {trialStatus === "paused" && <p className={styles.trialOverlayMessage} aria-live="polite">PAUSED / 再開操作が必要です</p>}
                  {trialStatus === "clear" && (
                    <div className={styles.trialOverlayMessage} aria-live="polite">
                      <strong>COURSE CLEAR</strong>
                      <span>{formatTrialTime(clearTime)}</span>
                    </div>
                  )}
                </div>
              )}

              {mode === "course" && (
                <div className={styles.mobileControls} aria-label="スマートフォン用DIRT TRIAL操作" aria-describedby="mobile-controls-help">
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
                <p className={styles.controlLabel}>{mode === "garage" ? "GARAGE CONTROLS" : "DIRT TRIAL CONTROLS"}</p>
                <p className={styles.statusMessage} aria-live={trialStatus === "paused" || trialStatus === "clear" ? "polite" : "off"}>{statusMessage}</p>
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
                <>
                  <div className={styles.courseControls}>
                    <div className={styles.trialActionButtons}>
                      <button type="button" className={styles.primaryButton} onClick={startOrResumeTrial} disabled={!isReady || trialStatus === "countdown" || trialStatus === "running"}>
                        {trialStatus === "paused" ? "再開" : trialStatus === "clear" ? "もう一度走る" : "スタート"}
                      </button>
                      <button type="button" onClick={pauseOrResume} disabled={!isReady || (trialStatus !== "countdown" && trialStatus !== "running" && trialStatus !== "paused")}>
                        {trialStatus === "paused" ? "再開" : "一時停止"}
                      </button>
                      <button type="button" onClick={resetToCheckpoint} disabled={!isReady || (trialStatus !== "running" && trialStatus !== "paused")}>最後のチェックポイントへ戻す</button>
                      <button type="button" onClick={restartTrial} disabled={!isReady || trialStatus === "countdown" || trialStatus === "running"}>最初からやり直す</button>
                      <button type="button" onClick={() => handleModeChange("garage")} disabled={!isReady || trialActive}>Garageへ戻る</button>
                    </div>
                    <p className={styles.courseState}>
                      <strong>{TRIAL_STATUS_LABEL[trialStatus]}</strong>
                      <span>{trialStatus === "ready" ? "スタート前はコース全体を確認できます" : trialStatus === "running" ? "車両とモジュールは走行終了まで固定" : trialStatus === "clear" ? "タイム確定。再走行できます" : "再開操作まで車両とタイムを停止"}</span>
                    </p>
                  </div>
                  <div className={styles.keyboardHelp} aria-label="キーボード操作方法">
                    <strong>KEYBOARD</strong>
                    <span>W／↑ アクセル</span>
                    <span>S／↓ ブレーキ・後退</span>
                    <span>A／← 左旋回</span>
                    <span>D／→ 右旋回</span>
                    <span>R checkpoint</span>
                    <span>P pause</span>
                  </div>
                  <p id="mobile-controls-help" className={styles.mobileControlsHint}>
                    スマートフォンの4つの操作buttonはRUNNING中のみ有効です。スタート前、pause中、clear後は無効になります。
                  </p>
                </>
              )}
              <div className={styles.statusDetails}>
                <span>{mode === "garage" ? "GARAGE" : "DIRT TRIAL"}</span>
                <span>{mode === "garage" ? (autoRotate ? "自動回転 ON" : "自動回転 OFF") : "高い追従カメラ"}</span>
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
              部品を選ぶと対象カテゴリだけが短く入れ替わります。DIRT TRIALではこの構成をそのまま使用します。
            </p>
          </section>
        )}
      </div>
    </section>
  );
}
