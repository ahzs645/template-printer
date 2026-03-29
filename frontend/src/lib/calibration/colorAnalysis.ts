import pkg from 'js-aruco2'
import { generateArucoMarker } from './aruco'

const { AR } = pkg

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

interface MarkerCorner {
  x: number
  y: number
}

interface MarkerBounds {
  minX: number
  maxX: number
  minY: number
  maxY: number
  width: number
  height: number
  center: { x: number; y: number }
}

interface MarkerCandidate {
  rawId: number
  logicalId: number | null
  corners: MarkerCorner[]
  bounds: MarkerBounds
  area: number
  aspectRatio: number
}

const EXPECTED_MARKER_PATTERNS = [0, 1, 2, 3].map((id) => ({
  id,
  rotations: buildMarkerRotations(generateArucoMarker(id, 100).matrix)
}))

const MAX_PATTERN_DISTANCE = 4
const MIN_PATTERN_DISTANCE_GAP = 3

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

function rotateMatrixClockwise(matrix: number[][]): number[][] {
  const size = matrix.length
  return Array.from({ length: size }, (_, row) =>
    Array.from({ length: size }, (_, col) => matrix[size - col - 1][row])
  )
}

function buildMarkerRotations(matrix: number[][]): number[][][] {
  const rotations = [matrix]
  for (let i = 1; i < 4; i++) {
    rotations.push(rotateMatrixClockwise(rotations[i - 1]))
  }
  return rotations
}

function matrixDistance(a: number[][], b: number[][]): number {
  let distance = 0
  for (let row = 0; row < a.length; row++) {
    for (let col = 0; col < a[row].length; col++) {
      if (a[row][col] !== b[row][col]) {
        distance++
      }
    }
  }
  return distance
}

function getMarkerBounds(corners: MarkerCorner[]): MarkerBounds {
  const xs = corners.map((corner) => corner.x)
  const ys = corners.map((corner) => corner.y)
  const minX = Math.min(...xs)
  const maxX = Math.max(...xs)
  const minY = Math.min(...ys)
  const maxY = Math.max(...ys)

  return {
    minX,
    maxX,
    minY,
    maxY,
    width: maxX - minX,
    height: maxY - minY,
    center: {
      x: (minX + maxX) / 2,
      y: (minY + maxY) / 2
    }
  }
}

function sampleMarkerMatrix(
  imageData: ImageData,
  corners: MarkerCorner[],
  matrixSize: number = 7
): number[][] {
  const bounds = getMarkerBounds(corners)
  const matrix: number[][] = []

  for (let row = 0; row < matrixSize; row++) {
    matrix[row] = []
    for (let col = 0; col < matrixSize; col++) {
      const startX = bounds.minX + ((col + 0.25) * bounds.width) / matrixSize
      const endX = bounds.minX + ((col + 0.75) * bounds.width) / matrixSize
      const startY = bounds.minY + ((row + 0.25) * bounds.height) / matrixSize
      const endY = bounds.minY + ((row + 0.75) * bounds.height) / matrixSize

      let brightnessSum = 0
      let count = 0

      for (let y = Math.max(0, Math.floor(startY)); y <= Math.min(imageData.height - 1, Math.floor(endY)); y++) {
        for (let x = Math.max(0, Math.floor(startX)); x <= Math.min(imageData.width - 1, Math.floor(endX)); x++) {
          const index = (y * imageData.width + x) * 4
          brightnessSum += imageData.data[index] + imageData.data[index + 1] + imageData.data[index + 2]
          count++
        }
      }

      const averageBrightness = brightnessSum / Math.max(1, count) / 3
      matrix[row][col] = averageBrightness > 127 ? 1 : 0
    }
  }

  return matrix
}

function matchMarkerPattern(imageData: ImageData, corners: MarkerCorner[]) {
  const sampledMatrix = sampleMarkerMatrix(imageData, corners)
  const scores = EXPECTED_MARKER_PATTERNS
    .map((pattern) => ({
      id: pattern.id,
      distance: Math.min(...pattern.rotations.map((rotation) => matrixDistance(sampledMatrix, rotation)))
    }))
    .sort((a, b) => a.distance - b.distance)

  if (scores.length < 2) return null

  const best = scores[0]
  const second = scores[1]

  if (best.distance > MAX_PATTERN_DISTANCE) return null
  if ((second.distance - best.distance) < MIN_PATTERN_DISTANCE_GAP) return null

  return {
    id: best.id,
    distance: best.distance
  }
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

  console.log(`[DEBUG v2] Checking marker count: ${detectedMarkers.length} >= 3? ${detectedMarkers.length >= 3}`);
  if (detectedMarkers.length >= 3) {
    console.log(`[v2] Found ${detectedMarkers.length} markers, calculating transform.`);
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

// Marker ID mapping: isolated markers usually decode to these IDs, but in the full chart
// js-aruco2 can sometimes report alternate IDs due to neighboring swatches. We treat these
// IDs as hints and fall back to direct 7x7 pattern matching against the rendered marker.
const MARKER_ID_MAP: { [detected: number]: number } = {
  72: 0,   // top-left
  178: 0,  // top-left (observed in full chart render)
  151: 1,  // top-right (checkerboard pattern)
  175: 1,  // top-right (observed in full chart render)
  27: 2,   // bottom-left
  181: 2,  // bottom-left (observed in full chart render)
  164: 3   // bottom-right
};

function detectArucoMarkers(imageData: ImageData): Array<{
  id: number;
  corners: Array<{ x: number; y: number }>;
}> {
  console.log('ArUco detection using js-aruco2 npm module');
  console.log('Image dimensions:', imageData.width, 'x', imageData.height);

  // Use ARUCO_MIP_36h12 dictionary - our markers are detected with this dictionary
  try {
    console.log('Using ARUCO_MIP_36h12 dictionary');
    const detector = new AR.Detector({ dictionaryName: 'ARUCO_MIP_36h12' });
    const detected = detector.detect(imageData);

    console.log(`Raw detection found ${detected.length} markers`);
    if (detected.length > 0) {
      console.log('Raw marker IDs:', detected.map((m: { id: number }) => m.id).join(', '));
      return processDetectedMarkers(detected, imageData);
    }
  } catch (e) {
    console.log('ARUCO_MIP_36h12 detection failed:', e);
  }

  // Fallback: try default detector (also uses ARUCO_MIP_36h12)
  try {
    console.log('Trying default detector');
    const detector = new AR.Detector();
    const detected = detector.detect(imageData);

    console.log(`Default detector found ${detected.length} markers`);
    if (detected.length > 0) {
      console.log('Raw marker IDs:', detected.map((m: { id: number }) => m.id).join(', '));
      return processDetectedMarkers(detected, imageData);
    }
  } catch (e) {
    console.log('Default detector failed:', e);
  }

  console.log('No markers found');
  return [];
}

function processDetectedMarkers(
  detectedJsArucoMarkers: Array<{ id: number; corners: Array<{ x: number; y: number }> }>,
  imageData: ImageData
): Array<{
  id: number;
  corners: Array<{ x: number; y: number }>;
}> {
  console.log('js-aruco2 raw detected', detectedJsArucoMarkers.length, 'markers');

  const expectedDetectedIds = Object.keys(MARKER_ID_MAP).map(Number);
  console.log('Looking for marker IDs:', expectedDetectedIds);

  const minArea = 200
  const validCandidates: MarkerCandidate[] = detectedJsArucoMarkers
    .map((marker) => {
      const corners = marker.corners.map((corner) => ({ x: corner.x, y: corner.y }))
      const bounds = getMarkerBounds(corners)
      const area = bounds.width * bounds.height
      const aspectRatio = Math.max(bounds.width, bounds.height) / Math.max(1, Math.min(bounds.width, bounds.height))

      return {
        rawId: marker.id,
        logicalId: MARKER_ID_MAP[marker.id] ?? null,
        corners,
        bounds,
        area,
        aspectRatio
      }
    })
    .filter((candidate) => {
      const isValid = candidate.area > minArea && candidate.aspectRatio < 2.0
      if (!isValid) {
        console.log(`Filtering marker ${candidate.rawId}: area=${candidate.area.toFixed(0)}, aspect=${candidate.aspectRatio.toFixed(2)}`)
      }
      return isValid
    })

  const patternMatchedMarkers = new Map<number, { id: number; corners: MarkerCorner[]; distance: number; rawId: number }>()

  for (const candidate of validCandidates) {
    const match = matchMarkerPattern(imageData, candidate.corners)
    if (!match) continue

    const existing = patternMatchedMarkers.get(match.id)
    if (!existing || match.distance < existing.distance) {
      patternMatchedMarkers.set(match.id, {
        id: match.id,
        corners: candidate.corners,
        distance: match.distance,
        rawId: candidate.rawId
      })
    }
  }

  if (patternMatchedMarkers.size > 0) {
    const matched = Array.from(patternMatchedMarkers.values())
      .sort((a, b) => a.id - b.id)
      .map(({ id, corners, distance, rawId }) => {
        console.log(`Matched marker pattern ${id} from raw ID ${rawId} with distance ${distance}`)
        return { id, corners }
      })

    console.log(`Pattern-matched markers: ${detectedJsArucoMarkers.length} -> ${matched.length}`)
    console.log('Valid marker positions:', matched.map((marker) => marker.id))
    return matched
  }

  const uniqueMarkers = new Map<number, { id: number; corners: MarkerCorner[]; area: number }>()
  for (const candidate of validCandidates) {
    if (candidate.logicalId === null) continue

    console.log(`Found expected marker ID ${candidate.rawId} -> maps to position ${candidate.logicalId}`)

    const existing = uniqueMarkers.get(candidate.logicalId)
    if (!existing || candidate.area > existing.area) {
      uniqueMarkers.set(candidate.logicalId, {
        id: candidate.logicalId,
        corners: candidate.corners,
        area: candidate.area
      })
    }
  }

  const fallbackMarkers = Array.from(uniqueMarkers.values()).map(({ id, corners }) => ({ id, corners }))
  console.log(`Filtered markers: ${detectedJsArucoMarkers.length} -> ${fallbackMarkers.length}`)
  console.log('Valid marker positions:', fallbackMarkers.map((marker) => marker.id))

  return fallbackMarkers
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

  const foundCount = [marker0, marker1, marker2, marker3].filter(Boolean).length;
  console.log('Expected markers found:', {
    topLeft: !!marker0,
    topRight: !!marker1,
    bottomLeft: !!marker2,
    bottomRight: !!marker3,
    total: foundCount
  });

  // Don't use corner detection fallback - it causes issues when markers are detected at wrong positions
  // Instead, proceed with whatever markers we found by ID
  if (foundCount < 2) {
    console.log('Need at least 2 markers for transform');
    return { rotation: 0, scale: 1, translation: { x: 0, y: 0 } };
  }

  // Create homography-like transform using available markers
  const detectedPoints: Array<{ x: number; y: number }> = [];
  const expectedPoints: Array<{ x: number; y: number }> = [];

  // Calculate grid layout EXACTLY matching layoutCalculator.ts
  const gridCols = 11;
  const gridRows = 7;
  const gap = 0.5;
  const margin = 5;

  const totalGapWidth = gap * (gridCols - 1);
  const totalGapHeight = gap * (gridRows - 1);
  const availableWidth = cardDimensions.width - (2 * margin) - totalGapWidth;
  const availableHeight = cardDimensions.height - (2 * margin) - totalGapHeight;

  const maxSwatchWidth = availableWidth / gridCols;
  const maxSwatchHeight = availableHeight / gridRows;
  const swatchSize = Math.min(maxSwatchWidth, maxSwatchHeight);

  const actualGridWidth = (gridCols * swatchSize) + totalGapWidth;
  const actualGridHeight = (gridRows * swatchSize) + totalGapHeight;
  const centerX = (cardDimensions.width - actualGridWidth) / 2;
  const centerY = (cardDimensions.height - actualGridHeight) / 2;

  console.log('Grid layout:', { centerX, centerY, swatchSize, actualGridWidth, actualGridHeight });

  // Expected marker CENTER positions (markers are at grid positions 0, 10, 66, 76)
  // Marker center = grid position + half swatch size
  if (marker0) {
    detectedPoints.push(getMarkerCenter(marker0));
    // Grid position 0 (col 0, row 0)
    expectedPoints.push({ x: centerX + swatchSize / 2, y: centerY + swatchSize / 2 });
  }
  if (marker1) {
    detectedPoints.push(getMarkerCenter(marker1));
    // Grid position 10 (col 10, row 0)
    expectedPoints.push({ x: centerX + 10 * (swatchSize + gap) + swatchSize / 2, y: centerY + swatchSize / 2 });
  }
  if (marker2) {
    detectedPoints.push(getMarkerCenter(marker2));
    // Grid position 66 (col 0, row 6)
    expectedPoints.push({ x: centerX + swatchSize / 2, y: centerY + 6 * (swatchSize + gap) + swatchSize / 2 });
  }
  if (marker3) {
    detectedPoints.push(getMarkerCenter(marker3));
    // Grid position 76 (col 10, row 6)
    expectedPoints.push({ x: centerX + 10 * (swatchSize + gap) + swatchSize / 2, y: centerY + 6 * (swatchSize + gap) + swatchSize / 2 });
  }

  console.log('Transform points:', { detectedPoints, expectedPoints });

  // Build marker position map directly from what we found
  // Since we add points in order 0, 1, 2, 3 (if they exist), we track the index
  const markerMap: { [id: number]: { detected: { x: number; y: number }; expected: { x: number; y: number } } } = {};
  let pointIdx = 0;

  if (marker0) {
    markerMap[0] = { detected: detectedPoints[pointIdx], expected: expectedPoints[pointIdx] };
    pointIdx++;
  }
  if (marker1) {
    markerMap[1] = { detected: detectedPoints[pointIdx], expected: expectedPoints[pointIdx] };
    pointIdx++;
  }
  if (marker2) {
    markerMap[2] = { detected: detectedPoints[pointIdx], expected: expectedPoints[pointIdx] };
    pointIdx++;
  }
  if (marker3) {
    markerMap[3] = { detected: detectedPoints[pointIdx], expected: expectedPoints[pointIdx] };
    pointIdx++;
  }

  console.log('Marker map:', Object.keys(markerMap).map(k => `M${k}`).join(', '),
    '| Detected positions:', Object.entries(markerMap).map(([k, v]) => `M${k}:(${v.detected.x.toFixed(0)},${v.detected.y.toFixed(0)})`).join(' '));

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

    // Grid step size (swatch + gap)
    const step = swatchSize + gap;

    // Marker centers in card coordinates (these are the reference points for bilinear interp)
    // Marker 0 center: col 0, row 0
    // Marker 1 center: col 10, row 0
    // Marker 2 center: col 0, row 6
    // Marker 3 center: col 10, row 6
    const marker0Center = { x: centerX + swatchSize / 2, y: centerY + swatchSize / 2 };
    const marker1Center = { x: centerX + 10 * step + swatchSize / 2, y: centerY + swatchSize / 2 };
    const marker2Center = { x: centerX + swatchSize / 2, y: centerY + 6 * step + swatchSize / 2 };
    const marker3Center = { x: centerX + 10 * step + swatchSize / 2, y: centerY + 6 * step + swatchSize / 2 };

    console.log(`Expected marker centers: m0(${marker0Center.x.toFixed(2)},${marker0Center.y.toFixed(2)}) m1(${marker1Center.x.toFixed(2)},${marker1Center.y.toFixed(2)}) m2(${marker2Center.x.toFixed(2)},${marker2Center.y.toFixed(2)}) m3(${marker3Center.x.toFixed(2)},${marker3Center.y.toFixed(2)}) spanX=${(marker1Center.x - marker0Center.x).toFixed(2)} spanY=${(marker2Center.y - marker0Center.y).toFixed(2)}`);

    // Calculate detected step sizes (how many pixels per cell in the image)
    const detectedStepX = markerMap[0] && markerMap[1]
      ? (markerMap[1].detected.x - markerMap[0].detected.x) / 10  // 10 cells between marker 0 and 1
      : null;
    const detectedStepY = markerMap[0] && markerMap[2]
      ? (markerMap[2].detected.y - markerMap[0].detected.y) / 6   // 6 cells between marker 0 and 2
      : null;

    console.log('Detected step sizes:', { detectedStepX, detectedStepY });

    return {
      rotation,
      scale,
      translation: dp1,
      // Direct grid-based transform using detected marker positions
      transformPoint: (cardX: number, cardY: number) => {
        // Bilinear interpolation if we have all 4 markers
        if (markerMap[0] && markerMap[1] && markerMap[2] && markerMap[3] && detectedStepX && detectedStepY) {
          // Normalize card coordinates relative to marker centers
          // At marker0 center: nx=0, ny=0 → maps to detected m0
          // At marker1 center: nx=1, ny=0 → maps to detected m1
          // Values outside [0,1] are extrapolated (for cell corners)
          const nx = (cardX - marker0Center.x) / (marker1Center.x - marker0Center.x);
          const ny = (cardY - marker0Center.y) / (marker2Center.y - marker0Center.y);

          // Bilinear interpolation using detected marker centers
          const x = markerMap[0].detected.x * (1 - nx) * (1 - ny) +
            markerMap[1].detected.x * nx * (1 - ny) +
            markerMap[2].detected.x * (1 - nx) * ny +
            markerMap[3].detected.x * nx * ny;

          const y = markerMap[0].detected.y * (1 - nx) * (1 - ny) +
            markerMap[1].detected.y * nx * (1 - ny) +
            markerMap[2].detected.y * (1 - nx) * ny +
            markerMap[3].detected.y * nx * ny;

          return { x, y };
        } else if (Object.keys(markerMap).length >= 3) {
          // Use 3-point transform with estimated 4th corner
          const hasTopLeft = !!markerMap[0];
          const hasTopRight = !!markerMap[1];
          const hasBottomLeft = !!markerMap[2];
          const hasBottomRight = !!markerMap[3];

          // Normalize relative to marker centers (same as 4-marker case)
          const normalizedX = (cardX - marker0Center.x) / (marker1Center.x - marker0Center.x);
          const normalizedY = (cardY - marker0Center.y) / (marker2Center.y - marker0Center.y);

          // Estimate missing corner from the other 3
          let m0 = markerMap[0]?.detected;
          let m1 = markerMap[1]?.detected;
          let m2 = markerMap[2]?.detected;
          let m3 = markerMap[3]?.detected;

          if (!hasTopRight && m0 && m2 && m3) {
            m1 = { x: m0.x + (m3.x - m2.x), y: m0.y + (m3.y - m2.y) };
          } else if (!hasTopLeft && m1 && m2 && m3) {
            m0 = { x: m1.x - (m3.x - m2.x), y: m1.y - (m3.y - m2.y) };
          } else if (!hasBottomLeft && m0 && m1 && m3) {
            m2 = { x: m0.x + (m3.x - m1.x), y: m0.y + (m3.y - m1.y) };
          } else if (!hasBottomRight && m0 && m1 && m2) {
            m3 = { x: m1.x + (m2.x - m0.x), y: m1.y + (m2.y - m0.y) };
          }

          if (m0 && m1 && m2 && m3) {
            const x = m0.x * (1 - normalizedX) * (1 - normalizedY) +
              m1.x * normalizedX * (1 - normalizedY) +
              m2.x * (1 - normalizedX) * normalizedY +
              m3.x * normalizedX * normalizedY;
            const y = m0.y * (1 - normalizedX) * (1 - normalizedY) +
              m1.y * normalizedX * (1 - normalizedY) +
              m2.y * (1 - normalizedX) * normalizedY +
              m3.y * normalizedX * normalizedY;
            return { x, y };
          }

          // Fallback if estimation failed
          return { x: cardX * scale + dp1.x, y: cardY * scale + dp1.y };
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

  // Calculate grid layout EXACTLY matching layoutCalculator.ts and calculateTransform
  const gridCols = swatchLayout.cols;
  const gridRows = swatchLayout.rows;
  const gap = 0.5;
  const margin = 5;

  const totalGapWidth = gap * (gridCols - 1);
  const totalGapHeight = gap * (gridRows - 1);
  const availableWidth = cardDimensions.width - (2 * margin) - totalGapWidth;
  const availableHeight = cardDimensions.height - (2 * margin) - totalGapHeight;

  const maxSwatchWidth = availableWidth / gridCols;
  const maxSwatchHeight = availableHeight / gridRows;
  const swatchSize = Math.min(maxSwatchWidth, maxSwatchHeight);

  const actualGridWidth = (gridCols * swatchSize) + totalGapWidth;
  const actualGridHeight = (gridRows * swatchSize) + totalGapHeight;
  const centerX = (cardDimensions.width - actualGridWidth) / 2;
  const centerY = (cardDimensions.height - actualGridHeight) / 2;

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

    // Position relative to card dimensions - using CENTERED positioning like layoutCalculator.ts
    const cardX = centerX + col * (swatchSize + gap) + swatchSize / 2;
    const cardY = centerY + row * (swatchSize + gap) + swatchSize / 2;

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
