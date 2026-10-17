/**
 * Tests for the ephemeral session-key collapse used by
 * `collapseEphemeralSessions` (metric labels only — see
 * docs/configuration.md and docs/limitations.md).
 */

import { describe, expect, it } from "vitest";

import {
  collapseEphemeralSessionKey,
  resolveMetricConversationId,
} from "../src/metric-session-key.js";

describe("collapseEphemeralSessionKey", () => {
  it("strips a trailing :run:<uuid> suffix", () => {
    expect(
      collapseEphemeralSessionKey(
        "agent:main:cron:ff729cdc-1234-5678-9abc-def012345678:run:28c489cb-aaaa-bbbb-cccc-dddddddddddd",
      ),
    ).toBe("agent:main:cron:ff729cdc-1234-5678-9abc-def012345678");
  });

  it("strips a trailing _<uuid> suffix", () => {
    expect(
      collapseEphemeralSessionKey(
        "agent:main:internal-session-effects:skill-workshop-review_a737fdf6-1111-2222-3333-444444444444",
      ),
    ).toBe("agent:main:internal-session-effects:skill-workshop-review");
  });

  it("leaves a key with no ephemeral suffix unchanged", () => {
    expect(collapseEphemeralSessionKey("agent:main:telegram:direct:12345")).toBe(
      "agent:main:telegram:direct:12345",
    );
  });

  it("does NOT collapse a trailing bare UUID with no :run:/_ separator (the job/channel ID case)", () => {
    const key = "agent:main:channel:ff729cdc-1234-5678-9abc-def012345678";
    expect(collapseEphemeralSessionKey(key)).toBe(key);
  });

  it("does NOT collapse :run: when the trailing token isn't UUID-shaped", () => {
    const key = "agent:main:cron:ff729cdc-1234-5678-9abc-def012345678:run:latest";
    expect(collapseEphemeralSessionKey(key)).toBe(key);
  });

  it("does NOT collapse a trailing underscore suffix when the token isn't UUID-shaped", () => {
    const key = "agent:main:internal-session-effects:skill-workshop-review_retry";
    expect(collapseEphemeralSessionKey(key)).toBe(key);
  });

  it("passes through the 'unknown' placeholder session key unchanged", () => {
    expect(collapseEphemeralSessionKey("unknown")).toBe("unknown");
  });

  it("matches a UUID case-insensitively", () => {
    expect(
      collapseEphemeralSessionKey(
        "agent:main:cron:jobid:run:28C489CB-AAAA-BBBB-CCCC-DDDDDDDDDDDD",
      ),
    ).toBe("agent:main:cron:jobid");
  });
});

describe("resolveMetricConversationId", () => {
  const collapsibleKey =
    "agent:main:cron:ff729cdc-1234-5678-9abc-def012345678:run:28c489cb-aaaa-bbbb-cccc-dddddddddddd";

  it("returns the session key unchanged when collapseEphemeralSessions is false", () => {
    expect(
      resolveMetricConversationId(collapsibleKey, { collapseEphemeralSessions: false }),
    ).toBe(collapsibleKey);
  });

  it("returns the collapsed key when collapseEphemeralSessions is true", () => {
    expect(
      resolveMetricConversationId(collapsibleKey, { collapseEphemeralSessions: true }),
    ).toBe("agent:main:cron:ff729cdc-1234-5678-9abc-def012345678");
  });
});
