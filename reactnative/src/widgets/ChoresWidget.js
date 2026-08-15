import React, {useState, useEffect, useCallback, useMemo} from 'react';
import {View, Text, StyleSheet, TouchableOpacity, ScrollView} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import WidgetCard from '../components/WidgetCard';
import useStore from '../store';
import {translate} from '../utils/translations';
import {fs} from '../utils/scale';
import {
  DEFAULT_ICON,
  choresForDate,
  completionKey,
  memberColor,
  pointsSince,
  pruneLog,
  resolveAssignee,
  uniqueLabels,
  weekStartMs,
} from '../utils/chores';

const STORAGE_KEY = '@homeboard_chores_log';

const Avatar = ({member, label, size = 26, selected, inverted}) => (
  <View
    style={[
      styles.avatar,
      {
        width: size,
        height: size,
        borderRadius: size / 2,
        backgroundColor: inverted ? '#ffffff' : member.color,
        opacity: selected === false ? 0.45 : 1,
      },
    ]}>
    <Text
      style={[
        styles.avatarText,
        {
          fontSize: fs(size * (label && label.length > 2 ? 0.32 : 0.42)),
          color: inverted ? member.color : '#ffffff',
        },
      ]}>
      {label}
    </Text>
  </View>
);

const ChoresWidget = () => {
  const config = useStore((s) => s.config);
  const lang = config.language || 'en';
  const members = useMemo(() => config.chores?.members || [], [config.chores]);
  const items = useMemo(() => config.chores?.items || [], [config.chores]);
  const showPoints = config.chores?.showPoints !== false;

  const labels = useMemo(() => uniqueLabels(members), [members]);
  const [log, setLog] = useState({});
  const [rawFilter, setFilter] = useState(null);
  // Drop the filter if that member was removed in settings
  const filter = members.some((m) => m.id === rawFilter) ? rawFilter : null;
  const [pickFor, setPickFor] = useState(null);
  // Rolls over at midnight so the list and period keys follow the day
  const [today, setToday] = useState(() => new Date());

  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY)
      .then((data) => {
        if (data) {
          setLog(pruneLog(JSON.parse(data), Date.now()));
        }
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    const timer = setInterval(() => {
      setToday((prev) => {
        const now = new Date();
        return now.getDate() === prev.getDate() ? prev : now;
      });
    }, 60 * 1000);
    return () => clearInterval(timer);
  }, []);

  const persist = useCallback((next) => {
    setLog(next);
    AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(next)).catch(() => {});
  }, []);

  const due = useMemo(
    () => choresForDate(items, log, today),
    [items, log, today],
  );

  const visible = useMemo(() => {
    const list = filter
      ? due.filter((chore) => {
          const done = log[completionKey(chore, today)];
          if (done) {
            return done.by === filter;
          }
          const owner = resolveAssignee(chore, members, today);
          return !owner || owner === filter;
        })
      : due;
    // Open chores first, completed ones sink to the bottom
    return [...list].sort(
      (a, b) =>
        (log[completionKey(a, today)] ? 1 : 0) -
        (log[completionKey(b, today)] ? 1 : 0),
    );
  }, [due, filter, log, members, today]);

  const doneCount = due.filter((c) => log[completionKey(c, today)]).length;

  const weekPoints = useMemo(() => {
    const since = weekStartMs(today);
    const map = {};
    members.forEach((m) => {
      map[m.id] = pointsSince(log, m.id, since);
    });
    return map;
  }, [log, members, today]);

  const complete = (chore, memberId) => {
    const key = completionKey(chore, today);
    persist({
      ...log,
      [key]: {by: memberId, at: Date.now(), points: chore.points || 0},
    });
    setPickFor(null);
  };

  const undo = (chore) => {
    const key = completionKey(chore, today);
    const next = {...log};
    delete next[key];
    persist(next);
  };

  const onPressChore = (chore) => {
    if (log[completionKey(chore, today)]) {
      undo(chore);
      return;
    }
    const who = filter || resolveAssignee(chore, members, today);
    if (who) {
      complete(chore, who);
    } else {
      setPickFor(pickFor === chore.id ? null : chore.id);
    }
  };

  if (!members.length || !items.length) {
    return (
      <WidgetCard variant="light">
        <Text style={styles.title}>{translate('chores', lang)}</Text>
        <View style={styles.empty}>
          <Icon name="broom" size={fs(28)} color="#7a8699" />
          <Text style={styles.emptyText}>
            {translate('choresSetupHint', lang)}
          </Text>
        </View>
      </WidgetCard>
    );
  }

  return (
    <WidgetCard variant="light">
      <View style={styles.header}>
        <Text style={styles.title}>{translate('chores', lang)}</Text>
        <Text style={styles.counter}>
          {doneCount}/{due.length}
        </Text>
      </View>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.chipRow}
        contentContainerStyle={styles.chipRowContent}>
        <TouchableOpacity
          style={[styles.chip, !filter && styles.chipAllActive]}
          onPress={() => setFilter(null)}>
          <Text style={[styles.chipName, !filter && styles.chipNameActive]}>
            {translate('everyone', lang)}
          </Text>
        </TouchableOpacity>
        {members.map((m) => {
          const active = filter === m.id;
          return (
            <TouchableOpacity
              key={m.id}
              style={[styles.chip, active && {backgroundColor: m.color}]}
              onPress={() => setFilter(active ? null : m.id)}>
              <Avatar
                member={m}
                label={labels[m.id]}
                size={22}
                selected={!filter || active}
                inverted={active}
              />
              <Text style={[styles.chipName, active && styles.chipNameActive]}>
                {m.name}
              </Text>
              {showPoints ? (
                <Text
                  style={[
                    styles.chipPoints,
                    {color: active ? '#ffffff' : m.color},
                  ]}>
                  {weekPoints[m.id] || 0}
                </Text>
              ) : null}
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      <ScrollView style={styles.list} showsVerticalScrollIndicator={false}>
        {visible.length === 0 ? (
          <View style={styles.empty}>
            <Icon name="check-all" size={fs(26)} color="#5a8f5a" />
            <Text style={styles.emptyText}>{translate('allDone', lang)}</Text>
          </View>
        ) : null}

        {visible.map((chore) => {
          const done = log[completionKey(chore, today)];
          const owner = done
            ? done.by
            : filter || resolveAssignee(chore, members, today);
          const color = owner ? memberColor(members, owner) : '#7a8699';
          const picking = pickFor === chore.id;
          return (
            <View key={chore.id}>
              <TouchableOpacity
                style={[
                  styles.row,
                  {borderLeftColor: color},
                  done && styles.rowDone,
                ]}
                onPress={() => onPressChore(chore)}>
                <Icon
                  name={done ? 'check-circle' : chore.icon || DEFAULT_ICON}
                  size={fs(22)}
                  color={done ? color : '#556'}
                />
                <Text
                  style={[styles.name, done && styles.nameDone]}
                  numberOfLines={1}>
                  {chore.name}
                </Text>
                {owner && !done ? (
                  <Avatar
                    member={members.find((m) => m.id === owner)}
                    label={labels[owner]}
                    size={22}
                  />
                ) : null}
                {done ? (
                  <Text style={[styles.by, {color}]} numberOfLines={1}>
                    {(members.find((m) => m.id === done.by) || {}).name || ''}
                  </Text>
                ) : null}
                {showPoints && chore.points ? (
                  <View style={[styles.pointsPill, done && {backgroundColor: color}]}>
                    <Text
                      style={[styles.pointsText, done && styles.pointsTextDone]}>
                      {chore.points}
                    </Text>
                  </View>
                ) : null}
              </TouchableOpacity>

              {picking ? (
                <View style={styles.pickRow}>
                  <Text style={styles.pickLabel}>
                    {translate('whoDidIt', lang)}
                  </Text>
                  {members.map((m) => (
                    <TouchableOpacity
                      key={m.id}
                      style={styles.pickPill}
                      onPress={() => complete(chore, m.id)}>
                      <Avatar member={m} label={labels[m.id]} size={24} />
                      <Text style={styles.pickName} numberOfLines={1}>
                        {m.name}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              ) : null}
            </View>
          );
        })}
      </ScrollView>
    </WidgetCard>
  );
};

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  title: {
    fontSize: fs(12),
    fontWeight: '500',
    color: '#555555',
    textTransform: 'uppercase',
  },
  counter: {
    fontSize: fs(13),
    fontWeight: '600',
    color: '#445566',
  },
  chipRow: {
    flexGrow: 0,
    flexShrink: 0,
    marginTop: 4,
    marginBottom: 2,
  },
  chipRowContent: {
    alignItems: 'center',
    gap: 7,
    paddingHorizontal: 4,
    // room for the pill shadow, which elevation clips at the content edge
    paddingVertical: 5,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: 'rgba(255,255,255,0.6)',
    borderRadius: 16,
    paddingHorizontal: 9,
    paddingVertical: 4,
    // avatar (22) + padding, so the text-only All pill matches the name pills
    minHeight: 30,
    shadowColor: '#000000',
    shadowOffset: {width: 0, height: 1},
    shadowOpacity: 0.16,
    shadowRadius: 2,
    elevation: 2,
  },
  chipAllActive: {
    backgroundColor: '#445566',
  },
  chipName: {
    fontSize: fs(13),
    color: '#445566',
  },
  chipNameActive: {
    color: '#ffffff',
    fontWeight: '600',
  },
  chipPoints: {
    fontSize: fs(13),
    fontWeight: 'bold',
  },
  list: {
    flex: 1,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: 'rgba(230, 230, 230, 0.2)',
    borderRadius: 4,
    borderLeftWidth: 5,
    marginVertical: 2,
    marginHorizontal: 4,
    paddingHorizontal: 8,
    height: 38,
  },
  rowDone: {
    opacity: 0.45,
  },
  name: {
    flex: 1,
    fontSize: fs(15),
    color: '#333333',
  },
  nameDone: {
    textDecorationLine: 'line-through',
    color: '#667',
  },
  by: {
    fontSize: fs(12),
    fontWeight: '600',
    maxWidth: '25%',
  },
  pointsPill: {
    minWidth: 26,
    alignItems: 'center',
    borderRadius: 4,
    backgroundColor: 'rgba(120, 134, 153, 0.25)',
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  pointsText: {
    fontSize: fs(12),
    fontWeight: 'bold',
    color: '#445566',
  },
  pointsTextDone: {
    color: '#ffffff',
  },
  pickRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 8,
    marginHorizontal: 4,
    marginBottom: 4,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 4,
    backgroundColor: 'rgba(255,255,255,0.4)',
  },
  pickLabel: {
    fontSize: fs(12),
    color: '#445566',
    marginRight: 2,
  },
  pickPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderRadius: 16,
    backgroundColor: '#ffffff',
    paddingLeft: 3,
    paddingRight: 10,
    paddingVertical: 3,
    shadowColor: '#000000',
    shadowOffset: {width: 0, height: 1},
    shadowOpacity: 0.16,
    shadowRadius: 2,
    elevation: 2,
  },
  pickName: {
    fontSize: fs(13),
    fontWeight: '600',
    color: '#334',
  },
  avatar: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    color: '#ffffff',
    fontWeight: 'bold',
  },
  empty: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 18,
  },
  emptyText: {
    fontSize: fs(13),
    color: '#556',
    textAlign: 'center',
    paddingHorizontal: 12,
  },
});

export default ChoresWidget;
