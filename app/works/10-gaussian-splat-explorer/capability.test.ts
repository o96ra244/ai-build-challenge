import { describe, expect, it } from "vitest";

import { selectGraphicsCapability } from "./capability";

describe("Gaussian Splat graphics capability", () => {
  it("prefers a WebGPU candidate", () => {
    expect(selectGraphicsCapability({ webgpu: true, webgl2: true })).toBe("webgpu");
  });

  it("selects WebGL 2 when WebGPU is unavailable", () => {
    expect(selectGraphicsCapability({ webgpu: false, webgl2: true })).toBe("webgl2");
  });

  it("reports unsupported when neither backend is available", () => {
    expect(selectGraphicsCapability({ webgpu: false, webgl2: false })).toBe("unsupported");
  });
});
