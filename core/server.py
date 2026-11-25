"""
TeXPress Studio - Local Application Server & API Bridge
Connects the responsive web/desktop UI directly to the local compiler engine.
"""

import json
import mimetypes
import os
import subprocess
import sys
import threading
import time
import webbrowser
from http.server import HTTPServer, SimpleHTTPRequestHandler
from pathlib import Path
from urllib.parse import urlparse, parse_qs

# Import sibling modules
sys.path.insert(0, str(Path(__file__).resolve().parent))
from compiler import LatexCompiler
from error_parser import ErrorTranslator

BASE_DIR = Path(__file__).resolve().parent.parent
UI_DIR = BASE_DIR / "ui"
DEFAULT_PROJECT_DIR = BASE_DIR / "templates" / "book_springer"

class TeXPressHandler(SimpleHTTPRequestHandler):
    compiler = LatexCompiler(project_dir=DEFAULT_PROJECT_DIR)

    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=str(UI_DIR), **kwargs)

    def do_GET(self):
        parsed = urlparse(self.path)
        params = parse_qs(parsed.query)

        if parsed.path == "/api/project":
            self.handle_get_project()
        elif parsed.path == "/api/file":
            self.handle_get_file(params.get("path", ["main.tex"])[0])
        elif parsed.path == "/api/pdf":
            self.handle_serve_pdf()
        elif parsed.path == "/api/status":
            self.send_json_response({
                "status": "ready",
                "app": "TeXPress Studio",
                "project": self.compiler.project_dir.name,
                "engines": self.compiler.engines
            })
        else:
            # Serve static files from UI directory
            super().do_GET()

    def do_POST(self):
        parsed = urlparse(self.path)
        content_length = int(self.headers.get("Content-Length", 0))
        body = self.rfile.read(content_length).decode("utf-8") if content_length > 0 else "{}"

        try:
            data = json.loads(body)
        except Exception:
            data = {}

        if parsed.path == "/api/compile":
            self.handle_compile(data)
        elif parsed.path == "/api/save":
            self.handle_save(data)
        else:
            self.send_error(404, "Unknown API Endpoint")

    def handle_get_project(self):
        """Lists files in the active project directory."""
        files = []
        pdir = self.compiler.project_dir
        for root, dirs, fnames in os.walk(pdir):
            if ".build" in root:
                continue
            for f in fnames:
                if f.endswith((".tex", ".bib", ".sty", ".cls", ".png", ".jpg", ".pdf")):
                    rel_path = os.path.relpath(os.path.join(root, f), pdir).replace("\\", "/")
                    files.append({
                        "name": f,
                        "path": rel_path,
                        "is_root": (f == "main.tex")
                    })

        self.send_json_response({
            "project_name": pdir.name,
            "root_file": "main.tex",
            "files": sorted(files, key=lambda x: (not x["is_root"], x["path"]))
        })

    def handle_get_file(self, rel_path):
        """Reads and returns the content of a project file."""
        target = self.compiler.project_dir / rel_path
        if not target.exists() or not target.is_file():
            self.send_json_response({"success": False, "error": f"File not found: {rel_path}"})
            return

        try:
            with open(target, "r", encoding="utf-8", errors="replace") as f:
                content = f.read()
            self.send_json_response({
                "success": True,
                "path": rel_path,
                "content": content
            })
        except Exception as e:
            self.send_json_response({"success": False, "error": str(e)})

    def handle_serve_pdf(self):
        """Serves the compiled PDF directly to the preview pane."""
        pdf_path = self.compiler.project_dir / "main.pdf"
        if not pdf_path.exists():
            pdf_path = self.compiler.build_dir / "main.pdf"

        if pdf_path.exists():
            self.send_response(200)
            self.send_header("Content-Type", "application/pdf")
            self.send_header("Content-Length", str(pdf_path.stat().st_size))
            self.send_header("Cache-Control", "no-cache, no-store, must-revalidate")
            self.end_headers()
            with open(pdf_path, "rb") as f:
                self.wfile.write(f.read())
        else:
            self.send_error(404, "No compiled PDF found yet. Compile the project first.")

    def handle_compile(self, data):
        """Runs the compilation pipeline and extracts plain-English diagnostics."""
        root_file = data.get("root_file", "main.tex")
        engine = data.get("engine", "xelatex")

        # Save active file edits to disk before compiling
        if "active_file" in data and "content" in data:
            target_path = self.compiler.project_dir / data["active_file"]
            target_path.parent.mkdir(parents=True, exist_ok=True)
            with open(target_path, "w", encoding="utf-8") as f:
                f.write(data["content"])

        res = self.compiler.compile(root_file=root_file, engine=engine)
        diagnostics = ErrorTranslator.parse_log(res.get("log", "")) if not res["success"] else []

        pdf_exists = (self.compiler.project_dir / "main.pdf").exists() or (self.compiler.build_dir / "main.pdf").exists()

        self.send_json_response({
            "success": res["success"],
            "error": res.get("error"),
            "diagnostics": diagnostics,
            "has_pdf": pdf_exists
        })

    def handle_save(self, data):
        filename = data.get("path")
        content = data.get("content", "")
        if not filename:
            self.send_json_response({"success": False, "error": "No file path provided."})
            return

        target = self.compiler.project_dir / filename
        target.parent.mkdir(parents=True, exist_ok=True)
        with open(target, "w", encoding="utf-8") as f:
            f.write(content)

        self.send_json_response({"success": True, "saved": filename})

    def send_json_response(self, obj):
        content = json.dumps(obj).encode("utf-8")
        self.send_response(200)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(content)))
        self.send_header("Access-Control-Allow-Origin", "*")
        self.end_headers()
        self.wfile.write(content)

def start_server(port=54321):
    def launch_native_window():
        time.sleep(0.7)
        url = f"http://127.0.0.1:{port}"
        profile_dir = str(BASE_DIR / ".cache" / "desktop_profile")
        app_flags = [
            f"--app={url}",
            "--start-maximized",
            f"--user-data-dir={profile_dir}",
            "--no-first-run",
            "--no-default-browser-check",
            "--disable-features=Translate",
            "--disable-extensions",
            "--disable-background-networking"
        ]

        # Scan for native Chromium app-mode engines built into Windows
        candidates = [
            r"C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe",
            r"C:\Program Files\Microsoft\Edge\Application\msedge.exe",
            r"C:\Program Files\Google\Chrome\Application\chrome.exe",
            r"C:\Program Files (x86)\Google\Chrome\Application\chrome.exe",
            os.path.expandvars(r"%LOCALAPPDATA%\Microsoft\Edge\Application\msedge.exe"),
            os.path.expandvars(r"%LOCALAPPDATA%\Google\Chrome\Application\chrome.exe")
        ]

        for exe in candidates:
            if os.path.exists(exe):
                try:
                    subprocess.Popen([exe] + app_flags)
                    return
                except Exception:
                    pass

        # Fallback to default browser if native app mode fails
        webbrowser.open(url)

    threading.Thread(target=launch_native_window, daemon=True).start()

    server = HTTPServer(("127.0.0.1", port), TeXPressHandler)
    print(f"=====================================================")
    print(f" 📘 TeXPress Studio - Native Desktop Mode")
    print(f" -> URL: http://127.0.0.1:{port}")
    print(f" -> Project: {DEFAULT_PROJECT_DIR}")
    print(f"=====================================================")
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\nStopping TeXPress Studio...")
        server.server_close()

if __name__ == "__main__":
    port = int(sys.argv[1]) if len(sys.argv) > 1 else 54321
    start_server(port)
