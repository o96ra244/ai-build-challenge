import fs from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

const workDirectory = path.join(process.cwd(), "app/works/09-thinker-light-study");

describe("Work 09 light interaction structure", () => {
  const component = fs.readFileSync(path.join(workDirectory, "ThinkerLightStudy.tsx"), "utf8");
  const scene = fs.readFileSync(path.join(workDirectory, "ThinkerLightScene.ts"), "utf8");
  const styles = fs.readFileSync(path.join(workDirectory, "page.module.css"), "utf8");

  it("keeps direct light interaction and a native keyboard disclosure", () => {
    expect(component).toContain("<details className={styles.lightPositionDisclosure}>");
    expect(component).toContain("<summary className={styles.lightPositionSummary}>LIGHT POSITION</summary>");
    expect(component).toContain('aria-live="polite"');
    expect(component).toContain("LIGHTING_PRESETS.map");
    expect(component).toContain("aria-pressed={selected}");
    expect(component).toContain("LIGHT_POSITION_CONTROLS.map");
    expect(component).not.toContain("open={");
    expect(styles).toContain(".lightPositionDisclosure:not([open]) .lightPositionButtons");
  });

  it("does not put secondary view or runtime readouts in the main screen", () => {
    expect(component).not.toContain("HOLD LIGHT");
    expect(component).not.toContain("VIEW");
    expect(component).not.toContain("KEY LIGHT");
    expect(component).not.toContain("DISTANCE RESPONSE");
    expect(component).not.toContain("WEBGPU /");
    expect(component).not.toContain("styles.statusCluster");
    expect(component).not.toContain("styles.lightReadout");
    expect(component).not.toContain("styles.lead");
    expect(component).not.toContain("styles.subtitle");
  });

  it("maps mouse movement and touch or pen taps to the shared light input", () => {
    expect(scene).toContain('addEventListener("pointermove", this.handlePointerMove');
    expect(scene).toContain('addEventListener("pointerdown", this.handlePointerDown');
    expect(scene).toContain('event.pointerType !== "touch"');
    expect(scene).toContain('event.pointerType !== "pen"');
    expect(scene).toContain("setLightFromClientPoint");
  });
});
