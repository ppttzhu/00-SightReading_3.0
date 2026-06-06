import { useMemo, useState } from 'react';
import type { CSSProperties } from 'react';
import { ArrowDown, ArrowUp, Pencil, Plus, Route, Search, Trash2, X } from 'lucide-react';
import {
  useAppStore,
  type AdventureStage,
  type QuizModuleId,
  type Slice,
  type GuidanceImage,
} from '../../core/store/useAppStore';
import { usePublish } from '../../core/storage/useRemoteSync';
import GuidanceEditor from '../../components/GuidanceEditor';

const MODULE_OPTIONS: Array<{ value: QuizModuleId; label: string; color: string }> = [
  { value: 'notes', label: '单音', color: '#2563eb' },
  { value: 'theory', label: '双音/音程', color: '#7c3aed' },
  { value: 'symbols', label: '符号', color: '#db2777' },
  { value: 'patterns', label: '音型', color: '#059669' },
];

function moduleLabel(moduleId: string) {
  return MODULE_OPTIONS.find(item => item.value === moduleId)?.label || moduleId;
}

function moduleColor(moduleId: string) {
  return MODULE_OPTIONS.find(item => item.value === moduleId)?.color || '#64748b';
}

function sortByLevel(stages: AdventureStage[]): AdventureStage[] {
  return [...stages].sort((a, b) => a.levelNum - b.levelNum || (a.createdAt || 0) - (b.createdAt || 0));
}

function stageAvgDifficulty(stage: { sliceIds: string[] }, sliceMap: Map<string, Slice>): string {
  const slices = stage.sliceIds.map(sid => sliceMap.get(sid)).filter(Boolean) as Slice[];
  if (slices.length === 0) return '-';
  const avg = slices.reduce((sum, s) => sum + s.difficulty, 0) / slices.length;
  return avg.toFixed(1);
}

function routeStageAvgDifficulty(
  stage: AdventureStage,
  customStages: { id: string; sliceIds: string[] }[],
  sliceMap: Map<string, Slice>,
): string {
  const src = customStages.find(cs => cs.id === stage.sourceStageId);
  if (!src) return '-';
  const slices = src.sliceIds.map(sid => sliceMap.get(sid)).filter(Boolean) as Slice[];
  if (slices.length === 0) return '-';
  const avg = slices.reduce((sum, s) => sum + s.difficulty, 0) / slices.length;
  return avg.toFixed(1);
}

function describeStage(
  stage: AdventureStage,
  customStages: { id: string; title: string; sliceIds: string[]; questionCount?: number; module: string }[],
  sliceMap: Map<string, Slice>,
): { label: string; tone: 'ok' | 'warn' | 'bad'; title: string; sourceTitle: string | null } {
  const sourceStage = customStages.find(cs => cs.id === stage.sourceStageId);
  if (!sourceStage) return { label: '原关卡已失效', tone: 'bad', title: stage.title, sourceTitle: null };
  const slices = sourceStage.sliceIds.map(sid => sliceMap.get(sid)).filter(Boolean) as Slice[];
  if (slices.length === 0) return { label: '空关卡', tone: 'bad', title: sourceStage.title, sourceTitle: sourceStage.title };
  const qc = stage.questionCount || sourceStage.questionCount || sourceStage.sliceIds.length;
  return {
    label: `${slices.length}/${qc} 题`,
    tone: 'ok',
    title: stage.title || sourceStage.title,
    sourceTitle: sourceStage.title,
  };
}

/** 音符显示时间预设值（毫秒） */
const NOTE_DISPLAY_PRESETS = [
  { label: '2s', value: 2000 },
  { label: '3s', value: 3000 },
  { label: '4s', value: 4000 },
  { label: '5s', value: 5000 },
  { label: '8s', value: 8000 },
];

const NOTE_HIDDEN_PRESETS = [
  { label: '3s', value: 3000 },
  { label: '6s', value: 6000 },
  { label: '8s', value: 8000 },
  { label: '10s', value: 10000 },
  { label: '15s', value: 15000 },
];

/** 关卡编辑弹框 */
function StageEditModal({
  stage,
  onSave,
  onClose,
}: {
  stage: AdventureStage;
  onSave: (title: string, description: string, guidance: string, guidanceImages: GuidanceImage[], noteDisplayMs?: number, noteHiddenMs?: number, passCriteria?: { enabled: boolean; minAccuracy: number }) => void;
  onClose: () => void;
}) {
  const [title, setTitle] = useState(stage.title);
  const [desc, setDesc] = useState(stage.description || '');
  const [guidance, setGuidance] = useState(stage.guidance || '');
  const [images, setImages] = useState<GuidanceImage[]>(stage.guidanceImages || []);
  const [noteDisplayMs, setNoteDisplayMs] = useState(stage.noteDisplayMs ?? 3000);
  const [noteHiddenMs, setNoteHiddenMs] = useState(stage.noteHiddenMs ?? 6000);
  const [passEnabled, setPassEnabled] = useState(stage.passCriteria?.enabled ?? false);
  const [minAccuracy, setMinAccuracy] = useState(stage.passCriteria?.minAccuracy ?? 80);

  const qc = stage.questionCount;
  const showQcWarning = passEnabled && minAccuracy >= 80 && qc > 0 && qc < 5;

  const handleSave = () => {
    onSave(title, desc, guidance, images, noteDisplayMs, noteHiddenMs, { enabled: passEnabled, minAccuracy });
  };

  return (
    <div style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '20px',
    }}>
      <div style={{
        background: 'white', borderRadius: '16px', width: '100%', maxWidth: '720px',
        maxHeight: '90vh', display: 'flex', flexDirection: 'column',
        boxShadow: '0 8px 32px rgba(0,0,0,0.15)',
      }}>
        {/* 弹框标题 */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '20px 24px 0',
        }}>
          <h2 style={{ margin: 0, fontSize: '1.15rem', color: '#1f2937', fontWeight: 700 }}>
            ✏️ 编辑关卡
          </h2>
          <button onClick={onClose} style={{ padding: '4px 8px', background: 'none', border: 'none', cursor: 'pointer', color: '#9ca3af' }}>
            <X size={20} />
          </button>
        </div>

        {/* 弹框内容 */}
        <div style={{ padding: '20px 24px', overflowY: 'auto', flex: 1 }}>
          {/* 标题 */}
          <div style={{ marginBottom: '16px' }}>
            <label style={{ display: 'block', marginBottom: '6px', fontWeight: 600, color: '#374151', fontSize: '0.9rem' }}>
              关卡标题
            </label>
            <input
              type="text"
              value={title}
              onChange={e => setTitle(e.target.value)}
              placeholder="关卡标题"
              style={{ width: '100%', padding: '10px 14px', borderRadius: '8px', border: '1px solid #d1d5db', fontSize: '1rem', boxSizing: 'border-box' }}
            />
          </div>

          {/* 关卡说明 */}
          <div style={{ marginBottom: '16px' }}>
            <label style={{ display: 'block', marginBottom: '6px', fontWeight: 600, color: '#374151', fontSize: '0.9rem' }}>
              关卡说明 <span style={{ color: '#9ca3af', fontWeight: 400 }}>（显示在闯关地图关卡卡片上）</span>
            </label>
            <textarea
              value={desc}
              onChange={e => setDesc(e.target.value)}
              placeholder="例如：练习升降号识别"
              rows={2}
              style={{ width: '100%', padding: '10px 14px', borderRadius: '8px', border: '1px solid #d1d5db', fontSize: '0.95rem', boxSizing: 'border-box', fontFamily: 'inherit', resize: 'vertical' }}
            />
          </div>

          {/* 音符显示时间配置 */}
          <div style={{ marginBottom: '16px', padding: '14px', background: '#f9fafb', borderRadius: '10px' }}>
            <label style={{ display: 'block', marginBottom: '8px', fontWeight: 600, color: '#374151', fontSize: '0.9rem' }}>
              音符显示时间
            </label>
            <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
              <span style={{ fontSize: '0.8rem', color: '#6b7280' }}>显示：</span>
              {NOTE_DISPLAY_PRESETS.map(p => (
                <button
                  key={p.value}
                  onClick={() => setNoteDisplayMs(p.value)}
                  style={{
                    padding: '4px 12px', borderRadius: '6px', border: `1px solid ${noteDisplayMs === p.value ? '#f59e0b' : '#d1d5db'}`,
                    background: noteDisplayMs === p.value ? '#fef3c7' : 'white', color: '#374151', fontWeight: noteDisplayMs === p.value ? 700 : 400,
                    cursor: 'pointer', fontSize: '0.82rem',
                  }}
                >{p.label}</button>
              ))}
              <input
                type="number"
                min={500}
                max={30000}
                step={100}
                value={noteDisplayMs}
                onChange={e => setNoteDisplayMs(Number(e.target.value))}
                style={{ width: '76px', padding: '4px 8px', borderRadius: '6px', border: '1px solid #d1d5db', fontSize: '0.82rem', textAlign: 'center' }}
              />
              <span style={{ fontSize: '0.75rem', color: '#9ca3af' }}>ms</span>
            </div>
            <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap', marginTop: '8px' }}>
              <span style={{ fontSize: '0.8rem', color: '#6b7280' }}>隐藏：</span>
              {NOTE_HIDDEN_PRESETS.map(p => (
                <button
                  key={p.value}
                  onClick={() => setNoteHiddenMs(p.value)}
                  style={{
                    padding: '4px 12px', borderRadius: '6px', border: `1px solid ${noteHiddenMs === p.value ? '#f59e0b' : '#d1d5db'}`,
                    background: noteHiddenMs === p.value ? '#fef3c7' : 'white', color: '#374151', fontWeight: noteHiddenMs === p.value ? 700 : 400,
                    cursor: 'pointer', fontSize: '0.82rem',
                  }}
                >{p.label}</button>
              ))}
              <input
                type="number"
                min={500}
                max={60000}
                step={100}
                value={noteHiddenMs}
                onChange={e => setNoteHiddenMs(Number(e.target.value))}
                style={{ width: '76px', padding: '4px 8px', borderRadius: '6px', border: '1px solid #d1d5db', fontSize: '0.82rem', textAlign: 'center' }}
              />
              <span style={{ fontSize: '0.75rem', color: '#9ca3af' }}>ms</span>
            </div>
          </div>

          {/* 通关标准配置 */}
          <div style={{ marginBottom: '16px', padding: '14px', background: '#f9fafb', borderRadius: '10px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px' }}>
              <label style={{ fontWeight: 600, color: '#374151', fontSize: '0.9rem' }}>
                通关标准
              </label>
              <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.85rem', color: '#6b7280', cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={passEnabled}
                  onChange={e => setPassEnabled(e.target.checked)}
                  style={{ width: '16px', height: '16px', cursor: 'pointer' }}
                />
                启用
              </label>
            </div>
            {passEnabled && (
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <span style={{ fontSize: '0.82rem', color: '#6b7280', minWidth: '60px' }}>最低正确率</span>
                  <input
                    type="range"
                    min={50}
                    max={100}
                    value={minAccuracy}
                    onChange={e => setMinAccuracy(Number(e.target.value))}
                    style={{ flex: 1 }}
                  />
                  <span style={{ fontSize: '1rem', fontWeight: 700, color: '#374151', minWidth: '48px', textAlign: 'right' }}>{minAccuracy}%</span>
                </div>
                {showQcWarning && (
                  <p style={{ margin: '8px 0 0', fontSize: '0.8rem', color: '#d97706', lineHeight: 1.4 }}>
                    ⚠️ 当前关卡仅 {qc} 题，正确率要求 {minAccuracy}% 可能偏高。建议至少 5 题以上以保证判定可靠性。
                  </p>
                )}
              </div>
            )}
          </div>

          {/* 学习指导 */}
          <GuidanceEditor
            value={guidance}
            onChange={setGuidance}
            guidanceImages={images}
            onImagesChange={setImages}
            stageId={stage.id}
          />
        </div>

        {/* 底部按钮 */}
        <div style={{
          display: 'flex', justifyContent: 'flex-end', gap: '10px',
          padding: '16px 24px 20px', borderTop: '1px solid #f3f4f6',
        }}>
          <button onClick={onClose} style={{ padding: '10px 20px', borderRadius: '8px', border: '1px solid #d1d5db', background: 'white', color: '#6b7280', fontWeight: 600, cursor: 'pointer' }}>
            取消
          </button>
          <button onClick={handleSave} style={{ padding: '10px 28px', borderRadius: '8px', border: 'none', background: '#f59e0b', color: 'white', fontWeight: 700, cursor: 'pointer', fontSize: '0.95rem' }}>
            保存修改
          </button>
        </div>
      </div>
    </div>
  );
}

export default function AdventureEditor() {
  const { publish, status: publishStatus, error: publishError } = usePublish();

  const slicesPool = useAppStore(s => s.slicesPool);
  const customStages = useAppStore(s => s.customStages);
  const adventureStages = useAppStore(s => s.adventureStages);
  const addAdventureStage = useAppStore(s => s.addAdventureStage);
  const removeAdventureStage = useAppStore(s => s.removeAdventureStage);
  const moveAdventureStage = useAppStore(s => s.moveAdventureStage);
  const updateAdventureStage = useAppStore(s => s.updateAdventureStage);

  const [moduleFilter, setModuleFilter] = useState<'all' | QuizModuleId>('all');
  const [search, setSearch] = useState('');
  const [message, setMessage] = useState('');
  const [modalStage, setModalStage] = useState<AdventureStage | null>(null);
  const [publishMsg, setPublishMsg] = useState('');

  const orderedRoute = useMemo(() => sortByLevel(adventureStages), [adventureStages]);
  const sliceMap = useMemo(() => new Map(slicesPool.map(s => [s.id, s])), [slicesPool]);
  const routeSourceCounts = useMemo(() => {
    const counts = new Map<string, number>();
    orderedRoute.forEach(s => {
      if (s.sourceStageId) counts.set(s.sourceStageId, (counts.get(s.sourceStageId) || 0) + 1);
    });
    return counts;
  }, [orderedRoute]);

  const visibleSourceStages = useMemo(() => {
    const q = search.trim().toLowerCase();
    return customStages
      .filter(s => moduleFilter === 'all' || s.module === moduleFilter)
      .filter(s => !q || s.title.toLowerCase().includes(q))
      .sort((a, b) => {
        const da = Number(stageAvgDifficulty(a, sliceMap));
        const db = Number(stageAvgDifficulty(b, sliceMap));
        return da - db || a.title.localeCompare(b.title);
      });
  }, [customStages, moduleFilter, search, sliceMap]);

  const showMsg = (text: string) => {
    setMessage(text);
    setTimeout(() => setMessage(''), 2600);
  };

  const addToRoute = (source: typeof customStages[number]) => {
    const existingCount = orderedRoute.filter(s => s.sourceStageId === source.id).length;
    addAdventureStage({
      id: `adventure_route_${source.id}_${existingCount + 1}`,
      title: source.title,
      description: '',
      guidance: '',
      sourceStageId: source.id,
      sourceModule: source.module,
      questionCount: source.questionCount || source.sliceIds.length || 1,
      unlockRule: 'previous_clear',
      source: 'manual',
    } as const);
    showMsg('已加入正式主线。');
  };

  const handlePublish = async () => {
    setPublishMsg('');
    try {
      await publish();
      if (publishStatus === 'error') {
        setPublishMsg(publishError || '发布失败');
      } else {
        setPublishMsg('✅ 路线已发布到云端');
        setTimeout(() => setPublishMsg(''), 3000);
      }
    } catch (e: any) {
      setPublishMsg(e.message || '发布失败');
    }
  };

  const hasUnpublishedChanges = orderedRoute.length > 0;

  return (
    <div className="adventure-cms-page">
      <div className="adventure-cms-header">
        <div>
          <span className="adventure-cms-kicker"><Route size={16} /> 主线闯关配置</span>
          <h1>主线排关工具</h1>
          <p>这里不重新制作关卡，只把「关卡编排」里已经做好的关卡排成一条路线。学生端会把这条路线包装成游戏化闯关地图。</p>
        </div>
        <div className="adventure-cms-stats">
          <strong>{orderedRoute.length}</strong>
          <span>路线关卡</span>
        </div>
      </div>

      {(message || publishMsg) && (
        <div className="adventure-cms-message">{message || publishMsg}</div>
      )}

      {/* ── 发布状态栏 ── */}
      <div className="adventure-cms-publish-bar">
        <span className="adventure-cms-publish-status">
          <span className={`status-dot ${hasUnpublishedChanges ? 'changed' : 'synced'}`} />
          {hasUnpublishedChanges ? '本地已保存 · 尚未发布到云端' : '路线已发布'}
        </span>
        <button
          className="primary-action"
          onClick={handlePublish}
          disabled={publishStatus === 'saving' || !hasUnpublishedChanges}
          style={{ width: 'auto' }}
        >
          {publishStatus === 'saving' ? '⏳ 发布中...' : '🚀 发布路线'}
        </button>
      </div>

      <div className="adventure-route-grid">
        {/* 左侧：现有关卡库 */}
        <section className="adventure-cms-panel">
          <div className="panel-heading">
            <h2>现有关卡库</h2>
            <span>{visibleSourceStages.length}/{customStages.length} 关</span>
          </div>
          <div className="pool-filter-grid">
            <label className="cms-field">
              <span>模块</span>
              <select value={moduleFilter} onChange={e => setModuleFilter(e.target.value as 'all' | QuizModuleId)}>
                <option value="all">全部模块</option>
                {MODULE_OPTIONS.map(item => (
                  <option key={item.value} value={item.value}>{item.label}</option>
                ))}
              </select>
            </label>
            <label className="cms-field">
              <span>搜索</span>
              <span className="cms-search-field compact">
                <Search size={16} />
                <input value={search} onChange={e => setSearch(e.target.value)} placeholder="关卡名称" />
              </span>
            </label>
          </div>
          <div className="source-stage-list">
            {visibleSourceStages.length === 0 ? (
              <p className="empty-state">还没有可排序的现有关卡。请先去"关卡编排"创建普通关卡。</p>
            ) : visibleSourceStages.map(stage => {
              const slices = stage.sliceIds.map(sid => sliceMap.get(sid)).filter(Boolean) as Slice[];
              const inRouteCount = routeSourceCounts.get(stage.id) || 0;
              return (
                <article key={stage.id} className={`source-stage-row${inRouteCount > 0 ? ' selected' : ''}`}>
                  <div className="stage-main">
                    <div className="stage-title-line">
                      <strong>{stage.title}</strong>
                      <span className="module-pill" style={{ '--pill-color': moduleColor(stage.module) } as CSSProperties}>{moduleLabel(stage.module)}</span>
                      {inRouteCount > 0 && <span className="in-route-badge">路线中 ×{inRouteCount}</span>}
                    </div>
                    <small>{slices.length} 题 · 平均 L{stageAvgDifficulty(stage, sliceMap)}</small>
                  </div>
                  <button className="stage-add-button" onClick={() => addToRoute(stage)}>
                    <Plus size={15} /> 加入主线
                  </button>
                </article>
              );
            })}
          </div>
        </section>

        {/* 右侧：正式主线路线 */}
        <section className="adventure-cms-panel">
          <div className="panel-heading">
            <h2>正式主线路线</h2>
            <span>加入到这里就是正式主线</span>
          </div>
          {orderedRoute.length === 0 ? (
            <p className="empty-state">还没有正式主线。点击左侧关卡的"加入主线"，它会出现在这里；学生端会按这里的顺序闯关。</p>
          ) : (
            <div className="official-stage-list">
              {orderedRoute.map((stage, index) => {
                const info = describeStage(stage, customStages, sliceMap);
                const sourceStage = customStages.find(cs => cs.id === stage.sourceStageId);
                const sourceModule = sourceStage?.module || stage.sourceModule || 'notes';

                return (
                  <article key={stage.id} className="official-stage-row">
                    <div className="stage-order-badge">Lv.{stage.levelNum}</div>
                    <div className="stage-main">
                      <div className="stage-title-line">
                        <strong>{info.title}</strong>
                        <span className={`stage-health ${info.tone}`}>{info.label}</span>
                        <span className="module-pill" style={{ '--pill-color': moduleColor(sourceModule) } as CSSProperties}>{moduleLabel(sourceModule)}</span>
                        {stage.guidance?.trim() && (
                          <span style={{ fontSize: '0.72rem', padding: '2px 8px', borderRadius: '4px', background: '#eff6ff', color: '#3b82f6', fontWeight: 600, marginLeft: '4px' }}>
                            📖 含指导
                          </span>
                        )}
                        {(stage.noteDisplayMs || stage.noteHiddenMs) && (
                          <span style={{ fontSize: '0.72rem', padding: '2px 8px', borderRadius: '4px', background: '#f0fdf4', color: '#16a34a', fontWeight: 600, marginLeft: '4px' }}>
                            {(stage.noteDisplayMs ?? 3000) / 1000}s/{(stage.noteHiddenMs ?? 6000) / 1000}s
                          </span>
                        )}
                        {stage.passCriteria?.enabled && (
                          <span style={{ fontSize: '0.72rem', padding: '2px 8px', borderRadius: '4px', background: '#fef2f2', color: '#dc2626', fontWeight: 600, marginLeft: '4px' }}>
                            ≥{stage.passCriteria.minAccuracy}%
                          </span>
                        )}
                      </div>
                      {stage.description && (
                        <p className="stage-desc">{stage.description}</p>
                      )}
                      <small>
                        {info.sourceTitle
                          ? `来源：${info.sourceTitle} · 平均 L${routeStageAvgDifficulty(stage, customStages, sliceMap)}`
                          : '❌ 原关卡已失效'}
                      </small>
                    </div>
                    <div className="stage-actions">
                      <button onClick={() => setModalStage(stage)} aria-label="编辑"><Pencil size={15} /></button>
                      <button disabled={index === 0} onClick={() => moveAdventureStage(stage.id, 'up')} aria-label="上移"><ArrowUp size={15} /></button>
                      <button disabled={index === orderedRoute.length - 1} onClick={() => moveAdventureStage(stage.id, 'down')} aria-label="下移"><ArrowDown size={15} /></button>
                      <button className="danger" onClick={() => removeAdventureStage(stage.id)} aria-label="移出路线"><Trash2 size={15} /></button>
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </section>
      </div>

      {/* 编辑弹框 */}
      {modalStage && (
        <StageEditModal
          stage={modalStage}
          onSave={(title, desc, guidance, images, noteDisplayMs, noteHiddenMs, passCriteria) => {
            updateAdventureStage(modalStage.id, { title, description: desc, guidance, guidanceImages: images, noteDisplayMs, noteHiddenMs, passCriteria });
            setModalStage(null);
            showMsg('已更新关卡信息。');
          }}
          onClose={() => setModalStage(null)}
        />
      )}
    </div>
  );
}
