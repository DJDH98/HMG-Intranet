export interface DockerService {
  id: string;
  name: string;
  port: number;
  iconName: string;
  description: string;
  category: "media" | "download" | "utility" | "other";
  isActive: boolean;
  isCustom?: boolean;
}

export interface HourlyForecast {
  time: string;
  temperature: number;
  weatherCode: number;
  precipProb: number;
}

export interface WeatherWarning {
  severity: "info" | "yellow" | "amber" | "red";
  title: string;
  description: string;
}

export interface WeatherData {
  temperature: number;
  apparentTemperature?: number;
  humidity?: number;
  precipitation?: number;
  weatherCode: number;
  windSpeed?: number;
  maxTemp: number;
  minTemp: number;
  sunrise?: string;
  sunset?: string;
  isLoaded: boolean;
  hourly?: HourlyForecast[];
  warnings?: WeatherWarning[];
}

export interface NewsArticle {
  title: string;
  summary: string;
  source: string;
  url: string;
  category: string;
}
