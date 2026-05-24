import * as Tone from 'tone';

/** 采样尾音上限，用于在播完后允许再次触发同一音 */
const NOTE_PLAY_MS = 5000;
/** 预览模式：按键反馈后自动释放的时长 */
const PREVIEW_HOLD_MS = 1200;
const RELEASE_MS = 400;

export type NoteLifecycleEvent =
  | { type: 'start'; note: string }
  | { type: 'fade'; note: string }
  | { type: 'end'; note: string };

export type PlayNoteOptions = {
  /** 预览模式：自动释放并触发 start/fade/end 生命周期事件 */
  preview?: boolean;
};

type NoteListener = (event: NoteLifecycleEvent) => void;

type NavigatorWithAudioSession = Navigator & {
  audioSession?: {
    type?: string;
  };
};

class AudioEngine {
  private static instance: AudioEngine;
  private sampler: Tone.Sampler | null = null;
  private activeNote: string | null = null;
  private endTimer: ReturnType<typeof setTimeout> | null = null;
  private fadeTimer: ReturnType<typeof setTimeout> | null = null;
  private listeners = new Set<NoteListener>();
  private silentUnlockAudio: HTMLAudioElement | null = null;
  private silentUnlockUrl: string | null = null;
  private silentUnlockStarted = false;
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

  public subscribe(listener: NoteListener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private emit(event: NoteLifecycleEvent) {
    this.listeners.forEach((listener) => listener(event));
  }

  private clearEndTimer() {
    if (this.endTimer) {
      clearTimeout(this.endTimer);
      this.endTimer = null;
    }
  }

  private clearFadeTimer() {
    if (this.fadeTimer) {
      clearTimeout(this.fadeTimer);
      this.fadeTimer = null;
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

  private schedulePreviewRelease(note: string) {
    this.clearEndTimer();
    this.endTimer = setTimeout(() => {
      this.beginPreviewRelease(note);
    }, PREVIEW_HOLD_MS);
  }

  private beginPreviewRelease(note: string) {
    this.clearEndTimer();
    this.clearFadeTimer();
    this.emit({ type: 'fade', note });
    if (this.enabled && this.sampler && this.activeNote === note) {
      this.sampler.triggerRelease(note, Tone.now());
    }
    if (this.activeNote === note) {
      this.activeNote = null;
    }
    this.fadeTimer = setTimeout(() => {
      this.emit({ type: 'end', note });
      this.fadeTimer = null;
    }, RELEASE_MS);
  }

  private isIOSWebAudioMuteCandidate() {
    const ua = navigator.userAgent;
    const isIOS = /iPad|iPhone|iPod/.test(ua);
    const isIPadOSDesktopMode = navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1;
    return isIOS || isIPadOSDesktopMode;
  }

  private getSilentUnlockUrl() {
    if (this.silentUnlockUrl) return this.silentUnlockUrl;

    const sampleRate = 8000;
    const durationSeconds = 0.25;
    const sampleCount = sampleRate * durationSeconds;
    const headerBytes = 44;
    const dataBytes = sampleCount * 2;
    const buffer = new ArrayBuffer(headerBytes + dataBytes);
    const view = new DataView(buffer);

    const writeString = (offset: number, value: string) => {
      for (let i = 0; i < value.length; i += 1) {
        view.setUint8(offset + i, value.charCodeAt(i));
      }
    };

    writeString(0, 'RIFF');
    view.setUint32(4, 36 + dataBytes, true);
    writeString(8, 'WAVE');
    writeString(12, 'fmt ');
    view.setUint32(16, 16, true);
    view.setUint16(20, 1, true);
    view.setUint16(22, 1, true);
    view.setUint32(24, sampleRate, true);
    view.setUint32(28, sampleRate * 2, true);
    view.setUint16(32, 2, true);
    view.setUint16(34, 16, true);
    writeString(36, 'data');
    view.setUint32(40, dataBytes, true);

    this.silentUnlockUrl = URL.createObjectURL(new Blob([buffer], { type: 'audio/wav' }));
    return this.silentUnlockUrl;
  }

  private primeIOSMediaChannel() {
    if (!this.isIOSWebAudioMuteCandidate()) return Promise.resolve();

    const nav = navigator as NavigatorWithAudioSession;
    if (nav.audioSession) {
      nav.audioSession.type = 'playback';
    }

    if (!this.silentUnlockAudio) {
      const audio = document.createElement('audio');
      audio.src = this.getSilentUnlockUrl();
      audio.loop = true;
      audio.preload = 'auto';
      audio.setAttribute('playsinline', 'true');
      audio.setAttribute('x-webkit-airplay', 'deny');
      audio.style.display = 'none';
      document.body.appendChild(audio);
      this.silentUnlockAudio = audio;
    }

    if (this.silentUnlockStarted) return Promise.resolve();

    const playPromise = this.silentUnlockAudio.play();
    this.silentUnlockStarted = true;
    return playPromise.catch((error) => {
      this.silentUnlockStarted = false;
      console.warn('[AudioEngine] iOS silent-mode unlock failed:', error);
    });
  }

  public stop(opts?: { lifecycle?: boolean }) {
    const note = this.activeNote;
    if (!note) {
      this.clearEndTimer();
      this.clearFadeTimer();
      return;
    }
    if (opts?.lifecycle) {
      this.beginPreviewRelease(note);
      return;
    }
    if (this.sampler) {
      this.sampler.triggerRelease(note, Tone.now());
    }
    this.activeNote = null;
    this.clearEndTimer();
    this.clearFadeTimer();
  }

  public async prime() {
    const unlockPromise = this.primeIOSMediaChannel();
    const toneStartPromise = Tone.context.state !== 'running' ? Tone.start() : Promise.resolve();
    await Promise.allSettled([unlockPromise, toneStartPromise]);
  }

  public async playNote(note: string, opts?: PlayNoteOptions) {
    const preview = opts?.preview ?? false;
    await this.prime();
    if (Tone.context.state !== 'running') {
      await Tone.start();
    }

    const now = Tone.now();

    if (preview) {
      if (this.activeNote && this.activeNote !== note) {
        this.beginPreviewRelease(this.activeNote);
      }
      if (this.activeNote === note) {
        return;
      }
      this.emit({ type: 'start', note });
      this.activeNote = note;
      if (this.enabled && this.isReady && this.sampler) {
        this.sampler.triggerAttack(note, now);
      }
      this.schedulePreviewRelease(note);
      return;
    }

    if (!this.enabled) return;
    if (!this.isReady || !this.sampler) return;

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
