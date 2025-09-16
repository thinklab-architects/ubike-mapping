/**
 * U-Bike Station Interface
 * Represents a bike sharing station with location and status information
 */
export interface UBikeStation {
  /** Unique station identifier */
  id: string;
  /** Station name in Chinese */
  name: string;
  /** Station name in English */
  nameEn?: string;
  /** Latitude coordinate */
  lat: number;
  /** Longitude coordinate */
  lng: number;
  /** Total number of bike slots */
  totalSlots: number;
  /** Number of available bikes */
  availableBikes: number;
  /** Number of available parking slots */
  availableSlots: number;
  /** Station status */
  status: StationStatus;
  /** Last update timestamp */
  lastUpdate: Date;
  /** District/Area information */
  district?: string;
  /** Detailed address */
  address?: string;
}

/**
 * Station Status Enum
 */
export enum StationStatus {
  ACTIVE = 'active',
  INACTIVE = 'inactive',
  MAINTENANCE = 'maintenance',
  COMING_SOON = 'coming_soon'
}

/**
 * Map Configuration Interface
 */
export interface MapConfig {
  /** Default center coordinates [lat, lng] */
  center: [number, number];
  /** Default zoom level */
  zoom: number;
  /** Minimum zoom level */
  minZoom: number;
  /** Maximum zoom level */
  maxZoom: number;
  /** Map tile layer URL */
  tileLayerUrl: string;
  /** Tile layer attribution */
  attribution: string;
}

/**
 * API Response Interface for U-Bike data
 */
export interface UBikeApiResponse {
  /** Response status */
  success: boolean;
  /** Array of station data */
  data: UBikeStation[];
  /** Response timestamp */
  timestamp: string;
  /** Total count of stations */
  totalCount: number;
  /** Error message if any */
  error?: string;
}