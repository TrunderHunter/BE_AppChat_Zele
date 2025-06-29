const MessageService = require("../../services/MessageService");
const Conversation = require("../../models/Conversation"); // Thêm import Conversation
const Group = require("../../models/Group"); // Thêm import Group

/**
 * Handler cho các sự kiện liên quan đến tin nhắn
 */
module.exports = function (io, socket, onlineUsers) {
  /**
   * Xử lý sự kiện gửi tin nhắn
   */
  socket.on(
    "sendMessage",
    async ({ senderId, receiverId, messageData, file }) => {
      try {
        console.log("Socket sendMessage event received:", {
          senderId,
          receiverId,
          messageData,
        });

        // Kiểm tra xem đã có cuộc trò chuyện giữa hai người dùng chưa
        const existingConversation = await Conversation.findOne({
          "participants.user_id": { $all: [senderId, receiverId] },
          participants: { $size: 2 },
        }).populate("last_message");

        const isNewConversation = !existingConversation;

        // Gọi service để lưu tin nhắn, nhưng tắt tính năng gửi thông báo socket
        // bằng cách thêm tham số skipSocketNotification
        const message = await MessageService.sendMessage(
          senderId,
          receiverId,
          messageData,
          file,
          true // skipSocketNotification = true
        );

        // Lấy cuộc trò chuyện đã được cập nhật (cũ hoặc mới)
        const updatedConversation = await Conversation.findOne({
          "participants.user_id": { $all: [senderId, receiverId] },
          participants: { $size: 2 },
        }).populate("last_message");

        // Nếu là cuộc trò chuyện mới, gửi thông báo newConversation
        if (isNewConversation) {
          [senderId, receiverId].forEach((userId) => {
            if (onlineUsers.has(userId)) {
              console.log(`Emitting newConversation to user ${userId}`);
              io.to(onlineUsers.get(userId)).emit(
                "newConversation",
                updatedConversation
              );
            }
          });
        }

        // Luôn gửi thông báo updateLastMessage cho cả cuộc trò chuyện cũ và mới
        [senderId, receiverId].forEach((userId) => {
          if (onlineUsers.has(userId)) {
            console.log(`Emitting updateLastMessage to user ${userId}`);
            io.to(onlineUsers.get(userId)).emit(
              "updateLastMessage",
              updatedConversation._id,
              updatedConversation.last_message
            );
          }
        });

        // Thay vì để MessageService gửi thông báo, chúng ta sẽ gửi từ đây
        // Phát sự kiện socket cho cả người gửi và người nhận
        [senderId, receiverId].forEach((userId) => {
          if (onlineUsers.has(userId)) {
            console.log(`Emitting receiveMessage to user ${userId}`);
            io.to(onlineUsers.get(userId)).emit("receiveMessage", message);
          }
        });
      } catch (error) {
        console.error("Error sending message via socket:", error);
        socket.emit("error", {
          message: "Error sending message",
          details: error.message,
        });
      }
    }
  );

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
      // Xác định loại tin nhắn (nhóm hoặc cá nhân)
      const isGroupMessage = result.conversation_id != null;

      if (isGroupMessage) {
        // Đây là tin nhắn nhóm
        console.log(
          "Revoking group message:",
          messageId,
          "in conversation:",
          result.conversation_id
        );

        // Lấy thông tin cuộc trò chuyện nhóm
        const conversation = await Conversation.findById(
          result.conversation_id
        ).populate("participants.user_id", "_id");

        if (conversation) {
          // Gửi thông báo đến tất cả thành viên trong nhóm
          conversation.participants.forEach((participant) => {
            const memberId = participant.user_id._id.toString();

            if (onlineUsers.has(memberId)) {
              console.log(
                `Emitting messageRevoked to group member: ${memberId}`
              );
              io.to(onlineUsers.get(memberId)).emit("messageRevoked", {
                messageId,
                is_revoked: true,
                isGroupMessage: true,
                conversationId: result.conversation_id.toString(),
              });
            }
          });
        }
      } else {
        // Đây là tin nhắn cá nhân
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
      }
    } catch (error) {
      console.error("Error revoking message:", error.message);
      socket.emit("error", "Error revoking message");
    }
  });

  /**
   * Xử lý sự kiện kiểm tra tin nhắn đã được nhận
   */
  socket.on("messageDelivered", ({ messageId, userId }) => {
    try {
      // Tìm người gửi tin nhắn để thông báo
      Message.findById(messageId)
        .then((message) => {
          if (!message) return;

          const senderId = message.sender_id.toString();

          // Cập nhật trạng thái tin nhắn thành "delivered"
          message.status = "delivered";
          message.save();

          // Thông báo cho người gửi rằng tin nhắn đã được nhận
          if (onlineUsers.has(senderId)) {
            io.to(onlineUsers.get(senderId)).emit("messageStatusUpdated", {
              messageId,
              status: "delivered",
            });
          }
        })
        .catch((err) => console.error("Error updating message status:", err));
    } catch (error) {
      console.error("Error in messageDelivered handler:", error);
    }
  });

  /**
   * Xử lý sự kiện kiểm tra tin nhắn đã được đọc
   */
  socket.on("messageSeen", ({ messageId, userId }) => {
    try {
      // Tìm người gửi tin nhắn để thông báo
      Message.findById(messageId)
        .then((message) => {
          if (!message) return;

          const senderId = message.sender_id.toString();

          // Cập nhật trạng thái tin nhắn thành "seen"
          message.status = "seen";
          message.save();

          // Thông báo cho người gửi rằng tin nhắn đã được đọc
          if (onlineUsers.has(senderId)) {
            io.to(onlineUsers.get(senderId)).emit("messageStatusUpdated", {
              messageId,
              status: "seen",
            });
          }
        })
        .catch((err) => console.error("Error updating message status:", err));
    } catch (error) {
      console.error("Error in messageSeen handler:", error);
    }
  });

  /**
   * Xử lý sự kiện chuyển tiếp tin nhắn
   */
  socket.on(
    "forwardMessage",
    async ({ senderId, receiverId, originalMessageId, isGroup = false }) => {
      try {
        console.log("Socket forwardMessage event received:", {
          senderId,
          receiverId,
          originalMessageId,
          isGroup,
        });

        // Gọi service để chuyển tiếp tin nhắn, nhưng tắt thông báo socket mặc định
        const forwardedMessage = await MessageService.forwardMessage(
          senderId,
          receiverId,
          originalMessageId,
          isGroup,
          true // skipSocketNotification = true để xử lý socket tùy chỉnh
        );

        // Nếu là chuyển tiếp đến người dùng cá nhân
        if (!isGroup) {
          // Lấy cuộc trò chuyện sau khi chuyển tiếp
          const updatedConversation = await Conversation.findOne({
            "participants.user_id": { $all: [senderId, receiverId] },
            participants: { $size: 2 },
          }).populate("last_message");

          // Gửi tin nhắn đến người gửi
          if (onlineUsers.has(senderId)) {
            io.to(onlineUsers.get(senderId)).emit("messageForwarded", {
              message: forwardedMessage,
              conversation: updatedConversation,
            });
          }

          // Gửi tin nhắn đến người nhận nếu họ đang online
          if (onlineUsers.has(receiverId)) {
            io.to(onlineUsers.get(receiverId)).emit("messageForwarded", {
              message: forwardedMessage,
              conversation: updatedConversation,
            });
          }
        } // Nếu là chuyển tiếp đến nhóm
        else {
          // Lấy thông tin nhóm và danh sách thành viên
          const group = await Group.findById(receiverId)
            .populate(
              "members.user",
              "username name email phone primary_avatar"
            )
            .populate("conversation_id") // Lấy thêm thông tin conversation
            .exec();

          if (!group) {
            throw new Error("Nhóm không tồn tại");
          }

          if (!group.conversation_id) {
            throw new Error("Cuộc trò chuyện của nhóm không tồn tại");
          } // Lấy ID của tất cả thành viên trong nhóm
          const memberIds = group.members
            .map((member) => {
              // Đảm bảo user là một ObjectId hoặc string hợp lệ
              if (member.user && member.user._id) {
                return member.user._id.toString();
              } else if (member.user) {
                return member.user.toString();
              }
              return null;
            })
            .filter((id) => id !== null); // Loại bỏ các ID null

          // Gửi tin nhắn đã chuyển tiếp cho tất cả thành viên trong nhóm đang online
          memberIds.forEach((memberId) => {
            if (onlineUsers.has(memberId)) {
              io.to(onlineUsers.get(memberId)).emit("groupMessageForwarded", {
                message: forwardedMessage,
                group: group,
                conversationId:
                  group.conversation_id._id || group.conversation_id,
              });
            }
          });
        }

        console.log("Forwarded message processed successfully");
      } catch (error) {
        console.error("Error in forwardMessage socket handler:", error);

        // Thông báo lỗi cho người gửi
        if (onlineUsers.has(senderId)) {
          io.to(onlineUsers.get(senderId)).emit("messageForwardError", {
            error: error.message,
          });
        }
      }
    }
  );
};
