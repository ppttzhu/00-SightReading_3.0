import { audioEngine } from './AudioEngine';
import { pitchToToneNote } from './pitchUtils';

/** 答错后恢复可再次判题前的等待时间（与闯关模式一致） */
export const WRONG_FEEDBACK_RESET_MS = 600;

/** 先后两个音之间的延迟（毫秒），让听者能清晰分辨每个音高 */
export const STAGGER_DELAY_MS = 1000;

/** 逐个播放一串音（音型、和弦分解等），每个音间隔 STAGGER_DELAY_MS */
export function playSequentialNotes(notes: string[]) {
  if (notes.length === 0) return;
  notes.forEach((n, i) => {
    const toneNote = pitchToToneNote(n);
    if (i === 0) {
      void audioEngine.playNote(toneNote);
    } else {
      setTimeout(() => {
        void audioEngine.playNotes([toneNote]);
      }, STAGGER_DELAY_MS * i);
    }
  });
}

/** 播放谱面上一对音（旋律音程 / 乐理闯关共用）
 *  先弹 firstPitch，延迟后再弹 secondPitch（自动停掉前一个音）。
 *  调用方应保证 firstPitch 是谱面上第一个音。 */
export function playIntervalPairAudio(firstPitch: string, secondPitch: string) {
  const first = pitchToToneNote(firstPitch);
  const second = pitchToToneNote(secondPitch);
  void audioEngine.playNote(first);
  setTimeout(() => {
    void audioEngine.playNotes([second]);
  }, STAGGER_DELAY_MS);
}

/** 同时弹响一对音（和声音程用）：两个音在同一时刻发声。 */
export function playIntervalHarmonic(lowPitch: string, highPitch: string) {
  void audioEngine.playNotes([pitchToToneNote(lowPitch), pitchToToneNote(highPitch)]);
}
