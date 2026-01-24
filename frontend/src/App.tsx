import { Routes, Route, Navigate } from 'react-router-dom';

import { MainLayout } from './components/layout/MainLayout';
import { HomePage } from './features/home/HomePage';
import { SessionPage } from './features/sessions/SessionPage';
import { NotesPage } from './features/notes/NotesPage';

function App() {
  return (
    <Routes>
      <Route path="/" element={<MainLayout />}>
        <Route index element={<HomePage />} />
        <Route path="session/:sessionId" element={<SessionPage />} />
        <Route path="session/:sessionId/notes" element={<NotesPage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  );
}

export default App;
