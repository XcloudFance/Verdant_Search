import React, { useState, useEffect } from 'react';
import {
  Box, Container, Typography, Paper, Stack, Button,
  Select, MenuItem, FormControl, InputLabel, Switch,
  FormControlLabel, Divider, Alert, CircularProgress,
} from '@mui/material';
import SettingsIcon from '@mui/icons-material/Settings';
import SaveIcon from '@mui/icons-material/Save';
import AmbientBackground from '../components/common/AmbientBackground';
import Navbar from '../components/layout/Navbar';
import AnimatedPage from '../components/layout/AnimatedPage';
import { GO_API } from '../config';

const LANGUAGES = [
  { value: 'en', label: 'English' },
  { value: 'zh', label: '中文' },
  { value: 'ms', label: 'Bahasa Melayu' },
];

const RESULTS_OPTIONS = [5, 10, 20, 50];

export default function Settings() {
  const [prefs, setPrefs] = useState({
    preferred_language: 'en',
    results_per_page: 10,
    reranker_enabled: true,
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    const token = localStorage.getItem('verdant_token');
    if (!token) { setLoading(false); return; }
    fetch(`${GO_API}/api/user/profile`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then(r => r.json())
      .then(data => {
        setPrefs({
          preferred_language: data.preferred_language || 'en',
          results_per_page: data.results_per_page || 10,
          reranker_enabled: data.reranker_enabled ?? true,
        });
      })
      .catch(() => setError('Failed to load preferences'))
      .finally(() => setLoading(false));
  }, []);

  const handleSave = async () => {
    const token = localStorage.getItem('verdant_token');
    if (!token) return;
    setSaving(true);
    setError('');
    setSaved(false);
    try {
      const res = await fetch(`${GO_API}/api/user/preferences`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify(prefs),
      });
      if (!res.ok) throw new Error('Save failed');
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch {
      setError('Failed to save preferences');
    } finally {
      setSaving(false);
    }
  };

  return (
    <AnimatedPage>
      <Box sx={{ minHeight: '100vh', bgcolor: 'background.default' }}>
        <AmbientBackground />
        <Navbar />
        <Container maxWidth="sm" sx={{ mt: 8 }}>
          <Stack direction="row" spacing={2} alignItems="center" mb={4}>
            <SettingsIcon color="primary" fontSize="large" />
            <Typography variant="h4" fontWeight="bold">Settings</Typography>
          </Stack>

          <Paper sx={{ p: 4, borderRadius: 3, bgcolor: 'rgba(30, 41, 59, 0.5)', backdropFilter: 'blur(10px)' }}>
            {loading ? (
              <Box display="flex" justifyContent="center" py={4}>
                <CircularProgress size={32} sx={{ color: 'primary.main' }} />
              </Box>
            ) : (
              <Stack spacing={4}>
                <Box>
                  <Typography variant="subtitle1" fontWeight="bold" mb={2} color="text.secondary">
                    Search Preferences
                  </Typography>
                  <Stack spacing={3}>
                    <FormControl fullWidth size="small">
                      <InputLabel>Language</InputLabel>
                      <Select
                        value={prefs.preferred_language}
                        label="Language"
                        onChange={e => setPrefs(p => ({ ...p, preferred_language: e.target.value }))}
                      >
                        {LANGUAGES.map(l => (
                          <MenuItem key={l.value} value={l.value}>{l.label}</MenuItem>
                        ))}
                      </Select>
                    </FormControl>

                    <FormControl fullWidth size="small">
                      <InputLabel>Results per page</InputLabel>
                      <Select
                        value={prefs.results_per_page}
                        label="Results per page"
                        onChange={e => setPrefs(p => ({ ...p, results_per_page: e.target.value }))}
                      >
                        {RESULTS_OPTIONS.map(n => (
                          <MenuItem key={n} value={n}>{n} results</MenuItem>
                        ))}
                      </Select>
                    </FormControl>
                  </Stack>
                </Box>

                <Divider sx={{ borderColor: 'rgba(255,255,255,0.08)' }} />

                <Box>
                  <Typography variant="subtitle1" fontWeight="bold" mb={2} color="text.secondary">
                    Reranker
                  </Typography>
                  <FormControlLabel
                    control={
                      <Switch
                        checked={prefs.reranker_enabled}
                        onChange={e => setPrefs(p => ({ ...p, reranker_enabled: e.target.checked }))}
                        color="primary"
                      />
                    }
                    label={
                      <Box>
                        <Typography variant="body2">Enable multimodal reranker</Typography>
                        <Typography variant="caption" color="text.secondary">
                          Stage 2 listwise LTR reranking — improves result quality at a small latency cost
                        </Typography>
                      </Box>
                    }
                  />
                </Box>

                {error && <Alert severity="error">{error}</Alert>}
                {saved && <Alert severity="success">Preferences saved</Alert>}

                <Button
                  variant="contained"
                  startIcon={saving ? <CircularProgress size={16} color="inherit" /> : <SaveIcon />}
                  onClick={handleSave}
                  disabled={saving}
                  sx={{ alignSelf: 'flex-start' }}
                >
                  Save Changes
                </Button>
              </Stack>
            )}
          </Paper>
        </Container>
      </Box>
    </AnimatedPage>
  );
}
