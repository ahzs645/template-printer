import pkg from 'js-aruco2';
const { AR } = pkg;
import sharp from 'sharp';

// Test a 5x5 pattern and return detected ID
async function testPattern(pattern) {
  const size = 70;
  const cellSize = size / 7;

  let svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}">`;

  for (let i = 0; i < 7; i++) {
    for (let j = 0; j < 7; j++) {
      if (i === 0 || i === 6 || j === 0 || j === 6) {
        svg += `<rect x="${j * cellSize}" y="${i * cellSize}" width="${cellSize}" height="${cellSize}" fill="black"/>`;
      } else {
        const bit = pattern[i - 1][j - 1];
        const color = bit === 1 ? 'white' : 'black';
        svg += `<rect x="${j * cellSize}" y="${i * cellSize}" width="${cellSize}" height="${cellSize}" fill="${color}"/>`;
      }
    }
  }
  svg += '</svg>';

  const paddedSize = size + 40;
  const paddedSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="${paddedSize}" height="${paddedSize}">
    <rect x="0" y="0" width="${paddedSize}" height="${paddedSize}" fill="white"/>
    <g transform="translate(20, 20)">${svg.replace(/<\/?svg[^>]*>/g, '')}</g>
  </svg>`;

  const buffer = Buffer.from(paddedSvg);
  const { data, info } = await sharp(buffer)
    .raw()
    .ensureAlpha()
    .toBuffer({ resolveWithObject: true });

  const imageData = {
    data: new Uint8ClampedArray(data),
    width: info.width,
    height: info.height
  };

  const detector = new AR.Detector({ dictionaryName: 'ARUCO_MIP_36h12' });
  const markers = detector.detect(imageData);

  return markers[0]?.id;
}

// Generate random 5x5 patterns and test them
const existingIds = [72, 27, 164]; // IDs already used by markers 0, 2, 3
const targetIds = []; // IDs we want to find patterns for
const foundPatterns = {};

console.log('Searching for unique patterns...');
console.log('Existing IDs:', existingIds);

// Try systematic patterns
for (let bits = 0; bits < 33554432; bits += 1000) { // Sample every 1000th pattern
  const pattern = [];
  for (let i = 0; i < 5; i++) {
    pattern[i] = [];
    for (let j = 0; j < 5; j++) {
      const bitIdx = i * 5 + j;
      pattern[i][j] = (bits >> bitIdx) & 1;
    }
  }

  const id = await testPattern(pattern);

  if (id !== undefined && !existingIds.includes(id) && !foundPatterns[id]) {
    foundPatterns[id] = pattern;
    console.log(`Found ID ${id}:`);
    console.log('  Pattern:', JSON.stringify(pattern));

    // Stop after finding a few unique IDs
    if (Object.keys(foundPatterns).length >= 5) {
      break;
    }
  }
}

// Let's also try some known good patterns by testing a few manually crafted ones
console.log('\n--- Testing specific patterns ---');

const testPatterns = [
  // Try different variations
  {
    name: 'Alt 1',
    pattern: [
      [0, 1, 0, 1, 0],
      [1, 0, 1, 0, 1],
      [0, 1, 0, 1, 0],
      [1, 0, 1, 0, 1],
      [0, 1, 0, 1, 0]
    ]
  },
  {
    name: 'Alt 2',
    pattern: [
      [1, 1, 0, 0, 1],
      [0, 0, 1, 1, 0],
      [1, 0, 0, 1, 1],
      [0, 1, 1, 0, 0],
      [1, 1, 0, 0, 1]
    ]
  },
  {
    name: 'Alt 3',
    pattern: [
      [0, 1, 1, 1, 0],
      [1, 0, 0, 0, 1],
      [1, 0, 1, 0, 1],
      [1, 0, 0, 0, 1],
      [0, 1, 1, 1, 0]
    ]
  },
  {
    name: 'Alt 4',
    pattern: [
      [1, 0, 0, 1, 0],
      [0, 1, 1, 0, 1],
      [0, 0, 0, 1, 0],
      [1, 1, 0, 0, 1],
      [0, 1, 1, 0, 0]
    ]
  },
  {
    name: 'Alt 5',
    pattern: [
      [0, 0, 1, 0, 0],
      [0, 1, 1, 1, 0],
      [1, 1, 0, 1, 1],
      [0, 1, 1, 1, 0],
      [0, 0, 1, 0, 0]
    ]
  },
  {
    name: 'Alt 6',
    pattern: [
      [1, 1, 1, 0, 0],
      [0, 0, 1, 0, 1],
      [1, 0, 0, 1, 0],
      [0, 1, 0, 1, 1],
      [0, 0, 1, 1, 1]
    ]
  }
];

for (const { name, pattern } of testPatterns) {
  const id = await testPattern(pattern);
  const isUnique = !existingIds.includes(id);
  console.log(`${name}: ID ${id} ${isUnique ? '✓ UNIQUE' : '(duplicate)'}`);
  if (isUnique && id !== undefined) {
    console.log('  Pattern:', JSON.stringify(pattern));
  }
}

console.log('\nDone!');
