import { validateWorkspace } from "./core";
import type { Library } from "./types";

export const STORAGE_KEY = "zenith.coordination.v2";
export function validateLibrary(input: unknown): Library {
  if (!input || typeof input !== "object")
    throw new Error("Invalid workspace file.");
  const value = input as Record<string, unknown>;
  if (
    Array.isArray(input) ||
    Object.keys(value).some(
      (key) =>
        !["version", "activeId", "onboardingDone", "workspaces"].includes(key),
    )
  )
    throw new Error("Unsupported library fields.");
  if (
    value.version !== 2 ||
    typeof value.onboardingDone !== "boolean" ||
    !Array.isArray(value.workspaces) ||
    value.workspaces.length > 24
  )
    throw new Error("Unsupported workspace format.");
  const workspaces = value.workspaces.map(validateWorkspace);
  if (new Set(workspaces.map((w) => w.profile.id)).size !== workspaces.length)
    throw new Error("Duplicate world identities.");
  if (
    value.activeId !== null &&
    (typeof value.activeId !== "string" ||
      !workspaces.some((w) => w.profile.id === value.activeId))
  )
    throw new Error("The active world is missing.");
  return {
    version: 2,
    activeId: value.activeId as string | null,
    onboardingDone: value.onboardingDone,
    workspaces,
  };
}
function canonical(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonical).join(",")}]`;
  if (value && typeof value === "object")
    return `{${Object.keys(value)
      .sort()
      .map(
        (key) =>
          `${JSON.stringify(key)}:${canonical((value as Record<string, unknown>)[key])}`,
      )
      .join(",")}}`;
  return JSON.stringify(value);
}
async function checksum(value: unknown) {
  const bytes = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(canonical(value)),
  );
  return Array.from(new Uint8Array(bytes), (n) =>
    n.toString(16).padStart(2, "0"),
  ).join("");
}
export async function exportLibrary(library: Library) {
  const payload = validateLibrary(library);
  const text = JSON.stringify(
    {
      format: "zenith-coordination",
      version: 2,
      checksum: await checksum(payload),
      payload,
    },
    null,
    2,
  );
  if (new TextEncoder().encode(text).length > 2_000_000)
    throw new Error(
      "Workspace files must be smaller than 2 MB. Export fewer worlds.",
    );
  return text;
}
export async function importLibrary(text: string): Promise<Library> {
  if (new TextEncoder().encode(text).length > 2_000_000)
    throw new Error("Workspace files must be smaller than 2 MB.");
  const parsed = JSON.parse(text) as unknown;
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed))
    throw new Error("Invalid workspace file.");
  const file = parsed as Record<string, unknown>;
  if (
    Object.keys(file).some(
      (key) => !["format", "version", "checksum", "payload"].includes(key),
    )
  )
    throw new Error("Unsupported export fields.");
  if (
    file.format !== "zenith-coordination" ||
    file.version !== 2 ||
    typeof file.checksum !== "string"
  )
    throw new Error("This is not a Zenith coordination export.");
  if ((await checksum(file.payload)) !== file.checksum)
    throw new Error("The file checksum does not match.");
  return validateLibrary(file.payload);
}
