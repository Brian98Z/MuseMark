'use strict';

const path = require('node:path');
const { execFileSync } = require('node:child_process');

module.exports = async function signMacApplication(context) {
  if (context.electronPlatformName !== 'darwin') return;
  const app = path.join(context.appOutDir, `${context.packager.appInfo.productFilename}.app`);
  // Re-sign the completed bundle without a developer certificate, before DMG/ZIP creation.
  execFileSync('codesign', ['--force', '--deep', '--sign', '-', app], { stdio: 'inherit' });
  execFileSync('codesign', ['--verify', '--deep', '--strict', '--verbose=2', app], { stdio: 'inherit' });
};
