/**
 * Playback helper for the RCM Level 6 Playback exercise. Plays the tonic chord
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

/** Play the tonic chord once as a blocked chord (all tones simultaneously). */
export function playTonic(tonic: string[]): void {
  audioEngine.stop();
  void audioEngine.playNotes(tonic.map(pitchToToneNote));
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
