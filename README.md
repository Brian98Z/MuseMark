![MuseMark 图标](assets/icon.svg)

# MuseMark — 本地 Markdown 编辑器 + 媒体预览器

所见即所得的本地 Markdown 编辑器与媒体预览器。**无许可证校验、无账号登录、无遥测、无任何联网请求。**

## 功能

工具栏图标悬停显示中文功能说明；提示框置于图标下方，避免贴近窗口顶边时被裁切。渲染模式菜单提供所见即所得与即时渲染，分屏预览由独立常驻按钮切换。

| 模块 | 能力 |
|---|---|
| 文档编辑 | 所见即所得（实时渲染 IR）＋ 源码模式（`Ctrl+/`）；长行自动换行；标题/表格/任务列表/引用/代码块/分隔线 |
| 渲染 | KaTeX 数学公式、Mermaid 图表、highlight.js 代码高亮（全部本地离线资源）；文档内相对图片按文档目录解析 |
| 媒体预览 | **图片**（缩放/适应窗口/双击放大，透明图带棋盘底）· **音频**（播放器）· **视频**（播放器）；空格播放暂停、←→ 快退快进 5 秒 |
| 文件 | 新建/打开/保存/另存为/打开文件夹/最近文件/拖放打开；单实例（双击文件直接开） |
| 导航 | 可折叠文件树（按类型着色图标）＋ 大纲跳转 ＋ 状态栏字数 |
| 格式 | 标题 1–6、粗/斜/下划线/删除线/高亮/行内代码/链接/图片/清除格式 |
| 超链接 | 点击链接即打开：`http/https/mailto` → 系统浏览器；文档内相对路径（文档/图片/音视频）→ 本应用打开；`#锚点` → 文档内跳转；悬停显示目标地址 |
| 视图 | 专注模式（F8）、打字机模式（F9）、缩放（`Ctrl+=`/`-`/`0`） |
| 主题 | 浅色 / 深色 / 暖色（护眼）/ 随系统（`Ctrl+Alt+1/2/3`） |
| 导出 | HTML（自包含）/ PDF（A4） |
| 安全 | 主进程拦截全部 http/https/ws 请求；外链仅放行 http/https/mailto；关闭前未保存提醒 |

## 运行

```bat
start.cmd
```
或
```bat
npm install
npm start
```

打开文件：`start.cmd "路径\文档.md"`（也支持图片 / 音频 / 视频），或直接把文件拖进窗口。

## 构建 Windows x64 安装包

需要 Windows x64、Node.js/npm 和可访问 npm registry 的构建环境。依赖版本由 `package-lock.json` 固定；Electron 44.7.0 与 electron-builder 26.0.12 位于 `devDependencies`，Vditor 3.11.3 位于 `dependencies`。

```bat
npm ci
npm run dist:win
```

`npm run dist:win` 使用 electron-builder 生成 NSIS x64 安装程序，输出到 `release/`；安装时允许选择目录，并创建桌面与开始菜单快捷方式。打包配置包含本地 renderer、离线 Vditor 资源、图标和 Electron runtime。安装器声明 MuseMark 可打开下列文档与媒体格式。Windows 会通过“打开方式”及默认应用设置管理默认处理程序；是否自动设为默认由系统和用户选择决定。

已注册格式：Markdown/TXT（`.md`、`.markdown`、`.mdown`、`.mkd`、`.txt`），图片（`.png`、`.jpg`、`.jpeg`、`.jfif`、`.gif`、`.webp`、`.svg`、`.bmp`、`.avif`、`.ico`），音频（`.mp3`、`.wav`、`.ogg`、`.oga`、`.flac`、`.m4a`、`.aac`、`.opus`、`.wma`）及视频（`.mp4`、`.webm`、`.mov`、`.mkv`、`.m4v`、`.avi`、`.ogv`、`.wmv`）。

### 使用本地 NSIS 工具包

`ELECTRON_BUILDER_NSIS_DIR` 应指向包含 `Bin/makensis.exe`、`Include/`、`Plugins/`、`Stubs/` 和 `elevate.exe` 的目录。若自备包将 `makensis.exe` 放在根目录，需复制到 `Bin/makensis.exe`；builder 会将 `NSISDIR` 设置为该根目录。

NSIS 编译器与 `nsis-resources-3.4.1` 是两个独立依赖。已有资源归档时，先核对 SHA-512（Base64）：`Dqd6g+2buwwvoG1Vyf6BHR1b+25QMmPcwZx40atOT57gH27rkjOei1L0JTldxZu4NFoEmW4kJgZ3DlSWVON3+Q==`，再将其中的 `plugins/` 解压至 `%LOCALAPPDATA%/electron-builder/Cache/nsis/nsis-resources-3.4.1/`（未覆盖默认缓存目录时）。不要将 `file://` 当作 app-builder 下载地址。

```powershell
$env:ELECTRON_BUILDER_NSIS_DIR = (Resolve-Path '.build/nsis-bundle/nsis-bundle/windows').Path
npm run dist:win -- --publish never
```

输出安装器：`release/MuseMark-1.0.0-win-x64.exe`。当前产物未做 Authenticode 签名，Windows 可能提示未知发布者。2026-10-15 已验证安装向导可打开、内嵌应用可解包且 EXE/ASAR 与 `win-unpacked` 哈希一致，以及打包应用启动、中文输入和撤销；尚未验证实际安装、卸载、快捷方式与文件关联。使用 7za 检查 EXE 时，它会识别内嵌 7z 并提示尾部附加数据；这不是完整 NSIS 安装流程的验证。

## 构建 macOS 安装包

在 macOS 上安装 Node.js 22，执行 `npm ci`，然后执行 `npm run dist:mac -- --publish never`。只构建本机架构可用 `npm run dist:mac:arm64 -- --publish never`（Apple Silicon）或 `npm run dist:mac:x64 -- --publish never`（Intel）。Windows 不能完成这里的 DMG 创建与 codesign 验证。

产物位于 `release/`：`MuseMark-1.0.0-mac-arm64.dmg` / `.zip` 及 `MuseMark-1.0.0-mac-x64.dmg` / `.zip`。DMG 打开后将 MuseMark 拖到 Applications；ZIP 解压后将 MuseMark.app 移入“应用程序”。选择与 Mac 芯片匹配的版本。

GitHub Actions 的 **Build macOS** 工作流使用两种原生架构 runner，生成 DMG、ZIP 和 SHA-256 清单，并检查归档、Mach-O 架构及应用启动后的页面调试目标。main 上相关代码变更自动触发，也可手动运行。成功后从该次 Actions 运行页面的 Artifacts 下载 `MuseMark-mac-arm64` 或 `MuseMark-mac-x64`（保留 30 天）；不会自动发布 GitHub Release。

这些构建仅作 **ad-hoc 临时签名**，没有 Apple Developer ID 认证或公证。首次打开可能被 Gatekeeper 拦截；核实来源后，在“系统设置 → 隐私与安全性”选择“仍要打开”。企业管理策略可能禁止放行。不要全局关闭 Gatekeeper。CI 启动检查不等于在用户 Mac 上通过下载隔离、首次安装及所有编辑功能验收。

## 快捷键

- 文件：`Ctrl+N` 新建 · `Ctrl+O` 打开 · `Ctrl+S` 保存 · `Ctrl+Shift+S` 另存为 · `Ctrl+Shift+O` 打开文件夹 · `Ctrl+W` 关闭 · `Ctrl+Q` 退出
- 编辑：`Ctrl+Z` 撤销 · `Ctrl+Shift+Z` 重做 · `Ctrl+F` 查找 · `Ctrl+H` 替换
- 段落：`Ctrl+1`~`6` 标题 · `Ctrl+0` 正文 · `Ctrl+Shift+K` 代码块 · `Ctrl+T` 表格 · `Ctrl+Shift+M` 公式
- 格式：`Ctrl+B` 加粗 · `Ctrl+I` 斜体 · `Ctrl+U` 下划线 · `Ctrl+Shift+H` 高亮 · `Ctrl+K` 链接 · `Ctrl+Shift+I` 图片 · `Ctrl+Enter` 打开光标处链接
- 视图：`Ctrl+/` 源码 · `Ctrl+Shift+1` 侧栏（工具栏最左端按钮） · `Ctrl+Shift+2` 大纲 · `F8` 专注 · `F9` 打字机 · `Ctrl+=`/`-`/`0` 缩放 · `Ctrl+Alt+1/2/3` 主题
- 媒体：`空格` 播放/暂停 · `←`/`→` 快退/快进 5 秒 · 双击图片放大/适应
- 导出：`Ctrl+Shift+E` HTML · `Ctrl+Shift+P` PDF

## 设计系统

- **色彩**：中性四层（frame / page / card / elevated）＋ 单一强调色；语义色仅用于状态。浅色偏冷灰、深色表面随层级变亮（层间距离约为浅色两倍）、暖色为纸张感中性色。
- **排版**：界面 13px，正文 16px / 行高 1.72；层级靠字重而非字号；数字使用 tabular-nums。
- **间距与圆角**：4/8 栅格；控制件圆角 6px、面板 8px；边框仅用 1px 极浅色，优先用留白分隔。
- **图标**：统一 Lucide 风格线性图标（24 视框 / stroke 2 / currentColor），文件类型用颜色区分（文档灰、图片紫、音频青、视频品红）。
- **微交互**：悬停/按下过渡 120ms、焦点环、Toast 提示、图片缩放动画。

## 设计取舍

- **本地优先**：全部渲染资源（数学公式、图表、代码高亮、编辑器内核）随应用分发，断网可用；主进程拦截一切外部请求。
- **无鉴权**：没有许可证校验、激活面板、账号体系，也没有更新检查与遥测——打开即用。
- **媒体即文档**：图片、音频、视频与 Markdown 同在一棵文件树、同一个窗口里查看，不需要外部播放器。
- **克制的界面**：三层中性表面 + 单一强调色 + 三套主题；层级靠字重与留白表达，不靠颜色堆砌。

## 工程结构

### 目录

```
musemark/
├─ main.js                  主进程：窗口 / 菜单 / IPC / 网络封锁 / 导出 / 单实例（492 行）
├─ preload.js               contextBridge 桥：26 项能力映射为 window.omp（26 行）
├─ renderer/
│  ├─ index.html            单页骨架：顶栏 + 侧栏（文件树 / 大纲）+ 编辑区 + 媒体查看器 + 查找条（111 行）
│  ├─ app.js                渲染进程全部界面逻辑：编辑器 / 文件流 / 文件树 / 大纲 / 媒体 / 命令 / 主题 / 导出（800 行）
│  ├─ style.css             设计令牌 + 布局 + 组件外观（439 行）
│  └─ vendor/               离线渲染内核：Vditor + Lute / KaTeX / Mermaid / highlight.js + 6 套代码主题（约 12 MB），见 THIRD-PARTY-NOTICES.md
├─ assets/                 项目图标：icon.svg（矢量标识）+ icon.png（256×256 带透明，窗口/任务栏）
├─ package.json             入口 main.js，`npm start` → electron .
├─ start.cmd                Windows 启动脚本（可选传入文档路径）
├─ README.md
└─ THIRD-PARTY-NOTICES.md   第三方组件清单与许可
```

### 进程模型

| 层 | 职责 | 关键约束 |
|---|---|---|
| 主进程 `main.js` | 建窗、原生菜单与快捷键、文件读写、原生对话框、导出、单实例与 argv 转发 | `session.webRequest` 取消全部 `http/https/ws/wss` 请求；窗口配置 `contextIsolation: true`、`nodeIntegration: false`、`sandbox: false` |
| 预加载 `preload.js` | 唯一通信通道：`contextBridge.exposeInMainWorld('omp', …)` 逐项映射 IPC | 不暴露 `ipcRenderer` 本体，只给具名方法 |
| 渲染进程 `renderer/` | 编辑器与全部界面逻辑，无 Node 权限 | 任何磁盘/系统操作必须经 `window.omp`；CSP 限定 `default-src 'self'` |

### IPC 通道

| 通道 | preload API | 用途 |
|---|---|---|
| `app:info` / `app:about` | `info()` / `about()` | 版本、运行时、作者信息 |
| `app:confirm-discard` | `confirmDiscard()` | 关闭前未保存确认（同步，规避异步竞态） |
| `file:read` / `file:write` | `read()` / `write()` | 文本读写（UTF-8） |
| `file:stat` | `stat()` | 类型/存在性判定：决定进编辑器还是媒体查看器 |
| `file:open-dialog` / `file:open-folder-dialog` / `file:save-dialog` | `openDialog()` / `openFolderDialog()` / `saveDialog()` | 原生打开/另存对话框 |
| `tree:read` | `readTree()` | 递归读取目录树（带类型标记，供文件树渲染） |
| `shell:reveal` / `shell:open-external` | `reveal()` / `openExternal()` | 资源管理器定位；外链仅放行 `http/https/mailto` 交系统浏览器 |
| `recent:list` | `recent()` | 最近文件（上限 20 条） |
| `export:html` / `export:pdf` | `exportHtml()` / `exportPdf()` | 自包含 HTML 与 PDF 导出 |
| `find:start` / `find:stop` | `findStart()` / `findStop()` | 基于 Electron `findInPage` 的原生查找 |
| `config:get` / `config:set` | `configGet()` / `configSet()` | 配置读写（`%APPDATA%\MuseMark\config.json`） |
| `menu`（主→渲染） | `onMenu()` | 下发菜单/快捷键命令与外部打开的文件路径 |

### `main.js` 分区

| 行段 | 模块 |
|---|---|
| 1–35 | 常量：扩展名分类（文档 / 图片 / 音频 / 视频）、最近文件上限、应用名 |
| 36–68 | 配置存储、最近文件读写 |
| 69–76 | 网络封锁：拦截并取消全部外部请求 |
| 77–126 | 窗口创建、多窗口管理、渲染进程日志与崩溃上报 |
| 127–266 | 原生菜单与快捷键（文件 / 编辑 / 格式 / 视图 / 主题 / 帮助） |
| 267–428 | IPC 接口、超链接白名单、HTML / PDF 导出 |
| 429–455 | 单实例锁与 argv 转发（二次启动把文件交给既有窗口） |
| 456–491 | 查找、关闭前确认 |

### `renderer/app.js` 分区

| 行段 | 模块 |
|---|---|
| 1–26 | 顶部声明：状态、扩展名分类、Vditor 实例 |
| 27–58 | 工具函数（DOM、提示、防抖等） |
| 59–104 | 编辑器初始化（Vditor 配置：IR 模式、本地 `cdn`、KaTeX / Mermaid / highlight.js） |
| 105–116 | 视图切换（编辑 / 分屏 / 预览） |
| 117–210 | 媒体查看器（图片缩放 / 音频 / 视频） |
| 211–242 | 标题与状态栏（文件名、未保存标记、字数） |
| 243–305 | 文件流（打开 / 保存 / 另存 / 最近文件） |
| 306–366 | 文件树（递归渲染、懒展开、点击打开） |
| 367–395 | 大纲（标题跳转） |
| 396–483 | 超链接处理、文档内相对资源按文档目录解析、侧栏控件 |
| 484–602 | 编辑命令（格式、插入、视图、文件等菜单命令实现） |
| 603–622 | 查找条 |
| 623–635 | 主题（浅 / 深 / 暖，切换根类名） |
| 636–684 | 导出（HTML / PDF） |
| 685–718 | 帮助与快捷键说明 |
| 719–800 | 启动：读取配置、恢复上次文件夹、绑定菜单与拖放 |

### 关键数据流

- **启动**：有文件参数 → 开窗并下发 `open-path`；无参数 → 开窗，若无 `config.lastFolder` 则留空，否则 400ms 后恢复上次文件夹（`main.js` 单实例段 + `app.js` 启动段）。
- **打开文件**：`file:stat` 判类型 → 文档进编辑器、媒体进查看器；文档内的相对图片/音视频/链接按**文档所在目录**解析。
- **保存**：`vditor.getValue()` → `file:write`；未保存状态驱动窗口标题与关闭确认（`app:confirm-discard`）。
- **主题**：三套令牌定义在 `style.css` 顶部（浅 / 深 / 暖），切换只改根节点类名，全部组件由 CSS 变量驱动。
- **联网**：主进程请求拦截 + 页面 CSP 双重限制；渲染内核资源全部来自 `renderer/vendor/` 本地目录。

## 作者

**Brian98Z** · [github.com/Brian98Z](https://github.com/Brian98Z)

## 说明

界面、交互、主进程逻辑、文件树与预览器为本项目独立实现。

渲染内核使用开源库 [Vditor](https://github.com/Vanessa219/vditor)（MIT，© Vanessa219 及贡献者），随包分发其内置的 Lute（Markdown 解析）、KaTeX（数学公式）、Mermaid（图表）、highlight.js（代码高亮，含 6 套主题）。

第三方组件的完整清单、许可与版权归属见 [THIRD-PARTY-NOTICES.md](./THIRD-PARTY-NOTICES.md)。
