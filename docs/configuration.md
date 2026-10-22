# Configuration

Configure the custom hook-based OTel observability plugin via `~/.openclaw/openclaw.json`.

## Full Configuration Example

```json
{
  "plugins": {
    "load": { "paths": ["~/.openclaw/plugins/otel-observability"] },
    "entries": {
      "otel-observability": {
        "enabled": true,
        "hooks": { "allowConversationAccess": true },
        "config": {
          "endpoint": "http://localhost:4318",
          "protocol": "http",
          "headers": {
            "Authorization": "Api-Token dt0c01.xxx"
          },
          "serviceName": "openclaw-gateway",
          "traces": true,
          "metrics": true,
          "logs": true,
          "sampleRate": 1.0,
          "metricsIntervalMs": 30000
        }
      }
    }
  }
}
```

## Configuration Reference

### `plugins.entries.otel-observability.hooks.allowConversationAccess`

Required, boolean, defaults to **unset/false**. Sits next to `config`, not inside it — a sibling field on the plugin entry (see example above). Required on OpenClaw ≥ 2026.4.23 for a path-loaded (non-bundled) plugin to receive conversation-scoped typed-hook events at all (`before_model_resolve`, `llm_input`/`llm_output`, `agent_end`, and the rest). Without it, those hook registrations are silently dropped — the plugin still logs its "registered" banners, but the handlers never fire, so no `openclaw.agent.turn`/model-call spans or per-call token metrics reach your backend, with no error logged anywhere. This only gates *that these events reach the plugin*, not conversation content — content capture is the separate `captureContent` option below, off by default. See [Getting Started](./getting-started.md#step-3-configure-openclaw) for the full explanation and [Hooks register but never fire](./getting-started.md#hooks-register-but-never-fire) if spans aren't showing up.

### `plugins.entries.otel-observability.config`

Plugin entry configuration.

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `endpoint` | string | `"http://localhost:4318"` | OTLP endpoint URL |
| `protocol` | string | `"http"` | Protocol: `"http"` or `"grpc"` |
| `headers` | object | `{}` | Custom HTTP headers (e.g., auth tokens) |
| `serviceName` | string | `"openclaw-gateway"` | OTel service name attribute |
| `traces` | boolean | `true` | Enable trace export |
| `metrics` | boolean | `true` | Enable metrics export |
| `logs` | boolean | `true` | Enable log forwarding |
| `sampleRate` | number | — | Trace sampling rate, `0.0`–`1.0`. Omit to use the SDK default (`parentbased_always_on`). **Overrides `OTEL_TRACES_SAMPLER` / `OTEL_TRACES_SAMPLER_ARG`** — see [Trace Sampling](#trace-sampling) for precedence rules. |
| `metricsIntervalMs` | number | `30000` | Metrics export interval in milliseconds (values below `1000` are ignored and the default is used) |
| `captureContent` | boolean \| object | `false` | Span content capture policy |
| `resourceAttributes` | object | `{}` | Extra OpenTelemetry resource attributes |
| `logConfig` | object | — | Filtering rules for which log lines the OTLP log pipeline exports — see [Log Filtering (`logConfig`)](#log-filtering-logconfig) |
| `signalEndpoints` | object | — | Per-signal OTLP endpoint overrides (`metrics`/`logs`/`traces`); falls back to `endpoint` |
| `signalHeaders` | object | — | Per-signal header overrides (`metrics`/`logs`/`traces`); replaces `headers` entirely for that signal |
| `collapseEphemeralSessions` | boolean | `false` | Collapse ephemeral per-run session keys (recurring cron jobs, internal-session-effect turns) to a stable job-level identifier **on metric labels only** — see [Metrics Reference](./telemetry/metrics.md#collapseephemeralsessions-metrics-only) for which metrics this affects and [Limitations](./limitations.md) for why it exists |
| `enableByModelMetrics` | boolean | `false` | Add a `_by_model` sibling for every per-conversation LLM metric, with `gen_ai.conversation.id`/`gen_ai.agent.id` dropped so it stays rate-able even for a one-shot session — see [Metrics Reference](./telemetry/metrics.md#_by_model-metrics-opt-in) for the full list and [Limitations](./limitations.md) for the problem it fixes. **Cost note:** this roughly doubles the number of LLM metric data points emitted. If your metrics backend is a managed service billed by data volume or storage, check its pricing before enabling. |

`collapseEphemeralSessions` recognizes two session-key shapes commonly produced by recurring background work: a trailing per-run identifier after `:run:` (e.g. a cron job's per-run session key), and a trailing per-run identifier after an underscore (e.g. an internal-session-effect turn's key). When enabled, metrics for a matching session key are labeled with the stable part only, instead of a fresh identifier every run — so a "tokens by session" dashboard panel shows one row per job instead of one row per run. Traces and logs are unaffected and always carry the full, per-run session key for drill-down. Default `false`: existing dashboards keep working unmodified unless you opt in.

> **`main` below is a placeholder, not a special value.** `agent:main:...` is only an example session key — `main` is whatever agent id your `openclaw.json` happens to use (`agents.entries.<agentId>`), chosen at setup and renameable later. OpenClaw's setup wizard commonly defaults the first agent to the id `main`, which is why examples throughout this project's docs use it, but nothing in this plugin's code — or in the rules below — treats that string as literal or implicit. The matching rules operate purely on the trailing suffix shape; whatever precedes it (agent id, channel, job id) is left untouched regardless of what it says.

**Exact rules implemented** (`src/metric-session-key.ts`), checked in this order, first match wins — everything else in the key before the matched suffix is left untouched:

1. **A trailing `:run:<uuid>` is stripped**, where `<uuid>` is a standard 8-4-4-4-12 hex UUID (case-insensitive). This is the shape a recurring cron job's per-run session key carries.
   ```
   agent:main:cron:ff729cdc-1234-5678-9abc-def012345678:run:28c489cb-aaaa-bbbb-cccc-dddddddddddd
   → agent:main:cron:ff729cdc-1234-5678-9abc-def012345678
   ```
2. **A trailing `_<uuid>` is stripped**, same UUID shape, when it isn't an `internal-session-effects:` session (rule 3 below is more permissive for those).
   ```
   agent:main:internal-session-effects:skill-workshop-review_a737fdf6-1111-2222-3333-444444444444
   → agent:main:internal-session-effects:skill-workshop-review
   ```
3. **For `internal-session-effects:` session keys specifically, two looser variants also collapse**, because real per-run IDs observed live for this session type aren't always standard UUIDs (some have 6 dash-separated hex groups, not 5):
   - A trailing `_<opaque-id>` where `<opaque-id>` is any run of hex digits and dashes (not only a strict UUID):
     ```
     agent:main:internal-session-effects:skill-workshop-review_f54ebfff-d4e5-4969-8c27-87-35c6acc9e5a6bf79
     → agent:main:internal-session-effects:skill-workshop-review
     ```
   - When there's no label before the per-run id at all (nothing to anchor an `_` on), a bare hex-and-dash tail directly after the marker's own trailing `:` collapses to the marker itself:
     ```
     agent:main:internal-session-effects:55d1aba4-57f5-4983-8388-8c9cbf2dd7c9-da3b886ec4001009
     → agent:main:internal-session-effects
     ```

**Deliberately left uncollapsed** — the match is positional (end of string only), never "any UUID anywhere," so a UUID that's a stable identifier rather than a per-run one is untouched:

```
agent:main:channel:ff729cdc-1234-5678-9abc-def012345678        (a bare trailing UUID, no :run:/_ separator — a channel/job ID)
agent:main:cron:ff729cdc-1234-5678-9abc-def012345678:run:latest (:run: present, but "latest" isn't UUID-shaped)
agent:main:telegram:direct:12345                                (no ephemeral suffix of any recognized shape)
```

`enableByModelMetrics` is the feature to reach for when you need a metric that's *reliably* rate-able, regardless of how often a session recurs — see [Limitations](./limitations.md) for the full comparison with `collapseEphemeralSessions` (which can incidentally help the common recurring-cron case too, but isn't guaranteed to) and for the one remaining gap in `enableByModelMetrics` itself. Default `false` — enabling it roughly doubles the number of LLM metric data points this plugin emits, which has a direct cost impact on a metrics backend billed by data volume or storage.

## Endpoint Configuration

### HTTP Protocol (Default)

For OTLP/HTTP endpoints (port 4318):

```json
{
  "plugins": {
    "entries": {
      "otel-observability": {
        "enabled": true,
        "config": {
          "endpoint": "http://localhost:4318",
          "protocol": "http"
        }
      }
    }
  }
}
```

The endpoint auto-appends `/v1/traces`, `/v1/metrics`, `/v1/logs` as needed.

### gRPC Protocol

For OTLP/gRPC endpoints (port 4317):

```json
{
  "plugins": {
    "entries": {
      "otel-observability": {
        "enabled": true,
        "config": {
          "endpoint": "http://localhost:4317",
          "protocol": "grpc"
        }
      }
    }
  }
}
```

**Note**: gRPC support is experimental.

## Per-Signal Endpoints (multi-backend fan-out)

For backends that expose a **separate ingestion URL per signal** instead of one shared OTLP endpoint (e.g. IONOS Cloud Observability: Mimir for metrics, Loki for logs, Tempo for traces), set `signalEndpoints` (and optionally `signalHeaders`) alongside the existing `endpoint`/`headers`. Any signal not listed falls back to the shared `endpoint`/`headers` — this is fully backward compatible with existing configs.

**Per-signal endpoints are used verbatim — no `/v1/<signal>` suffix is appended**, unlike the shared `endpoint` (which still gets suffixed for HTTP). This mirrors the OTel spec's distinction between the base `OTEL_EXPORTER_OTLP_ENDPOINT` (suffixed) and the signal-specific `OTEL_EXPORTER_OTLP_{TRACES,METRICS,LOGS}_ENDPOINT` variables (used as-is). It's also required to express real per-signal backend shapes that don't follow a fixed suffix rule — e.g. IONOS's own three pipelines each want a differently-shaped complete URL:

```json
{
  "plugins": {
    "entries": {
      "otel-observability": {
        "enabled": true,
        "config": {
          "protocol": "http",
          "signalEndpoints": {
            "metrics": "https://<pipeline-id>-metrics.<tenant>.monitoring.<region>.ionos.com/otlp/v1/metrics",
            "traces": "https://<pipeline-id>-traces.<tenant>.tracing.<region>.ionos.com/v1/traces",
            "logs": "https://<pipeline-id>-logs.<tenant>.logging.<region>.ionos.com/<tag>"
          },
          "signalHeaders": {
            "metrics": { "APIKEY": "<metrics-pipeline-key>" },
            "traces": { "APIKEY": "<traces-pipeline-key>" },
            "logs": { "APIKEY": "<logs-pipeline-key>" }
          }
        }
      }
    }
  }
}
```

Note IONOS's traces endpoint has **no** `/otlp` prefix (unlike metrics), and logs ends in the pipeline's own `/<tag>` path rather than `/v1/logs` — since overrides are verbatim, both are expressible even though they don't follow the same shape as each other or as the shared `endpoint`'s suffix rule.

`signalHeaders` **replaces** `headers` entirely for that signal (it is not merged) — set the full header set for that signal's backend, including any shared headers you still need.

If only some signals need their own endpoint, list only those — the rest keep using the shared `endpoint`/`headers`:

```json
{
  "plugins": {
    "entries": {
      "otel-observability": {
        "enabled": true,
        "config": {
          "endpoint": "http://localhost:4318",
          "signalEndpoints": {
            "logs": "https://logs-only-backend.example.com/otlp"
          }
        }
      }
    }
  }
}
```

## Authentication

Credentials go in `headers` (or per signal in `signalHeaders`), sent with every OTLP export request.

### Bearer Token

```json
{
  "plugins": {
    "load": { "paths": ["~/.openclaw/plugins/otel-observability"] },
    "entries": {
      "otel-observability": {
        "enabled": true,
        "hooks": { "allowConversationAccess": true },
        "config": {
          "endpoint": "https://api.example.com/otlp",
          "headers": {
            "Authorization": "Bearer your-token-here"
          }
        }
      }
    }
  }
}
```

### Dynatrace API Token

```json
{
  "plugins": {
    "load": { "paths": ["~/.openclaw/plugins/otel-observability"] },
    "entries": {
      "otel-observability": {
        "enabled": true,
        "hooks": { "allowConversationAccess": true },
        "config": {
          "endpoint": "https://{env-id}.live.dynatrace.com/api/v2/otlp",
          "headers": {
            "Authorization": "Api-Token dt0c01.xxx..."
          }
        }
      }
    }
  }
}
```

### Basic Auth (Grafana Cloud)

```json
{
  "plugins": {
    "load": { "paths": ["~/.openclaw/plugins/otel-observability"] },
    "entries": {
      "otel-observability": {
        "enabled": true,
        "hooks": { "allowConversationAccess": true },
        "config": {
          "endpoint": "https://otlp-gateway-prod-us-central-0.grafana.net/otlp",
          "headers": {
            "Authorization": "Basic base64(instanceId:apiKey)"
          }
        }
      }
    }
  }
}
```

## Sampling

Control trace sampling rate to reduce volume:

```json
{
  "plugins": {
    "load": { "paths": ["~/.openclaw/plugins/otel-observability"] },
    "entries": {
      "otel-observability": {
        "enabled": true,
        "hooks": { "allowConversationAccess": true },
        "config": {
          "endpoint": "http://localhost:4318",
          "sampleRate": 0.1
        }
      }
    }
  }
}
```

- not set (default) — every trace is kept (the SDK's default `parentbased_always_on` sampler)
- `1.0` — keep every trace, via the plugin's own ratio sampler
- `0.5` — keep 50% of traces
- `0.1` — keep 10% of traces
- `0.0` — drop every trace (no spans are recorded or exported; metrics and logs are unaffected — use `"traces": false` if you want to turn tracing off entirely)

See [Trace Sampling](#trace-sampling) below for the exact semantics.

## Selective Export

Enable only specific signals:

### Traces Only

```json
{
  "plugins": {
    "load": { "paths": ["~/.openclaw/plugins/otel-observability"] },
    "entries": {
      "otel-observability": {
        "enabled": true,
        "hooks": { "allowConversationAccess": true },
        "config": {
          "endpoint": "http://localhost:4318",
          "traces": true,
          "metrics": false,
          "logs": false
        }
      }
    }
  }
}
```

### Metrics Only

```json
{
  "plugins": {
    "load": { "paths": ["~/.openclaw/plugins/otel-observability"] },
    "entries": {
      "otel-observability": {
        "enabled": true,
        "hooks": { "allowConversationAccess": true },
        "config": {
          "endpoint": "http://localhost:4318",
          "traces": false,
          "metrics": true,
          "logs": false
        }
      }
    }
  }
}
```

### Logs Only

```json
{
  "plugins": {
    "load": { "paths": ["~/.openclaw/plugins/otel-observability"] },
    "entries": {
      "otel-observability": {
        "enabled": true,
        "hooks": { "allowConversationAccess": true },
        "config": {
          "endpoint": "http://localhost:4318",
          "traces": false,
          "metrics": false,
          "logs": true
        }
      }
    }
  }
}
```

## Log Filtering (`logConfig`)

With `logs: true`, every line this plugin logs through the gateway logger (the `[otel] ...` lines, including debug/info lines) is also exported as an OTLP log record. `logConfig` controls which of those lines get exported. It only affects OTLP export — the gateway's own console/journal output is unchanged.

```json
{
  "plugins": {
    "load": { "paths": ["~/.openclaw/plugins/otel-observability"] },
    "entries": {
      "otel-observability": {
        "enabled": true,
        "hooks": { "allowConversationAccess": true },
        "config": {
          "logs": true,
          "logConfig": {
            "excludeLevels": ["debug", "trace"],
            "excludeMessagePatterns": ["Registered "],
            "filters": [
              { "field": "message", "pattern": "pipeline active", "action": "include" },
              { "field": "level", "pattern": "info", "action": "exclude" }
            ]
          }
        }
      }
    }
  }
}
```

This example drops all debug/trace records and the per-hook `Registered ...` lines, then — via `filters` — drops every other info record except the `Observability pipeline active` startup confirmation. Warnings and errors are still exported.

| Field | Type | Description |
|-------|------|-------------|
| `excludeLevels` | string[] | Drop records at these levels (`trace`, `debug`, `info`, `warn`, `error`, `fatal`). Case-insensitive. The usual way to mute noisy debug/info output. |
| `excludeLoggers` | string[] | Drop records whose logger name contains any of these strings (case-insensitive substring match). |
| `excludeMessagePatterns` | string[] | Drop records whose message contains any of these strings (case-insensitive substring match). |
| `filters` | object[] | Ordered rules, each `{ "field": "logger" \| "message" \| "level" \| "type", "pattern": "<substring>", "action": "exclude" \| "include" }`. The first rule whose pattern matches decides: `exclude` drops the record, `include` keeps it and skips the remaining rules. Rules with an unknown `field` or `action` are ignored. |
| `enabled` | boolean | Parsed but currently has no effect. To turn off log export, set `"logs": false` instead. |

Order of evaluation: `excludeLevels`, then `excludeLoggers`, then `excludeMessagePatterns` — any match drops the record — and only then `filters`. An `include` rule therefore can't rescue a record that one of the three `exclude*` lists already dropped. A record matching nothing is exported.

Unlike the trace/metric settings, `logs` and `logConfig` changes can take effect through a plugin reload (see [Not hot-reloadable](#not-hot-reloadable) below).

## Environment Variables

The plugin's own config (`plugins.entries.otel-observability.config`) does **not** fall back to environment variables. `endpoint`, `protocol`, `serviceName`, and every other option above come only from the config file, falling back to the defaults in the table above — setting `OTEL_EXPORTER_OTLP_ENDPOINT` or `OTEL_SERVICE_NAME` has no effect on the plugin's exporters.

Environment variables are read only by the optional ESM preload (`instrumentation/preload.mjs`, loaded via `NODE_OPTIONS="--import ..."`), which runs before OpenClaw parses plugin config and sets up its own trace exporter for Traceloop LLM-client spans:

| Variable | Read by | Description |
|----------|---------|-------------|
| `OTEL_EXPORTER_OTLP_ENDPOINT` | preload only | OTLP/HTTP base endpoint for the preload's trace exporter (default `http://localhost:4318`; `/v1/traces` is appended). |
| `OTEL_SERVICE_NAME` | preload only | `service.name` for the preload's spans (default `openclaw-gateway`). |
| `OPENCLAW_OTEL_CAPTURE_CONTENT` | preload only | Legacy single-boolean flag for Traceloop content capture. `true` enables prompt/completion text on LLM-client spans. See [captureContent (gateway-launch setting)](#capturecontent-gateway-launch-setting). |
| `OPENCLAW_OTEL_CONTENT_POLICY` | preload only | Granular policy JSON (ISI-1000). When set, takes precedence over the legacy boolean. Same shape as the plugin's `captureContent` object form. |

`OTEL_EXPORTER_OTLP_PROTOCOL` is not read by either — the preload always exports OTLP/HTTP (protobuf). If you use the preload, set these to match the plugin config so both exporters send to the same place. The plugin's `start()` phase overwrites `OPENCLAW_OTEL_CAPTURE_CONTENT`/`OPENCLAW_OTEL_CONTENT_POLICY` in its own process environment from the plugin config, so subprocesses it spawns inherit the plugin's policy.

## Trace Sampling

The plugin exports 100% of traces by default. For high-traffic gateways this can be tuned down with the `sampleRate` option (0.0–1.0):

```json
{
  "plugins": {
    "load": { "paths": ["~/.openclaw/plugins/otel-observability"] },
    "entries": {
      "otel-observability": {
        "enabled": true,
        "hooks": { "allowConversationAccess": true },
        "config": {
          "sampleRate": 0.1
        }
      }
    }
  }
}
```

Semantics:

- `sampleRate` omitted — the SDK default sampler (`parentbased_always_on`) is used. The plugin does not construct its own sampler; nothing sampler-related appears in the boot log.
- `sampleRate: 1.0` — the plugin explicitly constructs `ParentBased(TraceIdRatio(1.0))`. Behaviourally equivalent to always-on, but the boot log reports `sampler=parentbased_traceidratio(1)` so operators can confirm the plugin took the sampling code path.
- `0.0` — drop every trace: no spans are recorded or exported. Metrics and logs are unaffected.
- Any value in between — keep that fraction of root traces.

Sampling is head-based and parent-respecting: the plugin wires a `ParentBasedSampler` around a `TraceIdRatioBasedSampler`. The root span of a trace makes the sampling decision based on the trace ID; child spans inherit the parent's decision so distributed traces stay coherent and you never see "half a trace".

Invalid values (negative, > 1, `NaN`, non-numeric, `null`, plain object) are ignored and the SDK default (`parentbased_always_on`) is used instead. The plugin emits a `[otel] Ignoring invalid sampleRate=…` warn-level log line whenever it drops a present-but-invalid value, so silent typos like `"sampleRate": "0.5"` (string) or `1.5` (out-of-range) are visible in operator logs instead of quietly disabling head-based sampling.

### Precedence vs. `OTEL_TRACES_SAMPLER` env vars

OpenTelemetry SDKs typically read the `OTEL_TRACES_SAMPLER` and `OTEL_TRACES_SAMPLER_ARG` environment variables to choose a default sampler. **This plugin does not.** When `sampleRate` is set in plugin config, the plugin builds the sampler directly (`ParentBased(TraceIdRatio(sampleRate))`) and the env vars have no effect on the plugin's tracer provider. When `sampleRate` is omitted, the plugin omits the `sampler` key entirely so the SDK's default (`parentbased_always_on`) applies — and even in that case, the plugin does not propagate `OTEL_TRACES_SAMPLER` to its provider.

Operators migrating from other OTel SDKs should configure sampling via `plugins.entries.otel-observability.config.sampleRate` rather than the env vars. The precedence is:

| Configuration                                                  | Effective sampler                                          |
| -------------------------------------------------------------- | ---------------------------------------------------------- |
| `sampleRate` set (any valid value)                             | `ParentBased(TraceIdRatio(sampleRate))` — env vars ignored |
| `sampleRate` omitted; `OTEL_TRACES_SAMPLER` set                | SDK default (`parentbased_always_on`) — env vars ignored   |
| `sampleRate` omitted; no env vars                              | SDK default (`parentbased_always_on`)                      |
| `sampleRate` present but invalid (e.g. `"0.5"` string, `1.5`)  | SDK default — plugin emits a `logger.warn` diagnostic      |

## `captureContent` (gateway-launch setting)

The plugin exposes a `captureContent` field in `plugins.entries.otel-observability.config`. It accepts either:

- a single boolean — `true` turns every capture category on, `false` turns every category off (legacy shape, kept for backwards compatibility), or
- a granular **`ContentCapturePolicy`** object with six independent flags:

| Flag | Span attribute(s) | What is captured |
|------|--------------------|-------------------|
| `inputMessages` | `gen_ai.input.messages` + `openclaw.content.input_message` (request span), `openclaw.content.prompt` / `openclaw.content.messages` (agent.turn span), `gen_ai.prompt.prompt_filter_results` (LLM-client span) | Inbound user message + the prompt and message history fed to the LLM |
| `outputMessages` | `gen_ai.output.messages` + `openclaw.content.output_message` (message.sent span), `gen_ai.completion.content_filter_results` (LLM-client span) | Outbound assistant reply text |
| `toolInputs` | `openclaw.content.tool_input` (execute_tool span) | Full tool-call input arguments (JSON-stringified, capped at 8192 UTF-16 code units) |
| `toolOutputs` | `openclaw.content.tool_output` (execute_tool span) | Tool-call result text (text parts of the result message, capped at 8192 UTF-16 code units) |
| `toolErrorMessages` | `openclaw.tool.error_preview` (execute_tool span, failure paths only) | Bounded, redacted preview of the tool error text (redacted, then capped at 1024 chars). **Default differs — see the note below** |
| `systemPrompt` | `gen_ai.system_instructions` + `openclaw.content.system_prompt` (agent.turn span) | System prompt text |

> The stable `gen_ai.*` content keys (ISI-1605, schema `1.4.0`, shipped in
> **0.8.0**) are emitted **alongside** the legacy `openclaw.content.*` mirrors —
> both share the same policy gate and the same redact-before-truncate funnel
> (8192 UTF-16 code units, surrogate-safe). The `gen_ai.*` keys light up
> **Dynatrace AI Observability** prompt/response rendering; see
> [Dynatrace → AI Observability](./backends/dynatrace.md#ai-observability-gen_ai-content-keys).
> `gen_ai.system_instructions` carries the system-prompt **text** and is
> intentionally distinct from `gen_ai.provider.name` (provider identity).

> ⚠️ **`toolErrorMessages` default is a special case.** Every other flag
> defaults **off**. `toolErrorMessages` also defaults **off** when
> `captureContent` is omitted or set to the boolean `false`, but defaults
> **on** whenever `captureContent` is supplied as an *object* — error text is
> operational data, a different privacy class from full prompt/response
> capture. Set `{ "toolErrorMessages": false }` to opt out explicitly.
>
> | `captureContent` value | `toolErrorMessages` → `error_preview` |
> |------------------------|----------------------------------------|
> | omitted entirely | **off** |
> | `false` | **off** |
> | `true` | **on** |
> | object, e.g. `{ "toolInputs": true }` | **on** (defaults to `true` when not named) |
> | object `{ "toolErrorMessages": false }` | **off** (explicit opt-out) |

LLM-client spans emitted by Traceloop (`@traceloop/instrumentation-anthropic`, `@traceloop/instrumentation-openai`) still respect the legacy single-boolean Traceloop flag. The plugin derives it from the policy as `inputMessages || outputMessages || systemPrompt` — the three categories that map to prompt/completion text.

> ⚠️ **Direction selection only applies to the plugin's own spans.** Traceloop's `traceContent` is a single boolean with no input/output distinction, so enabling **any** of `inputMessages`, `outputMessages`, or `systemPrompt` causes Traceloop LLM-client spans to record **both** `gen_ai.prompt.*.content` and `gen_ai.completion.*.content`. The `openclaw.content.*` attributes on the plugin's hook-surface spans **do** honor each flag in isolation — e.g., `{ inputMessages: true }` will record `openclaw.content.input_message` but not `openclaw.content.output_message`. If you need strict one-direction capture without completions landing on LLM-client spans, leave every LLM-content flag off and capture from the hook surface only (or filter `gen_ai.completion.*.content` at the OTel Collector). See [Privacy: `captureContent`](./security/privacy.md#traceloop-llm-client-spans-via-the-preload).

**Default: `false` (every flag off, privacy-first).** See [github issue #15](https://github.com/henrikrexed/openclaw-observability-plugin/issues/15) for the motivating report and ISI-1000 for the granular policy.

### Not hot-reloadable

`captureContent` is a **gateway-launch setting**, not a hot-reloadable plugin option, because the ESM preload (`instrumentation/preload.mjs`) instantiates `AnthropicInstrumentation` and `OpenAIInstrumentation` *before* OpenClaw parses plugin config. Changing the value in `openclaw.json` mid-run has no effect until the next gateway restart.

The telemetry providers themselves are also preserved across config hot-reload. OpenClaw calls the plugin service `stop()` before `register()` during reload; this plugin treats `stop()` as a non-destructive drain and calls `forceFlush()` instead of `shutdown()` so the live TracerProvider/MeterProvider keep exporting spans and metrics after reload.

Because the runtime is reused, changes to telemetry-affecting fields do not take effect until a full gateway restart:

- `endpoint`
- `headers`
- `protocol`
- `serviceName`
- `traces`
- `metrics`
- `sampleRate`
- `metricsIntervalMs`
- `resourceAttributes`
- `signalEndpoints`
- `signalHeaders`
- preload-backed content capture (`captureContent` for Traceloop LLM-client spans)

This is intentional: stale telemetry config is preferable to dropping all post-reload spans. Restart the gateway after changing any of those fields. The log pipeline is rebuilt during service `stop()`/`register()` reloads, so `logs` and `logConfig` can take effect through the plugin reload path.

### `openclaw.otel.preExit`

The plugin publishes a loose pre-exit contract for OpenClaw code paths that call `process.exit()` before the BatchSpanProcessor export interval fires:

```typescript
const preExit = globalThis[Symbol.for("openclaw.otel.preExit")];
if (typeof preExit === "function") await preExit();
```

The plugin sets the symbol to a non-destructive flush function during telemetry initialization and clears it from `shutdown()`. CLI exit handlers own calling it before forced exit.

### How to enable content capture

The preload reads two env vars and picks the granular one whenever it is set:

- `OPENCLAW_OTEL_CONTENT_POLICY` — granular policy as JSON. Preferred.
- `OPENCLAW_OTEL_CAPTURE_CONTENT` — legacy single boolean. Fallback.

#### All-on (legacy boolean)

```bash
OPENCLAW_OTEL_CAPTURE_CONTENT=true \
  NODE_OPTIONS="--import /path/to/openclaw-observability-plugin/instrumentation/preload.mjs" \
  openclaw gateway start
```

```json
{
  "plugins": {
    "entries": {
      "otel-observability": {
        "enabled": true,
        "config": {
          "captureContent": true
        }
      }
    }
  }
}
```

#### Granular (recommended)

Enable only what you actually need. For example, capture tool inputs/outputs for debugging without recording user prompts:

```bash
OPENCLAW_OTEL_CONTENT_POLICY='{"toolInputs":true,"toolOutputs":true}' \
  NODE_OPTIONS="--import /path/to/openclaw-observability-plugin/instrumentation/preload.mjs" \
  openclaw gateway start
```

```json
{
  "plugins": {
    "entries": {
      "otel-observability": {
        "enabled": true,
        "config": {
          "captureContent": {
            "toolInputs": true,
            "toolOutputs": true
          }
        }
      }
    }
  }
}
```

Or via systemd:

```ini
[Service]
Environment=OPENCLAW_OTEL_CONTENT_POLICY={"toolInputs":true,"toolOutputs":true}
Environment=NODE_OPTIONS=--import /path/to/openclaw-observability-plugin/instrumentation/preload.mjs
ExecStart=/usr/bin/openclaw gateway start
```

### Mismatch warning

If the plugin config and the preload-time env vars disagree about whether LLM-client content capture is on, the plugin logs a warning at `start()`:

```
[otel] captureContent policy resolves traceContent=true but the preload resolved
OPENCLAW_OTEL_CAPTURE_CONTENT=false at gateway launch. Traceloop LLM-client
spans will use the preload's value. Set OPENCLAW_OTEL_CONTENT_POLICY='{"inputMessages":true}'
(or OPENCLAW_OTEL_CAPTURE_CONTENT=true) in the gateway's environment before
starting (see docs/security/privacy.md).
```

Fix by setting the env var and restarting the gateway. The plugin's own hook-surface content attributes (`openclaw.content.*`) are not affected by this warning — they are evaluated against the live plugin config and so are always consistent with the running policy.

### Privacy guidance

Leave `captureContent` at `false` unless you control the backend and understand the implications. See [Privacy: `captureContent`](./security/privacy.md) for a fuller treatment.

## Applying Changes

After modifying trace/metric provider configuration:

```bash
openclaw gateway restart
```

Plugin hot reload can apply log pipeline changes (`logs` and `logConfig`), but it does not rebuild the trace or metric providers listed above.

## Troubleshooting

### Configuration Not Applied?

Check the current config:

```bash
cat ~/.openclaw/openclaw.json | jq '.plugins.entries["otel-observability"]'
```

Also confirm `plugins.load.paths` points at your clone: `jq '.plugins.load'`.

### Invalid Config Errors?

Validate JSON syntax:

```bash
cat ~/.openclaw/openclaw.json | jq .
```

### Endpoint Unreachable?

Test connectivity:

```bash
curl -v http://localhost:4318/v1/traces
```
