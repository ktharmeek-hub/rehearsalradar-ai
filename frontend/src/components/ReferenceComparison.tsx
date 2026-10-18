import { useMemo } from "react";
import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import type { AnalysisResponse } from "../services/audioApi";
import { comparePitch } from "../services/pitchComparison";

type Props = {
  singing: AnalysisResponse;
  reference: AnalysisResponse;
};

type ChartPoint = {
  time: number;
  singingHz: number | null;
  referenceHz: number | null;
};

function displayHz(pitch: number | null): string {
  return pitch === null ? "N/A" : `${pitch.toFixed(2)} Hz`;
}

export default function ReferenceComparison({ singing, reference }: Props) {
  const metrics = useMemo(
    () => comparePitch(singing, reference),
    [singing, reference]
  );

  const chartData = useMemo((): ChartPoint[] => {
    const singerPoints = singing.pitch_contour;
    const referencePoints = reference.pitch_contour;
    const stride = Math.max(1, Math.ceil(singerPoints.length / 900));
    // Positive offset means a later time in the reference corresponds
    // to the given time in the singing recording.
    const referenceShiftFrames = Math.round(
      (metrics?.timeOffsetSeconds ?? 0) * 100
    );
    const points: ChartPoint[] = [];

    for (let i = 0; i < singerPoints.length; i += stride) {
      const refIndex = i + referenceShiftFrames;
      points.push({
        time: singerPoints[i].time,
        singingHz: singerPoints[i].pitch_hz,
        referenceHz:
          refIndex >= 0 && refIndex < referencePoints.length
            ? referencePoints[refIndex].pitch_hz
            : null,
      });
    }
    return points;
  }, [singing, reference, metrics]);

  const hasReliablePitch =
    singing.status === "success" && reference.status === "success";

  let feedback =
    "Listen to the same short phrase in both recordings, then compare its rising and falling pitch patterns.";

  if (metrics) {
    const offset = metrics.medianPitchOffsetSemitones;
    if (Math.abs(offset) >= 1) {
      feedback = `Your matched voiced sections are generally ${Math.abs(offset).toFixed(2)} semitones ${offset > 0 ? "higher" : "lower"} than the reference. If matching the reference key is your goal, practise the same phrase slowly in that key.`;
    } else if (metrics.meanPitchDifferenceSemitones > 1) {
      feedback =
        "The overall key is fairly close, but some aligned voiced sections differ. Replay short phrases where the violet and cyan lines separate, and practise those phrases individually.";
    } else {
      feedback =
        "The matched vocal pitch patterns appear close in this test. Try another recording of the same excerpt to check whether the pattern is consistent.";
    }
  }

  return (
    <div className="mt-8 space-y-6">
      <div>
        <h3 className="text-2xl font-bold text-white">Reference Pitch Comparison</h3>
        <p className="mt-2 text-sm text-slate-400">
          Estimated vocal pitches from two recordings, with a small automatic starting-time adjustment.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="rounded-xl border border-violet-500/30 bg-slate-950 p-5">
          <p className="text-sm text-slate-400">Your Singing — Median Pitch</p>
          <p className="mt-2 text-2xl font-bold text-violet-400">
            {displayHz(singing.median_pitch_hz)}
          </p>
          <p className="mt-2 break-all text-xs text-slate-400">{singing.filename}</p>
        </div>
        <div className="rounded-xl border border-cyan-500/30 bg-slate-950 p-5">
          <p className="text-sm text-slate-400">Reference Vocal — Median Pitch</p>
          <p className="mt-2 text-2xl font-bold text-cyan-400">
            {displayHz(reference.median_pitch_hz)}
          </p>
          <p className="mt-2 break-all text-xs text-slate-400">{reference.filename}</p>
        </div>
      </div>

      {hasReliablePitch && metrics ? (
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="rounded-xl border border-white/10 bg-slate-950 p-5">
            <p className="text-sm text-slate-400">Estimated Time Offset</p>
            <p className="mt-2 text-2xl font-bold text-white">
              {metrics.timeOffsetSeconds > 0 ? "+" : ""}
              {metrics.timeOffsetSeconds.toFixed(2)} s
            </p>
            <p className="mt-2 text-xs text-slate-400">
              Reference playback position relative to your recording (up to ±3 s).
            </p>
          </div>
          <div className="rounded-xl border border-white/10 bg-slate-950 p-5">
            <p className="text-sm text-slate-400">Matched Voiced Audio (approx.)</p>
            <p className="mt-2 text-2xl font-bold text-white">
              {metrics.matchedDurationSeconds.toFixed(1)} s
            </p>
            <p className="mt-2 text-xs text-slate-400">
              Total paired voiced time, not the continuous excerpt length.
            </p>
          </div>
          <div className="rounded-xl border border-white/10 bg-slate-950 p-5">
            <p className="text-sm text-slate-400">Matched Median Pitch Offset</p>
            <p className="mt-2 text-2xl font-bold text-violet-300">
              {metrics.medianPitchOffsetSemitones > 0 ? "+" : ""}
              {metrics.medianPitchOffsetSemitones.toFixed(2)} semitones
            </p>
            <p className="mt-2 text-xs text-slate-400">
              Positive means your detected vocal pitch is higher.
            </p>
          </div>
          <div className="rounded-xl border border-white/10 bg-slate-950 p-5">
            <p className="text-sm text-slate-400">Mean Absolute Pitch Difference</p>
            <p className="mt-2 text-2xl font-bold text-white">
              {metrics.meanPitchDifferenceSemitones.toFixed(2)} semitones
            </p>
            <p className="mt-2 text-xs text-slate-400">
              {metrics.withinOneSemitonePercent.toFixed(1)}% of paired voiced samples are within 1 semitone. Not a singing accuracy score.
            </p>
          </div>
        </div>
      ) : (
        <p className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-4 text-sm text-amber-200">
          {hasReliablePitch
            ? "Not enough corresponding voiced audio to estimate a time offset reliably. The graph below uses the original timestamps."
            : "Reliable pitch was not found in one or both recordings. Try clear solo vocals without instruments."}
        </p>
      )}

      <div className="rounded-2xl border border-white/10 bg-slate-950 p-5 sm:p-6">
        <h4 className="text-xl font-semibold text-white">Aligned Pitch Contours</h4>
        <p className="mt-2 text-sm text-slate-400">
          Violet: your singing. Cyan: reference. Gaps are silent or uncertain regions.
        </p>
        <div className="mt-6 h-80 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={chartData}>
              <CartesianGrid stroke="#334155" strokeDasharray="3 3" />
              <XAxis
                dataKey="time"
                stroke="#94a3b8"
                tickFormatter={(value: number) => `${value}s`}
              />
              <YAxis stroke="#94a3b8" unit=" Hz" domain={["auto", "auto"]} />
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
              <Legend />
              <Line
                type="linear"
                dataKey="singingHz"
                name="Your Singing"
                stroke="#a78bfa"
                strokeWidth={2}
                dot={false}
                connectNulls={false}
                isAnimationActive={false}
              />
              <Line
                type="linear"
                dataKey="referenceHz"
                name="Reference Vocal"
                stroke="#22d3ee"
                strokeWidth={2}
                dot={false}
                connectNulls={false}
                isAnimationActive={false}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
        <p className="mt-4 text-xs text-slate-500">
          Alignment assumes the same song excerpt at approximately the same tempo. It does not correct for tempo changes or prove whether individual notes were sung correctly.
        </p>
      </div>

      <div className="rounded-xl border border-violet-500/20 bg-violet-500/10 p-5">
        <h4 className="font-semibold text-violet-300">Practice Insight</h4>
        <p className="mt-2 text-sm leading-relaxed text-slate-300">
          {feedback}
        </p>
      </div>
    </div>
  );
}
