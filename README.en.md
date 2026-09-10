# dsh-enter-send

DeepSeek Harness (dsh) client plugin: adds a **Send shortcut** option to **Settings → General** that remaps the send / newline keys of the chat composer.

| Option | Enter | Ctrl/Cmd+Enter |
|---|---|---|
| **Enter sends** (default, keeps dsh's native behavior) | send | newline |
| **Ctrl+Enter sends** | newline | send |

- Shift+Enter always inserts a newline in both modes (browser default, not intercepted).
- Enter pressed during IME composition always passes through — no accidental sends.
- With the default `enter` mode, plain Enter behaves exactly like stock dsh, so upgrading is a no-op.
- The setting persists to `$DSH_HOME/settings.yaml` (namespace `enter-send.mode`); it is also mirrored to browser `localStorage` as a fallback for non-loopback/memory-mode pages, so the last choice survives Web restarts.

## Installation

### Prerequisites

- dsh `0.1.2-rc.1` (web platform): the declared minimum; compatibility is verified up to `0.1.5-rc.1` (latest release), while newer versions require a fresh check
- Installing from git runs the `prepare` script to build the package: the toolchain is esbuild (npm ecosystem — Node.js only; installed automatically as a devDependency); setups with bun installed fall back to bun automatically
- Running the tests requires [bun](https://bun.sh) (development only)

### Option 1: Install from GitHub (source, auto-built on install)

```powershell
dsh plugin --profile web add github:Nalleyer/dsh-enter-send
```

A git install pulls **source**, not build artifacts, so pnpm ≥ 10 refuses to run the `prepare` build script until explicitly allowed — the first `add` fails and dsh prints the fix: copy the exact package key pnpm printed into that profile's `pnpm-workspace.yaml`:

```yaml
allowBuilds:
  dsh-enter-send: true
```

Then re-run `add`. **Be aware**: this authorization lets the package's code execute on your machine at install time (outside any sandbox). Only authorize packages whose source you trust, and consider pinning a commit (`github:Nalleyer/dsh-enter-send#<sha>`).

The package declares the `dsh.bundle` manifest, so `add` automatically writes the load row into the profile's patch layer — no manual editing; just restart `dsh web`.

### Option 2: Install from tarball / npm (prebuilt, no build authorization)

```powershell
# tarball (produced via pnpm pack in this repo)
dsh plugin --profile web add ./dsh-enter-send-0.1.0.tgz

# or by package name once published to npm
dsh plugin --profile web add dsh-enter-send
```

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
dsh plugin --profile web remove dsh-enter-send   # removes the dependency and its layer
# Any leftover enter-send section in $DSH_HOME/settings.yaml is harmless; remove it manually if you like
```

> See the [dsh documentation](https://deepseek-harness.github.io/deepseek-harness/develop/basic/) for the official plugin packaging & installation guide.

## Build & Test

```powershell
node scripts/build.mjs   # produces lib/index.js (host half) + lib/client.js (browser half)
                         # esbuild (npm) first; falls back to bun when esbuild is absent
bun test                 # keymap unit tests + composer-contract regression + bundle-shape smoke test (requires bun)
```

## How It Works

- **Interception**: a capture-phase `keydown` listener on `document` (`addEventListener(..., true)`) runs before React's delegated composer `onKeyDown`. It recognizes the composer's editable surface (both the legacy textarea and the current Lexical editor with `data-composer-input`, `data-phase`, and `contenteditable="true"`), while excluding disabled and composing input (`isComposing || keyCode === 229`).
- **Sending**: the keymap dispatches a synthesized unmodified-Enter `keydown` (`bubbles: true`) on the composer editor, which bubbles to the React root and triggers the composer's native submit path — draft / attachments / queue / busy arbitration are all reused, never re-implemented. The synthetic event re-enters the capture phase; a synchronous flag prevents recursion.
- **Newline**: the keymap dispatches a synthesized Shift+Enter `keydown` (`bubbles: true`) on the composer editor, so the composer's own keymap passes Shift+Enter through and Lexical's native Enter handling inserts the line break — the exact path a real Shift+Enter takes, so draft sync is identical. The former `document.execCommand("insertText", "\n")` approach no longer works on the current Lexical composer: it reports success but Chromium never dispatches a `beforeinput`, and Lexical reconciles the untouched DOM back — verified live and replaced by the synthesized-keydown route (re-confirmed on `0.1.5-rc.1`).
- **Persistence**: the browser half binds the `enter-send` namespace via `settingsScope`; the host half registers a schemastery schema (`mode: "enter" | "ctrl-enter"`) writing to `$DSH_HOME/settings.yaml`. The choice is also mirrored to browser `localStorage`, so it can survive restarts even in non-loopback/memory-mode pages.

## Directory Layout

```
├── package.json          # dsh.bundle + dsh.client manifest (platform: web)
├── cordis.patch.yml      # bundle layer (dsh.bundle.patch); doubles as the dev --patch overlay
├── scripts/build.mjs     # build script (bun build + __ModuleLoader__.load wrapper)
├── src/
│   ├── types.ts          # mode types & settings constants (shared by both halves)
│   ├── locales.ts        # zh/en dictionaries + LocaleNamespaceMap declaration
│   ├── node/index.ts     # host half: registers the settings namespace (dsh-settings)
│   └── client/           # browser half:
│       ├── index.ts      # apply entry: settings row + settingsScope + keymap + styles
│       ├── EnterSendRow.tsx  # settings row component (mirrors the official EnterBehaviorRow)
│       ├── keymap.ts     # key remapping core (pure logic, unit-testable)
│       ├── styles.ts     # row styles (runtime-injected <style>, removed on unload)
│       └── contract.d.ts # types only: pulls in the settings.general.item slot contract
├── lib/                  # build artifacts (.gitignored, not committed)
└── test/                 # bun test: keymap logic + composer contract + bundle-shape smoke
```

## Compatibility Notes

Every upstream contract the plugin rides was re-checked against dsh `0.1.5-rc.1` (web platform) and none of them changed, so no keymap or DOM-detection logic was needed (this pass only completed the manifest list, aligned the row styling, and hardened the tests):

- **Settings slot**: `settings.general.item` (list slot; `id` + `order` + `locale` + `inject` registration) is still the same shape the official `EnterBehaviorRow` uses (`id: composer-enter`, `order: 20`); this plugin registers `order: 21` right after it. Upstream still splits the work the same way — browser half registers the row through `ctx.slots.register(...)`, host half registers the schema through `ctx.inject(["settings"], ...)`.
- **Composer DOM markers**: `data-composer-input` (`ComposerContentEditable`) and `data-phase` (`InputBar` passes `input?.phase ?? "inert"` through the same spread) still land on the same contenteditable div, with `contenteditable` mirroring `editable` and `aria-disabled` mirroring the disabled state — `isComposerTarget` / `findComposerTarget` need no change. If upstream splits or renames these markers, update them.
- **Composer keymap**: `registerComposerKeymap` still returns `false` for Enter with `shiftKey === true` (passing it to Lexical's native newline) and routes every other Enter to `handlers.submit(ctrlKey || metaKey)`, so both the synthesized Shift+Enter newline and the synthesized plain-Enter send remain valid. If upstream changes Enter / Shift+Enter handling, update `newlineViaComposer` / `sendViaComposer` (see `src/client/keymap.ts`).
- **Client module table**: `@deepseek-ai/dsh-client-store` and `@deepseek-ai/dsh-client-ui-primitives`, which `lib/client.js` requires, are both in the shell's static module table and are now also declared in `package.json`'s `dsh.client.inject`; `test/bundle-smoke.test.ts` keeps the manifest and the built `require` calls in sync.
- **settingsScope / store API**: `ctx.settingsScope.bind({ namespace })` → `getSnapshot() / subscribe() / set(field, value)` and `createSnapshotStore(init, { persist: { name } })` are unchanged, and reads/writes still land in the `enter-send` section of `$DSH_HOME/settings.yaml`.
- The newline action still avoids `document.execCommand` (verified broken on the current Lexical composer); that finding was re-confirmed on `0.1.5-rc.1`.

## License

[MIT](./LICENSE)
