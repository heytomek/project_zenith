import { mkdir } from "node:fs/promises";
import { resolve } from "node:path";
import { PROFILES } from "../apps/web/lib/coordination/profiles";
import { workedExample } from "../apps/web/lib/coordination/examples";
import { exportLibrary } from "../apps/web/lib/coordination/storage";

// Generated portable examples. profiles.ts remains the bundled source of truth.
const destination = resolve(import.meta.dir, "../examples/coordination");
await mkdir(destination, { recursive: true });
for (const profile of PROFILES)
  await Bun.write(
    resolve(destination, `${profile.id}.profile.json`),
    `${JSON.stringify(profile, null, 2)}\n`,
  );
await Bun.write(
  resolve(destination, "worked-worlds.json"),
  await exportLibrary({
    version: 2,
    activeId: PROFILES[0].id,
    onboardingDone: true,
    workspaces: PROFILES.map(workedExample),
  }),
);
console.log(
  `Exported ${PROFILES.length} profiles and replayable worked histories to ${destination}`,
);
