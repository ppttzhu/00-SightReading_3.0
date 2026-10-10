/**
 * Beat-aware eighth-note beaming for the Playback notation renderer.
 *
 * Framework-free and side-effect-free so it can be unit-tested without a DOM,
 * VexFlow, or the audio engine. The renderer (`PlaybackPractice.tsx`) maps the
 * returned index groups onto its VexFlow StaveNotes.
 */

/**
 * Metric eighth-note beaming for ONE measure, as index groups into the
 * measure's note array.
 *
 * The quarter-note beat an eighth belongs to is `floor(onset)`; a beam run only
 * continues while consecutive eighths share the same beat. This keeps beams
 * metric: two eighths filling one beat beam together, but a beam never spans a
 * beat boundary. For example `[1.5, 0.5, 0.5, 0.5, 1]` yields a lone eighth on
 * beat 2's upbeat (index 1, which the caller flags because the group has size
 * 1) and a beamed pair on beat 3 (indices 2–3) — never a 3-eighth beam.
 *
 * Both 3/4 and 4/4 use quarter-note beats here, so 3/4 is never grouped like
 * 6/8. Because grouping runs per measure, beams never cross a barline. Groups
 * of size 1 are returned as-is; the caller filters them so an isolated eighth
 * is flagged rather than beamed.
 *
 * @param measureBeats durations (in beats) of the measure's notes, in order
 * @returns runs of note indices that should beam together
 */
export function beamIndexGroups(measureBeats: number[]): number[][] {
  const groups: number[][] = [];
  let run: number[] = [];
  let runBeat = -1;
  let onset = 0;
  const flush = () => { if (run.length) groups.push(run); run = []; };

  measureBeats.forEach((beats, i) => {
    if (beats === 0.5) {
      const beat = Math.floor(onset + 1e-9);
      if (run.length === 0) { runBeat = beat; run.push(i); }
      else if (beat === runBeat) { run.push(i); }
      else { flush(); runBeat = beat; run.push(i); }
    } else {
      flush();
      runBeat = -1;
    }
    onset += beats;
  });
  flush();
  return groups;
}
