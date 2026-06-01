import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => {
  // jsdom in vitest@4 + node 22 ships a localStorage that doesn't expose getItem
  // on direct access — stub a plain in-memory implementation before AudioEngine
  // evaluates `localStorage.getItem(...)` at class-definition time.
  const store = new Map<string, string>();
  const fakeLocalStorage = {
    getItem: (k: string) => (store.has(k) ? store.get(k)! : null),
    setItem: (k: string, v: string) => { store.set(k, String(v)); },
    removeItem: (k: string) => { store.delete(k); },
    clear: () => { store.clear(); },
    key: (i: number) => Array.from(store.keys())[i] ?? null,
    get length() { return store.size; },
  };
  vi.stubGlobal('localStorage', fakeLocalStorage);

  const samplerInstance: {
    triggerAttack: ReturnType<typeof vi.fn>;
    triggerRelease: ReturnType<typeof vi.fn>;
    toDestination: ReturnType<typeof vi.fn>;
  } = {
    triggerAttack: vi.fn(),
    triggerRelease: vi.fn(),
    toDestination: vi.fn(),
  };
  samplerInstance.toDestination.mockReturnValue(samplerInstance);

  const rawContext = {
    state: 'running' as 'running' | 'suspended',
    suspend: vi.fn().mockResolvedValue(undefined),
    resume: vi.fn().mockResolvedValue(undefined),
  };
  const context = {
    get state() { return rawContext.state; },
    rawContext,
  };

  return { samplerInstance, context, rawContext };
});

vi.mock('tone', () => {
  function Sampler(this: unknown) {
    return mocks.samplerInstance;
  }
  return {
    Sampler,
    context: mocks.context,
    start: vi.fn().mockResolvedValue(undefined),
    now: vi.fn(() => 0),
  };
});

// Import after mocks so the singleton picks them up.
import { audioEngine } from './AudioEngine';

const setHidden = (hidden: boolean) => {
  Object.defineProperty(document, 'hidden', { value: hidden, configurable: true });
  Object.defineProperty(document, 'visibilityState', {
    value: hidden ? 'hidden' : 'visible',
    configurable: true,
  });
};

beforeEach(() => {
  mocks.rawContext.state = 'running';
  mocks.rawContext.suspend.mockClear();
  mocks.samplerInstance.triggerRelease.mockClear();
});

afterEach(() => {
  setHidden(false);
});

describe('AudioEngine — release audio session on hidden', () => {
  it('exists as a singleton', () => {
    expect(audioEngine).toBeDefined();
  });

  it('suspends the Tone AudioContext when the page becomes hidden', () => {
    setHidden(true);
    document.dispatchEvent(new Event('visibilitychange'));
    expect(mocks.rawContext.suspend).toHaveBeenCalled();
  });

  it('does not suspend when the page becomes visible', () => {
    setHidden(false);
    document.dispatchEvent(new Event('visibilitychange'));
    expect(mocks.rawContext.suspend).not.toHaveBeenCalled();
  });

  it('does not call suspend if context is already suspended', () => {
    mocks.rawContext.state = 'suspended';
    setHidden(true);
    document.dispatchEvent(new Event('visibilitychange'));
    expect(mocks.rawContext.suspend).not.toHaveBeenCalled();
  });

  it('playNotes triggers all pitches at the same Tone.now()', async () => {
    const { audioEngine } = await import('./AudioEngine');
    (audioEngine as unknown as { isReady: boolean }).isReady = true;
    (audioEngine as unknown as { enabled: boolean }).enabled = true;

    await audioEngine.playNotes(['C4', 'E4']);

    expect(mocks.samplerInstance.triggerAttack).toHaveBeenCalledTimes(2);
    const times = mocks.samplerInstance.triggerAttack.mock.calls.map(
      (call: unknown[]) => call[1],
    );
    expect(times[0]).toBe(times[1]);
    expect(mocks.samplerInstance.triggerAttack).toHaveBeenCalledWith('C4', 0);
    expect(mocks.samplerInstance.triggerAttack).toHaveBeenCalledWith('E4', 0);
  });

  it('playNotes re-triggers the same pitches after release (rapid option clicks)', async () => {
    mocks.samplerInstance.triggerAttack.mockClear();
    mocks.samplerInstance.triggerRelease.mockClear();
    const { audioEngine } = await import('./AudioEngine');
    (audioEngine as unknown as { isReady: boolean }).isReady = true;
    (audioEngine as unknown as { enabled: boolean }).enabled = true;

    await audioEngine.playNotes(['C4', 'E4']);
    await audioEngine.playNotes(['C4', 'E4']);

    expect(mocks.samplerInstance.triggerRelease).toHaveBeenCalled();
    expect(mocks.samplerInstance.triggerAttack).toHaveBeenCalledTimes(4);
  });

  it('preview playNote re-attacks the same pitch on rapid clicks', async () => {
    mocks.samplerInstance.triggerAttack.mockClear();
    mocks.samplerInstance.triggerRelease.mockClear();
    const { audioEngine } = await import('./AudioEngine');
    (audioEngine as unknown as { isReady: boolean }).isReady = true;
    (audioEngine as unknown as { enabled: boolean }).enabled = true;

    await audioEngine.playNote('C4', { preview: true });
    await audioEngine.playNote('C4', { preview: true });

    expect(mocks.samplerInstance.triggerRelease).toHaveBeenCalled();
    expect(mocks.samplerInstance.triggerAttack).toHaveBeenCalledTimes(2);
  });

  it('playNotes deduplicates unison to a single attack', async () => {
    mocks.samplerInstance.triggerAttack.mockClear();
    const { audioEngine } = await import('./AudioEngine');
    (audioEngine as unknown as { isReady: boolean }).isReady = true;
    (audioEngine as unknown as { enabled: boolean }).enabled = true;

    await audioEngine.playNotes(['G4', 'G4']);

    expect(mocks.samplerInstance.triggerAttack).toHaveBeenCalledTimes(1);
    expect(mocks.samplerInstance.triggerAttack).toHaveBeenCalledWith('G4', 0);
  });

  it('pauses the iOS silent-unlock audio element when hidden', () => {
    const pauseSpy = vi.fn();
    const fakeAudio = { paused: false, pause: pauseSpy } as unknown as HTMLAudioElement;
    // Inject the silent unlock element as if iOS had primed it.
    (audioEngine as unknown as { silentUnlockAudio: HTMLAudioElement | null }).silentUnlockAudio = fakeAudio;
    (audioEngine as unknown as { silentUnlockStarted: boolean }).silentUnlockStarted = true;

    setHidden(true);
    document.dispatchEvent(new Event('visibilitychange'));

    expect(pauseSpy).toHaveBeenCalled();
    expect(
      (audioEngine as unknown as { silentUnlockStarted: boolean }).silentUnlockStarted,
    ).toBe(false);
  });
});
