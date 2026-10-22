# OpenClaw Observability

OpenTelemetry observability for OpenClaw AI agents — traces, metrics, and logs.

## Two Approaches

This documentation covers **two complementary approaches** to OpenClaw observability:

### 1. Official Diagnostics Plugin (Built-in)

OpenClaw v2026.2+ includes built-in OTel support via `diagnostics.otel` config. Best for:

- ✅ Operational metrics (tokens, costs, durations)
- ✅ Gateway health monitoring
- ✅ Log forwarding
- ✅ Simple setup (config only)

### 2. Custom Hook-Based Plugin (This Repo)

A plugin that hooks into the agent lifecycle for deeper tracing. Best for:

- ✅ Connected distributed traces
- ✅ Per-tool-call spans
- ✅ Request lifecycle visibility
- ✅ Debugging agent behavior

**Don't run both at once** — both initialize the OTel SDK and can conflict (global tracer/meter provider state, see [Limitations](./limitations.md)). Pick one; the two quick starts below are alternatives, not steps to combine.

## Quick Start

### Option A: This plugin (otel-observability)

1. Clone the repo at a release tag and build it (`npm ci && npm run build`)
2. Add it to `plugins.load.paths`
3. Configure it in `plugins.entries.otel-observability` (including `hooks.allowConversationAccess: true`)
4. Clear the jiti cache and restart the gateway

See [Getting Started](getting-started.md) for detailed instructions.

### Option B: Official plugin instead (5 minutes, config only)

If you only need what the official plugin covers, add this to `~/.openclaw/openclaw.json` instead — and don't also enable this plugin:

```json
{
  "diagnostics": {
    "enabled": true,
    "otel": {
      "enabled": true,
      "endpoint": "https://otlp-collector.example.com",
      "serviceName": "openclaw-gateway",
      "traces": true,
      "metrics": true,
      "logs": true
    }
  }
}
```

Then restart:

```bash
openclaw gateway restart
```

## What Gets Captured

### Official Plugin (`diagnostics-otel`, built into the Gateway)

| Signal | Data |
|--------|------|
| **Metrics** | `openclaw.tokens`, `openclaw.cost.usd`, `openclaw.run.duration_ms`, `openclaw.webhook.*`, `openclaw.message.*`, `openclaw.queue.*`, `openclaw.session.*` — full catalog: [OpenClaw core: Model calls and exported metrics](https://docs.openclaw.ai/gateway/opentelemetry/model-calls-and-metrics). `openclaw.tokens`/`openclaw.cost.usd`/`openclaw.run.duration_ms` are official-plugin-only; this plugin also emits some metrics under the `openclaw.queue.*`, `openclaw.session.*`, and `openclaw.webhook.*` prefixes, from its own instrumentation (see [Metrics Reference](telemetry/metrics.md)), and same-prefix names from the two plugins aren't necessarily identical in name or attributes. |
| **Traces** | Model usage, webhook processing, message processing, stuck sessions — full catalog: [OpenClaw core: Exported spans and diagnostic events](https://docs.openclaw.ai/gateway/opentelemetry/spans-and-events) |
| **Logs** | All Gateway logs with severity, subsystem, code location |

These two pages are also the authoritative reference for what fields actually exist on a diagnostic event — useful when building against or comparing to this plugin's own telemetry (see [Limitations](limitations.md)).

### Custom Plugin (This Repo)

| Signal | Data |
|--------|------|
| **Traces** | `openclaw.request` → `openclaw.agent.turn` → `chat <model>` / `execute_tool <name>` (connected hierarchy) |
| **Metrics** | `openclaw.llm.requests`/`.duration`/`.tokens.{total,prompt,completion}`, `openclaw.llm.cost.usd`, `openclaw.tool.calls`, `openclaw.tool.loop`, `openclaw.session.resets`, `openclaw.skill.used`, `openclaw.model.failover`, the OTel stable `gen_ai.client.*` histograms, plus session, queue, webhook, cron, sub-agent, gateway-health, and security metrics — full list: [Metrics Reference](telemetry/metrics.md) |
| **Logs** | This plugin's own gateway log lines, exported over OTLP (filterable via `logConfig`) |

## Trace Structure Comparison

**Official Plugin:**
```
openclaw.model.usage (standalone span)
openclaw.webhook.processed (standalone span)
openclaw.message.processed (standalone span)
```

**Custom Plugin:**
```
openclaw.request (root span - full lifecycle)
├── openclaw.agent.turn (child)
│   ├── chat <model> (child, one per real model call)
│   ├── execute_tool Read (child)
│   ├── execute_tool exec (child)
│   └── execute_tool Write (child)
```

## Supported Backends

Works with any OTLP-compatible backend:

- [Dynatrace](backends/dynatrace.md) — Direct OTLP ingest
- [Grafana](backends/grafana.md) — Tempo, Loki, Mimir
- Jaeger — Distributed tracing
- Prometheus + Grafana — Metrics
- Honeycomb, New Relic, Datadog — Cloud platforms
- Local OTel Collector — Self-hosted

## Documentation

- [Getting Started](getting-started.md) — Setup in 5 minutes
- [Glossary](glossary.md) — Acronyms and jargon used throughout these docs
- [Configuration](configuration.md) — All options explained
- [Architecture](architecture.md) — How it works
- [Limitations](limitations.md) — Known constraints
- [Telemetry Reference](telemetry/metrics.md) — Metric/trace details ([tokens](telemetry/tokens.md), [traces](telemetry/traces.md))

### Security Monitoring

- [Security Detection](security/detection.md) — Real-time threat detection
- [Tetragon Integration](security/tetragon.md) — Kernel-level monitoring

The plugin includes **real-time security detection** for:

| Detection | Severity | What It Catches |
|-----------|----------|-----------------|
| Sensitive File Access | Critical | Credentials, SSH keys, .env files |
| Prompt Injection | High | Social engineering attacks on the AI |
| Dangerous Commands | Critical | Data exfiltration, rm -rf, crypto mining |

[Security Detection](security/detection.md) also includes an example Dynatrace query for alerting on token-usage spikes. That one isn't a plugin detection — it's a backend-side alert you configure yourself on top of `openclaw.llm.tokens.total`.

Combined with Tetragon kernel monitoring, this provides defense-in-depth security observability.

## Source

- Official plugin: Built into OpenClaw v2026.2.0+
- Custom plugin: [github.com/th-m-vogel/openclaw-observability-plugin](https://github.com/th-m-vogel/openclaw-observability-plugin) (maintained fork of [henrikrexed/openclaw-observability-plugin](https://github.com/henrikrexed/openclaw-observability-plugin))
