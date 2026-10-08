/**
 * Compile-time only: pulls the declaration merges the plugin's runtime calls
 * depend on into the program. Declaration files are excluded from the build,
 * so the browser bundle keeps no import for these — the shell's module graph
 * already provides them:
 *
 * - `@deepseek-ai/dsh-client-ui-renderer/client` → `ctx.slots`;
 * - `@deepseek-ai/dsh-client-locale/client` → `ctx.locale`;
 * - `@deepseek-ai/dsh-client-ui-settings` → `settings.general.item` slot
 *   contract;
 * - `@deepseek-ai/dsh-client-ui-settings/client` → `ctx.configForms`.
 */
import type {} from "@deepseek-ai/dsh-client-locale/client";
import type {} from "@deepseek-ai/dsh-client-ui-renderer/client";
import type {} from "@deepseek-ai/dsh-client-ui-settings";
import type {} from "@deepseek-ai/dsh-client-ui-settings/client";
