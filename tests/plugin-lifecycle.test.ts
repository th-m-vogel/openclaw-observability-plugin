import { afterEach, describe, expect, it, vi } from "vitest";

describe("plugin service lifecycle", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.resetModules();
  });

  // ISI-1900 (openclaw/openclaw#166289): register()'s heavy init is gated
  // on api.registrationMode === "full", the authoritative signal OpenClaw
  // core already provides on every register() call — replacing the former
  // argv-based isPluginMgmtContext() heuristic, which couldn't recognize a
  // non-full load with no distinguishing argv at all (the actual mechanism
  // behind #166289's duplicate model.usage dispatch). Empirically confirmed
  // live (2026-10-10, see STATUS.md) against a real OpenClaw install: every
  // one of these modes is what the named real command actually reports.
  async function registerWithMode(params: { registrationMode?: string; argv?: string[] }) {
    vi.resetModules();

    const originalArgv = [...process.argv];
    if (params.argv) {
      process.argv = [originalArgv[0] ?? "node", originalArgv[1] ?? "openclaw", ...params.argv];
    }

    // initTelemetry must return a truthy value — register()'s diagnostics
    // subscription is additionally gated on `telemetry` being truthy
    // (`if (telemetry && !skipLongLivedInit)`), so a bare vi.fn() (which
    // returns undefined) would make registerDiagnosticsListener never get
    // called regardless of the registrationMode gate under test, masking
    // what this test block is actually trying to prove.
    const initTelemetry = vi.fn(() => ({ shutdown: vi.fn().mockResolvedValue(undefined) }));
    const registerHooks = vi.fn();
    const registerDiagnosticsListener = vi.fn().mockResolvedValue(() => {});
    const initLogPipeline = vi.fn(() => null);

    vi.doMock("../src/telemetry.js", () => ({
      initTelemetry,
      hasPreloadedOtelSdk: vi.fn(() => false),
    }));
    vi.doMock("../src/openllmetry.js", () => ({
      initOpenLLMetry: vi.fn(),
    }));
    vi.doMock("../src/hooks.js", () => ({
      registerHooks,
    }));
    vi.doMock("../src/diagnostics.js", () => ({
      registerDiagnosticsListener,
      hasDiagnosticsSupport: vi.fn(() => true),
    }));
    vi.doMock("../src/logs.js", () => ({
      initLogPipeline,
      bridgeGatewayLogger: vi.fn(),
    }));

    const api: Record<string, unknown> = {
      logger: {
        debug: vi.fn(),
        info: vi.fn(),
        warn: vi.fn(),
        error: vi.fn(),
      },
      pluginConfig: {
        endpoint: "http://127.0.0.1:14318",
        traces: true,
        metrics: true,
        // ISI-1710: exercise the real default (logs on) so the guard is
        // proven to skip the long-lived OTLP log pipeline too, not just
        // telemetry/hooks.
        logs: true,
      },
      registerGatewayMethod: vi.fn(),
      registerCli: vi.fn(),
      registerService: vi.fn(),
      registerTool: vi.fn(),
      on: vi.fn(),
    };
    if (params.registrationMode !== undefined) {
      api.registrationMode = params.registrationMode;
    }

    try {
      const plugin = (await import("../index.js")).default;
      plugin.register(api);
      await Promise.resolve();
    } finally {
      process.argv = originalArgv;
    }

    return { api, initTelemetry, registerHooks, registerDiagnosticsListener, initLogPipeline };
  }

  // Named after the real commands each registrationMode was empirically
  // confirmed (2026-10-10, live host, see STATUS.md) to actually report —
  // two of three differ from what core's own docs/test-file naming alone
  // would have suggested, which is exactly why this was tested live rather
  // than assumed.
  const confirmedNonFullCases = [
    { command: "plugins doctor", registrationMode: "discovery" },
    { command: "plugins inspect --runtime --json", registrationMode: "tool-discovery" },
    { command: "completion --write-state", registrationMode: "discovery" },
  ] as const;

  it.each(confirmedNonFullCases)(
    "skips long-lived init for $command (registrationMode: $registrationMode)",
    async ({ registrationMode }) => {
      const { initTelemetry, registerHooks, registerDiagnosticsListener, initLogPipeline, api } =
        await registerWithMode({ registrationMode });

      expect(initTelemetry).not.toHaveBeenCalled();
      expect(registerHooks).not.toHaveBeenCalled();
      expect(registerDiagnosticsListener).not.toHaveBeenCalled();
      expect(initLogPipeline).not.toHaveBeenCalled();
      expect((api.logger as { info: ReturnType<typeof vi.fn> }).info).toHaveBeenCalledWith(
        `[otel] Non-full registration (${registrationMode}) detected — skipping telemetry init`,
      );
    },
  );

  it("skips long-lived init for `plugins install` via the argv fallback (no safe live test exists for this command)", async () => {
    const { initTelemetry, registerHooks, registerDiagnosticsListener, initLogPipeline } =
      await registerWithMode({ argv: ["plugins", "install"] });

    expect(initTelemetry).not.toHaveBeenCalled();
    expect(registerHooks).not.toHaveBeenCalled();
    expect(registerDiagnosticsListener).not.toHaveBeenCalled();
    expect(initLogPipeline).not.toHaveBeenCalled();
  });

  it("skips long-lived init for an undocumented future registrationMode value", async () => {
    const { initTelemetry, registerHooks, registerDiagnosticsListener, initLogPipeline } =
      await registerWithMode({ registrationMode: "some-future-mode-core-hasnt-documented-yet" });

    expect(initTelemetry).not.toHaveBeenCalled();
    expect(registerHooks).not.toHaveBeenCalled();
    expect(registerDiagnosticsListener).not.toHaveBeenCalled();
    expect(initLogPipeline).not.toHaveBeenCalled();
  });

  it("still runs long-lived init when registrationMode is \"full\" (normal gateway startup, confirmed live)", async () => {
    const { initTelemetry, registerHooks, registerDiagnosticsListener } =
      await registerWithMode({ registrationMode: "full" });

    expect(initTelemetry).toHaveBeenCalled();
    expect(registerHooks).toHaveBeenCalled();
    expect(registerDiagnosticsListener).toHaveBeenCalled();
  });

  it("still runs long-lived init when registrationMode is undefined (older host, back-compat only — no currently-supported host actually lacks this field)", async () => {
    const { initTelemetry, registerHooks, registerDiagnosticsListener } =
      await registerWithMode({});

    expect(initTelemetry).toHaveBeenCalled();
    expect(registerHooks).toHaveBeenCalled();
    expect(registerDiagnosticsListener).toHaveBeenCalled();
  });

  it("a non-full register() reaching the SAME module instance as a live full registration leaves it untouched", async () => {
    // Regression test for a latent ordering bug: register() used to call
    // teardownActiveRegistration() and overwrite activeRegistration /
    // gatewayStopFinalizer unconditionally, BEFORE checking whether this
    // call is itself a full registration. If a non-full register() ever
    // reached the same module instance as an already-live full one (e.g.
    // via the ESM module cache, rather than the separate instance the
    // "discovery" mechanism normally creates), it would silently tear
    // down the live registration's hooks/diagnostics/telemetry with
    // nothing to re-create them, since init is skipped for a non-full
    // call — and gateway_stop would then flush a finalizer pointing at
    // telemetry: null.
    vi.resetModules();

    const shutdownFirst = vi.fn().mockResolvedValue(undefined);
    const stopHooksFirst = vi.fn();
    const unsubscribeDiagnosticsFirst = vi.fn();
    const restoreLoggerFirst = vi.fn();

    const initTelemetry = vi.fn(() => ({ shutdown: shutdownFirst }));
    const registerHooks = vi.fn(() => stopHooksFirst);
    const registerDiagnosticsListener = vi.fn().mockResolvedValue(unsubscribeDiagnosticsFirst);
    const initLogPipeline = vi.fn(() => null);

    vi.doMock("../src/telemetry.js", () => ({
      initTelemetry,
      hasPreloadedOtelSdk: vi.fn(() => false),
    }));
    vi.doMock("../src/openllmetry.js", () => ({
      initOpenLLMetry: vi.fn(),
    }));
    vi.doMock("../src/hooks.js", () => ({
      registerHooks,
    }));
    vi.doMock("../src/diagnostics.js", () => ({
      registerDiagnosticsListener,
      hasDiagnosticsSupport: vi.fn(() => true),
    }));
    vi.doMock("../src/logs.js", () => ({
      initLogPipeline,
      bridgeGatewayLogger: vi.fn(() => restoreLoggerFirst),
    }));

    const plugin = (await import("../index.js")).default;

    let gatewayStopCallback: (() => Promise<void>) | null = null;
    const makeApi = (registrationMode: string | undefined) => {
      const api: Record<string, unknown> = {
        logger: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() },
        pluginConfig: { endpoint: "http://127.0.0.1:14318", traces: true, metrics: true, logs: true },
        registerGatewayMethod: vi.fn(),
        registerCli: vi.fn(),
        registerService: vi.fn(),
        registerTool: vi.fn(),
        on: vi.fn((event: string, cb: () => Promise<void>) => {
          if (event === "gateway_stop") gatewayStopCallback = cb;
        }),
      };
      if (registrationMode !== undefined) api.registrationMode = registrationMode;
      return api;
    };

    // First call: a real, live "full" registration.
    const apiFull = makeApi("full");
    plugin.register(apiFull);
    await Promise.resolve();

    expect(initTelemetry).toHaveBeenCalledTimes(1);
    expect(registerHooks).toHaveBeenCalledTimes(1);
    expect(gatewayStopCallback).not.toBeNull();

    // Second call, same module instance: a non-full registration (the
    // scenario this test exists for).
    const apiDiscovery = makeApi("discovery");
    plugin.register(apiDiscovery);
    await Promise.resolve();

    // The non-full call must not have torn anything down or re-initialized.
    expect(shutdownFirst).not.toHaveBeenCalled();
    expect(stopHooksFirst).not.toHaveBeenCalled();
    expect(unsubscribeDiagnosticsFirst).not.toHaveBeenCalled();
    expect(initTelemetry).toHaveBeenCalledTimes(1);
    expect(registerHooks).toHaveBeenCalledTimes(1);

    // gateway_stop must still flush the FIRST (live) registration's real
    // telemetry, not a finalizer left pointing at a torn-down/null one.
    await gatewayStopCallback!();
    expect(shutdownFirst).toHaveBeenCalledTimes(1);
  });

  it("a diagnostics subscription that resolves AFTER stop() is unsubscribed immediately, not kept live", async () => {
    // registerDiagnosticsListener() awaits internally (loadSdk() etc.), so
    // it can resolve after stop() (or a fresh register()) already ran.
    // Stashing that late `unsub` as this registration's live subscription
    // would leak a still-attached listener nothing else knows to call —
    // the same stacked-listener shape #166289 was caused by.
    vi.resetModules();

    let resolveSubscription: ((unsub: () => void) => void) | null = null;
    const lateUnsub = vi.fn();
    const registerDiagnosticsListener = vi.fn(
      () => new Promise<() => void>((resolve) => { resolveSubscription = resolve; }),
    );

    vi.doMock("../src/telemetry.js", () => ({
      initTelemetry: vi.fn(() => ({ shutdown: vi.fn().mockResolvedValue(undefined), flush: vi.fn().mockResolvedValue(undefined) })),
      hasPreloadedOtelSdk: vi.fn(() => false),
    }));
    vi.doMock("../src/openllmetry.js", () => ({
      initOpenLLMetry: vi.fn(),
    }));
    vi.doMock("../src/hooks.js", () => ({
      registerHooks: vi.fn(() => vi.fn()),
    }));
    vi.doMock("../src/diagnostics.js", () => ({
      registerDiagnosticsListener,
      hasDiagnosticsSupport: vi.fn(() => true),
    }));
    vi.doMock("../src/logs.js", () => ({
      initLogPipeline: vi.fn(() => null),
      bridgeGatewayLogger: vi.fn(),
    }));

    const services: Array<{ stop?: () => Promise<void> }> = [];
    const api = {
      logger: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() },
      pluginConfig: { endpoint: "http://127.0.0.1:14318", traces: true, metrics: true, logs: false },
      registerGatewayMethod: vi.fn(),
      registerCli: vi.fn(),
      registerService: vi.fn((service) => services.push(service)),
      registerTool: vi.fn(),
      on: vi.fn(),
    };

    const plugin = (await import("../index.js")).default;
    plugin.register(api);
    await Promise.resolve();

    expect(registerDiagnosticsListener).toHaveBeenCalledTimes(1);
    expect(resolveSubscription).not.toBeNull();

    // stop() runs BEFORE the subscription promise ever settles.
    await services[0]!.stop?.();

    // Now the late subscription resolves.
    resolveSubscription!(lateUnsub);
    await Promise.resolve();
    await Promise.resolve();

    expect(lateUnsub).toHaveBeenCalledTimes(1);
  });

  it("stop flushes telemetry without destructively shutting providers down", async () => {
    vi.resetModules();

    const flush = vi.fn().mockResolvedValue(undefined);
    const shutdown = vi.fn().mockResolvedValue(undefined);
    const stopHooks = vi.fn();
    const unsubscribeDiagnostics = vi.fn();

    vi.doMock("../src/telemetry.js", () => ({
      initTelemetry: vi.fn(() => ({
        tracer: {},
        meter: {},
        counters: {},
        histograms: {},
        gauges: {},
        flush,
        shutdown,
      })),
      hasPreloadedOtelSdk: vi.fn(() => false),
    }));
    vi.doMock("../src/openllmetry.js", () => ({
      initOpenLLMetry: vi.fn(),
    }));
    vi.doMock("../src/hooks.js", () => ({
      registerHooks: vi.fn(() => stopHooks),
    }));
    vi.doMock("../src/diagnostics.js", () => ({
      registerDiagnosticsListener: vi.fn().mockResolvedValue(unsubscribeDiagnostics),
      hasDiagnosticsSupport: vi.fn(() => true),
    }));
    vi.doMock("../src/logs.js", () => ({
      initLogPipeline: vi.fn(() => null),
      bridgeGatewayLogger: vi.fn(),
    }));

    const services: Array<{ stop?: () => Promise<void> }> = [];
    const api = {
      logger: {
        debug: vi.fn(),
        info: vi.fn(),
        warn: vi.fn(),
        error: vi.fn(),
      },
      pluginConfig: {
        endpoint: "http://127.0.0.1:14318",
        traces: true,
        metrics: true,
        logs: false,
      },
      registerGatewayMethod: vi.fn(),
      registerCli: vi.fn(),
      registerService: vi.fn((service) => services.push(service)),
      registerTool: vi.fn(),
      on: vi.fn(),
    };

    const plugin = (await import("../index.js")).default;
    plugin.register(api);
    await Promise.resolve();

    expect(services).toHaveLength(1);
    await services[0]!.stop?.();

    expect(stopHooks).toHaveBeenCalledTimes(1);
    expect(unsubscribeDiagnostics).toHaveBeenCalledTimes(1);
    expect(flush).toHaveBeenCalledTimes(1);
    expect(shutdown).not.toHaveBeenCalled();
    expect(api.logger.info).toHaveBeenCalledWith(
      "[otel] Telemetry flushed (providers preserved for hot-reload)",
    );
  });

  it("gateway_stop destructively shuts telemetry down once", async () => {
    vi.resetModules();

    const flush = vi.fn().mockResolvedValue(undefined);
    const shutdown = vi.fn().mockResolvedValue(undefined);
    const stopHooks = vi.fn();
    const gatewayHooks = new Map<string, () => Promise<void>>();

    vi.doMock("../src/telemetry.js", () => ({
      initTelemetry: vi.fn(() => ({
        tracer: {},
        meter: {},
        counters: {},
        histograms: {},
        gauges: {},
        flush,
        shutdown,
      })),
      hasPreloadedOtelSdk: vi.fn(() => false),
    }));
    vi.doMock("../src/openllmetry.js", () => ({
      initOpenLLMetry: vi.fn(),
    }));
    vi.doMock("../src/hooks.js", () => ({
      registerHooks: vi.fn(() => stopHooks),
    }));
    vi.doMock("../src/diagnostics.js", () => ({
      registerDiagnosticsListener: vi.fn().mockResolvedValue(() => {}),
      hasDiagnosticsSupport: vi.fn(() => true),
    }));
    vi.doMock("../src/logs.js", () => ({
      initLogPipeline: vi.fn(() => null),
      bridgeGatewayLogger: vi.fn(),
    }));

    const services: Array<{ stop?: () => Promise<void> }> = [];
    const api = {
      logger: {
        debug: vi.fn(),
        info: vi.fn(),
        warn: vi.fn(),
        error: vi.fn(),
      },
      pluginConfig: {
        endpoint: "http://127.0.0.1:14318",
        traces: true,
        metrics: true,
        logs: false,
      },
      registerGatewayMethod: vi.fn(),
      registerCli: vi.fn(),
      registerService: vi.fn((service) => services.push(service)),
      registerTool: vi.fn(),
      on: vi.fn((hookName: string, handler: () => Promise<void>) => {
        gatewayHooks.set(hookName, handler);
      }),
    };

    const plugin = (await import("../index.js")).default;
    plugin.register(api);
    await Promise.resolve();

    expect(api.on).toHaveBeenCalledWith("gateway_stop", expect.any(Function));
    await gatewayHooks.get("gateway_stop")!();
    await gatewayHooks.get("gateway_stop")!();

    expect(shutdown).toHaveBeenCalledTimes(1);
    expect(api.logger.info).toHaveBeenCalledWith(
      "[otel] Telemetry shut down on gateway_stop",
    );

    await services[0]!.stop?.();
    expect(flush).not.toHaveBeenCalled();
  });

  it("accumulated gateway_stop handlers across reload finalize only once", async () => {
    vi.resetModules();

    const firstShutdown = vi.fn().mockResolvedValue(undefined);
    const secondShutdown = vi.fn().mockResolvedValue(undefined);
    const stopHooks = vi.fn();
    const gatewayHooks: Array<() => Promise<void>> = [];

    vi.doMock("../src/telemetry.js", () => ({
      initTelemetry: vi.fn()
        .mockReturnValueOnce({
          tracer: {},
          meter: {},
          counters: {},
          histograms: {},
          gauges: {},
          flush: vi.fn().mockResolvedValue(undefined),
          shutdown: firstShutdown,
        })
        .mockReturnValueOnce({
          tracer: {},
          meter: {},
          counters: {},
          histograms: {},
          gauges: {},
          flush: vi.fn().mockResolvedValue(undefined),
          shutdown: secondShutdown,
        }),
      hasPreloadedOtelSdk: vi.fn(() => false),
    }));
    vi.doMock("../src/openllmetry.js", () => ({
      initOpenLLMetry: vi.fn(),
    }));
    vi.doMock("../src/hooks.js", () => ({
      registerHooks: vi.fn(() => stopHooks),
    }));
    vi.doMock("../src/diagnostics.js", () => ({
      registerDiagnosticsListener: vi.fn().mockResolvedValue(() => {}),
      hasDiagnosticsSupport: vi.fn(() => true),
    }));
    vi.doMock("../src/logs.js", () => ({
      initLogPipeline: vi.fn(() => null),
      bridgeGatewayLogger: vi.fn(),
    }));

    const services: Array<{ stop?: () => Promise<void> }> = [];
    const api = {
      logger: {
        debug: vi.fn(),
        info: vi.fn(),
        warn: vi.fn(),
        error: vi.fn(),
      },
      pluginConfig: {
        endpoint: "http://127.0.0.1:14318",
        traces: true,
        metrics: true,
        logs: false,
      },
      registerGatewayMethod: vi.fn(),
      registerCli: vi.fn(),
      registerService: vi.fn((service) => services.push(service)),
      registerTool: vi.fn(),
      on: vi.fn((_hookName: string, handler: () => Promise<void>) => {
        gatewayHooks.push(handler);
      }),
    };

    const plugin = (await import("../index.js")).default;
    plugin.register(api);
    await services[0]!.stop?.();
    plugin.register(api);
    await Promise.resolve();

    expect(gatewayHooks).toHaveLength(2);
    await Promise.all(gatewayHooks.map((handler) => handler()));

    expect(firstShutdown).not.toHaveBeenCalled();
    expect(secondShutdown).toHaveBeenCalledTimes(1);
    expect(api.logger.info.mock.calls.filter(
      (call) => call[0] === "[otel] Telemetry shut down on gateway_stop",
    )).toHaveLength(1);
  });

  it("register() called again without a preceding stop() tears down the previous registration's hooks/diagnostics-listener/log-pipeline first (prevents duplicate model.usage cost/token counting)", async () => {
    vi.resetModules();

    const stopHooksFirst = vi.fn();
    const stopHooksSecond = vi.fn();
    const unsubscribeFirst = vi.fn();
    const unsubscribeSecond = vi.fn();
    const restoreLoggerFirst = vi.fn();
    const restoreLoggerSecond = vi.fn();
    const logPipelineShutdownFirst = vi.fn().mockResolvedValue(undefined);
    const logPipelineShutdownSecond = vi.fn().mockResolvedValue(undefined);

    const registerHooks = vi.fn()
      .mockReturnValueOnce(stopHooksFirst)
      .mockReturnValueOnce(stopHooksSecond);
    const registerDiagnosticsListener = vi.fn()
      .mockResolvedValueOnce(unsubscribeFirst)
      .mockResolvedValueOnce(unsubscribeSecond);
    const bridgeGatewayLogger = vi.fn()
      .mockReturnValueOnce(restoreLoggerFirst)
      .mockReturnValueOnce(restoreLoggerSecond);
    const initLogPipeline = vi.fn()
      .mockReturnValueOnce({ emit: vi.fn(), shutdown: logPipelineShutdownFirst })
      .mockReturnValueOnce({ emit: vi.fn(), shutdown: logPipelineShutdownSecond });

    vi.doMock("../src/telemetry.js", () => ({
      initTelemetry: vi.fn(() => ({
        tracer: {},
        meter: {},
        counters: {},
        histograms: {},
        gauges: {},
        flush: vi.fn().mockResolvedValue(undefined),
        shutdown: vi.fn().mockResolvedValue(undefined),
      })),
      hasPreloadedOtelSdk: vi.fn(() => false),
    }));
    vi.doMock("../src/openllmetry.js", () => ({
      initOpenLLMetry: vi.fn(),
    }));
    vi.doMock("../src/hooks.js", () => ({
      registerHooks,
    }));
    vi.doMock("../src/diagnostics.js", () => ({
      registerDiagnosticsListener,
      hasDiagnosticsSupport: vi.fn(() => true),
    }));
    vi.doMock("../src/logs.js", () => ({
      initLogPipeline,
      bridgeGatewayLogger,
    }));

    const api = {
      logger: {
        debug: vi.fn(),
        info: vi.fn(),
        warn: vi.fn(),
        error: vi.fn(),
      },
      pluginConfig: {
        endpoint: "http://127.0.0.1:14318",
        traces: true,
        metrics: true,
        logs: true,
      },
      registerGatewayMethod: vi.fn(),
      registerCli: vi.fn(),
      registerService: vi.fn(),
      registerTool: vi.fn(),
      on: vi.fn(),
    };

    const plugin = (await import("../index.js")).default;

    // First registration — no stop() in between, simulating OpenClaw
    // calling register() again without the documented stop()→register()
    // hot-reload sequence (the confirmed trigger behind duplicate
    // model.usage cost/token events: a single real event fires every
    // still-attached stacked listener from prior, never-torn-down
    // registrations).
    plugin.register(api);
    await Promise.resolve();
    plugin.register(api);
    await Promise.resolve();

    expect(stopHooksFirst).toHaveBeenCalledTimes(1);
    expect(unsubscribeFirst).toHaveBeenCalledTimes(1);
    expect(restoreLoggerFirst).toHaveBeenCalledTimes(1);
    expect(logPipelineShutdownFirst).toHaveBeenCalledTimes(1);

    // The second (current) registration's resources must still be live —
    // this isn't a general teardown, only the stale previous one's.
    expect(stopHooksSecond).not.toHaveBeenCalled();
    expect(unsubscribeSecond).not.toHaveBeenCalled();
    expect(restoreLoggerSecond).not.toHaveBeenCalled();
    expect(logPipelineShutdownSecond).not.toHaveBeenCalled();

    expect(api.logger.warn).toHaveBeenCalledWith(
      expect.stringContaining("register() called again without a preceding stop()"),
    );
  });
});
