import type { MidiStatus as MidiStatusType } from '../hooks/useMidi';

type Props = {
  status: MidiStatusType;
  deviceName: string | null;
  error: string | null;
};

/**
 * MIDI 连接状态指示器组件。
 * 放置在答题区域（替代钢琴/选项），根据当前 useMidi 状态渲染不同内容。
 */
export default function MidiStatus({ status, deviceName }: Props) {
  // idle 状态不渲染任何内容
  if (status === 'idle') return null;

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '24px 32px',
        width: '100%',
        maxWidth: 480,
        margin: '0 auto',
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '10px',
          padding: '16px 24px',
          borderRadius: '12px',
          background: getBackground(status),
          border: `1px solid ${getBorderColor(status)}`,
          boxShadow: '0 2px 8px rgba(0,0,0,0.04)',
          width: '100%',
          justifyContent: 'center',
        }}
      >
        {status === 'connecting' && <ConnectingContent />}
        {status === 'connected' && <ConnectedContent deviceName={deviceName} />}
        {status === 'no-device' && <WarningContent message="未检测到 MIDI 设备，请连接后重试" />}
        {status === 'permission-denied' && (
          <WarningContent message="浏览器已拒绝 MIDI 权限，请在设置中允许" />
        )}
        {status === 'disconnected' && <WarningContent message="设备已断开，请重新连接" />}
        {status === 'unsupported' && (
          <WarningContent message="当前浏览器不支持 Web MIDI API" />
        )}
      </div>
    </div>
  );
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function ConnectingContent() {
  return (
    <span
      style={{
        fontSize: '0.95rem',
        color: '#6b7280',
        animation: 'midi-pulse 1.5s ease-in-out infinite',
      }}
    >
      连接中…
      <style>{`
        @keyframes midi-pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.4; }
        }
      `}</style>
    </span>
  );
}

function ConnectedContent({ deviceName }: { deviceName: string | null }) {
  return (
    <>
      <span
        style={{
          display: 'inline-block',
          width: 10,
          height: 10,
          borderRadius: '50%',
          background: '#10b981',
          flexShrink: 0,
        }}
      />
      <span style={{ fontSize: '0.95rem', color: '#374151' }}>
        已连接：<strong>{deviceName ?? 'MIDI Device'}</strong>
      </span>
      <span style={{ fontSize: '0.85rem', color: '#6b7280', marginLeft: 4 }}>
        按下琴键作答
      </span>
    </>
  );
}

function WarningContent({ message }: { message: string }) {
  return (
    <>
      <span style={{ fontSize: '1.1rem', flexShrink: 0 }}>⚠</span>
      <span style={{ fontSize: '0.95rem', color: '#92400e' }}>{message}</span>
    </>
  );
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getBackground(status: MidiStatusType): string {
  switch (status) {
    case 'connected':
      return '#ecfdf5';
    case 'connecting':
      return '#f9fafb';
    default:
      return '#fffbeb';
  }
}

function getBorderColor(status: MidiStatusType): string {
  switch (status) {
    case 'connected':
      return '#a7f3d0';
    case 'connecting':
      return '#e5e7eb';
    default:
      return '#fde68a';
  }
}
