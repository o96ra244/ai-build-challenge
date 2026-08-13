import { describe, expect, it } from "vitest";

import {
  canCommitLoadResult,
  createInitialViewerState,
  transitionViewerState,
} from "./viewerState";

const metadata = {
  version: "SPZ v4" as const,
  splatCount: 445_409,
  renderer: "WebGPU" as const,
  fileSize: "9.36 MB",
};

describe("Gaussian Splat viewer state", () => {
  it("transitions idle to loading and ready", () => {
    const idle = createInitialViewerState();
    const loading = transitionViewerState(idle, { type: "start" });
    expect(loading).toEqual({ status: "loading" });
    expect(transitionViewerState(loading, { type: "ready", metadata })).toEqual({ status: "ready", metadata });
  });

  it("represents loading errors and unsupported graphics separately", () => {
    const loading = { status: "loading" as const };
    expect(transitionViewerState(loading, { type: "error", message: "SPZ decode failed" })).toEqual({
      status: "error",
      message: "SPZ decode failed",
    });
    expect(transitionViewerState(loading, { type: "unsupported", message: "No graphics backend" })).toEqual({
      status: "unsupported",
      message: "No graphics backend",
    });
  });

  it("resets an error or ready state when retry starts", () => {
    expect(transitionViewerState({ status: "error", message: "failed" }, { type: "retry" })).toEqual({ status: "loading" });
    expect(transitionViewerState({ status: "ready", metadata }, { type: "retry" })).toEqual({ status: "loading" });
  });

  it("rejects stale or disposed load results", () => {
    expect(canCommitLoadResult(2, 2, false)).toBe(true);
    expect(canCommitLoadResult(1, 2, false)).toBe(false);
    expect(canCommitLoadResult(2, 2, true)).toBe(false);
  });
});
