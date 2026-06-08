import { audioEngine } from './AudioEngine';
import { pitchToToneNote } from './pitchUtils';

/** 答错后恢复可再次判题前的等待时间（与闯关模式一致） */
export const WRONG_FEEDBACK_RESET_MS = 600;

/** 先后两个音之间的延迟（毫秒），让听者能清晰分辨每个音高 */
const STAGGER_DELAY_MS = 1000;

/** 播放谱面上一对音（双音练习 / 乐理闯关共用）
 *  按传入顺序先后播放：先响 firstPitch，延迟后再响 secondPitch。
 *  调用方应保证 firstPitch 是谱面上第一个音。 */
export function playIntervalPairAudio(firstPitch: string, secondPitch: string) {
  const first = pitchToToneNote(firstPitch);
  const second = pitchToToneNote(secondPitch);
  if (first === second) {
    void audioEngine.playNote(first);
  } else {
    void audioEngine.playNote(first);
    setTimeout(() => {
      void audioEngine.playNotes([second]);
    }, STAGGER_DELAY_MS);
  }
}
