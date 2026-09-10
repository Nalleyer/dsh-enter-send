/**
 * Composer-contract regression tests.
 *
 * These lock the two upstream facts the plugin rides, both re-verified against
 * dsh 0.1.5-rc.1 (`dsh-client-ui-conversation/lib/client.js`):
 *
 * 1. DOM shape — the composer surface is a `<div>` carrying BOTH
 *    `data-composer-input` (ComposerContentEditable) and `data-phase`
 *    (InputBar passes `input?.phase ?? "inert"` through the same spread), with
 *    `contenteditable` mirrored from `editable` and `aria-disabled` set while
 *    the editor is disabled.
 * 2. Key routing — the composer's `registerComposerKeymap` returns false for
 *    `event.shiftKey === true` on KEY_ENTER (so Lexical's native handler
 *    inserts the line break) and calls `handlers.submit(ctrlKey || metaKey)`
 *    otherwise. The plugin therefore only has to turn a remapped key into the
 *    right synthesized keydown; everything downstream stays native.
 */
import assert from "node:assert/strict";
import test from "node:test";
import { findComposerTarget, handleKeydown } from "../src/client/keymap.ts";
import type { KeymapActions } from "../src/client/keymap.ts";

/** Minimal stand-in for the composer's editable element. */
class FakeElement {
  constructor(
    readonly tagName: string,
    readonly attrs: Record<string, string>,
    readonly parent: FakeElement | null = null,
  ) {}

  hasAttribute(name: string): boolean {
    return name in this.attrs;
  }

  getAttribute(name: string): string | null {
    return this.attrs[name] ?? null;
  }

  /** Resolve the plugin's element selector against this element or an ancestor. */
  closest(selector: string): FakeElement | null {
    const required = selector
      .split(",")
      .map((part) => part.trim())
      .map((part) => (part.match(/\[([^\]]+)\]/g) ?? []).map((attr) => attr.slice(1, -1)));
    for (let node: FakeElement | null = this; node !== null; node = node.parent) {
      for (const attrNames of required) {
        if (attrNames.every((name) => node!.hasAttribute(name))) return node;
      }
    }
    return null;
  }
}

// `findComposerTarget` narrows with `instanceof Element` / `instanceof
// HTMLElement`; seed those globals so the fake elements below pass the gate.
Object.assign(globalThis, { Element: FakeElement, HTMLElement: FakeElement });

/** Current composer: contenteditable div with both markers on one element. */
function composerElement(overrides: Record<string, string> = {}): FakeElement {
  return new FakeElement("DIV", {
    "data-composer-input": "",
    "data-phase": "plain",
    contenteditable: "true",
    ...overrides,
  });
}

/** Records the synthesized keydowns the plugin dispatches. */
function recordingActions(): KeymapActions & { calls: Array<{ kind: string; key: string; shiftKey: boolean }> } {
  const calls: Array<{ kind: string; key: string; shiftKey: boolean }> = [];
  return {
    calls,
    newlineViaComposer: () => calls.push({ kind: "newline", key: "Enter", shiftKey: true }),
    sendViaComposer: () => calls.push({ kind: "send", key: "Enter", shiftKey: false }),
  };
}

/** Minimal keydown event the handler reads. */
function keyEvent(overrides: Partial<Record<string, unknown>> = {}): KeyboardEvent {
  return {
    key: "Enter",
    ctrlKey: false,
    metaKey: false,
    shiftKey: false,
    isComposing: false,
    keyCode: 13,
    preventDefault: () => {},
    stopPropagation: () => {},
    target: composerElement(),
    ...overrides,
  } as unknown as KeyboardEvent;
}

test("findComposerTarget walks up to the marked composer surface", () => {
  const root = new FakeElement("DIV", { "data-phase": "active" });
  const composer = new FakeElement(
    "DIV",
    { "data-composer-input": "", "data-phase": "inert", contenteditable: "true" },
    root,
  );
  const decoratedChild = new FakeElement("SPAN", {}, composer);
  assert.equal(findComposerTarget(decoratedChild), composer);
  assert.equal(findComposerTarget(composer), composer);
  // A bare `data-phase` container (the conversation root) is not the composer.
  assert.equal(findComposerTarget(root), null);
});

test("findComposerTarget rejects a read-only or non-editable surface", () => {
  assert.equal(findComposerTarget(composerElement({ contenteditable: "false" })), null);
  assert.equal(findComposerTarget(composerElement({ "aria-disabled": "true" })), null);
  assert.equal(findComposerTarget(null), null);
});

test("'enter' mode leaves plain Enter alone and turns Ctrl+Enter into a newline", () => {
  const actions = recordingActions();
  const plain = keyEvent();
  assert.equal(handleKeydown("enter", plain, actions), false);
  assert.deepEqual(actions.calls, []);

  const accelerated = keyEvent({ ctrlKey: true });
  assert.equal(handleKeydown("enter", accelerated, actions), true);
  assert.deepEqual(actions.calls, [{ kind: "newline", key: "Enter", shiftKey: true }]);
});

test("'ctrl-enter' mode turns plain Enter into a newline and Ctrl+Enter into a send", () => {
  const newline = recordingActions();
  assert.equal(handleKeydown("ctrl-enter", keyEvent(), newline), true);
  assert.deepEqual(newline.calls, [{ kind: "newline", key: "Enter", shiftKey: true }]);

  const send = recordingActions();
  assert.equal(handleKeydown("ctrl-enter", keyEvent({ ctrlKey: true }), send), true);
  assert.deepEqual(send.calls, [{ kind: "send", key: "Enter", shiftKey: false }]);
});

test("consumed events are cancelled before the composer sees them", () => {
  let prevented = 0;
  let stopped = 0;
  const event = keyEvent({ ctrlKey: true, preventDefault: () => prevented++, stopPropagation: () => stopped++ });
  handleKeydown("enter", event, recordingActions());
  assert.equal(prevented, 1);
  assert.equal(stopped, 1);
});

test("IME composition, Shift+Enter, and non-composer targets always pass through", () => {
  const actions = recordingActions();
  // keyCode 229 is the legacy IME marker the composer's own keymap also honours.
  assert.equal(handleKeydown("ctrl-enter", keyEvent({ isComposing: true }), actions), false);
  assert.equal(handleKeydown("ctrl-enter", keyEvent({ keyCode: 229 }), actions), false);
  assert.equal(handleKeydown("ctrl-enter", keyEvent({ shiftKey: true }), actions), false);
  assert.equal(handleKeydown("ctrl-enter", keyEvent({ target: new FakeElement("DIV", {}) }), actions), false);
  assert.deepEqual(actions.calls, []);
});
