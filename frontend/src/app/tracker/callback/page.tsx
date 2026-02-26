import { useEffect, useState } from 'react';
import { useSearchParams, useParams } from 'react-router-dom';
import { Box, CircularProgress, Typography, Alert } from '@mui/material';
import { api } from '../../../lib/api';

export default function TrackerCallbackPage() {
  const [searchParams] = useSearchParams();
  const { tracker: trackerName } = useParams<{ tracker: string }>();
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const handleCallback = async () => {
      if (!trackerName) {
        setStatus('error');
        setError('Missing tracker name');
        return;
      }

      const href = window.location.href;
      const fragment = window.location.hash.substring(1);
      const fragmentParams = new URLSearchParams(fragment);
      const tokenFromHref =
        href.match(/[?#&]access_token=([^&]+)/)?.[1] ??
        href.match(/#access_token=([^&]+)/)?.[1] ??
        null;
      const accessToken = fragmentParams.get('access_token') || (tokenFromHref ? decodeURIComponent(tokenFromHref) : null);
      const stateFromFragment = fragmentParams.get('state');
      const expiresIn = fragmentParams.get('expires_in');

      // Implicit grant flow: token in URL fragment
      if (accessToken) {

        try {
          const response = await api.post(`/trackers/${trackerName}/callback/implicit`, {
            access_token: accessToken,
            state: stateFromFragment,
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

      // AniList in this app uses implicit flow only by default.
      if (trackerName === 'anilist') {
        setStatus('error');
        setError('Missing access_token in AniList callback. Please reconnect and approve again.');
        return;
      }

      // Authorization code flow
      const code = searchParams.get('code');
      const state = searchParams.get('state') || stateFromFragment;

      if (!code || !state) {
        setStatus('error');
        setError('Missing required callback parameters');
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
