/**
 * Bundle-shape smoke test: the built lib/client.js must register the
 * module-loader handoff (`window.__ModuleLoader__.load({ id, factory })`) and
 * materialize to a plugin exporting `apply` + `inject`, with every external
 * `require` resolvable from the shell's static module table and the client
 * module graph.
 */
import { readFileSync } from "node:fs";
import assert from "node:assert/strict";
import test from "node:test";

test("client bundle registers the loader handoff and materializes", () => {
  const code = readFileSync(new URL("../lib/client.js", import.meta.url), "utf8");
  let handoff: { id: string; factory: (require: (spec: string) => unknown) => Record<string, unknown> } | null = null;
  (globalThis as Record<string, unknown>).window = {
    __ModuleLoader__: {
      load: (h: typeof handoff) => {
        handoff = h;
      },
    },
  };
  // Execute the classic script in a scope where `window` is the stub.
  new Function("window", code)((globalThis as Record<string, unknown>).window);
  assert.ok(handoff, "bundle must call window.__ModuleLoader__.load");
  assert.equal(handoff!.id, "dsh-enter-send");

  // The shell's static module table (verified in dsh-web-frontend dist) plus
  // graph rows must cover every require the bundle makes.
  const table: Record<string, unknown> = {
    react: { useState: () => null },
    "react/jsx-runtime": { jsx: () => null, jsxs: () => null },
    "@deepseek-ai/dsh-client-runtime/client": {
      createSnapshotStore: (init: unknown) => ({
        getSnapshot: () => init,
        set: () => {},
        subscribe: () => () => {},
      }),
    },
    "@deepseek-ai/dsh-client-ui-primitives": {
      Menu: () => null,
      IconChevronDownOutline14: () => null,
    },
  };
  const materialized = handoff!.factory((spec: string) => {
    if (spec in table) return table[spec];
    throw new Error(`unexpected require("${spec}")`);
  });
  assert.deepEqual(Object.keys(materialized).sort(), ["apply", "inject"]);
  assert.deepEqual(materialized.inject, ["slots", "locale", "connection", "remote", "settingsScope"]);
  assert.equal(typeof materialized.apply, "function");
});
