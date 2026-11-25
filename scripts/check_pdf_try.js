const fs = require('fs');
const path = require('path');
const pdfPath = 'S:/MSc DU/Research/Babu Sir/Research/Review 2/Nature_Computational_Science/.build/manuscript_natcomputsci.pdf';
const pdfBuffer = fs.readFileSync(pdfPath);
const pdfjsLib = require(path.join(__dirname, '..', 'node_modules', 'pdfjs-dist', 'legacy', 'build', 'pdf.js'));

async function test() {
  const doc = await pdfjsLib.getDocument({ data: new Uint8Array(pdfBuffer) }).promise;
  console.log('Total pages:', doc.numPages);
  for (let i = 1; i <= Math.min(3, doc.numPages); i++) {
    const page = await doc.getPage(i);
    const content = await page.getTextContent();
    const str = content.items.map(it => it.str).join(' ');
    console.log(`Page ${i} has "try": ${str.includes('try')}`);
    if (str.includes('try')) {
      const idx = str.indexOf('try');
      console.log('   Context: ...' + str.substring(Math.max(0, idx - 20), idx + 80) + '...');
    }
  }
}
test();
