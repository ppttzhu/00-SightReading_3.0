import { useState, useMemo } from 'react';
import { ChevronUp, ChevronDown, Loader2, Search } from 'lucide-react';
import { useUserSliceStats, type UserSliceStatsRecord, type QuizModule } from '../../../hooks/useUserSliceStats';
import Pagination from '../../../components/Pagination';

type SortKey = 'module' | 'mode' | 'displayLabel' | 'totalCount' | 'wrongCount' | 'errorRate';
type SortDir = 'asc' | 'desc';

type ModeFilter = '' | 'practice' | 'challenge';

const MODE_OPTIONS: { value: ModeFilter; label: string }[] = [
  { value: '', label: '全部模式' },
  { value: 'practice', label: '练习' },
  { value: 'challenge', label: '闯关' },
];

const MODULE_ORDER: Record<string, number> = { notes: 0, symbols: 1, theory: 2, patterns: 3 };
const MODULE_OPTIONS: { value: '' | QuizModule; label: string }[] = [
  { value: '', label: '全部模块' },
  { value: 'notes', label: '单音' },
  { value: 'symbols', label: '记号' },
  { value: 'theory', label: '音程' },
  { value: 'patterns', label: '音型' },
];

function getModuleLabel(m: QuizModule): string {
  return m === 'notes' ? '单音' : m === 'symbols' ? '记号' : m === 'theory' ? '音程' : '音型';
}

function compareRecords(a: UserSliceStatsRecord, b: UserSliceStatsRecord, key: SortKey, dir: SortDir): number {
  let cmp = 0;
  switch (key) {
    case 'module':
      cmp = (MODULE_ORDER[a.module] ?? 9) - (MODULE_ORDER[b.module] ?? 9);
      break;
    case 'mode': {
      const aMode = a.quizId.startsWith('prac_') ? 0 : 1;
      const bMode = b.quizId.startsWith('prac_') ? 0 : 1;
      cmp = aMode - bMode;
      break;
    }
    case 'displayLabel':
      cmp = a.displayLabel.localeCompare(b.displayLabel);
      break;
    case 'totalCount':
      cmp = a.totalCount - b.totalCount;
      break;
    case 'wrongCount':
      cmp = a.wrongCount - b.wrongCount;
      break;
    case 'errorRate':
      cmp = a.errorRate - b.errorRate;
      break;
  }
  return dir === 'desc' ? -cmp : cmp;
}

export default function PracticeRecordsTab() {
  const [page, setPage] = useState(1);
  const [sortKey, setSortKey] = useState<SortKey>('errorRate');
  const [sortDir, setSortDir] = useState<SortDir>('desc');
  const [filterModule, setFilterModule] = useState<'' | QuizModule>('');
  const [filterMode, setFilterMode] = useState<ModeFilter>('');
  const [searchText, setSearchText] = useState('');
  const pageSize = 10;
  const { data: allData, totalCount: rawTotal, loading, error, retry } = useUserSliceStats();

  // Filter and search
  const filteredData = useMemo(() => {
    let result = allData;
    if (filterModule) {
      result = result.filter(r => r.module === filterModule);
    }
    if (filterMode === 'practice') {
      result = result.filter(r => r.quizId.startsWith('prac_'));
    } else if (filterMode === 'challenge') {
      result = result.filter(r => !r.quizId.startsWith('prac_'));
    }
    if (searchText.trim()) {
      const q = searchText.trim().toLowerCase();
      result = result.filter(r => r.displayLabel.toLowerCase().includes(q));
    }
    return result;
  }, [allData, filterModule, filterMode, searchText]);

  // Sort
  const sortedData = useMemo(() => {
    const sorted = [...filteredData];
    sorted.sort((a, b) => compareRecords(a, b, sortKey, sortDir));
    return sorted;
  }, [filteredData, sortKey, sortDir]);

  const totalCount = sortedData.length;
  const totalPages = Math.ceil(totalCount / pageSize);
  const offset = (page - 1) * pageSize;
  const pageData = sortedData.slice(offset, offset + pageSize);

  const handleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    } else {
      setSortKey(key);
      setSortDir(key === 'module' || key === 'displayLabel' ? 'asc' : 'desc');
    }
    setPage(1);
  };

  const handleFilterChange = (value: '' | QuizModule) => {
    setFilterModule(value);
    setPage(1);
  };

  const handleModeChange = (value: ModeFilter) => {
    setFilterMode(value);
    setPage(1);
  };

  const handleSearchChange = (value: string) => {
    setSearchText(value);
    setPage(1);
  };

  const SortIcon = ({ col }: { col: SortKey }) => {
    if (sortKey !== col) return <span style={{ opacity: 0.3, marginLeft: 2 }}>↕</span>;
    return sortDir === 'asc'
      ? <ChevronUp size={12} style={{ marginLeft: 2 }} />
      : <ChevronDown size={12} style={{ marginLeft: 2 }} />;
  };

  if (loading) {
    return <div className="profile-loading"><Loader2 size={24} className="spin-icon" /></div>;
  }

  if (error) {
    return (
      <div className="profile-error">
        <span className="profile-error-message">{error}</span>
        <button className="profile-retry-button" onClick={retry}>
          重试
        </button>
      </div>
    );
  }

  if (rawTotal === 0) {
    return <div className="profile-empty">暂无做题记录，快去练习吧！</div>;
  }

  return (
    <div>
      {/* Filter & Search toolbar */}
      <div className="records-toolbar">
        <select
          className="records-filter-select"
          value={filterModule}
          onChange={e => handleFilterChange(e.target.value as '' | QuizModule)}
        >
          {MODULE_OPTIONS.map(opt => (
            <option key={opt.value} value={opt.value}>{opt.label}</option>
          ))}
        </select>
        <select
          className="records-filter-select"
          value={filterMode}
          onChange={e => handleModeChange(e.target.value as ModeFilter)}
        >
          {MODE_OPTIONS.map(opt => (
            <option key={opt.value} value={opt.value}>{opt.label}</option>
          ))}
        </select>
        <div className="records-search-wrapper">
          <Search size={14} className="records-search-icon" />
          <input
            className="records-search-input"
            type="text"
            placeholder="搜索题目..."
            value={searchText}
            onChange={e => handleSearchChange(e.target.value)}
          />
        </div>
      </div>

      {totalCount === 0 ? (
        <div className="profile-empty">没有匹配的记录</div>
      ) : (
        <>
          <table className="practice-records-table">
            <thead>
              <tr>
                <th style={{ cursor: 'pointer' }} onClick={() => handleSort('module')}>
                  模块<SortIcon col="module" />
                </th>
                <th style={{ cursor: 'pointer' }} onClick={() => handleSort('mode')}>
                  模式<SortIcon col="mode" />
                </th>
                <th style={{ cursor: 'pointer' }} onClick={() => handleSort('displayLabel')}>
                  题目<SortIcon col="displayLabel" />
                </th>
                <th style={{ cursor: 'pointer' }} onClick={() => handleSort('totalCount')}>
                  总次数<SortIcon col="totalCount" />
                </th>
                <th style={{ cursor: 'pointer' }} onClick={() => handleSort('wrongCount')}>
                  错误次数<SortIcon col="wrongCount" />
                </th>
                <th style={{ cursor: 'pointer' }} onClick={() => handleSort('errorRate')}>
                  错误率<SortIcon col="errorRate" />
                </th>
              </tr>
            </thead>
            <tbody>
              {pageData.map((record) => (
                <tr key={record.quizId}>
                  <td>{getModuleLabel(record.module)}</td>
                  <td>{record.quizId.startsWith('prac_') ? '练习' : '闯关'}</td>
                  <td>{record.displayLabel.replace(/^\[.*?\]\s*/, '')}</td>
                  <td>{record.totalCount}</td>
                  <td>{record.wrongCount}</td>
                  <td>{(record.errorRate * 100).toFixed(1) + '%'}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <Pagination currentPage={page} totalPages={totalPages} onPageChange={setPage} />
        </>
      )}
    </div>
  );
}
