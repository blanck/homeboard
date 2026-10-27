// Browsers cannot listen on a port. The phone setup server is Android-only;
// the Pi kiosk serves its phone settings from server.mjs instead.
const TcpSocket = {
  createServer: () => {
    throw new Error('TCP server not available on web');
  },
};

export default TcpSocket;
