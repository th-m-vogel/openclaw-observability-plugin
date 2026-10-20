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

**Don't run both at once** — both initialize the OTel SDK and can conflict (global tracer/meter provider state, see [Limitations](./limitations.md)). Pick one.

## Quick Start

### Official Plugin (5 minutes)

Add to `~/.openclaw/openclaw.json`:

```json
{
  "diagnostics": {
    "enabled": true,
    "otel": {
      "enabled": true,
      "endpoint": "http://localhost:4318",
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

### Custom Plugin (Additional)

1. Clone the repo
2. Add to `plugins.load.paths`
3. Configure in `plugins.entries.otel-observability`
4. Clear jiti cache and restart

See [Getting Started](getting-started.md) for detailed instructions.

## What Gets Captured

### Official Plugin (`diagnostics-otel`, built into the Gateway)

| Signal | Data |
|--------|------|
| **Metrics** | `openclaw.tokens`, `openclaw.cost.usd`, `openclaw.run.duration_ms`, `openclaw.webhook.*`, `openclaw.message.*`, `openclaw.queue.*`, `openclaw.session.*` (all emitted by `diagnostics-otel`, not by this plugin) — full catalog: [OpenClaw core: Model calls and exported metrics](https://docs.openclaw.ai/gateway/opentelemetry/model-calls-and-metrics) |
| **Traces** | Model usage, webhook processing, message processing, stuck sessions — full catalog: [OpenClaw core: Exported spans and diagnostic events](https://docs.openclaw.ai/gateway/opentelemetry/spans-and-events) |
| **Logs** | All Gateway logs with severity, subsystem, code location |

These two pages are also the authoritative reference for what fields actually exist on a diagnostic event — useful when building against or comparing to this plugin's own telemetry (see [Limitations](limitations.md)).

### Custom Plugin (This Repo)

| Signal | Data |
|--------|------|
| **Traces** | `openclaw.request` → `openclaw.agent.turn` → `tool.*` (connected hierarchy) |
| **Metrics** | `openclaw.llm.tokens.{total,prompt,completion}`, `openclaw.llm.cost.usd`, `openclaw.tool.calls`, `openclaw.tool.loop`, `openclaw.session.resets`, `openclaw.skill.used`, `openclaw.model.failover`, plus the OTel stable `gen_ai.*` set |

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
│   ├── tool.Read (child)
│   ├── tool.exec (child)
│   └── tool.Write (child)
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
| Token Spike Anomaly | Warning | Unusual usage patterns |

Combined with Tetragon kernel monitoring, this provides defense-in-depth security observability.

## Source

- Official plugin: Built into OpenClaw v2026.2.0+
- Custom plugin: [github.com/henrikrexed/openclaw-observability-plugin](https://github.com/henrikrexed/openclaw-observability-plugin)
