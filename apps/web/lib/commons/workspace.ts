import { z } from "zod";
import {
  BASELINE,
  MODEL_VERSION,
  PATHWAYS,
  canonical,
  evaluate,
} from "./model";

const text = z.string().trim().min(1).max(3000);
const id = z.string().min(1).max(100);
const date = z.iso.date();
const assumptions = z.strictObject({
  voluntaryHours: z.number().min(0).max(80),
  leadMonths: z.number().int().min(1).max(12),
  reductionPercent: z.number().min(0).max(80),
});
export const pathwaySchema = z.strictObject({
  id,
  title: text.max(80),
  kind: z.enum(["current", "coordinate", "prevent"]),
  assumptions,
});
const target = z.enum([
  "baseline",
  "capacity",
  "voluntaryHours",
  "leadMonths",
  "reductionPercent",
  "materials",
]);
const challengeSchema = z.strictObject({
  id,
  pathway: pathwaySchema,
  target,
  text,
  createdAt: z.iso.datetime(),
});
export const decisionFieldsSchema = z.strictObject({
  action: text,
  rationale: text,
  steward: text.max(200),
  authority: text,
  consent: text,
  reviewDate: date,
  success: text,
  reversal: text,
});
const decisionSchema = decisionFieldsSchema.extend({
  id,
  parentId: id.nullable(),
  createdAt: z.iso.datetime(),
  pathway: pathwaySchema,
  challenges: z.array(challengeSchema).max(200),
});
const observationSchema = z.strictObject({
  id,
  decisionId: id,
  createdAt: z.iso.datetime(),
  month: z.number().int().min(1).max(12),
  remaining: z.number().min(0).max(10000),
  note: text,
});
export const workspaceSchema = z
  .strictObject({
    version: z.literal(1),
    branches: z.array(pathwaySchema).max(100),
    challenges: z.array(challengeSchema).max(200),
    decisions: z.array(decisionSchema).max(200),
    observations: z.array(observationSchema).max(500),
  })
  .superRefine((w, ctx) => {
    const allIds = [
      ...PATHWAYS.map((p) => p.id),
      ...w.branches.map((p) => p.id),
      ...w.challenges.map((c) => c.id),
      ...w.decisions.map((d) => d.id),
      ...w.observations.map((o) => o.id),
    ];
    if (new Set(allIds).size !== allIds.length)
      ctx.addIssue({
        code: "custom",
        message: "Duplicate record identifiers.",
      });
    const seenDecisions = new Set<string>();
    for (const d of w.decisions) {
      if (d.parentId && !seenDecisions.has(d.parentId))
        ctx.addIssue({
          code: "custom",
          message: "A revision must refer to an earlier decision.",
        });
      seenDecisions.add(d.id);
    }
    if (w.observations.some((o) => !seenDecisions.has(o.decisionId)))
      ctx.addIssue({
        code: "custom",
        message: "Observation has no matching decision.",
      });
  });
export type Workspace = z.infer<typeof workspaceSchema>;
export type Challenge = Workspace["challenges"][number];
export type Decision = Workspace["decisions"][number];
export type DecisionFields = z.infer<typeof decisionFieldsSchema>;
export const EMPTY_WORKSPACE: Workspace = {
  version: 1,
  branches: [],
  challenges: [],
  decisions: [],
  observations: [],
};
export const STORAGE_KEY = "zenith.commons.v1";
export function parseWorkspace(raw: string): Workspace {
  if (raw.length > 2_000_000)
    throw new Error("This file is too large. Maximum size is 2 MB.");
  return workspaceSchema.parse(JSON.parse(raw));
}
async function digest(value: unknown): Promise<string> {
  const bytes = new TextEncoder().encode(canonical(value));
  const hash = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(hash), (b) =>
    b.toString(16).padStart(2, "0"),
  ).join("");
}
function results(workspace: Workspace) {
  return {
    pathways: [...PATHWAYS, ...workspace.branches].map((p) => ({
      expected: evaluate(p),
      pessimistic: evaluate(p, true),
    })),
    decisions: workspace.decisions.map((d) => ({
      id: d.id,
      expected: evaluate(d.pathway),
      pessimistic: evaluate(d.pathway, true),
    })),
  };
}
export async function exportWorkspace(workspace: Workspace): Promise<string> {
  const validated = workspaceSchema.parse(workspace);
  const payload = {
    format: "zenith-commons",
    version: 1,
    modelVersion: MODEL_VERSION,
    baseline: BASELINE,
    workspace: validated,
    results: results(validated),
  };
  const serialized = JSON.stringify(
    { ...payload, sha256: await digest(payload) },
    null,
    2,
  );
  if (serialized.length > 2_000_000)
    throw new Error("This export exceeds the 2 MB portable file limit.");
  return serialized;
}
export async function importWorkspace(raw: string): Promise<Workspace> {
  if (raw.length > 2_000_000)
    throw new Error("This file is too large. Maximum size is 2 MB.");
  const file = z
    .strictObject({
      format: z.literal("zenith-commons"),
      version: z.literal(1),
      modelVersion: z.literal(MODEL_VERSION),
      baseline: z.unknown(),
      workspace: workspaceSchema,
      results: z.unknown(),
      sha256: z.string().regex(/^[a-f0-9]{64}$/),
    })
    .parse(JSON.parse(raw));
  const { sha256, ...payload } = file;
  if (canonical(file.baseline) !== canonical(BASELINE))
    throw new Error(
      "This baseline version is not supported. The file has not been opened.",
    );
  if ((await digest(payload)) !== sha256)
    throw new Error(
      "The file checksum does not match. Its contents may have changed.",
    );
  if (canonical(results(file.workspace)) !== canonical(file.results))
    throw new Error(
      "The exported results cannot be reproduced by this model version.",
    );
  return file.workspace;
}
export function download(
  text: string,
  name: string,
  type = "application/json",
) {
  const url = URL.createObjectURL(new Blob([text], { type }));
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
