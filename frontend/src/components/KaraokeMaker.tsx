import KaraokePractice from "./KaraokePractice";
import { useId, useRef, useState, type ChangeEvent, type FormEvent, type ReactNode } from "react";

const API_BASE = (import.meta.env.VITE_API_BASE_URL || "http://127.0.0.1:8000").replace(/\/$/, "");
const MAX_MB = 50;
const ALLOWED_EXTENSIONS = ["mp3", "wav", "m4a", "flac", "ogg"];

type KaraokeResult = {
  job_id: string;
  filename: string;
  duration_seconds: number;
  karaoke_url: string;
  vocals_url: string;
};

function Icon({ kind, className = "h-5 w-5" }: { kind: "wave" | "upload" | "music" | "mic" | "download" | "check" | "file" | "sparkles"; className?: string }) {
  const common = { className, fill: "none", stroke: "currentColor", strokeWidth: 1.8, strokeLinecap: "round" as const, strokeLinejoin: "round" as const, viewBox: "0 0 24 24", "aria-hidden": true as const };
  const paths: Record<typeof kind, ReactNode> = {
    wave: <><path d="M2 12h2m2-4v8m3-12v16m3-13v10m3-14v18m3-12v6m3-4h1" /></>,
    upload: <><path d="M12 16V4m0 0L7 9m5-5 5 5M4 16v3a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-3" /></>,
    music: <><path d="M9 18V5l12-2v13" /><circle cx="6" cy="18" r="3" /><circle cx="18" cy="16" r="3" /></>,
    mic: <><rect x="9" y="2" width="6" height="13" rx="3" /><path d="M5 10a7 7 0 0 0 14 0M12 17v5m-4 0h8" /></>,
    download: <><path d="M12 3v13m0 0-5-5m5 5 5-5M5 17v3h14v-3" /></>,
    check: <path d="m5 12 4 4L19 6" />,
    file: <><path d="M13 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z" /><path d="M13 2v7h7" /></>,
    sparkles: <><path d="m12 3 1.7 5.3L19 10l-5.3 1.7L12 17l-1.7-5.3L5 10l5.3-1.7L12 3ZM5 18l.6 1.4L7 20l-1.4.6L5 22l-.6-1.4L3 20l1.4-.6L5 18Z" /></>,
  };
  return <svg {...common}>{paths[kind]}</svg>;
}

function TrackCard({ title, description, icon, url, downloadName, tone }: {
  title: string;
  description: string;
  icon: "music" | "mic";
  url: string;
  downloadName: string;
  tone: "violet" | "cyan";
}) {
  const isViolet = tone === "violet";
  return (
    <div className="min-w-0 rounded-2xl border border-white/10 bg-slate-900/75 p-5 shadow-lg shadow-black/10 sm:p-6">
      <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ${isViolet ? "bg-violet-500/15 text-violet-300" : "bg-cyan-400/10 text-cyan-300"}`}>
            <Icon kind={icon} className="h-6 w-6" />
          </div>
          <div>
            <h4 className="font-semibold tracking-tight text-white">{title}</h4>
            <p className="mt-0.5 text-xs leading-5 text-slate-400">{description}</p>
          </div>
        </div>
      </div>
      <audio controls preload="none" src={url} className="w-full" aria-label={`${title} preview`}>
        Your browser does not support audio playback.
      </audio>
      <a href={url + "?download=true"} download={downloadName} className="mt-5 inline-flex items-center justify-center gap-2 rounded-xl border border-white/15 bg-white/5 px-4 py-2.5 text-sm font-medium text-slate-100 transition hover:border-violet-400/50 hover:bg-white/10 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-violet-400">
        <Icon kind="download" className="h-4 w-4" /> Download MP3
      </a>
    </div>
  );
}

export default function KaraokeMaker() {
  const inputId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState<KaraokeResult | null>(null);

  function onChoose(event: ChangeEvent<HTMLInputElement>) {
    const chosen = event.target.files?.[0] ?? null;
    setFile(chosen);
    setResult(null);
    setError("");
  }

  function clearFile() {
    setFile(null);
    setResult(null);
    setError("");
    if (inputRef.current) inputRef.current.value = "";
  }

  async function generate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!file || isProcessing) return;
    const extension = file.name.split(".").pop()?.toLowerCase() || "";
    if (!ALLOWED_EXTENSIONS.includes(extension)) {
      setError("Please select an MP3, WAV, M4A, FLAC or OGG audio file.");
      return;
    }
    if (file.size > MAX_MB * 1024 * 1024) {
      setError(`File is too large. Please use audio under ${MAX_MB} MB.`);
      return;
    }
    setError("");
    setResult(null);
    setIsProcessing(true);
    try {
      const data = new FormData();
      data.append("file", file);
      const response = await fetch(`${API_BASE}/karaoke/generate`, { method: "POST", body: data });
      const payload = await response.json();
      if (!response.ok) throw new Error(typeof payload.detail === "string" ? payload.detail : "Unable to separate this recording.");
      setResult(payload as KaraokeResult);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not connect to the karaoke backend. Check that FastAPI is running.");
    } finally {
      setIsProcessing(false);
    }
  }

  const shortName = file?.name || "";
  const fileSize = file ? (file.size / (1024 * 1024)).toFixed(1) : "0";

  return (
    <section id="karaoke-maker" aria-labelledby="karaoke-title" className="relative isolate scroll-mt-6 overflow-hidden border-y border-white/10 bg-slate-950/70 px-4 py-16 text-white sm:px-6 sm:py-20">
      <div aria-hidden="true" className="pointer-events-none absolute -right-32 -top-56 h-96 w-96 rounded-full bg-violet-700/15 blur-3xl" />
      <div aria-hidden="true" className="pointer-events-none absolute -bottom-56 -left-32 h-96 w-96 rounded-full bg-cyan-700/10 blur-3xl" />
      <div className="relative mx-auto max-w-6xl">
        <div className="mb-10 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div className="max-w-2xl">
            <p className="mb-3 flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.2em] text-violet-300">
              <Icon kind="wave" className="h-4 w-4" /> Audio tools / Vocal separation
            </p>
            <h2 id="karaoke-title" className="text-3xl font-bold tracking-tight sm:text-4xl">AI Karaoke <span className="bg-gradient-to-r from-violet-300 to-cyan-300 bg-clip-text text-transparent">Studio</span></h2>
            <p className="mt-4 max-w-xl text-sm leading-7 text-slate-300 sm:text-base">
              Turn your music into two practice-ready tracks: an instrumental backing and isolated vocals. Upload music you own or have permission to process.
            </p>
          </div>
          <div className="flex flex-wrap gap-2 text-xs text-slate-300">
            <span className="rounded-full border border-white/10 bg-white/5 px-3 py-2">AI stem separation</span>
            <span className="rounded-full border border-white/10 bg-white/5 px-3 py-2">Audio previews</span>
            <span className="rounded-full border border-white/10 bg-white/5 px-3 py-2">MP3 downloads</span>
          </div>
        </div>

        <div className="grid gap-5 lg:grid-cols-[minmax(0,1.45fr)_minmax(260px,0.8fr)]">
          <form onSubmit={generate} className="min-w-0 rounded-3xl border border-violet-400/20 bg-gradient-to-br from-slate-900 to-slate-900/75 p-5 shadow-2xl shadow-black/20 sm:p-8">
            <div className="mb-6 flex items-center justify-between gap-3">
              <div>
                <h3 className="text-lg font-semibold tracking-tight">Create your karaoke track</h3>
                <p className="mt-1 text-sm text-slate-400">Select a song to get started.</p>
              </div>
              <div className="rounded-xl border border-violet-400/15 bg-violet-500/10 p-3 text-violet-300"><Icon kind="upload" className="h-5 w-5" /></div>
            </div>

            <label htmlFor={inputId} className={`group flex cursor-pointer flex-col items-center justify-center rounded-2xl border border-dashed p-7 text-center transition sm:p-9 ${isProcessing ? "cursor-not-allowed border-white/10 bg-white/[0.02] opacity-60" : "border-violet-400/40 bg-violet-500/[0.045] hover:border-violet-300/75 hover:bg-violet-500/[0.08]"}`}>
              <span className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl border border-violet-400/20 bg-violet-400/10 text-violet-300"><Icon kind={file ? "file" : "music"} className="h-7 w-7" /></span>
              <span className="max-w-full break-words text-base font-semibold text-white">{file ? shortName : "Choose an audio file"}</span>
              <span className="mt-2 text-xs leading-5 text-slate-400">{file ? `${fileSize} MB selected • click to change` : "MP3, WAV, M4A, FLAC, OGG • up to 50 MB, 8 minutes"}</span>
              <span className="mt-4 rounded-lg border border-violet-400/25 bg-violet-500/15 px-4 py-2 text-sm font-medium text-violet-100 group-hover:bg-violet-500/25">{file ? "Change file" : "Browse files"}</span>
            </label>
            <input id={inputId} ref={inputRef} type="file" accept=".mp3,.wav,.m4a,.flac,.ogg" onChange={onChoose} disabled={isProcessing} className="sr-only focus-visible:outline-2 focus-visible:outline-violet-400" />

            <div className="mt-5 flex flex-wrap items-center justify-between gap-3 text-xs text-slate-400">
              <span>Tip: Test with a 15–30 second song containing voice and music.</span>
              {file && !isProcessing && <button type="button" onClick={clearFile} className="font-semibold text-slate-300 underline decoration-white/30 underline-offset-4 hover:text-white">Remove file</button>}
            </div>

            <button type="submit" disabled={!file || isProcessing} aria-busy={isProcessing} className="mt-7 flex w-full items-center justify-center gap-3 rounded-xl bg-gradient-to-r from-violet-600 to-indigo-600 px-5 py-3.5 text-sm font-semibold text-white shadow-lg shadow-violet-900/25 transition hover:from-violet-500 hover:to-indigo-500 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-violet-400 disabled:cursor-not-allowed disabled:opacity-50">
              {isProcessing ? <span aria-hidden="true" className="h-5 w-5 animate-spin rounded-full border-2 border-white/30 border-t-white" /> : <Icon kind="sparkles" className="h-5 w-5" />}
              {isProcessing ? "Separating vocals and instruments…" : "Generate karaoke"}
            </button>
            {isProcessing && <div role="status" className="mt-4 rounded-xl border border-amber-500/20 bg-amber-400/5 p-4 text-sm leading-6 text-amber-100">AI processing on your laptop. CPU separation may take several minutes; first use downloads the model. Keep both servers running.</div>}
            {error && <div role="alert" className="mt-4 rounded-xl border border-red-400/25 bg-red-400/10 p-4 text-sm leading-6 text-red-200">{error}</div>}
          </form>

          <aside aria-label="Karaoke workflow" className="rounded-3xl border border-white/10 bg-slate-900/60 p-6 sm:p-8">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">How it works</p>
            <div className="mt-7 space-y-7">
              {([ ["01", "Upload", "Choose a recording with singing and background music."], ["02", "Separate", "AI estimates the vocal and instrumental stems."], ["03", "Practice", "Preview or download both tracks as MP3."] ] as const).map(([number, title, description]) => (
                <div key={number} className="flex gap-4">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-white/10 bg-white/5 text-sm font-semibold text-violet-300">{number}</div>
                  <div><h4 className="font-semibold text-white">{title}</h4><p className="mt-1 text-sm leading-6 text-slate-400">{description}</p></div>
                </div>
              ))}
            </div>
            <div className="mt-8 border-t border-white/10 pt-5 text-xs leading-6 text-slate-400">
              <span className="font-semibold text-slate-200">Quality note:</span> AI separation is approximate. Very quiet instruments or reverb may remain in the vocal track; zero leakage cannot be guaranteed.
            </div>
          </aside>
        </div>

        {result && (
          <div className="mt-8 rounded-3xl border border-emerald-400/15 bg-slate-900/40 p-5 sm:p-7">
            <div className="mb-6 flex flex-wrap items-center gap-3 text-sm">
              <span className="flex h-9 w-9 items-center justify-center rounded-full bg-emerald-500/15 text-emerald-300"><Icon kind="check" /></span>
              <div><p className="font-semibold text-emerald-200">Your tracks are ready</p><p className="mt-0.5 max-w-full break-words text-xs text-slate-400">{result.filename} · {Math.round(result.duration_seconds)} seconds</p></div>
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              <TrackCard title="Instrumental / Karaoke" description="Music backing track" icon="music" tone="violet" url={`${API_BASE}${result.karaoke_url}`} downloadName="rehearsalradar-karaoke.mp3" />
              <TrackCard title="Isolated Vocals" description="AI-estimated singer vocal stem" icon="mic" tone="cyan" url={`${API_BASE}${result.vocals_url}`} downloadName="rehearsalradar-vocals.mp3" />
            </div>
            <KaraokePractice key={result.job_id} karaokeUrl={`${API_BASE}${result.karaoke_url}`} trackName={result.filename} durationSeconds={result.duration_seconds} />
            <p className="mt-5 text-xs leading-6 text-slate-400">Generated files are stored on your local backend temporarily (about 24 hours). New analyses use the current AI model; existing files do not change automatically.</p>
          </div>
        )}
      </div>
    </section>
  );
}
