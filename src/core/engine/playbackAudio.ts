/**
 * Playback helper for the Playback exercise. Plays the tonic chord
 * (blocked) and the melody (sequential, timed by each note's beat duration)
 * through the shared AudioEngine. Relies on `AudioEngine.stop()` to cancel
 * pending scheduled notes when replaying or advancing. Mirrors intervalAudio.ts.
 */

import { audioEngine } from './AudioEngine';
import { pitchToToneNote } from './pitchUtils';
import type { MelodyNote } from '../playback/playbackTypes';

/** Tempo used for melody playback (beats per minute). */
export const PLAYBACK_BPM = 90;

/** Milliseconds per beat at {@link PLAYBACK_BPM}. */
export const MS_PER_BEAT = 60000 / PLAYBACK_BPM;

/** Default gap between the tonic chord and the melody in the auto-play cue. */
export const TONIC_TO_MELODY_GAP_MS = 3000;

/** Play the tonic chord once as a blocked chord (all tones simultaneously). */
export function playTonic(tonic: string[]): void {
  audioEngine.stop();
  void audioEngine.playNotes(tonic.map(pitchToToneNote));
}

/**
 * Auto-play cue for a new question: sound the tonic chord once, wait
 * `gapMs`, then play the melody once. The tonic sounds immediately and every
 * melody note is scheduled through the engine (relative to the gap), so a
 * single {@link AudioEngine.stop} — which fires on question change/replay —
 * cancels the whole pending sequence and nothing from the previous question
 * bleeds into the next.
 *
 * @param tonic  the tonic chord pitches
 * @param melody the melody notes (pitch + beats)
 * @param gapMs  silence between the chord and the first melody note
 */
export function playTonicThenMelody(
  tonic: string[],
  melody: MelodyNote[],
  gapMs: number = TONIC_TO_MELODY_GAP_MS,
): void {
  audioEngine.stop();
  void audioEngine.playNotes(tonic.map(pitchToToneNote));
  let offsetBeats = 0;
  for (const note of melody) {
    audioEngine.scheduleNotes([pitchToToneNote(note.pitch)], gapMs + offsetBeats * MS_PER_BEAT, false);
    offsetBeats += note.beats;
  }
}

/**
 * Play the melody once, note by note, each note scheduled at its cumulative
 * beat offset. The first note sounds immediately; later notes are scheduled via
 * `scheduleNotes` so a new question's `stop()` cancels pending notes.
 *
 * @param melody the melody notes (pitch + beats)
 */
export function playMelody(melody: MelodyNote[]): void {
  if (melody.length === 0) return;
  audioEngine.stop();
  let offsetBeats = 0;
  melody.forEach((note, i) => {
    const tone = pitchToToneNote(note.pitch);
    if (i === 0) {
      void audioEngine.playNotes([tone]);
    } else {
      audioEngine.scheduleNotes([tone], offsetBeats * MS_PER_BEAT, false);
    }
    offsetBeats += note.beats;
  });
}
