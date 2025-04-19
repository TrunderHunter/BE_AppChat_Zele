const Conversation = require("../models/Conversation");
const mongoose = require("mongoose");

exports.getConversationsByUserId = async (userId) => {
  // Kiểm tra ObjectId hợp lệ
  if (!mongoose.Types.ObjectId.isValid(userId)) {
    throw new Error("Invalid user ID");
  }

  // Tìm tất cả các đoạn hội thoại mà người dùng tham gia
  const conversations = await Conversation.find({
    "participants.user_id": userId,
  })
    .populate("last_message")
    .populate({
      path: "participants.user_id",
      select: "name primary_avatar", // Chỉ lấy các trường cần thiết
    });

  // Chuyển đổi participants thành định dạng mong muốn
  const formattedConversations = conversations.map((conversation) => {
    const formattedParticipants = conversation.participants.map(
      (participant) => ({
        user_id: participant.user_id._id,
        name: participant.user_id.name,
        primary_avatar: participant.user_id.primary_avatar,
        _id: participant._id,
      })
    );

    return {
      ...conversation.toObject(),
      participants: formattedParticipants,
    };
  });

  return formattedConversations;
};
exports.getConversationBetweenUsers = async (userId1, userId2) => {
  console.log("userId1:", userId1);
  console.log("userId2:", userId2);

  // 1. Kiểm tra format ObjectId
  if (
    !mongoose.isValidObjectId(userId1) ||
    !mongoose.isValidObjectId(userId2)
  ) {
    throw new Error("Invalid user IDs");
  }

  // 2. Query conversation giữa hai user, để Mongoose tự cast chuỗi → ObjectId
  const conversation = await Conversation.findOne({
    type: "personal",
    participants: {
      $all: [
        { $elemMatch: { user_id: userId1 } },
        { $elemMatch: { user_id: userId2 } }
      ]
    }
  })
    .populate("last_message")
    .populate({
      path: "messages",
      options: { sort: { createdAt: 1 } }
    })
    .populate("participants.user_id");

  if (!conversation) {
    return null;
  }

  // 3. Format lại participants để trả về đúng structure
  const formattedParticipants = conversation.participants.map((p) => ({
    user_id: p.user_id._id,
    name: p.user_id.name,
    primary_avatar: p.user_id.primary_avatar,
    _id: p._id,
  }));

  return {
    ...conversation.toObject(),
    participants: formattedParticipants,
    messages: conversation.messages || [],
  };
};