# Metrics Reference

All metrics use the `openclaw.*` namespace and are exported via OTLP at the configured interval (default: 30 seconds).

## LLM Metrics

> **0.11.0+:** `openclaw.llm.requests` and `.duration` record once per real model API call, from the `model_call_started`/`model_call_ended` hook pair, instead of once per **agent turn** from the `model.usage` diagnostic event (a turn may cover several real calls in a tool-use loop).
>
> **0.12.0+ (requires OpenClaw v2026.9.8+):** `openclaw.llm.tokens.*` (prompt/completion/total, including the cache_read/cache_write breakdown) also moved to a per-call source — `model.call.completed`/`model.call.error` *diagnostic events* (via `onInternalDiagnosticEvent`, a different mechanism than the hook pair above). These carry genuine call-scoped usage (`observer.usageField()`) confirmed since that release; the hook pair itself still carries none. `openclaw.llm.cost.usd` is unchanged — still once per agent turn, from `model.usage` — because no per-call cost field exists anywhere in OpenClaw's plugin API. If you're upgrading a dashboard or alert built against pre-0.12.0 semantics: `.tokens.*` cardinality changed the same way `.requests`/`.duration` did in 0.11.0 (one increment per real call instead of per turn); `.cost.usd` behaves exactly as before.

### `openclaw.llm.requests`

| | |
|---|---|
| **Type** | Counter |
| **Unit** | requests |
| **Attributes** | `gen_ai.response.model`, `gen_ai.conversation.id`, `gen_ai.provider.name` (when known), `openclaw.provider` (legacy mirror) |
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
| **Attributes** | `gen_ai.response.model`, `gen_ai.conversation.id`, `gen_ai.provider.name` (when known) |
| **Description** | Total tokens consumed per agent turn (prompt + completion + cache read + cache write) |

The primary cost metric. Combine with model information to estimate costs. Deduplicated (0.11.0+) against a known core bug ([openclaw/openclaw#166289](https://github.com/openclaw/openclaw/issues/166289)) where the underlying `model.usage` event occasionally dispatches twice for the same real completion.

---

### `openclaw.llm.tokens.prompt`

| | |
|---|---|
| **Type** | Counter |
| **Unit** | tokens |
| **Attributes** | Same as `openclaw.llm.tokens.total`, plus `token.type` (`cache_read`/`cache_write`) on the cache-token increments |
| **Description** | Prompt tokens consumed per agent turn |

Tracks input tokens. High prompt token counts may indicate large system prompts, long conversation histories, or excessive context injection. Note this grows with real, incremental usage turn-over-turn — in a non-caching provider, each turn in a long conversation legitimately carries more input than the last, since the full history gets resent; that's real billed usage, not double-counting.

---

### `openclaw.llm.tokens.completion`

| | |
|---|---|
| **Type** | Counter |
| **Unit** | tokens |
| **Attributes** | Same as `openclaw.llm.tokens.total` |
| **Description** | Completion tokens consumed per agent turn |

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

### Why can't tokens/cost be per-call too?

`openclaw.llm.requests`/`.duration` moved to a per-call hook in 0.11.0 because they don't need any usage data — a call either happened or it didn't, and timing is always available. `openclaw.llm.tokens.*` needed OpenClaw core to tell the plugin how many tokens a given call used; that didn't exist on the obvious-looking hook pair (`model_call_started`/`model_call_ended`, which deliberately carries no usage), but does exist, since v2026.9.8, on the separate `model.call.completed`/`model.call.error` diagnostic events, which this plugin adopted in 0.12.0. See `docs/limitations.md` for the full investigation and what's still turn-level only (cost).

## Tool Metrics

### `openclaw.tool.calls`

| | |
|---|---|
| **Type** | Counter |
| **Unit** | calls |
| **Attributes** | `gen_ai.tool.name` |
| **Description** | Total tool invocations |

Broken down by tool name. Shows which tools are used most frequently.

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
| **Attributes** | `gen_ai.tool.name` |
| **Description** | Tool execution duration in milliseconds |

How long each tool takes. Useful for identifying slow tools that bottleneck agent turns.

## Agent Metrics

### `openclaw.agent.turn_duration`

| | |
|---|---|
| **Type** | Histogram |
| **Unit** | ms |
| **Description** | Full agent turn duration (LLM + tools + processing) |

End-to-end time for a complete agent turn. This is the user-perceived latency.

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
| **Description** | Currently active sessions |

A gauge-like metric showing the number of active sessions at any point in time.

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

Counts messages received from users across all channels.

---

### `openclaw.messages.sent`

| | |
|---|---|
| **Type** | Counter |
| **Unit** | messages |
| **Description** | Total outbound messages |

Counts messages sent by the agent across all channels.

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
timeseries avg(openclaw.llm.tokens.total), by:{gen_ai.request.model}
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
