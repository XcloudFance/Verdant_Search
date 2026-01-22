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
            </Routes>
          </Router>
        </HistoryProvider>
      </AuthProvider>
    </ThemeProvider>
  );
}

export default App;
