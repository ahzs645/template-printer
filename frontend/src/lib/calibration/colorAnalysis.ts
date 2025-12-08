import { AR } from 'js-aruco2';

// Enhanced color analysis utilities
export interface ColorSample {
  color: string;
  position: { x: number; y: number };
  confidence: number;
}

export interface AnalysisResult {
  samples: ColorSample[];
  detectedMarkers: Array<{
    id: number;
    corners: Array<{ x: number; y: number }>;
  }>;
  transform: {
    rotation: number;
    scale: number;
    translation: { x: number; y: number };
    transformPoint?: (cardX: number, cardY: number) => { x: number; y: number };
  };
  canvasDimensions?: { width: number; height: number };
}

// Get average color from a region, filtering out outliers
export function getAverageColor(
  imageData: ImageData,
  centerX: number,
  centerY: number,
  radius: number = 3
): string {
  const colors: Array<{ r: number; g: number; b: number }> = [];

  for (let y = centerY - radius; y <= centerY + radius; y++) {
    for (let x = centerX - radius; x <= centerX + radius; x++) {
      if (x >= 0 && x < imageData.width && y >= 0 && y < imageData.height) {
        const index = (y * imageData.width + x) * 4;
        colors.push({
          r: imageData.data[index],
          g: imageData.data[index + 1],
          b: imageData.data[index + 2]
        });
      }
    }
  }

  if (colors.length === 0) return '#000000';

  // Sort colors and remove outliers (top and bottom 10%)
  const sortedByBrightness = colors.sort((a, b) =>
    (a.r + a.g + a.b) - (b.r + b.g + b.b)
  );

  const start = Math.floor(colors.length * 0.1);
  const end = Math.floor(colors.length * 0.9);
  const filteredColors = sortedByBrightness.slice(start, end);

  // Calculate average
  const avg = filteredColors.reduce(
    (acc, color) => ({
      r: acc.r + color.r,
      g: acc.g + color.g,
      b: acc.b + color.b
    }),
    { r: 0, g: 0, b: 0 }
  );

  const count = filteredColors.length;
  const r = Math.round(avg.r / count);
  const g = Math.round(avg.g / count);
  const b = Math.round(avg.b / count);

  return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;
}

// Enhanced color detection with perspective correction
export async function analyzeColorChart(
  canvas: HTMLCanvasElement,
  expectedColors: string[],
  cardDimensions: { width: number; height: number },
  swatchLayout: { cols: number; rows: number }
): Promise<AnalysisResult> {
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Could not get canvas context');

  const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);

  // Try to detect ArUco markers for perspective correction
  console.log('Detecting ArUco markers...');
  const detectedMarkers = detectArucoMarkers(imageData);
  console.log('ArUco detection completed, found markers:', detectedMarkers.length);

  let samples: ColorSample[] = [];
  let transform: AnalysisResult['transform'] = {
    rotation: 0,
    scale: 1,
    translation: { x: 0, y: 0 }
  };

  if (detectedMarkers.length >= 4) {
    console.log('Sufficient markers found, calculating perspective transform.');
    transform = calculateTransform(detectedMarkers, cardDimensions);

    if (transform.transformPoint) {
      console.log('Extracting colors with perspective correction.');
      samples = extractColorsWithTransform(
        imageData,
        expectedColors,
        transform,
        swatchLayout,
        cardDimensions
      );
    } else {
      console.warn('Transform point function not available after calculating transform.');
      samples = extractColorsGridBased(imageData, expectedColors, swatchLayout);
    }
  } else {
    console.log('Insufficient markers found, using grid-based detection as a fallback.');
    samples = extractColorsGridBased(imageData, expectedColors, swatchLayout);
  }

  return {
    samples,
    detectedMarkers,
    transform,
    canvasDimensions: { width: canvas.width, height: canvas.height }
  };
}

function detectArucoMarkers(imageData: ImageData): Array<{
  id: number;
  corners: Array<{ x: number; y: number }>;
}> {
  console.log('ArUco detection using js-aruco2 npm module');

  try {
    const detector = new AR.Detector({
      dictionaryName: 'ARUCO_MIP_36h12'
    });

    const detectedJsArucoMarkers = detector.detect(imageData);
    console.log('js-aruco2 detected', detectedJsArucoMarkers.length, 'markers');

    const markers = detectedJsArucoMarkers
      .map((marker: { id: number; corners: Array<{ x: number; y: number }> }) => ({
        id: marker.id,
        corners: [
          { x: marker.corners[0].x, y: marker.corners[0].y },
          { x: marker.corners[1].x, y: marker.corners[1].y },
          { x: marker.corners[2].x, y: marker.corners[2].y },
          { x: marker.corners[3].x, y: marker.corners[3].y }
        ]
      }))
      .filter((marker: { id: number; corners: Array<{ x: number; y: number }> }) => {
        const width = Math.abs(marker.corners[1].x - marker.corners[0].x);
        const height = Math.abs(marker.corners[2].y - marker.corners[0].y);
        const area = width * height;
        const minArea = 100;

        const isValid = area > minArea;
        if (!isValid) {
          console.log(`Filtering out small marker ID ${marker.id} with area ${area.toFixed(0)}`);
        }

        return isValid;
      });

    console.log(`Filtered markers: ${detectedJsArucoMarkers.length} -> ${markers.length}`);

    if (markers.length > 0) {
      console.log('js-aruco2 detection successful:', markers.length, 'markers found');
      console.log('Detected marker IDs:', markers.map((m: { id: number }) => m.id));
    }

    return markers;
  } catch (error) {
    console.warn('js-aruco2 detection failed:', error);
    return [];
  }
}

function calculateTransform(
  markers: Array<{ id: number; corners: Array<{ x: number; y: number }> }>,
  cardDimensions: { width: number; height: number }
): AnalysisResult['transform'] {
  console.log('Calculating transform from', markers.length, 'markers');
  console.log('Available marker IDs:', markers.map(m => m.id));

  // Get marker centers for transformation
  const getMarkerCenter = (marker: { corners: Array<{ x: number; y: number }> }) => {
    const x = marker.corners.reduce((sum, c) => sum + c.x, 0) / 4;
    const y = marker.corners.reduce((sum, c) => sum + c.y, 0) / 4;
    return { x, y };
  };

  // Find all 4 markers - try expected IDs first
  let marker0 = markers.find(m => m.id === 0); // Top-left
  let marker1 = markers.find(m => m.id === 1); // Top-right
  let marker2 = markers.find(m => m.id === 2); // Bottom-left
  let marker3 = markers.find(m => m.id === 3); // Bottom-right

  console.log('Expected markers found:', {
    topLeft: !!marker0,
    topRight: !!marker1,
    bottomLeft: !!marker2,
    bottomRight: !!marker3
  });

  // If we don't have the expected IDs, try to find 4 corner markers
  if (!marker0 || !marker1 || !marker2 || !marker3 && markers.length >= 4) {
    console.log('Using corner detection to find 4 most corner-like markers');

    // Find the 4 most extreme markers (corners)
    const centers = markers.map(marker => ({
      marker,
      center: getMarkerCenter(marker)
    }));

    // Find corner markers by position
    const topLeft = centers.reduce((best, current) =>
      (current.center.x + current.center.y) < (best.center.x + best.center.y) ? current : best
    );

    const topRight = centers.reduce((best, current) =>
      (current.center.x - current.center.y) > (best.center.x - best.center.y) ? current : best
    );

    const bottomLeft = centers.reduce((best, current) =>
      (current.center.y - current.center.x) > (best.center.y - best.center.x) ? current : best
    );

    const bottomRight = centers.reduce((best, current) =>
      (current.center.x + current.center.y) > (best.center.x + best.center.y) ? current : best
    );

    marker0 = topLeft.marker;
    marker1 = topRight.marker;
    marker2 = bottomLeft.marker;
    marker3 = bottomRight.marker;

    console.log('Assigned corner markers:', {
      topLeft: `ID ${marker0.id} at (${topLeft.center.x.toFixed(0)}, ${topLeft.center.y.toFixed(0)})`,
      topRight: `ID ${marker1.id} at (${topRight.center.x.toFixed(0)}, ${topRight.center.y.toFixed(0)})`,
      bottomLeft: `ID ${marker2.id} at (${bottomLeft.center.x.toFixed(0)}, ${bottomLeft.center.y.toFixed(0)})`,
      bottomRight: `ID ${marker3.id} at (${bottomRight.center.x.toFixed(0)}, ${bottomRight.center.y.toFixed(0)})`
    });
  }

  if (!marker0 || !marker1 || !marker2 || !marker3) {
    console.log('No usable markers available for transform');
    return { rotation: 0, scale: 1, translation: { x: 0, y: 0 } };
  }

  // Create homography-like transform using available markers
  const detectedPoints: Array<{ x: number; y: number }> = [];
  const expectedPoints: Array<{ x: number; y: number }> = [];

  // Expected positions in card coordinates (11x7 grid)
  const cardMargin = 5; // 5mm margin
  const gridCols = 11;
  const gridRows = 7;
  const cellWidth = (cardDimensions.width - 2 * cardMargin) / gridCols;
  const cellHeight = (cardDimensions.height - 2 * cardMargin) / gridRows;

  if (marker0) {
    detectedPoints.push(getMarkerCenter(marker0));
    expectedPoints.push({ x: cardMargin + 0.5 * cellWidth, y: cardMargin + 0.5 * cellHeight });
  }
  if (marker1) {
    detectedPoints.push(getMarkerCenter(marker1));
    expectedPoints.push({ x: cardMargin + 10.5 * cellWidth, y: cardMargin + 0.5 * cellHeight });
  }
  if (marker2) {
    detectedPoints.push(getMarkerCenter(marker2));
    expectedPoints.push({ x: cardMargin + 0.5 * cellWidth, y: cardMargin + 6.5 * cellHeight });
  }
  if (marker3) {
    detectedPoints.push(getMarkerCenter(marker3));
    expectedPoints.push({ x: cardMargin + 10.5 * cellWidth, y: cardMargin + 6.5 * cellHeight });
  }

  console.log('Transform points:', { detectedPoints, expectedPoints });

  // Create a simple affine-like transform
  if (detectedPoints.length >= 2) {
    // Use first two points to calculate basic transform
    const dp1 = detectedPoints[0];
    const dp2 = detectedPoints[1];
    const ep1 = expectedPoints[0];
    const ep2 = expectedPoints[1];

    // Calculate scale and rotation
    const detectedDx = dp2.x - dp1.x;
    const detectedDy = dp2.y - dp1.y;
    const expectedDx = ep2.x - ep1.x;
    const expectedDy = ep2.y - ep1.y;

    const detectedDistance = Math.sqrt(detectedDx * detectedDx + detectedDy * detectedDy);
    const expectedDistance = Math.sqrt(expectedDx * expectedDx + expectedDy * expectedDy);

    const scale = detectedDistance / expectedDistance;
    const rotation = Math.atan2(detectedDy, detectedDx) - Math.atan2(expectedDy, expectedDx);

    console.log('Calculated transform:', { scale: scale.toFixed(3), rotation: (rotation * 180 / Math.PI).toFixed(1) + '°' });

    return {
      rotation,
      scale,
      translation: dp1,
      // Add homography-like transform function
      transformPoint: (cardX: number, cardY: number) => {
        // Simple bilinear interpolation if we have 4 points
        if (detectedPoints.length === 4) {
          // Use bilinear interpolation with detected corners
          const normalizedX = (cardX - cardMargin) / (cardDimensions.width - 2 * cardMargin);
          const normalizedY = (cardY - cardMargin) / (cardDimensions.height - 2 * cardMargin);

          const x = detectedPoints[0].x * (1 - normalizedX) * (1 - normalizedY) +
            detectedPoints[1].x * normalizedX * (1 - normalizedY) +
            detectedPoints[2].x * (1 - normalizedX) * normalizedY +
            detectedPoints[3].x * normalizedX * normalizedY;

          const y = detectedPoints[0].y * (1 - normalizedX) * (1 - normalizedY) +
            detectedPoints[1].y * normalizedX * (1 - normalizedY) +
            detectedPoints[2].y * (1 - normalizedX) * normalizedY +
            detectedPoints[3].y * normalizedX * normalizedY;

          return { x, y };
        } else {
          // Simple affine transform for fewer points
          const cos_r = Math.cos(rotation);
          const sin_r = Math.sin(rotation);
          const translated_x = (cardX - ep1.x) * scale;
          const translated_y = (cardY - ep1.y) * scale;

          return {
            x: dp1.x + translated_x * cos_r - translated_y * sin_r,
            y: dp1.y + translated_x * sin_r + translated_y * cos_r
          };
        }
      }
    };
  }

  return { rotation: 0, scale: 1, translation: { x: 0, y: 0 } };
}

function extractColorsWithTransform(
  imageData: ImageData,
  expectedColors: string[],
  transform: AnalysisResult['transform'],
  swatchLayout: { cols: number; rows: number },
  cardDimensions: { width: number; height: number }
): ColorSample[] {
  const samples: ColorSample[] = [];

  // ArUco markers are at grid positions: 0, 10, 66, 76
  const markerPositions = [0, 10, 66, 76];
  let colorIndex = 0;

  // Process all grid positions
  for (let gridIndex = 0; gridIndex < swatchLayout.cols * swatchLayout.rows; gridIndex++) {
    // Skip marker positions
    if (markerPositions.includes(gridIndex)) {
      continue;
    }

    // Stop if we've processed all expected colors
    if (colorIndex >= expectedColors.length) {
      break;
    }

    const row = Math.floor(gridIndex / swatchLayout.cols);
    const col = gridIndex % swatchLayout.cols;

    // Calculate position with proper margins and gaps
    const margin = 5; // 5mm margin
    const gap = 0.5; // 0.5mm gap between swatches
    const swatchSize = (cardDimensions.width - 2 * margin - (swatchLayout.cols - 1) * gap) / swatchLayout.cols;

    // Position relative to card dimensions
    const cardX = margin + col * (swatchSize + gap) + swatchSize / 2;
    const cardY = margin + row * (swatchSize + gap) + swatchSize / 2;

    // Apply transformation to get image coordinates
    let x: number, y: number;
    if (transform.transformPoint) {
      const transformed = transform.transformPoint(cardX, cardY);
      x = transformed.x;
      y = transformed.y;
    } else {
      // Fallback to simple transform
      x = transform.translation.x + (cardX * transform.scale);
      y = transform.translation.y + (cardY * transform.scale);
    }

    if (x >= 0 && x < imageData.width && y >= 0 && y < imageData.height) {
      const color = getAverageColor(imageData, Math.round(x), Math.round(y), 5);
      samples.push({
        color,
        position: { x, y },
        confidence: 0.9 // High confidence with ArUco markers
      });
    } else {
      // Default color if position is out of bounds
      samples.push({
        color: '#E5E7EB',
        position: { x, y },
        confidence: 0.1
      });
    }

    colorIndex++;
  }

  return samples;
}

function extractColorsGridBased(
  _imageData: ImageData,
  _expectedColors: string[],
  _swatchLayout: { cols: number; rows: number }
): ColorSample[] {
  // Return empty samples array to let the calling code handle the color extraction
  // with its more accurate card aspect ratio scaling logic
  console.log('extractColorsGridBased called - delegating to calling code');
  return [];
}
