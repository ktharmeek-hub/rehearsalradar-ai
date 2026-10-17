
import { useState, type ChangeEvent } from "react";

type Mode = "free" | "compare";

function App() {
  const [mode, setMode] = useState<Mode>("free");
  const [singingFile, setSingingFile] = useState<File | null>(null);
  const [referenceFile, setReferenceFile] = useState<File | null>(null);
  const [message, setMessage] = useState("");

  function selectMode(selected: Mode) {
    setMode(selected);
    setSingingFile(null);
    setReferenceFile(null);
    setMessage("");

    document.getElementById("studio")?.scrollIntoView({
      behavior: "smooth",
    });
  }

  function handleFile(
    event: ChangeEvent<HTMLInputElement>,
    type: "singing" | "reference"
  ) {
    const file = event.target.files?.[0];

    setMessage("");

    if (!file) return;

    if (!file.name.toLowerCase().endsWith(".wav")) {
      setMessage("Please select a WAV audio file.");
      event.target.value = "";
      return;
    }

    if (file.size > 10 * 1024 * 1024) {
      setMessage("File size must be less than 10 MB.");
      event.target.value = "";
      return;
    }

    if (type === "singing") {
      setSingingFile(file);
    } else {
      setReferenceFile(file);
    }
  }

  function checkFiles() {
    if (!singingFile) {
      setMessage("Please select your singing recording.");
      return;
    }

    if (mode === "compare" && !referenceFile) {
      setMessage("Please select a reference recording.");
      return;
    }

    setMessage(
      "Files selected successfully! We will connect AI analysis in the next development stages."
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 text-white">

      {/* Navigation */}
      <nav className="border-b border-white/10 bg-slate-950/90">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-5">

          <a href="#" className="flex items-center gap-3">
            <div className="rounded-xl bg-violet-600 px-3 py-2 text-xl">
              ♫
            </div>
            <span className="text-xl font-bold">
              Rehearsal<span className="text-violet-400">Radar</span>
            </span>
          </a>

          <div className="flex items-center gap-5 text-sm">
            <a href="#features" className="text-slate-300 hover:text-white">
              Features
            </a>
            <a href="#studio" className="rounded-lg bg-violet-600 px-4 py-2 font-medium hover:bg-violet-500">
              Start Singing
            </a>
          </div>

        </div>
      </nav>

      {/* Hero Section */}
      <section className="relative overflow-hidden px-6 py-24 text-center">

        <div className="pointer-events-none absolute left-1/2 top-0 h-96 w-96 -translate-x-1/2 rounded-full bg-violet-700/20 blur-3xl" />

        <div className="relative mx-auto max-w-4xl">

          <div className="mb-6 inline-block rounded-full border border-violet-500/30 bg-violet-500/10 px-5 py-2 text-sm text-violet-300">
            AI-Powered Singing Analysis
          </div>

          <h1 className="text-5xl font-extrabold leading-tight md:text-7xl">
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
      <section id="features" className="bg-slate-900/50 px-6 py-20">

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
      <section id="studio" className="px-6 py-20">

        <div className="mx-auto max-w-3xl">

          <h2 className="text-center text-3xl font-bold">
            Your Singing Studio
          </h2>

          <p className="mt-3 text-center text-slate-400">
            Choose how you want to analyze your singing.
          </p>

          {/* Mode Selection */}
          <div className="mt-10 grid gap-4 sm:grid-cols-2">

            <button
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
          <div className="mt-8 rounded-2xl border border-white/10 bg-slate-900 p-7">

            <h3 className="text-xl font-semibold">
              {mode === "free"
                ? "Upload Your Singing"
                : "Upload Both Recordings"}
            </h3>

            <p className="mt-2 text-sm text-slate-400">
              WAV audio only • Maximum 10 MB per file
            </p>

            <div className="mt-7">
              <label className="mb-3 block font-medium">
                Your Singing Recording
              </label>

              <input
                key={`singing-${mode}`}
                type="file"
                accept=".wav,audio/wav"
                onChange={(e) => handleFile(e, "singing")}
                className="block w-full rounded-xl border border-white/10 bg-slate-800 p-4 text-sm text-slate-300 file:mr-4 file:rounded-lg file:border-0 file:bg-violet-600 file:px-4 file:py-2 file:text-white"
              />

              {singingFile && (
                <p className="mt-2 text-sm text-green-400">
                  Selected: {singingFile.name}
                </p>
              )}
            </div>

            {mode === "compare" && (
              <div className="mt-7">
                <label className="mb-3 block font-medium">
                  Reference Vocal Recording
                </label>

                <input
                  key="reference"
                  type="file"
                  accept=".wav,audio/wav"
                  onChange={(e) => handleFile(e, "reference")}
                  className="block w-full rounded-xl border border-white/10 bg-slate-800 p-4 text-sm text-slate-300 file:mr-4 file:rounded-lg file:border-0 file:bg-violet-600 file:px-4 file:py-2 file:text-white"
                />

                {referenceFile && (
                  <p className="mt-2 text-sm text-green-400">
                    Selected: {referenceFile.name}
                  </p>
                )}
              </div>
            )}

            <button
              onClick={checkFiles}
              className="mt-8 w-full rounded-xl bg-violet-600 py-4 font-semibold transition hover:bg-violet-500"
            >
              Check Selected Files →
            </button>

            {message && (
              <p className="mt-5 rounded-lg bg-slate-800 p-4 text-sm text-slate-200">
                {message}
              </p>
            )}

            <p className="mt-4 text-center text-xs text-slate-500">
              AI analysis and backend upload will be connected next.
            </p>

          </div>
        </div>
      </section>

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
