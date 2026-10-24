import { useEffect, useRef, useState, type ChangeEvent } from "react";
import { analyzeAudio, type AnalysisResponse } from "../services/audioApi";

/** Records the user's own microphone track while a generated instrumental plays.
 * Uses the existing local FastAPI /analyze service; no scoring model or new API needed.
 */
type Props = { karaokeUrl: string; trackName: string; durationSeconds: number };
type SavedTake = { url: string; blob: Blob; extension: "webm" | "m4a" | "ogg" };
const MAX_RECORD_SECONDS = 60;
const MAX_UPLOAD_BYTES = 20 * 1024 * 1024;

function pickMime(): string | undefined {
  if (typeof MediaRecorder === "undefined") return undefined;
  return ["audio/webm;codecs=opus", "audio/webm", "audio/mp4", "audio/ogg;codecs=opus", "audio/ogg"]
    .find((type) => MediaRecorder.isTypeSupported(type));
}

function extensionFor(mime: string): SavedTake["extension"] {
  if (mime.includes("mp4")) return "m4a";
  if (mime.includes("ogg")) return "ogg";
  return "webm";
}

export default function KaraokePractice({ karaokeUrl, trackName, durationSeconds }: Props) {
  const playerRef = useRef<HTMLAudioElement | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const clockRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const lastUrlRef = useRef<string | null>(null);
  const mountedRef = useRef(true);
  const [recording, setRecording] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [take, setTake] = useState<SavedTake | null>(null);
  const [analysis, setAnalysis] = useState<AnalysisResponse | null>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const canRecord = typeof navigator !== "undefined" && !!navigator.mediaDevices?.getUserMedia && typeof MediaRecorder !== "undefined";

  function clearTimers() {
    if (timeoutRef.current !== null) clearTimeout(timeoutRef.current);
    if (clockRef.current !== null) clearInterval(clockRef.current);
    timeoutRef.current = null;
    clockRef.current = null;
  }

  function stopTake() {
    clearTimers();
    playerRef.current?.pause();
    if (recorderRef.current?.state === "recording") recorderRef.current.stop();
    if (mountedRef.current) setRecording(false);
  }

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      clearTimers();
      const current = recorderRef.current;
      if (current?.state === "recording") {
        current.onstop = null;
        current.stop();
      }
      streamRef.current?.getTracks().forEach((track) => track.stop());
      playerRef.current?.pause();
      if (lastUrlRef.current) URL.revokeObjectURL(lastUrlRef.current);
    };
  }, []);

  function replaceTake(blob: Blob, mime: string) {
    if (lastUrlRef.current) URL.revokeObjectURL(lastUrlRef.current);
    const url = URL.createObjectURL(blob);
    lastUrlRef.current = url;
    setTake({ url, blob, extension: extensionFor(mime) });
    setAnalysis(null);
  }

  async function startTake() {
    if (recording || analyzing || !canRecord) return;
    setError("");
    setMessage("");
    setAnalysis(null);
    const player = playerRef.current;
    if (!player) return;
    let stream: MediaStream | null = null;
    try {
      stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false },
        video: false,
      });
      if (!mountedRef.current) { stream.getTracks().forEach((track) => track.stop()); return; }
      streamRef.current = stream;
      const chosenMime = pickMime();
      const recorder = chosenMime ? new MediaRecorder(stream, { mimeType: chosenMime }) : new MediaRecorder(stream);
      recorderRef.current = recorder;
      const chunks: BlobPart[] = [];
      recorder.ondataavailable = (event: BlobEvent) => {
        if (event.data.size) chunks.push(event.data);
      };
      recorder.onerror = () => { setError("Recording failed. Check your microphone settings."); stopTake(); };
      recorder.onstop = () => {
        clearTimers();
        stream?.getTracks().forEach((track) => track.stop());
        streamRef.current = null;
        recorderRef.current = null;
        if (!mountedRef.current) return;
        setRecording(false);
        const actualMime = recorder.mimeType || chosenMime || "audio/webm";
        const blob = new Blob(chunks, { type: actualMime });
        if (blob.size < 1000) { setError("No usable audio captured. Try again."); return; }
        replaceTake(blob, actualMime);
        setMessage("Practice take recorded. Listen, download, or analyze your vocal pitch below.");
      };
      if (player.ended || (Number.isFinite(player.duration) && player.currentTime >= player.duration - 0.2)) {
        player.currentTime = 0;
      }
      recorder.start(1000);
      try {
        await player.play();
      } catch {
        recorder.onstop = null;
        recorder.stop();
        stream.getTracks().forEach((track) => track.stop());
        streamRef.current = null;
        recorderRef.current = null;
        setError("Could not start the backing track. Press play once on the audio player, then try recording again.");
        return;
      }
      setRecording(true);
      setElapsed(0);
      setMessage("Recording your microphone while karaoke plays. Sing into the mic using headphones.");
      clockRef.current = setInterval(() => setElapsed((value) => Math.min(MAX_RECORD_SECONDS, value + 1)), 1000);
      timeoutRef.current = setTimeout(stopTake, MAX_RECORD_SECONDS * 1000);
    } catch (cause) {
      stream?.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
      recorderRef.current = null;
      setRecording(false);
      setError(cause instanceof Error ? `Microphone not available: ${cause.message}` : "Cannot access microphone.");
    }
  }

  async function analyzeFile(file: File) {
    if (analyzing) return;
    if (file.size === 0 || file.size > MAX_UPLOAD_BYTES) {
      setError("Please analyze a recording under 20 MB.");
      return;
    }
    setError("");
    setMessage("AI is estimating pitch from your practice take. Short, clear recordings work best.");
    setAnalyzing(true);
    setAnalysis(null);
    try {
      const result = await analyzeAudio(file);
      if (mountedRef.current) {
        setAnalysis(result);
        setMessage("");
      }
    } catch (cause) {
      if (mountedRef.current) {
        setError(cause instanceof Error ? cause.message : "AI analysis failed. Check the FastAPI server.");
        setMessage("");
      }
    } finally {
      if (mountedRef.current) setAnalyzing(false);
    }
  }

  function analyzeTake() {
    if (!take) return;
    const file = new File([take.blob], `karaoke-practice.${take.extension}`, { type: take.blob.type });
    void analyzeFile(file);
  }

  function handleUpload(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file || recording || analyzing) return;
    if (!/\.(mp3|wav|m4a|aac|flac|ogg|webm)$/i.test(file.name)) {
      setError("Upload an MP3, WAV, M4A, AAC, FLAC, OGG or WebM recording.");
      return;
    }
    void analyzeFile(file);
  }

  const median = analysis?.status === "success" && typeof analysis.median_pitch_hz === "number"
    ? analysis.median_pitch_hz : null;

  return (
    <div className="mt-7 rounded-2xl border border-violet-400/25 bg-gradient-to-br from-slate-900 to-violet-950/20 p-5 sm:p-7">
      <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-violet-300">Sing along</p>
          <h3 className="mt-2 text-xl font-bold text-white sm:text-2xl">Karaoke Practice Mode</h3>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-300">
            Play your generated instrumental, sing into your microphone and record a practice take. Replay it and check your pitch with AI.
          </p>
        </div>
        <span className="rounded-full border border-white/15 bg-white/5 px-3 py-1 text-xs text-slate-300">Up to 60 seconds per take</span>
      </div>

      <div className="rounded-xl border border-cyan-400/20 bg-cyan-400/5 p-4 text-sm leading-6 text-cyan-100">
        <strong>Use headphones.</strong> The app records your microphone, not an artificially separated voice. If karaoke comes from laptop speakers, the microphone will capture the instrumental too. For cleaner AI pitch results, use headphones and a quiet room.
      </div>

      <div className="mt-5 grid gap-5 md:grid-cols-2">
        <div className="rounded-xl border border-white/10 bg-slate-950/60 p-4 sm:p-5">
          <p className="text-sm font-semibold text-white">Backing track</p>
          <p className="mt-1 truncate text-xs text-slate-400" title={trackName}>{trackName} · {Math.round(durationSeconds)}s</p>
          <audio ref={playerRef} src={karaokeUrl} controls preload="metadata" className="mt-4 w-full" onEnded={() => { if (recorderRef.current?.state === "recording") stopTake(); }} aria-label="Karaoke instrumental backing track">
            Your browser does not support audio playback.
          </audio>
          <p className="mt-3 text-xs text-slate-400">Move the playhead to a short phrase before starting. Recording stops at 60 seconds or when the track ends.</p>
        </div>

        <div className="rounded-xl border border-white/10 bg-slate-950/60 p-4 sm:p-5">
          <p className="text-sm font-semibold text-white">Record your singing</p>
          <p className="mt-1 text-xs text-slate-400">The microphone recording stays in this browser until you leave or download it.</p>
          {recording ? (
            <button type="button" onClick={stopTake} className="mt-5 w-full rounded-xl bg-rose-600 px-4 py-3 font-semibold text-white hover:bg-rose-500">
              ● Recording {elapsed}s — Stop & review
            </button>
          ) : (
            <button type="button" disabled={!canRecord || analyzing} onClick={() => void startTake()} className="mt-5 w-full rounded-xl bg-violet-600 px-4 py-3 font-semibold text-white hover:bg-violet-500 disabled:cursor-not-allowed disabled:opacity-50">
              🎙 Start Singing & Recording
            </button>
          )}
          {!canRecord && <p className="mt-2 text-xs text-amber-200">Microphone recording needs localhost or HTTPS and a compatible browser. You can still upload a practice recording below.</p>}
          <label className="mt-4 block text-xs text-slate-400" htmlFor="karaoke-practice-upload">Already recorded a vocal take? Upload it for analysis:</label>
          <input id="karaoke-practice-upload" type="file" accept=".mp3,.wav,.m4a,.aac,.flac,.ogg,.webm" disabled={recording || analyzing} onChange={handleUpload} className="mt-2 w-full text-xs text-slate-200 file:mr-3 file:rounded-lg file:border-0 file:bg-slate-700 file:px-3 file:py-2 file:text-white" />
        </div>
      </div>

      {take && (
        <div className="mt-5 rounded-xl border border-emerald-400/20 bg-emerald-400/5 p-4 sm:p-5">
          <p className="text-sm font-semibold text-emerald-200">Your practice take is ready</p>
          <audio controls src={take.url} preload="metadata" className="mt-3 w-full" aria-label="Your recorded singing take" />
          <div className="mt-4 flex flex-wrap gap-3">
            <a href={take.url} download={`rehearsalradar-practice.${take.extension}`} className="inline-flex rounded-xl border border-white/20 bg-white/10 px-4 py-2.5 text-sm font-medium text-white hover:bg-white/15">↓ Download your take</a>
            <button type="button" onClick={analyzeTake} disabled={analyzing || recording} className="rounded-xl bg-violet-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-violet-500 disabled:opacity-50">{analyzing ? "Analyzing…" : "Analyze My Pitch"}</button>
          </div>
        </div>
      )}
      {message && <p role="status" className="mt-4 rounded-xl border border-white/10 bg-slate-950/50 p-3 text-sm text-slate-300">{message}</p>}
      {error && <p role="alert" className="mt-4 rounded-xl border border-red-400/25 bg-red-400/10 p-3 text-sm text-red-200">{error}</p>}
      {analysis && (
        <div className="mt-5 rounded-xl border border-white/10 bg-slate-950/60 p-5" aria-live="polite">
          <h4 className="text-lg font-semibold text-white">Practice analysis</h4>
          {median !== null && Number.isFinite(median) && median > 0 ? (
            <>
              <p className="mt-2 text-sm text-slate-200">Detected median pitch: <strong className="text-violet-300">{median.toFixed(1)} Hz</strong></p>
              <p className="mt-2 text-sm text-slate-400">This shows your approximate vocal pitch, not whether you sang the song correctly. For accurate note-by-note matching, compare short clean recordings of the same phrase in Reference Comparison.</p>
            </>
          ) : <p className="mt-2 text-sm text-amber-200">No reliable vocal pitch detected. Use headphones, reduce background noise, and retry with clear singing.</p>}
        </div>
      )}
    </div>
  );
}
