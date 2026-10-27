import {Platform} from 'react-native';

// Discovery is handled by the kiosk server: Tuya devices announce themselves
// over UDP, which a browser cannot listen to. Needs no credentials.
// Controlling a device additionally needs its per-device local key.
export const canScanTuya = () => Platform.OS === 'web';

export const scanTuyaDevices = async () => {
  const resp = await fetch('/tuya/scan');
  if (!resp.ok) throw new Error(`scan failed (${resp.status})`);
  const {devices} = await resp.json();
  return devices || [];
};

// Keep whatever the user already typed; a rescan only refreshes what the
// network reports (ip can change) and appends devices we had not seen.
export const mergeTuyaDevices = (existing = [], found = []) => {
  const merged = existing.map((device) => {
    const match = found.find((f) => f.id === device.id);
    return match ? {...device, ip: match.ip, version: match.version} : device;
  });
  for (const device of found) {
    if (merged.some((m) => m.id === device.id)) continue;
    merged.push({
      id: device.id,
      ip: device.ip,
      version: device.version,
      name: '',
      localKey: '',
    });
  }
  return merged;
};
