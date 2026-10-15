# Portable examples

Generated from `apps/web/lib/coordination/profiles.ts` with `bun run examples:coordination`.

Import `worked-worlds.json` to inspect three complete decision-to-outcome histories. The current library is backed up before replacement. Import a `*.profile.json` to add a fresh world; change its `id` first if that world already exists. These files contain synthetic data.

The raw profiles expose the complete scope, objective, evidence, capability, intervention, strategy and agent contract. They can be edited and imported; invalid references, units, dependencies or protections are rejected. Checksummed worked histories are reproducible snapshots, not alternative source definitions.
