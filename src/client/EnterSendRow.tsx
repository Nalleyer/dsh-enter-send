/**
 * General-settings row for the send shortcut. Mirrors the official
 * EnterBehaviorRow / LanguageRow: a title + description column and a Menu
 * selector, with the preference injected from the owning apply closure.
 *
 * The row's props are written explicitly (rather than through the
 * `PropsRuntime` / `PropsLocale` / `InjectFace` composed-type aliases) so the
 * component signature matches the registration's composed constraint without
 * depending on how those aliases resolve under declaration merging.
 */
import { useState } from "react";
import type { ReactNode } from "react";
import { IconChevronDownOutlineRegular, Menu } from "@deepseek-ai/dsh-client-ui-primitives";
import type { PropsLocale } from "@deepseek-ai/dsh-client-ui-slots";
import type { SnapshotSelectorHook, SnapshotStore } from "@deepseek-ai/dsh-client-store";
import { MODES } from "../submission-settings.js";
import type { SendMode } from "../submission-settings.js";

/** Registration-side preference face (`hooks.mode` arrives as `useMode`). */
export interface EnterSendRowInjected {
  hooks: {
    /** Persisted send-shortcut mode, exposed to the component as `useMode`. */
    mode: SnapshotStore<SendMode>;
  };
  /** Change the send-shortcut mode. */
  setMode: (mode: SendMode) => void;
}

/** Props the row consumes: the bound hook, the write path, and the `t` seat. */
export interface EnterSendRowProps extends PropsLocale<"enter-send"> {
  useMode: SnapshotSelectorHook<SendMode>;
  setMode: (mode: SendMode) => void;
}

/** Render the send-shortcut mode selector. */
export function EnterSendRow({ useMode, setMode, t }: EnterSendRowProps): ReactNode {
  const mode = useMode((value) => value);
  const [open, setOpen] = useState(false);
  return (
    <div className="dsh-es_row">
      <div className="dsh-es_rowText">
        <div className="dsh-es_title">{t("settings.enterSend.title")}</div>
        <div className="dsh-es_desc">{t("settings.enterSend.description")}</div>
      </div>
      <Menu
        open={open}
        onClose={() => setOpen(false)}
        items={MODES.map((id) => ({
          id,
          label: t(`settings.enterSend.mode.${id}`),
        }))}
        selectedId={mode}
        onSelect={(id) => {
          setOpen(false);
          // Menu's onSelect is string-typed; keep the write path narrowed.
          const next = MODES.find((candidate) => candidate === id);
          if (next !== undefined) setMode(next);
        }}
        align="end"
        portal
        anchor={
          <button
            type="button"
            className="dsh-es_selector"
            aria-haspopup="menu"
            aria-expanded={open}
            onClick={() => setOpen((value) => !value)}
          >
            {t(`settings.enterSend.mode.${mode}`)}
            <IconChevronDownOutlineRegular className="dsh-es_chevron" />
          </button>
        }
      />
    </div>
  );
}
