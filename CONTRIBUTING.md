# Contributing

Thanks for helping improve the OpenClaw OTel Observability Plugin. This document covers the parts of the workflow that are specific to this repo. General Git/GitHub etiquette applies otherwise.

## Branching model

All day-to-day work targets `main` — there is no legacy-version branch to track or backport to. Releases are cut from `main` and tagged (see [`SUPPORT.md`](SUPPORT.md) for the current OpenClaw version floor).

## Development

- Run `npm test` before opening a PR.
- Keep CHANGELOG entries under `[Unreleased]` until a release is cut; move them to a versioned section at release time.
- If a change affects the plugin↔OpenClaw compatibility surface, update `openclaw.plugin.json` (`minOpenClawVersion`), [`CHANGELOG.md`](CHANGELOG.md), and [`SUPPORT.md`](SUPPORT.md) in the same PR.
