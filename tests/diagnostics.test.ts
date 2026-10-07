import { mkdirSync, mkdtempSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";

const roots: string[] = [];

function makeInstallRoot(): string {
  const root = mkdtempSync(path.join(tmpdir(), "openclaw-otel-diag-"));
  roots.push(root);
  mkdirSync(path.join(root, "dist"), { recursive: true });
  writeFileSync(path.join(root, "openclaw.mjs"), "await import('./dist/entry.js');\n");
  writeFileSync(path.join(root, "dist", "entry.js"), "export {};\n");
  return root;
}

function writeChunk(root: string, source: string, chunkName?: string): string {
  const chunk = chunkName ?? `diagnostic-events-${path.basename(root).replace(/\W/g, "")}.js`;
  writeFileSync(path.join(root, "dist", chunk), source);
  return chunk;
}

function createLogger() {
  return {
    debug: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
  };
}

function createCounter() {
  return { add: vi.fn() };
}

function createHistogram() {
  return { record: vi.fn() };
}

function createTelemetry() {
  return {
    counters: {
      llmRequests: createCounter(),
      tokensCompletion: createCounter(),
      tokensPrompt: createCounter(),
      tokensSkill: createCounter(),
      tokensSystem: createCounter(),
      tokensToolResult: createCounter(),
      tokensTotal: createCounter(),
      tokensUser: createCounter(),
    },
    histograms: {
      genAiOperationDuration: createHistogram(),
      genAiTokenUsage: createHistogram(),
      llmDuration: createHistogram(),
    },
    meter: {
      createCounter: vi.fn(() => createCounter()),
    },
  };
}

async function loadFreshDiagnostics() {
  vi.resetModules();
  return import("../src/diagnostics.js");
}

async function withArgvEntry<T>(entryFile: string, run: () => Promise<T>): Promise<T> {
  const previous = process.argv[1];
  process.argv[1] = entryFile;
  try {
    return await run();
  } finally {
    process.argv[1] = previous;
  }
}

async function registerWithEntry(
  entryFile: string,
  logger = createLogger(),
  telemetry = createTelemetry(),
) {
  const diagnostics = await loadFreshDiagnostics();
  const unsubscribe = await withArgvEntry(entryFile, () =>
    diagnostics.registerDiagnosticsListener(telemetry as any, logger),
  );
  return { diagnostics, logger, unsubscribe };
}

afterEach(() => {
  while (roots.length > 0) {
    rmSync(roots.pop()!, { recursive: true, force: true });
  }
});

describe("internal diagnostics loader path resolution", () => {
  it("loads from package-root dist for the packaged openclaw.mjs launcher", async () => {
    const root = makeInstallRoot();
    writeChunk(
      root,
      "function onInternalDiagnosticEvent() { return () => undefined; }\nexport { onInternalDiagnosticEvent as o };\n",
    );

    const { diagnostics, logger, unsubscribe } = await registerWithEntry(
      path.join(root, "openclaw.mjs"),
    );

    expect(unsubscribe).toEqual(expect.any(Function));
    expect(diagnostics.hasDiagnosticsSupport()).toBe(true);
    expect(logger.warn).not.toHaveBeenCalledWith(
      "[otel] No diagnostic event source available — using fallback token extraction",
    );
  });

  it("loads directly from dist/entry.js launchers", async () => {
    const root = makeInstallRoot();
    writeChunk(root, "export function onInternalDiagnosticEvent() { return () => undefined; }\n");

    const { diagnostics } = await registerWithEntry(path.join(root, "dist", "entry.js"));

    expect(diagnostics.hasDiagnosticsSupport()).toBe(true);
  });

  it("loads from install-root dist for source-checkout src/entry.ts launchers", async () => {
    const root = makeInstallRoot();
    const src = path.join(root, "src");
    mkdirSync(src);
    writeFileSync(path.join(src, "entry.ts"), "export {};\n");
    writeChunk(root, "export function onInternalDiagnosticEvent() { return () => undefined; }\n");

    const { diagnostics } = await registerWithEntry(path.join(src, "entry.ts"));

    expect(diagnostics.hasDiagnosticsSupport()).toBe(true);
  });

  it("follows symlinked bin launchers before deriving the dist directory", async () => {
    const root = makeInstallRoot();
    const bin = path.join(root, "bin");
    mkdirSync(bin);
    const link = path.join(bin, "openclaw");
    symlinkSync(path.join(root, "openclaw.mjs"), link);
    writeChunk(root, "export function onInternalDiagnosticEvent() { return () => undefined; }\n");

    const { diagnostics } = await registerWithEntry(link);

    expect(diagnostics.hasDiagnosticsSupport()).toBe(true);
  });

  it("ignores non-JavaScript diagnostic event declarations", async () => {
    const root = makeInstallRoot();
    writeFileSync(path.join(root, "dist", "diagnostic-events-types.d.ts"), "export {};\n");
    writeChunk(root, "export function onInternalDiagnosticEvent() { return () => undefined; }\n");

    const { diagnostics } = await registerWithEntry(path.join(root, "openclaw.mjs"));

    expect(diagnostics.hasDiagnosticsSupport()).toBe(true);
  });
});

describe("internal diagnostics export resolution", () => {
  it("uses the direct public export when present", async () => {
    const root = makeInstallRoot();
    writeChunk(root, "export function onInternalDiagnosticEvent() { return () => undefined; }\n");

    const { diagnostics } = await registerWithEntry(path.join(root, "openclaw.mjs"));

    expect(diagnostics.hasDiagnosticsSupport()).toBe(true);
  });

  it("uses the function name when the export alias is minified", async () => {
    const root = makeInstallRoot();
    writeChunk(
      root,
      "function onInternalDiagnosticEvent() { return () => undefined; }\nexport { onInternalDiagnosticEvent as o };\n",
    );

    const { diagnostics } = await registerWithEntry(path.join(root, "openclaw.mjs"));

    expect(diagnostics.hasDiagnosticsSupport()).toBe(true);
  });

  it("receives model usage events from the resolved internal source", async () => {
    const root = makeInstallRoot();
    writeChunk(
      root,
      `export function onInternalDiagnosticEvent(listener) {
        listener({
          type: "model.usage",
          sessionKey: "session-1",
          provider: "openai",
          model: "gpt-test",
          usage: { input: 11, output: 5, total: 16 },
          costUsd: 0.12,
          durationMs: 123,
          context: { limit: 200, used: 16 }
        });
        return () => undefined;
      }\n`,
    );
    const logger = createLogger();
    const telemetry = createTelemetry();

    const { diagnostics } = await registerWithEntry(
      path.join(root, "openclaw.mjs"),
      logger,
      telemetry,
    );

    expect(diagnostics.getPendingUsage("session-1")).toMatchObject({
      costUsd: 0.12,
      durationMs: 123,
      model: "gpt-test",
      provider: "openai",
      usage: { input: 11, output: 5, total: 16 },
      context: { limit: 200, used: 16 },
    });
    // 0.11.0+: token/request/duration metrics moved to the per-call
    // model_call_started/model_call_ended hooks in hooks.ts (see
    // hooks.test.ts) — this event only still records cost (and the
    // system/user/tool_result/skill breakdown, not exercised here), since
    // core exposes no per-call price lookup anywhere else.
    expect(telemetry.counters.tokensPrompt.add).not.toHaveBeenCalled();
    expect(telemetry.counters.tokensCompletion.add).not.toHaveBeenCalled();
    expect(telemetry.counters.tokensTotal.add).not.toHaveBeenCalled();
    expect(telemetry.counters.llmRequests.add).not.toHaveBeenCalled();
    expect(telemetry.histograms.llmDuration.record).not.toHaveBeenCalled();
    expect(telemetry.histograms.genAiOperationDuration.record).not.toHaveBeenCalled();
    expect(telemetry.meter.createCounter).toHaveBeenCalledWith(
      "openclaw.llm.cost.usd",
      expect.any(Object),
    );
  });

  it("suppresses an exact-duplicate model.usage dispatch (openclaw/openclaw#166289) so cost isn't double-counted", async () => {
    const root = makeInstallRoot();
    writeChunk(
      root,
      `export function onInternalDiagnosticEvent(listener) {
        const payload = {
          type: "model.usage",
          sessionKey: "agent:main:new",
          provider: "ionos",
          model: "Qwen/Qwen3.5-397B-A17B",
          usage: { input: 226167, output: 3738, total: 229905 },
          costUsd: 0.1666,
          durationMs: 96700,
        };
        listener(payload);
        listener({ ...payload }); // core double-dispatches for a subset of calls
        return () => undefined;
      }\n`,
    );
    const logger = createLogger();
    const telemetry = createTelemetry();

    await registerWithEntry(path.join(root, "openclaw.mjs"), logger, telemetry);

    // Cost is only recorded once, even though the event fired twice.
    const costCounter = telemetry.meter.createCounter.mock.results[0]?.value;
    expect(telemetry.meter.createCounter).toHaveBeenCalledTimes(1);
    expect(costCounter.add).toHaveBeenCalledTimes(1);
    expect(costCounter.add).toHaveBeenCalledWith(0.1666, expect.any(Object));

    // The second, duplicate dispatch is logged, not silently dropped.
    expect(logger.debug).toHaveBeenCalledWith(
      expect.stringContaining("suppressed duplicate dispatch"),
    );
  });

  it("does not suppress two genuinely distinct model.usage events for the same session", async () => {
    const root = makeInstallRoot();
    writeChunk(
      root,
      `export function onInternalDiagnosticEvent(listener) {
        listener({
          type: "model.usage", sessionKey: "agent:main:new", provider: "ionos",
          model: "Qwen/Qwen3.5-397B-A17B", usage: { total: 1000 }, costUsd: 0.01,
        });
        listener({
          type: "model.usage", sessionKey: "agent:main:new", provider: "ionos",
          model: "Qwen/Qwen3.5-397B-A17B", usage: { total: 2000 }, costUsd: 0.02,
        });
        return () => undefined;
      }\n`,
    );
    const telemetry = createTelemetry();

    await registerWithEntry(path.join(root, "openclaw.mjs"), createLogger(), telemetry);

    expect(telemetry.meter.createCounter).toHaveBeenCalledTimes(2);
  });

  it("ignores non-function direct exports", async () => {
    const root = makeInstallRoot();
    writeChunk(root, "export const onInternalDiagnosticEvent = 'not-a-function';\n");
    const logger = createLogger();

    const { diagnostics } = await registerWithEntry(path.join(root, "openclaw.mjs"), logger);

    expect(diagnostics.hasDiagnosticsSupport()).toBe(false);
    expect(logger.debug).toHaveBeenCalledWith(
      expect.stringContaining("loaded but onInternalDiagnosticEvent export not resolved"),
    );
  });
});

describe("internal diagnostics fallback logging", () => {
  it("tries later chunks when an earlier diagnostics chunk has no event export", async () => {
    const root = makeInstallRoot();
    writeChunk(root, "export function emitFailoverEvent() {}\n", "diagnostic-events-a.js");
    writeChunk(
      root,
      "export function onInternalDiagnosticEvent() { return () => undefined; }\n",
      "diagnostic-events-z.js",
    );
    const logger = createLogger();

    const { diagnostics } = await registerWithEntry(path.join(root, "openclaw.mjs"), logger);

    expect(diagnostics.hasDiagnosticsSupport()).toBe(true);
    expect(logger.debug).toHaveBeenCalledWith(
      "[otel] Internal diagnostics chunk diagnostic-events-a.js loaded but onInternalDiagnosticEvent export not resolved; trying next diagnostics chunk",
    );
  });

  it("logs when a chunk loads but the event export cannot be resolved", async () => {
    const root = makeInstallRoot();
    const chunk = writeChunk(root, "export function emitFailoverEvent() {}\n");
    const logger = createLogger();

    await registerWithEntry(path.join(root, "openclaw.mjs"), logger);

    expect(logger.debug).toHaveBeenCalledWith(
      `[otel] Internal diagnostics chunk ${chunk} loaded but onInternalDiagnosticEvent export not resolved; falling back to SDK diagnostics`,
    );
  });

  it("logs when no diagnostics chunk exists in the resolved candidates", async () => {
    const root = makeInstallRoot();
    const logger = createLogger();

    await registerWithEntry(path.join(root, "openclaw.mjs"), logger);

    expect(logger.debug).toHaveBeenCalledWith(
      "[otel] Internal diagnostics chunk not found; falling back to SDK diagnostics",
    );
  });

  it("logs when the diagnostics chunk cannot be imported", async () => {
    const root = makeInstallRoot();
    const chunk = writeChunk(root, "throw new Error('boom');\n");
    const logger = createLogger();

    await registerWithEntry(path.join(root, "openclaw.mjs"), logger);

    expect(logger.debug).toHaveBeenCalledWith(
      `[otel] Internal diagnostics chunk ${chunk} failed to load; falling back to SDK diagnostics`,
    );
  });

  it("supports minified listener aliases validated by shape", async () => {
    const root = makeInstallRoot();
    writeChunk(
      root,
      `export const state = { listener: null };
      export function d(listener) {
        state.listener = listener;
        return () => undefined;
      }\n`,
    );

    const { diagnostics } = await registerWithEntry(path.join(root, "openclaw.mjs"));

    expect(diagnostics.hasDiagnosticsSupport()).toBe(true);
  });

  it("does not accept unrelated minified emitter exports as listener support", async () => {
    const root = makeInstallRoot();
    writeChunk(
      root,
      `export function o() {
        return undefined;
      }\n`,
    );

    const { diagnostics } = await registerWithEntry(path.join(root, "openclaw.mjs"));

    expect(diagnostics.hasDiagnosticsSupport()).toBe(false);
  });
});
