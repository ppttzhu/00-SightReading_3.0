import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams, Link } from 'react-router-dom';
import { LogIn, UserPlus, ArrowLeft, KeyRound } from 'lucide-react';
import { useAuth } from '../../core/auth/AuthProvider';

type Mode = 'login' | 'register' | 'forgot' | 'reset';

export default function AuthPage() {
  const { signIn, signUp, resetPassword, updatePassword, configured, user } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const paramMode = searchParams.get('mode');
  const returnTo = searchParams.get('returnTo') || '/client';

  function getInitialMode(): Mode {
    if (paramMode === 'register') return 'register';
    if (paramMode === 'forgot') return 'forgot';
    if (paramMode === 'reset') return 'reset';
    return 'login';
  }

  const [mode, setMode] = useState<Mode>(getInitialMode);
  const [identifier, setIdentifier] = useState('');
  const [nickname, setNickname] = useState('');
  const [password, setPassword] = useState('');
  const [status, setStatus] = useState<'idle' | 'submitting' | 'success'>('idle');
  const [message, setMessage] = useState('');

  // If already logged in and not resetting password, redirect away
  useEffect(() => {
    if (user && mode !== 'reset') {
      navigate(returnTo, { replace: true });
    }
  }, [user, navigate, returnTo, mode]);

  const isRegister = mode === 'register';
  const isForgot = mode === 'forgot';
  const isReset = mode === 'reset';

  const canSubmit = (() => {
    if (isForgot) return identifier.trim().length > 0;
    if (isReset) return password.length > 0;
    return identifier.trim() && password && (!isRegister || nickname.trim());
  })();

  const resetMessage = () => {
    setStatus('idle');
    setMessage('');
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!canSubmit || status === 'submitting') return;

    setStatus('submitting');
    setMessage('');
    try {
      if (isForgot) {
        await resetPassword(identifier);
        setStatus('success');
        setMessage('重置链接已发送到你的邮箱，请查收。');
      } else if (isReset) {
        await updatePassword(password);
        setStatus('success');
        setMessage('密码已更新，正在跳转...');
        window.setTimeout(() => navigate(returnTo, { replace: true }), 700);
      } else if (isRegister) {
        const result = await signUp({ email: identifier, password, nickname });
        setStatus('success');
        if (result.needsConfirmation) {
          setMessage('注册成功，请按提示完成验证后登录。');
        } else {
          setMessage('注册成功，正在跳转...');
          window.setTimeout(() => navigate(returnTo, { replace: true }), 700);
        }
      } else {
        await signIn(identifier, password);
        setStatus('success');
        setMessage('登录成功，正在跳转...');
        window.setTimeout(() => navigate(returnTo, { replace: true }), 500);
      }
    } catch (error) {
      setStatus('idle');
      setMessage(error instanceof Error ? error.message : '操作失败，请稍后再试。');
    }
  };

  const title = (() => {
    if (isForgot) return '找回密码';
    if (isReset) return '设置新密码';
    if (isRegister) return '注册账号';
    return '登录账号';
  })();

  const subtitle = (() => {
    if (isForgot) return '输入注册时使用的邮箱，我们会发送重置链接。';
    if (isReset) return '请输入你的新密码。';
    if (isRegister) return '创建学生账号，之后可用于保存学习资料。';
    return '登录后可进入你的账号。';
  })();

  return (
    <div className="auth-page">
      <div className="auth-page-card">
        <div className="auth-page-header">
          <Link to={returnTo} className="auth-back-link">
            <ArrowLeft size={18} /> 返回
          </Link>
          <h1>{title}</h1>
          <p>{subtitle}</p>
        </div>

        {!configured && (
          <div className="auth-warning">
            Supabase 尚未配置，请先设置 VITE_SUPABASE_URL 和 VITE_SUPABASE_PUBLISHABLE_KEY。
          </div>
        )}

        {/* Tabs: only show for login/register modes */}
        {!isForgot && !isReset && (
          <div className="auth-tabs">
            <button
              type="button"
              className={mode === 'login' ? 'active' : ''}
              onClick={() => { setMode('login'); resetMessage(); }}
            >
              <LogIn size={16} /> 登录
            </button>
            <button
              type="button"
              className={mode === 'register' ? 'active' : ''}
              onClick={() => { setMode('register'); resetMessage(); }}
            >
              <UserPlus size={16} /> 注册
            </button>
          </div>
        )}

        <form onSubmit={handleSubmit}>
          {/* Forgot password: email only */}
          {isForgot && (
            <label className="auth-field">
              <span>注册邮箱</span>
              <input
                value={identifier}
                onChange={(event) => setIdentifier(event.target.value)}
                placeholder="name@example.com"
                autoComplete="email"
                type="email"
              />
            </label>
          )}

          {/* Reset password: new password only */}
          {isReset && (
            <label className="auth-field">
              <span>新密码</span>
              <input
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                placeholder="请输入新密码"
                autoComplete="new-password"
              />
            </label>
          )}

          {/* Login / Register: email + password */}
          {!isForgot && !isReset && (
            <>
              <label className="auth-field">
                <span>邮箱</span>
                <input
                  value={identifier}
                  onChange={(event) => setIdentifier(event.target.value)}
                  placeholder="name@example.com"
                  autoComplete="email"
                  type="email"
                />
              </label>

              {isRegister && (
                <label className="auth-field">
                  <span>昵称</span>
                  <input
                    value={nickname}
                    onChange={(event) => setNickname(event.target.value)}
                    placeholder="想让大家怎么称呼你"
                    autoComplete="nickname"
                  />
                </label>
              )}

              <label className="auth-field">
                <span>密码</span>
                <input
                  type="password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  placeholder="请输入密码"
                  autoComplete={isRegister ? 'new-password' : 'current-password'}
                />
              </label>
            </>
          )}

          {message && (
            <p className={status === 'success' ? 'auth-message success' : 'auth-message'}>
              {message}
            </p>
          )}

          <button type="submit" className="auth-submit" disabled={!canSubmit || status === 'submitting' || !configured}>
            {status === 'submitting' ? '处理中...' : isForgot ? '发送重置链接' : isReset ? '确认修改' : isRegister ? '注册' : '登录'}
          </button>

          {/* Forgot password link (only on login mode) */}
          {mode === 'login' && (
            <button
              type="button"
              className="auth-forgot-link"
              onClick={() => { setMode('forgot'); resetMessage(); }}
            >
              <KeyRound size={14} /> 忘记密码？
            </button>
          )}

          {/* Back to login (from forgot mode) */}
          {isForgot && (
            <button
              type="button"
              className="auth-forgot-link"
              onClick={() => { setMode('login'); resetMessage(); }}
            >
              <ArrowLeft size={14} /> 返回登录
            </button>
          )}
        </form>
      </div>
    </div>
  );
}
