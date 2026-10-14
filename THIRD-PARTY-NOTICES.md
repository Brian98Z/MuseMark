# 第三方组件声明

MuseMark 自身的界面、交互、主进程逻辑、文件树与预览器均为独立实现，不含第三方应用的代码或授权逻辑。

下列组件随应用分发，其版权与许可归属各自作者。本项目不修改这些组件的授权条款，也不移除其文件内的版权声明。

## 运行时

| 组件 | 版本 | 许可 | 版权 | 来源 |
|---|---|---|---|---|
| Electron | 44.7.0 | MIT | © Electron contributors / OpenJS Foundation | https://github.com/electron/electron |
| Chromium | 152.0.7977.130 | BSD-3-Clause | © The Chromium Authors | https://www.chromium.org |
| Node.js | 20.18.3 | MIT | © Node.js contributors | https://nodejs.org |

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

以下引擎本项目未启用，已从 `renderer/vendor/vditor/dist/js/` 删除（如需启用，可从 `node_modules/vditor/dist/js/` 恢复对应目录）：

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
- Electron / Chromium / Node.js：见各自发行包内的 `LICENSE*` 文件
- 其余组件：许可声明保留在对应分发文件内部

## 开发与打包依赖

Node.js/npm 依赖版本固定于 `package-lock.json`。运行时使用 Vditor 3.11.3（MIT）；构建依赖包括 Electron 44.7.0（MIT）和 electron-builder 26.0.12（MIT）。Electron 构建依赖提供应用运行时，随发行版包含 Electron、Chromium 与 Node.js；版本信息以打包出的 Electron runtime 为准。electron-builder 的传递依赖各自遵循对应 npm 包的许可证。完整第三方声明与许可文件保留在发行包、`node_modules/` 与 `renderer/vendor/`。
