import React, {useState} from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  FlatList,
  TouchableOpacity,
} from 'react-native';

const DropdownPicker = ({label, value, options, onValueChange, half, placeholder, disabled}) => {
  const [open, setOpen] = useState(false);

  const selectedOption = options.find(o => o.value === value);
  const displayText = selectedOption ? selectedOption.label : (placeholder || 'Select...');

  return (
    <View style={[styles.field, half && styles.halfField]}>
      {label ? <Text style={styles.label}>{label}</Text> : null}
      <TouchableOpacity style={[styles.selector, disabled && styles.selectorDisabled]} onPress={() => !disabled && setOpen(true)} activeOpacity={disabled ? 1 : 0.2}>
        <Text style={[styles.selectorText, !selectedOption && styles.placeholder]} numberOfLines={1}>
          {displayText}
        </Text>
        <Text style={styles.arrow}>▼</Text>
      </TouchableOpacity>

      <Modal
        visible={open}
        transparent
        animationType="fade"
        onRequestClose={() => setOpen(false)}>
        <TouchableOpacity
          style={styles.overlay}
          activeOpacity={1}
          onPress={() => setOpen(false)}>
          <View style={styles.dropdown}>
            <Text style={styles.dropdownTitle}>{label || 'Select'}</Text>
            <FlatList
              data={options}
              keyExtractor={(item, i) => String(item.value ?? i)}
              renderItem={({item}) => (
                <TouchableOpacity
                  style={[
                    styles.option,
                    item.value === value && styles.optionSelected,
                  ]}
                  onPress={() => {
                    onValueChange(item.value);
                    setOpen(false);
                  }}>
                  <Text
                    style={[
                      styles.optionText,
                      item.value === value && styles.optionTextSelected,
                    ]}>
                    {item.label}
                  </Text>
                </TouchableOpacity>
              )}
              style={styles.list}
            />
          </View>
        </TouchableOpacity>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  field: {
    marginBottom: 10,
  },
  halfField: {
    flex: 1,
  },
  label: {
    color: '#aaaaaa',
    fontSize: 12,
    marginBottom: 4,
  },
  selector: {
    backgroundColor: '#2a2a2a',
    borderRadius: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: '#333',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  selectorText: {
    color: '#ffffff',
    fontSize: 14,
    flex: 1,
  },
  placeholder: {
    color: '#666',
  },
  selectorDisabled: {
    opacity: 0.4,
  },
  arrow: {
    color: '#666',
    fontSize: 10,
    marginLeft: 8,
  },
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  dropdown: {
    width: '70%',
    maxHeight: '70%',
    backgroundColor: '#1a1a1a',
    borderRadius: 12,
    overflow: 'hidden',
  },
  dropdownTitle: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: 'bold',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#333',
  },
  list: {
    maxHeight: 400,
  },
  option: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#2a2a2a',
  },
  optionSelected: {
    backgroundColor: 'rgba(200, 200, 200, 0.15)',
  },
  optionText: {
    color: '#ffffff',
    fontSize: 14,
  },
  optionTextSelected: {
    color: '#cccccc',
    fontWeight: 'bold',
  },
});

export default DropdownPicker;
