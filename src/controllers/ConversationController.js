const ConversationService = require("../services/ConversationService");
const sendResponse = require("../utils/response");

exports.getConversationsByUserId = async (req, res) => {
  try {
    const userId = req.user._id; // Lấy userId từ token đã xác thực

    const conversations = await ConversationService.getConversationsByUserId(
      userId
    );

    if (!conversations || conversations.length === 0) {
      return sendResponse(res, 200, "No conversations found", {});
    }

    sendResponse(
      res,
      200,
      "Conversations fetched successfully",
      "success",
      conversations
    );
  } catch (error) {
    sendResponse(res, 500, "Error fetching conversations", "error", {
      error: error.message,
    });
  }
};
exports.getConversationBetweenUsers = async (req, res) => {
  try {
    const { userId1, userId2 } = req.query;
    const conversation = await ConversationService.getConversationBetweenUsers(userId1, userId2);
    if (conversation) {
      res.status(200).json({ status: "success", data: conversation });
    } else {
      res.status(404).json({ status: "not_found", message: "No conversation found" });
    }
  } catch (error) {
    res.status(500).json({ status: "error", message: error.message });
  }
};
