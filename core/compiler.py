"""
TeXPress Studio - Core Compiler Engine
Orchestrates background builds, sandboxes auxiliary files into .build/,
and interfaces with local or portable LaTeX engines (pdflatex, xelatex, latexmk).
"""

import os
import shutil
import subprocess
import sys
from pathlib import Path

class LatexCompiler:
    def __init__(self, project_dir=None, portable_dir=None):
        self.project_dir = Path(project_dir).resolve() if project_dir else Path.cwd().resolve()
        self.portable_dir = Path(portable_dir).resolve() if portable_dir else Path(__file__).resolve().parent.parent / "portable"
        self.build_dir = self.project_dir / ".build"
        self.build_dir.mkdir(exist_ok=True)

        self.engines = self._locate_engines()

    def _locate_engines(self):
        """Locates available LaTeX compilation binaries (Portable first, then System PATH)."""
        candidates = {}
        bins = ["latexmk", "xelatex", "pdflatex", "bibtex", "biber"]

        # 1. Check portable directory
        portable_bin = self.portable_dir / "miktex" / "bin" / "x64"
        if portable_bin.exists():
            for b in bins:
                exe = portable_bin / f"{b}.exe"
                if exe.exists():
                    candidates[b] = str(exe)

        # 2. Check system PATH fallback
        for b in bins:
            if b not in candidates:
                found = shutil.which(b)
                if found:
                    candidates[b] = found

        return candidates

    def compile(self, root_file="main.tex", engine="xelatex"):
        """
        Executes sandboxed compilation.
        All auxiliary files (.aux, .log, .toc, .out) are redirected to .build/.
        The resulting .pdf is copied to the project directory or output/ folder.
        """
        root_path = self.project_dir / root_file
        if not root_path.exists():
            return {
                "success": False,
                "error": f"Root file not found: {root_file}",
                "log": ""
            }

        # Check compiler availability
        executable = self.engines.get(engine) or self.engines.get("pdflatex")
        if not executable:
            return {
                "success": False,
                "error": "No LaTeX engine found. Please ensure MiKTeX or TeX Live is installed.",
                "log": ""
            }

        # Command arguments: redirect output directory to .build
        # -synctex=1 enables bidirectional jump between source & PDF
        # -interaction=nonstopmode prevents hanging on terminal prompts
        # -file-line-error outputs standard file:line:error messages
        cmd = [
            executable,
            "-synctex=1",
            "-interaction=nonstopmode",
            "-file-line-error",
            f"-output-directory={str(self.build_dir)}",
            root_path.name
        ]

        try:
            process = subprocess.run(
                cmd,
                cwd=str(self.project_dir),
                stdout=subprocess.PIPE,
                stderr=subprocess.STDOUT,
                text=True,
                encoding="utf-8",
                errors="replace",
                timeout=45
            )

            raw_log = process.stdout
            base_name = Path(root_file).stem
            built_pdf = self.build_dir / f"{base_name}.pdf"

            if built_pdf.exists():
                # Copy output PDF to project directory so it's easily accessible
                dest_pdf = self.project_dir / f"{base_name}.pdf"
                shutil.copy2(built_pdf, dest_pdf)

                return {
                    "success": True,
                    "pdf_path": str(dest_pdf),
                    "log": raw_log,
                    "returncode": process.returncode
                }
            else:
                return {
                    "success": False,
                    "error": "PDF file was not generated.",
                    "log": raw_log,
                    "returncode": process.returncode
                }

        except subprocess.TimeoutExpired:
            return {
                "success": False,
                "error": "Compilation timed out (took longer than 45 seconds). Possible infinite macro loop.",
                "log": ""
            }
        except Exception as e:
            return {
                "success": False,
                "error": str(e),
                "log": ""
            }
