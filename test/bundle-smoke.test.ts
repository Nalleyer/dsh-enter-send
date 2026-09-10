/**
 * Bundle-shape smoke test: the built lib/client.js must register the
 * module-loader handoff (`window.__ModuleLoader__.load({ id, factory })`) and
 * materialize to a plugin exporting `apply` + `inject`, with every external
 * `require` resolvable from the shell's static module table and the client
 * module graph — every one of them also declared in the manifest's
 * `dsh.client.inject` list, which is the package's own statement of what the
 * shell must have loaded before this factory runs.
 */
import { readFileSync } from "node:fs";
import assert from "node:assert/strict";
import test from "node:test";

const manifest = JSON.parse(
  readFileSync(new URL("../package.json", import.meta.url), "utf8"),
) as { dsh: { client: { inject: string[] } } };

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
  assert.match(code, /data-composer-input/, "bundle must recognize the current dsh composer");

  // The shell's static module table (verified in dsh-web-frontend dist) plus
  // graph rows must cover every require the bundle makes.
  const table: Record<string, unknown> = {
    react: { useState: () => null },
    "react/jsx-runtime": { jsx: () => null, jsxs: () => null },
    "@deepseek-ai/dsh-client-store": {
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

test("every @deepseek-ai external require is declared in dsh.client.inject", () => {
  const code = readFileSync(new URL("../lib/client.js", import.meta.url), "utf8");
  // react / react/jsx-runtime ride the shell's permanent table and are never
  // declared by plugins; every @deepseek-ai row is a manifest concern.
  const required = [...code.matchAll(/require\("([^"]+)"\)/g)]
    .map((match) => match[1])
    .filter((spec) => spec.startsWith("@deepseek-ai/"));
  assert.ok(required.length > 0, "bundle must keep its dsh externals as require calls");
  for (const spec of required) {
    assert.ok(
      manifest.dsh.client.inject.includes(spec),
      `require("${spec}") is missing from package.json dsh.client.inject`,
    );
  }
});
