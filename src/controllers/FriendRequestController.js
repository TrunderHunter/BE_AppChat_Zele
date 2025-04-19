const FriendRequestService = require("../services/FriendRequestService");
const sendResponse = require("../utils/response");

exports.sendFriendRequest = async (req, res) => {
  try {
    const { receiverId, message } = req.body;
    const senderId = req.user._id;

    const friendRequest = await FriendRequestService.sendFriendRequest(
      senderId,
      receiverId,
      message
    );
    sendResponse(
      res,
      200,
      "Friend request sent successfully",
      "success",
      friendRequest
    );
  } catch (error) {
    sendResponse(res, 400, error.message, "error");
  }
};

exports.respondToFriendRequest = async (req, res) => {
  try {
    const { requestId, status } = req.body;

    const updatedRequest = await FriendRequestService.respondToFriendRequest(
      requestId,
      status
    );
    sendResponse(
      res,
      200,
      "Friend request updated successfully",
      "success",
      updatedRequest
    );
  } catch (error) {
    sendResponse(res, 400, error.message, "error");
  }
};

exports.getFriendRequests = async (req, res) => {
  try {
    const userId = req.user._id;

    const friendRequests = await FriendRequestService.getFriendRequests(userId);
    sendResponse(
      res,
      200,
      "Friend requests fetched successfully",
      "success",
      friendRequests
    );
  } catch (error) {
    sendResponse(res, 400, error.message, "error");
  }
};

exports.getSentFriendRequests = async (req, res) => {
  try {
    const userId = req.user._id;

    const sentRequests = await FriendRequestService.getSentFriendRequests(
      userId
    );
    sendResponse(
      res,
      200,
      "Sent friend requests fetched successfully",
      "success",
      sentRequests
    );
  } catch (error) {
    sendResponse(res, 400, error.message, "error");
  }
};
