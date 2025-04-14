const express = require("express");
const router = express.Router();
const multer = require("multer");
const upload = multer(); // Middleware xử lý file upload
const MessageController = require("../controllers/MessageController");

// Route to send a message
// http://localhost:5000/api/message/send
router.post("/send", upload.single("file"), MessageController.sendMessage);

// Route để lấy tất cả các tin nhắn của một cuộc hội thoại
// http://localhost:5000/api/message/getByConversation/:conversationId
router.get(
  "/getByConversation/:conversationId",
  MessageController.getMessagesByConversationId
);

// http://localhost:5000/api/message/revoke/:messageId
router.put("/revoke/:messageId", MessageController.revokeMessage);

module.exports = router;
