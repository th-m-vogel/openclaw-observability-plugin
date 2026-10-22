# Development

How to develop, test, and contribute to the plugin.

## Setup

```bash
# Clone
git clone https://github.com/th-m-vogel/openclaw-observability-plugin.git
cd openclaw-observability-plugin

# Install dependencies and build (the gateway loads the compiled dist/, see below)
npm ci
npm run build
```

Then point OpenClaw at your working copy the same way every other doc does — via `plugins.load.paths` in `~/.openclaw/openclaw.json` (see [Getting Started](getting-started.md#step-3-configure-openclaw) for the full entry, including the required `hooks.allowConversationAccess`):

```json
{
  "plugins": {
    "load": { "paths": ["/path/to/openclaw-observability-plugin"] },
    "entries": {
      "otel-observability": {
        "enabled": true,
        "hooks": { "allowConversationAccess": true },
        "config": { "endpoint": "http://localhost:4318" }
      }
    }
  }
}
```

```bash
# Restart gateway to pick up the plugin
openclaw gateway restart
```

## Project Structure

```
openclaw-observability-plugin/
├── index.ts                    # Plugin entry point (register/start/stop, RPC, CLI, agent tool)
├── src/
│   ├── config.ts               # Configuration parsing and defaults
│   ├── telemetry.ts            # OTel SDK setup (providers, exporters, instruments)
│   ├── hooks.ts                # Typed + event-stream hook handlers (spans, most metrics)
│   ├── diagnostics.ts          # Diagnostic-event listener (per-call tokens, cost, gateway/queue/session metrics)
│   ├── logs.ts                 # OTLP log pipeline, gateway-logger bridge, logConfig filtering
│   ├── security.ts             # Security detections (sensitive files, prompt injection, dangerous commands)
│   ├── semconv.ts              # Attribute/metric name constants, schema versions
│   ├── trace-context-store.ts  # Session → span-context store used for parenting
│   ├── propagation.ts          # W3C trace context inject/extract helpers
│   ├── metric-session-key.ts   # collapseEphemeralSessions label transform
│   ├── metric-by-model.ts      # enableByModelMetrics attribute stripping
│   ├── grpc-metadata.ts        # headers → gRPC metadata conversion
│   ├── openllmetry.ts          # GenAI instrumentation status check
│   └── version.ts              # Plugin version resolution from openclaw.plugin.json
├── instrumentation/
│   ├── preload.mjs             # Optional NODE_OPTIONS preload (Traceloop LLM-client spans)
│   └── capture-content.mjs     # Content-capture env-var resolution used by the preload
├── tests/                      # Vitest suite
├── collector/
│   └── otel-collector-config.yaml  # OTel Collector config
├── dynatrace/                  # Dynatrace dashboards and DQL examples
├── docs/                       # MkDocs documentation
├── openclaw.plugin.json        # Plugin manifest
├── package.json
├── tsconfig.json
├── mkdocs.yml
└── docker-compose.yaml
```

## Development Workflow

### 1. Make Changes

Edit the TypeScript files in `src/` or `index.ts`.

### 2. Rebuild and Restart Gateway

The gateway loads the compiled `dist/index.js` (the `openclaw.runtimeExtensions` entry in `package.json`), not the TypeScript source, so rebuild after every change:

```bash
npm run build
openclaw gateway restart
```

### 3. Verify

```bash
# Check plugin loaded
openclaw otel

# Check gateway logs for [otel] messages
tail -f ~/.openclaw/gateway.log | grep otel
```

### 4. Test with Debug Exporter

For quick development, use the collector's debug exporter to see spans in stdout:

```bash
docker compose up -d
docker compose logs -f otel-collector
```

Every exported span/metric will appear in the collector logs.

## Type Checking and Tests

```bash
npm run typecheck
npm test
```

CI runs `npm run typecheck`, `npm run build`, and `npm test`.

!!! note
    The plugin uses OpenClaw's plugin API via `any` types since the SDK types aren't published separately yet. Once `openclaw/plugin-sdk` is published, we'll add proper type imports.

## Testing Locally Without a Backend

You can run with just the debug exporter (no Dynatrace/Grafana needed):

1. Edit `collector/otel-collector-config.yaml`:

    ```yaml
    service:
      pipelines:
        traces:
          receivers: [otlp]
          processors: [batch]
          exporters: [debug]  # Remove dynatrace exporter
    ```

2. Start the collector: `docker compose up -d`
3. Watch spans: `docker compose logs -f otel-collector`
4. Send messages to your OpenClaw agent — you'll see spans appear in the logs

## Adding New Metrics

1. Define the instrument in `src/telemetry.ts`:

    ```typescript
    // In OtelCounters interface
    myNewMetric: Counter;

    // In initTelemetry()
    myNewMetric: meter.createCounter("openclaw.my.new_metric", {
      description: "Description of what this measures",
      unit: "unit",
    }),
    ```

2. Record values in `src/hooks.ts` (hook-sourced) or `src/diagnostics.ts` (diagnostic-event-sourced):

    ```typescript
    telemetry.counters.myNewMetric.add(1, { "attribute.key": "value" });
    ```

3. Document in `docs/telemetry/metrics.md`

## Adding New Spans

1. Use the tracer in `src/hooks.ts`:

    ```typescript
    const span = tracer.startSpan("openclaw.my.operation", {
      kind: SpanKind.INTERNAL,
      attributes: {
        "openclaw.my.attribute": "value",
      },
    });

    // ... do work ...

    span.setStatus({ code: SpanStatusCode.OK });
    span.end();
    ```

2. Document in `docs/telemetry/traces.md`

## Building the Documentation

```bash
# Install MkDocs (one-time)
pip install mkdocs-material

# Serve locally
mkdocs serve

# Build static site
mkdocs build

# Deploy to GitHub Pages
mkdocs gh-deploy
```

## Cutting a release

This fork is **not published to npm** (see [README → Quick start](../README.md#quick-start)). To cut a release:

```bash
# Bump version in package.json and openclaw.plugin.json
# Add a section to CHANGELOG.md
git tag v0.X.0 && git push origin v0.X.0
```

Users install by cloning the repo at that tag and loading it by path — see [README → Quick start](../README.md#quick-start) for the full steps.

## Contributing

1. Fork the repository
2. Create a feature branch: `git checkout -b feature/my-feature`
3. Make your changes
4. Run the checks CI runs: `npm run typecheck`, `npm run build`, and `npm test` (see [`CONTRIBUTING.md`](../CONTRIBUTING.md))
5. Test with a local collector
6. Submit a pull request

### Commit Convention

Use conventional commits:

- `feat: add new metric for session duration`
- `fix: handle missing tool name in hook`
- `docs: update Dynatrace setup guide`
- `refactor: simplify config parsing`
