/** 从音高字符串（如 C3、F#4、Bb5）解析八度 */
export function getOctaveFromPitch(pitch: string): number {
  const m = pitch.match(/(\d+)$/);
  return m ? parseInt(m[1], 10) : 4;
}

/** 音名 + 八度 → Tone 可播放音高，如 C3、C#4 */
export function pitchAtOctave(noteName: string, octave: number): string {
  return `${noteName}${octave}`;
}

/** Convert pitch string to a diatonic staff value for clef/range comparison. */
export function pitchToStaffNum(pitch: string): number {
  const noteVal: Record<string, number> = { C: 0, D: 1, E: 2, F: 3, G: 4, A: 5, B: 6 };
  const match = pitch.match(/^([A-Ga-g])(?:#|b)?(\d+)$/);
  if (!match) return pitchToStaffNum('C4');
  return parseInt(match[2], 10) * 7 + noteVal[match[1].toUpperCase()];
}

function pitchToMidi(pitch: string): number {
  const noteVal: Record<string, number> = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };
  const match = pitch.match(/^([A-Ga-g])(#|b)?(\d+)$/);
  if (!match) return pitchToMidi('C4');
  const accidentalOffset = match[2] === '#' ? 1 : match[2] === 'b' ? -1 : 0;
  return (parseInt(match[3], 10) + 1) * 12 + noteVal[match[1].toUpperCase()] + accidentalOffset;
}

export type ClefType = 'treble' | 'bass' | 'grand';
export type StaffPlacement = 'auto' | 'treble' | 'bass';

export function getAutomaticClefForPitch(pitch: string): 'treble' | 'bass' {
  const num = pitchToMidi(pitch);
  const a4Num = pitchToMidi('A4');
  const e3Num = pitchToMidi('E3');

  if (num > a4Num) return 'treble';
  if (num < e3Num) return 'bass';
  return Math.random() > 0.5 ? 'treble' : 'bass';
}

/** Determine which staff of a grand staff a note belongs on. */
export function getGrandStaffPlacement(pitch: string): 'treble' | 'bass' {
  const num = pitchToMidi(pitch);
  const b3Num = pitchToMidi('B3');
  return num >= b3Num ? 'treble' : 'bass';
}

/** Resolve a StaffPlacement to an actual clef, falling back to auto-detect. */
export function resolvePlacement(pitch: string, pref: StaffPlacement): 'treble' | 'bass' {
  if (pref === 'treble' || pref === 'bass') return pref;
  return getGrandStaffPlacement(pitch);
}

/** For practice mode: randomly choose clef type, constrained by pitch range. */
export function getClefForPractice(pitch: string): ClefType {
  const num = pitchToMidi(pitch);
  const c5Num = pitchToMidi('C5');
  const f2Num = pitchToMidi('F2');

  // Notes too high for bass clef alone (too many ledger lines)
  if (num > c5Num) {
    return Math.random() > 0.5 ? 'treble' : 'grand';
  }
  // Notes too low for treble clef alone
  if (num < f2Num) {
    return Math.random() > 0.5 ? 'bass' : 'grand';
  }
  // Middle range: any of the three
  const r = Math.random();
  if (r < 0.33) return 'treble';
  if (r < 0.67) return 'bass';
  return 'grand';
}

/** 在题目参考八度上播放某个音名字母（选项/键盘作答用）
 * If the letter matches the reference pitch's base note, preserve its accidental. */
export function pitchForAnswerLetter(letter: string, referencePitch: string): string {
  const baseLetter = letter.charAt(0).toUpperCase();
  const refBase = referencePitch.charAt(0).toUpperCase();
  if (baseLetter === refBase) {
    // e.g. referencePitch "C#4" → play "C#4" not "C4"
    const m = referencePitch.match(/^([A-G][#b]?)(\d)$/i);
    if (m) return `${m[1].charAt(0).toUpperCase()}${m[1].slice(1)}${m[2]}`;
  }
  return pitchAtOctave(baseLetter, getOctaveFromPitch(referencePitch));
}
