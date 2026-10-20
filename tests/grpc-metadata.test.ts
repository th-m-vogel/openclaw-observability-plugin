/**
 * Tests for `toGrpcMetadata` — converts this plugin's generic
 * `Record<string, string>` header config into a `grpc.Metadata` instance.
 *
 * Context: @opentelemetry/otlp-grpc-exporter-base (bumped to 0.223.0) no
 * longer accepts a plain `headers` option on its gRPC exporter config —
 * gRPC transports custom key/value pairs as Metadata, not HTTP headers.
 * Passing `headers` there is now a type error (and was already a silent
 * runtime no-op even before the bump — the old gRPC exporter logged
 * `diag.warn('Headers cannot be set when using grpc')` and dropped it).
 */

import { describe, expect, it } from "vitest";
import { Metadata } from "@grpc/grpc-js";

import { toGrpcMetadata } from "../src/grpc-metadata.js";

describe("toGrpcMetadata", () => {
  it("returns undefined for an empty headers object", () => {
    expect(toGrpcMetadata({})).toBeUndefined();
  });

  it("returns undefined for undefined input", () => {
    expect(toGrpcMetadata(undefined)).toBeUndefined();
  });

  it("converts a single header entry into a real grpc.Metadata instance", () => {
    const metadata = toGrpcMetadata({ Authorization: "Bearer secret" });
    expect(metadata).toBeInstanceOf(Metadata);
    expect(metadata?.get("Authorization")).toEqual(["Bearer secret"]);
  });

  it("converts multiple header entries, preserving every key", () => {
    const metadata = toGrpcMetadata({
      Authorization: "Bearer secret",
      APIKEY: "pipeline-key",
    });
    expect(metadata?.get("Authorization")).toEqual(["Bearer secret"]);
    expect(metadata?.get("APIKEY")).toEqual(["pipeline-key"]);
  });
});
