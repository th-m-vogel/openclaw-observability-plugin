/**
 * OpenClaw OTel Observability Plugin
 *
 * Provides full OpenTelemetry observability for OpenClaw:
 *   - Connected distributed traces (request → agent turn → tools)
 *   - Cost tracking via OpenClaw diagnostic events integration
 *   - Token usage (input, output, cache read/write) as spans + metrics
 *   - Tool execution spans with result metadata
 *   - Metrics: token usage, cost, latency histograms, tool calls
 *   - OTLP export to any OpenTelemetry-compatible backend (Dynatrace, Grafana, etc.)
 *
 * Usage in openclaw config:
 *   {
 *     "plugins": {
 *       "entries": {
 *         "otel-observability": {
 *           "enabled": true,
 *           "config": {
 *             "endpoint": "http://localhost:4318",
 *             "protocol": "http",
 *             "serviceName": "openclaw-gateway",
 *             "traces": true,
 *             "metrics": true,
 *             "captureContent": false
 *           }
 *         }
 *       }
 *     }
 *   }
 */

import { parseConfig, policyEnablesLlmContent, resolveSignalConfig, type OtelObservabilityConfig } from "./src/config.js";
import { initTelemetry, hasPreloadedOtelSdk, type TelemetryRuntime } from "./src/telemetry.js";
import { initOpenLLMetry } from "./src/openllmetry.js";
import { registerHooks } from "./src/hooks.js";
import { registerDiagnosticsListener, hasDiagnosticsSupport } from "./src/diagnostics.js";
import { initLogPipeline, bridgeGatewayLogger, type LogPipelineRuntime } from "./src/logs.js";

let gatewayStopFinalizer: (() => Promise<void>) | null = null;
let gatewayStopFinalizationStarted = false;

/**
 * Tracks the active registration's per-call resources (hooks, the
 * diagnostics-event subscription, the log pipeline, the gateway-logger
 * bridge) so a subsequent `register()` call can tear down the PREVIOUS
 * call's resources before setting up its own. `telemetry` itself doesn't
 * need tracking here —
 * `initTelemetry()` already dedupes it via its own module-level
 * singleton (`initializedRuntime`).
 *
 * OpenClaw is expected to call the plugin's `stop()` before calling
 * `register()` again (config hot-reload) — `stop()` below already tears
 * these same resources down correctly when that happens. It has been
 * observed, however, calling `register()` repeatedly WITHOUT an
 * intervening `stop()`; each such call previously left the prior call's
 * resources permanently stacked (`api.on`/the diagnostics event source
 * don't expose per-call replacement — only addition), since they were
 * only ever torn down by THAT call's own `stop()`, which never ran. A
 * single real OpenClaw event (e.g. `model.usage`) then fired every
 * still-attached stacked listener, producing duplicate cost/token
 * metrics and log lines — confirmed via direct log evidence (exact
 * duplicate `model.usage` lines, ~1ms apart, identical
 * session+cost+tokens).
 */
let activeRegistration: {
  stopHooks: (() => void) | null;
  unsubscribeDiagnostics: (() => void) | null;
  restoreLogger: (() => void) | null;
  logPipeline: LogPipelineRuntime | null;
} | null = null;

function teardownActiveRegistration(logger: any): void {
  if (!activeRegistration) return;
  logger.warn(
    "[otel] register() called again without a preceding stop() — " +
    "tearing down the previous registration's hooks/diagnostics-listener/" +
    "log-pipeline before setting up the new one " +
    "(prevents duplicate model.usage cost/token counting)."
  );
  const prev = activeRegistration;
  activeRegistration = null;
  prev.stopHooks?.();
  prev.unsubscribeDiagnostics?.();
  prev.restoreLogger?.();
  prev.logPipeline?.shutdown().catch((err) => {
    logger.error(`[otel] Error shutting down previous log pipeline: ${String(err)}`);
  });
}

/**
 * ISI-1900: whether this `register()` call is anything other than a real,
 * live "full" activation. OpenClaw core tells every plugin exactly this via
 * `api.registrationMode` — the authoritative signal, not an inference from
 * argv. This plugin used to guess instead (see the now-removed
 * `isPluginMgmtContext()`, an argv allow-list for specific CLI subcommands),
 * which had two problems: it couldn't recognize non-full loads that have no
 * distinguishing argv at all (OpenClaw core can load a separate, independent
 * module instance of this plugin for a read-only "discovery" pass during
 * completely normal gateway operation — the actual mechanism behind
 * openclaw/openclaw#166289's duplicate `model.usage` dispatch, since this
 * plugin's diagnostics-event subscription lives on a globalThis-shared
 * dispatcher, not a module-scoped one, so a second "discovery" instance's
 * subscription receives the exact same event dispatch as the real one);
 * and it had to be hand-updated every time core added a new one-shot
 * command. Root-caused and reproduced independently of a live gateway by
 * community contributor Yigtwxx:
 * https://github.com/openclaw/openclaw/issues/166289#issuecomment-6096617591
 *
 * Empirically confirmed live against a real OpenClaw install (2026-10-10,
 * via a temporary instrumented register()) that every one of the old argv
 * allow-list's commands which actually reaches `register()` for this
 * plugin reports a non-`"full"` mode: `plugins doctor` → `"discovery"`,
 * `plugins inspect --runtime --json` → `"tool-discovery"`,
 * `completion --write-state` → `"discovery"` (two of those three differ
 * from what core's own docs/test-file naming would have suggested —
 * confirmed live rather than assumed). `plugins list`/`update`/`uninstall`
 * turned out not to invoke `register()` for a path-sourced plugin at all in
 * the scenarios tested, making their old argv entries already-dead-code.
 * `plugins install` has no safe non-mutating invocation to test this way
 * (no `--dry-run` flag, unlike `update`/`uninstall`), so it keeps a narrow,
 * install-specific argv fallback below rather than relying on
 * `api.registrationMode` alone for a case this plugin never actually
 * observed live.
 *
 * `api.registrationMode` has existed in OpenClaw core since at least
 * 2026-07-16 — well before this plugin's own `minOpenClawVersion:
 * "2026.9.9"` floor — so there is no currently-supported host where this
 * field is genuinely absent. The `undefined` fallback below is kept anyway
 * as a free, zero-cost defensive measure, not because it's expected to
 * ever trigger.
 */
/**
 * Effective per-signal endpoints, honoring `signalEndpoints` overrides —
 * `config.endpoint` alone is misleading once any signal is routed
 * elsewhere, e.g. IONOS Cloud Observability's per-signal ingestion URLs.
 * Shared by the RPC status endpoint, CLI `otel` command, start()'s log
 * line, and the `otel_status` agent tool, so all four report the same
 * thing an operator would see in traces/metrics/logs.
 */
function resolveEffectiveEndpoints(config: OtelObservabilityConfig): {
  traces: string;
  metrics: string;
  logs: string;
} {
  return {
    traces: resolveSignalConfig(config, "traces").endpoint,
    metrics: resolveSignalConfig(config, "metrics").endpoint,
    logs: resolveSignalConfig(config, "logs").endpoint,
  };
}

function isNonFullRegistration(api: { registrationMode?: string }): boolean {
  if (api.registrationMode !== undefined && api.registrationMode !== "full") {
    return true;
  }
  // Narrow argv fallback: `plugins install` couldn't be safely tested live
  // (no --dry-run flag exists for it, unlike update/uninstall), so keep
  // catching it unconditionally here regardless of what registrationMode
  // reports — same safety margin the old isPluginMgmtContext() gave it,
  // not weakened by this change. Also covers any host old enough to not
  // send registrationMode at all.
  const argv = process.argv.slice(1);
  return argv.some((arg, index) => {
    const normalizedArg = arg.toLowerCase();
    const nextArg = argv[index + 1]?.toLowerCase();
    return normalizedArg === "plugins" && nextArg === "install";
  });
}

// ── Public re-exports ───────────────────────────────────────────────
// W3C trace context propagation helpers. Available without the plugin
// register lifecycle so user code (custom RPC, message queues,
// sub-agent transports) can inject/extract `traceparent` directly.
export {
  injectTraceContext,
  extractTraceContext,
  getPropagator,
  setupGlobalPropagator,
  propagationFields,
  type HeaderCarrier,
} from "./src/propagation.js";

const otelObservabilityPlugin = {
  id: "otel-observability",
  name: "OpenTelemetry Observability",
  description:
    "Connected traces, cost tracking, and metrics for OpenClaw via OpenTelemetry",

  configSchema: {
    parse(value: unknown): OtelObservabilityConfig {
      return parseConfig(value);
    },
  },

  register(api: any) {
    const logger = api.logger;
    const config = parseConfig(api.pluginConfig, logger);

    const thisRegistration: NonNullable<typeof activeRegistration> = {
      stopHooks: null,
      unsubscribeDiagnostics: null,
      restoreLogger: null,
      logPipeline: null,
    };

    let telemetry: TelemetryRuntime | null = null;
    let logPipeline: LogPipelineRuntime | null = null;
    let restoreLogger: (() => void) | null = null;
    let unsubscribeDiagnostics: (() => void) | null = null;
    let stopHooks: (() => void) | null = null;

    const shutdownTelemetry = async () => {
      if (!telemetry) return;
      await telemetry.shutdown();
      telemetry = null;
      logger.info("[otel] Telemetry shut down on gateway_stop");
    };

    // ISI-1900: skip long-lived initialization unless this is a real, live
    // "full" registration (see isNonFullRegistration() below). Computed
    // before touching any of the active-registration bookkeeping below —
    // a non-full registration reaching the SAME module instance as a live
    // "full" one must leave that live registration's hooks, diagnostics
    // subscription, and gateway_stop finalizer completely alone. Doing the
    // teardown-previous-registration dance unconditionally here (as this
    // used to) would silently tear down the live registration's telemetry
    // out from under it, with nothing to re-create it since init is
    // skipped for a non-full call — latent until the next restart.
    const skipLongLivedInit = isNonFullRegistration(api);

    if (!skipLongLivedInit) {
      teardownActiveRegistration(logger);
      activeRegistration = thisRegistration;
      gatewayStopFinalizer = shutdownTelemetry;
      gatewayStopFinalizationStarted = false;
    } else {
      logger.info(
        `[otel] Non-full registration (${String(api.registrationMode)}) detected — skipping telemetry init`,
      );
    }

    // ── Telemetry + hooks (init at register() time) ─────────────────
    // Telemetry, the log pipeline, and hooks ALL run during register()
    // so they work in every OpenClaw context, not just the gateway:
    //   - Hooks: OpenClaw snapshots typed hooks at plugin registration,
    //     so registering later means the gateway never sees them.
    //   - Telemetry / log pipeline: api.registerService.start() is a no-op
    //     in embedded runner contexts (openclaw agent CLI, cron,
    //     heartbeat, task-runner, subagent — see openclaw
    //     src/plugins/api-builder.ts). Initializing inside start() means
    //     telemetry/logs stay null in those contexts and every hook is
    //     a no-op.
    // registerHooks returns a cleanup fn (clears the stale-session
    // sweeper interval) so service.stop() doesn't leak the timer.
    // (skipLongLivedInit itself is computed above, before the
    // active-registration bookkeeping — see the comment there.)

    try {
      if (!skipLongLivedInit) {
        telemetry = initTelemetry(config, logger);
      }

      // ISI-997 — wire the OTLP log pipeline + bridge api.logger calls so
      // every gateway log emitted by this plugin (and anyone holding the
      // same logger reference) is exported as an OTel LogRecord.
      // ISI-1710/ISI-1900: gate behind !skipLongLivedInit — initLogPipeline()
      // starts a BatchLogRecordProcessor (repeating flush timer + OTLP
      // exporter) and mutates the global LoggerProvider. Since `logs`
      // defaults to true, an unguarded pipeline would start long-lived
      // exporter work during a non-full registration (and, under
      // protocol: grpc, keep the event loop alive so a one-shot CLI
      // invocation never exits) — the exact failure this guard exists to
      // prevent.
      if (!skipLongLivedInit && config.logs) {
        logPipeline = initLogPipeline(config, logger);
        thisRegistration.logPipeline = logPipeline;
        if (logPipeline) {
          restoreLogger = bridgeGatewayLogger(logger, logPipeline.emit);
          thisRegistration.restoreLogger = restoreLogger;
          logger.info("[otel] Gateway logger bridged to OTel log pipeline");
        }
      }

      // ISI-1900: only register hooks for a real, live "full" registration.
      // Hooks are snapshotted by OpenClaw at registration time; skipping
      // them here means a real gateway (which always registers as "full")
      // still gets them when it loads the plugin normally.
      if (!skipLongLivedInit) {
        stopHooks = registerHooks(api, () => telemetry, config);
        thisRegistration.stopHooks = stopHooks;
      }
      // `api.on` does not expose an unsubscribe handle. If a host retains
      // old hook registrations across hot reloads, every registered wrapper
      // shares this module-level guard and dispatches only the latest finalizer.
      api.on?.("gateway_stop", async () => {
        if (gatewayStopFinalizationStarted) return;
        gatewayStopFinalizationStarted = true;
        await gatewayStopFinalizer?.();
      });
      if (skipLongLivedInit) {
        logger.info("[otel] Non-full registration - hooks skipped, CLI will exit cleanly");
      } else {
        logger.info("[otel] Telemetry + hooks initialized at register() (runner-compatible)");
      }
    } catch (err) {
      logger.error(`[otel] Failed to initialize telemetry at register() time: ${String(err)}`);
    }

    // ── RPC: status endpoint ────────────────────────────────────────

    api.registerGatewayMethod(
      "otel-observability.status",
      ({ respond }: { respond: (ok: boolean, payload?: unknown) => void }) => {
        respond(true, {
          initialized: telemetry !== null,
          config: {
            endpoint: config.endpoint,
            effectiveEndpoints: resolveEffectiveEndpoints(config),
            protocol: config.protocol,
            serviceName: config.serviceName,
            traces: config.traces,
            metrics: config.metrics,
            logs: config.logs,
            captureContent: config.captureContent,
          },
        });
      }
    );

    // ── CLI command ─────────────────────────────────────────────────

    api.registerCli(
      ({ program }: { program: any }) => {
        program
          .command("otel")
          .description("OpenTelemetry observability status")
          .action(async () => {
            const effective = resolveEffectiveEndpoints(config);
            console.log("🔭 OpenTelemetry Observability Plugin");
            console.log("─".repeat(40));
            console.log(`  Endpoint:        ${config.endpoint} (shared default; see per-signal below if overridden)`);
            console.log(`  Protocol:        ${config.protocol}`);
            console.log(`  Service:         ${config.serviceName}`);
            console.log(`  Traces:          ${config.traces ? "✅" : "❌"} → ${effective.traces}`);
            console.log(`  Metrics:         ${config.metrics ? "✅" : "❌"} → ${effective.metrics}`);
            console.log(`  Logs:            ${config.logs ? "✅" : "❌"} → ${effective.logs}`);
            const policy = config.captureContent;
            const onFlags = (Object.keys(policy) as Array<keyof typeof policy>)
              .filter((k) => policy[k]);
            const capContentStr =
              onFlags.length === 0
                ? "❌ none"
                : onFlags.length === Object.keys(policy).length
                  ? "✅ all"
                  : `⚠️ ${onFlags.join(", ")}`;
            console.log(`  Capture content: ${capContentStr}`);
            console.log(`  Initialized:     ${telemetry ? "✅" : "❌"}`);
            console.log(`  Cost tracking:   ${hasDiagnosticsSupport() ? "✅ (via diagnostics API)" : "❌"}`);

          });
      },
      { commands: ["otel"] }
    );

    // Subscribe to diagnostic events immediately (not just in start())
    // so we capture gateway health metrics even if start() isn't called.
    // ISI-1710: skip in plugin-mgmt contexts to avoid async work that
    // prevents CLI exit.
    if (telemetry && !skipLongLivedInit) {
      registerDiagnosticsListener(telemetry, config, logger).then((unsub) => {
        // This resolves asynchronously (loadSdk()/loadInternalDiagnostics()
        // await internally). If stop() or a fresh register() already ran
        // by the time it settles, `activeRegistration` no longer points at
        // `thisRegistration` — stashing `unsub` as live here would leak a
        // still-attached listener nothing else knows to ever call (the
        // same stacked-listener shape as the #166289/duplicate-register
        // bug this file otherwise guards against). Unsubscribe it
        // immediately instead of keeping it.
        if (activeRegistration !== thisRegistration) {
          unsub();
          return;
        }
        unsubscribeDiagnostics = unsub;
        thisRegistration.unsubscribeDiagnostics = unsub;
        if (hasDiagnosticsSupport()) {
          logger.info("[otel] Integrated with OpenClaw diagnostics (cost tracking enabled)");
        }
      }).catch((err) => {
        logger.error(`[otel] Failed to register diagnostics listener: ${String(err)}`);
      });
    }

    // ── Background service ──────────────────────────────────────────

    api.registerService({
      id: "otel-observability",

      start: async () => {
        logger.info("[otel] Starting OpenTelemetry observability (gateway-only init)...");

        // Telemetry + hooks are already initialized at register() time so
        // they work in both gateway and embedded runner contexts. Only
        // gateway-specific work lives here.

        // Bridge captureContent → env vars consumed by the preload.
        // The preload reads these at gateway launch, but any subprocess
        // spawned later inherits them from here too. If the preload was
        // already active with a mismatched value, LLM-client spans will
        // reflect the preload's value (not the plugin config) — warn so
        // operators know to set the env vars before launching the gateway.
        //
        // Two vars are published:
        //   - OPENCLAW_OTEL_CONTENT_POLICY: full granular policy as JSON
        //     (ISI-1000). The preload reads this with precedence.
        //   - OPENCLAW_OTEL_CAPTURE_CONTENT: legacy single boolean
        //     (`inputMessages || outputMessages || systemPrompt`), kept
        //     for older preloads and external subprocesses that still
        //     read the legacy flag.
        //
        // Precedence (subprocesses): these assignments **always
        // overwrite** whatever the gateway was launched with. A
        // subprocess spawned by gateway code (e.g. a child OpenClaw
        // runner) therefore inherits the plugin's resolved policy, not
        // whatever the operator originally set in the gateway's
        // environment. This is intentional — plugin config is the
        // authority for in-process behavior; the env vars exist only to
        // brief the preload that ran before plugin config was parsed.
        // If you need a subprocess to see a different value, set it
        // explicitly in that subprocess's spawn-time env, not in the
        // gateway's.
        const llmContentEnabled = policyEnablesLlmContent(config.captureContent);
        const policyJson = JSON.stringify(config.captureContent);
        const preloadActive = hasPreloadedOtelSdk();
        const preloadResolved = (globalThis as any).__OPENCLAW_OTEL_CAPTURE_CONTENT;
        if (preloadActive && preloadResolved !== llmContentEnabled) {
          logger.warn(
            `[otel] captureContent policy resolves traceContent=${llmContentEnabled} but the preload resolved OPENCLAW_OTEL_CAPTURE_CONTENT=${preloadResolved} at gateway launch. ` +
              `Traceloop LLM-client spans will use the preload's value. ` +
              `Set OPENCLAW_OTEL_CONTENT_POLICY='${policyJson}' (or OPENCLAW_OTEL_CAPTURE_CONTENT=${llmContentEnabled}) in the gateway's environment before starting (see docs/security/privacy.md).`
          );
        }
        process.env.OPENCLAW_OTEL_CAPTURE_CONTENT = String(llmContentEnabled);
        process.env.OPENCLAW_OTEL_CONTENT_POLICY = policyJson;

        // 1. Wrap LLM SDKs. The wraps use trace.getTracer() which goes
        //    through the provider we registered above. OpenLLMetry's
        //    IITM preload only matters in the long-running gateway
        //    process, so leave it here.
        if (config.traces) {
          await initOpenLLMetry(config, logger);
        }

        const effectiveEndpoints = resolveEffectiveEndpoints(config);
        logger.info("[otel] ✅ Observability pipeline active (gateway-side)");
        logger.info(
          `[otel]   Traces=${config.traces} Metrics=${config.metrics} Logs=${config.logs}`
        );
        logger.info(`[otel]   Endpoint=${config.endpoint} (${config.protocol}, shared default)`);
        logger.info(
          `[otel]   Effective endpoints: traces=${effectiveEndpoints.traces} metrics=${effectiveEndpoints.metrics} logs=${effectiveEndpoints.logs}`
        );
      },

      stop: async () => {
        if (stopHooks) {
          stopHooks();
          stopHooks = null;
        }
        if (unsubscribeDiagnostics) {
          unsubscribeDiagnostics();
          unsubscribeDiagnostics = null;
        }
        if (restoreLogger) {
          restoreLogger();
          restoreLogger = null;
        }
        if (logPipeline) {
          await logPipeline.shutdown();
          logPipeline = null;
        }
        // A proper stop() already tore this registration's resources down
        // cleanly — clear the module-level tracking so the next register()
        // call's teardownActiveRegistration() finds nothing stale to warn
        // about (this was a correct stop()→register() hot-reload, not the
        // buggy repeated-register()-without-stop() case it guards against).
        if (activeRegistration === thisRegistration) {
          activeRegistration = null;
        }
        // Flush pending data but do NOT destroy the providers. OC's config
        // hot-reload calls stop() → register() in sequence; a destructive
        // shutdown() here kills the TracerProvider's exporter, and the new
        // register() cycle's hooks still hold closures over the old runtime
        // whose tracer routes through the (now dead) global provider.
        // Flush is non-destructive: pending spans/metrics drain to the
        // collector, but the providers stay usable for the existing hooks.
        // True shutdown happens on process exit via the OTel SDK's
        // registered signal handlers.
        if (telemetry) {
          await telemetry.flush();
          logger.info("[otel] Telemetry flushed (providers preserved for hot-reload)");
        }
      },
    });

    // ── Agent tool: otel_status ─────────────────────────────────────
    // Lets the agent check observability status in conversation

    api.registerTool(
      {
        name: "otel_status",
        label: "OTel Status",
        description:
          "Check the OpenTelemetry observability plugin status and configuration.",
        parameters: {
          type: "object",
          properties: {},
          additionalProperties: false,
        },
        async execute() {
          const status = {
            initialized: telemetry !== null,
            endpoint: config.endpoint,
            effectiveEndpoints: resolveEffectiveEndpoints(config),
            protocol: config.protocol,
            serviceName: config.serviceName,
            traces: config.traces,
            metrics: config.metrics,
            logs: config.logs,
            captureContent: config.captureContent,
          };
          return {
            content: [
              {
                type: "text",
                text: JSON.stringify(status, null, 2),
              },
            ],
          };
        },
      },
      { optional: true }
    );
  },
};

export default otelObservabilityPlugin;
