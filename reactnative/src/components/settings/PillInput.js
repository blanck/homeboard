import React, {useState} from 'react';
import {View, Text, TextInput, TouchableOpacity, StyleSheet} from 'react-native';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';

const PillInput = ({value, onChange, placeholder}) => {
  const items = (value || '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  const [inputValue, setInputValue] = useState('');

  const commit = (next) => onChange(next.join(','));

  const addPills = (raw) => {
    const next = [...items];
    raw
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean)
      .forEach((s) => {
        if (!next.includes(s)) next.push(s);
      });
    commit(next);
  };

  const handleChange = (text) => {
    if (text.includes(',')) {
      const parts = text.split(',');
      const last = parts.pop();
      addPills(parts.join(','));
      setInputValue(last);
    } else {
      setInputValue(text);
    }
  };

  const handleSubmit = () => {
    if (inputValue.trim()) {
      addPills(inputValue);
      setInputValue('');
    }
  };

  const handleKey = (e) => {
    if (
      e.nativeEvent.key === 'Backspace' &&
      inputValue === '' &&
      items.length > 0
    ) {
      commit(items.slice(0, -1));
    }
  };

  const removePill = (idx) => {
    commit(items.filter((_, i) => i !== idx));
  };

  return (
    <View style={styles.container}>
      {items.map((item, i) => (
        <View key={`${item}-${i}`} style={styles.pill}>
          <Text style={styles.pillText}>{item}</Text>
          <TouchableOpacity
            onPress={() => removePill(i)}
            hitSlop={{top: 8, bottom: 8, left: 8, right: 8}}>
            <Icon name="close" size={14} color="#cce0ff" />
          </TouchableOpacity>
        </View>
      ))}
      <TextInput
        style={styles.input}
        value={inputValue}
        onChangeText={handleChange}
        onSubmitEditing={handleSubmit}
        onKeyPress={handleKey}
        placeholder={items.length === 0 ? placeholder : ''}
        placeholderTextColor="#666"
        blurOnSubmit={false}
        autoCorrect={false}
        autoCapitalize="none"
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    backgroundColor: '#2a2a2a',
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#333',
    paddingVertical: 4,
    paddingHorizontal: 6,
    gap: 6,
    minHeight: 36,
    alignItems: 'center',
  },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1B4781',
    borderRadius: 12,
    paddingLeft: 10,
    paddingRight: 6,
    paddingVertical: 4,
    gap: 4,
  },
  pillText: {
    color: '#ffffff',
    fontSize: 12,
  },
  input: {
    flexGrow: 1,
    minWidth: 80,
    color: '#ffffff',
    fontSize: 14,
    paddingVertical: 4,
    paddingHorizontal: 4,
  },
});

export default PillInput;
