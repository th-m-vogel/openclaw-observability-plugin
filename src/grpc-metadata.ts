import { Metadata } from "@grpc/grpc-js";

/**
 * Converts this plugin's generic `Record<string, string>` header config
 * into a `grpc.Metadata` instance for the OTLP gRPC exporters.
 *
 * gRPC transports custom key/value pairs as Metadata, not HTTP headers —
 * @opentelemetry/otlp-grpc-exporter-base's `OTLPGRPCExporterConfigNode`
 * omits `headers` entirely (a `metadata` option is used instead). Returns
 * `undefined` for empty/absent input so callers can spread it in without
 * emitting an empty Metadata object.
 */
export function toGrpcMetadata(
  headers: Record<string, string> | undefined,
): Metadata | undefined {
  if (!headers || Object.keys(headers).length === 0) {
    return undefined;
  }
  const metadata = new Metadata();
  for (const [key, value] of Object.entries(headers)) {
    metadata.set(key, value);
  }
  return metadata;
}
