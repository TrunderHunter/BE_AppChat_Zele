const MessageService = require("../../services/MessageService");

/**
 * Handler cho các sự kiện liên quan đến tin nhắn
 */
module.exports = function (io, socket, onlineUsers) {
  /**
   * Xử lý sự kiện gửi tin nhắn (Tạm thời không sử dụng)
   */
  //   socket.on(
  //     "sendMessage",
  //     async ({ senderId, receiverId, messageData, file }) => {
  //       try {
  //         const message = await MessageService.sendMessage(
  //           senderId,
  //           receiverId,
  //           messageData,
  //           file
  //         );

  //         // Phát sự kiện socket cho cả người gửi và người nhận
  //         [senderId, receiverId].forEach((userId) => {
  //           if (onlineUsers.has(userId)) {
  //             io.to(onlineUsers.get(userId)).emit("newMessage", {
  //               conversationId: message.conversationId,
  //               message,
  //             });
  //           }
  //         });
  //       } catch (error) {
  //         console.error("Error sending message via socket:", error.message);
  //         socket.emit("error", "Error sending message");
  //       }
  //     }
  //   );

  /**
   * Xử lý sự kiện thu hồi tin nhắn
   */
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
};
