/**
 * TeXPress Studio - Main Application Coordinator
 * Decomposed, modular orchestrator connecting UI components and Electron IPC.
 */

// --------------------------------------------------------------------------
// 1. Global Application State
// --------------------------------------------------------------------------
const isElectron = typeof window.electronAPI !== "undefined";
window.isElectron = isElectron;
window.currentProjectName = null;
window.currentProjectTree = [];
window.activeFileKey = null;
window.openTabs = [];

let isCompiling = false;
let isAutoCompileEnabled = localStorage.getItem("texpress_auto_compile") === "true";
let autoCompileTimer = null;
let autoSaveTimer = null;
let pendingCompile = false;
let currentViewMode = "split";
let currentTheme = localStorage.getItem("texpress_theme") || "dark";
let currentFontSize = 14;

// DOM Elements Cache
let editorTextarea;
let sidebarPane;
let pdfPane;
let workspace;
let compileBtn;
let compileBtnText;
let statusCompileNotice;
let statusActiveFile;
let statusProjectName;
let statusWordCount;
let errorBanner;
let errorTitle;
let errorDesc;

// --------------------------------------------------------------------------
// 2. Application Boot & Module Initialization
// --------------------------------------------------------------------------
document.addEventListener("DOMContentLoaded", () => {
  // Cache DOM elements
  editorTextarea = document.getElementById("editorTextarea");
  sidebarPane = document.getElementById("sidebarPane");
  pdfPane = document.getElementById("pdfPane");
  workspace = document.getElementById("workspace");
  compileBtn = document.getElementById("compileBtn");
  compileBtnText = document.getElementById("compileBtnText");
  statusCompileNotice = document.getElementById("statusCompileNotice");
  statusActiveFile = document.getElementById("statusActiveFile");
  statusProjectName = document.getElementById("statusProjectName");
  statusWordCount = document.getElementById("statusWordCount");
  errorBanner = document.getElementById("errorBanner");
  errorTitle = document.getElementById("errorTitle");
  errorDesc = document.getElementById("errorDesc");

  // Apply saved theme
  applyTheme(currentTheme);
  updateAutoCompileUI();

  // Initialize Sub-Modules
  if (window.TeXPressEditor) window.TeXPressEditor.init();
  if (window.TeXPressHover) window.TeXPressHover.init();
  if (window.TeXPressSymbols) window.TeXPressSymbols.init();

  // Setup Layout & Interactivity
  setupDraggableResizers();
  setupViewModeSwitcher();
  setupGlobalShortcuts();

  // Connect Native Electron Menu IPC Events
  if (isElectron && window.electronAPI) {
    if (window.electronAPI.onMenuCompile) {
      window.electronAPI.onMenuCompile(() => runCompile());
    }
    if (window.electronAPI.onMenuSave) {
      window.electronAPI.onMenuSave(() => saveCurrentFile());
    }
    if (window.electronAPI.onMenuOpenProject) {
      window.electronAPI.onMenuOpenProject((_event, projectPath) => {
        if (projectPath) {
          loadProject();
        } else {
          triggerOpenProject();
        }
      });
    }
    if (window.electronAPI.onMenuNewProject) {
      window.electronAPI.onMenuNewProject(() => triggerCreateProject("book_springer", "My_Academic_Book"));
    }
    if (window.electronAPI.onMenuOpenSample) {
      window.electronAPI.onMenuOpenSample(() => triggerOpenSampleProject());
    }
    if (window.electronAPI.onMenuToggleExplorer) {
      window.electronAPI.onMenuToggleExplorer(() => toggleSidebar());
    }
    if (window.electronAPI.onMenuInsert) {
      window.electronAPI.onMenuInsert((type) => {
        if (window.TeXPressRibbon && typeof window.TeXPressRibbon.insertSnippet === "function") {
          window.TeXPressRibbon.insertSnippet(type);
        }
      });
    }
    if (window.electronAPI.onMenuCloseProject) {
      window.electronAPI.onMenuCloseProject(() => closeProject());
    }
    if (window.electronAPI.onMenuCloseTab) {
      window.electronAPI.onMenuCloseTab(() => closeActiveTab());
    }
    if (window.electronAPI.onMenuOpenFigureWizard) {
      window.electronAPI.onMenuOpenFigureWizard(() => {
        if (window.openFigureWizard) window.openFigureWizard();
      });
    }
    if (window.electronAPI.onMenuOpenTableWizard) {
      window.electronAPI.onMenuOpenTableWizard(() => {
        if (window.openTableWizard) window.openTableWizard();
      });
    }
    if (window.electronAPI.onMenuOpenWordCount) {
      window.electronAPI.onMenuOpenWordCount(() => {
        if (window.openWordCountModal) window.openWordCountModal();
      });
    }
    if (window.electronAPI.onMenuToggleSymbols) {
      window.electronAPI.onMenuToggleSymbols(() => {
        if (window.toggleSymbolsTab) window.toggleSymbolsTab();
      });
    }
    if (window.electronAPI.onMenuCitationPicker) {
      window.electronAPI.onMenuCitationPicker(() => {
        if (window.openCitationPicker) window.openCitationPicker();
      });
    }
    if (window.electronAPI.onMenuFindReplace) {
      window.electronAPI.onMenuFindReplace(() => {
        if (window.toggleFindReplaceBar) window.toggleFindReplaceBar(false);
      });
    }
    if (window.electronAPI.onMenuQuickCite) {
      window.electronAPI.onMenuQuickCite(() => {
        if (window.openCitationPicker) window.openCitationPicker();
      });
    }
    if (window.electronAPI.onMenuToggleWrap) {
      window.electronAPI.onMenuToggleWrap(() => {
        if (window.toggleLineWrapping) window.toggleLineWrapping();
      });
    }
    if (window.electronAPI.onMenuToggleNumbers) {
      window.electronAPI.onMenuToggleNumbers(() => {
        if (window.toggleLineNumbers) window.toggleLineNumbers();
      });
    }
    if (window.electronAPI.onMenuForwardSync) {
      window.electronAPI.onMenuForwardSync(() => {
        if (window.triggerForwardSync) window.triggerForwardSync();
      });
    }
    if (window.electronAPI.onMenuViewMode) {
      window.electronAPI.onMenuViewMode((mode) => {
        if (typeof setViewMode === "function") setViewMode(mode);
      });
    }
    if (window.electronAPI.onMenuToggleAutoCompile) {
      window.electronAPI.onMenuToggleAutoCompile(() => {
        if (typeof toggleAutoCompile === "function") toggleAutoCompile();
      });
    }
    if (window.electronAPI.onMenuSetBuildTarget) {
      window.electronAPI.onMenuSetBuildTarget((target) => {
        window.currentBuildTarget = target;
        const label = target === "auto" ? "🎯 Auto (Active Doc / Root)" : target === "active" ? "⚡ Active Tab File" : `📄 ${target}`;
        if (statusCompileNotice) {
          statusCompileNotice.textContent = `Build Target: ${label}`;
          statusCompileNotice.style.color = "var(--google-blue)";
        }
      });
    }
    if (window.electronAPI.onMenuToggleTheme) {
      window.electronAPI.onMenuToggleTheme(() => {
        if (typeof toggleTheme === "function") toggleTheme();
      });
    }
    if (window.electronAPI.onRecentProjectsUpdated) {
      window.electronAPI.onRecentProjectsUpdated((list) => {
        renderRecentProjectsList(list);
      });
    }
    if (window.electronAPI.onCheckUnsavedBeforeClose) {
      window.electronAPI.onCheckUnsavedBeforeClose(() => {
        handleBeforeWindowClose();
      });
    }
  }

  // Document Title Synchronization
  const docTitleInput = document.getElementById("docTitleInput");
  if (docTitleInput) {
    docTitleInput.addEventListener("input", (e) => {
      const val = e.target.value.trim();
      document.title = `${val || "Document"} - TeXPress Studio`;
    });
    docTitleInput.addEventListener("change", (e) => {
      const val = e.target.value.trim();
      if (!val) return;
      if (window.TeXPressEditor) {
        const content = window.TeXPressEditor.getContent();
        if (content && /\\title\{/.test(content)) {
          const updated = content.replace(/\\title\{[^}]+\}/, `\\title{\\textbf{${val}}}`);
          window.TeXPressEditor.setContent(updated, window.activeFileKey);
          saveCurrentFile();
        }
      }
    });
  }

  // Load project & recent folders on boot
  loadProject();
  loadRecentProjectsUI();
});

// --------------------------------------------------------------------------
// 3. Project State & File System Management
// --------------------------------------------------------------------------
function extractBookTitle(content, fallbackName) {
  if (content) {
    const titleIdx = content.indexOf("\\title{");
    if (titleIdx !== -1) {
      let depth = 0;
      let raw = "";
      const start = titleIdx + 7;
      for (let i = start; i < content.length; i++) {
        const char = content[i];
        if (char === "{") {
          depth++;
          raw += char;
        } else if (char === "}") {
          if (depth === 0) break;
          depth--;
          raw += char;
        } else {
          raw += char;
        }
      }
      let cleaned = raw
        .replace(/\\textbf\{([^}]+)\}/g, "$1")
        .replace(/\\textit\{([^}]+)\}/g, "$1")
        .replace(/\\textmd\{([^}]+)\}/g, "$1")
        .replace(/\\Huge|\\huge|\\LARGE|\\Large|\\large|\\normalsize|\\small|\\bfseries/g, "")
        .replace(/\\\\.*/s, "")
        .replace(/[{}]/g, "")
        .replace(/\s+/g, " ")
        .trim();
      if (cleaned) return cleaned;
    }
  }
  if (fallbackName) {
    return fallbackName.replace(/_/g, " ").replace(/-/g, " ");
  }
  return "Academic Document";
}

function updateDocumentTitle(title) {
  const titleInput = document.getElementById("docTitleInput");
  if (titleInput && title) {
    titleInput.value = title;
  }
  document.title = (title && title !== "Academic Document")
    ? `${title} - TeXPress Studio`
    : "TeXPress Studio - Academic Publishing Suite";
}
async function loadProject() {
  try {
    let projectData = { isProjectOpen: false, projectName: null, files: [], tree: [] };

    if (isElectron && window.electronAPI && window.electronAPI.getProject) {
      projectData = await window.electronAPI.getProject();
    } else {
      const res = await fetch("/api/project");
      projectData = await res.json();
    }

    const emptyState = document.getElementById("sidebarEmptyState");
    const fileTree = document.getElementById("fileTreeContainer");
    const tabBar = document.getElementById("sidebarTabBar");
    const outlineBox = document.getElementById("outlineBox");
    const welcomeDashboard = document.getElementById("welcomeDashboard");
    const editorWorkspace = document.getElementById("editorWorkspace");
    const imageViewer = document.getElementById("imageViewerContainer");
    const editorTabHeader = document.getElementById("editorTabHeader");

    if (!projectData.isProjectOpen) {
      window.currentProjectName = null;
      window.currentProjectPath = null;
      window.currentProjectTree = [];
      window.activeFileKey = null;
      window.openTabs = [];
      renderTabBar();

      if (welcomeDashboard) welcomeDashboard.style.display = "flex";
      if (editorWorkspace) editorWorkspace.style.display = "none";
      if (imageViewer) imageViewer.style.display = "none";
      const pdfTabViewer = document.getElementById("pdfTabViewerContainer");
      if (pdfTabViewer) pdfTabViewer.style.display = "none";
      const emptyEditorState = document.getElementById("editorEmptyState");
      if (emptyEditorState) emptyEditorState.style.display = "none";
      if (editorTabHeader) editorTabHeader.style.display = "none";

      if (emptyState) emptyState.style.display = "flex";
      if (fileTree) fileTree.style.display = "none";
      if (tabBar) tabBar.style.display = "none";
      if (outlineBox) outlineBox.style.display = "none";

      if (statusProjectName) statusProjectName.textContent = "No Project Open";
      if (statusActiveFile) statusActiveFile.textContent = "";
      if (statusCompileNotice) {
        statusCompileNotice.textContent = "Ready";
        statusCompileNotice.style.color = "var(--text-muted)";
      }

      if (window.TeXPressEditor) window.TeXPressEditor.setContent("", null);
      if (window.TeXPressPDF) window.TeXPressPDF.reload();
      return;
    }

    // Detect project switch / import and isolate open tabs from previous project
    const nextProjectKey = projectData.projectPath || projectData.projectName;
    const isProjectSwitched = (window.currentProjectPath !== nextProjectKey);
    if (isProjectSwitched) {
      window.openTabs = [];
      window.activeFileKey = null;
      window.activeImageDataUri = null;
      window.activeImageRelPath = null;
      if (window.TeXPressEditor) window.TeXPressEditor.setContent("", null);
      renderTabBar();
    }

    // Project is open
    window.currentProjectName = projectData.projectName;
    window.currentProjectPath = nextProjectKey;
    window.currentProjectTree = projectData.tree || [];

    if (welcomeDashboard) welcomeDashboard.style.display = "none";
    if (editorTabHeader) editorTabHeader.style.display = "flex";
    if (emptyState) emptyState.style.display = "none";
    if (fileTree) fileTree.style.display = "block";
    if (tabBar) tabBar.style.display = "flex";

    // Update Header & Status Bar
    if (statusProjectName) statusProjectName.textContent = projectData.projectName;
    const initialTitle = extractBookTitle(null, projectData.projectName);
    updateDocumentTitle(initialTitle);

    if (statusCompileNotice) {
      statusCompileNotice.textContent = "Ready to Build";
      statusCompileNotice.style.color = "var(--text-success)";
    }

    // Render VS Code Style Hierarchical Explorer
    if (window.TeXPressExplorer) {
      window.TeXPressExplorer.renderTree(window.currentProjectTree, fileTree, projectData.projectName);
    }

    // Determine default file to open (main.tex or first available file)
    let fileToOpen = null;
    if (projectData.files && projectData.files.length > 0) {
      const paths = projectData.files.map(f => (typeof f === "string" ? f : f.path));
      fileToOpen = paths.includes("main.tex") ? "main.tex" : paths[0];
    }
    if (fileToOpen) {
      await loadFile(fileToOpen, { isPreview: true });
    } else {
      renderTabBar();
    }

    // Load Bibliography References
    if (window.TeXPressCitations) {
      window.TeXPressCitations.loadCitations();
    }

    // Refresh PDF.js Preview
    if (window.TeXPressPDF) {
      window.TeXPressPDF.reload();
    }

    // Refresh Multi-Root and Multi-PDF selectors
    await refreshDocumentRootsList();
    await refreshProjectPdfsList();
  } catch (err) {
    console.error("Failed to load project state:", err);
  }
}

function isBinaryTabPath(relPath, fileType) {
  if (fileType === "pdf" || fileType === "image") return true;
  return /\.(pdf|png|jpg|jpeg|svg|webp|gif|bmp)$/i.test(String(relPath || ""));
}

async function loadFile(relPath, options = {}) {
  if (!relPath) return;
  if (typeof relPath === "object" && !relPath.path && !relPath.name) {
    return;
  }
  let isPreview = false;
  if (typeof options === "boolean") {
    isPreview = options;
  } else if (options && typeof options.isPreview === "boolean") {
    isPreview = options.isPreview;
  }
  if (typeof relPath === "object") {
    if (typeof relPath.isPreview === "boolean") isPreview = relPath.isPreview;
    relPath = relPath.path || relPath.name || "";
    if (!relPath) return;
  }
  relPath = String(relPath).replace(/\\/g, "/");

  // Zero Data-Loss: Stash departing tab buffer content & cursor/scroll state before switching (text tabs only)
  if (window.activeFileKey && window.TeXPressEditor) {
    const outgoingTab = (window.openTabs || []).find(t => t.path === window.activeFileKey);
    if (outgoingTab && !isBinaryTabPath(outgoingTab.path, outgoingTab.fileType)) {
      outgoingTab.bufferContent = window.TeXPressEditor.getContent();
      outgoingTab.isDirty = (outgoingTab.bufferContent !== outgoingTab.cleanContent);
      if (typeof window.TeXPressEditor.getViewState === "function") {
        outgoingTab.viewState = window.TeXPressEditor.getViewState();
      }
    }
  }

    const welcomeDashboard = document.getElementById("welcomeDashboard");
    const editorWorkspace = document.getElementById("editorWorkspace");
    const imageViewer = document.getElementById("imageViewerContainer");
    const pdfTabViewer = document.getElementById("pdfTabViewerContainer");
    const emptyEditorState = document.getElementById("editorEmptyState");
    const editorTabHeader = document.getElementById("editorTabHeader");

  // Always dismiss welcome dashboard & empty watermark when loading a project file
  if (welcomeDashboard) welcomeDashboard.style.display = "none";
  if (emptyEditorState) emptyEditorState.style.display = "none";
  if (editorTabHeader) editorTabHeader.style.display = "flex";

  try {
    window.openTabs = window.openTabs || [];
    let currentTab = window.openTabs.find(t => t.path === relPath);

    // If double-clicked / explicitly opened permanent, promote existing preview tab:
    if (currentTab && isPreview === false) {
      currentTab.isPreview = false;
    }

    let fileContent = "";
    let fileType = "";

    // If tab already exists in memory and holds a live buffer, restore from buffer!
    if (currentTab && typeof currentTab.bufferContent === "string") {
      fileContent = currentTab.bufferContent;
      fileType = currentTab.fileType || currentTab.ext || "tex";
    } else {
      let fileData;
      if (isElectron && window.electronAPI && window.electronAPI.readFile) {
        fileData = await window.electronAPI.readFile(relPath);
      } else {
        const res = await fetch(`/api/file?path=${encodeURIComponent(relPath)}`);
        fileData = await res.json();
      }

      if (!fileData || fileData.error) {
        console.error(fileData ? fileData.error : "Failed to load file");
        return;
      }

      fileContent = fileData.content || "";
      fileType = fileData.fileType || "";

      if (currentTab) {
        currentTab.cleanContent = fileContent;
        currentTab.bufferContent = fileContent;
        currentTab.isDirty = false;
      } else {
        const fileName = relPath.split("/").pop();
        const ext = fileName.includes(".") ? fileName.split(".").pop().toLowerCase() : "tex";

        // VS Code Preview Mode:
        // If single-clicked as preview (isPreview === true), replace any existing clean preview tab
        if (isPreview) {
          const prevIdx = window.openTabs.findIndex(t => t.isPreview && !t.isDirty);
          if (prevIdx !== -1) {
            window.openTabs.splice(prevIdx, 1);
          }
        }

        currentTab = {
          path: relPath,
          name: fileName,
          ext: ext,
          fileType: fileType || ext,
          cleanContent: fileContent,
          bufferContent: fileContent,
          isDirty: false,
          isPreview: isPreview
        };
        window.openTabs.push(currentTab);
      }
    }

    window.activeFileKey = relPath;
    renderTabBar();

    // 1. Image Files (.png, .jpg, .jpeg, .svg, .webp, .gif)
    if (fileType === "image" || /\.(png|jpg|jpeg|svg|webp|gif)$/i.test(relPath)) {
      if (editorWorkspace) editorWorkspace.style.display = "none";
      if (pdfTabViewer) pdfTabViewer.style.display = "none";
      if (imageViewer) imageViewer.style.display = "flex";

      let imgDataUri = (typeof fileData !== "undefined" && fileData.dataUri) ? fileData.dataUri : "";
      if (!imgDataUri && isElectron && window.electronAPI && window.electronAPI.readFile) {
        const reRead = await window.electronAPI.readFile(relPath);
        if (reRead && reRead.dataUri) imgDataUri = reRead.dataUri;
      }

      const imgEl = document.getElementById("imageViewerImg");
      const nameEl = document.getElementById("imageViewerName");
      const metaEl = document.getElementById("imageViewerMeta");

      if (imgEl && imgDataUri) imgEl.src = imgDataUri;
      if (nameEl) nameEl.textContent = relPath.split("/").pop();
      window.activeImageDataUri = imgDataUri;
      window.activeImageRelPath = relPath;
      updateContextUIForTab("image");
    }
    // 2. PDF Files (.pdf)
    else if (fileType === "pdf" || relPath.toLowerCase().endsWith(".pdf")) {
      if (imageViewer) imageViewer.style.display = "none";
      if (editorWorkspace) editorWorkspace.style.display = "none";
      if (pdfTabViewer) pdfTabViewer.style.display = "flex";
      updateContextUIForTab("pdf");

      let pdfDataUri = (typeof fileData !== "undefined" && fileData.dataUri) ? fileData.dataUri : "";
      await renderPdfInEditorPane(relPath, pdfDataUri);

      if (window.TeXPressPDF) {
        await window.TeXPressPDF.loadPdf(relPath);
      }
    }
    // 3. Text Files (.tex, .bib, .md, .txt, .sty, .cls)
    else {
      if (imageViewer) imageViewer.style.display = "none";
      if (pdfTabViewer) pdfTabViewer.style.display = "none";
      if (editorWorkspace) editorWorkspace.style.display = "flex";
      updateContextUIForTab("text");

      if (window.TeXPressEditor) {
        window.TeXPressEditor.setContent(fileContent, relPath, currentTab ? currentTab.viewState : null);
        setTimeout(() => {
          const cm = window.TeXPressEditor.getCm();
          if (cm) cm.refresh();
        }, 30);
      } else if (editorTextarea) {
        editorTextarea.value = fileContent;
      }

      // Update Outline Navigator
      if (window.TeXPressEditor) {
        window.TeXPressEditor.updateOutlineTree();
      }

      // Update Word Count in Status Bar
      if (window.TeXPressWordCount) {
        window.TeXPressWordCount.updateStatusBarWordCount();
      }

      // Extract true title from \title{...} for main.tex or any standalone .tex document
      if (fileContent && (relPath === "main.tex" || fileContent.includes("\\title{"))) {
        const bookTitle = extractBookTitle(fileContent, window.currentProjectName);
        updateDocumentTitle(bookTitle);
      }
    }

    // Update Status Bar & Tab Header
    if (statusActiveFile) {
      statusActiveFile.textContent = `${window.currentProjectName} / ${relPath}`;
    }
    const docActiveTabName = document.getElementById("docActiveTabName");
    if (docActiveTabName) {
      docActiveTabName.textContent = relPath;
    }
    const activeTabTitle = document.getElementById("activeTabTitle");
    if (activeTabTitle) {
      activeTabTitle.textContent = relPath;
    }

    // Re-render Explorer to show active file highlight
    const fileTree = document.getElementById("fileTreeContainer");
    if (window.TeXPressExplorer && fileTree && window.currentProjectTree) {
      window.TeXPressExplorer.renderTree(window.currentProjectTree, fileTree, window.currentProjectName);
    }
  } catch (err) {
    console.error(`Failed to load file ${relPath}:`, err);
  }
}

// --------------------------------------------------------------------------
// Multi-File Tab Management (VS Code Standard with Zero Data Loss)
// --------------------------------------------------------------------------
async function closeTab(relPath, e) {
  if (e) {
    e.stopPropagation();
    e.preventDefault();
  }
  window.openTabs = window.openTabs || [];
  const idx = window.openTabs.findIndex(t => t.path === relPath);
  if (idx === -1) return;

  const tab = window.openTabs[idx];

  // Capture live editor buffer if closing the currently active text tab
  if (window.activeFileKey === relPath && window.TeXPressEditor && !isBinaryTabPath(tab.path, tab.fileType)) {
    tab.bufferContent = window.TeXPressEditor.getContent();
    tab.isDirty = (tab.bufferContent !== tab.cleanContent);
  }

  // Guard against closing modified files without saving
  if (tab.isDirty) {
    let choice = "dontsave";
    if (typeof window.showTabClosePrompt === "function") {
      choice = await window.showTabClosePrompt(tab.name);
    } else {
      const ok = confirm(`Do you want to save the changes you made to "${tab.name}" before closing?`);
      choice = ok ? "save" : "dontsave";
    }

    if (choice === "cancel") {
      return; // Cancel closure
    }

    if (choice === "save") {
      if (isElectron && window.electronAPI && window.electronAPI.saveFile) {
        await window.electronAPI.saveFile({ path: tab.path, content: tab.bufferContent });
      }
      tab.cleanContent = tab.bufferContent;
      tab.isDirty = false;
    }
  }

  const wasActive = window.activeFileKey === relPath;
  window.openTabs.splice(idx, 1);

  if (wasActive) {
    if (window.openTabs.length > 0) {
      const nextIdx = Math.min(idx, window.openTabs.length - 1);
      const nextTab = window.openTabs[nextIdx];
      loadFile(nextTab.path, { isPreview: !!nextTab.isPreview });
    } else {
      window.activeFileKey = null;
      if (window.TeXPressEditor) {
        window.TeXPressEditor.setContent("", "");
      }
      const editorWorkspace = document.getElementById("editorWorkspace");
      const imageViewer = document.getElementById("imageViewerContainer");
      const pdfTabViewer = document.getElementById("pdfTabViewerContainer");
      const emptyEditorState = document.getElementById("editorEmptyState");
      if (editorWorkspace) editorWorkspace.style.display = "none";
      if (imageViewer) imageViewer.style.display = "none";
      if (pdfTabViewer) pdfTabViewer.style.display = "none";
      if (emptyEditorState) emptyEditorState.style.display = "flex";
      updateContextUIForTab("empty");
      renderTabBar();
    }
  } else {
    renderTabBar();
  }
}

function closeActiveTab() {
  if (window.activeFileKey) {
    closeTab(window.activeFileKey);
  }
}

function pinTab(relPath, e) {
  if (e) {
    e.stopPropagation();
    e.preventDefault();
  }
  if (!relPath) relPath = window.activeFileKey;
  if (!relPath) return;
  const tab = (window.openTabs || []).find(t => t.path === relPath);
  if (tab && tab.isPreview) {
    tab.isPreview = false;
    renderTabBar();
  }
}

function renderTabBar() {
  const strip = document.getElementById("editorTabStrip");
  if (!strip) return;

  if (!window.openTabs || window.openTabs.length === 0) {
    strip.innerHTML = '<span style="font-size: 11px; color: var(--text-muted); padding: 0 12px; display: inline-flex; align-items: center; height: 100%;">No open files</span>';
    return;
  }

  strip.innerHTML = window.openTabs.map(t => {
    const isActive = t.path === window.activeFileKey;
    let iconColor = "#60a5fa";
    let iconSvg = `<svg width="13" height="13" viewBox="0 0 16 16" fill="${iconColor}"><path d="M4 1h5.5L13 4.5V14a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V2a1 1 0 0 1 1-1zm5 1v3h3L9 2z"/></svg>`;
    if (t.path.endsWith(".bib")) {
      iconColor = "#f59e0b";
      iconSvg = `<svg width="13" height="13" viewBox="0 0 16 16" fill="${iconColor}"><path d="M3 2a1 1 0 0 1 1-1h8a1 1 0 0 1 1 1v12.5l-5-3-5 3V2z"/></svg>`;
    } else if (/\.(png|jpg|jpeg|svg|webp|gif)$/i.test(t.path)) {
      iconColor = "#c084fc";
      iconSvg = `<svg width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="${iconColor}" stroke-width="1.4"><rect x="2" y="2.5" width="12" height="11" rx="1.5"/><circle cx="5.5" cy="6" r="1"/><path d="M2.5 11.5l3.5-3.5 2.5 2.5 2-2 3 3"/></svg>`;
    } else if (t.path.endsWith(".pdf")) {
      iconColor = "#f87171";
      iconSvg = `<svg width="13" height="13" viewBox="0 0 16 16" fill="${iconColor}"><path d="M4 1h5.5L13 4.5V14a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V2a1 1 0 0 1 1-1zm5 1v3h3L9 2zM5.5 9h5v1h-5V9zm0 2h3.5v1h-3.5v-1z"/></svg>`;
    } else if (t.path.endsWith(".sty") || t.path.endsWith(".cls")) {
      iconColor = "#94a3b8";
      iconSvg = `<svg width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="${iconColor}" stroke-width="1.4"><circle cx="8" cy="8" r="2.2"/><path d="M8 2v1.5M8 12.5V14M2 8h1.5M12.5 8H14M3.8 3.8l1 1M11.2 11.2l1 1M12.2 3.8l-1 1M4.8 11.2l-1 1"/></svg>`;
    }

    const dirtyDot = t.isDirty ? '<span class="tab-dirty-dot" title="Unsaved changes">●</span>' : '';
    const previewClass = t.isPreview ? 'preview-tab' : '';
    const previewHint = t.isPreview ? ' (Preview - Double-click or edit to keep open)' : '';
    const pinBtn = t.isPreview ? `<button class="tab-pin-btn" onclick="pinTab('${escapeHtml(t.path)}', event)" title="Keep Open (Pin Tab)"><svg width="11" height="11" viewBox="0 0 16 16" fill="currentColor"><path d="M9.828.722a.5.5 0 0 1 .354.146l4.95 4.95a.5.5 0 0 1 0 .707c-.48.48-1.072.588-1.503.588-.177 0-.335-.018-.46-.039l-3.134 3.134a5.927 5.927 0 0 1 .16 1.013c.046.702-.032 1.687-.72 2.375a.5.5 0 0 1-.707 0l-2.829-2.828-3.182 3.182c-.195.195-1.219.902-1.414.707-.195-.195.512-1.22.707-1.414l3.182-3.182-2.828-2.829a.5.5 0 0 1 0-.707c.688-.688 1.673-.767 2.375-.72a5.922 5.922 0 0 1 1.013.16l3.134-3.133a2.772 2.772 0 0 1-.04-.461c0-.43.108-1.022.589-1.503a.5.5 0 0 1 .353-.146z"/></svg></button>` : '';

    return `
      <div class="editor-tab ${isActive ? 'active' : ''} ${t.isDirty ? 'dirty' : ''} ${previewClass}" 
           onclick="loadFile('${escapeHtml(t.path)}', { isPreview: ${!!t.isPreview} })" 
           ondblclick="pinTab('${escapeHtml(t.path)}', event)" 
           title="${escapeHtml(t.path)}${previewHint}">
        <span class="tab-icon">${iconSvg}</span>
        <span class="tab-title ${t.isPreview ? 'preview-title' : ''}">${escapeHtml(t.name)}</span>
        ${pinBtn}
        ${dirtyDot}
        <button class="tab-close-btn" onclick="closeTab('${escapeHtml(t.path)}', event)" title="Close ${escapeHtml(t.name)} (Ctrl+W)">✕</button>
      </div>
    `;
  }).join("");

  const activeEl = strip.querySelector(".editor-tab.active");
  if (activeEl) {
    activeEl.scrollIntoView({ behavior: "smooth", inline: "nearest" });
  }
}

function escapeHtml(str) {
  return String(str || "").replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/'/g, '&#39;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

window.pinTab = pinTab;
window.closeTab = closeTab;
window.closeActiveTab = closeActiveTab;
window.renderTabBar = renderTabBar;

async function saveCurrentFile(showNotice = true) {
  if (!window.activeFileKey || !window.currentProjectName) return;

  const activeTab = (window.openTabs || []).find(t => t.path === window.activeFileKey);
  if (isBinaryTabPath(window.activeFileKey, activeTab && activeTab.fileType)) {
    if (showNotice && statusCompileNotice) {
      statusCompileNotice.textContent = "Read-only preview (binary file)";
      statusCompileNotice.style.color = "var(--text-muted)";
    }
    return;
  }

  try {
    const content = window.TeXPressEditor
      ? window.TeXPressEditor.getContent()
      : (editorTextarea ? editorTextarea.value : "");

    if (isElectron && window.electronAPI && window.electronAPI.saveFile) {
      await window.electronAPI.saveFile({ path: window.activeFileKey, content });
    } else {
      await fetch("/api/file", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ path: window.activeFileKey, content })
      });
    }

    const curTab = (window.openTabs || []).find(t => t.path === window.activeFileKey);
    if (curTab) {
      curTab.cleanContent = content;
      curTab.bufferContent = content;
      curTab.isDirty = false;
      curTab.isPreview = false; // Promote preview tab to permanent upon save
      renderTabBar();
    }

    if (window.activeFileKey.endsWith(".tex")) {
      refreshDocumentRootsList();
    }

    if (showNotice) {
      if (window.showToast) {
        window.showToast(`Saved ${window.activeFileKey}`, "success", 2000);
      } else if (statusCompileNotice) {
        statusCompileNotice.textContent = `✓ Saved ${window.activeFileKey}`;
        statusCompileNotice.style.color = "var(--text-success)";
      }
    }
  } catch (err) {
    console.error("Save error:", err);
  }
}

async function saveAllDirtyFiles() {
  if (window.activeFileKey && window.TeXPressEditor) {
    const curTab = (window.openTabs || []).find(t => t.path === window.activeFileKey);
    if (curTab && !isBinaryTabPath(curTab.path, curTab.fileType)) {
      curTab.bufferContent = window.TeXPressEditor.getContent();
      curTab.isDirty = (curTab.bufferContent !== curTab.cleanContent);
    }
  }
  const dirtyTabs = (window.openTabs || []).filter(t => t.isDirty && !isBinaryTabPath(t.path, t.fileType));
  for (const tab of dirtyTabs) {
    try {
      if (isElectron && window.electronAPI && window.electronAPI.saveFile) {
        await window.electronAPI.saveFile({ path: tab.path, content: tab.bufferContent });
      } else {
        await fetch("/api/file", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ path: tab.path, content: tab.bufferContent })
        });
      }
      tab.cleanContent = tab.bufferContent;
      tab.isDirty = false;
    } catch (e) {
      console.warn("Failed to auto-save tab:", tab.path, e);
    }
  }
  if (dirtyTabs.length > 0) {
    renderTabBar();
  }
}

async function triggerCreateProject(template = "book_springer", defaultName = "My_Academic_Book") {
  let projName = defaultName;
  if (typeof window.showQuickInput === "function") {
    projName = await window.showQuickInput({
      title: "<span>📘 New LaTeX Project</span>",
      label: "Enter project folder name:",
      placeholder: defaultName,
      defaultValue: defaultName,
      confirmText: "Create Project"
    });
  } else {
    projName = prompt("Enter project name:", defaultName);
  }
  if (!projName || !projName.trim()) return;

  if (isElectron && window.electronAPI && window.electronAPI.createProject) {
    const res = await window.electronAPI.createProject({ templateName: template, projectName: projName.trim() });
    if (res && res.success) {
      if (window.showToast) window.showToast(`Project created: ${projName.trim()}`, "success");
      await loadProject();
    } else {
      if (window.showToast) window.showToast(res.error || "Failed to create project", "error");
    }
  }
}
window.triggerCreateProject = triggerCreateProject;
window.saveAllDirtyFiles = saveAllDirtyFiles;

// --------------------------------------------------------------------------
// Multi-Root Document & Multi-PDF Management
// --------------------------------------------------------------------------
window.currentBuildTarget = "auto";
window.currentLatexEngine = "auto";

function onBuildTargetChange(val) {
  window.currentBuildTarget = val;
  if (statusCompileNotice) {
    const label = val === "auto" ? "Smart Auto-Detect" : val;
    statusCompileNotice.textContent = `Target Document: ${label}`;
    statusCompileNotice.style.color = "var(--text-primary)";
  }
}

function onLatexEngineChanged(val) {
  window.currentLatexEngine = val;
  if (statusCompileNotice) {
    const label = val === "auto" ? "⚡ Auto-Detect (Optimal)" : (val === "pdflatex" ? "pdfLaTeX (Fast)" : "XeLaTeX (Unicode)");
    statusCompileNotice.textContent = `Compiler Engine: ${label}`;
    statusCompileNotice.style.color = "var(--text-primary)";
  }
}

function resolveBuildTarget() {
  const select = document.getElementById("buildTargetSelect");
  const selectedVal = select ? select.value : (window.currentBuildTarget || "auto");
  if (selectedVal === "active") {
    if (window.activeFileKey && window.activeFileKey.endsWith(".tex")) {
      return window.activeFileKey;
    }
  }
  if (selectedVal && selectedVal !== "auto") {
    return selectedVal;
  }
  // Smart Auto-Detect:
  // 1. If active file is a standalone LaTeX document (contains \documentclass), compile it!
  const activeContent = window.TeXPressEditor ? window.TeXPressEditor.getContent() : "";
  if (window.activeFileKey && window.activeFileKey.endsWith(".tex") && activeContent.includes("\\documentclass")) {
    return window.activeFileKey;
  }
  // 2. If project has discovered standalone roots, use the primary standalone root!
  if (select && select.options.length > 1) {
    for (let i = 1; i < select.options.length; i++) {
      const optVal = select.options[i].value;
      if (optVal && optVal !== "auto" && optVal !== "active") {
        return optVal;
      }
    }
  }
  return window.activeFileKey || "main.tex";
}

async function refreshDocumentRootsList() {
  const select = document.getElementById("buildTargetSelect");
  if (!select) return;
  const currentVal = select.value || "auto";

  let roots = [];
  if (isElectron && window.electronAPI && window.electronAPI.getStandaloneRoots) {
    const res = await window.electronAPI.getStandaloneRoots();
    if (res && res.success && res.roots) {
      roots = res.roots;
    }
  }

  select.innerHTML = "";
  const autoOpt = document.createElement("option");
  autoOpt.value = "auto";
  autoOpt.textContent = "🎯 Auto (Active Doc)";
  select.appendChild(autoOpt);

  if (roots.length > 0) {
    for (const r of roots) {
      const opt = document.createElement("option");
      opt.value = r.relPath;
      opt.textContent = r.name + (r.isMain ? " (Master)" : "");
      select.appendChild(opt);
    }
  } else {
    const mainOpt = document.createElement("option");
    mainOpt.value = "main.tex";
    mainOpt.textContent = "main.tex (Master)";
    select.appendChild(mainOpt);
  }

  let found = false;
  for (let i = 0; i < select.options.length; i++) {
    if (select.options[i].value === currentVal) {
      select.value = currentVal;
      found = true;
      break;
    }
  }
  if (!found) select.value = "auto";
}

async function refreshProjectPdfsList() {
  const select = document.getElementById("pdfTargetSelect");
  if (!select) return;

  let currentVal = window.TeXPressPDF ? window.TeXPressPDF.getCurrentPdf() : "main.pdf";

  let pdfs = [];
  if (isElectron && window.electronAPI && window.electronAPI.getProjectPdfs) {
    const res = await window.electronAPI.getProjectPdfs();
    if (res && res.success && res.pdfs) {
      pdfs = res.pdfs;
    }
  }

  select.innerHTML = "";
  if (pdfs.length > 0) {
    for (const p of pdfs) {
      const opt = document.createElement("option");
      opt.value = p.relPath;
      opt.textContent = p.name + (p.isMain ? " (Main)" : "");
      select.appendChild(opt);
    }
  } else {
    const opt = document.createElement("option");
    opt.value = "main.pdf";
    opt.textContent = "main.pdf";
    select.appendChild(opt);
  }

  let found = false;
  for (let i = 0; i < select.options.length; i++) {
    if (select.options[i].value === currentVal) {
      select.value = currentVal;
      found = true;
      break;
    }
  }
  if (!found && select.options.length > 0) {
    select.value = select.options[0].value;
  }
}

function onBuildTargetChange(val) {
  if (statusCompileNotice) {
    const label = val === "auto" ? "Smart Auto-Detect" : val;
    statusCompileNotice.textContent = `Target Document: ${label}`;
    statusCompileNotice.style.color = "var(--text-primary)";
  }
}

async function switchPdfTarget(pdfRelPath) {
  if (window.TeXPressPDF) {
    await window.TeXPressPDF.loadPdf(pdfRelPath);
  }
}

window.compileSpecificFile = async function(targetRelPath) {
  window.currentBuildTarget = targetRelPath;
  const select = document.getElementById("buildTargetSelect");
  if (select) {
    let exists = false;
    for (let i = 0; i < select.options.length; i++) {
      if (select.options[i].value === targetRelPath) {
        exists = true;
        break;
      }
    }
    if (!exists) {
      const opt = document.createElement("option");
      opt.value = targetRelPath;
      opt.textContent = targetRelPath.split("/").pop();
      select.appendChild(opt);
    }
    select.value = targetRelPath;
  }
  await runCompile(false);
};

window.setAsMasterRoot = function(targetRelPath) {
  window.currentBuildTarget = targetRelPath;
  const select = document.getElementById("buildTargetSelect");
  if (select) {
    select.value = targetRelPath;
  }
  if (statusCompileNotice) {
    statusCompileNotice.textContent = `🎯 Build target pinned to: ${targetRelPath}`;
    statusCompileNotice.style.color = "var(--text-success)";
  }
};

window.viewPdfInPane = async function(targetRelPath) {
  await loadFile(targetRelPath);
};

window.openPdfExternally = function(targetRelPath) {
  if (window.electronAPI && window.electronAPI.exportPdf) {
    window.electronAPI.exportPdf(targetRelPath);
  }
};

// --------------------------------------------------------------------------
// Bidirectional SyncTeX Navigation (PDF <-> Source Code)
// --------------------------------------------------------------------------
window.jumpToSourceLine = async function(file, line, column) {
  if (!file) return;

  const targetRel = file.replace(/\\/g, "/");

  // If different file than currently open, load and switch tab (preserve preview state)
  if (window.activeFileKey !== targetRel) {
    const existingTab = (window.openTabs || []).find(t => t.path === targetRel);
    await loadFile(targetRel, { isPreview: existingTab ? !!existingTab.isPreview : true });
  }

  // If currently in PDF-only view mode, switch to split mode so editor is visible
  if (typeof setViewMode === "function" && document.body.dataset.viewMode === "pdf") {
    setViewMode("split");
  }

  if (window.TeXPressEditor && window.TeXPressEditor.jumpToLineAndPulse) {
    window.TeXPressEditor.jumpToLineAndPulse(line, column || 1);
  }

  if (statusCompileNotice) {
    const fileName = targetRel.split("/").pop();
    statusCompileNotice.textContent = `📍 SyncTeX: ${fileName}:${line}`;
    statusCompileNotice.style.color = "var(--google-blue)";
  }
};

window.triggerForwardSync = async function() {
  if (!window.activeFileKey || !window.electronAPI || !window.electronAPI.synctexForward) return;
  const cm = window.TeXPressEditor ? window.TeXPressEditor.getCm() : null;
  if (!cm) return;

  const cur = cm.getCursor();
  const line = cur.line + 1;
  const col = cur.ch + 1;

  const activePdf = window.TeXPressPDF ? window.TeXPressPDF.getCurrentPdf() : "main.pdf";

  try {
    const res = await window.electronAPI.synctexForward({
      file: window.activeFileKey,
      line: line,
      column: col,
      pdfFile: activePdf
    });

    if (res && res.success && res.page) {
      if (window.TeXPressPDF && window.TeXPressPDF.showPdfSyncMarker) {
        window.TeXPressPDF.showPdfSyncMarker(res.page, res.x, res.y, res.width, res.height);
      }
      if (statusCompileNotice) {
        statusCompileNotice.textContent = `📍 Synced to Page ${res.page} in ${activePdf}`;
        statusCompileNotice.style.color = "var(--google-blue)";
      }
    }
  } catch (err) {
    console.warn("Forward SyncTeX error:", err);
  }
};

window.switchPdfTarget = switchPdfTarget;
window.onBuildTargetChange = onBuildTargetChange;
window.refreshProjectPdfsList = refreshProjectPdfsList;
window.refreshDocumentRootsList = refreshDocumentRootsList;

// --------------------------------------------------------------------------
// 4. Compilation Pipeline & Auto-Compile Engine
// --------------------------------------------------------------------------
async function runCompile(isAuto = false) {
  if (!window.currentProjectName) {
    if (!isAuto) {
      if (typeof window.showToast === "function") {
        window.showToast("Please open or create a project first before compiling.", "warning");
      } else {
        alert("Please open or create a project first before compiling.");
      }
    }
    return;
  }
  if (isCompiling) {
    if (isAuto) pendingCompile = true;
    return;
  }
  isCompiling = true;

  const engineSelect = document.getElementById("latexEngineSelect");
  const selectedEngine = engineSelect ? engineSelect.value : (window.currentLatexEngine || "auto");
  const targetRoot = resolveBuildTarget();

  if (compileBtn) compileBtn.classList.add("compiling");
  if (compileBtnText) compileBtnText.textContent = "Compiling...";
  if (statusCompileNotice) {
    const engineDesc = selectedEngine === "auto" ? "Optimal Engine (Auto)" : (selectedEngine === "pdflatex" ? "pdfLaTeX" : "XeLaTeX");
    statusCompileNotice.textContent = isAuto ? `⚡ Auto-compiling (${engineDesc})...` : `Building with ${engineDesc}...`;
    statusCompileNotice.style.color = "var(--text-warning)";
  }

  // Pre-Compilation Multi-File Flush: Commit all dirty tabs so compiler reads up-to-date sources
  await saveAllDirtyFiles();

  // VS Code Parity: Compiling promotes active preview tab to permanent!
  if (window.activeFileKey) {
    const activeTab = (window.openTabs || []).find(t => t.path === window.activeFileKey);
    if (activeTab && activeTab.isPreview) {
      activeTab.isPreview = false;
      renderTabBar();
    }
  }

  const payload = {
    rootFile: targetRoot,
    engine: selectedEngine,
    activeFile: window.activeFileKey,
    content: window.TeXPressEditor
      ? window.TeXPressEditor.getContent()
      : (editorTextarea ? editorTextarea.value : "")
  };

  const startTime = performance.now();

  try {
    let result;
    if (isElectron && window.electronAPI && window.electronAPI.compile) {
      result = await window.electronAPI.compile(payload);
    } else {
      const res = await fetch("/api/compile", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });
      result = await res.json();
    }

    const elapsed = ((performance.now() - startTime) / 1000).toFixed(2);

    if (result.success) {
      const docLabel = targetRoot.split("/").pop();
      const engineTag = result.engineUsed === "pdflatex" ? "pdfLaTeX" : (result.engineUsed === "xelatex" ? "XeLaTeX" : (result.engineUsed || "LaTeX"));
      const bibTag = result.bibtexRan ? " + BibTeX" : "";
      if (statusCompileNotice) {
        statusCompileNotice.textContent = `✓ Built ${docLabel} with ${engineTag}${bibTag} (${elapsed}s)`;
        statusCompileNotice.style.color = "var(--text-success)";
      }
      if (!isAuto && typeof window.showToast === "function") {
        window.showToast(`✓ Built ${docLabel} with ${engineTag}${bibTag} in ${elapsed}s`, "success", 2800);
      }
      dismissError();
      if (window.TeXPressEditor) {
        window.TeXPressEditor.clearCompilationErrors();
      }
      // Load the generated target PDF
      const generatedPdf = result.pdfFile || (targetRoot.replace(/\.tex$/i, ".pdf").split("/").pop());
      if (window.TeXPressPDF) {
        await window.TeXPressPDF.loadPdf(generatedPdf);
      }
      // Refresh PDF target dropdown
      await refreshProjectPdfsList();
    } else {
      if (statusCompileNotice) {
        statusCompileNotice.textContent = "⚠ Compilation Failed";
        statusCompileNotice.style.color = "var(--text-danger)";
      }
      if (window.TeXPressEditor) {
        window.TeXPressEditor.markCompilationErrors(result.diagnostics, window.activeFileKey);
      }
      if (!isAuto) {
        displayErrors(result.diagnostics, result.error);
      } else {
        if (result.diagnostics && result.diagnostics.length > 0) {
          const first = result.diagnostics[0];
          statusCompileNotice.textContent = `⚠ ${first.title}` + (first.line ? ` (L${first.line})` : "");
        }
      }
    }
  } catch (err) {
    console.error("Compile error:", err);
    if (statusCompileNotice) {
      statusCompileNotice.textContent = "Engine error: " + err.message;
      statusCompileNotice.style.color = "var(--text-danger)";
    }
  } finally {
    isCompiling = false;
    if (compileBtn) compileBtn.classList.remove("compiling");
    if (compileBtnText) compileBtnText.innerHTML = 'Compile <span class="compile-badge-f5">F5</span>';

    // If an auto-compile arrived while busy, run it cleanly once
    if (pendingCompile) {
      pendingCompile = false;
      setTimeout(() => runCompile(true), 400);
    }
  }
}

function onEditorInputActivity() {
  // Check dirty state immediately so the tab dot renders without waiting for auto-save
  if (window.activeFileKey && window.TeXPressEditor) {
    const curTab = (window.openTabs || []).find(t => t.path === window.activeFileKey);
    if (curTab) {
      let rerender = false;
      // VS Code Parity: Typing any character in editor promotes preview tab to permanent!
      if (curTab.isPreview) {
        curTab.isPreview = false;
        rerender = true;
      }
      const live = window.TeXPressEditor.getContent();
      const wasDirty = curTab.isDirty;
      curTab.bufferContent = live;
      curTab.isDirty = (live !== curTab.cleanContent);
      if (wasDirty !== curTab.isDirty || rerender) {
        renderTabBar();
      }
      // Immediately register in Target Document dropdown as soon as \documentclass is typed
      if (window.activeFileKey.endsWith(".tex") && live.includes("\\documentclass")) {
        const select = document.getElementById("buildTargetSelect");
        if (select && !Array.from(select.options).some(opt => opt.value === window.activeFileKey)) {
          const opt = document.createElement("option");
          opt.value = window.activeFileKey;
          opt.textContent = window.activeFileKey.split("/").pop();
          select.appendChild(opt);
        }
      }
    }
  }

  // 1. Silent debounced auto-save (800ms)
  clearTimeout(autoSaveTimer);
  autoSaveTimer = setTimeout(() => {
    saveCurrentFile(false);
  }, 800);

  // 2. Debounced auto-compile (2500ms pause)
  if (isAutoCompileEnabled && window.currentProjectName) {
    clearTimeout(autoCompileTimer);
    autoCompileTimer = setTimeout(() => {
      triggerAutoCompile();
    }, 2500);
  }
}

function triggerAutoCompile() {
  if (!window.currentProjectName) return;
  if (isCompiling) {
    pendingCompile = true;
    return;
  }
  runCompile(true);
}

function toggleAutoCompile() {
  isAutoCompileEnabled = !isAutoCompileEnabled;
  localStorage.setItem("texpress_auto_compile", isAutoCompileEnabled ? "true" : "false");
  updateAutoCompileUI();
  const btn = document.getElementById("btnAutoCompile");
  if (btn) btn.blur();
  if (isAutoCompileEnabled) {
    if (statusCompileNotice) {
      statusCompileNotice.textContent = "⚡ Auto-compile ON (auto-builds 2.5s after typing pauses)";
      statusCompileNotice.style.color = "var(--text-success)";
    }
    triggerAutoCompile();
  } else {
    clearTimeout(autoCompileTimer);
    if (statusCompileNotice) {
      statusCompileNotice.textContent = "Auto-compile paused";
      statusCompileNotice.style.color = "var(--text-muted)";
    }
  }
}

function updateAutoCompileUI() {
  const btn = document.getElementById("btnAutoCompile");
  const txt = document.getElementById("autoCompileText");
  if (!btn) return;
  btn.classList.toggle("active", isAutoCompileEnabled);
  if (txt) {
    txt.textContent = isAutoCompileEnabled ? "Auto: ON" : "Auto: OFF";
  }
  btn.title = isAutoCompileEnabled
    ? "Auto-compile is ON (automatically saves and builds 2.5s after typing pauses)"
    : "Auto-compile is OFF (click to enable automatic builds on typing pause)";
}

// --------------------------------------------------------------------------
// 5. Error Diagnostics Banner & Quick Fix
// --------------------------------------------------------------------------
function displayErrors(diagnostics, fallbackError) {
  if (!errorBanner) return;
  errorBanner.classList.add("show");

  if (diagnostics && diagnostics.length > 0) {
    const first = diagnostics[0];
    if (errorTitle) {
      errorTitle.innerHTML = `<span>${first.title + (first.line ? ` (Line ${first.line})` : "")}</span>` +
        (first.line ? ` <button class="btn-jump-error" onclick="TeXPressEditor.scrollToLine(${parseInt(first.line, 10) - 1})" style="margin-left: 10px; font-size: 11px; padding: 2px 8px; border-radius: 4px; background: rgba(255,255,255,0.25); border: 1px solid rgba(255,255,255,0.5); color: white; cursor: pointer; font-weight: 600;">Jump to Line</button>` : "");
    }
    if (errorDesc) {
      errorDesc.innerHTML = first.message;
    }
  } else {
    if (errorTitle) errorTitle.textContent = "LaTeX Compilation Error";
    if (errorDesc) {
      errorDesc.textContent = fallbackError || "Syntax error detected. Review compiler output.";
    }
  }
}

function dismissError() {
  if (errorBanner) errorBanner.classList.remove("show");
}

function simulateError() {
  displayErrors([{
    title: "Unescaped Special Character (%)",
    line: 12,
    message: "Found an unescaped <code>%</code> symbol. In LaTeX, percent signs indicate comments. Use <code>\\%</code> to print a literal percent sign."
  }]);
}

function autoFixError() {
  dismissError();
  runCompile();
}

// --------------------------------------------------------------------------
// 6. Project Open / Close / Sample Actions
// --------------------------------------------------------------------------
async function triggerOpenProject() {
  if (isElectron && window.electronAPI && window.electronAPI.openProjectDialog) {
    const res = await window.electronAPI.openProjectDialog();
    if (res && res.success) {
      await loadProject();
    }
  } else {
    if (typeof window.showToast === "function") {
      window.showToast("Project opening is available in the desktop application.", "info");
    } else {
      alert("Project opening is available in the desktop application.");
    }
  }
}

async function triggerOpenSampleProject() {
  if (isElectron && window.electronAPI && window.electronAPI.openSampleProject) {
    const res = await window.electronAPI.openSampleProject();
    if (res && res.success) {
      await loadProject();
    }
  } else {
    await fetch("/api/project/open-sample", { method: "POST" });
    await loadProject();
  }
}

async function closeProject() {
  if (isElectron && window.electronAPI && window.electronAPI.closeProject) {
    await window.electronAPI.closeProject();
  } else {
    await fetch("/api/project/close", { method: "POST" });
  }
  await loadProject();
}

// --------------------------------------------------------------------------
// 7. Workspace Resizers & Layout Modes
// --------------------------------------------------------------------------
function setupDraggableResizers() {
  const resizerSidebar = document.getElementById("resizerSidebar");
  const resizerPdf = document.getElementById("resizerPdf");
  if (!resizerSidebar || !resizerPdf) return;

  let isResizingSidebar = false;
  resizerSidebar.addEventListener("mousedown", () => {
    isResizingSidebar = true;
    resizerSidebar.classList.add("dragging");
    document.body.style.cursor = "col-resize";
  });

  let isResizingPdf = false;
  resizerPdf.addEventListener("mousedown", () => {
    isResizingPdf = true;
    resizerPdf.classList.add("dragging");
    document.body.style.cursor = "col-resize";
  });

  document.addEventListener("mousemove", (e) => {
    if (isResizingSidebar && sidebarPane) {
      const newWidth = Math.max(160, Math.min(e.clientX, 450));
      sidebarPane.style.width = newWidth + "px";
    }

    if (isResizingPdf && pdfPane && workspace) {
      const containerWidth = workspace.getBoundingClientRect().width;
      const newPdfWidth = Math.max(260, Math.min(containerWidth - e.clientX, containerWidth * 0.75));
      pdfPane.style.flex = "none";
      pdfPane.style.width = newPdfWidth + "px";
    }
  });

  document.addEventListener("mouseup", () => {
    if (isResizingSidebar || isResizingPdf) {
      const wasPdfResize = isResizingPdf;
      isResizingSidebar = false;
      isResizingPdf = false;
      resizerSidebar.classList.remove("dragging");
      resizerPdf.classList.remove("dragging");
      document.body.style.cursor = "default";
      if (wasPdfResize && window.TeXPressPDF) {
        window.TeXPressPDF.renderAllPages();
      }
    }
  });
}

function setupViewModeSwitcher() {
  const buttons = document.querySelectorAll(".btn-view-mode");
  buttons.forEach(btn => {
    btn.addEventListener("click", () => {
      setViewMode(btn.dataset.view);
    });
  });
}

function setViewMode(mode) {
  currentViewMode = mode;
  if (!workspace) return;
  workspace.classList.remove("view-split", "view-editor", "view-pdf");
  workspace.classList.add(`view-${mode}`);

  document.querySelectorAll(".btn-view-mode").forEach(btn => {
    btn.classList.toggle("active", btn.dataset.view === mode);
  });
}

function toggleSidebar() {
  if (sidebarPane) {
    sidebarPane.classList.toggle("drawer-open");
  }
}

// --------------------------------------------------------------------------
// 8. Shortcuts, Theme & Font Size Controls
// --------------------------------------------------------------------------
function setupGlobalShortcuts() {
  window.addEventListener("keydown", (e) => {
    // F5 Compile
    if (e.key === "F5") {
      e.preventDefault();
      runCompile();
      return;
    }
    // Ctrl+S Save
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "s") {
      e.preventDefault();
      saveCurrentFile();
      return;
    }
    // Ctrl+W Close Active Tab
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "w") {
      e.preventDefault();
      closeActiveTab();
      return;
    }
  });
}

function applyTheme(theme) {
  currentTheme = theme;
  document.documentElement.setAttribute("data-theme", theme);
  document.body.classList.toggle("theme-dark", theme === "dark");
  localStorage.setItem("texpress_theme", theme);
  
  // Synchronize OS-level window frame and native menus with dark/light mode
  if (window.electronAPI && window.electronAPI.setNativeTheme) {
    window.electronAPI.setNativeTheme(theme);
  }
  
  const themeIcon = document.getElementById("themeToggleIcon");
  const themeText = document.getElementById("themeToggleText");
  const themeBtn = document.getElementById("btnToggleTheme");
  if (themeIcon) themeIcon.textContent = theme === "dark" ? "☀️" : "🌙";
  if (themeText) themeText.textContent = theme === "dark" ? "Light" : "Dark";
  if (themeBtn) {
    themeBtn.title = theme === "dark" ? "Switch to Light Mode" : "Switch to Dark Mode";
    themeBtn.blur();
  }
}

function toggleTheme() {
  const newTheme = currentTheme === "dark" ? "light" : "dark";
  applyTheme(newTheme);
}

function changeFontSize(delta) {
  currentFontSize = Math.max(10, Math.min(26, currentFontSize + delta));
  const cm = window.TeXPressEditor ? window.TeXPressEditor.getCm() : null;
  if (cm) {
    cm.getWrapperElement().style.fontSize = `${currentFontSize}px`;
    cm.refresh();
  }
  if (editorTextarea) {
    editorTextarea.style.fontSize = `${currentFontSize}px`;
  }
  const display = document.getElementById("fontSizeDisplay");
  if (display) {
    display.textContent = `${currentFontSize}px`;
  }
}

function copyImageLatexCode() {
  const rel = window.activeImageRelPath || "figures/figure.png";
  const slug = rel.replace(/\.[^/.]+$/, "").replace(/[^a-zA-Z0-9_-]/g, "_").toLowerCase();
  const code = `\\begin{figure}[htbp]\n  \\centering\n  \\includegraphics[width=0.8\\textwidth]{${rel}}\n  \\caption{Sample Figure Caption}\n  \\label{fig:${slug}}\n\\end{figure}`;
  navigator.clipboard.writeText(code).then(() => {
    if (typeof window.showToast === "function") {
      window.showToast("LaTeX figure code copied to clipboard!", "success");
    } else {
      alert("✓ LaTeX figure code copied to clipboard:\n" + code);
    }
  });
}

function openFigureWizardForActiveImage() {
  if (window.openFigureWizard) {
    window.openFigureWizard();
    const rel = window.activeImageRelPath;
    if (rel && window.activeImageDataUri) {
      const img = document.getElementById("figurePreviewImg");
      const placeholder = document.getElementById("figurePreviewPlaceholder");
      if (img && placeholder) {
        img.src = window.activeImageDataUri;
        img.style.display = "block";
        placeholder.style.display = "none";
      }
      const fnEl = document.getElementById("figureSelectedFileName");
      if (fnEl) {
        fnEl.textContent = `✓ Active Image: ${rel}`;
        fnEl.style.color = "var(--text-success)";
      }
      const labelEl = document.getElementById("figureLabelInput");
      if (labelEl) {
        labelEl.value = `fig:${rel.replace(/\.[^/.]+$/, "").replace(/[^a-zA-Z0-9_-]/g, "_").toLowerCase()}`;
      }
      if (window.TeXPressFigure) {
        window.TeXPressFigure.updateFigurePreview();
      }
    }
  }
}

function applyStyleSelection(val) {
  if (!val || val === "normal") return;
  if (window.formatSelection) {
    window.formatSelection(val);
  }
  const select = document.getElementById("styleSelect");
  if (select) select.value = "normal";
}

function applyDocZoom(scale) {
  const paper = document.getElementById("paperSheet");
  if (!paper) return;
  paper.style.transform = `scale(${scale})`;
  paper.style.transformOrigin = "top center";
}

// Universal Quick Input Modal API (Cross-Platform Electron Replacement for window.prompt)
window.showQuickInput = function({ title, label, placeholder, defaultValue, confirmText }) {
  return new Promise((resolve) => {
    const modal = document.getElementById("quickInputModal");
    const titleEl = document.getElementById("quickInputTitle");
    const labelEl = document.getElementById("quickInputLabel");
    const inputEl = document.getElementById("quickInputField");
    const confirmBtn = document.getElementById("quickInputConfirmBtn");

    if (!modal || !inputEl) {
      resolve(null);
      return;
    }

    if (titleEl) titleEl.innerHTML = title || "<span>Input</span>";
    if (labelEl) labelEl.textContent = label || "Enter value:";
    if (confirmBtn) confirmBtn.textContent = confirmText || "OK";
    inputEl.placeholder = placeholder || "";
    inputEl.value = defaultValue || "";

    modal.style.display = "flex";
    setTimeout(() => {
      inputEl.focus();
      inputEl.select();
    }, 50);

    function cleanup() {
      modal.style.display = "none";
      window._quickInputResolve = null;
      inputEl.onkeydown = null;
    }

    window._quickInputResolve = (val) => {
      cleanup();
      resolve(val);
    };

    window.closeQuickInputModal = () => {
      cleanup();
      resolve(null);
    };

    window.submitQuickInputModal = () => {
      const val = inputEl.value;
      cleanup();
      resolve(val);
    };

    inputEl.onkeydown = (e) => {
      if (e.key === "Enter") {
        e.preventDefault();
        window.submitQuickInputModal();
      } else if (e.key === "Escape") {
        e.preventDefault();
        window.closeQuickInputModal();
      }
    };
  });
};

// Expose Core Functions Globally
window.applyStyleSelection = applyStyleSelection;
window.applyDocZoom = applyDocZoom;
window.loadProject = loadProject;
window.loadFile = loadFile;
window.saveCurrentFile = saveCurrentFile;
window.runCompile = runCompile;
window.triggerOpenProject = triggerOpenProject;
window.triggerOpenSampleProject = triggerOpenSampleProject;
let pdfTabRenderSeq = 0;
async function renderPdfInEditorPane(relPath, preloadedDataUri = "") {
  const seq = ++pdfTabRenderSeq;
  window.activeTabPdfRelPath = relPath;

  const nameEl = document.getElementById("pdfTabViewerName");
  const metaEl = document.getElementById("pdfTabViewerMeta");
  const canvasWrap = document.getElementById("pdfTabViewerCanvas");
  if (nameEl) nameEl.textContent = relPath.split("/").pop();
  if (metaEl) metaEl.textContent = "Loading PDF...";
  if (!canvasWrap) return;
  canvasWrap.innerHTML = "";

  try {
    let dataUri = preloadedDataUri;
    if (!dataUri && isElectron && window.electronAPI && window.electronAPI.readFile) {
      const reRead = await window.electronAPI.readFile(relPath);
      if (reRead && reRead.dataUri) dataUri = reRead.dataUri;
    }
    if (seq !== pdfTabRenderSeq) return;

    let uint8 = null;
    if (dataUri && dataUri.includes(",")) {
      const b64 = dataUri.split(",")[1];
      const raw = atob(b64);
      uint8 = new Uint8Array(raw.length);
      for (let i = 0; i < raw.length; i++) uint8[i] = raw.charCodeAt(i);
    } else if (isElectron && window.electronAPI && window.electronAPI.getPdfBase64) {
      const res = await window.electronAPI.getPdfBase64(relPath);
      if (res && res.success && res.base64) {
        const raw = atob(res.base64);
        uint8 = new Uint8Array(raw.length);
        for (let i = 0; i < raw.length; i++) uint8[i] = raw.charCodeAt(i);
      }
    }

    if (!uint8 || typeof pdfjsLib === "undefined") {
      if (metaEl) metaEl.textContent = "Preview unavailable";
      return;
    }

    const pdfDoc = await pdfjsLib.getDocument({ data: uint8 }).promise;
    if (seq !== pdfTabRenderSeq) return;

    if (metaEl) {
      metaEl.textContent = `${pdfDoc.numPages} page${pdfDoc.numPages === 1 ? "" : "s"}`;
    }

    const availableWidth = Math.max(canvasWrap.clientWidth - 48, 320);
    const dpr = window.devicePixelRatio || 1;

    for (let num = 1; num <= pdfDoc.numPages; num++) {
      if (seq !== pdfTabRenderSeq) return;
      const page = await pdfDoc.getPage(num);
      const unscaled = page.getViewport({ scale: 1.0 });
      const scale = Math.min(availableWidth / unscaled.width, 2.0);
      const viewport = page.getViewport({ scale });

      const canvas = document.createElement("canvas");
      canvas.className = "pdf-tab-page-canvas";
      canvas.width = Math.floor(viewport.width * dpr);
      canvas.height = Math.floor(viewport.height * dpr);
      canvas.style.width = `${Math.floor(viewport.width)}px`;
      canvas.style.height = `${Math.floor(viewport.height)}px`;

      const ctx = canvas.getContext("2d");
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      canvasWrap.appendChild(canvas);

      await page.render({ canvasContext: ctx, viewport }).promise;
    }
  } catch (err) {
    console.warn("Failed to render PDF in editor tab:", err);
    if (metaEl) metaEl.textContent = "Failed to load PDF";
  }
}

function openActiveTabPdfExternal() {
  if (window.activeTabPdfRelPath && isElectron && window.electronAPI && window.electronAPI.openPdfExternal) {
    window.electronAPI.openPdfExternal(window.activeTabPdfRelPath);
  }
}
window.openActiveTabPdfExternal = openActiveTabPdfExternal;

window.closeProject = closeProject;
window.triggerCloseProject = closeProject;
window.dismissError = dismissError;
window.simulateError = simulateError;
window.autoFixError = autoFixError;
window.setViewMode = setViewMode;
window.toggleSidebar = toggleSidebar;
window.toggleTheme = toggleTheme;
window.changeFontSize = changeFontSize;
window.toggleAutoCompile = toggleAutoCompile;
window.onEditorInputActivity = onEditorInputActivity;
window.copyImageLatexCode = copyImageLatexCode;
window.openFigureWizardForActiveImage = openFigureWizardForActiveImage;
window.onLatexEngineChanged = onLatexEngineChanged;
window.onBuildTargetChange = onBuildTargetChange;

// --------------------------------------------------------------------------
// Context-Aware Status Bar & Ribbon Accuracy + Ctrl+P Quick Open
// --------------------------------------------------------------------------
function updateContextUIForTab(mode) {
  const isText = (mode === "text");
  const cursorEl = document.getElementById("statusCursorPos");
  const linesEl = document.getElementById("statusTotalLines");
  const wordEl = document.getElementById("statusWordCount");

  if (cursorEl) {
    if (mode === "pdf") cursorEl.textContent = "PDF Preview";
    else if (mode === "image") cursorEl.textContent = "Image Preview";
    else if (mode === "empty") cursorEl.textContent = "No File";
  }
  if (!isText) {
    if (linesEl) linesEl.textContent = "";
    if (wordEl && mode !== "text") wordEl.textContent = mode === "pdf" ? "Read-only PDF" : mode === "image" ? "Read-only Image" : "0 words";
  }

  const textOnlySelectors = [
    "#styleSelect",
    "button[onclick*=\"formatSelection\"]",
    "button[onclick*=\"toggleComment\"]",
    "button[onclick*=\"insertSnippet\"]",
    "button[onclick*=\"openFigureWizard\"]",
    "button[onclick*=\"openTableWizard\"]",
    "button[onclick*=\"openCitationPicker\"]"
  ];
  textOnlySelectors.forEach(sel => {
    document.querySelectorAll(sel).forEach(el => {
      el.classList.toggle("is-disabled", !isText);
    });
  });
}

let quickOpenSelectedIndex = 0;
let quickOpenFilteredFiles = [];

function flattenProjectFiles(nodes, out = []) {
  for (const n of (nodes || [])) {
    if (n.type === "directory") {
      flattenProjectFiles(n.children || [], out);
    } else if (n.path) {
      out.push({ name: n.name || n.path.split("/").pop(), path: n.path });
    }
  }
  return out;
}

function renderQuickOpenList(query = "") {
  const listEl = document.getElementById("quickOpenList");
  if (!listEl) return;
  const q = query.trim().toLowerCase();
  const all = flattenProjectFiles(window.currentProjectTree || []);
  quickOpenFilteredFiles = q
    ? all.filter(f => f.name.toLowerCase().includes(q) || f.path.toLowerCase().includes(q))
    : all;

  if (quickOpenSelectedIndex >= quickOpenFilteredFiles.length) {
    quickOpenSelectedIndex = Math.max(0, quickOpenFilteredFiles.length - 1);
  }

  if (quickOpenFilteredFiles.length === 0) {
    listEl.innerHTML = `<div style="padding: 16px; text-align: center; color: var(--text-muted); font-size: 12px;">No matching files</div>`;
    return;
  }

  listEl.innerHTML = quickOpenFilteredFiles.slice(0, 40).map((f, i) => `
    <div class="quick-open-item ${i === quickOpenSelectedIndex ? 'selected' : ''}" onclick="selectQuickOpenFile('${escapeHtml(f.path)}')">
      <span style="font-weight: 500;">${escapeHtml(f.name)}</span>
      <span class="quick-open-item-path">${escapeHtml(f.path)}</span>
    </div>
  `).join("");
}

function openQuickOpenModal() {
  if (!window.currentProjectName) return;
  const overlay = document.getElementById("quickOpenOverlay");
  const input = document.getElementById("quickOpenInput");
  if (!overlay || !input) return;

  quickOpenSelectedIndex = 0;
  input.value = "";
  overlay.style.display = "flex";
  renderQuickOpenList("");
  input.focus();

  input.oninput = () => {
    quickOpenSelectedIndex = 0;
    renderQuickOpenList(input.value);
  };
  input.onkeydown = (e) => {
    if (e.key === "Escape") {
      e.preventDefault();
      closeQuickOpenModal();
    } else if (e.key === "ArrowDown") {
      e.preventDefault();
      if (quickOpenFilteredFiles.length > 0) {
        quickOpenSelectedIndex = (quickOpenSelectedIndex + 1) % Math.min(quickOpenFilteredFiles.length, 40);
        renderQuickOpenList(input.value);
      }
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      if (quickOpenFilteredFiles.length > 0) {
        const len = Math.min(quickOpenFilteredFiles.length, 40);
        quickOpenSelectedIndex = (quickOpenSelectedIndex - 1 + len) % len;
        renderQuickOpenList(input.value);
      }
    } else if (e.key === "Enter") {
      e.preventDefault();
      const target = quickOpenFilteredFiles[quickOpenSelectedIndex];
      if (target) {
        selectQuickOpenFile(target.path, !(e.ctrlKey || e.metaKey));
      }
    }
  };
}

function closeQuickOpenModal() {
  const overlay = document.getElementById("quickOpenOverlay");
  if (overlay) overlay.style.display = "none";
}

function selectQuickOpenFile(relPath, isPreview = true) {
  closeQuickOpenModal();
  loadFile(relPath, { isPreview });
}

window.openQuickOpenModal = openQuickOpenModal;
window.closeQuickOpenModal = closeQuickOpenModal;
window.selectQuickOpenFile = selectQuickOpenFile;
window.updateContextUIForTab = updateContextUIForTab;

window.addEventListener("keydown", (e) => {
  if ((e.ctrlKey || e.metaKey) && !e.shiftKey && !e.altKey && (e.key === "p" || e.key === "P")) {
    e.preventDefault();
    openQuickOpenModal();
  }
});

// --------------------------------------------------------------------------
// Recent Projects Dashboard & Unsaved-Changes Exit Guard
// --------------------------------------------------------------------------
function renderRecentProjectsList(list) {
  const section = document.getElementById("welcomeRecentSection");
  const container = document.getElementById("welcomeRecentList");
  if (!section || !container) return;

  if (!Array.isArray(list) || list.length === 0) {
    section.style.display = "none";
    container.innerHTML = "";
    return;
  }

  section.style.display = "block";
  container.innerHTML = list.map(item => `
    <div class="welcome-recent-item" onclick="openRecentProjectPath('${escapeHtml(item.path).replace(/\\/g, "\\\\")}')" title="${escapeHtml(item.path)}">
      <span class="welcome-recent-name">${escapeHtml(item.name)}</span>
      <span class="welcome-recent-path">${escapeHtml(item.path)}</span>
    </div>
  `).join("");
}

async function loadRecentProjectsUI() {
  if (!isElectron || !window.electronAPI || !window.electronAPI.getRecentProjects) return;
  try {
    const list = await window.electronAPI.getRecentProjects();
    renderRecentProjectsList(list);
  } catch (e) {}
}

async function openRecentProjectPath(dirPath) {
  if (!dirPath || !isElectron || !window.electronAPI || !window.electronAPI.openRecentProject) return;
  const res = await window.electronAPI.openRecentProject(dirPath);
  if (res && res.success) {
    await loadProject();
  } else if (window.showToast) {
    window.showToast((res && res.error) || "Could not open recent folder", "error");
    loadRecentProjectsUI();
  }
}

async function clearRecentProjectsUI() {
  if (!isElectron || !window.electronAPI || !window.electronAPI.clearRecentProjects) return;
  await window.electronAPI.clearRecentProjects();
  renderRecentProjectsList([]);
}

async function handleBeforeWindowClose() {
  if (window.activeFileKey && window.TeXPressEditor) {
    const curTab = (window.openTabs || []).find(t => t.path === window.activeFileKey);
    if (curTab && !isBinaryTabPath(curTab.path, curTab.fileType)) {
      curTab.bufferContent = window.TeXPressEditor.getContent();
      curTab.isDirty = (curTab.bufferContent !== curTab.cleanContent);
    }
  }
  const dirtyTabs = (window.openTabs || []).filter(t => t.isDirty && !isBinaryTabPath(t.path, t.fileType));
  if (dirtyTabs.length > 0) {
    const label = dirtyTabs.length === 1 ? dirtyTabs[0].name : `${dirtyTabs.length} unsaved files`;
    let choice = "dontsave";
    if (typeof window.showTabClosePrompt === "function") {
      choice = await window.showTabClosePrompt(label);
    } else {
      choice = confirm(`Save changes to ${label} before exiting?`) ? "save" : "dontsave";
    }
    if (choice === "cancel") return;
    if (choice === "save") {
      await saveAllDirtyFiles();
    }
  }
  if (isElectron && window.electronAPI && window.electronAPI.confirmForceClose) {
    await window.electronAPI.confirmForceClose();
  }
}

window.openRecentProjectPath = openRecentProjectPath;
window.clearRecentProjectsUI = clearRecentProjectsUI;
window.loadRecentProjectsUI = loadRecentProjectsUI;
