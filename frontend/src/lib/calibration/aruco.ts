// ArUco marker generation utilities
export interface ArucoMarker {
  id: number;
  size: number;
  matrix: number[][];
}

// ArUco patterns for ARUCO_MIP_36h12 dictionary
// These 5x5 bit patterns are detected with these IDs in js-aruco2's ARUCO_MIP_36h12 dictionary:
// Pattern 0 → detected as ID 72
// Pattern 1 → detected as ID 151 (checkerboard pattern - unique!)
// Pattern 2 → detected as ID 27
// Pattern 3 → detected as ID 164
const ARUCO_5X5_PATTERNS: { [key: number]: number[][] } = {
  // ID 0 - detected as ID 72 in ARUCO_MIP_36h12
  0: [
    [0, 0, 1, 1, 1],
    [1, 0, 0, 1, 0],
    [0, 1, 0, 1, 0],
    [0, 0, 1, 0, 0],
    [1, 0, 1, 1, 1]
  ],
  // ID 1 - detected as ID 151 in ARUCO_MIP_36h12 (checkerboard pattern)
  1: [
    [0, 1, 0, 1, 0],
    [1, 0, 1, 0, 1],
    [0, 1, 0, 1, 0],
    [1, 0, 1, 0, 1],
    [0, 1, 0, 1, 0]
  ],
  // ID 2 - detected as ID 27 in ARUCO_MIP_36h12
  2: [
    [0, 0, 0, 1, 1],
    [1, 0, 0, 1, 0],
    [0, 1, 1, 0, 0],
    [0, 1, 0, 1, 0],
    [0, 1, 0, 0, 1]
  ],
  // ID 3 - detected as ID 164 in ARUCO_MIP_36h12
  3: [
    [1, 0, 0, 0, 1],
    [0, 1, 0, 0, 0],
    [0, 0, 1, 1, 0],
    [1, 0, 1, 0, 0],
    [1, 1, 0, 0, 1]
  ]
};

export function generateArucoMarker(id: number, size: number = 100): ArucoMarker {
  const pattern = ARUCO_5X5_PATTERNS[id] || ARUCO_5X5_PATTERNS[0];

  // Add border (ArUco markers have a black border)
  // 5x5 pattern + 1-pixel border on each side = 7x7 total
  const matrixSize = 7;
  const matrix: number[][] = [];

  for (let i = 0; i < matrixSize; i++) {
    matrix[i] = [];
    for (let j = 0; j < matrixSize; j++) {
      // Border pixels are always black (0)
      if (i === 0 || i === matrixSize - 1 || j === 0 || j === matrixSize - 1) {
        matrix[i][j] = 0;
      } else {
        // Inner 5x5 pattern
        matrix[i][j] = pattern[i - 1][j - 1];
      }
    }
  }

  return {
    id,
    size,
    matrix
  };
}

export function generateArucoSVG(marker: ArucoMarker): string {
  const cellSize = marker.size / marker.matrix.length;

  let svg = `<g class="aruco-marker-${marker.id}">`;

  for (let i = 0; i < marker.matrix.length; i++) {
    for (let j = 0; j < marker.matrix[i].length; j++) {
      const x = j * cellSize;
      const y = i * cellSize;
      const color = marker.matrix[i][j] === 1 ? '#FFFFFF' : '#000000';

      svg += `<rect x="${x}" y="${y}" width="${cellSize}" height="${cellSize}" fill="${color}"/>`;
    }
  }

  svg += '</g>';
  return svg;
}

export function generateArucoCanvas(marker: ArucoMarker, canvas: HTMLCanvasElement): void {
  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  canvas.width = marker.size;
  canvas.height = marker.size;

  const cellSize = marker.size / marker.matrix.length;

  for (let i = 0; i < marker.matrix.length; i++) {
    for (let j = 0; j < marker.matrix[i].length; j++) {
      const x = j * cellSize;
      const y = i * cellSize;

      ctx.fillStyle = marker.matrix[i][j] === 1 ? '#FFFFFF' : '#000000';
      ctx.fillRect(x, y, cellSize, cellSize);
    }
  }
}

// Calculate ArUco marker positions for a card layout
export interface MarkerPosition {
  id: number;
  x: number;
  y: number;
  size: number;
}

export function calculateMarkerPositions(
  cardWidth: number,
  cardHeight: number,
  markerSize: number,
  margin: number = 2
): MarkerPosition[] {
  return [
    // Top-left corner
    { id: 0, x: margin, y: margin, size: markerSize },
    // Top-right corner
    { id: 1, x: cardWidth - markerSize - margin, y: margin, size: markerSize },
    // Bottom-left corner
    { id: 2, x: margin, y: cardHeight - markerSize - margin, size: markerSize },
    // Bottom-right corner
    { id: 3, x: cardWidth - markerSize - margin, y: cardHeight - markerSize - margin, size: markerSize }
  ];
}
