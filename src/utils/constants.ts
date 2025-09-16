import { MapConfig } from '@/types';

/**
 * Default map configuration for Taiwan
 */
export const DEFAULT_MAP_CONFIG: MapConfig = {
  center: [25.0330, 121.5654], // Taipei City Center
  zoom: 12,
  minZoom: 8,
  maxZoom: 18,
  tileLayerUrl: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
  attribution: '© OpenStreetMap contributors'
};

/**
 * U-Bike API endpoints
 */
export const API_ENDPOINTS = {
  TAIPEI: 'https://tcgbusfs.blob.core.windows.net/dotapp/youbike/v2/youbike_immediate.json',
  NEW_TAIPEI: 'https://data.ntpc.gov.tw/api/datasets/71CD1490-A2DF-4198-BEF1-318479775E8A/json',
  TAOYUAN: 'https://data.tycg.gov.tw/api/v1/rest/datastore/a1b4714b-3b75-4ff8-a8f2-cc377e4eaa0f'
};

/**
 * Station status colors for map markers
 */
export const STATUS_COLORS = {
  active: '#28a745',      // Green
  inactive: '#6c757d',    // Gray
  maintenance: '#ffc107', // Yellow
  coming_soon: '#17a2b8'  // Blue
} as const;

/**
 * Utility function to format station name
 */
export const formatStationName = (name: string): string => {
  return name.replace(/YouBike2\.0_/, '').trim();
};

/**
 * Utility function to calculate distance between two coordinates
 */
export const calculateDistance = (
  lat1: number, 
  lng1: number, 
  lat2: number, 
  lng2: number
): number => {
  const R = 6371; // Earth's radius in kilometers
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a = 
    Math.sin(dLat/2) * Math.sin(dLat/2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * 
    Math.sin(dLng/2) * Math.sin(dLng/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  return R * c;
};