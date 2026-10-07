# Limitations

## Official diagnostics-otel Plugin Dependency Issue

When OpenClaw is installed via **npm** (not pnpm from source), the bundled `@openclaw/diagnostics-otel` plugin may fail to load with:

```
Error: Cannot find module '@opentelemetry/api'
```

**Why:** The official plugin uses `workspace:*` dependency protocol (pnpm monorepo feature) that doesn't resolve when installed via npm.

**Workaround:** Use this custom plugin instead, which has its own properly installed OTel dependencies.

**Note:** Don't run both plugins simultaneously — they both initialize the OTel SDK which can cause conflicts.

---

## Auto-Instrumentation Limitations

## No Zero-Code Auto-Instrumentation (and no per-call token/cost data, even via hooks)

The plugin cannot auto-instrument the Anthropic/OpenAI SDKs themselves (e.g. monkey-patching `anthropic.chat` or `openai.chat.completions.create` the way a traditional OTel auto-instrumentation package would). That's a real, structural limitation of OpenClaw's ESM module architecture — see "Why?" below.

That's different from per-call visibility, though, which **is** available, in two separate ways. OpenClaw core exposes `model_call_started`/`model_call_ended` typed hook events, fired once per real model API call (not once per agent turn), and this plugin has used them since ISI-926 to produce a per-call `chat {model}` span alongside the aggregated `openclaw.agent.turn` span, plus (0.11.0+) `openclaw.llm.requests`/`.duration`. Separately, OpenClaw also emits `model.call.completed`/`model.call.error` *internal diagnostic events* (a different mechanism, via `onInternalDiagnosticEvent`, not the hook pair above) — confirmed, as of OpenClaw v2026.9.8, to carry genuine call-scoped usage (`observer.usageField()`, read from that call's own terminal provider response). This plugin uses that (0.12.0+) for `openclaw.llm.tokens.*` — real per-call token counts, not turn aggregates.

**Cost is still turn-level only.** No OpenClaw plugin API — the hook pair, the diagnostic events above, or anything else — exposes a per-call cost figure; `model.usage` (the turn-aggregated event) remains the only source for `openclaw.llm.cost.usd`. A feature request asking core to expose real per-call token usage was filed as [openclaw/openclaw#166623](https://github.com/openclaw/openclaw/issues/166623) and closed upstream as already-implemented via the diagnostic-events mechanism above — correctly, once we checked; per-call cost remains unaddressed by that issue or any other known mechanism.

**Codex/ACP-harness sessions may have no token metrics at all (unconfirmed, flagged not fixed).** Codex-harness model calls are already known to emit no `model.usage` at all — a structurally separate code path from the native embedded-agent-runner this plugin's per-call instrumentation targets (see the open items tracked alongside this project). Before 0.12.0, those turns still got *some* token metrics, because the `agent_end` hook fallback this release removed parsed `usage` straight out of the turn's own `messages` array, independent of either diagnostic source. Whether `model.call.completed`/`model.call.error` fire for Codex-harness calls the way they do for the native path hasn't been verified — if they don't, `openclaw.llm.tokens.*` now silently reports nothing for those sessions, a regression from the old (if also schema-broken) fallback. Needs a live check on a Codex-harness-routed session; until then, don't assume parity with the native path for this one case.

### What You Get vs. What's Missing

| Capability | Status | Details |
|---|---|---|
| Token usage per real call | ✅ (0.12.0+) | `openclaw.llm.tokens.*` from `model.call.completed`/`model.call.error` diagnostic events — requires OpenClaw v2026.9.8+ |
| Token usage per agent turn | ✅ | Still available too: `gen_ai.usage.input_tokens`/`.output_tokens` on `openclaw.agent.turn`, from `model.usage` |
| Model name | ✅ | `gen_ai.response.model` on both the turn span and each per-call span |
| Cache token tracking | ✅ (0.12.0+) | `cacheRead`/`cacheWrite` now per real call, same source as token usage above |
| Per-call spans | ✅ | `chat {model}` CLIENT span per real call, via `model_call_started`/`model_call_ended` |
| Per-call request count & latency | ✅ | `openclaw.llm.requests`/`.duration` (0.11.0+) |
| Cost per real call | ❌ | Only available per agent turn, from `model.usage` — core has no per-call price lookup anywhere |
| Request/response content | ❌ | No prompt/completion text capture on LLM calls |
| Standard GenAI dashboards | ⚠️ | Custom dashboards needed (not standard `gen_ai.*` span shape) |
| Zero-code SDK auto-instrumentation | ❌ | Would require patching `@anthropic-ai/sdk`/OpenAI SDK directly — see below for why that's not viable here |

### Why no zero-code auto-instrumentation?

We attempted three approaches. All failed due to OpenClaw's ESM module architecture.

#### Approach 1: Plugin-Side SDK Patching

OpenClaw's plugin loader uses **jiti** (a CJS-compatible TypeScript loader). The `@anthropic-ai/sdk` package has **dual entry points**:

- **ESM:** `@anthropic-ai/sdk/index.mjs` — loaded by `@mariozechner/pi-ai` (OpenClaw's LLM provider) via `import`
- **CJS:** `@anthropic-ai/sdk/index.js` — loaded by the plugin via `createRequire()`

These are completely separate module instances with different prototypes. Patching the CJS version has zero effect on the ESM instance that actually handles LLM calls.

Additionally, jiti blocks native `import()` calls (`ERR_VM_DYNAMIC_IMPORT_CALLBACK_MISSING`), making it impossible to access the ESM instance from plugin code.

#### Approach 2: NODE_OPTIONS Preload with IITM

The standard OpenTelemetry approach for ESM instrumentation:

```bash
NODE_OPTIONS="--import ./instrumentation/preload.mjs"
```

This uses [import-in-the-middle](https://github.com/DataDog/import-in-the-middle) (IITM) to register ESM loader hooks that intercept module imports. However, IITM intercepts **all** ESM modules globally — not just the targeted ones.

When IITM wraps `@mariozechner/pi-ai`, it breaks the module's named exports:

```
SyntaxError: The requested module '@mariozechner/pi-ai' does not
provide an export named 'getEnvApiKey'
```

This crash-loops the gateway on startup.

#### Approach 3: Manual register() with IITM

Using `register()` from `node:module` to manually install IITM loader hooks produces the same crash — the hooks are global and cannot selectively skip modules.

### Environment

- Node.js v22.22.0
- `@opentelemetry/instrumentation` 0.203.0
- `import-in-the-middle` 1.15.0
- `@anthropic-ai/sdk` 0.71.2

### Path Forward

Items 1 and 2 below have since shipped — 1 as OpenClaw core's `model_call_started`/`model_call_ended` typed hooks (ISI-926), 2 via a different mechanism than originally investigated (`model.call.completed`/`model.call.error` diagnostic events, not the hook pair). What's left unsolved:

1. ~~**LLM call events on the plugin API**~~ — done, see above.
2. ~~**Per-call token data**~~ — done (0.12.0+), via `model.call.completed`/`model.call.error`, not the hook pair originally investigated. [openclaw/openclaw#166623](https://github.com/openclaw/openclaw/issues/166623) closed upstream on this basis.
3. **Per-call cost data** — no mechanism found anywhere in the plugin API, including the one that solved per-call tokens. Still the single remaining gap.
4. **Built-in OTel hook in pi-ai** — a callback around the actual SDK call in the provider layer
5. **Fix IITM compatibility** — investigate why IITM breaks `@mariozechner/pi-ai` exports
6. **Native OTel support** — bundle instrumentation directly in OpenClaw where it can control the loader lifecycle

Until 3-6 are addressed, this plugin's hook-and-diagnostic-event-based approach is the viable path for this ecosystem — zero-code SDK patching isn't — but cost reporting stays capped at agent-turn granularity regardless of how this plugin is built; that's an OpenClaw platform limitation, not a plugin engineering problem.

---

## Loki backends may not show a real `service_name` label

Some Loki-backed OTLP ingestion pipelines (confirmed with IONOS Cloud Observability's Logging Service) do not map the OTel `service.name` resource attribute into a Loki stream label — every log stream shows `service_name="unknown_service"` in Grafana regardless of what `serviceName` this plugin's config sets. This is not a plugin bug: the plugin sets `service.name` identically on the metrics, trace, and log `Resource` (see `src/telemetry.ts` and `src/logs.ts`), and metrics/traces on the same backend correctly carry service identity. The gap is specific to how that Loki pipeline maps OTLP resource attributes to stream labels. Workaround: use the pipeline's own fixed `tag` (or another label the pipeline does propagate) for service identification in Loki queries/dashboards, and put `service.name` in the log body/structured attributes if you need it visible per-record.

---

## `gen_ai_provider_name` may be missing or inconsistent

Some token-usage metrics and spans are missing the `gen_ai_provider_name` label, or carry it inconsistently across calls to the exact same model/session. Confirmed present for both Anthropic-native and IONOS-routed (Qwen) calls, which rules out a per-backend cause. The plugin reads `event.provider`/`ctx.provider` from OpenClaw core's own `model.usage` event at every call site (see `src/hooks.ts`) and has no independent, reliable signal to backfill from when core omits it. Likely root cause is upstream in OpenClaw core, tracked as [openclaw/openclaw#153244](https://github.com/openclaw/openclaw/issues/153244). Workaround: group Grafana panels/queries by `gen_ai_response_model` instead of `gen_ai_provider_name` until core's event is fixed.
