# Support Policy

There is a single actively maintained line: `main`. Releases are cut from it as semver tags (`v0.9.2`, `v0.10.0`, `v0.11.0`, and onward) — this fork's releases continue the upstream project's `0.x` numbering rather than restarting it. No legacy-version branch is tracked separately — upgrade by pulling the latest tag.

## Minimum OpenClaw version

The plugin's overall floor is tracked in `openclaw.plugin.json` (`minOpenClawVersion`) and in the [Support matrix](README.md#support-matrix) in the README, which lists the minimum and last-verified OpenClaw version for each fork release.

The current floor is **OpenClaw `2026.9.9`** — the release that fixed the core undefined-rejection crash ([openclaw/openclaw#162031](https://github.com/openclaw/openclaw/issues/162031)) this plugin used to work around, so the plugin no longer carries that workaround. OpenClaw doesn't enforce a plugin's declared floor itself: on an older host the plugin still loads, but logs a one-time startup warning.

Individual features can also have their own version requirement. When such a requirement is higher than the floor, it's documented here and the plugin keeps loading without that feature on older hosts. Right now none is: the per-call `openclaw.llm.tokens.*` metrics need OpenClaw `2026.9.8` or newer (added in `0.11.0`), which the `2026.9.9` floor already covers. The plugin still logs a separate warning if it detects a host older than `2026.9.8`, since those metrics would then be missing.

## Reporting issues

Open a GitHub issue with:

- OpenClaw version (`openclaw --version`).
- Plugin version (from `openclaw.plugin.json` → `version`).
- Minimal reproduction and the observed vs. expected behavior.

## Related

- [`CONTRIBUTING.md`](CONTRIBUTING.md) — development workflow.
- [`CHANGELOG.md`](CHANGELOG.md) — per-release compatibility notes.
