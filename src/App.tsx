import { Navigate, Route, Routes } from 'react-router-dom';
import type { ReactNode } from 'react';
import { useAuth } from './auth';
import { Loading } from './components/ui';
import StudentLayout from './components/StudentLayout';
import AdminLayout from './components/AdminLayout';
import Login from './pages/Login';
import Home from './pages/Home';
import Learn from './pages/Learn';
import LessonPage from './pages/LessonPage';
import HangeulLab from './pages/HangeulLab';
import SpeakPage from './pages/SpeakPage';
import TalkPage from './pages/TalkPage';
import DramaList from './pages/DramaList';
import DramaPlayer from './pages/DramaPlayer';
import MyProgress from './pages/MyProgress';
import AdminDashboard from './pages/admin/AdminDashboard';
import AdminStudents from './pages/admin/AdminStudents';
import AdminStudentDetail from './pages/admin/AdminStudentDetail';
import AdminContent from './pages/admin/AdminContent';
import AdminLessonEditor from './pages/admin/AdminLessonEditor';
import AdminVideos from './pages/admin/AdminVideos';
import AdminVideoEditor from './pages/admin/AdminVideoEditor';
import AdminSettings from './pages/admin/AdminSettings';

function RequireRole({ role, children }: { role: 'student' | 'admin'; children: ReactNode }) {
  const auth = useAuth();
  if (auth.loading) return <Loading />;
  if (auth.role !== role) return <Navigate to="/login" replace />;
  return <>{children}</>;
}

export default function App() {
  const auth = useAuth();
  if (auth.loading) return <Loading />;
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route
        element={
          <RequireRole role="student">
            <StudentLayout />
          </RequireRole>
        }
      >
        <Route path="/home" element={<Home />} />
        <Route path="/learn" element={<Learn />} />
        <Route path="/lesson/:id" element={<LessonPage />} />
        <Route path="/hangeul" element={<HangeulLab />} />
        <Route path="/speak" element={<SpeakPage />} />
        <Route path="/talk" element={<TalkPage />} />
        <Route path="/drama" element={<DramaList />} />
        <Route path="/drama/:id" element={<DramaPlayer />} />
        <Route path="/me" element={<MyProgress />} />
      </Route>
      <Route
        path="/admin"
        element={
          <RequireRole role="admin">
            <AdminLayout />
          </RequireRole>
        }
      >
        <Route index element={<AdminDashboard />} />
        <Route path="students" element={<AdminStudents />} />
        <Route path="students/:id" element={<AdminStudentDetail />} />
        <Route path="content" element={<AdminContent />} />
        <Route path="lessons/:id" element={<AdminLessonEditor />} />
        <Route path="videos" element={<AdminVideos />} />
        <Route path="videos/:id" element={<AdminVideoEditor />} />
        <Route path="settings" element={<AdminSettings />} />
      </Route>
      <Route path="*" element={<Navigate to={auth.role === 'admin' ? '/admin' : auth.role === 'student' ? '/home' : '/login'} replace />} />
    </Routes>
  );
}
