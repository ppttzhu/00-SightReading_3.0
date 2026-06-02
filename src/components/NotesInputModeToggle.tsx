import { NOTES_INPUT_MODE_KEY } from '../pages/client/StageSelector';

type Props = {
  usePiano: boolean;
  onChange: (usePiano: boolean) => void;
  accentColor?: string;
};

/** 单音答题方式：选项按钮 / 钢琴键盘 */
export default function NotesInputModeToggle({
  usePiano,
  onChange,
  accentColor = '#3b82f6',
}: Props) {
  return (
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
      {(['options', 'piano'] as const).map((inputMode) => {
        const isPiano = inputMode === 'piano';
        const active = isPiano === usePiano;
        return (
          <button
            key={inputMode}
            type="button"
            onClick={() => {
              onChange(isPiano);
              localStorage.setItem(NOTES_INPUT_MODE_KEY, isPiano ? 'piano' : 'options');
            }}
            style={{
              padding: '6px 14px',
              borderRadius: '14px',
              border: 'none',
              cursor: 'pointer',
              fontWeight: '600',
              fontSize: '0.85rem',
              background: active ? accentColor : 'transparent',
              color: active ? 'white' : '#6b7280',
              transition: 'all 0.2s',
            }}
          >
            {isPiano ? '键盘' : '选项'}
          </button>
        );
      })}
    </div>
  );
}
