/**
 * Host half of the dsh-enter-send plugin (runs inside the dsh process).
 *
 * Publishes the durable `mode` field as this profile entry's configuration
 * schema, so the browser half's configuration form resolves it and the Host
 * settings document persists it. The behavior itself lives entirely in the
 * browser bundle (`./client`); this side only declares the schema and turns
 * off the auto-generated configuration page, because the plugin already
 * contributes its own row to the General section.
 *
 * Mirrors the official `dsh-client-ui-conversation` host half: a live
 * (volatile) field, plus `settings.configure({ auto: false })` registered as
 * an effect of the child context.
 */
import z from "@deepseek-ai/schemastery";
import type { Context } from "@deepseek-ai/cordis";
import { DEFAULT_MODE, MODE_FIELD, MODES } from "../submission-settings.js";

/**
 * Live send-shortcut preference. Volatile because the value is editable while
 * the profile runs and must never be baked into the profile patch.
 */
export const Config = z.object({
  [MODE_FIELD]: z.union([...MODES]).default(DEFAULT_MODE).volatile(),
});

/** Register this entry's settings presentation; the plugin owns its own row. */
export function apply(ctx: Context): void {
  ctx.inject(["settings"], (child: Context) => {
    child.effect(() => child.settings.configure({ auto: false }, ctx.fiber));
  });
}
