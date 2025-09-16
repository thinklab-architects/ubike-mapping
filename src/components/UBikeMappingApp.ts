import { UBikeApiService } from '@/services/UBikeApiService';
import { MapService } from '@/services/MapService';
import { UBikeStation } from '@/types';

/**
 * Main UBike Mapping Application
 * Coordinates the API service and map service to create a complete bike station mapping application
 */
export class UBikeMappingApp {
  private apiService: UBikeApiService;
  private mapService: MapService;
  private stations: UBikeStation[] = [];
  private isInitialized: boolean = false;

  constructor() {
    this.apiService = new UBikeApiService();
    this.mapService = new MapService();
  }

  /**
   * Initialize the application
   * This is the main entry point that sets up the map and loads initial data
   */
  async initialize(mapContainerId: string): Promise<void> {
    try {
      console.log('Initializing UBike Mapping Application...');
      
      // Initialize the map
      this.mapService.initializeMap(mapContainerId);
      console.log('Map initialized successfully');

      // Load station data
      await this.loadStations();
      console.log(`Loaded ${this.stations.length} stations`);

      // Add stations to map
      this.mapService.addStations(this.stations);
      console.log('Stations added to map');

      // Fit map to show all stations
      this.mapService.fitToStations(this.stations);

      this.isInitialized = true;
      console.log('UBike Mapping Application initialized successfully');
    } catch (error) {
      console.error('Failed to initialize UBike Mapping Application:', error);
      throw error;
    }
  }

  /**
   * Load stations from all available APIs
   */
  async loadStations(): Promise<void> {
    try {
      this.stations = await this.apiService.getAllStations();
      console.log(`Successfully loaded ${this.stations.length} stations from all cities`);
    } catch (error) {
      console.error('Error loading stations:', error);
      throw error;
    }
  }

  /**
   * Refresh station data
   */
  async refreshStations(): Promise<void> {
    if (!this.isInitialized) {
      console.warn('Application not initialized. Call initialize() first.');
      return;
    }

    try {
      // Clear cache to force fresh data
      this.apiService.clearCache();
      
      // Reload stations
      await this.loadStations();
      
      // Update map
      this.mapService.addStations(this.stations);
      
      console.log('Stations refreshed successfully');
    } catch (error) {
      console.error('Error refreshing stations:', error);
    }
  }

  /**
   * Search for stations by name
   */
  searchStations(query: string): UBikeStation[] {
    if (!query.trim()) return this.stations;

    const lowercaseQuery = query.toLowerCase();
    return this.stations.filter(station => 
      station.name.toLowerCase().includes(lowercaseQuery) ||
      (station.nameEn && station.nameEn.toLowerCase().includes(lowercaseQuery)) ||
      (station.address && station.address.toLowerCase().includes(lowercaseQuery)) ||
      (station.district && station.district.toLowerCase().includes(lowercaseQuery))
    );
  }

  /**
   * Find nearest stations to user location
   */
  async findNearestStations(userLat?: number, userLng?: number, limit: number = 5): Promise<UBikeStation[]> {
    if (userLat && userLng) {
      return this.mapService.findNearestStations(userLat, userLng, this.stations, limit);
    }

    // Try to get user location if not provided
    return new Promise((resolve, reject) => {
      if (!navigator.geolocation) {
        reject(new Error('Geolocation is not supported by this browser'));
        return;
      }

      navigator.geolocation.getCurrentPosition(
        position => {
          const { latitude, longitude } = position.coords;
          const nearest = this.mapService.findNearestStations(latitude, longitude, this.stations, limit);
          resolve(nearest);
        },
        error => {
          console.error('Error getting user location:', error);
          reject(error);
        }
      );
    });
  }

  /**
   * Center map on specific station
   */
  focusOnStation(stationId: string): void {
    const station = this.stations.find(s => s.id === stationId);
    if (station) {
      this.mapService.centerMap(station.lat, station.lng, 16);
    }
  }

  /**
   * Get all loaded stations
   */
  getStations(): UBikeStation[] {
    return this.stations;
  }

  /**
   * Get stations by status
   */
  getStationsByStatus(status: string): UBikeStation[] {
    return this.stations.filter(station => station.status === status);
  }

  /**
   * Get application statistics
   */
  getStatistics() {
    const totalStations = this.stations.length;
    const activeStations = this.getStationsByStatus('active').length;
    const totalBikes = this.stations.reduce((sum, station) => sum + station.availableBikes, 0);
    const totalSlots = this.stations.reduce((sum, station) => sum + station.totalSlots, 0);
    const availableSlots = this.stations.reduce((sum, station) => sum + station.availableSlots, 0);

    return {
      totalStations,
      activeStations,
      totalBikes,
      totalSlots,
      availableSlots,
      occupancyRate: totalSlots > 0 ? ((totalSlots - availableSlots) / totalSlots * 100).toFixed(1) : '0'
    };
  }

  /**
   * Destroy the application and clean up resources
   */
  destroy(): void {
    this.mapService.destroy();
    this.apiService.clearCache();
    this.isInitialized = false;
    console.log('UBike Mapping Application destroyed');
  }
}