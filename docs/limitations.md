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

That's different from per-call visibility, though, which is *partially* available: OpenClaw core exposes `model_call_started`/`model_call_ended` typed hook events, fired once per real model API call (not once per agent turn), and this plugin has used them since ISI-926 to produce a per-call `chat {model}` span alongside the aggregated `openclaw.agent.turn` span. As of 0.11.0, the same hook pair also drives `openclaw.llm.requests`/`.duration` (see `docs/telemetry/metrics.md`) — real per-call request counts and latency, independent of whether tracing is even enabled (the hook fires regardless of `traces`/`metrics` config).

**Token usage and cost are a separate story, and do not have per-call granularity anywhere in OpenClaw's current plugin API** — this was investigated directly in 0.11.0-dev, not assumed. `model_call_ended`'s real event payload was captured live in production and confirmed to carry no usage field at all; its documented purpose is "sanitized provider/model call metadata: timing, outcome, bounded request-id hashes... no prompt or response content" (OpenClaw's own hook reference) — this is deliberate, not a bug or a version-specific gap. The other hook with documented `usage` support, `llm_output`, was also checked live: it reports the exact same turn-aggregated numbers as `model.usage`, not real per-call ones. So token/cost metrics and the `chat {model}` span's own usage attributes all stay at agent-turn granularity — a real ceiling on what this plugin can report, not something more engineering effort here would fix. A feature request asking OpenClaw core to expose real per-call usage has been filed (see `STATUS.md` in the fork's tracking repo for the link once filed); don't expect it soon.

### What You Get vs. What's Missing

| Capability | Status | Details |
|---|---|---|
| Token usage per agent turn | ✅ | `gen_ai.usage.input_tokens`/`.output_tokens` on `openclaw.agent.turn` and `openclaw.llm.call`; `openclaw.llm.tokens.*` metrics |
| Token usage per real call | ❌ | Not available anywhere in OpenClaw's plugin API — see above. The `chat {model}` span exists (per real call) but has no usage attributes to show, since `model_call_ended` carries none |
| Model name | ✅ | `gen_ai.response.model` on both the turn span and each per-call span |
| Cache token tracking | ✅ | `cacheRead`/`cacheWrite` (aka `cache_read_input_tokens`/`cache_creation_input_tokens`) — per agent turn only, same limitation as above |
| Per-call spans | ✅ | `chat {model}` CLIENT span per real call, via `model_call_started`/`model_call_ended` (timing/model/provider only, no usage) |
| Per-call request count & latency | ✅ | `openclaw.llm.requests`/`.duration` (0.11.0+) — these don't need usage data, so they could move to the per-call hook |
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

Item 1 below has since shipped as OpenClaw core's `model_call_started`/`model_call_ended` typed hooks (ISI-926), which this plugin uses for per-call spans and (0.11.0+) per-call request-count/duration metrics — see above. That closes part of the per-call-granularity gap this section used to describe; what's left unsolved:

1. ~~**LLM call events on the plugin API** — emit `llm_call_start`/`llm_call_end` events so plugins can create per-call spans without monkey-patching~~ — done, see above.
2. **Per-call token/cost data on those events** — `model_call_started`/`model_call_ended` exist and fire per real call, but deliberately carry no usage/cost data (confirmed via live capture + OpenClaw's own hook docs, 0.11.0-dev). A feature request has been filed upstream asking for this; it's the single biggest remaining gap in this plugin's observability, and not something fixable without an OpenClaw core change.
3. **Built-in OTel hook in pi-ai** — a callback around the actual SDK call in the provider layer
4. **Fix IITM compatibility** — investigate why IITM breaks `@mariozechner/pi-ai` exports
5. **Native OTel support** — bundle instrumentation directly in OpenClaw where it can control the loader lifecycle

Until 2-5 are addressed, this plugin's hook-based approach is the viable path for this ecosystem — zero-code SDK patching isn't — but token/cost reporting is capped at agent-turn granularity regardless of how this plugin is built; that's an OpenClaw platform limitation, not a plugin engineering problem. Realistically, this may not get fixed upstream soon — live with the turn-level granularity for tokens/cost for now, same as before 0.11.0, and lean on the per-call request-count/duration metrics for anything that only needs those two.

---

## Loki backends may not show a real `service_name` label

Some Loki-backed OTLP ingestion pipelines (confirmed with IONOS Cloud Observability's Logging Service) do not map the OTel `service.name` resource attribute into a Loki stream label — every log stream shows `service_name="unknown_service"` in Grafana regardless of what `serviceName` this plugin's config sets. This is not a plugin bug: the plugin sets `service.name` identically on the metrics, trace, and log `Resource` (see `src/telemetry.ts` and `src/logs.ts`), and metrics/traces on the same backend correctly carry service identity. The gap is specific to how that Loki pipeline maps OTLP resource attributes to stream labels. Workaround: use the pipeline's own fixed `tag` (or another label the pipeline does propagate) for service identification in Loki queries/dashboards, and put `service.name` in the log body/structured attributes if you need it visible per-record.

---

## `gen_ai_provider_name` may be missing or inconsistent

Some token-usage metrics and spans are missing the `gen_ai_provider_name` label, or carry it inconsistently across calls to the exact same model/session. Confirmed present for both Anthropic-native and IONOS-routed (Qwen) calls, which rules out a per-backend cause. The plugin reads `event.provider`/`ctx.provider` from OpenClaw core's own `model.usage` event at every call site (see `src/hooks.ts`) and has no independent, reliable signal to backfill from when core omits it. Likely root cause is upstream in OpenClaw core, tracked as [openclaw/openclaw#153244](https://github.com/openclaw/openclaw/issues/153244). Workaround: group Grafana panels/queries by `gen_ai_response_model` instead of `gen_ai_provider_name` until core's event is fixed.
