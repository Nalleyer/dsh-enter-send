# dsh-enter-send

[English](./README.en.md) | [简体中文](./README.md)

DeepSeek Harness（dsh）客户端插件：在 **设置 → 常规** 页面新增"发送快捷键"选项，重映射聊天输入框的发送 / 换行键位。

| 选项 | Enter | Ctrl/Cmd+Enter |
|---|---|---|
| **Enter 发送**（默认，保持 dsh 原生行为） | 发送 | 换行 |
| **Ctrl+Enter 发送** | 换行 | 发送 |

- Shift+Enter 两种模式下都是换行（浏览器默认行为，不拦截）。
- 中文输入法（IME）组合输入中的 Enter 一律放行，不会误发。
- 默认值 `enter` 下普通 Enter 行为与官方完全一致，升级无感知。
- 设置持久化到 `$DSH_HOME/settings.yaml`（namespace `enter-send.mode`）；同时写入浏览器 `localStorage` 作为非本机访问/内存模式下的兜底，重启 Web 后仍会恢复上次选择。

## 安装

### 前置条件

- dsh `0.1.2-rc.1`（web 平台）：插件声明的最低版本；已兼容验证到 `0.1.5-rc.1`（最新发布版），更高版本需重新确认
- 从 git 安装时，安装过程会运行 `prepare` 脚本自动构建：构建工具链为 esbuild（npm 生态，仅需 Node.js，随 devDependencies 自动安装）；本机装有 bun 时自动改用 bun 构建
- 运行测试需要 [bun](https://bun.sh)（仅开发用）

### 方式一：从 GitHub 安装（源码，安装时自动构建）

```powershell
dsh plugin --profile web add github:Nalleyer/dsh-enter-send
```

git 安装拉取的是**源码**，不会附带构建产物，因此 pnpm ≥ 10 在得到显式允许前会拒绝运行 `prepare` 构建脚本——首次 `add` 会失败，dsh 会打印修法：把 pnpm 提示的确切包键写进该 profile 的 `pnpm-workspace.yaml`：

```yaml
allowBuilds:
  dsh-enter-send: true
```

然后重新执行 `add`。**请注意**：该授权允许包代码在安装时于你的机器上执行（不在任何沙箱内），只对源码可信的包授权，并建议锁定 commit（`github:Nalleyer/dsh-enter-send#<sha>`）。

本包声明了 `dsh.bundle` 清单，`add` 后加载行会自动写入 profile 的 patch 层，无需手动编辑；重启 `dsh web` 即可生效。

### 方式二：tarball / npm 安装（预构建产物，无需构建授权）

```powershell
# tarball（仓库内 pnpm pack 产出）
dsh plugin --profile web add ./dsh-enter-send-0.1.0.tgz

# 或 npm 发布后按包名安装
dsh plugin --profile web add dsh-enter-send
```

### 本地开发（--patch overlay，不写入 profile）

```powershell
# 注意：--patch 必须放在转发给 web app 的未知选项（如 --port）之前：
# commander 遇到未知选项就将其及后续 token 当作位置参数，--patch 放后面
# 会报 unknown option；也不能写成父级形式（dsh --patch ... web）。
dsh web --patch ./cordis.patch.yml --port 8091
```

### 卸载

```powershell
dsh plugin --profile web remove dsh-enter-send   # 移除依赖与加载层
# 卸载后 $DSH_HOME/settings.yaml 中残留的 enter-send 段无害，可手动删除
```

> 插件打包与安装的官方说明见 [dsh 开发文档](https://deepseek-harness.github.io/deepseek-harness/develop/basic/)。

## 构建与测试

```powershell
node scripts/build.mjs   # 产出 lib/index.js（host 半）+ lib/client.js（浏览器半）
                         # 构建优先用 esbuild（npm），无 esbuild 时回退 bun
bun test                 # keymap 逻辑单测 + composer 契约回归 + bundle 形态冒烟测试（需要 bun）
```

## 工作原理

- **拦截层**：`document` 捕获阶段 keydown 监听（`addEventListener(..., true)`），先于 React 委托的 composer `onKeyDown`。命中条件：目标是 composer 的可编辑区域（兼容旧版 textarea，以及新版带 `data-composer-input`、`data-phase` 且 `contenteditable="true"` 的 Lexical 编辑器）、非 disabled、非 IME 组合 `isComposing || keyCode === 229`。
- **发送**：拦截后向 composer 编辑区域派发合成的无修饰 Enter `keydown`（`bubbles: true`），冒泡到 React root 触发 composer 原生提交路径——草稿 / 附件 / 队列 / busy 仲裁全部复用，不重复实现。合成事件会再次经过捕获阶段，由同步标志防重入。
- **换行**：向 composer 编辑区域派发合成的 Shift+Enter `keydown`（`bubbles: true`），走 composer 自身的原生换行路径（KEY_ENTER 对 Shift+Enter 放行，Lexical 的 Enter 处理插入换行符），草稿同步与真实 Shift+Enter 完全一致。早期版本依赖的 `document.execCommand("insertText", "\n")` 在当前 Lexical composer 上已实测失效——返回成功但不派发 `beforeinput`，Lexical 把未变化的 DOM 回滚，因此替换为上述合成 keydown 方案（该结论在 `0.1.5-rc.1` 上复验仍成立）。
- **持久化**：浏览器半通过 `settingsScope` 绑定 `enter-send` namespace，host 半注册 schemastery schema（`mode: "enter" | "ctrl-enter"`），读写 `$DSH_HOME/settings.yaml`；选择同时存入浏览器 `localStorage`，在非 loopback/内存模式下也能跨重启保留。

## 目录结构

```
├── package.json          # dsh.bundle + dsh.client 清单（platform: web）
├── cordis.patch.yml      # bundle 配置层（dsh.bundle.patch），兼本地开发 --patch
├── scripts/build.mjs     # 构建脚本（bun build + __ModuleLoader__.load 包装）
├── src/
│   ├── types.ts          # 模式类型与 settings 常量（双端共用）
│   ├── locales.ts        # 中/英字典 + LocaleNamespaceMap 声明
│   ├── node/index.ts     # host 半：注册 settings namespace（dsh-settings）
│   └── client/           # 浏览器半：
│       ├── index.ts      # apply 入口：设置行 + settingsScope + keymap + 样式
│       ├── EnterSendRow.tsx  # 设置行组件（仿官方 EnterBehaviorRow）
│       ├── keymap.ts     # 按键重映射核心（纯逻辑，可单测）
│       ├── styles.ts     # 设置行样式（运行时注入 <style>，随卸载清理）
│       └── contract.d.ts # 仅类型：引入 settings.general.item 插槽契约
├── lib/                  # 构建产物（.gitignore，不入库）
└── test/                 # bun test：keymap 逻辑 + composer 契约 + bundle 形态冒烟
```

## 兼容性说明

已对照 dsh `0.1.5-rc.1`（web 平台）逐项复核，插件依赖的上游契约均未变化，键位与 DOM 识别逻辑无需改动（本次只做了清单补齐、样式对齐与测试加固）：

- **设置行插槽**：`settings.general.item`（列表型插槽，`id` + `order` + `locale` + `inject` 注册形态）与官方 `EnterBehaviorRow`（`id: composer-enter`, `order: 20`）完全同构；本插件用 `order: 21` 紧随其后。官方仍是浏览器半 `ctx.slots.register(...)`、宿主半 `ctx.inject(["settings"], ...)` 注册 schema 的同一套写法。
- **composer DOM 标记**：`data-composer-input`（`ComposerContentEditable`）与 `data-phase`（`InputBar` 以 `input?.phase ?? "inert"` 透传）仍落在同一个 contenteditable div 上，且 `contenteditable` 随 `editable`、`aria-disabled` 随禁用态同步——`isComposerTarget` / `findComposerTarget` 无需调整。若上游拆分这两个属性或改名，需同步更新。
- **composer 键位**：`registerComposerKeymap` 对 `shiftKey === true` 的 Enter 仍返回 `false`（放行给 Lexical 原生换行），其余 Enter 走 `handlers.submit(ctrlKey || metaKey)`；因此合成 Shift+Enter 换行、合成无修饰 Enter 发送两条路径都仍然成立。若上游改动 Enter / Shift+Enter 的 keymap 处理，需同步更新 `newlineViaComposer` / `sendViaComposer`（见 `src/client/keymap.ts`）。
- **客户端模块表**：`lib/client.js` 以 `require` 取用的 `@deepseek-ai/dsh-client-store` 与 `@deepseek-ai/dsh-client-ui-primitives` 均在 shell 的静态模块表内，且已一并写入 `package.json` 的 `dsh.client.inject`；`dsh.client.inject` 与产物 `require` 的一致性由 `test/bundle-smoke.test.ts` 守住。
- **settingsScope / store API**：`ctx.settingsScope.bind({ namespace })` → `getSnapshot() / subscribe() / set(field, value)` 与 `createSnapshotStore(init, { persist: { name } })` 均未变，读写仍落在 `$DSH_HOME/settings.yaml` 的 `enter-send` 段。
- 换行动作不再依赖 `document.execCommand`（在当前 Lexical composer 上实测失效）；该结论已在 `0.1.5-rc.1` 上复验。

## License

[MIT](./LICENSE)
