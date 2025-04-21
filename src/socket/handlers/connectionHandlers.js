/**
 * Handler cho các sự kiện liên quan đến kết nối và đăng ký người dùng
 */
module.exports = function (io, socket, onlineUsers) {
  /**
   * Xử lý sự kiện đăng ký người dùng khi kết nối socket
   */
  socket.on("registerUser", (userId) => {
    onlineUsers.set(userId, socket.id); // Lưu userId và socketId
    console.log(`User ${userId} is online with socket ID ${socket.id}`);
    console.log("Online users:", Array.from(onlineUsers.keys()));

    // Thông báo cho các user khác về người dùng này vừa online
    socket.broadcast.emit("userStatusChanged", {
      userId: userId,
      status: "online",
    });
  });

  /**
   * Xử lý sự kiện ngắt kết nối
   */
  socket.on("disconnect", () => {
    let disconnectedUserId = null;

    // Tìm userId tương ứng với socket.id
    for (const [userId, socketId] of onlineUsers.entries()) {
      if (socketId === socket.id) {
        disconnectedUserId = userId;
        onlineUsers.delete(userId); // Xóa userId khi socket ngắt kết nối
        console.log(`User ${userId} disconnected`);
        console.log("Online users:", Array.from(onlineUsers.keys()));
        break;
      }
    }

    // Thông báo cho các user khác về việc ngắt kết nối
    if (disconnectedUserId) {
      socket.broadcast.emit("userStatusChanged", {
        userId: disconnectedUserId,
        status: "offline",
      });
    }
  });
};
