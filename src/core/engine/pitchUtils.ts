/** 从音高字符串（如 C3、F#4、Bb5）解析八度 */
export function getOctaveFromPitch(pitch: string): number {
  const m = pitch.match(/(\d+)$/);
  return m ? parseInt(m[1], 10) : 4;
}

/** 音名 + 八度 → Tone 可播放音高，如 C3、C#4 */
export function pitchAtOctave(noteName: string, octave: number): string {
  return `${noteName}${octave}`;
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
