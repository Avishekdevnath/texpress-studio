import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import * as ResEdit from 'resedit';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const exePath = path.resolve(__dirname, '..', 'dist', 'TeXPress-win32-x64', 'TeXPress.exe');
const iconPath = path.resolve(__dirname, '..', 'assets', 'icon.ico');

console.log('Injecting icon into:', exePath);
console.log('Using icon from:', iconPath);

if (!fs.existsSync(exePath)) {
  console.error('Exe not found:', exePath);
  process.exit(1);
}
if (!fs.existsSync(iconPath)) {
  console.error('Icon not found:', iconPath);
  process.exit(1);
}

async function run() {
  try {
    const exeBuffer = fs.readFileSync(exePath);
    const exe = ResEdit.NtExecutable.from(exeBuffer);
    const res = ResEdit.NtExecutableResource.from(exe);

    const existingIconGroups = ResEdit.Resource.IconGroupEntry.fromEntries(res.entries);
    console.log('Found existing icon groups:', existingIconGroups.length);

    if (existingIconGroups.length === 0) {
      console.error('No icon groups found in executable');
      process.exit(1);
    }

    const iconBuffer = fs.readFileSync(iconPath);
    const iconFile = ResEdit.Data.IconFile.from(iconBuffer);
    console.log('Loaded icon file containing layers:', iconFile.icons.length);

    ResEdit.Resource.IconGroupEntry.replaceIconsForResource(
      res.entries,
      existingIconGroups[0].id,
      existingIconGroups[0].lang,
      iconFile.icons.map((item) => item.data)
    );

    // Update Version Info with official product branding
    const versionInfos = ResEdit.Resource.VersionInfo.fromEntries(res.entries);
    if (versionInfos.length > 0) {
      const vInfo = versionInfos[0];
      const langs = vInfo.getAllLanguagesForStringValues();
      if (langs.length > 0) {
        vInfo.setStringValues(langs[0], {
          FileDescription: 'TeXPress Studio - Academic Publishing Suite',
          ProductName: 'TeXPress Studio',
          CompanyName: 'TeXPress Team',
          LegalCopyright: '© 2026 TeXPress Team. All rights reserved.',
          InternalName: 'TeXPress'
        });
        vInfo.outputToResourceEntries(res.entries);
      }
    }

    res.outputResource(exe);
    const newExeBuffer = Buffer.from(exe.generate());

    fs.writeFileSync(exePath, newExeBuffer);
    console.log('SUCCESS! Icon and brand metadata successfully embedded into TeXPress.exe!');
    console.log('New executable size:', newExeBuffer.length, 'bytes');
  } catch (err) {
    console.error('Failed to inject icon:', err);
    process.exit(1);
  }
}

run();
