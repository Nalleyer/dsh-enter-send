/**
 * Shared constants and types for the dsh-enter-send plugin.
 *
 * The settings namespace is registered by the host half (lib/index.js) and
 * bound by the browser half (lib/client.js); both halves share this file's
 * vocabulary so the wire section stays consistent.
 */

/** Settings namespace (lowercase kebab-case, enforced by `settingsNamespace`). */
export const SETTINGS_NAMESPACE = "enter-send";

/** Field carrying the send shortcut mode inside the namespace section. */
export const MODE_FIELD = "mode";

/** Acceptable send shortcut modes, in display order. */
export const MODES = ["enter", "ctrl-enter"] as const;

/**
 * Send shortcut mode:
 * - `enter`: plain Enter sends (dsh default), Ctrl/Cmd+Enter inserts a newline.
 * - `ctrl-enter`: Ctrl/Cmd+Enter sends, plain Enter inserts a newline.
 */
export type SendMode = (typeof MODES)[number];

/** Default preserves dsh's built-in Enter-to-send behavior. */
export const DEFAULT_MODE: SendMode = "enter";

/** Durable enter-send section resolved by the settings schema. */
export interface EnterSendSettings {
  mode?: SendMode;
}
