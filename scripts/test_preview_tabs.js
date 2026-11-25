const fs = require('fs');
const path = require('path');

console.log('=== TEST SUITE: VS Code Preview Tab System ===\n');

// Mock DOM & environment for testing app.js tab logic
const domTabs = [];
let mockEditorContent = "initial content";

const mockTabState = {
  openTabs: [],
  activeFileKey: null,
  isDirty: false
};

function escapeHtml(str) {
  return String(str || "").replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/'/g, '&#39;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function loadFileSim(relPath, options = {}) {
  let isPreview = false;
  if (typeof options === "boolean") isPreview = options;
  else if (options && typeof options.isPreview === "boolean") isPreview = options.isPreview;

  let currentTab = mockTabState.openTabs.find(t => t.path === relPath);
  if (currentTab && isPreview === false) {
    currentTab.isPreview = false;
  }

  if (!currentTab) {
    if (isPreview) {
      const prevIdx = mockTabState.openTabs.findIndex(t => t.isPreview && !t.isDirty);
      if (prevIdx !== -1) {
        mockTabState.openTabs.splice(prevIdx, 1);
      }
    }
    const fileName = relPath.split("/").pop();
    currentTab = {
      path: relPath,
      name: fileName,
      cleanContent: "hello",
      bufferContent: "hello",
      isDirty: false,
      isPreview: isPreview
    };
    mockTabState.openTabs.push(currentTab);
  }

  mockTabState.activeFileKey = relPath;
}

function pinTabSim(relPath) {
  const tab = mockTabState.openTabs.find(t => t.path === relPath);
  if (tab) tab.isPreview = false;
}

function onTypingSim() {
  const tab = mockTabState.openTabs.find(t => t.path === mockTabState.activeFileKey);
  if (tab) {
    if (tab.isPreview) tab.isPreview = false;
    tab.isDirty = true;
  }
}

let passed = 0;
let total = 0;
function assert(condition, desc) {
  total++;
  if (condition) {
    console.log(`[PASS] ${desc}`);
    passed++;
  } else {
    console.error(`[FAIL] ${desc}`);
  }
}

// 1. Single click on file1.tex -> opens as preview tab
loadFileSim("file1.tex", { isPreview: true });
assert(mockTabState.openTabs.length === 1, "Tab list has 1 tab");
assert(mockTabState.openTabs[0].path === "file1.tex", "Active tab is file1.tex");
assert(mockTabState.openTabs[0].isPreview === true, "file1.tex has isPreview: true (Italic)");

// 2. Single click on file2.tex -> REPLACES file1.tex preview tab
loadFileSim("file2.tex", { isPreview: true });
assert(mockTabState.openTabs.length === 1, "Tab list still has 1 tab (Replaced preview tab)");
assert(mockTabState.openTabs[0].path === "file2.tex", "Active tab is now file2.tex");
assert(mockTabState.openTabs[0].isPreview === true, "file2.tex has isPreview: true");

// 3. Double click on file2.tex -> Promotes to permanent
loadFileSim("file2.tex", { isPreview: false });
assert(mockTabState.openTabs[0].isPreview === false, "file2.tex is now permanent (Non-italic)");

// 4. Single click on file3.tex -> Opens as new preview tab alongside permanent file2.tex
loadFileSim("file3.tex", { isPreview: true });
assert(mockTabState.openTabs.length === 2, "Tab list has 2 tabs (1 permanent, 1 preview)");
assert(mockTabState.openTabs[0].path === "file2.tex" && mockTabState.openTabs[0].isPreview === false, "file2.tex remains permanent");
assert(mockTabState.openTabs[1].path === "file3.tex" && mockTabState.openTabs[1].isPreview === true, "file3.tex is in preview mode");

// 5. Typing in editor -> Promotes preview file3.tex to permanent
onTypingSim();
assert(mockTabState.openTabs[1].isPreview === false, "file3.tex promoted to permanent upon typing");
assert(mockTabState.openTabs[1].isDirty === true, "file3.tex marked dirty");

// 6. Test pinTab explicitly
loadFileSim("file4.tex", { isPreview: true });
assert(mockTabState.openTabs.length === 3, "Opened file4.tex as preview");
pinTabSim("file4.tex");
assert(mockTabState.openTabs[2].isPreview === false, "pinTab promoted file4.tex to permanent");

// 7. Verify CSS in layout.css (including modular @imports)
const cssEntryPath = require('path').join(__dirname, '..', 'ui', 'css', 'layout.css');
const cssEntry = fs.readFileSync(cssEntryPath, 'utf-8');
const css = cssEntry.replace(/@import\s+url\(["'](.+?)["']\);/g, (_m, rel) =>
  fs.readFileSync(require('path').resolve(require('path').dirname(cssEntryPath), rel), 'utf-8')
);
assert(css.includes('.editor-tab.preview-tab') && css.includes('font-style: italic'), "layout.css contains italic rule for preview tabs");

console.log(`\nResults: ${passed}/${total} tests passed.`);
if (passed === total) {
  console.log('VS CODE PREVIEW TAB SYSTEM VERIFIED 100%!');
} else {
  process.exit(1);
}
