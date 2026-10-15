import { describe, expect, test } from "bun:test";
import { acceptAll, authorize, createWorkspace, revokeMandate, stepAgents, updateClaim } from "../../apps/web/lib/coordination/core";
import { PROFILES, makeProfile } from "../../apps/web/lib/coordination/profiles";
import { exportLibrary, importLibrary, validateLibrary } from "../../apps/web/lib/coordination/storage";
import type { Library, Workspace } from "../../apps/web/lib/coordination/types";

const library = (worlds: Workspace[]): Library => ({ version: 2, activeId: worlds[0]?.profile.id ?? null, onboardingDone: true, workspaces: worlds });
function authorized(index: number): Workspace {
  const world = createWorkspace(PROFILES[index]);
  return acceptAll(authorize(world, world.profile.strategies[0].id, "Preserve protections and retain uncertainty while advancing this synthetic portfolio."));
}
function canonical(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonical).join(",")}]`;
  if (value && typeof value === "object") return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${canonical((value as Record<string, unknown>)[key])}`).join(",")}}`;
  return JSON.stringify(value);
}
async function envelope(payload: unknown): Promise<string> {
  const bytes = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(canonical(payload)));
  return JSON.stringify({ format: "zenith-coordination", version: 2, checksum: Array.from(new Uint8Array(bytes), (n) => n.toString(16).padStart(2, "0")).join(""), payload });
}
function reverseKeys(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(reverseKeys);
  if (value && typeof value === "object") return Object.fromEntries(Object.entries(value).reverse().map(([key, item]) => [key, reverseKeys(item)]));
  return value;
}

describe("portable coordination library", () => {
  test("running, completed and stopping worlds roundtrip with frozen history and unconsumed reservations", async () => {
    let running = stepAgents(authorized(0));
    const shock = running.profile.shocks.find((s) => running.profile.capabilities.some((c) => c.claimId === s.claimId));
    if (shock) running = updateClaim(running, shock.claimId, shock.value);
    let complete = authorized(1);
    for (let n = 0; n < 40 && complete.mandates.some((m) => m.status !== "completed"); n++) complete = stepAgents(complete);
    let stopping = stepAgents(authorized(2));
    const mandate = stopping.mandates.find((m) => ["accepted", "running", "blocked"].includes(m.status))!;
    stopping = revokeMandate(stopping, mandate.id);
    expect(running.mandates.some((m) => m.status === "running")).toBe(true);
    expect(complete.mandates.every((m) => m.status === "completed")).toBe(true);
    expect(stopping.mandates.some((m) => m.status === "stopping")).toBe(true);
    const original = library([running, complete, stopping]);
    const serialized = await exportLibrary(original);
    const restored = await importLibrary(serialized);
    expect(restored).toEqual(original);
    expect(await exportLibrary(restored)).toBe(serialized);
    expect(restored.workspaces[2].mandates.find((m) => m.id === mandate.id)?.resources).toEqual(mandate.resources);
    const acknowledged = stepAgents(restored.workspaces[2]);
    expect(acknowledged.mandates.find((m) => m.id === mandate.id)?.status).toBe("revoked");
  });

  test("checksum is independent of whitespace and object key order", async () => {
    const original = library([createWorkspace(PROFILES[0])]);
    const exported = JSON.parse(await exportLibrary(original));
    expect(await importLibrary(JSON.stringify(reverseKeys(exported), null, 4))).toEqual(original);
    const empty: Library = { version: 2, activeId: null, onboardingDone: false, workspaces: [] };
    expect(await importLibrary(await exportLibrary(empty))).toEqual(empty);
  });

  test("altered payload and malformed checksum fail before a world is applied", async () => {
    const file = JSON.parse(await exportLibrary(library([createWorkspace(PROFILES[0])])));
    file.payload.workspaces[0].profile.name = "Changed world";
    await expect(importLibrary(JSON.stringify(file))).rejects.toThrow("checksum");
    file.checksum = "not-a-sha256";
    await expect(importLibrary(JSON.stringify(file))).rejects.toThrow();
  });

  test("even a recomputed checksum cannot admit invalid inner schema or fabricated execution", async () => {
    const world = stepAgents(authorized(0));
    const fabricated = library([world]); fabricated.workspaces[0].mandates[0].resources[0].consumed += 10;
    await expect(importLibrary(await envelope(fabricated))).rejects.toThrow();
    const missingProtection = library([createWorkspace(PROFILES[1])]);
    missingProtection.workspaces[0].profile.objectives.forEach((objective) => { delete objective.protection; });
    await expect(importLibrary(await envelope(missingProtection))).rejects.toThrow("protected condition");
    const unknownVersion = { ...library([]), version: 1 };
    await expect(importLibrary(await envelope(unknownVersion))).rejects.toThrow("Unsupported");
  });

  test("library validates active identity, duplicate worlds, bounds and exact shape", async () => {
    const world = createWorkspace(PROFILES[0]);
    expect(() => validateLibrary(library([world, world]))).toThrow("Duplicate");
    expect(() => validateLibrary({ ...library([world]), activeId: "absent" })).toThrow("active world");
    expect(() => validateLibrary({ ...library([]), onboardingDone: "yes" })).toThrow();
    expect(() => validateLibrary({ ...library([]), workspaces: Array(25).fill(world) })).toThrow();
    expect(() => validateLibrary({ ...library([world]), externalAuthority: "unvalidated" })).toThrow();
    const file = JSON.parse(await exportLibrary(library([world]))); file.externalAuthority = "unvalidated";
    await expect(importLibrary(JSON.stringify(file))).rejects.toThrow();
    await expect(importLibrary("null")).rejects.toThrow();
    await expect(importLibrary("[]")).rejects.toThrow();
    await expect(importLibrary("not json")).rejects.toThrow();
  });

  test("the 2 MB boundary counts UTF-8 bytes and applies to exports as well as imports", async () => {
    await expect(importLibrary(`"${"é".repeat(1_000_000)}"`)).rejects.toThrow("2 MB");
    const worlds = Array.from({ length: 24 }, (_, index) => {
      const profile = makeProfile({ name: `World ${index}`, objective: "Preserve capacity", id: `world-${index}` });
      profile.principles = Array(30).fill("p".repeat(4000));
      return createWorkspace(profile);
    });
    expect(validateLibrary(library(worlds)).workspaces).toHaveLength(24);
    await expect(exportLibrary(library(worlds))).rejects.toThrow("2 MB");
  });
});
