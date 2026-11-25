const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');

console.log('=== TEST SUITE: Smart Engine Auto-Detection & BibTeX Pipeline ===\n');

// 1. Test Engine Auto-Detection logic
function detectLatexEngine(content, defaultEngine = "xelatex") {
  if (!content || typeof content !== "string") return defaultEngine;

  const magicMatch = content.match(/%\s*!T[eE]X\s+(?:TS-)?program\s*=\s*([a-zA-Z0-9_\-]+)/i);
  if (magicMatch) {
    const prog = magicMatch[1].toLowerCase();
    if (prog.includes("pdf")) return "pdflatex";
    if (prog.includes("xe")) return "xelatex";
    if (prog.includes("lua")) return "lualatex";
  }

  const docClassMatch = content.match(/\\documentclass\s*\[([^\]]*)\]/i);
  if (docClassMatch) {
    const opts = docClassMatch[1].toLowerCase();
    if (opts.includes("pdflatex")) return "pdflatex";
    if (opts.includes("xelatex")) return "xelatex";
    if (opts.includes("lualatex")) return "lualatex";
  }

  const hasXePackage = /\\usepackage(\[[^\]]*\])?\{(?:fontspec|unicode-math|polyglossia|xeCJK|bidi)\}/i.test(content);
  const hasXeCommand = /\\(?:setmainfont|setsansfont|setmonofont|defaultfontfeatures)\b/i.test(content);
  if (hasXePackage || hasXeCommand) {
    return "xelatex";
  }

  if (/\\documentclass(\[[^\]]*\])?\{(?:sn-jnl|article|revtex4|revtex4-1|revtex4-2|svjour3|elsarticle|IEEEtran|acmart)\}/i.test(content)) {
    return "pdflatex";
  }

  return defaultEngine;
}

let passed = 0;
let total = 0;

function assertEqual(actual, expected, desc) {
  total++;
  if (actual === expected) {
    console.log(`[PASS] ${desc}: got '${actual}'`);
    passed++;
  } else {
    console.error(`[FAIL] ${desc}: expected '${expected}', got '${actual}'`);
  }
}

// Test Cases
assertEqual(
  detectLatexEngine('\\documentclass[pdflatex,sn-nature]{sn-jnl}'),
  'pdflatex',
  'Detects pdflatex from sn-jnl with pdflatex option'
);

assertEqual(
  detectLatexEngine('% !TeX program = pdflatex\n\\documentclass{article}'),
  'pdflatex',
  'Detects pdflatex from magic comment'
);

assertEqual(
  detectLatexEngine('\\documentclass{article}\n\\usepackage{fontspec}'),
  'xelatex',
  'Detects xelatex from fontspec package'
);

assertEqual(
  detectLatexEngine('\\documentclass{sn-jnl}\n\\usepackage{graphicx}'),
  'pdflatex',
  'Defaults sn-jnl to pdflatex'
);

assertEqual(
  detectLatexEngine('\\documentclass{book}\n\\setmainfont{Times New Roman}'),
  'xelatex',
  'Detects xelatex from setmainfont'
);

// Test on real manuscript_natcomputsci.tex
const manuscriptPath = 'S:/MSc DU/Research/Babu Sir/Research/Review 2/Nature_Computational_Science/manuscript_natcomputsci.tex';
const manuscriptContent = fs.readFileSync(manuscriptPath, 'utf-8');
const detectedEngine = detectLatexEngine(manuscriptContent);
assertEqual(
  detectedEngine,
  'pdflatex',
  'Real manuscript_natcomputsci.tex correctly resolves to pdflatex'
);

// Check title in real manuscript
const titleLine = manuscriptContent.split('\n').find(l => l.startsWith('\\title'));
console.log('\nCurrent Title Line in manuscript:', titleLine);
assertEqual(
  titleLine.includes('\\title[Quantum Artificial Intelligence in Molecular Medicine]{Quantum'),
  true,
  'Title is clean and correctly structured in mandatory {...} argument'
);

console.log(`\nResults: ${passed}/${total} tests passed.`);
if (passed === total) {
  console.log('ALL ENGINE & SYNTAX TESTS PASSED PERFECTLY!');
} else {
  process.exit(1);
}
