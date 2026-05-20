import { useEffect, useState, useMemo } from 'react';
import { useAuth } from '../../core/auth/AuthProvider';
import { useAppStore, type PracticeRecord, type UserTypeStats } from '../../core/store/useAppStore';

const MODULE_LABELS: Record<string, string> = { notes: '单音', symbols: '符号', theory: '乐理', patterns: '音型' };
const MODULE_COLORS: Record<string, string> = { notes: '#3b82f6', symbols: '#ec4899', theory: '#8b5cf6', patterns: '#10b981' };

interface StudentData {
  id: string;
  nickname: string;
  typeStats: UserTypeStats[];
  progress: Record<string, number>;
  totalPracticed: number;
  lastActive: string | null;
}

export default function Stats() {
  const { profile } = useAuth();

  const fetchAllProfiles = useAppStore((s) => s.fetchAllProfiles);
  const fetchAllUserTypeStats = useAppStore((s) => s.fetchAllUserTypeStats);
  const fetchAllStudentProgress = useAppStore((s) => s.fetchAllStudentProgress);
  const fetchStudentPracticeRecords = useAppStore((s) => s.fetchStudentPracticeRecords);

  const [students, setStudents] = useState<StudentData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [searchQuery, setSearchQuery] = useState('');

  // detail modal
  const [selectedStudent, setSelectedStudent] = useState<StudentData | null>(null);
  const [records, setRecords] = useState<PracticeRecord[]>([]);
  const [recordsLoading, setRecordsLoading] = useState(false);
  const [recordFilter, setRecordFilter] = useState<'all' | 'wrong'>('all');
  const [recordsOffset, setRecordsOffset] = useState(0);
  const [recordsHasMore, setRecordsHasMore] = useState(true);

  const isAdmin = profile?.role === 'admin';

  // 加载学生列表
  const loadStudents = async () => {
    if (!isAdmin) return;
    setLoading(true);
    setError('');
    try {
      const [profiles, stats, progress] = await Promise.all([
        fetchAllProfiles(),
        fetchAllUserTypeStats(),
        fetchAllStudentProgress(),
      ]);

      const statsByUser = new Map<string, UserTypeStats[]>();
      for (const s of stats) {
        const arr = statsByUser.get(s.userId) || [];
        arr.push(s);
        statsByUser.set(s.userId, arr);
      }

      const progressByUser = new Map<string, Record<string, number>>();
      for (const p of progress) {
        const rec = progressByUser.get(p.userId) || {};
        rec[p.module] = p.unlocked;
        progressByUser.set(p.userId, rec);
      }

      const list: StudentData[] = profiles.map((p) => {
        const ts = statsByUser.get(p.id) || [];
        const prog = progressByUser.get(p.id) || {};
        const lastActive = ts.reduce(
          (latest, s) => (!latest || (s.lastPracticedAt && s.lastPracticedAt > latest) ? (s.lastPracticedAt ?? null) : latest),
          null as string | null,
        );
        const totalPracticed = ts.reduce((sum, s) => sum + s.totalCount, 0);
        return { id: p.id, nickname: p.nickname, typeStats: ts, progress: prog, totalPracticed, lastActive };
      });

      list.sort((a, b) => b.totalPracticed - a.totalPracticed);
      setStudents(list);
    } catch (e: any) {
      setError(e.message || '加载失败');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadStudents();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAdmin]);

  // 学生详情
  const openDetail = async (student: StudentData) => {
    setSelectedStudent(student);
    setRecords([]);
    setRecordsOffset(0);
    setRecordsHasMore(true);
    setRecordFilter('all');
    setRecordsLoading(true);
    try {
      const rows = await fetchStudentPracticeRecords(student.id, { limit: 50, offset: 0 });
      setRecords(rows);
      setRecordsHasMore(rows.length >= 50);
      setRecordsOffset(50);
    } catch (e: any) {
      setError(e.message || '加载记录失败');
    } finally {
      setRecordsLoading(false);
    }
  };

  const loadMoreRecords = async () => {
    if (!selectedStudent || recordsLoading) return;
    setRecordsLoading(true);
    try {
      const rows = await fetchStudentPracticeRecords(selectedStudent.id, {
        isCorrect: recordFilter === 'wrong' ? false : undefined,
        limit: 50,
        offset: recordsOffset,
      });
      setRecords((prev) => [...prev, ...rows]);
      setRecordsHasMore(rows.length >= 50);
      setRecordsOffset((prev) => prev + rows.length);
    } catch (e: any) {
      setError(e.message || '加载失败');
    } finally {
      setRecordsLoading(false);
    }
  };

  const switchFilter = async (filter: 'all' | 'wrong') => {
    if (!selectedStudent) return;
    setRecordFilter(filter);
    setRecords([]);
    setRecordsOffset(0);
    setRecordsHasMore(true);
    setRecordsLoading(true);
    try {
      const rows = await fetchStudentPracticeRecords(selectedStudent.id, {
        isCorrect: filter === 'wrong' ? false : undefined,
        limit: 50,
        offset: 0,
      });
      setRecords(rows);
      setRecordsHasMore(rows.length >= 50);
      setRecordsOffset(50);
    } catch (e: any) {
      setError(e.message || '加载失败');
    } finally {
      setRecordsLoading(false);
    }
  };

  // 聚合统计
  const aggregateByType = useMemo(() => {
    const map: Record<string, { total: number; correct: number; wrong: number }> = {};
    for (const s of students) {
      for (const ts of s.typeStats) {
        const a = map[ts.module] || { total: 0, correct: 0, wrong: 0 };
        a.total += ts.totalCount;
        a.correct += ts.correctCount;
        a.wrong += ts.wrongCount;
        map[ts.module] = a;
      }
    }
    return map;
  }, [students]);

  const filteredStudents = useMemo(() => {
    if (!searchQuery.trim()) return students;
    const q = searchQuery.trim().toLowerCase();
    return students.filter((s) => s.nickname.toLowerCase().includes(q));
  }, [students, searchQuery]);

  // ============================================================
  // 渲染
  // ============================================================

  // 非 admin 显示权限提示
  if (!isAdmin) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', flex: 1 }}>
        <div style={{ textAlign: 'center', color: '#9ca3af' }}>
          <div style={{ fontSize: '3rem', marginBottom: '12px', opacity: 0.4 }}>🔒</div>
          <p style={{ fontSize: '1.1rem', fontWeight: 600, color: '#6b7280' }}>仅管理员可查看</p>
          <p style={{ fontSize: '0.85rem', marginTop: '4px' }}>请使用 admin 账号登录后访问统计面板。</p>
        </div>
      </div>
    );
  }

  // 加载中
  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', flex: 1 }}>
        <div style={{ textAlign: 'center', color: '#9ca3af' }}>
          <div
            style={{
              width: 36, height: 36, borderRadius: '50%', border: '3px solid #e5e7eb',
              borderTopColor: '#3b82f6', margin: '0 auto 12px',
              animation: 'spin 0.8s linear infinite',
            }}
          />
          <p>加载中...</p>
        </div>
      </div>
    );
  }

  // 错误
  if (error) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', flex: 1 }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ padding: '16px 24px', borderRadius: '12px', background: '#fef2f2', border: '1px solid #fecaca', color: '#dc2626', marginBottom: '12px' }}>
            {error}
          </div>
          <button
            onClick={() => loadStudents()}
            style={{ padding: '8px 20px', borderRadius: '8px', border: 'none', background: '#3b82f6', color: 'white', cursor: 'pointer', fontWeight: 600 }}
          >
            重试
          </button>
        </div>
      </div>
    );
  }

  return (
    <div>
      {/* 标题 */}
      <div style={{ marginBottom: '24px', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <h1 style={{ fontSize: '1.8rem', fontWeight: 800, color: '#1f2937', margin: 0, letterSpacing: '-0.5px' }}>学生统计</h1>
          <p style={{ color: '#6b7280', marginTop: '6px', fontSize: '0.9rem' }}>
            查看所有学生的学习进度、答题准确率和练习记录。
          </p>
        </div>
        <button
          onClick={() => loadStudents()}
          style={{
            padding: '8px 16px', borderRadius: '8px', border: '1px solid #e5e7eb', background: 'white',
            color: '#6b7280', cursor: 'pointer', fontSize: '0.85rem', fontWeight: 600,
          }}
        >
          ↻ 刷新
        </button>
      </div>

      {/* 题型概览卡片 */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '15px', marginBottom: '24px' }}>
        {(['A', 'B', 'C', 'D'] as const).map((type) => {
          const agg = aggregateByType[type] || { total: 0, correct: 0, wrong: 0 };
          const pct = agg.total > 0 ? Math.round((agg.correct / agg.total) * 100) : 0;
          return (
            <div
              key={type}
              style={{
                padding: '20px', borderRadius: '12px', background: 'white',
                border: `1px solid ${MODULE_COLORS[type]}20`,
                boxShadow: '0 2px 8px rgba(0,0,0,0.03)',
              }}
            >
              <div style={{ fontSize: '0.85rem', color: '#6b7280', marginBottom: '8px', fontWeight: 600 }}>
                {MODULE_LABELS[type]} <span style={{ fontWeight: 400, color: '#9ca3af' }}>({type})</span>
              </div>
              <div style={{ fontSize: '2rem', fontWeight: 800, color: MODULE_COLORS[type] }}>
                {agg.total}
              </div>
              <div style={{ fontSize: '0.8rem', color: '#6b7280', marginTop: '4px' }}>
                正确率 {pct}% ｜ 正确 {agg.correct} / 错误 {agg.wrong}
              </div>
              <div style={{ marginTop: '8px', height: '4px', background: '#e5e7eb', borderRadius: '2px', overflow: 'hidden' }}>
                <div style={{ width: `${pct}%`, height: '100%', background: MODULE_COLORS[type], borderRadius: '2px', transition: 'width 0.3s ease' }} />
              </div>
            </div>
          );
        })}
      </div>

      {/* 搜索栏 */}
      {students.length > 0 && (
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="按昵称搜索学生..."
          style={{
            padding: '10px 14px', borderRadius: '10px', border: '1px solid #e5e7eb',
            fontSize: '0.9rem', outline: 'none', width: '100%', maxWidth: '320px',
            marginBottom: '16px', color: '#374151',
          }}
        />
      )}

      {/* 学生列表 */}
      {students.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '60px 0', color: '#9ca3af' }}>
          <div style={{ fontSize: '3rem', marginBottom: '12px', opacity: 0.3 }}>📭</div>
          <p style={{ fontWeight: 600, color: '#6b7280', margin: 0 }}>暂无学生练习数据</p>
          <p style={{ fontSize: '0.85rem', marginTop: '6px' }}>学生注册并答题后会出现在这里。</p>
        </div>
      ) : filteredStudents.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '40px 0', color: '#9ca3af' }}>
          <p style={{ fontWeight: 600, color: '#6b7280', margin: 0 }}>未找到匹配的学生</p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {filteredStudents.map((student) => {
            const correctCount = student.typeStats.reduce((s, ts) => s + ts.correctCount, 0);
            const accuracy = student.totalPracticed > 0 ? Math.round((correctCount / student.totalPracticed) * 100) : 0;
            return (
              <div
                key={student.id}
                onClick={() => openDetail(student)}
                style={{
                  padding: '14px 16px', background: 'white', borderRadius: '10px',
                  border: '1px solid #e5e7eb', borderLeft: '4px solid #3b82f6',
                  cursor: 'pointer', boxShadow: '0 1px 3px rgba(0,0,0,0.03)',
                  display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                }}
              >
                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span style={{ fontWeight: 700, color: '#1f2937', fontSize: '1rem' }}>{student.nickname}</span>
                    {student.totalPracticed > 0 && (
                      <span style={{ padding: '1px 6px', borderRadius: '4px', background: '#eff6ff', color: '#3b82f6', fontSize: '0.7rem', fontWeight: 600 }}>
                        正确率 {accuracy}%
                      </span>
                    )}
                  </div>
                  <div style={{ display: 'flex', gap: '6px', marginTop: '4px', flexWrap: 'wrap' }}>
                    {student.typeStats.length > 0 ? (
                      student.typeStats.map((ts) => (
                        <span
                          key={ts.module}
                          style={{
                            padding: '1px 8px', borderRadius: '4px',
                            background: `${MODULE_COLORS[ts.module]}15`,
                            color: MODULE_COLORS[ts.module],
                            fontSize: '0.72rem', fontWeight: 600,
                          }}
                        >
                          {MODULE_LABELS[ts.module]} {ts.totalCount}题
                        </span>
                      ))
                    ) : (
                      <span style={{ fontSize: '0.75rem', color: '#b0b7c3' }}>尚无练习记录</span>
                    )}
                  </div>
                  {/* 解锁进度 */}
                  <div style={{ marginTop: '4px', display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
                    {(['notes', 'symbols', 'theory', 'patterns'] as const).map((mod) => {
                      const unlocked = student.progress[mod] || 1;
                      return (
                        <span key={mod} style={{ fontSize: '0.7rem', color: '#9ca3af' }}>
                          {MODULE_LABELS[mod]}: {unlocked}关
                        </span>
                      );
                    })}
                  </div>
                </div>
                <div style={{ textAlign: 'right', minWidth: '80px' }}>
                  <div style={{ fontSize: '1.3rem', fontWeight: 800, color: '#1f2937' }}>{student.totalPracticed}</div>
                  <div style={{ fontSize: '0.7rem', color: '#9ca3af' }}>
                    {student.lastActive
                      ? new Date(student.lastActive).toLocaleDateString('zh-CN', { month: 'short', day: 'numeric' })
                      : '未练习'}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* 学生详情弹窗 */}
      {selectedStudent && (
        <div
          style={{
            position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.3)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000,
          }}
          onClick={() => { setSelectedStudent(null); setRecords([]); }}
        >
          <div
            style={{
              background: 'white', borderRadius: '16px', padding: '24px',
              maxWidth: '800px', width: '90vw', maxHeight: '85vh', overflow: 'hidden',
              display: 'flex', flexDirection: 'column', boxShadow: '0 20px 60px rgba(0,0,0,0.2)',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* 弹窗标题 */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <div>
                <h3 style={{ margin: 0, fontSize: '1.2rem', color: '#1f2937' }}>{selectedStudent.nickname} 的练习记录</h3>
                {records.length > 0 && (
                  <span style={{ fontSize: '0.8rem', color: '#6b7280' }}>
                    共 {records.length} 条
                  </span>
                )}
              </div>
              <div style={{ display: 'flex', gap: '8px' }}>
                <button
                  onClick={() => switchFilter('all')}
                  style={{
                    padding: '6px 14px', borderRadius: '8px', border: '1px solid #e5e7eb',
                    background: recordFilter === 'all' ? '#3b82f6' : 'white',
                    color: recordFilter === 'all' ? 'white' : '#6b7280',
                    fontSize: '0.8rem', fontWeight: 600, cursor: 'pointer',
                  }}
                >
                  全部
                </button>
                <button
                  onClick={() => switchFilter('wrong')}
                  style={{
                    padding: '6px 14px', borderRadius: '8px', border: '1px solid #e5e7eb',
                    background: recordFilter === 'wrong' ? '#ef4444' : 'white',
                    color: recordFilter === 'wrong' ? 'white' : '#6b7280',
                    fontSize: '0.8rem', fontWeight: 600, cursor: 'pointer',
                  }}
                >
                  仅错题
                </button>
                <button
                  onClick={() => { setSelectedStudent(null); setRecords([]); }}
                  style={{
                    padding: '6px 14px', borderRadius: '8px', border: '1px solid #e5e7eb',
                    background: 'white', color: '#6b7280', fontSize: '0.8rem', fontWeight: 600, cursor: 'pointer',
                  }}
                >
                  关闭
                </button>
              </div>
            </div>

            {/* 记录表格 */}
            <div style={{ flex: 1, overflow: 'auto' }}>
              {records.length === 0 && !recordsLoading ? (
                <div style={{ textAlign: 'center', padding: '40px 0', color: '#9ca3af' }}>
                  <p style={{ margin: 0 }}>该学生暂无{recordFilter === 'wrong' ? '错题' : '练习'}记录</p>
                </div>
              ) : (
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.82rem' }}>
                  <thead>
                    <tr style={{ borderBottom: '2px solid #e5e7eb', textAlign: 'left' }}>
                      <th style={{ padding: '8px 6px', color: '#6b7280', fontWeight: 600 }}>日期</th>
                      <th style={{ padding: '8px 6px', color: '#6b7280', fontWeight: 600 }}>类型</th>
                      <th style={{ padding: '8px 6px', color: '#6b7280', fontWeight: 600 }}>模块</th>
                      <th style={{ padding: '8px 6px', color: '#6b7280', fontWeight: 600 }}>结果</th>
                      <th style={{ padding: '8px 6px', color: '#6b7280', fontWeight: 600 }}>答题用时</th>
                      <th style={{ padding: '8px 6px', color: '#6b7280', fontWeight: 600 }}>分数</th>
                      <th style={{ padding: '8px 6px', color: '#6b7280', fontWeight: 600 }}>错误回答</th>
                    </tr>
                  </thead>
                  <tbody>
                    {records.map((r) => (
                      <tr key={r.id} style={{ borderBottom: '1px solid #f3f4f6' }}>
                        <td style={{ padding: '7px 6px', color: '#6b7280', whiteSpace: 'nowrap' }}>
                          {new Date(r.createdAt).toLocaleString('zh-CN', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                        </td>
                        <td style={{ padding: '7px 6px' }}>
                          <span style={{ padding: '1px 6px', borderRadius: '4px', background: `${MODULE_COLORS[r.module] || '#6b7280'}15`, color: MODULE_COLORS[r.module] || '#6b7280', fontSize: '0.75rem', fontWeight: 600 }}>
                            {MODULE_LABELS[r.module] || r.module}
                          </span>
                        </td>
                        <td style={{ padding: '7px 6px', color: '#6b7280', fontSize: '0.78rem' }}>
                          {MODULE_LABELS[r.module] || r.module}
                        </td>
                        <td style={{ padding: '7px 6px', fontWeight: 600, color: r.isCorrect ? '#10b981' : '#ef4444' }}>
                          {r.isCorrect ? '✅' : '❌'}
                        </td>
                        <td style={{ padding: '7px 6px', color: '#6b7280', fontSize: '0.78rem' }}>
                          {r.timeSpentMs != null ? `${(r.timeSpentMs / 1000).toFixed(1)}s` : '—'}
                        </td>
                        <td style={{ padding: '7px 6px', fontWeight: 600, color: '#1f2937' }}>
                          {r.score ?? '—'}
                        </td>
                        <td style={{ padding: '7px 6px', color: '#ef4444', fontSize: '0.78rem', maxWidth: '120px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {r.answeredWrong || '—'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
              {recordsLoading && (
                <div style={{ textAlign: 'center', padding: '20px', color: '#9ca3af' }}>加载中...</div>
              )}
              {recordsHasMore && !recordsLoading && records.length > 0 && (
                <div style={{ textAlign: 'center', padding: '12px' }}>
                  <button
                    onClick={loadMoreRecords}
                    style={{
                      padding: '8px 20px', borderRadius: '8px', border: '1px solid #e5e7eb',
                      background: 'white', color: '#374151', fontSize: '0.85rem', fontWeight: 600, cursor: 'pointer',
                    }}
                  >
                    加载更多
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* 旋转动画 keyframe */}
      <style>{`
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}
