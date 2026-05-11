import { Outlet, Link } from 'react-router-dom';

export default function CMSLayout() {
  return (
    <div className="cms-layout" style={{ display: 'flex', minHeight: '100vh', fontFamily: 'system-ui, sans-serif' }}>
      <aside style={{ width: '250px', background: '#f4f4f5', padding: '20px', borderRight: '1px solid #e4e4e7' }}>
        <h2 style={{ fontSize: '1.2rem', marginBottom: '20px', color: '#18181b' }}>智能教研引擎</h2>
        <nav style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          <Link to="/cms" style={{ textDecoration: 'none', color: '#3f3f46', padding: '8px', borderRadius: '4px' }}>总览</Link>
          <Link to="/cms/parser" style={{ textDecoration: 'none', color: '#3f3f46', padding: '8px', borderRadius: '4px' }}>文件解析器</Link>
          <Link to="/cms/creator" style={{ textDecoration: 'none', color: '#3f3f46', padding: '8px', borderRadius: '4px' }}>手动出题器</Link>
          <Link to="/cms/builder" style={{ textDecoration: 'none', color: '#3f3f46', padding: '8px', borderRadius: '4px' }}>题库管理</Link>
          <Link to="/cms/stages" style={{ textDecoration: 'none', color: '#7c3aed', padding: '8px', borderRadius: '4px', fontWeight: 600 }}>关卡编排 ✨</Link>
        </nav>
      </aside>
      <main style={{ flex: 1, padding: '40px', background: '#ffffff' }}>
        <Outlet />
      </main>
    </div>
  );
}
