/**
 * TeXPress Studio - Symbols Palette Module
 * Visual Greek & Math Symbols Dock with search filtering and category pills.
 */

(function () {
  const LATEX_SYMBOLS = [
    // Greek Lowercase
    { symbol: "α", macro: "\\alpha", name: "alpha", cat: "greek" },
    { symbol: "β", macro: "\\beta", name: "beta", cat: "greek" },
    { symbol: "γ", macro: "\\gamma", name: "gamma", cat: "greek" },
    { symbol: "δ", macro: "\\delta", name: "delta", cat: "greek" },
    { symbol: "ε", macro: "\\epsilon", name: "epsilon", cat: "greek" },
    { symbol: "ζ", macro: "\\zeta", name: "zeta", cat: "greek" },
    { symbol: "η", macro: "\\eta", name: "eta", cat: "greek" },
    { symbol: "θ", macro: "\\theta", name: "theta", cat: "greek" },
    { symbol: "κ", macro: "\\kappa", name: "kappa", cat: "greek" },
    { symbol: "λ", macro: "\\lambda", name: "lambda", cat: "greek" },
    { symbol: "μ", macro: "\\mu", name: "mu", cat: "greek" },
    { symbol: "ν", macro: "\\nu", name: "nu", cat: "greek" },
    { symbol: "ξ", macro: "\\xi", name: "xi", cat: "greek" },
    { symbol: "π", macro: "\\pi", name: "pi", cat: "greek" },
    { symbol: "ρ", macro: "\\rho", name: "rho", cat: "greek" },
    { symbol: "σ", macro: "\\sigma", name: "sigma", cat: "greek" },
    { symbol: "τ", macro: "\\tau", name: "tau", cat: "greek" },
    { symbol: "υ", macro: "\\upsilon", name: "upsilon", cat: "greek" },
    { symbol: "φ", macro: "\\phi", name: "phi", cat: "greek" },
    { symbol: "χ", macro: "\\chi", name: "chi", cat: "greek" },
    { symbol: "ψ", macro: "\\psi", name: "psi", cat: "greek" },
    { symbol: "ω", macro: "\\omega", name: "omega", cat: "greek" },

    // Greek Uppercase
    { symbol: "Γ", macro: "\\Gamma", name: "Gamma", cat: "greek" },
    { symbol: "Δ", macro: "\\Delta", name: "Delta", cat: "greek" },
    { symbol: "Θ", macro: "\\Theta", name: "Theta", cat: "greek" },
    { symbol: "Λ", macro: "\\Lambda", name: "Lambda", cat: "greek" },
    { symbol: "Ξ", macro: "\\Xi", name: "Xi", cat: "greek" },
    { symbol: "Π", macro: "\\Pi", name: "Pi", cat: "greek" },
    { symbol: "Σ", macro: "\\Sigma", name: "Sigma", cat: "greek" },
    { symbol: "Φ", macro: "\\Phi", name: "Phi", cat: "greek" },
    { symbol: "Ψ", macro: "\\Psi", name: "Psi", cat: "greek" },
    { symbol: "Ω", macro: "\\Omega", name: "Omega", cat: "greek" },

    // Calculus & Operators
    { symbol: "∫", macro: "\\int_{a}^{b} ", name: "integral", cat: "calc" },
    { symbol: "∬", macro: "\\iint ", name: "double integral", cat: "calc" },
    { symbol: "∮", macro: "\\oint ", name: "contour integral", cat: "calc" },
    { symbol: "∑", macro: "\\sum_{i=1}^{n} ", name: "summation", cat: "calc" },
    { symbol: "∏", macro: "\\prod_{i=1}^{n} ", name: "product", cat: "calc" },
    { symbol: "∂", macro: "\\partial ", name: "partial derivative", cat: "calc" },
    { symbol: "∇", macro: "\\nabla ", name: "nabla grad", cat: "calc" },
    { symbol: "∞", macro: "\\infty ", name: "infinity", cat: "calc" },
    { symbol: "lim", macro: "\\lim_{x \\to 0} ", name: "limit", cat: "calc" },
    { symbol: "a/b", macro: "\\frac{a}{b} ", name: "fraction", cat: "calc" },
    { symbol: "√", macro: "\\sqrt{x} ", name: "square root", cat: "calc" },
    { symbol: "±", macro: "\\pm ", name: "plus minus", cat: "calc" },
    { symbol: "∓", macro: "\\mp ", name: "minus plus", cat: "calc" },
    { symbol: "×", macro: "\\times ", name: "times multiply", cat: "calc" },
    { symbol: "÷", macro: "\\div ", name: "divide", cat: "calc" },
    { symbol: "·", macro: "\\cdot ", name: "center dot", cat: "calc" },

    // Relations & Logic
    { symbol: "≤", macro: "\\le ", name: "less equal", cat: "rel" },
    { symbol: "≥", macro: "\\ge ", name: "greater equal", cat: "rel" },
    { symbol: "≠", macro: "\\neq ", name: "not equal", cat: "rel" },
    { symbol: "≈", macro: "\\approx ", name: "approximate", cat: "rel" },
    { symbol: "≡", macro: "\\equiv ", name: "equivalent identical", cat: "rel" },
    { symbol: "∼", macro: "\\sim ", name: "similar", cat: "rel" },
    { symbol: "∝", macro: "\\propto ", name: "proportional", cat: "rel" },
    { symbol: "∈", macro: "\\in ", name: "element of in", cat: "rel" },
    { symbol: "∉", macro: "\\notin ", name: "not element of", cat: "rel" },
    { symbol: "⊂", macro: "\\subset ", name: "subset", cat: "rel" },
    { symbol: "⊆", macro: "\\subseteq ", name: "subset equal", cat: "rel" },
    { symbol: "∪", macro: "\\cup ", name: "union", cat: "rel" },
    { symbol: "∩", macro: "\\cap ", name: "intersection", cat: "rel" },
    { symbol: "∀", macro: "\\forall ", name: "for all", cat: "rel" },
    { symbol: "∃", macro: "\\exists ", name: "exists", cat: "rel" },

    // Arrows & Delimiters
    { symbol: "←", macro: "\\leftarrow ", name: "left arrow", cat: "arrows" },
    { symbol: "→", macro: "\\rightarrow ", name: "right arrow to", cat: "arrows" },
    { symbol: "↔", macro: "\\leftrightarrow ", name: "left right arrow", cat: "arrows" },
    { symbol: "⇐", macro: "\\Leftarrow ", name: "double left arrow", cat: "arrows" },
    { symbol: "⇒", macro: "\\Rightarrow ", name: "implies double right", cat: "arrows" },
    { symbol: "⇔", macro: "\\Leftrightarrow ", name: "iff equivalent", cat: "arrows" },
    { symbol: "↑", macro: "\\uparrow ", name: "up arrow", cat: "arrows" },
    { symbol: "↓", macro: "\\downarrow ", name: "down arrow", cat: "arrows" },
    { symbol: "↦", macro: "\\mapsto ", name: "maps to", cat: "arrows" },
    { symbol: "⟨⟩", macro: "\\langle x \\rangle ", name: "angle brackets", cat: "arrows" }
  ];

  let activeCategory = "all";
  let activeSearch = "";

  function escapeJs(str) {
    return (str || "").replace(/\\/g, "\\\\").replace(/'/g, "\\'");
  }

  function renderSymbols() {
    const container = document.getElementById("symbolsGrid");
    if (!container) return;

    const filtered = LATEX_SYMBOLS.filter(item => {
      const matchesCat = (activeCategory === "all" || item.cat === activeCategory);
      const matchesSearch = !activeSearch ||
        item.name.toLowerCase().includes(activeSearch) ||
        item.macro.toLowerCase().includes(activeSearch) ||
        item.symbol.includes(activeSearch);
      return matchesCat && matchesSearch;
    });

    let html = "";
    filtered.forEach(item => {
      html += `<button class="symbol-btn" onclick="insertSymbol('${escapeJs(item.macro)}')" title="${item.macro} (${item.name})">${item.symbol}</button>`;
    });

    if (filtered.length === 0) {
      html = `<div style="grid-column: 1 / -1; padding: 16px; text-align: center; color: var(--text-muted); font-size: 11px;">No matching symbols.</div>`;
    }

    container.innerHTML = html;
  }

  function filterSymbols(val) {
    activeSearch = (val || "").trim().toLowerCase();
    renderSymbols();
  }

  function setSymbolCategory(cat) {
    activeCategory = cat;
    document.querySelectorAll(".cat-pill").forEach(pill => {
      if (pill.dataset.cat === cat) {
        pill.classList.add("active");
      } else {
        pill.classList.remove("active");
      }
    });
    renderSymbols();
  }

  function insertSymbol(macro) {
    if (window.TeXPressEditor) {
      window.TeXPressEditor.insertSnippet(macro);
    } else {
      const ta = document.getElementById("editorTextarea");
      if (ta) {
        const start = ta.selectionStart;
        const end = ta.selectionEnd;
        ta.value = ta.value.substring(0, start) + macro + ta.value.substring(end);
        ta.selectionStart = ta.selectionEnd = start + macro.length;
        ta.focus();
      }
    }
  }

  function switchSidebarTab(tab) {
    const btnFiles = document.getElementById("btnTabFiles");
    const btnSymbols = document.getElementById("btnTabSymbols");
    const fileTree = document.getElementById("fileTreeContainer");
    const outlineBox = document.getElementById("outlineBox");
    const symbolsPane = document.getElementById("symbolsPaneContainer");

    if (tab === "files") {
      if (btnFiles) btnFiles.classList.add("active");
      if (btnSymbols) btnSymbols.classList.remove("active");
      if (fileTree) fileTree.style.display = "block";
      if (outlineBox) outlineBox.style.display = "block";
      if (symbolsPane) symbolsPane.style.display = "none";
    } else {
      if (btnFiles) btnFiles.classList.remove("active");
      if (btnSymbols) btnSymbols.classList.add("active");
      if (fileTree) fileTree.style.display = "none";
      if (outlineBox) outlineBox.style.display = "none";
      if (symbolsPane) symbolsPane.style.display = "block";
      renderSymbols();
    }
  }

  function toggleSymbolsTab() {
    const symbolsPane = document.getElementById("symbolsPaneContainer");
    if (symbolsPane && symbolsPane.style.display === "block") {
      switchSidebarTab("files");
    } else {
      switchSidebarTab("symbols");
    }
  }

  function init() {
    renderSymbols();
  }

  window.TeXPressSymbols = {
    init,
    renderSymbols,
    filterSymbols,
    setSymbolCategory,
    insertSymbol,
    switchSidebarTab,
    toggleSymbolsTab
  };

  // Global bindings for inline onclicks
  window.filterSymbols = filterSymbols;
  window.setSymbolCategory = setSymbolCategory;
  window.insertSymbol = insertSymbol;
  window.switchSidebarTab = switchSidebarTab;
  window.toggleSymbolsTab = toggleSymbolsTab;
})();
