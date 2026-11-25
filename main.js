/**
 * TeXPress Studio - Main Process (Electron Native Desktop)
 * Controls application lifecycle, native Windows menus, and background compilation.
 */

const { app, BrowserWindow, Menu, ipcMain, dialog, shell, nativeImage, nativeTheme } = require("electron");
const path = require("path");
const fs = require("fs");
const { spawn, execSync, execFile } = require("child_process");

// Physical disk directory
const APP_ROOT = app.isPackaged ? path.dirname(process.execPath) : __dirname;
const TEMPLATES_DIR = path.join(APP_ROOT, "templates");

process.on("uncaughtException", (err) => {
  try {
    fs.appendFileSync(path.join(APP_ROOT, "crash.log"), `[${new Date().toISOString()}] Uncaught Exception: ${err.stack || err}\n`);
  } catch(e) {}
});
process.on("unhandledRejection", (reason) => {
  try {
    fs.appendFileSync(path.join(APP_ROOT, "crash.log"), `[${new Date().toISOString()}] Unhandled Rejection: ${reason}\n`);
  } catch(e) {}
});

let mainWindow;

// Starts with NO pre-loaded project by default!
let activeProjectDir = null;
let forceCloseWindow = false;

if (process.platform === "win32") {
  app.setAppUserModelId("com.texpress.studio");
}

// --------------------------------------------------------------------------
// Recent Projects Persistence & Windows Taskbar Jump List
// --------------------------------------------------------------------------
function getRecentProjectsPath() {
  return path.join(app.getPath("userData"), "recent_projects.json");
}

function loadRecentProjects() {
  try {
    const file = getRecentProjectsPath();
    if (!fs.existsSync(file)) return [];
    const raw = JSON.parse(fs.readFileSync(file, "utf-8"));
    if (!Array.isArray(raw)) return [];
    return raw.filter(item => item && item.path && fs.existsSync(item.path)).slice(0, 10);
  } catch (e) {
    return [];
  }
}

function saveRecentProjects(list) {
  try {
    fs.writeFileSync(getRecentProjectsPath(), JSON.stringify(list.slice(0, 10), null, 2), "utf-8");
  } catch (e) {}
}

function updateWindowsJumpList() {
  if (process.platform !== "win32") return;
  try {
    const recents = loadRecentProjects();
    const jumpCategories = [];
    if (recents.length > 0) {
      jumpCategories.push({
        type: "custom",
        name: "Recent Folders",
        items: recents.slice(0, 8).map(p => ({
          type: "task",
          title: p.name || path.basename(p.path),
          description: p.path,
          program: process.execPath,
          args: app.isPackaged ? `--open-project="${p.path}"` : `"${__dirname}" --open-project="${p.path}"`,
          iconPath: path.join(__dirname, "assets", "icon.ico"),
          iconIndex: 0
        }))
      });
    }
    jumpCategories.push({
      type: "tasks",
      items: [
        {
          type: "task",
          title: "New Window",
          description: "Open a new TeXPress Studio window",
          program: process.execPath,
          args: app.isPackaged ? "--new-window" : `"${__dirname}" --new-window`,
          iconPath: path.join(__dirname, "assets", "icon.ico"),
          iconIndex: 0
        }
      ]
    });
    app.setJumpList(jumpCategories);
  } catch (e) {
    // Ignore Jump List errors on unsupported environments
  }
}

function recordRecentProject(dirPath) {
  if (!dirPath || !fs.existsSync(dirPath)) return;
  const normalized = path.resolve(dirPath);
  const name = path.basename(normalized);
  const existing = loadRecentProjects().filter(p => path.resolve(p.path).toLowerCase() !== normalized.toLowerCase());
  const updated = [{ name, path: normalized, lastOpened: new Date().toISOString() }, ...existing].slice(0, 10);
  saveRecentProjects(updated);
  updateWindowsJumpList();
  if (typeof rebuildAppMenu === "function") rebuildAppMenu();
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send("recent-projects-updated", updated);
  }
}

function clearRecentProjects() {
  saveRecentProjects([]);
  updateWindowsJumpList();
  if (typeof rebuildAppMenu === "function") rebuildAppMenu();
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send("recent-projects-updated", []);
  }
}

function parseProjectArg(argv) {
  for (const arg of (argv || [])) {
    if (typeof arg !== "string") continue;
    if (arg.startsWith("--open-project=")) {
      const candidate = arg.slice("--open-project=".length).replace(/^["']|["']$/g, "");
      if (candidate && fs.existsSync(candidate) && fs.statSync(candidate).isDirectory()) {
        return candidate;
      }
    }
  }
  return null;
}

const startupProjectArg = parseProjectArg(process.argv);
if (startupProjectArg) {
  activeProjectDir = startupProjectArg;
}

// Locate LaTeX compilers on Windows
function locateLatexEngines() {
  const engines = {};
  const binaries = ["xelatex", "pdflatex", "latexmk", "biber", "bibtex", "synctex"];

  // Check portable directory first
  const portableBin = path.join(APP_ROOT, "portable", "miktex", "bin", "x64");
  for (const b of binaries) {
    const candidate = path.join(portableBin, `${b}.exe`);
    if (fs.existsSync(candidate)) {
      engines[b] = candidate;
    }
  }

  // System PATH fallback
  for (const b of binaries) {
    if (!engines[b]) {
      try {
        const found = execSync(`where.exe ${b}`, { encoding: "utf-8" }).trim().split("\n")[0].trim();
        if (found && fs.existsSync(found)) {
          engines[b] = found;
        }
      } catch (e) {
        // Engine not in PATH
      }
    }
  }

  // Built-in Tectonic fallback (zero external MiKTeX / TeX Live required)
  const tectonicCandidates = [
    path.join(__dirname, "bin", "tectonic.exe"),
    path.join(APP_ROOT, "bin", "tectonic.exe"),
    path.join(process.resourcesPath || "", "bin", "tectonic.exe")
  ];
  for (const cand of tectonicCandidates) {
    if (cand && fs.existsSync(cand)) {
      engines["tectonic"] = cand;
      break;
    }
  }
  if (!engines["tectonic"]) {
    try {
      const found = execSync("where.exe tectonic", { encoding: "utf-8" }).trim().split("\n")[0].trim();
      if (found && fs.existsSync(found)) engines["tectonic"] = found;
    } catch (e) {}
  }

  return engines;
}

const engines = locateLatexEngines();

/**
 * Smart LaTeX Engine Auto-Detection
 * Inspects document magic comments, documentclass options, and loaded packages.
 * Resolves to 'pdflatex' or 'xelatex' (or 'lualatex') based on source requirements.
 */
function detectLatexEngine(content, defaultEngine = "xelatex") {
  if (!content || typeof content !== "string") return defaultEngine;

  // 1. TeX Magic Comments (% !TeX program = pdflatex / xelatex / lualatex)
  const magicMatch = content.match(/%\s*!T[eE]X\s+(?:TS-)?program\s*=\s*([a-zA-Z0-9_\-]+)/i);
  if (magicMatch) {
    const prog = magicMatch[1].toLowerCase();
    if (prog.includes("pdf")) return "pdflatex";
    if (prog.includes("xe")) return "xelatex";
    if (prog.includes("lua")) return "lualatex";
  }

  // 2. Documentclass option: e.g. \documentclass[pdflatex,...]{sn-jnl}
  const docClassMatch = content.match(/\\documentclass\s*\[([^\]]*)\]/i);
  if (docClassMatch) {
    const opts = docClassMatch[1].toLowerCase();
    if (opts.includes("pdflatex")) return "pdflatex";
    if (opts.includes("xelatex")) return "xelatex";
    if (opts.includes("lualatex")) return "lualatex";
  }

  // 3. XeLaTeX/LuaLaTeX-exclusive packages and directives
  const hasXePackage = /\\usepackage(\[[^\]]*\])?\{(?:fontspec|unicode-math|polyglossia|xeCJK|bidi)\}/i.test(content);
  const hasXeCommand = /\\(?:setmainfont|setsansfont|setmonofont|defaultfontfeatures)\b/i.test(content);
  if (hasXePackage || hasXeCommand) {
    return "xelatex";
  }

  // 4. Academic/Journal document classes tailored for pdfLaTeX
  if (/\\documentclass(\[[^\]]*\])?\{(?:sn-jnl|article|revtex4|revtex4-1|revtex4-2|svjour3|elsarticle|IEEEtran|acmart)\}/i.test(content)) {
    return engines["pdflatex"] ? "pdflatex" : "xelatex";
  }

  return defaultEngine;
}

function parseLatexErrors(rawLog) {
  const diagnostics = [];
  
  // Line error format
  const lineRegex = /^([^:\n]+):(\d+):\s+(.*)$/gm;
  let match;
  while ((match = lineRegex.exec(rawLog)) !== null) {
    diagnostics.push({
      file: match[1].trim(),
      line: parseInt(match[2], 10),
      title: "LaTeX Error",
      message: match[3].trim()
    });
  }

  // Plain-English patterns
  if (rawLog.includes("Missing $ inserted")) {
    diagnostics.unshift({
      title: "Missing Math Delimiter ($)",
      message: "A math formula or special subscript character was used without enclosing '$' signs."
    });
  }
  if (rawLog.includes("Misplaced alignment tab character &")) {
    diagnostics.unshift({
      title: "Unescaped '&' Character",
      message: "Found an unescaped '&' in text. In LaTeX, use '\\&' to write an ampersand."
    });
  }
  if (rawLog.includes("Undefined control sequence")) {
    const typoMatch = rawLog.match(/Undefined control sequence\.\s+l\.(\d+)\s+([^\n]+)/);
    if (typoMatch) {
      diagnostics.unshift({
        title: "Unknown Command / Typo",
        line: parseInt(typoMatch[1], 10),
        message: `Command '${typoMatch[2].trim()}' does not exist. Check spelling or missing '\\usepackage{...}'.`
      });
    }
  }

  return diagnostics;
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 920,
    minHeight: 600,
    title: "TeXPress Studio - Academic Publishing Suite",
    icon: path.join(__dirname, "assets", "icon.ico"),
    backgroundColor: "#11111b",
    show: false,
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
      spellcheck: true
    }
  });

  // Synchronize OS-level window frame and native menus with dark theme
  nativeTheme.themeSource = "dark";

  // Native Windows Menu Bar
  function buildRecentSubmenu() {
    const recents = loadRecentProjects();
    if (recents.length === 0) {
      return [{ label: "No Recent Folders", enabled: false }];
    }
    const items = recents.map(p => ({
      label: `${p.name}  (${p.path})`,
      click: () => {
        if (fs.existsSync(p.path)) {
          activeProjectDir = p.path;
          recordRecentProject(activeProjectDir);
          if (mainWindow && !mainWindow.isDestroyed()) {
            mainWindow.webContents.send("menu-open-project", activeProjectDir);
          }
        }
      }
    }));
    items.push({ type: "separator" });
    items.push({
      label: "Clear Recently Opened",
      click: () => clearRecentProjects()
    });
    return items;
  }

  function buildMenuTemplate() {
    return [
    {
      label: "File",
      submenu: [
        {
          label: "New Project from Template...",
          accelerator: "CmdOrCtrl+Shift+N",
          click: () => mainWindow.webContents.send("menu-new-project")
        },
        {
          label: "Open Project Folder...",
          accelerator: "CmdOrCtrl+O",
          click: async () => {
            const res = await dialog.showOpenDialog(mainWindow, {
              title: "Open LaTeX Project Folder",
              properties: ["openDirectory"]
            });
            if (!res.canceled && res.filePaths.length > 0) {
              activeProjectDir = res.filePaths[0];
              recordRecentProject(activeProjectDir);
              mainWindow.webContents.send("menu-open-project", activeProjectDir);
            }
          }
        },
        {
          label: "Open Recent",
          submenu: buildRecentSubmenu()
        },
        {
          label: "Open Sample Project (Molecular Biophysics)",
          accelerator: "CmdOrCtrl+Shift+D",
          click: () => mainWindow.webContents.send("menu-open-sample")
        },
        {
          label: "Close Project",
          click: () => {
            activeProjectDir = null;
            mainWindow.webContents.send("menu-close-project");
          }
        },
        {
          label: "Close Active Tab",
          accelerator: "CmdOrCtrl+W",
          click: () => mainWindow.webContents.send("menu-close-tab")
        },
        { type: "separator" },
        {
          label: "Save Active File",
          accelerator: "CmdOrCtrl+S",
          click: () => mainWindow.webContents.send("menu-save")
        },
        { type: "separator" },
        {
          label: "Export Production PDF...",
          accelerator: "CmdOrCtrl+Shift+E",
          click: async () => {
            if (!activeProjectDir) {
              dialog.showErrorBox("No Project Open", "Please open a project and compile first.");
              return;
            }
            let pdfSource = path.join(activeProjectDir, "main.pdf");
            if (!fs.existsSync(pdfSource)) {
              const rootPdfs = fs.readdirSync(activeProjectDir)
                .filter(f => f.toLowerCase().endsWith(".pdf"))
                .map(f => {
                  const full = path.join(activeProjectDir, f);
                  return { full, mtime: fs.statSync(full).mtimeMs };
                })
                .sort((a, b) => b.mtime - a.mtime);
              if (rootPdfs.length > 0) {
                pdfSource = rootPdfs[0].full;
              }
            }
            if (!fs.existsSync(pdfSource)) {
              dialog.showErrorBox("No PDF Found", "Please compile the document first before exporting.");
              return;
            }
            const pdfName = path.basename(pdfSource);
            const saveDest = await dialog.showSaveDialog(mainWindow, {
              title: `Export ${pdfName}`,
              defaultPath: `${path.basename(activeProjectDir)}_${pdfName}`,
              filters: [{ name: "PDF Documents", extensions: ["pdf"] }]
            });
            if (!saveDest.canceled && saveDest.filePath) {
              fs.copyFileSync(pdfSource, saveDest.filePath);
              dialog.showMessageBox(mainWindow, { message: `Exported clean PDF to:\n${saveDest.filePath}` });
            }
          }
        },
        { type: "separator" },
        { label: "Exit TeXPress", accelerator: "CmdOrCtrl+Q", click: () => app.quit() }
      ]
    },
    {
      label: "Edit",
      submenu: [
        { role: "undo" },
        { role: "redo" },
        { type: "separator" },
        { role: "cut" },
        { role: "copy" },
        { role: "paste" },
        { role: "selectAll" }
      ]
    },
    {
      label: "Insert",
      submenu: [
        {
          label: "Figure / Image...",
          accelerator: "CmdOrCtrl+Shift+I",
          click: () => mainWindow.webContents.send("menu-open-figure-wizard")
        },
        {
          label: "New Chapter Heading",
          accelerator: "CmdOrCtrl+Shift+C",
          click: () => mainWindow.webContents.send("menu-insert", "chapter")
        },
        {
          label: "Math Equation Block",
          accelerator: "CmdOrCtrl+Alt+E",
          click: () => mainWindow.webContents.send("menu-insert", "equation")
        },
        {
          label: "Academic Table (booktabs)",
          accelerator: "CmdOrCtrl+Alt+B",
          click: () => mainWindow.webContents.send("menu-insert", "table")
        },
        {
          label: "Citation (\\cite)",
          accelerator: "CmdOrCtrl+Shift+B",
          click: () => mainWindow.webContents.send("menu-insert", "cite")
        }
      ]
    },
    {
      label: "Build",
      submenu: [
        {
          label: "Build Document (XeLaTeX)",
          accelerator: "F5",
          click: () => mainWindow.webContents.send("menu-compile")
        },
        {
          label: "Toggle Auto-Compile on Typing Pause",
          accelerator: "Alt+F5",
          click: () => mainWindow.webContents.send("menu-toggle-autocompile")
        },
        { type: "separator" },
        {
          label: "Target Document",
          submenu: [
            {
              label: "🎯 Auto (Active Document if Root, else main.tex)",
              click: () => mainWindow.webContents.send("menu-set-build-target", "auto")
            },
            {
              label: "📄 main.tex (Master Document)",
              click: () => mainWindow.webContents.send("menu-set-build-target", "main.tex")
            },
            {
              label: "⚡ Force Compile Active Tab File",
              click: () => mainWindow.webContents.send("menu-set-build-target", "active")
            }
          ]
        },
        { type: "separator" },
        {
          label: "Clean Auxiliary Files (.build/)",
          click: () => {
            if (activeProjectDir) {
              const bDir = path.join(activeProjectDir, ".build");
              if (fs.existsSync(bDir)) {
                fs.rmSync(bDir, { recursive: true, force: true });
                fs.mkdirSync(bDir, { recursive: true });
                dialog.showMessageBox(mainWindow, { message: "Cleaned .build cache directory successfully." });
              }
            }
          }
        },
        {
          label: "Open PDF in External Reader",
          click: () => {
            if (activeProjectDir) {
              const pdfPath = path.join(activeProjectDir, "main.pdf");
              if (fs.existsSync(pdfPath)) {
                shell.openPath(pdfPath);
                return;
              }
            }
            dialog.showErrorBox("No PDF Found", "Build the document first (F5) to generate main.pdf.");
          }
        }
      ]
    },
    {
      label: "Tools",
      submenu: [
        {
          label: "Academic Table Wizard (booktabs)...",
          accelerator: "CmdOrCtrl+Shift+T",
          click: () => mainWindow.webContents.send("menu-open-table-wizard")
        },
        {
          label: "Academic Prose Word Count...",
          accelerator: "CmdOrCtrl+Shift+W",
          click: () => mainWindow.webContents.send("menu-open-word-count")
        },
        {
          label: "Toggle Greek & Math Palette",
          accelerator: "CmdOrCtrl+Alt+S",
          click: () => mainWindow.webContents.send("menu-toggle-symbols")
        }
      ]
    },
    {
      label: "View",
      submenu: [
        {
          label: "Toggle Project Explorer",
          accelerator: "CmdOrCtrl+E",
          click: () => mainWindow.webContents.send("menu-toggle-explorer")
        },
        { type: "separator" },
        {
          label: "Toggle Dark / Light Theme",
          accelerator: "CmdOrCtrl+Alt+T",
          click: () => mainWindow.webContents.send("menu-toggle-theme")
        },
        { type: "separator" },
        {
          label: "Split View (Code + PDF)",
          accelerator: "CmdOrCtrl+Alt+1",
          click: () => mainWindow.webContents.send("menu-view-mode", "split")
        },
        {
          label: "Document Page Only (Editor)",
          accelerator: "CmdOrCtrl+Alt+2",
          click: () => mainWindow.webContents.send("menu-view-mode", "editor")
        },
        {
          label: "Live PDF Preview Only",
          accelerator: "CmdOrCtrl+Alt+3",
          click: () => mainWindow.webContents.send("menu-view-mode", "pdf")
        },
        { type: "separator" },
        {
          label: "Toggle Line Wrapping",
          accelerator: "Alt+Z",
          click: () => mainWindow.webContents.send("menu-toggle-wrap")
        },
        {
          label: "Toggle Line Numbers",
          accelerator: "Alt+L",
          click: () => mainWindow.webContents.send("menu-toggle-numbers")
        },
        { type: "separator" },
        {
          label: "Jump to PDF Location (SyncTeX)",
          accelerator: "CmdOrCtrl+Alt+J",
          click: () => mainWindow.webContents.send("menu-forward-sync")
        },
        { type: "separator" },
        { role: "resetZoom" },
        { role: "zoomIn" },
        { role: "zoomOut" },
        { type: "separator" },
        { role: "togglefullscreen" }
      ]
    },
    {
      label: "Help",
      submenu: [
        {
          label: "Keyboard Shortcuts",
          click: () => {
            dialog.showMessageBox(mainWindow, {
              title: "TeXPress Studio - Shortcuts",
              message: "Keyboard Shortcuts:\n• F5: Compile Document\n• Ctrl+P: Quick Open File\n• Ctrl+O: Open Project Folder\n• Ctrl+Shift+N: New Project\n• Ctrl+S: Save Active File\n• Ctrl+W: Close Active Tab\n• Ctrl+/: Toggle Comment\n• Ctrl+E: Toggle Explorer\n• Ctrl+Alt+J: SyncTeX Forward Sync\n• Ctrl+Shift+M: Insert Equation\n• Ctrl+Shift+T: Insert Table"
            });
          }
        },
        {
          label: "Engine Diagnostics",
          click: () => {
            const detected = Object.keys(engines).map(k => `${k}: ${engines[k]}`).join("\n");
            dialog.showMessageBox(mainWindow, {
              title: "LaTeX Engine Status",
              message: `Detected Compilers:\n\n${detected || "No compilers found in PATH."}`
            });
          }
        },
        { type: "separator" },
        {
          label: "About TeXPress Studio",
          click: () => {
            const iconPath = path.join(__dirname, "assets", "icon_256.png");
            dialog.showMessageBox(mainWindow, {
              type: "info",
              icon: fs.existsSync(iconPath) ? nativeImage.createFromPath(iconPath) : undefined,
              title: "About TeXPress Studio",
              message: "TeXPress Studio v1.0.0",
              detail: "Professional Academic Monograph & Paper Publishing Suite\nPowered by XeLaTeX, SyncTeX & CodeMirror 5\n© 2026 TeXPress Team. All rights reserved."
            });
          }
        }
      ]
    }
  ];
  }

  rebuildAppMenu = () => {
    if (!mainWindow || mainWindow.isDestroyed()) return;
    const menu = Menu.buildFromTemplate(buildMenuTemplate());
    Menu.setApplicationMenu(menu);
  };
  rebuildAppMenu();

  // Native Spellcheck & Edit Context Menu inside Editor
  mainWindow.webContents.on("context-menu", (_event, params) => {
    if (!params.isEditable && !params.selectionText) return;
    const template = [];
    if (params.misspelledWord) {
      const suggestions = (params.dictionarySuggestions || []).slice(0, 5);
      if (suggestions.length > 0) {
        suggestions.forEach((s) => {
          template.push({
            label: s,
            click: () => mainWindow.webContents.replaceMisspelling(s)
          });
        });
      } else {
        template.push({ label: "No Spelling Suggestions", enabled: false });
      }
      template.push({ type: "separator" });
      template.push({
        label: `Add "${params.misspelledWord}" to Dictionary`,
        click: () => mainWindow.webContents.session.addWordToSpellCheckerDictionary(params.misspelledWord)
      });
      template.push({ type: "separator" });
    }
    if (params.isEditable) {
      template.push(
        { role: "cut" },
        { role: "copy" },
        { role: "paste" },
        { type: "separator" },
        { role: "selectAll" }
      );
    } else if (params.selectionText) {
      template.push({ role: "copy" });
    }
    if (template.length > 0) {
      Menu.buildFromTemplate(template).popup({ window: mainWindow });
    }
  });

  // Unsaved changes guard on window close
  mainWindow.on("close", (e) => {
    if (forceCloseWindow) return;
    e.preventDefault();
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send("check-unsaved-before-close");
    }
  });

  mainWindow.loadFile(path.join(__dirname, "ui", "index.html"));

  mainWindow.once("ready-to-show", () => {
    updateWindowsJumpList();
    try {
      const { initAutoUpdater } = require("./updater_bridge");
      initAutoUpdater(app, mainWindow, dialog);
    } catch (e) {}
    mainWindow.maximize();
    mainWindow.show();
  });
}

let rebuildAppMenu = null;

// --------------------------------------------------------------------------
// IPC Handlers
// --------------------------------------------------------------------------

// 1. Get Project Files & Directory Tree
ipcMain.handle("get-project", async () => {
  if (!activeProjectDir || !fs.existsSync(activeProjectDir)) {
    return { isProjectOpen: false, projectName: null, files: [], tree: [] };
  }

  function getDirectoryTree(dir, rel = "") {
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    const items = [];
    const sorted = entries.sort((a, b) => {
      if (a.isDirectory() === b.isDirectory()) return a.name.localeCompare(b.name);
      return a.isDirectory() ? -1 : 1;
    });

    for (const ent of sorted) {
      if (ent.name === ".build" || ent.name === "node_modules" || ent.name.startsWith(".")) continue;
      const relPath = path.join(rel, ent.name).replace(/\\/g, "/");
      const fullPath = path.join(dir, ent.name);
      if (ent.isDirectory()) {
        const children = getDirectoryTree(fullPath, relPath);
        items.push({
          name: ent.name,
          path: relPath,
          type: "directory",
          children: children
        });
      } else if (/\.(tex|bib|sty|cls|png|jpg|jpeg|pdf|md|txt)$/i.test(ent.name)) {
        items.push({
          name: ent.name,
          path: relPath,
          type: "file",
          is_root: (ent.name === "main.tex" && rel === "")
        });
      }
    }
    return items;
  }

  const files = [];
  function scan(dir, rel = "") {
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const ent of entries) {
      if (ent.name === ".build" || ent.name === "node_modules" || ent.name.startsWith(".")) continue;
      const relPath = path.join(rel, ent.name).replace(/\\/g, "/");
      const fullPath = path.join(dir, ent.name);
      if (ent.isDirectory()) {
        scan(fullPath, relPath);
      } else if (/\.(tex|bib|sty|cls|png|jpg|jpeg|pdf|md|txt)$/i.test(ent.name)) {
        files.push({
          name: ent.name,
          path: relPath,
          is_root: (ent.name === "main.tex" && rel === "")
        });
      }
    }
  }

  scan(activeProjectDir);
  const tree = getDirectoryTree(activeProjectDir);

  return {
    isProjectOpen: true,
    projectName: path.basename(activeProjectDir),
    projectPath: activeProjectDir,
    tree: tree,
    files: files.sort((a, b) => (b.is_root ? 1 : 0) - (a.is_root ? 1 : 0))
  };
});

// 2. Open Project Folder Dialog
ipcMain.handle("open-project-dialog", async () => {
  const res = await dialog.showOpenDialog(mainWindow, {
    title: "Open LaTeX Project Folder",
    properties: ["openDirectory"]
  });
  if (!res.canceled && res.filePaths.length > 0) {
    activeProjectDir = res.filePaths[0];
    recordRecentProject(activeProjectDir);
    return { success: true, projectPath: activeProjectDir };
  }
  return { success: false };
});

// 3. Create Project from Template
ipcMain.handle("create-project", async (event, { templateName, projectFolderName, projectName } = {}) => {
  const templateSource = path.join(TEMPLATES_DIR, templateName);
  if (!fs.existsSync(templateSource)) {
    return { success: false, error: "Template not found" };
  }

  const res = await dialog.showOpenDialog(mainWindow, {
    title: "Select Parent Folder to Create New Project",
    properties: ["openDirectory"]
  });
  if (res.canceled || res.filePaths.length === 0) return { success: false };

  const folderName = (projectFolderName || projectName || "My_LaTeX_Project").trim() || "My_LaTeX_Project";
  const targetDir = path.join(res.filePaths[0], folderName);
  fs.mkdirSync(targetDir, { recursive: true });

  // Recursive copy
  function copyDir(src, dest) {
    const entries = fs.readdirSync(src, { withFileTypes: true });
    for (const ent of entries) {
      const s = path.join(src, ent.name);
      const d = path.join(dest, ent.name);
      if (ent.isDirectory()) {
        fs.mkdirSync(d, { recursive: true });
        copyDir(s, d);
      } else {
        fs.copyFileSync(s, d);
      }
    }
  }

  copyDir(templateSource, targetDir);
  activeProjectDir = targetDir;
  recordRecentProject(activeProjectDir);
  return { success: true, projectPath: activeProjectDir };
});

// 3b. Open Bundled Sample Project
ipcMain.handle("open-sample-project", async () => {
  const sampleSource1 = path.join(APP_ROOT, "samples", "Molecular_Biophysics");
  const sampleSource2 = path.join(__dirname, "samples", "Molecular_Biophysics");
  const templateFallback = path.join(TEMPLATES_DIR, "book_springer");
  
  let src = null;
  if (fs.existsSync(sampleSource1)) src = sampleSource1;
  else if (fs.existsSync(sampleSource2)) src = sampleSource2;
  else if (fs.existsSync(templateFallback)) src = templateFallback;

  if (!src) {
    return { success: false, error: "Sample project source files not found." };
  }

  const projectsDir = path.join(APP_ROOT, "projects");
  fs.mkdirSync(projectsDir, { recursive: true });
  const targetDir = path.join(projectsDir, "Sample_Molecular_Biophysics");

  // If not already copied, copy fresh from sample directory
  if (!fs.existsSync(targetDir)) {
    fs.mkdirSync(targetDir, { recursive: true });
    function copyDir(s, d) {
      const entries = fs.readdirSync(s, { withFileTypes: true });
      for (const ent of entries) {
        const srcP = path.join(s, ent.name);
        const dstP = path.join(d, ent.name);
        if (ent.isDirectory()) {
          fs.mkdirSync(dstP, { recursive: true });
          copyDir(srcP, dstP);
        } else {
          fs.copyFileSync(srcP, dstP);
        }
      }
    }
    copyDir(src, targetDir);
  }

  activeProjectDir = targetDir;
  recordRecentProject(activeProjectDir);
  return { success: true, projectPath: activeProjectDir };
});

// 3c. Recent Projects IPCs & Force Close Confirmation
ipcMain.handle("get-recent-projects", async () => {
  return loadRecentProjects();
});

ipcMain.handle("open-recent-project", async (_event, dirPath) => {
  if (!dirPath || !fs.existsSync(dirPath) || !fs.statSync(dirPath).isDirectory()) {
    return { success: false, error: "Folder no longer exists on disk." };
  }
  activeProjectDir = dirPath;
  recordRecentProject(activeProjectDir);
  return { success: true, projectPath: activeProjectDir };
});

ipcMain.handle("clear-recent-projects", async () => {
  clearRecentProjects();
  return { success: true };
});

ipcMain.handle("confirm-force-close", async () => {
  forceCloseWindow = true;
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.close();
  }
  return { success: true };
});

// 4. Close Project
ipcMain.handle("close-project", async () => {
  activeProjectDir = null;
  return { success: true };
});

// 5. Read File (Supports Text, Binary Images & PDFs)
ipcMain.handle("read-file", async (event, relPath) => {
  if (!activeProjectDir) return { success: false, error: "No project open" };
  const fullPath = path.join(activeProjectDir, relPath);
  if (!fs.existsSync(fullPath)) return { success: false, error: "File not found" };

  const ext = path.extname(fullPath).toLowerCase();
  const imageExts = [".png", ".jpg", ".jpeg", ".svg", ".webp", ".gif", ".bmp"];
  if (imageExts.includes(ext)) {
    const buffer = fs.readFileSync(fullPath);
    const mime = ext === ".svg" ? "image/svg+xml" : (ext === ".jpg" || ext === ".jpeg") ? "image/jpeg" : `image/${ext.replace(".", "")}`;
    return {
      success: true,
      fileType: "image",
      isImage: true,
      fileName: path.basename(fullPath),
      relPath: relPath,
      dataUri: `data:${mime};base64,${buffer.toString("base64")}`,
      sizeBytes: buffer.length
    };
  }

  if (ext === ".pdf") {
    const buffer = fs.readFileSync(fullPath);
    return {
      success: true,
      fileType: "pdf",
      isPdf: true,
      fileName: path.basename(fullPath),
      relPath: relPath,
      dataUri: `data:application/pdf;base64,${buffer.toString("base64")}`,
      sizeBytes: buffer.length
    };
  }

  const content = fs.readFileSync(fullPath, "utf-8");
  return { success: true, fileType: "text", isText: true, content, relPath };
});

// 6. Save File (Accepts both { path, content } and (relPath, content))
ipcMain.handle("save-file", async (event, data, secondArg) => {
  if (!activeProjectDir) return { success: false, error: "No project open" };
  let relPath, content;
  if (data && typeof data === "object" && data.path !== undefined) {
    relPath = data.path;
    content = data.content;
  } else {
    relPath = data;
    content = secondArg;
  }
  if (!relPath) return { success: false, error: "No path provided" };
  const fullPath = path.join(activeProjectDir, relPath);
  fs.mkdirSync(path.dirname(fullPath), { recursive: true });
  fs.writeFileSync(fullPath, content || "", "utf-8");
  return { success: true };
});

// 6b. Create New File
ipcMain.handle("create-file", async (event, { relPath }) => {
  if (!activeProjectDir) return { success: false, error: "No project open" };
  const cleanRel = (relPath || "").replace(/^[/\\]+/, "").replace(/\\/g, "/").trim();
  if (!cleanRel) return { success: false, error: "Invalid file name" };

  const fullPath = path.join(activeProjectDir, cleanRel);
  if (fs.existsSync(fullPath)) {
    return { success: false, error: "File already exists" };
  }

  fs.mkdirSync(path.dirname(fullPath), { recursive: true });
  let initialContent = "";
  if (cleanRel.endsWith(".tex")) {
    const baseName = path.basename(cleanRel, ".tex");
    const title = baseName.replace(/_/g, " ").replace(/\b\w/g, c => c.toUpperCase());
    initialContent = `\\chapter{${title}}\n\\label{ch:${baseName.toLowerCase()}}\n\nWrite your chapter content here...\n`;
  }
  fs.writeFileSync(fullPath, initialContent, "utf-8");
  return { success: true, relPath: cleanRel };
});

// 6c. Create New Folder
ipcMain.handle("create-folder", async (event, { relPath }) => {
  if (!activeProjectDir) return { success: false, error: "No project open" };
  const cleanRel = (relPath || "").replace(/^[/\\]+/, "").replace(/\\/g, "/").trim();
  if (!cleanRel) return { success: false, error: "Invalid folder name" };

  const fullPath = path.join(activeProjectDir, cleanRel);
  if (fs.existsSync(fullPath)) {
    return { success: false, error: "Folder already exists" };
  }

  fs.mkdirSync(fullPath, { recursive: true });
  return { success: true, relPath: cleanRel };
});

// 6d. Rename Item
ipcMain.handle("rename-item", async (event, { oldRelPath, newRelPath }) => {
  if (!activeProjectDir) return { success: false, error: "No project open" };
  const oldFull = path.join(activeProjectDir, oldRelPath);
  const newFull = path.join(activeProjectDir, newRelPath);

  if (!fs.existsSync(oldFull)) {
    return { success: false, error: "Item to rename not found" };
  }
  if (fs.existsSync(newFull)) {
    return { success: false, error: "Target name already exists" };
  }

  fs.renameSync(oldFull, newFull);
  return { success: true, oldRelPath, newRelPath };
});

// 6e. Delete Item (Supports files and directories, accepts both { relPath } and string)
ipcMain.handle("delete-item", async (event, data) => {
  if (!activeProjectDir) return { success: false, error: "No project open" };
  const rawPath = (data && typeof data === "object" && data.relPath !== undefined) ? data.relPath : data;
  const relPath = String(rawPath || "").replace(/^[/\\]+/, "").replace(/\\/g, "/").trim();
  if (!relPath || relPath === "." || relPath === "/" || relPath === "main.tex") {
    return { success: false, error: "Cannot delete master document (main.tex) or root directory" };
  }

  const fullPath = path.join(activeProjectDir, relPath);
  if (!fs.existsSync(fullPath)) {
    return { success: false, error: "Item not found" };
  }

  const stat = fs.statSync(fullPath);
  if (stat.isDirectory()) {
    fs.rmSync(fullPath, { recursive: true, force: true });
  } else {
    fs.unlinkSync(fullPath);
  }
  return { success: true, relPath };
});

// 6f. Reveal in Windows File Explorer
ipcMain.handle("reveal-in-explorer", async (event, { relPath } = {}) => {
  if (!activeProjectDir) return { success: false };
  const target = relPath ? path.join(activeProjectDir, relPath) : activeProjectDir;
  if (fs.existsSync(target)) {
    shell.showItemInFolder(target);
    return { success: true };
  }
  return { success: false, error: "Path not found" };
});

// 7. Compile (Zero-Freezes, Concurrency Mutex, Subfolder Path Safety & 45s Timeout)
let isCompileActive = false;
let activeCompileProc = null;

/**
 * Robust copy file with retry backoff for Windows EBUSY / EPERM file-locks
 * @param {string} src - Source file path (.build/main.pdf)
 * @param {string} dest - Destination file path (project root main.pdf)
 * @param {number} retries - Number of attempts before fallback
 * @param {number} delayMs - Delay between attempts in milliseconds
 * @returns {{success: boolean, path: string, fallback?: boolean}}
 */
function safeCopyPdf(src, dest, retries = 3, delayMs = 200) {
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      fs.copyFileSync(src, dest);
      return { success: true, path: dest };
    } catch (err) {
      if (attempt < retries) {
        const start = Date.now();
        while (Date.now() - start < delayMs) {} // Synchronous sleep
      } else {
        console.warn(`Windows file-lock on ${dest}: serving artifact directly from ${src}`);
        return { success: true, path: src, fallback: true };
      }
    }
  }
  return { success: true, path: src, fallback: true };
}

/**
 * Helper to spawn process asynchronously with timeout and taskkill on Windows
 */
function executeProcess(cmd, args, options = {}, timeoutMs = 45000) {
  return new Promise((resolve) => {
    let stdout = "";
    let stderr = "";
    let timedOut = false;

    const proc = spawn(cmd, args, {
      ...options,
      windowsHide: true
    });
    activeCompileProc = proc;

    const timer = setTimeout(() => {
      timedOut = true;
      if (proc && !proc.killed) {
        try {
          if (process.platform === "win32") {
            const { execSync } = require("child_process");
            execSync(`taskkill /pid ${proc.pid} /T /F`, { stdio: "ignore" });
          } else {
            proc.kill("SIGKILL");
          }
        } catch (e) {
          console.warn("Failed to kill hung compiler process:", e.message);
        }
      }
    }, timeoutMs);

    proc.stdout?.on("data", (d) => { stdout += d.toString(); });
    proc.stderr?.on("data", (d) => { stderr += d.toString(); });

    proc.on("close", (code) => {
      clearTimeout(timer);
      resolve({ code, stdout, stderr, timedOut });
    });

    proc.on("error", (err) => {
      clearTimeout(timer);
      resolve({ code: 1, stdout, stderr: err.message, timedOut, error: err });
    });
  });
}

ipcMain.handle("compile", async (event, { rootFile = "main.tex", engine = "auto", activeFile, content }) => {
  if (!activeProjectDir) {
    return { success: false, error: "No project currently open. Open or create a project first." };
  }

  // Mutex Lock: Prevent concurrent process spawning collisions
  if (isCompileActive) {
    return {
      success: false,
      error: "A compilation is already in progress. Please wait for it to complete.",
      isBusy: true,
      diagnostics: []
    };
  }
  isCompileActive = true;

  const buildDir = path.join(activeProjectDir, ".build");
  if (!fs.existsSync(buildDir)) {
    fs.mkdirSync(buildDir, { recursive: true });
  }

  // Subfolder Path Normalization: Ensure subdirectories exist inside .build/
  const targetRel = (rootFile || "main.tex").replace(/^[/\\]+/, "").replace(/\\/g, "/");
  const subDir = path.dirname(targetRel);
  if (subDir && subDir !== ".") {
    fs.mkdirSync(path.join(buildDir, subDir), { recursive: true });
  }

  if (activeFile && content) {
    const activePath = path.join(activeProjectDir, activeFile);
    fs.mkdirSync(path.dirname(activePath), { recursive: true });
    fs.writeFileSync(activePath, content, "utf-8");
  }

  // Determine target document content for smart engine detection
  let targetContent = "";
  const fullTargetPath = path.join(activeProjectDir, targetRel);
  if (activeFile === targetRel && content) {
    targetContent = content;
  } else if (fs.existsSync(fullTargetPath)) {
    try {
      targetContent = fs.readFileSync(fullTargetPath, "utf-8");
    } catch (e) {}
  }

  // Smart Engine Resolution (MiKTeX/TeX Live primary, built-in Tectonic fallback)
  let resolvedEngine = engine;
  if (!resolvedEngine || resolvedEngine === "auto") {
    resolvedEngine = detectLatexEngine(targetContent, "xelatex");
  }

  const useTectonic = (resolvedEngine === "tectonic") || (!engines["pdflatex"] && !engines["xelatex"] && !!engines["tectonic"]);
  if (useTectonic) {
    resolvedEngine = "tectonic";
  }

  const compilerExe = useTectonic
    ? engines["tectonic"]
    : (engines[resolvedEngine] || engines["pdflatex"] || engines["xelatex"]);
  if (!compilerExe) {
    isCompileActive = false;
    return {
      success: false,
      error: "No LaTeX compiler found. Please install MiKTeX/TeX Live or ensure built-in Tectonic is available.",
      diagnostics: []
    };
  }

  let totalStdout = "";
  let lastCode = 0;
  let bibtexRan = false;

  if (useTectonic) {
    const tecArgs = [
      "-X",
      "compile",
      targetRel,
      "--outdir",
      buildDir,
      "--synctex",
      "--keep-intermediates",
      "--keep-logs"
    ];
    const tecRes = await executeProcess(compilerExe, tecArgs, { cwd: activeProjectDir }, 180000);
    totalStdout = (tecRes.stdout || "") + "\n" + (tecRes.stderr || "");
    lastCode = tecRes.code;
    if (tecRes.timedOut) {
      isCompileActive = false;
      activeCompileProc = null;
      return {
        success: false,
        error: "Compilation timed out after 90 seconds.",
        diagnostics: [{
          file: targetRel,
          line: 1,
          severity: "error",
          title: "Compilation Timeout (90s)",
          message: "Tectonic exceeded 90 seconds. Check your internet connection if downloading packages for the first time."
        }],
        log: totalStdout,
        timedOut: true
      };
    }
  } else {
    const compileArgs = [
      "-synctex=1",
      "-interaction=nonstopmode",
      "-file-line-error",
      `-output-directory=${buildDir}`,
      targetRel
    ];

    // Pass 1: Primary Compilation
    const pass1 = await executeProcess(compilerExe, compileArgs, { cwd: activeProjectDir }, 45000);
    totalStdout = pass1.stdout;
    lastCode = pass1.code;

    if (pass1.timedOut) {
      isCompileActive = false;
      activeCompileProc = null;
      return {
        success: false,
        error: "Compilation timed out after 45 seconds. Terminated process tree to prevent lockup.",
        diagnostics: [{
          file: targetRel,
          line: 1,
          severity: "error",
          title: "Compilation Timeout (45s)",
          message: "Compiler exceeded 45-second execution limit. Check for infinite macro loops or missing \\end{...} tags."
        }],
        log: pass1.stdout,
        timedOut: true
      };
    }

    // Phase 3: Automated Bibliography Pipeline (BibTeX Integration)
    const jobName = path.basename(targetRel, ".tex");
    const auxFileInSub = path.join(buildDir, targetRel.replace(/\.tex$/i, ".aux"));
    const auxFileInRoot = path.join(buildDir, `${jobName}.aux`);
    const auxFile = fs.existsSync(auxFileInSub) ? auxFileInSub : auxFileInRoot;
    const auxDir = fs.existsSync(auxFile) ? path.dirname(auxFile) : buildDir;

    let citationsNeeded = false;

    if (fs.existsSync(auxFile)) {
      try {
        const auxContent = fs.readFileSync(auxFile, "utf-8");
        if (auxContent.includes("\\bibdata{") && (auxContent.includes("\\citation{") || pass1.stdout.includes("Citation") || pass1.stdout.includes("No file "))) {
          citationsNeeded = true;
        }
      } catch (e) {}
    }

    if (citationsNeeded && engines["bibtex"]) {
      const bibArgs = [`-include-directory=${activeProjectDir}`, jobName];
      const bibResult = await executeProcess(engines["bibtex"], bibArgs, {
        cwd: auxDir,
        env: {
          ...process.env,
          BIBINPUTS: `${activeProjectDir};${process.env.BIBINPUTS || ""}`,
          BSTINPUTS: `${activeProjectDir};${process.env.BSTINPUTS || ""}`
        }
      }, 20000);

      totalStdout += "\n\n--- [BibTeX Pass] ---\n" + bibResult.stdout;
      bibtexRan = true;

      const bblFile = path.join(auxDir, `${jobName}.bbl`);
      if (fs.existsSync(bblFile)) {
        // Pass 2: Ingest citations
        const pass2 = await executeProcess(compilerExe, compileArgs, { cwd: activeProjectDir }, 45000);
        totalStdout += "\n\n--- [LaTeX Pass 2: Ingest Citations] ---\n" + pass2.stdout;
        lastCode = pass2.code;

        // Pass 3: Finalize cross-references if needed
        if (pass2.stdout.includes("Rerun to get cross-references right") || pass2.stdout.includes("undefined citations") || pass2.stdout.includes("There were undefined references")) {
          const pass3 = await executeProcess(compilerExe, compileArgs, { cwd: activeProjectDir }, 45000);
          totalStdout += "\n\n--- [LaTeX Pass 3: Cross-References Resolution] ---\n" + pass3.stdout;
          lastCode = pass3.code;
        }
      }
    }
  }

  isCompileActive = false;
  activeCompileProc = null;

  const pdfBase = path.basename(targetRel, ".tex") + ".pdf";
  const builtPdfInSub = path.join(buildDir, targetRel.replace(/\.tex$/i, ".pdf"));
  const builtPdfInRoot = path.join(buildDir, pdfBase);
  const builtPdf = fs.existsSync(builtPdfInSub) ? builtPdfInSub : builtPdfInRoot;
  const destPdf = path.join(activeProjectDir, pdfBase);

  if (fs.existsSync(builtPdf)) {
    const copyResult = safeCopyPdf(builtPdf, destPdf);
    return {
      success: true,
      pdfPath: copyResult.path,
      pdfFile: pdfBase,
      engineUsed: resolvedEngine,
      bibtexRan,
      code: lastCode
    };
  } else {
    const diagnostics = parseLatexErrors(totalStdout);
    return {
      success: false,
      error: "Compilation failed. Check diagnostics.",
      diagnostics,
      log: totalStdout,
      engineUsed: resolvedEngine,
      code: lastCode
    };
  }
});

// IPC Handler to query detected engine for any document
ipcMain.handle("detect-document-engine", async (event, { relPath, content }) => {
  if (content) {
    return { engine: detectLatexEngine(content, "xelatex") };
  }
  if (!activeProjectDir || !relPath) return { engine: "xelatex" };
  const fullPath = path.join(activeProjectDir, relPath);
  if (fs.existsSync(fullPath)) {
    try {
      const src = fs.readFileSync(fullPath, "utf-8");
      return { engine: detectLatexEngine(src, "xelatex") };
    } catch (e) {}
  }
  return { engine: "xelatex" };
});

// IPC Handler to list available local LaTeX engines
ipcMain.handle("get-latex-engines", async () => {
  return {
    available: Object.keys(engines).filter((k) => ["pdflatex", "xelatex", "lualatex"].includes(k) && engines[k]),
    hasBibtex: Boolean(engines["bibtex"]),
    hasSynctex: Boolean(engines["synctex"])
  };
});

// IPC Handler to set OS-level native theme for window chrome and menus
ipcMain.handle("set-native-theme", async (event, theme) => {
  if (theme === "dark" || theme === "light" || theme === "system") {
    nativeTheme.themeSource = theme;
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.setBackgroundColor(theme === "dark" ? "#141416" : "#f8fafc");
    }
  }
  return { success: true, shouldUseDarkColors: nativeTheme.shouldUseDarkColors };
});

// 8. Get Compiled PDF Data URI (Dynamic Target PDF Support)
ipcMain.handle("get-pdf-data", async (event, targetRelPath) => {
  if (!activeProjectDir) return null;
  const target = targetRelPath ? String(targetRelPath).replace(/^[\\\/]+/, "") : "main.pdf";
  const pdfPath = path.isAbsolute(target) ? target : path.join(activeProjectDir, target);
  if (!fs.existsSync(pdfPath)) return null;
  const buffer = fs.readFileSync(pdfPath);
  return `data:application/pdf;base64,${buffer.toString("base64")}`;
});

// 9. Export PDF Dialog (Exports the currently active / selected PDF)
ipcMain.handle("export-pdf", async (event, targetRelPath) => {
  if (!activeProjectDir) {
    dialog.showErrorBox("No Project Open", "Please open a project and compile first.");
    return { success: false };
  }
  const target = targetRelPath ? String(targetRelPath).replace(/^[\\\/]+/, "") : "main.pdf";
  const pdfSource = path.isAbsolute(target) ? target : path.join(activeProjectDir, target);
  if (!fs.existsSync(pdfSource)) {
    const baseName = path.basename(target);
    dialog.showErrorBox("No PDF Found", `The document ${baseName} has not been compiled yet. Please compile it first before exporting.`);
    return { success: false };
  }
  const pdfName = path.basename(pdfSource);
  const saveDest = await dialog.showSaveDialog(mainWindow, {
    title: `Export ${pdfName}`,
    defaultPath: `${path.basename(activeProjectDir)}_${pdfName}`,
    filters: [{ name: "PDF Documents", extensions: ["pdf"] }]
  });
  if (!saveDest.canceled && saveDest.filePath) {
    fs.copyFileSync(pdfSource, saveDest.filePath);
    dialog.showMessageBox(mainWindow, { message: `Exported clean PDF to:\n${saveDest.filePath}` });
    return { success: true, filePath: saveDest.filePath };
  }
  return { success: false };
});

// 9a. Open PDF in OS Default Viewer
ipcMain.handle("open-pdf-external", async (event, targetRelPath) => {
  if (!activeProjectDir) return { success: false, error: "No project open" };
  const target = targetRelPath ? String(targetRelPath).replace(/^[\\\/]+/, "") : "main.pdf";
  const pdfPath = path.resolve(activeProjectDir, target);
  if (!pdfPath.startsWith(path.resolve(activeProjectDir))) {
    return { success: false, error: "Invalid path" };
  }
  if (!fs.existsSync(pdfPath)) {
    return { success: false, error: "PDF not found" };
  }
  const errMsg = await shell.openPath(pdfPath);
  return errMsg ? { success: false, error: errMsg } : { success: true };
});

// 9b. Scan all available PDFs in Project (for PDF Preview Switcher)
ipcMain.handle("get-project-pdfs", async () => {
  if (!activeProjectDir) return { success: false, pdfs: [] };
  const pdfList = [];
  function scanPdfs(dir, rel = "") {
    try {
      const entries = fs.readdirSync(dir, { withFileTypes: true });
      for (const ent of entries) {
        if (ent.name === ".build" || ent.name === "node_modules" || ent.name.startsWith(".")) continue;
        const relPath = path.join(rel, ent.name).replace(/\\/g, "/");
        const fullPath = path.join(dir, ent.name);
        if (ent.isDirectory()) {
          scanPdfs(fullPath, relPath);
        } else if (/\.pdf$/i.test(ent.name)) {
          try {
            const stat = fs.statSync(fullPath);
            pdfList.push({
              name: ent.name,
              relPath: relPath,
              sizeBytes: stat.size,
              mtime: stat.mtimeMs,
              isMain: ent.name.toLowerCase() === "main.pdf"
            });
          } catch (e) {}
        }
      }
    } catch (e) {}
  }
  scanPdfs(activeProjectDir);
  // Sort so main.pdf is always on top, followed by root PDFs, then subdirectory PDFs
  pdfList.sort((a, b) => {
    if (a.isMain) return -1;
    if (b.isMain) return 1;
    const aDepth = (a.relPath.match(/\//g) || []).length;
    const bDepth = (b.relPath.match(/\//g) || []).length;
    if (aDepth !== bDepth) return aDepth - bDepth;
    return a.name.localeCompare(b.name);
  });
  return { success: true, pdfs: pdfList };
});

// 9c. Scan Standalone Document Roots (LaTeX files containing \documentclass)
ipcMain.handle("get-standalone-roots", async () => {
  if (!activeProjectDir) return { success: false, roots: [] };
  const roots = [];
  function scanRoots(dir, rel = "") {
    try {
      const entries = fs.readdirSync(dir, { withFileTypes: true });
      for (const ent of entries) {
        if (ent.name === ".build" || ent.name === "node_modules" || ent.name.startsWith(".")) continue;
        const relPath = path.join(rel, ent.name).replace(/\\/g, "/");
        const fullPath = path.join(dir, ent.name);
        if (ent.isDirectory()) {
          scanRoots(fullPath, relPath);
        } else if (/\.tex$/i.test(ent.name)) {
          try {
            const content = fs.readFileSync(fullPath, "utf-8");
            if (content.includes("\\documentclass")) {
              roots.push({
                name: ent.name,
                relPath: relPath,
                isMain: ent.name.toLowerCase() === "main.tex"
              });
            }
          } catch (e) {}
        }
      }
    } catch (e) {}
  }
  scanRoots(activeProjectDir);
  // Sort: main.tex on top, then alphabetical
  roots.sort((a, b) => {
    if (a.isMain) return -1;
    if (b.isMain) return 1;
    return a.name.localeCompare(b.name);
  });
  return { success: true, roots: roots };
});

// 10. Scan Full Project Files Content (for word count)
ipcMain.handle("get-all-tex-contents", async () => {
  if (!activeProjectDir) return { success: false, files: [] };
  const texFiles = [];
  function scan(dir, rel = "") {
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const ent of entries) {
      if (ent.name === ".build" || ent.name === "node_modules" || ent.name.startsWith(".")) continue;
      const relPath = path.join(rel, ent.name).replace(/\\/g, "/");
      const fullPath = path.join(dir, ent.name);
      if (ent.isDirectory()) {
        scan(fullPath, relPath);
      } else if (/\.tex$/i.test(ent.name)) {
        try {
          const content = fs.readFileSync(fullPath, "utf-8");
          texFiles.push({ name: ent.name, path: relPath, content });
        } catch (e) {}
      }
    }
  }
  scan(activeProjectDir);
  return { success: true, files: texFiles };
});

// 11. Browse & Stage Image into Project's figures/ directory
ipcMain.handle("stage-figure-dialog", async () => {
  if (!activeProjectDir) {
    dialog.showErrorBox("No Project Open", "Please open or create a project first before inserting images.");
    return { success: false, error: "No project open" };
  }

  const res = await dialog.showOpenDialog(mainWindow, {
    title: "Select Figure / Image to Insert",
    filters: [
      { name: "All Supported Images", extensions: ["png", "jpg", "jpeg", "pdf", "eps", "webp"] },
      { name: "Bitmap Images", extensions: ["png", "jpg", "jpeg", "webp"] },
      { name: "Vector Graphics", extensions: ["pdf", "eps"] }
    ],
    properties: ["openFile"]
  });

  if (res.canceled || res.filePaths.length === 0) {
    return { success: false, canceled: true };
  }

  const sourcePath = res.filePaths[0];
  const figuresDir = path.join(activeProjectDir, "figures");
  fs.mkdirSync(figuresDir, { recursive: true });

  const fileName = path.basename(sourcePath);
  const destPath = path.join(figuresDir, fileName);

  try {
    fs.copyFileSync(sourcePath, destPath);

    // Read preview thumbnail data URI for browser preview
    const buffer = fs.readFileSync(destPath);
    const ext = path.extname(fileName).toLowerCase().replace(".", "");
    const mimeType = (ext === "pdf" || ext === "eps") ? "application/octet-stream" : `image/${ext === "jpg" ? "jpeg" : ext}`;
    const dataUri = `data:${mimeType};base64,${buffer.toString("base64")}`;

    return {
      success: true,
      fileName: fileName,
      relPath: `figures/${fileName}`.replace(/\\/g, "/"),
      dataUri: dataUri
    };
  } catch (err) {
    return { success: false, error: err.message };
  }
});

// 12. Bidirectional SyncTeX - Inverse Sync (PDF -> Source Code)
ipcMain.handle("synctex-inverse", async (event, { page, x, y, pdfFile }) => {
  if (!activeProjectDir) return { success: false, error: "No active project" };

  const synctexBin = engines["synctex"] || "synctex";
  const targetPdf = pdfFile ? String(pdfFile).replace(/^[\\\/]+/, "") : "main.pdf";
  const pdfPath = path.isAbsolute(targetPdf) ? targetPdf : path.join(activeProjectDir, targetPdf);
  const buildDir = path.join(activeProjectDir, ".build");

  return new Promise((resolve) => {
    const roundX = Math.round(x * 10) / 10;
    const roundY = Math.round(y * 10) / 10;
    const coordArg = `${page}:${roundX}:${roundY}:${path.basename(pdfPath)}`;
    const args = ["edit", "-o", coordArg, "-d", buildDir];

    execFile(synctexBin, args, { cwd: activeProjectDir, windowsHide: true }, (err, stdout) => {
      if (err || !stdout) {
        return resolve({ success: false, error: "SyncTeX edit lookup failed" });
      }

      const inputMatch = stdout.match(/Input:(.+)/m);
      const lineMatch = stdout.match(/Line:(\d+)/m);
      const colMatch = stdout.match(/Column:(-?\d+)/m);

      if (!inputMatch || !lineMatch) {
        return resolve({ success: false, error: "No location match found" });
      }

      let rawInput = inputMatch[1].trim();
      let relPath = rawInput;
      if (path.isAbsolute(rawInput)) {
        relPath = path.relative(activeProjectDir, rawInput).replace(/\\/g, "/");
      }

      resolve({
        success: true,
        file: relPath,
        line: parseInt(lineMatch[1], 10),
        column: colMatch ? Math.max(0, parseInt(colMatch[1], 10)) : 0
      });
    });
  });
});

// 13. Bidirectional SyncTeX - Forward Sync (Source Code -> PDF)
ipcMain.handle("synctex-forward", async (event, { file, line, column, pdfFile }) => {
  if (!activeProjectDir) return { success: false, error: "No active project" };

  const synctexBin = engines["synctex"] || "synctex";
  const targetPdf = pdfFile ? String(pdfFile).replace(/^[\\\/]+/, "") : "main.pdf";
  const pdfPath = path.isAbsolute(targetPdf) ? targetPdf : path.join(activeProjectDir, targetPdf);
  const buildDir = path.join(activeProjectDir, ".build");
  const fullInputPath = path.isAbsolute(file) ? file : path.join(activeProjectDir, file);

  return new Promise((resolve) => {
    const inputArg = `${line}:${column || 1}:${fullInputPath}`;
    const args = ["view", "-i", inputArg, "-o", path.basename(pdfPath), "-d", buildDir];

    execFile(synctexBin, args, { cwd: activeProjectDir, windowsHide: true }, (err, stdout) => {
      if (err || !stdout) return resolve({ success: false, error: "SyncTeX view lookup failed" });

      const pageMatch = stdout.match(/Page:(\d+)/m);
      const xMatch = stdout.match(/x:([\d.]+)/m);
      const yMatch = stdout.match(/y:([\d.]+)/m);
      const wMatch = stdout.match(/W:([\d.]+)/m);
      const hMatch = stdout.match(/H:([\d.]+)/m);

      if (!pageMatch) return resolve({ success: false, error: "Page not found" });

      resolve({
        success: true,
        page: parseInt(pageMatch[1], 10),
        x: xMatch ? parseFloat(xMatch[1]) : 0,
        y: yMatch ? parseFloat(yMatch[1]) : 0,
        width: wMatch ? parseFloat(wMatch[1]) : 0,
        height: hMatch ? parseFloat(hMatch[1]) : 0
      });
    });
  });
});

// App Lifecycle & Single-Instance Jump List Routing
const gotSingleInstanceLock = app.requestSingleInstanceLock();
if (!gotSingleInstanceLock) {
  app.quit();
} else {
  app.on("second-instance", (_event, argv) => {
    const requestedDir = parseProjectArg(argv);
    if (argv && argv.includes("--new-window")) {
      createWindow();
      return;
    }
    if (mainWindow && !mainWindow.isDestroyed()) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.focus();
      if (requestedDir) {
        activeProjectDir = requestedDir;
        recordRecentProject(activeProjectDir);
        mainWindow.webContents.send("menu-open-project", activeProjectDir);
      }
    }
  });

  app.whenReady().then(() => {
    if (startupProjectArg) {
      recordRecentProject(startupProjectArg);
    }
    createWindow();
  });
}

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});

app.on("activate", () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow();
});
