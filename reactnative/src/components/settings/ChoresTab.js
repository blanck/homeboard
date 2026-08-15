import React, {useState} from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  Switch,
  StyleSheet,
  Modal,
  ScrollView,
} from 'react-native';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import {translate} from '../../utils/translations';
import DropdownPicker from './DropdownPicker';
import {
  CHORE_ICONS,
  DEFAULT_ICON,
  MEMBER_COLORS,
  choreFromPreset,
  newId,
} from '../../utils/chores';
import {CHORE_LIBRARY, libraryChoreName} from '../../utils/choreLibrary';

const ChoresTab = ({form, updateField, lang, Section}) => {
  const [iconFor, setIconFor] = useState(null);
  const [libraryOpen, setLibraryOpen] = useState(false);
  // Only the chore being edited unfolds, so the tab stays short enough to
  // drag-scroll (a full-width TextInput swallows the scroll gesture)
  const [expanded, setExpanded] = useState(null);
  const members = form.choreMembers || [];
  const items = form.choreItems || [];

  const weekdays = translate('weekdaysShort', lang);

  const setMembers = (fn) => updateField('choreMembers', (prev) => fn(prev || []));
  const setItems = (fn) => updateField('choreItems', (prev) => fn(prev || []));

  const addMember = () => {
    setMembers((prev) => [
      ...prev,
      {
        id: newId('m'),
        name: '',
        color: MEMBER_COLORS[prev.length % MEMBER_COLORS.length],
      },
    ]);
  };

  const patchMember = (id, patch) =>
    setMembers((prev) => prev.map((m) => (m.id === id ? {...m, ...patch} : m)));

  const removeMember = (id) => {
    setMembers((prev) => prev.filter((m) => m.id !== id));
    setItems((prev) =>
      prev.map((c) =>
        c.assignee === id
          ? {...c, assignee: ''}
          : {
              ...c,
              rotateMembers: (c.rotateMembers || []).filter((x) => x !== id),
            },
      ),
    );
  };

  const cycleColor = (m) => {
    const i = MEMBER_COLORS.indexOf(m.color);
    patchMember(m.id, {
      color: MEMBER_COLORS[(i + 1) % MEMBER_COLORS.length],
    });
  };

  const addChore = () => {
    const chore = {
      id: newId('c'),
      name: '',
      icon: DEFAULT_ICON,
      points: 2,
      assignee: '',
      rotateMembers: [],
      recurrence: 'daily',
      days: [],
      dayOfMonth: 1,
    };
    setItems((prev) => [...prev, chore]);
    setExpanded(chore.id);
  };

  const patchChore = (id, patch) =>
    setItems((prev) => prev.map((c) => (c.id === id ? {...c, ...patch} : c)));

  const removeChore = (id) => setItems((prev) => prev.filter((c) => c.id !== id));

  const matchesPreset = (chore, preset) =>
    chore.libKey === preset.key ||
    chore.name.trim().toLowerCase() ===
      libraryChoreName(preset, lang).toLowerCase();

  const presetAdded = (preset) => items.some((c) => matchesPreset(c, preset));

  const togglePreset = (preset) => {
    setItems((prev) =>
      prev.some((c) => matchesPreset(c, preset))
        ? prev.filter((c) => !matchesPreset(c, preset))
        : [...prev, choreFromPreset(preset, lang, prev.length)],
    );
  };

  const toggleDay = (chore, day) => {
    const days = chore.days || [];
    patchChore(chore.id, {
      days: days.includes(day)
        ? days.filter((d) => d !== day)
        : [...days, day].sort(),
    });
  };

  const assigneeOptions = [
    {label: translate('anyone', lang), value: ''},
    {label: translate('rotate', lang), value: 'rotate'},
    ...members
      .filter((m) => m.name)
      .map((m) => ({label: m.name, value: m.id})),
  ];

  const recurrenceOptions = [
    {label: translate('daily', lang), value: 'daily'},
    {label: translate('weekly', lang), value: 'weekly'},
    {label: translate('monthly', lang), value: 'monthly'},
    {label: translate('once', lang), value: 'once'},
  ];

  const summarize = (chore) => {
    const who =
      (assigneeOptions.find((o) => o.value === (chore.assignee || '')) || {})
        .label || '';
    let when = translate(chore.recurrence || 'daily', lang);
    if (chore.recurrence === 'weekly' && (chore.days || []).length) {
      when = chore.days.map((d) => weekdays[d]).join(' ');
    } else if (chore.recurrence === 'monthly') {
      when = `${when} ${chore.dayOfMonth || 1}`;
    }
    return `${who} · ${when}`;
  };

  return (
    <View>
      <Section title={translate('familyMembers', lang)}>
        {members.map((m) => (
          <View key={m.id} style={styles.memberRow}>
            <TouchableOpacity
              style={[styles.swatch, {backgroundColor: m.color}]}
              onPress={() => cycleColor(m)}
            />
            <TextInput
              style={styles.memberInput}
              value={m.name}
              onChangeText={(v) => patchMember(m.id, {name: v})}
              placeholder={translate('memberName', lang)}
              placeholderTextColor="#666"
            />
            <TouchableOpacity
              style={styles.iconBtn}
              onPress={() => removeMember(m.id)}>
              <Icon name="trash-can-outline" size={18} color="#a55" />
            </TouchableOpacity>
          </View>
        ))}
        <TouchableOpacity style={styles.addBtn} onPress={addMember}>
          <Icon name="account-plus-outline" size={16} color="#ffffff" />
          <Text style={styles.addBtnText}>{translate('addMember', lang)}</Text>
        </TouchableOpacity>
        <Text style={styles.hint}>{translate('membersHint', lang)}</Text>
      </Section>

      <Section title={translate('chores', lang)}>
        {items.map((chore) => {
          const open = expanded === chore.id;
          return (
            <View key={chore.id} style={styles.choreCard}>
              <TouchableOpacity
                style={styles.choreRow}
                onPress={() => setExpanded(open ? null : chore.id)}>
                <Icon
                  name={chore.icon || DEFAULT_ICON}
                  size={20}
                  color="#cccccc"
                />
                <Text style={styles.choreRowName} numberOfLines={1}>
                  {chore.name || translate('choreName', lang)}
                </Text>
                <Text style={styles.choreRowMeta} numberOfLines={1}>
                  {summarize(chore)}
                </Text>
                <View style={styles.pointsBadge}>
                  <Text style={styles.pointsBadgeText}>{chore.points || 0}</Text>
                </View>
                <Icon
                  name={open ? 'chevron-up' : 'chevron-down'}
                  size={20}
                  color="#888"
                />
              </TouchableOpacity>

              {open ? (
                <View style={styles.editor}>
                  <View style={styles.choreTop}>
                    <TouchableOpacity
                      style={styles.choreIconBtn}
                      onPress={() =>
                        setIconFor(iconFor === chore.id ? null : chore.id)
                      }>
                      <Icon
                        name={chore.icon || DEFAULT_ICON}
                        size={20}
                        color="#cccccc"
                      />
                    </TouchableOpacity>
                    <TextInput
                      style={styles.choreInput}
                      value={chore.name}
                      onChangeText={(v) => patchChore(chore.id, {name: v})}
                      placeholder={translate('choreName', lang)}
                      placeholderTextColor="#666"
                      autoFocus={!chore.name}
                    />
                    <TextInput
                      style={styles.pointsInput}
                      value={String(chore.points ?? '')}
                      onChangeText={(v) =>
                        patchChore(chore.id, {points: parseInt(v, 10) || 0})
                      }
                      keyboardType="numeric"
                      placeholder={translate('points', lang)}
                      placeholderTextColor="#666"
                    />
                    <TouchableOpacity
                      style={styles.iconBtn}
                      onPress={() => removeChore(chore.id)}>
                      <Icon name="trash-can-outline" size={18} color="#a55" />
                    </TouchableOpacity>
                  </View>

                  {iconFor === chore.id ? (
                    <View style={styles.iconGrid}>
                      {CHORE_ICONS.map((name) => (
                        <TouchableOpacity
                          key={name}
                          style={[
                            styles.iconChoice,
                            chore.icon === name && styles.iconChoiceActive,
                          ]}
                          onPress={() => {
                            patchChore(chore.id, {icon: name});
                            setIconFor(null);
                          }}>
                          <Icon name={name} size={20} color="#cccccc" />
                        </TouchableOpacity>
                      ))}
                    </View>
                  ) : null}

                  <View style={styles.choreBottom}>
                    <View style={styles.pickerCol}>
                      <DropdownPicker
                        label={translate('assignee', lang)}
                        value={chore.assignee || ''}
                        options={assigneeOptions}
                        onValueChange={(v) =>
                          patchChore(chore.id, {assignee: v})
                        }
                      />
                    </View>
                    <View style={styles.pickerCol}>
                      <DropdownPicker
                        label={translate('repeats', lang)}
                        value={chore.recurrence || 'daily'}
                        options={recurrenceOptions}
                        onValueChange={(v) =>
                          patchChore(chore.id, {recurrence: v})
                        }
                      />
                    </View>
                    {chore.recurrence === 'weekly' ? (
                      <View style={styles.dayCol}>
                        <Text style={styles.label}>
                          {translate('onDays', lang)}
                        </Text>
                        <View style={styles.dayRow}>
                          {[1, 2, 3, 4, 5, 6, 0].map((d) => {
                            const on = (chore.days || []).includes(d);
                            return (
                              <TouchableOpacity
                                key={d}
                                style={[styles.day, on && styles.dayOn]}
                                onPress={() => toggleDay(chore, d)}>
                                <Text
                                  style={[
                                    styles.dayText,
                                    on && styles.dayTextOn,
                                  ]}>
                                  {weekdays[d]}
                                </Text>
                              </TouchableOpacity>
                            );
                          })}
                        </View>
                      </View>
                    ) : null}
                    {chore.recurrence === 'monthly' ? (
                      <View style={styles.dayCol}>
                        <Text style={styles.label}>
                          {translate('dayOfMonth', lang)}
                        </Text>
                        <TextInput
                          style={styles.monthInput}
                          value={String(chore.dayOfMonth || 1)}
                          onChangeText={(v) =>
                            patchChore(chore.id, {
                              dayOfMonth: Math.min(
                                31,
                                Math.max(1, parseInt(v, 10) || 1),
                              ),
                            })
                          }
                          keyboardType="numeric"
                        />
                      </View>
                    ) : null}
                  </View>
                </View>
              ) : null}
            </View>
          );
        })}

        <View style={styles.actionRow}>
          <TouchableOpacity
            style={[styles.addBtn, styles.starterBtn]}
            onPress={() => setLibraryOpen(true)}>
            <Icon name="playlist-plus" size={16} color="#ffffff" />
            <Text style={styles.addBtnText}>{translate('quickAdd', lang)}</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.addBtn} onPress={addChore}>
            <Icon name="plus" size={16} color="#ffffff" />
            <Text style={styles.addBtnText}>{translate('addChore', lang)}</Text>
          </TouchableOpacity>
        </View>
      </Section>

      <Modal
        visible={libraryOpen}
        transparent
        animationType="fade"
        statusBarTranslucent={true}
        navigationBarTranslucent={true}
        onRequestClose={() => setLibraryOpen(false)}>
        <View style={styles.libOverlay}>
          <View style={styles.libModal}>
            <View style={styles.libHeader}>
              <Text style={styles.libTitle}>{translate('quickAdd', lang)}</Text>
              <TouchableOpacity onPress={() => setLibraryOpen(false)}>
                <Icon name="close" size={24} color="#cccccc" />
              </TouchableOpacity>
            </View>
            <Text style={styles.libHint}>{translate('quickAddHint', lang)}</Text>
            <ScrollView style={styles.libBody}>
              {CHORE_LIBRARY.map((group) => (
                <View key={group.key} style={styles.libGroup}>
                  <Text style={styles.libGroupTitle}>
                    {group.label[lang] || group.label.en}
                  </Text>
                  <View style={styles.libChips}>
                    {group.chores.map((preset) => {
                      const added = presetAdded(preset);
                      return (
                        <TouchableOpacity
                          key={preset.key}
                          style={[styles.libChip, added && styles.libChipOn]}
                          onPress={() => togglePreset(preset)}>
                          <Icon
                            name={added ? 'check' : preset.icon}
                            size={18}
                            color={added ? '#ffffff' : '#cccccc'}
                          />
                          <Text
                            style={[
                              styles.libChipText,
                              added && styles.libChipTextOn,
                            ]}>
                            {libraryChoreName(preset, lang)}
                          </Text>
                          <Text style={styles.libChipPoints}>
                            {preset.points}
                          </Text>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                </View>
              ))}
            </ScrollView>
            <TouchableOpacity
              style={styles.libDone}
              onPress={() => setLibraryOpen(false)}>
              <Text style={styles.addBtnText}>
                {translate('done', lang)} ({items.length})
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      <View style={styles.switchRow}>
        <Switch
          value={form.choresShowPoints !== false}
          onValueChange={(v) => updateField('choresShowPoints', v)}
          trackColor={{false: '#333', true: '#1B4781'}}
          thumbColor="#ffffff"
        />
        <Text style={styles.switchLabel}>{translate('showPoints', lang)}</Text>
      </View>
      <Text style={styles.hint}>{translate('choresHint', lang)}</Text>
    </View>
  );
};

const styles = StyleSheet.create({
  memberRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
  },
  swatch: {
    width: 28,
    height: 28,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#444',
  },
  memberInput: {
    flex: 1,
    maxWidth: 300,
    backgroundColor: '#2a2a2a',
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#333',
    paddingHorizontal: 12,
    paddingVertical: 8,
    color: '#ffffff',
    fontSize: 14,
  },
  iconBtn: {
    padding: 6,
  },
  addBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    alignSelf: 'flex-start',
    backgroundColor: '#3a3a3a',
    borderRadius: 6,
    paddingVertical: 8,
    paddingHorizontal: 14,
  },
  starterBtn: {
    backgroundColor: '#1B4781',
  },
  addBtnText: {
    color: '#ffffff',
    fontSize: 13,
    fontWeight: '600',
  },
  actionRow: {
    flexDirection: 'row',
    gap: 10,
  },
  libOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  libModal: {
    width: '80%',
    height: '85%',
    backgroundColor: '#1a1a1a',
    borderRadius: 12,
    overflow: 'hidden',
  },
  libHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 16,
  },
  libTitle: {
    color: '#ffffff',
    fontSize: 18,
    fontWeight: 'bold',
  },
  libHint: {
    color: '#666',
    fontSize: 12,
    paddingHorizontal: 16,
    paddingTop: 4,
    fontStyle: 'italic',
  },
  libBody: {
    flex: 1,
    paddingHorizontal: 16,
    paddingTop: 12,
  },
  libGroup: {
    marginBottom: 16,
  },
  libGroupTitle: {
    color: '#cccccc',
    fontSize: 13,
    fontWeight: '600',
    textTransform: 'uppercase',
    marginBottom: 8,
  },
  libChips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  libChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#2a2a2a',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#333',
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  libChipOn: {
    backgroundColor: '#1B4781',
    borderColor: '#2f6bb5',
  },
  libChipText: {
    color: '#dddddd',
    fontSize: 13,
  },
  libChipTextOn: {
    color: '#ffffff',
    fontWeight: '600',
  },
  libChipPoints: {
    color: '#777',
    fontSize: 12,
    fontWeight: 'bold',
  },
  libDone: {
    margin: 16,
    backgroundColor: '#3a3a3a',
    borderRadius: 6,
    paddingVertical: 12,
    alignItems: 'center',
  },
  hint: {
    color: '#666',
    fontSize: 11,
    marginTop: 8,
    fontStyle: 'italic',
  },
  choreCard: {
    backgroundColor: '#222222',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#2f2f2f',
    marginBottom: 6,
    overflow: 'hidden',
  },
  choreRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 10,
    paddingVertical: 9,
  },
  choreRowName: {
    flex: 1,
    color: '#ffffff',
    fontSize: 14,
  },
  choreRowMeta: {
    color: '#888',
    fontSize: 12,
    maxWidth: '40%',
  },
  pointsBadge: {
    minWidth: 28,
    alignItems: 'center',
    borderRadius: 4,
    backgroundColor: '#2f2f2f',
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  pointsBadgeText: {
    color: '#cccccc',
    fontSize: 12,
    fontWeight: 'bold',
  },
  editor: {
    paddingHorizontal: 10,
    paddingBottom: 10,
    borderTopWidth: 1,
    borderTopColor: '#2f2f2f',
    paddingTop: 10,
  },
  choreTop: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  choreIconBtn: {
    width: 34,
    height: 34,
    borderRadius: 6,
    backgroundColor: '#2a2a2a',
    borderWidth: 1,
    borderColor: '#333',
    alignItems: 'center',
    justifyContent: 'center',
  },
  choreInput: {
    flex: 1,
    maxWidth: 420,
    backgroundColor: '#2a2a2a',
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#333',
    paddingHorizontal: 12,
    paddingVertical: 8,
    color: '#ffffff',
    fontSize: 14,
  },
  pointsInput: {
    width: 54,
    backgroundColor: '#2a2a2a',
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#333',
    paddingHorizontal: 8,
    paddingVertical: 8,
    color: '#ffffff',
    fontSize: 14,
    textAlign: 'center',
  },
  iconGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 8,
  },
  iconChoice: {
    width: 34,
    height: 34,
    borderRadius: 6,
    backgroundColor: '#2a2a2a',
    borderWidth: 1,
    borderColor: '#333',
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconChoiceActive: {
    borderColor: '#cccccc',
  },
  choreBottom: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    marginTop: 8,
  },
  pickerCol: {
    width: 130,
  },
  dayCol: {
    flex: 1,
  },
  label: {
    color: '#aaaaaa',
    fontSize: 12,
    marginBottom: 4,
  },
  dayRow: {
    flexDirection: 'row',
    gap: 4,
  },
  day: {
    width: 32,
    paddingVertical: 8,
    borderRadius: 6,
    backgroundColor: '#2a2a2a',
    borderWidth: 1,
    borderColor: '#333',
    alignItems: 'center',
  },
  dayOn: {
    backgroundColor: '#1B4781',
    borderColor: '#2f6bb5',
  },
  dayText: {
    color: '#888',
    fontSize: 12,
    fontWeight: '600',
  },
  dayTextOn: {
    color: '#ffffff',
  },
  monthInput: {
    width: 60,
    backgroundColor: '#2a2a2a',
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#333',
    paddingHorizontal: 8,
    paddingVertical: 8,
    color: '#ffffff',
    fontSize: 14,
    textAlign: 'center',
  },
  switchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 4,
  },
  switchLabel: {
    color: '#aaaaaa',
    fontSize: 14,
  },
});

export default ChoresTab;
