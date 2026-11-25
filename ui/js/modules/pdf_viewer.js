/**
 * TeXPress Studio - Mozilla PDF.js Canvas Document Viewer
 * High-DPI continuous multi-page vertical scroll and automatic Fit Width scaling.
 */

window.TeXPressPDF = (function() {
  let activePdfDoc = null;
  let currentPdfPageNum = 1;
  let currentPdfZoom = 1.0;
  let pdfZoomMode = "fit-width";
  let isRenderingPdf = false;
  let currentPdfRelPath = "main.pdf";

  let pdfStats = {
    totalWords: 0,
    totalChars: 0,
    numPages: 0,
    pdfFileName: "main.pdf",
    pages: []
  };

  function resetPdfStats() {
    pdfStats = {
      totalWords: 0,
      totalChars: 0,
      numPages: 0,
      pdfFileName: currentPdfRelPath,
      pages: []
    };
    updatePdfStatsUI();
  }

  async function computePdfStats() {
    if (!activePdfDoc) {
      resetPdfStats();
      return pdfStats;
    }

    let totalWords = 0;
    let totalChars = 0;
    const pages = [];

    for (let i = 1; i <= activePdfDoc.numPages; i++) {
      try {
        const page = await activePdfDoc.getPage(i);
        const textContent = await page.getTextContent();
        const pageText = (textContent && textContent.items)
          ? textContent.items.map(item => item.str).join(" ")
          : "";
        const wordsArr = pageText.trim().split(/\s+/).filter(w => w.length > 0 && /[a-zA-Z0-9]/.test(w));
        const words = wordsArr.length;
        const chars = pageText.length;
        totalWords += words;
        totalChars += chars;

        const preview = pageText.trim().replace(/\s+/g, " ").substring(0, 70);
        pages.push({ page: i, words, chars, preview });
      } catch (err) {
        pages.push({ page: i, words: 0, chars: 0, preview: "" });
      }
    }

    pdfStats = {
      totalWords,
      totalChars,
      numPages: activePdfDoc.numPages,
      pdfFileName: currentPdfRelPath,
      pages
    };

    updatePdfStatsUI();
    return pdfStats;
  }

  function updatePdfStatsUI() {
    const wordsFormatted = pdfStats.totalWords.toLocaleString();

    // 1. Live PDF Pane Toolbar Badge
    const badgeEl = document.getElementById("pdfWordsBadge");
    const numEl = document.getElementById("pdfTotalWords");
    if (numEl) numEl.textContent = wordsFormatted;
    if (badgeEl) {
      badgeEl.title = `Total: ${wordsFormatted} words across ${pdfStats.numPages} compiled pages in ${currentPdfRelPath} (Click for Full Manuscript Statistics)`;
    }

    // 2. Bottom Status Bar PDF Counter
    const statusPdfEl = document.getElementById("statusPdfWordCount");
    if (statusPdfEl) {
      statusPdfEl.textContent = `📄 PDF: ${wordsFormatted} words`;
      statusPdfEl.title = `Compiled Output (${currentPdfRelPath}): ${wordsFormatted} words across ${pdfStats.numPages} pages`;
    }

    // 3. Stats modal scope label
    const pdfNameEl = document.getElementById("statsScopePdfName");
    if (pdfNameEl) pdfNameEl.textContent = currentPdfRelPath;
  }

  async function loadPdf(targetRelPath) {
    if (targetRelPath) {
      currentPdfRelPath = targetRelPath.replace(/^[\\\/]+/, "");
    }
    const select = document.getElementById("pdfTargetSelect");
    if (select && select.value !== currentPdfRelPath) {
      // If the option exists, select it; otherwise add it dynamically
      let exists = false;
      for (let i = 0; i < select.options.length; i++) {
        if (select.options[i].value === currentPdfRelPath) {
          exists = true;
          break;
        }
      }
      if (!exists) {
        const opt = document.createElement("option");
        opt.value = currentPdfRelPath;
        opt.textContent = currentPdfRelPath;
        select.appendChild(opt);
      }
      select.value = currentPdfRelPath;
    }
    await reload();
  }

  async function reload() {
    const emptyState = document.getElementById("pdfEmptyState");
    const container = document.getElementById("pdfPagesContainer");
    const navCtrl = document.getElementById("pdfNavControls");
    const zoomCtrl = document.getElementById("pdfZoomControls");

    if (!window.currentProjectName) {
      if (emptyState) emptyState.style.display = "flex";
      if (container) container.style.display = "none";
      if (navCtrl) navCtrl.style.display = "none";
      if (zoomCtrl) zoomCtrl.style.display = "none";
      resetPdfStats();
      return;
    }

    try {
      // Memory cleanup: destroy prior PDF document to free WebAssembly & canvas streams
      if (activePdfDoc) {
        try {
          activePdfDoc.destroy();
        } catch (destroyErr) {
          console.warn("Failed to destroy prior PDF document:", destroyErr);
        }
        activePdfDoc = null;
      }

      let pdfBase64 = null;
      if (window.electronAPI && window.electronAPI.getPdfData) {
        const res = await window.electronAPI.getPdfData(currentPdfRelPath);
        if (typeof res === "string") {
          pdfBase64 = res.includes(",") ? res.split(",")[1] : res;
        } else if (res && res.data) {
          pdfBase64 = res.data.includes(",") ? res.data.split(",")[1] : res.data;
        }
      }

      if (!pdfBase64) {
        if (emptyState) emptyState.style.display = "flex";
        if (container) container.style.display = "none";
        if (navCtrl) navCtrl.style.display = "none";
        if (zoomCtrl) zoomCtrl.style.display = "none";
        resetPdfStats();
        return;
      }

      if (emptyState) emptyState.style.display = "none";
      if (container) container.style.display = "flex";
      if (navCtrl) navCtrl.style.display = "flex";
      if (zoomCtrl) zoomCtrl.style.display = "flex";

      const rawData = atob(pdfBase64);
      const uint8 = new Uint8Array(rawData.length);
      for (let i = 0; i < rawData.length; i++) {
        uint8[i] = rawData.charCodeAt(i);
      }

      const loadingTask = pdfjsLib.getDocument({ data: uint8 });
      activePdfDoc = await loadingTask.promise;

      const totalEl = document.getElementById("pdfTotalPages");
      if (totalEl) totalEl.textContent = activePdfDoc.numPages;

      // Extract true compiled PDF text & word count metrics
      await computePdfStats();

      await renderAllPages();
    } catch (e) {
      console.warn("Could not render PDF:", e);
    }
  }

  async function renderAllPages() {
    if (!activePdfDoc || isRenderingPdf) return;
    isRenderingPdf = true;

    const container = document.getElementById("pdfPagesContainer");
    const viewportEl = document.getElementById("pdfViewport");
    if (!container || !viewportEl) {
      isRenderingPdf = false;
      return;
    }

    container.innerHTML = "";

    const availableWidth = Math.max(viewportEl.clientWidth - 48, 300);
    const availableHeight = Math.max(viewportEl.clientHeight - 60, 400);

    const firstPage = await activePdfDoc.getPage(1);
    const unscaledViewport = firstPage.getViewport({ scale: 1.0 });

    let finalScale = 1.0;
    if (pdfZoomMode === "fit-width") {
      finalScale = availableWidth / unscaledViewport.width;
    } else if (pdfZoomMode === "fit-page") {
      const scaleW = availableWidth / unscaledViewport.width;
      const scaleH = availableHeight / unscaledViewport.height;
      finalScale = Math.min(scaleW, scaleH);
    } else {
      finalScale = currentPdfZoom;
    }
    currentPdfZoom = finalScale;

    const displayEl = document.getElementById("pdfZoomDisplay");
    if (displayEl) displayEl.textContent = `${Math.round(currentPdfZoom * 100)}%`;

    for (let num = 1; num <= activePdfDoc.numPages; num++) {
      await renderPage(num, container, finalScale);
    }

    isRenderingPdf = false;
    setupScrollTracking();
    updateActivePageOnScroll();
  }

  async function renderPage(num, container, scale) {
    const page = await activePdfDoc.getPage(num);
    const pixelRatio = window.devicePixelRatio || 1;
    const viewport = page.getViewport({ scale: scale });

    const card = document.createElement("div");
    card.className = "pdf-page-card";
    card.id = `pdfPageCard-${num}`;
    card.setAttribute("data-page-num", num);
    card.style.width = `${Math.floor(viewport.width)}px`;
    card.style.height = `${Math.floor(viewport.height)}px`;
    card.style.position = "relative";
    card.setAttribute("title", "Ctrl+Click or Double-Click to jump to LaTeX source (SyncTeX)");

    // 1. Bottom Canvas Layer
    const canvas = document.createElement("canvas");
    canvas.width = Math.floor(viewport.width * pixelRatio);
    canvas.height = Math.floor(viewport.height * pixelRatio);
    canvas.style.width = `${Math.floor(viewport.width)}px`;
    canvas.style.height = `${Math.floor(viewport.height)}px`;

    const ctx = canvas.getContext("2d");
    ctx.scale(pixelRatio, pixelRatio);
    card.appendChild(canvas);

    // 2. Selectable Text Layer (Text Selection & Copying)
    const textLayerDiv = document.createElement("div");
    textLayerDiv.className = "textLayer";
    textLayerDiv.style.width = `${Math.floor(viewport.width)}px`;
    textLayerDiv.style.height = `${Math.floor(viewport.height)}px`;
    card.appendChild(textLayerDiv);

    // 3. Interactive Hyperlink & Annotation Layer (Clickable TOC, Citations & URLs)
    const annotLayerDiv = document.createElement("div");
    annotLayerDiv.className = "annotationLayer";
    annotLayerDiv.style.width = `${Math.floor(viewport.width)}px`;
    annotLayerDiv.style.height = `${Math.floor(viewport.height)}px`;
    card.appendChild(annotLayerDiv);

    // 4. Page Number Indicator Pill
    const numBadge = document.createElement("div");
    numBadge.className = "pdf-page-number-pill";
    numBadge.textContent = `${num}`;
    card.appendChild(numBadge);

    container.appendChild(card);

    // SyncTeX Click Handlers (Ctrl+Click & Double Click)
    const onCardClick = async (e) => {
      if (e.ctrlKey || e.metaKey) {
        e.preventDefault();
        e.stopPropagation();
        await handleInverseSync(e, num, card, scale);
      }
    };

    const onCardDblClick = async (e) => {
      e.preventDefault();
      e.stopPropagation();
      await handleInverseSync(e, num, card, scale);
    };

    card.addEventListener("click", onCardClick);
    card.addEventListener("dblclick", onCardDblClick);

    // 1. Render Crisp High-DPI Canvas
    await page.render({
      canvasContext: ctx,
      viewport: viewport
    }).promise;

    // 2. Render Selectable Text Layer
    try {
      const textContent = await page.getTextContent();
      if (pdfjsLib && pdfjsLib.renderTextLayer) {
        await pdfjsLib.renderTextLayer({
          textContentSource: textContent,
          container: textLayerDiv,
          viewport: viewport
        }).promise;
      }
    } catch (textErr) {
      console.warn("Failed to render text layer for page", num, textErr);
    }

    // 3. Render Interactive Annotations (TOC Jumps, Cross-References & Citations)
    try {
      const annotations = await page.getAnnotations({ intent: "display" });
      renderAnnotations(annotations, annotLayerDiv, viewport);
    } catch (annotErr) {
      console.warn("Failed to render annotations for page", num, annotErr);
    }
  }

  /**
   * Render interactive hyperlinks, Table of Contents jumps, and citations
   * @param {Array} annotations - Annotations returned by page.getAnnotations()
   * @param {HTMLElement} layerDiv - .annotationLayer container
   * @param {Object} viewport - PDF.js page viewport
   */
  function renderAnnotations(annotations, layerDiv, viewport) {
    if (!annotations || annotations.length === 0) return;

    for (const annot of annotations) {
      if (annot.subtype !== "Link" || !annot.rect) continue;

      const normRect = pdfjsLib.Util.normalizeRect(viewport.convertToViewportRectangle(annot.rect));
      const left = Math.min(normRect[0], normRect[2]);
      const top = Math.min(normRect[1], normRect[3]);
      const width = Math.abs(normRect[2] - normRect[0]);
      const height = Math.abs(normRect[3] - normRect[1]);

      const linkEl = document.createElement("a");
      linkEl.className = "pdf-link-annotation";
      linkEl.style.left = `${left}px`;
      linkEl.style.top = `${top}px`;
      linkEl.style.width = `${width}px`;
      linkEl.style.height = `${height}px`;

      if (annot.url) {
        linkEl.href = annot.url;
        linkEl.title = `Open external URL: ${annot.url}`;
        linkEl.target = "_blank";
        linkEl.rel = "noopener noreferrer";
        linkEl.addEventListener("click", (e) => {
          if (e.ctrlKey || e.metaKey) return; // Allow SyncTeX on Ctrl+Click
          e.preventDefault();
          e.stopPropagation();
          if (window.electronAPI && window.electronAPI.openExternal) {
            window.electronAPI.openExternal(annot.url);
          } else {
            window.open(annot.url, "_blank");
          }
        });
      } else if (annot.dest) {
        const destTitle = typeof annot.dest === "string" ? annot.dest : "Target Section";
        linkEl.title = `Jump to ${destTitle}`;
        linkEl.addEventListener("click", async (e) => {
          if (e.ctrlKey || e.metaKey) return; // Allow SyncTeX on Ctrl+Click
          e.preventDefault();
          e.stopPropagation();
          await navigateToDest(annot.dest);
        });
      }

      layerDiv.appendChild(linkEl);
    }
  }

  /**
   * Resolves internal PDF destinations (named or explicit) and smoothly scrolls to target page & position
   * @param {string|Array} dest - Destination identifier or array
   */
  async function navigateToDest(dest) {
    if (!activePdfDoc || !dest) return;
    try {
      let explicitDest = dest;
      if (typeof dest === "string") {
        explicitDest = await activePdfDoc.getDestination(dest);
      }
      if (!explicitDest) return;

      let targetRef = explicitDest;
      if (Array.isArray(explicitDest) && explicitDest.length > 0) {
        targetRef = explicitDest[0];
      }

      let pageIndex = -1;
      if (typeof targetRef === "object" && targetRef !== null) {
        pageIndex = await activePdfDoc.getPageIndex(targetRef);
      } else if (typeof targetRef === "number") {
        pageIndex = targetRef;
      }

      if (pageIndex >= 0) {
        const pageNum = pageIndex + 1;
        let yOffset = 0;
        // If destination contains coordinate: [ ref, { name: 'XYZ' }, x, y, zoom ]
        if (Array.isArray(explicitDest) && explicitDest.length >= 4 && typeof explicitDest[3] === "number") {
          try {
            const targetPage = await activePdfDoc.getPage(pageNum);
            const vp = targetPage.getViewport({ scale: currentPdfZoom });
            const pt = vp.convertToViewportPoint(explicitDest[2] || 0, explicitDest[3]);
            if (pt && typeof pt[1] === "number") {
              yOffset = pt[1];
            }
          } catch (e) {
            // Fallback to top of page
          }
        }
        scrollToPage(pageNum, yOffset);
      }
    } catch (err) {
      console.warn("Failed to navigate to destination:", dest, err);
    }
  }

  async function handleInverseSync(e, pageNum, cardEl, scale) {
    if (!window.electronAPI || !window.electronAPI.synctexInverse) return;

    const rect = cardEl.getBoundingClientRect();
    const cssX = e.clientX - rect.left;
    const cssY = e.clientY - rect.top;

    // Convert CSS pixels on card to TeX points (72 DPI)
    const ptX = cssX / scale;
    const ptY = cssY / scale;

    try {
      const res = await window.electronAPI.synctexInverse({
        page: pageNum,
        x: ptX,
        y: ptY,
        pdfFile: currentPdfRelPath
      });

      if (res && res.success && res.file && res.line) {
        if (typeof window.jumpToSourceLine === "function") {
          await window.jumpToSourceLine(res.file, res.line, res.column);
        }
      }
    } catch (err) {
      console.warn("Inverse SyncTeX error:", err);
    }
  }

  async function showPdfSyncMarker(pageNum, x, y, width, height) {
    const card = document.getElementById(`pdfPageCard-${pageNum}`);
    if (!card) return;

    card.scrollIntoView({ behavior: "smooth", block: "center" });

    const curEl = document.getElementById("pdfCurrentPage");
    if (curEl) curEl.textContent = pageNum;

    const oldMarker = document.getElementById("synctexPdfMarker");
    if (oldMarker) oldMarker.remove();

    const scale = currentPdfZoom;
    const cssX = Math.max(0, x * scale);
    const cssY = Math.max(0, y * scale);
    const cssW = Math.max(40, (width || 200) * scale);
    const cssH = Math.max(16, (height || 22) * scale);

    const marker = document.createElement("div");
    marker.id = "synctexPdfMarker";
    marker.className = "synctex-pdf-marker";
    marker.style.left = `${cssX}px`;
    marker.style.top = `${cssY}px`;
    marker.style.width = `${cssW}px`;
    marker.style.height = `${cssH}px`;

    card.appendChild(marker);

    setTimeout(() => {
      if (marker && marker.parentNode) marker.remove();
    }, 2200);
  }

  function changeZoom(delta) {
    pdfZoomMode = "custom";
    currentPdfZoom = Math.max(0.3, Math.min(3.0, currentPdfZoom + delta));
    updateZoomButtons();
    renderAllPages();
  }

  function setZoomMode(mode) {
    pdfZoomMode = mode;
    updateZoomButtons();
    renderAllPages();
  }

  function updateZoomButtons() {
    const btnW = document.getElementById("btnFitWidth");
    const btnP = document.getElementById("btnFitPage");
    if (btnW) btnW.classList.toggle("active", pdfZoomMode === "fit-width");
    if (btnP) btnP.classList.toggle("active", pdfZoomMode === "fit-page");
  }

  // ========================================================================
  // Real-Time Scroll Page Tracking & Navigation
  // ========================================================================
  let scrollTicking = false;
  let pageObserver = null;

  function setupScrollTracking() {
    const viewportEl = document.getElementById("pdfViewport");
    if (!viewportEl) return;

    if (!viewportEl._hasScrollListener) {
      viewportEl._hasScrollListener = true;
      viewportEl.addEventListener("scroll", () => {
        if (!scrollTicking) {
          requestAnimationFrame(() => {
            updateActivePageOnScroll();
            scrollTicking = false;
          });
          scrollTicking = true;
        }
      }, { passive: true });
    }

    // Connect IntersectionObserver on all rendered page cards for sub-pixel precision
    if (pageObserver) {
      pageObserver.disconnect();
    }

    const cards = viewportEl.querySelectorAll(".pdf-page-card");
    if (cards.length > 0 && typeof IntersectionObserver !== "undefined") {
      const pageRatios = new Map();
      pageObserver = new IntersectionObserver((entries) => {
        for (const entry of entries) {
          const pageNum = parseInt(entry.target.getAttribute("data-page-num") || "1", 10);
          pageRatios.set(pageNum, entry.intersectionRatio);
        }

        let maxRatio = 0.15;
        let bestPage = currentPdfPageNum;
        for (const [pageNum, ratio] of pageRatios.entries()) {
          if (ratio > maxRatio) {
            maxRatio = ratio;
            bestPage = pageNum;
          }
        }

        if (bestPage !== currentPdfPageNum) {
          currentPdfPageNum = bestPage;
          const curEl = document.getElementById("pdfCurrentPage");
          if (curEl) curEl.textContent = bestPage;
        }
      }, {
        root: viewportEl,
        threshold: [0, 0.15, 0.3, 0.5, 0.7, 0.9, 1.0]
      });

      cards.forEach(c => pageObserver.observe(c));
    }
  }

  function updateActivePageOnScroll() {
    const viewportEl = document.getElementById("pdfViewport");
    if (!viewportEl || !activePdfDoc || activePdfDoc.numPages <= 0) return;

    const cards = viewportEl.querySelectorAll(".pdf-page-card");
    if (cards.length === 0) return;

    const vpRect = viewportEl.getBoundingClientRect();
    const vpHeight = vpRect.height;
    if (vpHeight <= 0) return;

    let bestPage = currentPdfPageNum;
    let maxVisibleHeight = -1;

    for (let i = 0; i < cards.length; i++) {
      const card = cards[i];
      const pageNum = i + 1;
      const rect = card.getBoundingClientRect();

      // Compute visible vertical span of this page inside viewport
      const visibleTop = Math.max(rect.top, vpRect.top);
      const visibleBottom = Math.min(rect.bottom, vpRect.bottom);
      const visibleHeight = Math.max(0, visibleBottom - visibleTop);

      if (visibleHeight > maxVisibleHeight) {
        maxVisibleHeight = visibleHeight;
        bestPage = pageNum;
      }
    }

    if (bestPage !== currentPdfPageNum) {
      currentPdfPageNum = bestPage;
      const curEl = document.getElementById("pdfCurrentPage");
      if (curEl) curEl.textContent = bestPage;
    }
  }

  function nextPage() {
    if (!activePdfDoc) return;
    if (currentPdfPageNum < activePdfDoc.numPages) {
      currentPdfPageNum++;
      scrollToPage(currentPdfPageNum);
    }
  }

  function prevPage() {
    if (!activePdfDoc) return;
    if (currentPdfPageNum > 1) {
      currentPdfPageNum--;
      scrollToPage(currentPdfPageNum);
    }
  }

  function scrollToPage(num, yOffset = 0) {
    const card = document.getElementById(`pdfPageCard-${num}`);
    const viewportEl = document.getElementById("pdfViewport");
    if (card && viewportEl) {
      if (yOffset && yOffset > 0) {
        const targetScroll = card.offsetTop + yOffset - 24;
        viewportEl.scrollTo({ top: Math.max(0, targetScroll), behavior: "smooth" });
      } else {
        card.scrollIntoView({ behavior: "smooth", block: "start" });
      }
      currentPdfPageNum = num;
      const curEl = document.getElementById("pdfCurrentPage");
      if (curEl) curEl.textContent = num;
    }
  }

  async function promptJumpToPage() {
    if (!activePdfDoc) return;
    const total = activePdfDoc.numPages;
    let target;
    if (typeof window.showQuickInput === "function") {
      target = await window.showQuickInput({
        title: "<span>📑 Jump to PDF Page</span>",
        label: `Enter target page number (1 - ${total}):`,
        placeholder: `Current page: ${currentPdfPageNum}`,
        defaultValue: String(currentPdfPageNum),
        confirmText: "Go to Page"
      });
    } else {
      target = prompt(`Jump to page (1 - ${total}):`, currentPdfPageNum);
    }
    if (target) {
      const num = parseInt(String(target).trim(), 10);
      if (!isNaN(num) && num >= 1 && num <= total) {
        scrollToPage(num);
      }
    }
  }

  function popout() {
    if (window.electronAPI && window.electronAPI.exportPdf) {
      window.electronAPI.exportPdf(currentPdfRelPath);
    }
  }

  return {
    reload,
    loadPdf,
    getCurrentPdf: () => currentPdfRelPath,
    getPdfStats: () => pdfStats,
    computePdfStats,
    showPdfSyncMarker,
    renderAllPages,
    changeZoom,
    setZoomMode,
    nextPage,
    prevPage,
    scrollToPage,
    promptJumpToPage,
    popout
  };
})();

// Visual selection feedback when holding Ctrl over PDF
window.addEventListener("keydown", (e) => {
  if (e.key === "Control" || e.key === "Meta") {
    document.body.classList.add("ctrl-down");
  }
});
window.addEventListener("keyup", (e) => {
  if (e.key === "Control" || e.key === "Meta") {
    document.body.classList.remove("ctrl-down");
  }
});
window.addEventListener("blur", () => {
  document.body.classList.remove("ctrl-down");
});
window.addEventListener("focus", () => {
  document.body.classList.remove("ctrl-down");
});
document.addEventListener("visibilitychange", () => {
  if (document.hidden) {
    document.body.classList.remove("ctrl-down");
  }
});

// Global convenience wrappers
window.reloadPdf = () => window.TeXPressPDF.reload();
window.loadPdf = (p) => window.TeXPressPDF.loadPdf(p);
window.showPdfSyncMarker = (pg, x, y, w, h) => window.TeXPressPDF.showPdfSyncMarker(pg, x, y, w, h);
window.renderAllPdfPages = () => window.TeXPressPDF.renderAllPages();
window.changePdfZoom = (d) => window.TeXPressPDF.changeZoom(d);
window.setPdfZoomMode = (m) => window.TeXPressPDF.setZoomMode(m);
window.nextPdfPage = () => window.TeXPressPDF.nextPage();
window.prevPdfPage = () => window.TeXPressPDF.prevPage();
window.promptJumpToPage = () => window.TeXPressPDF.promptJumpToPage();
window.popoutPdf = () => window.TeXPressPDF.popout();
