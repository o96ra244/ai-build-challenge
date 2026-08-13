export type GraphicsCapability = "webgpu" | "webgl2" | "unsupported";

export type GraphicsCapabilities = {
  readonly webgpu: boolean;
  readonly webgl2: boolean;
};

export type RendererBackend = "WebGPU" | "WebGL 2 fallback";

export function selectGraphicsCapability(capabilities: GraphicsCapabilities): GraphicsCapability {
  if (capabilities.webgpu) {
    return "webgpu";
  }
  if (capabilities.webgl2) {
    return "webgl2";
  }
  return "unsupported";
}

export function detectGraphicsCapabilities(): GraphicsCapabilities {
  const webgpu = typeof navigator !== "undefined" && "gpu" in navigator;
  let webgl2 = false;

  if (typeof document !== "undefined") {
    const canvas = document.createElement("canvas");
    webgl2 = canvas.getContext("webgl2") !== null;
  }

  return { webgpu, webgl2 };
}

export function getRendererBackendLabel(isWebGLBackend: boolean): RendererBackend {
  return isWebGLBackend ? "WebGL 2 fallback" : "WebGPU";
}
