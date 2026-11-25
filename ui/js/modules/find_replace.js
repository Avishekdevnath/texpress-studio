/**
 * TeXPress Studio - Word-Style Floating Find & Replace Bar
 */

window.TeXPressFindReplace = (function() {
  let findMatches = [];
  let currentFindIdx = -1;

  function toggle(showReplace = false) {
    const bar = document.getElementById("findReplaceBar");
    if (!bar) return;
    const isVisible = (bar.style.display === "flex");
    if (isVisible && !showReplace) {
      close();
      return;
    }

    bar.style.display = "flex";
    const replaceRow = document.getElementById("replaceRow");
    if (replaceRow) replaceRow.style.display = showReplace ? "flex" : "none";

    const textarea = document.getElementById("editorTextarea");
    if (textarea) {
      const selected = textarea.value.substring(textarea.selectionStart, textarea.selectionEnd);
      const input = document.getElementById("findInput");
      if (input) {
        if (selected && selected.length < 50 && !selected.includes("\n")) {
          input.value = selected;
        }
        input.focus();
        input.select();
        onInput(input.value);
      }
    }
  }

  function close() {
    const bar = document.getElementById("findReplaceBar");
    if (bar) bar.style.display = "none";
    const textarea = document.getElementById("editorTextarea");
    if (textarea) textarea.focus();
  }

  function onInput(query) {
    findMatches = [];
    currentFindIdx = -1;
    const counter = document.getElementById("findMatchCounter");
    const textarea = document.getElementById("editorTextarea");
    if (!textarea || !query) {
      if (counter) counter.textContent = "0 of 0";
      return;
    }

    const val = textarea.value;
    const lowerVal = val.toLowerCase();
    const lowerQuery = query.toLowerCase();
    let pos = lowerVal.indexOf(lowerQuery);

    while (pos !== -1) {
      findMatches.push({ start: pos, end: pos + query.length });
      pos = lowerVal.indexOf(lowerQuery, pos + 1);
    }

    if (findMatches.length > 0) {
      currentFindIdx = 0;
      highlightCurrent();
    }
    if (counter) {
      counter.textContent = findMatches.length > 0 ? `${currentFindIdx + 1} of ${findMatches.length}` : "0 of 0";
    }
  }

  function highlightCurrent() {
    if (currentFindIdx < 0 || currentFindIdx >= findMatches.length) return;
    const match = findMatches[currentFindIdx];
    const cm = window.TeXPressEditor ? window.TeXPressEditor.getCm() : null;
    const textarea = document.getElementById("editorTextarea");

    if (cm) {
      const from = cm.posFromIndex(match.start);
      const to = cm.posFromIndex(match.end);
      cm.setSelection(from, to);
      cm.scrollIntoView({ from, to }, 120);
      cm.focus();
    } else if (textarea) {
      textarea.focus();
      textarea.setSelectionRange(match.start, match.end);
      const lineIdx = textarea.value.substring(0, match.start).split("\n").length;
      textarea.scrollTop = Math.max(0, lineIdx * 24 - 150);
    }

    const counter = document.getElementById("findMatchCounter");
    if (counter) counter.textContent = `${currentFindIdx + 1} of ${findMatches.length}`;
  }

  function next() {
    if (findMatches.length === 0) return;
    currentFindIdx = (currentFindIdx + 1) % findMatches.length;
    highlightCurrent();
  }

  function prev() {
    if (findMatches.length === 0) return;
    currentFindIdx = (currentFindIdx - 1 + findMatches.length) % findMatches.length;
    highlightCurrent();
  }

  function replaceCurrent() {
    if (currentFindIdx < 0 || currentFindIdx >= findMatches.length) return;
    const match = findMatches[currentFindIdx];
    const replaceWith = document.getElementById("replaceInput").value || "";
    const cm = window.TeXPressEditor ? window.TeXPressEditor.getCm() : null;
    const textarea = document.getElementById("editorTextarea");

    if (cm) {
      const from = cm.posFromIndex(match.start);
      const to = cm.posFromIndex(match.end);
      cm.replaceRange(replaceWith, from, to);
      onInput(document.getElementById("findInput").value);
    } else if (textarea) {
      textarea.setRangeText(replaceWith, match.start, match.end, "select");
      onInput(document.getElementById("findInput").value);
    }

    if (typeof window.updateStatusBarWordCount === "function") window.updateStatusBarWordCount();
  }

  function replaceAll() {
    const query = document.getElementById("findInput").value;
    const replaceWith = document.getElementById("replaceInput").value || "";
    const textarea = document.getElementById("editorTextarea");
    if (!query) return;

    const cm = window.TeXPressEditor ? window.TeXPressEditor.getCm() : null;
    const count = findMatches.length;
    const regex = new RegExp(query.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "gi");

    if (cm) {
      const val = cm.getValue();
      cm.setValue(val.replace(regex, replaceWith));
      onInput("");
      if (typeof window.showToast === "function") {
        window.showToast(`Replaced ${count} occurrence(s).`, "success");
      } else {
        alert(`✓ Replaced ${count} occurrence(s).`);
      }
    } else if (textarea) {
      textarea.value = textarea.value.replace(regex, replaceWith);
      onInput("");
      if (typeof window.showToast === "function") {
        window.showToast(`Replaced ${count} occurrence(s).`, "success");
      } else {
        alert(`✓ Replaced ${count} occurrence(s).`);
      }
    }

    if (typeof window.updateStatusBarWordCount === "function") window.updateStatusBarWordCount();
  }

  return {
    toggle,
    close,
    onInput,
    next,
    prev,
    replaceCurrent,
    replaceAll
  };
})();

// Global convenience wrappers
window.toggleFindReplaceBar = (showReplace) => window.TeXPressFindReplace.toggle(showReplace);
window.onFindInput = (q) => window.TeXPressFindReplace.onInput(q);
window.findNextMatch = () => window.TeXPressFindReplace.next();
window.findPrevMatch = () => window.TeXPressFindReplace.prev();
window.replaceCurrentMatch = () => window.TeXPressFindReplace.replaceCurrent();
window.replaceAllMatches = () => window.TeXPressFindReplace.replaceAll();
