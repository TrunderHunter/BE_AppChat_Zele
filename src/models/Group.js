const mongoose = require("mongoose");

const GroupSchema = new mongoose.Schema({
  name: { type: String, required: true },
  description: { type: String },
  creator: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true,
  },
  avatar: { type: String },
  members: [
    {
      user: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
      role: {
        type: String,
        enum: ["admin", "moderator", "member"],
        default: "member",
      },
      joined_at: { type: Date, default: Date.now },
    },
  ],
  created_at: { type: Date, default: Date.now },
  updated_at: { type: Date, default: Date.now },
  settings: {
    who_can_send_messages: {
      type: String,
      enum: ["all", "admins_moderators", "admins"],
      default: "all",
    },
    who_can_add_members: {
      type: String,
      enum: ["all", "admins_moderators", "admins"],
      default: "admins",
    },
  },
  conversation_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Conversation",
  },
});

// Bảo đảm rằng ít nhất có một admin trong nhóm
GroupSchema.pre("save", function (next) {
  const hasAdmin = this.members.some((member) => member.role === "admin");
  if (!hasAdmin && this.members.length > 0) {
    return next(new Error("Group must have at least one admin"));
  }
  next();
});

module.exports = mongoose.model("Group", GroupSchema);
