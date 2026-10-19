![MuseMark](assets/icon.svg)

# MuseMark

English | [简体中文](README.zh-CN.md)

An offline Markdown editor and image, audio, and video viewer built with Tauri 2 and Vditor.

## Features

- Markdown editing with live rendering and source mode; tables, task lists, math, diagrams, and syntax highlighting.
- File tree, recent files, multiple windows, find and replace, and unsaved-change protection.
- Image zoom and audio/video playback with seeking.
- Light, dark, warm, and system themes; focus mode, typewriter mode, outline, and document zoom.
- Self-contained HTML export with embedded styles, fonts, and local images; PDF export on Windows.
- One-click copy for WeChat Official Account, Zhihu, and Toutiao: renders the document to HTML with inline styles so pasted articles keep headings, lists, quotes, code blocks, and tables without re-styling.
- Local editing without an account or online service. External links open in the system browser.

## Download and install

**[Download the latest release](https://github.com/Brian98Z/MuseMark/releases/latest)**

Choose an installer from **Assets**, not the source-code archives. Select x64 for Intel/AMD computers or ARM64 for Apple Silicon and Windows/Linux ARM devices. Use the included `SHA256SUMS.txt` to verify file integrity.

| Platform | Packages | Requirements |
|---|---|---|
| Windows x64 / ARM64 | `.exe` | Microsoft Edge WebView2; the installer downloads it if missing |
| macOS Intel / Apple Silicon | `.dmg` | System WKWebView |
| Linux x64 / ARM64 | `.deb`, `.AppImage` | WebKitGTK 4.1 and desktop libraries; AppImage may require FUSE |

- **Windows:** run the installer. It is not code-signed, so Windows may show an unknown-publisher warning.
- **macOS:** open the DMG and drag MuseMark into Applications. The app is not notarized; if blocked, allow it in Privacy & Security only after verifying its source.
- **Debian/Ubuntu:** install with `sudo apt install ./MuseMark-1.1.0-linux-x64.deb` (use the ARM64 filename on ARM).
- **AppImage:** make the file executable with `chmod +x <file>.AppImage`, then run it.

### Limitations

PDF export is Windows-only. Media format support depends on the system WebView. Linux builds target Ubuntu 22.04 (x64) and Ubuntu 24.04 (ARM64); older distributions may be incompatible. Windows ARM64 native launch and AppImage execution have not been verified. On Windows, most keyboard shortcuts are handled inside the page because WebView2 swallows native menu accelerators (see F1 in-app help for the full list); `Ctrl+Shift+0` (actual size) is reserved by Chinese IME language switching and was remapped to `Ctrl+Alt+0`.

## Build

Requires Node.js 22+, Rust, and the [Tauri platform prerequisites](https://v2.tauri.app/start/prerequisites/): Microsoft C++ Build Tools/Windows SDK on Windows, Xcode Command Line Tools on macOS, or WebKitGTK development libraries on Linux.

```sh
npm ci
npm start
```

Run the packaging command for your platform:

| Target | Command |
|---|---|
| Windows x64 | `npm run dist:win` |
| Windows ARM64 | `npm run dist:win:arm64` |
| macOS Intel | `npm run dist:mac:x64` |
| macOS Apple Silicon | `npm run dist:mac:arm64` |
| Linux x64 | `npm run dist:linux:x64` |
| Linux ARM64 | `npm run dist:linux:arm64` |

Install the matching Rust target when building for another architecture. Build macOS packages on macOS and Linux packages on Linux. Installers are written to `release/windows/`, `release/macos/`, or `release/linux/`.

## Project structure

| Path | Purpose |
|---|---|
| `src-tauri/src/` | Native windows, menus, file operations, settings, and Windows PDF export |
| `renderer/app.js` | Editor and media interface |
| `renderer/bridge.js` | Frontend/native communication |
| `renderer/export.js` | Self-contained export resources |
| `renderer/vendor/` | Bundled offline editor and rendering libraries |
| `scripts/` | Frontend preparation and desktop packaging |

## License

[MIT](LICENSE). Bundled dependencies are listed in [Third-party notices](THIRD-PARTY-NOTICES.md).
