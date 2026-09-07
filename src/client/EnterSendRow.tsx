/**
 * General-settings row for the send shortcut. Mirrors the official
 * EnterBehaviorRow: a title + description column and a Menu selector.
 */
import { useState } from "react";
import { IconChevronDownOutline14, Menu } from "@deepseek-ai/dsh-client-ui-primitives";
import type { InjectFace, PropsLocale, PropsRuntime } from "@deepseek-ai/dsh-client-ui-slots";
import type { SnapshotStore } from "@deepseek-ai/dsh-client-store";
import { MODES } from "../types.js";
import type { SendMode } from "../types.js";

/** Registration-side preference face. */
export interface EnterSendRowInjected {
  hooks: {
    /** Persisted send-shortcut mode bound as useMode. */
    mode: SnapshotStore<SendMode>;
  };
  /** Change the send-shortcut mode. */
  setMode: (mode: SendMode) => void;
}

/** Full Settings-row props. */
export type EnterSendRowProps = PropsRuntime<"settings.general.item"> &
  PropsLocale<"enter-send"> &
  InjectFace<EnterSendRowInjected>;

/** Render the send-shortcut mode selector. */
export function EnterSendRow({ useMode, setMode, t }: EnterSendRowProps) {
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
            <IconChevronDownOutline14 className="dsh-es_chevron" />
          </button>
        }
      />
    </div>
  );
}
