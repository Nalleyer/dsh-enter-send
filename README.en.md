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
- [bun](https://bun.sh) to build

### Steps

1. Build the artifacts (or grab them from Releases):

   ```powershell
   npm run build   # or: node scripts/build.mjs
   ```

2. Make the package resolvable by dsh (pick one):

   ```powershell
   # Option A: register via the plugin command
   dsh plugin --profile web add <this-dir>

   # Option B: symlink into the profile's node_modules
   #   $DSH_HOME\profiles\node_modules\dsh-enter-send → <this-dir>
   ```

3. Enable the load entry in the profile's `cordis.patch.yml` (required for Option B; Option A writes it for you):

   ```yaml
   - insert:
       - id: enter-send
         name: 'dsh-enter-send'
   ```

4. Restart `dsh web`, then open **Settings → General** to see "Send shortcut".

> See the [dsh documentation](https://deepseek-harness.github.io/deepseek-harness/develop/basic/) for the official plugin packaging & installation guide.

## Build & Test

```powershell
node scripts/build.mjs   # produces lib/index.js (host half) + lib/client.js (browser half)
bun test                 # keymap unit tests + bundle-shape smoke test
```

## How It Works

- **Interception**: a capture-phase `keydown` listener on `document` (`addEventListener(..., true)`) runs before React's delegated composer `onKeyDown`. It only fires when the target is the composer's textarea (carrying its `data-phase` marker, not readOnly/disabled, and not composing — `isComposing || keyCode === 229`).
- **Sending**: the keymap dispatches a synthesized unmodified-Enter `keydown` (`bubbles: true`) that bubbles to the React root and triggers the composer's native submit path — draft / attachments / queue / busy arbitration are all reused, never re-implemented. The synthetic event re-enters the capture phase; a synchronous flag prevents recursion.
- **Newline**: `document.execCommand("insertText", "\n")` fires the native `input` event, so draft sync follows the exact same path as Shift+Enter.
- **Persistence**: the browser half binds the `enter-send` namespace via `settingsScope`; the host half registers a schemastery schema (`mode: "enter" | "ctrl-enter"`) writing to `$DSH_HOME/settings.yaml`.

## Directory Layout

```
├── package.json          # dsh.client manifest (platform: web)
├── cordis.patch.yml      # local-development load patch
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
