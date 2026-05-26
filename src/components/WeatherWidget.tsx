import { useEffect, useState } from "react";
import { 
  Sun, 
  CloudSun, 
  Cloud, 
  CloudFog, 
  CloudDrizzle, 
  CloudRain, 
  CloudSnow, 
  CloudLightning, 
  Thermometer, 
  Wind, 
  Droplets, 
  Sunrise, 
  Sunset,
  RefreshCw,
  AlertTriangle,
  CheckCircle2
} from "lucide-react";
import { WeatherData, HourlyForecast, WeatherWarning } from "../types";

export default function WeatherWidget() {
  const [weather, setWeather] = useState<WeatherData>({
    temperature: 0,
    apparentTemperature: 0,
    humidity: 0,
    precipitation: 0,
    weatherCode: 0,
    windSpeed: 0,
    maxTemp: 0,
    minTemp: 0,
    sunrise: "",
    sunset: "",
    isLoaded: false,
    hourly: [],
    warnings: []
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchWeather = async () => {
    setLoading(true);
    setError(null);
    try {
      const latitude = 50.2333;
      const longitude = -5.2333;
      const url = `https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}&current=temperature_2m,relative_humidity_2m,apparent_temperature,precipitation,rain,weather_code,wind_speed_10m&hourly=temperature_2m,weather_code,precipitation_probability,wind_speed_10m&daily=weather_code,temperature_2m_max,temperature_2m_min,sunrise,sunset&timezone=Europe/London&wind_speed_unit=mph`;
      
      const res = await fetch(url);
      if (!res.ok) {
        throw new Error(`Open-Meteo responded with status: ${res.status}`);
      }
      const data = await res.json();
      
      const current = data.current;
      const daily = data.daily;
      const hourlyData = data.hourly;
      
      // Convert sunrise/sunset to simple hh:mm 24-hr time
      const formatTime = (isoStr?: string) => {
        if (!isoStr) return "";
        try {
          const date = new Date(isoStr);
          return date.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
        } catch (e) {
          return "";
        }
      };

      // Determine start index for the next 12 hours
      const now = new Date();
      const currentHour = now.getHours();
      const currentDateStr = now.toLocaleDateString("en-CA"); // YYYY-MM-DD
      const currentHourStr = `${currentDateStr}T${String(currentHour).padStart(2, "0")}:00`;
      
      let startIndex = hourlyData.time.findIndex((t: string) => t.startsWith(currentHourStr));
      if (startIndex === -1) {
        // Fallback: match by hour value
        startIndex = hourlyData.time.findIndex((t: string) => {
          const parts = t.split("T");
          if (parts.length > 1) {
            const hourVal = parseInt(parts[1].split(":")[0], 10);
            return hourVal === currentHour;
          }
          return false;
        });
      }
      if (startIndex === -1) startIndex = 0;

      // Pull the next 12 hours starting from current hour
      const hourlyForecasts: HourlyForecast[] = [];
      for (let idx = startIndex; idx < startIndex + 12; idx++) {
        if (idx < hourlyData.time.length) {
          const tISO = hourlyData.time[idx];
          const tempVal = hourlyData.temperature_2m[idx];
          const codeVal = hourlyData.weather_code[idx];
          const precipProb = hourlyData.precipitation_probability ? hourlyData.precipitation_probability[idx] : 0;
          
          try {
            const d = new Date(tISO);
            const formattedHour = d.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
            hourlyForecasts.push({
              time: formattedHour,
              temperature: tempVal,
              weatherCode: codeVal,
              precipProb
            });
          } catch (e) {
            hourlyForecasts.push({
              time: `+${idx - startIndex}h`,
              temperature: tempVal,
              weatherCode: codeVal,
              precipProb
            });
          }
        }
      }

      // Generate dynamic alerts/warnings based on actual realtime weather parameters:
      const activeWarnings: WeatherWarning[] = [];
      const windLevel = current.wind_speed_10m; // returned directly in mph
      const weatherCode = current.weather_code;
      const tempLevel = current.temperature_2m;

      // 1. Heavy wind gale advisory
      if (windLevel >= 22) {
        activeWarnings.push({
          severity: windLevel >= 32 ? "amber" : "yellow",
          title: windLevel >= 32 ? "Amber Gale Warning" : "Yellow Wind Bulletin",
          description: `Active gusts up to ${windLevel.toFixed(0)} mph detected in South Cornwall. Exercise high caution along elevated paths.`
        });
      }

      // 2. Heavy precip warnings
      // Check current weather code AND upcoming hourly forecasts for thunderstorms
      const upcomingThunderstorm = hourlyForecasts.some(h => [95, 96, 99].includes(h.weatherCode));
      if ([95, 96, 99].includes(weatherCode) || upcomingThunderstorm) {
        const isCurrent = [95, 96, 99].includes(weatherCode);
        activeWarnings.push({
          severity: "amber",
          title: "Severe Lightning & Storm",
          description: isCurrent
            ? "High electrical active cells moving across Redruth region. Watch out for infrastructure interference."
            : "Thunderstorms are forecast within the next 12 hours. Watch out for infrastructure interference."
        });
      } else if ([65, 82].includes(weatherCode)) {
        activeWarnings.push({
          severity: "yellow",
          title: "Yellow Torrential Rain Warning",
          description: "Violent heavy rain showers might result in instantaneous surface flooding across narrow lanes."
        });
      } else if ([75, 86].includes(weatherCode)) {
        activeWarnings.push({
          severity: "red",
          title: "Severe Snowfall/Ice Blackout",
          description: "Dense local snow accumulation. Avoid non-essential vehicular travel across Bodmin."
        });
      } else if ([45, 48].includes(weatherCode)) {
        activeWarnings.push({
          severity: "info",
          title: "Dense Marine Fog Advisory",
          description: "Heavy rolling coastal fog blankets low fields. Dramatically reduced sightlines."
        });
      }

      // 3. extreme cold warning
      if (tempLevel <= 3) {
        activeWarnings.push({
          severity: "yellow",
          title: "Black Ice & Ground Frost",
          description: "Air temperatures dipping below freezing point. Danger of icy road coatings on ungritted rural pathways."
        });
      }

      setWeather({
        temperature: current.temperature_2m,
        apparentTemperature: current.apparent_temperature,
        humidity: current.relative_humidity_2m,
        precipitation: current.precipitation,
        weatherCode: current.weather_code,
        windSpeed: current.wind_speed_10m,
        maxTemp: daily.temperature_2m_max[0],
        minTemp: daily.temperature_2m_min[0],
        sunrise: formatTime(daily.sunrise[0]),
        sunset: formatTime(daily.sunset[0]),
        isLoaded: true,
        hourly: hourlyForecasts,
        warnings: activeWarnings
      });
    } catch (err: any) {
      console.error(err);
      setError(err.message || "Weather fetch failed");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchWeather();
  }, []);

  const getWeatherIconAndLabel = (code: number, size = "w-8 h-8") => {
    if (code === 0) return { icon: <Sun className={`${size} text-amber-500 animate-[spin_25s_linear_infinite]`} />, label: "Clear Sky" };
    if ([1, 2].includes(code)) return { icon: <CloudSun className={`${size} text-amber-400`} />, label: "Partly Cloudy" };
    if (code === 3) return { icon: <Cloud className={`${size} text-stone-400`} />, label: "Overcast" };
    if ([45, 48].includes(code)) return { icon: <CloudFog className={`${size} text-stone-400`} />, label: "Foggy" };
    if ([51, 53, 55].includes(code)) return { icon: <CloudDrizzle className={`${size} text-blue-400`} />, label: "Drizzle" };
    if ([61, 63, 65, 80, 81, 82].includes(code)) return { icon: <CloudRain className={`${size} text-blue-500 animate-[pulse_2s_infinite]`} />, label: "Rainy" };
    if ([71, 73, 75, 85, 86].includes(code)) return { icon: <CloudSnow className={`${size} text-teal-300 animate-bounce`} />, label: "Snowy" };
    if ([95, 96, 99].includes(code)) return { icon: <CloudLightning className={`${size} text-purple-400`} />, label: "Thunderstorm" };
    return { icon: <CloudSun className={`${size} text-stone-400`} />, label: "Cloudy" };
  };

  const weatherDetails = getWeatherIconAndLabel(weather.weatherCode);

  if (loading && !weather.isLoaded) {
    return (
      <div className="bg-[#2b2d31] border border-[#1e1f22] rounded-2xl p-4 sm:p-6 flex flex-col justify-center items-center h-56 animate-pulse text-stone-400 font-sans">
        <RefreshCw className="w-5 h-5 animate-spin mb-2 text-[#5865F2]" />
        <p className="text-xs font-medium">Checking weather in Redruth...</p>
      </div>
    );
  }

  if (error && !weather.isLoaded) {
    return (
      <div className="bg-[#2b2d31] border border-red-500/20 rounded-2xl p-4 sm:p-6 flex flex-col justify-center items-center font-sans text-red-400">
        <p className="text-xs sm:text-sm font-semibold mb-2">Failed to retrieve weather</p>
        <p className="text-[10px] sm:text-xs opacity-80 text-center max-w-xs">{error}</p>
        <button 
          onClick={fetchWeather}
          className="mt-4 px-3 py-1 bg-red-950/40 hover:bg-red-950/70 text-red-200 border border-red-900/50 text-[10px] font-semibold rounded-lg transition-all"
        >
          Troubleshoot
        </button>
      </div>
    );
  }

  return (
    <div className="bg-[#2b2d31] border border-[#1e1f22] rounded-2xl p-3.5 sm:p-5 shadow-md flex flex-col hover:border-[#3f4147]/40 transition-all duration-300">
      
      {/* Weather Header */}
      <div className="flex items-start justify-between">
        <div>
          <span className="text-[9px] font-mono tracking-wider text-stone-400 uppercase font-semibold">Redruth, Cornwall</span>
          <h3 className="text-xs sm:text-sm font-bold text-stone-100 mt-0.5">Local Weather</h3>
          <p className="text-[11px] text-stone-400 mt-0.5">{weatherDetails.label}</p>
        </div>
        <div className="flex flex-col items-end">
          {weatherDetails.icon}
          <button 
            onClick={fetchWeather}
            disabled={loading}
            className="mt-1 text-stone-400 hover:text-stone-200 transition-colors cursor-pointer"
            title="Refresh weather"
          >
            <RefreshCw className={`w-3 h-3 ${loading ? "animate-spin" : ""}`} />
          </button>
        </div>
      </div>

      {/* Main Temperature Spot */}
      <div className="flex items-baseline mt-2">
        <span className="text-2xl sm:text-3xl font-extrabold tracking-tighter text-white font-sans">
          {weather.temperature.toFixed(1)}°C
        </span>
        {weather.apparentTemperature !== undefined && (
          <span className="text-[10px] sm:text-[11px] text-stone-400 ml-2 font-medium">
            Feels {weather.apparentTemperature.toFixed(0)}°
          </span>
        )}
      </div>

      {/* Primary Details Row */}
      <div className="grid grid-cols-2 gap-y-2 gap-x-2.5 border-t border-[#3f4147]/30 pt-2.5 mt-2.5 text-[10px] sm:text-[11px] font-sans text-stone-300">
        <div className="flex items-center gap-1.5">
          <Thermometer className="w-3.5 h-3.5 text-stone-400 shrink-0" />
          <div className="leading-tight">
            <span className="text-[8px] text-stone-400 block font-mono">Hi/Lo</span>
            <span className="font-semibold">
              {weather.maxTemp.toFixed(1)}°/{weather.minTemp.toFixed(1)}°
            </span>
          </div>
        </div>

        <div className="flex items-center gap-1.5">
          <Wind className="w-3.5 h-3.5 text-stone-400 shrink-0" />
          <div className="leading-tight">
            <span className="text-[8px] text-stone-400 block font-mono">Wind</span>
            <span className="font-semibold">{weather.windSpeed?.toFixed(0)} mph</span>
          </div>
        </div>

        <div className="flex items-center gap-1.5">
          <Droplets className="w-3.5 h-3.5 text-stone-400 shrink-0" />
          <div className="leading-tight">
            <span className="text-[8px] text-stone-400 block font-mono">Humidity</span>
            <span className="font-semibold">
              {weather.humidity || 0}%
            </span>
          </div>
        </div>

        <div className="flex items-center gap-1.5">
          <Sunrise className="w-3.5 h-3.5 text-stone-400 shrink-0" />
          <div className="leading-tight">
            <span className="text-[8px] text-stone-400 block font-mono">Sun</span>
            <span className="font-semibold text-stone-300 text-[9px] sm:text-[10px]">{weather.sunrise} - {weather.sunset}</span>
          </div>
        </div>
      </div>

      {/* Warnings & Advisories */}
      <div className="border-t border-[#3f4147]/30 mt-2.5 pt-2.5">
        {weather.warnings && weather.warnings.length > 0 ? (
          weather.warnings.map((warn, i) => {
            const isRed = warn.severity === "red";
            const isAmber = warn.severity === "amber";
            
            const badgeBg = isRed 
              ? "bg-red-950/20 border-red-900/60 text-red-300" 
              : isAmber 
                ? "bg-amber-950/20 border-amber-900/50 text-amber-300"
                : "bg-stone-900/40 border-[#3f4147]/40 text-stone-200";

            return (
              <div key={i} className={`p-2 border rounded-xl flex items-start gap-1.5 text-[10px] leading-relaxed ${badgeBg}`}>
                <AlertTriangle className="w-3.5 h-3.5 mt-0.5 shrink-0 text-amber-400" />
                <div>
                  <h4 className="font-bold">{warn.title}</h4>
                  <p className="text-stone-400 font-sans mt-0.5 text-[9px] leading-snug">{warn.description}</p>
                </div>
              </div>
            );
          })
        ) : (
          <div className="bg-[#1e1f22]/30 border border-[#1e1f22] rounded-xl p-2 flex items-center gap-1.5 text-[10px] text-stone-400">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
            <span className="font-sans">No active MET weather warnings</span>
          </div>
        )}
      </div>

      {/* Next 12 Hours Hourly Slider with Scroll to save space */}
      <div className="border-t border-[#3f4147]/30 mt-3.5 pt-2.5 select-none">
        <h4 className="text-[9px] font-mono tracking-wider text-stone-400 uppercase font-semibold mb-2">
          12-Hour Outlook
        </h4>
        <div className="flex gap-2.5 overflow-x-auto pb-1.5 scrollbar-thin scrollbar-thumb-stone-700 scrollbar-track-transparent">
          {weather.hourly && weather.hourly.map((h, index) => (
            <div key={index} className="flex flex-col items-center flex-1 min-w-[3.1rem] text-center p-1 rounded-lg bg-[#1e1f22]/20 border border-[transparent] hover:border-[#3f4147]/30 hover:bg-[#1e1f22]/40 transition-all duration-150">
              <span className="text-[8px] text-stone-400 font-mono font-semibold">{h.time}</span>
              <div className="my-1 shrink-0">
                {getWeatherIconAndLabel(h.weatherCode, "w-4 h-4").icon}
              </div>
              <span className="text-[10px] font-bold text-stone-100 tracking-tight">{h.temperature.toFixed(0)}°</span>
              {h.precipProb > 10 && (
                <span className="text-[8px] font-bold text-blue-400 mt-0.5">{h.precipProb}%</span>
              )}
            </div>
          ))}
        </div>
      </div>

    </div>
  );
}
