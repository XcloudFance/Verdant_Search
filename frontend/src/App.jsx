import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { ThemeProvider, CssBaseline } from '@mui/material';
import { Auth0Provider } from '@auth0/auth0-react';
import theme from './theme';
import { AuthProvider } from './context/AuthContext';
import { HistoryProvider } from './context/HistoryContext';
import Home from './pages/Home';
import Results from './pages/Results';
import Login from './pages/Login';
import Register from './pages/Register';
import History from './pages/History';
import Callback from './pages/Callback';
import Settings from './pages/Settings';
import Layout from './components/layout/Layout';
import AdminLayout from './pages/admin/AdminLayout';
import AdminOverview from './pages/admin/AdminOverview';
import CrawlerPanel from './pages/admin/CrawlerPanel';
import IndexPanel from './pages/admin/IndexPanel';
import AnalyticsPanel from './pages/admin/AnalyticsPanel';
import RerankerPanel from './pages/admin/RerankerPanel';
import ConfigPanel from './pages/admin/ConfigPanel';
import SearchDebugger from './pages/admin/SearchDebugger';
import BackupPanel from './pages/admin/BackupPanel';

function App() {
  return (
    <Auth0Provider
      domain="dev-mzxcgy6t1ssatho4.us.auth0.com"
      clientId="nOSSx5Y7RbqCcBZh5SDkvpvEKql5fEvo"
      authorizationParams={{ redirect_uri: window.location.origin + '/callback', scope: 'openid profile email' }}
    >
      <ThemeProvider theme={theme}>
        <CssBaseline />
        <AuthProvider>
          <HistoryProvider>
            <Router>
              <Routes>
                <Route element={<Layout />}>
                  <Route path="/" element={<Home />} />
                  <Route path="/results" element={<Results />} />
                  <Route path="/login" element={<Login />} />
                  <Route path="/register" element={<Register />} />
                  <Route path="/history" element={<History />} />
                  <Route path="/callback" element={<Callback />} />
                  <Route path="/settings" element={<Settings />} />
                </Route>
                <Route path="/admin" element={<AdminLayout />}>
                  <Route index element={<AdminOverview />} />
                  <Route path="crawler" element={<CrawlerPanel />} />
                  <Route path="index" element={<IndexPanel />} />
                  <Route path="analytics" element={<AnalyticsPanel />} />
                  <Route path="reranker" element={<RerankerPanel />} />
                  <Route path="search-debug" element={<SearchDebugger />} />
                  <Route path="backup" element={<BackupPanel />} />
                  <Route path="config" element={<ConfigPanel />} />
                </Route>
              </Routes>
            </Router>
          </HistoryProvider>
        </AuthProvider>
      </ThemeProvider>
    </Auth0Provider>
  );
}

export default App;
