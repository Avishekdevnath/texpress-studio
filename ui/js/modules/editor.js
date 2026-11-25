/**
 * TeXPress Studio - CodeMirror LaTeX Syntax Highlighting Editor Engine
 * Full TeX token coloring (macros, math, args, comments) inside the Google Docs Paper Sheet.
 * Features:
 * - Line Wrap Toggle (Alt+Z)
 * - Line Numbers Toggle (Alt+L)
 * - LaTeX Autocomplete & IntelliSense (\ and Ctrl+Space)
 * - Real-time Compiler Error Markers (🔴) and Interactive Hover Quick-Fix
 */

window.TeXPressEditor = (function() {
  let cmInstance = null;
  let activeRelPath = null;
  let isSettingContent = false;
  let errorMarkers = [];
  let isWrapping = localStorage.getItem("texpress_line_wrapping") !== "false";
  let isLineNumbers = localStorage.getItem("texpress_line_numbers") !== "false";
  let activeHoverTimeout = null;

  function init() {
    const textarea = document.getElementById("editorTextarea");
    if (!textarea) return;

    if (typeof CodeMirror !== "undefined" && !cmInstance) {
      cmInstance = CodeMirror.fromTextArea(textarea, {
        mode: "stex",
        inputStyle: "contenteditable",
        spellcheck: true,
        lineNumbers: isLineNumbers,
        lineWrapping: isWrapping,
        gutters: ["CodeMirror-linenumbers", "error-gutter"],
        matchBrackets: true,
        autoCloseBrackets: true,
        indentUnit: 2,
        tabSize: 2,
        extraKeys: {
          "Ctrl-B": () => format("bold"),
          "Ctrl-I": () => format("italic"),
          "Ctrl-U": () => format("underline"),
          "Ctrl-/": (cm) => toggleComment(cm),
          "Cmd-/": (cm) => toggleComment(cm),
          "Ctrl-G": () => promptGoToLine(),
          "Ctrl-W": () => { if (window.closeActiveTab) window.closeActiveTab(); },
          "Ctrl-Alt-J": () => { if (window.triggerForwardSync) window.triggerForwardSync(); },
          "Cmd-Alt-J": () => { if (window.triggerForwardSync) window.triggerForwardSync(); },
          "Alt-Z": () => toggleLineWrapping(),
          "Alt-L": () => toggleLineNumbers(),
          "Ctrl-Space": (cm) => {
            if (window.TeXPressLatexHints) window.TeXPressLatexHints.show(cm);
          },
          "Ctrl-F": () => {
            if (window.TeXPressFindReplace) window.TeXPressFindReplace.toggle(false);
          },
          "Ctrl-H": () => {
            if (window.TeXPressFindReplace) window.TeXPressFindReplace.toggle(true);
          },
          "Ctrl-R": () => {
            if (window.TeXPressFindReplace) window.TeXPressFindReplace.toggle(true);
          },
          "Ctrl-Shift-I": () => {
            if (window.openFigureWizard) window.openFigureWizard();
          },
          "Ctrl-Shift-B": () => {
            if (window.openCitationPicker) window.openCitationPicker();
          },
          "Alt-1": () => format("h1"),
          "Alt-2": () => format("h2"),
          "Esc": () => {
            if (window.TeXPressFindReplace) window.TeXPressFindReplace.close();
            if (window.closeCitationPicker) window.closeCitationPicker();
            hideErrorHover();
            const hover = document.getElementById("editorHoverCard");
            if (hover) hover.style.display = "none";
          }
        }
      });

      // Enable native Chromium inline spellchecking in contenteditable editor
      const input = cmInstance.getInputField();
      if (input) {
        input.setAttribute("spellcheck", "true");
        input.setAttribute("autocapitalize", "off");
      }

      // Intercept Ctrl+/ directly on CodeMirror keydown for universal keyboard layout support
      cmInstance.on("keydown", (cm, e) => {
        if ((e.ctrlKey || e.metaKey) && (e.key === "/" || e.code === "Slash" || e.keyCode === 191)) {
          e.preventDefault();
          e.stopPropagation();
          toggleComment(cm);
        }
      });

      // Track cursor position to update line/col number in real-time
      cmInstance.on("cursorActivity", () => {
        updateCursorPositionUI();
      });

      // Autocomplete trigger on typing "\" or continuing a command
      cmInstance.on("inputRead", (cm, change) => {
        if (change.origin === "+input" && change.text && change.text[0]) {
          const char = change.text[0];
          if (char === "\\" || (/[a-zA-Z]/.test(char) && isTypingLatexCommand(cm))) {
            if (window.TeXPressLatexHints) {
              window.TeXPressLatexHints.show(cm);
            }
          }
        }
      });

      // Change listener for auto-save, auto-compile, outline, word count
      cmInstance.on("change", (_cm, changeObj) => {
        textarea.value = cmInstance.getValue();
        if (typeof window.updateStatusBarWordCount === "function") {
          window.updateStatusBarWordCount();
        }
        updateOutlineTree();
        updateCursorPositionUI();
        // Ignore programmatic setValue() when loading a file into the editor
        if (isSettingContent || (changeObj && changeObj.origin === "setValue")) {
          return;
        }
        if (typeof window.onEditorInputActivity === "function") {
          window.onEditorInputActivity();
        }
      });

      // Setup line hover inspection for error diagnostics
      setupErrorHoverListeners();
    }

    updateOutlineTree();
    updateWrapAndNumbersUI();
    updateCursorPositionUI();
  }

  function isTypingLatexCommand(cm) {
    const cur = cm.getCursor();
    const line = cm.getLine(cur.line);
    for (let i = cur.ch - 1; i >= 0; i--) {
      const ch = line[i];
      if (ch === "\\") return true;
      if (/[\s,;{}()[\]$]/.test(ch)) return false;
    }
    return false;
  }

  // ========================================================================
  // Line Wrap & Line Numbers Features
  // ========================================================================
  function toggleLineWrapping() {
    isWrapping = !isWrapping;
    localStorage.setItem("texpress_line_wrapping", isWrapping ? "true" : "false");
    if (cmInstance) {
      cmInstance.setOption("lineWrapping", isWrapping);
      cmInstance.refresh();
    }
    updateWrapAndNumbersUI();
  }

  function toggleLineNumbers() {
    isLineNumbers = !isLineNumbers;
    localStorage.setItem("texpress_line_numbers", isLineNumbers ? "true" : "false");
    if (cmInstance) {
      cmInstance.setOption("lineNumbers", isLineNumbers);
      cmInstance.refresh();
    }
    updateWrapAndNumbersUI();
  }

  function updateWrapAndNumbersUI() {
    const btnWrap = document.getElementById("btnToggleWrap");
    const lblWrap = document.getElementById("lblToggleWrap");
    if (btnWrap) {
      btnWrap.classList.toggle("active", isWrapping);
      btnWrap.title = `Toggle Line Wrap (Alt+Z) — Currently ${isWrapping ? "ON" : "OFF"}`;
    }
    if (lblWrap) {
      lblWrap.textContent = isWrapping ? "Wrap: ON" : "Wrap: OFF";
    }

    const btnNum = document.getElementById("btnToggleLineNumbers");
    const lblNum = document.getElementById("lblToggleLineNumbers");
    if (btnNum) {
      btnNum.classList.toggle("active", isLineNumbers);
      btnNum.title = `Toggle Line Numbers (Alt+L) — Currently ${isLineNumbers ? "ON" : "OFF"}`;
    }
    if (lblNum) {
      lblNum.textContent = isLineNumbers ? "Numbers: ON" : "Numbers";
    }
  }

  // ========================================================================
  // Live Cursor & Line Number Tracking (Resolves line number at right/bottom)
  // ========================================================================
  function updateCursorPositionUI() {
    if (!cmInstance) return;
    const cur = cmInstance.getCursor();
    const line = cur.line + 1;
    const col = cur.ch + 1;
    const total = cmInstance.lineCount();

    const posEl = document.getElementById("statusCursorPos");
    const totalEl = document.getElementById("statusTotalLines");
    const topEl = document.getElementById("editorTopLineIndicator");

    if (posEl) posEl.textContent = `Ln ${line}, Col ${col}`;
    if (totalEl) totalEl.textContent = `${total} lines`;
    if (topEl) topEl.textContent = `Line ${line} : Col ${col}`;
  }

  async function promptGoToLine() {
    if (!cmInstance) return;
    const current = cmInstance.getCursor().line + 1;
    const total = cmInstance.lineCount();
    let input;
    if (typeof window.showQuickInput === "function") {
      input = await window.showQuickInput({
        title: "<span>📍 Go to Line</span>",
        label: `Enter target line number (1 - ${total}):`,
        placeholder: `Current line: ${current}`,
        defaultValue: String(current),
        confirmText: "Jump to Line"
      });
    } else {
      input = prompt(`Go to line (1 - ${total}):`, current);
    }
    if (input !== null && input !== "") {
      const lineNum = parseInt(String(input).trim(), 10);
      if (!isNaN(lineNum) && lineNum >= 1 && lineNum <= total) {
        scrollToLine(lineNum - 1);
      }
    }
  }

  function jumpToLineAndPulse(lineNum, colNum) {
    if (!cmInstance) return;
    const l = Math.max(0, (lineNum || 1) - 1);
    const c = Math.max(0, (colNum || 1) - 1);

    cmInstance.focus();
    cmInstance.setCursor({ line: l, ch: c });
    cmInstance.scrollIntoView({ line: l, ch: c }, 150);

    cmInstance.addLineClass(l, "background", "synctex-target-line");
    setTimeout(() => {
      try {
        cmInstance.removeLineClass(l, "background", "synctex-target-line");
      } catch (e) {}
    }, 1800);
  }

  // ========================================================================
  // Comment / Uncomment Selection (Ctrl+/)
  // ========================================================================
  function toggleComment(cm) {
    if (!cm) cm = cmInstance;
    if (!cm) return;

    cm.operation(() => {
      const from = cm.getCursor("from");
      const to = cm.getCursor("to");
      let startLine = from.line;
      let endLine = to.line;

      // If multi-line selection ends at column 0, exclude that line
      if (endLine > startLine && to.ch === 0) {
        endLine--;
      }

      let allCommented = true;
      let hasContent = false;

      for (let l = startLine; l <= endLine; l++) {
        const text = cm.getLine(l);
        if (text.trim().length > 0) {
          hasContent = true;
          if (!/^\s*%/.test(text)) {
            allCommented = false;
            break;
          }
        }
      }

      if (!hasContent) {
        cm.replaceRange("% ", CodeMirror.Pos(startLine, 0));
        return;
      }

      if (allCommented) {
        // Uncomment: remove leading % and optional space
        for (let l = startLine; l <= endLine; l++) {
          const text = cm.getLine(l);
          const match = text.match(/^(\s*)%( ?)(.*)$/);
          if (match) {
            const indent = match[1];
            const rest = match[3];
            cm.replaceRange(indent + rest, CodeMirror.Pos(l, 0), CodeMirror.Pos(l, text.length));
          }
        }
      } else {
        // Comment: prepend % with existing indentation preserved
        for (let l = startLine; l <= endLine; l++) {
          const text = cm.getLine(l);
          const match = text.match(/^(\s*)(.*)$/);
          if (match) {
            const indent = match[1];
            const rest = match[2];
            cm.replaceRange(indent + "% " + rest, CodeMirror.Pos(l, 0), CodeMirror.Pos(l, text.length));
          }
        }
      }
    });

    cm.focus();
  }

  // ========================================================================
  // Compiler Error Line Highlighting & Hover Quick-Fix
  // ========================================================================
  function markCompilationErrors(diagnostics, activeFile) {
    clearCompilationErrors();
    if (!cmInstance || !diagnostics || diagnostics.length === 0) return;

    const currentDoc = activeFile || window.activeFileKey || "";

    diagnostics.forEach((d) => {
      // Check if diagnostic belongs to current active document or project root
      const isMatch = !d.file || 
        d.file === currentDoc || 
        currentDoc.endsWith(d.file) || 
        d.file.endsWith(currentDoc) ||
        d.file.includes(currentDoc.split("/").pop());

      if (!isMatch && d.file) return;

      const lineIdx = Math.max(0, parseInt(d.line, 10) - 1);
      if (isNaN(lineIdx) || lineIdx >= cmInstance.lineCount()) return;

      // 1. Add red gutter dot
      const marker = document.createElement("div");
      marker.className = "cm-error-gutter-dot";
      marker.innerHTML = "🔴";
      marker.title = `${d.title || "LaTeX Error"}: ${stripHtml(d.message || "")}`;
      marker.dataset.line = lineIdx;

      marker.addEventListener("mouseenter", (e) => {
        showErrorHover(e, lineIdx, d);
      });
      marker.addEventListener("mouseleave", () => {
        scheduleHideErrorHover();
      });

      cmInstance.setGutterMarker(lineIdx, "error-gutter", marker);

      // 2. Add line highlight background class
      cmInstance.addLineClass(lineIdx, "background", "cm-line-error");

      errorMarkers.push({ line: lineIdx, diagnostic: d, marker });
    });
  }

  function clearCompilationErrors() {
    if (!cmInstance) return;
    errorMarkers.forEach((item) => {
      cmInstance.setGutterMarker(item.line, "error-gutter", null);
      cmInstance.removeLineClass(item.line, "background", "cm-line-error");
    });
    errorMarkers = [];
    hideErrorHover();
  }

  function setupErrorHoverListeners() {
    if (!cmInstance) return;
    const wrapper = cmInstance.getWrapperElement();
    if (!wrapper) return;

    wrapper.addEventListener("mousemove", (e) => {
      const lineNode = e.target.closest(".CodeMirror-line");
      if (!lineNode) return;

      const lineEl = lineNode.closest(".CodeMirror-linenumber, .CodeMirror-line, pre");
      const coords = { left: e.clientX, top: e.clientY };
      const pos = cmInstance.coordsChar(coords);
      if (pos && typeof pos.line === "number") {
        const errorItem = errorMarkers.find(m => m.line === pos.line);
        if (errorItem) {
          clearTimeout(activeHoverTimeout);
          showErrorHover(e, pos.line, errorItem.diagnostic);
        }
      }
    });

    wrapper.addEventListener("mouseleave", () => {
      scheduleHideErrorHover();
    });
  }

  function showErrorHover(e, lineIdx, diagnostic) {
    clearTimeout(activeHoverTimeout);
    let card = document.getElementById("errorHoverTooltip");
    if (!card) {
      card = document.createElement("div");
      card.id = "errorHoverTooltip";
      card.className = "error-hover-card";
      document.body.appendChild(card);
      card.addEventListener("mouseenter", () => clearTimeout(activeHoverTimeout));
      card.addEventListener("mouseleave", () => scheduleHideErrorHover());
    }

    const lineText = cmInstance.getLine(lineIdx) || "";
    const quickFix = generateQuickFixPlan(lineText, diagnostic);

    card.innerHTML = `
      <div class="error-hover-header">
        <span class="error-hover-tag">🔴 Line ${lineIdx + 1} Error</span>
        <button class="error-hover-close" onclick="TeXPressEditor.hideErrorHover()">✕</button>
      </div>
      <div class="error-hover-title">${escapeHtml(diagnostic.title || "LaTeX Syntax Error")}</div>
      <div class="error-hover-desc">${diagnostic.message || "Undefined sequence or syntax violation."}</div>
      ${quickFix ? `
        <div class="error-hover-action-box">
          <div class="error-fix-caption">💡 Suggested Fix:</div>
          <div class="error-fix-preview"><code>${escapeHtml(quickFix.description)}</code></div>
          <div style="display: flex; gap: 8px; margin-top: 8px;">
            <button class="btn-quick-fix-apply" onclick="TeXPressEditor.applyQuickFix(${lineIdx}, '${quickFix.id}')">
              ⚡ Apply Quick Fix
            </button>
            <button class="btn-quick-fix-jump" onclick="TeXPressEditor.scrollToLine(${lineIdx})">
              Jump to Line
            </button>
          </div>
        </div>
      ` : `
        <div style="margin-top: 8px;">
          <button class="btn-quick-fix-jump" onclick="TeXPressEditor.scrollToLine(${lineIdx})">
            Jump to Line
          </button>
        </div>
      `}
    `;

    card.style.display = "block";
    const x = Math.min(window.innerWidth - 360, Math.max(10, e.clientX + 16));
    const y = Math.min(window.innerHeight - 200, Math.max(40, e.clientY - 20));
    card.style.left = `${x}px`;
    card.style.top = `${y}px`;
  }

  function scheduleHideErrorHover() {
    clearTimeout(activeHoverTimeout);
    activeHoverTimeout = setTimeout(() => {
      hideErrorHover();
    }, 450);
  }

  function hideErrorHover() {
    clearTimeout(activeHoverTimeout);
    const card = document.getElementById("errorHoverTooltip");
    if (card) card.style.display = "none";
  }

  function generateQuickFixPlan(lineText, diagnostic) {
    const msg = (diagnostic.message || "").toLowerCase();
    const title = (diagnostic.title || "").toLowerCase();

    // 1. Missing closing brace
    if (msg.includes("runaway argument") || msg.includes("missing }") || title.includes("brace")) {
      return {
        id: "add_closing_brace",
        description: "Insert missing closing brace '}' at end of statement"
      };
    }

    // 2. Unescaped percent symbol
    if (lineText.includes("%") && !lineText.includes("\\%") && !lineText.trim().startsWith("%")) {
      return {
        id: "escape_percent",
        description: "Escape raw '%' sign to '\\%'"
      };
    }

    // 3. Undefined control sequence
    if (msg.includes("undefined control sequence") || title.includes("undefined")) {
      const match = diagnostic.message.match(/\\([a-zA-Z]+)/);
      const badCmd = match ? match[1] : "";
      if (badCmd) {
        return {
          id: `fix_typo_${badCmd}`,
          description: `Fix unknown command '\\${badCmd}'`
        };
      }
    }

    // 4. Missing \item
    if (msg.includes("something's wrong--perhaps a missing \\item")) {
      return {
        id: "add_item",
        description: "Insert missing '\\item' before list entry"
      };
    }

    return null;
  }

  function applyQuickFix(lineIdx, fixId) {
    if (!cmInstance) return;
    const currentLine = cmInstance.getLine(lineIdx);
    let newLine = currentLine;

    if (fixId === "add_closing_brace") {
      newLine = currentLine + "}";
    } else if (fixId === "escape_percent") {
      newLine = currentLine.replace(/([^\\])%/g, "$1\\%");
    } else if (fixId === "add_item") {
      newLine = "  \\item " + currentLine.trim();
    } else if (fixId && fixId.startsWith("fix_typo_")) {
      const badCmd = fixId.replace("fix_typo_", "");
      // Common typo corrections
      const corrections = {
        "inpur": "input",
        "incude": "include",
        "textbfx": "textbf",
        "usepackag": "usepackage",
        "begn": "begin"
      };
      const fixed = corrections[badCmd] || "";
      if (fixed) {
        newLine = currentLine.replace(new RegExp(`\\\\${badCmd}\\b`), `\\${fixed}`);
      }
    }

    if (newLine !== currentLine) {
      cmInstance.replaceRange(newLine, CodeMirror.Pos(lineIdx, 0), CodeMirror.Pos(lineIdx, currentLine.length));
    }

    hideErrorHover();
    clearCompilationErrors();

    // Trigger re-compilation immediately
    if (typeof window.runCompile === "function") {
      window.runCompile();
    }
  }

  // ========================================================================
  // Core Editing & Formatting Methods
  // ========================================================================
  function getContent() {
    if (cmInstance) {
      return cmInstance.getValue();
    }
    const ta = document.getElementById("editorTextarea");
    return ta ? ta.value : "";
  }

  function setContent(content, relPath, viewState = null) {
    activeRelPath = relPath;
    clearCompilationErrors();
    if (cmInstance) {
      isSettingContent = true;
      try {
        cmInstance.setValue(content || "");
        cmInstance.clearHistory();
        if (viewState && viewState.cursor) {
          cmInstance.setCursor(viewState.cursor);
          if (viewState.scroll) {
            setTimeout(() => {
              if (cmInstance) cmInstance.scrollTo(viewState.scroll.left, viewState.scroll.top);
            }, 10);
          }
        } else {
          cmInstance.setCursor({ line: 0, ch: 0 });
        }
      } finally {
        isSettingContent = false;
      }
    } else {
      const textarea = document.getElementById("editorTextarea");
      if (textarea) textarea.value = content || "";
    }
    updateOutlineTree();
    updateCursorPositionUI();
  }

  function getViewState() {
    if (!cmInstance) return null;
    const s = cmInstance.getScrollInfo();
    return {
      cursor: cmInstance.getCursor(),
      scroll: { left: s.left, top: s.top }
    };
  }

  function insertSnippet(codeOrName) {
    let snippet = codeOrName;
    if (codeOrName === "equation") {
      snippet = "\n\\begin{equation}\n  E = mc^2\n\\end{equation}\n";
    } else if (codeOrName === "inline-math") {
      snippet = "$x$";
    }

    if (cmInstance) {
      cmInstance.replaceSelection(snippet);
      cmInstance.focus();
    } else {
      const ta = document.getElementById("editorTextarea");
      if (ta) {
        const start = ta.selectionStart;
        const end = ta.selectionEnd;
        const val = ta.value;
        ta.value = val.substring(0, start) + snippet + val.substring(end);
        ta.selectionStart = ta.selectionEnd = start + snippet.length;
        ta.focus();
      }
    }
    updateOutlineTree();
    if (typeof window.updateStatusBarWordCount === "function") {
      window.updateStatusBarWordCount();
    }
  }

  function undo() {
    if (cmInstance) {
      cmInstance.undo();
      cmInstance.focus();
    }
  }

  function redo() {
    if (cmInstance) {
      cmInstance.redo();
      cmInstance.focus();
    }
  }

  function scrollToLine(lineIdx) {
    if (cmInstance) {
      cmInstance.setCursor({ line: lineIdx, ch: 0 });
      cmInstance.scrollIntoView({ line: lineIdx, ch: 0 }, 140);
      cmInstance.focus();
    } else {
      const ta = document.getElementById("editorTextarea");
      if (!ta) return;
      const lines = ta.value.split("\n");
      let pos = 0;
      for (let i = 0; i < lineIdx && i < lines.length; i++) {
        pos += lines[i].length + 1;
      }
      ta.focus();
      ta.setSelectionRange(pos, pos + (lines[lineIdx] ? lines[lineIdx].length : 0));
      ta.scrollTop = Math.max(0, lineIdx * 24 - 120);
    }
  }

  function format(type) {
    if (!cmInstance) return;
    const selected = cmInstance.getSelection();
    let replacement = "";
    switch (type) {
      case "bold":
        replacement = `\\textbf{${selected || "bold text"}}`;
        break;
      case "italic":
        replacement = `\\textit{${selected || "italic text"}}`;
        break;
      case "underline":
        replacement = `\\underline{${selected || "underlined text"}}`;
        break;
      case "strikethrough":
        replacement = `\\sout{${selected || "strikethrough text"}}`;
        break;
      case "chapter":
        replacement = `\n\\chapter{${selected || "Chapter Title"}}\n`;
        break;
      case "title":
        replacement = `\n\\title{${selected || "Book Title"}}\n`;
        break;
      case "h1":
        replacement = `\n\\section{${selected || "Section Title"}}\n`;
        break;
      case "h2":
        replacement = `\n\\subsection{${selected || "Subsection Title"}}\n`;
        break;
      case "h3":
        replacement = `\n\\subsubsection{${selected || "Subsubsection Title"}}\n`;
        break;
      case "bullet-list":
        replacement = `\n\\begin{itemize}\n  \\item ${selected || "First item"}\n  \\item Second item\n\\end{itemize}\n`;
        break;
      case "numbered-list":
        replacement = `\n\\begin{enumerate}\n  \\item ${selected || "First item"}\n  \\item Second item\n\\end{enumerate}\n`;
        break;
      case "quote":
        replacement = `\n\\begin{quote}\n  ${selected || "Quotation text..."}\n\\end{quote}\n`;
        break;
      case "math":
      case "inline-math":
        replacement = `$${selected || "x"}$`;
        break;
      case "math_block":
      case "equation":
        replacement = `\n\\begin{equation}\n  ${selected || "E = mc^2"}\n\\end{equation}\n`;
        break;
      default:
        replacement = selected;
    }
    cmInstance.replaceSelection(replacement);
    cmInstance.focus();
  }

  function updateOutlineTree() {
    const outlineBox = document.getElementById("outlineBox");
    const outlineItems = document.getElementById("outlineItems");
    if (!outlineBox || !outlineItems) return;

    const content = getContent();
    if (!content) {
      outlineBox.style.display = "none";
      return;
    }

    const lines = content.split("\n");
    const matches = [];

    lines.forEach((line, index) => {
      const chMatch = line.match(/\\chapter\{([^}]+)\}/);
      if (chMatch) matches.push({ title: chMatch[1], depth: 0, line: index });

      const secMatch = line.match(/\\section\{([^}]+)\}/);
      if (secMatch) matches.push({ title: secMatch[1], depth: 1, line: index });

      const subMatch = line.match(/\\subsection\{([^}]+)\}/);
      if (subMatch) matches.push({ title: subMatch[1], depth: 2, line: index });
    });

    if (matches.length === 0) {
      outlineBox.style.display = "none";
      return;
    }

    outlineBox.style.display = "block";
    outlineItems.innerHTML = matches.map(m => `
      <div class="doc-outline-item depth-${m.depth}" onclick="TeXPressEditor.scrollToLine(${m.line})" title="Jump to line ${m.line + 1}">
        ${m.depth === 0 ? "📖 " : m.depth === 1 ? "§ " : "• "}${escapeHtml(m.title)}
      </div>
    `).join("");
  }

  function escapeHtml(str) {
    return String(str).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/'/g, '&#39;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }

  function stripHtml(str) {
    return String(str).replace(/<[^>]+>/g, "");
  }

  function getCm() {
    return cmInstance;
  }

  return {
    init,
    getContent,
    setContent,
    insertSnippet,
    undo,
    redo,
    scrollToLine,
    format,
    updateOutlineTree,
    toggleLineWrapping,
    toggleLineNumbers,
    toggleComment,
    promptGoToLine,
    jumpToLineAndPulse,
    updateCursorPositionUI,
    markCompilationErrors,
    clearCompilationErrors,
    showErrorHover,
    hideErrorHover,
    applyQuickFix,
    getCm,
    getViewState
  };
})();

// Global convenience wrappers
window.editorUndo = () => window.TeXPressEditor.undo();
window.editorRedo = () => window.TeXPressEditor.redo();
window.formatSelection = (type) => window.TeXPressEditor.format(type);
window.insertSnippet = (code) => window.TeXPressEditor.insertSnippet(code);
window.toggleLineWrapping = () => window.TeXPressEditor.toggleLineWrapping();
window.toggleLineNumbers = () => window.TeXPressEditor.toggleLineNumbers();
window.toggleComment = () => window.TeXPressEditor.toggleComment();
window.promptGoToLine = () => window.TeXPressEditor.promptGoToLine();
window.jumpToLineAndPulse = (l, c) => window.TeXPressEditor.jumpToLineAndPulse(l, c);

// Global keydown listeners for shortcuts (Ctrl+/ and Ctrl+Alt+J)
window.addEventListener("keydown", (e) => {
  if ((e.ctrlKey || e.metaKey) && (e.key === "/" || e.code === "Slash" || e.keyCode === 191)) {
    const active = document.activeElement;
    if (active && (active.closest(".CodeMirror") || active.id === "editorTextarea")) {
      e.preventDefault();
      e.stopPropagation();
      if (window.TeXPressEditor) window.TeXPressEditor.toggleComment();
    }
  } else if ((e.ctrlKey || e.metaKey) && e.altKey && (e.key === "j" || e.key === "J" || e.code === "KeyJ")) {
    e.preventDefault();
    e.stopPropagation();
    if (typeof window.triggerForwardSync === "function") {
      window.triggerForwardSync();
    }
  }
}, true);
