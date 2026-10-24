import { useEffect, useMemo, useRef, useState, type ChangeEvent } from "react";
import { analyzeAudio, type AnalysisResponse } from "../services/audioApi";
import { getPitchInsights } from "../services/pitchInsights";
import { comparePitch } from "../services/pitchComparison";

type Props = {
  analysis: AnalysisResponse;
  reference?: AnalysisResponse | null;
};

type Attempt = {
  at: string;
  targetNote: string;
  targetHz: number;
  detectedHz: number;
  differenceCents: number;
};

type CheckResult =
  | { kind: "success"; attempt: Attempt }
  | { kind: "no_pitch"; message: string };

const STORAGE_KEY = "rehearsalradar-note-practice-v1";
const NOTE_NAMES = ["C", "C♯", "D", "D♯", "E", "F", "F♯", "G", "G♯", "A", "A♯", "B"];
const MIN_MIDI = 48; // C3
const MAX_MIDI = 81; // A5
const RECORD_MS = 5000;

function midiHz(midi: number): number {
  return 440 * 2 ** ((midi - 69) / 12);
}

function midiName(midi: number): string {
  return `${NOTE_NAMES[midi % 12]}${Math.floor(midi / 12) - 1}`;
}

function initialMidi(result: AnalysisResponse): number {
  const hz = result.median_pitch_hz;
  if (typeof hz !== "number" || !Number.isFinite(hz) || hz <= 0) return 60;
  return Math.max(MIN_MIDI, Math.min(MAX_MIDI, Math.round(69 + 12 * Math.log2(hz / 440))));
}

function readAttempts(): Attempt[] {
  try {
    const parsed: unknown = JSON.parse(window.localStorage.getItem(STORAGE_KEY) ?? "[]");
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((item): item is Attempt =>
      item !== null && typeof item === "object" &&
      typeof item.targetNote === "string" &&
      typeof item.at === "string" &&
      Number.isFinite(item.differenceCents) &&
      Number.isFinite(item.detectedHz) && Number.isFinite(item.targetHz)
    ).slice(0, 20);
  } catch {
    return [];
  }
}

function recommendation(analysis: AnalysisResponse, reference?: AnalysisResponse | null): string {
  if (analysis.status !== "success") {
    return "Start with a clear solo recording. Once your voice is detected, try the note-matching exercise below.";
  }

  if (reference?.status === "success") {
    const comparison = comparePitch(analysis, reference);
    if (comparison && comparison.matchedDurationSeconds >= 2) {
      if (Math.abs(comparison.medianPitchOffsetSemitones) >= 1) {
        return `In the matched voiced portions, your pitch was about ${Math.abs(comparison.medianPitchOffsetSemitones).toFixed(1)} semitones ${comparison.medianPitchOffsetSemitones > 0 ? "higher" : "lower"} than the reference. Try singing the same short phrase in the reference key, then compare again.`;
      }
      if (comparison.meanPitchDifferenceSemitones >= 1) {
        return "Your overall key looks closer to the reference, but some aligned sections differ. Replay a short phrase, sing it slowly, and compare another take.";
      }
      return "The aligned pitch patterns appear relatively close. Practise the phrase again to see whether the result is consistent.";
    }
    return "Not enough matching voiced audio to compare confidently. Try two clear recordings of the same phrase at a similar tempo.";
  }

  const insights = getPitchInsights(analysis);
  if (insights.reliablePitchPercent < 40) {
    return "Pitch estimates were available for only part of your audio. Practise with a quieter, solo-vocal recording, then analyze again.";
  }
  if (insights.medianLocalVariationCents === null) {
    return "Try holding one comfortable note for five seconds. A sustained note makes it easier to observe how your pitch behaves.";
  }
  if (insights.medianLocalVariationCents > 30) {
    return "Some approximately steady passages showed pitch variation. Try the held-note exercise below and listen for controlled changes; natural vibrato can also cause variation.";
  }
  return "Start with a comfortable note, then move the target up or down a semitone. Repeating short takes helps you practise pitch control.";
}

/** A real user exercise, not a trained singing-quality model or musical correctness score. */
export default function PracticeCoach({ analysis, reference }: Props) {
  const [midi, setMidi] = useState(() => initialMidi(reference?.status === "success" ? reference : analysis));
  const [isRecording, setIsRecording] = useState(false);
  const [remaining, setRemaining] = useState(5);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [message, setMessage] = useState("");
  const [result, setResult] = useState<CheckResult | null>(null);
  const [attempts, setAttempts] = useState<Attempt[]>(readAttempts);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const stopTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const countdownRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const mountedRef = useRef(true);

  const targetHz = midiHz(midi);
  const targetName = midiName(midi);
  const advice = useMemo(() => recommendation(analysis, reference), [analysis, reference]);
  const canRecord = typeof window !== "undefined" &&
    !!navigator.mediaDevices?.getUserMedia && typeof MediaRecorder !== "undefined";

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      if (stopTimerRef.current) clearTimeout(stopTimerRef.current);
      if (countdownRef.current) clearInterval(countdownRef.current);
      const recorder = recorderRef.current;
      if (recorder?.state === "recording") {
        recorder.onstop = null;
        recorder.stop();
      }
      streamRef.current?.getTracks().forEach((track) => track.stop());
      void audioContextRef.current?.close().catch(() => {});
    };
  }, []);

  // Analysis changes when the person uploads a different recording.
  useEffect(() => {
    setMidi(initialMidi(reference?.status === "success" ? reference : analysis));
    setResult(null);
    setMessage("");
  }, [analysis, reference]);

  async function playNote() {
    if (isPlaying || isRecording) return;
    try {
      const context = new AudioContext();
      audioContextRef.current = context;
      await context.resume();
      const oscillator = context.createOscillator();
      const volume = context.createGain();
      oscillator.type = "sine";
      oscillator.frequency.value = targetHz;
      volume.gain.setValueAtTime(0.0001, context.currentTime);
      volume.gain.exponentialRampToValueAtTime(0.12, context.currentTime + 0.08);
      volume.gain.setValueAtTime(0.12, context.currentTime + 1.5);
      volume.gain.exponentialRampToValueAtTime(0.0001, context.currentTime + 1.9);
      oscillator.connect(volume);
      volume.connect(context.destination);
      oscillator.onended = () => {
        void context.close().catch(() => {});
        if (audioContextRef.current === context) audioContextRef.current = null;
        if (mountedRef.current) setIsPlaying(false);
      };
      setIsPlaying(true);
      oscillator.start();
      oscillator.stop(context.currentTime + 2);
      setMessage("Listen to the tone, then sing that note for about five seconds.");
    } catch {
      setIsPlaying(false);
      setMessage("Could not play the note. Check your browser audio settings.");
    }
  }

  function stopRecording() {
    if (stopTimerRef.current) clearTimeout(stopTimerRef.current);
    if (countdownRef.current) clearInterval(countdownRef.current);
    stopTimerRef.current = null;
    countdownRef.current = null;
    const recorder = recorderRef.current;
    if (recorder?.state === "recording") recorder.stop();
    setIsRecording(false);
  }

  async function checkRecording(file: File, goalHz: number, goalName: string) {
    if (!mountedRef.current) return;
    setIsAnalyzing(true);
    setResult(null);
    setMessage("Analyzing your held note using the existing AI pitch detector...");
    try {
      const recording = await analyzeAudio(file);
      const pitch = recording.median_pitch_hz;
      if (recording.status !== "success" || typeof pitch !== "number" || !Number.isFinite(pitch) || pitch <= 0) {
        setResult({ kind: "no_pitch", message: "No reliable note was detected. Try a quieter room and sing a sustained 'aa' sound for five seconds." });
      } else {
        const difference = 1200 * Math.log2(pitch / goalHz);
        const attempt: Attempt = {
          at: new Date().toISOString(),
          targetNote: goalName,
          targetHz: goalHz,
          detectedHz: pitch,
          differenceCents: Math.round(difference),
        };
        setResult({ kind: "success", attempt });
        setAttempts((previous) => {
          const next = [attempt, ...previous].slice(0, 20);
          try { window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next)); } catch { /* private mode */ }
          return next;
        });
      }
      setMessage("");
    } catch (err) {
      setMessage(err instanceof Error ? `Could not analyze the recording: ${err.message}` : "Could not analyze the recording. Try again.");
    } finally {
      if (mountedRef.current) setIsAnalyzing(false);
    }
  }

  async function recordNote() {
    if (isRecording || isAnalyzing || !canRecord) return;
    setMessage("");
    setResult(null);
    const goalHz = targetHz;
    const goalName = targetName;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
      if (!mountedRef.current) {
        stream.getTracks().forEach((track) => track.stop());
        return;
      }
      streamRef.current = stream;
      const mimeType = ["audio/webm;codecs=opus", "audio/webm", "audio/mp4"].find((type) => MediaRecorder.isTypeSupported(type));
      const recorder = mimeType ? new MediaRecorder(stream, { mimeType }) : new MediaRecorder(stream);
      recorderRef.current = recorder;
      const chunks: BlobPart[] = [];
      recorder.ondataavailable = (event: BlobEvent) => {
        if (event.data.size > 0) chunks.push(event.data);
      };
      recorder.onerror = () => {
        setMessage("Microphone recording failed. You can upload a note recording instead.");
        stopRecording();
      };
      recorder.onstop = () => {
        stream.getTracks().forEach((track) => track.stop());
        streamRef.current = null;
        recorderRef.current = null;
        if (!mountedRef.current) return;
        const actualMime = recorder.mimeType || mimeType || "audio/webm";
        const extension = actualMime.includes("mp4") ? "m4a" : "webm";
        const blob = new Blob(chunks, { type: actualMime });
        if (blob.size < 1000) {
          setMessage("Recording was too short. Try holding the note for five seconds.");
          return;
        }
        const file = new File([blob], `note-practice.${extension}`, { type: actualMime });
        void checkRecording(file, goalHz, goalName);
      };
      recorder.start();
      setRemaining(5);
      setIsRecording(true);
      setMessage("Sing one steady 'aa' note now. Recording stops automatically after 5 seconds.");
      countdownRef.current = setInterval(() => setRemaining((n) => Math.max(0, n - 1)), 1000);
      stopTimerRef.current = setTimeout(stopRecording, RECORD_MS);
    } catch (err) {
      streamRef.current?.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
      setIsRecording(false);
      setMessage(err instanceof Error ? `Microphone unavailable: ${err.message}. You can upload a note recording instead.` : "Microphone unavailable. You can upload a note recording instead.");
    }
  }

  function handleUpload(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file || isRecording || isAnalyzing) return;
    const extension = file.name.slice(file.name.lastIndexOf(".")).toLowerCase();
    if (![".mp3", ".wav", ".m4a", ".aac", ".flac", ".ogg", ".webm"].includes(extension)) {
      setMessage("Choose an MP3, WAV, M4A, AAC, FLAC, OGG or WebM recording.");
      return;
    }
    if (file.size > 15 * 1024 * 1024) {
      setMessage("Practice recording must be below 15 MB.");
      return;
    }
    void checkRecording(file, targetHz, targetName);
  }

  const successful = result?.kind === "success" ? result.attempt : null;
  const absCents = successful ? Math.abs(successful.differenceCents) : null;
  const quality = absCents !== null && absCents <= 50
    ? "Close to the target note"
    : absCents !== null && absCents <= 100
      ? "Getting closer — try another take"
      : "Try adjusting toward the target note";

  return (
    <section id="practice-coach" className="mt-9 overflow-hidden rounded-3xl border border-violet-400/20 bg-gradient-to-br from-slate-900 via-slate-900 to-violet-950/30 p-5 shadow-xl shadow-violet-950/20 sm:p-7">
      <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.16em] text-violet-300">Interactive Practice</p>
          <h3 className="mt-2 text-2xl font-bold text-white">Your Pitch Practice Coach</h3>
          <p className="mt-2 max-w-xl text-sm leading-relaxed text-slate-300">Listen to a note, sing it back and get measured feedback. No training labels needed.</p>
        </div>
        <span className="rounded-full border border-violet-400/30 bg-violet-500/10 px-3 py-1 text-xs text-violet-200">AI pitch checking</span>
      </div>

      <div className="mb-6 rounded-2xl border border-slate-700/70 bg-slate-950/50 p-4">
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Suggested next exercise</p>
        <p className="mt-2 text-sm leading-relaxed text-slate-200">{advice}</p>
      </div>

      <div className="grid gap-5 md:grid-cols-[1fr_1.1fr]">
        <div className="rounded-2xl border border-slate-700/80 bg-slate-950/60 p-5">
          <p className="text-sm font-medium text-slate-300">Choose your practice note</p>
          <div className="mt-4 flex items-center justify-center gap-4">
            <button type="button" onClick={() => { setMidi((n) => Math.max(MIN_MIDI, n - 1)); setResult(null); }} disabled={midi <= MIN_MIDI || isRecording || isAnalyzing} aria-label="Lower target one semitone" className="rounded-xl border border-slate-600 px-4 py-3 text-xl hover:bg-slate-800 disabled:opacity-40">−</button>
            <div className="min-w-28 text-center">
              <p className="text-4xl font-bold text-violet-300">{targetName}</p>
              <p className="mt-1 text-sm text-slate-400">{targetHz.toFixed(1)} Hz</p>
            </div>
            <button type="button" onClick={() => { setMidi((n) => Math.min(MAX_MIDI, n + 1)); setResult(null); }} disabled={midi >= MAX_MIDI || isRecording || isAnalyzing} aria-label="Raise target one semitone" className="rounded-xl border border-slate-600 px-4 py-3 text-xl hover:bg-slate-800 disabled:opacity-40">+</button>
          </div>
          <p className="mt-3 text-center text-xs leading-relaxed text-slate-400">Starts near a typical detected pitch. Change it to any comfortable note.</p>
          <button type="button" onClick={() => void playNote()} disabled={isPlaying || isRecording} className="mt-5 w-full rounded-xl border border-violet-400/60 bg-violet-500/15 px-4 py-3 font-semibold text-violet-100 hover:bg-violet-500/25 disabled:opacity-50">
            {isPlaying ? "♫ Playing..." : "♫ Play Target Note (2 sec)"}
          </button>
        </div>

        <div className="rounded-2xl border border-slate-700/80 bg-slate-950/60 p-5">
          <p className="text-sm font-medium text-slate-300">Sing the note and check your pitch</p>
          <ol className="mt-3 space-y-1 text-sm text-slate-400">
            <li>1. Play the reference tone.</li>
            <li>2. Sing one sustained “aa” sound at the same pitch.</li>
            <li>3. Check your recording and try again.</li>
          </ol>
          {isRecording ? (
            <button type="button" onClick={stopRecording} className="mt-5 w-full rounded-xl bg-rose-600 px-4 py-3 font-semibold text-white hover:bg-rose-500">● Recording... {remaining}s · Stop</button>
          ) : (
            <button type="button" onClick={() => void recordNote()} disabled={!canRecord || isAnalyzing || isPlaying} className="mt-5 w-full rounded-xl bg-violet-600 px-4 py-3 font-semibold text-white hover:bg-violet-500 disabled:opacity-50">
              {isAnalyzing ? "Analyzing your note..." : "🎙 Record My Note (5 sec)"}
            </button>
          )}
          {!canRecord && <p className="mt-2 text-xs text-amber-200">Microphone recording requires localhost or HTTPS and a supported browser. Upload a file below instead.</p>}
          <label htmlFor="practice-note-upload" className="mt-4 block text-xs text-slate-400">Or upload an existing 4–8 second note recording</label>
          <input id="practice-note-upload" type="file" accept=".mp3,.wav,.m4a,.aac,.flac,.ogg,.webm" disabled={isRecording || isAnalyzing} onChange={handleUpload} className="mt-2 block w-full text-xs text-slate-300 file:mr-3 file:rounded-lg file:border-0 file:bg-slate-700 file:px-3 file:py-2 file:text-white disabled:opacity-50" />
        </div>
      </div>

      {message && <p role="status" className="mt-5 rounded-xl border border-slate-700 bg-slate-950/70 p-4 text-sm text-slate-200">{message}</p>}

      {result?.kind === "no_pitch" && <p role="alert" className="mt-5 rounded-xl border border-amber-500/40 bg-amber-500/10 p-4 text-sm text-amber-100">{result.message}</p>}
      {successful && (
        <div className="mt-5 rounded-2xl border border-violet-400/30 bg-violet-500/10 p-5" aria-live="polite">
          <p className="text-sm font-semibold text-white">Your practice result — {quality}</p>
          <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3">
            <div><p className="text-xs text-slate-400">Target</p><p className="mt-1 font-semibold text-slate-100">{successful.targetNote} · {successful.targetHz.toFixed(1)} Hz</p></div>
            <div><p className="text-xs text-slate-400">Detected median</p><p className="mt-1 font-semibold text-slate-100">{successful.detectedHz.toFixed(1)} Hz</p></div>
            <div><p className="text-xs text-slate-400">Pitch difference</p><p className="mt-1 font-semibold text-violet-200">{Math.abs(successful.differenceCents)} cents {successful.differenceCents >= 0 ? "higher" : "lower"}</p></div>
          </div>
          <p className="mt-3 text-xs leading-relaxed text-slate-400">This measures the median pitch of a sustained note against your selected tone. It is not a singing-quality score; voice changes and vibrato may affect the estimate.</p>
        </div>
      )}

      {attempts.length > 0 && (
        <div className="mt-5 rounded-xl border border-slate-700/60 bg-slate-950/40 p-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h4 className="text-sm font-semibold text-slate-200">Recent note practice</h4>
            <span className="text-xs text-slate-400">Saved only in this browser</span>
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            {attempts.slice(0, 5).map((attempt, index) => (
              <span key={`${attempt.at}-${index}`} className="rounded-lg border border-slate-700 bg-slate-800/70 px-3 py-2 text-xs text-slate-200">{attempt.targetNote}: {Math.abs(attempt.differenceCents)}¢</span>
            ))}
          </div>
          <p className="mt-3 text-xs text-slate-500">Lower absolute pitch difference for repeated attempts on the same note can suggest better note matching, but it is not a full singing assessment.</p>
        </div>
      )}
    </section>
  );
}
