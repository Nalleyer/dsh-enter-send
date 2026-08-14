/**
 * Compile-time only: pulls the settings slot contract into the program so the
 * typed `settings.general.item` SlotMap merge is visible to the browser
 * source. Never emitted into the bundle (declaration files are excluded from
 * the build).
 */
import "@deepseek-ai/dsh-client-ui-settings";
