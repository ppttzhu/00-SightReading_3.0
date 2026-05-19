import { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { LogIn, LogOut, UserCircle } from 'lucide-react';
import { useAuth } from '../../core/auth/AuthProvider';

export default function AccountMenu() {
  const { user, profile, loading, profileLoading, signOut } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [signOutError, setSignOutError] = useState('');

  const handleSignOut = async () => {
    setSignOutError('');
    try {
      await signOut();
    } catch (error) {
      setSignOutError(error instanceof Error ? error.message : '退出失败，请稍后再试。');
    }
  };

  const handleLogin = () => {
    navigate(`/auth?returnTo=${encodeURIComponent(location.pathname)}`);
  };

  if (loading || profileLoading) {
    return <span className="account-loading">账号加载中...</span>;
  }

  if (!user) {
    return (
      <button type="button" className="account-button" onClick={handleLogin}>
        <LogIn size={16} /> 登录 / 注册
      </button>
    );
  }

  return (
    <div className="account-menu">
      <span className="account-chip">
        <UserCircle size={16} />
        {profile?.nickname || user.email || '已登录'}
      </span>
      <button type="button" className="account-icon-button" onClick={handleSignOut} aria-label="退出登录" title="退出登录">
        <LogOut size={16} />
      </button>
      {signOutError && <span className="account-error">{signOutError}</span>}
    </div>
  );
}
