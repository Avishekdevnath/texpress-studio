"""
TeXPress Studio - Plain-English Error Translator
Parses cryptic TeX .log dumps and converts them into clear, actionable advice for scholars.
"""

import re

class ErrorTranslator:
    COMMON_PATTERNS = [
        # 1. Unescaped special characters
        (
            r"! You can't use `macro parameter character #' in [^.]*",
            "Unescaped '#' Character",
            "You used a raw '#' character in the text. In LaTeX, write '\\#' instead."
        ),
        (
            r"! Misplaced alignment tab character &",
            "Misplaced '&' Alignment Character",
            "Found an unescaped '&' outside of a table. If writing an ampersand in prose, use '\\&'."
        ),
        # 2. Math mode delimiters
        (
            r"! Missing \$ inserted",
            "Missing Math Mode Delimiter ($)",
            "A mathematical character or subscript/superscript (like '_' or '^') was used in regular text without enclosing '$' signs."
        ),
        (
            r"! Display math should end with \$\$",
            "Mismatched Math Brackets",
            "An equation block was opened or closed with inconsistent math brackets."
        ),
        # 3. Environments
        (
            r"! LaTeX Error: \\begin\{([^}]+)\} on input line (\d+) ended by \\end\{([^}]+)\}",
            "Mismatched Environment \\begin / \\end",
            "Environment '\\begin{{{0}}}' on line {1} was improperly closed with '\\end{{{2}}}'."
        ),
        (
            r"! LaTeX Error: Environment ([^ ]+) undefined",
            "Undefined Environment",
            "The environment '\\begin{{{0}}}' is not recognized. Did you forget to load the package in the preamble?"
        ),
        # 4. Undefined control sequences / typos
        (
            r"! Undefined control sequence\.\s+l\.(\d+)\s+([^\n]+)",
            "Misspelled or Unknown Command",
            "Line {0}: Command '{1}' does not exist. Check for spelling errors or missing '\\usepackage{{...}}'."
        ),
        # 5. Missing Packages / Files
        (
            r"! LaTeX Error: File `([^']+)' not found",
            "Missing File or Package",
            "Could not find file '{0}'. If this is a package, it needs to be installed via MiKTeX."
        ),
        # 6. Unclosed brackets
        (
            r"! Too many \}'s",
            "Extra Closing Bracket '}'",
            "Found an extra closing bracket '}' that does not have a matching opening '{'."
        )
    ]

    @classmethod
    def parse_log(cls, raw_log):
        """Extracts structured errors from raw log text."""
        diagnostics = []

        # Find line-error format: filename:line: message
        line_error_regex = re.compile(r"^([^:\n]+):(\d+):\s+(.*)$", re.MULTILINE)
        for match in line_error_regex.finditer(raw_log):
            file, line, msg = match.groups()
            diagnostics.append({
                "type": "error",
                "file": file.strip(),
                "line": int(line),
                "title": "LaTeX Error",
                "message": msg.strip(),
                "suggestion": "Check this line for syntax formatting."
            })

        # Match against our plain-English knowledgebase
        for pattern, title, advice_template in cls.COMMON_PATTERNS:
            regex = re.compile(pattern)
            match = regex.search(raw_log)
            if match:
                groups = match.groups()
                # Format advice with captured groups if any
                try:
                    advice = advice_template.format(*groups) if groups else advice_template
                except Exception:
                    advice = advice_template

                # Extract line number if present
                line_match = re.search(r"l\.(\d+)", raw_log[match.start():match.start() + 200])
                line_no = int(line_match.group(1)) if line_match else None

                diagnostics.insert(0, {
                    "type": "human_friendly",
                    "title": title,
                    "line": line_no,
                    "message": advice,
                    "suggestion": "Click Auto-Fix or correct the indicated line."
                })

        return diagnostics
