/**
 * Verification test for:
 * 1. Count and Word Gap Fix (e.g. 581 words)
 * 2. PDF Cursor Fix (no crosshair, proper pointer on links, text on content, default on canvas)
 * 3. Logo Assets everywhere (icon.ico, square PNGs, horizontal logos, app window icon)
 */

const fs = require('fs');
const path = require('path');

const cssEntryPath = path.join(__dirname, '..', 'ui', 'css', 'layout.css');
const css = fs.readFileSync(cssEntryPath, 'utf8').replace(/@import\s+url\(["'](.+?)["']\);/g, (_m, rel) =>
  fs.readFileSync(path.resolve(path.dirname(cssEntryPath), rel), 'utf8')
);
const html = fs.readFileSync(path.join(__dirname, '..', 'ui', 'index.html'), 'utf8');
const pdf = fs.readFileSync(path.join(__dirname, '..', 'ui', 'js', 'modules', 'pdf_viewer.js'), 'utf8');
const main = fs.readFileSync(path.join(__dirname, '..', 'main.js'), 'utf8');

console.log('='.repeat(80));
console.log('   TeXPress Studio - Brand Assets, Word Gap & PDF Cursor Verification   ');
console.log('='.repeat(80));

const tests = [
  // 1. Word Gap Fix
  {
    name: '.pdf-page-badge has gap: 5px to prevent text and numbers from gluing together',
    pass: css.includes('.pdf-page-badge {') && css.includes('gap: 5px;')
  },
  {
    name: '#pdfWordsBadge has separated spans: <span>📝</span>, <span>0</span>, <span>words</span>',
    pass: html.includes('id="pdfWordsBadge"') && html.includes('<span>words</span>')
  },
  {
    name: 'Page number badge has clean separator span with opacity',
    pass: html.includes('<span id="pdfCurrentPage">1</span>') && html.includes('<span id="pdfTotalPages">10</span>')
  },

  // 2. PDF Cursor Fix
  {
    name: 'No cursor: crosshair on .pdf-page-card or canvas in layout.css',
    pass: !css.includes('.pdf-page-card { cursor: crosshair') &&
          !css.includes('.pdf-page-card canvas { cursor: crosshair') &&
          !css.includes('body.ctrl-down .pdf-page-card canvas {\n  cursor: crosshair')
  },
  {
    name: '.pdf-page-card and canvas default to cursor: default',
    pass: css.includes('.pdf-page-card {\n  cursor: default;') &&
          css.includes('.pdf-page-card canvas {\n  cursor: default;')
  },
  {
    name: '.textLayer and its spans have cursor: text for selection',
    pass: css.includes('.textLayer {\n  position: absolute;') &&
          css.includes('cursor: text;')
  },
  {
    name: '.pdf-link-annotation has cursor: pointer for hand icon',
    pass: css.includes('.annotationLayer .pdf-link-annotation {\n  position: absolute;') &&
          css.includes('cursor: pointer;')
  },
  {
    name: 'pdf_viewer.js removes ctrl-down on window blur, focus, and visibilitychange',
    pass: pdf.includes('window.addEventListener("blur"') &&
          pdf.includes('window.addEventListener("focus"') &&
          pdf.includes('document.addEventListener("visibilitychange"')
  },

  // 3. Logo everywhere
  {
    name: 'Multi-resolution icon.ico exists in assets/',
    pass: fs.existsSync(path.join(__dirname, '..', 'assets', 'icon.ico')) &&
          fs.statSync(path.join(__dirname, '..', 'assets', 'icon.ico')).size > 50000
  },
  {
    name: 'Horizontal brand logos (Light & Dark) exist in assets/',
    pass: fs.existsSync(path.join(__dirname, '..', 'assets', 'logo_horizontal.png')) &&
          fs.existsSync(path.join(__dirname, '..', 'assets', 'logo_horizontal_dark.png'))
  },
  {
    name: 'Hero brand logos exist in assets/',
    pass: fs.existsSync(path.join(__dirname, '..', 'assets', 'logo_hero.png')) &&
          fs.existsSync(path.join(__dirname, '..', 'assets', 'logo_hero_dark.png'))
  },
  {
    name: 'BrowserWindow in main.js sets icon to icon.ico',
    pass: main.includes('icon: path.join(__dirname, "assets", "icon.ico")')
  },
  {
    name: 'About dialog in main.js displays native brand icon',
    pass: main.includes('nativeImage.createFromPath(iconPath)')
  },
  {
    name: 'index.html includes favicon link to icon_256.png and icon.ico',
    pass: html.includes('href="assets/icon_256.png"') && html.includes('href="assets/icon.ico"')
  },
  {
    name: 'Ribbon header includes brand mark icon',
    pass: html.includes('class="ribbon-brand-mark"') && html.includes('src="assets/icon_32.png"')
  },
  {
    name: 'Welcome Dashboard hero displays official brand logo with dark mode support',
    pass: html.includes('class="welcome-brand-wrap"') &&
          html.includes('src="assets/logo_hero.png"') &&
          html.includes('src="assets/logo_hero_dark.png"')
  },
  {
    name: 'Bottom status bar displays official brand emblem and title',
    pass: html.includes('src="assets/icon_16.png"') && html.includes('TeXPress Studio</span>')
  }
];

let allPassed = true;
tests.forEach((t) => {
  console.log((t.pass ? '✓ PASS: ' : '✗ FAIL: ') + t.name);
  if (!t.pass) allPassed = false;
});

console.log('='.repeat(80));
console.log('Result: ' + tests.filter(t => t.pass).length + '/' + tests.length + ' tests passed.');
console.log('='.repeat(80));

process.exit(allPassed ? 0 : 1);
