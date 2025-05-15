const Message = require("../models/Message");
const Conversation = require("../models/Conversation");
const User = require("../models/User");
const Group = require("../models/Group");
const mongoose = require("mongoose");
const {
  sendMessageToUser,
  notifyUsersAboutConversation,
  onlineUsers,
  io, // Import socket instance
} = require("../socket/socket");
const { uploadFileToS3 } = require("../utils/S3Uploader"); // Import module upload file

exports.sendMessage = async (
  senderId,
  receiverId,
  messageData,
  file,
  skipSocketNotification = false
) => {
  let { message_type, content, file_id, mentions, self_destruct_timer } =
    messageData;

  // Kiểm tra và thiết lập message_type
  if (!message_type) {
    if (file) {
      message_type = "file"; // Nếu không có message_type và có file, thiết lập là "file"
    } else {
      message_type = "text"; // Mặc định là "text" nếu không được cung cấp
    }
  }

  // Kiểm tra giá trị hợp lệ của message_type
  const validMessageTypes = ["text", "image", "video", "file", "voice"];
  if (!validMessageTypes.includes(message_type)) {
    throw new Error("Invalid message type");
  }

  // Kiểm tra xem người gửi và người nhận có phải là người dùng hợp lệ hay không
  const sender = await User.findById(senderId);
  const receiver = await User.findById(receiverId);
  if (!sender) {
    throw new Error("Người gửi không hợp lệ");
  }
  if (!receiver) {
    throw new Error("Người nhận không hợp lệ");
  }

  let fileMeta = null;

  if (file) {
    try {
      console.log("Bắt đầu upload file:", file.originalname || file.name);
      fileMeta = await uploadFileToS3(file); // Sử dụng module upload file
      console.log("File đã được upload thành công:", fileMeta);
    } catch (error) {
      console.error("Lỗi khi upload file:", error);
      throw new Error(`Lỗi khi upload file: ${error.message}`);
    }
  }

  // Đảm bảo content luôn có giá trị, ngay cả khi gửi file
  if (!content && file) {
    // Tạo nội dung mặc định dựa trên loại file
    if (message_type === "image") {
      content = "Đã gửi một hình ảnh";
    } else if (message_type === "video") {
      content = "Đã gửi một video";
    } else if (message_type === "voice") {
      content = "Đã gửi một tin nhắn thoại";
    } else {
      content = "Đã gửi một tệp đính kèm";
    }
  } else if (!content) {
    content = ""; // Đảm bảo content không phải null hoặc undefined
  }
  // Create a new message
  const message = new Message({
    sender_id: senderId,
    receiver_id: receiverId,
    message_type, // Đảm bảo message_type được thiết lập đúng
    content,
    file_id,
    mentions,
    "message_meta.self_destruct_timer": self_destruct_timer,
    file_meta: messageData.file_meta || fileMeta, // Ưu tiên sử dụng file_meta từ messageData (khi chuyển tiếp)
  });

  await message.save();
  console.log("Tin nhắn đã được lưu vào db:", {
    messageId: message._id,
    type: message.message_type,
    hasFileMeta: !!message.file_meta,
    fileMetaDetails: message.file_meta,
  });

  await message.populate(
    "sender_id receiver_id",
    "_id name email phone primary_avatar"
  );

  // Update or create a conversation
  let conversation = await Conversation.findOne({
    "participants.user_id": { $all: [senderId, receiverId] }, // Đảm bảo cả 2 user_id đều tồn tại
    participants: { $size: 2 }, // Đảm bảo chỉ có 2 người tham gia
  });

  if (!conversation) {
    conversation = new Conversation({
      participants: [
        {
          user_id: senderId,
        },
        {
          user_id: receiverId,
        },
      ],
      type: "personal",
      last_message: message._id,
      messages: [
        {
          message_id: message._id,
          sender_id: senderId,
          content: content, // Sử dụng content đã được đảm bảo có giá trị
          timestamp: message.timestamp,
        },
      ],
    });

    await conversation.populate("last_message");

    // Populate thông tin người tham gia
    await conversation.populate({
      path: "participants.user_id",
      select: "_id name email phone primary_avatar",
    });

    // Chuyển đổi định dạng dữ liệu cho phù hợp
    const formattedConversation = {
      ...conversation.toObject(),
      participants: conversation.participants.map((participant) => ({
        user_id: participant.user_id._id,
        name: participant.user_id.name,
        primary_avatar: participant.user_id.primary_avatar,
        _id: participant._id,
      })),
    };

    // Gửi thông báo qua WebSocket cho cả hai người dùng về đoạn hội thoại mới
    if (!skipSocketNotification) {
      notifyUsersAboutConversation(
        [senderId, receiverId],
        "newConversation",
        formattedConversation
      );

      // Gửi thông báo qua WebSocket
      notifyUsersAboutConversation(
        [senderId, receiverId],
        "updateLastMessage",
        formattedConversation
      );
    }
  } else {
    conversation.last_message = message._id;
    conversation.updated_at = Date.now();
    conversation.messages.push({
      message_id: message._id,
      sender_id: senderId,
      content: content, // Sử dụng content đã được đảm bảo có giá trị
      timestamp: message.timestamp,
    });

    await conversation.populate("last_message");

    // Populate thông tin người tham gia
    await conversation.populate({
      path: "participants.user_id",
      select: "_id name email phone primary_avatar",
    });

    // Chuyển đổi định dạng dữ liệu cho phù hợp
    const formattedConversation = {
      ...conversation.toObject(),
      participants: conversation.participants.map((participant) => ({
        user_id: participant.user_id._id,
        name: participant.user_id.name,
        primary_avatar: participant.user_id.primary_avatar,
        _id: participant._id,
      })),
    };

    // Gửi thông báo qua WebSocket
    if (!skipSocketNotification) {
      notifyUsersAboutConversation(
        [senderId, receiverId],
        "updateLastMessage",
        formattedConversation
      );
    }
  }

  await conversation.save();

  // Gửi tin nhắn qua socket cho người nhận nếu họ đang online
  if (!skipSocketNotification && onlineUsers.has(receiverId)) {
    sendMessageToUser(receiverId, "receiveMessage", message);
  } else if (!skipSocketNotification) {
    console.log(`User ${receiverId} is not online. Message saved to database.`);
  }

  return message;
};

// Gửi tin nhắn nhóm
exports.sendGroupMessage = async (
  senderId,
  conversationId,
  messageData,
  file,
  skipSocketNotification = false
) => {
  let { message_type, content, file_id, mentions, self_destruct_timer } =
    messageData;

  // Kiểm tra và thiết lập message_type
  if (!message_type) {
    if (file) {
      message_type = "file";
    } else {
      message_type = "text";
    }
  }

  // Kiểm tra giá trị hợp lệ của message_type
  const validMessageTypes = ["text", "image", "video", "file", "voice"];
  if (!validMessageTypes.includes(message_type)) {
    throw new Error("Invalid message type");
  }

  // Tìm cuộc trò chuyện và kiểm tra nó có phải là nhóm không
  const conversation = await Conversation.findById(conversationId);
  if (!conversation) {
    throw new Error("Cuộc trò chuyện không tồn tại");
  }

  if (conversation.type !== "group") {
    throw new Error("Cuộc trò chuyện này không phải là nhóm");
  }

  // Kiểm tra người gửi có phải là thành viên của nhóm
  const isMember = conversation.participants.some(
    (p) => p.user_id.toString() === senderId
  );

  if (!isMember) {
    throw new Error("Bạn không phải thành viên của nhóm này");
  }

  // Nếu nhóm có cài đặt hạn chế về việc ai có thể gửi tin nhắn
  if (conversation.group_id) {
    const group = await Group.findById(conversation.group_id);
    if (group) {
      const sender = group.members.find((m) => m.user.toString() === senderId);
      if (sender) {
        // Nếu chỉ admin có thể gửi tin nhắn
        if (
          group.settings.who_can_send_messages === "admins" &&
          sender.role !== "admin"
        ) {
          throw new Error("Chỉ admin mới có thể gửi tin nhắn trong nhóm này");
        }

        // Nếu chỉ admin và moderator có thể gửi tin nhắn
        if (
          group.settings.who_can_send_messages === "admins_moderators" &&
          !["admin", "moderator"].includes(sender.role)
        ) {
          throw new Error(
            "Chỉ admin và moderator mới có thể gửi tin nhắn trong nhóm này"
          );
        }
      }
    }
  }

  // Xử lý file nếu có
  let fileMeta = null;
  if (file) {
    fileMeta = await uploadFileToS3(file);
  }

  // Đảm bảo content luôn có giá trị, ngay cả khi gửi file
  if (!content && file) {
    // Tạo nội dung mặc định dựa trên loại file
    if (message_type === "image") {
      content = "Đã gửi một hình ảnh";
    } else if (message_type === "video") {
      content = "Đã gửi một video";
    } else if (message_type === "voice") {
      content = "Đã gửi một tin nhắn thoại";
    } else {
      content = "Đã gửi một tệp đính kèm";
    }
  } else if (!content) {
    content = ""; // Đảm bảo content không phải null hoặc undefined
  }

  // Lấy thông tin người gửi
  const sender = await User.findById(senderId);
  if (!sender) {
    throw new Error("Người gửi không hợp lệ");
  } // Tạo tin nhắn mới
  const message = new Message({
    sender_id: senderId,
    receiver_id: conversationId, // Trong trường hợp nhóm, receiver_id là ID cuộc hội thoại
    conversation_id: conversationId, // Thêm conversation_id cho tin nhắn nhóm
    message_type,
    content,
    file_id,
    mentions,
    "message_meta.self_destruct_timer": self_destruct_timer,
    file_meta: messageData.file_meta || fileMeta, // Ưu tiên sử dụng file_meta từ messageData (khi chuyển tiếp)
  });

  await message.save();
  await message.populate("sender_id", "_id name email phone primary_avatar");

  // Cập nhật cuộc trò chuyện
  conversation.last_message = message._id;
  conversation.updated_at = Date.now();
  conversation.messages.push({
    message_id: message._id,
    sender_id: senderId,
    content: content, // Sử dụng content đã được đảm bảo có giá trị
    timestamp: message.timestamp,
  });

  await conversation.save();
  await conversation.populate("last_message");

  // Populate thông tin người tham gia
  await conversation.populate({
    path: "participants.user_id",
    select: "_id name email phone primary_avatar",
  });

  // Chuyển đổi định dạng dữ liệu cho phù hợp với yêu cầu
  const formattedConversation = {
    ...conversation.toObject(),
    participants: conversation.participants.map((participant) => ({
      user_id: participant.user_id._id,
      name: participant.user_id.name,
      primary_avatar: participant.user_id.primary_avatar,
      _id: participant._id,
    })),
  };

  // Lấy danh sách ID của tất cả thành viên trong nhóm
  const memberIds = conversation.participants.map((p) =>
    p.user_id._id.toString()
  );

  if (!skipSocketNotification) {
    // Gửi thông báo cập nhật cuộc hội thoại
    notifyUsersAboutConversation(
      memberIds,
      "updateLastMessage",
      formattedConversation
    );

    // Gửi tin nhắn đến tất cả thành viên đang online
    memberIds.forEach((memberId) => {
      if (onlineUsers.has(memberId) && memberId !== senderId) {
        sendMessageToUser(memberId, "receiveGroupMessage", {
          message,
          conversationId,
        });
      }
    });
  }

  return message;
};

// Lấy tất cả tin nhắn trong một cuộc hội thoại
exports.getMessagesByConversationId = async (conversationId) => {
  // Kiểm tra ObjectId hợp lệ
  if (!mongoose.Types.ObjectId.isValid(conversationId)) {
    throw new Error("Invalid conversation ID");
  }

  // Tìm cuộc hội thoại
  const conversation = await Conversation.findById(conversationId);
  if (!conversation) {
    throw new Error("Conversation not found");
  }

  // Lấy tất cả các tin nhắn thuộc về cuộc hội thoại
  const messages = await Message.find({
    _id: { $in: conversation.messages.map((msg) => msg.message_id) },
  })
    .populate("sender_id", "_id name email phone primary_avatar")
    .populate("receiver_id", "_id name email phone primary_avatar");

  return messages;
};

// Thu hồi tin nhắn
exports.revokeMessage = async (messageId, userId) => {
  // Kiểm tra xem tin nhắn có tồn tại không
  const message = await Message.findById(messageId);

  if (!message) {
    throw new Error("Message not found");
  }

  // Chỉ cho phép người gửi thu hồi tin nhắn
  if (message.sender_id.toString() !== userId.toString()) {
    return null; // Không cho phép thu hồi
  }

  // Đánh dấu tin nhắn là đã bị thu hồi
  message.is_revoked = true;
  // message.content = null; // Xóa nội dung tin nhắn
  await message.save();

  // Làm mới để đảm bảo lấy được dữ liệu đã cập nhật
  const updatedMessage = await Message.findById(messageId);
  return updatedMessage;
};

/**
 * Chuyển tiếp tin nhắn đến người dùng khác hoặc nhóm
 * @param {string} senderId - ID của người dùng chuyển tiếp tin nhắn
 * @param {string} receiverId - ID của người nhận hoặc nhóm nhận tin nhắn
 * @param {string} originalMessageId - ID của tin nhắn gốc cần chuyển tiếp
 * @param {boolean} isGroup - Flag xác định đây là chuyển tiếp đến nhóm hay không
 * @param {boolean} skipSocketNotification - Flag để bỏ qua thông báo qua socket (cho phép xử lý socket riêng)
 * @returns {Object} - Tin nhắn đã chuyển tiếp
 */
exports.forwardMessage = async (
  senderId,
  receiverId,
  originalMessageId,
  isGroup = false,
  skipSocketNotification = false
) => {
  try {
    // Tìm tin nhắn gốc cần chuyển tiếp
    const originalMessage = await Message.findById(originalMessageId);

    if (!originalMessage) {
      throw new Error("Không tìm thấy tin nhắn gốc");
    }

    // Lấy thông tin từ tin nhắn gốc
    const { message_type, content, file_meta, mentions } = originalMessage;

    console.log("Original message details:", {
      message_id: originalMessageId,
      type: message_type,
      has_file_meta: !!file_meta,
      file_url: file_meta?.url,
    });

    // Chuẩn bị dữ liệu tin nhắn mới được chuyển tiếp
    const messageData = {
      message_type,
      content,
      mentions,
    };

    // Nếu tin nhắn gốc có file, copy thông tin file
    if (file_meta && file_meta.url) {
      messageData.file_meta = file_meta;
      // Log chi tiết để debug
      console.log("Forwarding message with file:", {
        url: file_meta.url,
        file_type: file_meta.file_type,
        file_name: file_meta.file_name,
        file_size: file_meta.file_size,
      });
    }
    // Tạo tin nhắn mới dựa trên loại (cá nhân hoặc nhóm)
    let forwardedMessage;

    if (isGroup) {
      // Chuyển tiếp tới nhóm
      // Cần tìm conversation_id từ group_id
      const group = await Group.findById(receiverId);
      if (!group) {
        throw new Error("Nhóm không tồn tại");
      }

      if (!group.conversation_id) {
        throw new Error("Cuộc trò chuyện của nhóm không tồn tại");
      }

      // Sử dụng conversation_id của nhóm
      forwardedMessage = await this.sendGroupMessage(
        senderId,
        group.conversation_id.toString(), // Sử dụng conversation_id thay vì group_id
        messageData,
        null, // không có file mới, sử dụng file_meta từ tin nhắn gốc
        skipSocketNotification
      );
    } else {
      // Chuyển tiếp tới cá nhân
      forwardedMessage = await this.sendMessage(
        senderId,
        receiverId,
        messageData,
        null, // không có file mới, sử dụng file_meta từ tin nhắn gốc
        skipSocketNotification
      );
    }
    // Cập nhật thông tin về tin nhắn gốc
    if (forwardedMessage) {
      forwardedMessage.forwarded_from = {
        original_message_id: originalMessage._id,
        original_sender_id: originalMessage.sender_id,
        forwarded_at: Date.now(),
      };

      // Đảm bảo file_meta được sao chép nếu chưa có
      if (originalMessage.file_meta && !forwardedMessage.file_meta) {
        forwardedMessage.file_meta = originalMessage.file_meta;
        console.log("Added missing file_meta to forwarded message");
      }

      await forwardedMessage.save();

      // Log tin nhắn đã chuyển tiếp để debug
      console.log("Forwarded message details after save:", {
        message_id: forwardedMessage._id,
        type: forwardedMessage.message_type,
        has_file_meta: !!forwardedMessage.file_meta,
        file_url: forwardedMessage.file_meta?.url,
      });
    }

    // Trả về tin nhắn đã chuyển tiếp
    return forwardedMessage;
  } catch (error) {
    console.error("Lỗi khi chuyển tiếp tin nhắn:", error);
    throw error;
  }
};
