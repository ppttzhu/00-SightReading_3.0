/**
 * Playback helper for the RCM Level 6 chord-progression exercise.
 *
 * Mirrors `intervalAudio.ts`: a thin Presentation-adjacent helper that schedules
 * blocked (solid) chords through the shared {@link audioEngine} and relies on
 * `audioEngine.stop()` (which cancels pending scheduled timers) to drop any
 * not-yet-sounded chords when the screen advances to the next question.
 *
 * This module carries no music-theory rules — it only turns already-resolved,
 * correctly-spelled chords into timed playback calls.
 */

import { audioEngine } from './AudioEngine';
import { pitchToToneNote } from './pitchUtils';
import type { ResolvedChord } from '../progression/chordResolver';

/** 相邻两个柱式和弦之间的延迟（毫秒），调校为让每个三和弦都清晰可辨。 */
export const PROGRESSION_CHORD_GAP_MS = 1000;

/**
 * 依次播放一条和声进行的三个「柱式」（solid）三和弦。
 *
 * 第一个和弦立即发声；其后的每个和弦通过
 * `audioEngine.scheduleNotes(tones, index * PROGRESSION_CHORD_GAP_MS, false)`
 * 计划播放。使用 `additive === false`，因此每个和弦在响起时会释放上一个和弦
 * （柱式衔接，而非叠加或分解），同一和弦内的音在同一时刻发声。由于后续和弦
 * 是通过 scheduleNotes 计划的，切换到下一题时调用 `stop()` 即可取消尚未响起的
 * 和弦（Requirement 7.3, 7.5）。
 *
 * 每个和弦的 `pitches`（带八度的拼写音，如 `"E4"`）经 {@link pitchToToneNote}
 * 转换为 Tone 可播放的音高。若 `chords` 为空则直接返回。
 *
 * @param chords 进行顺序排列的已解析和弦（根位）
 */
export function playProgression(chords: ResolvedChord[]): void {
  if (chords.length === 0) return;

  chords.forEach((chord, i) => {
    const tones = chord.pitches.map(pitchToToneNote);
    if (i === 0) {
      // 第一个和弦立即作为柱式和弦发声（所有音同时响起，非分解）。
      void audioEngine.playNotes(tones);
    } else {
      // 计划后续和弦，additive=false：释放上一个和弦并同时触发本和弦，
      // 且切换题目时 stop() 能取消尚未响起的和弦。
      audioEngine.scheduleNotes(tones, i * PROGRESSION_CHORD_GAP_MS, false);
    }
  });
}
