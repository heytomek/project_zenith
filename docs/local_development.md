# Local development

The active app needs Bun and the Next.js web application. It does not need Python, migrations, Docker, Redis or a database seed.

```sh
bun install --frozen-lockfile
bun run dev:web
```

For a production preview:

```sh
bun run build:web
bun run start:web --hostname 127.0.0.1 --port 3000
```

Open `http://127.0.0.1:3000`. Keep the same origin when reopening local state: `localhost` and `127.0.0.1` have separate browser storage. Use the validated library export/import to move between origins or browsers.

## Active files

| Path | Responsibility |
| --- | --- |
| `apps/web/lib/coordination/types.ts` | Shared primitive, workspace and library contracts |
| `apps/web/lib/coordination/core.ts` | Validation, evaluation, decisions, mandates and replay |
| `apps/web/lib/coordination/profiles.ts` | Three worked domains and custom seed constructor |
| `apps/web/lib/coordination/examples.ts` | Populated synthetic histories using kernel commands |
| `apps/web/lib/coordination/storage.ts` | Library validation and checksummed file envelope |
| `apps/web/components/coordination` | Onboarding, utility views, inspections and local state |
| `apps/web/app/globals.css` | Responsive materials, hierarchy and motion |

Fresh **Begin** uses `createWorkspace(profile)`; **Worked case** uses `workedExample(profile)`. **New instance** clones the entire profile with a new identity and fresh initial claims, retaining the earlier workspace.

The browser key is `zenith.coordination.v2`. Replacement imports preserve `zenith.coordination.v2.previous`. Archive exposes earlier `zenith.commons.v1` and Alder raw records without converting or mutating them. Do not clear storage to troubleshoot a saved workspace before exporting it.

The Python prototype has [historical setup instructions](archive/2026-09-12/local_development.md). It is disconnected from the current app. See [testing](testing_guide.md) and [the running contract](mvp.md).
