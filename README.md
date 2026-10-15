![MuseMark](assets/icon.svg)

# MuseMark

离线 Markdown 编辑器与图片、音视频预览器。界面使用 Vditor 3.11.3，桌面宿主已从 Electron 切换为 **Tauri 2 + 系统 WebView**，不再携带 Chromium/Node.js。

## 下载客户端

**[下载 MuseMark v1.0.0](https://github.com/Brian98Z/MuseMark/releases/tag/v1.0.0)** · [最新版本](https://github.com/Brian98Z/MuseMark/releases/latest)

在 Release 的 **Assets** 中选择匹配系统和 CPU 架构的安装包；`Source code` 是源码，不是客户端。常见 Intel/AMD 电脑选择 x64，Apple Silicon Mac 和 Windows ARM 设备选择 ARM64。Linux 用户优先选择适配发行版的 DEB。

下载同页 `SHA256SUMS.txt` 可校验安装包：Windows 使用 `Get-FileHash .\MuseMark-1.0.0-win-x64.exe -Algorithm SHA256`，macOS 使用 `shasum -a 256 <文件名>`，Linux 使用 `sha256sum <文件名>`，将输出与清单对应行比较。校验和用于检查文件完整性，不代替代码签名。

## Windows x64 验收

新安装包：`release/windows/MuseMark-1.0.0-win-x64.exe`。旧 Electron 安装包保留于 `release/windows/previous/`；新旧大小及哈希以桌面检查点实测记录为准。没有 Developer ID/代码签名证书，Windows 可能显示未知发布者。

无文件参数启动时默认打开系统桌面；打开文件/文件夹、另存为和导出对话框也以系统桌面为起点，不受历史 lastFolder 覆盖。安装器通过 NSIS hook 为本安装目录的已有快捷方式显式设置 EXE 图标，保留原参数及 AppUserModelID；桌面快捷方式创建选项仍由用户决定。

Windows 使用 Microsoft Edge WebView2。已有运行时时无需重复安装；缺少时，NSIS 安装器下载微软 Evergreen Bootstrapper 并安装运行时，因此首次安装可能需要联网。应用本身不访问外部服务；用户点击 http/https/mailto 外链时交给系统浏览器。

Windows x64 已完成本地运行检查；Windows ARM64、macOS x64/ARM64、Linux x64/ARM64 已完成本轮 Tauri 云端构建。macOS/Linux 的系统 WebView 媒体支持不同，当前原生 PDF 导出仅实现 Windows WebView2；macOS/Linux 点击 PDF 会报告不支持，不能将这些包视为全功能等价版本。

## 系统版本与安装

| 系统 | 架构 | 安装格式 | 运行前置条件 |
|---|---|---|---|
| Windows | x64、ARM64 | NSIS `.exe` | Microsoft Edge WebView2；缺少时安装器联网安装 |
| macOS | Intel x64、Apple Silicon ARM64 | `.dmg` | 系统 WKWebView；临时签名、未 Apple 公证 |
| Linux | x64、ARM64 | `.deb`、`.AppImage` | WebKitGTK 4.1 及桌面运行库；AppImage 不意味着免除系统依赖 |

- Windows：运行匹配芯片架构的安装程序；桌面/开始菜单快捷方式及文件关联由安装器处理，默认应用由系统和用户决定。
- macOS：打开 DMG，将 MuseMark 拖入 Applications；确认来源可信后，可在系统“隐私与安全性”放行未公证应用，不要关闭全局 Gatekeeper。
- Debian/Ubuntu：`sudo apt install ./MuseMark-1.0.0-linux-x64.deb`（ARM64 更换文件名），让包管理器解析依赖。
- AppImage：`chmod +x MuseMark-1.0.0-linux-x64.AppImage` 后运行；某些系统需 FUSE，解包可使用 `--appimage-extract`。不要用禁用沙箱解决运行错误。
- 公开客户端通过 [GitHub Release](https://github.com/Brian98Z/MuseMark/releases/tag/v1.0.0) 下载，无需从 Actions 获取。Actions Artifacts 仅保留构建追溯用途，可能过期；本地交付副本保存在 `release/<系统>/`。

### 功能与验证区别

Windows x64 已实测文档读写、公式/图表、图片、部分音视频、单实例、关闭保护及 PDF。Windows ARM64 在 x64 runner 上通过交叉构建及 PE 架构检查，未原生启动；macOS 两架构通过最终 DMG 完整性、挂载后应用架构、签名及进程启动检查；Linux 两架构通过 DEB 安装、架构检查、AppImage 解包以及安装后 Xvfb/DBus/Openbox 会话的可见窗口检查。这些 smoke 不等于全部 UI 功能、升级安装及文件关联已验收。Linux x64 以 Ubuntu 22.04、ARM64 以 Ubuntu 24.04 为构建基线，不保证更老发行版兼容。

### 本轮交付文件（2026-10-15）

文件统一带 `MuseMark-1.0.0-` 前缀；大小为安装包本身，不包含系统先决条件。

| 目录 | 文件后缀 | 大小（MiB） |
|---|---|---:|
| `release/windows/` | `win-x64.exe` | 4.41 |
| `release/windows/` | `win-arm64.exe` | 4.24 |
| `release/macos/` | `mac-x64.dmg` | 4.84 |
| `release/macos/` | `mac-arm64.dmg` | 4.70 |
| `release/linux/` | `linux-x64.deb` | 5.20 |
| `release/linux/` | `linux-arm64.deb` | 5.12 |
| `release/linux/` | `linux-x64.AppImage` | 80.06 |
| `release/linux/` | `linux-arm64.AppImage` | 78.30 |

Debian/Ubuntu 用户优先选择 DEB，由系统包管理器安装依赖；AppImage 携带更多运行库，体积明显较大。本轮新增云端产物已下载至上述目录并通过 ZIP 完整性及 SHA-256 清单核对；Windows x64 沿用此前本地验收包。AppImage 仅验证解包，未验证实际启动。

构建提交 `f36a4da`，标签 `build-platforms-20261015-tauri-2`。成功运行记录：[Windows ARM64](https://github.com/Brian98Z/MuseMark/actions/runs/38690893943)、[macOS](https://github.com/Brian98Z/MuseMark/actions/runs/38690893957)、[Linux](https://github.com/Brian98Z/MuseMark/actions/runs/38690894003)。安装包作为 v1.0.0 Release 附件发布，不提交到源码仓库；Release 附统一 `SHA256SUMS.txt`，本地各系统目录附分架构校验清单。

## 功能

- Markdown 实时渲染、源码模式、标题、表格、任务列表、引用、代码块。
- 本地 KaTeX 公式、Mermaid 图表、highlight.js 代码高亮。
- 图片缩放、音频/视频播放与进退；实际 codec 支持由系统 WebView 决定。
- 打开、保存、另存为、文件树、最近文件、多窗口、单实例文件转发、文件关联。
- 浅色、深色、暖色、随系统主题；专注、打字机、大纲、文档缩放。
- 独立 HTML 导出：离线渲染并内嵌样式、字体和本地图片。
- Windows PDF 导出：独立隐藏 WebView2 页面，等待图片和字体，再以 A4 输出。
- 未保存关闭确认：原生窗口拦截，取消保留窗口。

## 快捷键

| 操作 | 快捷键 |
|---|---|
| 新建 / 打开 / 保存 | Ctrl+N / Ctrl+O / Ctrl+S |
| 新窗口 / 文件夹 / 另存为 | Ctrl+Shift+N / Ctrl+Shift+O / Ctrl+Shift+S |
| HTML / PDF 导出 | Ctrl+Shift+E / Ctrl+Shift+P |
| 查找 / 替换 | Ctrl+F / Ctrl+H |
| 源码 / 文件树 / 大纲 | Ctrl+/ / Ctrl+Shift+1 / Ctrl+Shift+2 |
| 专注 / 打字机 | F8 / F9 |
| 浅色 / 深色 / 暖色 | Ctrl+Alt+1 / 2 / 3 |
| 图片缩放 / 音视频播放 | 双击图片 / 空格 |
| 音视频进退 | 左右箭头，5 秒 |

菜单提供完整快捷键。macOS 菜单通过 CmdOrCtrl 使用 Command；其他平台尚待实测。

## 本地构建

前置：Node.js 22+、Rust MSVC 工具链、Microsoft C++ Build Tools、Windows SDK、WebView2。Rust 精确依赖见 `src-tauri/Cargo.lock`，npm 依赖见 `package-lock.json`。

```powershell
npm ci
npm start
npm run dist:win
```

本机已将 Rust 编译器和 Cargo 缓存收纳到：

`F:/OMP/projects/发布工具包/electron/windows/shared/tauri/`

`scripts/build-desktop.cjs` 在该位置存在时自动使用，其他机器使用 PATH 中的 Rust；可通过 `MUSEMARK_TOOLS` 指定工具根目录。Visual Studio/Windows SDK 是系统环境，不是可随意移动的目录。遇到链接器缺失时从 VS x64 Native Tools 命令提示符执行构建。

产物分类：

- Windows：`release/windows/`
- macOS：`release/macos/`
- Linux：`release/linux/`

架构在文件名中区分。原生中间输出位于 `src-tauri/target/`，前端过滤输出位于 `.build/web/`，均不入 Git。

其他架构命令：`dist:win:arm64`、`dist:mac:x64`、`dist:mac:arm64`、`dist:linux:x64`、`dist:linux:arm64`。macOS DMG 需 Mac 构建，Linux 需 WebKitGTK 开发环境；交叉编译成功不代表该架构启动已验证。工作流通过手动 dispatch 或显式 `build-platforms-*` 标签触发，普通 main 推送不自动重打包。仅有 Contents/Workflows 权限的令牌可能无法调用 dispatch API（需 Actions 写权限），可使用经过授权的专用构建标签，不强推或覆盖已有标签。

## 结构

- `src-tauri/src/lib.rs`：窗口、原生菜单、单实例、启动事件、关闭保护。
- `src-tauri/src/files.rs`：文件、目录树、对话框、最近记录、配置、外链。
- `src-tauri/src/pdf.rs`：Windows WebView2 PDF 导出。
- `renderer/bridge.js`：受控 Tauri IPC 桥与查找。
- `renderer/app.js`：编辑器和媒体 UI。
- `renderer/export.js`：自包含导出资源处理。
- `renderer/vendor/`：离线编辑与渲染资源。
- `scripts/prepare-web.cjs`：排除开发文件和未用语言/图标。
- `scripts/build-desktop.cjs`：统一构建与系统分类输出。

原 Electron `main.js`、`preload.js` 及打包依赖已移除，不能再用 Electron 启动。旧设置首次从 `%APPDATA%/MuseMark/config.json` 迁移至 Tauri 应用配置目录，旧文件不删除。

## 安全和验证边界

CSP 拒绝外部网络资源，外链仅允许 http/https/mailto；本地媒体通过动态授权的 asset 协议读取。PDF 导出独立页面移除脚本、事件属性及嵌入页面，等待渲染后关闭脚本再打印。不通过 `--no-sandbox` 绕过运行时问题。

安装、卸载、快捷方式及文件关联需对最终安装器单独验收；页面启动、归档测试和调试目标出现不代表全部验收完成。完整第三方信息见 [THIRD-PARTY-NOTICES.md](THIRD-PARTY-NOTICES.md)。
