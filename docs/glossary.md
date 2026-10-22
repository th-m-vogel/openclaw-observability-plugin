# Glossary

This project's docs assume familiarity with OpenTelemetry, OpenClaw's own
plugin internals, and a handful of compliance/ecosystem acronyms — not
because that familiarity is safe to assume, but because re-explaining them
inline every time would bury the actual point of each sentence. This page is
the place those explanations live instead. If a term below is undefined, it's
a gap — [open an issue](https://github.com/th-m-vogel/openclaw-observability-plugin/issues).

## OpenTelemetry core

**OTel (OpenTelemetry)** — the vendor-neutral standard this whole plugin is
built on: a spec plus SDKs for emitting traces, metrics, and logs in a common
format any compatible backend can ingest.

**OTLP (OpenTelemetry Protocol)** — the wire format/transport OTel data is
sent over (HTTP or gRPC) between this plugin and whatever backend receives
it. "Point the plugin at an OTLP endpoint" means "give it a URL that speaks
this protocol."

**Span** — one timed unit of work in a trace (e.g. a single tool call, a
single model request). Spans nest to form a trace tree; see
[Architecture](./architecture.md) for this plugin's own tree shape.

**Resource** — the fixed set of attributes (service name, version, schema
URL) attached to *every* span/metric/log this plugin emits, identifying
which process produced it.

**Semantic conventions ("semconv")** — OTel's standardized attribute names
for common concepts (`service.name`, `code.function.name`, etc.), so two
unrelated tools' telemetry uses the same field names for the same thing
instead of each inventing its own. This plugin tracks its own semconv
version in `src/semconv.ts`; see the CHANGELOG's ISI-994/ISI-1004/ISI-1605
entries for its alignment history.

**GenAI semantic conventions** — OTel's newer, LLM-specific semconv
extension: the `gen_ai.*` attribute namespace (`gen_ai.request.model`,
`gen_ai.usage.input_tokens`, etc.) this plugin emits alongside its own
`openclaw.*`-namespaced attributes. See [Metrics Reference](./telemetry/metrics.md).

**Exporter** — the component that actually sends OTel data over the wire to
a backend (e.g. `OTLPTraceExporter`). Distinct from the SDK that generates
the data in the first place.

**Collector** — a standalone process (the "OTel Collector") that receives
OTLP data and forwards/transforms/fans it out to one or more real backends.
Optional — you can point this plugin straight at a backend that speaks OTLP
natively instead. See [OTel Collector backend](./backends/otel-collector.md).

## LLM/GenAI-specific

**LLM** — large language model; the model an OpenClaw agent calls per turn
(Claude, GPT, Gemini, etc.).

**OpenLLMetry** — an open-source OTel instrumentation library (by
[Traceloop](https://www.traceloop.com/)) that auto-instruments LLM SDK calls
(Anthropic, OpenAI) to emit GenAI-semconv spans without hand-written hooks.
This plugin optionally wraps LLM SDKs with it when `traces` is enabled — see
[Architecture](./architecture.md).

## Compliance/privacy acronyms

These appear in [Privacy](./security/privacy.md) and
[Security Detection](./security/detection.md) as *categories of sensitive
data this plugin's redaction/detection logic is aware of* — this project
doesn't implement or certify compliance with any of them, it just avoids
leaking data that would matter to someone who does:

- **PII** — personally identifiable information.
- **GDPR** — EU General Data Protection Regulation.
- **HIPAA** — US Health Insurance Portability and Accountability Act
  (health-data privacy).
- **PCI** (usually written **PCI DSS**) — Payment Card Industry Data
  Security Standard (payment-card-data handling).
- **CVE** — Common Vulnerabilities and Exposures; a public vulnerability ID
  (e.g. referenced when discussing a specific security issue this plugin's
  detectors might flag mention of).

## JavaScript/Node ecosystem

**ESM / CJS** — ECMAScript Modules (`import`/`export`) vs. CommonJS
(`require`/`module.exports`), Node's two incompatible module systems. Comes
up in this project because OpenClaw plugins run under ESM, and some
auto-instrumentation approaches (see IITM below) don't mix cleanly with it —
see [Limitations](./limitations.md).

**IITM (import-in-the-middle)** — a library that hooks Node's ESM module
loader to intercept imports, used by one of the content-capture approaches
discussed in [Limitations](./limitations.md) ("NODE_OPTIONS Preload with IITM").

**jiti** — the TypeScript/ESM runtime loader OpenClaw's gateway uses to load
plugin source directly without a separate build step for some code paths.
Clearing its cache (`rm -rf /tmp/jiti`) is a standard troubleshooting step
after updating a path-loaded plugin — see [Getting Started](./getting-started.md).

**UUID** — universally unique identifier, the standard 8-4-4-4-12 hex-string
ID shape used throughout this plugin's session/run keys. See
[Metrics Reference](./telemetry/metrics.md#collapseephemeralsessions-metrics-only)
and [Configuration](./configuration.md) for exactly how this plugin
recognizes one in a session key.

## Dynatrace

**DQL (Dynatrace Query Language)** — the query language used in Dynatrace's
own UI/API, referenced in this project's example queries — see
[Dynatrace backend](./backends/dynatrace.md) and the "Example DQL Queries"
section in [Traces](./telemetry/traces.md).

## This project's own conventions

**`ISI-####`** — an internal issue/ticket reference number used throughout
`CHANGELOG.md` and code comments to tie a change back to its original
tracking record. The prefix itself has no further meaning for a reader
outside the maintainer's own tracking system — treat it as a stable citation
you can ignore, not an abbreviation to decode.

**`registrationMode` / "non-full registration"** — OpenClaw core's own
signal for whether a given `register()` call is a live, real gateway
activation versus a discovery/setup/one-shot-CLI pass. This plugin skips its
own long-lived telemetry init on anything non-full. See
[Architecture → Plugin Lifecycle](./architecture.md#plugin-lifecycle).
