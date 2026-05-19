/**
 * Global polling registry.
 *
 * The canonical source of all Trading Layer polling is
 * `MarketDataService`. Any other component that runs its own
 * recurring poll against the Trading Layer is considered a
 * duplicate loop and is flagged in the Dev Mode diagnostics panel.
 *
 * Components that intentionally run a controlled extra loop can
 * call `registerExternalLoop(id)` so they show up in diagnostics
 * but don't get flagged as duplicates.
 */

const externalLoops = new Set<string>();
const duplicateLoops = new Set<string>();
const listeners = new Set<() => void>();

function emit() {
  for (const l of listeners) {
    try {
      l();
    } catch {
      /* ignore */
    }
  }
}

export function registerExternalLoop(id: string) {
  if (externalLoops.has(id)) {
    duplicateLoops.add(id);
  } else {
    externalLoops.add(id);
  }
  emit();
}

export function unregisterExternalLoop(id: string) {
  externalLoops.delete(id);
  duplicateLoops.delete(id);
  emit();
}

export function getExternalLoops(): string[] {
  return Array.from(externalLoops);
}

export function getDuplicateLoops(): string[] {
  return Array.from(duplicateLoops);
}

export function hasDuplicateLoops(): boolean {
  return duplicateLoops.size > 0;
}

export function subscribePollingRegistry(cb: () => void): () => void {
  listeners.add(cb);
  return () => listeners.delete(cb);
}
