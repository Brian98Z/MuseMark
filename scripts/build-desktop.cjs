'use strict';
const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const root = path.resolve(__dirname, '..');
const tools = process.env.MUSEMARK_TOOLS || 'F:/OMP/projects/发布工具包/electron/windows/shared/tauri';
const toolchain = path.join(tools, 'toolchain', 'bin');
const env = { ...process.env };
if (fs.existsSync(toolchain)) {
  env.PATH = toolchain + path.delimiter + env.PATH;
  env.CARGO_HOME = path.join(tools, 'cargo');
}
const mode = process.argv[2] || 'build';
const args = process.argv.slice(3);
const cli = require.resolve('@tauri-apps/cli/tauri.js');
const result = spawnSync(process.execPath, [cli, mode, ...args], { cwd: root, env, stdio: 'inherit' });
if (result.error) throw result.error;
if (result.status !== 0) process.exit(result.status ?? 1);
if (mode === 'build') {
  const platform = { win32: 'windows', darwin: 'macos', linux: 'linux' }[process.platform];
  const out = path.join(root, 'release', platform);
  fs.mkdirSync(out, { recursive: true });
  const targetArg = args.indexOf('--target');
  const target = targetArg >= 0 ? args[targetArg + 1] : '';
  const bundles = path.join(root, 'src-tauri', 'target', target, 'release', 'bundle');
  const arch = target.startsWith('aarch64') ? 'arm64' : target.startsWith('x86_64') ? 'x64' : process.arch;
  const version = require('../package.json').version;
  for (const format of fs.readdirSync(bundles, { withFileTypes: true })) {
    if (!format.isDirectory()) continue;
    for (const entry of fs.readdirSync(path.join(bundles, format.name))) {
      if (!/\.(exe|msi|dmg|deb|rpm|AppImage)$/.test(entry)) continue;
      const ext = path.extname(entry);
      const destination = path.join(out, `MuseMark-${version}-${platform === 'windows' ? 'win' : platform === 'macos' ? 'mac' : 'linux'}-${arch}${ext}`);
      if (fs.existsSync(destination)) {
        const previous = path.join(out, 'previous', new Date().toISOString().replace(/[:.]/g, '-'));
        fs.mkdirSync(previous, { recursive: true });
        fs.copyFileSync(destination, path.join(previous, path.basename(destination)));
      }
      fs.copyFileSync(path.join(bundles, format.name, entry), destination);
      console.log('Installer:', destination);
    }
  }
}
