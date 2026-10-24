import { useEffect, useState, type FormEvent } from "react";
import type { AnalysisResponse } from "../services/audioApi";

const API_BASE = (import.meta.env.VITE_API_BASE_URL || "http://127.0.0.1:8000").replace(/\/$/, "");

type Stats = { total: number; label_0: number; label_1: number; target?: number };

type Props = { analysisResult: AnalysisResponse; singingFilename?: string };

export default function MLTrainingFeedback({ analysisResult, singingFilename }: Props) {
  const [label, setLabel] = useState<"0" | "1" | "">("");
  const [singerId, setSingerId] = useState("singer001");
  const [songId, setSongId] = useState("song001");
  const [stats, setStats] = useState<Stats | null>(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    setLabel("");
    setSaved(false);
    setMessage("");
    setError("");
  }, [analysisResult]);

  useEffect(() => {
    let live = true;
    fetch(`${API_BASE}/ml-feedback/stats`)
      .then((res) => { if (!res.ok) throw new Error(); return res.json(); })
      .then((data: Stats) => { if (live) setStats(data); })
      .catch(() => { /* Statistics are optional; saving still reports connection errors. */ });
    return () => { live = false; };
  }, []);

  async function saveSample(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!label || saved || saving) return;
    setError("");
    setMessage("");
    setSaving(true);
    try {
      const payload = new FormData();
      const json = new Blob([JSON.stringify(analysisResult)], { type: "application/json" });
      payload.append("file", json, "analysis.json");
      payload.append("label", label);
      payload.append("recording_id", `web_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 9)}`);
      payload.append("singer_id", singerId.trim());
      payload.append("song_id", songId.trim());

      const response = await fetch(`${API_BASE}/ml-feedback`, { method: "POST", body: payload });
      const result = await response.json();
      if (!response.ok) {
        throw new Error(typeof result.detail === "string" ? result.detail : "Unable to save the training sample.");
      }
      setSaved(true);
      setStats({ total: result.total, label_0: result.label_0, label_1: result.label_1, target: 30 });
      setMessage("Training feedback saved locally. Thank you for reviewing this recording.");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Cannot connect to FastAPI. Check that the backend is running.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <section aria-labelledby="training-feedback-heading" className="mt-8 rounded-2xl border border-violet-400/20 bg-slate-900/80 p-5 shadow-lg shadow-black/10 sm:p-7">
      <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-start">
        <div>
          <p className="text-xs font-semibold uppercase tracking-widest text-violet-300">Optional · ML research</p>
          <h3 id="training-feedback-heading" className="mt-2 text-xl font-bold text-white">Help train our practice model</h3>
          <p className="mt-2 text-sm leading-6 text-slate-300">
            Listen to the recording yourself, then label whether pitch-control practice is a priority. Your choice saves numeric pitch features to the local training dataset — not the raw audio.
          </p>
          {singingFilename && <p className="mt-2 break-all text-xs text-slate-400">Recording: {singingFilename}</p>}
        </div>
        {stats && <div className="shrink-0 rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-center text-sm text-white">
          <span className="block text-lg font-bold text-violet-200">{stats.total} / {stats.target ?? 30}</span>
          <span className="text-xs text-slate-400">reviewed samples</span>
          <span className="mt-1 block text-xs text-slate-400">Label 0: {stats.label_0} · Label 1: {stats.label_1}</span>
        </div>}
      </div>

      <form onSubmit={saveSample} className="mt-6 space-y-5">
        <fieldset disabled={saving || saved}>
          <legend className="mb-3 text-sm font-semibold text-white">Your independent listening judgment</legend>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className={`flex cursor-pointer gap-3 rounded-xl border p-4 transition ${label === "0" ? "border-emerald-400 bg-emerald-500/10" : "border-white/15 bg-white/5 hover:border-white/30"}`}>
              <input type="radio" name="pitch-review" checked={label === "0"} onChange={() => setLabel("0")} className="mt-1 accent-emerald-500" />
              <span className="text-sm text-slate-200"><strong className="block text-white">Label 0</strong>No immediate pitch-control practice priority</span>
            </label>
            <label className={`flex cursor-pointer gap-3 rounded-xl border p-4 transition ${label === "1" ? "border-violet-400 bg-violet-500/10" : "border-white/15 bg-white/5 hover:border-white/30"}`}>
              <input type="radio" name="pitch-review" checked={label === "1"} onChange={() => setLabel("1")} className="mt-1 accent-violet-500" />
              <span className="text-sm text-slate-200"><strong className="block text-white">Label 1</strong>Needs additional pitch-control practice</span>
            </label>
          </div>
        </fieldset>

        <div className="grid gap-3 sm:grid-cols-2">
          <label className="block text-sm text-slate-300">Anonymous singer ID
            <input value={singerId} onChange={(e) => setSingerId(e.target.value)} maxLength={64} required disabled={saving || saved} className="mt-1 block w-full rounded-lg border border-white/20 bg-slate-950 px-3 py-2 text-white outline-none focus:border-violet-400" placeholder="singer001" />
          </label>
          <label className="block text-sm text-slate-300">Song/passage ID
            <input value={songId} onChange={(e) => setSongId(e.target.value)} maxLength={64} required disabled={saving || saved} className="mt-1 block w-full rounded-lg border border-white/20 bg-slate-950 px-3 py-2 text-white outline-none focus:border-violet-400" placeholder="song001" />
          </label>
        </div>
        <p className="text-xs leading-5 text-slate-400">Use the same singer ID for the same singer and a different ID for a different singer. Human labels are not automatically determined by the AI graph.</p>
        <button type="submit" disabled={!label || saving || saved} className="rounded-xl bg-violet-600 px-5 py-3 text-sm font-semibold text-white transition hover:bg-violet-500 disabled:cursor-not-allowed disabled:opacity-50">
          {saving ? "Saving…" : saved ? "Saved to training dataset" : "Save Training Sample"}
        </button>
        {message && <p role="status" className="text-sm text-emerald-300">{message}</p>}
        {error && <p role="alert" className="rounded-lg border border-red-400/25 bg-red-500/10 px-4 py-3 text-sm text-red-200">{error}</p>}
      </form>
    </section>
  );
}
