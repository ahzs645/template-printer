import pkg from 'js-aruco2';
const { AR, dictionaries } = pkg;

// Try to access the dictionary data
console.log('Available in AR:', Object.keys(AR));
console.log('Available dictionaries:', Object.keys(dictionaries || {}));

// Look for ARUCO_MIP_36h12 dictionary
const dict = dictionaries?.ARUCO_MIP_36h12;
if (dict) {
  console.log('\nARUCO_MIP_36h12 dictionary:');
  console.log('Number of markers:', dict.length);
  console.log('Bit size:', dict.tau);

  // Find specific markers
  const targetIds = [72, 225, 27, 164];
  for (const id of targetIds) {
    if (dict[id]) {
      console.log(`\nID ${id}:`, dict[id]);
    }
  }
}

// Let's also check what the default detector uses
const detector = new AR.Detector({ dictionaryName: 'ARUCO_MIP_36h12' });
console.log('\nDetector config:', detector);

// Try to generate marker images and see what pattern they have
// by creating test images and detecting them
import sharp from 'sharp';

async function testPattern(pattern, expectedId) {
  // Create a 7x7 marker image (5x5 pattern + border)
  const size = 70;
  const cellSize = size / 7;

  let svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}">`;
  svg += `<rect x="0" y="0" width="${size}" height="${size}" fill="white"/>`; // White padding

  // Draw black border
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

  // Add white padding around the marker
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

  console.log(`Pattern for expected ID ${expectedId}: detected as ID ${markers[0]?.id || 'NOT FOUND'}`);
  if (markers.length > 0) {
    console.log(`  Detected ${markers.length} markers: ${markers.map(m => m.id).join(', ')}`);
  }

  return markers[0]?.id;
}

// Test the patterns from aruco.ts
const patterns = {
  0: [
    [0, 0, 1, 1, 1],
    [1, 0, 0, 1, 0],
    [0, 1, 0, 1, 0],
    [0, 0, 1, 0, 0],
    [1, 0, 1, 1, 1]
  ],
  1: [
    [1, 0, 1, 0, 1],
    [0, 1, 0, 0, 0],
    [1, 1, 1, 1, 0],
    [0, 0, 0, 1, 0],
    [1, 0, 1, 0, 1]
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

console.log('\n--- Testing current patterns ---');
for (const [id, pattern] of Object.entries(patterns)) {
  await testPattern(pattern, id);
}
