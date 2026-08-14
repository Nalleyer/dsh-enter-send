# dsh-enter-send

DeepSeek Harness (dsh) client plugin: adds a **Send shortcut** option to **Settings → General** that remaps the send / newline keys of the chat composer.

| Option | Enter | Ctrl/Cmd+Enter |
|---|---|---|
| **Enter sends** (default, keeps dsh's native behavior) | send | newline |
| **Ctrl+Enter sends** | newline | send |

- Shift+Enter always inserts a newline in both modes (browser default, not intercepted).
- Enter pressed during IME composition always passes through — no accidental sends.
- With the default `enter` mode, plain Enter behaves exactly like stock dsh, so upgrading is a no-op.
- The setting persists to `$DSH_HOME/settings.yaml` (namespace `enter-send.mode`).

## Installation

### Prerequisites

- dsh ≥ `0.1.0-rc.6` (web platform)
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
bun test                 # keymap unit tests + bundle-shape smoke test (requires bun)
```

## How It Works

- **Interception**: a capture-phase `keydown` listener on `document` (`addEventListener(..., true)`) runs before React's delegated composer `onKeyDown`. It only fires when the target is the composer's textarea (carrying its `data-phase` marker, not readOnly/disabled, and not composing — `isComposing || keyCode === 229`).
- **Sending**: the keymap dispatches a synthesized unmodified-Enter `keydown` (`bubbles: true`) that bubbles to the React root and triggers the composer's native submit path — draft / attachments / queue / busy arbitration are all reused, never re-implemented. The synthetic event re-enters the capture phase; a synchronous flag prevents recursion.
- **Newline**: `document.execCommand("insertText", "\n")` fires the native `input` event, so draft sync follows the exact same path as Shift+Enter.
- **Persistence**: the browser half binds the `enter-send` namespace via `settingsScope`; the host half registers a schemastery schema (`mode: "enter" | "ctrl-enter"`) writing to `$DSH_HOME/settings.yaml`.

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
└── test/                 # bun test: keymap logic + bundle-shape smoke
```

## Compatibility Notes

- The plugin identifies the composer textarea by its `data-phase` attribute, coupling it to the official composer's internals; if upstream changes that marker, update `isComposerTarget` accordingly.
- `document.execCommand("insertText")` is deprecated but supported in every Chromium release; if it is ever removed, switch to `beforeinput` / `InputEvent` injection (see the comments in `src/client/keymap.ts`).

## License

[MIT](./LICENSE)
