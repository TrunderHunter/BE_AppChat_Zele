const express = require("express");
const router = express.Router();
const FriendRequestController = require("../controllers/FriendRequestController");
const authMiddleware = require("../middlewares/authMiddleware");

router.post("/send", authMiddleware, FriendRequestController.sendFriendRequest);
router.put(
  "/respond",
  authMiddleware,
  FriendRequestController.respondToFriendRequest
);

// http://localhost:5000/api/friend-request/list
router.get("/list", authMiddleware, FriendRequestController.getFriendRequests);

// http://localhost:5000/api/friend-request/sent
router.get(
  "/sent",
  authMiddleware,
  FriendRequestController.getSentFriendRequests
);

router.delete('/cancel/:requestId', authMiddleware, FriendRequestController.cancelFriendRequest);

module.exports = router;
