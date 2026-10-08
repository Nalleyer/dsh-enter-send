/**
 * Durable send-shortcut preference, stored in the Host configuration document
 * of profile entry {@link SETTINGS_NAMESPACE}.
 *
 * Both halves of the plugin share this vocabulary: the Host half exports the
 * `Config` schema the loader validates the profile entry against, and the
 * browser half binds the same field through `ctx.configForms`.
 */

/** Profile entry id owning this plugin's configuration (the bundle row id). */
export const SETTINGS_NAMESPACE = "enter-send";

/** Field carrying the send shortcut mode inside the entry's section. */
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

/** Durable enter-send section resolved by the Host configuration schema. */
export interface EnterSendSettings {
  mode?: SendMode;
}

/** Locale namespace owning the settings-row copy. */
export const LOCALE_NS = "enter-send";
