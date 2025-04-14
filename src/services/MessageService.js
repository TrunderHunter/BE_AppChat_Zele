const Message = require("../models/Message");
const Conversation = require("../models/Conversation");
const User = require("../models/User");
const mongoose = require("mongoose");
const {
  sendMessageToUser,
  notifyUsersAboutConversation,
  onlineUsers,
  io, // Import socket instance
} = require("../socket/socket");
const { uploadFileToS3 } = require("../utils/S3Uploader"); // Import module upload file

exports.sendMessage = async (senderId, receiverId, messageData, file) => {
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
    fileMeta = await uploadFileToS3(file); // Sử dụng module upload file
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
    file_meta: fileMeta, // Thêm thông tin file
  });

  (await message.save()).populate(
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
          name: sender.name,
          primary_avatar: sender.primary_avatar,
        },
        {
          user_id: receiverId,
          name: receiver.name,
          primary_avatar: receiver.primary_avatar,
        },
      ],
      type: "personal",
      last_message: message._id,
      messages: [
        {
          message_id: message._id,
          sender_id: senderId,
          content: content,
          timestamp: message.timestamp,
        },
      ],
    });

    await conversation.populate("last_message");

    // Gửi thông báo qua WebSocket cho cả hai người dùng về đoạn hội thoại mới
    notifyUsersAboutConversation(
      [senderId, receiverId],
      "newConversation",
      conversation
    );

    // Gửi thông báo qua WebSocket
    notifyUsersAboutConversation(
      [senderId, receiverId],
      "updateLastMessage",
      conversation
    );
  } else {
    conversation.last_message = message._id;
    conversation.updated_at = Date.now();
    conversation.messages.push({
      message_id: message._id,
      sender_id: senderId,
      content: content,
      timestamp: message.timestamp,
    });

    await conversation.populate("last_message");

    // Gửi thông báo qua WebSocket
    notifyUsersAboutConversation(
      [senderId, receiverId],
      "updateLastMessage",
      conversation
    );
  }

  await conversation.save();

  // Gửi tin nhắn qua socket cho người nhận nếu họ đang online
  if (onlineUsers.has(receiverId)) {
    sendMessageToUser(receiverId, "receiveMessage", message);
  } else {
    console.log(`User ${receiverId} is not online. Message saved to database.`);
  }

  return message;
};

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

  return message;
};
