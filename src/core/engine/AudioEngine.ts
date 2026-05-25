import * as Tone from 'tone';

/** 采样尾音上限，用于在播完后允许再次触发同一音 */
const NOTE_PLAY_MS = 5000;

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
    if (this.activeNote && this.sampler) {
      this.sampler.triggerRelease(this.activeNote, Tone.now());
      this.activeNote = null;
    }
    this.clearEndTimer();

    // Tone.context.rawContext 是底层 Web Audio AudioContext，直接 suspend 可释放音频会话
    const rawContext = Tone.context.rawContext as AudioContext;
    if (rawContext.state === 'running') {
      void rawContext.suspend();
    }

    if (this.silentUnlockAudio && !this.silentUnlockAudio.paused) {
      this.silentUnlockAudio.pause();
    }
    // 复位 started 标记，让下次用户交互时 primeIOSMediaChannel 重新启动静音循环
    this.silentUnlockStarted = false;
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

  public stop() {
    if (this.activeNote && this.sampler) {
      this.sampler.triggerRelease(this.activeNote, Tone.now());
      this.activeNote = null;
    }
    this.clearEndTimer();
  }

  public async prime() {
    const unlockPromise = this.primeIOSMediaChannel();
    const toneStartPromise = Tone.context.state !== 'running' ? Tone.start() : Promise.resolve();
    await Promise.allSettled([unlockPromise, toneStartPromise]);
  }

  public async playNote(note: string) {
    if (!this.enabled) return;
    await this.prime();
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
