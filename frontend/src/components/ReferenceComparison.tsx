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
  const singingPoints = singing.pitch_contour;
  const referencePoints = reference.pitch_contour;
  const maxFrames = Math.max(singingPoints.length, referencePoints.length);
  const stride = Math.max(1, Math.ceil(maxFrames / 900));

  // Both API responses use 10 ms frames starting at time zero.
  // We compare corresponding timestamps, without automatic alignment.
  const chartData: ChartPoint[] = [];
  for (let index = 0; index < maxFrames; index += stride) {
    chartData.push({
      time: Math.round(index * 0.01 * 100) / 100,
      singingHz: singingPoints[index]?.pitch_hz ?? null,
      referenceHz: referencePoints[index]?.pitch_hz ?? null,
    });
  }

  const hasBothPitches =
    singing.median_pitch_hz !== null &&
    reference.median_pitch_hz !== null &&
    singing.median_pitch_hz > 0 &&
    reference.median_pitch_hz > 0;

  const medianOffsetSemitones = hasBothPitches
    ? 12 * Math.log2(singing.median_pitch_hz! / reference.median_pitch_hz!)
    : null;

  return (
    <div className="mt-8 space-y-6">
      <div>
        <h3 className="text-2xl font-bold">Reference Pitch Comparison</h3>
        <p className="mt-2 text-sm text-slate-400">
          Two vocal recordings analyzed using the same pitch estimation model.
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

      {medianOffsetSemitones !== null ? (
        <div className="rounded-xl border border-white/10 bg-slate-950 p-5">
          <p className="text-sm text-slate-400">Overall median pitch offset</p>
          <p className="mt-2 text-2xl font-semibold text-white">
            {medianOffsetSemitones >= 0 ? "+" : ""}
            {medianOffsetSemitones.toFixed(2)} semitones
          </p>
          <p className="mt-2 text-sm text-slate-400">
            Positive means your recording's median pitch is higher than the
            reference's; negative means lower. This is not a note accuracy score.
          </p>
        </div>
      ) : (
        <p className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-4 text-sm text-amber-200">
          Reliable pitch was not found in one or both recordings. Try clear,
          solo vocal recordings without instruments.
        </p>
      )}

      <div className="rounded-2xl border border-white/10 bg-slate-950 p-5 sm:p-6">
        <h4 className="text-xl font-semibold">Pitch Contours — Side by Side</h4>
        <p className="mt-2 text-sm text-slate-400">
          Violet: your singing. Cyan: reference. Gaps mark uncertain or silent audio.
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
      </div>

      <div className="rounded-xl border border-violet-500/20 bg-violet-500/10 p-5">
        <h4 className="font-semibold text-violet-300">How to use this comparison</h4>
        <p className="mt-2 text-sm leading-relaxed text-slate-300">
          Upload two clean vocal recordings of the same excerpt, starting at
          approximately the same moment and sung in the same key. Compare the
          upward and downward movements in the two curves. This version does
          not automatically align timing, isolate vocals from music, or grade
          individual notes. A difference in curves does not by itself prove
          incorrect singing.
        </p>
      </div>
    </div>
  );
}
