/**
 * Browser half of the dsh-enter-send plugin.
 *
 * Provides the send-shortcut preference row (Settings → General) and the
 * capture-phase keymap that remaps Enter / Ctrl(+Cmd)+Enter on the composer
 * textarea. All registrations ride the plugin fiber: the slot entry, the
 * locale dictionaries, the stylesheet, and the keydown listener are torn down
 * automatically when the plugin unloads.
 */
import type { ClientContext, SettingsScope, SnapshotStore } from "@deepseek-ai/dsh-client-runtime/client";
import { createSnapshotStore } from "@deepseek-ai/dsh-client-runtime/client";
import { en, LOCALE_NS, zh } from "../locales.js";
import { DEFAULT_MODE, MODE_FIELD, SETTINGS_NAMESPACE } from "../types.js";
import type { EnterSendSettings, SendMode } from "../types.js";
import { EnterSendRow } from "./EnterSendRow.js";
import { installKeymap } from "./keymap.js";
import { injectStyles } from "./styles.js";

/** Services required by this browser plugin (fiber activation gates on them). */
export const inject = ["slots", "locale", "settingsScope"];

/** Adopt the scope's accepted durable mode without writing it back. */
function adoptMode(
  host: SettingsScope<EnterSendSettings>,
  modeStore: SnapshotStore<SendMode>,
): void {
  const section = host.getSnapshot().value;
  if (section === undefined || section.mode === undefined) return;
  if (modeStore.getSnapshot() === section.mode) return;
  modeStore.set(section.mode);
}

/** Mount the browser plugin. */
export function apply(ctx: ClientContext): void {
  ctx.effect(() => ctx.locale.register(LOCALE_NS, { zh, en }), "enter-send: dictionaries");

  const modeStore = createSnapshotStore<SendMode>(DEFAULT_MODE);
  const host = ctx.settingsScope.bind<EnterSendSettings>({ namespace: SETTINGS_NAMESPACE });
  host.subscribe(() => adoptMode(host, modeStore));
  adoptMode(host, modeStore);

  const setMode = (mode: SendMode) => {
    if (modeStore.getSnapshot() === mode) return;
    modeStore.set(mode);
    void host.set(MODE_FIELD, mode);
  };

  ctx.slots.inject(
    "settings.general.item",
    () =>
      ctx.slots.register(
        {
          name: "settings.general.item",
          id: "enter-send-mode",
          order: 21,
          locale: LOCALE_NS,
          inject: () => ({
            hooks: { mode: modeStore },
            setMode,
          }),
        },
        EnterSendRow,
      ),
  );

  ctx.effect(() => injectStyles(), "enter-send: styles");
  ctx.effect(() => installKeymap(() => modeStore.getSnapshot()), "enter-send: keymap");
}
