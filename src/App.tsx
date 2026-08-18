import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import CMSLayout from './pages/cms/CMSLayout';
import ClientLayout from './pages/client/ClientLayout';
import Dashboard from './pages/cms/Dashboard';
import UploadParser from './pages/cms/UploadParser';
import StageBuilder from './pages/cms/StageBuilder';
import ManualCreator from './pages/cms/ManualCreator';
import CustomStageEditor from './pages/cms/CustomStageEditor';
import FeedbackManager from './pages/cms/FeedbackManager';
import AdventureEditor from './pages/cms/AdventureEditor';
import Stats from './pages/cms/Stats';
import AllowlistPage from './pages/cms/AllowlistPage';
import MainMenu from './pages/client/MainMenu';
import StageSelector from './pages/client/StageSelector';
import InteractiveQuiz from './pages/client/InteractiveQuiz';
import PracticeQuiz from './pages/client/PracticeQuiz';
import IntervalPractice from './pages/client/IntervalPractice';
import ChordPractice from './pages/client/ChordPractice';
import ProgressionPractice from './pages/client/ProgressionPractice';
import ProfilePage from './pages/client/ProfilePage';
import AdventureMap from './pages/client/AdventureMap';
import FreePracticeHub from './pages/client/FreePracticeHub';
import CMSAuthGate from './components/auth/CMSAuthGate';
import AuthPage from './pages/auth/AuthPage';

function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* 默认重定向到学生端 */}
        <Route path="/" element={<Navigate to="/client" replace />} />

        {/* 登录/注册页面 */}
        <Route path="/auth" element={<AuthPage />} />

        {/* 学生端 (Client) 路由 */}
        <Route path="/client" element={<ClientLayout />}>
          <Route index element={<MainMenu />} />
          <Route path="adventure" element={<AdventureMap />} />
          <Route path="adventure/quiz/:stageId" element={<InteractiveQuiz />} />
          <Route path="free" element={<FreePracticeHub />} />
          <Route path="free/:moduleId" element={<StageSelector />} />
          <Route path="quiz/:stageId" element={<InteractiveQuiz />} />
          <Route path="practice/intervals" element={<IntervalPractice />} />
          <Route path="practice/chords" element={<ChordPractice />} />
          <Route path="practice/progression" element={<ProgressionPractice />} />
          <Route path="practice/:moduleId" element={<PracticeQuiz />} />
          <Route path="profile" element={<Navigate to="/client/profile/ranking" replace />} />
          <Route path="profile/ranking" element={<ProfilePage />} />
          <Route path="profile/record" element={<ProfilePage />} />
        </Route>

        {/* 教师端 (CMS) 路由 */}
        <Route path="/cms" element={<CMSAuthGate><CMSLayout /></CMSAuthGate>}>
          <Route index element={<Dashboard />} />
          <Route path="parser" element={<UploadParser />} />
          <Route path="builder" element={<StageBuilder />} />
          <Route path="creator" element={<ManualCreator />} />
          <Route path="stages" element={<CustomStageEditor />} />
          <Route path="adventure" element={<AdventureEditor />} />
          <Route path="feedback" element={<FeedbackManager />} />
          <Route path="stats" element={<Stats />} />
          <Route path="allowlist" element={<AllowlistPage />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}

export default App;
