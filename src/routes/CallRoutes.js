const express = require('express');
const router = express.Router();
const CallController = require('../controllers/CallController');

// Endpoint để tạo cuộc gọi mới
router.post('/', CallController.createCall);

// Endpoint để kết thúc cuộc gọi
router.put('/:callId/end', CallController.endCall);

// Endpoint để từ chối cuộc gọi
router.put('/:callId/reject', CallController.rejectCall);

// Endpoint để lấy lịch sử cuộc gọi
router.get('/history', CallController.getCallHistory);

// Endpoint để lấy chi tiết cuộc gọi
router.get('/:callId', CallController.getCallDetail);

module.exports = router;