# DWD-WMS Weather Map Viewer

## Overview

This is a web-based application for visualizing weather data from the German Weather Service (DWD) on an interactive map. It fetches data from the DWD's Web Map Service (WMS) and allows users to view and animate various weather layers, such as radar imagery and temperature forecasts.

The application is built with vanilla JavaScript, Leaflet.js for the interactive map, and Bootstrap for the user interface.

## Features

- **Interactive Map:** Pan and zoom using a Leaflet map with an OpenStreetMap base layer.
- **DWD Weather Layers:** Select from a list of available time-enabled weather layers from the DWD WMS, including:
  - Radar imagery
  - Perceived temperature
  - Satellite data
  - Weather warnings
- **Time-Series Animation:**
  - Select a custom start and end time.
  - Animate the selected weather layer over the chosen time period.
  - Controls to play, pause, resume, and stop the animation.
  - A time slider to manually scrub through the animation frames.
- **Map Controls:**
  - **Fullscreen Mode:** Toggle fullscreen view with the F2 key.
  - **Darken Base Map:** Dim the OpenStreetMap layer to better see the weather overlay.
  - **Overlay Transparency:** Make the DWD layer semi-transparent.
  - **Custom Map Height:** Adjust the height of the map view.
- **Location Search:**
  - Geocode an address to center the map on a specific location.
  - Set a custom zoom level.
- **User Settings:**
  - Automatically saves your settings (last used layer, map size, location, etc.) to your browser's `localStorage`.
- **Connection Diagnostics:**
  - A connection test utility measures ping and download speed to the DWD server.
- **Auto-Refresh:** Automatically refreshes the data at an interval corresponding to the selected layer's update frequency.

## How to Run

To run this application, you need a web server with PHP support.

1.  Clone or download the repository.
2.  Place the files on a PHP-enabled web server (e.g., Apache with `mod_php`, or run `php -S localhost:8000`).
3.  Open `index.html` in your web browser.

The `proxy.php` script is required to bypass browser CORS (Cross-Origin Resource Sharing) restrictions when fetching data from the DWD server.

### `index_noProxy.html`

This repository also includes `index_noProxy.html`, a version that attempts to connect to the DWD server directly without a proxy. This file is intended for local use or specific environments where CORS is not an issue (e.g., if you use a browser extension to disable CORS). It will likely not work if opened directly from the filesystem or on a standard web server due to security restrictions in modern browsers.

## Technical Details

- **Frontend:** HTML, CSS, JavaScript
- **Libraries:**
  - [Leaflet.js](https://leafletjs.com/): Interactive map library.
  - [Bootstrap](https://getbootstrap.com/): UI framework.
- **Backend:** A simple PHP proxy (`proxy.php`) is used to handle requests to the DWD server.
- **Data Source:** [DWD GeoServer WMS](https://maps.dwd.de/geoserver/web/). The application fetches a list of available layers by parsing the `GetCapabilities` document.

## File Descriptions

- `index.html`: The main application file. Requires the PHP proxy to function correctly.
- `proxy.php`: A PHP script that securely forwards requests to the DWD WMS server, adding the necessary CORS headers.
- `index_noProxy.html`: A standalone version for local use that does not use the PHP proxy.
- `saveSettings.php`: An unused script, likely a remnant from a previous server-side settings implementation.
- `LICENSE`: The project's license file.

## Credits and License

- **Code and Logic:** The application logic and code were developed by Denys Safra.
- **Data:** Weather data and WMS layers are provided by the **Deutscher Wetterdienst (DWD)**. © DWD.
- **Map Tiles:** Base map tiles are from **OpenStreetMap**. © OpenStreetMap contributors.
- **Libraries:** This project uses Leaflet.js and Bootstrap.

This project is distributed under the license specified in the `LICENSE` file.
