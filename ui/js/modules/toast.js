/**
 * TeXPress Studio - Professional Non-Blocking Toast Notification System
 * Replaces disruptive browser alerts with modern, non-blocking UI notifications.
 */

(function() {
  /**
   * Displays an elegant, non-blocking toast message.
   * @param {string} message - Content to display to the user.
   * @param {"info" | "success" | "warning" | "error"} [type="info"] - Visual category.
   * @param {number} [duration=3200] - Duration in milliseconds before auto-dismissal.
   */
  function showToast(message, type = "info", duration = 3200) {
    if (!message) return;

    let container = document.getElementById("texpressToastContainer");
    if (!container) {
      container = document.createElement("div");
      container.id = "texpressToastContainer";
      container.className = "texpress-toast-container";
      document.body.appendChild(container);
    }

    const toast = document.createElement("div");
    toast.className = `texpress-toast texpress-toast-${type}`;

    let icon = "ℹ️";
    if (type === "success") icon = "✓";
    else if (type === "warning") icon = "⚠️";
    else if (type === "error") icon = "✕";

    toast.innerHTML = `
      <span class="texpress-toast-icon">${icon}</span>
      <span class="texpress-toast-msg">${escapeHtml(message)}</span>
      <button class="texpress-toast-close" onclick="this.parentElement.remove()">✕</button>
    `;

    container.appendChild(toast);

    // Slide in
    setTimeout(() => {
      toast.classList.add("visible");
    }, 10);

    // Auto dismiss
    const dismissTimer = setTimeout(() => {
      dismissToast(toast);
    }, duration);

    toast.addEventListener("mouseenter", () => clearTimeout(dismissTimer));
    toast.addEventListener("mouseleave", () => {
      setTimeout(() => dismissToast(toast), 1200);
    });
  }

  function dismissToast(toast) {
    if (!toast || !toast.parentNode) return;
    toast.classList.remove("visible");
    toast.classList.add("dismissing");
    setTimeout(() => {
      if (toast.parentNode) toast.parentNode.removeChild(toast);
    }, 240);
  }

  function escapeHtml(str) {
    return String(str || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  // ========================================================================
  // Tab Close Confirmation Modal Resolver
  // ========================================================================
  let tabCloseResolver = null;

  /**
   * Prompts user when attempting to close an unsaved tab.
   * @param {string} fileName - Name of the dirty file.
   * @returns {Promise<"save" | "dontsave" | "cancel">}
   */
  function showTabClosePrompt(fileName) {
    return new Promise((resolve) => {
      tabCloseResolver = resolve;
      const modal = document.getElementById("tabCloseModal");
      const text = document.getElementById("tabClosePromptText");
      if (text) {
        text.textContent = `Do you want to save the changes you made to "${fileName}" before closing?`;
      }
      if (modal) {
        modal.style.display = "flex";
      } else {
        // Fallback to confirm dialog if modal is unavailable
        const ok = confirm(`Do you want to save changes to "${fileName}"?`);
        resolve(ok ? "save" : "dontsave");
      }
    });
  }

  function resolveTabClosePrompt(choice) {
    const modal = document.getElementById("tabCloseModal");
    if (modal) modal.style.display = "none";
    if (typeof tabCloseResolver === "function") {
      const fn = tabCloseResolver;
      tabCloseResolver = null;
      fn(choice);
    }
  }

  function cancelTabClosePrompt() {
    resolveTabClosePrompt("cancel");
  }

  // ========================================================================
  // Delete Item Confirmation Modal Resolver (VS Code Parity)
  // ========================================================================
  let deleteResolver = null;

  /**
   * Prompts user with VS Code style dialog when deleting a file or folder.
   * @param {string} itemName - Name of file or folder being deleted.
   * @param {string} relPath - Relative path.
   * @param {boolean} isPermanent - Whether Shift+Delete was pressed.
   * @returns {Promise<boolean>} Resolves true if confirmed, false if cancelled.
   */
  function showDeletePrompt(itemName, relPath, isPermanent = false) {
    return new Promise((resolve) => {
      deleteResolver = resolve;
      const modal = document.getElementById("deleteConfirmModal");
      const titleEl = document.getElementById("deleteModalTitle");
      const msgEl = document.getElementById("deletePromptMessage");
      const pathEl = document.getElementById("deletePromptPath");
      const confirmBtn = document.getElementById("deleteConfirmBtn");

      if (titleEl) {
        titleEl.textContent = isPermanent ? "🗑️ Permanently Delete Item?" : "🗑️ Delete Item?";
      }
      if (msgEl) {
        msgEl.textContent = isPermanent
          ? `Are you sure you want to permanently delete "${itemName}" and all of its contents? This action cannot be undone.`
          : `Are you sure you want to delete "${itemName}"?`;
      }
      if (pathEl) {
        pathEl.textContent = relPath || itemName;
      }
      if (confirmBtn) {
        confirmBtn.textContent = isPermanent ? "Permanently Delete" : "Delete";
      }

      if (modal) {
        modal.style.display = "flex";
        setTimeout(() => {
          if (confirmBtn) confirmBtn.focus();
        }, 30);
      } else {
        const ok = confirm(isPermanent
          ? `Are you sure you want to permanently delete '${itemName}'?\nPath: ${relPath}\nThis action cannot be undone.`
          : `Are you sure you want to delete '${itemName}'?\nPath: ${relPath}`);
        resolve(ok);
      }
    });
  }

  function resolveDeletePrompt(confirmed) {
    const modal = document.getElementById("deleteConfirmModal");
    if (modal) modal.style.display = "none";
    if (typeof deleteResolver === "function") {
      const fn = deleteResolver;
      deleteResolver = null;
      fn(!!confirmed);
    }
  }

  // Handle Enter / Escape inside modals
  window.addEventListener("keydown", (e) => {
    const delModal = document.getElementById("deleteConfirmModal");
    if (delModal && delModal.style.display === "flex") {
      if (e.key === "Escape") {
        e.preventDefault();
        e.stopPropagation();
        resolveDeletePrompt(false);
      } else if (e.key === "Enter") {
        e.preventDefault();
        e.stopPropagation();
        resolveDeletePrompt(true);
      }
    }
  }, true);

  // Export globals
  window.showToast = showToast;
  window.showTabClosePrompt = showTabClosePrompt;
  window.resolveTabClosePrompt = resolveTabClosePrompt;
  window.cancelTabClosePrompt = cancelTabClosePrompt;
  window.showDeletePrompt = showDeletePrompt;
  window.resolveDeletePrompt = resolveDeletePrompt;

  // Intercept any legacy alert() calls and route to non-blocking toast
  window.alert = function(msg) {
    showToast(String(msg), "info", 3500);
  };
})();
