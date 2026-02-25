import { useEffect, useState, useRef } from 'react';
import { useSearchParams, useParams } from 'react-router-dom';
import { Box, CircularProgress, Typography, Alert } from '@mui/material';
import { api } from '../../../lib/api';

export default function TrackerCallbackPage() {
  const [searchParams] = useSearchParams();
  const { tracker: trackerName } = useParams<{ tracker: string }>();
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading');
  const [error, setError] = useState<string | null>(null);
  const hasProcessed = useRef(false);

  useEffect(() => {
    if (hasProcessed.current) return;
    hasProcessed.current = true;

    const handleCallback = async () => {
      if (!trackerName) {
        setStatus('error');
        setError('Missing tracker name');
        return;
      }

      // Check for implicit grant flow (AniList) - token in URL fragment
      if (trackerName === 'anilist') {
        const fragment = window.location.hash.substring(1);
        const fragmentParams = new URLSearchParams(fragment);
        const accessToken = fragmentParams.get('access_token');
        const state = fragmentParams.get('state');
        const expiresIn = fragmentParams.get('expires_in');

        if (!accessToken || !state) {
          setStatus('error');
          setError('Missing access token in callback');
          return;
        }

        try {
          // Use implicit grant callback endpoint
          const response = await api.post(`/trackers/${trackerName}/callback/implicit`, {
            access_token: accessToken,
            state: state,
            expires_in: expiresIn ? parseInt(expiresIn) : 31536000,
          });
          setStatus('success');

          window.opener?.postMessage(
            { type: 'TRACKER_CONNECTED', tracker: trackerName, username: response.data.username },
            window.location.origin
          );

          setTimeout(() => window.close(), 2000);
        } catch (err: any) {
          setStatus('error');
          setError(err.response?.data?.detail || 'Failed to connect tracker');
        }
        return;
      }

      // Authorization code flow (MAL, etc.)
      const code = searchParams.get('code');
      const state = searchParams.get('state');

      if (!code || !state) {
        setStatus('error');
        setError('Missing required parameters (code or state)');
        return;
      }

      try {
        const response = await api.get(`/trackers/${trackerName}/callback`, {
          params: { code, state },
        });
        setStatus('success');

        window.opener?.postMessage(
          { type: 'TRACKER_CONNECTED', tracker: trackerName, username: response.data.username },
          window.location.origin
        );

        setTimeout(() => window.close(), 2000);
      } catch (err: any) {
        setStatus('error');
        setError(err.response?.data?.detail || 'Failed to connect tracker');
      }
    };

    handleCallback();
  }, [searchParams, trackerName]);

  return (
    <Box
      sx={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: '100vh',
        p: 3,
      }}
    >
      {status === 'loading' && (
        <>
          <CircularProgress />
          <Typography sx={{ mt: 2 }}>Connecting to tracker...</Typography>
        </>
      )}
      {status === 'success' && (
        <Alert severity="success">
          Successfully connected! This window will close automatically.
        </Alert>
      )}
      {status === 'error' && <Alert severity="error">{error || 'Failed to connect tracker'}</Alert>}
    </Box>
  );
}
