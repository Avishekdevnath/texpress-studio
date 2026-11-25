/**
 * TeXPress Studio — Isolated Auto-Updater Bridge (electron-updater)
 * Safely checks for updates only when running as an installed/packaged app.
 */

function initAutoUpdater(app, mainWindow, dialog) {
  if (!app || !app.isPackaged) {
    return;
  }

  let autoUpdater;
  try {
    ({ autoUpdater } = require("electron-updater"));
  } catch (err) {
    return;
  }

  autoUpdater.autoDownload = true;
  autoUpdater.autoInstallOnAppQuit = true;

  autoUpdater.on("update-available", (info) => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send("updater-status", {
        state: "downloading",
        version: info && info.version
      });
    }
  });

  autoUpdater.on("update-downloaded", async (info) => {
    if (!mainWindow || mainWindow.isDestroyed()) return;
    const res = await dialog.showMessageBox(mainWindow, {
      type: "info",
      buttons: ["Restart & Update", "Later"],
      defaultId: 0,
      cancelId: 1,
      title: "Update Ready — TeXPress Studio",
      message: `TeXPress Studio ${info && info.version ? "v" + info.version : ""} has been downloaded.`,
      detail: "Restart now to install the update, or it will install automatically when you quit."
    });
    if (res.response === 0) {
      autoUpdater.quitAndInstall();
    }
  });

  autoUpdater.on("error", () => {
    // Fail silently on offline/firewall environments
  });

  setTimeout(() => {
    autoUpdater.checkForUpdatesAndNotify().catch(() => {});
  }, 5000);
}

module.exports = { initAutoUpdater };
