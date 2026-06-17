import { useState, useEffect, useCallback, useRef } from 'react';
import { useAuth } from '../core/auth/AuthProvider';
import { supabase } from '../core/auth/supabaseClient';

export type SortBy = 'hot' | 'new';

export interface CommentNode {
  id: string;
  stageId: string;
  userId: string;
  userNickname: string;
  content: string;
  parentId: string | null;
  likeCount: number;
  isLiked: boolean;
  createdAt: string;
  replies: CommentNode[];
}

interface DbComment {
  id: string;
  stage_id: string;
  user_id: string;
  user_nickname: string;
  content: string;
  parent_id: string | null;
  like_count: number;
  created_at: string;
}

interface DbLike {
  comment_id: string;
}

const PAGE_SIZE = 10;

/** 递归在评论树中找到目标节点并更新 */
function updateCommentInTree(tree: CommentNode[], id: string, updater: (n: CommentNode) => CommentNode): CommentNode[] {
  return tree.map(n => {
    if (n.id === id) return updater(n);
    if (n.replies.length > 0) {
      return { ...n, replies: updateCommentInTree(n.replies, id, updater) };
    }
    return n;
  });
}

interface UseStageCommentsResult {
  comments: CommentNode[];
  loading: boolean;
  loadingMore: boolean;
  error: string | null;
  hasMore: boolean;
  sortBy: SortBy;
  setSortBy: (sort: SortBy) => void;
  loadMore: () => void;
  submitComment: (content: string, parentId?: string) => Promise<boolean>;
  deleteComment: (id: string) => Promise<boolean>;
  toggleLike: (commentId: string, isLiked: boolean) => Promise<boolean>;
  retry: () => void;
}

function buildTree(flat: DbComment[], likedIds: Set<string>): CommentNode[] {
  const map = new Map<string, CommentNode>();

  for (const c of flat) {
    map.set(c.id, {
      id: c.id,
      stageId: c.stage_id,
      userId: c.user_id,
      userNickname: c.user_nickname,
      content: c.content,
      parentId: c.parent_id,
      likeCount: c.like_count,
      isLiked: likedIds.has(c.id),
      createdAt: c.created_at,
      replies: [],
    });
  }

  const roots: CommentNode[] = [];
  for (const node of map.values()) {
    if (node.parentId && map.has(node.parentId)) {
      map.get(node.parentId)!.replies.push(node);
    } else if (!node.parentId) {
      roots.push(node);
    }
  }

  for (const node of map.values()) {
    node.replies.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
  }

  return roots;
}

export function useStageComments(stageId: string): UseStageCommentsResult {
  const { user, profile } = useAuth();
  const [sortBy, setSortByState] = useState<SortBy>('hot');
  const [comments, setComments] = useState<CommentNode[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fetchKey, setFetchKey] = useState(0);
  const offsetRef = useRef(0);
  const totalRootCountRef = useRef(0);
  const sortByRef = useRef(sortBy);
  const cacheRef = useRef<Map<SortBy, { comments: CommentNode[]; totalCount: number }>>(new Map());
  const commentsRef = useRef<CommentNode[]>([]);
  const likePendingRef = useRef(false);
  // 每次渲染同步 ref，用于乐观更新回滚
  commentsRef.current = comments;

  const purgeCache = useCallback(() => {
    cacheRef.current.clear();
  }, []);

  const setSortBy = useCallback((sort: SortBy) => {
    if (sort === sortByRef.current) return; // 相同排序，忽略
    sortByRef.current = sort;
    offsetRef.current = 0;
    totalRootCountRef.current = 0;

    // 命中缓存 → 立即渲染，后续静默刷新
    const cached = cacheRef.current.get(sort);
    if (cached) {
      setComments(cached.comments);
      totalRootCountRef.current = cached.totalCount;
      setLoading(false);
      setError(null);
    }

    setSortByState(sort);
    setFetchKey(k => k + 1);
  }, []);

  const fetchData = useCallback(async (isLoadMore: boolean) => {
    if (!supabase || !user) {
      setComments([]);
      setLoading(false);
      setLoadingMore(false);
      return;
    }

    // 首屏有缓存 → 静默刷新（不显示 loading）
    const hasCached = !isLoadMore && cacheRef.current.has(sortByRef.current);
    if (isLoadMore) {
      setLoadingMore(true);
    } else if (!hasCached) {
      setLoading(true);
    }
    setError(null);

    const currentSort = sortByRef.current;
    const offset = offsetRef.current;

    try {
      // 1. 获取主评论总数（判断 hasMore）
      const { count: totalCount, error: countErr } = await supabase
        .from('stage_comment')
        .select('id', { count: 'exact', head: true })
        .eq('stage_id', stageId)
        .is('parent_id', null);

      if (countErr) throw new Error(countErr.message);
      totalRootCountRef.current = totalCount ?? 0;

      // 2. 取一页主评论的 ID
      const orderCol = currentSort === 'hot' ? 'like_count' : 'created_at';
      const { data: rootData, error: rootErr } = await supabase
        .from('stage_comment')
        .select('id')
        .eq('stage_id', stageId)
        .is('parent_id', null)
        .order(orderCol, { ascending: false })
        .range(offset, offset + PAGE_SIZE - 1);

      if (rootErr) throw new Error(rootErr.message);

      const rootIds = (rootData as { id: string }[]).map(r => r.id);
      if (rootIds.length === 0) {
        if (!isLoadMore) setComments([]);
        setLoading(false);
        setLoadingMore(false);
        return;
      }

      // 3. 查这页主评论 + 该关卡所有回复（任意层级，支持嵌套）
      const { data: rootsData, error: rootsErr } = await supabase
        .from('stage_comment')
        .select('*')
        .in('id', rootIds);
      if (rootsErr) throw new Error(rootsErr.message);

      const { data: repliesData, error: repliesErr } = await supabase
        .from('stage_comment')
        .select('*')
        .eq('stage_id', stageId)
        .not('parent_id', 'is', null);
      if (repliesErr) throw new Error(repliesErr.message);

      const allData = [...(rootsData as DbComment[] || []), ...(repliesData as DbComment[] || [])];
      const ids = allData.map(c => c.id);

      // 4. 查点赞状态
      const likedSet = new Set<string>();
      if (ids.length > 0) {
        const { data: likesRaw } = await supabase
          .from('comment_like')
          .select('comment_id')
          .eq('user_id', user.id)
          .in('comment_id', ids);

        if (likesRaw) {
          for (const l of likesRaw as DbLike[]) likedSet.add(l.comment_id);
        }
      }

      const tree = buildTree(allData, likedSet);

      if (isLoadMore) {
        setComments(prev => [...prev, ...tree]);
      } else {
        // 缓存第一页，下次切换直接出
        cacheRef.current.set(currentSort, { comments: tree, totalCount: totalRootCountRef.current });
        setComments(tree);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : '评论加载失败');
      if (!isLoadMore && !hasCached) {
        setComments([]);
      }
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  }, [supabase, user, stageId]);

  useEffect(() => {
    offsetRef.current = 0;
    totalRootCountRef.current = 0;
    fetchData(false);
  }, [fetchData, fetchKey]);

  const loadMore = useCallback(() => {
    offsetRef.current += PAGE_SIZE;
    fetchData(true);
  }, [fetchData]);

  const hasMore = comments.length < totalRootCountRef.current;

  const submitComment = useCallback(async (content: string, parentId?: string): Promise<boolean> => {
    if (!supabase || !user || !profile) return false;
    if (!content.trim() || content.trim().length > 500) return false;

    const { error: insertErr } = await supabase
      .from('stage_comment')
      .insert({
        stage_id: stageId,
        user_id: user.id,
        user_nickname: profile.nickname,
        content: content.trim(),
        parent_id: parentId || null,
      });

    if (insertErr) return false;
    purgeCache();
    offsetRef.current = 0;
    totalRootCountRef.current = 0;
    setFetchKey(k => k + 1);
    return true;
  }, [supabase, user, profile, stageId, purgeCache]);

  const deleteComment = useCallback(async (id: string): Promise<boolean> => {
    if (!supabase) return false;

    const { error } = await supabase
      .from('stage_comment')
      .delete()
      .eq('id', id);

    if (error) return false;
    purgeCache();
    offsetRef.current = 0;
    totalRootCountRef.current = 0;
    setFetchKey(k => k + 1);
    return true;
  }, [supabase, purgeCache]);

  const toggleLike = useCallback(async (commentId: string, isLiked: boolean): Promise<boolean> => {
    if (!supabase || !user) return false;
    if (likePendingRef.current) return false;
    likePendingRef.current = true;

    // 乐观更新：先改 UI，再发请求
    const snapshot = commentsRef.current;
    const newLiked = !isLiked;
    const updateFn = (n: CommentNode) => ({
      ...n,
      isLiked: newLiked,
      likeCount: n.likeCount + (newLiked ? 1 : -1),
    });

    setComments(prev => updateCommentInTree(prev, commentId, updateFn));

    try {
      const { error } = newLiked
        ? await supabase.from('comment_like').insert({ comment_id: commentId, user_id: user.id })
        : await supabase.from('comment_like').delete().eq('comment_id', commentId).eq('user_id', user.id);

      if (error) {
        // 请求失败，回滚
        setComments(snapshot);
        return false;
      }
    } finally {
      likePendingRef.current = false;
    }

    // 同步缓存，保持跨排序一致性
    cacheRef.current.forEach(entry => {
      entry.comments = updateCommentInTree(entry.comments, commentId, updateFn);
    });
    return true;
  }, [supabase, user]);

  const retry = useCallback(() => {
    offsetRef.current = 0;
    totalRootCountRef.current = 0;
    setFetchKey(k => k + 1);
  }, []);

  return { comments, loading, loadingMore, error, hasMore, sortBy, setSortBy, loadMore, submitComment, deleteComment, toggleLike, retry };
}

export function useCommentCounts(stageIds: string[]) {
  const [counts, setCounts] = useState<Map<string, number>>(new Map());
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!supabase || stageIds.length === 0) {
      setCounts(new Map());
      setLoading(false);
      return;
    }

    let cancelled = false;
    setLoading(true);

    supabase
      .from('stage_comment')
      .select('stage_id')
      .in('stage_id', stageIds)
      .then(({ data }) => {
        if (cancelled) return;
        const map = new Map<string, number>();
        if (data) {
          for (const row of data as { stage_id: string }[]) {
            map.set(row.stage_id, (map.get(row.stage_id) || 0) + 1);
          }
        }
        setCounts(map);
        setLoading(false);
      });

    return () => { cancelled = true; };
  }, [supabase, stageIds.join(',')]);

  return { counts, loading };
}
