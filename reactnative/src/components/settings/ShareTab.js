import React, {useState, useEffect, useRef} from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Alert,
  Platform,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import dgram from 'react-native-udp';
import {translate} from '../../utils/translations';
import {buildSectionData, parseQrValue} from '../../utils/qrSections';
import {
  SYNC_PORT,
  MULTICAST_ADDR,
  generateKeypair,
  deriveSharedKey,
  encrypt,
  decrypt,
  newRequestId,
  buildAnnounce,
  buildRequest,
  buildAccept,
  buildDecline,
  buildData,
  buildChunk,
  parseMessage,
} from '../../utils/lanSync';

const SECTIONS = [
  {key: 'general', icon: 'cog'},
  {key: 'weather', icon: 'weather-partly-cloudy'},
  {key: 'energy', icon: 'flash'},
  {key: 'news', icon: 'newspaper'},
  {key: 'stocks', icon: 'chart-line'},
  {key: 'calendar', icon: 'calendar'},
  {key: 'music', icon: 'music'},
  {key: 'smartDevices', icon: 'devices'},
];

const DEVICE_NAME_KEY = 'homeboard_device_name';
const DEVICE_ID_KEY = 'homeboard_device_id';
const ANNOUNCE_INTERVAL = 4000;
const DEVICE_TTL = 12000;
const REQUEST_TIMEOUT = 30000;

const randomHex = (n) => {
  const bytes = new Uint8Array(n);
  if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
    crypto.getRandomValues(bytes);
  } else {
    for (let i = 0; i < n; i++) bytes[i] = Math.floor(Math.random() * 256);
  }
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('').toUpperCase();
};

const ShareTab = ({form, updateField, lang, Section}) => {
  const [deviceId, setDeviceId] = useState(null);
  const [deviceName, setDeviceName] = useState('');
  const [selectedSection, setSelectedSection] = useState(null);
  const [devices, setDevices] = useState({});
  const [sending, setSending] = useState(null);
  const [received, setReceived] = useState(null);
  const [incoming, setIncoming] = useState(null);

  const socketRef = useRef(null);
  const announceTimerRef = useRef(null);
  const sweepTimerRef = useRef(null);
  const pendingRequestsRef = useRef({});
  const incomingHandshakesRef = useRef({});
  const chunkBuffersRef = useRef({});
  const deviceNameRef = useRef('');
  const deviceIdRef = useRef('');

  useEffect(() => {
    deviceNameRef.current = deviceName;
  }, [deviceName]);
  useEffect(() => {
    deviceIdRef.current = deviceId || '';
  }, [deviceId]);

  useEffect(() => {
    let cancelled = false;
    const init = async () => {
      let id = await AsyncStorage.getItem(DEVICE_ID_KEY);
      if (!id) {
        id = randomHex(4);
        await AsyncStorage.setItem(DEVICE_ID_KEY, id);
      }
      let name = await AsyncStorage.getItem(DEVICE_NAME_KEY);
      if (!name) {
        const platformLabel = Platform.OS === 'ios' ? 'iOS' : 'Android';
        name = `${platformLabel} ${id}`;
        await AsyncStorage.setItem(DEVICE_NAME_KEY, name);
      }
      if (cancelled) return;
      setDeviceId(id);
      setDeviceName(name);
    };
    init();
    return () => {
      cancelled = true;
    };
  }, []);

  const sendRaw = (message, addr = MULTICAST_ADDR) => {
    const sock = socketRef.current;
    if (!sock) return;
    try {
      sock.send(message, undefined, undefined, SYNC_PORT, addr, () => {});
    } catch (e) {
      console.warn('send failed:', e);
    }
  };

  const sendChunked = (reqId, payload, addr) => {
    const MAX = 1200;
    if (payload.length <= MAX) {
      sendRaw(buildData(reqId, payload), addr);
      return;
    }
    const total = Math.ceil(payload.length / MAX);
    for (let i = 0; i < total; i++) {
      const chunk = payload.slice(i * MAX, (i + 1) * MAX);
      sendRaw(buildChunk(reqId, i, total, chunk), addr);
    }
  };

  const announce = () => {
    if (!deviceIdRef.current || !deviceNameRef.current) return;
    sendRaw(buildAnnounce(deviceIdRef.current, deviceNameRef.current));
  };

  const sweepStaleDevices = () => {
    const cutoff = Date.now() - DEVICE_TTL;
    setDevices((prev) => {
      const next = {};
      let changed = false;
      for (const [id, dev] of Object.entries(prev)) {
        if (dev.lastSeen >= cutoff) next[id] = dev;
        else changed = true;
      }
      return changed ? next : prev;
    });
  };

  useEffect(() => {
    if (!deviceId) return;

    const socket = dgram.createSocket({type: 'udp4', reusePort: true});
    socketRef.current = socket;

    socket.on('error', (err) => {
      console.warn('Sync socket error:', err);
    });

    socket.on('message', (msg, rinfo) => {
      const value = msg.toString();
      const parsed = parseMessage(value);
      if (!parsed) return;

      if (parsed.type === 'HBANN') {
        if (parsed.id === deviceIdRef.current) return;
        setDevices((prev) => ({
          ...prev,
          [parsed.id]: {id: parsed.id, name: parsed.name, addr: rinfo.address, lastSeen: Date.now()},
        }));
        return;
      }

      if (parsed.type === 'HBREQ') {
        if (parsed.senderId === deviceIdRef.current) return;
        if (incomingHandshakesRef.current[parsed.reqId]) return;
        incomingHandshakesRef.current[parsed.reqId] = {
          senderId: parsed.senderId,
          senderName: parsed.senderName,
          section: parsed.section,
          senderPub: parsed.senderPub,
          addr: rinfo.address,
        };
        setIncoming({
          reqId: parsed.reqId,
          senderName: parsed.senderName,
          section: parsed.section,
        });
        return;
      }

      if (parsed.type === 'HBOK') {
        const pending = pendingRequestsRef.current[parsed.reqId];
        if (!pending) return;
        try {
          const sharedKey = deriveSharedKey(pending.priv, parsed.receiverPub);
          const ciphertext = encrypt(sharedKey, pending.payload);
          sendChunked(parsed.reqId, ciphertext, pending.addr);
          setSending(pending.section);
          setTimeout(() => setSending(null), 2000);
        } catch (e) {
          console.warn('encrypt error:', e);
        } finally {
          delete pendingRequestsRef.current[parsed.reqId];
        }
        return;
      }

      if (parsed.type === 'HBNO') {
        delete pendingRequestsRef.current[parsed.reqId];
        return;
      }

      if (parsed.type === 'HBDATA' || parsed.type === 'HBCHUNK') {
        const handshake = incomingHandshakesRef.current[parsed.reqId];
        if (!handshake || !handshake.sharedKey) return;

        let ciphertext = null;
        if (parsed.type === 'HBDATA') {
          ciphertext = parsed.ciphertext;
        } else {
          const buf = chunkBuffersRef.current[parsed.reqId] || {parts: {}, total: parsed.total};
          buf.parts[parsed.idx] = parsed.chunk;
          chunkBuffersRef.current[parsed.reqId] = buf;
          if (Object.keys(buf.parts).length === buf.total) {
            ciphertext = '';
            for (let i = 0; i < buf.total; i++) ciphertext += buf.parts[i];
            delete chunkBuffersRef.current[parsed.reqId];
          }
        }
        if (ciphertext === null) return;

        const plaintext = decrypt(handshake.sharedKey, ciphertext);
        delete incomingHandshakesRef.current[parsed.reqId];
        if (!plaintext) {
          console.warn('decrypt failed for req', parsed.reqId);
          return;
        }
        const wire = `HB:${handshake.section}:${plaintext}`;
        const result = parseQrValue(wire);
        if (result) {
          for (const [k, v] of Object.entries(result.fields)) {
            updateField(k, v);
          }
          setReceived(result.section);
          setTimeout(() => setReceived(null), 4000);
        }
      }
    });

    socket.bind(SYNC_PORT, () => {
      try {
        socket.addMembership(MULTICAST_ADDR);
      } catch (e) {
        console.warn('addMembership failed:', e);
      }
      try {
        socket.setBroadcast(true);
      } catch (e) {}
      announce();
      announceTimerRef.current = setInterval(announce, ANNOUNCE_INTERVAL);
      sweepTimerRef.current = setInterval(sweepStaleDevices, 5000);
    });

    return () => {
      if (announceTimerRef.current) clearInterval(announceTimerRef.current);
      if (sweepTimerRef.current) clearInterval(sweepTimerRef.current);
      try { socket.close(); } catch (e) {}
      socketRef.current = null;
      pendingRequestsRef.current = {};
      incomingHandshakesRef.current = {};
      chunkBuffersRef.current = {};
    };
  }, [deviceId]);

  const handleRename = async (newName) => {
    setDeviceName(newName);
    try {
      await AsyncStorage.setItem(DEVICE_NAME_KEY, newName);
    } catch (e) {}
  };

  const handleSendToDevice = (device) => {
    if (!selectedSection) {
      Alert.alert(translate('selectSectionFirst', lang));
      return;
    }
    const reqId = newRequestId();
    const {priv, pub} = generateKeypair();
    const data = buildSectionData(selectedSection, form);

    pendingRequestsRef.current[reqId] = {
      section: selectedSection,
      priv,
      payload: data,
      addr: device.addr,
    };
    setTimeout(() => {
      delete pendingRequestsRef.current[reqId];
    }, REQUEST_TIMEOUT);

    sendRaw(
      buildRequest(reqId, deviceIdRef.current, deviceNameRef.current, selectedSection, pub),
      device.addr,
    );
  };

  const handleAccept = () => {
    if (!incoming) return;
    const handshake = incomingHandshakesRef.current[incoming.reqId];
    if (!handshake) {
      setIncoming(null);
      return;
    }
    const {priv, pub} = generateKeypair();
    handshake.sharedKey = deriveSharedKey(priv, handshake.senderPub);
    sendRaw(buildAccept(incoming.reqId, pub), handshake.addr);
    setIncoming(null);
  };

  const handleDecline = () => {
    if (!incoming) return;
    const handshake = incomingHandshakesRef.current[incoming.reqId];
    if (handshake) {
      sendRaw(buildDecline(incoming.reqId), handshake.addr);
      delete incomingHandshakesRef.current[incoming.reqId];
    }
    setIncoming(null);
  };

  const deviceList = Object.values(devices);

  return (
    <View>
      <Section title={translate('thisDevice', lang)}>
        <TextInput
          style={styles.nameInput}
          value={deviceName}
          onChangeText={handleRename}
          placeholder="Homeboard"
          placeholderTextColor="#555"
          maxLength={32}
        />
      </Section>

      {incoming && (
        <View style={styles.incomingBanner}>
          <Icon name="download" size={20} color="#4CAF50" />
          <View style={styles.incomingText}>
            <Text style={styles.incomingTitle}>
              {incoming.senderName}
            </Text>
            <Text style={styles.incomingSub}>
              {translate('wantsToSend', lang)} {translate(incoming.section, lang)}
            </Text>
          </View>
          <TouchableOpacity style={styles.declineBtn} onPress={handleDecline}>
            <Text style={styles.declineBtnText}>{translate('decline', lang)}</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.acceptBtn} onPress={handleAccept}>
            <Text style={styles.acceptBtnText}>{translate('accept', lang)}</Text>
          </TouchableOpacity>
        </View>
      )}

      <Section title={translate('shareExport', lang)}>
        <Text style={styles.hint}>{translate('shareSendHint', lang)}</Text>
        <View style={styles.sectionGrid}>
          {SECTIONS.map((s) => (
            <TouchableOpacity
              key={s.key}
              style={[
                styles.sectionBtn,
                selectedSection === s.key && styles.sectionBtnSelected,
                sending === s.key && styles.sectionBtnSent,
              ]}
              onPress={() => setSelectedSection(s.key === selectedSection ? null : s.key)}>
              <Icon
                name={sending === s.key ? 'check' : s.icon}
                size={22}
                color={sending === s.key ? '#4CAF50' : selectedSection === s.key ? '#4CAF50' : '#ffffff'}
              />
              <Text
                style={[
                  styles.sectionLabel,
                  selectedSection === s.key && styles.sectionLabelSelected,
                ]}>
                {translate(s.key, lang)}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </Section>

      <Section title={translate('devicesNearby', lang)}>
        {deviceList.length === 0 ? (
          <Text style={styles.emptyHint}>{translate('searchingDevices', lang)}</Text>
        ) : (
          deviceList.map((d) => (
            <TouchableOpacity
              key={d.id}
              style={[styles.deviceRow, !selectedSection && styles.deviceRowDisabled]}
              disabled={!selectedSection}
              onPress={() => handleSendToDevice(d)}>
              <Icon name="cellphone-link" size={20} color="#cccccc" />
              <Text style={styles.deviceName}>{d.name}</Text>
              <Icon name="send" size={18} color={selectedSection ? '#4CAF50' : '#444'} />
            </TouchableOpacity>
          ))
        )}
        {received && (
          <View style={styles.receivedBanner}>
            <Icon name="check-circle" size={18} color="#4CAF50" />
            <Text style={styles.receivedText}>
              {translate('settingsImported', lang)}: {translate(received, lang)}
            </Text>
          </View>
        )}
      </Section>
    </View>
  );
};

const styles = StyleSheet.create({
  hint: {
    color: '#888',
    fontSize: 12,
    marginBottom: 12,
    lineHeight: 18,
  },
  emptyHint: {
    color: '#666',
    fontSize: 13,
    fontStyle: 'italic',
    paddingVertical: 8,
  },
  nameInput: {
    backgroundColor: '#2a2a2a',
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#333',
    color: '#ffffff',
    fontSize: 14,
    paddingVertical: 8,
    paddingHorizontal: 12,
  },
  sectionGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  sectionBtn: {
    backgroundColor: '#1B4781',
    borderRadius: 8,
    paddingVertical: 10,
    paddingHorizontal: 14,
    alignItems: 'center',
    minWidth: 80,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  sectionBtnSelected: {
    borderColor: '#4CAF50',
  },
  sectionBtnSent: {
    borderColor: '#4CAF50',
    backgroundColor: 'rgba(76, 175, 80, 0.2)',
  },
  sectionLabel: {
    color: '#cccccc',
    fontSize: 11,
    marginTop: 4,
  },
  sectionLabelSelected: {
    color: '#ffffff',
  },
  deviceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#2a2a2a',
    borderRadius: 6,
    paddingVertical: 12,
    paddingHorizontal: 14,
    marginBottom: 6,
    gap: 12,
  },
  deviceRowDisabled: {
    opacity: 0.5,
  },
  deviceName: {
    color: '#ffffff',
    fontSize: 14,
    flex: 1,
  },
  incomingBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(76, 175, 80, 0.15)',
    borderRadius: 8,
    padding: 12,
    marginBottom: 16,
    gap: 10,
  },
  incomingText: {
    flex: 1,
  },
  incomingTitle: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '600',
  },
  incomingSub: {
    color: '#aaaaaa',
    fontSize: 12,
  },
  acceptBtn: {
    backgroundColor: '#4CAF50',
    borderRadius: 6,
    paddingVertical: 8,
    paddingHorizontal: 14,
  },
  acceptBtnText: {
    color: '#ffffff',
    fontWeight: '600',
    fontSize: 13,
  },
  declineBtn: {
    backgroundColor: '#444',
    borderRadius: 6,
    paddingVertical: 8,
    paddingHorizontal: 14,
  },
  declineBtnText: {
    color: '#cccccc',
    fontWeight: '600',
    fontSize: 13,
  },
  receivedBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 12,
    backgroundColor: 'rgba(76, 175, 80, 0.15)',
    borderRadius: 6,
    padding: 10,
    gap: 8,
  },
  receivedText: {
    color: '#4CAF50',
    fontSize: 13,
    fontWeight: '600',
  },
});

export default ShareTab;
