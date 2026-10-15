# Zenith web

The active page mounts `CoordinationApp`: a local strategic coordination workspace for humans and simulated specialist agents. See the [root README](../../README.md), [running contract](../../docs/mvp.md) and [architecture](../../docs/system_architecture.md).

From the repository root:

```sh
bun run dev:web
```

For a stable production preview:

```sh
bun run build:web
bun run start:web --hostname 127.0.0.1 --port 3000
```

The only application route is `/`. Its views are `#situation`, `#strategies`, `#mandates` and `#ledger`. Unknown legacy hashes fall back to Situation. Agent avatars open scoped authority details.

Onboarding offers fresh guided setup, a worked synthetic case, a custom world or file import. Harbor, Meridian and Open Atlas use the same coordination contracts and engine. Worked cases are populated through the same commands exposed in the interface.

all computation and persistence stay in the browser. the local key is `zenith.coordination.v2`; export offers the current world or complete library in a checksummed envelope. a raw validated `Profile` import adds a fresh world. Archive downloads valid version-two libraries as reopenable exports and preserves version-one or unreadable records verbatim. the Python API is disconnected; the older Alder interface is preserved in `docs/archive/2026-10-04/alder-interface`, with its calculator and tests retained separately.

run `bun run examples:coordination` from the repository root to regenerate the editable profiles and worked library in [`examples/coordination`](../../examples/coordination/README.md).

No live model provider, agent runtime, authentication, external connector or server persistence is implemented.
