import type { ApiRequest, ApiResponse } from './types.js';

// Simple 3-minute cache for weather
let cachedWeatherData: any = null;
let weatherCacheTimestamp = 0;
const WEATHER_CACHE_DURATION = 3 * 60 * 1000;

export default async function handler(req: ApiRequest, res: ApiResponse) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ success: false, error: 'Method not allowed' });
  }

  try {
    const now = Date.now();
    if (cachedWeatherData && (now - weatherCacheTimestamp < WEATHER_CACHE_DURATION)) {
      return res.json({ success: true, data: cachedWeatherData });
    }

    const latitude = 50.2333;
    const longitude = -5.2333;
    const url = `https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}&current=temperature_2m,relative_humidity_2m,apparent_temperature,precipitation,rain,weather_code,wind_speed_10m&hourly=temperature_2m,weather_code,precipitation_probability,wind_speed_10m&daily=weather_code,temperature_2m_max,temperature_2m_min,sunrise,sunset&timezone=Europe/London&wind_speed_unit=mph`;

    const response = await fetch(url);
    if (!response.ok) throw new Error(`Open-Meteo status: ${response.status}`);

    const data = await response.json();
    cachedWeatherData = data;
    weatherCacheTimestamp = now;

    res.json({ success: true, data });
  } catch (error: any) {
    console.error("Error in /api/weather:", error);
    if (cachedWeatherData) {
      return res.json({ success: true, data: cachedWeatherData });
    }
    res.status(500).json({ success: false, error: error.message });
  }
}
