const mongoose = require("mongoose");

const MessageSchema = new mongoose.Schema({
  sender_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true,
  },  receiver_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true,
  }, // Can be user or group
  conversation_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Conversation",
  }, // ID của cuộc trò chuyện nhóm
  message_type: {
    type: String,
    enum: ["text", "image", "video", "file", "voice"],
    required: true,
  },
  content: { type: String },
  file_id: { type: mongoose.Schema.Types.ObjectId, ref: "File" },
  file_meta: {
    url: { type: String },
    file_type: { type: String },
    file_name: { type: String },
    file_size: { type: Number },
  },
  timestamp: { type: Date, default: Date.now },
  status: {
    type: String,
    enum: ["sent", "delivered", "seen"],
    default: "sent",
  },
  is_revoked: { type: Boolean, default: false }, // Đối với tin nhắn đã thu hồi
  message_meta: {
    is_edited: { type: Boolean, default: false },
    is_deleted: { type: Boolean, default: false },
    deleted_by_sender: { type: Boolean, default: false },
    deleted_by_receiver: { type: Boolean, default: false },
    is_encrypted: { type: Boolean, default: true },
    self_destruct_timer: { type: Number }, // In seconds
  },
  mentions: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],
  reactions: [
    {
      user_id: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
      reaction_type: { type: String, enum: ["like", "love", "laugh", "sad"] },
    },
  ],
  replies: [
    {
      reply_to: { type: mongoose.Schema.Types.ObjectId, ref: "Message" },
      content: { type: String },
      timestamp: { type: Date, default: Date.now },
    },
  ],
});

module.exports = mongoose.model("Message", MessageSchema);
