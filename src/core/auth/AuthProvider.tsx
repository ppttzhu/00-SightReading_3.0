import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import type { Session, User } from '@supabase/supabase-js';
import { isSupabaseConfigured, supabase } from './supabaseClient';

export type AppRole = 'student' | 'admin';

export interface Profile {
  id: string;
  nickname: string;
  role: AppRole;
}

interface AuthContextValue {
  session: Session | null;
  user: User | null;
  profile: Profile | null;
  loading: boolean;
  profileLoading: boolean;
  configured: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (params: { email: string; password: string; nickname: string }) => Promise<{ needsConfirmation: boolean }>;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
  resetPassword: (email: string, redirectTo?: string) => Promise<void>;
  updatePassword: (newPassword: string) => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

function getChineseAuthError(message: string) {
  const lower = message.toLowerCase();
  if (lower.includes('invalid login credentials')) return '邮箱或密码不正确。';
  if (lower.includes('email not confirmed')) return '请先完成邮箱验证后再登录。';
  if (lower.includes('user already registered')) return '这个邮箱已经注册过了，请直接登录。';
  if (lower.includes('password')) return `密码无法使用：${message}`;
  return message || '认证失败，请稍后再试。';
}

async function fetchProfile(userId: string): Promise<Profile | null> {
  if (!supabase) return null;
  const { data, error } = await supabase
    .from('profiles')
    .select('id,nickname,role')
    .eq('id', userId)
    .maybeSingle();

  if (error) throw new Error(getChineseAuthError(error.message));
  return data as Profile | null;
}

async function upsertStudentProfile(userId: string, nickname: string) {
  if (!supabase) return;
  const trimmedNickname = nickname.trim();
  const { error } = await supabase
    .from('profiles')
    .upsert(
      { id: userId, nickname: trimmedNickname, role: 'student' satisfies AppRole },
      { onConflict: 'id' },
    );

  if (error) throw new Error(getChineseAuthError(error.message));
}

async function validateAllowlist(nickname: string): Promise<void> {
  if (!supabase) throw new Error('Supabase 尚未配置。');

  const { data, error } = await supabase
    .from('allowlist')
    .select('id, nickname, profile_id')
    .eq('nickname', nickname)
    .maybeSingle();

  if (error) throw new Error('允许列表查询失败，请稍后再试。');
  if (!data) throw new Error('您还不是学员，请联系睿涵老师。');
  if (data.profile_id) throw new Error('该昵称已被注册，请联系睿涵老师。');
}

async function linkProfileToAllowlist(profileId: string, nickname: string, email: string): Promise<void> {
  if (!supabase) return;
  await supabase
    .from('allowlist')
    .update({ profile_id: profileId, email, registered_at: new Date().toISOString() })
    .eq('nickname', nickname);
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [profileLoading, setProfileLoading] = useState(false);

  const refreshProfile = useCallback(async () => {
    if (!supabase || !session?.user) {
      setProfile(null);
      return;
    }

    setProfileLoading(true);
    try {
      setProfile(await fetchProfile(session.user.id));
    } finally {
      setProfileLoading(false);
    }
  }, [session?.user]);

  useEffect(() => {
    if (!supabase) {
      setLoading(false);
      return;
    }

    let mounted = true;
    supabase.auth.getSession().then(({ data }) => {
      if (!mounted) return;
      setSession(data.session);
      setLoading(false);
    });

    const { data: listener } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession);
      if (!nextSession) setProfile(null);
    });

    return () => {
      mounted = false;
      listener.subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    refreshProfile().catch((error) => {
      console.error('[AuthProvider] Failed to refresh profile:', error);
      setProfile(null);
    });
  }, [refreshProfile]);

  const signIn = useCallback(async (email: string, password: string) => {
    if (!supabase) throw new Error('Supabase 尚未配置，请先设置环境变量。');
    const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
    if (error) throw new Error(getChineseAuthError(error.message));
  }, []);

  const signUp = useCallback(async ({ email, password, nickname }: { email: string; password: string; nickname: string }) => {
    if (!supabase) throw new Error('Supabase 尚未配置，请先设置环境变量。');
    const trimmedEmail = email.trim();
    const trimmedNickname = nickname.trim();

    // Validate against allowlist BEFORE auth
    await validateAllowlist(trimmedNickname);

    const options = { data: { nickname: trimmedNickname, role: 'student' } };

    const { data, error } = await supabase.auth.signUp({ email: trimmedEmail, password, options });
    if (error) throw new Error(getChineseAuthError(error.message));

    if (data.user && data.session) {
      await upsertStudentProfile(data.user.id, trimmedNickname);
      await linkProfileToAllowlist(data.user.id, trimmedNickname, trimmedEmail);
      setProfile(await fetchProfile(data.user.id));
    }

    return { needsConfirmation: Boolean(data.user && !data.session) };
  }, []);

  const signOut = useCallback(async () => {
    if (!supabase) return;
    const { error } = await supabase.auth.signOut();
    if (error) throw new Error(getChineseAuthError(error.message));
    setProfile(null);
  }, []);

  const resetPassword = useCallback(async (email: string, redirectTo?: string) => {
    if (!supabase) throw new Error('Supabase 尚未配置，请先设置环境变量。');
    const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
      redirectTo: redirectTo || `${window.location.origin}/auth?mode=reset`,
    });
    if (error) throw new Error(getChineseAuthError(error.message));
  }, []);

  const updatePassword = useCallback(async (newPassword: string) => {
    if (!supabase) throw new Error('Supabase 尚未配置，请先设置环境变量。');
    const { error } = await supabase.auth.updateUser({ password: newPassword });
    if (error) throw new Error(getChineseAuthError(error.message));
  }, []);

  const value = useMemo<AuthContextValue>(() => ({
    session,
    user: session?.user ?? null,
    profile,
    loading,
    profileLoading,
    configured: isSupabaseConfigured,
    signIn,
    signUp,
    signOut,
    refreshProfile,
    resetPassword,
    updatePassword,
  }), [loading, profile, profileLoading, refreshProfile, session, signIn, signOut, signUp, resetPassword, updatePassword]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used inside AuthProvider');
  return context;
}
