'use strict';
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const out = path.join(root, '.build', 'web');
fs.rmSync(out, { recursive: true, force: true });
fs.mkdirSync(out, { recursive: true });
for (const directory of ['renderer', 'assets']) {
  fs.cpSync(path.join(root, directory), path.join(out, directory), {
    recursive: true,
    filter(source) {
      const rel = path.relative(root, source).split(path.sep).join('/');
      if (rel.endsWith('.d.ts')) return false;
      if (/\/i18n\/[^/]+\.js$/.test(rel) && !rel.endsWith('/zh_CN.js')) return false;
      return !['renderer/vendor/vditor/dist/index.js', 'renderer/vendor/vditor/dist/method.js', 'renderer/vendor/vditor/dist/js/icons/ant.js'].includes(rel);
    },
  });
}
console.log('Prepared offline WebView assets:', out);
