/**
 * Browser-side submission policy: the single reactive source of the send
 * shortcut mode, backed by the Host configuration form when one is composed.
 *
 * Mirrors the official `ComposerSubmissionPolicy`:
 * - the local snapshot store is what the keymap and the settings row read;
 * - a durable change publishes locally first, then queues the Host write;
 * - adopting Host state never writes it back.
 */
import type { ConfigForm } from "@deepseek-ai/dsh-client-ui-settings/client";
import { createSnapshotStore } from "@deepseek-ai/dsh-client-store";
import type { SnapshotStore } from "@deepseek-ai/dsh-client-store";
import { DEFAULT_MODE, MODE_FIELD } from "../submission-settings.js";
import type { EnterSendSettings, SendMode } from "../submission-settings.js";

/** Reactive send-shortcut preference plus its durable write path. */
export class EnterSendPolicy {
  /** Reactive preference source for the keymap and the Settings row. */
  readonly mode: SnapshotStore<SendMode> = createSnapshotStore<SendMode>(DEFAULT_MODE);

  private unsubscribe: (() => void) | undefined;

  private readonly host: ConfigForm<EnterSendSettings> | undefined;

  /**
   * @param host Shared configuration form of this profile entry; omitted keeps
   * the browser-local default (no Host settings provider composed).
   */
  constructor(host?: ConfigForm<EnterSendSettings>) {
    this.host = host;
    if (host === undefined) return;
    this.unsubscribe = host.subscribe(() => {
      this.adopt(host);
    });
    this.adopt(host);
  }

  /** Release the preference subscription. */
  dispose(): void {
    this.unsubscribe?.();
    this.unsubscribe = undefined;
  }

  /**
   * Change the send shortcut mode; the live value publishes before the durable
   * write starts.
   * @param mode - plain-Enter or Ctrl/Cmd-Enter sends.
   */
  setMode(mode: SendMode): void {
    if (this.mode.getSnapshot() === mode) return;
    this.mode.set(mode);
    void this.host?.set(MODE_FIELD, mode);
  }

  /**
   * Adopt the accepted durable mode without writing it back.
   * @param host - the configuration form driving this adoption.
   */
  private adopt(host: ConfigForm<EnterSendSettings>): void {
    const section = host.getSnapshot().value;
    const mode = section?.mode;
    if (mode === undefined) return;
    if (this.mode.getSnapshot() === mode) return;
    this.mode.set(mode);
  }
}
