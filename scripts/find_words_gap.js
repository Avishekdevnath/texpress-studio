const fs = require('fs');
const path = require('path');

function searchDir(dir) {
  const files = fs.readdirSync(dir);
  for (const f of files) {
    const full = path.join(dir, f);
    if (fs.statSync(full).isDirectory()) {
      if (f !== 'vendor' && f !== 'node_modules' && f !== '.build') searchDir(full);
    } else if (f.endsWith('.js') || f.endsWith('.html')) {
      const content = fs.readFileSync(full, 'utf8');
      const lines = content.split('\n');
      lines.forEach((l, i) => {
        if (l.includes('pdfWordsBadge') || l.includes('pdfTotalWords') || l.includes('wordsBadge') || /words/i.test(l)) {
          if (l.includes('pdfWordsBadge') || l.includes('pdfTotalWords') || l.includes('words<') || l.includes('words"') || l.includes('words`') || l.includes('words\'') || l.includes('words</span>') || l.includes('words</div>')) {
            console.log(full + ':' + (i+1) + ': ' + l.trim());
          }
        }
      });
    }
  }
}

searchDir('texpress_studio/ui');
