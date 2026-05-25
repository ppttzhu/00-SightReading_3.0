import { useState, useRef } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import remarkBreaks from 'remark-breaks';
import { useAppStore, type CustomStage, type AutoStage } from '../../core/store/useAppStore';
import { getStaffLabel } from '../../core/engine/pitchUtils';
import { uploadGuidanceImage, GuidanceImageUploadError } from '../../components/guidanceImageUpload';

const MODULE_OPTIONS = [
  { value: 'notes',    label: '🎵 单音 (Notes)',          color: '#3b82f6' },
  { value: 'symbols',  label: '🎼 音乐表情记号 (Symbols)', color: '#ec4899' },
  { value: 'theory',   label: '📚 双音/音程关系 (Theory)', color: '#8b5cf6' },
  { value: 'patterns', label: '🎹 音型 (Patterns)',        color: '#10b981' },
] as const;

const TYPE_LABELS: Record<string, string> = { notes: '单音', symbols: '音乐表情记号', theory: '双音/音程关系', patterns: '音型' };
const TYPE_COLORS: Record<string, string> = { notes: '#3b82f6', symbols: '#ec4899', theory: '#8b5cf6', patterns: '#10b981' };

export default function CustomStageEditor() {
  const slicesPool = useAppStore(s => s.slicesPool);
  const customStages = useAppStore(s => s.customStages);
  const stageOrder = useAppStore(s => s.stageOrder);
  const addCustomStage = useAppStore(s => s.addCustomStage);
  const updateCustomStage = useAppStore(s => s.updateCustomStage);
  const removeCustomStage = useAppStore(s => s.removeCustomStage);
  const setStageOrder = useAppStore(s => s.setStageOrder);
  const getAllStages = useAppStore(s => s.getAllStages);

  const [module, setModule] = useState<'notes' | 'symbols' | 'theory' | 'patterns'>('notes');
  const [stageName, setStageName] = useState('');
  const [guidance, setGuidance] = useState('');
  const [uploadStatus, setUploadStatus] = useState<{ kind: 'idle' } | { kind: 'uploading'; name: string } | { kind: 'error'; msg: string }>({ kind: 'idle' });
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [questionCount, setQuestionCount] = useState(5);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [diffFilter, setDiffFilter] = useState<number | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<CustomStage | null>(null);
  const [msg, setMsg] = useState('');
  const dragItem = useRef<number | null>(null);
  const dragOver = useRef<number | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const relevantType = module;
  const filteredPool = slicesPool.filter(s => s.module === relevantType);
  const visiblePool = filteredPool
    .filter(s => diffFilter === null || s.difficulty === diffFilter)
    .sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
  const moduleStages = customStages.filter(cs => cs.module === module);
  const moduleColor = MODULE_OPTIONS.find(m => m.value === module)?.color || '#3b82f6';
  const orderedStages: AutoStage[] = getAllStages(module);

  const handleDragStart = (idx: number) => { dragItem.current = idx; };
  const handleDragEnter = (idx: number) => { dragOver.current = idx; };
  const handleDragEnd = () => {
    if (dragItem.current === null || dragOver.current === null || dragItem.current === dragOver.current) return;
    const newOrder = [...stageOrder[module]];
    const [moved] = newOrder.splice(dragItem.current, 1);
    newOrder.splice(dragOver.current, 0, moved);
    setStageOrder(module, newOrder);
    dragItem.current = null;
    dragOver.current = null;
  };

  const showMsg = (text: string) => {
    setMsg(text);
    setTimeout(() => setMsg(''), 2500);
  };

  const insertAtCursor = (text: string) => {
    const ta = textareaRef.current;
    if (!ta) {
      setGuidance(g => g + text);
      return;
    }
    const start = ta.selectionStart ?? guidance.length;
    const end = ta.selectionEnd ?? guidance.length;
    const next = guidance.slice(0, start) + text + guidance.slice(end);
    setGuidance(next);
    // 恢复光标位置到插入文本之后
    requestAnimationFrame(() => {
      ta.focus();
      const caret = start + text.length;
      ta.setSelectionRange(caret, caret);
    });
  };

  const runUpload = async (file: File) => {
    setUploadStatus({ kind: 'uploading', name: file.name });
    try {
      const url = await uploadGuidanceImage(file);
      // Sanitize alt: strip extension, then escape chars that break ![alt](url) syntax
      const alt = file.name.replace(/\.[^.]+$/, '').replace(/[[\]\r\n]/g, ' ').trim() || 'image';
      insertAtCursor(`![${alt}](${url})`);
      setUploadStatus({ kind: 'idle' });
    } catch (e) {
      const message = e instanceof GuidanceImageUploadError ? e.message : String(e);
      setUploadStatus({ kind: 'error', msg: message });
      setTimeout(() => setUploadStatus({ kind: 'idle' }), 4000);
    }
  };

  const runUploads = async (files: File[]) => {
    const images = files.filter(f => f.type.startsWith('image/'));
    for (const file of images) {
      await runUpload(file);
    }
  };

  const toggleSlice = (id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      setQuestionCount(qc => Math.max(qc, next.size));
      return next;
    });
  };

  const handleCreate = () => {
    if (!stageName.trim()) return showMsg('请输入关卡名称');
    if (selectedIds.size === 0) return showMsg('至少选择 1 道题目');
    if (questionCount < selectedIds.size) return showMsg(`题数不能小于已选题目数（${selectedIds.size}）`);
    const stage: CustomStage = {
      id: `custom_${Date.now()}`,
      module,
      title: stageName.trim(),
      sliceIds: Array.from(selectedIds),
      questionCount,
      guidance: guidance.trim() || undefined,
    };
    addCustomStage(stage);
    setStageName('');
    setGuidance('');
    setSelectedIds(new Set());
    setQuestionCount(5);
    setDiffFilter(null);
    showMsg(`✓ 已创建关卡「${stage.title}」（${stage.sliceIds.length} 道题，出题 ${questionCount} 次）`);
  };

  const handleEdit = (cs: CustomStage) => {
    setEditingId(cs.id);
    setStageName(cs.title);
    setGuidance(cs.guidance ?? '');
    setSelectedIds(new Set(cs.sliceIds));
    setModule(cs.module);
    setQuestionCount(cs.questionCount || cs.sliceIds.length || 5);
  };

  const handleUpdate = () => {
    if (!editingId) return;
    if (!stageName.trim()) return showMsg('请输入关卡名称');
    if (selectedIds.size === 0) return showMsg('至少选择 1 道题目');
    if (questionCount < selectedIds.size) return showMsg(`题数不能小于已选题目数（${selectedIds.size}）`);
    updateCustomStage(editingId, { title: stageName.trim(), sliceIds: Array.from(selectedIds), questionCount, guidance: guidance.trim() || undefined });
    setEditingId(null);
    setStageName('');
    setGuidance('');
    setSelectedIds(new Set());
    setQuestionCount(5);
    showMsg('✓ 关卡已更新');
  };

  const handleCancel = () => {
    setEditingId(null);
    setStageName('');
    setGuidance('');
    setSelectedIds(new Set());
    setQuestionCount(5);
  };

  return (
    <>
    <div style={{ maxWidth: '900px' }}>
      <h1 style={{ fontSize: '2rem', color: '#1f2937', margin: '0 0 8px' }}>关卡编排</h1>
      <p style={{ color: '#6b7280', marginBottom: '28px' }}>
        自定义每个关卡的题目内容与顺序，学生端将在自动生成关卡之后看到这些手动关卡。
      </p>

      {/* 成功提示 */}
      {msg && (
        <div style={{ background: '#ecfdf5', border: '1px solid #6ee7b7', borderRadius: '8px', padding: '10px 18px', color: '#065f46', fontWeight: 600, marginBottom: '20px' }}>
          {msg}
        </div>
      )}

      {/* ===== 创建 / 编辑区 ===== */}
      <div style={{ background: 'white', borderRadius: '16px', padding: '28px', boxShadow: '0 2px 12px rgba(0,0,0,0.05)', marginBottom: '32px', border: `2px solid ${editingId ? '#f59e0b' : moduleColor}20` }}>
        <h2 style={{ margin: '0 0 20px', fontSize: '1.15rem', color: '#374151', fontWeight: 700 }}>
          {editingId ? '✏️ 编辑关卡' : '➕ 新建关卡'}
        </h2>

        {/* 模块选择 */}
        <div style={{ marginBottom: '18px' }}>
          <label style={{ display: 'block', marginBottom: '8px', fontWeight: 600, color: '#374151', fontSize: '0.9rem' }}>所属模块</label>
          <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
            {MODULE_OPTIONS.map(opt => (
              <button
                key={opt.value}
                onClick={() => { if (!editingId) { setModule(opt.value); setSelectedIds(new Set()); } }}
                style={{
                  padding: '8px 16px', borderRadius: '20px', border: 'none',
                  background: module === opt.value ? opt.color : '#f3f4f6',
                  color: module === opt.value ? 'white' : '#6b7280',
                  fontWeight: 600, cursor: editingId ? 'not-allowed' : 'pointer',
                  fontSize: '0.88rem', opacity: editingId && module !== opt.value ? 0.4 : 1,
                  transition: 'all 0.15s',
                }}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        {/* 关卡名称 + 题数 */}
        <div style={{ marginBottom: '18px', display: 'flex', gap: '12px' }}>
          <div style={{ flex: 1 }}>
            <label style={{ display: 'block', marginBottom: '8px', fontWeight: 600, color: '#374151', fontSize: '0.9rem' }}>关卡名称</label>
            <input
              type="text"
              value={stageName}
              onChange={e => setStageName(e.target.value)}
              placeholder="例如：基础单音识别、升降号练习..."
              style={{ width: '100%', padding: '10px 14px', borderRadius: '8px', border: '1px solid #d1d5db', fontSize: '1rem', boxSizing: 'border-box' }}
            />
          </div>
          <div style={{ width: '120px' }}>
            <label style={{ display: 'block', marginBottom: '8px', fontWeight: 600, color: '#374151', fontSize: '0.9rem' }}>
              题数
              {questionCount > selectedIds.size && selectedIds.size > 0 && (
                <span style={{ fontWeight: 400, color: '#f59e0b', fontSize: '0.75rem', marginLeft: '4px' }}>（会重复）</span>
              )}
            </label>
            <input
              type="number"
              value={questionCount}
              min={Math.max(1, selectedIds.size)}
              onChange={e => setQuestionCount(Math.max(selectedIds.size || 1, parseInt(e.target.value) || 1))}
              style={{ width: '100%', padding: '10px 14px', borderRadius: '8px', border: '1px solid #d1d5db', fontSize: '1rem', boxSizing: 'border-box' }}
            />
          </div>
        </div>

        {/* 学习指导（可选，支持 Markdown + 换行 + 图片上传） */}
        <div style={{ marginBottom: '18px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
            <label style={{ fontWeight: 600, color: '#374151', fontSize: '0.9rem' }}>
              学习指导 <span style={{ color: '#9ca3af', fontWeight: 400 }}>（可选，支持 Markdown，回车直接换行，可贴/拖图片）</span>
            </label>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              {uploadStatus.kind === 'uploading' && (
                <span style={{ fontSize: '0.8rem', color: '#6b7280' }}>⏳ 上传中：{uploadStatus.name}</span>
              )}
              {uploadStatus.kind === 'error' && (
                <span style={{ fontSize: '0.8rem', color: '#ef4444' }}>⚠️ {uploadStatus.msg}</span>
              )}
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                style={{ display: 'none' }}
                onChange={(e) => {
                  const files = Array.from(e.target.files ?? []);
                  if (files.length > 0) runUploads(files);
                  e.target.value = '';
                }}
              />
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={uploadStatus.kind === 'uploading'}
                style={{ padding: '6px 12px', borderRadius: '6px', border: '1px solid #d1d5db', background: 'white', color: '#374151', fontWeight: 600, cursor: 'pointer', fontSize: '0.8rem' }}
              >
                📷 插入图片
              </button>
            </div>
          </div>
          <textarea
            ref={textareaRef}
            value={guidance}
            onChange={e => setGuidance(e.target.value)}
            rows={5}
            placeholder={'例如：\n这一关主要练习升降号识别。\n\n**注意**：C# 和 Db 是同一个琴键。\n\n（直接拖拽或粘贴图片即可上传）'}
            onPaste={(e) => {
              const items = Array.from(e.clipboardData?.items ?? []);
              const images: File[] = [];
              for (const item of items) {
                if (item.kind === 'file' && item.type.startsWith('image/')) {
                  const f = item.getAsFile();
                  if (f) images.push(f);
                }
              }
              if (images.length > 0) {
                e.preventDefault();
                runUploads(images);
              }
            }}
            onDragOver={(e) => { e.preventDefault(); }}
            onDrop={(e) => {
              const files = Array.from(e.dataTransfer?.files ?? []).filter(f => f.type.startsWith('image/'));
              if (files.length > 0) {
                e.preventDefault();
                runUploads(files);
              }
            }}
            style={{
              width: '100%', padding: '10px 14px', borderRadius: '8px',
              border: '1px solid #d1d5db', fontSize: '0.95rem', boxSizing: 'border-box',
              fontFamily: 'inherit', resize: 'vertical', minHeight: '120px',
            }}
          />
          {guidance.trim() && (
            <details open style={{ marginTop: '8px', background: '#f9fafb', borderRadius: '8px', padding: '10px 14px' }}>
              <summary style={{ cursor: 'pointer', fontSize: '0.85rem', color: '#6b7280', fontWeight: 600 }}>👁 预览</summary>
              <div style={{ marginTop: '8px', color: '#374151', fontSize: '0.95rem', lineHeight: 1.65 }}>
                <ReactMarkdown
                  remarkPlugins={[remarkGfm, remarkBreaks]}
                  components={{
                    a: ({ href, children }) => <a href={href} target="_blank" rel="noopener noreferrer">{children}</a>,
                    img: ({ src, alt }) => (
                      <img
                        src={src}
                        alt={alt ?? ''}
                        style={{ maxWidth: '100%', height: 'auto', borderRadius: '8px', display: 'block', margin: '8px 0' }}
                      />
                    ),
                  }}
                >{guidance}</ReactMarkdown>
              </div>
            </details>
          )}
        </div>

        {/* 题目勾选 */}
        <div style={{ marginBottom: '20px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
            <label style={{ fontWeight: 600, color: '#374151', fontSize: '0.9rem' }}>
              选择题目 <span style={{ color: '#9ca3af', fontWeight: 400 }}>（已选 {selectedIds.size} 道）</span>
            </label>
            {filteredPool.length > 0 && (
              <button
                onClick={() => setSelectedIds(selectedIds.size === visiblePool.length ? new Set() : new Set(visiblePool.map(s => s.id)))}
                style={{ fontSize: '0.8rem', color: moduleColor, background: 'none', border: 'none', cursor: 'pointer', fontWeight: 600 }}
              >
                {selectedIds.size === visiblePool.length && visiblePool.length > 0 ? '取消全选' : '全选'}
              </button>
            )}
          </div>

          {/* 难度筛选 */}
          {filteredPool.length > 0 && (
            <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginBottom: '8px' }}>
              <button onClick={() => { setDiffFilter(null); setSelectedIds(new Set()); }} style={{ padding: '3px 10px', borderRadius: '20px', border: `1px solid ${diffFilter === null ? moduleColor : '#e5e7eb'}`, background: diffFilter === null ? `${moduleColor}18` : 'white', color: diffFilter === null ? moduleColor : '#6b7280', fontSize: '0.8rem', cursor: 'pointer', fontWeight: 600 }}>全部</button>
              {Array.from(new Set(filteredPool.map(s => s.difficulty))).sort((a, b) => a - b).map(d => (
                <button key={d} onClick={() => { setDiffFilter(diffFilter === d ? null : d); setSelectedIds(new Set()); }} style={{ padding: '3px 10px', borderRadius: '20px', border: `1px solid ${diffFilter === d ? '#f59e0b' : '#e5e7eb'}`, background: diffFilter === d ? '#fef3c7' : 'white', color: diffFilter === d ? '#d97706' : '#6b7280', fontSize: '0.8rem', cursor: 'pointer', fontWeight: 600 }}>L{d}</button>
              ))}
            </div>
          )}

          {filteredPool.length === 0 ? (
            <div style={{ padding: '24px', textAlign: 'center', background: '#f9fafb', borderRadius: '10px', color: '#9ca3af' }}>
              该模块题库为空，请先通过「手动出题器」添加题目
            </div>
          ) : (
            <div style={{ maxHeight: '260px', overflowY: 'auto', border: '1px solid #e5e7eb', borderRadius: '10px', padding: '8px' }}>
              {visiblePool.map(slice => {
                const checked = selectedIds.has(slice.id);
                const c = slice.content as unknown as Record<string, unknown>;
                const raw = c.raw as string | undefined;
                const symbol = c.symbol as string | undefined;
                const theory = c.theory as string | undefined;
                const pattern = c.pattern as string | undefined;
                const label = (typeof c === 'string' ? c : raw || symbol || theory || pattern) || slice.id;
                const isNew = (slice.createdAt || 0) > Date.now() - 10 * 60 * 1000;
                return (
                  <label
                    key={slice.id}
                    style={{
                      display: 'flex', alignItems: 'center', gap: '12px',
                      padding: '9px 12px', borderRadius: '8px', cursor: 'pointer',
                      background: checked ? `${moduleColor}10` : 'transparent',
                      transition: 'background 0.15s',
                    }}
                  >
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => toggleSlice(slice.id)}
                      style={{ accentColor: moduleColor, width: '16px', height: '16px', cursor: 'pointer', flexShrink: 0 }}
                    />
                    <span style={{
                      display: 'inline-block', padding: '2px 8px', borderRadius: '4px',
                      background: `${TYPE_COLORS[slice.module]}18`, color: TYPE_COLORS[slice.module],
                      fontSize: '0.75rem', fontWeight: 700, flexShrink: 0
                    }}>
                      {TYPE_LABELS[slice.module]}
                    </span>
                    <span style={{ color: '#374151', fontSize: '0.95rem' }}>{label}</span>
                    {(((slice.content as unknown as Record<string, unknown>).options as string[] | undefined) ?? []).length > 0 && (
                      <span style={{
                        padding: '1px 6px', borderRadius: '4px', border: '1px solid #d1d5db',
                        color: '#9ca3af', fontSize: '0.72rem', flexShrink: 0, maxWidth: '220px',
                        overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap'
                      }}
                        title={((slice.content as unknown as Record<string, unknown>).options as string[]).join(' / ')}
                      >
                        选项: {((slice.content as unknown as Record<string, unknown>).options as string[]).join(' / ')}
                      </span>
                    )}
                    {slice.module === 'notes' && (
                      <span style={{
                        padding: '1px 6px',
                        borderRadius: '4px',
                        border: '1px solid #e5e7eb',
                        color: '#6b7280',
                        fontSize: '0.75rem',
                        fontWeight: 500,
                        flexShrink: 0
                      }}>
                        {getStaffLabel((slice.content as unknown as Record<string, unknown>).pitch as string || (slice.content as unknown as Record<string, unknown>).raw as string, ((slice.content as unknown as Record<string, unknown>).placement as 'auto' | 'treble' | 'bass') || undefined)}
                      </span>
                    )}
                    {slice.module === 'theory' && ((slice.content as unknown as Record<string, unknown>).placement as string) && (
                      <span style={{
                        padding: '1px 6px',
                        borderRadius: '4px',
                        border: '1px solid #e5e7eb',
                        color: '#6b7280',
                        fontSize: '0.75rem',
                        fontWeight: 500,
                        flexShrink: 0
                      }}>
                        {((slice.content as unknown as Record<string, unknown>).placement as string) === 'treble' ? '高音' : ((slice.content as unknown as Record<string, unknown>).placement as string) === 'bass' ? '低音' : '自动'}
                      </span>
                    )}
                    {isNew && (
                      <span style={{
                        padding: '1px 6px',
                        borderRadius: '4px',
                        background: '#fee2e2',
                        color: '#ef4444',
                        fontSize: '0.7rem',
                        fontWeight: 'bold',
                        flexShrink: 0
                      }}>
                        新
                      </span>
                    )}
                    <span style={{ marginLeft: 'auto', color: '#f59e0b', fontSize: '0.8rem', flexShrink: 0 }}>L{slice.difficulty}</span>
                  </label>
                );
              })}
            </div>
          )}
        </div>

        {/* 操作按钮 */}
        <div style={{ display: 'flex', gap: '10px' }}>
          {editingId ? (
            <>
              <button
                onClick={handleUpdate}
                style={{ padding: '10px 28px', borderRadius: '8px', border: 'none', background: '#f59e0b', color: 'white', fontWeight: 700, cursor: 'pointer', fontSize: '0.95rem' }}
              >
                保存修改
              </button>
              <button
                onClick={handleCancel}
                style={{ padding: '10px 20px', borderRadius: '8px', border: '1px solid #e5e7eb', background: 'white', color: '#6b7280', fontWeight: 600, cursor: 'pointer', fontSize: '0.95rem' }}
              >
                取消
              </button>
            </>
          ) : (
            <button
              onClick={handleCreate}
              style={{ padding: '10px 28px', borderRadius: '8px', border: 'none', background: moduleColor, color: 'white', fontWeight: 700, cursor: 'pointer', fontSize: '0.95rem' }}
            >
              创建关卡
            </button>
          )}
        </div>
      </div>

      {/* ===== 关卡排序（学生视角）===== */}
      <div style={{ background: 'white', borderRadius: '16px', padding: '28px', boxShadow: '0 2px 12px rgba(0,0,0,0.05)', marginBottom: '32px', border: '2px solid #e5e7eb' }}>
        <div style={{ marginBottom: '16px' }}>
          <h2 style={{ margin: 0, fontSize: '1.15rem', color: '#374151', fontWeight: 700 }}>
            当前模块的关卡
            <span style={{ marginLeft: '10px', fontSize: '0.85rem', color: '#9ca3af', fontWeight: 400 }}>（共 {moduleStages.length} 个）</span>
          </h2>
          <p style={{ margin: '4px 0 0', fontSize: '0.85rem', color: '#9ca3af' }}>
            拖拽调整关卡顺序，学生将按此顺序解锁关卡
          </p>
        </div>

        {orderedStages.length === 0 ? (
          <div style={{ padding: '32px', textAlign: 'center', background: '#f9fafb', borderRadius: '10px', color: '#9ca3af' }}>
            暂无关卡，点击上方「新建关卡」开始编排
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '4px 16px', fontSize: '0.78rem', color: '#9ca3af', fontWeight: 600 }}>
              <span style={{ width: '16px' }} />
              <span style={{ width: '28px', textAlign: 'center' }}>序号</span>
              <span style={{ flex: 1 }}>关卡名称</span>
              <span style={{ width: '60px', textAlign: 'right' }}>题数</span>
            </div>
            {orderedStages.map((stage, idx) => (
              <div
                key={stage.id}
                draggable
                onDragStart={() => handleDragStart(idx)}
                onDragEnter={() => handleDragEnter(idx)}
                onDragEnd={handleDragEnd}
                onDragOver={e => e.preventDefault()}
                style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '12px 16px', borderRadius: '8px', border: '1px solid #e5e7eb', background: '#fafafa', cursor: 'grab', userSelect: 'none' }}
              >
                <span style={{ color: '#9ca3af', fontSize: '1rem' }}>⠿</span>
                <span style={{ width: '28px', height: '28px', borderRadius: '50%', background: `${moduleColor}18`, display: 'flex', alignItems: 'center', justifyContent: 'center', color: moduleColor, fontWeight: 800, fontSize: '0.85rem', flexShrink: 0 }}>{idx + 1}</span>
                <span style={{ flex: 1, fontWeight: 600, color: '#1f2937', fontSize: '0.95rem' }}>
                  {stage.title}
                  {customStages.find(c => c.id === stage.id)?.guidance?.trim() && (
                    <span style={{ fontSize: '0.72rem', padding: '2px 8px', borderRadius: '4px', background: '#eff6ff', color: '#3b82f6', fontWeight: 600, marginLeft: '8px' }}>
                      📖 含指导
                    </span>
                  )}
                </span>
                <span style={{ fontSize: '0.8rem', color: '#9ca3af' }}>
                  {stage.slices.length} 题
                  {stage.questionCount > stage.slices.length && <span style={{ color: '#f59e0b', marginLeft: '4px' }}>→ 出 {stage.questionCount}</span>}
                </span>
                <button onClick={(e) => { e.stopPropagation(); const cs = customStages.find(c => c.id === stage.id); if (cs) handleEdit(cs); }} style={{ padding: '4px 10px', borderRadius: '6px', border: '1px solid #d1d5db', background: 'white', color: '#374151', fontWeight: 600, cursor: 'pointer', fontSize: '0.78rem' }}>编辑</button>
                <button onClick={(e) => { e.stopPropagation(); const cs = customStages.find(c => c.id === stage.id); if (cs) setDeleteTarget(cs); }} style={{ padding: '4px 10px', borderRadius: '6px', border: 'none', background: '#fee2e2', color: '#ef4444', fontWeight: 600, cursor: 'pointer', fontSize: '0.78rem' }}>删除</button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>

    {deleteTarget && (
      <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
        <div style={{ background: 'white', borderRadius: '12px', padding: '28px 32px', width: '360px', boxShadow: '0 8px 32px rgba(0,0,0,0.15)' }}>
          <div style={{ fontWeight: 700, fontSize: '1.05rem', color: '#1f2937', marginBottom: '10px' }}>删除关卡</div>
          <div style={{ color: '#6b7280', fontSize: '0.9rem', marginBottom: '24px' }}>确认删除关卡「{deleteTarget.title}」？此操作不可撤销。</div>
          <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
            <button onClick={() => setDeleteTarget(null)} style={{ padding: '8px 20px', borderRadius: '8px', border: '1px solid #d1d5db', background: 'white', color: '#374151', fontWeight: 600, cursor: 'pointer' }}>取消</button>
            <button onClick={() => { removeCustomStage(deleteTarget.id); setDeleteTarget(null); }} style={{ padding: '8px 20px', borderRadius: '8px', border: 'none', background: '#ef4444', color: 'white', fontWeight: 600, cursor: 'pointer' }}>删除</button>
          </div>
        </div>
      </div>
    )}
    </>
  );
}
