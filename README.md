# dsh-enter-send

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
- 构建需要 [bun](https://bun.sh)

### 步骤

1. 构建产物（或在 Releases 下载）：

   ```powershell
   npm run build   # 或 node scripts/build.mjs
   ```

2. 让 dsh 能解析到本包（二选一）：

   ```powershell
   # 方式 A：通过插件命令注册
   dsh plugin --profile web add <本目录>

   # 方式 B：手动链接到 profile 的 node_modules
   #   $DSH_HOME\profiles\node_modules\dsh-enter-send → <本目录>
   ```

3. 在 profile 的 `cordis.patch.yml` 中启用加载行（方式 B 需要；方式 A 会自动写入）：

   ```yaml
   - insert:
       - id: enter-send
         name: 'dsh-enter-send'
   ```

4. 重启 `dsh web`，打开 **设置 → 常规** 即可看到"发送快捷键"。

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
├── package.json          # dsh.client 清单（platform: web）
├── cordis.patch.yml      # 本地开发加载用的 patch
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
