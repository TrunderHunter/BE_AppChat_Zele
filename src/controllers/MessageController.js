const MessageService = require("../services/MessageService");
const sendResponse = require("../utils/response");
const multer = require("multer");
const upload = multer(); // Sử dụng multer để xử lý file upload

exports.sendMessage = async (req, res) => {
  try {
    const senderId = req.user._id; // Extract sender ID from authenticated user
    const {
      receiverId,
      message_type,
      content,
      file_id,
      mentions,
      self_destruct_timer,
    } = req.body;

    const file = req.file; // Lấy file từ request

    if (!receiverId || !message_type) {
      return sendResponse(
        res,
        400,
        "Receiver ID and message type are required",
        "error"
      );
    }

    const message = await MessageService.sendMessage(
      senderId,
      receiverId,
      {
        message_type,
        content,
        file_id,
        mentions,
        self_destruct_timer,
      },
      file
    );

    sendResponse(res, 200, "Message sent successfully", "success", message);
  } catch (error) {
    if (error.message === "File size exceeds the 10MB limit") {
      return sendResponse(res, 400, error.message, "error");
    }
    sendResponse(res, 500, "Error sending message", "error", {
      error: error.message,
    });
  }
};

exports.getMessagesByConversationId = async (req, res) => {
  try {
    const { conversationId } = req.params;

    const messages = await MessageService.getMessagesByConversationId(
      conversationId
    );

    // Changed this condition to return empty array instead of error
    if (!messages || messages.length === 0) {
      return sendResponse(
        res,
        200,
        "No messages found for this conversation",
        "success",
        []
      );
    }

    sendResponse(
      res,
      200,
      "Messages fetched successfully",
      "success",
      messages
    );
  } catch (error) {
    sendResponse(res, 500, "Error fetching messages", "error", {
      error: error.message,
    });
  }
};

exports.revokeMessage = async (req, res) => {
  try {
    const { messageId } = req.params;
    const userId = req.user._id; // Lấy ID người dùng từ token

    const result = await MessageService.revokeMessage(messageId, userId);

    if (!result) {
      return sendResponse(
        res,
        403,
        "You are not allowed to revoke this message",
        "error"
      );
    }

    sendResponse(res, 200, "Message revoked successfully", "success", result);
  } catch (error) {
    sendResponse(res, 500, "Error revoking message", "error", {
      error: error.message,
    });
  }
};

exports.sendGroupMessage = async (req, res) => {
  try {
    const senderId = req.user._id;
    const {
      conversationId,
      message_type,
      content,
      file_id,
      mentions,
      self_destruct_timer,
    } = req.body;
    const file = req.file;

    if (!conversationId) {
      return sendResponse(res, 400, "Thiếu ID cuộc trò chuyện", "error");
    }

    const message = await MessageService.sendGroupMessage(
      senderId,
      conversationId,
      {
        message_type,
        content,
        file_id,
        mentions,
        self_destruct_timer,
      },
      file
    );

    sendResponse(res, 200, "Gửi tin nhắn nhóm thành công", "success", message);
  } catch (error) {
    if (error.message === "File size exceeds the 10MB limit") {
      return sendResponse(res, 400, error.message, "error");
    }
    sendResponse(res, 500, "Error sending group message", "error", {
      error: error.message,
    });
  }
};
