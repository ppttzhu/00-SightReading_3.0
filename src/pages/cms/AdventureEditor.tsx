import { useMemo, useState } from 'react';
import type { CSSProperties } from 'react';
import { ArrowDown, ArrowUp, Check, ListOrdered, Plus, Route, Search, Sparkles, Trash2, X } from 'lucide-react';
import {
  useAppStore,
  type AdventureDraftOptions,
  type AdventurePresetId,
  type AdventureStage,
  type CustomStage,
  type QuizModuleId,
  type Slice,
} from '../../core/store/useAppStore';

const MODULE_OPTIONS: Array<{ value: QuizModuleId; label: string; short: string; color: string }> = [
  { value: 'notes', label: '单音', short: '单音', color: '#2563eb' },
  { value: 'theory', label: '双音/音程', short: '音程', color: '#7c3aed' },
  { value: 'symbols', label: '符号', short: '符号', color: '#db2777' },
  { value: 'patterns', label: '音型', short: '音型', color: '#059669' },
];

const PRESETS: Array<{ id: AdventurePresetId; title: string; description: string; modules: QuizModuleId[] }> = [
  { id: 'notes_intro', title: '单音优先', description: '先排单音关卡，按平均难度从低到高。', modules: ['notes'] },
  { id: 'mixed_review', title: '单音 + 音程', description: '把单音和双音/音程关卡排成入门主线。', modules: ['notes', 'theory'] },
  { id: 'symbols_focus', title: '符号强化', description: '只从符号类现有关卡里生成顺序。', modules: ['symbols'] },
  { id: 'comprehensive', title: '综合路线', description: '从所有现有关卡中按难度生成综合路线。', modules: ['notes', 'theory', 'symbols', 'patterns'] },
];

const moduleLabel = (moduleId: string) => MODULE_OPTIONS.find(item => item.value === moduleId)?.label || moduleId;
const moduleColor = (moduleId: string) => MODULE_OPTIONS.find(item => item.value === moduleId)?.color || '#64748b';

function sortAdventureStages(stages: AdventureStage[]): AdventureStage[] {
  return [...stages].sort((a, b) => a.levelNum - b.levelNum || (a.createdAt || 0) - (b.createdAt || 0));
}

function stageSlices(stage: CustomStage | AdventureStage, sliceMap: Map<string, Slice>): Slice[] {
  return stage.sliceIds.map(sliceId => sliceMap.get(sliceId)).filter(Boolean) as Slice[];
}

function averageDifficulty(stage: CustomStage | AdventureStage, sliceMap: Map<string, Slice>): string {
  const slices = stageSlices(stage, sliceMap);
  if (slices.length === 0) return '-';
  const avg = slices.reduce((sum, slice) => sum + slice.difficulty, 0) / slices.length;
  return avg.toFixed(1);
}

function sourceForRouteStage(stage: AdventureStage, customStages: CustomStage[]): CustomStage | undefined {
  return stage.sourceStageId ? customStages.find(item => item.id === stage.sourceStageId) : undefined;
}

function describeRouteStage(stage: AdventureStage, customStages: CustomStage[], sliceMap: Map<string, Slice>) {
  const sourceStage = sourceForRouteStage(stage, customStages);
  const effectiveStage = sourceStage || stage;
  const slices = stageSlices(effectiveStage, sliceMap);
  if (!sourceStage && stage.sourceStageId) return { label: '原关卡已失效', tone: 'bad' as const, slices, title: stage.title };
  if (slices.length === 0) return { label: '空关卡', tone: 'bad' as const, slices, title: sourceStage?.title || stage.title };
  return {
    label: `${slices.length}/${effectiveStage.questionCount || slices.length} 题`,
    tone: 'ok' as const,
    slices,
    title: sourceStage?.title || stage.title,
  };
}

export default function AdventureEditor() {
  const slicesPool = useAppStore(state => state.slicesPool);
  const customStages = useAppStore(state => state.customStages);
  const adventureStages = useAppStore(state => state.adventureStages);
  const adventureDraft = useAppStore(state => state.adventureDraft);
  const addAdventureStage = useAppStore(state => state.addAdventureStage);
  const removeAdventureStage = useAppStore(state => state.removeAdventureStage);
  const moveAdventureStage = useAppStore(state => state.moveAdventureStage);
  const generateAdventureDraft = useAppStore(state => state.generateAdventureDraft);
  const publishAdventureDraft = useAppStore(state => state.publishAdventureDraft);
  const clearAdventureDraft = useAppStore(state => state.clearAdventureDraft);

  const [mode, setMode] = useState<'manual' | 'assistant'>('manual');
  const [moduleFilter, setModuleFilter] = useState<'all' | QuizModuleId>('all');
  const [search, setSearch] = useState('');
  const [message, setMessage] = useState('');
  const [draftOptions, setDraftOptions] = useState<AdventureDraftOptions>({
    preset: 'mixed_review',
    stageCount: 5,
    questionCount: 5,
    minDifficulty: 1,
    maxDifficulty: 10,
    modules: ['notes', 'theory'],
    includeReview: false,
  });

  const orderedRoute = useMemo(() => sortAdventureStages(adventureStages), [adventureStages]);
  const sliceMap = useMemo(() => new Map(slicesPool.map(slice => [slice.id, slice])), [slicesPool]);
  const routeSourceIds = useMemo(() => new Set(orderedRoute.map(stage => stage.sourceStageId).filter(Boolean)), [orderedRoute]);

  const visibleSourceStages = useMemo(() => {
    const query = search.trim().toLowerCase();
    return customStages
      .filter(stage => moduleFilter === 'all' || stage.module === moduleFilter)
      .filter(stage => !query || stage.title.toLowerCase().includes(query))
      .sort((a, b) => Number(averageDifficulty(a, sliceMap)) - Number(averageDifficulty(b, sliceMap)) || a.title.localeCompare(b.title));
  }, [customStages, moduleFilter, search, sliceMap]);

  const showMessage = (text: string) => {
    setMessage(text);
    window.setTimeout(() => setMessage(''), 2600);
  };

  const addSourceStageToRoute = (sourceStage: CustomStage) => {
    if (routeSourceIds.has(sourceStage.id)) {
      showMessage('这关已经在主线里了。');
      return;
    }
    addAdventureStage({
      id: `adventure_route_${Date.now()}_${sourceStage.id}`,
      title: sourceStage.title,
      description: `引用现有关卡：${sourceStage.title}`,
      sourceStageId: sourceStage.id,
      sourceModule: sourceStage.module,
      sliceIds: sourceStage.sliceIds,
      questionCount: sourceStage.questionCount || sourceStage.sliceIds.length || 1,
      unlockRule: 'previous_clear',
      source: 'manual',
    });
    showMessage('已加入正式主线。学生端会按右侧顺序显示。');
  };

  const applyPreset = (presetId: AdventurePresetId) => {
    const preset = PRESETS.find(item => item.id === presetId) || PRESETS[0];
    setDraftOptions(prev => ({
      ...prev,
      preset: presetId,
      modules: preset.modules,
    }));
  };

  const toggleDraftModule = (moduleId: QuizModuleId) => {
    setDraftOptions(prev => {
      const exists = prev.modules.includes(moduleId);
      const modules = exists
        ? prev.modules.filter(item => item !== moduleId)
        : [...prev.modules, moduleId];
      return { ...prev, modules };
    });
  };

  const handleGenerateDraft = () => {
    const draft = generateAdventureDraft(draftOptions);
    showMessage(draft.warnings.length > 0 ? '排序草稿已生成，但有提示需要检查。' : '已按现有关卡生成排序草稿。');
  };

  const handlePublishDraft = () => {
    publishAdventureDraft();
    setMode('manual');
    showMessage('草稿已确认，正式主线路线已更新。');
  };

  return (
    <div className="adventure-cms-page">
      <div className="adventure-cms-header">
        <div>
          <span className="adventure-cms-kicker"><Route size={16} /> 主线闯关配置</span>
          <h1>主线排关工具</h1>
          <p>这里不重新制作关卡，只把“关卡编排”里已经做好的关卡排成一条路线。学生端会把这条路线包装成游戏化闯关地图。</p>
        </div>
        <div className="adventure-cms-stats">
          <strong>{orderedRoute.length}</strong>
          <span>路线关卡</span>
        </div>
      </div>

      {message && <div className="adventure-cms-message">{message}</div>}

      <div className="adventure-cms-tabs" role="tablist" aria-label="主线排关模式">
        <button className={mode === 'manual' ? 'active' : ''} onClick={() => setMode('manual')}>
          <ListOrdered size={16} /> 手动排序
        </button>
        <button className={mode === 'assistant' ? 'active' : ''} onClick={() => setMode('assistant')}>
          <Sparkles size={16} /> 自动草稿
        </button>
      </div>

      {mode === 'manual' ? (
        <div className="adventure-route-grid">
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
                  {MODULE_OPTIONS.map(item => <option key={item.value} value={item.value}>{item.label}</option>)}
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
                <p className="empty-state">还没有可排序的现有关卡。请先去“关卡编排”创建普通关卡。</p>
              ) : visibleSourceStages.map(stage => {
                const slices = stageSlices(stage, sliceMap);
                const selected = routeSourceIds.has(stage.id);
                return (
                  <article key={stage.id} className={`source-stage-row${selected ? ' selected' : ''}`}>
                    <div className="stage-main">
                      <div className="stage-title-line">
                        <strong>{stage.title}</strong>
                        <span className="module-pill" style={{ '--pill-color': moduleColor(stage.module) } as CSSProperties}>{moduleLabel(stage.module)}</span>
                      </div>
                      <small>{slices.length} 题 · 平均 L{averageDifficulty(stage, sliceMap)}</small>
                    </div>
                    <button className="stage-add-button" disabled={selected} onClick={() => addSourceStageToRoute(stage)}>
                      <Plus size={15} /> {selected ? '已在主线' : '加入主线'}
                    </button>
                  </article>
                );
              })}
            </div>
          </section>

          <section className="adventure-cms-panel">
            <div className="panel-heading">
              <h2>正式主线路线</h2>
              <span>加入到这里就是正式主线</span>
            </div>
            {orderedRoute.length === 0 ? (
              <p className="empty-state">还没有正式主线。点击左侧关卡的“加入主线”，它会出现在这里；学生端会按这里的顺序闯关。</p>
            ) : (
              <div className="official-stage-list">
                {orderedRoute.map((stage, index) => {
                  const info = describeRouteStage(stage, customStages, sliceMap);
                  const module = sourceForRouteStage(stage, customStages)?.module || stage.sourceModule || 'notes';
                  return (
                    <article key={stage.id} className="official-stage-row">
                      <div className="stage-order-badge">Lv.{stage.levelNum}</div>
                      <div className="stage-main">
                        <div className="stage-title-line">
                          <strong>{info.title}</strong>
                          <span className={`stage-health ${info.tone}`}>{info.label}</span>
                          <span className="module-pill" style={{ '--pill-color': moduleColor(module) } as CSSProperties}>{moduleLabel(module)}</span>
                        </div>
                        <small>引用现有关卡 · 平均 L{averageDifficulty(sourceForRouteStage(stage, customStages) || stage, sliceMap)}</small>
                      </div>
                      <div className="stage-actions">
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
      ) : (
        <div className="adventure-assistant-layout">
          <section className="adventure-cms-panel">
            <div className="panel-heading">
              <h2>按现有关卡生成草稿</h2>
              <span>生成排序，不新建关卡</span>
            </div>
            <div className="preset-grid">
              {PRESETS.map(preset => (
                <button key={preset.id} className={`preset-card${draftOptions.preset === preset.id ? ' active' : ''}`} onClick={() => applyPreset(preset.id)}>
                  <strong>{preset.title}</strong>
                  <span>{preset.description}</span>
                </button>
              ))}
            </div>
            <div className="assistant-controls">
              <label className="cms-field">
                <span>路线关卡数</span>
                <input type="number" min={3} max={10} value={draftOptions.stageCount} onChange={e => setDraftOptions(prev => ({ ...prev, stageCount: Number(e.target.value) || 3 }))} />
              </label>
              <label className="cms-field">
                <span>最低平均难度</span>
                <input type="number" min={1} max={10} value={draftOptions.minDifficulty} onChange={e => setDraftOptions(prev => ({ ...prev, minDifficulty: Number(e.target.value) || 1 }))} />
              </label>
              <label className="cms-field">
                <span>最高平均难度</span>
                <input type="number" min={1} max={10} value={draftOptions.maxDifficulty} onChange={e => setDraftOptions(prev => ({ ...prev, maxDifficulty: Number(e.target.value) || 10 }))} />
              </label>
            </div>
            <div className="module-checkboxes">
              {MODULE_OPTIONS.map(item => (
                <label key={item.value} style={{ '--pill-color': item.color } as CSSProperties}>
                  <input type="checkbox" checked={draftOptions.modules.includes(item.value)} onChange={() => toggleDraftModule(item.value)} />
                  <span>{item.short}</span>
                </label>
              ))}
            </div>
            <button className="primary-action" onClick={handleGenerateDraft}>
              <Sparkles size={16} /> 生成排序草稿
            </button>
          </section>

          <section className="adventure-cms-panel">
            <div className="panel-heading">
              <h2>草稿预览</h2>
              {adventureDraft && <button className="text-action" onClick={clearAdventureDraft}><X size={14} /> 清空草稿</button>}
            </div>
            {!adventureDraft ? (
              <p className="empty-state">还没有草稿。选择套路和参数后点击生成。</p>
            ) : (
              <>
                <div className="draft-summary">{adventureDraft.summary}</div>
                {adventureDraft.warnings.length > 0 && (
                  <div className="draft-warnings">
                    {adventureDraft.warnings.map((warning, index) => <p key={index}>{warning}</p>)}
                  </div>
                )}
                <div className="draft-stage-list">
                  {adventureDraft.stages.map(stage => {
                    const info = describeRouteStage(stage, customStages, sliceMap);
                    const sourceStage = sourceForRouteStage(stage, customStages);
                    return (
                      <article key={stage.id} className="draft-stage-row">
                        <strong>{info.title}</strong>
                        <span className={`stage-health ${info.tone}`}>{info.label}</span>
                        <p>{stage.description}</p>
                        <small>{sourceStage ? `${moduleLabel(sourceStage.module)} · 平均 L${averageDifficulty(sourceStage, sliceMap)}` : '原关卡不可用'}</small>
                      </article>
                    );
                  })}
                </div>
                <button className="primary-action" onClick={handlePublishDraft}>
                  <Check size={16} /> 确认草稿为正式主线
                </button>
              </>
            )}
          </section>
        </div>
      )}
    </div>
  );
}
