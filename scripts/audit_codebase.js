/**
 * TeXPress Studio - Deep Codebase Integrity & Reputation Risk Auditor
 */

const fs = require("fs");
const path = require("path");

const STUDIO_DIR = path.join(__dirname, "..");
const UI_DIR = path.join(STUDIO_DIR, "ui");
const HTML_FILE = path.join(UI_DIR, "index.html");

const html = fs.readFileSync(HTML_FILE, "utf-8");

// 1. Check getElementById references
const jsFiles = [
  path.join(UI_DIR, "js", "app.js")
];
const modDir = path.join(UI_DIR, "js", "modules");
for (const f of fs.readdirSync(modDir)) {
  if (f.endsWith(".js")) {
    jsFiles.push(path.join(modDir, f));
  }
}

console.log("=== 1. Checking DOM Element ID References ===");
const missingIds = [];
for (const file of jsFiles) {
  const code = fs.readFileSync(file, "utf-8");
  const regex = /getElementById\((?:'([^']+)'|"([^"]+)")\)/g;
  let match;
  while ((match = regex.exec(code)) !== null) {
    const id = match[1] || match[2];
    const exists = html.includes(`id="${id}"`) || html.includes(`id='${id}'`);
    if (!exists) {
      missingIds.push({ id, file: path.basename(file) });
    }
  }
}
if (missingIds.length === 0) {
  console.log("✓ All getElementById references exist in index.html!");
} else {
  console.log("✗ Missing Element IDs found:");
  missingIds.forEach(m => console.log(`   - ID "${m.id}" referenced in ${m.file} but NOT in index.html`));
}

// 2. Check native menu events declared in main.js vs preload.js vs app.js
console.log("\n=== 2. Checking Native Electron Menu IPC Event Parity ===");
const mainCode = fs.readFileSync(path.join(STUDIO_DIR, "main.js"), "utf-8");
const preloadCode = fs.readFileSync(path.join(STUDIO_DIR, "preload.js"), "utf-8");
const appCode = fs.readFileSync(path.join(UI_DIR, "js", "app.js"), "utf-8");

const menuEventsInMain = new Set();
const mainMatches = mainCode.matchAll(/mainWindow\.webContents\.send\(['"]([^'"]+)['"]/g);
for (const m of mainMatches) {
  menuEventsInMain.add(m[1]);
}

const menuEventsInPreload = new Set();
const preloadMatches = preloadCode.matchAll(/ipcRenderer\.on\(['"]([^'"]+)['"]/g);
for (const m of preloadMatches) {
  menuEventsInPreload.add(m[1]);
}

console.log("Events sent by main.js menu:", Array.from(menuEventsInMain));
console.log("\nChecking if preload.js exposes each menu event:");
for (const ev of menuEventsInMain) {
  if (!menuEventsInPreload.has(ev)) {
    console.log(`   ✗ Menu event "${ev}" sent from main.js is NOT exposed in preload.js!`);
  } else {
    console.log(`   ✓ "${ev}" exposed in preload.js`);
  }
}

console.log("\nChecking if app.js actually binds to listeners exposed in preload.js:");
const preloadMethodMatches = preloadCode.matchAll(/(\w+):\s*\(callback\)\s*=>\s*ipcRenderer\.on/g);
for (const pm of preloadMethodMatches) {
  const method = pm[1];
  if (!appCode.includes(`window.electronAPI.${method}`)) {
    console.log(`   ✗ Preload listener "electronAPI.${method}" is NEVER LISTENED TO in app.js!`);
  } else {
    console.log(`   ✓ "electronAPI.${method}" is handled in app.js`);
  }
}

// 3. Scan for disruptive modal alerts / prompts
console.log("\n=== 3. Scanning for Disruptive window.alert / prompt calls ===");
for (const file of jsFiles) {
  const code = fs.readFileSync(file, "utf-8");
  const lines = code.split("\n");
  lines.forEach((line, i) => {
    if (/\balert\(|\bprompt\(/.test(line) && !line.includes("alert-danger") && !line.includes("alert-box")) {
      console.log(`   ⚠️ Line ${i + 1} in ${path.basename(file)}: ${line.trim()}`);
    }
  });
}
