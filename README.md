# TeXPress Studio

**A fast, distraction-free LaTeX editor and academic publishing suite for Windows.**  
Write papers, theses, and books with live PDF preview, one-click Equation/Figure/Table wizards, BibTeX citation lookup, and instant `F5` compilation — no terminal required.

---

## Download & Install (Windows)

1. Go to the **[Releases Page](https://github.com/Avishekdevnath/texpress-studio/releases/latest)**.
2. Download **`TeXPress Studio-Setup-1.0.0.exe`**.
3. Double-click the installer and follow the setup steps (no Administrator password required).
4. Launch **TeXPress Studio** from your Desktop or Start Menu.

> **Prerequisite (LaTeX Compiler):** TeXPress Studio requires a LaTeX distribution such as **[MiKTeX](https://miktex.org/download)** or **[TeX Live](https://tug.org/texlive/)** installed on your PC to compile `.tex` files into PDFs.

---

## Quick Start (3 Steps)

1. **Open a Project:** Click **Open Existing Folder** (or **Open Sample Book** on the Welcome screen to try a full demo right away).
2. **Edit & Insert:** Single-click files in the left Explorer to preview them, or double-click to keep them open. Use the top toolbar to insert **Equations**, **Figures**, **Tables**, or **Citations**.
3. **Compile (`F5`):** Press **`F5`** (or click **Compile**) to build your PDF and view it side-by-side.

---

## Key Features

- **Smart Engine & Citation Detection:** Automatically picks `pdflatex`, `xelatex`, or `lualatex` based on your document and runs `bibtex` when needed.
- **Live PDF Preview & SyncTeX:** Smooth multi-page PDF viewer with selectable text, clickable table of contents/links, and **`Ctrl + Click`** on any PDF line to jump straight to that line in your code.
- **VS Code-Style Workspace:** Preview vs. pinned tabs, **`Ctrl + P`** quick file switcher, per-tab cursor memory, inline spellcheck with right-click spelling suggestions, and Windows Taskbar Recent Folders.
- **Academic Wizards:** Visual table builder (with Excel/CSV paste), figure wizard, BibTeX citation picker, Greek/Math symbols dock, and manuscript word-count breakdown.

---

## Useful Shortcuts

| Action | Shortcut |
|---|---|
| Compile Document | `F5` |
| Quick Open File | `Ctrl + P` |
| Open Project Folder | `Ctrl + O` |
| Save Active File | `Ctrl + S` |
| Close Active Tab | `Ctrl + W` |
| Toggle Comment | `Ctrl + /` |
| Jump PDF -> Code | `Ctrl + Click` (in PDF) |
| Jump Code -> PDF | `Ctrl + Alt + J` |

---

<details>
<summary><strong>For Developers (Build from Source)</strong></summary>

Requires [Node.js](https://nodejs.org/) (v18+):

```bash
git clone https://github.com/Avishekdevnath/texpress-studio.git
cd texpress-studio
npm install
npm start
```

</details>

## License

MIT — see [LICENSE](LICENSE).
