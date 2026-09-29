/**
 * Tests for the config parser.
 *
 * Covers:
 *   - ISI-1000: granular `ContentCapturePolicy` — default all-off, legacy
 *     boolean compat, partial object form, unknown-key handling, coercion,
 *     and `policyEnablesLlmContent` derivation for Traceloop's traceContent.
 *   - ISI-998: `sampleRate` accepts only finite numbers in [0, 1]; anything
 *     else (out-of-range, NaN, wrong type, missing) yields `undefined` so
 *     the plugin falls back to the SDK default sampler.
 */

import { describe, expect, it, vi } from "vitest";

import {
  CONTENT_POLICY_DISABLED,
  CONTENT_POLICY_ENABLED,
  normalizeContentCapturePolicy,
  parseConfig,
  policyEnablesLlmContent,
  resolveSignalConfig,
  type OtelObservabilityConfig,
} from "../src/config.js";

describe("parseConfig — content capture policy", () => {
  it("defaults to all flags off when captureContent is unset", () => {
    const cfg = parseConfig({});
    expect(cfg.captureContent).toEqual(CONTENT_POLICY_DISABLED);
  });

  it("treats legacy `captureContent: true` as every flag on", () => {
    const cfg = parseConfig({ captureContent: true });
    expect(cfg.captureContent).toEqual(CONTENT_POLICY_ENABLED);
  });

  it("treats legacy `captureContent: false` as every flag off", () => {
    const cfg = parseConfig({ captureContent: false });
    expect(cfg.captureContent).toEqual(CONTENT_POLICY_DISABLED);
  });

  it("accepts partial object form and fills missing flags as false (toolErrorMessages defaults true)", () => {
    const cfg = parseConfig({
      captureContent: { inputMessages: true, toolOutputs: true },
    });
    expect(cfg.captureContent).toEqual({
      ...CONTENT_POLICY_DISABLED,
      inputMessages: true,
      toolOutputs: true,
      toolErrorMessages: true,
    });
  });

  it("ignores unknown keys in the object form", () => {
    const cfg = parseConfig({
      captureContent: { inputMessages: true, somethingElse: true } as any,
    });
    expect(cfg.captureContent).toEqual({
      ...CONTENT_POLICY_DISABLED,
      inputMessages: true,
      toolErrorMessages: true,
    });
  });

  it("coerces non-boolean field values to false", () => {
    const cfg = parseConfig({
      captureContent: {
        inputMessages: "yes" as any,
        outputMessages: 1 as any,
        toolInputs: null as any,
        toolOutputs: true,
        systemPrompt: undefined as any,
      },
    });
    expect(cfg.captureContent).toEqual({
      ...CONTENT_POLICY_DISABLED,
      toolOutputs: true,
      toolErrorMessages: true,
    });
  });

  it("allows explicit toolErrorMessages: false to suppress error previews", () => {
    const cfg = parseConfig({
      captureContent: { toolErrorMessages: false },
    });
    expect(cfg.captureContent.toolErrorMessages).toBe(false);
  });

  it("rejects arrays and falls back to disabled policy", () => {
    const cfg = parseConfig({ captureContent: [] as any });
    expect(cfg.captureContent).toEqual(CONTENT_POLICY_DISABLED);
  });
});

describe("normalizeContentCapturePolicy", () => {
  it("returns a fresh copy of the disabled policy for null/undefined input", () => {
    expect(normalizeContentCapturePolicy(undefined)).toEqual(
      CONTENT_POLICY_DISABLED,
    );
    expect(normalizeContentCapturePolicy(null)).toEqual(
      CONTENT_POLICY_DISABLED,
    );
  });

  it("returns a mutable copy (not the frozen constant)", () => {
    const out = normalizeContentCapturePolicy(false);
    expect(() => {
      out.inputMessages = true;
    }).not.toThrow();
    expect(out.inputMessages).toBe(true);
  });
});

describe("policyEnablesLlmContent", () => {
  it("returns false for the disabled policy", () => {
    expect(policyEnablesLlmContent(CONTENT_POLICY_DISABLED)).toBe(false);
  });

  it("returns true for any LLM-content flag", () => {
    for (const flag of ["inputMessages", "outputMessages", "systemPrompt"] as const) {
      const policy = { ...CONTENT_POLICY_DISABLED, [flag]: true };
      expect(policyEnablesLlmContent(policy)).toBe(true);
    }
  });

  it("returns false when only tool flags are enabled", () => {
    expect(
      policyEnablesLlmContent({
        ...CONTENT_POLICY_DISABLED,
        toolInputs: true,
        toolOutputs: true,
      }),
    ).toBe(false);
  });
});

describe("parseConfig — sampleRate", () => {
  it("returns undefined when sampleRate is not provided", () => {
    expect(parseConfig({}).sampleRate).toBeUndefined();
  });

  it("accepts 0.0 (drop all)", () => {
    expect(parseConfig({ sampleRate: 0 }).sampleRate).toBe(0);
  });

  it("accepts 1.0 (keep all)", () => {
    expect(parseConfig({ sampleRate: 1 }).sampleRate).toBe(1);
  });

  it("accepts a fractional rate", () => {
    expect(parseConfig({ sampleRate: 0.25 }).sampleRate).toBe(0.25);
  });

  it("rejects values above 1", () => {
    expect(parseConfig({ sampleRate: 1.5 }).sampleRate).toBeUndefined();
  });

  it("rejects negative values", () => {
    expect(parseConfig({ sampleRate: -0.1 }).sampleRate).toBeUndefined();
  });

  it("rejects NaN", () => {
    expect(parseConfig({ sampleRate: Number.NaN }).sampleRate).toBeUndefined();
  });

  it("rejects Infinity", () => {
    expect(
      parseConfig({ sampleRate: Number.POSITIVE_INFINITY }).sampleRate,
    ).toBeUndefined();
  });

  it("rejects non-number types", () => {
    expect(parseConfig({ sampleRate: "0.5" }).sampleRate).toBeUndefined();
  });

  // ── ISI-1003 — additional edge cases real-world configs produce ──
  it("rejects explicit null (e.g. JSON `null`)", () => {
    expect(parseConfig({ sampleRate: null }).sampleRate).toBeUndefined();
  });

  it("rejects -Infinity", () => {
    expect(
      parseConfig({ sampleRate: Number.NEGATIVE_INFINITY }).sampleRate,
    ).toBeUndefined();
  });

  it("rejects plain object (e.g. accidentally nested)", () => {
    expect(
      parseConfig({ sampleRate: { value: 0.5 } as any }).sampleRate,
    ).toBeUndefined();
  });
});

// ── ISI-1003 — Minor #3 — logger.warn on silent sampleRate validation drop ──
describe("parseConfig — sampleRate diagnostics", () => {
  it("does not warn when sampleRate is omitted", () => {
    const warn = vi.fn();
    parseConfig({}, { warn });
    expect(warn).not.toHaveBeenCalled();
  });

  it("does not warn when sampleRate is valid", () => {
    const warn = vi.fn();
    parseConfig({ sampleRate: 0.25 }, { warn });
    expect(warn).not.toHaveBeenCalled();
  });

  it("warns when sampleRate is present but out of range", () => {
    const warn = vi.fn();
    parseConfig({ sampleRate: 1.5 }, { warn });
    expect(warn).toHaveBeenCalledTimes(1);
    const msg = warn.mock.calls[0]![0]!;
    expect(msg).toContain("sampleRate");
    expect(msg).toContain("1.5");
    expect(msg).toContain("parentbased_always_on");
  });

  it("warns when sampleRate is a string typo and reports the rejected value", () => {
    const warn = vi.fn();
    parseConfig({ sampleRate: "0.5" }, { warn });
    expect(warn).toHaveBeenCalledTimes(1);
    const msg = warn.mock.calls[0]![0]!;
    expect(msg).toContain('"0.5"');
    expect(msg).toContain("typeof=string");
  });

  it("warns when sampleRate is explicit null", () => {
    const warn = vi.fn();
    parseConfig({ sampleRate: null }, { warn });
    expect(warn).toHaveBeenCalledTimes(1);
  });

  it("warns when sampleRate is NaN", () => {
    const warn = vi.fn();
    parseConfig({ sampleRate: Number.NaN }, { warn });
    expect(warn).toHaveBeenCalledTimes(1);
    expect(warn.mock.calls[0]![0]!).toContain("NaN");
  });

  it("does not warn (no logger) when called without a logger", () => {
    // Belt-and-suspenders: ensures the configSchema.parse() codepath
    // (which has no logger handy) stays silent and does not throw.
    expect(() => parseConfig({ sampleRate: "bad" })).not.toThrow();
  });
});

describe("parseConfig — per-signal endpoint/header overrides", () => {
  it("has no signalEndpoints/signalHeaders by default", () => {
    const cfg = parseConfig({});
    expect(cfg.signalEndpoints).toBeUndefined();
    expect(cfg.signalHeaders).toBeUndefined();
  });

  it("parses a full set of per-signal endpoints", () => {
    const cfg = parseConfig({
      signalEndpoints: {
        metrics: "https://metrics.example.com/otlp",
        logs: "https://logs.example.com/otlp",
        traces: "https://traces.example.com/otlp",
      },
    });
    expect(cfg.signalEndpoints).toEqual({
      metrics: "https://metrics.example.com/otlp",
      logs: "https://logs.example.com/otlp",
      traces: "https://traces.example.com/otlp",
    });
  });

  it("parses a partial set of per-signal endpoints", () => {
    const cfg = parseConfig({
      signalEndpoints: { metrics: "https://metrics.example.com/otlp" },
    });
    expect(cfg.signalEndpoints).toEqual({
      metrics: "https://metrics.example.com/otlp",
    });
  });

  it("ignores non-string endpoint values", () => {
    const cfg = parseConfig({
      signalEndpoints: { metrics: 123 as any, logs: null as any },
    });
    expect(cfg.signalEndpoints).toBeUndefined();
  });

  it("ignores unknown signal keys", () => {
    const cfg = parseConfig({
      signalEndpoints: { somethingElse: "https://x.example.com" } as any,
    });
    expect(cfg.signalEndpoints).toBeUndefined();
  });

  it("rejects a non-object signalEndpoints value", () => {
    const cfg = parseConfig({ signalEndpoints: "not-an-object" as any });
    expect(cfg.signalEndpoints).toBeUndefined();
  });

  it("parses per-signal headers independently of signalEndpoints", () => {
    const cfg = parseConfig({
      signalHeaders: {
        logs: { APIKEY: "logs-key" },
        traces: { APIKEY: "traces-key" },
      },
    });
    expect(cfg.signalHeaders).toEqual({
      logs: { APIKEY: "logs-key" },
      traces: { APIKEY: "traces-key" },
    });
  });
});

describe("resolveSignalConfig", () => {
  function baseConfig(
    overrides: Partial<OtelObservabilityConfig> = {},
  ): OtelObservabilityConfig {
    return {
      endpoint: "http://localhost:4318",
      protocol: "http",
      serviceName: "test",
      headers: { Authorization: "Bearer shared" },
      traces: true,
      metrics: true,
      logs: true,
      captureContent: CONTENT_POLICY_DISABLED,
      metricsIntervalMs: 30_000,
      resourceAttributes: {},
      ...overrides,
    };
  }

  it("falls back to the shared endpoint/headers when no override is set", () => {
    const config = baseConfig();
    for (const signal of ["metrics", "logs", "traces"] as const) {
      expect(resolveSignalConfig(config, signal)).toEqual({
        endpoint: "http://localhost:4318",
        headers: { Authorization: "Bearer shared" },
      });
    }
  });

  it("overrides only the targeted signal, leaving others on the shared endpoint", () => {
    const config = baseConfig({
      signalEndpoints: { logs: "https://logs.example.com/otlp" },
      signalHeaders: { logs: { APIKEY: "logs-key" } },
    });
    expect(resolveSignalConfig(config, "logs")).toEqual({
      endpoint: "https://logs.example.com/otlp",
      headers: { APIKEY: "logs-key" },
    });
    expect(resolveSignalConfig(config, "metrics")).toEqual({
      endpoint: "http://localhost:4318",
      headers: { Authorization: "Bearer shared" },
    });
    expect(resolveSignalConfig(config, "traces")).toEqual({
      endpoint: "http://localhost:4318",
      headers: { Authorization: "Bearer shared" },
    });
  });

  it("overrides all three signals independently", () => {
    const config = baseConfig({
      signalEndpoints: {
        metrics: "https://metrics.example.com/otlp",
        logs: "https://logs.example.com/otlp",
        traces: "https://traces.example.com/otlp",
      },
    });
    expect(resolveSignalConfig(config, "metrics").endpoint).toBe(
      "https://metrics.example.com/otlp",
    );
    expect(resolveSignalConfig(config, "logs").endpoint).toBe(
      "https://logs.example.com/otlp",
    );
    expect(resolveSignalConfig(config, "traces").endpoint).toBe(
      "https://traces.example.com/otlp",
    );
  });
});
