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
- 设置写入当前 profile 的配置文档（本插件条目 `enter-send` 的 `mode` 字段），随桌面端 / Web 端各自的配置一起持久化。

## 安装

### 前置条件

- dsh `0.2.0-rc.2`（web 平台）：本版按该版本的客户端 API 重写，`0.1.x` 不再兼容（原因见下方「兼容性说明」）。
  - **桌面版**自带这套运行时，直接可装；
  - **CLI / web profile** 需先把 `@deepseek-ai/dsh` 升到 `0.2.x` 一线——目前 npm 上是 `0.1.5-rc.3`，在它下面装本版会复现"装了不激活"。
- 从 git 安装时会运行 `prepare` 脚本自动构建：构建工具链是 esbuild（npm 生态，只需 Node.js，随 devDependencies 自动安装）；本机有 bun 时回退用 bun 构建。

### 方式一：桌面版（推荐，官方入口）

桌面版不是用 CLI 的 `web` profile，而是 Electron 自有的保留 profile `$DSH_HOME/profiles/desktop`——**在 CLI 里装的插件桌面版看不到**，而且 npm 版 `dsh` CLI 会拒绝针对 `desktop` profile 的插件管理请求。桌面版请走它自己的入口：

1. 打开 **设置 → 插件 → 添加插件**；
2. 在包名/地址输入框里粘贴本仓库地址：

   ```
   github:Nalleyer/dsh-enter-send
   ```

   想锁定版本可以写 `github:Nalleyer/dsh-enter-send#<commit-sha>`；
3. 点「安装」，等它把依赖装好并执行 `prepare` 构建；
4. 重启桌面版（或按提示重载 profile），**设置 → 常规** 里会出现「发送快捷键」一行。

> 安装对话框会提示：插件装入后不会自动更新，升级需要先卸载再安装新版本。

### 方式二：CLI（web profile）

```powershell
dsh plugin --profile web add github:Nalleyer/dsh-enter-send
```

git 安装拉取的是**源码**，不附带构建产物，因此 pnpm ≥ 10 在得到显式允许前会拒绝运行 `prepare` 构建脚本——首次 `add` 会失败，dsh 会打印修法：把 pnpm 提示的确切包键写进该 profile 的 `pnpm-workspace.yaml`：

```yaml
allowBuilds:
  dsh-enter-send: true
```

然后重新执行 `add`。**注意**：该授权允许包代码在安装时于你的机器上执行（不在沙箱内），只对源码可信的包授权，并建议锁定 commit。

本包声明了 `dsh.bundle` 清单，`add` 后加载行会自动写入 profile 的 patch 层，无需手动编辑；重启 `dsh web` 即可生效。

### 本地开发（--patch overlay，不写入 profile）

```powershell
# 注意：--patch 必须放在转发给 web app 的未知选项（如 --port）之前：
# commander 遇到未知选项就将其及后续 token 当作位置参数，--patch 放后面
# 会报 unknown option；也不能写成父级形式（dsh --patch ... web）。
dsh web --patch ./cordis.patch.yml --port 8091
```

### 卸载

```powershell
# CLI / web profile：
dsh plugin --profile web remove dsh-enter-send
# 桌面版：设置 → 插件 → 插件列表里卸载
```

卸载后插件条目残留的配置无害，可手动删除。

> 插件打包与安装的官方说明见 [dsh 开发文档](https://deepseek-harness.github.io/deepseek-harness/develop/basic/)。

## 构建与测试

```powershell
pnpm install             # 安装开发依赖（esbuild、typescript、tsx、0.2.0-rc.2 类型包）
node scripts/build.mjs   # 产出 lib/index.js（host 半）+ lib/client.js（浏览器半）
pnpm test                # keymap 单测 + composer 契约回归 + 提交策略单测 + bundle 形态冒烟
pnpm typecheck           # tsc --noEmit，按真实 0.2.0-rc.2 类型检查
```

测试用 `node --import tsx --test`（Node 24 自带 test runner，tsx 负责 TS 转译）；`pnpm test:bun` 保留了 bun 入口。

## 工作原理

- **拦截层**：`document` 捕获阶段 keydown 监听（`addEventListener(..., true)`），先于 React 委托的 composer `onKeyDown`。命中条件：目标是 composer 的可编辑区域（带 `data-composer-input`、`data-phase` 且 `contenteditable="true"` 的 Lexical 编辑器）、非 disabled、非 IME 组合（`isComposing || keyCode === 229`）。
- **发送**：拦截后向 composer 编辑区域派发合成的无修饰 Enter `keydown`（`bubbles: true`），冒泡到 React root 触发 composer 原生提交路径——草稿 / 附件 / 队列 / busy 仲裁全部复用，不重复实现。合成事件会再次经过捕获阶段，由同步标志防重入。
- **换行**：向 composer 编辑区域派发合成的 Shift+Enter `keydown`（`bubbles: true`），走 composer 自身的原生换行路径（KEY_ENTER 对 Shift+Enter 放行，Lexical 的 Enter 处理插入换行符），草稿同步与真实 Shift+Enter 完全一致。早期版本依赖的 `document.execCommand("insertText", "\n")` 在当前 Lexical composer 上已实测失效——返回成功但不派发 `beforeinput`，Lexical 把未变化的 DOM 回滚，因此替换为上述合成 keydown 方案。
- **偏好持久化**：浏览器半通过 `ctx.configForms.get("enter-send")` 取本插件条目的配置表单（`getSnapshot / subscribe / set`），host 半导出 `Config` schema（`mode` 为 volatile 字段）并关掉自动生成的配置页（`settings.configure({ auto: false })`）；选择先落到本地 snapshot store（键盘与设置行读它），再排队写回 Host 文档。

## 目录结构

```
├── package.json              # dsh.bundle + dsh.client 清单（platform: web）
├── cordis.patch.yml          # bundle 配置层（dsh.bundle.patch），行 id = enter-send
├── scripts/build.mjs         # 构建脚本（esbuild + __ModuleLoader__.load 包装）
├── src/
│   ├── submission-settings.ts # 双端共用：条目 id、字段、模式常量与类型
│   ├── locales.ts            # 中/英字典 + LocaleNamespaceMap 声明
│   ├── node/
│   │   ├── index.ts          # host 半：导出 Config schema + 关闭自动配置页
│   │   └── contract.d.ts     # 仅类型：引入 ctx.settings 声明
│   └── client/
│       ├── index.ts          # apply 入口：设置行 + configForms + keymap + 样式
│       ├── submission.ts     # 提交策略：本地 store + Host 表单读写
│       ├── EnterSendRow.tsx  # 设置行组件（仿官方 EnterBehaviorRow）
│       ├── keymap.ts         # 按键重映射核心（纯逻辑，可单测）
│       ├── styles.ts         # 设置行样式（运行时注入 <style>，随卸载清理）
│       └── contract.d.ts     # 仅类型：引入 slots / locale / settings 声明
├── lib/                      # 构建产物（.gitignore，不入库）
└── test/                     # keymap + composer 契约 + 提交策略 + bundle 冒烟
```

## 兼容性说明

**本版是一次 API 迁移，不是清单微调。** 0.1.2 版依赖的三个上游契约在 0.2.0-rc.2 上全部变了，旧版装上去会**静默不激活**（客户端 fiber 等不到 `settingsScope` 服务），表现就是"装了没反应"：

| 0.1.2 写法（失效） | 0.2.0-rc.2（本版） |
|---|---|
| host 侧 `ctx.settings.register(ns, schema)` | 服务只提供 `configure / describe / update / replace / mutate`；改为**导出 `Config` schema**（profile 条目自带配置） |
| 客户端 `inject` 含 `settingsScope` | `inject = ["slots", "locale", "configForms"]`，偏好走 `ctx.configForms.get(entryId)` |
| — | **服务访问按 `inject` 门禁**：`ctx.<service>` 未列入 `inject` 即抛 `cannot get property "…" without inject`，注册字典的 `ctx.locale.register()` 因此必须声明 `"locale"` |
| `settingsScope.bind({ namespace }).set(field, v)` | `ctx.configForms.get(id).set(field, v)`，读取用 `getSnapshot()/subscribe()` |
| — | 设置行注册需要 `store` / `inject` / `locale`；`hooks` 隔间 → `useXxx` 选择器 Hook |
| `IconChevronDownOutline14` | `IconChevronDownOutlineRegular`（图标命名改为 `Regular`/`Medium`） |

仍成立的契约（已逐项复核 0.2.0-rc.2 产物）：

- **设置行插槽**：`settings.general.item`（列表型，`id` + `order` + `locale` + `inject`）与官方 `EnterBehaviorRow`（`id: composer-enter`, `order: 20`）同构；本插件用 `order: 21` 紧随其后。
- **条目 id 对齐**：`configForms.get()` 的 key 是 **profile 里的插件条目 id**，因此 `cordis.patch.yml` 的插入行写成 `id: enter-send`，与客户端里的 `SETTINGS_NAMESPACE` 一致。若将来安装器改用别的行 id，改这一处即可（`src/submission-settings.ts`）。
- **composer DOM 标记**：`data-composer-input`（`ComposerContentEditable`）与 `data-phase`（`InputBar` 以 `input?.phase ?? "inert"` 透传）仍落在同一个 contenteditable div 上，`contenteditable` 随 `editable`、`aria-disabled` 随禁用态同步——`isComposerTarget` / `findComposerTarget` 无需调整。上游若拆开这两个属性或改名，需同步更新。
- **composer 键位**：`registerComposerKeymap` 对 `shiftKey === true` 的 Enter 仍返回 `false`（放行给 Lexical 原生换行），其余 Enter 提交；因此合成 Shift+Enter 换行、合成无修饰 Enter 发送两条路径都仍然成立。上游若改动 Enter / Shift+Enter 的处理，需同步更新 `newlineViaCursor` / `sendViaComposer`（见 `src/client/keymap.ts`）。
- **客户端模块表**：`lib/client.js` 以 `require` 取用的 `@deepseek-ai/dsh-client-store` 与 `@deepseek-ai/dsh-client-ui-primitives` 在 shell 的静态模块表内，且已写入 `package.json` 的 `dsh.client.inject`；两者一致性由 `test/bundle-smoke.test.ts` 守住。

## License

[MIT](./LICENSE)
