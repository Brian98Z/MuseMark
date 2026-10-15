# 第三方组件声明

MuseMark 自身的界面、交互、主进程逻辑、文件树与预览器均为独立实现，不含第三方应用的代码或授权逻辑。

下列组件随应用分发，其版权与许可归属各自作者。本项目不修改这些组件的授权条款，也不移除其文件内的版权声明。

## 运行时

| 组件 | 版本 | 许可 | 版权 | 来源 |
|---|---|---|---|---|
| Tauri | 2.12.4（依赖精确版本见 Cargo.lock） | MIT / Apache-2.0 | © Tauri Programme contributors | https://github.com/tauri-apps/tauri |
| Wry / Tao / Tauri 插件 | 见 Cargo.lock | 各 crate 声明的许可 | 各项目贡献者 | https://github.com/tauri-apps |

Windows 复用用户系统安装的 Microsoft Edge WebView2，不在应用包中分发 Electron、Chromium 或 Node.js。缺少 WebView2 时，安装程序下载微软运行时引导器，运行时受微软条款约束。macOS/Linux 分别使用 WKWebView/WebKitGTK，当前迁移优先验证 Windows。

## 渲染内核：Vditor

MIT 许可，© Vanessa219 及贡献者 · https://github.com/Vanessa219/vditor

内核内置并随包分发的组件：

| 内置组件 | 许可 | 版权 / 作者 | 本项目用途 |
|---|---|---|---|
| Lute | MIT | © 88250 / b3log | Markdown 解析与渲染 |
| KaTeX | MIT | © Khan Academy | 数学公式 |
| Mermaid | MIT | © Knut Sveidqvist 及贡献者 | 流程图 / 时序图等图表 |
| highlight.js | BSD-3-Clause | © 2006 Ivan Sagalaev | 代码语法高亮 |
| diff-match-patch | Apache-2.0 | © 2018 The diff-match-patch Authors（Google / Neil Fraser） | 内核文本差异处理 |
| 图标集 | Apache-2.0（Material Icons，© Google）· MIT（Ant Design Icons，© Ant Group） | 见左 | 工具栏图标 |

Mermaid 的构建产物内部还包含其自身依赖：chevrotain、langium、d3、dagre、lodash、underscore、jQuery、DOMPurify、dayjs、cytoscape 等。这些依赖的版权声明与许可保留在对应的 bundle 文件内。

### 代码高亮主题（分发 6 套）

均来自 highlight.js 项目（BSD-3-Clause）：`github`、`github-dark`、`atom-one-light`、`atom-one-dark`、`xcode`、`vs`。

## 已从分发目录移除的内核内置引擎

以下引擎本项目未启用，已从 `renderer/vendor/vditor/dist/js/` 删除；需要时应从对应版本的官方 Vditor 发布包恢复并补充功能验收：

| 引擎 | 许可 | 版权 / 作者 |
|---|---|---|
| MathJax | Apache-2.0 | © 2009-2019 The MathJax Consortium；内含 The Closure Library Authors（Google） |
| ECharts | Apache-2.0 | © Apache ECharts contributors；内含 Microsoft Corporation（tslib） |
| Graphviz + viz.js | EPL-1.0 / MIT | © AT&T（Graphviz）· © Michael Daines（viz.js）· zlib：© Jean-loup Gailly & Mark Adler |
| markmap | MIT | © Mike Bostock 及贡献者 |
| abcjs | MIT | © 2009-2019 Paul Rosen & Gregory Dyke（https://abcjs.net） |
| smiles-drawer | MIT | © 2011-2019 smiles-drawer contributors；ColorBrewer：© Cynthia Brewer |
| flowchart.js | MIT | © 2020 Adriano Raiano（adrai） |
| wavedrom | MIT | © 2011-2026 Aliaksei Chapyzhenka |
| PlantUML 编码器 | MIT | © Arnaud Roques（原实现仅编码，渲染需请求外部服务） |

## 完整许可文本

- highlight.js：`renderer/vendor/vditor/dist/js/highlight.js/LICENSE`
- Tauri 及 Rust 依赖：依赖和版本见 `src-tauri/Cargo.lock`，完整许可证文本位于各 crate 源码包（构建工具目录的 Cargo registry 缓存）。
- 其余组件：许可声明保留在对应分发文件内部

## 开发与打包依赖

Node.js/npm 仅用于构建，锁定在 package-lock.json，当前直接构建依赖为 @tauri-apps/cli 2.12.3。Rust 运行时依赖锁定在 src-tauri/Cargo.lock。Vditor 3.11.3 作为离线浏览器资源随包分发；diff-match-patch 已内嵌于 Vditor，无需再次分发独立 Node 包。保留 renderer/vendor 中的版权声明；开发资源与发布排除规则由 scripts/prepare-web.cjs 控制。
