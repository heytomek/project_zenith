"use client";

import { useState } from "react";
import { ArrowRight, Check, Plus, Upload } from "lucide-react";
import { PROFILES, makeProfile } from "@/lib/coordination/profiles";
import type { Profile } from "@/lib/coordination/types";
import { IconButton, Mark, WorldIcon } from "./primitives";

export function ProfileArt({ kind }: { kind: Profile["icon"] }) {
  const nodes =
    kind === "region"
      ? [
          [26, 58],
          [50, 28],
          [76, 56],
          [50, 78],
        ]
      : kind === "enterprise"
        ? [
            [25, 32],
            [25, 72],
            [60, 50],
            [84, 50],
          ]
        : [
            [28, 28],
            [76, 32],
            [70, 76],
            [24, 70],
          ];
  return (
    <svg
      className="profile-art"
      viewBox="0 0 100 100"
      fill="none"
      aria-hidden="true"
    >
      <circle
        cx="50"
        cy="50"
        r="37"
        stroke="currentColor"
        strokeOpacity=".13"
      />
      {nodes.map(([x, y], i) => (
        <g key={i}>
          <path
            d={`M50 50 L${x} ${y}`}
            stroke="currentColor"
            strokeOpacity=".35"
          />
          <circle
            cx={x}
            cy={y}
            r="5"
            fill="currentColor"
            fillOpacity=".2"
            stroke="currentColor"
            strokeOpacity=".5"
          />
        </g>
      ))}
      <circle cx="50" cy="50" r="9" fill="currentColor" />
      <circle cx="50" cy="50" r="3" fill="var(--surface)" />
    </svg>
  );
}
export function NewWorld({
  onCreate,
}: {
  onCreate: (profile: Profile) => void;
}) {
  const [name, setName] = useState("");
  const [objective, setObjective] = useState("");
  const [unit, setUnit] = useState("units");
  const [baseline, setBaseline] = useState("20");
  const [target, setTarget] = useState("50");
  const [error, setError] = useState("");
  return (
    <form
      className="z-fields"
      onSubmit={(event) => {
        event.preventDefault();
        try {
          if (name.trim() && objective.trim())
            onCreate(
              makeProfile({
                name: name.trim(),
                objective: objective.trim(),
                unit: unit.trim(),
                baseline: Number(baseline),
                target: Number(target),
              }),
            );
        } catch (error) {
          setError(
            error instanceof Error ? error.message : "Check the model inputs.",
          );
        }
      }}
    >
      <label>
        Name
        <input
          required
          maxLength={80}
          value={name}
          onChange={(event) => setName(event.target.value)}
          placeholder="A project, company, or commons"
        />
      </label>
      <label>
        Objective
        <input
          required
          maxLength={160}
          value={objective}
          onChange={(event) => setObjective(event.target.value)}
          placeholder="What should become possible?"
        />
      </label>
      <details className="custom-model">
        <summary>Model</summary>
        <div className="z-fields">
          <label>
            Unit
            <input
              required
              maxLength={40}
              value={unit}
              onChange={(event) => setUnit(event.target.value)}
            />
          </label>
          <div className="model-pair">
            <label>
              Baseline
              <input
                required
                type="number"
                min={-1e9}
                max={1e9}
                step="any"
                value={baseline}
                onChange={(event) => setBaseline(event.target.value)}
              />
            </label>
            <label>
              Target
              <input
                required
                type="number"
                min={-1e9}
                max={1e9}
                step="any"
                value={target}
                onChange={(event) => setTarget(event.target.value)}
              />
            </label>
          </div>
        </div>
      </details>
      <small className="muted">Editable synthetic starting model.</small>
      {error && (
        <p className="negative" role="alert">
          {error}
        </p>
      )}
      <button
        className="primary"
        type="submit"
        disabled={!name.trim() || !objective.trim()}
      >
        Create <ArrowRight size={16} />
      </button>
    </form>
  );
}
export function Onboarding({
  onStart,
  onImport,
  profiles = PROFILES,
  existingIds = [],
}: {
  onStart: (profile: Profile, guided: boolean) => void;
  onImport: () => void;
  profiles?: readonly Profile[];
  existingIds?: string[];
}) {
  const [selected, setSelected] = useState(profiles[0].id);
  const [custom, setCustom] = useState(false);
  const profile = profiles.find((item) => item.id === selected) ?? profiles[0];
  return (
    <main className="z-onboarding" id="main-content">
      <div className="z-onboard-logo">
        <Mark />
        <span>Zenith</span>
      </div>
      <div className="onboard-heading">
        <h1>Choose your world.</h1>
        <p>Start fresh, or inspect a worked case.</p>
      </div>
      <div className="profile-grid" role="group" aria-label="Example worlds">
        {profiles.map((item) => (
          <button
            key={item.id}
            className={`profile-card ${selected === item.id && !custom ? "selected" : ""}`}
            aria-pressed={selected === item.id && !custom}
            onClick={() => {
              setSelected(item.id);
              setCustom(false);
            }}
          >
            <ProfileArt kind={item.icon} />
            <div className="profile-title">
              <WorldIcon kind={item.icon} />
              <h2>{item.name}</h2>
              {selected === item.id && !custom && <Check size={16} />}
            </div>
            <p>{item.subtitle}</p>
            <div className="profile-details">
              <span>{item.scopes.length} scopes</span>
              <span>{item.horizonMonths} months</span>
            </div>
          </button>
        ))}
      </div>
      {custom ? (
        <div className="onboard-custom">
          <NewWorld onCreate={(item) => onStart(item, true)} />
        </div>
      ) : (
        <div className="onboard-question">
          <p>{profile.question}</p>
        </div>
      )}
      <div className="onboard-actions">
        <IconButton icon={Upload} label="Import" onClick={onImport} />
        <button className="text-button" onClick={() => setCustom(!custom)}>
          <Plus size={16} />
          {custom ? "Examples" : "New world"}
        </button>
        {!custom && (
          <>
            {!existingIds.includes(profile.id) && (
              <button
                className="text-button"
                onClick={() => onStart(profile, false)}
              >
                Worked case
              </button>
            )}
            <button className="primary" onClick={() => onStart(profile, true)}>
              {existingIds.includes(profile.id) ? "Open" : "Begin"}{" "}
              <ArrowRight size={16} />
            </button>
          </>
        )}
      </div>
      <small className="onboard-note">Synthetic cases · local simulation</small>
    </main>
  );
}
