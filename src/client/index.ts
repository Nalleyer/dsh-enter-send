/**
 * Browser half of the dsh-enter-send plugin.
 *
 * Provides the send-shortcut preference row (Settings → General) and the
 * capture-phase keymap that remaps Enter / Ctrl(+Cmd)+Enter on the composer.
 * The preference travels the Host configuration form of this plugin's own
 * profile entry, so it persists in the Host settings document the same way
 * dsh's built-in Composer Enter preference does.
 *
 * All registrations ride the plugin fiber: the slot entry, the locale
 * dictionaries, the stylesheet, the keydown listener, and the preference
 * subscription are torn down automatically when the plugin unloads.
 */
import type { Context as ClientContext } from "@deepseek-ai/cordis";
import type { ConfigForm } from "@deepseek-ai/dsh-client-ui-settings/client";
import { en, LOCALE_NS, zh } from "../locales.js";
import { SETTINGS_NAMESPACE } from "../submission-settings.js";
import type { EnterSendSettings, SendMode } from "../submission-settings.js";
import { EnterSendRow } from "./EnterSendRow.js";
import { installKeymap } from "./keymap.js";
import { injectStyles } from "./styles.js";
import { EnterSendPolicy } from "./submission.js";

/** Services required by this browser plugin (fiber activation gates on them). */
export const inject = ["slots", "remote", "configForms"];

/** Mount the browser plugin. */
export function apply(ctx: ClientContext): void {
  ctx.effect(() => ctx.locale.register(LOCALE_NS, { zh, en }), "enter-send: dictionaries");

  const policy = new EnterSendPolicy(
    ctx.configForms.get<EnterSendSettings>(SETTINGS_NAMESPACE) as ConfigForm<EnterSendSettings>,
  );
  ctx.effect(() => () => policy.dispose(), "enter-send: preference subscription");

  ctx.slots.inject("settings.general.item", () =>
    ctx.slots.register(
      {
        name: "settings.general.item",
        id: "enter-send-mode",
        order: 21,
        locale: LOCALE_NS,
        inject: () => ({
          hooks: { mode: policy.mode },
          setMode: (mode: SendMode) => {
            policy.setMode(mode);
          },
        }),
      },
      EnterSendRow,
    ),
  );

  ctx.effect(() => injectStyles(), "enter-send: styles");
  ctx.effect(() => installKeymap(() => policy.mode.getSnapshot()), "enter-send: keymap");
}
