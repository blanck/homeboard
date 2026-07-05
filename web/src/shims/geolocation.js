const unavailable = (errorCb) => {
  if (errorCb) errorCb({code: 2, message: 'Geolocation unavailable'});
};

const Geolocation = {
  getCurrentPosition: (success, error, options) => {
    if (!navigator.geolocation) return unavailable(error);
    navigator.geolocation.getCurrentPosition(success, error, options);
  },
  watchPosition: (success, error, options) => {
    if (!navigator.geolocation) {
      unavailable(error);
      return -1;
    }
    return navigator.geolocation.watchPosition(success, error, options);
  },
  clearWatch: (id) => {
    if (navigator.geolocation && id !== -1) navigator.geolocation.clearWatch(id);
  },
  requestAuthorization: (success) => {
    if (success) success();
  },
};

export default Geolocation;
