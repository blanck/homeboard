const getState = () => ({
  isConnected: navigator.onLine,
  isInternetReachable: navigator.onLine,
  type: navigator.onLine ? 'unknown' : 'none',
});

const listeners = new Set();
const notify = () => listeners.forEach((fn) => fn(getState()));
window.addEventListener('online', notify);
window.addEventListener('offline', notify);

const NetInfo = {
  addEventListener: (fn) => {
    listeners.add(fn);
    fn(getState());
    return () => listeners.delete(fn);
  },
  fetch: async () => getState(),
};

export default NetInfo;
