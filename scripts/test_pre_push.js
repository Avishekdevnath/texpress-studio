const fs = require('fs');
const path = require('path');
const os = require('os');
const assert = require('assert');
const { execFileSync, execSync } = require('child_process');

const root = path.join(__dirname, '..');
const tecExe = 'W:/Dream Project/texpress_studio_nsis/bin/tectonic.exe';

console.log('=== PRE-PUSH RELEASE READINESS TEST SUITE ===\n');

// 1. JS Syntax checks
const jsFiles = [
  'main.js',
  'preload.js',
  'updater_bridge.js',
  'ui/js/app.js',
  'ui/js/modules/editor.js',
  'ui/js/modules/explorer.js'
];
for (const rel of jsFiles) {
  execFileSync(process.execPath, ['--check', path.join(root, rel)], { stdio: 'pipe' });
  console.log(`[PASS] Syntax check: ${rel}`);
}

// 2. Integration assertions
const mainJs = fs.readFileSync(path.join(root, 'main.js'), 'utf8');
const preloadJs = fs.readFileSync(path.join(root, 'preload.js'), 'utf8');
const indexHtml = fs.readFileSync(path.join(root, 'ui/index.html'), 'utf8');
const appJs = fs.readFileSync(path.join(root, 'ui/js/app.js'), 'utf8');

assert(mainJs.includes('engines["tectonic"]'), 'main.js detects tectonic.exe');
assert(mainJs.includes('useTectonic'), 'main.js routes fallback/selected compile through Tectonic');
assert(mainJs.includes('initAutoUpdater(app, mainWindow, dialog)'), 'main.js wires initAutoUpdater');
assert(preloadJs.includes('onUpdaterStatus'), 'preload.js exposes onUpdaterStatus');
assert(indexHtml.includes('<option value="tectonic">Tectonic (Built-in)</option>'), 'index.html lists Tectonic option');
assert(appJs.includes('val === "tectonic"'), 'app.js handles tectonic engine label');
console.log('[PASS] Integration checks: Tectonic fallback & auto-updater wired');

// 3. Real Tectonic compilation E2E test
assert(fs.existsSync(tecExe), `tectonic.exe not found at ${tecExe}`);
const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'texpress-tec-'));
const buildDir = path.join(tmpDir, '.build');
fs.mkdirSync(buildDir, { recursive: true });
const sampleTex = path.join(tmpDir, 'hello.tex');
fs.writeFileSync(sampleTex, [
  '\\documentclass{article}',
  '\\begin{document}',
  '\\section{Hello TeXPress}',
  'Testing Tectonic zero-setup compilation: $E = mc^2$.',
  '\\end{document}',
  ''
].join('\n'), 'utf8');

execFileSync(tecExe, [
  '-X', 'compile', 'hello.tex',
  '--outdir', buildDir,
  '--synctex',
  '--keep-intermediates',
  '--keep-logs'
], { cwd: tmpDir, stdio: 'pipe', timeout: 180000 });

const outPdf = path.join(buildDir, 'hello.pdf');
const outSync = path.join(buildDir, 'hello.synctex.gz');
assert(fs.existsSync(outPdf) && fs.statSync(outPdf).size > 1000, 'Tectonic generated valid hello.pdf');
assert(fs.existsSync(outSync), 'Tectonic generated hello.synctex.gz');
fs.rmSync(tmpDir, { recursive: true, force: true });
console.log('[PASS] Real Tectonic E2E compile generated PDF + SyncTeX');

// 4. Git hygiene check (no ignored/binary folders tracked)
const gitStatus = execSync('git status --porcelain', { cwd: root, encoding: 'utf8' });
const badEntries = gitStatus.split(/\r?\n/).filter(line =>
  /(node_modules\/|dist\/|bin\/|\.build\/|\.log$)/i.test(line)
);
assert(badEntries.length === 0, `Git hygiene failed: ${badEntries.join(', ')}`);
console.log('[PASS] Git hygiene check: no node_modules/, dist/, bin/, .build/, or *.log staged/untracked');

console.log('\nALL PRE-PUSH TESTS PASSED!');
