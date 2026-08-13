import type { RendererBackend } from "./capability";

export const SPZ_VERSION_LABEL = "SPZ v4";
export const ASSET_SIZE_BYTES = 9_360_535;

export type RuntimeMetadata = {
  readonly version: typeof SPZ_VERSION_LABEL;
  readonly splatCount: number;
  readonly renderer: RendererBackend;
  readonly fileSize: string;
};

export function formatFileSize(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes < 0) {
    return "0 B";
  }
  if (bytes < 1_000_000) {
    return `${Math.round(bytes / 1_000)} KB`;
  }
  return `${(bytes / 1_000_000).toFixed(2)} MB`;
}

export function createRuntimeMetadata(
  splatCount: number,
  renderer: RendererBackend,
  fileSizeBytes = ASSET_SIZE_BYTES,
): RuntimeMetadata {
  return {
    version: SPZ_VERSION_LABEL,
    splatCount: Number.isFinite(splatCount) && splatCount >= 0 ? Math.floor(splatCount) : 0,
    renderer,
    fileSize: formatFileSize(fileSizeBytes),
  };
}
