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
 * Toolchain: esbuild (npm) first — Node-only, matches the official dsh
 * quickstart (`npx @deepseek-ai/dsh`), and is what `prepare` uses during a
 * `dsh plugin add github:...` install (pnpm installs devDependencies there).
 * Falls back to bun for local setups that ship dsh via bun.
 */
import { execFileSync } from "node:child_process";
import { mkdirSync, rmSync, writeFileSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const lib = join(root, "lib");
const PACKAGE_NAME = "dsh-enter-send";

/** All runtime imports outside the bundle resolve from the client module table. */
const EXTERNALS = ["react", "react/jsx-runtime", "@deepseek-ai/*"];

/** esbuild path (npm ecosystem; the primary toolchain). */
async function bundleWithEsbuild(esbuild) {
  const client = await esbuild.build({
    entryPoints: [join(root, "src/client/index.ts")],
    outfile: join(lib, ".client.tmp.js"),
    bundle: true,
    format: "cjs",
    platform: "browser",
    target: ["es2022"],
    jsx: "automatic",
    jsxImportSource: "react",
    external: EXTERNALS,
    write: false,
  });
  writeFileSync(join(lib, ".client.tmp.js"), client.outputFiles[0].text);

  const host = await esbuild.build({
    entryPoints: [join(root, "src/node/index.ts")],
    outfile: join(lib, "index.js"),
    bundle: true,
    format: "esm",
    platform: "node",
    target: ["es2022"],
    external: EXTERNALS,
    write: false,
  });
  writeFileSync(join(lib, "index.js"), host.outputFiles[0].text);
}

/** bun fallback (bun-installed dsh setups; also the historical local toolchain). */
function bundleWithBun() {
  execFileSync(
    "bun",
    [
      "build",
      "src/client/index.ts",
      "--outfile",
      join(lib, ".client.tmp.js"),
      "--format",
      "cjs",
      "--target",
      "browser",
      // Production: selects react/jsx-runtime over react/jsx-dev-runtime — the
      // shell's static module table seeds jsx-runtime only (verified in
      // dsh-web-frontend dist), so a dev-runtime require would fail at load.
      "--production",
      ...EXTERNALS.flatMap((spec) => ["--external", spec]),
    ],
    { cwd: root, stdio: "inherit" },
  );
  execFileSync(
    "bun",
    [
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
    ],
    { cwd: root, stdio: "inherit" },
  );
}

mkdirSync(lib, { recursive: true });
mkdirSync(join(lib, "types", "client"), { recursive: true });

let esbuild = null;
try {
  esbuild = await import("esbuild");
} catch {
  // devDependencies not installed yet — fall back to bun below.
}
if (esbuild) {
  await bundleWithEsbuild(esbuild);
  console.log(`bundled with esbuild (npm)`);
} else {
  try {
    bundleWithBun();
    console.log(`bundled with bun (fallback)`);
  } catch (error) {
    console.error(
      "build failed: install devDependencies (`npm install` or `bun install`) " +
        "for esbuild, or put bun (https://bun.sh) on PATH.",
    );
    process.exit(1);
  }
}

// ── wrap the browser bundle in the module-loader handoff ────────────────────
const body = readFileSync(join(lib, ".client.tmp.js"), "utf8");
rmSync(join(lib, ".client.tmp.js"));
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

// ── minimal public types ───────────────────────────────────────────────────
writeFileSync(
  join(lib, "types", "index.d.ts"),
  `export declare const SETTINGS_NAMESPACE = "enter-send";
export declare const MODE_FIELD = "mode";
export declare const MODES: readonly ["enter", "ctrl-enter"];
export declare type SendMode = (typeof MODES)[number];
export declare const DEFAULT_MODE: SendMode;
export declare interface EnterSendSettings {
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
