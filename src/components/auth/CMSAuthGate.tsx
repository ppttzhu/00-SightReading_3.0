import { Link } from 'react-router-dom';
import { ShieldAlert } from 'lucide-react';
import { useAuth } from '../../core/auth/AuthProvider';

interface CMSAuthGateProps {
  children: React.ReactNode;
}

const localCmsEnabled = import.meta.env.DEV || import.meta.env.VITE_ENABLE_LOCAL_CMS === 'true';

export default function CMSAuthGate({ children }: CMSAuthGateProps) {
  const { user, profile, loading, profileLoading, configured } = useAuth();

  if (loading || profileLoading) {
    return (
      <div className="cms-auth-state">
        <div className="cms-auth-panel">
          <p>正在检查登录状态...</p>
        </div>
      </div>
    );
  }

  if (!configured) {
    if (localCmsEnabled) {
      return (
        <>
          <div className="cms-local-dev-banner">
            教师端临时预览模式：Supabase 尚未配置，当前访问由服务器密码保护；发布会写入阿里云测试数据文件。
          </div>
          {children}
        </>
      );
    }

    return (
      <div className="cms-auth-state">
        <div className="cms-auth-panel">
          <ShieldAlert size={32} />
          <h1>Supabase 尚未配置</h1>
          <p>请先设置 VITE_SUPABASE_URL 和 VITE_SUPABASE_PUBLISHABLE_KEY，然后再进入教师端。</p>
          <Link to="/client">返回学生端</Link>
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="cms-auth-state">
        <div className="cms-auth-panel">
          <ShieldAlert size={32} />
          <h1>请先登录</h1>
          <p>教师端只允许管理员账号访问。</p>
          <Link to="/auth?returnTo=/cms" className="cms-auth-link">登录管理员账号</Link>
          <Link to="/client">返回学生端</Link>
        </div>
      </div>
    );
  }

  if (profile?.role !== 'admin') {
    return (
      <div className="cms-auth-state">
        <div className="cms-auth-panel">
          <ShieldAlert size={32} />
          <h1>没有访问权限</h1>
          <p>当前账号不是管理员。管理员需要在 Supabase 中手动设置。</p>
          <Link to="/client">返回学生端</Link>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
