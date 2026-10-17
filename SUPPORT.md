# Support Policy

There is a single actively maintained line: `main`, released as `0.9.x` → `0.10.0` → `0.11.0` and onward. No legacy-version branch is tracked separately — upgrade by pulling the latest tag.

## Minimum OpenClaw version

The plugin's overall floor is tracked in `openclaw.plugin.json` (`minOpenClawVersion`) and in the [Support matrix](README.md#support-matrix) in the README, which lists the minimum and last-verified OpenClaw version for each fork release.

Individual features can carry their own, higher floor on top of that baseline: as of `0.11.0`, real per-call `openclaw.llm.tokens.*` requires **OpenClaw `>= 2026.9.8`** — older installs still load the plugin, just without that metric (see `docs/limitations.md`).

## Reporting issues

Open a GitHub issue with:

- OpenClaw version (`openclaw --version`).
- Plugin version (from `openclaw.plugin.json` → `version`).
- Minimal reproduction and the observed vs. expected behavior.

## Related

- [`CONTRIBUTING.md`](CONTRIBUTING.md) — development workflow.
- [`CHANGELOG.md`](CHANGELOG.md) — per-release compatibility notes.
