import React, {useState, useEffect, useCallback} from 'react';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import WidgetCard from '../components/WidgetCard';
import useStore from '../store';
import {translate} from '../utils/translations';
import {fs} from '../utils/scale';

const STORAGE_KEY = '@homeboard_todos';
const EXPIRE_MS = 60 * 60 * 1000; // 1 hour

const TodoWidget = () => {
  const config = useStore((s) => s.config);
  const lang = config.language || 'en';
  const [todos, setTodos] = useState([]);
  const [adding, setAdding] = useState(false);
  const [input, setInput] = useState('');

  // Load from storage
  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY).then((data) => {
      if (data) {
        setTodos(JSON.parse(data));
      }
    });
  }, []);

  // Clean up expired checked items every minute
  useEffect(() => {
    const timer = setInterval(() => {
      setTodos((prev) => {
        const now = Date.now();
        const next = prev.filter(
          (t) => !t.doneAt || now - t.doneAt < EXPIRE_MS,
        );
        if (next.length !== prev.length) {
          AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(next));
        }
        return next;
      });
    }, 60 * 1000);
    return () => clearInterval(timer);
  }, []);

  const persist = useCallback((next) => {
    setTodos(next);
    AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  }, []);

  const addTodo = () => {
    const text = input.trim();
    if (!text) {
      setAdding(false);
      return;
    }
    persist([{id: Date.now(), text, doneAt: null}, ...todos]);
    setInput('');
    setAdding(false);
  };

  const removeTodo = (id) => {
    persist(todos.filter((t) => t.id !== id));
  };

  const toggleTodo = (id) => {
    persist(
      todos.map((t) =>
        t.id === id ? {...t, doneAt: t.doneAt ? null : Date.now()} : t,
      ),
    );
  };

  const pending = todos.filter((t) => !t.doneAt);
  const done = todos.filter((t) => t.doneAt);

  return (
    <WidgetCard variant="light">
      <View style={styles.headerRow}>
        <Text style={styles.title}>{translate('todo', lang)}</Text>
        {!adding && (
          <TouchableOpacity onPress={() => setAdding(true)}>
            <Icon name="plus" size={30} color="#333" />
          </TouchableOpacity>
        )}
      </View>

      {adding && (
        <View style={styles.inputRow}>
          <TextInput
            style={styles.input}
            value={input}
            onChangeText={setInput}
            placeholder={translate('addTodo', lang)}
            placeholderTextColor="#999"
            autoFocus
            onSubmitEditing={addTodo}
            onBlur={() => { if (!input.trim()) setAdding(false); }}
            returnKeyType="done"
          />
          <TouchableOpacity onPress={addTodo} style={styles.addBtn}>
            <Icon name="check-circle" size={28} color="#555" />
          </TouchableOpacity>
        </View>
      )}

      <ScrollView style={styles.list} showsVerticalScrollIndicator={false}>
        {pending.map((todo) => (
          <TouchableOpacity
            key={todo.id}
            style={styles.row}
            onPress={() => toggleTodo(todo.id)}>
            <Icon name="circle-outline" size={24} color="#555" />
            <Text style={styles.todoText}>{todo.text}</Text>
          </TouchableOpacity>
        ))}
        {done.map((todo) => (
          <TouchableOpacity
            key={todo.id}
            style={[styles.row, styles.doneRow]}
            onPress={() => toggleTodo(todo.id)}>
            <Icon name="check-circle" size={24} color="#555" />
            <Text style={[styles.todoText, styles.doneText]}>{todo.text}</Text>
            <TouchableOpacity onPress={() => removeTodo(todo.id)}>
              <Icon name="trash-can-outline" size={18} color="#555" />
            </TouchableOpacity>
          </TouchableOpacity>
        ))}
      </ScrollView>
    </WidgetCard>
  );
};

const styles = StyleSheet.create({
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  title: {
    fontSize: fs(12),
    fontWeight: '500',
    color: '#555555',
    textTransform: 'uppercase',
  },
  list: {
    flex: 1,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 6,
    paddingHorizontal: 4,
    gap: 10,
  },
  doneRow: {
    opacity: 0.4,
  },
  todoText: {
    flex: 1,
    fontSize: fs(17),
    color: '#333',
  },
  doneText: {
    textDecorationLine: 'line-through',
    color: '#888',
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
  },
  input: {
    flex: 1,
    backgroundColor: 'rgba(255,255,255,0.5)',
    borderRadius: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
    fontSize: fs(16),
    color: '#333',
  },
  addBtn: {
    marginLeft: 8,
  },
});

export default TodoWidget;
