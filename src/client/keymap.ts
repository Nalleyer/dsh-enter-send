/**
 * Keymap core: remap Enter / Ctrl(+Cmd)+Enter on the composer editor.
 *
 * Strategy (see the handover doc §3.1/§3.2): a document-level CAPTURE-phase
 * keydown listener runs before React's delegated composer handler. When the
 * current mode wants to remap a key, we preventDefault + stopPropagation so
 * the composer never sees it, then perform the mapped action ourselves:
 *
 * - "send": dispatch a synthesized plain-Enter keydown that bubbles to
 *   React's root listener, so the composer's own submit path runs unchanged
 *   (draft, attachments, queue/busy arbitration — all native).
 * - "newline": `document.execCommand("insertText", "\n")` on the focused
 *   editable surface, which fires the native input event and keeps React's
 *   draft store in sync exactly like the browser-default Shift+Enter path.
 *
 * IME composition (keyCode 229 / isComposing) always passes through, and
 * Shift+Enter always passes through (newline in both modes).
 */
import type { SendMode } from "../types.js";

/** Action the keymap takes for one keydown. */
export type KeyAction = "send" | "newline";

/** Keyboard facts the keymap reads from a keydown event. */
export interface KeyFacts {
  key: string;
  ctrlKey: boolean;
  metaKey: boolean;
  shiftKey: boolean;
}

/**
 * Attribute-level composer check (instanceof kept separate so tests can
 * exercise the shape with plain stubs).
 *
 * dsh <= 0.1.1 used a textarea. Current dsh uses a Lexical contenteditable
 * div with both data-composer-input and data-phase markers.
 */
export function isComposerTargetLike(target: {
  tagName: string;
  hasAttribute(name: string): boolean;
  getAttribute(name: string): string | null;
  readOnly?: boolean;
  disabled?: boolean;
}): boolean {
  const isTextarea = target.tagName.toLowerCase() === "textarea";
  const isCurrentContentEditable =
    target.hasAttribute("data-composer-input") && target.getAttribute("contenteditable") === "true";
  return (
    target.hasAttribute("data-phase") &&
    (isTextarea || isCurrentContentEditable) &&
    !target.readOnly &&
    !target.disabled &&
    target.getAttribute("aria-disabled") !== "true"
  );
}

/**
 * True when `target` is the composer's editable surface: either the legacy
 * textarea or the current Lexical contenteditable div.
 */
export function isComposerTarget(target: unknown): target is HTMLElement {
  return target instanceof HTMLElement && isComposerTargetLike(target);
}

/**
 * Resolve a key event target to the composer root. Key events from a
 * contenteditable can originate on a decorated child, so use the nearest
 * marked editor instead of requiring the event target itself to be the root.
 */
export function findComposerTarget(target: EventTarget | null): HTMLElement | null {
  if (!(target instanceof Element)) return null;
  const candidate = target.closest("[data-composer-input][data-phase], textarea[data-phase]");
  return isComposerTarget(candidate) ? candidate : null;
}

/**
 * Resolve one composer keydown into the action the current mode wants.
 * Returns null when the key must pass through untouched (the composer's own
 * handler takes over — plain Enter in `enter` mode, Shift+Enter in both).
 *
 * | key                     | mode='enter' (default) | mode='ctrl-enter' |
 * |-------------------------|------------------------|-------------------|
 * | Enter                   | null (composer sends) | newline           |
 * | Ctrl/Cmd+Enter          | newline               | send              |
 * | Shift+Enter             | null (browser newline)| null (same)       |
 */
export function resolveAction(mode: SendMode, e: KeyFacts): KeyAction | null {
  if (e.key !== "Enter") return null;
  if (e.shiftKey) return null;
  const accelerated = e.ctrlKey || e.metaKey;
  if (mode === "ctrl-enter") return accelerated ? "send" : "newline";
  return accelerated ? "newline" : null;
}

/**
 * Pure decision for one keydown: composing input and non-composer targets
 * always pass through; otherwise the mode's mapping applies.
 */
export function decide(mode: SendMode, e: KeyFacts, eligible: boolean, composing: boolean): KeyAction | null {
  if (composing) return null;
  if (!eligible) return null;
  return resolveAction(mode, e);
}

/** Insert a newline into the focused editable element (fires React onChange). */
export function insertNewline(target: HTMLElement): void {
  target.focus();
  // Deprecated but universally supported in Chromium; fires the native
  // `input` event so React's draft store syncs exactly like Shift+Enter.
  document.execCommand("insertText", false, "\n");
}

/**
 * Ask the composer to send by dispatching a synthesized plain-Enter keydown
 * that bubbles to React's delegated root listener. `isTrusted=false` does not
 * matter to React; the composer treats it as an unmodified Enter and runs its
 * normal submit path (accelerated = false → plain submit).
 */
export function sendViaComposer(target: HTMLElement): void {
  target.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true, cancelable: true }));
}

/** DOM-backed actions used by the installed listener. */
export interface KeymapActions {
  insertNewline(target: HTMLElement): void;
  sendViaComposer(target: HTMLElement): void;
}

export const domActions: KeymapActions = {
  insertNewline,
  sendViaComposer,
};

/**
 * Handle one keydown; returns true when the keymap consumed the event.
 * `actions` is injectable for tests.
 */
export function handleKeydown(mode: SendMode, e: KeyboardEvent, actions: KeymapActions = domActions): boolean {
  const target = findComposerTarget(e.target);
  const action = decide(mode, e, target !== null, e.isComposing || e.keyCode === 229);
  if (action === null || target === null) return false;
  e.preventDefault();
  e.stopPropagation();
  if (action === "send") actions.sendViaComposer(target);
  else actions.insertNewline(target);
  return true;
}

/**
 * Install the capture-phase keydown listener. Returns the disposer (removes
 * the listener); also used as the plugin's unload cleanup via `ctx.effect`.
 *
 * Re-entry guard: `sendViaComposer` dispatches a synthesized keydown, which
 * runs the full capture path again and would hit this same listener.
 * `dispatchEvent` is synchronous, so a flag set around the handler call
 * suppresses that re-entry.
 */
export function installKeymap(getMode: () => SendMode): () => void {
  let synthetic = false;
  const handler = (e: KeyboardEvent) => {
    if (synthetic) return;
    synthetic = true;
    try {
      handleKeydown(getMode(), e);
    } finally {
      synthetic = false;
    }
  };
  document.addEventListener("keydown", handler, true);
  return () => document.removeEventListener("keydown", handler, true);
}
