import { useEffect, useState } from "react";
import {
  deleteHistory,
  getHistory,
  listHistory,
  type HistoryEntry,
  type HistorySummary,
} from "../services/historyApi";
import PitchResults from "./PitchResults";
import ReferenceComparison from "./ReferenceComparison";

interface Props {
  refreshKey: number;
}

export default function AnalysisHistory({ refreshKey }: Props) {
  const [items, setItems] = useState<HistorySummary[]>([]);
  const [manualRefresh, setManualRefresh] = useState(0);
  const [selected, setSelected] = useState<HistoryEntry | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingId, setLoadingId] = useState<number | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    setLoading(true);
    listHistory()
      .then((rows) => {
        if (active) { setItems(rows); setError(""); }
      })
      .catch((err: unknown) => {
        if (active) setError(err instanceof Error ? err.message : "Cannot load history");
      })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [refreshKey, manualRefresh]);

  async function openEntry(id: number) {
    if (selected?.id === id) {
      setSelected(null);
      return;
    }
    setLoadingId(id);
    setError("");
    try {
      setSelected(await getHistory(id));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not open saved result");
    } finally {
      setLoadingId(null);
    }
  }

  async function removeEntry(id: number) {
    if (!window.confirm("Delete this saved analysis? This cannot be undone.")) return;
    setError("");
    try {
      await deleteHistory(id);
      setItems((previous) => previous.filter((item) => item.id !== id));
      if (selected?.id === id) setSelected(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not delete result");
    }
  }

  return (
    <section id="history" className="bg-slate-900/50 px-4 py-16 sm:px-6 sm:py-20">
      <div className="mx-auto max-w-4xl">
        <h2 className="text-center text-2xl font-bold sm:text-3xl">Analysis History</h2>
        <p className="mx-auto mt-3 max-w-2xl text-center text-sm leading-relaxed text-slate-400">
          Revisit past pitch results and graphs. Results are saved in SQLite on this local backend;
          uploaded audio files are not stored.
        </p>

        <div className="mt-6 flex flex-wrap items-center justify-between gap-3">
          <p className="text-xs text-slate-400">
            {loading ? "Checking saved results..." : `${items.length} recent saved ${items.length === 1 ? "analysis" : "analyses"}`}
          </p>
          <button
            type="button"
            onClick={() => setManualRefresh((previous) => previous + 1)}
            disabled={loading}
            className="rounded-lg border border-white/20 px-4 py-2 text-sm text-slate-200 transition hover:bg-white/10 disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-violet-400"
          >
            Refresh history
          </button>
        </div>

        {error && (
          <p role="alert" className="mt-6 rounded-xl border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-200">
            {error}
          </p>
        )}

        {loading ? (
          <p role="status" className="mt-8 text-center text-slate-400">Loading saved analyses...</p>
        ) : items.length === 0 ? (
          <p className="mt-8 rounded-2xl border border-white/10 bg-slate-900 p-7 text-center text-slate-400">
            No saved analyses yet. Complete a singing analysis and it will appear here.
          </p>
        ) : (
          <div className="mt-8 space-y-3">
            {items.map((item) => (
              <div key={item.id} className="rounded-xl border border-white/10 bg-slate-900 p-4 sm:p-5">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-medium uppercase tracking-wide text-violet-300">
                      {item.mode === "free" ? "Free singing" : "Reference comparison"}
                    </p>
                    <p className="mt-1 break-all font-medium text-white">{item.singing_filename}</p>
                    {item.reference_filename && (
                      <p className="mt-1 break-all text-xs text-slate-400">Reference: {item.reference_filename}</p>
                    )}
                    <p className="mt-2 text-xs text-slate-400">
                      {new Date(item.created_at).toLocaleString()} · {item.duration_seconds.toFixed(1)}s
                      {item.median_pitch_hz !== null ? ` · median ${item.median_pitch_hz.toFixed(1)} Hz` : ""}
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => void openEntry(item.id)}
                      disabled={loadingId !== null}
                      className="rounded-lg bg-violet-600 px-3 py-2 text-sm font-medium text-white hover:bg-violet-500 disabled:opacity-50"
                    >
                      {loadingId === item.id ? "Loading..." : selected?.id === item.id ? "Close" : "View"}
                    </button>
                    <button
                      type="button"
                      onClick={() => void removeEntry(item.id)}
                      className="rounded-lg border border-red-500/30 px-3 py-2 text-sm text-red-300 hover:bg-red-500/10"
                    >
                      Delete
                    </button>
                  </div>
                </div>
                {selected?.id === item.id && (
                  <div className="mt-6 border-t border-white/10 pt-2">
                    {selected.mode === "compare" && selected.reference ? (
                      <ReferenceComparison singing={selected.singing} reference={selected.reference} />
                    ) : (
                      <PitchResults result={selected.singing} />
                    )}
                    <p className="mt-4 text-xs text-slate-500">
                      Saved pitch estimates only. Audio playback is unavailable for historical entries.
                    </p>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
        <p className="mt-5 text-xs text-slate-500">
          This is a local, single-user history feature. Authentication must be added before public deployment.
        </p>
      </div>
    </section>
  );
}
