const { PeerServer } = require("peer");

/**
 * Cấu hình và khởi tạo PeerJS Server để hỗ trợ kết nối WebRTC
 * @param {Object} server - HTTP server instance
 * @returns {Object} Peer server instance
 */
const initializePeerServer = (server) => {
  const peerServer = PeerServer({
    port: process.env.PEER_PORT || 9000,
    path: "/peerjs",
    proxied: true,
    ssl:
      process.env.NODE_ENV === "production"
        ? {
            key: process.env.SSL_KEY_PATH,
            cert: process.env.SSL_CERT_PATH,
          }
        : undefined,
  });

  console.log(`PeerJS Server running on port ${process.env.PEER_PORT || 9000}`);

  // Xử lý sự kiện khi peer kết nối
  peerServer.on("connection", (client) => {
    console.log(`PeerJS client connected: ${client.getId()}`);
  });

  // Xử lý sự kiện khi peer ngắt kết nối
  peerServer.on("disconnect", (client) => {
    console.log(`PeerJS client disconnected: ${client.getId()}`);
  });

  return peerServer;
};

module.exports = { initializePeerServer };
