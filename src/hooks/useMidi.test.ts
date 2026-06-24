import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useMidi } from './useMidi';

// ─── Mock helpers ─────────────────────────────────────────────────────────────

function createMockMIDIInput(overrides: Partial<{ id: string; name: string; state: string }> = {}) {
  return {
    id: overrides.id ?? 'input-1',
    name: overrides.name ?? 'Test MIDI Keyboard',
    state: overrides.state ?? 'connected',
    type: 'input' as const,
    onmidimessage: null as ((event: { data: Uint8Array }) => void) | null,
  };
}

function createMockMIDIAccess(inputs: ReturnType<typeof createMockMIDIInput>[] = []) {
  const inputMap = new Map(inputs.map((inp) => [inp.id, inp]));
  return {
    inputs: inputMap,
    onstatechange: null as ((event: { port: unknown }) => void) | null,
  };
}

function setupRequestMIDIAccess(mockAccess: ReturnType<typeof createMockMIDIAccess>) {
  Object.defineProperty(navigator, 'requestMIDIAccess', {
    value: vi.fn().mockResolvedValue(mockAccess),
    writable: true,
    configurable: true,
  });
}

function removeRequestMIDIAccess() {
  Object.defineProperty(navigator, 'requestMIDIAccess', {
    value: undefined,
    writable: true,
    configurable: true,
  });
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('useMidi', () => {
  const onNoteOn = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    removeRequestMIDIAccess();
  });

  describe('when enabled is false', () => {
    it('returns idle status with no device and no error', () => {
      const { result } = renderHook(() => useMidi({ enabled: false, onNoteOn }));
      expect(result.current.status).toBe('idle');
      expect(result.current.deviceName).toBeNull();
      expect(result.current.error).toBeNull();
    });

    it('does not call requestMIDIAccess', () => {
      const mockAccess = createMockMIDIAccess([createMockMIDIInput()]);
      setupRequestMIDIAccess(mockAccess);

      renderHook(() => useMidi({ enabled: false, onNoteOn }));
      expect(navigator.requestMIDIAccess).not.toHaveBeenCalled();
    });
  });

  describe('when browser does not support Web MIDI API', () => {
    it('sets status to unsupported with error message', () => {
      removeRequestMIDIAccess();
      const { result } = renderHook(() => useMidi({ enabled: true, onNoteOn }));
      expect(result.current.status).toBe('unsupported');
      expect(result.current.error).toBe('当前浏览器不支持 Web MIDI API');
      expect(result.current.deviceName).toBeNull();
    });
  });

  describe('when MIDI permission is denied', () => {
    it('sets status to permission-denied', async () => {
      Object.defineProperty(navigator, 'requestMIDIAccess', {
        value: vi.fn().mockRejectedValue(new DOMException('User denied', 'NotAllowedError')),
        writable: true,
        configurable: true,
      });

      const { result } = renderHook(() => useMidi({ enabled: true, onNoteOn }));

      // Wait for async init to complete
      await act(async () => {
        await new Promise((r) => setTimeout(r, 0));
      });

      expect(result.current.status).toBe('permission-denied');
      expect(result.current.error).toBe('MIDI 权限已被拒绝');
      expect(result.current.deviceName).toBeNull();
    });
  });

  describe('when no MIDI devices are connected', () => {
    it('sets status to no-device', async () => {
      const mockAccess = createMockMIDIAccess([]);
      setupRequestMIDIAccess(mockAccess);

      const { result } = renderHook(() => useMidi({ enabled: true, onNoteOn }));

      await act(async () => {
        await new Promise((r) => setTimeout(r, 0));
      });

      expect(result.current.status).toBe('no-device');
      expect(result.current.error).toBe('未检测到 MIDI 设备');
      expect(result.current.deviceName).toBeNull();
    });
  });

  describe('when a MIDI device is connected', () => {
    it('sets status to connected with device name', async () => {
      const input = createMockMIDIInput({ name: 'Yamaha P-125' });
      const mockAccess = createMockMIDIAccess([input]);
      setupRequestMIDIAccess(mockAccess);

      const { result } = renderHook(() => useMidi({ enabled: true, onNoteOn }));

      await act(async () => {
        await new Promise((r) => setTimeout(r, 0));
      });

      expect(result.current.status).toBe('connected');
      expect(result.current.deviceName).toBe('Yamaha P-125');
      expect(result.current.error).toBeNull();
    });

    it('attaches midimessage listener to the input', async () => {
      const input = createMockMIDIInput();
      const mockAccess = createMockMIDIAccess([input]);
      setupRequestMIDIAccess(mockAccess);

      renderHook(() => useMidi({ enabled: true, onNoteOn }));

      await act(async () => {
        await new Promise((r) => setTimeout(r, 0));
      });

      expect(input.onmidimessage).not.toBeNull();
    });
  });

  describe('NoteOn event handling', () => {
    it('calls onNoteOn with converted pitch for NoteOn with velocity > 0', async () => {
      const input = createMockMIDIInput();
      const mockAccess = createMockMIDIAccess([input]);
      setupRequestMIDIAccess(mockAccess);

      renderHook(() => useMidi({ enabled: true, onNoteOn }));

      await act(async () => {
        await new Promise((r) => setTimeout(r, 0));
      });

      // Simulate NoteOn: channel 0, note 60 (C4), velocity 100
      act(() => {
        input.onmidimessage!({ data: new Uint8Array([0x90, 60, 100]) });
      });

      expect(onNoteOn).toHaveBeenCalledWith('C4');
    });

    it('does not call onNoteOn for NoteOn with velocity 0 (NoteOff equivalent)', async () => {
      const input = createMockMIDIInput();
      const mockAccess = createMockMIDIAccess([input]);
      setupRequestMIDIAccess(mockAccess);

      renderHook(() => useMidi({ enabled: true, onNoteOn }));

      await act(async () => {
        await new Promise((r) => setTimeout(r, 0));
      });

      // Simulate NoteOn with velocity 0 (= NoteOff)
      act(() => {
        input.onmidimessage!({ data: new Uint8Array([0x90, 60, 0]) });
      });

      expect(onNoteOn).not.toHaveBeenCalled();
    });

    it('does not call onNoteOn for NoteOff messages (0x80)', async () => {
      const input = createMockMIDIInput();
      const mockAccess = createMockMIDIAccess([input]);
      setupRequestMIDIAccess(mockAccess);

      renderHook(() => useMidi({ enabled: true, onNoteOn }));

      await act(async () => {
        await new Promise((r) => setTimeout(r, 0));
      });

      // Simulate NoteOff message
      act(() => {
        input.onmidimessage!({ data: new Uint8Array([0x80, 60, 64]) });
      });

      expect(onNoteOn).not.toHaveBeenCalled();
    });

    it('handles NoteOn on different MIDI channels', async () => {
      const input = createMockMIDIInput();
      const mockAccess = createMockMIDIAccess([input]);
      setupRequestMIDIAccess(mockAccess);

      renderHook(() => useMidi({ enabled: true, onNoteOn }));

      await act(async () => {
        await new Promise((r) => setTimeout(r, 0));
      });

      // NoteOn on channel 5 (0x95)
      act(() => {
        input.onmidimessage!({ data: new Uint8Array([0x95, 69, 80]) });
      });

      expect(onNoteOn).toHaveBeenCalledWith('A4');
    });
  });

  describe('hot-plug via onstatechange', () => {
    it('detects device disconnection and sets disconnected status', async () => {
      const input = createMockMIDIInput();
      const mockAccess = createMockMIDIAccess([input]);
      setupRequestMIDIAccess(mockAccess);

      const { result } = renderHook(() => useMidi({ enabled: true, onNoteOn }));

      await act(async () => {
        await new Promise((r) => setTimeout(r, 0));
      });

      expect(result.current.status).toBe('connected');

      // Simulate device disconnection
      await act(async () => {
        input.state = 'disconnected';
        mockAccess.onstatechange!({ port: input });
      });

      expect(result.current.status).toBe('disconnected');
      expect(result.current.error).toBe('MIDI 设备已断开');
    });

    it('reconnects automatically when a device is plugged back in', async () => {
      const input = createMockMIDIInput();
      const mockAccess = createMockMIDIAccess([input]);
      setupRequestMIDIAccess(mockAccess);

      const { result } = renderHook(() => useMidi({ enabled: true, onNoteOn }));

      await act(async () => {
        await new Promise((r) => setTimeout(r, 0));
      });

      // Disconnect
      await act(async () => {
        input.state = 'disconnected';
        mockAccess.onstatechange!({ port: input });
      });

      expect(result.current.status).toBe('disconnected');

      // Reconnect
      await act(async () => {
        input.state = 'connected';
        mockAccess.onstatechange!({ port: input });
      });

      expect(result.current.status).toBe('connected');
      expect(result.current.deviceName).toBe('Test MIDI Keyboard');
    });
  });

  describe('cleanup when enabled becomes false', () => {
    it('removes midimessage listener and resets state', async () => {
      const input = createMockMIDIInput();
      const mockAccess = createMockMIDIAccess([input]);
      setupRequestMIDIAccess(mockAccess);

      const { result, rerender } = renderHook(
        ({ enabled }) => useMidi({ enabled, onNoteOn }),
        { initialProps: { enabled: true } },
      );

      await act(async () => {
        await new Promise((r) => setTimeout(r, 0));
      });

      expect(result.current.status).toBe('connected');
      expect(input.onmidimessage).not.toBeNull();

      // Disable
      rerender({ enabled: false });

      expect(result.current.status).toBe('idle');
      expect(result.current.deviceName).toBeNull();
      expect(input.onmidimessage).toBeNull();
    });

    it('nullifies the midimessage handler so no events can fire after cleanup', async () => {
      const input = createMockMIDIInput();
      const mockAccess = createMockMIDIAccess([input]);
      setupRequestMIDIAccess(mockAccess);

      const { rerender } = renderHook(
        ({ enabled }) => useMidi({ enabled, onNoteOn }),
        { initialProps: { enabled: true } },
      );

      await act(async () => {
        await new Promise((r) => setTimeout(r, 0));
      });

      expect(input.onmidimessage).not.toBeNull();

      // Disable — triggers cleanup
      rerender({ enabled: false });

      // After cleanup, the handler is removed so the browser cannot deliver events
      expect(input.onmidimessage).toBeNull();
      // Also verifies onstatechange is cleaned up
      expect(mockAccess.onstatechange).toBeNull();
    });
  });

  describe('selects first connected input from multiple', () => {
    it('picks the first connected input port', async () => {
      const disconnected = createMockMIDIInput({ id: 'a', name: 'Offline', state: 'disconnected' });
      const connected = createMockMIDIInput({ id: 'b', name: 'Active Keyboard' });
      const mockAccess = createMockMIDIAccess([disconnected, connected]);
      setupRequestMIDIAccess(mockAccess);

      const { result } = renderHook(() => useMidi({ enabled: true, onNoteOn }));

      await act(async () => {
        await new Promise((r) => setTimeout(r, 0));
      });

      expect(result.current.status).toBe('connected');
      expect(result.current.deviceName).toBe('Active Keyboard');
    });
  });
});
