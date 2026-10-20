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

function writeOpenclawPackageJson(root: string, version: string): void {
  writeFileSync(path.join(root, "package.json"), JSON.stringify({ name: "openclaw", version }));
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
      costUsd: createCounter(),
      llmRequests: createCounter(),
      tokensCompletion: createCounter(),
      tokensPrompt: createCounter(),
      tokensTotal: createCounter(),
      tokensTotalByModel: createCounter(),
      tokensPromptByModel: createCounter(),
      tokensCompletionByModel: createCounter(),
      costUsdByModel: createCounter(),
      skillUsed: createCounter(),
      modelFailover: createCounter(),
    },
    histograms: {
      genAiOperationDuration: createHistogram(),
      genAiTokenUsage: createHistogram(),
      llmDuration: createHistogram(),
      genAiTokenUsageByModel: createHistogram(),
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
  config: unknown = { collapseEphemeralSessions: false, enableByModelMetrics: false },
) {
  const diagnostics = await loadFreshDiagnostics();
  const unsubscribe = await withArgvEntry(entryFile, () =>
    diagnostics.registerDiagnosticsListener(telemetry as any, config as any, logger),
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
      "[otel] No diagnostic event source available — openclaw.llm.tokens.* and .cost.usd will not be recorded",
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
    // 0.11.0+: request-count/duration metrics moved to the per-call
    // model_call_started/model_call_ended hooks in hooks.ts (see
    // hooks.test.ts). 0.12.0+: openclaw.llm.tokens.* also moved to a
    // per-call source — not this hook (confirmed to carry no usage), but
    // the sibling model.call.completed/model.call.error *diagnostic
    // events*, a different mechanism (openclaw/openclaw#166623) — see the
    // "model.call.completed / model.call.error" describe block below.
    // Cost stays here, on this turn-level event — no per-call cost field
    // exists anywhere in OpenClaw's plugin API.
    expect(telemetry.counters.tokensPrompt.add).not.toHaveBeenCalled();
    expect(telemetry.counters.tokensCompletion.add).not.toHaveBeenCalled();
    expect(telemetry.counters.tokensTotal.add).not.toHaveBeenCalled();
    expect(telemetry.counters.llmRequests.add).not.toHaveBeenCalled();
    expect(telemetry.histograms.llmDuration.record).not.toHaveBeenCalled();
    expect(telemetry.histograms.genAiOperationDuration.record).not.toHaveBeenCalled();
    expect(telemetry.counters.costUsd.add).toHaveBeenCalledWith(0.12, expect.any(Object));
  });

  it("suppresses an exact-duplicate model.usage dispatch (openclaw/openclaw#166289) so cost isn't double-counted", async () => {
    const root = makeInstallRoot();
    writeChunk(
      root,
      `export function onInternalDiagnosticEvent(listener) {
        const payload = {
          type: "model.usage",
          sessionKey: "agent:main:new",
          provider: "custom-provider",
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
    expect(telemetry.meter.createCounter).not.toHaveBeenCalled();
    expect(telemetry.counters.costUsd.add).toHaveBeenCalledTimes(1);
    expect(telemetry.counters.costUsd.add).toHaveBeenCalledWith(0.1666, expect.any(Object));

    // The second, duplicate dispatch is logged, not silently dropped.
    expect(logger.debug).toHaveBeenCalledWith(
      expect.stringContaining("suppressed duplicate dispatch"),
    );
  });

  it("suppresses a duplicate dispatch even when its recomputed cost differs only in floating-point noise", async () => {
    const root = makeInstallRoot();
    writeChunk(
      root,
      `export function onInternalDiagnosticEvent(listener) {
        listener({
          type: "model.usage", sessionKey: "agent:main:custom-session", provider: "openai",
          model: "gpt-5.6-luna", usage: { total: 287134 }, costUsd: 0.05110000000001,
        });
        listener({
          type: "model.usage", sessionKey: "agent:main:custom-session", provider: "openai",
          model: "gpt-5.6-luna", usage: { total: 287134 }, costUsd: 0.05109999999998,
        });
        return () => undefined;
      }\n`,
    );
    const logger = createLogger();
    const telemetry = createTelemetry();

    await registerWithEntry(path.join(root, "openclaw.mjs"), logger, telemetry);

    expect(telemetry.counters.costUsd.add).toHaveBeenCalledTimes(1);
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
          type: "model.usage", sessionKey: "agent:main:new", provider: "custom-provider",
          model: "Qwen/Qwen3.5-397B-A17B", usage: { total: 1000 }, costUsd: 0.01,
        });
        listener({
          type: "model.usage", sessionKey: "agent:main:new", provider: "custom-provider",
          model: "Qwen/Qwen3.5-397B-A17B", usage: { total: 2000 }, costUsd: 0.02,
        });
        return () => undefined;
      }\n`,
    );
    const telemetry = createTelemetry();

    await registerWithEntry(path.join(root, "openclaw.mjs"), createLogger(), telemetry);

    expect(telemetry.counters.costUsd.add).toHaveBeenCalledTimes(2);
  });

  it("survives a malformed event (non-numeric costUsd) without crashing, logging it instead of throwing into core's dispatcher", async () => {
    const root = makeInstallRoot();
    writeChunk(
      root,
      `export function onInternalDiagnosticEvent(listener) {
        listener({
          type: "model.usage", sessionKey: "agent:main:bad", provider: "custom-provider",
          model: "some-model", usage: { total: 1000 }, costUsd: "not-a-number",
        });
        // A well-formed event right after, on the same listener — proves
        // the malformed one didn't tear the subscription down.
        listener({
          type: "model.usage", sessionKey: "agent:main:good", provider: "custom-provider",
          model: "some-model", usage: { total: 500 }, costUsd: 0.05,
        });
        return () => undefined;
      }\n`,
    );
    const logger = createLogger();
    const telemetry = createTelemetry();

    await registerWithEntry(path.join(root, "openclaw.mjs"), logger, telemetry);

    // Did not throw (registerWithEntry itself would have rejected), and
    // the well-formed event right after still landed normally.
    expect(telemetry.counters.costUsd.add).toHaveBeenCalledWith(0.05, expect.any(Object));
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

describe("model.call.completed / model.call.error diagnostic events", () => {
  it("records real per-call token metrics from model.call.completed, labeled with conversation id + provider + agent id", async () => {
    const root = makeInstallRoot();
    writeChunk(
      root,
      `export function onInternalDiagnosticEvent(listener) {
        listener({
          type: "model.call.completed",
          sessionKey: "agent:main:new",
          provider: "openai-compatible",
          model: "example/model-1",
          agentId: "main",
          usage: { input: 1000, output: 200, cacheRead: 500, cacheWrite: 50, total: 1250 },
          durationMs: 850,
        });
        return () => undefined;
      }\n`,
    );
    const telemetry = createTelemetry();

    await registerWithEntry(path.join(root, "openclaw.mjs"), createLogger(), telemetry);

    const baseAttrs = {
      "gen_ai.response.model": "example/model-1",
      "gen_ai.operation.name": "chat",
      "gen_ai.conversation.id": "agent:main:new",
      "gen_ai.provider.name": "openai-compatible",
      "openclaw.provider": "openai-compatible",
      "gen_ai.agent.id": "main",
    };
    expect(telemetry.counters.tokensPrompt.add).toHaveBeenCalledWith(
      1000,
      expect.objectContaining(baseAttrs),
    );
    expect(telemetry.counters.tokensCompletion.add).toHaveBeenCalledWith(
      200,
      expect.objectContaining(baseAttrs),
    );
    expect(telemetry.counters.tokensPrompt.add).toHaveBeenCalledWith(
      500,
      expect.objectContaining({ ...baseAttrs, "token.type": "cache_read" }),
    );
    expect(telemetry.counters.tokensPrompt.add).toHaveBeenCalledWith(
      50,
      expect.objectContaining({ ...baseAttrs, "token.type": "cache_write" }),
    );
    expect(telemetry.counters.tokensTotal.add).toHaveBeenCalledWith(
      1250,
      expect.objectContaining(baseAttrs),
    );
  });

  it("also records _by_model siblings for the per-call token metrics when enableByModelMetrics is on, without conversation id or agent id", async () => {
    const root = makeInstallRoot();
    writeChunk(
      root,
      `export function onInternalDiagnosticEvent(listener) {
        listener({
          type: "model.call.completed",
          sessionKey: "agent:main:new",
          provider: "openai-compatible",
          model: "example/model-1",
          agentId: "main",
          usage: { input: 1000, output: 200, cacheRead: 500, cacheWrite: 50, total: 1250 },
          durationMs: 850,
        });
        return () => undefined;
      }\n`,
    );
    const telemetry = createTelemetry();

    await registerWithEntry(
      path.join(root, "openclaw.mjs"),
      createLogger(),
      telemetry,
      { collapseEphemeralSessions: false, enableByModelMetrics: true },
    );

    const byModelAttrs = {
      "gen_ai.response.model": "example/model-1",
      "gen_ai.operation.name": "chat",
      "gen_ai.provider.name": "openai-compatible",
      "openclaw.provider": "openai-compatible",
    };
    expect(telemetry.counters.tokensPromptByModel.add).toHaveBeenCalledWith(1000, byModelAttrs);
    expect(telemetry.counters.tokensCompletionByModel.add).toHaveBeenCalledWith(200, byModelAttrs);
    expect(telemetry.counters.tokensPromptByModel.add).toHaveBeenCalledWith(
      500,
      { ...byModelAttrs, "token.type": "cache_read" },
    );
    expect(telemetry.counters.tokensPromptByModel.add).toHaveBeenCalledWith(
      50,
      { ...byModelAttrs, "token.type": "cache_write" },
    );
    expect(telemetry.counters.tokensTotalByModel.add).toHaveBeenCalledWith(1250, byModelAttrs);
    expect(telemetry.histograms.genAiTokenUsageByModel.record).toHaveBeenCalledWith(
      1000,
      expect.objectContaining({ ...byModelAttrs, "gen_ai.token.type": "input" }),
    );
  });

  it("does NOT record any _by_model sibling for the per-call token metrics when enableByModelMetrics is off (default)", async () => {
    const root = makeInstallRoot();
    writeChunk(
      root,
      `export function onInternalDiagnosticEvent(listener) {
        listener({
          type: "model.call.completed",
          sessionKey: "agent:main:new",
          provider: "openai-compatible",
          model: "example/model-1",
          usage: { input: 1000, output: 200, total: 1200 },
        });
        return () => undefined;
      }\n`,
    );
    const telemetry = createTelemetry();

    await registerWithEntry(path.join(root, "openclaw.mjs"), createLogger(), telemetry);

    expect(telemetry.counters.tokensPromptByModel.add).not.toHaveBeenCalled();
    expect(telemetry.counters.tokensCompletionByModel.add).not.toHaveBeenCalled();
    expect(telemetry.counters.tokensTotalByModel.add).not.toHaveBeenCalled();
    expect(telemetry.histograms.genAiTokenUsageByModel.record).not.toHaveBeenCalled();
  });

  it("records tokens from a model.call.error event when usage is present (provider billed tokens before erroring)", async () => {
    const root = makeInstallRoot();
    writeChunk(
      root,
      `export function onInternalDiagnosticEvent(listener) {
        listener({
          type: "model.call.error",
          sessionKey: "agent:main:err",
          provider: "anthropic",
          model: "claude-3.5-sonnet",
          usage: { input: 300, output: 0, total: 300 },
        });
        return () => undefined;
      }\n`,
    );
    const telemetry = createTelemetry();

    await registerWithEntry(path.join(root, "openclaw.mjs"), createLogger(), telemetry);

    expect(telemetry.counters.tokensPrompt.add).toHaveBeenCalledWith(300, expect.any(Object));
    expect(telemetry.counters.tokensTotal.add).toHaveBeenCalledWith(300, expect.any(Object));
  });

  it("does not record token metrics when model.call.completed carries no usage field", async () => {
    const root = makeInstallRoot();
    writeChunk(
      root,
      `export function onInternalDiagnosticEvent(listener) {
        listener({
          type: "model.call.completed",
          sessionKey: "agent:main:nousage",
          provider: "anthropic",
          model: "claude-3.5-sonnet",
        });
        return () => undefined;
      }\n`,
    );
    const telemetry = createTelemetry();

    await registerWithEntry(path.join(root, "openclaw.mjs"), createLogger(), telemetry);

    expect(telemetry.counters.tokensPrompt.add).not.toHaveBeenCalled();
    expect(telemetry.counters.tokensCompletion.add).not.toHaveBeenCalled();
    expect(telemetry.counters.tokensTotal.add).not.toHaveBeenCalled();
    expect(telemetry.counters.tokensPromptByModel.add).not.toHaveBeenCalled();
    expect(telemetry.counters.tokensCompletionByModel.add).not.toHaveBeenCalled();
    expect(telemetry.counters.tokensTotalByModel.add).not.toHaveBeenCalled();
  });
});

describe("model.usage _by_model sibling for cost", () => {
  it("also records the costUsdByModel sibling when enableByModelMetrics is on, without conversation id", async () => {
    const root = makeInstallRoot();
    writeChunk(
      root,
      `export function onInternalDiagnosticEvent(listener) {
        listener({
          type: "model.usage",
          sessionKey: "agent:main:new",
          provider: "anthropic",
          model: "claude-3.5-sonnet",
          usage: { total: 375 },
          costUsd: 0.05,
        });
        return () => undefined;
      }\n`,
    );
    const telemetry = createTelemetry();

    await registerWithEntry(
      path.join(root, "openclaw.mjs"),
      createLogger(),
      telemetry,
      { collapseEphemeralSessions: false, enableByModelMetrics: true },
    );

    const byModelAttrs = {
      "gen_ai.response.model": "claude-3.5-sonnet",
      "gen_ai.operation.name": "invoke_agent",
      "gen_ai.provider.name": "anthropic",
      "openclaw.provider": "anthropic",
    };
    expect(telemetry.counters.costUsdByModel.add).toHaveBeenCalledWith(0.05, byModelAttrs);
  });

  it("does not record a costUsdByModel increment for a falsy (zero) cost", async () => {
    const root = makeInstallRoot();
    writeChunk(
      root,
      `export function onInternalDiagnosticEvent(listener) {
        listener({
          type: "model.usage", sessionKey: "agent:main:new", provider: "anthropic",
          model: "claude-3.5-sonnet", usage: { total: 100 }, costUsd: 0,
        });
        return () => undefined;
      }\n`,
    );
    const telemetry = createTelemetry();

    await registerWithEntry(
      path.join(root, "openclaw.mjs"),
      createLogger(),
      telemetry,
      { collapseEphemeralSessions: false, enableByModelMetrics: true },
    );

    expect(telemetry.counters.costUsdByModel.add).not.toHaveBeenCalled();
  });

  it("suppresses the costUsdByModel sibling too on a duplicate dispatch, not just the raw metric", async () => {
    const root = makeInstallRoot();
    writeChunk(
      root,
      `export function onInternalDiagnosticEvent(listener) {
        const payload = {
          type: "model.usage", sessionKey: "agent:main:new", provider: "anthropic",
          model: "claude-3.5-sonnet", usage: { total: 100 }, costUsd: 0.05,
        };
        listener(payload);
        listener({ ...payload });
        return () => undefined;
      }\n`,
    );
    const telemetry = createTelemetry();

    await registerWithEntry(
      path.join(root, "openclaw.mjs"),
      createLogger(),
      telemetry,
      { collapseEphemeralSessions: false, enableByModelMetrics: true },
    );

    expect(telemetry.counters.costUsdByModel.add).toHaveBeenCalledTimes(1);
  });

  it("does NOT record the costUsdByModel sibling when enableByModelMetrics is off (default)", async () => {
    const root = makeInstallRoot();
    writeChunk(
      root,
      `export function onInternalDiagnosticEvent(listener) {
        listener({
          type: "model.usage", sessionKey: "agent:main:new", provider: "anthropic",
          model: "claude-3.5-sonnet", usage: { total: 100 }, costUsd: 0.05,
        });
        return () => undefined;
      }\n`,
    );
    const telemetry = createTelemetry();

    await registerWithEntry(path.join(root, "openclaw.mjs"), createLogger(), telemetry);

    expect(telemetry.counters.costUsdByModel.add).not.toHaveBeenCalled();
  });
});

describe("skill.used diagnostic event", () => {
  it("records a skill usage with all optional fields present", async () => {
    const root = makeInstallRoot();
    writeChunk(
      root,
      `export function onInternalDiagnosticEvent(listener) {
        listener({
          type: "skill.used",
          sessionKey: "agent:main:new",
          agentId: "main",
          skillName: "writing-plans",
          skillSource: "bundled",
          activation: "command",
          toolName: "Skill",
        });
        return () => undefined;
      }\n`,
    );
    const telemetry = createTelemetry();

    await registerWithEntry(path.join(root, "openclaw.mjs"), createLogger(), telemetry);

    expect(telemetry.counters.skillUsed.add).toHaveBeenCalledWith(1, {
      "openclaw.skill.name": "writing-plans",
      "openclaw.skill.source": "bundled",
      "openclaw.skill.activation": "command",
      "openclaw.agent": "main",
      "openclaw.toolName": "Skill",
    });
  });

  it("omits the agent/toolName attributes when not present on the event", async () => {
    const root = makeInstallRoot();
    writeChunk(
      root,
      `export function onInternalDiagnosticEvent(listener) {
        listener({
          type: "skill.used",
          sessionKey: "agent:main:new",
          skillName: "brainstorming",
          skillSource: "workspace",
          activation: "read",
        });
        return () => undefined;
      }\n`,
    );
    const telemetry = createTelemetry();

    await registerWithEntry(path.join(root, "openclaw.mjs"), createLogger(), telemetry);

    expect(telemetry.counters.skillUsed.add).toHaveBeenCalledWith(1, {
      "openclaw.skill.name": "brainstorming",
      "openclaw.skill.source": "workspace",
      "openclaw.skill.activation": "read",
    });
  });
});

describe("model.failover diagnostic event", () => {
  it("records a failover with all optional fields present", async () => {
    const root = makeInstallRoot();
    writeChunk(
      root,
      `export function onInternalDiagnosticEvent(listener) {
        listener({
          type: "model.failover",
          sessionKey: "agent:main:new",
          lane: "main",
          fromProvider: "anthropic",
          fromModel: "claude-sonnet-5",
          toProvider: "openai",
          toModel: "gpt-5.6-luna",
          reason: "upstream_error",
          suspended: true,
        });
        return () => undefined;
      }\n`,
    );
    const telemetry = createTelemetry();

    await registerWithEntry(path.join(root, "openclaw.mjs"), createLogger(), telemetry);

    expect(telemetry.counters.modelFailover.add).toHaveBeenCalledWith(1, {
      "openclaw.provider": "anthropic",
      "openclaw.model": "claude-sonnet-5",
      "openclaw.failover.to_provider": "openai",
      "openclaw.failover.to_model": "gpt-5.6-luna",
      "openclaw.failover.reason": "upstream_error",
      "openclaw.failover.suspended": "true",
      "openclaw.lane": "main",
    });
  });

  it("omits attributes for fields not present on the event", async () => {
    const root = makeInstallRoot();
    writeChunk(
      root,
      `export function onInternalDiagnosticEvent(listener) {
        listener({
          type: "model.failover",
          sessionKey: "agent:main:new",
          reason: "rate_limited",
        });
        return () => undefined;
      }\n`,
    );
    const telemetry = createTelemetry();

    await registerWithEntry(path.join(root, "openclaw.mjs"), createLogger(), telemetry);

    expect(telemetry.counters.modelFailover.add).toHaveBeenCalledWith(1, {
      "openclaw.failover.reason": "rate_limited",
    });
  });
});

describe("collapseEphemeralSessions (metric labels only)", () => {
  const cronSessionKey =
    "agent:main:cron:job1:run:28c489cb-aaaa-bbbb-cccc-dddddddddddd";
  const collapsedCronKey = "agent:main:cron:job1";
  const effectsSessionKey =
    "agent:main:internal-session-effects:skill-workshop-review_a737fdf6-1111-2222-3333-444444444444";
  const collapsedEffectsKey = "agent:main:internal-session-effects:skill-workshop-review";

  it("model.call.completed: labels openclaw.llm.tokens.prompt with the collapsed session key when enabled", async () => {
    const root = makeInstallRoot();
    writeChunk(
      root,
      `export function onInternalDiagnosticEvent(listener) {
        listener({
          type: "model.call.completed",
          sessionKey: "${cronSessionKey}",
          provider: "anthropic",
          model: "claude-3.5-sonnet",
          usage: { input: 100, output: 20, total: 120 },
        });
        return () => undefined;
      }\n`,
    );
    const telemetry = createTelemetry();

    await registerWithEntry(
      path.join(root, "openclaw.mjs"),
      createLogger(),
      telemetry,
      { collapseEphemeralSessions: true },
    );

    expect(telemetry.counters.tokensPrompt.add).toHaveBeenCalledWith(
      100,
      expect.objectContaining({ "gen_ai.conversation.id": collapsedCronKey }),
    );
  });

  it("model.call.completed: leaves the session key uncollapsed by default", async () => {
    const root = makeInstallRoot();
    writeChunk(
      root,
      `export function onInternalDiagnosticEvent(listener) {
        listener({
          type: "model.call.completed",
          sessionKey: "${cronSessionKey}",
          provider: "anthropic",
          model: "claude-3.5-sonnet",
          usage: { input: 100, output: 20, total: 120 },
        });
        return () => undefined;
      }\n`,
    );
    const telemetry = createTelemetry();

    await registerWithEntry(path.join(root, "openclaw.mjs"), createLogger(), telemetry);

    expect(telemetry.counters.tokensPrompt.add).toHaveBeenCalledWith(
      100,
      expect.objectContaining({ "gen_ai.conversation.id": cronSessionKey }),
    );
  });

  it("model.usage: labels openclaw.llm.cost.usd with the collapsed session key when enabled", async () => {
    const root = makeInstallRoot();
    writeChunk(
      root,
      `export function onInternalDiagnosticEvent(listener) {
        listener({
          type: "model.usage",
          sessionKey: "${effectsSessionKey}",
          provider: "anthropic",
          model: "claude-3.5-sonnet",
          usage: { total: 500 },
          costUsd: 0.05,
        });
        return () => undefined;
      }\n`,
    );
    const telemetry = createTelemetry();

    await registerWithEntry(
      path.join(root, "openclaw.mjs"),
      createLogger(),
      telemetry,
      { collapseEphemeralSessions: true },
    );

    expect(telemetry.counters.costUsd.add).toHaveBeenCalledWith(
      0.05,
      expect.objectContaining({ "gen_ai.conversation.id": collapsedEffectsKey }),
    );
  });

  it("model.usage: the dedup guard still keys on the RAW (uncollapsed) session key", async () => {
    const root = makeInstallRoot();
    const runA = "agent:main:cron:job1:run:11111111-1111-1111-1111-111111111111";
    const runB = "agent:main:cron:job1:run:22222222-2222-2222-2222-222222222222";
    writeChunk(
      root,
      `export function onInternalDiagnosticEvent(listener) {
        listener({
          type: "model.usage", sessionKey: "${runA}", provider: "anthropic",
          model: "claude-3.5-sonnet", usage: { total: 1000 }, costUsd: 0.05,
        });
        listener({
          type: "model.usage", sessionKey: "${runB}", provider: "anthropic",
          model: "claude-3.5-sonnet", usage: { total: 1000 }, costUsd: 0.05,
        });
        return () => undefined;
      }\n`,
    );
    const telemetry = createTelemetry();

    await registerWithEntry(
      path.join(root, "openclaw.mjs"),
      createLogger(),
      telemetry,
      { collapseEphemeralSessions: true },
    );

    // Two genuinely distinct runs with identical cost/tokens must both be
    // recorded — the dedup guard must key on the raw sessionKey, not the
    // collapsed one, or these would wrongly look like the same duplicate
    // dispatch.
    expect(telemetry.counters.costUsd.add).toHaveBeenCalledTimes(2);
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
    // No real `openclaw/plugin-sdk` is installed in this test environment
    // either, so this scenario also exercises the no-event-source-at-all
    // path (0.12.0+: the old message named a token-extraction fallback
    // that no longer exists — see hooks.ts's removed agent_end fallback).
    expect(logger.warn).toHaveBeenCalledWith(
      "[otel] No diagnostic event source available — openclaw.llm.tokens.* and .cost.usd will not be recorded",
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

describe("minimum OpenClaw version check", () => {
  it("warns once when the installed OpenClaw version is below the plugin's minimum", async () => {
    const root = makeInstallRoot();
    writeOpenclawPackageJson(root, "2026.9.7");
    writeChunk(root, "export function onInternalDiagnosticEvent() { return () => undefined; }\n");
    const logger = createLogger();

    await registerWithEntry(path.join(root, "openclaw.mjs"), logger);

    expect(logger.warn).toHaveBeenCalledWith(
      expect.stringContaining(
        "Detected OpenClaw v2026.9.7, below this plugin's minimum supported version v2026.9.8",
      ),
    );
  });

  it("does not warn when the installed OpenClaw version exactly meets the minimum", async () => {
    const root = makeInstallRoot();
    writeOpenclawPackageJson(root, "2026.9.8");
    writeChunk(root, "export function onInternalDiagnosticEvent() { return () => undefined; }\n");
    const logger = createLogger();

    await registerWithEntry(path.join(root, "openclaw.mjs"), logger);

    expect(logger.warn).not.toHaveBeenCalledWith(expect.stringContaining("minimum supported version"));
  });

  it("does not warn when the installed OpenClaw version exceeds the minimum", async () => {
    const root = makeInstallRoot();
    writeOpenclawPackageJson(root, "2026.10.1");
    writeChunk(root, "export function onInternalDiagnosticEvent() { return () => undefined; }\n");
    const logger = createLogger();

    await registerWithEntry(path.join(root, "openclaw.mjs"), logger);

    expect(logger.warn).not.toHaveBeenCalledWith(expect.stringContaining("minimum supported version"));
  });

  it("does not misread an unparseable pre-release version string as below minimum", async () => {
    const root = makeInstallRoot();
    // A dev/canary build string — parseInt stops at the first non-digit
    // character, so "8-canary" still reads as the numeric segment 8.
    writeOpenclawPackageJson(root, "2026.9.8-canary.3");
    writeChunk(root, "export function onInternalDiagnosticEvent() { return () => undefined; }\n");
    const logger = createLogger();

    await registerWithEntry(path.join(root, "openclaw.mjs"), logger);

    expect(logger.warn).not.toHaveBeenCalledWith(expect.stringContaining("minimum supported version"));
  });

  it("logs at debug level, not warn, when the installed version cannot be determined", async () => {
    const root = makeInstallRoot(); // no package.json written
    writeChunk(root, "export function onInternalDiagnosticEvent() { return () => undefined; }\n");
    const logger = createLogger();

    await registerWithEntry(path.join(root, "openclaw.mjs"), logger);

    expect(logger.debug).toHaveBeenCalledWith(
      "[otel] Could not determine installed OpenClaw version; skipping minimum-version check",
    );
    expect(logger.warn).not.toHaveBeenCalledWith(expect.stringContaining("minimum supported version"));
  });
});
