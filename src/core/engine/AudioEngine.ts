import * as Tone from 'tone';

/** 采样尾音上限，用于在播完后允许再次触发同一音 */
const NOTE_PLAY_MS = 5000;

class AudioEngine {
  private static instance: AudioEngine;
  private sampler: Tone.Sampler | null = null;
  private activeNote: string | null = null;
  private endTimer: ReturnType<typeof setTimeout> | null = null;
  public isReady = false;
  public enabled = localStorage.getItem('audioEnabled') !== 'false';

  public setEnabled(val: boolean) {
    this.enabled = val;
    localStorage.setItem('audioEnabled', String(val));
  }

  private constructor() {
    this.sampler = new Tone.Sampler({
      urls: {
        C1: 'C1.mp3',
        C2: 'C2.mp3',
        C3: 'C3.mp3',
        C4: 'C4.mp3',
        C5: 'C5.mp3',
        C6: 'C6.mp3',
        C7: 'C7.mp3',
        C8: 'C8.mp3',
        F1: 'F1.mp3',
        F2: 'F2.mp3',
        F3: 'F3.mp3',
        F4: 'F4.mp3',
        F5: 'F5.mp3',
        F6: 'F6.mp3',
        F7: 'F7.mp3',
      },
      baseUrl: '/audio/piano/',
      release: 0.4,
      onload: () => {
        this.isReady = true;
        console.log('钢琴音源加载完毕');
      },
    }).toDestination();
  }

  public static getInstance(): AudioEngine {
    if (!AudioEngine.instance) {
      AudioEngine.instance = new AudioEngine();
    }
    return AudioEngine.instance;
  }

  private clearEndTimer() {
    if (this.endTimer) {
      clearTimeout(this.endTimer);
      this.endTimer = null;
    }
  }

  private scheduleActiveClear(note: string) {
    this.clearEndTimer();
    this.endTimer = setTimeout(() => {
      if (this.activeNote === note) {
        this.activeNote = null;
      }
      this.endTimer = null;
    }, NOTE_PLAY_MS);
  }

  public stop() {
    if (this.activeNote && this.sampler) {
      this.sampler.triggerRelease(this.activeNote, Tone.now());
      this.activeNote = null;
    }
    this.clearEndTimer();
  }

  public async prime() {
    if (Tone.context.state !== 'running') {
      await Tone.start();
    }
  }

  public async playNote(note: string) {
    if (!this.enabled) return;
    if (Tone.context.state !== 'running') {
      await Tone.start();
    }
    if (!this.isReady || !this.sampler) return;

    const now = Tone.now();

    // 同一键连击：不打断当前发声
    if (this.activeNote === note) {
      return;
    }

    // 切换到其他键：释放上一音，再触发新音
    if (this.activeNote) {
      this.sampler.triggerRelease(this.activeNote, now);
    }

    this.sampler.triggerAttack(note, now);
    this.activeNote = note;
    this.scheduleActiveClear(note);
  }
}

export const audioEngine = AudioEngine.getInstance();
