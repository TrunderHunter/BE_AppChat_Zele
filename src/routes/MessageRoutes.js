const express = require("express");
const router = express.Router();
const multer = require("multer");
const upload = multer(); // Middleware xử lý file upload
const MessageController = require("../controllers/MessageController");

// Route to send a message
// http://localhost:5000/api/message/send
router.post("/send", upload.single("file"), MessageController.sendMessage);

// Route để gửi tin nhắn vào nhóm
// http://localhost:5000/api/message/send-group
router.post(
  "/send-group",
  upload.single("file"),
  MessageController.sendGroupMessage
);

// Route để lấy các tin nhắn của một cuộc hội thoại với phân trang
// http://localhost:5000/api/message/getByConversation/:conversationId?limit=10&before_id=123
router.get(
  "/getByConversation/:conversationId",
  MessageController.getMessagesByConversationId
);

// http://localhost:5000/api/message/revoke/:messageId
router.put("/revoke/:messageId", MessageController.revokeMessage);

// Route để chuyển tiếp tin nhắn
// http://localhost:5000/api/message/forward
router.post("/forward", MessageController.forwardMessage);

module.exports = router;
