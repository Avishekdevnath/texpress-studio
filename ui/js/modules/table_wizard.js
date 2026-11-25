/**
 * TeXPress Studio - Spreadsheet-to-LaTeX Table Wizard (booktabs)
 */

window.TeXPressTableWizard = (function() {
  let tableRows = 3;
  let tableCols = 3;
  let tableAlignments = ["l", "l", "r"];
  let tableData = [
    ["Parameter", "Description", "Value"],
    ["Enthalpy (dH)", "Van 't Hoff heat", "-45.2 kJ/mol"],
    ["Entropy (dS)", "Conformational loss", "-120.5 J/mol K"]
  ];

  function open() {
    const modal = document.getElementById("tableWizardModal");
    if (modal) modal.style.display = "flex";
    renderGrid();
    updatePreview();
  }

  function close() {
    const modal = document.getElementById("tableWizardModal");
    if (modal) modal.style.display = "none";
    const textarea = document.getElementById("editorTextarea");
    if (textarea) textarea.focus();
  }

  function renderGrid() {
    const grid = document.getElementById("tableWizardGrid");
    const alignBar = document.getElementById("tableAlignmentBar");
    if (!grid || !alignBar) return;

    grid.innerHTML = "";
    alignBar.innerHTML = "";

    for (let c = 0; c < tableCols; c++) {
      const curAlign = tableAlignments[c] || "l";
      const alignBtn = document.createElement("button");
      alignBtn.className = "align-btn";
      alignBtn.textContent = `Col ${c+1}: ${curAlign.toUpperCase()}`;
      alignBtn.title = "Click to cycle alignment (Left -> Center -> Right)";
      alignBtn.onclick = () => cycleAlignment(c);
      alignBar.appendChild(alignBtn);
    }

    for (let r = 0; r < tableRows; r++) {
      const tr = document.createElement("tr");
      for (let c = 0; c < tableCols; c++) {
        const td = document.createElement("td");
        const input = document.createElement("input");
        input.type = "text";
        input.value = (tableData[r] && tableData[r][c] !== undefined) ? tableData[r][c] : "";
        input.oninput = (e) => {
          if (!tableData[r]) tableData[r] = [];
          tableData[r][c] = e.target.value;
          updatePreview();
        };
        td.appendChild(input);
        tr.appendChild(td);
      }
      grid.appendChild(tr);
    }

    const rDisp = document.getElementById("gridRowsDisplay");
    const cDisp = document.getElementById("gridColsDisplay");
    if (rDisp) rDisp.textContent = tableRows;
    if (cDisp) cDisp.textContent = tableCols;
  }

  function cycleAlignment(colIdx) {
    const cur = tableAlignments[colIdx] || "l";
    tableAlignments[colIdx] = cur === "l" ? "c" : cur === "c" ? "r" : "l";
    renderGrid();
    updatePreview();
  }

  function parseExcelPaste() {
    const input = document.getElementById("excelPasteInput").value.trim();
    if (!input) return;

    const lines = input.split(/\r?\n/).filter(l => l.trim().length > 0);
    const parsed = lines.map(line => {
      if (line.includes("\t")) return line.split("\t").map(s => s.trim());
      return line.split(",").map(s => s.trim());
    });

    if (parsed.length > 0) {
      tableRows = parsed.length;
      tableCols = Math.max(...parsed.map(row => row.length));
      tableData = parsed;
      tableAlignments = Array(tableCols).fill("l");
      renderGrid();
      updatePreview();
    }
  }

  function clearGrid() {
    tableData = [];
    tableRows = 3;
    tableCols = 3;
    tableAlignments = ["l", "l", "r"];
    const input = document.getElementById("excelPasteInput");
    if (input) input.value = "";
    renderGrid();
    updatePreview();
  }

  function changeRows(delta) {
    tableRows = Math.max(1, Math.min(tableRows + delta, 30));
    renderGrid();
    updatePreview();
  }

  function changeCols(delta) {
    tableCols = Math.max(1, Math.min(tableCols + delta, 15));
    while (tableAlignments.length < tableCols) tableAlignments.push("l");
    renderGrid();
    updatePreview();
  }

  function generateLatex() {
    const caption = document.getElementById("tableCaptionInput").value.trim() || "Academic Table";
    const label = document.getElementById("tableLabelInput").value.trim() || "tab:sample";
    const alignStr = tableAlignments.slice(0, tableCols).join("");

    let code = `\\begin{table}[htbp]\n`;
    code += `  \\centering\n`;
    code += `  \\caption{${caption}}\n`;
    code += `  \\label{${label}}\n`;
    code += `  \\begin{tabular}{${alignStr}}\n`;
    code += `    \\toprule\n`;

    for (let r = 0; r < tableRows; r++) {
      const rowVals = [];
      for (let c = 0; c < tableCols; c++) {
        const val = (tableData[r] && tableData[r][c] !== undefined) ? tableData[r][c] : "";
        rowVals.push(val);
      }
      code += `    ${rowVals.join(" & ")} \\\\\n`;
      if (r === 0) {
        code += `    \\midrule\n`;
      }
    }

    code += `    \\bottomrule\n`;
    code += `  \\end{tabular}\n`;
    code += `\\end{table}\n`;
    return code;
  }

  function updatePreview() {
    const preview = document.getElementById("tableLatexPreview");
    if (preview) preview.textContent = generateLatex();
  }

  function copyCode() {
    navigator.clipboard.writeText(generateLatex()).then(() => {
      if (typeof window.showToast === "function") {
        window.showToast("booktabs Table LaTeX code copied to clipboard!", "success");
      } else {
        alert("✓ booktabs Table LaTeX code copied to clipboard!");
      }
    });
  }

  function insert() {
    if (!window.currentProjectName) {
      if (typeof window.showToast === "function") {
        window.showToast("Please open or create a project first.", "warning");
      } else {
        alert("Please open or create a project first.");
      }
      return;
    }
    const code = "\n" + generateLatex() + "\n";
    const textarea = document.getElementById("editorTextarea");
    if (!textarea) return;

    if (window.TeXPressEditor) window.TeXPressEditor.recordSnapshot(true);

    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const val = textarea.value;
    textarea.value = val.substring(0, start) + code + val.substring(end);
    textarea.selectionStart = textarea.selectionEnd = start + code.length;
    textarea.focus();

    if (window.TeXPressEditor) window.TeXPressEditor.recordSnapshot(true);
    if (typeof window.updateStatusBarWordCount === "function") window.updateStatusBarWordCount();
    close();
  }

  return {
    open,
    close,
    parseExcelPaste,
    clearGrid,
    changeRows,
    changeCols,
    updatePreview,
    copyCode,
    insert
  };
})();

// Global convenience wrappers
window.openTableWizard = () => window.TeXPressTableWizard.open();
window.closeTableWizard = () => window.TeXPressTableWizard.close();
window.parseExcelPaste = () => window.TeXPressTableWizard.parseExcelPaste();
window.clearTableGrid = () => window.TeXPressTableWizard.clearGrid();
window.changeGridRows = (d) => window.TeXPressTableWizard.changeRows(d);
window.changeGridCols = (d) => window.TeXPressTableWizard.changeCols(d);
window.updateTablePreview = () => window.TeXPressTableWizard.updatePreview();
window.copyTableCode = () => window.TeXPressTableWizard.copyCode();
window.insertTableFromWizard = () => window.TeXPressTableWizard.insert();
