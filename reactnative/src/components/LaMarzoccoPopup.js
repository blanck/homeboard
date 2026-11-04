import React, {useCallback, useEffect, useRef, useState} from 'react';
import {View, Text, StyleSheet, Modal, Pressable, Switch, TouchableOpacity} from 'react-native';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import useStore from '../store';
import {
  fetchLaMarzoccoStatus,
  setLaMarzoccoCoffeeTemperature,
  setLaMarzoccoSteam,
  setLaMarzoccoSteamLevel,
  startLaMarzoccoBackflush,
} from '../services/lamarzoccoService';
import {translate} from '../utils/translations';
import {fs, sp} from '../utils/scale';

const TEMP_STEP = 0.5;
const TEMP_SEND_DELAY_MS = 800;
// The cloud only queues commands, so read the real state back shortly after
const REFRESH_DELAY_MS = 4000;
const STEAM_LEVELS = ['Level1', 'Level2', 'Level3'];

const formatDate = (ms) => {
  const d = new Date(ms);
  return `${d.getDate()}/${d.getMonth() + 1}/${d.getFullYear()}`;
};

const LaMarzoccoPopup = () => {
  const visible = useStore((s) => s.lamarzoccoPopupVisible);
  const hide = useStore((s) => s.hideLaMarzoccoPopup);
  const lamarzocco = useStore((s) => s.lamarzocco);
  const setLaMarzocco = useStore((s) => s.setLaMarzocco);
  const serial = useStore((s) => s.config.smartDevices?.lamarzocco?.serialNumber);
  const machineName = useStore((s) => s.config.smartDevices?.lamarzocco?.machineName);
  const lang = useStore((s) => s.config.language || 'en');

  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [started, setStarted] = useState(false);
  const [draftTemp, setDraftTemp] = useState(null);
  const tempTimer = useRef(null);
  const refreshTimer = useRef(null);

  const refresh = useCallback(() => {
    fetchLaMarzoccoStatus(serial)
      .then((lm) => lm && setLaMarzocco(lm))
      .catch(() => {});
  }, [serial, setLaMarzocco]);

  // The dashboard polls hourly, too slow for a control panel
  useEffect(() => {
    if (!visible) return;
    setFailed(false);
    setConfirming(false);
    setStarted(false);
    refresh();
  }, [visible, refresh]);

  useEffect(
    () => () => {
      clearTimeout(tempTimer.current);
      clearTimeout(refreshTimer.current);
    },
    [],
  );

  if (!visible || !lamarzocco) return null;

  const coffee = lamarzocco.coffeeBoiler;
  const steam = lamarzocco.steamBoiler;
  const backflush = lamarzocco.backflush;
  const offline = lamarzocco.connected === false;
  const isOn = lamarzocco.status === 'PoweredOn' || lamarzocco.status === 'Brewing';
  const flushing = backflush?.status === 'Requested' || backflush?.status === 'Cleaning';
  const locked = busy || offline;

  const send = async (command, patch) => {
    setBusy(true);
    setFailed(false);
    const ok = await command();
    setBusy(false);
    setFailed(!ok);
    if (!ok) return false;
    if (patch) {
      const current = useStore.getState().lamarzocco;
      setLaMarzocco({...current, ...patch(current)});
    }
    clearTimeout(refreshTimer.current);
    refreshTimer.current = setTimeout(refresh, REFRESH_DELAY_MS);
    return true;
  };

  const targetTemp = draftTemp ?? coffee?.temperature;

  // Waits for the taps to stop so a few presses send one command
  const stepTemp = (delta) => {
    const next = Math.min(coffee.max, Math.max(coffee.min, targetTemp + delta));
    setDraftTemp(next);
    clearTimeout(tempTimer.current);
    tempTimer.current = setTimeout(async () => {
      await send(
        () => setLaMarzoccoCoffeeTemperature(serial, next),
        (current) => ({coffeeBoiler: {...current.coffeeBoiler, temperature: next}}),
      );
      setDraftTemp(null);
    }, TEMP_SEND_DELAY_MS);
  };

  const setSteam = (enabled) =>
    send(
      () => setLaMarzoccoSteam(serial, enabled),
      (current) => ({steamBoiler: {...current.steamBoiler, enabled}}),
    );

  const setLevel = (level) =>
    send(
      () => setLaMarzoccoSteamLevel(serial, level),
      (current) => ({steamBoiler: {...current.steamBoiler, level}}),
    );

  const startBackflush = async () => {
    const ok = await send(() => startLaMarzoccoBackflush(serial));
    setConfirming(false);
    setStarted(ok);
  };

  const backflushNote = () => {
    if (offline) return translate('machineOffline', lang);
    if (started) return translate('backflushStarted', lang);
    if (flushing) return translate('backflushRunning', lang);
    if (!isOn) return translate('machineOffFirst', lang);
    if (backflush?.lastCleaned) {
      return `${translate('lastCleaned', lang)} ${formatDate(backflush.lastCleaned)}`;
    }
    return null;
  };
  const note = backflushNote();

  return (
    <Modal
      visible
      animationType="fade"
      transparent
      statusBarTranslucent
      navigationBarTranslucent
      onRequestClose={hide}>
      <View style={styles.overlay}>
        <Pressable style={StyleSheet.absoluteFill} onPress={hide} />
        <View style={styles.panel}>
          <View style={styles.header}>
            <Text style={styles.title} numberOfLines={1}>
              {machineName || lamarzocco.name || 'La Marzocco'}
            </Text>
            <TouchableOpacity onPress={hide} hitSlop={{top: 12, bottom: 12, left: 12, right: 12}}>
              <Icon name="close" size={sp(28)} color="#cccccc" />
            </TouchableOpacity>
          </View>

          {coffee?.temperature ? (
            <View style={styles.row}>
              <Text style={styles.label}>{translate('coffeeTemperature', lang)}</Text>
              <View style={styles.stepper}>
                <TouchableOpacity
                  style={styles.stepBtn}
                  disabled={offline}
                  accessibilityLabel="-"
                  onPress={() => stepTemp(-TEMP_STEP)}>
                  <Icon name="minus" size={sp(22)} color="#ffffff" />
                </TouchableOpacity>
                <Text style={styles.value}>{targetTemp.toFixed(1)}°C</Text>
                <TouchableOpacity
                  style={styles.stepBtn}
                  disabled={offline}
                  accessibilityLabel="+"
                  onPress={() => stepTemp(TEMP_STEP)}>
                  <Icon name="plus" size={sp(22)} color="#ffffff" />
                </TouchableOpacity>
              </View>
            </View>
          ) : null}

          {steam?.canToggle ? (
            <View style={styles.row}>
              <Text style={styles.label}>{translate('steam', lang)}</Text>
              <Switch
                value={!!steam.enabled}
                disabled={locked}
                onValueChange={setSteam}
                trackColor={{false: '#333', true: '#1B4781'}}
                thumbColor="#ffffff"
              />
            </View>
          ) : null}

          {steam?.level ? (
            <View style={styles.row}>
              <Text style={styles.label}>{translate('steamLevel', lang)}</Text>
              <View style={styles.levels}>
                {STEAM_LEVELS.map((level, i) => (
                  <TouchableOpacity
                    key={level}
                    style={[styles.level, steam.level === level && styles.levelOn]}
                    disabled={locked}
                    onPress={() => setLevel(level)}>
                    <Text style={styles.levelText}>{i + 1}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          ) : null}

          {backflush ? (
            <View style={styles.backflush}>
              <View style={styles.backflushRow}>
                <View style={styles.backflushText}>
                  <Text style={styles.label}>{translate('backflush', lang)}</Text>
                  {note && !confirming ? <Text style={styles.note}>{note}</Text> : null}
                </View>
                {confirming ? null : (
                  <TouchableOpacity
                    style={[styles.startBtn, (locked || !isOn || flushing) && styles.startBtnOff]}
                    disabled={locked || !isOn || flushing}
                    onPress={() => setConfirming(true)}>
                    <Text style={styles.startText}>{translate('startBackflush', lang)}</Text>
                  </TouchableOpacity>
                )}
              </View>
              {confirming ? (
                <View>
                  <Text style={styles.confirm}>{translate('backflushConfirm', lang)}</Text>
                  <View style={styles.confirmActions}>
                    <TouchableOpacity style={styles.cancelBtn} onPress={() => setConfirming(false)}>
                      <Text style={styles.cancelText}>{translate('cancel', lang)}</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={styles.startBtn} disabled={locked} onPress={startBackflush}>
                      <Text style={styles.startText}>{translate('startBackflush', lang)}</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              ) : null}
            </View>
          ) : null}

          {failed ? <Text style={styles.error}>{translate('commandFailed', lang)}</Text> : null}
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  panel: {
    width: '90%',
    maxWidth: sp(520),
    backgroundColor: '#16162a',
    borderRadius: 12,
    padding: sp(20),
    elevation: 24,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: sp(12),
    marginBottom: sp(8),
  },
  title: {
    flex: 1,
    color: '#ffffff',
    fontSize: fs(22),
    fontWeight: '700',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    minHeight: sp(56),
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#2e2e4a',
  },
  label: {
    color: '#e8e8f0',
    fontSize: fs(17),
  },
  value: {
    color: '#ffffff',
    fontSize: fs(18),
    fontWeight: '700',
    minWidth: sp(80),
    textAlign: 'center',
  },
  stepper: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: sp(8),
  },
  stepBtn: {
    width: sp(42),
    height: sp(42),
    borderRadius: sp(21),
    backgroundColor: '#2e2e4a',
    alignItems: 'center',
    justifyContent: 'center',
  },
  levels: {
    flexDirection: 'row',
    gap: sp(8),
  },
  level: {
    width: sp(42),
    height: sp(42),
    borderRadius: 8,
    backgroundColor: '#2e2e4a',
    alignItems: 'center',
    justifyContent: 'center',
  },
  levelOn: {
    backgroundColor: '#1B4781',
  },
  levelText: {
    color: '#ffffff',
    fontSize: fs(16),
    fontWeight: '700',
  },
  backflush: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#2e2e4a',
    paddingTop: sp(12),
  },
  backflushRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: sp(12),
  },
  backflushText: {
    flex: 1,
    minWidth: 0,
  },
  note: {
    color: '#9a9ab8',
    fontSize: fs(13),
    marginTop: 2,
  },
  startBtn: {
    backgroundColor: '#1B4781',
    borderRadius: 20,
    paddingVertical: sp(9),
    paddingHorizontal: sp(20),
  },
  startBtnOff: {
    backgroundColor: '#2e2e4a',
  },
  startText: {
    color: '#ffffff',
    fontSize: fs(15),
    fontWeight: '600',
  },
  confirm: {
    color: '#f0c674',
    fontSize: fs(15),
    lineHeight: fs(21),
    marginTop: sp(10),
  },
  confirmActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: sp(10),
    marginTop: sp(12),
  },
  cancelBtn: {
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#3a3a5a',
    paddingVertical: sp(9),
    paddingHorizontal: sp(20),
  },
  cancelText: {
    color: '#cccccc',
    fontSize: fs(15),
  },
  error: {
    color: '#ff8a80',
    fontSize: fs(14),
    marginTop: sp(12),
  },
});

export default LaMarzoccoPopup;
