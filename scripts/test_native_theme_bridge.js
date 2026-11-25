const fs = require('fs');
const path = require('path');

console.log('=== TEST SUITE: Native Theme Synchronization Bridge ===\n');

let passed = 0;
let total = 0;

function assert(condition, desc) {
  total++;
  if (condition) {
    console.log(`[PASS] ${desc}`);
    passed++;
  } else {
    console.error(`[FAIL] ${desc}`);
  }
}

// 1. Check main.js
const mainJs = fs.readFileSync('s:/MSc DU/Research/Babu Sir/Final Research/texpress_studio/main.js', 'utf-8');
assert(mainJs.includes('nativeTheme') && mainJs.includes('require("electron")'), "main.js imports nativeTheme from electron");
assert(mainJs.includes('nativeTheme.themeSource = "dark"'), "main.js sets dark theme by default on window creation");
assert(mainJs.includes('ipcMain.handle("set-native-theme"'), "main.js registers 'set-native-theme' IPC handler");
assert(mainJs.includes('nativeTheme.themeSource = theme'), "main.js dynamically updates nativeTheme.themeSource");

// 2. Check preload.js
const preloadJs = fs.readFileSync('s:/MSc DU/Research/Babu Sir/Final Research/texpress_studio/preload.js', 'utf-8');
assert(preloadJs.includes('setNativeTheme: (theme) => ipcRenderer.invoke("set-native-theme", theme)'), "preload.js exposes setNativeTheme to renderer");

// 3. Check app.js
const appJs = fs.readFileSync('s:/MSc DU/Research/Babu Sir/Final Research/texpress_studio/ui/js/app.js', 'utf-8');
assert(appJs.includes('window.electronAPI.setNativeTheme(theme)'), "app.js calls setNativeTheme inside applyTheme");

// 4. Check dist synchronized files
const distMain = fs.readFileSync('s:/MSc DU/Research/Babu Sir/Final Research/texpress_studio/dist/TeXPress-win32-x64/resources/app/main.js', 'utf-8');
assert(distMain.includes('ipcMain.handle("set-native-theme"'), "dist/resources/app/main.js is properly synchronized");

console.log(`\nResults: ${passed}/${total} tests passed.`);
if (passed === total) {
  console.log('NATIVE THEME BRIDGE FULLY VERIFIED!');
} else {
  process.exit(1);
}
