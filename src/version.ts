/**
 * Plugin version resolution for the OTel Resource (ISI-995).
 *
 * The plugin's `openclaw.plugin.json` is the source of truth for the version
 * shown to dashboards as `service.version`. release-please keeps that
 * manifest, `package.json`, and the published npm tag in lockstep, so any
 * of those is fine — we read the OpenClaw manifest because it is the one
 * the plugin loader resolves and ships with the published package.
 *
 * Reading happens once at module load and the result is cached as a
 * constant. If the manifest is missing or malformed (e.g. a sandbox that
 * stripped JSON files from the bundle) the fallback `"unknown"` keeps the
 * Resource emitting a well-formed `service.version` instead of leaking the
 * old hard-coded `"0.1.0"` placeholder.
 */

import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

// This module lives at a different depth relative to the repo root
// depending on whether it's running from source (`src/version.ts`, one
// level down) or from a compiled build (`dist/src/version.js`, two levels
// down) — a single fixed `".."` only resolves correctly for the former and
// silently falls back to "unknown" for the latter, which is what the
// production gateway actually loads. Try each plausible depth instead of
// assuming one.
const MANIFEST_SEARCH_DEPTHS = ["..", "../..", "../../.."];

function readPluginVersion(): string {
  const here = dirname(fileURLToPath(import.meta.url));
  for (const depth of MANIFEST_SEARCH_DEPTHS) {
    try {
      const manifestPath = resolve(here, depth, "openclaw.plugin.json");
      const raw = readFileSync(manifestPath, "utf8");
      const parsed = JSON.parse(raw) as { version?: unknown };
      if (typeof parsed.version === "string" && parsed.version.length > 0) {
        return parsed.version;
      }
    } catch {
      // Try the next candidate depth.
    }
  }
  return "unknown";
}

/**
 * Plugin version emitted as `service.version` on every span / metric / log.
 * Resolved from `openclaw.plugin.json` at module load.
 */
export const PLUGIN_VERSION: string = readPluginVersion();
