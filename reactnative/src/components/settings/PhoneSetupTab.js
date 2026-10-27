import React, {useCallback, useEffect, useRef, useState} from 'react';
import {View, Text, StyleSheet, TouchableOpacity, ActivityIndicator} from 'react-native';
import 'react-native-get-random-values';
import QRCode from 'react-native-qrcode-svg';
import NetInfo from '@react-native-community/netinfo';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import useStore from '../../store';
import {translate} from '../../utils/translations';
import {renderSetupPage} from '../../utils/setupPage';
import {startSetupServer, SETUP_PORT} from '../../services/setupServer';
import * as spotify from '../../services/spotifyOAuthService';
import * as tibberAuth from '../../services/tibberOAuthService';
import {fetchTibberHomes, fetchDataApiHomes, fetchDataApiDevices} from '../../services/tibberService';
import {loginLaMarzocco, hasLaMarzoccoLogin} from '../../services/lamarzoccoService';

// The server is LAN-reachable, so it only runs while this tab is open and
// for at most this long; the random path token keeps other devices out
const SESSION_MS = 15 * 60 * 1000;

const randomToken = () => {
  const bytes = new Uint8Array(12);
  global.crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
};

const json = (data) => ({type: 'application/json; charset=utf-8', body: JSON.stringify(data)});
const redirect = (location) => ({status: 302, location});

const PhoneSetupTab = ({form, lang, Section, onApply}) => {
  const setSpotifyConnected = useStore((s) => s.setSpotifyConnected);
  const setTibberDataApiConnected = useStore((s) => s.setTibberDataApiConnected);
  const [session, setSession] = useState(null);
  const [generation, setGeneration] = useState(0);
  const [phase, setPhase] = useState('starting');
  const [status, setStatus] = useState({});
  const [lastEvent, setLastEvent] = useState('');

  // The server outlives renders; give its handlers the current form and save
  const formRef = useRef(form);
  formRef.current = form;
  const applyRef = useRef(onApply);
  applyRef.current = onApply;
  const machinesRef = useRef([]);

  const readStatus = useCallback(async () => {
    const f = formRef.current;
    const [sp, tb, lm] = await Promise.all([
      spotify.isSpotifyConnected(),
      tibberAuth.isDataApiConnected(),
      hasLaMarzoccoLogin(),
    ]);
    const evIds = f.tibberEvDeviceIds || [];
    const vehicles = (f.tibberDevices || [])
      .filter((d) => d.type === 'ev' && evIds.includes(d.deviceId))
      .map((d) => d.label);
    const home = (f.tibberHomes || []).find((h) => h.id === f.tibberHomeId);
    return {
      spotify: sp,
      tibber: tb,
      tibberDevices: vehicles.join(', '),
      tibberToken: !!f.tibberApiKey,
      tibberHome: f.tibberApiKey ? home?.label || '' : '',
      lamarzocco: lm && !!f.lmSerialNumber,
      lamarzoccoMachine: lm && f.lmSerialNumber ? f.lmMachineName || '' : '',
    };
  }, []);

  // Data API devices only show once picked: keep the picks that still exist,
  // else pick every vehicle so the car appears without visiting Energy
  const tibberDeviceChanges = async () => {
    const f = formRef.current;
    let homeId = f.tibberHomeId;
    if (!homeId) homeId = (await fetchDataApiHomes())[0]?.id;
    if (!homeId) return {energyProvider: 'tibber'};
    const devices = (await fetchDataApiDevices(homeId)).map(({raw, ...d}) => d);
    const changes = {
      energyProvider: 'tibber',
      tibberHomeId: homeId,
      tibberDevices: [{deviceId: 'pulse', type: 'pulse', label: 'Tibber Pulse'}, ...devices],
    };
    const evIds = devices.filter((d) => d.type === 'ev').map((d) => d.deviceId);
    const stillThere = (f.tibberEvDeviceIds || []).filter((id) => evIds.includes(id));
    if (evIds.length) {
      changes.tibberEvDeviceIds = stillThere.length ? stillThere : evIds;
      changes.tibberEv = true;
    }
    return changes;
  };

  const apply = async (changes, event) => {
    await applyRef.current(changes);
    setLastEvent(event);
  };

  const start = useCallback(async () => {
    setPhase('starting');
    const net = await NetInfo.fetch().catch(() => null);
    const ip = net?.details?.ipAddress;
    if (!ip || !/^\d+\.\d+\.\d+\.\d+$/.test(ip)) {
      setPhase('noWifi');
      return null;
    }
    const token = randomToken();
    const base = `/s/${token}`;
    const lanReturn = `${ip}.${SETUP_PORT}`;

    const handle = async ({method, path, query, body}) => {
      // OAuth returns via the https forwarder and carries no token; the PKCE
      // state check inside the exchange is what authenticates it
      if (method === 'GET' && (path === '/oauth/spotify' || path === '/oauth/tibber')) {
        const isSpotify = path === '/oauth/spotify';
        const label = isSpotify ? 'Spotify' : 'Tibber';
        if (!query.code) return redirect(`${base}/?error=${encodeURIComponent(query.error || label)}`);
        try {
          if (isSpotify) {
            await spotify.exchangeCodeForTokens(query.code, query.state);
            setSpotifyConnected(true);
            setLastEvent('Spotify');
          } else {
            await tibberAuth.exchangeCodeForTokens(query.code, query.state);
            setTibberDataApiConnected(true);
            await apply(await tibberDeviceChanges(), 'Tibber');
          }
          return redirect(`${base}/?connected=${label}`);
        } catch (err) {
          console.warn(`Phone setup: ${label} callback failed:`, err?.message);
          return redirect(`${base}/?error=${encodeURIComponent(`${label}: ${err?.message || 'failed'}`)}`);
        }
      }

      if (path !== base && !path.startsWith(`${base}/`)) {
        return {status: 403, type: 'text/plain; charset=utf-8', body: translate('phoneSetupLinkExpired', lang)};
      }
      const route = path.slice(base.length) || '/';
      let data = {};
      if (method === 'POST') {
        try {
          data = JSON.parse(decodeURIComponent(body));
        } catch {
          return {status: 400, ...json({ok: false})};
        }
      }

      if (method === 'GET' && route === '/') {
        return {body: renderSetupPage({base, lang, connected: query.connected, error: query.error})};
      }
      if (method === 'GET' && route === '/status') return json(await readStatus());
      if (method === 'GET' && route === '/spotify') {
        return redirect(await spotify.startOAuthFlow({lanReturn}));
      }
      if (method === 'GET' && route === '/tibber') {
        return redirect(await tibberAuth.startOAuthFlow({lanReturn}));
      }
      if (method === 'POST' && route === '/tibber-token') {
        const homes = data.token ? await fetchTibberHomes(data.token) : [];
        if (!homes.length) return json({ok: false, error: translate('phoneSetupBadToken', lang)});
        const current = formRef.current.tibberHomeId;
        await apply(
          {
            energyProvider: 'tibber',
            tibberApiKey: data.token,
            tibberHomes: homes,
            tibberHomeId: homes.some((h) => h.id === current) ? current : homes[0].id,
          },
          'Tibber',
        );
        return json({ok: true});
      }
      if (method === 'POST' && route === '/lamarzocco') {
        let machines = null;
        try {
          machines = await loginLaMarzocco(data.email, data.password);
        } catch (err) {
          return json({ok: false, error: err?.message || 'Login failed'});
        }
        if (!machines?.length) return json({ok: false, error: translate('noDevicesFound', lang)});
        machinesRef.current = machines;
        if (machines.length > 1) {
          return json({
            ok: true,
            machines: machines.map((m) => ({serial: m.serialNumber, name: m.name || m.model})),
          });
        }
        data = {serial: machines[0].serialNumber};
      }
      if (method === 'POST' && (route === '/lamarzocco' || route === '/lamarzocco-machine')) {
        const machine = machinesRef.current.find((m) => m.serialNumber === data.serial);
        if (!machine) return json({ok: false});
        await apply(
          {
            smartDeviceType: 'lamarzocco',
            lmSerialNumber: machine.serialNumber,
            lmMachineName: machine.name || machine.model || 'La Marzocco',
            lmShowWidget: true,
          },
          'La Marzocco',
        );
        return json({ok: true});
      }
      return null;
    };

    try {
      const server = await startSetupServer(handle);
      setSession({url: `http://${ip}:${SETUP_PORT}${base}`});
      setPhase('ready');
      return server;
    } catch (err) {
      console.warn('Phone setup: server failed to start:', err?.message);
      setPhase('failed');
      return null;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lang, readStatus, setSpotifyConnected, setTibberDataApiConnected]);

  useEffect(() => {
    let server = null;
    let stopped = false;
    let expiry = null;
    start().then((s) => {
      server = s;
      if (stopped) s?.stop();
      else if (s) {
        expiry = setTimeout(() => {
          s.stop();
          setPhase('expired');
        }, SESSION_MS);
      }
    });
    return () => {
      stopped = true;
      clearTimeout(expiry);
      server?.stop();
    };
  }, [start, generation]);

  useEffect(() => {
    let alive = true;
    const tick = () => readStatus().then((s) => alive && setStatus(s)).catch(() => {});
    tick();
    const timer = setInterval(tick, 3000);
    return () => {
      alive = false;
      clearInterval(timer);
    };
  }, [readStatus]);

  const restart = () => setGeneration((g) => g + 1);

  const rows = [
    {key: 'spotify', label: 'Spotify', on: status.spotify},
    {key: 'tibber', label: 'Tibber', on: status.tibber, detail: status.tibberDevices},
    {key: 'tibberToken', label: translate('phoneSetupTibberPrices', lang), on: status.tibberToken, detail: status.tibberHome},
    {key: 'lamarzocco', label: 'La Marzocco', on: status.lamarzocco, detail: status.lamarzoccoMachine},
  ];

  return (
    <Section title={translate('phoneSetup', lang)}>
      <View style={styles.row}>
        <View style={styles.qrCol}>
          {phase === 'ready' && session ? (
            <>
              <View style={styles.qrBox}>
                <QRCode value={session.url} size={220} />
              </View>
              <Text style={styles.url} selectable>{session.url}</Text>
            </>
          ) : phase === 'starting' ? (
            <ActivityIndicator size="large" color="#cccccc" style={styles.spinner} />
          ) : (
            <View style={styles.qrPlaceholder}>
              <Text style={styles.problem}>
                {translate(
                  phase === 'noWifi' ? 'phoneSetupNoWifi' : phase === 'expired' ? 'phoneSetupExpired' : 'phoneSetupFailed',
                  lang,
                )}
              </Text>
              <TouchableOpacity style={styles.button} onPress={restart}>
                <Icon name="qrcode" size={18} color="#fff" />
                <Text style={styles.buttonText}>{translate('phoneSetupNewCode', lang)}</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>

        <View style={styles.infoCol}>
          <Text style={styles.step}>1. {translate('phoneSetupStep1', lang)}</Text>
          <Text style={styles.step}>2. {translate('phoneSetupStep2', lang)}</Text>
          <Text style={styles.step}>3. {translate('phoneSetupStep3', lang)}</Text>

          <View style={styles.statusList}>
            {rows.map((r) => (
              <View key={r.key} style={styles.statusRow}>
                <Icon
                  name={r.on ? 'check-circle' : 'circle-outline'}
                  size={20}
                  color={r.on ? '#3fcf40' : '#666'}
                />
                <Text style={styles.statusLabel}>{r.label}</Text>
                {r.on && r.detail ? (
                  <Text style={styles.statusDetail} numberOfLines={1}>{r.detail}</Text>
                ) : null}
              </View>
            ))}
          </View>
          {lastEvent ? (
            <Text style={styles.event}>
              {lastEvent}: {translate('phoneSetupJustConnected', lang)}
            </Text>
          ) : null}
        </View>
      </View>
    </Section>
  );
};

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    gap: 28,
    alignItems: 'flex-start',
  },
  qrCol: {
    width: 260,
    alignItems: 'center',
  },
  qrBox: {
    backgroundColor: '#ffffff',
    padding: 16,
    borderRadius: 12,
  },
  url: {
    color: '#888',
    fontSize: 11,
    marginTop: 8,
    textAlign: 'center',
  },
  spinner: {
    marginTop: 100,
  },
  qrPlaceholder: {
    width: 252,
    height: 252,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#333',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
    gap: 14,
  },
  problem: {
    color: '#cccccc',
    fontSize: 14,
    textAlign: 'center',
  },
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#2a2a2a',
    borderRadius: 8,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  buttonText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '600',
  },
  infoCol: {
    flex: 1,
  },
  step: {
    color: '#dddddd',
    fontSize: 16,
    marginBottom: 10,
    lineHeight: 22,
  },
  statusList: {
    marginTop: 14,
    gap: 10,
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  statusLabel: {
    color: '#ffffff',
    fontSize: 15,
    fontWeight: '600',
  },
  statusDetail: {
    color: '#888',
    fontSize: 13,
    flex: 1,
  },
  event: {
    color: '#3fcf40',
    fontSize: 14,
    marginTop: 16,
  },
});

export default PhoneSetupTab;
