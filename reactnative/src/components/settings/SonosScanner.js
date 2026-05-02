import React, {useState, useEffect, useRef} from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
} from 'react-native';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import NetInfo from '@react-native-community/netinfo';
import {translate} from '../../utils/translations';
import {discoverSonosDevices, getDeviceDetails} from '../../services/sonosService';

const BATCH_SIZE = 20;
const TIMEOUT_MS = 2000;

const getSubnetFromIp = (ip) => {
  if (!ip) return null;
  const parts = ip.split('.');
  if (parts.length === 4) {
    return parts.slice(0, 3).join('.');
  }
  return null;
};

const SonosScanner = ({onSelectDevice, lang}) => {
  const [scanning, setScanning] = useState(false);
  const [devices, setDevices] = useState([]);
  const [scanDone, setScanDone] = useState(false);
  const [selectedIp, setSelectedIp] = useState(null);
  const [subnet, setSubnet] = useState('192.168.1');
  const [progress, setProgress] = useState(0);
  const cancelledRef = useRef(false);

  useEffect(() => {
    NetInfo.fetch().then((state) => {
      const ip = state.details?.ipAddress;
      const detected = getSubnetFromIp(ip);
      if (detected) setSubnet(detected);
    }).catch(() => {});
  }, []);

  const scanSsdp = async () => {
    cancelledRef.current = false;
    setScanning(true);
    setDevices([]);
    setScanDone(false);
    setSelectedIp(null);

    try {
      // SSDP discovery
      const discovered = await discoverSonosDevices(3000);

      if (cancelledRef.current) {
        setScanning(false);
        return;
      }

      if (discovered.length > 0) {
        // Fetch device details for each discovered IP
        const details = await Promise.all(
          discovered.map((d) => getDeviceDetails(d.ip)),
        );
        const found = details.filter(Boolean);
        setDevices(found);
        setScanning(false);
        setScanDone(true);
        return;
      }
    } catch {
      // SSDP failed, fall through to IP scan
    }

    if (cancelledRef.current) {
      setScanning(false);
      return;
    }

    // Fallback: IP range scan
    await scanIpRange();
  };

  const scanIpRange = async () => {
    const found = [];
    setProgress(0);

    try {
      for (let batch = 1; batch <= 254; batch += BATCH_SIZE) {
        if (cancelledRef.current) break;

        const end = Math.min(batch + BATCH_SIZE - 1, 254);
        setProgress(Math.round((end / 254) * 100));

        const promises = [];
        for (let i = batch; i <= end; i++) {
          promises.push(getDeviceDetails(`${subnet}.${i}`));
        }

        const results = await Promise.all(promises);
        for (const r of results) {
          if (r) {
            found.push(r);
            setDevices([...found]);
          }
        }
      }
    } catch {}

    setScanning(false);
    setScanDone(true);
    setProgress(0);
  };

  const handleSelect = (device) => {
    setSelectedIp(device.ip);
    onSelectDevice(device.ip, device.name, device.room);
  };

  return (
    <View style={styles.container}>
      <View style={styles.row}>
        {scanning ? (
          <TouchableOpacity style={styles.cancelBtn} onPress={() => { cancelledRef.current = true; }}>
            <Icon name="stop" size={16} color="#ffffff" />
            <Text style={styles.btnText}>{translate('cancel', lang)}</Text>
          </TouchableOpacity>
        ) : (
          <TouchableOpacity style={styles.scanBtn} onPress={scanSsdp}>
            <Icon name="access-point-network" size={16} color="#ffffff" />
            <Text style={styles.btnText}>{translate('scanNetwork', lang)}</Text>
          </TouchableOpacity>
        )}
      </View>

      {scanning && progress > 0 ? (
        <View style={styles.progressRow}>
          <View style={styles.progressBg}>
            <View style={[styles.progressFill, {width: `${progress}%`}]} />
          </View>
          <Text style={styles.progressText}>{progress}%</Text>
        </View>
      ) : scanning ? (
        <View style={styles.loadingRow}>
          <ActivityIndicator size="small" color="#cccccc" />
          <Text style={styles.loadingText}>{translate('scanning', lang)}</Text>
        </View>
      ) : null}

      {devices.length > 0 ? (
        <View style={styles.deviceList}>
          <Text style={styles.listTitle}>
            {translate('foundDevices', lang)} ({devices.length})
          </Text>
          {devices.map((d, i) => (
            <TouchableOpacity
              key={i}
              style={[
                styles.deviceItem,
                selectedIp === d.ip && styles.deviceItemSelected,
              ]}
              onPress={() => handleSelect(d)}>
              <View style={styles.deviceInfo}>
                <Text style={styles.deviceName}>{d.room || d.name}</Text>
                <Text style={styles.deviceMeta}>{d.name} - {d.ip}</Text>
              </View>
              {selectedIp === d.ip ? (
                <Icon name="check" size={18} color="#cccccc" />
              ) : null}
            </TouchableOpacity>
          ))}
        </View>
      ) : null}

      {scanDone && !scanning && devices.length === 0 ? (
        <Text style={styles.noDevices}>{translate('noDevicesFound', lang)}</Text>
      ) : null}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginBottom: 10,
  },
  row: {
    flexDirection: 'row',
    gap: 8,
    alignItems: 'center',
  },
  scanBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#1B4781',
    borderRadius: 6,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  cancelBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#c44',
    borderRadius: 6,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  btnText: {
    color: '#ffffff',
    fontSize: 13,
    fontWeight: '600',
  },
  loadingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 8,
  },
  loadingText: {
    color: '#888',
    fontSize: 12,
  },
  progressRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
    gap: 8,
  },
  progressBg: {
    flex: 1,
    height: 4,
    backgroundColor: '#333',
    borderRadius: 2,
  },
  progressFill: {
    height: 4,
    backgroundColor: '#cccccc',
    borderRadius: 2,
  },
  progressText: {
    color: '#888',
    fontSize: 12,
    minWidth: 32,
  },
  deviceList: {
    backgroundColor: '#2a2a2a',
    borderRadius: 6,
    marginTop: 10,
    borderWidth: 1,
    borderColor: '#333',
  },
  listTitle: {
    color: '#cccccc',
    fontSize: 12,
    fontWeight: '600',
    padding: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#444',
  },
  deviceItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#444',
  },
  deviceItemSelected: {
    backgroundColor: 'rgba(62, 136, 196, 0.2)',
  },
  deviceInfo: {
    flex: 1,
  },
  deviceName: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '600',
  },
  deviceMeta: {
    color: '#888',
    fontSize: 11,
    marginTop: 2,
  },
  noDevices: {
    color: '#888',
    fontSize: 12,
    marginTop: 8,
    fontStyle: 'italic',
  },
});

export default SonosScanner;
