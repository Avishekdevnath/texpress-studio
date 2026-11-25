const assert = require("assert");

console.log("=== Testing PDF Viewport Scroll Page Number Tracking ===");

// Simulate viewport and 10 pages
const numPages = 10;
const cardHeight = 800;
const gap = 20;
const vpHeight = 900;

function computeActivePage(scrollTop) {
  const vpTop = scrollTop;
  const vpBottom = scrollTop + vpHeight;

  let bestPage = 1;
  let maxVisibleHeight = -1;

  for (let i = 0; i < numPages; i++) {
    const pageNum = i + 1;
    const cardTop = i * (cardHeight + gap);
    const cardBottom = cardTop + cardHeight;

    const visibleTop = Math.max(cardTop, vpTop);
    const visibleBottom = Math.min(cardBottom, vpBottom);
    const visibleHeight = Math.max(0, visibleBottom - visibleTop);

    if (visibleHeight > maxVisibleHeight) {
      maxVisibleHeight = visibleHeight;
      bestPage = pageNum;
    }
  }

  return bestPage;
}

// Test 1: At top (scrollTop = 0)
assert.strictEqual(computeActivePage(0), 1, "Page 1 must be active at scrollTop 0");
console.log("✓ ScrollTop 0 -> Page 1");

// Test 2: Scrolled to page 2 (scrollTop = 820)
assert.strictEqual(computeActivePage(820), 2, "Page 2 must be active at scrollTop 820");
console.log("✓ ScrollTop 820 -> Page 2");

// Test 3: Scrolled to page 5 (scrollTop = 4 * 820 = 3280)
assert.strictEqual(computeActivePage(3280), 5, "Page 5 must be active at scrollTop 3280");
console.log("✓ ScrollTop 3280 -> Page 5");

// Test 4: Scrolled to last page 10 (scrollTop = 9 * 820 = 7380)
assert.strictEqual(computeActivePage(7380), 10, "Page 10 must be active at scrollTop 7380");
console.log("✓ ScrollTop 7380 -> Page 10");

console.log("=== All PDF Scroll Tracking Calculations PASSED! ===");
