const { Server } = require("socket.io");

// Import các socket handlers
const messageHandlers = require("./handlers/messageHandlers");
const friendRequestHandlers = require("./handlers/friendRequestHandlers");
const groupHandlers = require("./handlers/groupHandlers");
const connectionHandlers = require("./handlers/connectionHandlers");
let io;
const onlineUsers = new Map(); // Map để ánh xạ userId với socketId

/**
 * Khởi tạo Socket.IO server
 * @param {Object} server - HTTP server instance
 */
const initializeSocket = (server) => {
  io = new Server(server, {
    cors: {
      origin: "*", // Cho phép tất cả các domain (có thể giới hạn domain cụ thể)
      methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    },
  });

  io.on("connection", (socket) => {
    console.log("A user connected:", socket.id);

    // Kích hoạt các handlers khác nhau
    connectionHandlers(io, socket, onlineUsers);
    messageHandlers(io, socket, onlineUsers);
    friendRequestHandlers(io, socket, onlineUsers);
    groupHandlers(io, socket, onlineUsers);
  });
};

/**
 * Gửi tin nhắn đến một user cụ thể
 * @param {String} userId - ID của người dùng nhận tin nhắn
 * @param {String} event - Tên sự kiện socket
 * @param {Object} data - Dữ liệu gửi kèm
 */
const sendMessageToUser = (userId, event, data) => {
  const socketId = onlineUsers.get(userId);
  if (socketId) {
    io.to(socketId).emit(event, data);
  }
};

/**
 * Gửi thông báo về đoạn hội thoại mới cho nhiều người dùng
 * @param {Array} userIds - Mảng chứa ID các người dùng cần thông báo
 * @param {String} event - Tên sự kiện socket
 * @param {Object} data - Dữ liệu gửi kèm
 */
const notifyUsersAboutConversation = (userIds, event, data) => {
  userIds.forEach((userId) => {
    const socketId = onlineUsers.get(userId);
    if (socketId) {
      io.to(socketId).emit(event, data);
    }
  });
};

module.exports = {
  initializeSocket,
  sendMessageToUser,
  notifyUsersAboutConversation,
  onlineUsers,
  io,
};
