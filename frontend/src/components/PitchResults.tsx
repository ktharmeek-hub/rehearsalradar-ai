import { useMemo } from "react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";

import type { AnalysisResponse } from "../services/audioApi";
import { getPitchInsights } from "../services/pitchInsights";

interface PitchResultsProps {
  result: AnalysisResponse;
}

export default function PitchResults({ result }: PitchResultsProps) {
  const insights = useMemo(() => getPitchInsights(result), [result]);

  const chartData = useMemo(() => {
    const stride = Math.max(1, Math.ceil(result.pitch_contour.length / 1200));
    return result.pitch_contour.filter((_, index) => index % stride === 0);
  }, [result]);

  const formatPitch = (value: number | null) =>
    value === null ? "N/A" : `${value.toFixed(2)} Hz`;

  return (
    <div className="mt-8 space-y-6">
      <div>
        <h3 className="text-2xl font-bold text-white">
          AI Singing Analysis Results
        </h3>
        <p className="mt-2 break-all text-sm text-slate-400">
          Analyzed recording: {result.filename}
        </p>
      </div>

      {result.status === "no_pitch_detected" ? (
        <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-5 text-amber-200">
          No reliable vocal pitch detected. Try a clear solo singing recording
          without background music.
        </div>
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-3">
            <div className="rounded-xl border border-violet-500/30 bg-slate-900 p-5">
              <p className="text-sm text-slate-400">Median Pitch</p>
              <p className="mt-2 text-2xl font-bold text-violet-400">
                {formatPitch(result.median_pitch_hz)}
              </p>
            </div>
            <div className="rounded-xl border border-white/10 bg-slate-900 p-5">
              <p className="text-sm text-slate-400">
                Lower Pitch (5th percentile)
              </p>
              <p className="mt-2 text-2xl font-bold text-white">
                {formatPitch(result.min_pitch_hz)}
              </p>
            </div>
            <div className="rounded-xl border border-white/10 bg-slate-900 p-5">
              <p className="text-sm text-slate-400">
                Upper Pitch (95th percentile)
              </p>
              <p className="mt-2 text-2xl font-bold text-white">
                {formatPitch(result.max_pitch_hz)}
              </p>
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="rounded-xl border border-white/10 bg-slate-900 p-5">
              <p className="text-sm text-slate-400">Reliable Pitch Frames</p>
              <p className="mt-2 text-2xl font-bold text-white">
                {insights.reliablePitchPercent.toFixed(1)}%
              </p>
              <p className="mt-2 text-xs text-slate-400">
                Frames with a confident pitch estimate. Not a score for singing quality or vocal activity.
              </p>
            </div>
            <div className="rounded-xl border border-white/10 bg-slate-900 p-5">
              <p className="text-sm text-slate-400">
                Short-Window Pitch Variation
              </p>
              <p className="mt-2 text-2xl font-bold text-violet-300">
                {insights.medianLocalVariationCents === null
                  ? "Not available"
                  : `${insights.medianLocalVariationCents.toFixed(1)} cents`}
              </p>
              <p className="mt-2 text-xs text-slate-400">
                Median local variation across {insights.candidateSteadyWindows} approximately steady 0.5 s windows.
                Lower means less fluctuation in those windows, not greater note accuracy.
              </p>
            </div>
          </div>

          <div className="rounded-2xl border border-white/10 bg-slate-900 p-6">
            <h4 className="mb-2 text-xl font-semibold text-white">
              Pitch Contour
            </h4>
            <p className="mb-6 text-sm text-slate-400">
              How your detected vocal pitch changes over time.
            </p>
            <div className="h-80 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={chartData}>
                  <CartesianGrid stroke="#334155" strokeDasharray="3 3" />
                  <XAxis
                    dataKey="time"
                    stroke="#94a3b8"
                    tickFormatter={(value: number) => `${value}s`}
                  />
                  <YAxis
                    stroke="#94a3b8"
                    domain={["auto", "auto"]}
                    tickFormatter={(value: number) => `${value}`}
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "#0f172a",
                      border: "1px solid #475569",
                      borderRadius: "10px",
                      color: "#fff",
                    }}
                    formatter={(value) =>
                      typeof value === "number"
                        ? `${value.toFixed(2)} Hz`
                        : "No reliable pitch"
                    }
                  />
                  <Line
                    type="linear"
                    dataKey="pitch_hz"
                    name="Vocal Pitch"
                    stroke="#a78bfa"
                    strokeWidth={2}
                    dot={false}
                    connectNulls={false}
                    isAnimationActive={false}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
            <p className="mt-4 text-xs text-slate-500">
              Gaps represent low-confidence or unvoiced audio. Pitch estimates are approximate.
            </p>
          </div>

          <div className="rounded-xl border border-violet-500/20 bg-violet-500/10 p-5">
            <h4 className="mb-3 text-lg font-semibold text-violet-300">
              Practice Insights
            </h4>
            <ul className="list-disc space-y-2 pl-5 text-sm leading-relaxed text-slate-300">
              {insights.feedback.map((insight) => (
                <li key={insight}>{insight}</li>
              ))}
            </ul>
          </div>
        </>
      )}
    </div>
  );
}
