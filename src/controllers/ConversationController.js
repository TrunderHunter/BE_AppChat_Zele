const ConversationService = require("../services/ConversationService");
const sendResponse = require("../utils/response");

exports.getConversationsByUserId = async (req, res) => {
  try {
    const userId = req.user._id; // Lấy userId từ token đã xác thực

    const conversations = await ConversationService.getConversationsByUserId(
      userId
    );

    if (!conversations || conversations.length === 0) {
      return sendResponse(res, 200, "No conversations found", "success", []);
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
    const conversation = await ConversationService.getConversationBetweenUsers(
      userId1,
      userId2
    );
    if (conversation) {
      sendResponse(
        res,
        200,
        "Conversation fetched successfully",
        "success",
        conversation
      );
    } else {
      sendResponse(res, 404, "No conversation found", "error");
    }
  } catch (error) {
    sendResponse(res, 500, error.message, "error");
  }
};

/**
 * Lấy thông tin cuộc hội thoại theo ID
 */
exports.getConversationById = async (req, res) => {
  try {
    const { conversationId } = req.params;
    const userId = req.user._id;

    if (!conversationId) {
      return sendResponse(res, 400, "ID cuộc hội thoại là bắt buộc", "error");
    }

    const conversation = await ConversationService.getConversationById(conversationId, userId);
    
    if (!conversation) {
      return sendResponse(res, 404, "Không tìm thấy cuộc hội thoại", "error");
    }

    return sendResponse(
      res,
      200,
      "Lấy thông tin cuộc hội thoại thành công",
      "success",
      conversation
    );
  } catch (error) {
    return sendResponse(res, 500, error.message, "error");
  }
};
