import React, { useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth0 } from '@auth0/auth0-react';
import { Box, CircularProgress, Typography } from '@mui/material';
import SpaIcon from '@mui/icons-material/Spa';
import { useAuth } from '../context/AuthContext';

export default function Callback() {
  const { isAuthenticated, isLoading, getIdTokenClaims, error } = useAuth0();
  const { loginWithSSO } = useAuth();
  const navigate = useNavigate();
  const attempted = useRef(false);

  useEffect(() => {
    if (isLoading || attempted.current) return;

    if (error) {
      console.error('[SSO] Auth0 error:', error);
      navigate('/login');
      return;
    }

    if (isAuthenticated) {
      attempted.current = true;
      // Use ID token (always a JWT) — access token requires audience config
      getIdTokenClaims()
        .then(claims => {
          if (!claims?.__raw) throw new Error('No ID token');
          return loginWithSSO(claims.__raw);
        })
        .then(ok => {
          if (!ok) throw new Error('loginWithSSO returned false');
          navigate('/');
        })
        .catch(err => {
          console.error('[SSO] Callback failed:', err);
          navigate('/login');
        });
    }
  }, [isAuthenticated, isLoading, error]);

  return (
    <Box sx={{
      minHeight: '100vh', display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center', gap: 2,
      bgcolor: '#070714',
    }}>
      <SpaIcon sx={{ fontSize: 40, color: '#10b981' }} />
      <CircularProgress size={28} sx={{ color: '#10b981' }} />
      <Typography sx={{ color: '#475569', fontSize: 14 }}>
        Completing sign-in…
      </Typography>
    </Box>
  );
}
