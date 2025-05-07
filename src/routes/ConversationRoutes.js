const express = require("express");
const router = express.Router();
const ConversationController = require("../controllers/ConversationController");
const authMiddleware = require("../middlewares/authMiddleware");

// Route mặc định để lấy tất cả các đoạn hội thoại của người dùng
// http://localhost:5000/api/conversation/
router.get(
  "/",
  authMiddleware,
  ConversationController.getConversationsByUserId
);

// Route để lấy tất cả các đoạn hội thoại của người dùng
// http://localhost:5000/api/conversation/getAll
router.get(
  "/getAll",
  authMiddleware,
  ConversationController.getConversationsByUserId
);

// Route để kiểm tra đoạn hội thoại giữa hai người dùng
// http://localhost:5000/api/conversation/checkBetweenUsers
router.get(
  "/checkBetweenUsers",
  authMiddleware,
  ConversationController.getConversationBetweenUsers
);

// Thêm route tương thích với frontend
router.get(
  "/between",
  authMiddleware,
  ConversationController.getConversationBetweenUsers
);

// Route để lấy cuộc hội thoại theo ID
// http://localhost:5000/api/conversation/:conversationId
router.get(
  "/:conversationId",
  authMiddleware,
  ConversationController.getConversationById
);

module.exports = router;
