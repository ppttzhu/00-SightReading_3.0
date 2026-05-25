import { Link, useNavigate, useLocation } from 'react-router-dom';
import { LogIn, Trophy, Loader2 } from 'lucide-react';
import { useAuth } from '../../core/auth/AuthProvider';

export default function AccountMenu() {
  const { user, profile, loading, profileLoading } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const handleLogin = () => {
    navigate(`/auth?returnTo=${encodeURIComponent(location.pathname)}`);
  };

  if (loading || profileLoading) {
    return <Loader2 size={18} className="spin-icon" />;
  }

  if (!user) {
    return (
      <button type="button" className="account-button" onClick={handleLogin}>
        <LogIn size={16} /> 登录 / 注册
      </button>
    );
  }

  const isProfilePage = location.pathname === '/client/profile';

  return (
    <Link to="/client/profile" className={`account-chip${isProfilePage ? ' hide-on-mobile' : ''}`} style={{ textDecoration: 'none' }}>
      <Trophy size={16} />
      <span className="account-chip-text">{profile?.nickname || user.email || '已登录'}</span>
    </Link>
  );
}
