/**
 * Handler cho các sự kiện liên quan đến kết nối và đăng ký người dùng
 */
module.exports = function (io, socket, onlineUsers) {
  // Map lưu trữ timer cho các kết nối timeout
  const disconnectTimers = new Map();
  // Thời gian chờ trước khi đánh dấu người dùng là offline (ms) - 5 giây
  const GRACE_PERIOD = 5000;

  /**
   * Xử lý sự kiện đăng ký người dùng khi kết nối socket
   */
  socket.on("registerUser", (userId) => {
    // Hủy timer disconnect nếu có (người dùng tải lại trang)
    if (disconnectTimers.has(userId)) {
      clearTimeout(disconnectTimers.get(userId));
      disconnectTimers.delete(userId);
      console.log(`Cleared disconnect timer for user ${userId} (page reload)`);
    }

    const wasOffline =
      !onlineUsers.has(userId) || onlineUsers.get(userId) !== socket.id;

    onlineUsers.set(userId, socket.id); // Lưu userId và socketId
    console.log(`User ${userId} is online with socket ID ${socket.id}`);
    console.log("Online users:", Array.from(onlineUsers.keys()));

    // Lưu user ID vào đối tượng socket để dễ truy cập khi disconnect
    socket.userId = userId;

    // Chỉ thông báo nếu người dùng thực sự vừa online (không phải tải lại trang)
    if (wasOffline) {
      // Thông báo cho các user khác về người dùng này vừa online
      socket.broadcast.emit("userStatusChanged", {
        userId: userId,
        status: "online",
      });
    }
  });

  /**
   * Xử lý sự kiện heartbeat để duy trì kết nối
   */
  socket.on("heartbeat", ({ userId }) => {
    // Kiểm tra xem userId có hợp lệ không và có map với socket này không
    if (userId && socket.userId === userId) {
      // Cập nhật thời gian hoạt động cuối cùng của người dùng
      // Điều này hữu ích nếu bạn muốn hiển thị "active X minutes ago"
      socket.lastActive = Date.now();

      // Đảm bảo người dùng vẫn được đánh dấu là online
      if (!onlineUsers.has(userId) || onlineUsers.get(userId) !== socket.id) {
        onlineUsers.set(userId, socket.id);
      }
    }
  });

  /**
   * Xử lý sự kiện ngắt kết nối
   */
  socket.on("disconnect", () => {
    const userId = socket.userId;

    if (!userId) return;

    // Kiểm tra xem socket.id hiện tại có phải là kết nối mới nhất của người dùng không
    const latestSocketId = onlineUsers.get(userId);
    if (latestSocketId !== socket.id) {
      // Nếu không phải, có thể người dùng đã kết nối lại với ID khác
      console.log(
        `Ignoring disconnect for outdated socket ${socket.id} of user ${userId}`
      );
      return;
    }

    console.log(`Starting disconnect timer for user ${userId}`);

    // Thiết lập timer để đánh dấu người dùng là offline sau thời gian chờ
    const timerId = setTimeout(() => {
      // Sau thời gian chờ, kiểm tra lại xem ID socket có còn khớp không
      if (onlineUsers.get(userId) === socket.id) {
        onlineUsers.delete(userId);
        console.log(
          `User ${userId} officially disconnected after grace period`
        );
        console.log("Online users:", Array.from(onlineUsers.keys()));

        // Thông báo cho các user khác về việc ngắt kết nối
        socket.broadcast.emit("userStatusChanged", {
          userId: userId,
          status: "offline",
        });
      }
      disconnectTimers.delete(userId);
    }, GRACE_PERIOD);

    // Lưu timer ID để có thể hủy nếu người dùng kết nối lại
    disconnectTimers.set(userId, timerId);
  });
};
