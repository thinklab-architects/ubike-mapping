import { UBikeStation, UBikeApiResponse, StationStatus } from '@/types';
import { API_ENDPOINTS, formatStationName } from '@/utils/constants';

/**
 * U-Bike API Service
 * Handles fetching and processing of U-Bike station data
 */
export class UBikeApiService {
  private cache: Map<string, { data: UBikeStation[], timestamp: number }> = new Map();
  private readonly CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

  /**
   * Fetch stations data for Taipei
   */
  async getTaipeiStations(): Promise<UBikeStation[]> {
    return this.fetchStations('taipei', API_ENDPOINTS.TAIPEI);
  }

  /**
   * Fetch stations data for New Taipei
   */
  async getNewTaipeiStations(): Promise<UBikeStation[]> {
    return this.fetchStations('new_taipei', API_ENDPOINTS.NEW_TAIPEI);
  }

  /**
   * Fetch stations data for Taoyuan
   */
  async getTaoyuanStations(): Promise<UBikeStation[]> {
    return this.fetchStations('taoyuan', API_ENDPOINTS.TAOYUAN);
  }

  /**
   * Fetch all stations from all cities
   */
  async getAllStations(): Promise<UBikeStation[]> {
    const [taipei, newTaipei, taoyuan] = await Promise.allSettled([
      this.getTaipeiStations(),
      this.getNewTaipeiStations(),
      this.getTaoyuanStations()
    ]);

    const allStations: UBikeStation[] = [];
    
    if (taipei.status === 'fulfilled') allStations.push(...taipei.value);
    if (newTaipei.status === 'fulfilled') allStations.push(...newTaipei.value);
    if (taoyuan.status === 'fulfilled') allStations.push(...taoyuan.value);

    return allStations;
  }

  /**
   * Generic fetch method with caching
   */
  private async fetchStations(city: string, url: string): Promise<UBikeStation[]> {
    // Check cache first
    const cached = this.cache.get(city);
    if (cached && Date.now() - cached.timestamp < this.CACHE_DURATION) {
      return cached.data;
    }

    try {
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      const stations = this.transformApiData(data, city);
      
      // Update cache
      this.cache.set(city, { data: stations, timestamp: Date.now() });
      
      return stations;
    } catch (error) {
      console.error(`Error fetching ${city} stations:`, error);
      return [];
    }
  }

  /**
   * Transform API data to our standard format
   */
  private transformApiData(data: any, city: string): UBikeStation[] {
    if (!Array.isArray(data)) {
      return [];
    }

    return data.map((item: any) => ({
      id: item.sno || item.id || `${city}_${Math.random()}`,
      name: formatStationName(item.sna || item.name || 'Unknown Station'),
      nameEn: item.snaen || item.name_en,
      lat: parseFloat(item.lat || item.latitude || '0'),
      lng: parseFloat(item.lng || item.longitude || '0'),
      totalSlots: parseInt(item.tot || item.total || '0'),
      availableBikes: parseInt(item.sbi || item.available_bikes || '0'),
      availableSlots: parseInt(item.bemp || item.available_slots || '0'),
      status: this.parseStatus(item.act || item.status || '1'),
      lastUpdate: new Date(item.mday || item.updated_at || Date.now()),
      district: item.sarea || item.district,
      address: item.ar || item.address
    }));
  }

  /**
   * Parse station status from API data
   */
  private parseStatus(status: string): StationStatus {
    switch (status) {
      case '1':
      case 'active':
        return StationStatus.ACTIVE;
      case '0':
      case 'inactive':
        return StationStatus.INACTIVE;
      case '2':
      case 'maintenance':
        return StationStatus.MAINTENANCE;
      default:
        return StationStatus.ACTIVE;
    }
  }

  /**
   * Clear cache manually
   */
  clearCache(): void {
    this.cache.clear();
  }
}