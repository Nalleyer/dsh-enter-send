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
- 设置持久化到 `$DSH_HOME/settings.yaml`（namespace `enter-send.mode`）。

## 安装

### 前置条件

- dsh ≥ `0.1.0-rc.6`（web 平台）
- 从 git 安装时，安装过程会运行 `prepare` 脚本自动构建，需要 [bun](https://bun.sh)

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
bun test                 # keymap 逻辑单测 + bundle 形态冒烟测试
```

## 工作原理

- **拦截层**：`document` 捕获阶段 keydown 监听（`addEventListener(..., true)`），先于 React 委托的 composer `onKeyDown`。命中条件：目标是 composer 的 textarea（带独有 `data-phase` 标记、非 readOnly/disabled、非 IME 组合 `isComposing || keyCode === 229`）。
- **发送**：拦截后向 textarea 派发合成的无修饰 Enter `keydown`（`bubbles: true`），冒泡到 React root 触发 composer 原生提交路径——草稿 / 附件 / 队列 / busy 仲裁全部复用，不重复实现。合成事件会再次经过捕获阶段，由同步标志防重入。
- **换行**：`document.execCommand("insertText", "\n")`，触发原生 `input` 事件，草稿同步与 Shift+Enter 路径一致。
- **持久化**：浏览器半通过 `settingsScope` 绑定 `enter-send` namespace，host 半注册 schemastery schema（`mode: "enter" | "ctrl-enter"`），读写 `$DSH_HOME/settings.yaml`。

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
└── test/                 # bun test：keymap 逻辑 + bundle 形态冒烟
```

## 兼容性说明

- 插件通过 composer textarea 的 `data-phase` 属性识别目标，与官方 composer 内部实现耦合；若上游调整该标记，需同步更新 `isComposerTarget`。
- `document.execCommand("insertText")` 已被标记废弃，但 Chromium 全版本支持；若未来被移除，需改用 `beforeinput` / `InputEvent` 注入（见 `src/client/keymap.ts` 内注释）。

## License

[MIT](./LICENSE)
