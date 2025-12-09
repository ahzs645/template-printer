import sharp from 'sharp';
import pkg from 'js-aruco2';
const { AR } = pkg;

const imagePath = process.argv[2];
if (!imagePath) {
  console.error('Usage: node test-aruco.mjs <image-path>');
  process.exit(1);
}

console.log('Testing image:', imagePath);

// Load and process image
const image = sharp(imagePath);
const metadata = await image.metadata();
console.log('Image dimensions:', metadata.width, 'x', metadata.height);

// Get raw pixel data
const { data, info } = await image
  .raw()
  .ensureAlpha()
  .toBuffer({ resolveWithObject: true });

console.log('Pixel data:', info.width, 'x', info.height, 'channels:', info.channels);

// Create ImageData-like object
const imageData = {
  data: new Uint8ClampedArray(data),
  width: info.width,
  height: info.height
};

// Test ARUCO_MIP_36h12 dictionary
console.log('\n--- Testing ARUCO_MIP_36h12 dictionary ---');
const detector = new AR.Detector({ dictionaryName: 'ARUCO_MIP_36h12' });
const markers = detector.detect(imageData);

console.log('Found', markers.length, 'markers');

// Find the 4 corner markers by position
if (markers.length > 0) {
  const markerCenters = markers.map(m => {
    const cx = m.corners.reduce((sum, c) => sum + c.x, 0) / 4;
    const cy = m.corners.reduce((sum, c) => sum + c.y, 0) / 4;
    const width = Math.abs(m.corners[1].x - m.corners[0].x);
    const height = Math.abs(m.corners[2].y - m.corners[0].y);
    return { id: m.id, cx, cy, width, height, area: width * height };
  });

  // Filter to reasonable size markers
  const validMarkers = markerCenters.filter(m => m.area > 200);
  console.log('\nValid markers (area > 200):', validMarkers.length);

  // Find corners
  const topLeft = validMarkers.reduce((best, m) =>
    (m.cx + m.cy) < (best.cx + best.cy) ? m : best, validMarkers[0]);
  const topRight = validMarkers.reduce((best, m) =>
    (m.cx - m.cy) > (best.cx - best.cy) ? m : best, validMarkers[0]);
  const bottomLeft = validMarkers.reduce((best, m) =>
    (m.cy - m.cx) > (best.cy - best.cx) ? m : best, validMarkers[0]);
  const bottomRight = validMarkers.reduce((best, m) =>
    (m.cx + m.cy) > (best.cx + best.cy) ? m : best, validMarkers[0]);

  console.log('\nCorner markers:');
  console.log('Top-left:', topLeft ? `ID ${topLeft.id} at (${topLeft.cx.toFixed(0)}, ${topLeft.cy.toFixed(0)})` : 'NOT FOUND');
  console.log('Top-right:', topRight ? `ID ${topRight.id} at (${topRight.cx.toFixed(0)}, ${topRight.cy.toFixed(0)})` : 'NOT FOUND');
  console.log('Bottom-left:', bottomLeft ? `ID ${bottomLeft.id} at (${bottomLeft.cx.toFixed(0)}, ${bottomLeft.cy.toFixed(0)})` : 'NOT FOUND');
  console.log('Bottom-right:', bottomRight ? `ID ${bottomRight.id} at (${bottomRight.cx.toFixed(0)}, ${bottomRight.cy.toFixed(0)})` : 'NOT FOUND');

  // Show unique IDs
  const uniqueIds = [...new Set(validMarkers.map(m => m.id))];
  console.log('\nUnique IDs found:', uniqueIds.join(', '));

  // Show all markers near the corners
  console.log('\n--- Markers by position ---');
  const sortedByPos = [...validMarkers].sort((a, b) => (a.cx + a.cy) - (b.cx + b.cy));
  sortedByPos.slice(0, 10).forEach(m => {
    console.log(`ID ${m.id}: (${m.cx.toFixed(0)}, ${m.cy.toFixed(0)}) area=${m.area.toFixed(0)}`);
  });
}
