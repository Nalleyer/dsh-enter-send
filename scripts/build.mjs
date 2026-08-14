/**
 * Build the dsh-enter-send package artifacts:
 *
 *   lib/index.js      — host (node) half, ESM: registers the settings namespace.
 *   lib/client.js     — browser half, classic script registering
 *                       `window.__ModuleLoader__.load({ id, factory })`, the
 *                       exact delivery shape the web shell's client module
 *                       loader expects (verified against the official
 *                       dsh-client-ui-conversation/lib/client.js).
 *   lib/types/*.d.ts  — minimal public type declarations.
 *
 * Requires `bun` on PATH (the workspace's own bundle tool; npm has a broken
 * native-module setup on this machine, see the handover doc §1).
 */
import { execFileSync } from "node:child_process";
import { mkdirSync, rmSync, writeFileSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const lib = join(root, "lib");
const PACKAGE_NAME = "dsh-enter-send";

/** All runtime imports outside the bundle resolve from the client module table. */
const EXTERNALS = ["--external", "react", "--external", "react/jsx-runtime", "--external", "@deepseek-ai/*"];

function bun(args) {
  execFileSync("bun", args, { cwd: root, stdio: "inherit" });
}

mkdirSync(lib, { recursive: true });
mkdirSync(join(lib, "types", "client"), { recursive: true });

// ── browser half: bundle, then wrap in the module-loader handoff ───────────
const tmpClient = join(lib, ".client.tmp.js");
bun([
  "build",
  "src/client/index.ts",
  "--outfile",
  tmpClient,
  "--format",
  "cjs",
  "--target",
  "browser",
  // Production: selects react/jsx-runtime over react/jsx-dev-runtime — the
  // shell's static module table seeds jsx-runtime only (verified in
  // dsh-web-frontend dist), so a dev-runtime require would fail at load.
  "--production",
  ...EXTERNALS,
]);
const body = readFileSync(tmpClient, "utf8");
rmSync(tmpClient);
const clientBundle = `window.__ModuleLoader__.load({
  id: ${JSON.stringify(PACKAGE_NAME)},
  factory: (require) => {
    var module = { exports: {} };
    var exports = module.exports;
    Object.defineProperty(exports, Symbol.toStringTag, { value: "Module" });
${body}
    return module.exports;
  }
});
`;
writeFileSync(join(lib, "client.js"), clientBundle);

// ── host half: plain ESM plugin module ─────────────────────────────────────
bun([
  "build",
  "src/node/index.ts",
  "--outfile",
  join(lib, "index.js"),
  "--format",
  "esm",
  "--target",
  "node",
  "--external",
  "@deepseek-ai/*",
]);

// ── minimal public types ───────────────────────────────────────────────────
writeFileSync(
  join(lib, "types", "index.d.ts"),
  `export declare const SETTINGS_NAMESPACE = "enter-send";
export declare const MODE_FIELD = "mode";
export declare const MODES: readonly ["enter", "ctrl-enter"];
export declare type SendMode = (typeof MODES)[number];
export declare const DEFAULT_MODE: SendMode;
export interface EnterSendSettings {
  mode?: SendMode;
}
export declare function apply(ctx: unknown): void;
`,
);
writeFileSync(
  join(lib, "types", "client", "index.d.ts"),
  `export declare const inject: string[];
export declare function apply(ctx: unknown): void;
`,
);

console.log(`built ${PACKAGE_NAME}: lib/client.js + lib/index.js`);
