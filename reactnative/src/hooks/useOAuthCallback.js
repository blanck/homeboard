import {useEffect} from 'react';
import {Linking, Platform} from 'react-native';
import useStore from '../store';
import {exchangeCodeForTokens} from '../services/tibberOAuthService';
import {exchangeCodeForTokens as exchangeSpotifyCode} from '../services/spotifyOAuthService';

// Completes the OAuth handshake for whichever root is mounted: the kiosk
// dashboard and the phone settings page both need it, and on the phone it is
// the only way connecting an account can reach the Pi at all.
const useOAuthCallback = () => {
  const setTibberDataApiConnected = useStore((s) => s.setTibberDataApiConnected);
  const setSpotifyConnected = useStore((s) => s.setSpotifyConnected);

  // Handle OAuth deep links
  useEffect(() => {
    const handleUrl = async (url) => {
      if (!url) return;
      try {
        const queryString = url.split('?')[1] || '';
        const params = new URLSearchParams(queryString);
        const code = params.get('code');
        const state = params.get('state');
        if (!code || !state) return;
        // Matches both homeboard://oauth/x (native) and https://host/oauth/x (web)
        if (url.includes('oauth/tibber')) {
          await exchangeCodeForTokens(code, state);
          setTibberDataApiConnected(true);
          console.warn('Tibber Data API: OAuth connected');
        } else if (url.includes('oauth/spotify')) {
          await exchangeSpotifyCode(code, state);
          setSpotifyConnected(true);
          console.warn('Spotify: OAuth connected');
        } else {
          return;
        }
        if (Platform.OS === 'web' && typeof window !== 'undefined') {
          window.history.replaceState({}, '', '/');
        }
      } catch (err) {
        console.warn('OAuth callback error:', err);
      }
    };

    // Cold start
    Linking.getInitialURL().then(handleUrl);

    // Warm start
    const sub = Linking.addEventListener('url', ({url}) => handleUrl(url));

    // Web popup flow: the OAuth forwarder page posts the callback query back
    // to this opener so the kiosk never navigates away from the dashboard
    let onMessage;
    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      onMessage = (event) => {
        const d = event.data;
        if (!d || d.homeboardOAuth !== true || typeof d.provider !== 'string') return;
        handleUrl(`oauth/${d.provider}${d.search || ''}`);
        try {
          event.source?.close();
        } catch {}
      };
      window.addEventListener('message', onMessage);
    }
    return () => {
      sub.remove();
      if (onMessage) window.removeEventListener('message', onMessage);
    };
  }, [setTibberDataApiConnected, setSpotifyConnected]);
};

export default useOAuthCallback;
