"use client";

import { useState } from "react";
import type { Workspace } from "@/lib/coordination/types";

export type StrategyDraft = { strategyId: string; rationale: string };
type ComposerDraft = { requested: string[]; name: string; thesis: string };

// Uncommitted writing is tab-local; the library remains the authority for decisions.
export function useStrategyDraft(workspace: Workspace) {
  const key = `zenith.strategy-draft.${workspace.profile.id}`;
  const [draft, setDraft] = useState<StrategyDraft>(() => {
    const fallback = {
      strategyId: workspace.profile.strategies[0].id,
      rationale: "",
    };
    try {
      const saved = JSON.parse(sessionStorage.getItem(key) ?? "null");
      if (
        saved &&
        typeof saved.rationale === "string" &&
        saved.rationale.length <= 4000 &&
        workspace.profile.strategies.some((s) => s.id === saved.strategyId)
      ) return { strategyId: saved.strategyId, rationale: saved.rationale };
    } catch { /* An unavailable draft store does not prevent editing. */ }
    return fallback;
  });
  const save = (next: StrategyDraft) => {
    setDraft(next);
    try { sessionStorage.setItem(key, JSON.stringify(next)); } catch { /* Keep this tab's in-memory draft. */ }
  };
  return [draft, save] as const;
}

export function useComposerDraft(workspace: Workspace, initialIds: string[]) {
  const key = `zenith.composer-draft.${workspace.profile.id}`;
  const [draft, setDraft] = useState<ComposerDraft>(() => {
    try {
      const saved = JSON.parse(sessionStorage.getItem(key) ?? "null");
      if (saved && typeof saved.name === "string" && saved.name.length <= 80 &&
        typeof saved.thesis === "string" && saved.thesis.length <= 1000 &&
        Array.isArray(saved.requested) && saved.requested.length <= workspace.profile.interventions.length &&
        saved.requested.every((id: unknown) => workspace.profile.interventions.some(i => i.id === id)))
        return { name: saved.name, thesis: saved.thesis, requested: saved.requested };
    } catch { /* The live preview can start without stored input. */ }
    return { name: "", thesis: "", requested: initialIds };
  });
  const save = (next: ComposerDraft) => {
    setDraft(next);
    try { sessionStorage.setItem(key, JSON.stringify(next)); } catch { /* Keep editing in memory. */ }
  };
  return [draft, save] as const;
}
