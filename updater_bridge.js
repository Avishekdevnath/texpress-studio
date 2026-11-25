/**
 * TeXPress Studio — Auto-Updater Bridge (electron-updater)
 * Runs silent background checks on startup AND manual checks via Help -> Check for Updates...
 */

let autoUpdaterInstance = null;
let listenersAttached = false;

function getAutoUpdater() {
  if (autoUpdaterInstance) return autoUpdaterInstance;
  try {
    ({ autoUpdater: autoUpdaterInstance } = require("electron-updater"));
    return autoUpdaterInstance;
  } catch (err) {
    return null;
  }
}

function attachUpdaterListeners(mainWindow, dialog, autoUpdater) {
  if (listenersAttached || !autoUpdater) return;
  listenersAttached = true;

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
    // Fail silently on background checks in offline/firewall environments
  });
}

function initAutoUpdater(app, mainWindow, dialog) {
  if (!app || !app.isPackaged) return;
  const autoUpdater = getAutoUpdater();
  if (!autoUpdater) return;
  attachUpdaterListeners(mainWindow, dialog, autoUpdater);

  setTimeout(() => {
    autoUpdater.checkForUpdatesAndNotify().catch(() => {});
  }, 5000);
}

async function checkForUpdatesManual(app, mainWindow, dialog) {
  const currentVer = app ? app.getVersion() : "1.0.0";
  if (!app || !app.isPackaged) {
    await dialog.showMessageBox(mainWindow, {
      type: "info",
      title: "Check for Updates — TeXPress Studio",
      message: `You are running TeXPress Studio v${currentVer} (Development Mode).`,
      detail: "Automatic GitHub Release updates run in the installed Windows release."
    });
    return;
  }

  const autoUpdater = getAutoUpdater();
  if (!autoUpdater) {
    await dialog.showMessageBox(mainWindow, {
      type: "warning",
      title: "Check for Updates — TeXPress Studio",
      message: `Current Version: v${currentVer}`,
      detail: "Updater module is not available in this build."
    });
    return;
  }

  attachUpdaterListeners(mainWindow, dialog, autoUpdater);

  try {
    const result = await autoUpdater.checkForUpdates();
    const latestVer = result && result.updateInfo && result.updateInfo.version;
    if (latestVer && latestVer !== currentVer) {
      await dialog.showMessageBox(mainWindow, {
        type: "info",
        title: "Update Available — TeXPress Studio",
        message: `TeXPress Studio v${latestVer} is available (current: v${currentVer}).`,
        detail: "The update is downloading in the background. You will be prompted to restart once it finishes."
      });
    } else {
      await dialog.showMessageBox(mainWindow, {
        type: "info",
        title: "Up to Date — TeXPress Studio",
        message: `You are on the latest version (v${currentVer}).`
      });
    }
  } catch (err) {
    await dialog.showMessageBox(mainWindow, {
      type: "warning",
      title: "Update Check Failed",
      message: `Current Version: v${currentVer}`,
      detail: "Could not reach GitHub Releases. Please check your internet connection or verify that a release is published."
    });
  }
}

module.exports = { initAutoUpdater, checkForUpdatesManual };
