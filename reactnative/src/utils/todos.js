import AsyncStorage from '@react-native-async-storage/async-storage';
import useStore from '../store';

export const TODOS_KEY = '@homeboard_todos';

// Adds items the list does not already have open; returns how many were added
export const addTodos = async (texts) => {
  let todos = [];
  try {
    todos = JSON.parse((await AsyncStorage.getItem(TODOS_KEY)) || '[]');
  } catch {}
  const open = new Set(todos.filter((t) => !t.doneAt).map((t) => t.text.toLowerCase()));
  const now = Date.now();
  const added = [];
  for (const text of texts.map((t) => t.trim()).filter(Boolean)) {
    if (open.has(text.toLowerCase())) continue;
    open.add(text.toLowerCase());
    added.push({id: now + added.length, text, doneAt: null});
  }
  if (!added.length) return 0;
  await AsyncStorage.setItem(TODOS_KEY, JSON.stringify([...added, ...todos]));
  useStore.getState().bumpTodos();
  return added.length;
};
