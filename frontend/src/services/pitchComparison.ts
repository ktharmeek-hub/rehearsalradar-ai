import type { AnalysisResponse } from "./audioApi";

export interface ComparisonMetrics {
  // Reference timestamp = singing timestamp + timeOffsetSeconds.
  timeOffsetSeconds: number;
  // Approximate amount of paired, voiced audio; not the total clip duration.
  matchedDurationSeconds: number;
  // Positive = singer's detected pitch is higher, among matched samples.
  medianPitchOffsetSemitones: number;
  // Mean absolute difference among matched voiced samples.
  meanPitchDifferenceSemitones: number;
  // Descriptive agreement measure, NOT a note-correctness score.
  withinOneSemitonePercent: number;
}

function median(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0
    ? (sorted[middle - 1] + sorted[middle]) / 2
    : sorted[middle];
}

// Downsample into 100 ms windows and take the median voiced pitch per window.
// This reduces small frame-to-frame fluctuations before aligning two recordings.
function pitchBins(result: AnalysisResponse): Map<number, number> {
  const groups = new Map<number, number[]>();

  for (const point of result.pitch_contour) {
    const hz = point.pitch_hz;
    if (hz === null || !Number.isFinite(hz) || hz <= 0) continue;

    const bin = Math.round(point.time * 10);
    const samples = groups.get(bin) ?? [];
    samples.push(12 * Math.log2(hz / 440));
    groups.set(bin, samples);
  }

  return new Map(
    [...groups].map(([bin, samples]) => [bin, median(samples)])
  );
}

/**
 * Estimate a single global starting-time offset (up to +/- 3 seconds).
 * Appropriate only for approximately matching excerpts at similar tempos.
 * It does NOT perform dynamic time warping or determine singing correctness.
 */
export function comparePitch(
  singing: AnalysisResponse,
  reference: AnalysisResponse
): ComparisonMetrics | null {
  const singer = pitchBins(singing);
  const ref = pitchBins(reference);
  const smallerCount = Math.min(singer.size, ref.size);
  if (smallerCount < 10) return null;

  const minimumOverlap = Math.max(10, Math.ceil(smallerCount * 0.35));
  let bestShift = 0;
  let bestScore = Infinity;
  let bestDifferences: number[] = [];

  for (let shift = -30; shift <= 30; shift++) {
    const differences: number[] = [];

    for (const [timeBin, singerPitch] of singer) {
      const referencePitch = ref.get(timeBin + shift);
      if (referencePitch !== undefined) {
        differences.push(singerPitch - referencePitch);
      }
    }

    if (differences.length < minimumOverlap) continue;

    // Align the *shape* of the pitch curves, allowing for an overall key shift.
    const pitchOffset = median(differences);
    const averageShapeError =
      differences.reduce((sum, delta) => sum + Math.abs(delta - pitchOffset), 0) /
      differences.length;
    const overlapPenalty = 0.4 * (1 - differences.length / smallerCount);
    const shiftPenalty = Math.abs(shift) * 0.001;
    const score = averageShapeError + overlapPenalty + shiftPenalty;

    if (score < bestScore) {
      bestScore = score;
      bestShift = shift;
      bestDifferences = differences;
    }
  }

  if (bestDifferences.length === 0) return null;

  const meanAbsoluteDifference =
    bestDifferences.reduce((sum, delta) => sum + Math.abs(delta), 0) /
    bestDifferences.length;
  const closeSamples = bestDifferences.filter(
    (delta) => Math.abs(delta) <= 1
  ).length;

  return {
    timeOffsetSeconds: Number((bestShift / 10).toFixed(2)),
    matchedDurationSeconds: Number((bestDifferences.length / 10).toFixed(2)),
    medianPitchOffsetSemitones: Number(median(bestDifferences).toFixed(2)),
    meanPitchDifferenceSemitones: Number(meanAbsoluteDifference.toFixed(2)),
    withinOneSemitonePercent: Number(
      ((closeSamples / bestDifferences.length) * 100).toFixed(1)
    ),
  };
}
