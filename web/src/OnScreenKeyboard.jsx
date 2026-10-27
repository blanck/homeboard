// On-screen keyboard for the Pi kiosk.
//
// X11 gives Chromium no soft keyboard, and a separate X window (matchbox) can
// never be seen: --kiosk puts the browser in openbox's fullscreen layer, which
// nothing can stack above. Rendering the keyboard inside the page sidesteps the
// window manager entirely.
//
// Web-only, and the phone never shows it: those have a real keyboard.
import React, {useCallback, useEffect, useRef, useState} from 'react';
import {createPortal} from 'react-dom';
import useStore from '@homeboard/rn/store';

const ROWS = [
  ['1', '2', '3', '4', '5', '6', '7', '8', '9', '0'],
  ['q', 'w', 'e', 'r', 't', 'y', 'u', 'i', 'o', 'p', 'å'],
  ['a', 's', 'd', 'f', 'g', 'h', 'j', 'k', 'l', 'ö', 'ä'],
  ['z', 'x', 'c', 'v', 'b', 'n', 'm', '.', '-', '@'],
];

const isTextField = (el) => {
  if (!el) return false;
  if (el.isContentEditable) return true;
  if (el.tagName === 'TEXTAREA') return true;
  if (el.tagName !== 'INPUT') return false;
  if (el.readOnly || el.disabled) return false;
  return !['checkbox', 'radio', 'range', 'color', 'button', 'submit'].includes(el.type);
};

// React tracks the input value on the node, so assigning `.value` directly is
// ignored on the next render. Go through the prototype setter and fire `input`
// so onChangeText runs exactly as if the user had typed.
const setNativeValue = (el, value) => {
  const proto = el.tagName === 'TEXTAREA' ? window.HTMLTextAreaElement : window.HTMLInputElement;
  const setter = Object.getOwnPropertyDescriptor(proto.prototype, 'value')?.set;
  if (setter) setter.call(el, value);
  else el.value = value;
  el.dispatchEvent(new Event('input', {bubbles: true}));
};

const editField = (el, transform) => {
  const value = el.value ?? '';
  const start = el.selectionStart ?? value.length;
  const end = el.selectionEnd ?? value.length;
  const {next, caret} = transform(value, start, end);
  setNativeValue(el, next);
  try {
    el.setSelectionRange(caret, caret);
  } catch {
    // number inputs disallow selection ranges; caret position is cosmetic
  }
};

const OnScreenKeyboard = () => {
  // Off unless this device is known to lack a native keyboard. There is no way
  // to detect that: a Pi touchscreen on X11 has touch but no OS keyboard, so it
  // looks identical to a phone that has one.
  const enabled = useStore((s) => s.config.showOnScreenKeyboard) === true;
  const [visible, setVisible] = useState(false);
  const [shift, setShift] = useState(false);
  const targetRef = useRef(null);
  const hideTimer = useRef(null);

  useEffect(() => {
    const onFocusIn = (event) => {
      if (!isTextField(event.target)) return;
      clearTimeout(hideTimer.current);
      targetRef.current = event.target;
      setVisible(true);
    };
    // Tabbing between fields blurs before it focuses, so settle first rather
    // than flapping the keyboard shut between two inputs.
    const onFocusOut = (event) => {
      if (!isTextField(event.target)) return;
      clearTimeout(hideTimer.current);
      hideTimer.current = setTimeout(() => {
        if (!isTextField(document.activeElement)) {
          setVisible(false);
          setShift(false);
          targetRef.current = null;
        }
      }, 250);
    };
    document.addEventListener('focusin', onFocusIn);
    document.addEventListener('focusout', onFocusOut);
    return () => {
      document.removeEventListener('focusin', onFocusIn);
      document.removeEventListener('focusout', onFocusOut);
      clearTimeout(hideTimer.current);
    };
  }, []);

  const press = useCallback(
    (key) => {
      const el = targetRef.current;
      if (!el) return;
      editField(el, (value, start, end) => ({
        next: value.slice(0, start) + key + value.slice(end),
        caret: start + key.length,
      }));
      if (shift) setShift(false);
    },
    [shift],
  );

  const backspace = useCallback(() => {
    const el = targetRef.current;
    if (!el) return;
    editField(el, (value, start, end) => {
      if (start !== end) return {next: value.slice(0, start) + value.slice(end), caret: start};
      if (start === 0) return {next: value, caret: 0};
      return {next: value.slice(0, start - 1) + value.slice(start), caret: start - 1};
    });
  }, []);

  const submit = useCallback(() => {
    const el = targetRef.current;
    if (!el) return;
    el.dispatchEvent(new KeyboardEvent('keydown', {key: 'Enter', bubbles: true}));
    el.blur();
  }, []);

  if (!enabled || !visible) return null;

  // Keep focus in the field: a mousedown on a key would otherwise blur it
  const hold = (event) => event.preventDefault();

  const Key = ({label, onPress, flex = 1, wide}) => (
    <button
      type="button"
      onMouseDown={hold}
      onTouchStart={hold}
      onClick={onPress}
      style={{...styles.key, flex, ...(wide ? styles.keyWide : null)}}>
      {label}
    </button>
  );

  // React Native's Modal renders into its own portal on document.body, so a
  // keyboard living inside #root sits *under* the modal backdrop: taps close
  // the popup instead of typing. Portal into body so it stacks above them.
  return createPortal(
    <div style={styles.wrap} onMouseDown={hold}>
      {ROWS.map((row, i) => (
        <div key={i} style={styles.row}>
          {i === 3 ? (
            <Key label={shift ? 'SHIFT' : 'shift'} onPress={() => setShift((s) => !s)} flex={1.6} wide />
          ) : null}
          {row.map((k) => (
            <Key key={k} label={shift ? k.toUpperCase() : k} onPress={() => press(shift ? k.toUpperCase() : k)} />
          ))}
          {i === 3 ? <Key label="⌫" onPress={backspace} flex={1.6} wide /> : null}
        </div>
      ))}
      <div style={styles.row}>
        <Key label="space" onPress={() => press(' ')} flex={6} />
        <Key label="done" onPress={submit} flex={1.6} wide />
      </div>
    </div>,
    document.body,
  );
};

const styles = {
  wrap: {
    position: 'fixed',
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 2147483000,
    background: 'rgba(18,18,18,0.97)',
    borderTop: '1px solid #333',
    padding: '10px 12px 14px',
    display: 'flex',
    flexDirection: 'column',
    gap: 8,
    userSelect: 'none',
  },
  row: {display: 'flex', gap: 8, justifyContent: 'center'},
  key: {
    flex: 1,
    minHeight: 62,
    fontSize: 22,
    color: '#fff',
    background: '#2f2f2f',
    border: '1px solid #444',
    borderRadius: 8,
    cursor: 'pointer',
    fontFamily: 'inherit',
  },
  keyWide: {background: '#3d3d3d', fontSize: 16},
};

export default OnScreenKeyboard;
