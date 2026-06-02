import { audioEngine } from './AudioEngine';
import { pitchToToneNote } from './pitchUtils';

/** 答错后恢复可再次判题前的等待时间（与闯关模式一致） */
export const WRONG_FEEDBACK_RESET_MS = 600;

/** 播放谱面上一对音（双音练习 / 乐理闯关共用） */
export function playIntervalPairAudio(lowPitch: string, highPitch: string) {
  const low = pitchToToneNote(lowPitch);
  const high = pitchToToneNote(highPitch);
  if (low === high) {
    void audioEngine.playNote(low);
  } else {
    void audioEngine.playNotes([low, high]);
  }
}
