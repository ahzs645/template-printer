// ArUco marker generation utilities
export interface ArucoMarker {
  id: number;
  size: number;
  matrix: number[][];
}

// ArUco 4x4 dictionary patterns (simplified subset)
const ARUCO_4X4_PATTERNS: { [key: number]: number[][] } = {
  0: [
    [1, 0, 1, 1],
    [1, 1, 0, 0],
    [0, 1, 1, 1],
    [0, 0, 1, 0]
  ],
  1: [
    [1, 0, 0, 1],
    [1, 1, 1, 1],
    [1, 1, 0, 0],
    [0, 1, 0, 0]
  ],
  2: [
    [0, 1, 0, 0],
    [1, 0, 1, 1],
    [1, 1, 1, 0],
    [0, 1, 1, 1]
  ],
  3: [
    [1, 1, 1, 0],
    [0, 0, 1, 1],
    [0, 1, 0, 1],
    [1, 0, 1, 0]
  ]
};

export function generateArucoMarker(id: number, size: number = 100): ArucoMarker {
  const pattern = ARUCO_4X4_PATTERNS[id] || ARUCO_4X4_PATTERNS[0];

  // Add border (ArUco markers have a black border)
  const matrixSize = 6; // 4x4 pattern + 1-pixel border on each side
  const matrix: number[][] = [];

  for (let i = 0; i < matrixSize; i++) {
    matrix[i] = [];
    for (let j = 0; j < matrixSize; j++) {
      // Border pixels are always black (0)
      if (i === 0 || i === matrixSize - 1 || j === 0 || j === matrixSize - 1) {
        matrix[i][j] = 0;
      } else {
        // Inner 4x4 pattern
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
