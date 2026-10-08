/**
 * Compile-time only: pulls the declaration merge that puts `ctx.settings` on
 * the Cordis context into this program. Declaration files are excluded from
 * the build, so the Host bundle keeps no runtime import of the settings
 * package — the running dsh process provides the service.
 */
import type {} from "@deepseek-ai/dsh-settings";
