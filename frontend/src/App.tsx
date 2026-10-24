
import { useState, type ChangeEvent } from "react";
import { analyzeAudio, type AnalysisResponse } from "./services/audioApi";
import PitchResults from "./components/PitchResults";
import ReferenceComparison from "./components/ReferenceComparison";
import AudioPreview from "./components/AudioPreview";
import AnalysisHistory from "./components/AnalysisHistory";
import { saveHistory } from "./services/historyApi";
import KaraokeMaker from "./components/KaraokeMaker";
import PracticeCoach from "./components/PracticeCoach";

type Mode = "free" | "compare";

const ALLOWED_EXTENSIONS = [".mp3", ".wav", ".m4a", ".aac", ".flac", ".ogg", ".webm"];
const MAX_FILE_SIZE = 100 * 1024 * 1024;
const ACCEPTED_AUDIO = ALLOWED_EXTENSIONS.join(",");

function App() {
  const [mode, setMode] = useState<Mode>("free");
  const [selectionKey, setSelectionKey] = useState(0);
  const [singingFile, setSingingFile] = useState<File | null>(null);
  const [referenceFile, setReferenceFile] = useState<File | null>(null);
  const [message, setMessage] = useState("");
  const [isUploading, setIsUploading] = useState(false);
  const [isError, setIsError] = useState(false);
  const [historyRevision, setHistoryRevision] = useState(0);
  const [historyWarning, setHistoryWarning] = useState("");
  const [analysisResult, setAnalysisResult] = useState<AnalysisResponse | null>(null);
  const [referenceAnalysis, setReferenceAnalysis] = useState<AnalysisResponse | null>(null);

  function selectMode(selected: Mode) {
    if (isUploading) return;
    setMode(selected);
    setSingingFile(null);
    setReferenceFile(null);
    setMessage("");
    setIsError(false);
    setHistoryWarning("");
    setAnalysisResult(null);
    setReferenceAnalysis(null);

    document.getElementById("studio")?.scrollIntoView({
      behavior: "smooth",
    });
  }

  function clearCurrentSelection() {
    if (isUploading) return;
    setSingingFile(null);
    setReferenceFile(null);
    setAnalysisResult(null);
    setReferenceAnalysis(null);
    setMessage("");
    setIsError(false);
    setHistoryWarning("");
    // Recreate native file inputs, clearing the displayed file names too.
    setSelectionKey((previous) => previous + 1);
  }

  function exportResults() {
    if (!analysisResult || (mode === "compare" && !referenceAnalysis)) return;
    // Export derived pitch data only. No recording bytes are included.
    const payload = {
      exported_at: new Date().toISOString(),
      app: "RehearsalRadar AI",
      mode,
      singing: analysisResult,
      ...(mode === "compare" ? { reference: referenceAnalysis } : {}),
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `rehearsalradar-${mode}-${Date.now()}.json`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  }

  function handleFile(
    event: ChangeEvent<HTMLInputElement>,
    type: "singing" | "reference"
  ) {
    const file = event.target.files?.[0];

    setMessage("");
    setIsError(false);
    setHistoryWarning("");
    setAnalysisResult(null);
    setReferenceAnalysis(null);
    // Clear the old selection so an invalid replacement is never uploaded.
    if (type === "singing") setSingingFile(null);
    else setReferenceFile(null);

    if (!file) return;

    const extension = file.name.slice(file.name.lastIndexOf(".")).toLowerCase();
    if (!ALLOWED_EXTENSIONS.includes(extension)) {
      setMessage("Unsupported format. Select MP3, WAV, M4A, AAC, FLAC, OGG or WebM audio.");
      setIsError(true);
      event.target.value = "";
      return;
    }

    if (file.size === 0 || file.size > MAX_FILE_SIZE) {
      setMessage("Audio file must be non-empty and at most 100 MB.");
      setIsError(true);
      event.target.value = "";
      return;
    }

    if (type === "singing") setSingingFile(file);
    else setReferenceFile(file);
  }

  async function checkFiles() {
    if (isUploading) return;
    setIsError(false);
    setHistoryWarning("");
    setAnalysisResult(null);
    setReferenceAnalysis(null);

    if (!singingFile) {
      setMessage("Please select your singing recording.");
      setIsError(true);
      return;
    }

    if (mode === "compare" && !referenceFile) {
      setMessage("Please select a reference vocal recording of the same excerpt.");
      setIsError(true);
      return;
    }

    setIsUploading(true);
    setMessage(
      mode === "free"
        ? "Analyzing your singing with AI... This may take a little while on CPU."
        : "Analyzing your singing... The reference will be analyzed next."
    );

    try {
      if (mode === "free") {
        // This endpoint performs real pitch analysis, not just file validation.
        const analysis = await analyzeAudio(singingFile);
        setAnalysisResult(analysis);
        try {
          await saveHistory("free", analysis);
          setHistoryRevision((revision) => revision + 1);
        } catch (saveError) {
          setHistoryWarning(saveError instanceof Error
            ? `Analysis finished but history was not saved: ${saveError.message}`
            : "Analysis finished but history was not saved.");
        }
        setMessage(
          analysis.status === "success"
            ? "AI pitch analysis completed successfully!"
            : "Analysis finished, but no reliable pitch was detected. Try a clearer solo vocal recording."
        );
      } else if (referenceFile) {
        // Process sequentially to avoid overloading a laptop's CPU.
        const singing = await analyzeAudio(singingFile);
        setMessage("Singing analyzed. Now analyzing the reference vocal...");
        const reference = await analyzeAudio(referenceFile);
        setAnalysisResult(singing);
        setReferenceAnalysis(reference);
        try {
          await saveHistory("compare", singing, reference);
          setHistoryRevision((revision) => revision + 1);
        } catch (saveError) {
          setHistoryWarning(saveError instanceof Error
            ? `Comparison finished but history was not saved: ${saveError.message}`
            : "Comparison finished but history was not saved.");
        }
        setMessage("Both recordings analyzed. Compare their pitch contours below.");
      }
    } catch (error) {
      setIsError(true);
      setMessage(error instanceof Error ? error.message : "Audio processing failed. Please retry.");
    } finally {
      setIsUploading(false);
    }
  }

  return (
    <div className="min-h-screen bg-slate-950 text-white">

      {/* Navigation */}
      <nav className="border-b border-white/10 bg-slate-950/90">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-4 px-4 py-4 sm:flex-row sm:px-6 sm:py-5">

          <a href="#" className="flex items-center gap-3">
            <div className="rounded-xl bg-violet-600 px-3 py-2 text-xl">
              ♫
            </div>
            <span className="text-xl font-bold">
              Rehearsal<span className="text-violet-400">Radar</span>
            </span>
          </a>

          <div className="flex flex-wrap items-center justify-center gap-3 text-sm sm:gap-5">
            <a href="#features" className="text-slate-300 hover:text-white">
              Features
            </a>
            <a href="#studio" className="rounded-lg bg-violet-600 px-4 py-2 font-medium hover:bg-violet-500">
              Start Singing
            </a>
            <a href="#history" className="text-slate-300 hover:text-white">
              History
            </a>
          </div>

        </div>
      </nav>

      {/* Hero Section */}
      <section className="relative overflow-hidden px-4 py-16 text-center sm:px-6 sm:py-24">

        <div className="pointer-events-none absolute left-1/2 top-0 h-96 w-96 -translate-x-1/2 rounded-full bg-violet-700/20 blur-3xl" />

        <div className="relative mx-auto max-w-4xl">

          <div className="mb-6 inline-block rounded-full border border-violet-500/30 bg-violet-500/10 px-5 py-2 text-sm text-violet-300">
            AI-Powered Singing Analysis
          </div>

          <h1 className="text-4xl font-extrabold leading-tight sm:text-5xl md:text-7xl">
            Sing Freely.
            <br />
            <span className="text-violet-400">
              Understand Your Voice.
            </span>
          </h1>

          <p className="mx-auto mt-7 max-w-2xl text-lg leading-relaxed text-slate-400">
            Discover your vocal pitch, explore your singing patterns,
            and compare your performance with reference melodies
            using intelligent audio analysis.
          </p>

          <button
            onClick={() => selectMode("free")}
            className="mt-9 rounded-xl bg-violet-600 px-8 py-4 font-semibold shadow-lg shadow-violet-900/30 transition hover:bg-violet-500"
          >
            Get Started →
          </button>

          <p className="mt-5 text-sm text-slate-500">
            Upload your voice • Explore pitch • Improve with practice
          </p>

        </div>
      </section>

      {/* Features */}
      <section id="features" className="bg-slate-900/50 px-4 py-16 sm:px-6 sm:py-20">

        <div className="mx-auto max-w-6xl">

          <h2 className="mb-3 text-center text-3xl font-bold">
            Discover What Your Voice Can Do
          </h2>

          <p className="mb-12 text-center text-slate-400">
            Powerful tools to understand your singing.
          </p>

          <div className="grid gap-6 md:grid-cols-3">

            <div className="rounded-2xl border border-white/10 bg-slate-900 p-7">
              <div className="mb-5 text-4xl">🎙️</div>
              <h3 className="mb-3 text-xl font-semibold">
                Vocal Pitch Analysis
              </h3>
              <p className="leading-relaxed text-slate-400">
                Explore your pitch range, note frequencies,
                and pitch movement throughout a recording.
              </p>
            </div>

            <div className="rounded-2xl border border-white/10 bg-slate-900 p-7">
              <div className="mb-5 text-4xl">🎵</div>
              <h3 className="mb-3 text-xl font-semibold">
                Reference Comparison
              </h3>
              <p className="leading-relaxed text-slate-400">
                Compare your singing with a clean reference vocal
                recording and identify pitch differences.
              </p>
            </div>

            <div className="rounded-2xl border border-white/10 bg-slate-900 p-7">
              <div className="mb-5 text-4xl">📈</div>
              <h3 className="mb-3 text-xl font-semibold">
                Practice Insights
              </h3>
              <p className="leading-relaxed text-slate-400">
                Visualize your singing patterns and discover
                areas to focus on during practice.
              </p>
            </div>

          </div>
        </div>
      </section>

      {/* Singing Studio */}
      <section id="studio" className="px-4 py-16 sm:px-6 sm:py-20">

        <div className="mx-auto max-w-3xl">

          <h2 className="text-center text-2xl font-bold sm:text-3xl">
            Your Singing Studio
          </h2>

          <p className="mt-3 text-center text-slate-400">
            Choose how you want to analyze your singing.
          </p>

          {/* Mode Selection */}
          <div className="mt-10 grid gap-4 sm:grid-cols-2">

            <button
              type="button"
              aria-pressed={mode === "free"}
              disabled={isUploading}
              onClick={() => selectMode("free")}
              className={`rounded-2xl border p-6 text-left transition ${
                mode === "free"
                  ? "border-violet-500 bg-violet-500/10"
                  : "border-white/10 bg-slate-900 hover:border-violet-500/50"
              }`}
            >
              <div className="mb-3 text-3xl">🎤</div>
              <h3 className="text-lg font-semibold">
                Free Singing Analysis
              </h3>
              <p className="mt-2 text-sm text-slate-400">
                Analyze your voice without a reference recording.
              </p>
            </button>

            <button
              type="button"
              aria-pressed={mode === "compare"}
              disabled={isUploading}
              onClick={() => selectMode("compare")}
              className={`rounded-2xl border p-6 text-left transition ${
                mode === "compare"
                  ? "border-violet-500 bg-violet-500/10"
                  : "border-white/10 bg-slate-900 hover:border-violet-500/50"
              }`}
            >
              <div className="mb-3 text-3xl">🎼</div>
              <h3 className="text-lg font-semibold">
                Reference Comparison
              </h3>
              <p className="mt-2 text-sm text-slate-400">
                Compare your singing with another vocal recording.
              </p>
            </button>

          </div>

          {/* Upload Area */}
          <div className="mt-8 rounded-2xl border border-white/10 bg-slate-900 p-5 sm:p-7">

            <h3 className="text-xl font-semibold">
              {mode === "free"
                ? "Upload Your Singing"
                : "Upload Both Recordings"}
            </h3>

            <p className="mt-2 text-sm text-slate-400">
              MP3, WAV, M4A, AAC, FLAC, OGG or WebM • Maximum 100 MB and 6 minutes per file
            </p>

            <div className="mt-7">
              <label htmlFor="singing-upload" className="mb-3 block font-medium">
                Your Singing Recording
              </label>

              <input
                key={`singing-${mode}-${selectionKey}`}
                id="singing-upload"
                type="file"
                accept={ACCEPTED_AUDIO}
                onChange={(e) => handleFile(e, "singing")}
                disabled={isUploading}
                className="block w-full rounded-xl border border-white/10 bg-slate-800 p-3 text-sm text-slate-300 sm:p-4 file:mr-4 file:rounded-lg file:border-0 file:bg-violet-600 file:px-4 file:py-2 file:text-white"
              />

              {singingFile && (
                <AudioPreview file={singingFile} label="Your Singing Recording" />
              )}
            </div>

            {mode === "compare" && (
              <div className="mt-7">
                <label htmlFor="reference-upload" className="mb-3 block font-medium">
                  Reference Vocal Recording
                </label>

                <input
                  key={`reference-${selectionKey}`}
                  id="reference-upload"
                  type="file"
                  accept={ACCEPTED_AUDIO}
                  onChange={(e) => handleFile(e, "reference")}
                  disabled={isUploading}
                  className="block w-full rounded-xl border border-white/10 bg-slate-800 p-3 text-sm text-slate-300 sm:p-4 file:mr-4 file:rounded-lg file:border-0 file:bg-violet-600 file:px-4 file:py-2 file:text-white"
                />

                {referenceFile && (
                  <AudioPreview file={referenceFile} label="Reference Vocal Recording" />
                )}
              </div>
            )}

            <button
              type="button"
              onClick={checkFiles}
              disabled={isUploading}
              aria-busy={isUploading}
              className="mt-8 w-full rounded-xl bg-violet-600 py-4 font-semibold transition hover:bg-violet-500 disabled:cursor-not-allowed disabled:opacity-60"
            >
              <span className="inline-flex items-center justify-center gap-3">
                {isUploading && (
                  <span
                    className="h-5 w-5 animate-spin rounded-full border-2 border-white/30 border-t-white"
                    aria-hidden="true"
                  />
                )}
                {isUploading
                  ? mode === "free" ? "Analyzing with AI..." : "Analyzing both recordings..."
                  : mode === "free" ? "Analyze My Singing →" : "Compare Both Recordings →"}
              </span>
            </button>

            {(singingFile || referenceFile || analysisResult) && !isUploading && (
              <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
                <p className="text-xs text-slate-400">
                  Audio runs locally through your FastAPI server. Large files may take longer on CPU.
                </p>
                <button
                  type="button"
                  onClick={clearCurrentSelection}
                  className="rounded-lg border border-white/20 px-4 py-2 text-sm text-slate-200 transition hover:bg-white/10 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-violet-400"
                >
                  Clear selection
                </button>
              </div>
            )}

            {message && (
              <p
                role={isError ? "alert" : "status"}
                className={`mt-5 rounded-lg border p-4 text-sm ${
                  isError
                    ? "border-red-500/30 bg-red-500/10 text-red-200"
                    : "border-violet-500/20 bg-slate-800 text-slate-200"
                }`}
              >
                {message}
              </p>
            )}

            {historyWarning && (
              <p role="alert" className="mt-4 rounded-lg border border-amber-500/30 bg-amber-500/10 p-4 text-sm text-amber-200">
                {historyWarning}
              </p>
            )}

            {mode === "free" && analysisResult && (
              <PitchResults result={analysisResult} />
            )}

            {mode === "compare" && analysisResult && referenceAnalysis && (
              <ReferenceComparison
                singing={analysisResult}
                reference={referenceAnalysis}
              />
            )}

            {analysisResult && (mode === "free" || referenceAnalysis) && (
              <PracticeCoach
                key={mode + "-" + analysisResult.filename + "-" + (referenceAnalysis?.filename ?? "")}
                analysis={analysisResult}
                reference={mode === "compare" ? referenceAnalysis : null}
              />
            )}

            {analysisResult && (mode === "free" || referenceAnalysis) && (
              <div className="mt-5 flex flex-wrap justify-end">
                <button
                  type="button"
                  onClick={exportResults}
                  className="rounded-xl border border-violet-400/40 bg-violet-500/10 px-4 py-2.5 text-sm font-medium text-violet-200 transition hover:bg-violet-500/20 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-violet-400"
                >
                  Download pitch results (.json) ↓
                </button>
              </div>
            )}

            <p className="mt-4 text-center text-xs text-slate-500">
              {mode === "free"
                ? "AI pitch estimates are approximate. Clear solo vocals work best."
                : "Basic alignment adjusts starting-time offsets up to 3 seconds; use the same excerpt at a similar tempo."}
            </p>

          </div>
        </div>
      </section>



            {/* Karaoke Studio */}
      <KaraokeMaker />

      {/* Analysis History — last main section */}
      <AnalysisHistory refreshKey={historyRevision} />

      {/* Footer */}
      <footer className="border-t border-white/10 px-6 py-8 text-center">
        <p className="text-sm text-slate-500">
          RehearsalRadar AI • Intelligent Singing Practice Platform
        </p>
      </footer>

    </div>
  );
}

export default App;
