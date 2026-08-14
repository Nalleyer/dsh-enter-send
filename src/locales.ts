/**
 * Locale dictionaries for the enter-send settings row, plus the typed
 * `LocaleNamespaceMap` merge that gives the component a typed `t` seat.
 */
import type { LocaleDictOf } from "@deepseek-ai/dsh-client-ui-slots";

/** Locale namespace owning the settings-row copy. */
export const LOCALE_NS = "enter-send";

declare module "@deepseek-ai/dsh-client-ui-slots" {
  interface LocaleNamespaceMap {
    "enter-send":
      | "settings.enterSend.title"
      | "settings.enterSend.description"
      | "settings.enterSend.mode.enter"
      | "settings.enterSend.mode.ctrl-enter";
  }
}

export type EnterSendDict = LocaleDictOf<typeof LOCALE_NS>;

/** Simplified Chinese dictionary. */
export const zh: EnterSendDict = {
  "settings.enterSend.title": "发送快捷键",
  "settings.enterSend.description": "Enter 或 Ctrl/Cmd+Enter 发送",
  "settings.enterSend.mode.enter": "Enter 发送（Ctrl+Enter 换行）",
  "settings.enterSend.mode.ctrl-enter": "Ctrl+Enter 发送（Enter 换行）",
};

/** English dictionary. */
export const en: EnterSendDict = {
  "settings.enterSend.title": "Send shortcut",
  "settings.enterSend.description": "Send with Enter or Ctrl/Cmd+Enter",
  "settings.enterSend.mode.enter": "Enter sends (Ctrl+Enter newline)",
  "settings.enterSend.mode.ctrl-enter": "Ctrl+Enter sends (Enter newline)",
};
