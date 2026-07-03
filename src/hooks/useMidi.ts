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

// ─── Capacitor native MIDI plugin types ───────────────────────────────────────

interface CapacitorMidiEvent {
  type: 'noteOn' | 'noteOff';
  note: number;
  velocity: number;
  timestamp: number;
}

interface CapacitorDeviceDescriptor {
  id: string;
  name: string;
  type: 'input' | 'output';
}

interface CapacitorMidiPlugin {
  listDevices(): Promise<{ devices: CapacitorDeviceDescriptor[] }>;
  startListening(options: { deviceId: string }): Promise<void>;
  stopListening(): Promise<void>;
  addListener(eventName: string, callback: (data: unknown) => void): Promise<{ remove: () => void }>;
}

// ─── Capacitor detection helper ───────────────────────────────────────────────

function getCapacitorMidi(): CapacitorMidiPlugin | null {
  const win = window as unknown as Record<string, unknown>;
  if (win.Capacitor && typeof win.Capacitor === 'object') {
    const cap = win.Capacitor as Record<string, unknown>;
    if (cap.Plugins && typeof cap.Plugins === 'object') {
      const plugins = cap.Plugins as Record<string, unknown>;
      if (plugins.Midi) {
        return plugins.Midi as CapacitorMidiPlugin;
      }
    }
  }
  return null;
}

function isRunningInCapacitor(): boolean {
  const win = window as unknown as Record<string, unknown>;
  return !!(win.Capacitor && typeof win.Capacitor === 'object');
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
      return 'MIDI 需要连接 MIDI 键盘';
    case 'permission-denied':
      return 'MIDI 权限已被拒绝';
    case 'no-device':
      return '未检测到 MIDI 设备，请连接键盘';
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

    // ─── Try Capacitor native MIDI plugin first (iOS/Android app) ───────
    const nativeMidi = getCapacitorMidi();
    if (nativeMidi) {
      return initCapacitorMidi(nativeMidi, setStatus, setDeviceName, onNoteOnRef);
    }

    // ─── Fallback to Web MIDI API (desktop Chrome/Edge) ─────────────────
    if (!(navigator as unknown as Record<string, unknown>).requestMIDIAccess) {
      // No native plugin and no Web MIDI — truly unsupported
      if (isRunningInCapacitor()) {
        // Inside Capacitor but plugin not registered — show no-device instead of unsupported
        setStatus('no-device');
      } else {
        setStatus('unsupported');
      }
      setDeviceName(null);
      return;
    }

    return initWebMidi(setStatus, setDeviceName, onNoteOnRef);
  }, [enabled]);

  return {
    status,
    deviceName,
    error: getErrorMessage(status),
  };
}

// ─── Capacitor Native MIDI initialization ─────────────────────────────────────

function initCapacitorMidi(
  midi: CapacitorMidiPlugin,
  setStatus: (s: MidiStatus) => void,
  setDeviceName: (n: string | null) => void,
  onNoteOnRef: React.MutableRefObject<(pitch: string) => void>,
): () => void {
  let cancelled = false;
  const listenerHandles: Array<{ remove: () => void }> = [];

  const init = async () => {
    setStatus('connecting');

    try {
      // Subscribe to MIDI events
      const midiEventHandle = await midi.addListener('midiEvent', (data: unknown) => {
        if (cancelled) return;
        const event = data as CapacitorMidiEvent;
        if (event.type === 'noteOn' && event.velocity > 0) {
          const pitch = midiNoteToPitch(event.note);
          onNoteOnRef.current(pitch);
        }
      });
      listenerHandles.push(midiEventHandle);

      // Subscribe to device connected
      const connectedHandle = await midi.addListener('deviceConnected', (data: unknown) => {
        if (cancelled) return;
        const device = data as CapacitorDeviceDescriptor;
        setDeviceName(device.name);
        setStatus('connected');
        // Auto-start listening to newly connected device
        midi.startListening({ deviceId: device.id }).catch(() => {});
      });
      listenerHandles.push(connectedHandle);

      // Subscribe to device disconnected
      const disconnectedHandle = await midi.addListener('deviceDisconnected', (_data: unknown) => {
        if (cancelled) return;
        setDeviceName(null);
        setStatus('disconnected');
      });
      listenerHandles.push(disconnectedHandle);

      // Get initial device list
      const { devices } = await midi.listDevices();
      if (cancelled) return;

      if (devices.length > 0) {
        const lastDevice = devices[devices.length - 1];
        await midi.startListening({ deviceId: lastDevice.id });
        if (cancelled) return;
        setDeviceName(lastDevice.name);
        setStatus('connected');
      } else {
        setStatus('no-device');
        setDeviceName(null);
      }
    } catch (err: unknown) {
      if (cancelled) return;
      setStatus('no-device');
      setDeviceName(null);
    }
  };

  init();

  // Cleanup
  return () => {
    cancelled = true;
    midi.stopListening().catch(() => {});
    for (const handle of listenerHandles) {
      handle.remove();
    }
    setStatus('idle');
    setDeviceName(null);
  };
}

// ─── Web MIDI API initialization ──────────────────────────────────────────────

function initWebMidi(
  setStatus: (s: MidiStatus) => void,
  setDeviceName: (n: string | null) => void,
  onNoteOnRef: React.MutableRefObject<(pitch: string) => void>,
): () => void {
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
}
