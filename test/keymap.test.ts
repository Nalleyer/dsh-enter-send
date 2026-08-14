/**
 * Unit tests for the pure keymap logic. Run with: bun test  (or: node --test test/)
 */
import assert from "node:assert/strict";
import test from "node:test";
import { decide, isComposerTargetLike, resolveAction } from "../src/client/keymap.ts";
import { DEFAULT_MODE, MODES } from "../src/types.ts";

const enter = { key: "Enter", ctrlKey: false, metaKey: false, shiftKey: false };
const ctrlEnter = { key: "Enter", ctrlKey: true, metaKey: false, shiftKey: false };
const metaEnter = { key: "Enter", ctrlKey: false, metaKey: true, shiftKey: false };
const shiftEnter = { key: "Enter", ctrlKey: false, metaKey: false, shiftKey: true };
const otherKey = { key: "a", ctrlKey: false, metaKey: false, shiftKey: false };

test("default mode ('enter') keeps dsh's Enter behavior and remaps Ctrl+Enter to newline", () => {
  assert.equal(resolveAction("enter", enter), null); // composer sends
  assert.equal(resolveAction("enter", ctrlEnter), "newline");
  assert.equal(resolveAction("enter", metaEnter), "newline");
  assert.equal(resolveAction("enter", shiftEnter), null); // browser newline
  assert.equal(resolveAction("enter", otherKey), null);
});

test("'ctrl-enter' mode swaps the mapping", () => {
  assert.equal(resolveAction("ctrl-enter", enter), "newline");
  assert.equal(resolveAction("ctrl-enter", ctrlEnter), "send");
  assert.equal(resolveAction("ctrl-enter", metaEnter), "send");
  assert.equal(resolveAction("ctrl-enter", shiftEnter), null); // newline either way
  assert.equal(resolveAction("ctrl-enter", otherKey), null);
});

test("every declared mode round-trips through the settings vocabulary", () => {
  assert.deepEqual([...MODES], ["enter", "ctrl-enter"]);
  assert.equal(DEFAULT_MODE, "enter");
});

test("decide gates on composing input and target eligibility", () => {
  // Composing input (IME) always passes through, even for remapped keys.
  assert.equal(decide("ctrl-enter", enter, true, true), null);
  assert.equal(decide("ctrl-enter", ctrlEnter, true, true), null);
  // Non-composer targets pass through.
  assert.equal(decide("ctrl-enter", enter, false, false), null);
  // Eligible + not composing applies the mapping.
  assert.equal(decide("ctrl-enter", enter, true, false), "newline");
  assert.equal(decide("ctrl-enter", ctrlEnter, true, false), "send");
  assert.equal(decide("enter", ctrlEnter, true, false), "newline");
});

test("composer-target shape check", () => {
  const target = { hasAttribute: (name) => name === "data-phase", readOnly: false, disabled: false };
  assert.equal(isComposerTargetLike(target), true);
  assert.equal(isComposerTargetLike({ ...target, readOnly: true }), false);
  assert.equal(isComposerTargetLike({ ...target, disabled: true }), false);
  assert.equal(isComposerTargetLike({ ...target, hasAttribute: () => false }), false);
});
