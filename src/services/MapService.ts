import * as L from 'leaflet';
import { UBikeStation, MapConfig } from '@/types';
import { DEFAULT_MAP_CONFIG, STATUS_COLORS, calculateDistance } from '@/utils/constants';

/**
 * Map Service
 * Handles Leaflet map initialization and station marker management
 */
export class MapService {
  private map: L.Map | null = null;
  private stationMarkers: L.LayerGroup = new L.LayerGroup();
  private config: MapConfig;

  constructor(config: MapConfig = DEFAULT_MAP_CONFIG) {
    this.config = config;
  }

  /**
   * Initialize the map
   */
  initializeMap(containerId: string): L.Map {
    if (this.map) {
      this.map.remove();
    }

    this.map = L.map(containerId, {
      center: this.config.center,
      zoom: this.config.zoom,
      minZoom: this.config.minZoom,
      maxZoom: this.config.maxZoom
    });

    // Add tile layer
    L.tileLayer(this.config.tileLayerUrl, {
      attribution: this.config.attribution
    }).addTo(this.map);

    // Add marker layer group
    this.stationMarkers.addTo(this.map);

    return this.map;
  }

  /**
   * Add stations to the map
   */
  addStations(stations: UBikeStation[]): void {
    if (!this.map) return;

    // Clear existing markers
    this.stationMarkers.clearLayers();

    stations.forEach(station => {
      const marker = this.createStationMarker(station);
      this.stationMarkers.addLayer(marker);
    });
  }

  /**
   * Create a marker for a station
   */
  private createStationMarker(station: UBikeStation): L.CircleMarker {
    const color = STATUS_COLORS[station.status];
    
    const marker = L.circleMarker([station.lat, station.lng], {
      radius: 8,
      fillColor: color,
      color: '#fff',
      weight: 2,
      opacity: 1,
      fillOpacity: 0.8
    });

    // Create popup content
    const popupContent = this.createPopupContent(station);
    marker.bindPopup(popupContent);

    return marker;
  }

  /**
   * Create popup content for a station
   */
  private createPopupContent(station: UBikeStation): string {
    return `
      <div class="station-popup">
        <h3>${station.name}</h3>
        ${station.nameEn ? `<p class="name-en">${station.nameEn}</p>` : ''}
        <div class="station-info">
          <p><strong>Available Bikes:</strong> ${station.availableBikes}</p>
          <p><strong>Available Slots:</strong> ${station.availableSlots}</p>
          <p><strong>Total Slots:</strong> ${station.totalSlots}</p>
          <p><strong>Status:</strong> <span class="status ${station.status}">${station.status}</span></p>
        </div>
        ${station.address ? `<p class="address">${station.address}</p>` : ''}
        <p class="last-update">Last updated: ${station.lastUpdate.toLocaleString()}</p>
      </div>
    `;
  }

  /**
   * Find nearest stations to a given coordinate
   */
  findNearestStations(lat: number, lng: number, stations: UBikeStation[], limit: number = 5): UBikeStation[] {
    return stations
      .map(station => ({
        ...station,
        distance: calculateDistance(lat, lng, station.lat, station.lng)
      }))
      .sort((a, b) => a.distance - b.distance)
      .slice(0, limit);
  }

  /**
   * Center map on specific coordinates
   */
  centerMap(lat: number, lng: number, zoom?: number): void {
    if (!this.map) return;
    this.map.setView([lat, lng], zoom || this.config.zoom);
  }

  /**
   * Fit map to show all stations
   */
  fitToStations(stations: UBikeStation[]): void {
    if (!this.map || stations.length === 0) return;

    const group = new L.FeatureGroup(
      stations.map(station => 
        L.marker([station.lat, station.lng])
      )
    );

    this.map.fitBounds(group.getBounds().pad(0.1));
  }

  /**
   * Get current map instance
   */
  getMap(): L.Map | null {
    return this.map;
  }

  /**
   * Destroy the map
   */
  destroy(): void {
    if (this.map) {
      this.map.remove();
      this.map = null;
    }
  }
}