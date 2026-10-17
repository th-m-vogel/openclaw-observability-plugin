/**
 * Ephemeral session-key collapse for metric labels (`collapseEphemeralSessions`).
 *
 * Recurring cron jobs and internal-session-effect turns get a fresh,
 * UUID-suffixed session key per run. On a metric's `gen_ai.conversation.id`
 * label, that fragments one logical job into dozens of single-sample
 * series — fine for trace/log drill-down, poor for a "tokens by session"
 * dashboard panel. This module collapses that suffix back to a stable,
 * job-level identifier for metric labels only.
 *
 * The match is deliberately positional, not "any UUID anywhere": only a
 * UUID-shaped token immediately after a trailing `:run:` or a trailing
 * `_` is eligible. A UUID elsewhere in the key (a cron job's own stable
 * ID, a channel/user ID) is never touched, since it may be the thing a
 * dashboard actually needs to group by.
 */

import type { OtelObservabilityConfig } from "./config.js";

const UUID_SHAPE = "[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}";
const TRAILING_RUN_SUFFIX = new RegExp(`:run:${UUID_SHAPE}$`, "i");
const TRAILING_UNDERSCORE_SUFFIX = new RegExp(`_${UUID_SHAPE}$`, "i");

/**
 * Pure matching/stripping logic — no config awareness. Exported mainly so
 * the matching rule itself can be unit tested directly.
 */
export function collapseEphemeralSessionKey(sessionKey: string): string {
  const runMatch = sessionKey.match(TRAILING_RUN_SUFFIX);
  if (runMatch) {
    return sessionKey.slice(0, runMatch.index);
  }

  const underscoreMatch = sessionKey.match(TRAILING_UNDERSCORE_SUFFIX);
  if (underscoreMatch) {
    return sessionKey.slice(0, underscoreMatch.index);
  }

  return sessionKey;
}

/**
 * What metric write sites actually call: applies the collapse only when
 * `collapseEphemeralSessions` is enabled, otherwise a pure passthrough.
 */
export function resolveMetricConversationId(
  sessionKey: string,
  config: Pick<OtelObservabilityConfig, "collapseEphemeralSessions">,
): string {
  return config.collapseEphemeralSessions
    ? collapseEphemeralSessionKey(sessionKey)
    : sessionKey;
}
