"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";

import { COURSE_IDS, COURSE_DEFINITIONS, type CourseId } from "./machineSequence";
import type {
  KineticRelayScene,
  MachineUiState,
} from "./KineticRelayScene";
import styles from "./page.module.css";

const DEFAULT_STATE: MachineUiState = {
  runtimeStatus: "loading",
  backend: "pending",
  selectedCourse: "A",
  selectorPhase: "settled",
  selectorMoving: false,
  sequencePhase: "ready",
  stageLabel: "RELEASE GATE",
  stageIndex: 0,
  stageCount: COURSE_DEFINITIONS.A.stages.length,
  canStart: false,
  statusText: "HELIX READY",
};

const COURSE_ACCENTS: Record<CourseId, string> = {
  A: "#dce8ee",
  B: "#f0c77c",
  C: "#b9eef2",
};

export function KineticRelay() {
  const canvasHostRef = useRef<HTMLDivElement>(null);
  const sceneRef = useRef<KineticRelayScene | null>(null);
  const [machineState, setMachineState] = useState<MachineUiState>(DEFAULT_STATE);
  const [loadingMessage, setLoadingMessage] = useState("Initializing renderer");
  const [runtimeError, setRuntimeError] = useState("");

  useEffect(() => {
    const container = canvasHostRef.current;
    if (!container) {
      return;
    }
    let disposed = false;
    let scene: KineticRelayScene | null = null;
    const mediaQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
    const handleMotionPreference = (): void => {
      sceneRef.current?.setReducedMotion(mediaQuery.matches);
    };
    mediaQuery.addEventListener("change", handleMotionPreference);

    void import("./KineticRelayScene")
      .then(async ({ KineticRelayScene: Scene }) => {
        if (disposed) {
          return null;
        }
        scene = new Scene(container, {
          reducedMotion: mediaQuery.matches,
          onLoadingState: (message) => {
            if (!disposed) {
              setLoadingMessage(message);
            }
          },
          onStateChange: (nextState) => {
            if (!disposed) {
              setMachineState(nextState);
            }
          },
        });
        sceneRef.current = scene;
        try {
          await scene.init();
          if (disposed) {
            scene.dispose();
            return null;
          }
          return null;
        } catch (error: unknown) {
          if (disposed) {
            return null;
          }
          scene.dispose();
          setRuntimeError(error instanceof Error ? error.message : "3D machine could not be initialized.");
          setMachineState((current) => ({ ...current, runtimeStatus: "error", canStart: false }));
          return null;
        }
      })
      .catch((error: unknown) => {
        if (disposed) {
          return;
        }
        setRuntimeError(error instanceof Error ? error.message : "3D machine could not be loaded.");
        setMachineState((current) => ({ ...current, runtimeStatus: "error", canStart: false }));
      });

    return () => {
      disposed = true;
      mediaQuery.removeEventListener("change", handleMotionPreference);
      scene?.dispose();
      sceneRef.current = null;
    };
  }, []);

  const selectCourse = (course: CourseId): void => {
    sceneRef.current?.selectCourse(course);
  };

  const start = (): void => {
    sceneRef.current?.start();
  };

  const restart = (): void => {
    sceneRef.current?.restart();
  };

  const isRunning = machineState.sequencePhase === "running";
  const isComplete = machineState.sequencePhase === "complete";
  const controlsDisabled = machineState.runtimeStatus !== "ready" || machineState.selectorMoving || isRunning;
  const selectedDefinition = COURSE_DEFINITIONS[machineState.selectedCourse];

  return (
    <main className={styles.experience} aria-labelledby="kinetic-relay-title">
      <div className={styles.canvasHost} ref={canvasHostRef} aria-describedby="kinetic-relay-description">
        {machineState.runtimeStatus === "loading" && (
          <div className={styles.loadingPanel} role="status" aria-live="polite">
            <span className={styles.loadingMark} aria-hidden="true" />
            <span>{loadingMessage}</span>
          </div>
        )}
        {machineState.runtimeStatus === "error" && (
          <div className={styles.errorPanel} role="alert">
            <strong>THE MACHINE COULD NOT START</strong>
            <span>WebGL / Rapier initialization failed.</span>
            <small>{runtimeError}</small>
          </div>
        )}
      </div>

      <div className={styles.uiLayer}>
        <header className={styles.header}>
          <p className={styles.workNumber}>WORK 10 <span>/ 15</span></p>
          <h1 id="kinetic-relay-title">
            <span>KINETIC RELAY</span>
            <em>TRIPLE ROUTE MARBLE MACHINE</em>
          </h1>
          <p id="kinetic-relay-description" className={styles.description}>
            ひとつの精密機械に接続された3つの経路。junctionを選び、重量のある連鎖を見届けます。
          </p>
        </header>

        <div className={styles.topRight}>
          <span className={styles.backendLabel}>PRECISION STUDY / 10</span>
          <Link href="/" className={styles.indexLink} aria-label="作品一覧へ戻る">INDEX ↗</Link>
        </div>

        <section className={styles.controlPanel} aria-label="Course controls">
          <div className={styles.panelHeading}>
            <span>JUNCTION / COURSE</span>
            <span className={styles.selectorDot} aria-hidden="true" />
          </div>
          <div className={styles.courseButtons} role="group" aria-label="Course selection">
            {COURSE_IDS.map((course) => {
              const definition = COURSE_DEFINITIONS[course];
              const selected = machineState.selectedCourse === course;
              return (
                <button
                  type="button"
                  key={course}
                  className={`${styles.courseButton} ${selected ? styles.courseButtonSelected : ""}`}
                  style={{ "--course-accent": COURSE_ACCENTS[course] } as React.CSSProperties}
                  aria-pressed={selected}
                  disabled={controlsDisabled}
                  onClick={() => selectCourse(course)}
                >
                  <span className={styles.courseLetter}>{course}</span>
                  <span className={styles.courseName}>{definition.name}</span>
                  <span className={styles.courseMaterial}>{definition.subtitle}</span>
                </button>
              );
            })}
          </div>
          <div className={styles.selectedCourse}>
            <span className={styles.selectedLabel}>LOCKED ROUTE</span>
            <strong>{machineState.selectedCourse} — {selectedDefinition.name}</strong>
            <span className={styles.selectorStatus}>
              {machineState.selectorMoving ? `JUNCTION ${machineState.selectorPhase.toUpperCase()}` : machineState.sequencePhase.toUpperCase()}
            </span>
          </div>
          <div className={styles.actionRow}>
            <button
              type="button"
              className={styles.startButton}
              disabled={!machineState.canStart}
              onClick={start}
            >
              START <span aria-hidden="true">↗</span>
            </button>
            {(isRunning || isComplete) && (
              <button type="button" className={styles.restartButton} onClick={restart} disabled={machineState.selectorMoving}>
                RESTART
              </button>
            )}
          </div>
        </section>

        <section className={styles.statusPanel} aria-label="Machine status">
          <p className={styles.statusKicker}>RELAY / LIVE SEQUENCE</p>
          <p className={styles.statusText} aria-live="polite">{machineState.statusText}</p>
          <div className={styles.progressTrack} aria-hidden="true">
            <span style={{ width: `${isComplete ? 100 : isRunning ? ((machineState.stageIndex + 0.2) / machineState.stageCount) * 100 : 0}%` }} />
          </div>
          {isRunning && <p className={styles.stageText}>{String(machineState.stageIndex + 1).padStart(2, "0")} / {String(machineState.stageCount).padStart(2, "0")} · {machineState.stageLabel}</p>}
          {isComplete && <p className={styles.completeText}>GOAL BELL · COMPLETE</p>}
        </section>

        <p className={styles.hint}>SELECT A ROUTE · WATCH THE LOCK · START THE RELAY</p>

        <footer className={styles.footer}>
          <span>CHROME / BRASS / GLASS</span>
          <span>ONE MACHINE · THREE ROUTES</span>
        </footer>
      </div>
    </main>
  );
}
