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

That's different from per-call visibility, though, which **is** available, in two separate ways. OpenClaw core exposes `model_call_started`/`model_call_ended` typed hook events, fired once per real model API call (not once per agent turn), and this plugin has used them since ISI-926 to produce a per-call `chat {model}` span alongside the aggregated `openclaw.agent.turn` span, plus (0.11.0+) `openclaw.llm.requests`/`.duration`. Separately, OpenClaw also emits `model.call.completed`/`model.call.error` *internal diagnostic events* (a different mechanism, via `onInternalDiagnosticEvent`, not the hook pair above) — confirmed, as of OpenClaw v2026.9.8, to carry genuine call-scoped usage (`observer.usageField()`, read from that call's own terminal provider response). This plugin uses that (0.11.0+) for `openclaw.llm.tokens.*` — real per-call token counts, not turn aggregates.

**Cost is still turn-level only.** No OpenClaw plugin API — the hook pair, the diagnostic events above, or anything else — exposes a per-call cost figure; `model.usage` (the turn-aggregated event) remains the only source for `openclaw.llm.cost.usd`. A feature request asking core to expose real per-call token usage was filed as [openclaw/openclaw#166623](https://github.com/openclaw/openclaw/issues/166623) and closed upstream as already-implemented via the diagnostic-events mechanism above — correctly, once we checked; per-call cost remains unaddressed by that issue or any other known mechanism.

**Codex/ACP-harness sessions may have no token metrics at all (unconfirmed, flagged not fixed).** Codex-harness model calls are already known to emit no `model.usage` at all — a structurally separate code path from the native embedded-agent-runner this plugin's per-call instrumentation targets. Before 0.11.0, those turns still got *some* token metrics, because the `agent_end` hook fallback this release removed parsed `usage` straight out of the turn's own `messages` array, independent of either diagnostic source. Whether `model.call.completed`/`model.call.error` fire for Codex-harness calls the way they do for the native path hasn't been verified — if they don't, `openclaw.llm.tokens.*` now silently reports nothing for those sessions, a regression from the old (if also schema-broken) fallback. Needs a live check on a Codex-harness-routed session; until then, don't assume parity with the native path for this one case.

### What You Get vs. What's Missing

| Capability | Status | Details |
|---|---|---|
| Token usage per real call | ✅ (0.11.0+) | `openclaw.llm.tokens.*` from `model.call.completed`/`model.call.error` diagnostic events — requires OpenClaw v2026.9.8+ |
| Token usage per agent turn | ✅ | Still available too: `gen_ai.usage.input_tokens`/`.output_tokens` on `openclaw.agent.turn`, from `model.usage` |
| Model name | ✅ | `gen_ai.response.model` on both the turn span and each per-call span |
| Cache token tracking | ✅ (0.11.0+) | `cacheRead`/`cacheWrite` now per real call, same source as token usage above |
| Per-call spans | ✅ | `chat {model}` CLIENT span per real call, via `model_call_started`/`model_call_ended` |
| Per-call request count & latency | ✅ | `openclaw.llm.requests`/`.duration` (0.11.0+) |
| Cost per real call | ❌ | Only available per agent turn, from `model.usage` — core has no per-call price lookup anywhere |
| Request/response content | ✅ (opt-in) | Off by default. The `captureContent` option records prompt, completion, system-prompt, and tool I/O text on this plugin's spans (redacted, then truncated), and the optional ESM preload adds Traceloop LLM-client spans — see [Privacy](./security/privacy.md) |
| Standard GenAI dashboards | ⚠️ | Spans and metrics carry stable OTel GenAI semconv attributes (`gen_ai.provider.name`, `gen_ai.response.model`, `gen_ai.usage.*`, ...), model-call and tool spans use the semconv `chat <model>`/`execute_tool <name>` names, and the stable `gen_ai.client.token.usage`/`.operation.duration` histograms are emitted. The request/session/turn spans are `openclaw.*`-named, though, so a prebuilt GenAI dashboard that keys on span names may need adjusting |
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
2. ~~**Per-call token data**~~ — done (0.11.0+), via `model.call.completed`/`model.call.error`, not the hook pair originally investigated. [openclaw/openclaw#166623](https://github.com/openclaw/openclaw/issues/166623) closed upstream on this basis.
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

---

## Cost reporting can silently go missing for some session types (OpenClaw core, not this plugin)

`openclaw.llm.cost.usd` comes entirely from OpenClaw core's own `model.usage` diagnostic event — this plugin has no independent accounting and only relays what core emits. That event does not fire at all for several confirmed session shapes, each tracked upstream as its own issue since the trigger conditions are distinct:

- **Sessions running under a per-channel/topic model override** — [openclaw/openclaw#164562](https://github.com/openclaw/openclaw/issues/164562).
- **Internal/background agent-turn sessions** spawned by core itself (scheduled maintenance tasks, memory-effect turns), independent of any model override — [openclaw/openclaw#169156](https://github.com/openclaw/openclaw/issues/169156).
- **Continuation steps within a multi-call tool-use turn**, correlated with the `messages.groupChat.visibleReplies` channel setting — [openclaw/openclaw#167920](https://github.com/openclaw/openclaw/issues/167920).

In every case, real per-call token counts still arrive correctly via the separate `model.call.completed`/`model.call.error` diagnostic events (see [Telemetry → Tokens](./telemetry/tokens.md)) — only cost goes missing, because cost is the only metric still tied to `model.usage`. If a dashboard shows tokens with no matching cost for a session, this is almost always why.

A related, separate defect — `model.usage` occasionally double-firing for the exact same real call, inflating cost/tokens — was root-caused to a plugin-side gap (a second, independent module instance loaded during a core-internal read-only pass could receive the same event dispatch) and fixed in this plugin as of the `registrationMode`-based `register()` gate (see `CHANGELOG.md`). That one *was* this plugin's responsibility and is closed; the gaps above are not — there's no plugin-side workaround for an event that core never emits.

**A broader, related gap: OpenClaw's built-in `openclaw` system/custodian agent emits almost no telemetry at all, not just missing cost.** Turns running under this agent (`agentId: "openclaw"`, sessions namespaced `agent:openclaw:openclaw-<uuid>`, the agent backing system setup/config/doctor-style operations — not a user-facing conversation) appear to produce no mid/end-of-turn instrumentation beyond the initial `before_model_resolve` hook and the resulting agent-turn span: no `model_call_started`, no tool-call spans, no `model.usage`, no `agent_end`. Unlike the gaps above, tokens don't arrive correctly either here — the entire post-`before_model_resolve` pipeline appears silent for this agent. Tracked as [openclaw/openclaw#169158](https://github.com/openclaw/openclaw/issues/169158). Core's own triage has independently confirmed the narrower claim (missing `model.usage` settlement for this agent) but flagged the broader "every downstream hook is silent" claim as needing a live reproduction before fully crediting it — treat the full extent of this one as not yet fully confirmed. Low practical impact either way: this affects observability into OpenClaw's own internal setup/maintenance operations, not visibility into real conversational usage or cost.

**`costUsd` can be missing even for mainstream, first-party-hosted providers** — this is wider than it first looks, and worth separating into two genuinely different causes.

**Structural case: custom/self-hosted OpenAI-compatible endpoints.** These always report `costUsd: undefined`, tokens unaffected. No fix is possible, on the plugin side or otherwise: the OpenAI Chat Completions API spec has no cost field at all, ever, only a token-count `usage` object. There is nothing for OpenClaw core to resolve a price from.

**Catalog-coverage case: any other provider, including well-known hosted ones.** `costUsd` for a normal, non-custom model call depends entirely on OpenClaw core resolving a per-token price for that exact model ID — and core has **no bundled, maintained price table of its own**. It resolves pricing at runtime from a set of external, independently-maintained third-party aggregators (OpenCode/models.dev's catalog, OpenRouter, Venice, Chutes, Cerebras, DeepInfra, and LiteLLM's community-maintained pricing JSON on GitHub — see `model-catalog-pricing.ts` in OpenClaw core). If a model's exact ID isn't currently listed with pricing in any of those, cost silently comes back `undefined` — tokens are unaffected, since those come from a separate event entirely. Confirmed live: Google's Gemini models (`gemini-3.1-pro-preview` specifically, a brand-name hosted provider, not a custom endpoint) had no auto-resolved cost on a real gateway, because that model ID wasn't yet carried by any of the aggregators core queries. Preview/newly-released model IDs are the likeliest to hit this; well-established ones (e.g. most Anthropic/OpenAI model IDs) are usually covered.

**Fix (this one has one): define the model's cost manually.** Add the model under `models.providers.<provider>.models[]` in `openclaw.json` with an explicit `cost` object — `input`/`output`/`cacheRead`/`cacheWrite`, each a USD rate per million tokens — and OpenClaw core resolves pricing from that instead of the external catalogs. For a provider with context-length-tiered pricing (Gemini's real-world pricing roughly doubles past a 200K-token prompt), core also supports a `tieredPricing` array alongside the flat rates:

```json
"cost": {
  "input": 2, "output": 12, "cacheRead": 0.2, "cacheWrite": 0,
  "tieredPricing": [
    { "input": 4, "output": 18, "cacheRead": 0.4, "cacheWrite": 0, "range": [200000] }
  ]
}
```

This is a real, fully-implemented OpenClaw core schema field, not a Google-specific or provider-specific invention — confirmed directly in the installed package's cost-resolution code (`usage-cost-*.mjs`'s `selectPricingRates`): tiers are sorted by `range[0]`, and the tier whose range contains the call's total `input + cacheRead + cacheWrite` token count is selected and used for that call's pricing, independent of provider. `range` takes one or two numbers (`[start]` for an open-ended top tier, `[start, end]` for a bounded one); the base `cost` object above acts as the first/lowest tier. Once defined this way, this plugin (which only relays whatever `costUsd` core resolves and attaches no pricing logic of its own) reports it correctly — the fix lives entirely in `openclaw.json`'s model definition, not in this repo.

---

## `rate()`/`increase()` queries can show zero even though the data arrived correctly

This one is easy to mistake for a missing-metric bug (like the section above), but it's a PromQL/label-cardinality effect, not a reporting gap — the data point is really there, an instant query finds it, and only windowed-rate queries show nothing.

**Why it happens:** `openclaw.llm.cost.usd` and the per-call `openclaw.llm.tokens.*` metrics carry `gen_ai.conversation.id` as a label, which is unique per conversation/session by design — that's what makes it possible to look up a single session's cost/tokens at all. But a Prometheus/Mimir time series is identified by its *full* label set, and `rate()`/`increase()` work by diffing two samples of the *same* series over a window. If a conversation only ever produces one export for that label combination — which is exactly what happens for an **isolated session that runs once and exits** (cron/scheduled jobs with `sessionTarget: "isolated"`, one-shot system/background turns) — the series is born with one sample at its final value and never gets a second one to diff against, at any window width. `increase()` evaluates this per full-label series *before* any `sum by (...)` aggregation runs, so the series contributes exactly `0` to a coarser query too (e.g. `sum by (gen_ai_response_model) (increase(openclaw_llm_cost_usd[$__rate_interval]))`) — silently, with no visible empty row to flag it. An instant query (or Mimir/Prometheus's series API) against the same series shows the real value with no trouble.

**This isn't unique to isolated/one-shot sessions.** Any conversation whose LLM calls all land inside a single metrics-export interval (`metricsIntervalMs`, 30s default) hits the same blind spot even with per-call instrumentation (0.11.0+) — a two-call burst that completes within one export tick still produces only one sample for that conversation's series. Per-call instrumentation only escapes this when a conversation's calls are spread across more than one export tick.

**Workaround:** for trend/dashboard panels that don't need per-conversation granularity, query with an instant/last-value approach (e.g. `sum by (gen_ai_response_model) (openclaw_llm_cost_usd)` without `increase()`/`rate()`, read as a running total rather than a delta) or pre-aggregate outside Prometheus. There's no query-side fix that preserves both per-conversation lookup and a reliable windowed delta from the same metric — the label that makes lookup possible is exactly the label that makes the series one-shot.

**Fixed for LLM metrics as of `0.12.0`, opt-in — with one remaining gap.** Every per-conversation LLM metric now has a `_by_model` sibling (`enableByModelMetrics: true`, see [Configuration](./configuration.md)) — same value, same attributes, but with `gen_ai.conversation.id`/`gen_ai.agent.id` dropped, so the series accumulates across every call to that provider+model instead of starting fresh per conversation:

```
sum by (gen_ai_response_model) (increase(openclaw_llm_cost_usd_by_model[$__rate_interval]))
```

This closes the blind spot for the case it's meant for — a `_by_model` series for a given provider+model keeps accumulating samples across every conversation that uses it, for as long as the gateway process runs, so a one-shot session's contribution lands on an already-warm series and is immediately diffable. It does **not** eliminate the underlying mechanism entirely: a `_by_model` series is still born flat on its very first sample, same as any series — so a provider+model used for the first time since the last gateway restart (or a `token.type`/error variant seen for the first time) still contributes `0` to a windowed query exactly once, the same way the raw per-conversation metric always does. In practice this shrinks the blind spot from "once per conversation, forever" to "once per provider+model (and `token.type`) per gateway process lifetime" — a much smaller window, but not strictly zero. See [Metrics Reference](./telemetry/metrics.md#_by_model-metrics-opt-in) for the full list of 9 siblings. Off by default: enabling it roughly doubles the number of LLM metric data points this plugin emits, which has a direct cost impact if your metrics backend is a managed service billed by data volume or storage — check its pricing before enabling. Tool metrics (`openclaw.tool.*`) have the same blind spot but don't have a `_by_model` sibling yet.

**`collapseEphemeralSessions` can incidentally help too, but isn't the fix to reach for.** That option (see [Configuration](./configuration.md)) exists as a dashboard-*legibility* feature — fewer, more readable rows for a recurring job's "tokens by session" panel — not as a fix for this blind spot. As a side effect, once a recurring job's collapsed series has accumulated more than one sample across multiple runs, that series does become diffable the same way any multi-sample series is. But this isn't guaranteed: a collapsed series can still be effectively one-shot if the underlying job runs infrequently relative to `metricsIntervalMs`, or if it's the collapsed series' very first run. If what you actually need is a metric that's reliably rate-able regardless of how often a session recurs, reach for `enableByModelMetrics` above — that's the feature built specifically for this problem, not `collapseEphemeralSessions`.
