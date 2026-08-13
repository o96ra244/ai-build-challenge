export type CleanupRegistry = {
  readonly add: (disposer: () => void) => () => void;
  readonly dispose: () => void;
};

export function createCleanupRegistry(): CleanupRegistry {
  const disposers = new Set<() => void>();
  let disposed = false;

  return {
    add(disposer) {
      if (disposed) {
        disposer();
        return () => undefined;
      }
      disposers.add(disposer);
      return () => {
        disposers.delete(disposer);
      };
    },
    dispose() {
      if (disposed) {
        return;
      }
      disposed = true;
      const pending = [...disposers];
      disposers.clear();
      pending.forEach((disposer) => disposer());
    },
  };
}
