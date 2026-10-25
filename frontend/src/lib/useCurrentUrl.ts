"use client";

import { useSyncExternalStore } from "react";

/** No-op subscribe: the URL only changes via a navigation, which remounts. */
function subscribe() {
  return () => {};
}

/**
 * The browser's current URL, or "" while rendering on the server.
 *
 * Read through useSyncExternalStore rather than an effect so the value is
 * available on the first client render without a state update, and the server
 * snapshot stays stable during hydration.
 */
export function useCurrentUrl(): string {
  return useSyncExternalStore(
    subscribe,
    () => window.location.href,
    () => ""
  );
}
