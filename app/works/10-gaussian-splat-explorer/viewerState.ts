import type { RuntimeMetadata } from "./metadata";

export type ViewerState =
  | { readonly status: "idle" }
  | { readonly status: "loading" }
  | { readonly status: "ready"; readonly metadata: RuntimeMetadata }
  | { readonly status: "error"; readonly message: string }
  | { readonly status: "unsupported"; readonly message: string };

export type ViewerEvent =
  | { readonly type: "start" }
  | { readonly type: "ready"; readonly metadata: RuntimeMetadata }
  | { readonly type: "error"; readonly message: string }
  | { readonly type: "unsupported"; readonly message: string }
  | { readonly type: "retry" };

export function createInitialViewerState(): ViewerState {
  return { status: "idle" };
}

export function transitionViewerState(state: ViewerState, event: ViewerEvent): ViewerState {
  switch (event.type) {
    case "start":
    case "retry":
      return { status: "loading" };
    case "ready":
      return { status: "ready", metadata: event.metadata };
    case "error":
      return { status: "error", message: event.message };
    case "unsupported":
      return { status: "unsupported", message: event.message };
    default:
      return state;
  }
}

export function canCommitLoadResult(
  attemptId: number,
  activeAttemptId: number,
  disposed: boolean,
): boolean {
  return !disposed && attemptId === activeAttemptId;
}
