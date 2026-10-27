import {Platform} from 'react-native';

// Picking a photo on a phone beats typing a URL on a touchscreen. The file is
// downscaled here rather than on the Pi: a modern phone photo is several
// thousand pixels wide, and the board only ever shows it at 1080p.
const MAX_W = 1920;
const MAX_H = 1080;
const QUALITY = 0.85;

export const canPickBackground = () => Platform.OS === 'web' && typeof document !== 'undefined';

// Resolves null when the picker is dismissed. Cancelling fires no `change`
// event in older browsers, so fall back to the focus that returns with the
// user; without this the caller waits forever on a picker nobody used.
export const pickImage = () =>
  new Promise((resolve) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    // Off-screen rather than display:none, which some mobile browsers ignore
    input.style.cssText = 'position:fixed;left:-9999px;opacity:0';
    document.body.appendChild(input);

    let settled = false;
    const finish = (file) => {
      if (settled) return;
      settled = true;
      window.removeEventListener('focus', onFocus);
      input.remove();
      resolve(file);
    };

    const onFocus = () => {
      // The change event lands after focus returns, so give it a moment
      setTimeout(() => finish(input.files && input.files[0] ? input.files[0] : null), 1500);
    };

    input.addEventListener('change', () => finish(input.files && input.files[0]));
    input.addEventListener('cancel', () => finish(null));
    window.addEventListener('focus', onFocus);
    input.click();
  });

const downscale = (file) =>
  new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      const scale = Math.min(1, MAX_W / img.width, MAX_H / img.height);
      const canvas = document.createElement('canvas');
      canvas.width = Math.round(img.width * scale);
      canvas.height = Math.round(img.height * scale);
      canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height);
      canvas.toBlob(
        (blob) => (blob ? resolve(blob) : reject(new Error('could not encode image'))),
        'image/jpeg',
        QUALITY,
      );
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('could not read image'));
    };
    img.src = url;
  });

// Returns a same-origin URL to store in settings
export const uploadBackground = async (file, slot) => {
  const blob = await downscale(file);
  const resp = await fetch(`/background?slot=${encodeURIComponent(slot)}`, {
    method: 'POST',
    headers: {'Content-Type': 'image/jpeg'},
    body: blob,
  });
  if (!resp.ok) throw new Error(`upload failed (${resp.status})`);
  const {url} = await resp.json();
  return url;
};
