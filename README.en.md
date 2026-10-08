# dsh-enter-send

[English](./README.en.md) | [简体中文](./README.md)

DeepSeek Harness (dsh) client plugin: adds a **Send shortcut** option to **Settings → General** that remaps the send / newline keys of the chat composer.

| Option | Enter | Ctrl/Cmd+Enter |
|---|---|---|
| **Enter sends** (default, keeps dsh's native behavior) | send | newline |
| **Ctrl+Enter sends** | newline | send |

- Shift+Enter always inserts a newline in both modes (browser default, not intercepted).
- Enter pressed during IME composition always passes through — no accidental sends.
- With the default `enter` mode, plain Enter behaves exactly like stock dsh, so upgrading is a no-op.
- The setting is written to the current profile's configuration document (the `mode` field of this plugin's `enter-send` entry), persisting alongside the Desktop / Web side's own configuration.

## Installation

### Prerequisites

- dsh `0.2.0-rc.2` (web platform): this release is a rewrite against that version's client API; `0.1.x` is no longer supported (see Compatibility Notes below).
  - The **Desktop app** bundles that runtime, so it works as-is;
  - **CLI / web profile** needs `@deepseek-ai/dsh` upgraded to the `0.2.x` line first — npm currently serves `0.1.5-rc.3`, where this release reproduces the "installed but never activates" failure.
- Installing from git runs the `prepare` script to build the package: the toolchain is esbuild (npm ecosystem — Node.js only; installed automatically as a devDependency); setups with bun installed fall back to bun.

### Option 1: Desktop app (recommended, official entry point)

The Desktop app does not use the CLI's `web` profile — it loads Electron's reserved `$DSH_HOME/profiles/desktop` profile, so **plugins installed through the CLI are invisible to it**, and the npm `dsh` CLI rejects plugin-management requests against the `desktop` profile. Use the Desktop app's own entry point:

1. Open **Settings → Plugins → Add plugin**;
2. Paste this repository's address into the package/address field:

   ```
   github:Nalleyer/dsh-enter-send
   ```

   To pin a revision, use `github:Nalleyer/dsh-enter-send#<commit-sha>`;
3. Click **Install** and let it resolve dependencies and run the `prepare` build;
4. Restart the Desktop app (or reload the profile as prompted) — a **Send shortcut** row appears in **Settings → General**.

> The install dialog notes that installed plugins do not update automatically: upgrading means uninstalling and installing the new version.

### Option 2: CLI (web profile)

```powershell
dsh plugin --profile web add github:Nalleyer/dsh-enter-send
```

A git install pulls **source**, not build artifacts, so pnpm ≥ 10 refuses to run the `prepare` build script until explicitly allowed — the first `add` fails and dsh prints the fix: copy the exact package key pnpm printed into that profile's `pnpm-workspace.yaml`:

```yaml
allowBuilds:
  dsh-enter-send: true
```

Then re-run `add`. **Be aware**: this authorization lets the package's code execute on your machine at install time (outside any sandbox). Only authorize packages whose source you trust, and consider pinning a commit.

The package declares the `dsh.bundle` manifest, so `add` automatically writes the load row into the profile's patch layer — no manual editing; just restart `dsh web`.

### Local development (--patch overlay, does not touch the profile)

```powershell
# Note: --patch must come before unknown options forwarded to the web app
# (e.g. --port): commander treats an unknown option and its following tokens
# as positional args, so --patch after --port errors with unknown option;
# the parent form (dsh --patch ... web) is rejected as well.
dsh web --patch ./cordis.patch.yml --port 8091
```

### Uninstall

```powershell
# CLI / web profile:
dsh plugin --profile web remove dsh-enter-send
# Desktop app: Settings → Plugins → plugin list → uninstall
```

Any leftover configuration for the plugin entry is harmless; remove it manually if you like.

> See the [dsh documentation](https://deepseek-harness.github.io/deepseek-harness/develop/basic/) for the official plugin packaging & installation guide.

## Build & Test

```powershell
pnpm install             # dev dependencies (esbuild, typescript, tsx, 0.2.0-rc.2 type packages)
node scripts/build.mjs   # produces lib/index.js (host half) + lib/client.js (browser half)
pnpm test                # keymap + composer contract + submission policy + bundle-shape smoke
pnpm typecheck           # tsc --noEmit against the real 0.2.0-rc.2 types
```

Tests run through `node --import tsx --test` (Node 24's built-in runner, tsx for TS transpilation); `pnpm test:bun` keeps the bun entry point.

## How It Works

- **Interception**: a capture-phase `keydown` listener on `document` (`addEventListener(..., true)`) runs before React's delegated composer `onKeyDown`. It recognizes the composer's editable surface (the current Lexical editor with `data-composer-input`, `data-phase`, and `contenteditable="true"`), while excluding disabled and composing input (`isComposing || keyCode === 229`).
- **Sending**: the keymap dispatches a synthesized unmodified-Enter `keydown` (`bubbles: true`) on the composer editor, which bubbles to the React root and triggers the composer's native submit path — draft / attachments / queue / busy arbitration are all reused, never re-implemented. The synthetic event re-enters the capture phase; a synchronous flag prevents recursion.
- **Newline**: the keymap dispatches a synthesized Shift+Enter `keydown` (`bubbles: true`) on the composer editor, so the composer's own keymap passes Shift+Enter through and Lexical's native Enter handling inserts the line break — the exact path a real Shift+Enter takes, so draft sync is identical. The former `document.execCommand("insertText", "\n")` approach no longer works on the current Lexical composer: it reports success but Chromium never dispatches a `beforeinput`, and Lexical reconciles the untouched DOM back — verified live and replaced by the synthesized-keydown route.
- **Preference persistence**: the browser half resolves this plugin entry's configuration form through `ctx.configForms.get("enter-send")` (`getSnapshot / subscribe / set`); the host half exports the `Config` schema (`mode` as a volatile field) and turns off the auto-generated page (`settings.configure({ auto: false })`). A choice lands in the local snapshot store first (the keymap and the settings row read that), then queues the durable Host write.

## Directory Layout

```
├── package.json              # dsh.bundle + dsh.client manifest (platform: web)
├── cordis.patch.yml          # bundle layer (dsh.bundle.patch); row id = enter-send
├── scripts/build.mjs         # build script (esbuild + __ModuleLoader__.load wrapper)
├── src/
│   ├── submission-settings.ts # shared: entry id, field, mode constants and types
│   ├── locales.ts            # zh/en dictionaries + LocaleNamespaceMap declaration
│   ├── node/
│   │   ├── index.ts          # host half: exports the Config schema, disables the auto page
│   │   └── contract.d.ts     # types only: pulls in the ctx.settings declaration
│   └── client/
│       ├── index.ts          # apply entry: settings row + configForms + keymap + styles
│       ├── submission.ts     # submission policy: local store + Host form read/write
│       ├── EnterSendRow.tsx  # settings row component (mirrors the official EnterBehaviorRow)
│       ├── keymap.ts         # key remapping core (pure logic, unit-testable)
│       ├── styles.ts         # row styles (runtime-injected <style>, removed on unload)
│       └── contract.d.ts     # types only: pulls in the slots / locale / settings declarations
├── lib/                      # build artifacts (.gitignored, not committed)
└── test/                     # keymap + composer contract + submission policy + bundle smoke
```

## Compatibility Notes

**This release is an API migration, not a manifest tweak.** All three upstream contracts the 0.1.2 release rode changed in 0.2.0-rc.2, and the old build **silently fails to activate** there (the client fiber never resolves the `settingsScope` service) — which looks exactly like "installed but nothing happens":

| 0.1.2 (broken) | 0.2.0-rc.2 (this release) |
|---|---|
| host `ctx.settings.register(ns, schema)` | the service only offers `configure / describe / update / replace / mutate`; the plugin now **exports a `Config` schema** (each profile entry owns its configuration) |
| client `inject` includes `settingsScope` | `inject = ["slots", "locale", "configForms"]`; the preference rides `ctx.configForms.get(entryId)` |
| — | **service access is gated by `inject`**: reading an undeclared `ctx.<service>` throws `cannot get property "…" without inject`, so the dictionary `ctx.locale.register()` requires `"locale"` in the list |
| `settingsScope.bind({ namespace }).set(field, v)` | `ctx.configForms.get(id).set(field, v)`; reads through `getSnapshot()/subscribe()` |
| — | row registration now takes `store` / `inject` / `locale`; the `hooks` compartment becomes `useXxx` selector hooks |
| `IconChevronDownOutline14` | `IconChevronDownOutlineRegular` (icon naming moved to `Regular`/`Medium`) |

Contracts that still hold (each re-verified against the 0.2.0-rc.2 artifacts):

- **Settings slot**: `settings.general.item` (list slot; `id` + `order` + `locale` + `inject`) is the same shape the official `EnterBehaviorRow` uses (`id: composer-enter`, `order: 20`); this plugin registers `order: 21` right after it.
- **Entry id alignment**: the key for `configForms.get()` is the **plugin entry id inside the profile**, so `cordis.patch.yml` inserts a row with `id: enter-send`, matching `SETTINGS_NAMESPACE` in the client half. If a future installer uses a different row id, that single constant in `src/submission-settings.ts` is the only change needed.
- **Composer DOM markers**: `data-composer-input` (`ComposerContentEditable`) and `data-phase` (`InputBar` passes `input?.phase ?? "inert"` through the same spread) still land on the same contenteditable div, with `contenteditable` mirroring `editable` and `aria-disabled` mirroring the disabled state — `isComposerTarget` / `findComposerTarget` need no change. If upstream splits or renames these markers, update them.
- **Composer keymap**: `registerComposerKeymap` still returns `false` for Enter with `shiftKey === true` (passing it to Lexical's native newline) and submits every other Enter, so both the synthesized Shift+Enter newline and the synthesized plain-Enter send remain valid. If upstream changes Enter / Shift+Enter handling, update `newlineViaComposer` / `sendViaComposer` (see `src/client/keymap.ts`).
- **Client module table**: `@deepseek-ai/dsh-client-store` and `@deepseek-ai/dsh-client-ui-primitives`, which `lib/client.js` requires, are both in the shell's static module table and are declared in `package.json`'s `dsh.client.inject`; `test/bundle-smoke.test.ts` keeps the manifest and the built `require` calls in sync.

## License

[MIT](./LICENSE)
