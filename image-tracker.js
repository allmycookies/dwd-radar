/**
 * Helper function to calculate the Euclidean distance between two RGB colors.
 * @param {number[]} rgb1 - Array [r, g, b].
 * @param {number[]} rgb2 - Array [r, g, b].
 * @returns {number} The distance between the two colors.
 */
function color_distance(rgb1, rgb2) {
    let r_dist = Math.pow(rgb1[0] - rgb2[0], 2);
    let g_dist = Math.pow(rgb1[1] - rgb2[1], 2);
    let b_dist = Math.pow(rgb1[2] - rgb2[2], 2);
    return Math.sqrt(r_dist + g_dist + b_dist);
}


/**
 * @class ImageTracker
 * This class is responsible for analyzing radar images to track precipitation movement.
 */
class ImageTracker {
  /**
   * @param {object} options - Configuration options for the tracker.
   * @param {HTMLCanvasElement} options.canvas - The canvas element for image analysis.
   * @param {object} options.map - The Leaflet map instance.
   * @param {HTMLElement} options.resultsElement - The DOM element to display results.
   */
  constructor(options) {
    this.canvas = options.canvas;
    this.ctx = this.canvas.getContext('2d', { willReadFrequently: true });
    this.map = options.map;
    this.resultsElement = options.resultsElement;

    this.legendColorMap = null;
    this.gridData = []; // Stores analysis data for recent frames
    this.isEnabled = false;
    this.GRID_SIZE = 10;
    this.selectedColor = null;

    console.log("ImageTracker initialized.");
  }

  /**
   * Stores the color selected by the user.
   * @param {string} hexColor - The hex code of the color to track.
   */
  setSelectedColor(hexColor) {
    this.selectedColor = hexColor;
    // Reset data when selection changes
    this.gridData = [];
    if (this.resultsElement) {
        this.resultsElement.textContent = "Warte auf Daten...";
    }
  }

  /**
   * Starts or stops the analysis process.
   * @param {boolean} enabled - True to start, false to stop.
   */
  setAnalysisEnabled(enabled) {
    this.isEnabled = enabled;
    if (enabled) {
      console.log("Image analysis enabled.");
    } else {
      console.log("Image analysis disabled.");
      this.gridData = [];
      if (this.resultsElement) {
        this.resultsElement.textContent = "--";
      }
    }
  }

  /**
   * Fetches and analyzes the legend image to create a color-to-value map.
   */
  async parseLegend(legendUrl) {
    console.log(`Parsing legend from: ${legendUrl}`);
    const img = new Image();
    img.crossOrigin = "Anonymous";
    img.src = legendUrl;

    return new Promise((resolve, reject) => {
        img.onload = () => {
            const tempCanvas = document.createElement('canvas');
            tempCanvas.width = img.width;
            tempCanvas.height = img.height;
            const tempCtx = tempCanvas.getContext('2d', { willReadFrequently: true });
            tempCtx.drawImage(img, 0, 0);

            const colors = [];
            const colorPositions = new Map();

            const startX = Math.floor(img.width * 0.25);
            const endX = Math.floor(img.width * 0.75);

            for (let y = 0; y < img.height; y++) {
                for (let x = startX; x < endX; x++) {
                    const pixel = tempCtx.getImageData(x, y, 1, 1).data;
                    const r = pixel[0], g = pixel[1], b = pixel[2], a = pixel[3];
                    const isGrey = Math.abs(r - g) < 10 && Math.abs(g - b) < 10;
                    if (a > 200 && (r + g + b < 700) && !isGrey) {
                        const hex = `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;
                        if (!colorPositions.has(hex)) {
                            colors.push(hex);
                            colorPositions.set(hex, y);
                            break;
                        }
                    }
                }
            }

            colors.sort((a, b) => colorPositions.get(a) - colorPositions.get(b));
            this.legendColorMap = new Map(colors.map((color, index) => [color, index + 1]));

            if (this.legendColorMap.size === 0) {
                console.error("Could not extract any valid colors from the legend.");
                reject("No colors found in legend.");
            } else {
                console.log("Legend parsed successfully. Color map:", this.legendColorMap);
                resolve({ map: this.legendColorMap, list: colors });
            }
        };
        img.onerror = () => {
            console.error("Failed to load legend image.");
            reject("Failed to load legend image.");
        };
    });
  }

  /**
   * Finds the closest color in the legend to a given RGB color.
   */
  findClosestLegendColor(r, g, b) {
    if (!this.legendColorMap || this.legendColorMap.size === 0) return null;
    let minDistance = Infinity;
    let closestColor = null;
    for (const hex of this.legendColorMap.keys()) {
        const r_leg = parseInt(hex.substring(1, 3), 16);
        const g_leg = parseInt(hex.substring(3, 5), 16);
        const b_leg = parseInt(hex.substring(5, 7), 16);
        const distance = color_distance([r, g, b], [r_leg, g_leg, b_leg]);
        if (distance < minDistance) {
            minDistance = distance;
            closestColor = hex;
        }
    }
    return minDistance < 100 ? closestColor : null;
  }

  /**
   * Analyzes a single frame, creating a grid based on the selected color.
   */
  analyzeFrame(imageElement, timestamp) {
    if (!this.isEnabled || !this.selectedColor) {
      return; // Stop if analysis is off or no color is selected
    }

    this.canvas.width = imageElement.naturalWidth;
    this.canvas.height = imageElement.naturalHeight;
    this.ctx.drawImage(imageElement, 0, 0);
    const imageData = this.ctx.getImageData(0, 0, this.canvas.width, this.canvas.height).data;

    const cols = Math.floor(this.canvas.width / this.GRID_SIZE);
    const rows = Math.floor(this.canvas.height / this.GRID_SIZE);
    const currentGrid = Array(rows).fill(null).map(() => Array(cols).fill(0));

    for (let gridY = 0; gridY < rows; gridY++) {
        for (let gridX = 0; gridX < cols; gridX++) {
            let targetColorPixels = 0;
            for (let y = 0; y < this.GRID_SIZE; y++) {
                for (let x = 0; x < this.GRID_SIZE; x++) {
                    const i = ((gridY * this.GRID_SIZE + y) * this.canvas.width + (gridX * this.GRID_SIZE + x)) * 4;
                    if (imageData[i+3] > 128) {
                        const closestColorHex = this.findClosestLegendColor(imageData[i], imageData[i+1], imageData[i+2]);
                        if (closestColorHex === this.selectedColor) {
                            targetColorPixels++;
                        }
                    }
                }
            }
            if (targetColorPixels > (this.GRID_SIZE * this.GRID_SIZE) / 10) {
                currentGrid[gridY][gridX] = 1; // Mark cell as containing the target color
            }
        }
    }

    const lastGridData = this.gridData.length > 0 ? this.gridData[this.gridData.length - 1] : null;
    const newGridData = { timestamp: timestamp, grid: currentGrid };

    if (lastGridData && lastGridData.timestamp !== newGridData.timestamp) {
        this.trackMovementFromCenter(lastGridData, newGridData);
    }

    this.gridData.push(newGridData);
    if (this.gridData.length > 10) { this.gridData.shift(); }
  }

  /**
   * Tracks movement of the selected color from the map's center.
   */
  trackMovementFromCenter(gridData1, gridData2) {
    const grid1 = gridData1.grid;
    const grid2 = gridData2.grid;
    const rows = grid1.length;
    const cols = grid1[0].length;

    const mapSize = this.map.getSize();
    const crosshairPixelX = mapSize.x / 2;
    const crosshairPixelY = mapSize.y / 2;
    const startX = Math.floor(crosshairPixelX / this.GRID_SIZE);
    const startY = Math.floor(crosshairPixelY / this.GRID_SIZE);

    if (grid1[startY] && grid1[startY][startX] === 1) {
        const SEARCH_RADIUS = 8;
        let bestMatch = { x: -1, y: -1, found: false };
        let minDistanceSq = Infinity;

        for (let sY = -SEARCH_RADIUS; sY <= SEARCH_RADIUS; sY++) {
            for (let sX = -SEARCH_RADIUS; sX <= SEARCH_RADIUS; sX++) {
                const newY = startY + sY;
                const newX = startX + sX;
                if (newY >= 0 && newY < rows && newX >= 0 && newX < cols && grid2[newY][newX] === 1) {
                    const distanceSq = sX * sX + sY * sY;
                    if (distanceSq < minDistanceSq) {
                        minDistanceSq = distanceSq;
                        bestMatch = { x: newX, y: newY, found: true };
                    }
                }
            }
        }

        if (bestMatch.found) {
            const dxCells = bestMatch.x - startX;
            const dyCells = bestMatch.y - startY;
            this.calculateSpeed(dxCells, dyCells, gridData1.timestamp, gridData2.timestamp);
        } else {
            if (this.resultsElement) this.resultsElement.textContent = "Bewegung unklar";
        }
    } else {
        if (this.resultsElement) this.resultsElement.textContent = "Keine Zieldaten am Fadenkreuz";
    }
  }

  /**
   * Calculates speed from displacement and time difference.
   */
  calculateSpeed(dxCells, dyCells, time1, time2) {
    if (dxCells === 0 && dyCells === 0) {
        if (this.resultsElement) this.resultsElement.textContent = "Stationär";
        return;
    }

    const dxPixels = dxCells * this.GRID_SIZE;
    const dyPixels = dyCells * this.GRID_SIZE;

    const mapCenter = this.map.getCenter();
    const point1 = this.map.latLngToContainerPoint(mapCenter);
    const point2 = L.point(point1.x + dxPixels, point1.y + dyPixels);
    const newLatLng = this.map.containerPointToLatLng(point2);
    const realWorldDistanceMeters = mapCenter.distanceTo(newLatLng);

    const timeDiffSeconds = (new Date(time2) - new Date(time1)) / 1000;
    if (timeDiffSeconds <= 0) return;

    const speedMps = realWorldDistanceMeters / timeDiffSeconds;
    const speedKph = speedMps * 3.6;

    if (this.resultsElement) {
        this.resultsElement.textContent = `~ ${speedKph.toFixed(1)} km/h`;
    }
    console.log(`Calculated speed: ${speedKph.toFixed(1)} km/h`);
  }
}
