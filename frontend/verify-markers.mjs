import sharp from 'sharp';
import pkg from 'js-aruco2';
const { AR } = pkg;

const imagePath = process.argv[2] || '/tmp/test-calibration-card.png';

console.log('Testing:', imagePath);

const { data, info } = await sharp(imagePath)
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

console.log('Total markers detected:', markers.length);

// Expected IDs
const expectedIds = [72, 151, 27, 164];
console.log('\nLooking for expected IDs:', expectedIds);

for (const id of expectedIds) {
  const found = markers.filter(m => m.id === id);
  if (found.length > 0) {
    for (const m of found) {
      const cx = m.corners.reduce((sum, c) => sum + c.x, 0) / 4;
      const cy = m.corners.reduce((sum, c) => sum + c.y, 0) / 4;
      console.log(`  ID ${id}: FOUND at (${cx.toFixed(0)}, ${cy.toFixed(0)})`);
    }
  } else {
    console.log(`  ID ${id}: NOT FOUND`);
  }
}

// Show all unique IDs found
const uniqueIds = [...new Set(markers.map(m => m.id))].sort((a, b) => a - b);
console.log('\nAll unique IDs:', uniqueIds.join(', '));
