"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { STORAGE_KEY, validateLibrary } from "@/lib/coordination/storage";
import type { Library } from "@/lib/coordination/types";

const fresh = (): Library => ({
  version: 2,
  activeId: null,
  onboardingDone: false,
  workspaces: [],
});
export function useLibrary() {
  const [library, setLibrary] = useState<Library | null>(null);
  const [notice, setNotice] = useState("");
  const raw = useRef<string | null>(null);
  const current = useRef<Library | null>(null);
  const damaged = useRef(false);
  const load = useCallback(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      const next = stored ? validateLibrary(JSON.parse(stored)) : fresh();
      raw.current = stored;
      current.current = next;
      damaged.current = false;
      setLibrary(next);
    } catch (error) {
      damaged.current = true;
      current.current = fresh();
      setLibrary(current.current);
      setNotice(
        `The saved file could not be opened. It is preserved in storage. ${error instanceof Error ? error.message : "Storage is unavailable."}`,
      );
    }
  }, []);
  useEffect(() => {
    // Read browser storage after hydration; the server has no local workspace.
    let active = true;
    queueMicrotask(() => {
      if (active) load();
    });
    const update = (event: StorageEvent) => {
      if (event.key === STORAGE_KEY) {
        load();
        setNotice("Workspace refreshed from another tab.");
      }
    };
    window.addEventListener("storage", update);
    return () => {
      active = false;
      window.removeEventListener("storage", update);
    };
  }, [load]);
  const change = useCallback(
    (
      transform: (previous: Library) => Library,
      replacement = false,
    ): boolean => {
      try {
        if (!current.current) return false;
        if (damaged.current && !replacement)
          throw new Error(
            "Export the preserved file or import a valid workspace before saving.",
          );
        const stored = localStorage.getItem(STORAGE_KEY);
        if (!replacement && stored !== raw.current) {
          load();
          throw new Error(
            "Another tab changed this workspace. Review the refreshed state and retry.",
          );
        }
        const next = validateLibrary(transform(current.current));
        const nextRaw = JSON.stringify(next);
        if (replacement && stored)
          localStorage.setItem(`${STORAGE_KEY}.previous`, stored);
        localStorage.setItem(STORAGE_KEY, nextRaw);
        raw.current = nextRaw;
        current.current = next;
        damaged.current = false;
        setLibrary(next);
        return true;
      } catch (error) {
        setNotice(
          error instanceof Error
            ? error.message
            : "The change could not be saved.",
        );
        return false;
      }
    },
    [load],
  );
  return { library, change, notice, setNotice, reload: load };
}
