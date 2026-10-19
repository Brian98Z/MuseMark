![MuseMark](assets/icon.svg)

# MuseMark

[English](README.md) | 简体中文

基于 Tauri 2 和 Vditor 的离线 Markdown 编辑器与图片、音视频预览器。

## 功能

- Markdown 实时渲染与源码编辑，支持表格、任务列表、数学公式、图表和代码高亮。
- 文件树、最近文件、多窗口、查找替换与未保存关闭提醒。
- 图片缩放、音视频播放与进度跳转。
- 浅色、深色、暖色和系统主题，支持专注模式、打字机模式、大纲与文档缩放。
- 导出内嵌样式、字体和本地图片的独立 HTML；Windows 支持 PDF 导出。
- 一键复制到公众号 / 知乎 / 今日头条：自动渲染为带内联样式的 HTML，粘贴后标题、列表、引用、代码块、表格排版不丢。
- 本地编辑，无需账号或在线服务；外部链接交给系统浏览器打开。

## 下载与安装

**[下载最新版本](https://github.com/Brian98Z/MuseMark/releases/latest)**

从 **Assets** 选择安装包，不要下载源码归档。Intel/AMD 电脑选择 x64，Apple Silicon 和 Windows/Linux ARM 设备选择 ARM64。可使用同页 `SHA256SUMS.txt` 核对文件完整性。

| 平台 | 安装格式 | 运行要求 |
|---|---|---|
| Windows x64 / ARM64 | `.exe` | Microsoft Edge WebView2，缺少时安装器联网下载 |
| macOS Intel / Apple Silicon | `.dmg` | 系统 WKWebView |
| Linux x64 / ARM64 | `.deb`、`.AppImage` | WebKitGTK 4.1 与桌面运行库；AppImage 可能需要 FUSE |

- **Windows：**运行安装器。程序未代码签名，系统可能提示未知发布者。
- **macOS：**打开 DMG，将 MuseMark 拖入 Applications。程序未 Apple 公证；若被拦截，请在确认来源后通过“隐私与安全性”放行。
- **Debian/Ubuntu：**运行 `sudo apt install ./MuseMark-1.1.0-linux-x64.deb`，ARM 设备使用 ARM64 文件名。
- **AppImage：**运行 `chmod +x <文件名>.AppImage` 赋予执行权限，再启动文件。

### 限制

PDF 导出仅支持 Windows。媒体格式支持取决于系统 WebView。Linux 构建基线为 Ubuntu 22.04（x64）和 Ubuntu 24.04（ARM64），较旧发行版可能不兼容。Windows ARM64 原生启动和 AppImage 实际运行尚未验证。Windows 上多数快捷键由页面内处理（WebView2 会吞掉原生菜单加速键，完整列表见应用内 F1 帮助）；「实际大小」原 `Ctrl+Shift+0` 被中文输入法的语言切换占用，已改绑 `Ctrl+Alt+0`。

## 构建

需要 Node.js 22+、Rust 及 [Tauri 平台依赖](https://v2.tauri.app/start/prerequisites/)：Windows 需要 Microsoft C++ Build Tools / Windows SDK，macOS 需要 Xcode Command Line Tools，Linux 需要 WebKitGTK 开发库。

```sh
npm ci
npm start
```

按目标平台执行打包命令：

| 目标 | 命令 |
|---|---|
| Windows x64 | `npm run dist:win` |
| Windows ARM64 | `npm run dist:win:arm64` |
| macOS Intel | `npm run dist:mac:x64` |
| macOS Apple Silicon | `npm run dist:mac:arm64` |
| Linux x64 | `npm run dist:linux:x64` |
| Linux ARM64 | `npm run dist:linux:arm64` |

构建其他架构时需安装对应 Rust target。macOS 安装包在 macOS 上构建，Linux 安装包在 Linux 上构建。产物分别输出至 `release/windows/`、`release/macos/` 或 `release/linux/`。

## 项目结构

| 路径 | 用途 |
|---|---|
| `src-tauri/src/` | 原生窗口、菜单、文件操作、设置与 Windows PDF 导出 |
| `renderer/app.js` | 编辑器与媒体界面 |
| `renderer/bridge.js` | 前端与原生层通信 |
| `renderer/export.js` | 自包含导出资源处理 |
| `renderer/vendor/` | 随应用提供的离线编辑与渲染库 |
| `scripts/` | 前端资源准备与桌面打包 |

## 许可证

[MIT](LICENSE)。依赖许可见[第三方声明](THIRD-PARTY-NOTICES.md)。
