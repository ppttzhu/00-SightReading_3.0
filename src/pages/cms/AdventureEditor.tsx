import { useMemo, useState } from 'react';
import type { CSSProperties } from 'react';
import { ArrowDown, ArrowUp, Plus, Route, Search, Trash2 } from 'lucide-react';
import {
  useAppStore,
  type AdventureStage,
  type QuizModuleId,
  type Slice,
} from '../../core/store/useAppStore';

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

/** 现有关卡（CustomStage）的平均难度，用于左侧关卡库展示 */
function stageAvgDifficulty(stage: { sliceIds: string[] }, sliceMap: Map<string, Slice>): string {
  const slices = stage.sliceIds.map(sid => sliceMap.get(sid)).filter(Boolean) as Slice[];
  if (slices.length === 0) return '-';
  const avg = slices.reduce((sum, s) => sum + s.difficulty, 0) / slices.length;
  return avg.toFixed(1);
}

/** 冒险关卡通过其 sourceStage 计算平均难度，用于右侧路线列表展示 */
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
): { label: string; tone: 'ok' | 'warn' | 'bad'; title: string } {
  const sourceStage = customStages.find(cs => cs.id === stage.sourceStageId);
  if (!sourceStage) return { label: '原关卡已失效', tone: 'bad', title: stage.title };
  const slices = sourceStage.sliceIds.map(sid => sliceMap.get(sid)).filter(Boolean) as Slice[];
  if (slices.length === 0) return { label: '空关卡', tone: 'bad', title: sourceStage.title };
  const qc = stage.questionCount || sourceStage.questionCount || sourceStage.sliceIds.length;
  return {
    label: `${slices.length}/${qc} 题`,
    tone: 'ok',
    title: sourceStage.title,
  };
}

export default function AdventureEditor() {
  const slicesPool = useAppStore(s => s.slicesPool);
  const customStages = useAppStore(s => s.customStages);
  const adventureStages = useAppStore(s => s.adventureStages);
  const addAdventureStage = useAppStore(s => s.addAdventureStage);
  const removeAdventureStage = useAppStore(s => s.removeAdventureStage);
  const moveAdventureStage = useAppStore(s => s.moveAdventureStage);

  const [moduleFilter, setModuleFilter] = useState<'all' | QuizModuleId>('all');
  const [search, setSearch] = useState('');
  const [message, setMessage] = useState('');

  const orderedRoute = useMemo(() => sortByLevel(adventureStages), [adventureStages]);
  const sliceMap = useMemo(() => new Map(slicesPool.map(s => [s.id, s])), [slicesPool]);
  const routeSourceIds = useMemo(
    () => new Set(orderedRoute.map(s => s.sourceStageId).filter(Boolean) as string[]),
    [orderedRoute],
  );

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
    if (routeSourceIds.has(source.id)) {
      showMsg('这关已经在主线里了。');
      return;
    }
    addAdventureStage({
      id: `adventure_route_${Date.now()}_${source.id}`,
      title: source.title,
      description: source.guidance || `引用现有关卡：${source.title}`,
      sourceStageId: source.id,
      sourceModule: source.module,
      questionCount: source.questionCount || source.sliceIds.length || 1,
      unlockRule: 'previous_clear',
      source: 'manual',
    } as const);
    showMsg('已加入正式主线。学生端会按右侧顺序显示。');
  };

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

      {message && <div className="adventure-cms-message">{message}</div>}

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
              const selected = routeSourceIds.has(stage.id);
              return (
                <article key={stage.id} className={`source-stage-row${selected ? ' selected' : ''}`}>
                  <div className="stage-main">
                    <div className="stage-title-line">
                      <strong>{stage.title}</strong>
                      <span className="module-pill" style={{ '--pill-color': moduleColor(stage.module) } as CSSProperties}>{moduleLabel(stage.module)}</span>
                    </div>
                    <small>{slices.length} 题 · 平均 L{stageAvgDifficulty(stage, sliceMap)}</small>
                  </div>
                  <button className="stage-add-button" disabled={selected} onClick={() => addToRoute(stage)}>
                    <Plus size={15} /> {selected ? '已在主线' : '加入主线'}
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
                const sourceModule = customStages.find(cs => cs.id === stage.sourceStageId)?.module || stage.sourceModule || 'notes';
                return (
                  <article key={stage.id} className="official-stage-row">
                    <div className="stage-order-badge">Lv.{stage.levelNum}</div>
                    <div className="stage-main">
                      <div className="stage-title-line">
                        <strong>{info.title}</strong>
                        <span className={`stage-health ${info.tone}`}>{info.label}</span>
                        <span className="module-pill" style={{ '--pill-color': moduleColor(sourceModule) } as CSSProperties}>{moduleLabel(sourceModule)}</span>
                      </div>
                      <small>引用现有关卡 · 平均 L{routeStageAvgDifficulty(stage, customStages, sliceMap)}</small>
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
    </div>
  );
}
