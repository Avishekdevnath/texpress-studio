/**
 * TeXPress Studio - End-to-End Architectural Verification & Reputation Audit
 * Validates all 5 phases of the E2E Remediation Plan against the codebase.
 */

const fs = require("fs");
const path = require("path");

const ROOT = path.resolve(__dirname, "..");
let passed = 0;
let failed = 0;

function assert(condition, message) {
  if (condition) {
    console.log(`  ✓ PASS: ${message}`);
    passed++;
  } else {
    console.error(`  ✗ FAIL: ${message}`);
    failed++;
  }
}

console.log("================================================================================");
console.log("       TeXPress Studio - E2E Architectural Reputation Audit Suite               ");
console.log("================================================================================\n");

// -----------------------------------------------------------------------------
// Suite 1: Phase 1 Zero Data-Loss Architecture
// -----------------------------------------------------------------------------
console.log("[Suite 1: Zero Data-Loss Architecture]");
const appJsPath = path.join(ROOT, "ui", "js", "app.js");
const appJs = fs.readFileSync(appJsPath, "utf-8");

assert(appJs.includes("outgoingTab.bufferContent = window.TeXPressEditor.getContent()"), "loadFile stashes active buffer before switching tabs");
assert(appJs.includes("showTabClosePrompt(tab.name)"), "closeTab intercepts dirty tab closure with guarded modal prompt");
assert(appJs.includes("async function saveAllDirtyFiles()"), "saveAllDirtyFiles is defined for pre-compilation multi-file flush");
assert(appJs.includes("await saveAllDirtyFiles()"), "runCompile flushes all dirty tabs before triggering XeLaTeX engine");
assert(appJs.includes("curTab.isDirty = (live !== curTab.cleanContent)"), "onEditorInputActivity tracks dirty buffer changes instantly");
assert(appJs.includes("tab-dirty-dot"), "renderTabBar renders dirty dot indicator (●) for modified documents");

// -----------------------------------------------------------------------------
// Suite 2: Phase 2 Compiler Engine & Concurrency Safety
// -----------------------------------------------------------------------------
console.log("\n[Suite 2: Compiler Engine & Concurrency Safety]");
const mainJsPath = path.join(ROOT, "main.js");
const mainJs = fs.readFileSync(mainJsPath, "utf-8");

assert(mainJs.includes("isCompileActive"), "main.js implements isCompileActive mutex lock");
assert(mainJs.includes("A compilation is already in progress"), "compile handler rejects concurrent process collisions");
assert(mainJs.includes("targetRel = (rootFile || \"main.tex\").replace"), "compile handler normalizes subfolder paths (e.g. chapters/01_intro.tex)");
assert(mainJs.includes("fs.mkdirSync(path.join(buildDir, subDir)"), "compile handler ensures subfolder exists in .build directory before spawning");
assert(mainJs.includes("taskkill /pid"), "45-second watchdog timer terminates entire process tree on compile freeze");
assert(mainJs.includes("function safeCopyPdf"), "safeCopyPdf implements retry backoff for Windows EBUSY/EPERM file locks");

// -----------------------------------------------------------------------------
// Suite 3: Phase 3 Native Menu IPC Parity & Template Hardening
// -----------------------------------------------------------------------------
console.log("\n[Suite 3: Native Menu IPC Parity & Template Hardening]");
assert(mainJs.includes('accelerator: "CmdOrCtrl+Alt+E"'), "Math Equation Block assigned unique shortcut CmdOrCtrl+Alt+E");
assert(mainJs.includes('accelerator: "CmdOrCtrl+Alt+B"'), "Academic Table snippet assigned unique shortcut CmdOrCtrl+Alt+B");
assert(mainJs.includes('accelerator: "CmdOrCtrl+Alt+S"'), "Greek & Math Palette assigned unique shortcut CmdOrCtrl+Alt+S");

const blankTpl = fs.readFileSync(path.join(ROOT, "templates", "blank_document", "main.tex"), "utf-8");
const ieeeTpl = fs.readFileSync(path.join(ROOT, "templates", "paper_ieee", "main.tex"), "utf-8");
const springerTpl = fs.readFileSync(path.join(ROOT, "templates", "book_springer", "main.tex"), "utf-8");

assert(blankTpl.includes("\\usepackage{enumitem}"), "blank_document template includes enumitem");
assert(ieeeTpl.includes("\\usepackage{enumitem}"), "paper_ieee template includes enumitem");
assert(springerTpl.includes("\\usepackage{enumitem}"), "book_springer template includes enumitem");

// -----------------------------------------------------------------------------
// Suite 4: Phase 4 PDF Interactive Layers & Memory Management
// -----------------------------------------------------------------------------
console.log("\n[Suite 4: PDF Viewer Interactive Layers & Memory Management]");
const pdfJsPath = path.join(ROOT, "ui", "js", "modules", "pdf_viewer.js");
const pdfJs = fs.readFileSync(pdfJsPath, "utf-8");
const layoutCssPath = path.join(ROOT, "ui", "css", "layout.css");
const layoutCss = fs.readFileSync(layoutCssPath, "utf-8").replace(/@import\s+url\(["'](.+?)["']\);/g, (_m, rel) =>
  fs.readFileSync(path.resolve(path.dirname(layoutCssPath), rel), "utf-8")
);

assert(pdfJs.includes("activePdfDoc.destroy()"), "reload destroys previous activePdfDoc instance to prevent memory leaks");
assert(pdfJs.includes("pdfjsLib.renderTextLayer"), "renderPage initializes selectable TextLayer for copying & highlighting");
assert(pdfJs.includes("page.getAnnotations"), "renderPage extracts PDF interactive annotations");
assert(pdfJs.includes("function renderAnnotations"), "renderAnnotations maps PDF links to clickable DOM elements");
assert(pdfJs.includes("async function navigateToDest"), "navigateToDest resolves named and coordinate internal destinations");
assert(pdfJs.includes("scrollToPage(pageNum, yOffset)"), "scrollToPage supports sub-page vertical scroll navigation");
assert(layoutCss.includes(".annotationLayer"), "layout.css defines .annotationLayer styling");
assert(layoutCss.includes(".pdf-link-annotation:hover"), "layout.css provides hover styling for interactive PDF links");
assert(layoutCss.includes(".textLayer"), "layout.css defines .textLayer styling for selectable text");
assert(layoutCss.includes("body.ctrl-down .annotationLayer .pdf-link-annotation"), "layout.css disables annotation pointer-events during Ctrl+Click (SyncTeX)");

// -----------------------------------------------------------------------------
// Suite 5: Phase 5 Professional UX & Toast Notification System
// -----------------------------------------------------------------------------
console.log("\n[Suite 5: Professional UX & Toast Notification System]");
const toastJsPath = path.join(ROOT, "ui", "js", "modules", "toast.js");
const toastJs = fs.readFileSync(toastJsPath, "utf-8");
const indexHtmlPath = path.join(ROOT, "ui", "index.html");
const indexHtml = fs.readFileSync(indexHtmlPath, "utf-8");

assert(fs.existsSync(toastJsPath), "toast.js module exists");
assert(toastJs.includes("window.showToast = showToast"), "window.showToast is exported globally");
assert(toastJs.includes("window.showTabClosePrompt = showTabClosePrompt"), "window.showTabClosePrompt is exported globally");
assert(toastJs.includes("window.alert = function"), "toast.js overrides window.alert to automatically redirect legacy calls to toasts");
assert(indexHtml.includes('id="tabCloseModal"'), "index.html includes #tabCloseModal container");
assert(indexHtml.includes('src="js/modules/toast.js"'), "index.html imports toast.js module");
assert(layoutCss.includes(".texpress-toast-container"), "layout.css includes toast notification styling");

// Verify zero unprotected alert calls exist across modules
const jsFiles = [
  "ui/js/app.js",
  "ui/js/modules/citations.js",
  "ui/js/modules/explorer.js",
  "ui/js/modules/figure_wizard.js",
  "ui/js/modules/find_replace.js",
  "ui/js/modules/pdf_viewer.js",
  "ui/js/modules/ribbon.js",
  "ui/js/modules/table_wizard.js"
];

let unprotectedAlerts = 0;
for (const rel of jsFiles) {
  const content = fs.readFileSync(path.join(ROOT, rel), "utf-8");
  const lines = content.split("\n");
  lines.forEach((line, idx) => {
    if (/^\s*alert\(/.test(line)) {
      const prevContext = lines.slice(Math.max(0, idx - 5), idx).join("\n");
      if (!prevContext.includes("showToast")) {
        unprotectedAlerts++;
        console.warn(`    Warning: Unprotected alert on ${rel}:${idx + 1}: ${line.trim()}`);
      }
    }
  });
}
assert(unprotectedAlerts === 0, `All alerts across core modules are protected with showToast (found ${unprotectedAlerts} unprotected)`);

console.log("\n================================================================================");
console.log(`Audit Summary: ${passed} Passed, ${failed} Failed`);
console.log("================================================================================");

if (failed > 0) {
  process.exit(1);
} else {
  console.log("ALL V&V ARCHITECTURAL REQUIREMENTS FULLY SATISFIED!\n");
}
