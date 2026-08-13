import { readFileSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

const sceneSource = readFileSync(path.join(process.cwd(), "app/works/10-gaussian-splat-explorer/GaussianSplatScene.ts"), "utf8");
const componentSource = readFileSync(path.join(process.cwd(), "app/works/10-gaussian-splat-explorer/GaussianSplatExplorer.tsx"), "utf8");

describe("Work 10 interaction architecture", () => {
  it("uses event-driven coalesced rendering and hides rendering while the tab is hidden", () => {
    expect(sceneSource).toContain("window.requestAnimationFrame");
    expect(sceneSource).toContain("this.renderFrameHandle !== null");
    expect(sceneSource).toContain("document.hidden");
    expect(sceneSource).not.toContain("setAnimationLoop");
    expect(sceneSource).not.toContain("autoRotate = true");
  });

  it("keeps orbit pan and damping disabled while using automatic Gaussian sorting", () => {
    expect(sceneSource).toContain("controls.enablePan = false");
    expect(sceneSource).toContain("controls.enableDamping = false");
    expect(sceneSource).toContain("new GaussianSplatMesh(geometry, { autoSort: true })");
    expect(sceneSource).toContain("new THREE.TextureLoader().loadAsync(BACKGROUND_URL)");
    expect(sceneSource).toContain("THREE.EquirectangularReflectionMapping");
    expect(sceneSource).toContain("this.scene.backgroundIntensity = 0.46");
    expect(sceneSource).toContain("renderer.toneMappingExposure = 0.68");
    expect(sceneSource).toContain("this.splatMesh.material.toneMapped = false");
  });

  it("keeps retry and HOME as native buttons", () => {
    expect(componentSource).toContain('<button type="button"');
    expect(componentSource).toContain("sceneRef.current?.resetCamera()");
    expect(componentSource).toContain("Retry");
  });
});
