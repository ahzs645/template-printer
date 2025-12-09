import sharp from 'sharp';

// Card dimensions in pixels (high resolution)
const SCALE = 10; // 10 pixels per mm
const cardWidth = Math.round(85.6 * SCALE);
const cardHeight = Math.round(54 * SCALE);

// Grid layout matching layoutCalculator.ts
const gridCols = 11;
const gridRows = 7;
const gap = Math.round(0.5 * SCALE);
const margin = Math.round(5 * SCALE);

const totalGapWidth = gap * (gridCols - 1);
const totalGapHeight = gap * (gridRows - 1);
const availableWidth = cardWidth - (2 * margin) - totalGapWidth;
const availableHeight = cardHeight - (2 * margin) - totalGapHeight;

const maxSwatchWidth = availableWidth / gridCols;
const maxSwatchHeight = availableHeight / gridRows;
// Use exact floating point to match layoutCalculator.ts (no Math.floor!)
const swatchSize = Math.min(maxSwatchWidth, maxSwatchHeight);

const actualGridWidth = (gridCols * swatchSize) + totalGapWidth;
const actualGridHeight = (gridRows * swatchSize) + totalGapHeight;
// Use exact centering (no Math.floor!)
const centerX = (cardWidth - actualGridWidth) / 2;
const centerY = (cardHeight - actualGridHeight) / 2;

console.log('Card:', cardWidth, 'x', cardHeight);
console.log('Swatch size:', swatchSize);
console.log('Center:', centerX, centerY);

// ArUco 5x5 patterns - these MUST match aruco.ts exactly!
// Detected as: 0→72, 1→151, 2→27, 3→164
const ARUCO_PATTERNS = {
  0: [
    [0, 0, 1, 1, 1],
    [1, 0, 0, 1, 0],
    [0, 1, 0, 1, 0],
    [0, 0, 1, 0, 0],
    [1, 0, 1, 1, 1]
  ],
  1: [
    [0, 1, 0, 1, 0],
    [1, 0, 1, 0, 1],
    [0, 1, 0, 1, 0],
    [1, 0, 1, 0, 1],
    [0, 1, 0, 1, 0]
  ],
  2: [
    [0, 0, 0, 1, 1],
    [1, 0, 0, 1, 0],
    [0, 1, 1, 0, 0],
    [0, 1, 0, 1, 0],
    [0, 1, 0, 0, 1]
  ],
  3: [
    [1, 0, 0, 0, 1],
    [0, 1, 0, 0, 0],
    [0, 0, 1, 1, 0],
    [1, 0, 1, 0, 0],
    [1, 1, 0, 0, 1]
  ]
};

// Sample colors
const colors = [
  [255, 0, 0], [0, 255, 0], [0, 0, 255], [0, 255, 255], [255, 0, 255],
  [255, 255, 0], [255, 165, 0], [173, 255, 47], [0, 128, 128], [128, 0, 128],
  [245, 222, 179], [210, 180, 140], [139, 69, 19], [165, 42, 42], [255, 182, 193],
  [255, 248, 220], [240, 255, 240], [230, 230, 250], [250, 250, 210], [135, 206, 235],
  [173, 216, 230], [255, 228, 196], [222, 184, 135], [210, 105, 30], [245, 245, 220],
  [128, 128, 128], [169, 169, 169], [105, 105, 105], [47, 79, 79], [0, 0, 0],
  [28, 28, 28], [45, 45, 45], [61, 61, 61], [139, 0, 0], [165, 42, 42],
  [178, 34, 34], [205, 92, 92], [220, 20, 60], [255, 0, 0], [255, 99, 71],
  [255, 69, 0], [34, 139, 34], [50, 205, 50], [60, 179, 113], [46, 139, 87],
  [0, 128, 0], [0, 100, 0], [85, 107, 47], [107, 142, 35], [124, 252, 0],
  [127, 255, 0], [173, 255, 47], [154, 205, 50], [0, 0, 128], [0, 0, 139],
  [0, 0, 205], [0, 0, 255], [30, 144, 255], [65, 105, 225], [70, 130, 180],
  [95, 158, 160], [100, 149, 237], [0, 206, 209], [32, 178, 170], [72, 61, 139],
  [123, 104, 238], [138, 43, 226], [148, 0, 211], [153, 50, 204], [186, 85, 211]
];

// Create raw pixel buffer (RGBA)
const pixels = Buffer.alloc(cardWidth * cardHeight * 4);

// Fill with white
for (let i = 0; i < pixels.length; i += 4) {
  pixels[i] = 255;     // R
  pixels[i + 1] = 255; // G
  pixels[i + 2] = 255; // B
  pixels[i + 3] = 255; // A
}

// Helper to set pixel
function setPixel(x, y, r, g, b) {
  if (x >= 0 && x < cardWidth && y >= 0 && y < cardHeight) {
    const idx = (y * cardWidth + x) * 4;
    pixels[idx] = r;
    pixels[idx + 1] = g;
    pixels[idx + 2] = b;
    pixels[idx + 3] = 255;
  }
}

// Helper to fill rectangle
function fillRect(x, y, w, h, r, g, b) {
  for (let py = y; py < y + h; py++) {
    for (let px = x; px < x + w; px++) {
      setPixel(px, py, r, g, b);
    }
  }
}

// Draw grid
const markerPositions = [0, 10, 66, 76];
let colorIndex = 0;

for (let gridIdx = 0; gridIdx < gridCols * gridRows; gridIdx++) {
  const row = Math.floor(gridIdx / gridCols);
  const col = gridIdx % gridCols;
  const x = centerX + col * (swatchSize + gap);
  const y = centerY + row * (swatchSize + gap);

  if (markerPositions.includes(gridIdx)) {
    // Draw ArUco marker
    const markerId = markerPositions.indexOf(gridIdx);
    const pattern = ARUCO_PATTERNS[markerId];
    const cellSize = Math.floor(swatchSize / 7);

    // Draw 7x7 marker (5x5 pattern + 1-cell black border)
    for (let mi = 0; mi < 7; mi++) {
      for (let mj = 0; mj < 7; mj++) {
        const mx = x + mj * cellSize;
        const my = y + mi * cellSize;

        let isWhite;
        if (mi === 0 || mi === 6 || mj === 0 || mj === 6) {
          isWhite = false; // Black border
        } else {
          isWhite = pattern[mi - 1][mj - 1] === 1;
        }

        fillRect(mx, my, cellSize, cellSize, isWhite ? 255 : 0, isWhite ? 255 : 0, isWhite ? 255 : 0);
      }
    }
  } else {
    // Draw color swatch
    const color = colors[colorIndex % colors.length];
    fillRect(x, y, swatchSize, swatchSize, color[0], color[1], color[2]);
    colorIndex++;
  }
}

// Convert to PNG
await sharp(pixels, {
  raw: {
    width: cardWidth,
    height: cardHeight,
    channels: 4
  }
})
  .png()
  .toFile('/tmp/test-calibration-card.png');

console.log('Generated: /tmp/test-calibration-card.png');

// Also copy to desktop
await sharp(pixels, {
  raw: {
    width: cardWidth,
    height: cardHeight,
    channels: 4
  }
})
  .png()
  .toFile('/Users/ahmadjalil/Desktop/test-calibration-card.png');

console.log('Also saved to: ~/Desktop/test-calibration-card.png');
