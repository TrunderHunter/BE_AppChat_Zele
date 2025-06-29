const { Server } = require("socket.io");

// Import các socket handlers
const messageHandlers = require("./handlers/messageHandlers");
const friendRequestHandlers = require("./handlers/friendRequestHandlers");
const groupHandlers = require("./handlers/groupHandlers");
const connectionHandlers = require("./handlers/connectionHandlers");
const callHandlers = require("./handlers/callHandlers"); // Thêm import callHandlers
let io;
const onlineUsers = new Map(); // Map để ánh xạ userId với socketId

/**
 * Khởi tạo Socket.IO server
 * @param {Object} server - HTTP server instance
 */
const initializeSocket = (server) => {
  io = new Server(server, {
    cors: {
      origin: process.env.CLIENT_URL || "*",
      methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
      credentials: true, // Cho phép credentials (cookies, authorization headers)
      allowedHeaders: ["Content-Type", "Authorization"],
    },
  });

  io.on("connection", (socket) => {
    console.log("A user connected:", socket.id);

    // Kích hoạt các handlers khác nhau
    connectionHandlers(io, socket, onlineUsers);
    messageHandlers(io, socket, onlineUsers);
    friendRequestHandlers(io, socket, onlineUsers);
    groupHandlers(io, socket, onlineUsers);
    callHandlers(io, socket, onlineUsers); // Thêm callHandlers
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
