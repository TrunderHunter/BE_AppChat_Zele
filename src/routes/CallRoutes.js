const express = require("express");
const router = express.Router();
const CallController = require("../controllers/CallController");

// Endpoint để lấy lịch sử cuộc gọi
router.get("/history", CallController.getCallHistory);

// Endpoint để lấy thống kê cuộc gọi
router.get("/statistics", CallController.getCallStatistics);

// Endpoint để lấy chi tiết cuộc gọi (đặt sau các route cụ thể khác)
router.get("/:callId", CallController.getCallDetail);

module.exports = router;
