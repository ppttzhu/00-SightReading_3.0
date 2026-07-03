import type { InputMode } from '../hooks/useNotesInputMode';

type Props = {
  mode: InputMode;
  onChange: (mode: InputMode) => void;
  accentColor?: string;
};

const BUTTONS: { mode: InputMode; label: string }[] = [
  { mode: 'options', label: '选项' },
  { mode: 'piano', label: '键盘' },
  { mode: 'midi', label: 'MIDI' },
];

/** 单音答题方式：选项按钮 / 钢琴键盘 / MIDI */
export default function NotesInputModeToggle({
  mode,
  onChange,
  accentColor = '#3b82f6',
}: Props) {
  const midiSupported = (() => {
    if (typeof window === 'undefined') return false;
    // Check for Capacitor native MIDI plugin (iOS/Android app)
    const win = window as unknown as Record<string, unknown>;
    if (win.Capacitor && typeof win.Capacitor === 'object') {
      const cap = win.Capacitor as Record<string, unknown>;
      if (cap.Plugins && typeof cap.Plugins === 'object') {
        const plugins = cap.Plugins as Record<string, unknown>;
        if (plugins.Midi) return true;
      }
      // Inside Capacitor but plugin not yet loaded — still allow MIDI mode
      return true;
    }
    // Fallback: check Web MIDI API (desktop browsers)
    return typeof navigator !== 'undefined' && 'requestMIDIAccess' in navigator;
  })();

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px' }}>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '4px',
          background: 'white',
          border: '1px solid #e5e7eb',
          borderRadius: '20px',
          padding: '4px 6px',
          boxShadow: '0 2px 8px rgba(0,0,0,0.04)',
        }}
      >
        {BUTTONS.map((btn) => {
          const active = btn.mode === mode;
          const disabled = btn.mode === 'midi' && !midiSupported;
          return (
            <button
              key={btn.mode}
              type="button"
              disabled={disabled}
              onClick={() => {
                if (!disabled) onChange(btn.mode);
              }}
              style={{
                padding: '6px 14px',
                borderRadius: '14px',
                border: 'none',
                cursor: disabled ? 'not-allowed' : 'pointer',
                fontWeight: '600',
                fontSize: '0.85rem',
                background: active ? accentColor : 'transparent',
                color: disabled ? '#d1d5db' : active ? 'white' : '#6b7280',
                opacity: disabled ? 0.5 : 1,
                transition: 'all 0.2s',
              }}
            >
              {btn.label}
            </button>
          );
        })}
      </div>
      {!midiSupported && (
        <span style={{ fontSize: '0.75rem', color: '#9ca3af' }}>
          MIDI 需要电脑或安卓手机，iOS 浏览器不可用
        </span>
      )}
    </div>
  );
}
