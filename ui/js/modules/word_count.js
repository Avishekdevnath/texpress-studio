/**
 * TeXPress Studio - Academic Prose Statistics & Word Counter
 */

window.TeXPressWordCount = (function() {
  let statsScope = "project";

  function computeStats(rawTex) {
    if (!rawTex) {
      return { words: 0, journalPages: "0.0", bookPages: "0.0", chars: 0, equations: 0, floats: 0 };
    }

    const inlineEqs = (rawTex.match(/\$[^$]+\$/g) || []).length;
    const blockEqs = (rawTex.match(/\\begin\{(equation|align|gather|multline)\*?\}[\s\S]*?\\end\{\1\*?\}/g) || []).length;
    const equations = inlineEqs + blockEqs;

    const tables = (rawTex.match(/\\begin\{table\*?\}[\s\S]*?\\end\{table\*?\}/g) || []).length;
    const figures = (rawTex.match(/\\begin\{figure\*?\}[\s\S]*?\\end\{figure\*?\}/g) || []).length;
    const floats = tables + figures;

    let prose = rawTex;
    let preambleWords = "";
    const titleMatches = rawTex.match(/\\title\{([^}]+)\}/g);
    if (titleMatches) {
      preambleWords += " " + titleMatches.map(m => m.replace(/\\title\{|\}/g, "")).join(" ");
    }
    const authorMatches = rawTex.match(/\\author\{([^}]+)\}/g);
    if (authorMatches) {
      preambleWords += " " + authorMatches.map(m => m.replace(/\\author\{|\}/g, "")).join(" ");
    }

    const docStart = prose.indexOf("\\begin{document}");
    if (docStart !== -1) {
      prose = preambleWords + " " + prose.substring(docStart + 16);
    }
    const docEnd = prose.indexOf("\\end{document}");
    if (docEnd !== -1) prose = prose.substring(0, docEnd);

    prose = prose.replace(/(^|[^\\])%.*$/gm, "");
    prose = prose.replace(/\\begin\{(equation|align|gather|multline)\*?\}[\s\S]*?\\end\{\1\*?\}/g, " ");
    prose = prose.replace(/\$[^$]+\$/g, " ");
    prose = prose.replace(/\\(cite|ref|label|pageref|eqref)\{[^}]+\}/g, " ");
    prose = prose.replace(/\\begin\{[^}]+\}/g, " ");
    prose = prose.replace(/\\end\{[^}]+\}/g, " ");
    prose = prose.replace(/\\[a-zA-Z]+(\[[^\]]*\])?(\{([^}]*)\})?/g, " $3 ");
    prose = prose.replace(/[{}[\]\\]/g, " ");

    const wordsArray = prose.trim().split(/\s+/).filter(w => w.length > 0 && /[a-zA-Z0-9]/.test(w));
    const words = wordsArray.length;
    const chars = prose.length;
    const journalPages = (words / 500).toFixed(1);
    const bookPages = (words / 300).toFixed(1);

    return { words, journalPages, bookPages, chars, equations, floats };
  }

  function getActiveContent() {
    if (window.TeXPressEditor) {
      return window.TeXPressEditor.getContent();
    }
    const textarea = document.getElementById("editorTextarea");
    return textarea ? textarea.value : "";
  }

  async function updateStatusBarWordCount() {
    const countEl = document.getElementById("statusWordCount");
    if (!countEl) return;
    const activeText = getActiveContent();
    const stats = computeStats(activeText);
    countEl.textContent = `Editor: ${stats.words.toLocaleString()} words`;
  }

  function openModal(preferredScope) {
    const modal = document.getElementById("wordCountModal");
    if (modal) modal.style.display = "flex";
    if (preferredScope) {
      statsScope = preferredScope;
    } else {
      const pStats = window.TeXPressPDF ? window.TeXPressPDF.getPdfStats() : null;
      if (pStats && pStats.totalWords > 0) {
        statsScope = "pdf";
      } else {
        statsScope = "project";
      }
    }
    setScope(statsScope);
  }

  function closeModal() {
    const modal = document.getElementById("wordCountModal");
    if (modal) modal.style.display = "none";
  }

  async function setScope(scope) {
    statsScope = scope;
    const btnPdf = document.getElementById("btnStatsScopePdf");
    const btnActive = document.getElementById("btnStatsScopeActive");
    const btnProj = document.getElementById("btnStatsScopeProject");
    if (btnPdf) btnPdf.classList.toggle("active", scope === "pdf");
    if (btnActive) btnActive.classList.toggle("active", scope === "active");
    if (btnProj) btnProj.classList.toggle("active", scope === "project");

    const breakdownEl = document.getElementById("statsChapterBreakdown");
    const activeText = getActiveContent();

    if (scope === "pdf") {
      const pStats = window.TeXPressPDF ? window.TeXPressPDF.getPdfStats() : null;
      if (pStats && pStats.totalWords > 0) {
        const stats = {
          words: pStats.totalWords,
          journalPages: pStats.numPages.toFixed(1),
          bookPages: (pStats.totalWords / 300).toFixed(1),
          chars: pStats.totalChars,
          equations: "Rendered",
          floats: `${pStats.numPages} Pages`
        };
        renderStatsDisplay(stats);

        if (breakdownEl) {
          let pagesHtml = "";
          for (const pg of pStats.pages) {
            pagesHtml += `
              <div class="stats-chapter-item">
                <div style="display: flex; align-items: center; gap: 8px;">
                  <span>📑</span>
                  <span style="font-weight: 600; color: var(--text-primary); min-width: 55px;">Page ${pg.page}</span>
                  ${pg.preview ? `<span style="font-size: 11px; color: var(--text-muted); max-width: 290px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">"${escapeHtml(pg.preview)}..."</span>` : ''}
                </div>
                <span class="stats-chapter-words">${pg.words.toLocaleString()} words</span>
              </div>
            `;
          }
          breakdownEl.innerHTML = pagesHtml;
        }
      } else {
        renderStatsDisplay({ words: 0, journalPages: "0.0", bookPages: "0.0", chars: 0, equations: 0, floats: 0 });
        if (breakdownEl) {
          breakdownEl.innerHTML = `
            <div style="text-align: center; padding: 24px; color: var(--text-muted); font-size: 12px;">
              <div>📖 No compiled PDF words available yet.</div>
              <div style="margin-top: 6px;">Press <strong>Compile (F5)</strong> to build and compute exact compiled PDF word counts.</div>
            </div>
          `;
        }
      }
    } else if (scope === "active") {
      const activeFile = window.activeFileKey || "Active Document";
      if (breakdownEl) {
        breakdownEl.innerHTML = `
          <div class="stats-chapter-item">
            <div style="display: flex; align-items: center; gap: 6px;">
              <span>📄</span>
              <span style="font-weight: 600; color: var(--text-primary);">${escapeHtml(activeFile)}</span>
              <span style="font-size: 10px; color: var(--google-blue); font-weight: 600;">[CURRENTLY EDITING]</span>
            </div>
            <span class="stats-chapter-words">${computeStats(activeText).words.toLocaleString()} words</span>
          </div>
        `;
      }
      const stats = computeStats(activeText);
      renderStatsDisplay(stats);
    } else {
      let totalText = "";
      let chapterHtml = "";

      if (window.electronAPI && window.electronAPI.getAllTexContents) {
        const res = await window.electronAPI.getAllTexContents();
        if (res.success && res.files && res.files.length > 0) {
          for (const f of res.files) {
            const displayName = f.name || (f.path ? f.path.split("/").pop() : "document.tex");
            const folderPrefix = f.path && f.path.includes("/") ? f.path.substring(0, f.path.lastIndexOf("/") + 1) : "";
            
            // If this file is currently being edited in CodeMirror, use the live edited content
            let fileContent = f.content;
            if (window.activeFileKey === f.path) {
              fileContent = activeText;
            }

            const st = computeStats(fileContent);
            totalText += " " + fileContent;
            chapterHtml += `
              <div class="stats-chapter-item">
                <div style="display: flex; align-items: center; gap: 6px;">
                  <span>📄</span>
                  <span style="font-weight: 600; color: var(--text-primary);">${escapeHtml(displayName)}</span>
                  ${folderPrefix ? `<span style="font-size: 10px; color: var(--text-muted);">(${escapeHtml(folderPrefix)})</span>` : ''}
                </div>
                <span class="stats-chapter-words">${st.words.toLocaleString()} words</span>
              </div>
            `;
          }
        }
      }

      if (!totalText.trim()) {
        totalText = activeText;
      }

      const totalStats = computeStats(totalText);
      renderStatsDisplay(totalStats);
      if (breakdownEl) breakdownEl.innerHTML = chapterHtml;
    }
  }

  function renderStatsDisplay(stats) {
    const wEl = document.getElementById("statProseWords");
    const jEl = document.getElementById("statEstJournalPages");
    const bEl = document.getElementById("statEstBookPages");
    const cEl = document.getElementById("statCharacters");
    const eEl = document.getElementById("statEquations");
    const fEl = document.getElementById("statFloats");
    if (wEl) wEl.textContent = stats.words.toLocaleString();
    if (jEl) jEl.textContent = stats.journalPages;
    if (bEl) bEl.textContent = stats.bookPages;
    if (cEl) cEl.textContent = stats.chars.toLocaleString();
    if (eEl) eEl.textContent = stats.equations;
    if (fEl) fEl.textContent = stats.floats;
  }

  function escapeHtml(str) {
    return String(str).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/'/g, '&#39;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }

  return {
    computeStats,
    updateStatusBarWordCount,
    openModal,
    closeModal,
    setScope
  };
})();

// Global convenience wrappers
window.openWordCountModal = (scope) => window.TeXPressWordCount.openModal(scope);
window.closeWordCountModal = () => window.TeXPressWordCount.closeModal();
window.setWordCountScope = (s) => window.TeXPressWordCount.setScope(s);
window.updateStatusBarWordCount = () => window.TeXPressWordCount.updateStatusBarWordCount();
