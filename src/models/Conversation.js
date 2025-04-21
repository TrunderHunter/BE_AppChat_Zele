const mongoose = require("mongoose");

const ConversationSchema = new mongoose.Schema({
  // ID, tên hình ảnh của người tham gia cuộc trò chuyện
  participants: [
    {
      user_id: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    },
  ],
  type: {
    type: String,
    enum: ["personal", "group", "channel"],
    default: "personal",
  },
  group_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Group",
  },
  last_message: { type: mongoose.Schema.Types.ObjectId, ref: "Message" },
  name: { type: String }, // Tên của nhóm chat (chỉ sử dụng cho nhóm)
  avatar: { type: String }, // Avatar của nhóm (chỉ sử dụng cho nhóm)
  messages: [
    {
      message_id: { type: mongoose.Schema.Types.ObjectId, ref: "Message" },
      sender_id: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        required: true,
      },
      content: { type: String, required: true },
      timestamp: { type: Date, default: Date.now },
    },
  ],
  updated_at: { type: Date, default: Date.now },
});

module.exports = mongoose.model("Conversation", ConversationSchema);
