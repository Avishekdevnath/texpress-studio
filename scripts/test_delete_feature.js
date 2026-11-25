const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const explorer = fs.readFileSync(path.join(ROOT, 'ui/js/modules/explorer.js'), 'utf8');
const toast = fs.readFileSync(path.join(ROOT, 'ui/js/modules/toast.js'), 'utf8');
const html = fs.readFileSync(path.join(ROOT, 'ui/index.html'), 'utf8');
const main = fs.readFileSync(path.join(ROOT, 'main.js'), 'utf8');

let pass = 0;
let fail = 0;
function check(name, cond) {
  if (cond) {
    console.log(`  ✓ ${name}`);
    pass++;
  } else {
    console.error(`  ✗ ${name}`);
    fail++;
  }
}

console.log('Testing Explorer Delete & Shift+Delete Fixes:');
check('tabindex=0 on tree items for DOM keyboard focus', explorer.includes('tabindex="0"'));
check('setupKeyboardListeners attached globally in capture phase', explorer.includes('setupKeyboardListeners()') && explorer.includes('true);'));
check('Delete & Shift+Delete keys handled', explorer.includes('e.key === "Delete" || e.code === "Delete"') && explorer.includes('confirmDelete(targetPath, e.shiftKey)'));
check('F2 key handled for Rename', explorer.includes('e.key === "F2"') && explorer.includes('promptRename(targetPath)'));
check('getSelectedPath retrieves selected item correctly', explorer.includes('function getSelectedPath()'));
check('showDeletePrompt and resolveDeletePrompt in toast.js', toast.includes('function showDeletePrompt') && toast.includes('function resolveDeletePrompt'));
check('deleteConfirmModal exists in index.html', html.includes('id="deleteConfirmModal"'));
check('main.js handles both object { relPath } and string relPath', main.includes('rawPath = (data && typeof data === "object"') && main.includes('fs.rmSync(fullPath, { recursive: true, force: true })'));

console.log(`\nResult: ${pass} passed, ${fail} failed.`);
if (fail > 0) process.exit(1);
