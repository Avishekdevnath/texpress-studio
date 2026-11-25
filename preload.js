/**
 * TeXPress Studio - Electron Preload Script
 * Exposes a secure API bridge (electronAPI) to the renderer window.
 */

const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("electronAPI", {
  isElectron: true,
  getProject: () => ipcRenderer.invoke("get-project"),
  openProjectDialog: () => ipcRenderer.invoke("open-project-dialog"),
  openSampleProject: () => ipcRenderer.invoke("open-sample-project"),
  createProject: (data) => ipcRenderer.invoke("create-project", data),
  closeProject: () => ipcRenderer.invoke("close-project"),
  readFile: (relPath) => ipcRenderer.invoke("read-file", relPath),
  saveFile: (data) => ipcRenderer.invoke("save-file", data),
  compile: (data) => ipcRenderer.invoke("compile", data),
  getPdfData: (targetRelPath) => ipcRenderer.invoke("get-pdf-data", targetRelPath),
  exportPdf: (targetRelPath) => ipcRenderer.invoke("export-pdf", targetRelPath),
  getProjectPdfs: () => ipcRenderer.invoke("get-project-pdfs"),
  getStandaloneRoots: () => ipcRenderer.invoke("get-standalone-roots"),
  synctexInverse: (data) => ipcRenderer.invoke("synctex-inverse", data),
  synctexForward: (data) => ipcRenderer.invoke("synctex-forward", data),
  openPdfExternal: (targetRelPath) => ipcRenderer.invoke("open-pdf-external", targetRelPath),
  getAllTexContents: () => ipcRenderer.invoke("get-all-tex-contents"),
  stageFigureDialog: () => ipcRenderer.invoke("stage-figure-dialog"),
  createFile: (data) => ipcRenderer.invoke("create-file", data),
  createFolder: (data) => ipcRenderer.invoke("create-folder", data),
  renameItem: (data) => ipcRenderer.invoke("rename-item", data),
  deleteItem: (data) => ipcRenderer.invoke("delete-item", data),
  revealInExplorer: (data) => ipcRenderer.invoke("reveal-in-explorer", data),
  detectDocumentEngine: (data) => ipcRenderer.invoke("detect-document-engine", data),
  getLatexEngines: () => ipcRenderer.invoke("get-latex-engines"),
  setNativeTheme: (theme) => ipcRenderer.invoke("set-native-theme", theme),
  getRecentProjects: () => ipcRenderer.invoke("get-recent-projects"),
  openRecentProject: (dirPath) => ipcRenderer.invoke("open-recent-project", dirPath),
  clearRecentProjects: () => ipcRenderer.invoke("clear-recent-projects"),
  confirmForceClose: () => ipcRenderer.invoke("confirm-force-close"),
  
  // Native menu event listeners
  onMenuCompile: (callback) => ipcRenderer.on("menu-compile", callback),
  onMenuInsert: (callback) => ipcRenderer.on("menu-insert", (event, type) => callback(type)),
  onMenuSave: (callback) => ipcRenderer.on("menu-save", callback),
  onMenuViewMode: (callback) => ipcRenderer.on("menu-view-mode", (event, mode) => callback(mode)),
  onMenuToggleExplorer: (callback) => ipcRenderer.on("menu-toggle-explorer", callback),
  onMenuToggleWrap: (callback) => ipcRenderer.on("menu-toggle-wrap", callback),
  onMenuToggleNumbers: (callback) => ipcRenderer.on("menu-toggle-numbers", callback),
  onMenuOpenProject: (callback) => ipcRenderer.on("menu-open-project", callback),
  onMenuOpenSample: (callback) => ipcRenderer.on("menu-open-sample", callback),
  onMenuNewProject: (callback) => ipcRenderer.on("menu-new-project", callback),
  onMenuCloseProject: (callback) => ipcRenderer.on("menu-close-project", callback),
  onMenuCloseTab: (callback) => ipcRenderer.on("menu-close-tab", callback),
  onMenuOpenTableWizard: (callback) => ipcRenderer.on("menu-open-table-wizard", callback),
  onMenuOpenFigureWizard: (callback) => ipcRenderer.on("menu-open-figure-wizard", callback),
  onMenuOpenWordCount: (callback) => ipcRenderer.on("menu-open-word-count", callback),
  onMenuToggleSymbols: (callback) => ipcRenderer.on("menu-toggle-symbols", callback),
  onMenuForwardSync: (callback) => ipcRenderer.on("menu-forward-sync", callback),
  onMenuToggleAutoCompile: (callback) => ipcRenderer.on("menu-toggle-autocompile", callback),
  onMenuSetBuildTarget: (callback) => ipcRenderer.on("menu-set-build-target", (event, target) => callback(target)),
  onMenuToggleTheme: (callback) => ipcRenderer.on("menu-toggle-theme", callback),
  onRecentProjectsUpdated: (callback) => ipcRenderer.on("recent-projects-updated", (_event, list) => callback(list)),
  onCheckUnsavedBeforeClose: (callback) => ipcRenderer.on("check-unsaved-before-close", callback)
});
