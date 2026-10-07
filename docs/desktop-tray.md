# 运行时桌面托盘 / Runtime desktop tray

> 这不是官方插件 API：Electron 的托盘是主进程里的原生对象，纯插件无法改它的左键/右键。本功能由插件的 Host 半自行进入**正在运行**的桌面端主进程、在内存里替换托盘行为。**不修改任何安装文件、不注入启动参数、不需要重启以外的操作、不修改 Electron fuses、不提权。** 每次桌面端启动后重新注入，内存补丁随进程消失。

## 已迁移功能

参照 Deeptop / DSH-Desktop（MIT，Copyright 2026 Sparrived）的托盘行为：

- 左键：320 DIP 主题化面板；再次点击或失焦隐藏。
- 双击：打开主窗口；右键：官方原生菜单原样保留。
- 未读最多 3 条、最近最多 4 条、更多最多 12 条，按活动时间排序、去重。
- 标题、工作区名（缺失时目录末段）、运行中（`◉`）和未读（`●`）标记；超过长度截断。
- 点击会话、新建会话、打开 DeepSeek Harness、退出。
- 更多页面、返回、上下方向键、Home / End、Esc；小屏滚动与多屏工作区边界限制。
- 退出仍走官方 `app.quit()`，不跳过进行中任务确认。

### 明确的兼容性差异

- 会话数据与切换来自官方 `sessions` / `uiSession` / `uiWorkspace` / `workspaces` / `connection` 服务，不抓取 DOM，不读取私有数据库，不让弹窗连接 Host。
- 排除已归档、空白和明确的 subagent；普通 fork 仍保留。
- 未读采用当前官方客户端的 `pendingInteraction` / `completionUnread`。当前会话不计未读；在隐藏主窗口中完成的当前会话也不会因此变未读。重启后不保留未读。
- 官方聚合服务没有独立的失败状态，**不迁移旧项目的独立错误标记**。
- 面板只跟随明暗和五个受限配色 token；不复制任意自定义 CSS、背景壁纸、外部字体。
- 主进程每 20 秒重新下发一次工具提示与菜单，因此在语言切换等官方重排之后仍能恢复；官方窗口重绘毫秒级生效。

## 工作方式

```
桌面端主进程 ── spawn ──> DSH Host（插件运行在这里）
   ▲                              │
   │  1. process._debugProcess(ppid)：让主进程自己打开 inspector（127.0.0.1，仅回环）
   │  2. 扫描 9229–9239，只接受标题为 electron/js2c/browser_init 的目标
   │  3. Runtime.queryObjects(Tray.prototype) 找到活着的托盘实例
   │  4. Runtime.callFunctionOn 注入 src/desktop/tray-main.cjs（字符串，独立作用域）
   │  5. require('inspector').close()：立刻关闭自己打开的端口
   └──────────────────────────────┘
```

- 触发时机：**每次桌面端启动后**。Host 是主进程的子进程（`process.ppid` 即主进程），插件激活时读取开关并注入；托盘通常在激活之后稍晚创建，载荷因此同时提供原型旁路：后创建的托盘会被自动接管。
- 开关保存在 `$DSH_HOME/dsh-custom-theme.desktop-tray.json`，由“设置 → 主题与背景 → 桌面托盘（运行时补丁）”写入。Host 是执行注入的一方，所以开关必须存在 Host 侧。
- 数据方向是**拉取**：主进程调用渲染器里的两个全局函数 `window.__dctTraySnapshot()` / `window.__dctTrayAction(...)`，每次调用都读当前官方 store，没有订阅、租约、心跳或缓存。
- 关闭开关会立即在内存里卸载：还原官方 tooltip 与右键菜单对象、还原被替换的 `Tray.prototype` 方法、断开 IPC、销毁弹窗。下一次启动不再注入。
- 弹窗行为对齐系统托盘菜单：**按内容自适应高度**（文档把菜单高度报给主进程，主进程再按光标所在显示器的可用工作区夹取，并记住上次高度，所以首次打开不会闪一下整屏高度），并按内容铺满画布背景；窗口以 `show()` 取得焦点，**点击外部（失焦）立即关闭**，`Esc`、再次点击托盘同样关闭。鼠标打开时焦点落在列表容器上，因此不会给第一行加高亮，方向键仍从第一项开始。

## 使用

1. 确保桌面端加载的是包含本功能的插件构建（开发版先 `npm run build:client`）。
2. 进入“设置 → 主题与背景 → 桌面托盘（运行时补丁）”，勾选“启用增强托盘”。卡片会显示注入结果。
3. 首次启用后**重启桌面端**即可让自动注入在启动时完成；重启前也可以只对当前会话生效（见“验证”一节的手动注入）。
4. 左键测试面板，然后右键、双击、新会话与会话跳转。退出有运行任务时仍走官方确认。

状态文字的含义：

| 状态 | 含义 |
| --- | --- |
| 仅在 DSH 桌面端可用 | 当前是 Web 页面（`dsh web`／浏览器），没有可修补的原生托盘 |
| 已开启，等待注入 | 开关已保存，本次注入尚未成功；重启桌面端后仍如此请查看卡片错误行 |
| 已在运行的桌面端上生效 | 注入成功，托盘已被接管 |
| 已关闭 | 使用官方托盘行为 |

## 安全边界

- **不是桌面端就自动跳过**：判定要求同时满足三条——运行在 Electron 运行时里（`process.versions.electron`）、启动入口是 Desktop Host 引导（argv 含 `dsh-desktop-host`）、父进程是一个有效 pid。`dsh web`、CLI 等宿主下第一条即不成立，直接返回“不是桌面端宿主”，**不打开端口、不发任何请求**；开关文件只被读取，不会被当作注入依据。
- **只凭 `ELECTRON_RUN_AS_NODE` 不足以认定桌面端**：这个环境变量会被桌面端会话的任何后代进程继承（在桌面端里跑一次 `dsh web` 也会带上它），所以它只作为线索，argv 里的 Host 引导路径才是证据。即便判定成立，注入也只接受标题为 Electron 引导目标（`browser_init`）的 inspector，普通进程永远不会被当成主进程。
- 只在本机回环地址上通信：目标必须是 `ws://127.0.0.1:<port>/`，且标题必须是 Electron 引导目标；非回环或非 `browser_init` 一律拒绝。
- **只关闭自己打开的端口。** 如果 9229–9239 上已经有 inspector（例如用户自己用 `--inspect` 启动），注入会复用它并在结束后**原样保留**；否则注入完成立即 `require('inspector').close()`。任何失败路径都会走同一个 `finally` 关闭逻辑。
- 端口只在注入的约一秒内存在；窗口期内**本机其他进程若能连上该端口，就等于拿到主进程的完全控制权**。这是本方案接受的取舍：不落盘、不需要改安装包、不需要重启才能卸载。不接受该窗口请保持开关关闭。
- 载荷在**独立作用域**中执行：它只能看见 `electron` 模块、`config` 和托盘实例，没有 `require`、没有文件系统。渲染器提供的字符串、ID、颜色都会在进入菜单/提示/弹窗之前重新校验（长度上限、控制字符、ID 字符集、颜色格式、去重）。
- 弹窗使用独立本地文档与独立非持久 session、独立 preload；`sandbox`、`contextIsolation` 开启，`nodeIntegration` 关闭，拒绝权限请求、禁止导航与新窗口；IPC 只接受属于该弹窗主 frame 的调用。
- 同一产品 renderer 中的其他插件共享信任域，IPC 无法区分它们；不要把该桥接当作针对恶意客户端插件的隔离机制。
- 失败一律不外抛：注入失败只会让卡片显示原因，官方托盘保持原样，插件其余功能不受影响。

## 兼容性

- 需要 **Windows / macOS / Linux 上的官方 Desktop**（Electron 主进程 + Host 子进程），已验证构建为 Desktop `0.2.0-rc.2`（Electron 44.0.0、Node 24.18）。
- 不做版本哈希白名单：载荷在每次启动时对新主进程重新校验（找得到 `Tray` 原型、有活着的实例才动手），桌面端升级后若内部结构变化，注入会失败并保持官方行为，而不是留下半成品。
- 原地升级插件后，**已经运行**的桌面端仍持有旧代码，需要重启才会用新版本注入。

## 验证

```powershell
npm test                 # 单元测试：注入器、端口扫描、载荷（mock electron）、渲染器钩子、路由
npm run check:client     # lib/client.js 与 src/client 一致
node test/browser/tray-popup.mjs   # 弹窗文档：明暗、键盘、更多/返回、纯文本、错误
```

真实桌面端验证（不改动正在使用的安装）：用临时 `DSH_HOME` + 独立 `--user-data-dir` 启动第二个实例，插件目录以 junction/软链指向工作区，再对一个明确的 PID 运行注入器：

```powershell
node .tmp/probe/iso-verify.mjs <桌面端主进程 PID> install    # 也支持 uninstall / inspect / click
```

本文档记录的这次验证结果（Desktop 0.2.0-rc.2、Electron 44.0.0）：

- `install` → `{ok:true, mode:"install", trays:1, adopted:1}`；主进程内实测 `click:[1] dbl:[1] channels:4`。
- 触发真实托盘 `click` → 弹窗窗口被创建：`file:///…/src/desktop/popup.html`，可见；再次点击后隐藏。
- `uninstall` → `{ok:true, mode:"uninstall", trays:0}`；主进程内 `click:[] dbl:[] channels:0`，弹窗销毁。
- 再 `install` → 再次接管成功（原型还原后仍可重复注入）。
- 每次注入结束后 9229 均不可连接（`ECONNREFUSED`），即注入器关闭了自己打开的端口。

单元测试与真实端到端互补：`test/desktop-inject.test.mjs` 用**序列化后的载荷源码**（`new Function(...)`，与注入路径一致）驱动 mock Electron，覆盖菜单分组、文本/颜色消毒、IPC 信任检查、已销毁托盘、卸载还原与重复注入。

## English summary

This is a **runtime, memory-only** desktop tray feature, not an archive patch. The plugin's Host half runs as a child of the Desktop main process, so it can ask that process to open its own inspector on loopback, evaluate a self-contained payload that replaces the tray's click handling, and immediately close the port it opened. No installed file is modified, no launch argument is injected, no Electron fuse is changed and no elevation is used; the patch disappears with the process and is reapplied at every Desktop start while the switch is on.

Left click opens a themed session panel (3 unread / 4 recent / 12 more, running and unread markers, New chat / Open / Quit), double click opens the app and right click keeps the official native menu. Session data comes from the official client services through two renderer globals the main process pulls; everything the renderer sends is re-validated before it reaches a menu, tooltip or window.

The tradeoff is a roughly one-second loopback inspector window during injection: while it is open, another local process could take control of the Desktop main process. An inspector that was already open is reused and left alone; only a port this feature opened is closed, including on every failure path. Failures never throw out of the plugin: the settings card reports the reason and the official tray stays as it was.
