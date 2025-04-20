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

exports.cancelFriendRequest = async (req, res) => {
  try {
    const { requestId } = req.params;
    const userId = req.user ? req.user.id : null;
    
    console.log(`Controller: Canceling request ${requestId} by user ${userId}`);

    if (!requestId) {
      return res.status(400).json({ 
        success: false, 
        message: 'ID của lời mời kết bạn không được cung cấp' 
      });
    }

    // Pass the user ID to the service
    const result = await FriendRequestService.cancelFriendRequest(requestId, userId);
    
    return res.status(200).json({
      success: true,
      message: 'Đã hủy lời mời kết bạn thành công',
      data: result
    });
  } catch (error) {
    console.error('Error canceling friend request:', error);
    
    // Check if this is a permission error
    if (error.message && error.message.includes('không có quyền')) {
      return res.status(403).json({
        success: false,
        message: error.message
      });
    }
    
    // For other errors
    return res.status(500).json({
      success: false,
      message: error.message || 'Đã xảy ra lỗi khi hủy lời mời kết bạn'
    });
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
