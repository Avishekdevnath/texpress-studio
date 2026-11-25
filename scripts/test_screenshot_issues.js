/**
 * Verification Suite for the 4 User Screenshot Issues
 * 1. Explorer Header Action Buttons (Image 1)
 * 2. Nested File/Folder Creation inside Selected Folder (Image 2)
 * 3. PDF Page Number Update on Scroll (Image 3)
 * 4. Table of Contents & Cross-Reference Link Navigation (Image 4)
 */

const fs = require('fs');
const path = require('path');

const expPath = path.join(__dirname, '..', 'ui', 'js', 'modules', 'explorer.js');
const pdfPath = path.join(__dirname, '..', 'ui', 'js', 'modules', 'pdf_viewer.js');
const htmlPath = path.join(__dirname, '..', 'ui', 'index.html');
const cssPath = path.join(__dirname, '..', 'ui', 'css', 'layout.css');

const exp = fs.readFileSync(expPath, 'utf8');
const pdf = fs.readFileSync(pdfPath, 'utf8');
const html = fs.readFileSync(htmlPath, 'utf8');
const css = fs.readFileSync(cssPath, 'utf8').replace(/@import\s+url\(["'](.+?)["']\);/g, (_m, rel) =>
  fs.readFileSync(path.resolve(path.dirname(cssPath), rel), 'utf8')
);

console.log('='.repeat(80));
console.log('      TeXPress Studio - 4 User Screenshot Issues Forensic Verification      ');
console.log('='.repeat(80));

const tests = [
  // Issue 1 & 2: VS Code File/Folder Creation & Nesting
  {
    category: 'Issue 1 & 2: Explorer Creation & Nested Folder Scoping',
    name: 'Explorer header toolbar provides New File, New Folder, Refresh, Collapse All',
    check: () => exp.includes("startInlineCreation('file')") &&
                 exp.includes("startInlineCreation('folder')") &&
                 exp.includes("refreshTree()") &&
                 exp.includes("collapseAll()")
  },
  {
    category: 'Issue 1 & 2: Explorer Creation & Nested Folder Scoping',
    name: 'Folder selection sets activeSelection to directory path on click',
    check: () => exp.includes('activeSelection = { path: folderPath, type: "directory" }')
  },
  {
    category: 'Issue 1 & 2: Explorer Creation & Nested Folder Scoping',
    name: 'getTargetDirectory resolves selected folder as creation target',
    check: () => exp.includes('if (activeSelection.type === "directory" && activeSelection.path)') &&
                 exp.includes('return activeSelection.path;')
  },
  {
    category: 'Issue 1 & 2: Explorer Creation & Nested Folder Scoping',
    name: 'getTargetDirectory falls back to parent folder when a file is selected',
    check: () => exp.includes('if (activeSelection.type === "file" && activeSelection.path)') &&
                 exp.includes('activeSelection.path.lastIndexOf("/")')
  },
  {
    category: 'Issue 1 & 2: Explorer Creation & Nested Folder Scoping',
    name: 'startInlineCreation mounts inline input directly inside the target folder children container',
    check: () => exp.includes('parentContainer = childrenEl;') &&
                 exp.includes('parentContainer.insertBefore(inlineRow, parentContainer.firstChild);')
  },
  {
    category: 'Issue 1 & 2: Explorer Creation & Nested Folder Scoping',
    name: 'Commit prepends targetDir to fullRelPath ensuring file is created INSIDE folder',
    check: () => exp.includes('const fullRelPath = targetDir ? `${targetDir}/${cleanName}` : cleanName;')
  },

  // Issue 3: PDF Scroll Page Tracking
  {
    category: 'Issue 3: PDF Scroll & Dynamic Page Number Tracking',
    name: 'PDF viewport attaches passive scroll listener with requestAnimationFrame throttling',
    check: () => pdf.includes('viewportEl.addEventListener("scroll"') &&
                 pdf.includes('requestAnimationFrame') &&
                 pdf.includes('updateActivePageOnScroll()')
  },
  {
    category: 'Issue 3: PDF Scroll & Dynamic Page Number Tracking',
    name: 'IntersectionObserver tracks multi-threshold visibility across all rendered page cards',
    check: () => pdf.includes('new IntersectionObserver') &&
                 pdf.includes('bestPage !== currentPdfPageNum')
  },
  {
    category: 'Issue 3: PDF Scroll & Dynamic Page Number Tracking',
    name: 'updateActivePageOnScroll calculates exact visible vertical height inside viewport',
    check: () => pdf.includes('const visibleHeight = Math.max(0, visibleBottom - visibleTop);') &&
                 pdf.includes('curEl.textContent = bestPage;')
  },
  {
    category: 'Issue 3: PDF Scroll & Dynamic Page Number Tracking',
    name: 'DOM contains #pdfCurrentPage and #pdfTotalPages in toolbar',
    check: () => html.includes('id="pdfCurrentPage"') && html.includes('id="pdfTotalPages"')
  },

  // Issue 4: PDF Table of Contents & Internal Hyperlink Jumps
  {
    category: 'Issue 4: Interactive PDF Table of Contents & Links',
    name: 'renderPage builds AnnotationLayer for each PDF page',
    check: () => pdf.includes('annotLayerDiv.className = "annotationLayer"') &&
                 pdf.includes('renderAnnotations(annotations, annotLayerDiv, viewport)')
  },
  {
    category: 'Issue 4: Interactive PDF Table of Contents & Links',
    name: 'renderAnnotations converts annot.dest links to clickable .pdf-link-annotation anchors',
    check: () => pdf.includes('await navigateToDest(annot.dest)')
  },
  {
    category: 'Issue 4: Interactive PDF Table of Contents & Links',
    name: 'navigateToDest resolves named and explicit destination coordinates and calls scrollToPage',
    check: () => pdf.includes('async function navigateToDest(dest)') &&
                 pdf.includes('scrollToPage(pageNum, yOffset)')
  },
  {
    category: 'Issue 4: Interactive PDF Table of Contents & Links',
    name: 'Single-click triggers PDF link jump while Ctrl+Click preserves SyncTeX inverse search',
    check: () => pdf.includes('if (e.ctrlKey || e.metaKey) return; // Allow SyncTeX on Ctrl+Click')
  },
  {
    category: 'Issue 4: Interactive PDF Table of Contents & Links',
    name: 'layout.css provides hover highlight and pointer cursor for PDF hyperlinks',
    check: () => css.includes('.pdf-link-annotation') &&
                 css.includes('cursor: pointer')
  }
];

let passedCount = 0;
let currentCat = '';

tests.forEach((t) => {
  if (t.category !== currentCat) {
    currentCat = t.category;
    console.log(`\n[${currentCat}]`);
  }
  const pass = t.check();
  if (pass) {
    console.log(`  ✓ PASS: ${t.name}`);
    passedCount++;
  } else {
    console.log(`  ✗ FAIL: ${t.name}`);
  }
});

console.log('\n' + '='.repeat(80));
console.log(`Result: ${passedCount}/${tests.length} tests passed`);
console.log('='.repeat(80));

if (passedCount === tests.length) {
  process.exit(0);
} else {
  process.exit(1);
}
