// Minimal polyfills for the Pi kiosk's Chromium 78 (Raspbian Buster).
// Syntax is handled by the chrome78 build target; these cover runtime APIs
// that dependencies use. No imports here: this module must execute first.

if (!Object.hasOwn) {
  Object.defineProperty(Object, 'hasOwn', {
    value: (obj, prop) => Object.prototype.hasOwnProperty.call(obj, prop),
    writable: true,
    configurable: true,
  });
}

if (!Array.prototype.at) {
  Object.defineProperty(Array.prototype, 'at', {
    value: function (n) {
      n = Math.trunc(n) || 0;
      if (n < 0) n += this.length;
      return n < 0 || n >= this.length ? undefined : this[n];
    },
    writable: true,
    configurable: true,
  });
}

if (!String.prototype.at) {
  Object.defineProperty(String.prototype, 'at', {
    value: function (n) {
      n = Math.trunc(n) || 0;
      if (n < 0) n += this.length;
      return n < 0 || n >= this.length ? undefined : this.charAt(n);
    },
    writable: true,
    configurable: true,
  });
}

if (!String.prototype.replaceAll) {
  Object.defineProperty(String.prototype, 'replaceAll', {
    value: function (search, replace) {
      if (search instanceof RegExp) return this.replace(search, replace);
      return this.split(search).join(
        typeof replace === 'function' ? replace(search) : replace,
      );
    },
    writable: true,
    configurable: true,
  });
}

if (!Promise.any) {
  Promise.any = (promises) =>
    new Promise((resolve, reject) => {
      let pending = 0;
      const errors = [];
      for (const p of promises) {
        const i = pending++;
        Promise.resolve(p).then(resolve, (e) => {
          errors[i] = e;
          if (--pending === 0) reject(new Error('All promises were rejected'));
        });
      }
      if (pending === 0) reject(new Error('All promises were rejected'));
    });
}

if (typeof window !== 'undefined' && !window.structuredClone) {
  window.structuredClone = (value) => JSON.parse(JSON.stringify(value));
}

if (typeof window !== 'undefined' && !window.reportError) {
  window.reportError = (e) => console.error(e);
}
