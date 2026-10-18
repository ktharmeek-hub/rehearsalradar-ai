import type { AnalysisResponse } from "./audioApi";

/** Descriptive summaries of confident pitch estimates, not a singing score. */
export interface PitchInsights {
  reliablePitchPercent: number;
  candidateSteadyWindows: number;
  medianLocalVariationCents: number | null;
  feedback: string[];
}

function median(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0
    ? (sorted[middle - 1] + sorted[middle]) / 2
    : sorted[middle];
}

function percentile(values: number[], fraction: number): number {
  const sorted = [...values].sort((a, b) => a - b);
  const index = (sorted.length - 1) * fraction;
  const lower = Math.floor(index);
  const upper = Math.ceil(index);
  return sorted[lower] + (sorted[upper] - sorted[lower]) * (index - lower);
}

export function getPitchInsights(result: AnalysisResponse): PitchInsights {
  const contour = result.pitch_contour;
  const totalFrames = contour.length;
  const validFrames = contour.filter(
    (point) =>
      point.pitch_hz !== null &&
      Number.isFinite(point.pitch_hz) &&
      point.pitch_hz > 0
  );

  const reliablePitchPercent = totalFrames
    ? (100 * validFrames.length) / totalFrames
    : 0;

  // Use separate half-second windows. We only describe variability in windows
  // with enough detected pitch and a modest pitch span. A short window is not
  // proof that a singer intended to sustain a musical note.
  const windows = new Map<number, { total: number; pitches: number[] }>();
  for (const point of contour) {
    const windowIndex = Math.floor(point.time / 0.5);
    const window = windows.get(windowIndex) ?? { total: 0, pitches: [] };
    window.total += 1;
    if (
      point.pitch_hz !== null &&
      Number.isFinite(point.pitch_hz) &&
      point.pitch_hz > 0
    ) {
      window.pitches.push(point.pitch_hz);
    }
    windows.set(windowIndex, window);
  }

  const localVariations: number[] = [];
  for (const window of windows.values()) {
    // Require a meaningful full-ish 0.5-second sample and mostly valid frames.
    if (window.total < 35 || window.pitches.length < window.total * 0.8) {
      continue;
    }

    const low = percentile(window.pitches, 0.1);
    const high = percentile(window.pitches, 0.9);
    const central = median(window.pitches);
    const spanCents = 1200 * Math.log2(high / low);

    // Exclude obvious note changes; keep approximately steady segments only.
    if (!Number.isFinite(spanCents) || spanCents > 100) continue;

    const deviations = window.pitches.map((hz) =>
      Math.abs(1200 * Math.log2(hz / central))
    );
    localVariations.push(median(deviations));
  }

  const medianLocalVariationCents = localVariations.length
    ? Number(median(localVariations).toFixed(1))
    : null;

  const feedback: string[] = [];
  if (reliablePitchPercent < 40) {
    feedback.push(
      "Reliable pitch was detected in a limited part of this recording. Try a clearer solo vocal recording with less background noise."
    );
  } else {
    feedback.push(
      "Use the pitch contour to locate rising, falling and repeated phrases; replay short sections that you want to practise."
    );
  }

  if (medianLocalVariationCents === null) {
    feedback.push(
      "There were too few approximately steady half-second sections to estimate local pitch variation. Try holding a single comfortable note for a few seconds."
    );
  } else if (medianLocalVariationCents < 25) {
    feedback.push(
      "The short sections selected for stability analysis show relatively little pitch fluctuation. Try sustaining a longer note and compare repeated attempts."
    );
  } else {
    feedback.push(
      "Some approximately steady sections show pitch fluctuation. Practise holding a comfortable note with even breath support, then compare another recording."
    );
  }

  feedback.push(
    "These measurements describe the detected audio; without a reference they cannot establish note correctness or singing quality."
  );

  return {
    reliablePitchPercent: Number(reliablePitchPercent.toFixed(1)),
    candidateSteadyWindows: localVariations.length,
    medianLocalVariationCents,
    feedback,
  };
}
