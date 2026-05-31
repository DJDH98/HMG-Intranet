import { useEffect, useState, useRef } from "react";
import { 
  Rocket, 
  Calendar, 
  MapPin, 
  Timer, 
  RefreshCw, 
  AlertTriangle, 
  ChevronLeft, 
  ChevronRight,
  Sparkles,
  Layers,
  Info
} from "lucide-react";

interface LaunchItem {
  id: string;
  name: string;
  flight_number: number;
  date_utc: string;
  date_precision: string;
  details: string;
  launchpad_name: string;
  countdownText?: string;
  isFallback?: boolean;
}

// High-fidelity fallback Starship flight definitions mapping past May 2026
const FALLBACK_STARSHIP_LAUNCHES: LaunchItem[] = [
  {
    id: "starship-flight-7",
    name: "Starship Flight 7 (IFT-7)",
    flight_number: 7,
    date_utc: "2026-06-28T14:30:00.000Z",
    date_precision: "day",
    details: "Expected to test propellant transfer, Raptor engine performance, and heat-shield changes during reentry.",
    launchpad_name: "Orbital Launch Mount A, Starbase, Boca Chica, Texas",
    isFallback: true
  },
  {
    id: "starship-flight-8",
    name: "Starship Flight 8 (IFT-8)",
    flight_number: 8,
    date_utc: "2026-09-15T00:00:00.000Z",
    date_precision: "month",
    details: "Expected to test upper-stage refinements, hot-staging hardware, and propellant boil-off control.",
    launchpad_name: "Orbital Launch Mount A, Starbase, Boca Chica, Texas",
    isFallback: true
  },
  {
    id: "starship-flight-9",
    name: "Starship Flight 9 (IFT-9)",
    flight_number: 9,
    date_utc: "2026-11-20T00:00:00.000Z",
    date_precision: "quarter",
    details: "Expected to focus on upper-stage deployment tests and landing accuracy.",
    launchpad_name: "Orbital Launch Mount B, Starbase, Boca Chica, Texas",
    isFallback: true
  }
];

export default function StarshipWidget() {
  const [launches, setLaunches] = useState<LaunchItem[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [countdown, setCountdown] = useState({ days: 0, hours: 0, minutes: 0, seconds: 0, show: false });
  const [lastRefreshed, setLastRefreshed] = useState<Date>(new Date());
  
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  const fetchLaunches = async () => {
    setLoading(true);
    setError(null);
    try {
      // Fetch upcoming SpaceX launches
      const res = await fetch("https://api.spacexdata.com/v5/launches?upcoming=true");
      if (!res.ok) {
        throw new Error(`SpaceX API responded with status: ${res.status}`);
      }
      const data = await res.json();
      
      // Filter for Starship launches (by name or rocket ID)
      // Starship rocket ID is "5e9d0d95edd2613b3c4b5802"
      const starshipOnly = data.filter((item: any) => {
        const nameMatch = item.name.toLowerCase().includes("starship") || item.name.toLowerCase().includes("ift");
        const rocketMatch = item.rocket === "5e9d0d95edd2613b3c4b5802";
        return nameMatch || rocketMatch;
      });

      // Map API items to unified layout
      const mappedLaunches: LaunchItem[] = starshipOnly.map((item: any) => {
        // Resolve launch site name
        let siteName = "Starbase, Boca Chica, Texas";
        if (item.launchpad === "5e9e4502f5090995de566f86") {
          siteName = "Orbital Launch Mount A, Starbase, Texas";
        }
        
        let detailsText = item.details;
        if (!detailsText) {
          detailsText = `SpaceX Starship test flight (${item.name}). Expected to test liftoff, staging, landing, and heat-shield performance.`;
        }

        return {
          id: item.id,
          name: item.name,
          flight_number: item.flight_number,
          date_utc: item.date_utc,
          date_precision: item.date_precision,
          details: detailsText,
          launchpad_name: siteName,
          isFallback: false
        };
      });

      if (mappedLaunches.length > 0) {
        setLaunches(mappedLaunches);
      } else {
        // Fallback to high-fidelity definitions if SpaceX has zero future launches in their index
        console.warn("SpaceX API returned zero Starship launches. Using offline schedule.");
        setLaunches(FALLBACK_STARSHIP_LAUNCHES);
      }
    } catch (err: any) {
      console.warn("Could not retrieve live SpaceX schedule. Active state loaded with fallback data:", err);
      setLaunches(FALLBACK_STARSHIP_LAUNCHES);
    } finally {
      setLoading(false);
      setLastRefreshed(new Date());
    }
  };

  useEffect(() => {
    fetchLaunches();
    
    // Refresh SpaceX telemetry every 30 minutes
    const refreshInterval = setInterval(() => {
      fetchLaunches();
    }, 30 * 60 * 1000);

    return () => {
      clearInterval(refreshInterval);
    };
  }, []);

  // Set up live ticking countdown for current active flight
  useEffect(() => {
    if (timerRef.current) clearInterval(timerRef.current);
    
    const activeLaunch = launches[currentIndex];
    if (!activeLaunch) return;

    const updateCountdown = () => {
      const launchTime = new Date(activeLaunch.date_utc).getTime();
      const now = new Date().getTime();
      const diff = launchTime - now;

      // Only show precise countdown if launch is in the future AND precision is Day/Hour
      const isPrecise = activeLaunch.date_precision === "day" || activeLaunch.date_precision === "hour";
      
      if (diff > 0 && isPrecise) {
        const days = Math.floor(diff / (1000 * 60 * 60 * 24));
        const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
        const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
        const seconds = Math.floor((diff % (1000 * 60)) / 1000);
        setCountdown({ days, hours, minutes, seconds, show: true });
      } else {
        setCountdown({ days: 0, hours: 0, minutes: 0, seconds: 0, show: false });
      }
    };

    updateCountdown();
    timerRef.current = setInterval(updateCountdown, 1000);

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [launches, currentIndex]);

  const handleNext = () => {
    if (launches.length > 0) {
      setCurrentIndex((prev) => (prev + 1) % launches.length);
    }
  };

  const handlePrev = () => {
    if (launches.length > 0) {
      setCurrentIndex((prev) => (prev - 1 + launches.length) % launches.length);
    }
  };

  if (loading && launches.length === 0) {
    return (
      <div className="bg-[#2b2d31] border border-[#1e1f22] rounded-2xl p-4 sm:p-5 flex flex-col justify-center items-center h-48 animate-pulse text-stone-400 font-sans">
        <Rocket className="w-5 h-5 animate-bounce mb-2 text-[#5865F2]" />
        <p className="text-xs font-semibold">Loading SpaceX launches...</p>
        <p className="text-[10px] text-stone-500 mt-1">Fetching SpaceX schedule...</p>
      </div>
    );
  }

  const activeLaunch = launches[currentIndex];

  const formatLaunchDate = (isoStr: string, precision: string) => {
    const d = new Date(isoStr);
    try {
      if (precision === "hour" || precision === "day") {
        return d.toLocaleDateString("en-GB", {
          day: "numeric",
          month: "long",
          year: "numeric",
          hour: "2-digit",
          minute: "2-digit",
          timeZoneName: "short"
        });
      }
      
      if (precision === "month") {
        const month = d.toLocaleDateString("en-GB", { month: "long" });
        const year = d.getFullYear();
        return `NET: ${month} ${year}`;
      }

      if (precision === "quarter") {
        const quarter = Math.floor(d.getMonth() / 3) + 1;
        const year = d.getFullYear();
        return `NET: Q${quarter} ${year}`;
      }

      // Default fallback
      return `NET: ${d.toLocaleDateString("en-GB", { month: "short", year: "numeric" })}`;
    } catch (e) {
      return "NET: Mid-2026";
    }
  };

  return (
    <div className="bg-[#2b2d31] border border-[#1e1f22] rounded-2xl p-3.5 sm:p-5 shadow-md flex flex-col hover:border-[#3f4147]/40 transition-[border-color] duration-300">
      
      {/* Title Header */}
      <div className="flex items-center justify-between border-b border-[#3f4147]/20 pb-2.5 mb-3 select-none">
        <div className="flex items-center gap-2">
          <div className="p-1 bg-amber-500/10 border border-amber-500/25 text-amber-500 rounded-lg shrink-0">
            <Rocket className="w-3.5 h-3.5 animate-[pulse_2.5s_infinite]" />
          </div>
          <div>
            <span className="text-[8px] font-mono tracking-widest text-stone-400 uppercase font-semibold">SpaceX launches</span>
            <h3 className="text-xs font-bold text-stone-100 tracking-tight">Starship schedule</h3>
          </div>
        </div>

        <div className="flex items-center gap-1.5">
          {/* Index Counter */}
          {launches.length > 1 && (
            <span className="text-[8px] font-mono text-stone-500 font-bold bg-[#1e1f22] px-1.5 py-0.5 rounded-md">
              {currentIndex + 1}/{launches.length}
            </span>
          )}

          {/* Manual Refresh */}
          <button 
            onClick={fetchLaunches}
            disabled={loading}
            className="p-1 rounded-md text-stone-400 hover:text-stone-200 hover:bg-[#1e1f22]/50 transition-all cursor-pointer"
            title="Force refresh index"
          >
            <RefreshCw className={`w-3 h-3 ${loading ? "animate-spin" : ""}`} />
          </button>
        </div>
      </div>

      {activeLaunch ? (
        <div className="flex flex-col flex-grow">
          
          {/* Big Header: Flight Name / Title */}
          <div className="flex items-start justify-between gap-1.5">
            <div className="flex-grow">
              <span className="text-[9px] uppercase font-bold text-amber-500 font-mono tracking-wider bg-amber-500/10 border border-amber-500/20 px-1.5 py-0.5 rounded-lg inline-block">
                Flight {activeLaunch.flight_number || "System"}
              </span>
              <h4 className="text-xs sm:text-sm font-black text-white font-sans mt-1 leading-snug tracking-tight">
                {activeLaunch.name}
              </h4>
            </div>

            {/* Pagination Controls */}
            {launches.length > 1 && (
              <div className="flex items-center gap-1 shrink-0 mt-0.5 select-none">
                <button
                  onClick={handlePrev}
                  className="p-1 rounded-md bg-[#1e1f22]/60 hover:bg-[#35373c]/80 border border-[#1e1f22] text-stone-400 hover:text-white transition-colors cursor-pointer"
                  title="Previous Launch"
                >
                  <ChevronLeft className="w-3 h-3" />
                </button>
                <button
                  onClick={handleNext}
                  className="p-1 rounded-md bg-[#1e1f22]/60 hover:bg-[#35373c]/80 border border-[#1e1f22] text-stone-400 hover:text-white transition-colors cursor-pointer"
                  title="Next Launch"
                >
                  <ChevronRight className="w-3 h-3" />
                </button>
              </div>
            )}
          </div>

          {/* Countdown Clock Display */}
          {countdown.show ? (
            <div className="mt-3 bg-[#1e1f22]/60 border border-[#1e1f22] rounded-xl p-2.5 flex items-center justify-between select-none">
              <div className="flex items-center gap-1.5">
                <Timer className="w-3.5 h-3.5 text-[#5865F2] animate-[pulse_1s_infinite]" />
                <span className="text-[9px] font-mono tracking-wider text-stone-400 uppercase font-bold">Countdown:</span>
              </div>
              <div className="flex items-center gap-1 font-mono text-[10px] sm:text-xs text-white">
                <div className="bg-[#2b2d31] px-1 rounded-md min-w-[1.4rem] text-center py-0.5 border border-[#1e1f22]">
                  <span className="font-extrabold text-white">{countdown.days}</span>
                  <span className="text-[7px] text-stone-400 block -mt-0.5 font-sans uppercase">d</span>
                </div>
                <span>:</span>
                <div className="bg-[#2b2d31] px-1 rounded-md min-w-[1.4rem] text-center py-0.5 border border-[#1e1f22]">
                  <span className="font-extrabold text-[#5865F2]">{String(countdown.hours).padStart(2, "0")}</span>
                  <span className="text-[7px] text-stone-400 block -mt-0.5 font-sans uppercase">h</span>
                </div>
                <span>:</span>
                <div className="bg-[#2b2d31] px-1 rounded-md min-w-[1.4rem] text-center py-0.5 border border-[#1e1f22]">
                  <span className="font-extrabold text-[#5865F2]">{String(countdown.minutes).padStart(2, "0")}</span>
                  <span className="text-[7px] text-stone-400 block -mt-0.5 font-sans uppercase">m</span>
                </div>
                <span>:</span>
                <div className="bg-[#2b2d31] px-1 rounded-md min-w-[1.5rem] text-center py-0.5 border border-[#1e1f22]">
                  <span className="font-extrabold text-amber-500">{String(countdown.seconds).padStart(2, "0")}</span>
                  <span className="text-[7px] text-stone-400 block -mt-0.5 font-sans uppercase">s</span>
                </div>
              </div>
            </div>
          ) : (
            <div className="mt-2.5 bg-[#1e1f22]/40 border border-[#1e1f22]/60 rounded-xl p-2 flex items-center gap-1.5 select-none text-stone-400">
              <Info className="w-3.5 h-3.5 text-stone-500 shrink-0" />
              <div className="text-[9px] font-sans">
                No active countdown (date is a targeted rough estimate)
              </div>
            </div>
          )}

          {/* Details & Target Date Grid */}
          <div className="mt-3.5 space-y-2 border-t border-[#3f4147]/20 pt-3">
            {/* Target Date Row */}
            <div className="flex items-center gap-2 text-[10px] sm:text-[11px] font-sans text-stone-300">
              <Calendar className="w-3.5 h-3.5 text-stone-400 shrink-0" />
              <div>
                <span className="text-[8px] text-stone-400 block font-mono">Target Date</span>
                <span className="font-extrabold text-emerald-400">
                  {formatLaunchDate(activeLaunch.date_utc, activeLaunch.date_precision)}
                </span>
              </div>
            </div>

            {/* Launch Site Row */}
            <div className="flex items-center gap-2 text-[10px] sm:text-[11px] font-sans text-stone-300">
              <MapPin className="w-3.5 h-3.5 text-stone-400 shrink-0" />
              <div>
                <span className="text-[8px] text-stone-400 block font-mono">Launch Facilities</span>
                <span className="font-semibold text-stone-200">
                  {activeLaunch.launchpad_name}
                </span>
              </div>
            </div>
          </div>

          {/* Core Goals Description Box */}
          <div className="bg-[#1e1f22]/35 border border-[#1e1f22]/90 rounded-xl p-2.5 mt-3.5">
            <span className="text-[8px] uppercase tracking-wider font-mono font-bold text-stone-400 block mb-1">
              Mission notes:
            </span>
            <p className="text-[9px] sm:text-[10px] text-stone-300 font-sans leading-normal line-clamp-4">
              {activeLaunch.details}
            </p>
          </div>

          {/* Channel Info Pin */}
          <div className="mt-3 border-t border-[#2b2d31] pt-2 flex items-center justify-between text-[8px] font-mono text-stone-500">
            <span>Last Indexed: {lastRefreshed.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })}</span>
            {activeLaunch.isFallback ? (
              <span className="text-amber-500/80 uppercase font-semibold">Offline schedule</span>
            ) : (
              <span className="text-[#5865F2] uppercase font-semibold">Live API data</span>
            )}
          </div>

        </div>
      ) : (
        <div className="text-stone-400 text-center text-xs py-10 font-sans">
          No upcoming Starship launches found.
        </div>
      )}

    </div>
  );
}
