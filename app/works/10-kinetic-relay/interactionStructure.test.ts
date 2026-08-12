import fs from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

const workDirectory = path.join(process.cwd(), "app/works/10-kinetic-relay");

describe("Work 10 interaction structure", () => {
  const component = fs.readFileSync(path.join(workDirectory, "KineticRelay.tsx"), "utf8");
  const scene = fs.readFileSync(path.join(workDirectory, "KineticRelayScene.ts"), "utf8");
  const styles = fs.readFileSync(path.join(workDirectory, "page.module.css"), "utf8");

  it("uses native course and action buttons with accessible route state", () => {
    expect(component).toContain('type="button"');
    expect(component).toContain("aria-pressed={selected}");
    expect(component).toContain('aria-live="polite"');
    expect(component).toContain('disabled={controlsDisabled}');
    expect(component).toContain("COURSE_IDS.map");
    expect(component).toContain("RESTART");
  });

  it("keeps the selector as a scene mechanism rather than a DOM-only tab switch", () => {
    expect(scene).toContain("startSelectorChange");
    expect(scene).toContain("selectorPlatform.position.x");
    expect(scene).toContain("selectorLockPin.position.y");
    expect(scene).toContain("updateSelectorVisuals");
    expect(scene).toContain("MachinePhysicsWorld");
  });

  it("provides visible keyboard focus styling and reduced-motion handling", () => {
    expect(styles).toContain(":focus-visible");
    expect(styles).toContain("prefers-reduced-motion");
    expect(component).toContain("prefers-reduced-motion: reduce");
    expect(scene).toContain("setReducedMotion");
  });
});
