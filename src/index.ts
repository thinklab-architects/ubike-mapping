/**
 * UBike Mapping Application - Main Entry Point
 * 
 * This is the main index file that exports all the essential components
 * for the UBike mapping application. This file serves as the primary
 * interface for AI assistants (like ChatGPT Codex) to understand the
 * project structure and available APIs.
 * 
 * @author ThinkLab Architects
 * @version 1.0.0
 */

// Main Application Component
export { UBikeMappingApp } from '@/components/UBikeMappingApp';

// Services
export { UBikeApiService } from '@/services/UBikeApiService';
export { MapService } from '@/services/MapService';

// Types and Interfaces
export type {
  UBikeStation,
  StationStatus,
  MapConfig,
  UBikeApiResponse
} from '@/types';

// Utilities and Constants
export {
  DEFAULT_MAP_CONFIG,
  API_ENDPOINTS,
  STATUS_COLORS,
  formatStationName,
  calculateDistance
} from '@/utils/constants';

// Import for internal use
import { UBikeMappingApp } from '@/components/UBikeMappingApp';

/**
 * PROJECT STRUCTURE OVERVIEW
 * =========================
 * 
 * This project is organized as follows:
 * 
 * /src
 *   /components    - Main application components
 *     UBikeMappingApp.ts - Main application class
 *   
 *   /services      - Business logic and API services
 *     UBikeApiService.ts - Handles API calls to UBike data sources
 *     MapService.ts      - Manages Leaflet map operations
 *   
 *   /types         - TypeScript type definitions
 *     index.ts     - All interface and type definitions
 *   
 *   /utils         - Utility functions and constants
 *     constants.ts - Configuration constants and helper functions
 * 
 * QUICK START GUIDE
 * ================
 * 
 * To use this application:
 * 
 * 1. Install dependencies: npm install
 * 2. Build the project: npm run build
 * 3. Include in HTML and initialize:
 * 
 * ```html
 * <div id="map" style="height: 500px;"></div>
 * <script type="module">
 *   import { UBikeMappingApp } from './dist/index.js';
 *   
 *   const app = new UBikeMappingApp();
 *   app.initialize('map');
 * </script>
 * ```
 * 
 * API REFERENCE
 * =============
 * 
 * Main Classes:
 * - UBikeMappingApp: Main application coordinator
 * - UBikeApiService: Fetches data from Taiwan UBike APIs
 * - MapService: Manages Leaflet map and markers
 * 
 * Key Interfaces:
 * - UBikeStation: Represents a bike station
 * - MapConfig: Map configuration options
 * - UBikeApiResponse: API response format
 * 
 * FEATURES
 * ========
 * 
 * - Real-time UBike station data from multiple Taiwan cities
 * - Interactive Leaflet.js map with custom markers
 * - Station search and filtering capabilities
 * - Nearest station finder using geolocation
 * - Responsive design and mobile-friendly
 * - TypeScript for better code intelligence
 * - Comprehensive caching for performance
 * 
 * DEVELOPMENT
 * ===========
 * 
 * npm run dev      - Start development server
 * npm run build    - Build for production
 * npm run lint     - Run ESLint
 * npm run type-check - Check TypeScript types
 */

// Quick initialization function for easy setup
export async function createUBikeApp(containerId: string): Promise<UBikeMappingApp> {
  const app = new UBikeMappingApp();
  await app.initialize(containerId);
  return app;
}

// Version information
export const VERSION = '1.0.0';
export const BUILD_DATE = new Date().toISOString();

// Development utilities
export const DEV_UTILS = {
  /**
   * Log application statistics to console
   */
  logStats: (app: UBikeMappingApp) => {
    console.table(app.getStatistics());
  },
  
  /**
   * Export stations data as JSON
   */
  exportStations: (app: UBikeMappingApp) => {
    const data = app.getStations();
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `ubike-stations-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }
};

// Default export for CommonJS compatibility
import { UBikeApiService } from '@/services/UBikeApiService';
import { MapService } from '@/services/MapService';

export default {
  UBikeMappingApp,
  UBikeApiService,
  MapService,
  createUBikeApp,
  VERSION,
  BUILD_DATE
};