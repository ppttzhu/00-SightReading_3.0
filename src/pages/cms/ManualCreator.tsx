import { useState } from 'react';
import { useAppStore } from '../../core/store/useAppStore';

const TYPE_OPTIONS = [
  { value: 'A', label: '单音池 (A)', placeholder: '输入音高，如 C4、F#5、Bb3' },
  { value: 'B', label: '符号池 (B)', placeholder: '输入符号名称，如 ff、staccato、fermata' },
  { value: 'C', label: '乐理池 (C)', placeholder: '输入乐理概念，如 纯五度 (P5)、C大调三和弦' },
  { value: 'D', label: '音型池 (D)', placeholder: '输入音型描述，如 上行音阶 C-D-E-F-G' },
];

export default function ManualCreator() {
  const addSlices = useAppStore(state => state.addSlices);

  const [type, setType] = useState<'A' | 'B' | 'C' | 'D'>('A');
  const [content, setContent] = useState('');
  const [symbolAnswer, setSymbolAnswer] = useState('');
  const [difficulty, setDifficulty] = useState(1);
  const [batchMode, setBatchMode] = useState(false);
  const [batchText, setBatchText] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  const currentTypeOption = TYPE_OPTIONS.find(t => t.value === type)!;

  const handleAddSingle = () => {
    if (!content.trim()) return;
    if (type === 'B' && !symbolAnswer.trim()) return;

    const slice = {
      id: `manual_${type}_${Date.now()}_${content}`,
      type: type,
      content: buildContent(type, content.trim()),
      difficulty
    };
    addSlices([slice]);
    setContent('');
    setSymbolAnswer('');
    showSuccess('已添加 1 道题目');
  };

  const handleAddBatch = () => {
    if (!batchText.trim()) return;

    // 按换行分割，每行为一道题
    // B 类格式: "符号|答案"，如 "pp|极弱 (pianissimo)"
    const lines = batchText.split('\n').map(l => l.trim()).filter(l => l.length > 0);
    const slices = lines.map((line, idx) => {
      let contentObj;
      if (type === 'B' && line.includes('|')) {
        const [symbol, answer] = line.split('|').map(s => s.trim());
        contentObj = { symbol, answer };
      } else {
        contentObj = buildContent(type, line);
      }
      return {
        id: `manual_${type}_${Date.now()}_${idx}_${line}`,
        type: type,
        content: contentObj,
        difficulty
      };
    });

    addSlices(slices);
    setBatchText('');
    showSuccess(`已批量添加 ${slices.length} 道题目`);
  };

  const buildContent = (type: string, value: string) => {
    switch (type) {
      case 'A': return { pitch: value, raw: value };
      case 'B': return { symbol: value, answer: symbolAnswer.trim() };
      case 'C': return { theory: value, raw: value };
      case 'D': return { pattern: value, raw: value };
      default: return { raw: value };
    }
  };

  const showSuccess = (msg: string) => {
    setSuccessMsg(msg);
    setTimeout(() => setSuccessMsg(''), 2000);
  };

  return (
    <div style={{ maxWidth: '800px' }}>
      <h1 style={{ fontSize: '2rem', color: '#1f2937', marginBottom: '10px' }}>手动出题器</h1>
      <p style={{ color: '#6b7280', marginBottom: '30px' }}>
        对于引擎无法自动识别的音型或乐理概念，教师可以在此手动创建题目并推送至素材池。
      </p>

      {/* 成功提示 */}
      {successMsg && (
        <div style={{ background: '#ecfdf5', border: '1px solid #6ee7b7', padding: '12px 20px', borderRadius: '8px', color: '#065f46', fontWeight: 'bold', marginBottom: '20px' }}>
          ✓ {successMsg}
        </div>
      )}

      {/* 题目类型选择 */}
      <div style={{ marginBottom: '20px' }}>
        <label style={{ display: 'block', marginBottom: '8px', fontWeight: 'bold', color: '#374151' }}>题目类型</label>
        <div style={{ display: 'flex', gap: '10px' }}>
          {TYPE_OPTIONS.map(opt => (
            <button
              key={opt.value}
              onClick={() => setType(opt.value as any)}
              style={{
                flex: 1,
                padding: '12px',
                borderRadius: '8px',
                border: type === opt.value ? '2px solid #3b82f6' : '1px solid #e5e7eb',
                background: type === opt.value ? '#eff6ff' : 'white',
                color: type === opt.value ? '#1d4ed8' : '#6b7280',
                fontWeight: type === opt.value ? 'bold' : 'normal',
                cursor: 'pointer',
                transition: 'all 0.2s'
              }}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {/* 难度选择 */}
      <div style={{ marginBottom: '20px' }}>
        <label style={{ display: 'block', marginBottom: '8px', fontWeight: 'bold', color: '#374151' }}>
          难度等级: <span style={{ color: '#f59e0b' }}>L{difficulty}</span>
        </label>
        <input
          type="range"
          min="1"
          max="10"
          value={difficulty}
          onChange={(e) => setDifficulty(parseInt(e.target.value))}
          style={{ width: '100%', cursor: 'pointer' }}
        />
        <div style={{ display: 'flex', justifyContent: 'space-between', color: '#9ca3af', fontSize: '0.8rem', marginTop: '4px' }}>
          <span>L1 入门</span><span>L5 中等</span><span>L10 大师</span>
        </div>
      </div>

      {/* 模式切换 */}
      <div style={{ display: 'flex', gap: '15px', marginBottom: '20px' }}>
        <button
          onClick={() => setBatchMode(false)}
          style={{
            padding: '8px 20px', borderRadius: '20px', border: 'none',
            background: !batchMode ? '#1f2937' : '#f3f4f6',
            color: !batchMode ? 'white' : '#6b7280',
            fontWeight: 'bold', cursor: 'pointer'
          }}
        >
          单条添加
        </button>
        <button
          onClick={() => setBatchMode(true)}
          style={{
            padding: '8px 20px', borderRadius: '20px', border: 'none',
            background: batchMode ? '#1f2937' : '#f3f4f6',
            color: batchMode ? 'white' : '#6b7280',
            fontWeight: 'bold', cursor: 'pointer'
          }}
        >
          批量添加
        </button>
      </div>

      {/* 输入区域 */}
      {!batchMode ? (
        <div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginBottom: '15px' }}>
            <div style={{ display: 'flex', gap: '10px' }}>
              <input
                type="text"
                value={content}
                onChange={(e) => setContent(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && type !== 'B' && handleAddSingle()}
                placeholder={currentTypeOption.placeholder}
                style={{ flex: 1, padding: '12px 16px', borderRadius: '8px', border: '1px solid #d1d5db', fontSize: '1rem' }}
              />
              {type !== 'B' && (
                <button
                  onClick={handleAddSingle}
                  disabled={!content.trim()}
                  style={{
                    padding: '12px 24px', borderRadius: '8px', border: 'none',
                    background: content.trim() ? '#3b82f6' : '#94a3b8',
                    color: 'white', fontWeight: 'bold', cursor: content.trim() ? 'pointer' : 'not-allowed',
                    whiteSpace: 'nowrap'
                  }}
                >
                  + 添加到素材池
                </button>
              )}
            </div>
            {type === 'B' && (
              <div style={{ display: 'flex', gap: '10px' }}>
                <input
                  type="text"
                  value={symbolAnswer}
                  onChange={(e) => setSymbolAnswer(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleAddSingle()}
                  placeholder="输入正确答案，如 极弱 (pianissimo)"
                  style={{ flex: 1, padding: '12px 16px', borderRadius: '8px', border: '1px solid #d1d5db', fontSize: '1rem' }}
                />
                <button
                  onClick={handleAddSingle}
                  disabled={!content.trim() || !symbolAnswer.trim()}
                  style={{
                    padding: '12px 24px', borderRadius: '8px', border: 'none',
                    background: content.trim() && symbolAnswer.trim() ? '#3b82f6' : '#94a3b8',
                    color: 'white', fontWeight: 'bold', cursor: content.trim() && symbolAnswer.trim() ? 'pointer' : 'not-allowed',
                    whiteSpace: 'nowrap'
                  }}
                >
                  + 添加到素材池
                </button>
              </div>
            )}
          </div>
          <p style={{ color: '#9ca3af', fontSize: '0.85rem' }}>
            {type === 'B' ? '第一行输入符号（题面），第二行输入答案含义' : '按回车可快速提交'}
          </p>
        </div>
      ) : (
        <div>
          <textarea
            value={batchText}
            onChange={(e) => setBatchText(e.target.value)}
            placeholder={type === 'B'
              ? `每行格式: 符号|答案，例如：\npp|极弱 (pianissimo)\nff|极强 (fortissimo)\nstaccato|断音\nfermata|延音记号`
              : `每行输入一道题目，例如：\nC4\nD4\nE4\nF#5\nG3`}
            style={{
              width: '100%', height: '200px', padding: '16px', borderRadius: '8px',
              border: '1px solid #d1d5db', fontSize: '1rem', resize: 'vertical',
              fontFamily: 'monospace', lineHeight: '1.8'
            }}
          />
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '10px' }}>
            <span style={{ color: '#6b7280', fontSize: '0.85rem' }}>
              已输入 {batchText.split('\n').filter(l => l.trim()).length} 行
            </span>
            <button
              onClick={handleAddBatch}
              disabled={!batchText.trim()}
              style={{
                padding: '12px 24px', borderRadius: '8px', border: 'none',
                background: batchText.trim() ? '#3b82f6' : '#94a3b8',
                color: 'white', fontWeight: 'bold', cursor: batchText.trim() ? 'pointer' : 'not-allowed'
              }}
            >
              批量添加到素材池
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
