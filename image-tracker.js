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
    this.GRID_SIZE = 10; // The size of the grid cells for analysis

    console.log("ImageTracker initialized.");
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
      // Reset data when disabled
      this.gridData = [];
      if (this.resultsElement) {
        this.resultsElement.textContent = "--";
      }
    }
  }

  /**
   * Fetches and analyzes the legend image to create a color-to-value map.
   * @param {string} legendUrl - The URL of the legend image.
   */
  async parseLegend(legendUrl) {
    console.log(`Parsing legend from: ${legendUrl}`);
    const img = new Image();
    img.crossOrigin = "Anonymous"; // Necessary for canvas security
    img.src = legendUrl;

    return new Promise((resolve, reject) => {
        img.onload = () => {
            const tempCanvas = document.createElement('canvas');
            tempCanvas.width = img.width;
            tempCanvas.height = img.height;
            const tempCtx = tempCanvas.getContext('2d');
            tempCtx.drawImage(img, 0, 0);

            const colors = [];
            // Scan down the vertical center of the legend image
            for (let y = 0; y < img.height; y++) {
                const pixel = tempCtx.getImageData(Math.floor(img.width / 2), y, 1, 1).data;
                const r = pixel[0], g = pixel[1], b = pixel[2], a = pixel[3];

                // Ignore transparent, white, or very light pixels (background)
                if (a > 200 && (r + g + b < 700)) {
                    const hex = `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;
                    if (!colors.includes(hex)) {
                        colors.push(hex);
                    }
                }
            }

            // Map colors to an intensity index (higher index = more intense)
            this.legendColorMap = new Map(colors.map((color, index) => [color, index + 1]));

            if (this.legendColorMap.size === 0) {
                console.warn("Could not extract any colors from the legend.");
                reject("No colors found in legend.");
            } else {
                console.log("Legend parsed successfully. Color map:", this.legendColorMap);
                resolve(this.legendColorMap);
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
   * @param {number} r - Red value.
   * @param {number} g - Green value.
   * @param {number} b - Blue value.
   * @returns {string|null} The hex code of the closest color or null.
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

    // Only return a match if it's reasonably close (e.g., not a map feature)
    return minDistance < 100 ? closestColor : null;
  }

  /**
   * Analyzes a single frame, creates a grid, and triggers motion tracking.
   * @param {HTMLImageElement} imageElement - The image of the current frame.
   * @param {string} timestamp - The ISO timestamp of the frame.
   */
  analyzeFrame(imageElement, timestamp) {
    if (!this.isEnabled || !this.legendColorMap) {
      return;
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
            let totalIntensity = 0;
            let pixelCount = 0;

            for (let y = 0; y < this.GRID_SIZE; y++) {
                for (let x = 0; x < this.GRID_SIZE; x++) {
                    const i = ((gridY * this.GRID_SIZE + y) * this.canvas.width + (gridX * this.GRID_SIZE + x)) * 4;
                    if (imageData[i+3] > 128) { // Check alpha
                        const closestColorHex = this.findClosestLegendColor(imageData[i], imageData[i+1], imageData[i+2]);
                        if (closestColorHex) {
                            totalIntensity += this.legendColorMap.get(closestColorHex);
                            pixelCount++;
                        }
                    }
                }
            }

            if (pixelCount > (this.GRID_SIZE * this.GRID_SIZE) / 10) { // Require at least 10% of pixels to be rain
                currentGrid[gridY][gridX] = totalIntensity / pixelCount;
            }
        }
    }

    const lastGridData = this.gridData.length > 0 ? this.gridData[this.gridData.length - 1] : null;
    const newGridData = { timestamp: timestamp, grid: currentGrid };

    if (lastGridData && lastGridData.timestamp !== newGridData.timestamp) {
        this.trackMovement(lastGridData, newGridData);
    }

    this.gridData.push(newGridData);
    if (this.gridData.length > 10) { // Keep a limited history
        this.gridData.shift();
    }
  }

  /**
   * Tracks movement by comparing two grids.
   * @param {object} gridData1 - The older grid data object.
   * @param {object} gridData2 - The newer grid data object.
   */
  trackMovement(gridData1, gridData2) {
    const grid1 = gridData1.grid;
    const grid2 = gridData2.grid;
    const rows = grid1.length;
    const cols = grid1[0].length;

    const SEARCH_RADIUS = 5; // Search in a 5-cell radius
    let totalDx = 0, totalDy = 0, vectorCount = 0;

    for (let y = 0; y < rows; y++) {
        for (let x = 0; x < cols; x++) {
            if (grid1[y][x] > 0.1) { // Only track blocks with some rain
                let bestMatch = { x: -1, y: -1, error: Infinity };

                for (let searchY = -SEARCH_RADIUS; searchY <= SEARCH_RADIUS; searchY++) {
                    for (let searchX = -SEARCH_RADIUS; searchX <= SEARCH_RADIUS; searchX++) {
                        const newY = y + searchY, newX = x + searchX;
                        if (newY >= 0 && newY < rows && newX >= 0 && newX < cols) {
                            const error = Math.abs(grid1[y][x] - grid2[newY][newX]);
                            if (error < bestMatch.error) {
                                bestMatch = { x: newX, y: newY, error: error };
                            }
                        }
                    }
                }

                if (bestMatch.error < 0.5) { // If a reasonable match was found
                    totalDx += bestMatch.x - x;
                    totalDy += bestMatch.y - y;
                    vectorCount++;
                }
            }
        }
    }

    if (vectorCount > 10) { // Require a minimum number of vectors for a stable result
        const avgDx = totalDx / vectorCount;
        const avgDy = totalDy / vectorCount;
        this.calculateSpeed(avgDx, avgDy, gridData1.timestamp, gridData2.timestamp);
    } else if (this.resultsElement) {
        this.resultsElement.textContent = "Bewegung unklar";
    }
  }

  /**
   * Calculates speed from displacement and time difference.
   * @param {number} dxCells - Average displacement in X (grid cells).
   * @param {number} dyCells - Average displacement in Y (grid cells).
   * @param {string} time1 - ISO timestamp of the first frame.
   * @param {string} time2 - ISO timestamp of the second frame.
   */
  calculateSpeed(dxCells, dyCells, time1, time2) {
    const dxPixels = dxCells * this.GRID_SIZE;
    const dyPixels = dyCells * this.GRID_SIZE;
    const pixelDistance = Math.sqrt(dxPixels*dxPixels + dyPixels*dyPixels);

    if (pixelDistance < 1) {
        if (this.resultsElement) this.resultsElement.textContent = "Stationär";
        return;
    }

    // Use Leaflet to convert pixel distance to real-world meters
    const mapCenter = this.map.getCenter();
    const point1 = this.map.latLngToContainerPoint(mapCenter);
    const point2 = L.point(point1.x + dxPixels, point1.y + dyPixels);
    const newLatLng = this.map.containerPointToLatLng(point2);
    const realWorldDistanceMeters = mapCenter.distanceTo(newLatLng);

    const timeDiffSeconds = (new Date(time2) - new Date(time1)) / 1000;
    if (timeDiffSeconds <= 0) return;

    const speedMps = realWorldDistanceMeters / timeDiffSeconds; // meters per second
    const speedKph = speedMps * 3.6; // km per hour

    if (this.resultsElement) {
        this.resultsElement.textContent = `~ ${speedKph.toFixed(1)} km/h`;
    }
    console.log(`Calculated speed: ${speedKph.toFixed(1)} km/h`);
  }
}
