# Dynatrace Dashboard Templates

Pre-built Dynatrace dashboard JSON for monitoring OpenClaw AI agent operations.

## Dashboard: OpenClaw Overview

**File:** `openclaw-overview-dashboard.json`

### Sections

| # | Section | DQL Metrics | Visualization |
|---|---------|-------------|---------------|
| 1 | **Overview** | Active agent count, monthly cost | Single value tiles |
| 2 | **Token Usage** | `gen_ai.client.token.usage` by model/type, cache hit rate | Bar + line charts |
| 3 | **Cost** | `openclaw.llm.cost.usd` by provider/model | Bar + area charts |
| 4 | **Agent Performance** | `gen_ai.client.operation.duration` by provider, tool call frequency | Line + bar charts |
| 5 | **Security** | `openclaw.security.*` events, recent incidents from spans | Line chart + table |
| 6 | **V3 spans & GenAI metrics** | `chat <model>` / `execute_tool <name>` / `openclaw.dispatch.prepare` spans + stable `gen_ai.client.*` metrics | Tables + line/area charts |

Other files in this directory: `openclaw-overview-dashboard-plugin-only.json` (built only from this plugin's own `openclaw.*` metrics, spans, and logs), plus `-v3`/`-v4` variants of the overview.

### Import

1. Open Dynatrace → **Dashboards** → **Upload**
2. Select `openclaw-overview-dashboard.json`
3. The dashboard uses Dynatrace Dashboard v7 format (Grail/DQL)

### Prerequisites

- This plugin (`otel-observability`) enabled — the tiles query its metric and span names, not the official `diagnostics-otel` plugin's
- Telemetry reaching Dynatrace, either directly via OTLP or through an OTel Collector
- For security tiles: this plugin's security detection module (always on); Tetragon is optional

### Metric Sources

| Metric | Source |
|--------|--------|
| `gen_ai.client.token.usage` | This plugin — `model.call.completed`/`model.call.error` diagnostic events (once per real model call) |
| `gen_ai.client.operation.duration` | This plugin — `model_call_ended` hook (per real call) and `agent_end` hook (per agent turn) |
| `openclaw.llm.cost.usd` | This plugin — `model.usage` diagnostic event (once per agent turn) |
| `openclaw.security.*` | This plugin's security detection module |

### Customization

- Adjust time ranges per tile as needed
- Add management zone filters for multi-environment setups
- Modify thresholds in single-value tiles to match your budget/SLO targets
