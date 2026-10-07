<div align="center">

# 🎨 DSH Custom Theme

**让你的 DeepSeek Harness 焕发全新色彩与现代交互体验**

自由定制 CSS 主题 · 多分区壁纸工作台 · 星空粒子推理滑条 · 正文排版与流式动效 · 深度思考展开策略

[![npm version](https://img.shields.io/npm/v/dsh-custom-theme.svg?style=flat-square)](https://www.npmjs.com/package/dsh-custom-theme)
[![license](https://img.shields.io/npm/l/dsh-custom-theme.svg?style=flat-square)](https://github.com/Sparrived/dsh-custom-theme/blob/main/LICENSE)
[![DSH Compatibility](https://img.shields.io/badge/DSH-0.2.0+-blue.svg?style=flat-square)](https://github.com/deepseek-ai/dsh)
[![Tests Passing](https://img.shields.io/badge/tests-194%20passed-brightgreen.svg?style=flat-square)](https://github.com/Sparrived/dsh-custom-theme)
[![PRs Welcome](https://img.shields.io/badge/PRs-welcome-brightgreen.svg?style=flat-square)](https://github.com/Sparrived/dsh-custom-theme/pulls)

[English](README.en.md) | **简体中文**

</div>

---

## 🌟 核心特性一览

DeepSeek Harness 原生仅提供亮色、暗色与跟随系统三种预设，缺乏供用户自由扩展外观与深层交互的接口。**dsh-custom-theme** 为 DSH Web GUI 与 Desktop 桌面端带来了全方位的界面个性化与体验增强能力：

- 🎨 **用户专属 CSS 主题目录**：直接将 `.css` 放入主题目录即可生效，支持实时扫描与热加载，内置 **Atom One Dark**、**Monokai Pro** 与 **Gov** 经典预设。
- 🖼️ **多分区壁纸工作台**：独创窗口 6 大独立区域（整体、标题栏、侧边栏、会话区、对话框、工具面板）分层壁纸设定，支持独立覆盖、对齐、透明度与背景虚化。
- 🌌 **星空与深海·推理等级滑条**：移植并升级物理流光滑条，包含 **Codex 星空星轨** 与 **DeepSeek 深海游鲸** 两套动态粒子主题，拖拽顺滑、能量澎湃。
- ✍️ **排版与正文字体定制**：提供 12px～17px 字号快捷胶囊、-2px～+6px 行间距增量调节，支持自定义界面正文字体与代码等宽字体。
- 🌊 **打字机流式渐显与墨晕**：文本流式输出时平滑淡入，彻底消除字符跳动；支持微调过渡时间与初始落笔墨晕浓度。
- 💬 **思考状态文案与光效**：支持自定义模型思考时的文字并实现多词轮播；内置官方扫光、哑光流光、七彩炫光、静态及隐藏等多种光效。
- 🧠 **第三方模型推理档位自动补全**：自动为未声明推理档位的第三方模型注入 `off / low / high / max` 档位配置，附带字节级安全备份与回滚机制。
- 🔍 **上下文注入提示与折叠增强**：恢复官方隐藏的「上下文注入」（技能、规则、参考等）卡片；支持自定义思考过程（Reasoning）的自动展开与折叠时机。
- ⚡ **零外部依赖 · 极速轻量**：纯原生实现，不引入额外第三方运行时包，190+ 自动化测试保证极致稳定性与无闪烁渲染。

---

## 📸 功能图解与视觉体验

### 1. 现代化设置面板与主题切换

在「设置 → 主题与背景」中，提供了一站式的现代化卡片配置面板。你可以自由切换官方主题或自定义主题，并支持明暗模式联动切换。

<div align="center">
  <img src="docs/images/card-themes.png" alt="主题与排版设置" width="760" />
</div>

#### 经典内置主题效果预览

<table>
  <tr>
    <td align="center" width="50%">
      <b>Atom One Dark</b><br />
      <img src="docs/images/chat-one-dark.png" alt="Atom One Dark" />
    </td>
    <td align="center" width="50%">
      <b>Monokai Pro</b><br />
      <img src="docs/images/chat-monokai-pro.png" alt="Monokai Pro" />
    </td>
  </tr>
  <tr>
    <td align="center" colspan="2">
      <b>Gov 终端风格</b><br />
      <img src="docs/images/chat-gov.png" alt="Gov" width="80%" />
    </td>
  </tr>
</table>

---

### 2. 多分区壁纸与背景工作台

插件将 DSH 界面解构为 6 个独立的视觉层级，你可以为整个窗口铺满全景壁纸，也可以为会话区、侧边栏或对话框单独指定壁纸与磨砂玻璃质感。

<div align="center">
  <img src="docs/images/card-backgrounds.png" alt="多分区壁纸工作台" width="760" />
  <p><i>支持在交互式窗口线框图中直观选择分区并配置背景图、透明度（0%~100%）与高斯模糊（0px~20px）</i></p>
</div>

#### 多分区实际渲染效果

所有背景图均通过独立的 `::before` 伪元素合成，完全脱离 DOM 内容流，**绝不影响正文阅读对比度，也绝不引发滚动重绘卡顿**：

<div align="center">
  <img src="docs/images/shot-bg-zones.png" alt="多分区实机效果" width="820" />
</div>

---

### 3. 星空与深海 · 推理强度物理滑条

在输入框的模型切换菜单中，原生的静态列表被替换为极具质感的交互滑条。

<div align="center">
  <img src="docs/images/reasoning-slider-showcase.png" alt="模型菜单推理滑条" width="820" />
</div>

<div align="center">
  <img src="docs/images/reasoning-slider-closeup.png" alt="星空粒子滑条特写" width="360" />
  <p><i>Codex 星空：包含 22 个相位独立解耦的星轨粒子、动态星云渐变与能量辉光</i></p>
</div>

- **双重主题风格**：可在设置中自由切换「Codex 星空」或「DeepSeek 深海游鲸」。
- **丝滑控制**：支持指针平滑拖拽与直接点击档位吸附；支持键盘方向键步进、`Home`/`End` 快速跳转。
- **自动适配**：原生支持 `off`、`low`、`high`、`max` 四档，无缝同步至底层模型 API 调用。

---

### 4. 运行状态文案与扫光特效

模型在进行深度思考（Thinking）或工具调用（Tool Use）时，状态栏文案不再一成不变。

<div align="center">
  <img src="docs/images/card-working.png" alt="运行状态文案与特效设置" width="760" />
</div>

- **文案轮播**：一行一条，按指定间隔（1.2s ~ 4s）自动循环播放你喜欢的俏皮话（如「大肥鱼吃饭中」、「星际漫游中」、「灵感捕获中」）。
- **多种光效模式**：

| 光效名称 | 视觉呈现 | 特点说明 |
| :--- | :--- | :--- |
| **跟随官方** | 官方蓝白色单道扫光 | 保持 DSH 默认的简洁扫光 |
| **哑光流光** | 保持字色，扫光带染色 | <img src="docs/images/shot-work-shimmer-matte.png" height="28" /> 高级微质感 |
| **七彩流光** | 扫光带呈现全彩光谱流动 | <img src="docs/images/shot-work-shimmer-rainbow.png" height="28" /> 绚丽醒目 |
| **静态显示** | 纯色常亮，关闭扫光动画 | 静音低扰模式，节省渲染开销 |
| **完全隐藏** | 界面高度折叠不占位 | 保留屏幕阅读器（a11y）朗读，界面极度清爽 |

---

### 5. 更多深度体验增强

| 功能模块 | 说明 |
| :--- | :--- |
| **✍️ 排版与字体** | 字号胶囊（12px～17px）、行距增量微调（-2px～+6px），支持指定正文与代码的系统/安装字体族。 |
| **🌊 流式渐显动效** | 告别字符生硬闪烁，内置「清爽快速」、「柔和缓显」等预设，字符产生时柔和淡入，阅读更舒适。 |
| **🧠 推理档位自动补全** | 一键为未在配置文件中显式声明档位的第三方模型（如 Gemini、自定义网关）赋予推理强度调节能力。 |
| **🔍 上下文注入提示恢复** | 还原被折叠的 Agent 技能、工作区规则和前置指令注入通知，方便开发者排查上下文状态。 |
| **📖 推理展开策略** | 可选 `streaming`（生成中展开、生成完毕自动折叠）、`keep`（保持展开）、`always`（全部展开）或 `off`。 |
| **🔄 在线一键升级** | 自动静默检测 npm 镜像源新版本，设置页直接展示更新通知与升级按钮。 |

---

## 📦 安装与配置

### 前置要求

- **DeepSeek Harness** `0.2.0` 或更高版本。
- 适用于 **Desktop 桌面端** 以及通过浏览器访问的 **Web GUI** 模式。

### 方式一：通过 DSH 插件管理器安装（推荐）

1. 打开 DSH 界面，点击左侧导航栏的 **「插件」**。
2. 搜索 `dsh-custom-theme` 并点击安装。
3. 重启一次 DSH 即可在「设置」中看到 **「主题与背景」** 页面。

### 方式二：手动配置 (`cordis.patch.yml`)

1. 在你的 DSH 配置目录下的 `package.json` 中添加依赖：
   ```bash
   pnpm add dsh-custom-theme
   ```

2. 在对应的 `cordis.patch.yml` 中声明插件加载：
   ```yaml
   dsh-custom-theme:
     themesDir: ~/.dsh/themes
     backgroundsDir: ~/.dsh/backgrounds
   ```

3. 重启 DSH Desktop 或 `dsh web`。

---

## 🎨 编写你的专属 CSS 主题

向 DSH 添加自定义主题非常简单：**只需往主题目录放入一个 `.css` 文件！**

### 主题存放路径

- **Windows**: `C:\Users\<用户名>\.dsh\themes\<主题名>.css`
- **macOS / Linux**: `~/.dsh/themes/<主题名>.css`

### 主题 CSS 编写规范

只需覆盖根层级的 `--dsw-alias-*` 自定义变量。插件会自动读取调色板并注入底层运行时，同时自动为代码块生成匹配的 Shiki 高亮配色：

```css
/* ~/.dsh/themes/nord-aurora.css */

/* 1. 亮色 / 默认配色 */
:root {
  --dsw-alias-bg-base: #eceff4;
  --dsw-alias-bg-subtle: #e5e9f0;
  --dsw-alias-brand-primary: #5e81ac;
  --dsw-alias-label-primary: #2e3440;
  --dsw-alias-label-secondary: #4c566a;
  --dsw-alias-border-base: #d8dee9;
}

/* 2. 深色配色（当用户切换到深色模式时生效） */
[data-theme="dark"] {
  --dsw-alias-bg-base: #2e3440;
  --dsw-alias-bg-subtle: #3b4252;
  --dsw-alias-brand-primary: #88c0d0;
  --dsw-alias-label-primary: #eceff4;
  --dsw-alias-label-secondary: #d8dee9;
  --dsw-alias-border-base: #434c5e;
}
```

放好文件后，打开 DSH 设置里的「主题与背景」，点击 **「重新扫描」**，你的新主题就会出现在下拉列表中！

<details>
<summary><b>🔍 查看常用 CSS 变量参考清单</b></summary>

| 变量名 | 用途说明 |
| :--- | :--- |
| `--dsw-alias-bg-base` | 核心主背景色（底色） |
| `--dsw-alias-bg-subtle` | 次级背景色（卡片、侧边栏、输入框底色） |
| `--dsw-alias-brand-primary` | 品牌主强调色（按钮、激活态、焦点框） |
| `--dsw-alias-brand-hover` | 品牌强调色悬浮态 |
| `--dsw-alias-label-primary` | 正文一级主要文字颜色 |
| `--dsw-alias-label-secondary` | 次级文字颜色（提示语、说明文本） |
| `--dsw-alias-border-base` | 常用边框与分隔线颜色 |
| `--dsw-alias-label-deep-diving` | 运行状态提示文字颜色（如「深度求索中」） |
| `--dsw-alias-label-shimmer` | 思考状态扫光带颜色 |

</details>

---

## 🖱️ 桌面托盘（运行时补丁）

插件可在**每次桌面端启动后**把托盘行为注入正在运行的主进程：左键主题会话面板、右键原生菜单、双击打开应用，提供“未读 / 最近 / 更多”、新会话、打开和退出。纯内存补丁：不修改安装文件、不改启动参数、不改 Electron fuses、不提权，随进程消失；关闭开关立即在内存里还原官方托盘。

需要官方 Desktop（Host 是主进程的子进程）。注入瞬间会在本机回环地址短暂开启调试端口，注入完成立刻关闭；不接受这一秒窗口请保持关闭。独立错误标记和任意旧 CSS 未迁移，未读遵循官方内存状态。详见[工作方式、安全边界与真机验证](<docs/desktop-tray.md>)。

---

## 🏛️ 架构设计

`dsh-custom-theme` 采用优雅的双端分层架构，保持极度轻量与高内聚：

```
dsh-custom-theme/
├── src/
│   ├── index.mjs                # 宿主端入口：挂载 Cordis 行，服务 /dsh-custom-theme/* 路由
│   ├── host/                    # 宿主端功能实现（文件持久化、安全校验、Patch 热修补、更新检测）
│   ├── themes.mjs               # 纯主题规则（ID白名单、防目录逃逸、图片嗅探）
│   ├── effort-levels.mjs        # 针对 cordis.patch.yml 的精准 AST/文本修补
│   ├── update.mjs               # npm Registry 客户端与更新缓存
│   └── client/                  # 浏览器前端模块源码（拆分为 41 个细分功能模块）
├── lib/
│   └── client.js                # 前端打包产物：零外部依赖的单文件模块（动态注入 Web GUI）
├── themes/                      # 官方内置种子主题（one-dark, monokai-pro, gov）
└── test/                        # 完备的单元测试与基于真实 Chromium 的 CDP 无头浏览器端到端测试
```

- **双端严格隔离**：宿主端只依赖 Node.js 原生 API，负责文件系统与路由；前端由 DSH 核心 `window.__ModuleLoader__` 懒加载，使用内置 React 渲染。
- **渲染零损耗**：壁纸采用独立层级隔离与 `requestAnimationFrame` 批量节流，会话流式打字与大量代码块渲染时帧率稳固。

---

## 🧪 质量与测试

本项目拥有严苛的质量保障体系，包含超过 190 个自动化测试用例：

```bash
# 运行全部单元测试与架构完整性校验
pnpm test

# 运行无头浏览器交互与视觉呈现冒烟测试
pnpm run test:browser

# 验证运行状态流光渲染质量
pnpm run test:effects
```

---

## 📄 开源许可

本项目遵循 [MIT License](LICENSE) 开源协议。

欢迎提交 [Issue](https://github.com/Sparrived/dsh-custom-theme/issues) 反馈建议或发起 [Pull Request](https://github.com/Sparrived/dsh-custom-theme/pulls) 贡献主题！
