/** 从音高字符串（如 C3、F#4、Bb5）解析八度 */
export function getOctaveFromPitch(pitch: string): number {
  const m = pitch.match(/(\d+)$/);
  return m ? parseInt(m[1], 10) : 4;
}

/** 音名 + 八度 → Tone 可播放音高，如 C3、C#4 */
export function pitchAtOctave(noteName: string, octave: number): string {
  return `${noteName}${octave}`;
}

/** 在题目参考八度上播放某个音名字母（选项/键盘作答用） */
export function pitchForAnswerLetter(letter: string, referencePitch: string): string {
  return pitchAtOctave(letter.charAt(0).toUpperCase(), getOctaveFromPitch(referencePitch));
}
