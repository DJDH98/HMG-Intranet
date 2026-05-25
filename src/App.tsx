import { useState, useEffect, FormEvent, MouseEvent } from "react";
import { 
  Server, 
  Image, 
  Sparkles, 
  Film, 
  Tv, 
  Flame, 
  DownloadCloud, 
  Headphones, 
  Music, 
  Lock, 
  Search, 
  Globe, 
  Activity, 
  Plus, 
  X, 
  Settings, 
  ExternalLink,
  ChevronRight,
  ChevronDown,
  ChevronUp,
  CloudSun,
  Moon,
  Sun,
  Info,
  Layers,
  Sparkle,
  LogOut
} from "lucide-react";
import { DEFAULT_SERVICES } from "./defaultServices";
import { DockerService } from "./types";
import WeatherWidget from "./components/WeatherWidget";
import NewsAgent from "./components/NewsAgent";
import StarshipWidget from "./components/StarshipWidget";
import GitHubLoginGateway from "./components/GitHubLoginGateway";
import { useAuth, useUser } from "@clerk/clerk-react";

// Helper to calculate moon phase in plain JS
function getMoonPhaseInfo(date: Date) {
  const knownNewMoon = new Date("2000-01-06T18:14:00Z").getTime();
  const currentMs = date.getTime();
  const diffMs = currentMs - knownNewMoon;
  const diffDays = diffMs / (1000 * 60 * 60 * 24);
  
  const synodicMonth = 29.530588853;
  const phaseCycle = (diffDays / synodicMonth) % 1;
  const normalizedPhase = phaseCycle < 0 ? phaseCycle + 1 : phaseCycle;
  
  let name = "";
  let iconType = "";
  let illumination = 0;

  if (normalizedPhase < 0.03 || normalizedPhase > 0.97) {
    name = "New Moon";
    iconType = "new-moon";
    illumination = 0;
  } else if (normalizedPhase >= 0.03 && normalizedPhase < 0.22) {
    name = "Waxing Crescent";
    iconType = "waxing-crescent";
    illumination = ((normalizedPhase - 0.03) / 0.19) * 50;
  } else if (normalizedPhase >= 0.22 && normalizedPhase < 0.28) {
    name = "First Quarter";
    iconType = "first-quarter";
    illumination = 50;
  } else if (normalizedPhase >= 0.28 && normalizedPhase < 0.47) {
    name = "Waxing Gibbous";
    iconType = "waxing-gibbous";
    illumination = 50 + ((normalizedPhase - 0.28) / 0.19) * 50;
  } else if (normalizedPhase >= 0.47 && normalizedPhase < 0.53) {
    name = "Full Moon";
    iconType = "full-moon";
    illumination = 100;
  } else if (normalizedPhase >= 0.53 && normalizedPhase < 0.72) {
    name = "Waning Gibbous";
    iconType = "waning-gibbous";
    illumination = 100 - ((normalizedPhase - 0.53) / 0.19) * 50;
  } else if (normalizedPhase >= 0.72 && normalizedPhase < 0.78) {
    name = "Last Quarter";
    iconType = "last-quarter";
    illumination = 50;
  } else {
    name = "Waning Crescent";
    iconType = "waning-crescent";
    illumination = 50 - ((normalizedPhase - 0.78) / 0.19) * 50;
  }

  // Calculate dynamic days to next full moon & new moon
  let daysToFull = 0;
  if (normalizedPhase < 0.5) {
    daysToFull = (0.5 - normalizedPhase) * synodicMonth;
  } else {
    daysToFull = (1.5 - normalizedPhase) * synodicMonth;
  }
  const daysToNew = (1.0 - normalizedPhase) * synodicMonth;

  const fullMoonDate = new Date(currentMs + daysToFull * 86400 * 1000);
  const newMoonDate = new Date(currentMs + daysToNew * 86400 * 1000);

  const formatFutureDate = (d: Date) => {
    return d.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
  };

  const moonAge = (normalizedPhase * synodicMonth).toFixed(1);

  return {
    name,
    illumination: Math.round(illumination),
    iconType,
    moonAge,
    nextFullMoon: formatFutureDate(fullMoonDate),
    nextNewMoon: formatFutureDate(newMoonDate),
    cyclePercent: Math.round(normalizedPhase * 100)
  };
}

// Custom rendered SVG moon graphic corresponding directly to the illuminated shapes
function MoonGraphic({ iconType }: { iconType: string }) {
  switch (iconType) {
    case "new-moon":
      return (
        <svg viewBox="0 0 32 32" className="w-5 h-5 flex-shrink-0">
          <circle cx="16" cy="16" r="14" fill="#1c1917" className="stroke-stone-800" strokeWidth="1" />
        </svg>
      );
    case "waxing-crescent":
      return (
        <svg viewBox="0 0 32 32" className="w-5 h-5 flex-shrink-0 filter drop-shadow-[0_0_3px_rgba(254,240,138,0.25)]">
          <circle cx="16" cy="16" r="14" fill="#1a1c1d" />
          <path d="M16 2 A14 14 0 0 1 16 30 A10 14 0 0 0 16 2" fill="#fef08a" />
        </svg>
      );
    case "first-quarter":
      return (
        <svg viewBox="0 0 32 32" className="w-5 h-5 flex-shrink-0 filter drop-shadow-[0_0_4px_rgba(254,240,138,0.35)]">
          <circle cx="16" cy="16" r="14" fill="#1a1c1d" />
          <path d="M16 2 A14 14 0 0 1 16 30 Z" fill="#fef08a" />
        </svg>
      );
    case "waxing-gibbous":
      return (
        <svg viewBox="0 0 32 32" className="w-5 h-5 flex-shrink-0 filter drop-shadow-[0_0_5px_rgba(254,240,138,0.45)]">
          <circle cx="16" cy="16" r="14" fill="#1a1c1d" />
          <path d="M16 2 A14 14 0 0 1 16 30 A-10 14 0 0 0 16 2" fill="#fef08a" />
          <path d="M16 2 A14 14 0 0 1 16 30 Z" fill="#fef08a" />
        </svg>
      );
    case "full-moon":
      return (
        <svg viewBox="0 0 32 32" className="w-5 h-5 flex-shrink-0 filter drop-shadow-[0_0_8px_rgba(254,240,138,0.55)]">
          <circle cx="16" cy="16" r="14" fill="#fef08a" />
        </svg>
      );
    case "waning-gibbous":
      return (
        <svg viewBox="0 0 32 32" className="w-5 h-5 flex-shrink-0 filter drop-shadow-[0_0_5px_rgba(254,240,138,0.45)]">
          <circle cx="16" cy="16" r="14" fill="#1a1c1d" />
          <path d="M16 2 A14 14 0 0 0 16 30 A10 14 0 0 1 16 2" fill="#fef08a" />
          <path d="M16 2 A14 14 0 0 0 16 30 Z" fill="#fef08a" />
        </svg>
      );
    case "last-quarter":
      return (
        <svg viewBox="0 0 32 32" className="w-5 h-5 flex-shrink-0 filter drop-shadow-[0_0_4px_rgba(254,240,138,0.35)]">
          <circle cx="16" cy="16" r="14" fill="#1a1c1d" />
          <path d="M16 2 A14 14 0 0 0 16 30 Z" fill="#fef08a" />
        </svg>
      );
    case "waning-crescent":
      return (
        <svg viewBox="0 0 32 32" className="w-5 h-5 flex-shrink-0 filter drop-shadow-[0_0_3px_rgba(254,240,138,0.25)]">
          <circle cx="16" cy="16" r="14" fill="#1a1c1d" />
          <path d="M16 2 A14 14 0 0 0 16 30 A-10 14 0 0 1 16 2" fill="#fef08a" />
        </svg>
      );
    default:
      return (
        <svg viewBox="0 0 32 32" className="w-5 h-5 flex-shrink-0">
          <circle cx="16" cy="16" r="14" fill="#fef08a" />
        </svg>
      );
  }
}

// Ultra high-fidelity scalable Moon Graphic with craters and surface texture for the modal view
function LargeMoonGraphic({ iconType }: { iconType: string }) {
  return (
    <div className="relative w-32 h-32 flex items-center justify-center bg-radial from-[#ffe066]/10 to-transparent p-4 rounded-full select-none">
      <svg viewBox="0 0 100 100" className="w-24 h-24 flex-shrink-0 filter drop-shadow-[0_0_12px_rgba(254,240,138,0.45)]">
        <defs>
          <radialGradient id="darkSideGradient" cx="50%" cy="50%" r="50%">
            <stop offset="65%" stopColor="#1a1c1d" />
            <stop offset="100%" stopColor="#111213" />
          </radialGradient>
          
          <pattern id="craterMap" width="100" height="100" patternUnits="userSpaceOnUse">
            {/* Soft, layered circular craters to evoke realism */}
            <circle cx="34" cy="28" r="7" fill="#000" fillOpacity="0.09" />
            <circle cx="33" cy="27" r="7" fill="#fff" fillOpacity="0.04" />
            
            <circle cx="66" cy="42" r="11" fill="#000" fillOpacity="0.09" />
            <circle cx="64" cy="40" r="11" fill="#fff" fillOpacity="0.04" />

            <circle cx="44" cy="72" r="9" fill="#000" fillOpacity="0.09" />
            <circle cx="42" cy="70" r="9" fill="#fff" fillOpacity="0.04" />

            <circle cx="22" cy="54" r="5" fill="#000" fillOpacity="0.08" />
            <circle cx="76" cy="64" r="4.5" fill="#000" fillOpacity="0.07" />
            <circle cx="55" cy="18" r="3" fill="#000" fillOpacity="0.07" />
          </pattern>
        </defs>

        {/* Base dark backdrop of moon sphere */}
        <circle cx="50" cy="50" r="45" fill="url(#darkSideGradient)" className="stroke-stone-800" strokeWidth="0.5" />
        
        {/* Render illuminated portion on top */}
        {iconType === "full-moon" && (
          <circle cx="50" cy="50" r="45" fill="#fef08a" />
        )}
        
        {iconType === "new-moon" && (
          <circle cx="50" cy="50" r="45" fill="#1c1917" />
        )}

        {iconType === "first-quarter" && (
          <path d="M50 5 A45 45 0 0 1 50 95 Z" fill="#fef08a" />
        )}

        {iconType === "last-quarter" && (
          <path d="M50 5 A45 45 0 0 0 50 95 Z" fill="#fef08a" />
        )}

        {iconType === "waxing-crescent" && (
          <path d="M50 5 A45 45 0 0 1 50 95 A30 45 0 0 0 50 5" fill="#fef08a" />
        )}

        {iconType === "waning-crescent" && (
          <path d="M50 5 A45 45 0 0 0 50 95 A-30 45 0 0 0 50 5" fill="#fef08a" />
        )}

        {iconType === "waxing-gibbous" && (
          <>
            <path d="M50 5 A45 45 0 0 1 50 95 Z" fill="#fef08a" />
            <path d="M50 5 A45 45 0 0 1 50 95 A-24 45 0 0 1 50 5" fill="#fef08a" />
          </>
        )}

        {iconType === "waning-gibbous" && (
          <>
            <path d="M50 5 A45 45 0 0 0 50 95 Z" fill="#fef08a" />
            <path d="M50 5 A45 45 0 0 0 50 95 A24 45 0 0 0 50 5" fill="#fef08a" />
          </>
        )}

        {/* Craters texture pattern overlay */}
        <circle cx="50" cy="50" r="45" fill="url(#craterMap)" className="pointer-events-none" />
      </svg>
    </div>
  );
}

export default function App() {
  // Service configuration with LocalStorage persistence
  const [services, setServices] = useState<DockerService[]>(() => {
    const saved = localStorage.getItem("dalen_services");
    if (saved) {
      try { return JSON.parse(saved); } catch (e) { return DEFAULT_SERVICES; }
    }
    return DEFAULT_SERVICES;
  });

  // Track the advanced expandable Moon Phase Modal Dialog
  const [isMoonModalOpen, setIsMoonModalOpen] = useState(false);

  // Tailscale IP state
  const [tailscaleIp, setTailscaleIp] = useState<string>(() => {
    return localStorage.getItem("dalen_tailscale_ip") || "100.66.186.68";
  });

  // State management
  const [selectedCategory, setSelectedCategory] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [isAddingService, setIsAddingService] = useState(false);
  const [isEditingIp, setIsEditingIp] = useState(false);
  const [tempIp, setTempIp] = useState(tailscaleIp);
  const [timeOfDay, setTimeOfDay] = useState("");
  const [localTimeStr, setLocalTimeStr] = useState("");
  const [currentMoonPhase, setCurrentMoonPhase] = useState(() => getMoonPhaseInfo(new Date()));

  // Clerk Authentication states
  const { isLoaded: isAuthLoaded, isSignedIn, signOut } = useAuth();
  const { user } = useUser();

  // Docker Shortcuts and settings collapsible states (isDockersExpanded starts true for undocked)
  const [isContainerSettingsOpen, setIsContainerSettingsOpen] = useState(false);
  const [isDockersExpanded, setIsDockersExpanded] = useState(true);

  // New service form fields
  const [newServiceName, setNewServiceName] = useState("");
  const [newServicePort, setNewServicePort] = useState("");
  const [newServiceDesc, setNewServiceDesc] = useState("");
  const [newServiceCategory, setNewServiceCategory] = useState<"media" | "download" | "utility" | "other">("media");
  const [newServiceIcon, setNewServiceIcon] = useState("Server");
  const [newServiceActive, setNewServiceActive] = useState(true);

  // Synchronize storage
  useEffect(() => {
    localStorage.setItem("dalen_services", JSON.stringify(services));
  }, [services]);

  useEffect(() => {
    localStorage.setItem("dalen_tailscale_ip", tailscaleIp);
  }, [tailscaleIp]);

  // Handle dynamic greetings depending on time
  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      const hours = now.getHours();
      
      if (hours >= 5 && hours < 12) {
        setTimeOfDay("Good Morning, Dalen");
      } else if (hours >= 12 && hours < 17) {
        setTimeOfDay("Good Afternoon, Dalen");
      } else {
        setTimeOfDay("Good Evening, Dalen");
      }

      setLocalTimeStr(now.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" }));
      setCurrentMoonPhase(getMoonPhaseInfo(now));
    };

    updateTime();
    const interval = setInterval(updateTime, 1005 * 60); // update every minute
    return () => clearInterval(interval);
  }, []);

  // Map icon names to Lucide icon components
  const renderServiceIcon = (iconName: string, className = "w-5 h-5") => {
    switch (iconName) {
      case "Image": return <Image className={className} />;
      case "Sparkles": return <Sparkles className={className} />;
      case "Film": return <Film className={className} />;
      case "Tv": return <Tv className={className} />;
      case "Flame": return <Flame className={className} />;
      case "DownloadCloud": return <DownloadCloud className={className} />;
      case "Headphones": return <Headphones className={className} />;
      case "Music": return <Music className={className} />;
      case "Lock": return <Lock className={className} />;
      case "Search": return <Search className={className} />;
      case "Globe": return <Globe className={className} />;
      case "Activity": return <Activity className={className} />;
      default: return <Server className={className} />;
    }
  };

  // Add standard new service
  const handleAddService = (e: FormEvent) => {
    e.preventDefault();
    if (!newServiceName || !newServicePort) return;

    const newService: DockerService = {
      id: `custom-${Date.now()}`,
      name: newServiceName,
      port: parseInt(newServicePort, 10),
      description: newServiceDesc || "User defined custom container route",
      category: newServiceCategory,
      iconName: newServiceIcon,
      isActive: newServiceActive,
      isCustom: true
    };

    setServices(prev => [...prev, newService]);
    
    // Clear Form
    setNewServiceName("");
    setNewServicePort("");
    setNewServiceDesc("");
    setNewServiceCategory("media");
    setNewServiceIcon("Server");
    setNewServiceActive(true);
    setIsAddingService(false);
    setIsContainerSettingsOpen(true); // stay open to verify additions
  };

  // Remove a custom service
  const handleRemoveService = (id: string, e: MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    if (confirm("Are you sure you want to delete this custom service container link?")) {
      setServices(prev => prev.filter(s => s.id !== id));
    }
  };

  // Filter list of services
  const filteredServices = services.filter(service => {
    const matchesCategory = selectedCategory === "all" || service.category === selectedCategory;
    const matchesSearch = service.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
                          service.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          String(service.port).includes(searchQuery);
    return matchesCategory && matchesSearch;
  });

  if (!isAuthLoaded) {
    return (
      <div className="min-h-screen bg-[#1e1f22] text-[#dbdee1] flex flex-col items-center justify-center p-4 relative font-sans antialiased overflow-hidden select-none">
        <div className="w-10 h-10 border-2 border-[#5865F2] border-t-transparent rounded-full animate-spin" />
        <span className="text-xs font-mono text-stone-500 mt-4 tracking-wider">INITIALIZING SAFE GATEWAY...</span>
      </div>
    );
  }

  if (!isSignedIn) {
    return <GitHubLoginGateway />;
  }

  return (
    <div className="min-h-screen bg-[#313338] text-[#dbdee1] flex flex-col font-sans selection:bg-[#5865F2] selection:text-white pb-12 antialiased">
      {/* Subtle Ambient top highlight */}
      <div className="absolute top-0 left-0 right-0 h-[1px] bg-gradient-to-r from-transparent via-[#5865F2]/40 to-transparent opacity-60" />

      {/* Admin Panel Header in Discord Dark Theme */}
      <header className="border-b border-[#1e1f22] bg-[#1e1f22] sticky top-0 z-40 px-4 sm:px-6 py-3.5 transition-all shadow-md">
        <div className="max-w-[1600px] mx-auto flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-[#5865F2]/10 border border-[#5865F2]/20 rounded-xl relative group">
              <span className="absolute inset-0 bg-[#5865F2]/15 rounded-xl blur-md opacity-70" />
              <Layers className="w-5.5 h-5.5 text-[#5865F2] relative" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-semibold text-stone-300 font-sans">{timeOfDay}</span>
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-[pulse_2s_infinite]" />
              </div>
              <h1 className="text-md sm:text-lg font-bold tracking-tight text-white mt-0.5">HMG Intranet</h1>
            </div>
          </div>

          {/* Tailscale Configurator, Live Clock, Moon, Custom Unraid Deep Link */}
          <div className="flex flex-wrap items-center gap-2.5">
            {/* Real Unraid WebUI deep link for Dalen */}
            <a
              href="http://100.66.186.68:9090/"
              target="_blank"
              rel="noopener noreferrer"
              className="px-3.5 py-1.5 bg-[#5865F2] hover:bg-[#4752c4] text-white text-xs font-bold rounded-xl flex items-center gap-1.5 transition-colors duration-150 shrink-0"
              id="unraid-dashboard-header-link"
              title="Access Unraid dashboard direct 100.66.186.68:9090"
            >
              <Server className="w-3.5 h-3.5 animate-pulse" />
              <span>Unraid WebUI</span>
              <ExternalLink className="w-3 h-3 text-white/80" />
            </a>

            {/* GLiNet KVM Backup Link Amber Button */}
            <a
              href="http://100.93.46.67"
              target="_blank"
              rel="noopener noreferrer"
              className="px-3.5 py-1.5 bg-amber-500 hover:bg-amber-400 text-stone-950 text-xs font-bold rounded-xl flex items-center gap-1.5 transition-colors duration-150 shrink-0 shadow-sm"
              id="glinet-kvm-header-link"
              title="Access GLiNet KVM emergency host 100.93.46.67"
            >
              <Server className="w-3.5 h-3.5" />
              <span>GLiNet KVM</span>
              <ExternalLink className="w-3 h-3 text-stone-900" />
            </a>

            {/* Cornwall Time Display */}
            <div className="px-3 py-1.5 bg-[#2b2d31] border border-[#1e1f22] rounded-xl text-xs font-mono text-stone-300 flex items-center gap-2 select-none">
              <span className="w-1.5 h-1.5 bg-stone-500 rounded-full" />
              <span>Clock: <b className="text-white">{localTimeStr}</b></span>
            </div>

            {/* Moon phases (Interactive and Expandable Dialog Trigger) */}
            <button
              onClick={() => setIsMoonModalOpen(true)}
              className="px-3 py-1.5 bg-[#2b2d31] border border-[#1e1f22] hover:border-[#5865F2]/45 rounded-xl text-xs font-sans text-stone-300 flex items-center gap-2 select-none hover:bg-[#35373c] transition-all cursor-pointer active:scale-95 shadow-sm shrink-0"
              title="Click to view detailed Cornwall astronomical lunar age analysis"
              id="moonphase-expansion-trigger"
            >
              <MoonGraphic iconType={currentMoonPhase.iconType} />
              <span className="text-[10px] text-stone-300 font-semibold">{currentMoonPhase.name}</span>
            </button>

            {/* IP configuration UI */}
            <div className="px-3 py-1.5 bg-[#2b2d31] border border-[#1e1f22] rounded-xl text-xs flex items-center gap-2 transition-colors">
              <div className="w-2 h-2 rounded-full bg-emerald-500" />
              
              {isEditingIp ? (
                <div className="flex items-center gap-1.5">
                  <input
                    type="text"
                    value={tempIp}
                    onChange={(e) => setTempIp(e.target.value)}
                    className="bg-[#1e1f22] border border-[#3f4147] rounded px-1.5 py-0.5 text-xs text-white w-32 focus:outline-hidden focus:border-[#5865F2] text-center font-mono"
                    id="tailscale-ip-input"
                  />
                  <button
                    onClick={() => {
                      if (tempIp.trim()) {
                        setTailscaleIp(tempIp.trim());
                        setIsEditingIp(false);
                      }
                    }}
                    className="text-[9px] bg-[#5865F2] hover:bg-[#4752c4] text-white px-1.5 py-0.5 rounded font-bold cursor-pointer"
                    id="save-ip-button"
                  >
                    Save
                  </button>
                  <button
                    onClick={() => {
                      setTempIp(tailscaleIp);
                      setIsEditingIp(false);
                    }}
                    className="text-stone-400 hover:text-white"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </div>
              ) : (
                <div className="flex items-center gap-1.5">
                  <span className="text-stone-400 font-mono text-[11px]">IP:</span>
                  <span className="font-bold text-white font-mono tracking-tight">{tailscaleIp}</span>
                  <button
                    onClick={() => setIsEditingIp(true)}
                    className="text-stone-550 hover:text-white p-0.5 cursor-pointer rounded transition-colors"
                    title="Edit IP"
                  >
                    <Settings className="w-3 h-3" />
                  </button>
                </div>
              )}
            </div>

            {/* Clerk User Avatar and Sign Out Button */}
            <div className="flex items-center gap-2">
              {user?.imageUrl && (
                <img 
                  src={user.imageUrl} 
                  alt={user.fullName || "User Profile"} 
                  className="w-6.5 h-6.5 rounded-full ring-2 ring-[#5865F2]/45 shrink-0"
                  referrerPolicy="no-referrer"
                />
              )}
              <button
                onClick={() => signOut()}
                className="px-3 py-1.5 bg-[#4e5058]/40 hover:bg-rose-600/20 hover:text-rose-400 border border-[#3f4147]/50 rounded-xl text-xs font-sans text-stone-300 flex items-center gap-1.5 cursor-pointer transition-all duration-150 shadow-xs active:scale-[0.98]"
                title="Sign out of the security portal"
                id="portal-logout-button"
              >
                <LogOut className="w-3.5 h-3.5" />
                <span>Sign Out</span>
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Grid Block */}
      <main className="max-w-[1600px] mx-auto px-4 sm:px-6 py-6 w-full flex-grow flex flex-col gap-6 relative z-10">
        
        {/* Top rows: Weather & News side by side on desktop, stacked on mobile */}
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 items-start">
          {/* Left Column (Weather & Starship Telemetry) */}
          <div className="lg:col-span-1 flex flex-col gap-6">
            <WeatherWidget />
            <StarshipWidget />
          </div>

          {/* Right Column (News Stream) */}
          <div className="lg:col-span-3">
            <NewsAgent />
          </div>
        </div>

        {/* Bottom Section: Docker Link Shortcuts (Permanently Undocked & Open) */}
        <div className="w-full">
          {/* Docker Containers Section */}
          <section className="bg-[#2b2d31] border border-[#1e1f22]/95 rounded-2xl p-4 sm:p-5 shadow-md hover:border-[#3f4147]/40 transition-[border-color] duration-300">
            
            {/* Top Header bar with settings gear icon (Undocked/Uncollapsible) */}
            <div className="flex items-center justify-between border-b border-[#3f4147]/20 pb-3 mb-4 select-none">
              <div className="flex items-center gap-2.5 flex-grow">
                <div className="p-1.5 bg-[#5865F2]/10 border border-[#5865F2]/25 text-[#5865F2] rounded-lg shrink-0">
                  <Layers className="w-4 h-4" />
                </div>
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <h2 className="text-sm font-bold text-white tracking-tight">Docker Shortcuts</h2>
                    <span className="bg-[#1e1f22] border border-[#3f4147]/40 px-1.5 py-0.5 rounded-full text-[9px] text-stone-400 font-mono font-semibold">
                      {services.length} endpoints
                    </span>
                  </div>
                  <p className="text-[10px] text-stone-400 font-sans mt-0.5">
                    Homelab console shortcuts permanently undocked and active
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                {/* Small button for container settings */}
                <button
                  onClick={() => setIsContainerSettingsOpen(prev => !prev)}
                  className={`p-1.5 rounded-lg border transition-colors flex items-center justify-center cursor-pointer ${
                    isContainerSettingsOpen
                      ? "bg-[#5865F2] border-[#5865F2] text-white"
                      : "bg-[#1e1f22] border-[#1e1f22] hover:bg-[#35373c]/50 hover:border-[#3f4147]/60 text-stone-400 hover:text-stone-200"
                  }`}
                  title="Configure Container Shortcuts"
                  id="admin-docker-settings-btn"
                >
                  <Settings className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>

            {/* Container settings popup/inline panel inside the card */}
            {isContainerSettingsOpen && (
              <div className="bg-[#1e1f22]/50 border border-[#3f4147]/20 p-3.5 rounded-xl mb-4 space-y-3 animate-[fadeIn_0.15s_ease-out]">
                <div className="flex items-center justify-between border-b border-[#3f4147]/20 pb-2">
                  <span className="text-[9px] text-stone-400 uppercase font-mono font-bold tracking-wider">Add Custom Docker Shortcut</span>
                  <button
                    onClick={() => setIsContainerSettingsOpen(false)}
                    className="text-stone-550 hover:text-stone-350 transition-colors"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>

                <form onSubmit={handleAddService} className="grid grid-cols-1 md:grid-cols-4 gap-3 items-end">
                  <div>
                    <label className="block text-[9px] uppercase font-mono tracking-wider text-stone-400 mb-1 font-bold">Service Name</label>
                    <input
                      type="text"
                      required
                      value={newServiceName}
                      onChange={(e) => setNewServiceName(e.target.value)}
                      placeholder="e.g. Navidrome"
                      className="w-full text-xs font-sans bg-[#1e1f22] border border-[#3f4147]/40 focus:border-[#5865F2] rounded-xl px-2.5 py-1.5 text-white focus:outline-hidden"
                    />
                  </div>
                  <div>
                    <label className="block text-[9px] uppercase font-mono tracking-wider text-stone-400 mb-1 font-bold">Port Number</label>
                    <input
                      type="number"
                      required
                      value={newServicePort}
                      onChange={(e) => setNewServicePort(e.target.value)}
                      placeholder="e.g. 4533"
                      className="w-full text-xs font-sans bg-[#1e1f22] border border-[#3f4147]/40 focus:border-[#5865F2] rounded-xl px-2.5 py-1.5 text-white focus:outline-hidden"
                    />
                  </div>
                  <div>
                    <label className="block text-[9px] uppercase font-mono tracking-wider text-stone-400 mb-1 font-bold">Icon Class</label>
                    <select
                      value={newServiceIcon}
                      onChange={(e) => setNewServiceIcon(e.target.value)}
                      className="w-full text-xs font-sans bg-[#1e1f22] border border-[#3f4147]/40 focus:border-[#5865F2] rounded-xl px-2 py-1.5 text-[#dbdee1] font-medium focus:outline-hidden"
                    >
                      <option value="Server">Server Icon</option>
                      <option value="Music">Music Icon</option>
                      <option value="Film">Film Icon</option>
                      <option value="Tv">TV Icon</option>
                      <option value="Image">Image Icon</option>
                      <option value="DownloadCloud">Download Icon</option>
                      <option value="Headphones">Podcast Icon</option>
                      <option value="Lock">Lock Icon</option>
                      <option value="Activity">Chart Icon</option>
                    </select>
                  </div>
                  <button
                    type="submit"
                    className="w-full py-1.5 bg-[#5865F2] hover:bg-[#4752c4] text-white font-bold text-xs rounded-xl transition-all cursor-pointer shadow-xs active:scale-97 h-[34px] flex items-center justify-center gap-1"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Add Link Card</span>
                  </button>
                </form>
              </div>
            )}

            {/* Grid of services displays permanently open and active */}
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-2.5 animate-[fadeIn_0.2s_ease-out]">
              {services.map((service) => {
                const url = `http://${tailscaleIp}:${service.port}`;
                return (
                  <a
                    key={service.id}
                    href={url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="group relative border border-[#1e1f22] bg-[#313338] hover:border-[#3f4147] rounded-xl p-2.5 flex items-center justify-between gap-1.5 shadow-xs hover:shadow-md transition-all duration-150"
                  >
                    <div className="flex items-center gap-2 min-w-0 flex-1">
                      {/* Compact Slim Icon */}
                      <div className="p-1.5 border border-[#3f4147]/20 rounded-lg shrink-0 bg-[#5865F2]/10 text-[#5865F2] group-hover:bg-[#5865F2]/20 group-hover:text-white transition-all">
                        {renderServiceIcon(service.iconName, "w-3.5 h-3.5")}
                      </div>

                      {/* Name and Port */}
                      <div className="flex-1 min-w-0">
                        <h3 className="text-xs font-bold text-white tracking-tight group-hover:text-[#5865F2] transition-colors truncate">
                          {service.name}
                        </h3>
                        <div className="flex items-center gap-1 mt-0.5">
                          <span className="text-[9px] text-stone-400 font-mono font-semibold">
                            :{service.port}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Delete Custom Services Button */}
                    {service.isCustom && (
                      <button
                        onClick={(e) => handleRemoveService(service.id, e)}
                        className="text-stone-550 hover:text-red-400 transition-colors p-1 rounded-md cursor-pointer shrink-0 ml-1 select-none"
                        title="Delete custom container"
                        id={`delete-btn-${service.id}`}
                      >
                        <X className="w-3" />
                      </button>
                    )}
                  </a>
                );
              })}
            </div>
          </section>
        </div>
      </main>

      {/* Discord Styled Footer */}
      <footer className="max-w-[1600px] mx-auto px-6 mt-6 border-t border-[#1e1f22] pt-6 text-center text-stone-500 text-[10px] font-sans flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 shrink-0">
        <p>HMG Intranet homelab engine &bull; No active status circles (clean view)</p>
        <p className="font-mono text-stone-550 uppercase tracking-widest text-[8px]">
          Node Host Server &bull; Port 3000 &bull; Redruth Cornwall UK &bull; {tailscaleIp}
        </p>
      </footer>

      {/* Expanded Moon Phase Modal Details Overlay */}
      {isMoonModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#111214]/80 backdrop-blur-md animate-[fadeIn_0.18s_ease-out]">
          {/* Backdrop Click */}
          <div className="absolute inset-0 cursor-default" onClick={() => setIsMoonModalOpen(false)} />

          <div className="relative w-full max-w-sm bg-[#2b2d31] border border-[#3f4147]/50 rounded-3xl shadow-[0_16px_50px_rgba(0,0,0,0.65)] overflow-hidden animate-[scaleIn_0.2s_ease-out]">
            {/* Modal Header */}
            <div className="bg-[#1e1f22]/70 p-4 border-b border-[#1e1f22] flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Moon className="w-4 h-4 text-[#fef08a] animate-pulse" />
                <span className="text-[10px] uppercase font-mono font-bold tracking-wider text-stone-300">Cornwall Lunar observatory</span>
              </div>
              <button
                onClick={() => setIsMoonModalOpen(false)}
                className="p-1.5 rounded-lg text-stone-400 hover:text-white hover:bg-[#35373c] transition-colors cursor-pointer"
                title="Close modal"
                id="close-moon-modal"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-5 flex flex-col items-center">
              {/* Scalable graphic */}
              <LargeMoonGraphic iconType={currentMoonPhase.iconType} />

              <div className="text-center mt-3">
                <span className="text-[10px] uppercase font-mono tracking-wider font-bold text-[#5586F2] bg-[#5865F2]/10 border border-[#5865F2]/25 px-2 py-0.5 rounded-md">
                  Active Orbit Stage
                </span>
                <h3 className="text-md font-black text-white tracking-tight font-sans mt-2">{currentMoonPhase.name}</h3>
                <span className="text-xs text-amber-300 font-mono font-bold block mt-1">{currentMoonPhase.illumination}% Illumination</span>
              </div>

              {/* Grid of details */}
              <div className="w-full grid grid-cols-2 gap-2.5 mt-5 border-t border-[#3f4147]/20 pt-4">
                <div className="bg-[#1e1f22]/55 border border-[#3f4147]/25 rounded-xl p-2.5 text-center">
                  <span className="block text-[8px] uppercase font-mono tracking-wider text-stone-400 font-bold">Lunar Cycle Age</span>
                  <span className="block text-xs font-extrabold text-white font-sans mt-0.5">{currentMoonPhase.moonAge} days</span>
                  <span className="text-[9px] text-stone-500 font-mono">of 29.53 day cycle</span>
                </div>

                <div className="bg-[#1e1f22]/55 border border-[#3f4147]/25 rounded-xl p-2.5 text-center">
                  <span className="block text-[8px] uppercase font-mono tracking-wider text-stone-400 font-bold">Orbital Progress</span>
                  <span className="block text-xs font-extrabold text-[#5865F2] font-sans mt-0.5">{currentMoonPhase.cyclePercent}%</span>
                  <span className="text-[9px] text-stone-500 font-mono">path completion</span>
                </div>

                <div className="bg-[#1e1f22]/55 border border-[#3f4147]/25 rounded-xl p-2.5 text-center">
                  <span className="block text-[8px] uppercase font-mono tracking-wider text-stone-400 font-bold">Next Full Moon</span>
                  <span className="block text-[10px] font-bold text-emerald-400 font-mono mt-0.5 px-0.5 truncate" title={currentMoonPhase.nextFullMoon}>
                    {currentMoonPhase.nextFullMoon}
                  </span>
                  <span className="text-[9px] text-stone-500 font-sans">High Tide peak</span>
                </div>

                <div className="bg-[#1e1f22]/55 border border-[#3f4147]/25 rounded-xl p-2.5 text-center">
                  <span className="block text-[8px] uppercase font-mono tracking-wider text-stone-400 font-bold">Next New Moon</span>
                  <span className="block text-[10px] font-bold text-stone-300 font-mono mt-0.5 px-0.5 truncate" title={currentMoonPhase.nextNewMoon}>
                    {currentMoonPhase.nextNewMoon}
                  </span>
                  <span className="text-[9px] text-stone-500 font-sans">Dark Sky peak</span>
                </div>
              </div>

              {/* Cornwall Forecast Insights */}
              <div className="mt-4 w-full bg-[#1e1f22]/30 border border-[#3f4147]/25 rounded-xl p-3 flex items-start gap-2">
                <Info className="w-4 h-4 text-[#5865F2] shrink-0 mt-0.5" />
                <div className="text-[10px] text-stone-300 leading-normal font-sans">
                  <b className="text-white block font-bold mb-0.5">Physical Cornwall Gravitational Index:</b>
                  {currentMoonPhase.illumination >= 70 ? (
                    <span>Spring Tides active. High gravitational pulling forces registered. Majestic night skyline over Redruth.</span>
                  ) : currentMoonPhase.illumination <= 30 ? (
                    <span>Neap Tides active. Purest, stellar dark skies tonight. Outstanding orbital visibility over Bodmin Moors.</span>
                  ) : (
                    <span>Standard lunar gravitational coefficient. Consistent sea and communication atmospheric index.</span>
                  )}
                </div>
              </div>
            </div>

            {/* Modal Action Buttons */}
            <div className="bg-[#1e1f22]/40 px-4 py-3 border-t border-[#1e1f22] text-center">
              <button
                onClick={() => setIsMoonModalOpen(false)}
                className="px-4 py-1.5 bg-[#4e5058] hover:bg-[#5865F2] text-white text-[11px] font-mono font-bold rounded-xl transition-all cursor-pointer active:scale-97 select-none"
              >
                Close Telescope Dialog
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
