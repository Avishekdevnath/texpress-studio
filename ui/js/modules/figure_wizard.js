/**
 * TeXPress Studio - Figure Wizard Module
 * Handles visual graphic insertion, auto-staging figures to figures/ directory,
 * interactive width adjustments, caption/label sync, and LaTeX \begin{figure} generation.
 */

(function () {
  let currentFigureRelPath = "";
  let currentFigureWidth = "0.8";

  function openFigureWizard() {
    const modal = document.getElementById("figureWizardModal");
    if (modal) modal.style.display = "flex";
    updateFigurePreview();
  }

  function closeFigureWizard() {
    const modal = document.getElementById("figureWizardModal");
    if (modal) modal.style.display = "none";
  }

  async function browseFigureImage() {
    if (window.electronAPI && window.electronAPI.stageFigureDialog) {
      const res = await window.electronAPI.stageFigureDialog();
      if (res && res.success) {
        currentFigureRelPath = res.relPath;
        const fnEl = document.getElementById("figureSelectedFileName");
        if (fnEl) {
          fnEl.textContent = `✓ Staged: ${res.relPath}`;
          fnEl.style.color = "var(--text-success)";
        }

        const img = document.getElementById("figurePreviewImg");
        const placeholder = document.getElementById("figurePreviewPlaceholder");
        if (res.dataUri && img && placeholder) {
          img.src = res.dataUri;
          img.style.display = "block";
          placeholder.style.display = "none";
        }

        const baseName = res.fileName.replace(/\.[^/.]+$/, "").replace(/[^a-zA-Z0-9_-]/g, "_").toLowerCase();
        const labelEl = document.getElementById("figureLabelInput");
        if (labelEl) labelEl.value = `fig:${baseName}`;

        updateFigurePreview();
      }
    } else {
      if (typeof window.showToast === "function") {
        window.showToast("Image browser is available in the desktop application.", "info");
      } else {
        alert("Image browser is available in the desktop application.");
      }
    }
  }

  function setFigureWidth(factor) {
    currentFigureWidth = factor;
    const b50 = document.getElementById("btnFigWidth50");
    const b75 = document.getElementById("btnFigWidth75");
    const b80 = document.getElementById("btnFigWidth80");
    const b100 = document.getElementById("btnFigWidth100");
    if (b50) b50.classList.toggle("active", factor === "0.5");
    if (b75) b75.classList.toggle("active", factor === "0.75");
    if (b80) b80.classList.toggle("active", factor === "0.8");
    if (b100) b100.classList.toggle("active", factor === "1.0");
    updateFigurePreview();
  }

  function onFigureCaptionInput(val) {
    const labelInput = document.getElementById("figureLabelInput");
    if (labelInput && (!labelInput.value || labelInput.value === "fig:my_plot")) {
      const slug = (val || "").trim().toLowerCase().replace(/[^a-zA-Z0-9]+/g, "_").substring(0, 20);
      if (slug) labelInput.value = `fig:${slug}`;
    }
    updateFigurePreview();
  }

  function generateFigureLatex() {
    const relPath = currentFigureRelPath || "figures/sample_figure.png";
    const captionEl = document.getElementById("figureCaptionInput");
    const labelEl = document.getElementById("figureLabelInput");
    const placementEl = document.getElementById("figurePlacementSelect");

    const caption = (captionEl ? captionEl.value.trim() : "") || "Sample Figure Caption";
    const label = (labelEl ? labelEl.value.trim() : "") || "fig:sample";
    const placement = (placementEl ? placementEl.value : "") || "htbp";

    let code = `\\begin{figure}[${placement}]\n`;
    code += `  \\centering\n`;
    code += `  \\includegraphics[width=${currentFigureWidth}\\textwidth]{${relPath}}\n`;
    code += `  \\caption{${caption}}\n`;
    code += `  \\label{${label}}\n`;
    code += `\\end{figure}\n`;
    return code;
  }

  function updateFigurePreview() {
    const code = generateFigureLatex();
    const preview = document.getElementById("figureLatexPreview");
    if (preview) preview.textContent = code;
  }

  function copyFigureCode() {
    const code = generateFigureLatex();
    navigator.clipboard.writeText(code).then(() => {
      if (typeof window.showToast === "function") {
        window.showToast("Figure LaTeX code copied to clipboard!", "success");
      } else {
        alert("✓ Figure LaTeX code copied to clipboard!");
      }
    });
  }

  function insertFigureFromWizard() {
    const code = "\n" + generateFigureLatex() + "\n";
    if (window.TeXPressEditor) {
      window.TeXPressEditor.insertSnippet(code);
    } else {
      const ta = document.getElementById("editorTextarea");
      if (ta) {
        const start = ta.selectionStart;
        const end = ta.selectionEnd;
        ta.value = ta.value.substring(0, start) + code + ta.value.substring(end);
        ta.selectionStart = ta.selectionEnd = start + code.length;
        ta.focus();
      }
    }
    closeFigureWizard();
  }

  // Expose API
  window.TeXPressFigure = {
    openFigureWizard,
    closeFigureWizard,
    browseFigureImage,
    setFigureWidth,
    onFigureCaptionInput,
    generateFigureLatex,
    updateFigurePreview,
    copyFigureCode,
    insertFigureFromWizard
  };

  // Global bindings for inline onclicks
  window.openFigureWizard = openFigureWizard;
  window.closeFigureWizard = closeFigureWizard;
  window.browseFigureImage = browseFigureImage;
  window.setFigureWidth = setFigureWidth;
  window.onFigureCaptionInput = onFigureCaptionInput;
  window.copyFigureCode = copyFigureCode;
  window.insertFigureFromWizard = insertFigureFromWizard;
})();
