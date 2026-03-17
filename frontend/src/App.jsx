import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { ThemeProvider, CssBaseline } from '@mui/material';
import theme from './theme';
import { AuthProvider } from './context/AuthContext';
import { HistoryProvider } from './context/HistoryContext';
import Home from './pages/Home';
import Results from './pages/Results';
import Login from './pages/Login';
import Register from './pages/Register';
import History from './pages/History';
import Layout from './components/layout/Layout';
import AdminLayout from './pages/admin/AdminLayout';
import AdminOverview from './pages/admin/AdminOverview';
import CrawlerPanel from './pages/admin/CrawlerPanel';
import IndexPanel from './pages/admin/IndexPanel';
import AnalyticsPanel from './pages/admin/AnalyticsPanel';
import RerankerPanel from './pages/admin/RerankerPanel';
import ConfigPanel from './pages/admin/ConfigPanel';

function App() {
  return (
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
              </Route>
              <Route path="/admin" element={<AdminLayout />}>
                <Route index element={<AdminOverview />} />
                <Route path="crawler" element={<CrawlerPanel />} />
                <Route path="index" element={<IndexPanel />} />
                <Route path="analytics" element={<AnalyticsPanel />} />
                <Route path="reranker" element={<RerankerPanel />} />
                <Route path="config" element={<ConfigPanel />} />
              </Route>
            </Routes>
          </Router>
        </HistoryProvider>
      </AuthProvider>
    </ThemeProvider>
  );
}

export default App;
