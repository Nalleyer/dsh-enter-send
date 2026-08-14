/**
 * Host half of the dsh-enter-send plugin (runs inside the dsh process).
 *
 * Registers the `enter-send` settings namespace with the Host user-settings
 * service so the browser half's `settingsScope` reads/writes land in
 * $DSH_HOME/settings.yaml. The actual behavior lives entirely in the browser
 * bundle (./client); this side is the settings-surface counterpart, mirroring
 * the official `dsh-client-ui-conversation` host registration.
 */
import { settingsNamespace } from "@deepseek-ai/dsh-settings";
import z from "@deepseek-ai/schemastery";
import { DEFAULT_MODE, MODE_FIELD, MODES, SETTINGS_NAMESPACE } from "../types.js";

/** Durable enter-send schema; also the wire envelope the browser scope validates against. */
const EnterSendSettingsSchema = z.object({
  [MODE_FIELD]: z.union([...MODES]).default(DEFAULT_MODE),
});

/** Register the durable enter-send section when a settings provider exists. */
function apply(ctx: any): void {
  ctx.inject(["settings"], (settingsCtx: any) => {
    settingsCtx.settings.register(settingsNamespace(SETTINGS_NAMESPACE), EnterSendSettingsSchema);
  });
}

export { apply };
