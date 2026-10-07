/**
 * Diagnostic events integration — subscribes to OpenClaw's internal diagnostic
 * events to get accurate cost/token data, then enriches our connected traces.
 *
 * This combines the best of both approaches:
 * - Our plugin: Connected traces (request → agent turn → tools)
 * - Official diagnostics: Accurate cost, token counts, context limits
 */

import type { Span } from "@opentelemetry/api";
import * as fs from "node:fs";
import * as path from "node:path";
import { pathToFileURL } from "node:url";
import type { TelemetryRuntime } from "./telemetry.js";
import {
  GEN_AI_AGENT_ID,
  GEN_AI_CONVERSATION_ID,
  GEN_AI_OPERATION_NAME,
  GEN_AI_PROVIDER_NAME,
  GEN_AI_RESPONSE_MODEL,
  GEN_AI_TOKEN_TYPE,
  GEN_AI_USAGE_CACHE_CREATION_INPUT_TOKENS,
  GEN_AI_USAGE_CACHE_READ_INPUT_TOKENS,
  GEN_AI_USAGE_INPUT_TOKENS,
  GEN_AI_USAGE_OUTPUT_TOKENS,
  OP_CHAT,
  OP_INVOKE_AGENT,
  OC_PROVIDER,
  TOKEN_TYPE_INPUT,
  TOKEN_TYPE_OUTPUT,
  TOKEN_TYPE_CACHE_READ,
  TOKEN_TYPE_CACHE_CREATION,
} from "./semconv.js";

type DiagnosticEventSource = (listener: (evt: any) => void) => () => void;

// Import from OpenClaw plugin SDK (loaded lazily)
let onDiagnosticEvent: DiagnosticEventSource | null = null;
let sdkLoadAttempted = false;

function asDiagnosticEventSource(candidate: unknown): DiagnosticEventSource | null {
  if (typeof candidate !== "function") return null;
  try {
    const unsubscribe = candidate(() => {});
    if (typeof unsubscribe !== "function") return null;
    unsubscribe();
    return candidate as DiagnosticEventSource;
  } catch {
    return null;
  }
}

function findDiagnosticEventSource(candidates: unknown[]): DiagnosticEventSource | null {
  for (const candidate of candidates) {
    const eventSource = asDiagnosticEventSource(candidate);
    if (eventSource) return eventSource;
  }
  return null;
}

async function loadSdk(): Promise<void> {
  if (sdkLoadAttempted) return;
  sdkLoadAttempted = true;
  try {
    // Dynamic import to avoid build issues if SDK not available
    // @ts-ignore - openclaw/plugin-sdk types not available at build time
    const sdk = await import("openclaw/plugin-sdk") as any;
    onDiagnosticEvent = asDiagnosticEventSource(sdk.onDiagnosticEvent);
  } catch {
    // SDK not available — will use fallback token extraction
  }
}

type DiagnosticsLogger = { debug?: (message: string) => void; warn?: (message: string) => void };

// Direct access to internal diagnostic events (preferred - bypasses SDK wrapper)
let onInternalDiagnosticEvent: DiagnosticEventSource | null = null;
let internalLoadAttempted = false;

function safeRealpath(file: string): string {
  try {
    return fs.realpathSync(file);
  } catch {
    return path.resolve(file);
  }
}

function resolveInternalDiagnosticsDistCandidates(entryFile: string | undefined): string[] {
  if (!entryFile) return [];
  const resolvedEntry = safeRealpath(entryFile);
  const entryDir = path.dirname(resolvedEntry);
  const entryParent = path.basename(entryDir);
  const installRoot = entryParent === "dist" || entryParent === "src"
    ? path.dirname(entryDir)
    : entryDir;
  const candidates = entryParent === "dist"
    ? [entryDir]
    : [path.join(installRoot, "dist"), entryDir];
  return [...new Set(candidates)];
}

function findInternalDiagnosticsChunks(
  distCandidates: string[],
): Array<{ distDir: string; chunk: string }> {
  const matches: Array<{ distDir: string; chunk: string }> = [];
  for (const distDir of distCandidates) {
    let files: string[];
    try {
      files = fs.readdirSync(distDir);
    } catch {
      continue;
    }
    const chunks = files
      .filter((f) => f.startsWith("diagnostic-events-") && f.endsWith(".js"))
      .sort();
    for (const file of chunks) {
      matches.push({ distDir, chunk: file });
    }
  }
  return matches;
}

function resolveInternalDiagnosticEventSource(diag: Record<string, unknown>): DiagnosticEventSource | null {
  const direct = asDiagnosticEventSource(diag.onInternalDiagnosticEvent);
  if (direct) return direct;

  const knownMinifiedAlias = asDiagnosticEventSource(diag.d);
  if (knownMinifiedAlias) return knownMinifiedAlias;

  const named = Object.values(diag).find(
    (value) => typeof value === "function" && value.name === "onInternalDiagnosticEvent",
  );
  const namedSource = asDiagnosticEventSource(named);
  if (namedSource) return namedSource;

  return findDiagnosticEventSource(Object.values(diag));
}

async function loadInternalDiagnosticEventSource(
  entryFile: string | undefined,
  logger?: DiagnosticsLogger,
): Promise<DiagnosticEventSource | null> {
  const matches = findInternalDiagnosticsChunks(resolveInternalDiagnosticsDistCandidates(entryFile));
  if (matches.length === 0) {
    logger?.debug?.("[otel] Internal diagnostics chunk not found; falling back to SDK diagnostics");
    return null;
  }

  for (const [index, match] of matches.entries()) {
    const fallbackAction = index === matches.length - 1
      ? "falling back to SDK diagnostics"
      : "trying next diagnostics chunk";
    try {
      const specifier = pathToFileURL(path.join(match.distDir, match.chunk)).href;
      const diag = await import(specifier) as Record<string, unknown>;
      const eventSource = resolveInternalDiagnosticEventSource(diag);
      if (eventSource) return eventSource;
      logger?.debug?.(
        `[otel] Internal diagnostics chunk ${match.chunk} loaded but onInternalDiagnosticEvent export not resolved; ${fallbackAction}`,
      );
    } catch {
      logger?.debug?.(
        `[otel] Internal diagnostics chunk ${match.chunk} failed to load; ${fallbackAction}`,
      );
    }
  }
  return null;
}

async function loadInternalDiagnostics(logger?: DiagnosticsLogger): Promise<void> {
  if (internalLoadAttempted) return;
  internalLoadAttempted = true;
  try {
    // Prefer the stable package export when present. Older OpenClaw builds did
    // not expose this path, so keep the packaged-chunk scan below as fallback.
    // @ts-ignore - openclaw/plugin-sdk types not available at build time
    const runtime = await import("openclaw/plugin-sdk/diagnostic-runtime") as any;
    onInternalDiagnosticEvent = asDiagnosticEventSource(runtime.onInternalDiagnosticEvent);
    if (onInternalDiagnosticEvent) return;
  } catch {
    // Stable diagnostic-runtime export not available.
  }

  onInternalDiagnosticEvent = await loadInternalDiagnosticEventSource(process.argv[1], logger);
}

/**
 * Minimum OpenClaw version this plugin supports for real per-call token
 * metrics — the release confirmed (commit b2d6842c547d, ancestor of the
 * v2026.9.8 tag) to spread `observer.usageField()` onto `model.call.completed`
 * / `model.call.error` internal diagnostic events. Older installs still load
 * this plugin fine; they just won't have `openclaw.llm.tokens.*` data, since
 * those events won't carry a `usage` field to read.
 */
export const MIN_SUPPORTED_OPENCLAW_VERSION = "2026.9.8";

function resolveOpenclawInstallRoot(entryFile: string | undefined): string | undefined {
  if (!entryFile) return undefined;
  const resolvedEntry = safeRealpath(entryFile);
  const entryDir = path.dirname(resolvedEntry);
  const entryParent = path.basename(entryDir);
  return entryParent === "dist" || entryParent === "src"
    ? path.dirname(entryDir)
    : entryDir;
}

function readInstalledOpenclawVersion(installRoot: string | undefined): string | undefined {
  if (!installRoot) return undefined;
  try {
    const raw = fs.readFileSync(path.join(installRoot, "package.json"), "utf8");
    const parsed = JSON.parse(raw) as { version?: unknown };
    return typeof parsed.version === "string" ? parsed.version : undefined;
  } catch {
    return undefined;
  }
}

/**
 * Compares two dot-separated, OpenClaw-style `YYYY.M.D` version strings.
 * Returns negative if `a` < `b`, positive if `a` > `b`, 0 if equal.
 * Each segment is read with `parseInt`, which stops at the first
 * non-digit character — good enough to not misjudge a pre-release string
 * like "2026.9.8-canary.3" (reads as 2026.9.8) as older than it is, with
 * no `semver` dependency needed for OpenClaw's actual version shape.
 */
function compareVersions(a: string, b: string): number {
  const partsA = a.split(".");
  const partsB = b.split(".");
  const len = Math.max(partsA.length, partsB.length);
  for (let i = 0; i < len; i++) {
    const numA = Number.parseInt(partsA[i] ?? "0", 10) || 0;
    const numB = Number.parseInt(partsB[i] ?? "0", 10) || 0;
    if (numA !== numB) return numA - numB;
  }
  return 0;
}

let minVersionCheckDone = false;

function checkMinimumOpenclawVersion(entryFile: string | undefined, logger?: DiagnosticsLogger): void {
  if (minVersionCheckDone) return;
  minVersionCheckDone = true;
  const installedVersion = readInstalledOpenclawVersion(resolveOpenclawInstallRoot(entryFile));
  if (!installedVersion) {
    logger?.debug?.("[otel] Could not determine installed OpenClaw version; skipping minimum-version check");
    return;
  }
  if (compareVersions(installedVersion, MIN_SUPPORTED_OPENCLAW_VERSION) < 0) {
    logger?.warn?.(
      `[otel] Detected OpenClaw v${installedVersion}, below this plugin's minimum supported version v${MIN_SUPPORTED_OPENCLAW_VERSION}. ` +
      `Real per-call token metrics (openclaw.llm.tokens.*) require v${MIN_SUPPORTED_OPENCLAW_VERSION}+ and will be missing or incomplete on this install. See docs/limitations.md.`
    );
  }
}

/** Pending usage data waiting to be attached to spans */
interface PendingUsageData {
  costUsd?: number;
  usage: {
    input?: number;
    output?: number;
    cacheRead?: number;
    cacheWrite?: number;
    total?: number;
  };
  context?: {
    limit?: number;
    used?: number;
  };
  durationMs?: number;
  provider?: string;
  model?: string;
}

/** Map of sessionKey → pending usage data from diagnostic events */
const pendingUsageMap = new Map<string, PendingUsageData>();

/**
 * Dedup guard against openclaw/openclaw#166289 — core double-dispatches the
 * `model.usage` diagnostic event for a subset of calls (confirmed core-side,
 * not caused by this plugin). Keyed on content, not identity, since the two
 * dispatches are otherwise byte-identical and arrive ~1ms apart. Only needs
 * to protect what's *exclusively* recorded from this event (cost, and the
 * system/user/tool_result/skill token breakdown) — the primary token/request
 * metrics now come from the per-call `model_call_started`/`model_call_ended`
 * hooks in hooks.ts, which are tied to a real call and unaffected by this.
 */
const recentUsageEvents = new Map<string, number>();
const DUPLICATE_WINDOW_MS = 5_000;

/** Map of sessionKey → active agent span (set by hooks.ts) */
export const activeAgentSpans = new Map<string, Span>();

/**
 * Register diagnostic event listener to capture model.usage events.
 * Returns unsubscribe function.
 */
export async function registerDiagnosticsListener(
  telemetry: TelemetryRuntime,
  logger: any
): Promise<() => void> {
  // Load the SDK if not already loaded
  await loadSdk();
  await loadInternalDiagnostics(logger);
  checkMinimumOpenclawVersion(process.argv[1], logger);

  // Use internal diagnostic events if available, otherwise fall back to SDK
  const eventSource = onInternalDiagnosticEvent || onDiagnosticEvent;
  
  if (!eventSource) {
    logger.warn?.("[otel] No diagnostic event source available — openclaw.llm.tokens.* and .cost.usd will not be recorded");
    return () => {};
  }

  const { counters, histograms } = telemetry;

  const unsubscribe = eventSource((evt: any) => {
    
    // ISI-1017: Queue events
    if (evt.type === "queue.lane.enqueue") {
      const { lane, depth, waitMs } = evt;
      const attrs: Record<string, string | number> = {};
      if (lane) attrs["openclaw.queue.lane"] = lane;
      counters.queueLaneEnqueue.add(1, attrs);
      if (typeof depth === "number") histograms.queueDepth.record(depth, attrs);
      if (typeof waitMs === "number") histograms.queueWaitMs.record(waitMs, attrs);
      logger.debug?.(`[otel] queue.lane.enqueue: lane=${lane}, depth=${depth}, waitMs=${waitMs}`);
      return;
    }

    if (evt.type === "queue.lane.dequeue") {
      const { lane, depth } = evt;
      const attrs: Record<string, string | number> = {};
      if (lane) attrs["openclaw.queue.lane"] = lane;
      counters.queueLaneDequeue.add(1, attrs);
      if (typeof depth === "number") histograms.queueDepth.record(depth, attrs);
      logger.debug?.(`[otel] queue.lane.dequeue: lane=${lane}, depth=${depth}`);
      return;
    }

    // ISI-1017: Session events
    if (evt.type === "session.stuck") {
      const { sessionKey, ageMs } = evt;
      const attrs = { "openclaw.session.key": sessionKey || "unknown" };
      counters.sessionStuck.add(1, attrs);
      if (typeof ageMs === "number") histograms.sessionStuckAgeMs.record(ageMs, attrs);
      logger.debug?.(`[otel] session.stuck: session=${sessionKey}, ageMs=${ageMs}`);
      return;
    }

    if (evt.type === "session.long_running") {
      const { sessionKey, ageMs } = evt;
      const attrs = { "openclaw.session.key": sessionKey || "unknown" };
      counters.sessionLongRunning.add(1, attrs);
      logger.debug?.(`[otel] session.long_running: session=${sessionKey}, ageMs=${ageMs}`);
      return;
    }

    if (evt.type === "session.stalled") {
      const { sessionKey, ageMs } = evt;
      const attrs = { "openclaw.session.key": sessionKey || "unknown" };
      counters.sessionStalled.add(1, attrs);
      logger.debug?.(`[otel] session.stalled: session=${sessionKey}, ageMs=${ageMs}`);
      return;
    }

    // ISI-1016: Gateway health metrics from diagnostic events
    if (evt.type === "diagnostic.liveness.warning") {
      const {
        eventLoopDelayP99Ms,
        eventLoopDelayMaxMs,
        eventLoopUtilization,
        cpuCoreRatio,
        active,
        waiting,
        queued,
      } = evt;

      counters.livenessWarnings.add(1, {
        "openclaw.diagnostic.phase": evt.phase || "unknown",
      });

      if (typeof eventLoopDelayP99Ms === "number") {
        histograms.gatewayEventLoopDelayP99.record(eventLoopDelayP99Ms);
      }
      if (typeof eventLoopDelayMaxMs === "number") {
        histograms.gatewayEventLoopDelayMax.record(eventLoopDelayMaxMs);
      }
      if (typeof eventLoopUtilization === "number") {
        histograms.gatewayEventLoopUtilization.record(eventLoopUtilization);
      }
      if (typeof cpuCoreRatio === "number") {
        histograms.gatewayCpuCoreRatio.record(cpuCoreRatio);
      }
      if (typeof queued === "number") {
        histograms.gatewayWorkQueued.record(queued);
      }

      logger.debug?.(
        `[otel] diagnostic.liveness.warning: eventLoopDelayP99Ms=${eventLoopDelayP99Ms}, cpuCoreRatio=${cpuCoreRatio}, queued=${queued}`
      );
      return;
    }

    if (evt.type === "diagnostic.heartbeat") {
      counters.diagnosticHeartbeats.add(1, {
        "openclaw.diagnostic.phase": evt.phase || "unknown",
      });

      // Record queue depth if available
      if (typeof evt.queued === "number") {
        histograms.gatewayWorkQueued.record(evt.queued);
      }

      logger.debug?.(`[otel] diagnostic.heartbeat: webhooks=${evt.webhooks?.received}/${evt.webhooks?.processed}/${evt.webhooks?.errors}`);
      return;
    }

    // Memory sample events — record memory usage histograms
    if (evt.type === "diagnostic.memory.sample") {
      if (evt.memory) {
        if (typeof evt.memory.rssBytes === "number") histograms.memoryRssBytes.record(evt.memory.rssBytes);
        if (typeof evt.memory.heapUsedBytes === "number") histograms.memoryHeapUsedBytes.record(evt.memory.heapUsedBytes);
        if (typeof evt.memory.heapTotalBytes === "number") histograms.memoryHeapTotalBytes.record(evt.memory.heapTotalBytes);
        if (typeof evt.memory.externalBytes === "number") histograms.memoryExternalBytes.record(evt.memory.externalBytes);
        if (typeof evt.memory.arrayBuffersBytes === "number") histograms.memoryArrayBuffersBytes.record(evt.memory.arrayBuffersBytes);
      }
      logger.debug?.(`[otel] diagnostic.memory.sample: rss=${evt.memory?.rssBytes}, heapUsed=${evt.memory?.heapUsedBytes}`);
      return;
    }

    // Memory pressure events
    if (evt.type === "diagnostic.memory.pressure") {
      const attrs: Record<string, string> = {};
      if (evt.reason) attrs["openclaw.memory.reason"] = evt.reason;
      if (evt.level) attrs["openclaw.memory.level"] = evt.level;
      counters.memoryPressure.add(1, attrs);
      // Also record memory snapshot if available
      if (evt.memory) {
        if (typeof evt.memory.rssBytes === "number") histograms.memoryRssBytes.record(evt.memory.rssBytes);
        if (typeof evt.memory.heapUsedBytes === "number") histograms.memoryHeapUsedBytes.record(evt.memory.heapUsedBytes);
        if (typeof evt.memory.heapTotalBytes === "number") histograms.memoryHeapTotalBytes.record(evt.memory.heapTotalBytes);
        if (typeof evt.memory.externalBytes === "number") histograms.memoryExternalBytes.record(evt.memory.externalBytes);
        if (typeof evt.memory.arrayBuffersBytes === "number") histograms.memoryArrayBuffersBytes.record(evt.memory.arrayBuffersBytes);
      }
      logger.debug?.(`[otel] diagnostic.memory.pressure: reason=${evt.reason}, level=${evt.level}`);
      return;
    }

    // 0.12.0+: real per-call token usage. Unlike `model_call_started`/
    // `model_call_ended` (the plugin *hooks*, confirmed to carry no usage
    // field — see hooks.ts), these are `onInternalDiagnosticEvent`
    // *diagnostic events* — a different mechanism, verified live against
    // OpenClaw v2026.9.8 to spread `observer.usageField()` (call-scoped,
    // read from that call's own terminal provider response) onto the
    // payload. Fires once per real model API call, unconditionally —
    // same reliability class as the per-call request/duration hooks in
    // hooks.ts — so no fallback is needed the way `model.usage` (a
    // turn-level event) needed one. See openclaw/openclaw#166623.
    //
    // No dedup guard needed here against #166289 specifically: that bug
    // is core double-dispatching the `model.usage` event itself (a
    // separate emission site). `model.call.completed`/`model.call.error`
    // are emitted from `emitModelCallEnded`, which core guards with its
    // own one-shot `observer.state.terminalEventEmitted` flag per call
    // (checked directly in OpenClaw's installed source) — a structurally
    // different, call-scoped idempotency mechanism, not the thing #166289
    // is about. If a *different* double-dispatch bug is ever found on
    // these events specifically, add a guard the same way the `model.usage`
    // handler below does (keyed on session/model/usage, not event identity).
    if (evt.type === "model.call.completed" || evt.type === "model.call.error") {
      const usage = evt.usage;
      if (!usage) return;

      const sessionKey = evt.sessionKey || "unknown";
      const model = evt.model || "unknown";
      const metricAttrs: Record<string, string> = {
        [GEN_AI_RESPONSE_MODEL]: model,
        [GEN_AI_OPERATION_NAME]: OP_CHAT,
        [GEN_AI_CONVERSATION_ID]: sessionKey,
      };
      if (evt.provider && evt.provider !== "unknown") {
        metricAttrs[GEN_AI_PROVIDER_NAME] = evt.provider;
        metricAttrs[OC_PROVIDER] = evt.provider;
      }
      if (evt.agentId && evt.agentId !== "unknown") {
        metricAttrs[GEN_AI_AGENT_ID] = evt.agentId;
      }

      if (usage.input) {
        counters.tokensPrompt.add(usage.input, metricAttrs);
        histograms.genAiTokenUsage.record(usage.input, {
          ...metricAttrs,
          [GEN_AI_TOKEN_TYPE]: TOKEN_TYPE_INPUT,
        });
      }
      if (usage.output) {
        counters.tokensCompletion.add(usage.output, metricAttrs);
        histograms.genAiTokenUsage.record(usage.output, {
          ...metricAttrs,
          [GEN_AI_TOKEN_TYPE]: TOKEN_TYPE_OUTPUT,
        });
      }
      if (usage.cacheRead) {
        counters.tokensPrompt.add(usage.cacheRead, { ...metricAttrs, "token.type": "cache_read" });
        histograms.genAiTokenUsage.record(usage.cacheRead, {
          ...metricAttrs,
          [GEN_AI_TOKEN_TYPE]: TOKEN_TYPE_CACHE_READ,
        });
      }
      if (usage.cacheWrite) {
        counters.tokensPrompt.add(usage.cacheWrite, { ...metricAttrs, "token.type": "cache_write" });
        histograms.genAiTokenUsage.record(usage.cacheWrite, {
          ...metricAttrs,
          [GEN_AI_TOKEN_TYPE]: TOKEN_TYPE_CACHE_CREATION,
        });
      }
      if (usage.total) {
        counters.tokensTotal.add(usage.total, metricAttrs);
      }

      logger.debug?.(
        `[otel] ${evt.type}: session=${sessionKey}, model=${model}, tokens=${usage.total ?? "?"}`
      );
      return;
    }

    if (evt.type !== "model.usage") return;

    const sessionKey = evt.sessionKey || "unknown";
    const usage = evt.usage || {};
    const costUsd = evt.costUsd;
    const model = evt.model || "unknown";
    const provider = evt.provider || "unknown";

    // Store for later attachment to agent span
    pendingUsageMap.set(sessionKey, {
      costUsd,
      usage,
      context: evt.context,
      durationMs: evt.durationMs,
      provider,
      model,
    });

    // Stable GenAI attribute keys only — `gen_ai.system` dropped in schema
    // 1.3.0 (ISI-1004). `openclaw.provider` (legacy mirror) is retained.
    const metricAttrs = {
      [GEN_AI_RESPONSE_MODEL]: model,
      [GEN_AI_PROVIDER_NAME]: provider,
      [GEN_AI_OPERATION_NAME]: OP_INVOKE_AGENT,
      [GEN_AI_CONVERSATION_ID]: sessionKey,
      [OC_PROVIDER]: provider,
    };

    // NOTE (0.11.0): request-count and duration metrics moved to the
    // per-call `model_call_started`/`model_call_ended` hooks in hooks.ts,
    // which fire once per real model API call rather than once per *agent
    // turn* like this event (a turn may cover several real calls — see a
    // trace with several `chat {model}` spans under one `openclaw.agent.turn`
    // for an example) and are immune to this event's known core-side
    // double-dispatch bug (openclaw/openclaw#166289) since they're tied to
    // a real, individually-identified call.
    //
    // NOTE (0.12.0): `openclaw.llm.tokens.*` moved the same way, onto the
    // `model.call.completed`/`model.call.error` diagnostic events above —
    // real per-call usage, confirmed available since OpenClaw v2026.9.8
    // (openclaw/openclaw#166623). What stays here: cost (no per-call cost
    // field exists anywhere in the plugin API) and the ISI-1018
    // system/user/tool_result/skill breakdown (not present in per-call
    // usage either). Both still need the dedup guard below, since this
    // event can still double-dispatch (#166289).
    const dedupKey = `${sessionKey}|${model}|${costUsd ?? "?"}|${usage.total ?? "?"}`;
    const now = Date.now();
    const lastSeen = recentUsageEvents.get(dedupKey);
    const isDuplicate = typeof lastSeen === "number" && now - lastSeen < DUPLICATE_WINDOW_MS;
    recentUsageEvents.set(dedupKey, now);
    if (recentUsageEvents.size > 500) {
      for (const [k, ts] of recentUsageEvents) {
        if (now - ts > DUPLICATE_WINDOW_MS) recentUsageEvents.delete(k);
      }
    }

    if (!isDuplicate) {
      // ISI-1018: Token breakdown by type (system, user, tool_result, skill)
      if (usage.system) {
        counters.tokensSystem.add(usage.system, metricAttrs);
      }
      if (usage.user) {
        counters.tokensUser.add(usage.user, metricAttrs);
      }
      if (usage.toolResult) {
        counters.tokensToolResult.add(usage.toolResult, metricAttrs);
      }
      if (usage.skill) {
        counters.tokensSkill.add(usage.skill, metricAttrs);
      }

      // Record cost metric
      if (typeof costUsd === "number" && costUsd > 0) {
        telemetry.meter.createCounter("openclaw.llm.cost.usd", {
          description: "Estimated LLM cost in USD",
          unit: "usd",
        }).add(costUsd, metricAttrs);
      }
    } else {
      logger.debug?.(
        `[otel] model.usage: suppressed duplicate dispatch (openclaw/openclaw#166289) for session=${sessionKey}, cost=$${costUsd?.toFixed(4) || "?"}, tokens=${usage.total || "?"}`
      );
    }

    // Span enrichment overwrites the same attributes either way, so it's
    // safe to run regardless of the dedup check above.
    const agentSpan = activeAgentSpans.get(sessionKey);
    if (agentSpan) {
      enrichSpanWithUsage(agentSpan, evt);
      pendingUsageMap.delete(sessionKey);
    }

    logger.debug?.(`[otel] model.usage: session=${sessionKey}, model=${model}, cost=$${costUsd?.toFixed(4) || "?"}, tokens=${usage.total || "?"}`);
  });

  logger.info("[otel] Subscribed to OpenClaw diagnostic events (model.usage, etc.)");
  return unsubscribe;
}

/**
 * Get pending usage data for a session (if any).
 * Called by agent_end hook to attach data to span.
 */
export function getPendingUsage(sessionKey: string): PendingUsageData | undefined {
  const data = pendingUsageMap.get(sessionKey);
  if (data) {
    pendingUsageMap.delete(sessionKey);
  }
  return data;
}

/**
 * Enrich a span with usage data from diagnostic event.
 */
export function enrichSpanWithUsage(span: Span, data: PendingUsageData): void {
  const usage = data.usage || {};

  // GenAI semantic convention attributes — stable keys only.
  // `gen_ai.usage.total_tokens` and `gen_ai.usage.cache_*_tokens` (legacy)
  // dropped in schema 1.3.0 (ISI-1004).
  if (usage.input !== undefined) {
    span.setAttribute(GEN_AI_USAGE_INPUT_TOKENS, usage.input);
  }
  if (usage.output !== undefined) {
    span.setAttribute(GEN_AI_USAGE_OUTPUT_TOKENS, usage.output);
  }
  if (usage.cacheRead !== undefined) {
    span.setAttribute(GEN_AI_USAGE_CACHE_READ_INPUT_TOKENS, usage.cacheRead);
  }
  if (usage.cacheWrite !== undefined) {
    span.setAttribute(GEN_AI_USAGE_CACHE_CREATION_INPUT_TOKENS, usage.cacheWrite);
  }

  // Cost (custom attribute — not in GenAI semconv yet)
  if (data.costUsd !== undefined) {
    span.setAttribute("openclaw.llm.cost_usd", data.costUsd);
  }

  // Context window
  if (data.context?.limit !== undefined) {
    span.setAttribute("openclaw.context.limit", data.context.limit);
  }
  if (data.context?.used !== undefined) {
    span.setAttribute("openclaw.context.used", data.context.used);
  }

  // Provider/model — `gen_ai.provider.name` only (legacy `gen_ai.system`
  // dropped in schema 1.3.0 / ISI-1004).
  if (data.provider) {
    span.setAttribute(GEN_AI_PROVIDER_NAME, data.provider);
  }
  if (data.model) {
    span.setAttribute(GEN_AI_RESPONSE_MODEL, data.model);
  }
}

/**
 * Check if diagnostic events are available.
 * Note: Only accurate after registerDiagnosticsListener() has been called.
 */
export function hasDiagnosticsSupport(): boolean {
  return typeof onDiagnosticEvent === "function" || typeof onInternalDiagnosticEvent === "function";
}

/**
 * Async check for diagnostics support (loads SDK if needed).
 */
export async function checkDiagnosticsSupport(): Promise<boolean> {
  await loadSdk();
  await loadInternalDiagnostics();
  return hasDiagnosticsSupport();
}
