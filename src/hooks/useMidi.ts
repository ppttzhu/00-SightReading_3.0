import { useState, useEffect, useRef } from 'react';
import { midiNoteToPitch } from '../core/engine/pitchUtils';

// ─── Minimal Web MIDI API type declarations ───────────────────────────────────
// The DOM lib doesn't include Web MIDI types, so we declare them inline.

interface MIDIPort {
  id: string;
  name: string | null;
  state: 'connected' | 'disconnected';
  type: 'input' | 'output';
}

interface MIDIMessageEvent {
  data: Uint8Array;
}

interface MIDIInput extends MIDIPort {
  type: 'input';
  onmidimessage: ((event: MIDIMessageEvent) => void) | null;
}

interface MIDIConnectionEvent {
  port: MIDIPort;
}

interface MIDIAccess {
  inputs: Map<string, MIDIInput>;
  onstatechange: ((event: MIDIConnectionEvent) => void) | null;
}

// ─── Public types ─────────────────────────────────────────────────────────────

export type MidiStatus =
  | 'idle'
  | 'connecting'
  | 'connected'
  | 'permission-denied'
  | 'no-device'
  | 'disconnected'
  | 'unsupported';

export interface UseMidiOptions {
  enabled: boolean;
  onNoteOn: (pitch: string) => void;
}

export interface UseMidiReturn {
  status: MidiStatus;
  deviceName: string | null;
  error: string | null;
}

// ─── Error messages (Chinese) ─────────────────────────────────────────────────

function getErrorMessage(status: MidiStatus): string | null {
  switch (status) {
    case 'unsupported':
      return 'MIDI 需要电脑或安卓手机，iOS 浏览器不可用';
    case 'permission-denied':
      return 'MIDI 权限已被拒绝';
    case 'no-device':
      return '未检测到 MIDI 设备';
    case 'disconnected':
      return 'MIDI 设备已断开';
    default:
      return null;
  }
}

// ─── Hook implementation ──────────────────────────────────────────────────────

export function useMidi(options: UseMidiOptions): UseMidiReturn {
  const { enabled } = options;

  const [status, setStatus] = useState<MidiStatus>('idle');
  const [deviceName, setDeviceName] = useState<string | null>(null);

  // Store onNoteOn in a ref to avoid re-running the effect when callback identity changes
  const onNoteOnRef = useRef(options.onNoteOn);
  onNoteOnRef.current = options.onNoteOn;

  useEffect(() => {
    if (!enabled) {
      setStatus('idle');
      setDeviceName(null);
      return;
    }

    // Check browser support
    if (!(navigator as unknown as Record<string, unknown>).requestMIDIAccess) {
      setStatus('unsupported');
      setDeviceName(null);
      return;
    }

    let cancelled = false;
    let midiAccess: MIDIAccess | null = null;
    let activeInput: MIDIInput | null = null;

    const handleMidiMessage = (event: MIDIMessageEvent) => {
      const data = event.data;
      if (data.length < 3) return;
      // NoteOn: status byte high nibble is 0x90, velocity > 0
      if ((data[0] & 0xf0) === 0x90 && data[2] > 0) {
        const pitch = midiNoteToPitch(data[1]);
        onNoteOnRef.current(pitch);
      }
    };

    const attachInput = (input: MIDIInput) => {
      activeInput = input;
      input.onmidimessage = handleMidiMessage;
      setDeviceName(input.name ?? 'MIDI Device');
      setStatus('connected');
    };

    const detachInput = () => {
      if (activeInput) {
        activeInput.onmidimessage = null;
        activeInput = null;
      }
    };

    const findAndAttachFirstInput = (access: MIDIAccess) => {
      detachInput();
      for (const input of access.inputs.values()) {
        if (input.state === 'connected') {
          attachInput(input);
          return;
        }
      }
      // No connected device found
      setDeviceName(null);
      setStatus('no-device');
    };

    const handleStateChange = (_event: MIDIConnectionEvent) => {
      if (cancelled || !midiAccess) return;

      const wasConnected = activeInput !== null;

      // If current device disconnected, detach it
      if (activeInput && activeInput.state === 'disconnected') {
        detachInput();
      }

      // Try to find a connected device
      for (const input of midiAccess.inputs.values()) {
        if (input.state === 'connected') {
          attachInput(input);
          return;
        }
      }

      // No connected device found
      if (!activeInput) {
        setDeviceName(null);
        setStatus(wasConnected ? 'disconnected' : 'no-device');
      }
    };

    const init = async () => {
      setStatus('connecting');
      try {
        const access = await (
          navigator as unknown as { requestMIDIAccess: () => Promise<MIDIAccess> }
        ).requestMIDIAccess();

        if (cancelled) return;

        midiAccess = access;
        access.onstatechange = handleStateChange;
        findAndAttachFirstInput(access);
      } catch (err: unknown) {
        if (cancelled) return;
        if (err instanceof DOMException) {
          setStatus('permission-denied');
        } else {
          setStatus('permission-denied');
        }
        setDeviceName(null);
      }
    };

    init();

    // Cleanup
    return () => {
      cancelled = true;
      detachInput();
      if (midiAccess) {
        midiAccess.onstatechange = null;
        midiAccess = null;
      }
      setStatus('idle');
      setDeviceName(null);
    };
  }, [enabled]);

  return {
    status,
    deviceName,
    error: getErrorMessage(status),
  };
}
