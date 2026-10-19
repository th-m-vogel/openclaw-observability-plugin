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
 *
 * `internal-session-effects:` session keys (e.g. `skill-workshop-review`)
 * are a special case: real per-run IDs observed live aren't always
 * standard 8-4-4-4-12 UUIDs (some have 6 dash-separated hex groups, not
 * 5), so for session keys carrying this literal marker, any trailing
 * `_<opaque-id>` made up only of hex digits and dashes collapses too —
 * not just a strict UUID shape. Scoped to the marker specifically so it
 * can't misfire on an unrelated session key that happens to end in a
 * hex-and-dash-shaped token.
 *
 * Some `internal-session-effects:` job types carry no label at all before
 * the per-run id (unlike `skill-workshop-review_<id>`), so the opaque id
 * sits directly after the marker's own trailing `:` with no `_` to anchor
 * on. For those, the whole post-marker tail is checked: if it's nothing
 * but hex digits and dashes (no label text), it collapses down to the
 * marker itself.
 */

import type { OtelObservabilityConfig } from "./config.js";

const UUID_SHAPE = "[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}";
const TRAILING_RUN_SUFFIX = new RegExp(`:run:${UUID_SHAPE}$`, "i");
const TRAILING_UNDERSCORE_SUFFIX = new RegExp(`_${UUID_SHAPE}$`, "i");

// `internal-session-effects:` IDs observed live (e.g. skill-workshop-review)
// aren't always standard 8-4-4-4-12 UUIDs — real examples have 6 dash-
// separated hex groups, not 5. Rather than guess at core's exact ID scheme,
// this accepts any trailing opaque token made up only of hex digits and
// dashes, scoped strictly to session keys carrying the literal
// `internal-session-effects:` marker so it can't misfire on an unrelated
// session key that happens to end in a hex-and-dash-shaped token.
const INTERNAL_SESSION_EFFECTS_MARKER = "internal-session-effects:";
const TRAILING_HEX_DASH_SUFFIX = /_[0-9a-f](?:[0-9a-f-]*[0-9a-f])?$/i;
const BARE_HEX_DASH_TAIL = /^[0-9a-f](?:[0-9a-f-]*[0-9a-f])?$/i;

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

  const markerIndex = sessionKey.indexOf(INTERNAL_SESSION_EFFECTS_MARKER);
  if (markerIndex !== -1) {
    const tailStart = markerIndex + INTERNAL_SESSION_EFFECTS_MARKER.length;
    const tail = sessionKey.slice(tailStart);
    if (BARE_HEX_DASH_TAIL.test(tail)) {
      return sessionKey.slice(0, tailStart - 1);
    }

    const hexDashMatch = sessionKey.match(TRAILING_HEX_DASH_SUFFIX);
    if (hexDashMatch) {
      return sessionKey.slice(0, hexDashMatch.index);
    }
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
