/**
 * TeXPress Studio - Google Docs Toolbar Dropdowns & List Presets
 * Implements Google Docs style Numbered Lists, Bulleted Lists, Line Spacing, and Indents.
 */

window.TeXPressToolbarMenus = (function() {
  let activeOpenDropdown = null;

  function init() {
    // Dismiss dropdowns when clicking outside
    document.addEventListener("click", (e) => {
      if (!e.target.closest(".gdocs-dropdown") && !e.target.closest(".ribbon-split-btn")) {
        closeAllDropdowns();
      }
    });

    window.addEventListener("keydown", (e) => {
      if (e.key === "Escape") {
        closeAllDropdowns();
      }
    });
  }

  function toggleDropdown(menuId, btnEl) {
    const menu = document.getElementById(menuId);
    if (!menu) return;

    if (activeOpenDropdown && activeOpenDropdown !== menu) {
      activeOpenDropdown.style.display = "none";
    }

    if (menu.style.display === "block") {
      menu.style.display = "none";
      activeOpenDropdown = null;
    } else {
      // Position menu directly under trigger button
      if (btnEl) {
        const rect = btnEl.getBoundingClientRect();
        menu.style.top = `${rect.bottom + 4}px`;
        menu.style.left = `${Math.min(window.innerWidth - 300, rect.left)}px`;
      }
      menu.style.display = "block";
      activeOpenDropdown = menu;
    }
  }

  function closeAllDropdowns() {
    if (activeOpenDropdown) {
      activeOpenDropdown.style.display = "none";
      activeOpenDropdown = null;
    }
    const all = document.querySelectorAll(".gdocs-dropdown");
    all.forEach(el => el.style.display = "none");
  }

  // ========================================================================
  // Line & Paragraph Spacing (Resolves Image 4)
  // ========================================================================
  function applyLineSpacing(type) {
    closeAllDropdowns();
    let code = "";
    switch (type) {
      case "single":
        code = "\n\\singlespacing\n";
        break;
      case "1.15":
        code = "\n\\setstretch{1.15}\n";
        break;
      case "1.5":
        code = "\n\\onehalfspacing\n";
        break;
      case "double":
        code = "\n\\doublespacing\n";
        break;
      default:
        code = "\n\\singlespacing\n";
    }

    if (window.TeXPressEditor) {
      window.TeXPressEditor.insertSnippet(code);
    }
  }

  async function applyParagraphSpacing(type) {
    closeAllDropdowns();
    let code = "";
    if (type === "before") {
      code = "\n\\vspace{6pt}\n";
    } else if (type === "after") {
      code = "\n\\setlength{\\parskip}{6pt}\n";
    } else if (type === "custom") {
      let val;
      if (typeof window.showQuickInput === "function") {
        val = await window.showQuickInput({
          title: "<span>📏 Custom Paragraph Spacing</span>",
          label: "Enter LaTeX paragraph spacing (\\parskip):",
          placeholder: "e.g. 6pt, 8pt, 0.5em, 12pt",
          defaultValue: "6pt",
          confirmText: "Apply Spacing"
        });
      } else {
        val = prompt("Enter custom spacing (e.g. 8pt, 1em, 1.25):", "6pt");
      }
      if (val) {
        code = `\n\\setlength{\\parskip}{${val.trim()}}\n`;
      } else {
        return;
      }
    }

    if (window.TeXPressEditor) {
      window.TeXPressEditor.insertSnippet(code);
    }
  }

  // ========================================================================
  // Numbered Lists (Resolves Image 1 & 2)
  // ========================================================================
  function applyNumberedListPreset(preset) {
    closeAllDropdowns();
    let snippet = "";
    switch (preset) {
      case "1.a.i":
        snippet = `\n\\begin{enumerate}
  \\item First numbered item
  \\begin{enumerate}[label=\\alph*.]
    \\item Sub-item a
    \\item Sub-item b
  \\end{enumerate}
  \\item Second numbered item
\\end{enumerate}\n`;
        break;

      case "1)a)i)":
        snippet = `\n\\begin{enumerate}[label=\\arabic*)]
  \\item First item
  \\begin{enumerate}[label=\\alph*)]
    \\item Sub-item a
  \\end{enumerate}
  \\item Second item
\\end{enumerate}\n`;
        break;

      case "1.1.1.2":
        snippet = `\n\\begin{enumerate}[label=\\arabic*.]
  \\item Section clause
  \\begin{enumerate}[label=\\arabic{enumi}.\\arabic*.]
    \\item Clause 1.1
    \\item Clause 1.2
  \\end{enumerate}
  \\item Next section
\\end{enumerate}\n`;
        break;

      case "A.a.i":
        snippet = `\n\\begin{enumerate}[label=\\Alph*.]
  \\item Category A
  \\begin{enumerate}[label=\\alph*.]
    \\item Subcategory a
  \\end{enumerate}
  \\item Category B
\\end{enumerate}\n`;
        break;

      case "I.A.1":
        snippet = `\n\\begin{enumerate}[label=\\Roman*.]
  \\item Article I
  \\begin{enumerate}[label=\\Alph*.]
    \\item Section A
    \\begin{enumerate}[label=\\arabic*.]
      \\item Subsection 1
    \\end{enumerate}
  \\end{enumerate}
  \\item Article II
\\end{enumerate}\n`;
        break;

      case "01.a.i":
        snippet = `\n\\begin{enumerate}[label=0\\arabic*.]
  \\item Item 01
  \\begin{enumerate}[label=\\alph*.]
    \\item Sub-item a
  \\end{enumerate}
  \\item Item 02
\\end{enumerate}\n`;
        break;

      default:
        snippet = `\n\\begin{enumerate}
  \\item First item
  \\item Second item
\\end{enumerate}\n`;
    }

    if (window.TeXPressEditor) {
      window.TeXPressEditor.insertSnippet(snippet);
    }
  }

  // ========================================================================
  // Bulleted Lists (Resolves Image 3)
  // ========================================================================
  function applyBulletListPreset(preset) {
    closeAllDropdowns();
    let snippet = "";
    switch (preset) {
      case "disc":
        snippet = `\n\\begin{itemize}
  \\item Primary bullet item
  \\begin{itemize}
    \\item Sub-bullet level two
    \\item Sub-bullet level two
  \\end{itemize}
  \\item Secondary bullet item
\\end{itemize}\n`;
        break;

      case "diamond":
        snippet = `\n\\begin{itemize}[label=$\\diamond$]
  \\item Diamond bullet point
  \\begin{itemize}[label=$\\rightarrow$]
    \\item Arrow sub-item
  \\end{itemize}
  \\item Concluding point
\\end{itemize}\n`;
        break;

      case "square":
        snippet = `\n\\begin{itemize}[label=$\\blacksquare$]
  \\item Square bullet point
  \\begin{itemize}[label=$\\square$]
    \\item Hollow square sub-item
  \\end{itemize}
  \\item Concluding point
\\end{itemize}\n`;
        break;

      case "arrow":
        snippet = `\n\\begin{itemize}[label=$\\rightarrow$]
  \\item Arrow primary point
  \\begin{itemize}[label=$\\diamond$]
    \\item Diamond secondary point
  \\end{itemize}
  \\item Next point
\\end{itemize}\n`;
        break;

      case "star":
        snippet = `\n\\begin{itemize}[label=$\\star$]
  \\item Star priority item
  \\begin{itemize}[label=$\\circ$]
    \\item Circle sub-item
  \\end{itemize}
  \\item Next priority item
\\end{itemize}\n`;
        break;

      case "checklist":
        snippet = `\n\\begin{itemize}[label=$\\square$]
  \\item [$\\square$] Incomplete task
  \\item [$\\boxtimes$] Completed task
  \\item [$\\square$] Pending research review
\\end{itemize}\n`;
        break;

      default:
        snippet = `\n\\begin{itemize}
  \\item First bullet
  \\item Second bullet
\\end{itemize}\n`;
    }

    if (window.TeXPressEditor) {
      window.TeXPressEditor.insertSnippet(snippet);
    }
  }

  // ========================================================================
  // Indent Increase & Decrease
  // ========================================================================
  function indent(direction) {
    if (!window.TeXPressEditor) return;
    const cm = window.TeXPressEditor.getCm();
    if (cm) {
      if (direction > 0) {
        cm.execCommand("indentMore");
      } else {
        cm.execCommand("indentLess");
      }
    }
  }

  return {
    init,
    toggleDropdown,
    closeAllDropdowns,
    applyLineSpacing,
    applyParagraphSpacing,
    applyNumberedListPreset,
    applyBulletListPreset,
    indent
  };
})();

// Auto-init on page load
document.addEventListener("DOMContentLoaded", () => {
  if (window.TeXPressToolbarMenus) {
    window.TeXPressToolbarMenus.init();
  }
});
