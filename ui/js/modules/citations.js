/**
 * TeXPress Studio - Zotero / Mendeley Style Citation Explorer & BibTeX Parser
 */

window.TeXPressCitations = (function() {
  let parsedCitations = [];

  async function loadCitations() {
    parsedCitations = [];
    try {
      let bibContent = "";
      if (window.electronAPI && window.electronAPI.readFile) {
        const res = await window.electronAPI.readFile("references.bib");
        if (res && res.success) bibContent = res.content;
      }
      if (bibContent) {
        parsedCitations = parseBibTeX(bibContent);
      }
    } catch (e) {
      console.warn("Could not read references.bib:", e);
    }
  }

  function parseBibTeX(raw) {
    const entries = [];
    const entryRegex = /@([a-zA-Z]+)\s*\{\s*([^,]+),([\s\S]*?)(?=\n@|\n*$)/g;
    let match;

    while ((match = entryRegex.exec(raw)) !== null) {
      const type = match[1].toLowerCase();
      const key = match[2].trim();
      const body = match[3];

      function getField(name) {
        const fRegex = new RegExp(`${name}\\s*=\\s*[{"]([^}"]+)[}"]`, "i");
        const fMatch = body.match(fRegex);
        return fMatch ? fMatch[1].trim() : "";
      }

      entries.push({
        key,
        type,
        title: getField("title") || key,
        author: getField("author") || "Unknown author",
        year: getField("year") || "n.d.",
        journal: getField("journal") || getField("booktitle") || getField("publisher") || ""
      });
    }
    return entries;
  }

  function openPicker() {
    loadCitations().then(() => {
      switchTab("browse");
      filter("");
      const modal = document.getElementById("citationModal");
      if (modal) modal.style.display = "flex";
      setTimeout(() => {
        const input = document.getElementById("citationSearchInput");
        if (input) { input.focus(); input.value = ""; }
      }, 50);
    });
  }

  function closePicker() {
    const modal = document.getElementById("citationModal");
    if (modal) modal.style.display = "none";
    const textarea = document.getElementById("editorTextarea");
    if (textarea) textarea.focus();
  }

  function switchTab(tab) {
    const browseTab = document.getElementById("btnCiteTabBrowse");
    const addTab = document.getElementById("btnCiteTabAdd");
    const browseView = document.getElementById("citeViewBrowse");
    const addView = document.getElementById("citeViewAdd");

    if (tab === "browse") {
      if (browseTab) browseTab.classList.add("active");
      if (addTab) addTab.classList.remove("active");
      if (browseView) browseView.style.display = "block";
      if (addView) addView.style.display = "none";
    } else {
      if (addTab) addTab.classList.add("active");
      if (browseTab) browseTab.classList.remove("active");
      if (addView) addView.style.display = "block";
      if (browseView) browseView.style.display = "none";
    }
  }

  function filter(query) {
    const container = document.getElementById("citationCardsList");
    if (!container) return;
    const q = (query || "").toLowerCase();

    const filtered = parsedCitations.filter(c => {
      return c.key.toLowerCase().includes(q) ||
             c.title.toLowerCase().includes(q) ||
             c.author.toLowerCase().includes(q) ||
             c.year.includes(q);
    });

    if (filtered.length === 0) {
      container.innerHTML = `<div style="text-align: center; padding: 24px; color: var(--text-muted); font-size: 12px;">
        No matching references found in references.bib.
      </div>`;
      return;
    }

    container.innerHTML = filtered.map(c => `
      <div class="citation-card-item" onclick="TeXPressCitations.insertKey('${c.key}')" title="Click to insert \\cite{${c.key}}">
        <div style="display: flex; justify-content: space-between; align-items: center;">
          <span class="citation-card-key">${c.key}</span>
          <span style="font-size: 10px; color: var(--text-muted); text-transform: uppercase;">${c.type}</span>
        </div>
        <div class="citation-card-title">${escapeHtml(c.title)}</div>
        <div class="citation-card-author">${escapeHtml(c.author)} (${c.year})</div>
        ${c.journal ? `<div class="citation-card-meta">${escapeHtml(c.journal)}</div>` : ""}
      </div>
    `).join("");
  }

  function insertKey(key) {
    const textarea = document.getElementById("editorTextarea");
    if (!textarea) return;

    if (window.TeXPressEditor) window.TeXPressEditor.recordSnapshot(true);

    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const snippet = `\\cite{${key}}`;
    textarea.setRangeText(snippet, start, end, "end");
    closePicker();

    if (window.TeXPressEditor) window.TeXPressEditor.recordSnapshot(true);
    if (typeof window.updateStatusBarWordCount === "function") window.updateStatusBarWordCount();
  }

  function generateKey() {
    const author = document.getElementById("newRefAuthor").value.trim();
    const year = document.getElementById("newRefYear").value.trim() || new Date().getFullYear();
    const title = document.getElementById("newRefTitle").value.trim();

    let firstAuthor = "author";
    if (author) {
      const parts = author.split(/[, ]+/);
      firstAuthor = parts[0].toLowerCase().replace(/[^a-z0-9]/g, "");
    }
    let firstWord = "ref";
    if (title) {
      const words = title.split(/\s+/).filter(w => w.length > 3);
      if (words.length > 0) firstWord = words[0].toLowerCase().replace(/[^a-z0-9]/g, "");
    }

    const generatedKey = `${firstAuthor}${year}${firstWord}`;
    document.getElementById("newRefKey").value = generatedKey;
  }

  async function saveAndInsert() {
    const type = document.getElementById("newRefType").value;
    const key = document.getElementById("newRefKey").value.trim() || "new_reference";
    const title = document.getElementById("newRefTitle").value.trim();
    const author = document.getElementById("newRefAuthor").value.trim();
    const year = document.getElementById("newRefYear").value.trim();
    const journal = document.getElementById("newRefJournal").value.trim();

    if (!title || !author) {
      if (typeof window.showToast === "function") {
        window.showToast("Please enter at least Title and Author.", "warning");
      } else {
        alert("Please enter at least Title and Author.");
      }
      return;
    }

    const bibBlock = `\n@${type}{${key},\n  author = {${author}},\n  title = {${title}},\n  year = {${year || "2024"}},\n  journal = {${journal || "Academic Press"}}\n}\n`;

    try {
      let existing = "";
      if (window.electronAPI && window.electronAPI.readFile) {
        const readRes = await window.electronAPI.readFile("references.bib");
        if (readRes && readRes.success) existing = readRes.content;
        await window.electronAPI.saveFile({ relPath: "references.bib", content: existing + bibBlock });
      }
      insertKey(key);
      if (typeof window.showToast === "function") {
        window.showToast(`Reference [${key}] saved to references.bib and inserted!`, "success");
      } else {
        alert(`✓ Reference [${key}] saved to references.bib and inserted!`);
      }
    } catch (err) {
      console.error("Failed to append reference:", err);
    }
  }

  function escapeHtml(str) {
    return String(str).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/'/g, '&#39;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }

  function getCitations() {
    return parsedCitations;
  }

  return {
    loadCitations,
    openPicker,
    closePicker,
    switchTab,
    filter,
    insertKey,
    generateKey,
    saveAndInsert,
    getCitations
  };
})();

// Global convenience wrappers
window.openCitationPicker = () => window.TeXPressCitations.openPicker();
window.closeCitationPicker = () => window.TeXPressCitations.closePicker();
window.switchCiteModalTab = (tab) => window.TeXPressCitations.switchTab(tab);
window.filterCitations = (q) => window.TeXPressCitations.filter(q);
window.generateNewRefKey = () => window.TeXPressCitations.generateKey();
window.saveAndInsertNewReference = () => window.TeXPressCitations.saveAndInsert();
