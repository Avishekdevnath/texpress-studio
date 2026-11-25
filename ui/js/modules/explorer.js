/**
 * TeXPress Studio - VS Code Style Hierarchical File Tree Explorer
 * Fully interactive with New File, New Folder, Inline Creation, Rename, Delete, Copy Path, and Context Menu.
 * Zero-compromise VS Code parity: Folder selection determines creation scope; inline creation row in-tree.
 */

window.TeXPressExplorer = (function() {
  const expandedFolders = new Set(["chapters", "figures"]);
  let activeSelection = {
    path: null,
    type: null // "directory" | "file"
  };
  let activeContextItem = null;
  let clickDebounceTimer = null;

  function renderTree(treeData, container, projectName) {
    if (!container) return;
    if (!treeData || treeData.length === 0) {
      container.innerHTML = '<div style="padding: 12px; color: var(--text-muted); font-size: 11px;">No files found.</div>';
      return;
    }

    let html = `
      <div class="vscode-explorer-root">
        <div class="vscode-tree-header">
          <div class="vscode-header-title" onclick="TeXPressExplorer.toggleRoot()">
            <span class="vscode-chevron">⌄</span>
            <span style="font-weight: 700; text-transform: uppercase;">${escapeHtml(projectName || "PROJECT")}</span>
          </div>
          <div class="vscode-header-actions">
            <button class="vscode-icon-btn" onclick="TeXPressExplorer.startInlineCreation('file')" title="New File...">
              <svg width="13" height="13" viewBox="0 0 16 16" fill="currentColor"><path d="M9 1H4a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2h8a2 2 0 0 0 2-2V6L9 1zm0 1.5L12.5 6H9V2.5zM8 8v2H6v1h2v2h1v-2h2v-1H9V8H8z"/></svg>
            </button>
            <button class="vscode-icon-btn" onclick="TeXPressExplorer.startInlineCreation('folder')" title="New Folder...">
              <svg width="13" height="13" viewBox="0 0 16 16" fill="currentColor"><path d="M1 3.5A1.5 1.5 0 0 1 2.5 2h3.764a1.5 1.5 0 0 1 1.06.44L8.707 3.829a.5.5 0 0 0 .354.146H13.5A1.5 1.5 0 0 1 15 5.5v2.05a2.5 2.5 0 0 0-1-.05V5.5a.5.5 0 0 0-.5-.5H9.06a1.5 1.5 0 0 1-1.06-.44L6.615 3.171A.5.5 0 0 0 6.264 3H2.5a.5.5 0 0 0-.5.5V13a.5.5 0 0 0 .5.5H8v1H2.5A1.5 1.5 0 0 1 1 13V3.5z"/><path d="M13.5 10a.5.5 0 0 1 .5.5v1.5h1.5a.5.5 0 0 1 0 1H14V14.5a.5.5 0 0 1-1 0V13h-1.5a.5.5 0 0 1 0-1H13V10.5a.5.5 0 0 1 .5-.5z"/></svg>
            </button>
            <button class="vscode-icon-btn" onclick="TeXPressExplorer.refreshTree()" title="Refresh Explorer">
              <svg width="13" height="13" viewBox="0 0 16 16" fill="currentColor"><path fill-rule="evenodd" d="M8 3a5 5 0 1 0 4.546 2.914.5.5 0 0 1 .908-.417A6 6 0 1 1 8 2v1z"/><path d="M8 4.466V.534a.25.25 0 0 1 .41-.192l2.36 1.966c.12.1.12.284 0 .384L8.41 4.658A.25.25 0 0 1 8 4.466z"/></svg>
            </button>
            <button class="vscode-icon-btn" onclick="TeXPressExplorer.collapseAll()" title="Collapse All Folders">
              <svg width="13" height="13" viewBox="0 0 16 16" fill="currentColor"><path d="M9 9H4v1h5V9zM1 3.5A1.5 1.5 0 0 1 2.5 2h11A1.5 1.5 0 0 1 15 3.5v9a1.5 1.5 0 0 1-1.5 1.5h-11A1.5 1.5 0 0 1 1 12.5v-9zM2.5 3a.5.5 0 0 0-.5.5v9a.5.5 0 0 0 .5.5h11a.5.5 0 0 0 .5-.5v-9a.5.5 0 0 0-.5-.5h-11z"/></svg>
            </button>
          </div>
        </div>
        <div class="vscode-tree-body" id="vscodeTreeBody" onclick="TeXPressExplorer.onBodyClick(event)" oncontextmenu="TeXPressExplorer.showRootContextMenu(event)">
          ${renderNodes(treeData, 0)}
        </div>
      </div>
    `;

    container.innerHTML = html;
    ensureContextMenuInDom();
  }

  function renderNodes(nodes, depth) {
    let html = "";
    for (const node of nodes) {
      const indent = depth * 10 + 8;
      if (node.type === "directory") {
        const isExpanded = expandedFolders.has(node.path);
        const chevron = isExpanded ? "⌄" : "›";
        const isFolderSelected = (activeSelection.path === node.path);
        const folderActiveClass = isFolderSelected ? " active" : "";
        html += `
          <div class="vscode-tree-item vscode-tree-folder${folderActiveClass}"
               data-path="${escapeHtml(node.path)}"
               data-depth="${depth}"
               title="${escapeHtml(node.path)}"
               tabindex="0"
               style="padding-left: ${indent}px;"
               onclick="TeXPressExplorer.onFolderClick('${escapeJs(node.path)}', event)"
               oncontextmenu="TeXPressExplorer.showItemContextMenu(event, '${escapeJs(node.path)}', 'directory', '${escapeJs(node.name)}')">
            <span class="vscode-chevron">${chevron}</span>
            <span class="vscode-folder-icon">
              <svg width="14" height="14" viewBox="0 0 16 16" fill="#e5a93c" style="flex-shrink: 0; display: block;"><path d="M1 3.5A1.5 1.5 0 0 1 2.5 2h3.764a1.5 1.5 0 0 1 1.06.44L8.707 3.829a.5.5 0 0 0 .354.146H13.5A1.5 1.5 0 0 1 15 5.5v7a1.5 1.5 0 0 1-1.5 1.5h-11A1.5 1.5 0 0 1 1 12.5v-9z"/></svg>
            </span>
            <span class="vscode-item-name">${escapeHtml(node.name)}</span>
          </div>
        `;
        if (isExpanded) {
          html += `<div class="vscode-folder-children">${node.children && node.children.length > 0 ? renderNodes(node.children, depth + 1) : ""}</div>`;
        }
      } else {
        const icon = getFileIcon(node.name);
        const isFileSelected = (activeSelection.path === node.path) || (window.activeFileKey === node.path);
        const activeClass = isFileSelected ? " active" : "";
        const rootBadge = node.is_root ? '<span class="tree-badge" style="margin-left: auto;">ROOT</span>' : '';
        html += `
          <div class="vscode-tree-item vscode-tree-file${activeClass}"
               data-file="${escapeHtml(node.path)}"
               data-path="${escapeHtml(node.path)}"
               data-depth="${depth}"
               title="${escapeHtml(node.path)}"
               tabindex="0"
               style="padding-left: ${indent + 8}px;"
               onclick="TeXPressExplorer.onFileClick('${escapeJs(node.path)}', event)"
               ondblclick="TeXPressExplorer.onFileDblClick('${escapeJs(node.path)}', event)"
               oncontextmenu="TeXPressExplorer.showItemContextMenu(event, '${escapeJs(node.path)}', 'file', '${escapeJs(node.name)}')">
            <span class="vscode-file-icon">${icon}</span>
            <span class="vscode-item-name">${escapeHtml(node.name)}</span>
            ${rootBadge}
          </div>
        `;
      }
    }
    return html;
  }

  function onFolderClick(folderPath, event) {
    if (event) event.stopPropagation();
    activeSelection = { path: folderPath, type: "directory" };
    activeContextItem = { path: folderPath, type: "directory", name: folderPath.split("/").pop() };
    if (expandedFolders.has(folderPath)) {
      expandedFolders.delete(folderPath);
    } else {
      expandedFolders.add(folderPath);
    }
    if (window.currentProjectTree) {
      renderTree(window.currentProjectTree, document.getElementById("fileTreeContainer"), window.currentProjectName);
    }
  }

  function onFileClick(filePath, event) {
    if (event) event.stopPropagation();
    activeSelection = { path: filePath, type: "file" };
    activeContextItem = { path: filePath, type: "file", name: filePath.split("/").pop() };
    // Visually highlight active item and set focus
    const container = document.getElementById("fileTreeContainer");
    if (container) {
      container.querySelectorAll(".vscode-tree-item").forEach(el => el.classList.remove("active"));
      const targetEl = Array.from(container.querySelectorAll(".vscode-tree-item")).find(el => el.getAttribute("data-path") === filePath);
      if (targetEl) targetEl.classList.add("active");
    }
    if (clickDebounceTimer) {
      clearTimeout(clickDebounceTimer);
    }
    clickDebounceTimer = setTimeout(() => {
      clickDebounceTimer = null;
      if (typeof window.loadFile === "function") {
        window.loadFile(filePath, { isPreview: true });
      }
    }, 220);
  }

  function onFileDblClick(filePath, event) {
    if (event) event.stopPropagation();
    if (clickDebounceTimer) {
      clearTimeout(clickDebounceTimer);
      clickDebounceTimer = null;
    }
    if (typeof window.pinTab === "function") {
      window.pinTab(filePath);
    }
    if (typeof window.loadFile === "function") {
      window.loadFile(filePath, { isPreview: false });
    }
  }

  function onBodyClick(event) {
    if (event.target.classList.contains("vscode-tree-body") || event.target.id === "fileTreeContainer") {
      activeSelection = { path: "", type: "directory" };
      const container = document.getElementById("fileTreeContainer");
      if (container) {
        container.querySelectorAll(".vscode-tree-item").forEach(el => el.classList.remove("active"));
      }
    }
  }

  function getTargetDirectory() {
    if (activeSelection.type === "directory" && activeSelection.path) {
      return activeSelection.path;
    }
    if (activeSelection.type === "file" && activeSelection.path) {
      return activeSelection.path.includes("/")
        ? activeSelection.path.substring(0, activeSelection.path.lastIndexOf("/"))
        : "";
    }
    if (window.activeFileKey && window.activeFileKey.includes("/")) {
      return window.activeFileKey.substring(0, window.activeFileKey.lastIndexOf("/"));
    }
    return "";
  }

  function getFileIcon(fileName) {
    const lower = fileName.toLowerCase();
    if (lower.endsWith(".tex")) {
      return `<svg width="14" height="14" viewBox="0 0 16 16" fill="#0b57d0" style="flex-shrink: 0; display: block;"><path d="M4 0h5.5v3.5a1.5 1.5 0 0 0 1.5 1.5H14v10a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V1a1 1 0 0 1 1-1zm6 0v3.5a.5.5 0 0 0 .5.5H14L10 0z"/><text x="4" y="12" font-size="5" font-weight="bold" fill="#ffffff" font-family="sans-serif">TeX</text></svg>`;
    }
    if (lower.endsWith(".bib")) {
      return `<svg width="14" height="14" viewBox="0 0 16 16" fill="#b06000" style="flex-shrink: 0; display: block;"><path d="M1 2.828c.885-.37 2.154-.769 3.388-.893 1.33-.134 2.458.063 3.112.752v9.746c-.935-.53-2.12-.603-3.213-.493-1.18.12-2.37.461-3.287.811V2.828zm7.5-.141c.654-.689 1.782-.886 3.112-.752 1.234.124 2.503.523 3.388.893v9.923c-.918-.35-2.107-.692-3.287-.81-1.094-.111-2.278-.039-3.213.492V2.687z"/></svg>`;
    }
    if (lower.endsWith(".pdf")) {
      return `<svg width="14" height="14" viewBox="0 0 16 16" fill="#b3261e" style="flex-shrink: 0; display: block;"><path d="M4 0h5.5v3.5a1.5 1.5 0 0 0 1.5 1.5H14v10a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V1a1 1 0 0 1 1-1zm6 0v3.5a.5.5 0 0 0 .5.5H14L10 0z"/><text x="4" y="12" font-size="4.5" font-weight="bold" fill="#ffffff" font-family="sans-serif">PDF</text></svg>`;
    }
    if (/\.(png|jpg|jpeg|svg|webp|eps|gif)$/.test(lower)) {
      return `<svg width="14" height="14" viewBox="0 0 16 16" fill="#7b1fa2" style="flex-shrink: 0; display: block;"><path d="M2.5 1A1.5 1.5 0 0 0 1 2.5v11A1.5 1.5 0 0 0 2.5 15h11a1.5 1.5 0 0 0 1.5-1.5v-11A1.5 1.5 0 0 0 13.5 1h-11zm8 3.5a1.5 1.5 0 1 1-3 0 1.5 1.5 0 0 1 3 0zm-8.5 8 3.5-4.5 2.5 3 3.5-4.5 3.5 6h-13z"/></svg>`;
    }
    return `<svg width="14" height="14" viewBox="0 0 16 16" fill="var(--text-muted)" style="flex-shrink: 0; display: block;"><path d="M4 0h5.5v3.5a1.5 1.5 0 0 0 1.5 1.5H14v10a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V1a1 1 0 0 1 1-1zm6 0v3.5a.5.5 0 0 0 .5.5H14L10 0z"/></svg>`;
  }

  function toggleFolder(folderPath) {
    if (expandedFolders.has(folderPath)) {
      expandedFolders.delete(folderPath);
    } else {
      expandedFolders.add(folderPath);
    }
    if (window.currentProjectTree) {
      renderTree(window.currentProjectTree, document.getElementById("fileTreeContainer"), window.currentProjectName);
    }
  }

  function collapseAll() {
    expandedFolders.clear();
    if (window.currentProjectTree) {
      renderTree(window.currentProjectTree, document.getElementById("fileTreeContainer"), window.currentProjectName);
    }
  }

  function refreshTree() {
    if (typeof window.loadProject === "function") {
      window.loadProject();
    }
  }

  // ========================================================================
  // VS Code Native Inline Tree Creation (File or Folder)
  // ========================================================================
  function startInlineCreation(type, forcedTargetDir = null) {
    hideContextMenu();
    cancelInlineCreation();

    let targetDir = "";
    if (forcedTargetDir !== null && forcedTargetDir !== undefined) {
      targetDir = forcedTargetDir;
    } else {
      targetDir = getTargetDirectory();
    }

    // Ensure target folder is expanded
    if (targetDir) {
      expandedFolders.add(targetDir);
      if (window.currentProjectTree) {
        renderTree(window.currentProjectTree, document.getElementById("fileTreeContainer"), window.currentProjectName);
      }
    }

    let parentContainer = null;
    let depth = 0;

    if (targetDir) {
      const allFolders = Array.from(document.querySelectorAll(".vscode-tree-folder"));
      const folderEl = allFolders.find(el => el.getAttribute("data-path") === targetDir);
      if (folderEl) {
        depth = parseInt(folderEl.getAttribute("data-depth") || "0", 10) + 1;
        let childrenEl = folderEl.nextElementSibling;
        if (!childrenEl || !childrenEl.classList.contains("vscode-folder-children")) {
          childrenEl = document.createElement("div");
          childrenEl.className = "vscode-folder-children";
          folderEl.parentNode.insertBefore(childrenEl, folderEl.nextSibling);
        }
        parentContainer = childrenEl;
        const chevron = folderEl.querySelector(".vscode-chevron");
        if (chevron) chevron.textContent = "⌄";
      }
    }

    if (!parentContainer) {
      parentContainer = document.getElementById("vscodeTreeBody");
      depth = 0;
    }
    if (!parentContainer) return;

    const isFileLike = (type === "file" || type === "standalone");
    const indent = depth * 10 + 8 + (isFileLike ? 8 : 0);
    const iconHtml = isFileLike
      ? `<span class="vscode-file-icon">${getFileIcon("file.tex")}</span>`
      : `<span class="vscode-folder-icon"><svg width="14" height="14" viewBox="0 0 16 16" fill="#e5a93c" style="flex-shrink: 0; display: block;"><path d="M1 3.5A1.5 1.5 0 0 1 2.5 2h3.764a1.5 1.5 0 0 1 1.06.44L8.707 3.829a.5.5 0 0 0 .354.146H13.5A1.5 1.5 0 0 1 15 5.5v7a1.5 1.5 0 0 1-1.5 1.5h-11A1.5 1.5 0 0 1 1 12.5v-9z"/></svg></span>`;

    const inlineRow = document.createElement("div");
    inlineRow.id = "vscodeInlineCreationRow";
    inlineRow.className = "vscode-tree-item vscode-inline-row";
    inlineRow.style.paddingLeft = `${indent}px`;
    const placeholder = type === "standalone" ? "standalone_doc.tex" : (type === "file" ? "filename.tex" : "folder_name");
    inlineRow.innerHTML = `
      ${type === "folder" ? '<span class="vscode-chevron">›</span>' : ''}
      ${iconHtml}
      <input type="text" class="vscode-inline-input" spellcheck="false" autocomplete="off" placeholder="${placeholder}" />
    `;

    if (parentContainer.firstChild) {
      parentContainer.insertBefore(inlineRow, parentContainer.firstChild);
    } else {
      parentContainer.appendChild(inlineRow);
    }

    const input = inlineRow.querySelector(".vscode-inline-input");
    if (!input) return;

    let isHandled = false;

    async function commit() {
      if (isHandled) return;
      isHandled = true;
      const rawVal = input.value.trim();
      if (!rawVal) {
        cancelInlineCreation();
        return;
      }

      let cleanName = rawVal.replace(/^[/\\]+/, "").trim();
      if ((type === "file" || type === "standalone") && !cleanName.includes(".")) {
        cleanName += ".tex";
      }

      const fullRelPath = targetDir ? `${targetDir}/${cleanName}` : cleanName;
      cancelInlineCreation();

      if (type === "file" || type === "standalone") {
        if (window.electronAPI && window.electronAPI.createFile) {
          const res = await window.electronAPI.createFile({ relPath: fullRelPath });
          if (res && res.success) {
            const createdPath = res.relPath || fullRelPath;
            if (type === "standalone" && window.electronAPI.saveFile) {
              const docTitle = cleanName.replace(/\.tex$/i, "").replace(/[_-]+/g, " ");
              const skeleton = [
                "\\documentclass[11pt,a4paper]{article}",
                "\\usepackage[utf8]{inputenc}",
                "\\usepackage{amsmath,amssymb,graphicx}",
                "",
                `\\title{${docTitle}}`,
                "\\author{Author Name}",
                "\\date{\\today}",
                "",
                "\\begin{document}",
                "\\maketitle",
                "",
                "\\section{Introduction}",
                "Start writing here...",
                "",
                "\\end{document}",
                ""
              ].join("\n");
              await window.electronAPI.saveFile({ path: createdPath, content: skeleton });
            }
            if (targetDir) expandedFolders.add(targetDir);
            activeSelection = { path: createdPath, type: "file" };
            await window.loadProject();
            if (typeof window.loadFile === "function") {
              window.loadFile(createdPath, { isPreview: false });
            }
          } else {
            if (typeof window.showToast === "function") {
              window.showToast("Error creating file: " + (res.error || "Unknown error"), "error");
            } else {
              alert("Error creating file: " + (res.error || "Unknown error"));
            }
          }
        }
      } else {
        if (window.electronAPI && window.electronAPI.createFolder) {
          const res = await window.electronAPI.createFolder({ relPath: fullRelPath });
          if (res && res.success) {
            expandedFolders.add(fullRelPath);
            if (targetDir) expandedFolders.add(targetDir);
            activeSelection = { path: fullRelPath, type: "directory" };
            await window.loadProject();
          } else {
            if (typeof window.showToast === "function") {
              window.showToast("Error creating folder: " + (res.error || "Unknown error"), "error");
            } else {
              alert("Error creating folder: " + (res.error || "Unknown error"));
            }
          }
        }
      }
    }

    input.addEventListener("keydown", (e) => {
      if (e.key === "Enter") {
        e.preventDefault();
        e.stopPropagation();
        commit();
      } else if (e.key === "Escape") {
        e.preventDefault();
        e.stopPropagation();
        isHandled = true;
        cancelInlineCreation();
      }
    });

    input.addEventListener("blur", () => {
      setTimeout(() => {
        if (!isHandled) {
          if (input.value && input.value.trim()) {
            commit();
          } else {
            cancelInlineCreation();
          }
        }
      }, 150);
    });

    setTimeout(() => {
      input.focus();
    }, 30);
  }

  function cancelInlineCreation() {
    const el = document.getElementById("vscodeInlineCreationRow");
    if (el) el.remove();
  }

  // ========================================================================
  // Right-Click Context Menu & Keyboard Navigation Implementation
  // ========================================================================
  function getSelectedPath() {
    if (activeSelection && activeSelection.path) {
      return activeSelection.path;
    }
    if (activeContextItem && activeContextItem.path) {
      return activeContextItem.path;
    }
    const container = document.getElementById("fileTreeContainer");
    if (container) {
      const activeEl = container.querySelector(".vscode-tree-item.active") || container.querySelector(".vscode-tree-item:focus");
      if (activeEl) {
        return activeEl.getAttribute("data-path");
      }
    }
    return null;
  }

  let isKeyboardListenerAttached = false;
  function setupKeyboardListeners() {
    if (isKeyboardListenerAttached) return;
    isKeyboardListenerAttached = true;

    window.addEventListener("keydown", (e) => {
      const activeEl = document.activeElement;
      const tag = (activeEl && activeEl.tagName) || "";
      const isInput = tag === "INPUT" || tag === "TEXTAREA" || (activeEl && activeEl.isContentEditable);
      const isCodeMirror = activeEl && activeEl.closest && activeEl.closest(".CodeMirror");

      if (e.key === "Escape") {
        hideContextMenu();
        cancelInlineCreation();
        return;
      }

      // If user is actively typing in an input field or in CodeMirror editor, don't hijack Delete/F2
      if (isInput || isCodeMirror) {
        return;
      }

      // If delete modal or quick input is currently open, let the modal handle Enter/Escape
      const delModal = document.getElementById("deleteConfirmModal");
      if (delModal && delModal.style.display === "flex") return;
      const qiModal = document.getElementById("quickInputModal");
      if (qiModal && qiModal.style.display === "flex") return;
      const tcModal = document.getElementById("tabCloseModal");
      if (tcModal && tcModal.style.display === "flex") return;

      const targetPath = getSelectedPath();
      if (!targetPath) return;

      // F2 -> Rename selected item
      if (e.key === "F2") {
        e.preventDefault();
        e.stopPropagation();
        promptRename(targetPath);
        return;
      }

      // Delete or Shift+Delete -> Delete selected file or folder
      if (e.key === "Delete" || e.code === "Delete" || e.code === "NumpadDecimal") {
        e.preventDefault();
        e.stopPropagation();
        confirmDelete(targetPath, e.shiftKey);
        return;
      }
    }, true);
  }

  function ensureContextMenuInDom() {
    setupKeyboardListeners();
    let menu = document.getElementById("vscodeContextMenu");
    if (!menu) {
      menu = document.createElement("div");
      menu.id = "vscodeContextMenu";
      menu.className = "vscode-context-menu";
      menu.style.display = "none";
      document.body.appendChild(menu);

      // Dismiss on window click
      document.addEventListener("click", () => hideContextMenu());
    }
  }

  function showItemContextMenu(e, itemPath, itemType, itemName) {
    e.preventDefault();
    e.stopPropagation();
    activeContextItem = { path: itemPath, type: itemType, name: itemName };
    activeSelection = { path: itemPath, type: itemType };

    const menu = document.getElementById("vscodeContextMenu");
    if (!menu) return;

    let itemsHtml = "";
    if (itemType === "directory") {
      itemsHtml += `
        <div class="vscode-menu-item" onclick="TeXPressExplorer.startInlineCreation('file', '${escapeJs(itemPath)}')">
          <span>New File...</span>
        </div>
        <div class="vscode-menu-item" onclick="TeXPressExplorer.startInlineCreation('standalone', '${escapeJs(itemPath)}')">
          <span>New Standalone Document...</span>
        </div>
        <div class="vscode-menu-item" onclick="TeXPressExplorer.startInlineCreation('folder', '${escapeJs(itemPath)}')">
          <span>New Folder...</span>
        </div>
        <div class="vscode-menu-separator"></div>
      `;
    } else if (itemType === "file") {
      const parentDir = itemPath.includes("/") ? itemPath.substring(0, itemPath.lastIndexOf("/")) : "";
      itemsHtml += `
        <div class="vscode-menu-item" onclick="TeXPressExplorer.startInlineCreation('file', '${escapeJs(parentDir)}')">
          <span>New File...</span>
        </div>
        <div class="vscode-menu-item" onclick="TeXPressExplorer.startInlineCreation('standalone', '${escapeJs(parentDir)}')">
          <span>New Standalone Document...</span>
        </div>
        <div class="vscode-menu-item" onclick="TeXPressExplorer.startInlineCreation('folder', '${escapeJs(parentDir)}')">
          <span>New Folder...</span>
        </div>
        <div class="vscode-menu-separator"></div>
      `;
      const lowerName = itemName.toLowerCase();
      if (lowerName.endsWith(".tex")) {
        itemsHtml += `
          <div class="vscode-menu-item" onclick="TeXPressExplorer.hideContextMenu(); window.compileSpecificFile('${escapeJs(itemPath)}')">
            <span>⚡ Compile Document (XeLaTeX)</span>
          </div>
          <div class="vscode-menu-item" onclick="TeXPressExplorer.hideContextMenu(); window.setAsMasterRoot('${escapeJs(itemPath)}')">
            <span>🎯 Set as Build Target Root</span>
          </div>
          <div class="vscode-menu-separator"></div>
        `;
      } else if (lowerName.endsWith(".pdf")) {
        itemsHtml += `
          <div class="vscode-menu-item" onclick="TeXPressExplorer.hideContextMenu(); window.viewPdfInPane('${escapeJs(itemPath)}')">
            <span>👁️ View in PDF Preview Pane</span>
          </div>
          <div class="vscode-menu-item" onclick="TeXPressExplorer.hideContextMenu(); window.openPdfExternally('${escapeJs(itemPath)}')">
            <span>↗️ Open in External Reader</span>
          </div>
          <div class="vscode-menu-separator"></div>
        `;
      }
    }

    itemsHtml += `
      <div class="vscode-menu-item" onclick="TeXPressExplorer.copyRelativePath('${escapeJs(itemPath)}')">
        <span>Copy Relative Path</span>
        <span class="vscode-menu-shortcut">Ctrl+Shift+C</span>
      </div>
      <div class="vscode-menu-item" onclick="TeXPressExplorer.copyFullPath('${escapeJs(itemPath)}')">
        <span>Copy Full Path</span>
      </div>
      <div class="vscode-menu-item" onclick="TeXPressExplorer.revealInExplorer('${escapeJs(itemPath)}')">
        <span>Reveal in File Explorer</span>
      </div>
      <div class="vscode-menu-separator"></div>
      <div class="vscode-menu-item" onclick="TeXPressExplorer.promptRename('${escapeJs(itemPath)}')">
        <span>Rename...</span>
        <span class="vscode-menu-shortcut">F2</span>
      </div>
    `;

    if (itemPath !== "main.tex") {
      itemsHtml += `
        <div class="vscode-menu-item" style="color: var(--text-danger);" onclick="TeXPressExplorer.confirmDelete('${escapeJs(itemPath)}')">
          <span>Delete</span>
          <span class="vscode-menu-shortcut">Del</span>
        </div>
      `;
    }

    menu.innerHTML = itemsHtml;
    menu.style.left = `${Math.min(window.innerWidth - 210, e.clientX)}px`;
    menu.style.top = `${Math.min(window.innerHeight - 240, e.clientY)}px`;
    menu.style.display = "block";
  }

  function showRootContextMenu(e) {
    e.preventDefault();
    const menu = document.getElementById("vscodeContextMenu");
    if (!menu) return;

    menu.innerHTML = `
      <div class="vscode-menu-item" onclick="TeXPressExplorer.startInlineCreation('file', '')">
        <span>New File in Root...</span>
      </div>
      <div class="vscode-menu-item" onclick="TeXPressExplorer.startInlineCreation('standalone', '')">
        <span>New Standalone Document...</span>
      </div>
      <div class="vscode-menu-item" onclick="TeXPressExplorer.startInlineCreation('folder', '')">
        <span>New Folder in Root...</span>
      </div>
      <div class="vscode-menu-separator"></div>
      <div class="vscode-menu-item" onclick="TeXPressExplorer.refreshTree()">
        <span>Refresh Explorer</span>
      </div>
      <div class="vscode-menu-item" onclick="TeXPressExplorer.revealInExplorer('')">
        <span>Reveal Project in Explorer</span>
      </div>
    `;
    menu.style.left = `${Math.min(window.innerWidth - 210, e.clientX)}px`;
    menu.style.top = `${Math.min(window.innerHeight - 240, e.clientY)}px`;
    menu.style.display = "block";
  }

  function hideContextMenu() {
    const menu = document.getElementById("vscodeContextMenu");
    if (menu) menu.style.display = "none";
  }

  // Fallback modal prompt helpers for external or programmatic invocations
  async function promptNewFile(parentDir = "") {
    startInlineCreation("file", parentDir);
  }

  async function promptNewFolder(parentDir = "") {
    startInlineCreation("folder", parentDir);
  }

  async function promptRename(oldRelPath) {
    hideContextMenu();
    const oldName = oldRelPath.split("/").pop();
    const dir = oldRelPath.includes("/") ? oldRelPath.substring(0, oldRelPath.lastIndexOf("/")) : "";
    let newName;
    if (typeof window.showQuickInput === "function") {
      newName = await window.showQuickInput({
        title: `<span>✏️ Rename "${oldName}"</span>`,
        label: `Enter new name for "${oldRelPath}":`,
        placeholder: oldName,
        defaultValue: oldName,
        confirmText: "Rename"
      });
    } else {
      newName = prompt(`Rename '${oldName}' to:`, oldName);
    }
    if (!newName || newName.trim() === oldName) return;

    const newRelPath = dir ? `${dir}/${newName.trim()}` : newName.trim();
    if (window.electronAPI && window.electronAPI.renameItem) {
      const res = await window.electronAPI.renameItem({ oldRelPath, newRelPath });
      if (res && res.success) {
        if (Array.isArray(window.openTabs)) {
          const oldPrefix = oldRelPath + "/";
          const newPrefix = newRelPath + "/";
          for (const tab of window.openTabs) {
            if (tab.path === oldRelPath) {
              tab.path = newRelPath;
              tab.name = newRelPath.split("/").pop();
            } else if (tab.path.startsWith(oldPrefix)) {
              tab.path = newPrefix + tab.path.slice(oldPrefix.length);
            }
          }
        }
        if (window.activeFileKey === oldRelPath) {
          window.activeFileKey = newRelPath;
        } else if (window.activeFileKey && window.activeFileKey.startsWith(oldRelPath + "/")) {
          window.activeFileKey = newRelPath + "/" + window.activeFileKey.slice((oldRelPath + "/").length);
        }
        if (typeof window.renderTabBar === "function") {
          window.renderTabBar();
        }
        await window.loadProject();
        if (window.activeFileKey === newRelPath && typeof window.loadFile === "function") {
          const renamedTab = (window.openTabs || []).find(t => t.path === newRelPath);
          window.loadFile(newRelPath, { isPreview: renamedTab ? !!renamedTab.isPreview : false });
        }
      } else {
        if (typeof window.showToast === "function") {
          window.showToast("Rename error: " + (res.error || "Target name already exists"), "error");
        } else {
          alert("Rename error: " + (res.error || "Target name already exists"));
        }
      }
    }
  }

  async function confirmDelete(relPath, isPermanent = false) {
    hideContextMenu();
    const targetPath = relPath || getSelectedPath();
    if (!targetPath) return;

    if (targetPath === "main.tex") {
      if (typeof window.showToast === "function") {
        window.showToast("Cannot delete the root document (main.tex).", "warning");
      } else {
        alert("Cannot delete the root document (main.tex).");
      }
      return;
    }

    const itemName = targetPath.split("/").pop();
    let ok = false;
    if (typeof window.showDeletePrompt === "function") {
      ok = await window.showDeletePrompt(itemName, targetPath, isPermanent);
    } else {
      ok = confirm(isPermanent
        ? `Are you sure you want to permanently delete '${itemName}'?\nPath: ${targetPath}\nThis action cannot be undone.`
        : `Are you sure you want to delete '${itemName}'?\nPath: ${targetPath}`);
    }
    if (!ok) return;

    if (window.electronAPI && window.electronAPI.deleteItem) {
      const res = await window.electronAPI.deleteItem({ relPath: targetPath });
      if (res && res.success) {
        // Close any tabs for deleted file or folder
        if (window.openTabs && window.openTabs.length > 0) {
          const tabsToClose = window.openTabs.filter(t => t.path === targetPath || t.path.startsWith(targetPath + "/"));
          for (const t of tabsToClose) {
            t.isDirty = false;
            if (typeof window.closeTab === "function") {
              await window.closeTab(t.path);
            }
          }
        }
        activeSelection = { path: null, type: null };
        activeContextItem = null;
        await window.loadProject();
        if (typeof window.showToast === "function") {
          window.showToast(`Deleted ${itemName}`, "success");
        }
      } else {
        if (typeof window.showToast === "function") {
          window.showToast("Delete error: " + (res.error || "Could not delete item"), "error");
        } else {
          alert("Delete error: " + (res.error || "Could not delete item"));
        }
      }
    }
  }

  function copyRelativePath(relPath) {
    hideContextMenu();
    navigator.clipboard.writeText(relPath).then(() => {
      if (window.statusCompileNotice) {
        window.statusCompileNotice.textContent = `✓ Copied relative path: ${relPath}`;
        window.statusCompileNotice.style.color = "var(--text-success)";
      }
    });
  }

  async function copyFullPath(relPath) {
    hideContextMenu();
    if (window.electronAPI && window.electronAPI.getProject) {
      const proj = await window.electronAPI.getProject();
      if (proj && proj.projectPath) {
        const full = proj.projectPath + "\\" + relPath.replace(/\//g, "\\");
        navigator.clipboard.writeText(full).then(() => {
          if (window.statusCompileNotice) {
            window.statusCompileNotice.textContent = `✓ Copied full path`;
            window.statusCompileNotice.style.color = "var(--text-success)";
          }
        });
      }
    }
  }

  function revealInExplorer(relPath) {
    hideContextMenu();
    if (window.electronAPI && window.electronAPI.revealInExplorer) {
      window.electronAPI.revealInExplorer({ relPath });
    }
  }

  function escapeHtml(str) {
    return String(str).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/'/g, '&#39;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }

  function escapeJs(str) {
    return String(str).replace(/\\/g, "/").replace(/'/g, "\\'");
  }

  // Initialize keyboard listeners (Del, Shift+Del, F2) immediately
  setupKeyboardListeners();

  return {
    renderTree,
    toggleFolder,
    collapseAll,
    refreshTree,
    onFolderClick,
    onFileClick,
    onFileDblClick,
    onBodyClick,
    startInlineCreation,
    cancelInlineCreation,
    showItemContextMenu,
    showRootContextMenu,
    promptNewFile,
    promptNewFolder,
    promptRename,
    confirmDelete,
    copyRelativePath,
    copyFullPath,
    revealInExplorer,
    hideContextMenu
  };
})();
