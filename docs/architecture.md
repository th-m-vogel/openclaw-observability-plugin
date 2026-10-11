# Architecture

How OpenClaw observability works — both the official plugin and custom hook-based approach.

## Overview: Two Approaches

```
┌─────────────────────────────────────────────────────────────────────┐
│                        OpenClaw Gateway                             │
│                                                                     │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │                      Agent Execution                         │   │
│  │  message_received → before_model_resolve →                  │   │
│  │                     before_prompt_build → tool_calls →       │   │
│  │                     tool_result_persist → agent_end          │   │
│  └──────────────────────────┬──────────────────────────────────┘   │
│                              │                                      │
│         ┌────────────────────┼────────────────────┐                │
│         │                    │                    │                │
│         ▼                    ▼                    ▼                │
│  ┌─────────────┐    ┌───────────────┐    ┌─────────────────┐      │
│  │  Diagnostic │    │  Typed Hooks  │    │   Log Output    │      │
│  │   Events    │    │  (api.on())   │    │                 │      │
│  │ (model.usage│    │               │    │                 │      │
│  │  message.*) │    │               │    │                 │      │
│  └──────┬──────┘    └───────┬───────┘    └────────┬────────┘      │
│         │                   │                     │                │
│         ▼                   ▼                     ▼                │
│  ┌─────────────┐    ┌─────────────────┐   ┌──────────────┐        │
│  │  OFFICIAL   │    │     CUSTOM      │   │ Log Forward  │        │
│  │   PLUGIN    │    │     PLUGIN      │   │ (via official│        │
│  │ diagnostics │    │ otel-observ...  │   │   plugin)    │        │
│  │    -otel    │    │                 │   │              │        │
│  └──────┬──────┘    └───────┬─────────┘   └──────┬───────┘        │
│         │                   │                    │                 │
│         └───────────────────┼────────────────────┘                 │
│                             ▼                                      │
│                   ┌─────────────────┐                              │
│                   │ OTLP Exporters  │                              │
│                   │ (HTTP/protobuf) │                              │
│                   └────────┬────────┘                              │
└────────────────────────────┼────────────────────────────────────────┘
                             │
                             ▼
                   ┌─────────────────┐
                   │  OTLP Endpoint  │
                   │ (Collector or   │
                   │  Direct Ingest) │
                   └─────────────────┘
```

## Approach 1: Official Plugin (diagnostics-otel)

### How It Works

The official plugin uses the **diagnostic event bus** — a publish-subscribe system where the Gateway emits events and plugins consume them.

```
Gateway Core                    diagnostics-otel Plugin
     │                                   │
     │  emit("model.usage", {...})       │
     │ ─────────────────────────────────>│
     │                                   │  ──> create span
     │                                   │  ──> update counters
     │                                   │  ──> record histogram
     │                                   │
     │  emit("message.processed", {...}) │
     │ ─────────────────────────────────>│
     │                                   │  ──> create span
     │                                   │  ──> update counters
```

### Diagnostic Events

| Event | When Emitted | Data Included |
|-------|--------------|---------------|
| `model.usage` | After LLM call | tokens, cost, model, duration |
| `webhook.received` | HTTP request arrives | channel, type |
| `webhook.processed` | Handler completes | duration, chatId |
| `webhook.error` | Handler fails | error message |
| `message.queued` | Added to queue | channel, source, depth |
| `message.processed` | Processing done | outcome, duration |
| `queue.lane.enqueue` | Lane add | lane, size |
| `queue.lane.dequeue` | Lane remove | lane, size, wait time |
| `session.state` | State change | state, reason |
| `session.stuck` | Stuck detected | age, queue depth |

### OTel Signals Created

> Everything in this subsection is produced by the Gateway-built-in `diagnostics-otel` plugin. The custom plugin in this repo (Approach 2 below) emits a different metric set (`openclaw.llm.*` + `gen_ai.*`).

**Metrics (emitted by `diagnostics-otel`):**
```
openclaw.tokens{type="input|output|cache_read|cache_write"}
openclaw.cost.usd
openclaw.run.duration_ms
openclaw.context.tokens{type="limit|used"}
openclaw.webhook.received
openclaw.webhook.error
openclaw.webhook.duration_ms
openclaw.message.queued
openclaw.message.processed
openclaw.message.duration_ms
openclaw.queue.depth
openclaw.queue.wait_ms
openclaw.session.state
openclaw.session.stuck
openclaw.session.stuck_age_ms
```

**Traces (emitted by `diagnostics-otel`):**
- `openclaw.model.usage` — Per LLM call span
- `openclaw.webhook.processed` — Per webhook span
- `openclaw.webhook.error` — Error span (with status=ERROR)
- `openclaw.message.processed` — Per message span
- `openclaw.session.stuck` — Stuck detection span

**Logs (emitted by `diagnostics-otel`):**
- All Gateway logs as OTel LogRecords
- Includes severity, subsystem, code location

---

## Approach 2: Custom Hook-Based Plugin

### Plugin Lifecycle

OpenClaw drives plugins through three phases. Mixing them up is the single most common way to break the custom plugin — if typed hooks are registered in the wrong phase, the gateway never sees them and no spans are produced. The current layout:

```
┌──────────────┐      ┌──────────────┐      ┌──────────────┐
│  register()  │ ───▶ │    start()   │ ───▶ │    stop()    │
│  synchronous │      │     async    │      │     async    │
└──────────────┘      └──────────────┘      └──────────────┘
        │                     │                     │
        │                     │                     │
        ▼                     ▼                     ▼
  - initTelemetry()     - initOpenLLMetry()  - stopHooks()
  - api.on(*)           - env bridge         - unsubscribe()
  - api.registerHook()                       - telemetry.flush()
  - api.registerGate…
  - api.on("gateway_stop")
  - api.registerCli()
  - api.registerService()
  - api.registerTool()
        │                     │
        └─── lazy getter ─────┘
           () => telemetry
```

| Phase | Runs | Responsibility |
|---|---|---|
| `register()` | Synchronous, before the gateway accepts traffic | Build or reuse the OTel runtime (`initTelemetry` → TracerProvider + MeterProvider), wire every typed hook (`message_received`, `session_start`, `session_end`, `before_model_resolve`, `before_prompt_build`, `llm_input`, `llm_output`, `model_call_started`, `model_call_ended`, `before_dispatch`, `reply_dispatch`, `before_tool_call`, `after_tool_call`, `tool_approval_resolution`, `tool_result_persist`, `message_sent`, `before_agent_finalize`, `agent_end`, `before_reset`, cron hooks, subagent hooks), event-stream hooks (`command:*`, `gateway:startup`), diagnostics listener, RPC method, CLI command, background service, and agent tool. |
| `start()` | Async, once the gateway is ready | Perform gateway-only setup: publish content-capture env vars for subprocesses, warn on preload/config mismatches, and optionally wrap LLM SDKs with OpenLLMetry when `traces` is on. |
| `stop()` | Async, on gateway reload or shutdown | Clear the stale-session sweeper `setInterval` (see [b668a4f](https://github.com/henrikrexed/openclaw-observability-plugin/commit/b668a4f), ISI-522), unsubscribe from diagnostics, shut down the log pipeline, and call `telemetry.flush()` so batched spans/metrics drain without destroying providers. |
| `gateway_stop` | Final gateway lifecycle hook | Calls `telemetry.shutdown()` for destructive provider teardown, clears the metric heartbeat interval and preExit symbol, and releases the module-level runtime guard for a real process restart. |

### Lazy telemetry getter

Hooks are registered in `register()` and resolve the current runtime with a **lazy telemetry getter** instead of closing over a stale concrete runtime:

```typescript
let telemetry: TelemetryRuntime | null = null;

// Registered in register(), resolves telemetry at call time.
let stopHooks: (() => void) | null = null;
let unsubscribeDiagnostics: (() => void) | null = null;

telemetry = initTelemetry(config, logger);         // populated in register()
stopHooks = registerHooks(api, () => telemetry, config);
registerDiagnosticsListener(telemetry, logger).then((unsub) => {
  unsubscribeDiagnostics = unsub;
});
api.on("gateway_stop", async () => {
  await telemetry?.shutdown();                     // destructive finalizer
  telemetry = null;
});

api.registerService({
  id: "otel-observability",
  start: async () => {
    if (config.traces) await initOpenLLMetry(config, logger);
  },
  stop: async () => {
    stopHooks?.();                                  // clearInterval
    unsubscribeDiagnostics?.();
    await telemetry?.flush();                       // non-destructive
  },
});
```

Each hook handler opens with:

```typescript
const telemetry = getTelemetry();
if (!telemetry) return;
```

so hook handlers read whichever live runtime `register()` installed.

### Hot reload vs. final shutdown

OpenClaw uses the same service `stop()` callback for config hot-reload and ordinary gateway teardown, and the service context does not provide a reliable "final process exit" discriminator. This plugin therefore treats `stop()` as a hot-reload-safe drain, not a destructive provider shutdown.

`initTelemetry()` is idempotent. During hot reload, the new `register()` call reuses the existing runtime rather than registering a second global TracerProvider or duplicating the metric heartbeat interval. This prevents silent telemetry loss after reload, but it also means trace/metric provider config changes do not take effect until the process restarts. Restart the gateway after changing endpoint, headers, protocol, service name, traces, metrics, sample rate, metrics interval, resource attributes, or preload-backed content capture. The metric heartbeat interval is unref'ed so it does not pin process exit; `gateway_stop` still performs explicit destructive shutdown when the host emits final gateway teardown.

The runtime still exposes `shutdown()` for explicit destructive teardown in tests and `gateway_stop`. During normal operation, forced-exit callers should use `globalThis[Symbol.for("openclaw.otel.preExit")]` to flush before `process.exit()`; the plugin sets that symbol during telemetry initialization and clears it from `shutdown()`.

### How It Works

The custom plugin uses **typed plugin hooks** — direct callbacks into the agent lifecycle.

```
Gateway Agent Loop              Custom Plugin
     │                               │
     │  on("message_received")       │
     │ ─────────────────────────────>│  ──> create ROOT span
     │                               │      store in sessionContextMap
     │                               │
     │  on("before_model_resolve")   │
     │ ─────────────────────────────>│  ──> create AGENT TURN span
     │                               │      (child of root)
     │                               │
     │  on("before_prompt_build")    │
     │ ─────────────────────────────>│  ──> enrich AGENT TURN span
     │                               │      with prompt.chars +
     │                               │      session.message_count
     │                               │
     │  on("model_call_started")     │
     │ ─────────────────────────────>│  ──> create CHAT span (per real call)
     │  (once per real LLM call)     │      (child of agent turn)
     │                               │
     │  on("model_call_ended")       │
     │ ─────────────────────────────>│  ──> close CHAT span (no usage here —
     │                               │      this event carries none, see
     │                               │      Data Flow Comparison below)
     │                               │      update llm.requests/.duration
     │                               │      (per-call metrics, 0.11.0+)
     │                               │
     │  on("tool_result_persist")    │
     │ ─────────────────────────────>│  ──> create TOOL span
     │  (called for each tool)       │      (child of agent turn)
     │                               │
     │  on("agent_end")              │
     │ ─────────────────────────────>│  ──> end agent turn span
     │                               │      end root span
     │                               │      extract tokens from messages,
     │                               │      enrich turn span + token-count
     │                               │      fallback metrics if model.usage
     │                               │      never fired this turn
```

### Trace Context Propagation

The key difference is **trace context propagation**. The custom plugin maintains a session-to-context map:

```typescript
interface SessionTraceContext {
  rootSpan: Span;           // openclaw.request
  rootContext: Context;     // OTel context with root span
  agentSpan?: Span;         // openclaw.agent.turn
  agentContext?: Context;   // OTel context with agent span
  startTime: number;
}

const sessionContextMap = new Map<string, SessionTraceContext>();
```

When creating child spans, it uses the stored context:

```typescript
// Tool span becomes child of agent turn
const span = tracer.startSpan(
  `tool.${toolName}`,
  { kind: SpanKind.INTERNAL },
  sessionCtx.agentContext  // <-- parent context
);
```

### Resulting Trace Structure

```
openclaw.request (root)
│   openclaw.session.key: "main@whatsapp:+123..."
│   openclaw.message.channel: "whatsapp"
│
├── openclaw.session (long-lived, covers entire conversation)
│   gen_ai.conversation.id: "session-abc"
│   openclaw.session.channel: "whatsapp"
│   openclaw.session.user_id: "user-42"
│   user.id: "user-42"
│
└── openclaw.agent.turn (child)
    │   gen_ai.operation.name: "invoke_agent"
    │   gen_ai.usage.input_tokens: 1234
    │   gen_ai.usage.output_tokens: 567
    │   gen_ai.response.model: "claude-opus-4-5-..."
    │   gen_ai.provider.name: "anthropic"
    │   openclaw.agent.duration_ms: 4100
    │   openclaw.prompt.chars: 256
    │   openclaw.session.message_count: 8
    │
    ├── openclaw.dispatch.prepare
    │       gen_ai.request.model: "claude-opus-4-5-..."
    │
    ├── chat claude-opus-4-5-20250514 (model call span)
    │       gen_ai.provider.name: "anthropic"
    │       gen_ai.request.model: "claude-opus-4-5-..."
    │       gen_ai.response.model: "claude-opus-4-5-20250514"
    │       gen_ai.usage.input_tokens: 1234
    │       gen_ai.usage.output_tokens: 567
    │       gen_ai.usage.cache_read.input_tokens: 800
    │       gen_ai.response.finish_reasons: "end_turn"
    │
    ├── execute_tool Read (tool span)
    │       gen_ai.tool.name: "Read"
    │       gen_ai.operation.name: "execute_tool"
    │       openclaw.tool.duration_ms: 45
    │       openclaw.tool.result_chars: 2048
    │
    ├── execute_tool Bash (tool span)
    │       gen_ai.tool.name: "Bash"
    │       openclaw.tool.input_preview: '{"command":"ls -la"}'
    │       openclaw.tool.duration_ms: 120
    │
    └── execute_tool Write (tool span)
            gen_ai.tool.name: "Write"
            openclaw.tool.result_chars: 0
```

### OTel Signals Created

**Metrics (emitted by this plugin, see `docs/telemetry/metrics.md` for the full reference):**
```
openclaw.llm.requests            # counter, per real call (0.11.0+)
openclaw.llm.errors              # counter, per real call (0.11.0+)
openclaw.llm.duration            # histogram, per real call (0.11.0+)
openclaw.llm.tokens.total        # counter, per agent turn, by gen_ai.response.model
openclaw.llm.tokens.prompt       # counter, per agent turn
openclaw.llm.tokens.completion   # counter, per agent turn
openclaw.llm.cost.usd            # counter, per agent turn, by gen_ai.response.model
openclaw.tool.calls              # counter
openclaw.session.resets          # counter
```

The OTel-stable `gen_ai.usage.input_tokens` / `gen_ai.usage.output_tokens` are recorded as **span attributes** on both the per-call `chat {model}` span and the aggregated `openclaw.agent.turn` span (see the trace structure above), in addition to the per-call counters above.

**Traces (emitted by this plugin):** see the trace tree above (`openclaw.request` → `openclaw.session` → `openclaw.agent.turn` → child spans).

**Note:** The legacy `openclaw.tokens` / `openclaw.cost.usd` counters are emitted only by the Gateway's built-in `diagnostics-otel` plugin (Approach 1). They are **not** emitted by this plugin.

---

## Data Flow Comparison

### Official Plugin: Token Tracking

```
1. Agent calls LLM via pi-ai
2. pi-ai returns response with .usage
3. Gateway calculates cost
4. Gateway emits "model.usage" event with:
   - usage: {input, output, cacheRead, cacheWrite}
   - costUsd: 0.0234
   - model: "claude-..."
   - durationMs: 2341
5. diagnostics-otel receives event
6. Creates metrics + span
7. Batches and exports via OTLP
```

### Custom Plugin: Token Tracking

**0.11.0+** — two separate paths, split by what's exclusively available on each. Tokens/cost stayed on the turn-level path; only request count and duration moved to the per-call one (see `docs/telemetry/metrics.md` for why the obvious-looking alternative — moving tokens there too — doesn't work: `model_call_ended`'s real event carries no usage data at all).

```
Per real model call (openclaw.llm.requests / .duration / .errors only):
1. Agent calls LLM via pi-ai
2. Gateway fires model_call_started → plugin opens a "chat {model}" span,
   stashes provider/agentId on the session's active context
3. pi-ai returns response with .usage (but this is NOT what model_call_ended
   receives — see step 4)
4. Gateway fires model_call_ended with sanitized call metadata only: timing,
   outcome, provider/model, bounded request-id hashes — no usage field
5. Plugin closes the span (no usage attributes to add — none are available)
   and records request-count/duration metrics (0.11.0+, new — previously
   this step only touched the span, and didn't record metrics at all)
6. Batches and exports via OTLP

Per agent turn (openclaw.llm.tokens.* and .cost.usd — unchanged since before
0.11.0, still the only source for either):
1. Gateway fires the "model.usage" diagnostic event once per turn (summing
   however many of the per-call cycles above happened in it, e.g. several in
   a tool-use loop) — this is the one place token counts and cost appear at
   all; neither is ever on model_call_started/model_call_ended
2. Plugin dedup-checks it against openclaw/openclaw#166289 (core is known to
   double-dispatch this event for a subset of calls, 0.11.0+) and records
   tokens/cost if new
3. Gateway also fires agent_end with the turn's messages (incl. .usage) —
   plugin uses this to enrich the agent-turn span's attributes, and (0.11.0+,
   same label schema as step 2 now) as a token-count fallback for turns
   where model.usage never fired at all
```

Before 0.11.0, step 5 of the per-call path only set span attributes and
recorded nothing; the agent-turn fallback in step 3 used a different,
disjoint label schema (no `gen_ai.conversation.id`) than step 2's primary
path. Both are fixed now — see `docs/telemetry/metrics.md` for the full
before/after.

---

## Resource and Attributes

### Common Attributes

| Attribute | Description |
|-----------|-------------|
| `service.name` | Service name from config |
| `openclaw.channel` | Channel (whatsapp, telegram, etc.) |
| `openclaw.session.key` | Session identifier |

### Official Plugin Specific

| Attribute | Description |
|-----------|-------------|
| `openclaw.provider` | LLM provider |
| `openclaw.model` | Model name |
| `openclaw.token` | Token type (input/output/cache_*) |
| `openclaw.webhook` | Webhook update type |
| `openclaw.outcome` | Message outcome |
| `openclaw.state` | Session state |

### Custom Plugin Specific

| Attribute | Description |
|-----------|-------------|
| `gen_ai.operation.name` | Operation: `invoke_agent`, `chat`, `execute_tool` |
| `gen_ai.request.model` | Requested model name |
| `gen_ai.response.model` | Actual model used |
| `gen_ai.response.id` | LLM response ID |
| `gen_ai.response.finish_reasons` | Stop reasons |
| `gen_ai.usage.input_tokens` | Input token count |
| `gen_ai.usage.output_tokens` | Output token count |
| `gen_ai.usage.cache_read.input_tokens` | Cache read tokens |
| `gen_ai.usage.cache_creation.input_tokens` | Cache creation tokens |
| `gen_ai.request.stream` | Whether streaming |
| `gen_ai.request.max_tokens` | Max token limit |
| `gen_ai.provider.name` | Provider name |
| `openclaw.tool.approval.requested` | Approval required (renamed from `gen_ai.tool.approval.requested` in schema 1.1.0) |
| `openclaw.tool.approval.resolution` | Approved/denied (renamed from `gen_ai.tool.approval.resolution` in schema 1.1.0) |
| `openclaw.tool.approval.duration_ms` | Approval wait time (renamed from `gen_ai.tool.approval.duration_ms` in schema 1.1.0) |
| `openclaw.agent.id` | Agent identifier |
| `openclaw.tool.name` | Tool name |
| `openclaw.tool.call_id` | Tool call UUID |
| `openclaw.tool.result_chars` | Result size |
| `openclaw.tool.duration_ms` | Tool execution time |
| `openclaw.session.channel` | Channel (whatsapp, cli, etc.) |
| `openclaw.session.user_id` | User identifier (kept for backward compatibility — see `user.id`) |
| `user.id` | OTel-stable end-user id (ISI-995). Mirrors `openclaw.session.user_id` on the `openclaw.session` span so registry-keyed dashboards can correlate sessions on a standard attribute. |
| `openclaw.prompt.chars` | Prompt character count |
| `openclaw.session.message_count` | History size fed to LLM |
| `openclaw.dispatch.duration_ms` | Dispatch phase duration |

### Removed attributes — dual-emit window closed (schema 1.3.0)

Schema `1.3.0` (ISI-1004) closes the dual-emit window opened in `1.2.0`
(ISI-994). The legacy OTel semconv keys are **no longer emitted** —
dashboards, alerts, and queries must read the stable replacements.

| Removed (1.3.0)                       | Stable replacement (shipped in 1.2.0)                                    |
|---------------------------------------|--------------------------------------------------------------------------|
| `gen_ai.system`                       | `gen_ai.provider.name`                                                   |
| `code.function` + `code.namespace`    | `code.function.name` (= `${namespace}.${function}`) + `code.file.path`   |
| `gen_ai.usage.cache_read_tokens`      | `gen_ai.usage.cache_read.input_tokens`                                   |
| `gen_ai.usage.cache_write_tokens`     | `gen_ai.usage.cache_creation.input_tokens`                               |
| `gen_ai.usage.total_tokens`           | *(none — compute `input + output`)*                                      |

The constants that exported the removed keys
(`GEN_AI_SYSTEM`, `CODE_FUNCTION`, `CODE_NAMESPACE`,
`GEN_AI_USAGE_CACHE_READ_TOKENS`, `GEN_AI_USAGE_CACHE_WRITE_TOKENS`,
`GEN_AI_USAGE_TOTAL_TOKENS`) are also removed from `src/semconv.ts`.

**Consumer action required:**

- Switch Dynatrace dashboards / DQL queries from `gen_ai.system` to
  `gen_ai.provider.name`.
- Replace any filter on `code.function` / `code.namespace` with
  `code.function.name` (combined form) or `code.file.path`.
- Update cache-token panels to `gen_ai.usage.cache_read.input_tokens` /
  `gen_ai.usage.cache_creation.input_tokens`.
- Compute totals as `gen_ai.usage.input_tokens +
  gen_ai.usage.output_tokens` — `gen_ai.usage.total_tokens` is gone.

The resource attribute `openclaw.schema.version` now carries `1.3.0` on
every signal so consumers can gate queries on the schema cut-over.

### Resource identity (ISI-995)

The trace, metric, and log Resources all carry:

- `service.version` resolved at module load from `openclaw.plugin.json`'s
  `version` field — the legacy hard-coded `"0.1.0"` placeholder is gone,
  so version-comparison dashboards now see real plugin releases.
- An OTel semconv `schema_url` (currently
  `https://opentelemetry.io/schemas/1.39.0`, pinned to the installed
  `@opentelemetry/semantic-conventions` version) so backends can resolve
  attribute names against the right registry generation.

### Log-attribute hygiene (ISI-995)

Bridged log records emit OTel-stable `code.function.name`,
`code.file.path`, and `code.line.number` for the emit site, replacing
the older `openclaw.log.function`, `openclaw.log.file`, and
`openclaw.log.line` triplet (which duplicated the same semantics in a
non-portable namespace and confused log-pipeline filters keyed on
`code.*`).

The pipeline no longer emits `openclaw.log.trace_id`,
`openclaw.log.span_id`, or `openclaw.log.trace_flags` either — those
fields are already on the OTLP LogRecord itself when the active context
is passed to `emit()`, so the duplicate attribute lines were silent
double-records.

---

## Performance Considerations

### Batching

Both plugins use batched export:
- **Traces:** BatchSpanProcessor (default 5s or 512 spans)
- **Metrics:** PeriodicExportingMetricReader (default 60s)
- **Logs:** BatchLogRecordProcessor (default 5s)

### Overhead

| Plugin | Overhead Source |
|--------|-----------------|
| Official | Event subscription, metric/span creation |
| Custom | Hook interception, context map management |

Both are lightweight — the OTel SDK handles batching efficiently.

### Sampling

Reduce trace volume with `sampleRate`:

```json
{
  "diagnostics": {
    "otel": {
      "sampleRate": 0.1  // 10% of traces
    }
  }
}
```

---

## When to Use Each

| Use Case | Recommended |
|----------|-------------|
| Production monitoring | Official |
| Cost/token dashboards | Official |
| Gateway health alerts | Official |
| Debugging specific requests | Custom |
| Understanding agent behavior | Custom |
| Tool execution analysis | Custom |
| Complete observability | Both |
