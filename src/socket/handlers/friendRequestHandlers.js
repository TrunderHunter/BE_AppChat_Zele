const FriendRequestService = require("../../services/FriendRequestService");
const UserService = require("../../services/UserService");

/**
 * Handler cho các sự kiện liên quan đến lời mời kết bạn
 */
module.exports = function (io, socket, onlineUsers) {
  /**
   * Xử lý sự kiện gửi lời mời kết bạn
   */
  socket.on("sendFriendRequest", async ({ senderId, receiverId, message }) => {
    try {
      const friendRequest = await FriendRequestService.sendFriendRequest(
        senderId,
        receiverId,
        message
      );

      // Gửi thông báo real-time đến người nhận
      if (onlineUsers.has(receiverId)) {
        io.to(onlineUsers.get(receiverId)).emit(
          "newFriendRequest",
          friendRequest
        );
      }
    } catch (error) {
      socket.emit("error", error.message);
    }
  });

  /**
   * Xử lý sự kiện phản hồi lời mời kết bạn
   */
  socket.on("respondToFriendRequest", async ({ requestId, status, userId }) => {
    try {
      const updatedRequest = await FriendRequestService.respondToFriendRequest(
        requestId,
        status
      );

      // Lấy ID người gửi và người nhận
      const senderId = updatedRequest.sender._id
        ? updatedRequest.sender._id.toString()
        : updatedRequest.sender.toString();
      const receiverId = updatedRequest.receiver._id
        ? updatedRequest.receiver._id.toString()
        : updatedRequest.receiver.toString();

      // Nếu lời mời được chấp nhận
      if (status === "accepted") {
        // Thông báo cho cả người gửi và người nhận về tình trạng bạn bè mới
        [senderId, receiverId].forEach(async (userId) => {
          if (onlineUsers.has(userId)) {
            // Lấy danh sách bạn bè cập nhật
            const updatedFriends = await UserService.getUserFriends(userId);

            // Gửi thông báo về việc chấp nhận lời mời và danh sách bạn bè cập nhật
            io.to(onlineUsers.get(userId)).emit("friendRequestResponse", {
              request: updatedRequest,
              status: "accepted",
              friends: updatedFriends,
            });

            // Thông báo riêng về việc có bạn mới
            io.to(onlineUsers.get(userId)).emit("newFriend", {
              friendId: userId === senderId ? receiverId : senderId,
            });
          }
        });
      }
      // Nếu lời mời bị từ chối (lúc này lời mời đã bị xóa khỏi DB)
      else if (status === "rejected") {
        // Thông báo cho người gửi biết lời mời đã bị từ chối
        if (onlineUsers.has(senderId)) {
          io.to(onlineUsers.get(senderId)).emit("friendRequestResponse", {
            request: updatedRequest,
            status: "rejected",
            message: "Lời mời kết bạn đã bị từ chối",
            canSendAgain: true, // Flag báo hiệu người dùng có thể gửi lại lời mời
          });
        }

        // Thông báo cho người nhận biết rằng họ đã từ chối thành công
        if (onlineUsers.has(receiverId)) {
          io.to(onlineUsers.get(receiverId)).emit("friendRequestResponse", {
            request: updatedRequest,
            status: "rejected",
            message: "Đã từ chối lời mời kết bạn",
          });
        }
      }
    } catch (error) {
      socket.emit("error", error.message);
    }
  });

  /**
   * Xử lý sự kiện lấy danh sách lời mời đã gửi
   */
  socket.on("getSentFriendRequests", async ({ userId }) => {
    try {
      const sentRequests = await FriendRequestService.getSentFriendRequests(
        userId
      );
      socket.emit("sentFriendRequests", sentRequests);
    } catch (error) {
      socket.emit("error", error.message);
    }
  });
};
