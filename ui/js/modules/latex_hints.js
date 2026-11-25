/**
 * TeXPress Studio - LaTeX Command Autocomplete & IntelliSense Engine
 * Integrates with CodeMirror show-hint addon for contextual command suggestions.
 */

window.TeXPressLatexHints = (function() {
  const LATEX_COMMANDS = [
    // 1. Structure
    { text: "\\chapter{}", displayText: "\\chapter{Title}", desc: "Top-level book chapter", snippet: "\\chapter{${1:Title}}" },
    { text: "\\section{}", displayText: "\\section{Title}", desc: "Major section heading", snippet: "\\section{${1:Title}}" },
    { text: "\\subsection{}", displayText: "\\subsection{Title}", desc: "Subsection heading", snippet: "\\subsection{${1:Title}}" },
    { text: "\\subsubsection{}", displayText: "\\subsubsection{Title}", desc: "Sub-subsection heading", snippet: "\\subsubsection{${1:Title}}" },
    { text: "\\paragraph{}", displayText: "\\paragraph{Title}", desc: "Named paragraph run-in heading", snippet: "\\paragraph{${1:Title}} " },
    { text: "\\subparagraph{}", displayText: "\\subparagraph{Title}", desc: "Sub-paragraph heading", snippet: "\\subparagraph{${1:Title}} " },
    { text: "\\appendix", displayText: "\\appendix", desc: "Start book appendix section", snippet: "\\appendix\n" },

    // 2. Environments
    { text: "\\begin{equation}\n  \n\\end{equation}", displayText: "\\begin{equation}", desc: "Numbered display math equation", snippet: "\\begin{equation}\n  ${1:E = mc^2}\n\\end{equation}\n" },
    { text: "\\begin{align}\n  \n\\end{align}", displayText: "\\begin{align}", desc: "Multi-line aligned math equations", snippet: "\\begin{align}\n  ${1:x} &= ${2:y} \\\\\n\\end{align}\n" },
    { text: "\\begin{figure}[htbp]\n  \\centering\n  \\includegraphics[width=0.85\\linewidth]{}\n  \\caption{}\n  \\label{fig:}\n\\end{figure}", displayText: "\\begin{figure}", desc: "Floating image/figure environment", snippet: "\\begin{figure}[htbp]\n  \\centering\n  \\includegraphics[width=0.85\\linewidth]{${1:figures/filename.png}}\n  \\caption{${2:Caption here}}\n  \\label{fig:${3:label}}\n\\end{figure}\n" },
    { text: "\\begin{table}[htbp]\n  \\centering\n  \\caption{}\n  \\label{tab:}\n  \\begin{tabular}{ccc}\n    \\toprule\n    Col 1 & Col 2 & Col 3 \\\\\n    \\midrule\n     &  &  \\\\\n    \\bottomrule\n  \\end{tabular}\n\\end{table}", displayText: "\\begin{table}", desc: "Academic table with booktabs styling", snippet: "\\begin{table}[htbp]\n  \\centering\n  \\caption{${1:Table caption}}\n  \\label{tab:${2:label}}\n  \\begin{tabular}{ccc}\n    \\toprule\n    ${3:Col 1} & ${4:Col 2} & ${5:Col 3} \\\\\n    \\midrule\n    A & B & C \\\\\n    \\bottomrule\n  \\end{tabular}\n\\end{table}\n" },
    { text: "\\begin{itemize}\n  \\item \n\\end{itemize}", displayText: "\\begin{itemize}", desc: "Unordered bulleted list", snippet: "\\begin{itemize}\n  \\item ${1:First item}\n\\end{itemize}\n" },
    { text: "\\begin{enumerate}\n  \\item \n\\end{enumerate}", displayText: "\\begin{enumerate}", desc: "Numbered ordered list", snippet: "\\begin{enumerate}\n  \\item ${1:First item}\n\\end{enumerate}\n" },
    { text: "\\begin{abstract}\n  \n\\end{abstract}", displayText: "\\begin{abstract}", desc: "Paper or chapter abstract block", snippet: "\\begin{abstract}\n  ${1:Abstract text here...}\n\\end{abstract}\n" },
    { text: "\\begin{quote}\n  \n\\end{quote}", displayText: "\\begin{quote}", desc: "Block quotation", snippet: "\\begin{quote}\n  ${1:Quotation text...}\n\\end{quote}\n" },
    { text: "\\begin{proof}\n  \n\\end{proof}", displayText: "\\begin{proof}", desc: "Mathematical proof environment", snippet: "\\begin{proof}\n  ${1:Proof steps...}\n\\end{proof}\n" },
    { text: "\\begin{theorem}\n  \n\\end{theorem}", displayText: "\\begin{theorem}", desc: "Mathematical theorem block", snippet: "\\begin{theorem}\n  ${1:Theorem statement...}\n\\end{theorem}\n" },

    // 3. Citations & References
    { text: "\\cite{}", displayText: "\\cite{key}", desc: "Bibliographic citation", snippet: "\\cite{${1:key}}" },
    { text: "\\citep{}", displayText: "\\citep{key}", desc: "Parenthetical citation (Author, Year)", snippet: "\\citep{${1:key}}" },
    { text: "\\citet{}", displayText: "\\citet{key}", desc: "Textual citation Author (Year)", snippet: "\\citet{${1:key}}" },
    { text: "\\ref{}", displayText: "\\ref{label}", desc: "Cross-reference to section or float", snippet: "\\ref{${1:label}}" },
    { text: "\\eqref{}", displayText: "\\eqref{eq:label}", desc: "Parenthesized equation reference (1.1)", snippet: "\\eqref{eq:${1:label}}" },
    { text: "\\label{}", displayText: "\\label{name}", desc: "Anchor target for cross-references", snippet: "\\label{${1:name}}" },

    // 4. Text & Typography
    { text: "\\textbf{}", displayText: "\\textbf{text}", desc: "Bold font weight", snippet: "\\textbf{${1:text}}" },
    { text: "\\textit{}", displayText: "\\textit{text}", desc: "Italic font slant", snippet: "\\textit{${1:text}}" },
    { text: "\\underline{}", displayText: "\\underline{text}", desc: "Underlined text", snippet: "\\underline{${1:text}}" },
    { text: "\\emph{}", displayText: "\\emph{text}", desc: "Emphasized text", snippet: "\\emph{${1:text}}" },
    { text: "\\texttt{}", displayText: "\\texttt{code}", desc: "Monospace typewriter font", snippet: "\\texttt{${1:code}}" },
    { text: "\\textsf{}", displayText: "\\textsf{text}", desc: "Sans-serif font family", snippet: "\\textsf{${1:text}}" },
    { text: "\\textsc{}", displayText: "\\textsc{text}", desc: "Small capital letters", snippet: "\\textsc{${1:text}}" },
    { text: "\\footnote{}", displayText: "\\footnote{note}", desc: "Insert bottom-of-page footnote", snippet: "\\footnote{${1:text}}" },

    // 5. Math Formulas
    { text: "\\frac{}{}", displayText: "\\frac{num}{den}", desc: "Fraction: numerator over denominator", snippet: "\\frac{${1:num}}{${2:den}}" },
    { text: "\\sqrt{}", displayText: "\\sqrt{x}", desc: "Square root radical", snippet: "\\sqrt{${1:x}}" },
    { text: "\\sum_{i=1}^{n}", displayText: "\\sum_{i=1}^{n}", desc: "Summation notation", snippet: "\\sum_{${1:i=1}}^{${2:n}} " },
    { text: "\\int_{a}^{b}", displayText: "\\int_{a}^{b}", desc: "Definite integral", snippet: "\\int_{${1:a}}^{${2:b}} " },
    { text: "\\prod_{i=1}^{n}", displayText: "\\prod_{i=1}^{n}", desc: "Product notation", snippet: "\\prod_{${1:i=1}}^{${2:n}} " },
    { text: "\\lim_{x \\to 0}", displayText: "\\lim_{x \\to 0}", desc: "Limit notation", snippet: "\\lim_{${1:x \\to 0}} " },
    { text: "\\partial", displayText: "\\partial", desc: "Partial derivative symbol (∂)", snippet: "\\partial " },
    { text: "\\nabla", displayText: "\\nabla", desc: "Nabla gradient vector (∇)", snippet: "\\nabla " },
    { text: "\\infty", displayText: "\\infty", desc: "Infinity symbol (∞)", snippet: "\\infty" },
    { text: "\\alpha", displayText: "\\alpha", desc: "Greek letter alpha (α)", snippet: "\\alpha " },
    { text: "\\beta", displayText: "\\beta", desc: "Greek letter beta (β)", snippet: "\\beta " },
    { text: "\\gamma", displayText: "\\gamma", desc: "Greek letter gamma (γ)", snippet: "\\gamma " },
    { text: "\\delta", displayText: "\\delta", desc: "Greek letter delta (δ)", snippet: "\\delta " },
    { text: "\\epsilon", displayText: "\\epsilon", desc: "Greek letter epsilon (ε)", snippet: "\\epsilon " },
    { text: "\\lambda", displayText: "\\lambda", desc: "Greek letter lambda (λ)", snippet: "\\lambda " },
    { text: "\\mu", displayText: "\\mu", desc: "Greek letter mu (μ)", snippet: "\\mu " },
    { text: "\\pi", displayText: "\\pi", desc: "Greek letter pi (π)", snippet: "\\pi " },
    { text: "\\sigma", displayText: "\\sigma", desc: "Greek letter sigma (σ)", snippet: "\\sigma " },
    { text: "\\omega", displayText: "\\omega", desc: "Greek letter omega (ω)", snippet: "\\omega " },
    { text: "\\Delta", displayText: "\\Delta", desc: "Capital Greek Delta (Δ)", snippet: "\\Delta " },

    // 6. Preamble & Document
    { text: "\\usepackage{}", displayText: "\\usepackage{package}", desc: "Load LaTeX package in preamble", snippet: "\\usepackage{${1:package}}" },
    { text: "\\documentclass{}", displayText: "\\documentclass[11pt]{book}", desc: "Document class setup", snippet: "\\documentclass[11pt,twoside]{${1:book}}" },
    { text: "\\title{}", displayText: "\\title{Book Title}", desc: "Define document title", snippet: "\\title{${1:Title}}" },
    { text: "\\author{}", displayText: "\\author{Author Name}", desc: "Define document author", snippet: "\\author{${1:Author}}" },
    { text: "\\date{\\today}", displayText: "\\date{\\today}", desc: "Current date macro", snippet: "\\date{\\today}" },
    { text: "\\maketitle", displayText: "\\maketitle", desc: "Render document title block", snippet: "\\maketitle\n" },
    { text: "\\tableofcontents", displayText: "\\tableofcontents", desc: "Generate Table of Contents", snippet: "\\tableofcontents\n" },
    { text: "\\include{}", displayText: "\\include{chapters/file}", desc: "Include child chapter file", snippet: "\\include{${1:chapters/01_intro.tex}}" },
    { text: "\\input{}", displayText: "\\input{file}", desc: "Inline text input without page break", snippet: "\\input{${1:file}}" },
    { text: "\\bibliography{}", displayText: "\\bibliography{references}", desc: "Attach BibTeX references file", snippet: "\\bibliography{${1:references}}" },
    { text: "\\bibliographystyle{}", displayText: "\\bibliographystyle{plain}", desc: "Set bibliography citation style", snippet: "\\bibliographystyle{${1:plain}}" }
  ];

  function latexHint(cm) {
    const cur = cm.getCursor();
    const token = cm.getTokenAt(cur);
    const line = cm.getLine(cur.line);

    // Look back to find command prefix starting with "\"
    let start = cur.ch;
    let end = cur.ch;

    // Scan backwards from cursor to find '\'
    let prefix = "";
    let slashIdx = -1;
    for (let i = cur.ch - 1; i >= 0; i--) {
      const ch = line[i];
      if (ch === "\\") {
        slashIdx = i;
        prefix = line.substring(i, cur.ch);
        start = i;
        break;
      }
      if (/[\s,;{}()[\]$]/.test(ch)) {
        break;
      }
    }

    if (slashIdx === -1 || !prefix.startsWith("\\")) {
      return null;
    }

    const query = prefix.toLowerCase();
    const matches = LATEX_COMMANDS.filter(cmd => {
      return cmd.text.toLowerCase().startsWith(query) || cmd.displayText.toLowerCase().startsWith(query);
    });

    if (matches.length === 0) return null;

    return {
      list: matches.map(cmd => {
        return {
          text: cmd.text,
          displayText: `${cmd.displayText} — ${cmd.desc}`,
          className: "latex-hint-item",
          hint: (cmInstance, data, curHint) => {
            // Replace prefix with completed text
            cmInstance.replaceRange(cmd.text, CodeMirror.Pos(cur.line, start), CodeMirror.Pos(cur.line, end));
            // Position cursor inside braces if command has '{}'
            const braceIdx = cmd.text.indexOf("{");
            if (braceIdx !== -1) {
              cmInstance.setCursor(CodeMirror.Pos(cur.line, start + braceIdx + 1));
            }
          }
        };
      }),
      from: CodeMirror.Pos(cur.line, start),
      to: CodeMirror.Pos(cur.line, end)
    };
  }

  function show(cm) {
    if (typeof CodeMirror === "undefined" || !CodeMirror.showHint) return;
    cm.showHint({
      hint: latexHint,
      completeSingle: false,
      closeOnUnfocus: true
    });
  }

  return {
    latexHint,
    show
  };
})();
