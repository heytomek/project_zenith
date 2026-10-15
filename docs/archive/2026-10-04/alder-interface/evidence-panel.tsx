"use client";
import { useEffect, useRef } from "react";
import { X, Plus, ArrowUpRight } from "lucide-react";
import { EVIDENCE, type EvidenceKey } from "@/lib/commons/evidence";
import { CASE_EVIDENCE } from "@/lib/commons/case-study";
import type { Pathway } from "@/lib/commons/model";
export function EvidencePanel({
  target,
  pathway,
  close,
  challenge,
  sources,
}: {
  target: EvidenceKey;
  pathway: Pathway;
  close: () => void;
  challenge: (key: EvidenceKey) => void;
  sources: (sourceId: string) => void;
}) {
  const heading = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    heading.current?.focus();
  }, [target]);
  const e = EVIDENCE[target];
  const notes = CASE_EVIDENCE.filter((source) => source.target === target);
  const current =
    target === "voluntaryHours"
      ? `${pathway.assumptions.voluntaryHours} hours / month`
      : target === "leadMonths"
        ? `${pathway.assumptions.leadMonths} months`
        : target === "reductionPercent"
          ? `${pathway.assumptions.reductionPercent}% reduction`
          : e.value;
  return (
    <aside className="evidence-panel" aria-labelledby="evidence-title">
      <div className="section-heading">
        <span className="compact-badge">{e.status}</span>
        <button
          className="icon-button"
          aria-label="Close evidence"
          title="Close evidence"
          onClick={close}
        >
          <X size={18} />
        </button>
      </div>
      <h2 ref={heading} id="evidence-title" tabIndex={-1}>
        {e.title}
      </h2>
      <p className="evidence-value">{current}</p>
      <p>{e.explanation}</p>
      <code className="equation">{e.equation}</code>
      <h3>Limits</h3>
      <p>{e.limitation}</p>
      <h3>Required evidence</h3>
      <p>{e.needed}</p>
      {notes.length > 0 && (
        <div className="evidence-source-links">
          <h3>Sources</h3>
          {notes.slice(0, 2).map((source) => (
            <button
              className="text-button"
              key={source.id}
              onClick={() => sources(source.id)}
            >
              {source.title} <ArrowUpRight size={14} />
            </button>
          ))}
          {notes.length > 2 && (
            <button
              className="text-button"
              onClick={() => sources(notes[2].id)}
            >
              {notes.length - 2} more <ArrowUpRight size={14} />
            </button>
          )}
        </div>
      )}
      <button className="button secondary" onClick={() => challenge(target)}>
        <Plus size={15} /> Challenge
      </button>
    </aside>
  );
}
