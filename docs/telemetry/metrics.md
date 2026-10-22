# Metrics Reference

Metrics use the `openclaw.*` namespace — plus the two stable OTel GenAI histograms `gen_ai.client.token.usage` and `gen_ai.client.operation.duration` — and are exported via OTLP every `metricsIntervalMs` (default: 30 seconds).

A metric only appears in your backend once something has recorded a value to it, so event-driven metrics (webhooks, cron, failover, memory pressure, ...) stay absent until the matching OpenClaw event actually fires. A core set of counters (LLM requests/errors/tokens, tool calls/errors, messages, session resets, security) is kept alive with a zero-value data point every export interval, carrying the attribute `openclaw.idle=true` — filter that out (or ignore it, since it adds 0) in queries that group by attribute.

> This page covers metrics emitted by **this plugin** only. For OpenClaw core's own first-party metric catalog (emitted by the official `diagnostics-otel` plugin — see [index](../index.md) for how the two relate), the authoritative reference is [OpenClaw core: Model calls and exported metrics](https://docs.openclaw.ai/gateway/opentelemetry/model-calls-and-metrics). Always check that page (or the core source directly) before assuming a field exists on a diagnostic event — see [Limitations](../limitations.md) for a real example of what happens when that isn't done.

## LLM Metrics

> **0.11.0+:** `openclaw.llm.requests` and `.duration` record once per real model API call, from the `model_call_started`/`model_call_ended` hook pair, instead of once per **agent turn** from the `model.usage` diagnostic event (a turn may cover several real calls in a tool-use loop).
>
> **0.11.0+ (requires OpenClaw v2026.9.8+):** `openclaw.llm.tokens.*` (prompt/completion/total, including the cache_read/cache_write breakdown) also moved to a per-call source — `model.call.completed`/`model.call.error` *diagnostic events* (via `onInternalDiagnosticEvent`, a different mechanism than the hook pair above). These carry genuine call-scoped usage (`observer.usageField()`) confirmed since that release; the hook pair itself still carries none. `openclaw.llm.cost.usd` is unchanged — still once per agent turn, from `model.usage` — because no per-call cost field exists anywhere in OpenClaw's plugin API. If you're upgrading a dashboard or alert built against pre-0.11.0 semantics: `.tokens.*` cardinality changed the same way `.requests`/`.duration` did (one increment per real call instead of per turn), **and so did its labels**, to match `.requests`/`.duration` exactly: `gen_ai.operation.name` is now `"chat"` (was `"invoke_agent"`), `gen_ai.agent.id` is now present when known, and `gen_ai.provider.name`/`openclaw.provider` are omitted entirely when the provider is unknown (was always set, including to the literal string `"unknown"`). A panel filtering on the old `operation_name="invoke_agent"` value will silently stop matching `.tokens.*` — update it to `"chat"`, the same value `.requests`/`.duration` already use. `.cost.usd` behaves exactly as before, including its labels.

#### `collapseEphemeralSessions` (metrics only)

With `collapseEphemeralSessions: true` (see [Configuration](../configuration.md)), the `gen_ai.conversation.id` label on `openclaw.llm.requests`, `.errors`, `.duration`, `.tokens.*`, and `.cost.usd`, on `gen_ai.client.token.usage` and `gen_ai.client.operation.duration`, and on `openclaw.tool.calls`, `openclaw.tool.duration`, and `openclaw.tool.approvals` — may be a collapsed, stable job-level value instead of the full per-run session key, for session keys matching one of the two recognized ephemeral shapes (see Configuration). Trace spans and log lines are unaffected and always carry the full per-run session key for drill-down. Default `false`: this label is the raw session key everywhere, same as before this option existed.

#### `_by_model` metrics (opt-in)

With `enableByModelMetrics: true` (see [Configuration](../configuration.md)), every per-conversation LLM metric gets an additional `_by_model` sibling: same value, same attributes, but with `gen_ai.conversation.id`/`gen_ai.agent.id` dropped so the series is rate-able even for a one-shot session (see [Limitations](../limitations.md) for the `rate()`/`increase()` blind spot this fixes). Default `false` — enabling it roughly **doubles** the number of LLM metric data points this plugin emits; if your metrics backend is a managed service billed by data volume or storage, check its pricing before enabling.

This is the feature to reach for when you need a metric that's *reliably* rate-able, regardless of how often a session recurs. `collapseEphemeralSessions` can incidentally make a recurring-cron series rate-able too, once it's accumulated more than one sample across multiple runs — but that's a side effect of a dashboard-legibility feature, not guaranteed (a job that runs infrequently relative to `metricsIntervalMs`, or hasn't run twice yet, is still effectively one-shot even when collapsed). See [Limitations](../limitations.md) for the full comparison, including the one remaining gap in `enableByModelMetrics` itself (a `_by_model` series is still born flat on its very first sample per provider+model per gateway process lifetime).

| Source metric | `_by_model` sibling |
|---|---|
| `openclaw.llm.requests` | `openclaw.llm.requests_by_model` |
| `openclaw.llm.errors` | `openclaw.llm.errors_by_model` |
| `openclaw.llm.duration` | `openclaw.llm.duration_by_model` |
| `openclaw.llm.tokens.total` | `openclaw.llm.tokens.total_by_model` |
| `openclaw.llm.tokens.prompt` | `openclaw.llm.tokens.prompt_by_model` |
| `openclaw.llm.tokens.completion` | `openclaw.llm.tokens.completion_by_model` |
| `openclaw.llm.cost.usd` | `openclaw.llm.cost.usd_by_model` |
| `gen_ai.client.token.usage` (stable semconv) | `openclaw.genai.client.token.usage_by_model` |
| `gen_ai.client.operation.duration` (stable semconv) | `openclaw.genai.client.operation.duration_by_model` |

The two semconv-sourced siblings live in this plugin's own `openclaw.*` namespace rather than `gen_ai.client.*_by_model`, so the stable GenAI semconv names stay exactly spec-compliant. Tool metrics (`openclaw.tool.*`) have the same underlying blind spot but don't have a `_by_model` sibling yet.

### `openclaw.llm.requests`

| | |
|---|---|
| **Type** | Counter |
| **Unit** | requests |
| **Attributes** | `gen_ai.response.model`, `gen_ai.operation.name` (`chat`), `gen_ai.conversation.id`, `gen_ai.provider.name` + `openclaw.provider` (legacy mirror) when the provider is known, `gen_ai.agent.id` when known |
| **Description** | Total number of real LLM API calls made |

Tracks every call to Anthropic, OpenAI, or any other configured provider — one increment per real call, not per agent turn. Use this to understand request volume over time.

---

### `openclaw.llm.errors`

| | |
|---|---|
| **Type** | Counter |
| **Unit** | errors |
| **Attributes** | Same as `openclaw.llm.requests` |
| **Description** | Total number of LLM API errors |

Counts failed LLM calls (rate limits, timeouts, invalid requests, etc.). A spike here usually means rate limiting or API issues.

---

### `openclaw.llm.tokens.total`

| | |
|---|---|
| **Type** | Counter |
| **Unit** | tokens |
| **Attributes** | Same as `openclaw.llm.requests` |
| **Description** | Total tokens consumed per real model API call (prompt + completion + cache read + cache write) |

The primary token-volume metric. Combine with model information to estimate costs (see `openclaw.llm.cost.usd` for the plugin's own turn-level cost figure). Unlike `openclaw.llm.cost.usd`, this metric does **not** need the plugin's own `#166289` dedup guard — it comes from `model.call.completed`/`model.call.error`, which core itself idempotency-guards per call (a one-shot `observer.state.terminalEventEmitted` flag), a structurally different and already-safe emission path from `model.usage` (the event `#166289` actually affects).

---

### `openclaw.llm.tokens.prompt`

| | |
|---|---|
| **Type** | Counter |
| **Unit** | tokens |
| **Attributes** | Same as `openclaw.llm.tokens.total`, plus `token.type` (`cache_read`/`cache_write`) on the cache-token increments |
| **Description** | Prompt tokens consumed per real model API call |

Tracks input tokens. High prompt token counts may indicate large system prompts, long conversation histories, or excessive context injection. Note this grows with real, incremental usage turn-over-turn — in a non-caching provider, each turn in a long conversation legitimately carries more input than the last, since the full history gets resent; that's real billed usage, not double-counting.

---

### `openclaw.llm.tokens.completion`

| | |
|---|---|
| **Type** | Counter |
| **Unit** | tokens |
| **Attributes** | Same as `openclaw.llm.tokens.total` |
| **Description** | Completion tokens consumed per real model API call |

Tracks output tokens. Useful for understanding response verbosity.

---

### `openclaw.llm.duration`

| | |
|---|---|
| **Type** | Histogram |
| **Unit** | ms |
| **Attributes** | Same as `openclaw.llm.requests` |
| **Description** | Real model API call duration in milliseconds |

Latency distribution for individual LLM calls (not full agent turns — see `openclaw.agent.turn_duration` for that). Use percentiles (p50, p95, p99) to understand typical and worst-case latency.

### `openclaw.llm.cost.usd`

| | |
|---|---|
| **Type** | Counter |
| **Unit** | usd |
| **Attributes** | `gen_ai.response.model`, `gen_ai.provider.name`, `openclaw.provider` (legacy mirror), `gen_ai.operation.name` (`invoke_agent`), `gen_ai.conversation.id` |
| **Description** | Estimated LLM cost in USD, once per agent turn |

Sourced from OpenClaw core's turn-level `model.usage` diagnostic event, the only place a cost figure exists in the plugin API — recorded only when core supplies a positive `costUsd`, and dedup-guarded against the `#166289` duplicate dispatch. Missing entirely for session types where core never emits `model.usage`, and for custom/self-hosted providers core has no price table for — see [Limitations](../limitations.md). Note the different `gen_ai.operation.name` from the per-call metrics above (`invoke_agent` vs `chat`), and no `gen_ai.agent.id`.

---

### `gen_ai.client.token.usage`

| | |
|---|---|
| **Type** | Histogram (stable OTel GenAI semconv) |
| **Unit** | `{token}` |
| **Attributes** | Same as `openclaw.llm.requests`, plus `gen_ai.token.type` (`input`, `output`, `cache_read`, `cache_creation`) |
| **Description** | Tokens per real model API call, one data point per token type |

Same source and timing as `openclaw.llm.tokens.*` (the `model.call.completed`/`model.call.error` diagnostic events).

---

### `gen_ai.client.operation.duration`

| | |
|---|---|
| **Type** | Histogram (stable OTel GenAI semconv) |
| **Unit** | s |
| **Attributes** | Per-call points: same as `openclaw.llm.requests` (`gen_ai.operation.name` = `chat`). Per-turn points: `gen_ai.response.model`, `gen_ai.operation.name` = `invoke_agent`, `gen_ai.agent.id`, `openclaw.agent.id` |
| **Description** | Duration in seconds of both real model calls and whole agent turns |

Recorded from two places: once per real call (`model_call_ended`, same value as `openclaw.llm.duration` in seconds) and once per agent turn (`agent_end`, same value as `openclaw.agent.turn_duration` in seconds). **Filter or group by `gen_ai.operation.name`** — mixing the two in one percentile gives a meaningless result.

### Why can't tokens/cost be per-call too?

`openclaw.llm.requests`/`.duration` moved to a per-call hook in 0.11.0 because they don't need any usage data — a call either happened or it didn't, and timing is always available. `openclaw.llm.tokens.*` needed OpenClaw core to tell the plugin how many tokens a given call used; that didn't exist on the obvious-looking hook pair (`model_call_started`/`model_call_ended`, which deliberately carries no usage), but does exist, since v2026.9.8, on the separate `model.call.completed`/`model.call.error` diagnostic events, which this plugin adopted in 0.11.0. See `docs/limitations.md` for the full investigation and what's still turn-level only (cost).

### `openclaw.model.failover`

| | |
|---|---|
| **Type** | Counter |
| **Unit** | 1 |
| **Attributes** | `openclaw.provider`, `openclaw.model`, `openclaw.failover.to_provider`, `openclaw.failover.to_model`, `openclaw.failover.reason`, `openclaw.failover.suspended`, `openclaw.lane` — all optional, present only when the underlying event carries them |
| **Description** | OpenClaw core switched provider/model mid-session (error, rate limit, or routing policy) |

Sourced from core's own `model.failover` trusted diagnostic event (same general dispatch channel as `model.usage`; see [OpenClaw core: Model calls and exported metrics](https://docs.openclaw.ai/gateway/opentelemetry/model-calls-and-metrics)). Useful for catching real incidents as they happen instead of reconstructing them from logs after the fact — e.g. an upstream provider outage triggering an automatic fallback.

## Tool Metrics

### `openclaw.tool.calls`

| | |
|---|---|
| **Type** | Counter |
| **Unit** | calls |
| **Attributes** | `gen_ai.tool.name`, `gen_ai.operation.name` (`execute_tool`), `gen_ai.conversation.id` |
| **Description** | Total tool invocations |

Broken down by tool name. Shows which tools are used most frequently. Carries the per-conversation `gen_ai.conversation.id` label, so it has the same `rate()`/`increase()` one-shot-series caveat as the LLM metrics (and no `_by_model`-style sibling yet) — see [Limitations](../limitations.md).

**Example attribute values:** `exec`, `Read`, `Write`, `web_fetch`, `web_search`, `browser`, `memory_search`

---

### `openclaw.tool.errors`

| | |
|---|---|
| **Type** | Counter |
| **Unit** | errors |
| **Attributes** | `gen_ai.tool.name` |
| **Description** | Total tool execution errors |

Broken down by tool name. High error rates on specific tools may indicate configuration issues or external service problems.

---

### `openclaw.tool.duration`

| | |
|---|---|
| **Type** | Histogram |
| **Unit** | ms |
| **Attributes** | `gen_ai.tool.name`, `gen_ai.conversation.id` |
| **Description** | Tool execution duration in milliseconds |

How long each tool takes. Useful for identifying slow tools that bottleneck agent turns.

---

### `openclaw.tool.approvals`

| | |
|---|---|
| **Type** | Counter |
| **Unit** | approvals |
| **Attributes** | `gen_ai.tool.name`, `gen_ai.conversation.id` |
| **Description** | Tool calls that required an approval before running |

Incremented when a tool call starts with an approval requirement. The approval outcome and wait time are span attributes on the tool span (`openclaw.tool.approval.resolution`, `openclaw.tool.approval.duration_ms`), not metrics.


### `openclaw.tool.loop`

| | |
|---|---|
| **Type** | Counter |
| **Unit** | 1 |
| **Attributes** | `openclaw.toolName`, `openclaw.loop.level` (`warning`/`critical`), `openclaw.loop.action` (`warn`/`block`), `openclaw.loop.detector`, `openclaw.loop.count`, optional `openclaw.loop.paired_tool` |
| **Description** | OpenClaw core detected a repetitive tool-call loop and warned or blocked it |

Sourced from core's own `tool.loop` internal diagnostic event (same general dispatch channel as `model.usage`; see [OpenClaw core: Model calls and exported metrics](https://docs.openclaw.ai/gateway/opentelemetry/model-calls-and-metrics)). `openclaw.loop.detector` is one of `generic_repeat`, `argument_churn`, `unknown_tool_repeat`, `known_poll_no_progress`, `global_circuit_breaker`, or `ping_pong`. Useful as a runaway-agent safety signal — e.g. catching a stuck skill-workshop session looping on the same tool call instead of making progress — complementing the security-detection layer below.

## Skill Metrics

### `openclaw.skill.used`

| | |
|---|---|
| **Type** | Counter |
| **Unit** | 1 |
| **Attributes** | `openclaw.skill.name`, `openclaw.skill.source`, `openclaw.skill.activation`, optional `openclaw.agent`, optional `openclaw.toolName` |
| **Description** | A skill was invoked (via a `/command` or a bundled `Skill` tool read) |

Sourced from OpenClaw core's own `skill.used` trusted diagnostic event (same general dispatch channel as `model.usage`; see [OpenClaw core: Model calls and exported metrics](https://docs.openclaw.ai/gateway/opentelemetry/model-calls-and-metrics)). `openclaw.skill.source` is `bundled`, `workspace`, or `unknown`; `openclaw.skill.activation` is `command` or `read`. `openclaw.agent`/`openclaw.toolName` are present only when the underlying event carries them.

## Agent Metrics

### `openclaw.agent.turn_duration`

| | |
|---|---|
| **Type** | Histogram |
| **Unit** | ms |
| **Attributes** | `gen_ai.response.model`, `gen_ai.operation.name` (`invoke_agent`), `gen_ai.agent.id`, `openclaw.agent.id` |
| **Description** | Full agent turn duration (LLM + tools + processing) |

End-to-end time for a complete agent turn. This is the user-perceived latency.

---

### `openclaw.agent_turns.active`

| | |
|---|---|
| **Type** | UpDownCounter |
| **Unit** | turns |
| **Description** | Declared but currently never updated |

The instrument is created at startup, but no code path increments or decrements it, so it never reports data. Listed here so a name seen in a metrics browser isn't mistaken for a broken pipeline.

---

### `openclaw.requests.active`

| | |
|---|---|
| **Type** | UpDownCounter |
| **Unit** | requests |
| **Description** | Declared but currently never updated |

Same as `openclaw.agent_turns.active`: created, never recorded to.


## Session Metrics

### `openclaw.session.resets`

| | |
|---|---|
| **Type** | Counter |
| **Unit** | resets |
| **Attributes** | `command.source` (from the `command:new`/`command:reset` event hooks) **or** `openclaw.session.reset_reason` (from the `before_reset` typed hook) |
| **Description** | Total session resets |

Emitted from two different call sites with two different attribute keys — group by whichever one matches the code path you're inspecting; a single query against only one key will undercount.

---

### `openclaw.sessions.active`

| | |
|---|---|
| **Type** | UpDownCounter |
| **Unit** | sessions |
| **Attributes** | `openclaw.session.channel` |
| **Description** | Currently active sessions |

A gauge-like metric showing the number of active sessions at any point in time — incremented on `session_start`, decremented on `session_end`.

---

### `openclaw.session.stuck`

| | |
|---|---|
| **Type** | Counter |
| **Unit** | events |
| **Attributes** | `openclaw.session.key` |
| **Description** | Core's `session.stuck` diagnostic event fired |

---

### `openclaw.session.stuck_age_ms`

| | |
|---|---|
| **Type** | Histogram |
| **Unit** | ms |
| **Attributes** | `openclaw.session.key` |
| **Description** | Age of the stuck session when `session.stuck` fired |

---

### `openclaw.session.long_running`

| | |
|---|---|
| **Type** | Counter |
| **Unit** | events |
| **Attributes** | `openclaw.session.key` |
| **Description** | Core's `session.long_running` diagnostic event fired |

---

### `openclaw.session.stalled`

| | |
|---|---|
| **Type** | Counter |
| **Unit** | events |
| **Attributes** | `openclaw.session.key` |
| **Description** | Core's `session.stalled` diagnostic event fired |

These four carry the raw session key as a label (not collapsed by `collapseEphemeralSessions`), so they're high-cardinality by design — aggregate them away for alerting panels.

## Queue Metrics

All sourced from core's `queue.lane.enqueue`/`queue.lane.dequeue` diagnostic events.

### `openclaw.queue.lane.enqueue`

| | |
|---|---|
| **Type** | Counter |
| **Unit** | events |
| **Attributes** | `openclaw.queue.lane` (when present) |
| **Description** | Items added to a queue lane |

---

### `openclaw.queue.lane.dequeue`

| | |
|---|---|
| **Type** | Counter |
| **Unit** | events |
| **Attributes** | `openclaw.queue.lane` (when present) |
| **Description** | Items removed from a queue lane |

---

### `openclaw.queue.depth`

| | |
|---|---|
| **Type** | Histogram |
| **Unit** | items |
| **Attributes** | `openclaw.queue.lane` (when present) |
| **Description** | Lane depth, sampled on every enqueue and dequeue |

---

### `openclaw.queue.wait_ms`

| | |
|---|---|
| **Type** | Histogram |
| **Unit** | ms |
| **Attributes** | `openclaw.queue.lane` (when present) |
| **Description** | Wait time reported on enqueue |

## Gateway Health Metrics

Sourced from core's `diagnostic.liveness.warning`, `diagnostic.heartbeat`, `diagnostic.memory.sample`, and `diagnostic.memory.pressure` diagnostic events. The histograms below carry no attributes.

### `openclaw.liveness.warnings`

| | |
|---|---|
| **Type** | Counter |
| **Unit** | events |
| **Attributes** | `openclaw.diagnostic.phase` |
| **Description** | Core's `diagnostic.liveness.warning` event fired |

---

### `openclaw.diagnostic.heartbeats`

| | |
|---|---|
| **Type** | Counter |
| **Unit** | events |
| **Attributes** | `openclaw.diagnostic.phase` |
| **Description** | Core's `diagnostic.heartbeat` event fired |

---

### `openclaw.gateway.*` histograms

| Metric | Unit | Recorded from |
|---|---|---|
| `openclaw.gateway.event_loop_delay_p99` | ms | liveness warnings |
| `openclaw.gateway.event_loop_delay_max` | ms | liveness warnings |
| `openclaw.gateway.event_loop_utilization` | 1 | liveness warnings |
| `openclaw.gateway.cpu_core_ratio` | 1 | liveness warnings |
| `openclaw.gateway.work_queued` | items | liveness warnings and heartbeats |

Each is recorded only when the triggering event carries the corresponding field.

---

### `openclaw.memory.pressure`

| | |
|---|---|
| **Type** | Counter |
| **Unit** | 1 |
| **Attributes** | `openclaw.memory.reason`, `openclaw.memory.level` (each when present) |
| **Description** | Core's `diagnostic.memory.pressure` event fired |

---

### `openclaw.memory.*` histograms

| Metric | Unit |
|---|---|
| `openclaw.memory.rss_bytes` | By |
| `openclaw.memory.heap_used_bytes` | By |
| `openclaw.memory.heap_total_bytes` | By |
| `openclaw.memory.external_bytes` | By |
| `openclaw.memory.array_buffers_bytes` | By |

Recorded from the memory snapshot on both `diagnostic.memory.sample` and `diagnostic.memory.pressure` events.


## Compaction Metrics

### `openclaw.compaction.count`

| | |
|---|---|
| **Type** | Counter |
| **Unit** | events |
| **Attributes** | `openclaw.compaction.reason` |
| **Description** | Total context-compaction events |

How often the runtime compacts session context. Auto-compaction reports
`reason="auto"`. Pairs with the `openclaw.compaction` span for per-event detail.

---

### `openclaw.compaction.tokens_reclaimed`

| | |
|---|---|
| **Type** | Histogram |
| **Unit** | `{token}` |
| **Attributes** | `openclaw.compaction.reason` |
| **Description** | Tokens reclaimed by a context-compaction event (`tokens_before − tokens_after`, clamped at 0) |

Quantifies how much context each compaction frees. Recorded only when the
runtime reports both pre- and post-compaction token counts.

## Message Metrics

### `openclaw.messages.received`

| | |
|---|---|
| **Type** | Counter |
| **Unit** | messages |
| **Description** | Total inbound messages |

Counts messages received from users across all channels. Attribute: `openclaw.message.channel`.

---

### `openclaw.messages.sent`

| | |
|---|---|
| **Type** | Counter |
| **Unit** | messages |
| **Description** | Total outbound messages |

Counts messages sent by the agent across all channels. Attribute: `openclaw.message.channel`.

## Webhook Metrics

Sourced from the `webhook_received`, `webhook_processed`, and `webhook_error` hooks. Note the plural `webhooks` in the counter names and the singular `webhook` in the histogram names.

### `openclaw.webhooks.received`

| | |
|---|---|
| **Type** | Counter |
| **Unit** | events |
| **Attributes** | `openclaw.webhook.source`, `openclaw.webhook.event_type` |
| **Description** | Webhooks received |

---

### `openclaw.webhooks.processed`

| | |
|---|---|
| **Type** | Counter |
| **Unit** | events |
| **Attributes** | `openclaw.webhook.source`, `openclaw.webhook.event_type` |
| **Description** | Webhooks processed successfully |

---

### `openclaw.webhooks.errors`

| | |
|---|---|
| **Type** | Counter |
| **Unit** | errors |
| **Attributes** | `openclaw.webhook.source`, `openclaw.webhook.event_type` |
| **Description** | Webhook processing errors |

---

### `openclaw.webhook.duration`

| | |
|---|---|
| **Type** | Histogram |
| **Unit** | ms |
| **Attributes** | `openclaw.webhook.source`, `openclaw.webhook.event_type` |
| **Description** | Webhook processing duration (recorded on success and on error) |

---

### `openclaw.webhook.payload_size`

| | |
|---|---|
| **Type** | Histogram |
| **Unit** | bytes |
| **Attributes** | `openclaw.webhook.source` |
| **Description** | Size of a received webhook payload, when reported |

## Cron Metrics

Sourced from the `cron_changed` and `cron_executed` hooks.

### `openclaw.cron.changes`

| | |
|---|---|
| **Type** | Counter |
| **Unit** | events |
| **Attributes** | `openclaw.cron.job_name`, `openclaw.cron.action` |
| **Description** | Cron job definition changes |

---

### `openclaw.cron.executions`

| | |
|---|---|
| **Type** | Counter |
| **Unit** | events |
| **Attributes** | `openclaw.cron.job_name`, `openclaw.cron.trigger` |
| **Description** | Cron job runs |

---

### `openclaw.cron.errors`

| | |
|---|---|
| **Type** | Counter |
| **Unit** | errors |
| **Attributes** | `openclaw.cron.job_name` |
| **Description** | Failed cron job runs |

---

### `openclaw.cron.duration`

| | |
|---|---|
| **Type** | Histogram |
| **Unit** | ms |
| **Attributes** | `openclaw.cron.job_name`, `openclaw.cron.trigger` |
| **Description** | Cron job run duration, when reported |

## Sub-agent Metrics

Sourced from the `subagent_spawned` (or legacy `subagent_spawning`) and `subagent_ended` hooks.

### `openclaw.subagent.spawns`

| | |
|---|---|
| **Type** | Counter |
| **Unit** | events |
| **Attributes** | `openclaw.subagent.child_agent_name`, `openclaw.subagent.spawn_reason` |
| **Description** | Sub-agents spawned |

---

### `openclaw.subagent.ended`

| | |
|---|---|
| **Type** | Counter |
| **Unit** | events |
| **Attributes** | `openclaw.subagent.child_agent_name`, `openclaw.subagent.success` |
| **Description** | Sub-agents finished |

---

### `openclaw.subagent.duration`

| | |
|---|---|
| **Type** | Histogram |
| **Unit** | ms |
| **Attributes** | `openclaw.subagent.child_agent_name`, `gen_ai.response.model` |
| **Description** | Sub-agent run duration |


## Security Metrics

### `openclaw.security.events`

| | |
|---|---|
| **Type** | Counter |
| **Unit** | events |
| **Attributes** | `detection`, `severity` |
| **Description** | Total security events detected across all detection types |

The umbrella counter for all security detections. Use `detection` to filter by type (`sensitive_file_access`, `prompt_injection`, `dangerous_command`) and `severity` to filter by level (`critical`, `high`, `warning`).

---

### `openclaw.security.sensitive_file_access`

| | |
|---|---|
| **Type** | Counter |
| **Unit** | events |
| **Attributes** | `file_pattern` |
| **Description** | Attempts to access sensitive files (credentials, SSH keys, .env, etc.) |

Triggers when the agent reads, writes, or edits files matching sensitive patterns (`.env`, `.ssh/`, `credentials`, `api_key`, etc.). The `file_pattern` attribute contains the regex source that matched.

---

### `openclaw.security.prompt_injection`

| | |
|---|---|
| **Type** | Counter |
| **Unit** | events |
| **Attributes** | `pattern_count` |
| **Description** | Prompt injection attempts detected in inbound messages |

Detects social engineering patterns like "ignore previous instructions", fake `[SYSTEM]` tags, role manipulation ("pretend you are"), and jailbreak attempts. The `pattern_count` attribute shows how many patterns matched (more = higher confidence).

---

### `openclaw.security.dangerous_command`

| | |
|---|---|
| **Type** | Counter |
| **Unit** | events |
| **Attributes** | `command_type` |
| **Description** | Dangerous shell command executions detected |

Catches data exfiltration (`curl -d`, `nc -e`), destructive commands (`rm -rf /`, `mkfs`), privilege escalation (`chmod +s`), crypto mining (`xmrig`), and persistence mechanisms (`crontab`, `.bashrc` modification). The `command_type` attribute describes the matched threat.

---

## Dashboard Examples

### Token Usage Over Time

Track cost by monitoring `openclaw.llm.tokens.total` over time. In Dynatrace:

```
timeseries sum(openclaw.llm.tokens.total), by:{gen_ai.response.model}
```

### Cost by Model Over Time (rate-able, including one-shot sessions — requires enableByModelMetrics: true)

```
sum by (gen_ai_response_model) (increase(openclaw_llm_cost_usd_by_model[$__rate_interval]))
```

### LLM Latency Percentiles

```
timeseries percentile(openclaw.llm.duration, 50, 95, 99)
```

### Tool Error Rate

```
timeseries sum(openclaw.tool.errors) / sum(openclaw.tool.calls) * 100, by:{gen_ai.tool.name}
```

### Most Used Tools

```
timeseries sum(openclaw.tool.calls), by:{gen_ai.tool.name}
```

### Security Events Over Time

```
timeseries sum(openclaw.security.events), by:{detection, severity}
```

### Sensitive File Access by Pattern

```
timeseries sum(openclaw.security.sensitive_file_access), by:{file_pattern}
```

### Dangerous Commands by Type

```
timeseries sum(openclaw.security.dangerous_command), by:{command_type}
```

### Prompt Injection Attempts

```
timeseries sum(openclaw.security.prompt_injection), by:{pattern_count}
```
