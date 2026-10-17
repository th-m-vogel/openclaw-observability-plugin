# OpenClaw Observability

[![License: Apache 2.0](https://img.shields.io/badge/License-Apache_2.0-blue.svg)](https://opensource.org/licenses/Apache-2.0)

An OpenTelemetry plugin for [OpenClaw](https://github.com/openclaw/openclaw) AI agents. It hooks into OpenClaw's typed plugin lifecycle (`register()`/`start()`/`stop()`) and diagnostic-event stream to emit connected traces, token/cost metrics, and structured logs for a gateway's full agent lifecycle — sessions, agent turns, model calls, tool calls, sub-agents, and cron jobs — to any OTLP-compatible backend.

📖 **[Full Documentation](./docs/index.md)** — setup guide, configuration reference, backend examples, architecture.

## This fork

`th-m-vogel/openclaw-observability-plugin` is a maintained fork of [`henrikrexed/openclaw-observability-plugin`](https://github.com/henrikrexed/openclaw-observability-plugin). Upstream has had no maintainer activity since 2026-07-20, so this fork is the canonical, actively maintained version going forward rather than something waiting on upstream merges.

It's a **drop-in replacement** for the original plugin — the original single shared `endpoint`/`headers`/`protocol` config still works exactly as before (this fork's own additions, like per-signal endpoint overrides, are opt-in extras, not a breaking change). Point `plugins.load.paths` at this fork's clone instead of upstream's and your existing config keeps working unmodified.

See [`CHANGELOG.md`](CHANGELOG.md) for the full release history.

## Support matrix

| Fork release | Minimum OpenClaw | Last verified against | Status |
|---|---|---|---|
| `0.11.0` | `2026.9.8` | `2026.10.1` | **Active (this fork)** — per-call token metrics, `#166289` duplicate-dispatch fix |
| `0.10.0` | `2026.4.21` | `2026.9.8` | Superseded by `0.11.0` |
| `0.9.2` | `2026.4.21` | `2026.9.7` | Superseded by `0.10.0` |

All releases live on `main`; there is no legacy-version branch split to track. Upgrade by pulling the latest tag — see [Quick start](#quick-start) below.

## What's new

Only this fork's own work is listed here — see [`CHANGELOG.md`](CHANGELOG.md) for full detail on every entry, including upstream's pre-fork history.

**`0.11.0`:**
- Real per-call token metrics (`openclaw.llm.requests`/`.duration`/`.tokens.*`), from a real per-model-call diagnostic event instead of once per agent turn.
- Root-caused and fixed [`openclaw/openclaw#166289`](https://github.com/openclaw/openclaw/issues/166289) — a core mechanism (a second, independent plugin module instance loaded during an internal read-only pass) could duplicate `model.usage` dispatch, double-counting cost/tokens. Replaced an argv-based CLI-command guess with an authoritative check on `api.registrationMode`, closing both this and a related one-shot-CLI-hang issue in the same change.
- `openclaw plugins install` and every one-shot CLI invocation now skip long-lived telemetry init correctly, confirmed live against a real host across every registration mode OpenClaw reports.

**`0.10.0`:**
- Native per-signal OTLP endpoints (`signalEndpoints`/`signalHeaders`) — traces, metrics, and logs can ship to different ingestion URLs/credentials in one config block.
- Fixed a duplicate cost/token-counting bug on repeated `register()` calls without an intervening `stop()`.

**`0.9.2`:**
- Fixed a log-timestamp double-conversion bug that silently dropped every exported log record on timestamp-validating backends.
- Fixed `openclaw completion`/`doctor`/`update` hanging indefinitely instead of exiting.

## What it captures

Connected traces for a full agent turn, every span GenAI-semconv-labeled:

```
openclaw.request (root span)
├── openclaw.session (long-lived, spans many turns)
├── openclaw.agent.turn
│   ├── chat {model} (model call span)
│   ├── execute_tool Read / Write / Bash (tool spans)
│   └── ...
└── openclaw.message.sent
```

- **Metrics** — real per-call token/request/duration counters, turn-level cost (`openclaw.llm.cost.usd`), tool-call counts and duration, session/queue/webhook/cron gauges and histograms.
- **Traces** — the full lifecycle above, plus sub-agent spawn/duration spans and security-detection events on spans (prompt injection, dangerous commands, sensitive file access).
- **Logs** — this plugin's own gateway log lines, bridged to OTLP with severity and structured attributes.

This plugin is separate from OpenClaw core's own built-in `diagnostics-otel` plugin, which covers gateway-level health (queues, webhooks) rather than per-request tracing. **Don't run both at once** — both initialize the OTel SDK and can conflict. See [Limitations](./docs/limitations.md) for the full reasoning and a workaround for an npm-install issue that affects the official plugin specifically.

## Quick start

**Prerequisites:** an OTLP-compatible endpoint to send telemetry to (self-hosted collector, or a managed backend — Dynatrace, Grafana Cloud, IONOS Cloud Observability, etc.), and whatever credential that endpoint requires (API key, bearer token, or none for a local collector with no auth). See [Backends](./docs/backends/index.md) for setup notes on specific providers.

1. Clone, pinned to a release tag, into your OpenClaw install's `plugins/` directory, and build:
   ```bash
   git clone --branch v0.11.0 https://github.com/th-m-vogel/openclaw-observability-plugin.git ~/.openclaw/plugins/otel-observability
   cd ~/.openclaw/plugins/otel-observability
   npm ci && npm run build
   ```

2. Point `openclaw.json` at the clone and enable it. This example enables metrics only (traces and logs off) against one shared OTLP endpoint and header — a reasonable minimal starting point, since metrics alone already cover token/cost/latency dashboards without the extra volume of full tracing. Flip `traces`/`logs` to `true` once you want the full picture, and see [Configuration](./docs/configuration.md#per-signal-endpoints-multi-backend-fan-out) if you need to route signals to different URLs/credentials instead:
   ```json
   {
     "plugins": {
       "load": { "paths": ["~/.openclaw/plugins/otel-observability"] },
       "entries": {
         "otel-observability": {
           "enabled": true,
           "hooks": { "allowConversationAccess": true },
           "config": {
             "endpoint": "https://otlp-collector.example.com",
             "headers": { "Authorization": "Bearer ${OTEL_API_KEY}" },
             "serviceName": "openclaw-gateway",
             "traces": false,
             "metrics": true,
             "logs": false,
             "captureContent": false
           }
         }
       }
     }
   }
   ```
   `endpoint` is the OTLP base URL only, for the default HTTP protocol shown here — the plugin appends the per-signal path (`/v1/traces`, `/v1/metrics`, `/v1/logs`) itself; don't include it yourself. (gRPC and any `signalEndpoints` override are used verbatim with no suffix appended — see [Configuration](./docs/configuration.md#endpoint-configuration).) The exact header name/scheme your backend expects varies (`Authorization: Bearer ...`, a plain API-key header, etc.) — check [Backends](./docs/backends/index.md) for your specific provider.

   `hooks.allowConversationAccess: true` is required on OpenClaw ≥ 2026.4.23, for every install, and defaults to **unset/false**. It grants this plugin's non-bundled hooks permission to receive conversation-scoped typed-hook events at all (`before_model_resolve`, `llm_input`/`llm_output`, `agent_end`, and the rest) — without it, those registrations are silently dropped and no `openclaw.agent.turn`/model-call spans or per-call metrics ever reach your backend, with no error logged. This is **not** the same thing as exposing conversation content: `allowConversationAccess` only lets the plugin see that these events fired and their structural metadata (model, token counts, timing). Actual prompt/completion text is a separate, privacy-sensitive opt-in — the `captureContent` option (default `false`) — and stays off unless you explicitly turn it on. See [captureContent](./docs/configuration.md#capturecontent-gateway-launch-setting) before enabling it: once on, conversation content is exported to whatever backend/logging system this config points at.

3. Clear the jiti cache and restart:
   ```bash
   rm -rf /tmp/jiti
   systemctl --user restart openclaw-gateway
   ```

4. Confirm it's live:
   ```bash
   journalctl --user -u openclaw-gateway -f | grep -E '\[otel\]'
   ```
   Send a message, then check your backend for an `openclaw.request` span with at least one `openclaw.agent.turn` child.

Full walkthrough, every config option, and backend-specific examples (Dynatrace, Grafana Cloud, generic OTLP collector): [Getting Started](./docs/getting-started.md), [Configuration](./docs/configuration.md), [Backends](./docs/backends/index.md).

## Known limitations

The one worth knowing before you start debugging a dashboard: **`rate()`/`increase()` panels can show zero cost/tokens for a session even though the data arrived correctly.** `openclaw.llm.cost.usd` and the token-breakdown metrics carry a per-conversation ID label, so a conversation whose calls all land in a single sample — a one-shot isolated cron/background session, or any conversation whose calls complete within one 30s export tick — produces only one sample for that series, with nothing earlier to diff against. An instant query finds the value fine; a windowed `rate()`/`increase()`, even grouped down to just `model`, silently contributes `0` for that series. This looks identical to "no data," but it isn't — see [Limitations](./docs/limitations.md) for the mechanism and the query workaround.

Separately: **cost and token-breakdown reporting depend entirely on an OpenClaw core event (`model.usage`) that doesn't fire for every session type** — confirmed gaps include per-channel/topic model overrides, internal/background agent-turn sessions, and multi-call tool-use continuation steps (each tracked upstream as its own issue). Real per-call *token counts* still arrive correctly through a separate, more reliable event in all of these cases — only cost and the token-type breakdown go missing. There's no plugin-side fix for an event core never emits.

Also: custom/self-hosted OpenAI-compatible providers always report `cost: undefined` (structural — no cost field exists in that API spec, by design), and zero-code auto-instrumentation isn't possible for this ecosystem (ESM/CJS isolation breaks it) — all telemetry comes from typed hooks and diagnostic events instead.

Full list, including backend-specific quirks (Loki service-name labels, provider-name inconsistency) and the reasoning behind each: [Limitations](./docs/limitations.md).

## License

Apache License 2.0 — see [LICENSE](./LICENSE) for the full text.
