import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { Providers } from "./app/providers";
import Layout from './app/layout';
import BrowsePage from './app/browse/page';
import LibraryPage from './app/library/page';
import MangaPage from './app/manga/page';
import ReaderPage from './app/reader/page';
import SourcesPage from './app/sources/page';
import DownloadsPage from './app/downloads/page';
import UpdatesPage from './app/updates/page';
import SettingsPage from './app/settings/page';
import CategoriesPage from './components/CategoriesPage';
import HistoryPage from './components/HistoryPage';
import TrackerCallbackPage from './app/tracker/callback/page';

// Pages that should have AppFrame (sidebar navigation)
const PagesWithAppFrame = () => (
  <Layout>
    <Routes>
      <Route path="/" element={<Navigate to="/browse" replace />} />
      <Route path="/browse" element={<BrowsePage />} />
      <Route path="/library" element={<LibraryPage />} />
      <Route path="/categories" element={<CategoriesPage />} />
      <Route path="/history" element={<HistoryPage />} />
      <Route path="/manga" element={<MangaPage />} />
      <Route path="/sources" element={<SourcesPage />} />
      <Route path="/downloads" element={<DownloadsPage />} />
      <Route path="/updates" element={<UpdatesPage />} />
      <Route path="/settings" element={<SettingsPage />} />
    </Routes>
  </Layout>
);

// Reader page without AppFrame for full-screen experience
const ReaderWithoutAppFrame = () => <ReaderPage />;

// Tracker callback page without AppFrame for OAuth flow
const TrackerCallbackWithoutAppFrame = () => <TrackerCallbackPage />;

export default function App() {
  return (
    <Providers>
      <Router>
        <Routes>
          <Route path="/reader/*" element={<ReaderWithoutAppFrame />} />
          <Route path="/tracker/callback/:tracker" element={<TrackerCallbackWithoutAppFrame />} />
          <Route path="/*" element={<PagesWithAppFrame />} />
        </Routes>
      </Router>
    </Providers>
  );
}