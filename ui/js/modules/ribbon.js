/**
 * TeXPress Studio - Google Docs Pill Ribbon & Formatting Controller
 */

window.TeXPressRibbon = (function() {
  let currentFontSize = 15;
  let isDocStarred = false;

  function format(type) {
    const textarea = document.getElementById("editorTextarea");
    if (!textarea) return;
    if (!window.currentProjectName) {
      if (typeof window.showToast === "function") {
        window.showToast("Please open or create a project first.", "warning");
      } else {
        alert("Please open or create a project first.");
      }
      return;
    }

    if (window.TeXPressEditor) window.TeXPressEditor.recordSnapshot(true);

    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const val = textarea.value;
    const selectedText = val.substring(start, end);

    if (type === "bold") {
      wrapOrUnwrap("\\textbf{", "}", selectedText, start, end, "bold text");
    } else if (type === "italic") {
      wrapOrUnwrap("\\textit{", "}", selectedText, start, end, "italic text");
    } else if (type === "underline") {
      wrapOrUnwrap("\\underline{", "}", selectedText, start, end, "underlined text");
    } else if (type === "title") {
      insertBlockCommand("\\title{", "}", selectedText, start, end, "Book Title");
    } else if (type === "chapter") {
      insertBlockCommand("\\chapter{", "}", selectedText, start, end, "Chapter Title");
    } else if (type === "h1") {
      insertBlockCommand("\\section{", "}", selectedText, start, end, "Section Title");
    } else if (type === "h2") {
      insertBlockCommand("\\subsection{", "}", selectedText, start, end, "Subsection Title");
    } else if (type === "h3") {
      insertBlockCommand("\\subsubsection{", "}", selectedText, start, end, "Subsubsection Title");
    } else if (type === "bullet-list") {
      formatList("itemize", selectedText, start, end);
    } else if (type === "numbered-list") {
      formatList("enumerate", selectedText, start, end);
    } else if (type === "quote") {
      formatBlockquote(selectedText, start, end);
    } else if (type === "math-inline") {
      wrapOrUnwrap("$", "$", selectedText, start, end, "x");
    }

    if (window.TeXPressEditor) {
      window.TeXPressEditor.recordSnapshot(true);
      window.TeXPressEditor.updateOutlineTree();
    }
    if (typeof window.updateStatusBarWordCount === "function") {
      window.updateStatusBarWordCount();
    }
  }

  function wrapOrUnwrap(prefix, suffix, selectedText, start, end, placeholder) {
    const textarea = document.getElementById("editorTextarea");
    const val = textarea.value;
    if (!selectedText) {
      textarea.value = val.substring(0, start) + prefix + suffix + val.substring(end);
      textarea.selectionStart = textarea.selectionEnd = start + prefix.length;
    } else {
      if (selectedText.startsWith(prefix) && selectedText.endsWith(suffix)) {
        const unwrapped = selectedText.substring(prefix.length, selectedText.length - suffix.length);
        textarea.value = val.substring(0, start) + unwrapped + val.substring(end);
        textarea.selectionStart = start;
        textarea.selectionEnd = start + unwrapped.length;
      } else {
        textarea.value = val.substring(0, start) + prefix + selectedText + suffix + val.substring(end);
        textarea.selectionStart = start + prefix.length;
        textarea.selectionEnd = end + prefix.length;
      }
    }
    textarea.focus();
  }

  function insertBlockCommand(prefix, suffix, selectedText, start, end, defaultTitle) {
    const textarea = document.getElementById("editorTextarea");
    const val = textarea.value;
    const title = selectedText || defaultTitle;
    const block = `\n${prefix}${title}${suffix}\n`;
    textarea.value = val.substring(0, start) + block + val.substring(end);
    textarea.selectionStart = textarea.selectionEnd = start + block.length;
    textarea.focus();
  }

  function formatList(env, selectedText, start, end) {
    const textarea = document.getElementById("editorTextarea");
    const val = textarea.value;
    let items = "";
    if (selectedText) {
      const lines = selectedText.split(/\r?\n/).filter(l => l.trim().length > 0);
      items = lines.map(l => `  \\item ${l.trim()}`).join("\n");
    } else {
      items = "  \\item First item\n  \\item Second item";
    }
    const block = `\n\\begin{${env}}\n${items}\n\\end{${env}}\n`;
    textarea.value = val.substring(0, start) + block + val.substring(end);
    textarea.selectionStart = textarea.selectionEnd = start + block.length;
    textarea.focus();
  }

  function formatBlockquote(selectedText, start, end) {
    const textarea = document.getElementById("editorTextarea");
    const val = textarea.value;
    const quote = selectedText || "Insert academic quote here...";
    const block = `\n\\begin{quote}\n  ${quote}\n\\end{quote}\n`;
    textarea.value = val.substring(0, start) + block + val.substring(end);
    textarea.selectionStart = textarea.selectionEnd = start + block.length;
    textarea.focus();
  }

  function applyStyleSelection(val) {
    if (val === "title") format("title");
    else if (val === "chapter") format("chapter");
    else if (val === "h1") format("h1");
    else if (val === "h2") format("h2");
    else if (val === "h3") format("h3");
    else if (val === "normal") {
      const textarea = document.getElementById("editorTextarea");
      const start = textarea.selectionStart;
      const end = textarea.selectionEnd;
      let selected = textarea.value.substring(start, end);
      selected = selected.replace(/\\(chapter|section|subsection|subsubsection|title)\{([^}]+)\}/g, "$2");
      textarea.setRangeText(selected, start, end, "select");
    }
    const selectEl = document.getElementById("styleSelect");
    if (selectEl) selectEl.value = "normal";
  }

  function applyDocZoom(scale) {
    const paperSheet = document.getElementById("paperSheet");
    if (paperSheet) {
      paperSheet.style.transform = `scale(${scale})`;
      paperSheet.style.transformOrigin = "top center";
    }
  }

  function changeFontSize(delta) {
    const textarea = document.getElementById("editorTextarea");
    if (!textarea) return;
    currentFontSize = Math.max(12, Math.min(currentFontSize + delta, 28));
    textarea.style.fontSize = currentFontSize + "px";
    const display = document.getElementById("fontSizeDisplay");
    if (display) display.textContent = currentFontSize;
  }

  function toggleDocStar() {
    isDocStarred = !isDocStarred;
    const btn = document.getElementById("btnDocStar");
    if (btn) {
      btn.style.color = isDocStarred ? "#fbbc04" : "var(--text-muted)";
    }
  }

  return {
    format,
    applyStyleSelection,
    applyDocZoom,
    changeFontSize,
    toggleDocStar
  };
})();

// Global convenience wrappers
window.formatSelection = (type) => window.TeXPressRibbon.format(type);
window.applyStyleSelection = (val) => window.TeXPressRibbon.applyStyleSelection(val);
window.applyDocZoom = (val) => window.TeXPressRibbon.applyDocZoom(val);
window.changeFontSize = (delta) => window.TeXPressRibbon.changeFontSize(delta);
window.toggleDocStar = () => window.TeXPressRibbon.toggleDocStar();
window.editorUndo = () => { if (window.TeXPressEditor) window.TeXPressEditor.undo(); };
window.editorRedo = () => { if (window.TeXPressEditor) window.TeXPressEditor.redo(); };
