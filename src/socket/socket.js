const { Server } = require("socket.io");
const MessageService = require("../services/MessageService");
const FriendRequestService = require("../services/FriendRequestService");
const UserService = require("../services/UserService");

let io;
const onlineUsers = new Map(); // Map để ánh xạ userId với socketId

const initializeSocket = (server) => {
  io = new Server(server, {
    cors: {
      origin: "*", // Cho phép tất cả các domain (có thể giới hạn domain cụ thể)
      // Tất cả các phương thức HTTP đều được phép
      methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    },
  });

  io.on("connection", (socket) => {
    console.log("A user connected:", socket.id);

    // Lắng nghe sự kiện đăng ký userId
    socket.on("registerUser", (userId) => {
      onlineUsers.set(userId, socket.id); // Lưu userId và socketId
      console.log(`User ${userId} is online with socket ID ${socket.id}`);
      console.log("Online users:", Array.from(onlineUsers.keys()));
    });

    // Lắng nghe sự kiện gửi tin nhắn từ client (nếu cần)
    socket.on(
      "sendMessage",
      async ({ senderId, receiverId, messageData, file }) => {
        try {
          const message = await MessageService.sendMessage(
            senderId,
            receiverId,
            messageData,
            file
          );

          // Phát sự kiện socket cho cả người gửi và người nhận
          [senderId, receiverId].forEach((userId) => {
            if (onlineUsers.has(userId)) {
              io.to(onlineUsers.get(userId)).emit("newMessage", {
                conversationId: message.conversationId,
                message,
              });
            }
          });
        } catch (error) {
          console.error("Error sending message via socket:", error.message);
          socket.emit("error", "Error sending message");
        }
      }
    );

    // Lắng nghe sự kiện thu hồi tin nhắn
    socket.on("revokeMessage", async ({ messageId, userId }) => {
      try {
        const result = await MessageService.revokeMessage(messageId, userId);

        if (!result) {
          socket.emit("error", "You are not allowed to revoke this message");
          return;
        }

        // Gửi thông báo real-time đến người nhận và người gửi
        const receiverId = result.receiver_id.toString();
        const senderId = result.sender_id.toString();

        // Thông báo cho người nhận
        if (onlineUsers.has(receiverId)) {
          io.to(onlineUsers.get(receiverId)).emit("messageRevoked", {
            messageId,
            is_revoked: true,
          });
        }

        // Thông báo cho người gửi
        if (onlineUsers.has(senderId)) {
          io.to(onlineUsers.get(senderId)).emit("messageRevoked", {
            messageId,
            is_revoked: true,
          });
        }
      } catch (error) {
        console.error("Error revoking message:", error.message);
        socket.emit("error", "Error revoking message");
      }
    });

    // Lắng nghe sự kiện gửi lời mời kết bạn
    socket.on(
      "sendFriendRequest",
      async ({ senderId, receiverId, message }) => {
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
      }
    );

    // Lắng nghe sự kiện phản hồi lời mời kết bạn
    socket.on(
      "respondToFriendRequest",
      async ({ requestId, status, userId }) => {
        try {
          const updatedRequest =
            await FriendRequestService.respondToFriendRequest(
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
      }
    );

    // Lắng nghe sự kiện lấy danh sách lời mời đã gửi
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

    // Lắng nghe sự kiện ngắt kết nối
    socket.on("disconnect", () => {
      for (const [userId, socketId] of onlineUsers.entries()) {
        if (socketId === socket.id) {
          onlineUsers.delete(userId); // Xóa userId khi socket ngắt kết nối
          console.log(`User ${userId} disconnected`);
          console.log("Online users:", Array.from(onlineUsers.keys()));
          break;
        }
      }
    });
  });
};

// Hàm gửi tin nhắn đến một user cụ thể
const sendMessageToUser = (userId, event, data) => {
  const socketId = onlineUsers.get(userId);
  if (socketId) {
    io.to(socketId).emit(event, data); // Gửi sự kiện đến socketId cụ thể
  }
};

// Hàm gửi thông báo về đoạn hội thoại mới cho nhiều người dùng
const notifyUsersAboutConversation = (userIds, event, data) => {
  userIds.forEach((userId) => {
    const socketId = onlineUsers.get(userId);
    if (socketId) {
      io.to(socketId).emit(event, data); // Gửi sự kiện đến socketId cụ thể
    }
  });
};

module.exports = {
  initializeSocket,
  sendMessageToUser,
  notifyUsersAboutConversation, // Xuất hàm mới
  onlineUsers,
  io,
};
