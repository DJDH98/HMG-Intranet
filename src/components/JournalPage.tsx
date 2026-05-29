import { FormEvent, useEffect, useMemo, useState } from "react";
import {
  BookOpenText,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Clock,
  Home,
  Save,
  Sparkles,
  Trash2
} from "lucide-react";
import {
  getMonthCalendarDays,
  isPastOrToday,
  loadJournalEntries,
  saveJournalEntries,
  toDateKey,
  upsertJournalEntry,
  type JournalEntry
} from "../journalStorage";

interface JournalPageProps {
  onBackHome: () => void;
  getAuthToken?: () => Promise<string | null>;
}

const formatLongDate = (dateKey: string) => {
  const [year, month, day] = dateKey.split("-").map(Number);
  return new Date(year, month - 1, day).toLocaleDateString("en-GB", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric"
  });
};

export default function JournalPage({ onBackHome, getAuthToken }: JournalPageProps) {
  const todayKey = toDateKey(new Date());
  const [entries, setEntries] = useState<JournalEntry[]>(() => loadJournalEntries(localStorage));
  const [selectedDate, setSelectedDate] = useState(todayKey);
  const [visibleMonth, setVisibleMonth] = useState(() => new Date());
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [aiAction, setAiAction] = useState<"title" | "cleanup" | null>(null);
  const [aiError, setAiError] = useState("");
  const [databaseStatus, setDatabaseStatus] = useState<"loading" | "synced" | "saving" | "local">("loading");
  const [databaseMessage, setDatabaseMessage] = useState("");

  const entriesByDate = useMemo(() => {
    return new Map(entries.map((entry) => [entry.date, entry]));
  }, [entries]);

  const selectedEntry = entriesByDate.get(selectedDate);
  const calendarDays = useMemo(() => getMonthCalendarDays(visibleMonth), [visibleMonth]);
  const canGoNextMonth = toDateKey(new Date(visibleMonth.getFullYear(), visibleMonth.getMonth() + 1, 1)) <= todayKey.slice(0, 7) + "-01";

  const buildAuthHeaders = async () => {
    const token = await getAuthToken?.();
    return token ? { Authorization: `Bearer ${token}` } : {};
  };

  useEffect(() => {
    saveJournalEntries(localStorage, entries);
  }, [entries]);

  useEffect(() => {
    let isMounted = true;

    async function loadDatabaseEntries() {
      try {
        const response = await fetch("/api/journal-entries", {
          headers: await buildAuthHeaders()
        });
        const data = await response.json().catch(() => ({}));

        if (!response.ok || !data.success || !Array.isArray(data.entries)) {
          throw new Error(data.error || "Journal database is unavailable.");
        }

        if (!isMounted) return;

        const localEntries = loadJournalEntries(localStorage);
        if (data.entries.length === 0 && localEntries.length > 0) {
          setDatabaseStatus("saving");
          let latestEntries = data.entries as JournalEntry[];

          for (const entry of localEntries) {
            const saveResponse = await fetch("/api/journal-entries", {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                ...(await buildAuthHeaders())
              },
              body: JSON.stringify({
                date: entry.date,
                title: entry.title,
                body: entry.body
              })
            });
            const saveData = await saveResponse.json().catch(() => ({}));
            if (saveResponse.ok && saveData.success && Array.isArray(saveData.entries)) {
              latestEntries = saveData.entries;
            }
          }

          if (!isMounted) return;
          setEntries(latestEntries);
          setDatabaseStatus("synced");
          setDatabaseMessage("Database synced. Local entries were backed up.");
          return;
        }

        setEntries(data.entries);
        setDatabaseStatus("synced");
        setDatabaseMessage("Database synced.");
      } catch (error: any) {
        if (!isMounted) return;
        setDatabaseStatus("local");
        setDatabaseMessage(error.message || "Using local browser storage.");
      }
    }

    loadDatabaseEntries();
    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    setTitle(selectedEntry?.title ?? "");
    setBody(selectedEntry?.body ?? "");
  }, [selectedEntry, selectedDate]);

  const handleSelectDate = (dateKey: string) => {
    if (!isPastOrToday(dateKey, todayKey)) return;
    setSelectedDate(dateKey);
  };

  const changeMonth = (offset: number) => {
    setVisibleMonth((current) => new Date(current.getFullYear(), current.getMonth() + offset, 1));
  };

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault();
    if (!body.trim() && !title.trim()) return;

    const optimisticEntries = upsertJournalEntry(entries, {
      date: selectedDate,
      title: title || "Untitled entry",
      body
    });
    setEntries(optimisticEntries);

    async function saveToDatabase() {
      setDatabaseStatus("saving");
      setDatabaseMessage("Saving to database...");

      try {
        const response = await fetch("/api/journal-entries", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            ...(await buildAuthHeaders())
          },
          body: JSON.stringify({
            date: selectedDate,
            title: title || "Untitled entry",
            body
          })
        });
        const data = await response.json().catch(() => ({}));

        if (!response.ok || !data.success || !Array.isArray(data.entries)) {
          throw new Error(data.error || "Journal database save failed.");
        }

        setEntries(data.entries);
        setDatabaseStatus("synced");
        setDatabaseMessage("Saved to database.");
      } catch (error: any) {
        setDatabaseStatus("local");
        setDatabaseMessage(error.message || "Saved locally only. Database sync failed.");
      }
    }

    saveToDatabase();
  };

  const handleDelete = () => {
    if (!selectedEntry) return;
    if (confirm(`Delete the journal entry for ${formatLongDate(selectedDate)}?`)) {
      setEntries((current) => current.filter((entry) => entry.date !== selectedDate));
      setDatabaseStatus("saving");
      setDatabaseMessage("Deleting from database...");

      buildAuthHeaders()
        .then((headers) => fetch(`/api/journal-entries?date=${encodeURIComponent(selectedDate)}`, {
          method: "DELETE",
          headers
        }))
        .then(async (response) => {
          const data = await response.json().catch(() => ({}));
          if (!response.ok || !data.success || !Array.isArray(data.entries)) {
            throw new Error(data.error || "Journal database delete failed.");
          }
          setEntries(data.entries);
          setDatabaseStatus("synced");
          setDatabaseMessage("Deleted from database.");
        })
        .catch((error: any) => {
          setDatabaseStatus("local");
          setDatabaseMessage(error.message || "Deleted locally only. Database sync failed.");
        });
    }
  };

  const handleJournalAi = async (action: "title" | "cleanup") => {
    if (!body.trim()) return;

    setAiAction(action);
    setAiError("");

    try {
      const response = await fetch("/api/journal-ai", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(await buildAuthHeaders())
        },
        body: JSON.stringify({ action, entry: body })
      });
      const data = await response.json().catch(() => ({}));

      if (!response.ok || !data.success || typeof data.text !== "string") {
        throw new Error(data.error || "Journal AI request failed.");
      }

      if (action === "title") {
        setTitle(data.text);
      } else {
        setBody(data.text);
      }
    } catch (error: any) {
      setAiError(error.message || "Journal AI request failed.");
    } finally {
      setAiAction(null);
    }
  };

  const monthLabel = visibleMonth.toLocaleDateString("en-GB", {
    month: "long",
    year: "numeric"
  });

  return (
    <main className="max-w-[1600px] mx-auto px-4 sm:px-6 py-6 w-full flex-grow flex flex-col gap-6 relative z-10">
      <section className="bg-[#2b2d31] border border-[#1e1f22]/95 rounded-2xl p-4 sm:p-5 shadow-md">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 border-b border-[#3f4147]/20 pb-4">
          <div className="flex items-center gap-3 min-w-0">
            <div className="p-2 bg-[#5865F2]/10 border border-[#5865F2]/25 text-[#5865F2] rounded-xl shrink-0">
              <BookOpenText className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <h2 className="text-lg font-bold text-white tracking-tight">Personal Journal</h2>
              <p className="text-xs text-stone-400 mt-0.5">
                Saved to the site database when available, with browser storage kept as a safety fallback.
              </p>
            </div>
          </div>

          <button
            onClick={onBackHome}
            className="px-3 py-2 bg-[#1e1f22] hover:bg-[#35373c]/50 border border-[#3f4147]/40 rounded-xl text-xs font-bold text-stone-200 flex items-center justify-center gap-2 cursor-pointer transition-colors"
            id="journal-home-link"
          >
            <Home className="w-4 h-4" />
            <span>Dashboard</span>
          </button>
        </div>

        <div className={`mt-4 rounded-xl border px-3 py-2 text-xs ${
          databaseStatus === "synced"
            ? "bg-emerald-500/10 border-emerald-500/25 text-emerald-200"
            : databaseStatus === "saving" || databaseStatus === "loading"
              ? "bg-[#5865F2]/10 border-[#5865F2]/25 text-[#b7c0ff]"
              : "bg-amber-500/10 border-amber-500/25 text-amber-200"
        }`}>
          {databaseStatus === "loading"
            ? "Connecting to journal database..."
            : databaseMessage || "Journal database status pending."}
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1.05fr)_minmax(360px,0.95fr)] gap-5 pt-5">
          <div className="bg-[#1e1f22]/40 border border-[#3f4147]/25 rounded-xl p-3 sm:p-4">
            <div className="flex items-center justify-between gap-3 mb-4">
              <button
                onClick={() => changeMonth(-1)}
                className="p-2 bg-[#2b2d31] hover:bg-[#35373c] border border-[#3f4147]/35 rounded-lg text-stone-300 cursor-pointer transition-colors"
                title="Previous month"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <div className="flex items-center gap-2 text-white font-bold">
                <CalendarDays className="w-4 h-4 text-[#5865F2]" />
                <span>{monthLabel}</span>
              </div>
              <button
                onClick={() => changeMonth(1)}
                disabled={!canGoNextMonth}
                className="p-2 bg-[#2b2d31] hover:bg-[#35373c] disabled:opacity-35 disabled:hover:bg-[#2b2d31] border border-[#3f4147]/35 rounded-lg text-stone-300 cursor-pointer disabled:cursor-not-allowed transition-colors"
                title="Next month"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>

            <div className="grid grid-cols-7 gap-1.5 text-center text-[10px] font-mono font-bold uppercase tracking-wider text-stone-500 mb-2">
              {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((day) => (
                <span key={day}>{day}</span>
              ))}
            </div>

            <div className="grid grid-cols-7 gap-1.5">
              {calendarDays.map((day) => {
                const hasEntry = entriesByDate.has(day.dateKey);
                const isSelected = selectedDate === day.dateKey;
                const isFuture = !isPastOrToday(day.dateKey, todayKey);

                return (
                  <button
                    key={day.dateKey}
                    onClick={() => handleSelectDate(day.dateKey)}
                    disabled={isFuture}
                    className={`aspect-square min-h-12 rounded-lg border text-left p-1.5 sm:p-2 transition-colors relative overflow-hidden ${
                      isSelected
                        ? "bg-[#5865F2] border-[#5865F2] text-white"
                        : "bg-[#2b2d31] border-[#3f4147]/25 text-stone-200 hover:border-[#5865F2]/60 hover:bg-[#35373c]/60"
                    } ${!day.isCurrentMonth ? "opacity-45" : ""} ${isFuture ? "opacity-25 cursor-not-allowed hover:border-[#3f4147]/25 hover:bg-[#2b2d31]" : "cursor-pointer"}`}
                    title={formatLongDate(day.dateKey)}
                  >
                    <span className="text-xs font-bold">{day.date.getDate()}</span>
                    {hasEntry && (
                      <span className={`absolute bottom-1.5 right-1.5 w-2 h-2 rounded-full ${isSelected ? "bg-white" : "bg-emerald-400"}`} />
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="bg-[#1e1f22]/40 border border-[#3f4147]/25 rounded-xl p-3 sm:p-4 flex flex-col gap-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <span className="text-[10px] text-stone-500 font-mono font-bold uppercase tracking-wider">Selected day</span>
                <h3 className="text-md font-bold text-white mt-1">{formatLongDate(selectedDate)}</h3>
              </div>
              {selectedEntry && (
                <button
                  onClick={handleDelete}
                  className="p-2 bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/25 rounded-lg text-rose-300 cursor-pointer transition-colors"
                  title="Delete entry"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              )}
            </div>

            <form onSubmit={handleSubmit} className="flex flex-col gap-3">
              <div>
                <div className="flex items-center justify-between gap-2 mb-1">
                  <label className="block text-[9px] uppercase font-mono tracking-wider text-stone-400 font-bold">Title</label>
                  <button
                    type="button"
                    onClick={() => handleJournalAi("title")}
                    disabled={!body.trim() || aiAction !== null}
                    className="px-2 py-1 bg-[#5865F2]/10 hover:bg-[#5865F2]/20 disabled:opacity-35 disabled:hover:bg-[#5865F2]/10 border border-[#5865F2]/25 rounded-lg text-[10px] font-bold text-[#5865F2] flex items-center gap-1.5 cursor-pointer disabled:cursor-not-allowed transition-colors"
                    title="Generate a title from the current entry"
                  >
                    <Sparkles className={`w-3.5 h-3.5 ${aiAction === "title" ? "animate-pulse" : ""}`} />
                    <span>{aiAction === "title" ? "Generating" : "Generate Title"}</span>
                  </button>
                </div>
                <input
                  value={title}
                  onChange={(event) => setTitle(event.target.value)}
                  placeholder="A short title"
                  className="w-full text-sm bg-[#1e1f22] border border-[#3f4147]/40 focus:border-[#5865F2] rounded-xl px-3 py-2 text-white focus:outline-hidden"
                />
              </div>

              <div className="flex-1">
                <div className="flex items-center justify-between gap-2 mb-1">
                  <label className="block text-[9px] uppercase font-mono tracking-wider text-stone-400 font-bold">Entry</label>
                  <button
                    type="button"
                    onClick={() => handleJournalAi("cleanup")}
                    disabled={!body.trim() || aiAction !== null}
                    className="px-2 py-1 bg-emerald-500/10 hover:bg-emerald-500/20 disabled:opacity-35 disabled:hover:bg-emerald-500/10 border border-emerald-500/25 rounded-lg text-[10px] font-bold text-emerald-300 flex items-center gap-1.5 cursor-pointer disabled:cursor-not-allowed transition-colors"
                    title="Clean up spelling and phrasing in the current entry"
                  >
                    <Sparkles className={`w-3.5 h-3.5 ${aiAction === "cleanup" ? "animate-pulse" : ""}`} />
                    <span>{aiAction === "cleanup" ? "Cleaning" : "Clean Up Entry"}</span>
                  </button>
                </div>
                <textarea
                  value={body}
                  onChange={(event) => setBody(event.target.value)}
                  placeholder="Write what happened today..."
                  rows={12}
                  className="w-full resize-y min-h-64 text-sm leading-relaxed bg-[#1e1f22] border border-[#3f4147]/40 focus:border-[#5865F2] rounded-xl px-3 py-2 text-white focus:outline-hidden"
                />
              </div>

              {aiError && (
                <div className="bg-rose-500/10 border border-rose-500/25 text-rose-200 rounded-xl px-3 py-2 text-xs leading-relaxed">
                  {aiError}
                </div>
              )}

              <button
                type="submit"
                className="w-full py-2.5 bg-[#5865F2] hover:bg-[#4752c4] text-white font-bold text-xs rounded-xl transition-all cursor-pointer shadow-xs active:scale-97 flex items-center justify-center gap-2"
              >
                <Save className="w-4 h-4" />
                <span>{selectedEntry ? "Update Entry" : "Save Entry"}</span>
              </button>
            </form>
          </div>
        </div>
      </section>

      <section className="bg-[#2b2d31] border border-[#1e1f22]/95 rounded-2xl p-4 sm:p-5 shadow-md">
        <div className="flex items-center gap-2 border-b border-[#3f4147]/20 pb-3 mb-4">
          <Clock className="w-4 h-4 text-[#5865F2]" />
          <h2 className="text-sm font-bold text-white tracking-tight">Recent Entries</h2>
          <span className="bg-[#1e1f22] border border-[#3f4147]/40 px-1.5 py-0.5 rounded-full text-[9px] text-stone-400 font-mono font-semibold">
            {entries.length} saved
          </span>
        </div>

        {entries.length === 0 ? (
          <div className="text-sm text-stone-400 bg-[#1e1f22]/40 border border-[#3f4147]/25 rounded-xl p-4">
            No journal entries saved in this browser yet.
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
            {entries.slice(0, 6).map((entry) => (
              <button
                key={entry.id}
                onClick={() => {
                  setSelectedDate(entry.date);
                  const [year, month] = entry.date.split("-").map(Number);
                  setVisibleMonth(new Date(year, month - 1, 1));
                }}
                className="text-left bg-[#313338] hover:bg-[#35373c]/60 border border-[#1e1f22] hover:border-[#5865F2]/45 rounded-xl p-3 cursor-pointer transition-colors"
              >
                <div className="flex items-center justify-between gap-2 mb-2">
                  <span className="text-xs font-bold text-white truncate">{entry.title}</span>
                  <span className="text-[10px] text-stone-400 font-mono shrink-0">{entry.date}</span>
                </div>
                <p className="text-xs text-stone-400 leading-relaxed line-clamp-3">{entry.body || "No body text."}</p>
              </button>
            ))}
          </div>
        )}
      </section>
    </main>
  );
}
