# UBike Mapping

A comprehensive Taiwan bike sharing (UBike) station mapping application built with TypeScript and Leaflet.js.

## 🚀 Features

- **Real-time Data**: Fetches live UBike station data from multiple Taiwan cities
- **Interactive Map**: Powered by Leaflet.js with custom markers and popups
- **Search & Filter**: Find stations by name, location, or district
- **Geolocation**: Find nearest stations to your current location
- **Statistics**: View system-wide usage statistics
- **Responsive Design**: Works on desktop and mobile devices
- **TypeScript**: Full type safety for better development experience
- **AI-Friendly**: Structured for easy integration with AI coding assistants

## 🏗️ Project Structure

```
src/
├── components/          # Main application components
│   └── UBikeMappingApp.ts
├── services/           # Business logic and API services
│   ├── UBikeApiService.ts
│   └── MapService.ts
├── types/              # TypeScript type definitions
│   └── index.ts
├── utils/              # Utility functions and constants
│   └── constants.ts
└── index.ts            # Main entry point and exports
```

## 🚀 Quick Start

### Installation

```bash
npm install
```

### Development

```bash
npm run dev
```

### Build

```bash
npm run build
```

### Linting

```bash
npm run lint
```

## 📖 Usage

### Basic Setup

```typescript
import { UBikeMappingApp } from './dist/index.js';

const app = new UBikeMappingApp();
await app.initialize('map-container-id');
```

### Advanced Usage

```typescript
import { 
  UBikeMappingApp, 
  UBikeApiService, 
  MapService,
  createUBikeApp 
} from './dist/index.js';

// Quick setup
const app = await createUBikeApp('map');

// Manual setup with custom configuration
const apiService = new UBikeApiService();
const mapService = new MapService({
  center: [25.0330, 121.5654],
  zoom: 12,
  minZoom: 8,
  maxZoom: 18
});

const app = new UBikeMappingApp();
await app.initialize('map');

// Search for stations
const results = app.searchStations('台北車站');

// Find nearest stations
const nearest = await app.findNearestStations(25.0330, 121.5654, 5);

// Get statistics
const stats = app.getStatistics();
console.log(stats);
```

## 🗺️ Data Sources

The application fetches data from official Taiwan UBike APIs:

- **Taipei**: YouBike 2.0 official API
- **New Taipei**: New Taipei City open data platform
- **Taoyuan**: Taoyuan City government API

## 🔧 Configuration

### Map Configuration

```typescript
import { MapConfig } from './dist/index.js';

const config: MapConfig = {
  center: [25.0330, 121.5654], // Taipei center
  zoom: 12,
  minZoom: 8,
  maxZoom: 18,
  tileLayerUrl: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
  attribution: '© OpenStreetMap contributors'
};
```

### VS Code Setup

The project includes VS Code configuration for enhanced development experience:

- IntelliSense for TypeScript
- ESLint integration
- GitHub Copilot optimization
- Debug configurations

## 🤖 AI Assistant Integration

This project is specifically structured to work well with AI coding assistants like GitHub Copilot and ChatGPT Codex:

### Features for AI Assistance

1. **Comprehensive Type Definitions**: All interfaces and types are well-documented
2. **Clear Project Structure**: Logical organization of files and modules
3. **Extensive Documentation**: JSDoc comments throughout the codebase
4. **Index File**: Central export point for easy discovery
5. **VS Code Configuration**: Optimized settings for AI assistance

### Working with AI Assistants

The main `src/index.ts` file serves as a comprehensive guide for AI assistants, including:

- Project overview and architecture
- Quick start examples
- API reference
- Feature descriptions
- Development guidelines

## 📊 API Reference

### UBikeMappingApp

Main application class that coordinates all functionality.

#### Methods

- `initialize(containerId: string)`: Initialize the application
- `loadStations()`: Load station data from APIs
- `refreshStations()`: Refresh station data
- `searchStations(query: string)`: Search stations by text
- `findNearestStations(lat?, lng?, limit?)`: Find nearest stations
- `focusOnStation(stationId: string)`: Center map on specific station
- `getStatistics()`: Get usage statistics
- `destroy()`: Clean up resources

### UBikeApiService

Handles API communication with UBike data sources.

#### Methods

- `getTaipeiStations()`: Get Taipei stations
- `getNewTaipeiStations()`: Get New Taipei stations
- `getTaoyuanStations()`: Get Taoyuan stations
- `getAllStations()`: Get all stations from all cities
- `clearCache()`: Clear cached data

### MapService

Manages Leaflet map operations and markers.

#### Methods

- `initializeMap(containerId: string)`: Initialize the map
- `addStations(stations: UBikeStation[])`: Add stations to map
- `findNearestStations(lat, lng, stations, limit)`: Find nearest stations
- `centerMap(lat, lng, zoom?)`: Center map on coordinates
- `fitToStations(stations)`: Fit map to show all stations
- `destroy()`: Clean up map resources

## 🛠️ Development

### Requirements

- Node.js 18+
- TypeScript 5+
- Modern browser with ES2022 support

### Scripts

- `npm run dev`: Start development server
- `npm run build`: Build for production
- `npm run start`: Start production server
- `npm run lint`: Run ESLint
- `npm run type-check`: Check TypeScript types
- `npm run preview`: Preview production build

### Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Run tests and linting
5. Submit a pull request

## 📄 License

MIT License - see LICENSE file for details

## 🙋‍♂️ Support

For questions or issues, please create an issue in the GitHub repository.

---

Built with ❤️ by ThinkLab Architects