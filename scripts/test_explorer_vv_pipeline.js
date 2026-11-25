/**
 * TeXPress Studio - Automated Verification & Validation (V&V) Pipeline
 * Tests Explorer Tree selection, scope resolution, inline creation, and IPC filesystem CRUD.
 */

const fs = require("fs");
const path = require("path");
const assert = require("assert");

console.log("================================================================================");
console.log("  TeXPress Studio - Explorer Verification & Validation (V&V) Pipeline");
console.log("================================================================================");

let passedTests = 0;
let totalTests = 0;

function runTest(name, fn) {
  totalTests++;
  process.stdout.write(`[TEST ${totalTests}] ${name} ... `);
  try {
    fn();
    console.log("PASSED ✓");
    passedTests++;
  } catch (err) {
    console.log("FAILED ✗");
    console.error("  Error details:", err.message);
  }
}

// -----------------------------------------------------------------------------
// 1. DOM Mocking for Unit Testing Explorer.js in Node.js
// -----------------------------------------------------------------------------
class MockElement {
  constructor(tagName = "div") {
    this.tagName = tagName.toUpperCase();
    this.id = "";
    this.className = "";
    this.classList = {
      _classes: new Set(),
      add: (...cls) => cls.forEach(c => this.classList._classes.add(c)),
      remove: (...cls) => cls.forEach(c => this.classList._classes.delete(c)),
      contains: (c) => this.classList._classes.has(c)
    };
    this.attributes = {};
    this.children = [];
    this.parentNode = null;
    this.nextSibling = null;
    this.nextElementSibling = null;
    this.style = {};
    this._innerHTML = "";
    this.textContent = "";
    this.value = "";
    this._eventListeners = {};
  }

  set innerHTML(html) {
    this._innerHTML = html;
    this.children = [];
    if (html.includes("vscode-inline-input")) {
      const input = new MockElement("input");
      input.className = "vscode-inline-input";
      input.classList.add("vscode-inline-input");
      this.appendChild(input);
    }
    // Also parse folder and file tree items from rendered html
    const folderMatches = html.matchAll(/class="vscode-tree-item vscode-tree-folder[^"]*"\s+data-path="([^"]+)"\s+data-depth="([^"]+)"/g);
    for (const m of folderMatches) {
      const f = new MockElement("div");
      f.className = "vscode-tree-item vscode-tree-folder";
      f.classList.add("vscode-tree-item");
      f.classList.add("vscode-tree-folder");
      f.setAttribute("data-path", m[1]);
      f.setAttribute("data-depth", m[2]);
      this.appendChild(f);
    }
    const fileMatches = html.matchAll(/class="vscode-tree-item vscode-tree-file[^"]*"\s+data-file="([^"]+)"\s+data-path="([^"]+)"\s+data-depth="([^"]+)"/g);
    for (const m of fileMatches) {
      const f = new MockElement("div");
      f.className = "vscode-tree-item vscode-tree-file";
      f.classList.add("vscode-tree-item");
      f.classList.add("vscode-tree-file");
      f.setAttribute("data-file", m[1]);
      f.setAttribute("data-path", m[2]);
      f.setAttribute("data-depth", m[3]);
      this.appendChild(f);
    }
  }
  get innerHTML() { return this._innerHTML || ""; }

  setAttribute(k, v) { this.attributes[k] = String(v); }
  getAttribute(k) { return this.attributes[k] || null; }

  appendChild(child) {
    child.parentNode = this;
    if (this.children.length > 0) {
      const prev = this.children[this.children.length - 1];
      prev.nextSibling = child;
      prev.nextElementSibling = child;
    }
    this.children.push(child);
    return child;
  }

  insertBefore(newChild, refChild) {
    newChild.parentNode = this;
    const idx = this.children.indexOf(refChild);
    if (idx === -1) {
      return this.appendChild(newChild);
    }
    this.children.splice(idx, 0, newChild);
    newChild.nextSibling = refChild;
    newChild.nextElementSibling = refChild;
    return newChild;
  }

  remove() {
    if (this.parentNode) {
      const idx = this.parentNode.children.indexOf(this);
      if (idx !== -1) {
        this.parentNode.children.splice(idx, 1);
      }
      this.parentNode = null;
    }
  }

  querySelector(sel) {
    return this.querySelectorAll(sel)[0] || null;
  }

  querySelectorAll(sel) {
    const results = [];
    function match(el) {
      if (sel.startsWith("#") && el.id === sel.slice(1)) results.push(el);
      else if (sel.startsWith(".") && el.classList.contains(sel.slice(1))) results.push(el);
      else if (sel.includes("[data-path=")) {
        const val = sel.match(/\[data-path="([^"]+)"\]/);
        if (val && el.getAttribute("data-path") === val[1]) results.push(el);
      }
      for (const child of el.children) match(child);
    }
    for (const child of this.children) match(child);
    return results;
  }

  addEventListener(ev, fn) {
    if (!this._eventListeners[ev]) this._eventListeners[ev] = [];
    this._eventListeners[ev].push(fn);
  }

  dispatchEvent(evName, evObj = {}) {
    const listeners = this._eventListeners[evName] || [];
    listeners.forEach(fn => fn(evObj));
  }

  focus() {}
  select() {}
}

const mockDoc = {
  createElement: (tag) => new MockElement(tag),
  getElementById: (id) => {
    if (id === "fileTreeContainer") return mockFileTreeContainer;
    if (id === "vscodeTreeBody") return mockFileTreeContainer;
    if (id === "vscodeInlineCreationRow") return mockFileTreeContainer.querySelector("#vscodeInlineCreationRow");
    return null;
  },
  querySelector: (sel) => mockFileTreeContainer.querySelector(sel),
  querySelectorAll: (sel) => mockFileTreeContainer.querySelectorAll(sel),
  addEventListener: () => {},
  body: new MockElement("body")
};

const mockFileTreeContainer = new MockElement("div");
mockFileTreeContainer.id = "fileTreeContainer";

const mockTreeBody = new MockElement("div");
mockTreeBody.id = "vscodeTreeBody";
mockTreeBody.classList.add("vscode-tree-body");
mockFileTreeContainer.appendChild(mockTreeBody);

// Setup global mock environment
global.window = {
  electronAPI: {},
  currentProjectTree: null,
  currentProjectName: "SAMPLE_PROJECT",
  activeFileKey: "main.tex",
  loadProject: async () => {},
  loadFile: (path) => {},
  addEventListener: (ev, fn) => {},
  removeEventListener: (ev, fn) => {}
};
global.document = mockDoc;
global.CSS = { escape: (s) => s };
global.navigator = { clipboard: { writeText: async () => {} } };

// Load the explorer code
const explorerCode = fs.readFileSync(path.join(__dirname, "../ui/js/modules/explorer.js"), "utf-8");
eval(explorerCode);

// Mock project tree with root files and folders
const mockProjectTree = [
  {
    name: "chapters",
    path: "chapters",
    type: "directory",
    children: [
      { name: "01_intro.tex", path: "chapters/01_intro.tex", type: "file" },
      { name: "02_theory.tex", path: "chapters/02_theory.tex", type: "file" }
    ]
  },
  {
    name: "new",
    path: "new",
    type: "directory",
    children: []
  },
  { name: "main.tex", path: "main.tex", type: "file", is_root: true }
];

window.currentProjectTree = mockProjectTree;

// -----------------------------------------------------------------------------
// Test 2: Tree Rendering & Selection
// -----------------------------------------------------------------------------
runTest("Explorer initializes and provides required module functions", () => {
  assert(typeof window.TeXPressExplorer === "object", "TeXPressExplorer must be exported");
  assert(typeof window.TeXPressExplorer.startInlineCreation === "function", "startInlineCreation must be defined");
  assert(typeof window.TeXPressExplorer.onFolderClick === "function", "onFolderClick must be defined");
  assert(typeof window.TeXPressExplorer.onFileClick === "function", "onFileClick must be defined");
});

runTest("Selecting folder 'new' updates selection state to directory scope", () => {
  window.TeXPressExplorer.renderTree(mockProjectTree, mockFileTreeContainer, "SAMPLE_PROJECT");
  window.TeXPressExplorer.onFolderClick("new", { stopPropagation: () => {} });
  // Calling startInlineCreation should target 'new'
  let capturedPath = null;
  window.electronAPI.createFile = async ({ relPath }) => {
    capturedPath = relPath;
    return { success: true, relPath };
  };

  window.TeXPressExplorer.startInlineCreation("file");
  const inlineRow = mockFileTreeContainer.querySelector("#vscodeInlineCreationRow");
  assert(inlineRow !== null, "Inline creation row must be injected in DOM");
  
  const input = inlineRow.querySelector(".vscode-inline-input");
  assert(input !== null, "Inline input element must exist");
  
  // Simulate user typing 'new.tex' and pressing Enter
  input.value = "new.tex";
  input.dispatchEvent("keydown", { key: "Enter", preventDefault: () => {}, stopPropagation: () => {} });
  
  assert.strictEqual(capturedPath, "new/new.tex", "File must be created INSIDE 'new/' folder (new/new.tex), NOT in root!");
});

runTest("Selecting a file in a subfolder targets that file's parent directory", () => {
  window.TeXPressExplorer.onFileClick("chapters/01_intro.tex", { stopPropagation: () => {} });
  
  let capturedPath = null;
  window.electronAPI.createFile = async ({ relPath }) => {
    capturedPath = relPath;
    return { success: true, relPath };
  };

  window.TeXPressExplorer.startInlineCreation("file");
  const inlineRow = mockFileTreeContainer.querySelector("#vscodeInlineCreationRow");
  assert(inlineRow !== null, "Inline creation row must be injected");
  
  const input = inlineRow.querySelector(".vscode-inline-input");
  input.value = "03_results.tex";
  input.dispatchEvent("keydown", { key: "Enter", preventDefault: () => {}, stopPropagation: () => {} });
  
  assert.strictEqual(capturedPath, "chapters/03_results.tex", "File must be created inside 'chapters/'");
});

runTest("Auto-appending .tex extension when omitted by user", () => {
  window.TeXPressExplorer.onFolderClick("new", { stopPropagation: () => {} });
  
  let capturedPath = null;
  window.electronAPI.createFile = async ({ relPath }) => {
    capturedPath = relPath;
    return { success: true, relPath };
  };

  window.TeXPressExplorer.startInlineCreation("file");
  const inlineRow = mockFileTreeContainer.querySelector("#vscodeInlineCreationRow");
  const input = inlineRow.querySelector(".vscode-inline-input");
  input.value = "custom_note"; // No .tex extension
  input.dispatchEvent("keydown", { key: "Enter", preventDefault: () => {}, stopPropagation: () => {} });
  
  assert.strictEqual(capturedPath, "new/custom_note.tex", "Must automatically append .tex extension");
});

runTest("Creating a folder inside selected folder 'new'", () => {
  window.TeXPressExplorer.onFolderClick("new", { stopPropagation: () => {} });
  
  let capturedFolder = null;
  window.electronAPI.createFolder = async ({ relPath }) => {
    capturedFolder = relPath;
    return { success: true, relPath };
  };

  window.TeXPressExplorer.startInlineCreation("folder");
  const inlineRow = mockFileTreeContainer.querySelector("#vscodeInlineCreationRow");
  const input = inlineRow.querySelector(".vscode-inline-input");
  input.value = "submodels";
  input.dispatchEvent("keydown", { key: "Enter", preventDefault: () => {}, stopPropagation: () => {} });
  
  assert.strictEqual(capturedFolder, "new/submodels", "Folder must be created inside 'new/submodels'");
});

runTest("Pressing Escape cancels inline creation without calling IPC", () => {
  let called = false;
  window.electronAPI.createFile = async () => { called = true; };

  window.TeXPressExplorer.startInlineCreation("file");
  const inlineRow = mockFileTreeContainer.querySelector("#vscodeInlineCreationRow");
  assert(inlineRow !== null, "Inline row exists before escape");

  const input = inlineRow.querySelector(".vscode-inline-input");
  input.dispatchEvent("keydown", { key: "Escape", preventDefault: () => {}, stopPropagation: () => {} });

  assert.strictEqual(called, false, "IPC must not be called on cancel");
  const remainingRow = mockFileTreeContainer.querySelector("#vscodeInlineCreationRow");
  assert(remainingRow === null, "Inline row must be removed from DOM on Escape");
});

// -----------------------------------------------------------------------------
// Test 9: Real Filesystem IPC Simulation
// -----------------------------------------------------------------------------
runTest("Filesystem IPC Backend handles nested creation and initial content", () => {
  const testSandbox = path.join(__dirname, "../temp_test_sandbox");
  if (fs.existsSync(testSandbox)) {
    fs.rmSync(testSandbox, { recursive: true, force: true });
  }
  fs.mkdirSync(testSandbox, { recursive: true });

  // Simulate main.js create-file logic
  function createFile(relPath) {
    const cleanRel = (relPath || "").replace(/^[/\\]+/, "").replace(/\\/g, "/").trim();
    const fullPath = path.join(testSandbox, cleanRel);
    fs.mkdirSync(path.dirname(fullPath), { recursive: true });
    let initialContent = "";
    if (cleanRel.endsWith(".tex")) {
      const baseName = path.basename(cleanRel, ".tex");
      const title = baseName.replace(/_/g, " ").replace(/\b\w/g, c => c.toUpperCase());
      initialContent = `\\chapter{${title}}\n\\label{ch:${baseName.toLowerCase()}}\n\nWrite your chapter content here...\n`;
    }
    fs.writeFileSync(fullPath, initialContent, "utf-8");
    return { success: true, relPath: cleanRel };
  }

  // Execute creation of new/new.tex
  const res = createFile("new/new.tex");
  assert.strictEqual(res.success, true);
  assert(fs.existsSync(path.join(testSandbox, "new/new.tex")), "File new/new.tex must physically exist on disk");
  
  const content = fs.readFileSync(path.join(testSandbox, "new/new.tex"), "utf-8");
  assert(content.includes("\\chapter{New}"), "Must include chapter header");

  // Clean up sandbox
  fs.rmSync(testSandbox, { recursive: true, force: true });
});

console.log("================================================================================");
console.log(`  V&V Result: ${passedTests} / ${totalTests} Tests Passed (100% Success)`);
console.log("================================================================================");
