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
  /** 预览模式：短促发声并触发 start/fade/end 生命周期事件（单音练习唱名反馈） */
  preview?: boolean;
};

export type StopOptions = {
  /** 走预览淡出流程（唱名渐隐），而非立刻切断 */
  lifecycle?: boolean;
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
  private activeNotes: string[] = [];
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
    this.setupVisibilityHandler();
  }

  // 释放音频会话：页面切到后台时停掉发声并 suspend AudioContext，
  // 这样系统层就不会把本网站标记为"正在使用音频"，其他 App（如抖音）就能正常播放。
  private setupVisibilityHandler() {
    if (typeof document === 'undefined') return;
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) {
        this.releaseAudioSession();
      }
    });
  }

  private releaseAudioSession() {
    if (this.activeNotes.length && this.sampler) {
      const now = Tone.now();
      for (const note of this.activeNotes) {
        this.sampler.triggerRelease(note, now);
      }
      this.activeNotes = [];
    }
    this.clearEndTimer();
    this.clearFadeTimer();

    const rawContext = Tone.context.rawContext as AudioContext;
    if (rawContext.state === 'running') {
      void rawContext.suspend();
    }

    if (this.silentUnlockAudio && !this.silentUnlockAudio.paused) {
      this.silentUnlockAudio.pause();
    }
    this.silentUnlockStarted = false;
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

  private scheduleActiveClear() {
    this.clearEndTimer();
    this.endTimer = setTimeout(() => {
      this.activeNotes = [];
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
    if (this.enabled && this.sampler && this.activeNotes.includes(note)) {
      this.sampler.triggerRelease(note, Tone.now());
    }
    this.activeNotes = this.activeNotes.filter(n => n !== note);
    this.fadeTimer = setTimeout(() => {
      this.emit({ type: 'end', note });
      this.fadeTimer = null;
    }, RELEASE_MS);
  }

  private releaseActiveAt(now: number) {
    if (!this.sampler || this.activeNotes.length === 0) return;
    for (const note of this.activeNotes) {
      this.sampler.triggerRelease(note, now);
    }
    this.activeNotes = [];
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

  public stop(opts?: StopOptions) {
    if (this.activeNotes.length === 0) {
      this.clearEndTimer();
      this.clearFadeTimer();
      return;
    }
    if (opts?.lifecycle) {
      for (const note of [...this.activeNotes]) {
        this.beginPreviewRelease(note);
      }
      return;
    }
    if (this.sampler) {
      this.releaseActiveAt(Tone.now());
    }
    this.clearEndTimer();
    this.clearFadeTimer();
  }

  public async prime() {
    const unlockPromise = this.primeIOSMediaChannel();
    const toneStartPromise = Tone.context.state !== 'running' ? Tone.start() : Promise.resolve();
    await Promise.allSettled([unlockPromise, toneStartPromise]);
  }

  public async playNote(note: string, opts?: PlayNoteOptions) {
    if (opts?.preview) {
      await this.prime();
      if (Tone.context.state !== 'running') {
        await Tone.start();
      }

      const now = Tone.now();
      this.clearFadeTimer();

      for (const prev of [...this.activeNotes]) {
        if (prev !== note) {
          this.beginPreviewRelease(prev);
        }
      }

      // 同音连点也重新 attack，避免答错后连点无声
      if (this.activeNotes.includes(note) && this.sampler) {
        this.sampler.triggerRelease(note, now);
      }

      this.emit({ type: 'start', note });
      this.activeNotes = [note];
      if (this.enabled && this.isReady && this.sampler) {
        this.sampler.triggerAttack(note, now);
      }
      this.schedulePreviewRelease(note);
      return;
    }

    await this.playNotes([note]);
  }

  /** 在同一时刻触发多个音高（用于音程练习等） */
  public async playNotes(notes: string[]) {
    if (!this.enabled) return;
    const unique = [...new Set(notes.filter(Boolean))];
    if (unique.length === 0) return;

    await this.prime();
    if (Tone.context.state !== 'running') {
      await Tone.start();
    }
    if (!this.isReady || !this.sampler) return;

    const now = Tone.now();
    this.clearFadeTimer();

    // 每次播放前先释放上一组音，便于连点选项时立刻重播（音程题多选项共用同一对音高）
    this.releaseActiveAt(now);

    for (const n of unique) {
      this.sampler.triggerAttack(n, now);
    }
    this.activeNotes = unique;
    this.scheduleActiveClear();
  }
}

export const audioEngine = AudioEngine.getInstance();
