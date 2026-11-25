/**
 * TeXPress Studio - In-Line Floating Hover Inspector Previews
 */

window.TeXPressHover = (function() {
  let hoverTimer = null;

  function init() {
    const paperSheet = document.getElementById("paperSheet");
    const card = document.getElementById("editorHoverCard");
    if (!paperSheet || !card) return;

    paperSheet.addEventListener("mousemove", (e) => {
      clearTimeout(hoverTimer);
      hoverTimer = setTimeout(() => {
        inspect(e);
      }, 350);
    });

    paperSheet.addEventListener("mouseleave", () => {
      clearTimeout(hoverTimer);
      card.style.display = "none";
    });
  }

  function inspect(e) {
    const card = document.getElementById("editorHoverCard");
    if (!card) return;

    const cm = window.TeXPressEditor ? window.TeXPressEditor.getCm() : null;
    let slice = "";
    let fullText = "";

    if (cm) {
      const pos = cm.coordsChar({ left: e.clientX, top: e.clientY });
      const line = cm.getLine(pos.line) || "";
      const ch = pos.ch;
      slice = line.substring(Math.max(0, ch - 50), Math.min(line.length, ch + 50));
      fullText = cm.getValue();
    } else {
      const textarea = document.getElementById("editorTextarea");
      if (!textarea) return;
      fullText = textarea.value;
      const pos = textarea.selectionStart;
      slice = fullText.substring(Math.max(0, pos - 80), Math.min(fullText.length, pos + 80));
    }

    // 1. Citation Hover
    const citeMatch = slice.match(/\\cite\{([^}]+)\}/);
    if (citeMatch && window.TeXPressCitations) {
      const key = citeMatch[1].trim();
      const citations = window.TeXPressCitations.getCitations();
      const found = citations.find(c => c.key === key);
      if (found) {
        document.getElementById("hoverCardTitle").textContent = found.title;
        document.getElementById("hoverCardAuthors").textContent = `${found.author} (${found.year})`;
        document.getElementById("hoverCardMeta").textContent = `${found.journal || found.type} • Key: ${found.key}`;
        document.getElementById("hoverCardImg").style.display = "none";

        card.style.left = `${Math.min(window.innerWidth - 360, e.clientX + 10)}px`;
        card.style.top = `${Math.min(window.innerHeight - 140, e.clientY + 15)}px`;
        card.style.display = "block";
        return;
      }
    }

    // 2. Figure Hover
    const figMatch = slice.match(/\\ref\{fig:([^}]+)\}/);
    if (figMatch) {
      const figLabel = "fig:" + figMatch[1].trim();
      const imgMatch = text.match(new RegExp(`\\\\includegraphics(?:\\[[^\\]]*\\])?\\{([^}]+)\\}[\\s\\S]*?\\\\label\\{${figLabel}\\}`, "i"));
      if (imgMatch) {
        const imgPath = imgMatch[1];
        document.getElementById("hoverCardTitle").textContent = `Figure: ${figLabel}`;
        document.getElementById("hoverCardAuthors").textContent = imgPath;
        document.getElementById("hoverCardMeta").textContent = "Project Graphics File";
        const imgElem = document.getElementById("hoverCardImg");
        imgElem.src = imgPath;
        imgElem.style.display = "block";

        card.style.left = `${Math.min(window.innerWidth - 360, e.clientX + 10)}px`;
        card.style.top = `${Math.min(window.innerHeight - 200, e.clientY + 15)}px`;
        card.style.display = "block";
        return;
      }
    }

    // 3. Equation Hover
    const eqMatch = slice.match(/\\eqref\{([^}]+)\}/);
    if (eqMatch) {
      const eqLabel = eqMatch[1].trim();
      document.getElementById("hoverCardTitle").textContent = `Equation: ${eqLabel}`;
      document.getElementById("hoverCardAuthors").textContent = "Referenced Math Block";
      document.getElementById("hoverCardMeta").textContent = "Click to jump to equation definition";
      document.getElementById("hoverCardImg").style.display = "none";

      card.style.left = `${Math.min(window.innerWidth - 360, e.clientX + 10)}px`;
      card.style.top = `${Math.min(window.innerHeight - 140, e.clientY + 15)}px`;
      card.style.display = "block";
      return;
    }

    card.style.display = "none";
  }

  return {
    init,
    inspect
  };
})();
