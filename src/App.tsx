import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import CMSLayout from './pages/cms/CMSLayout';
import ClientLayout from './pages/client/ClientLayout';
import Dashboard from './pages/cms/Dashboard';
import UploadParser from './pages/cms/UploadParser';
import StageBuilder from './pages/cms/StageBuilder';
import ManualCreator from './pages/cms/ManualCreator';
import CustomStageEditor from './pages/cms/CustomStageEditor';
import FeedbackManager from './pages/cms/FeedbackManager';
import MainMenu from './pages/client/MainMenu';
import StageSelector from './pages/client/StageSelector';
import InteractiveQuiz from './pages/client/InteractiveQuiz';

function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* 默认重定向到学生端 */}
        <Route path="/" element={<Navigate to="/client" replace />} />

        {/* 学生端 (Client) 路由 */}
        <Route path="/client" element={<ClientLayout />}>
          <Route index element={<MainMenu />} />
          <Route path="module/:moduleId" element={<StageSelector />} />
          <Route path="quiz/:stageId" element={<InteractiveQuiz />} />
        </Route>

        {/* 教师端 (CMS) 路由 */}
        <Route path="/cms" element={<CMSLayout />}>
          <Route index element={<Dashboard />} />
          <Route path="parser" element={<UploadParser />} />
          <Route path="builder" element={<StageBuilder />} />
          <Route path="creator" element={<ManualCreator />} />
          <Route path="stages" element={<CustomStageEditor />} />
          <Route path="feedback" element={<FeedbackManager />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}

export default App;
