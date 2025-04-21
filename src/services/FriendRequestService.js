const FriendRequest = require("../models/FriendRequest");
const User = require("../models/User");
const mongoose = require("mongoose");

class FriendRequestService {
  static async sendFriendRequest(senderId, receiverId, message) {
    const existingRequest = await FriendRequest.findOne({
      sender: senderId,
      receiver: receiverId,
    });
    if (existingRequest) {
      throw new Error("Lời mời kết bạn đã tồn tại");
    }

    const friendRequest = new FriendRequest({
      sender: senderId,
      receiver: receiverId,
      message,
    });
    return await friendRequest.save();
  }

  static async respondToFriendRequest(requestId, status) {
    const friendRequest = await FriendRequest.findById(requestId);
    if (!friendRequest) {
      throw new Error("Lời mời kết bạn không tồn tại");
    }

    if (friendRequest.status !== "pending") {
      throw new Error(
        "Bạn không thể phản hồi lời mời kết bạn này vì nó đã được xử lý trước đó"
      );
    }

    // Kiểm tra status hợp lệ
    if (!["accepted", "rejected"].includes(status)) {
      throw new Error(
        "Trạng thái không hợp lệ. Chỉ chấp nhận 'accepted' hoặc 'rejected'"
      );
    }

    // Nếu chấp nhận lời mời, thêm cả hai người dùng vào danh sách bạn bè của nhau
    if (status === "accepted") {
      const session = await mongoose.startSession();
      try {
        await session.withTransaction(async () => {
          const senderId = friendRequest.sender;
          const receiverId = friendRequest.receiver;

          // Thêm người gửi vào danh sách bạn bè của người nhận
          await User.findByIdAndUpdate(
            receiverId,
            { $addToSet: { friends: senderId } },
            { session }
          );

          // Thêm người nhận vào danh sách bạn bè của người gửi
          await User.findByIdAndUpdate(
            senderId,
            { $addToSet: { friends: receiverId } },
            { session }
          );
        });
      } catch (error) {
        throw new Error("Không thể thêm bạn bè: " + error.message);
      } finally {
        session.endSession();
      }

      // Cập nhật trạng thái cho lời mời được chấp nhận
      friendRequest.status = status;
      friendRequest.updated_at = new Date();

      // Lưu cập nhật trạng thái
      const updatedRequest = await friendRequest.save();

      // Nạp thông tin người gửi và người nhận để trả về thông tin đầy đủ
      await updatedRequest.populate("sender", "name email primary_avatar");
      await updatedRequest.populate("receiver", "name email primary_avatar");

      return updatedRequest;
    }
    // Nếu từ chối lời mời, xóa lời mời để người dùng có thể gửi lại sau này
    else if (status === "rejected") {
      // Lưu thông tin trước khi xóa để trả về
      const senderInfo = await User.findById(friendRequest.sender).select(
        "name email primary_avatar"
      );
      const receiverInfo = await User.findById(friendRequest.receiver).select(
        "name email primary_avatar"
      );

      // Xóa yêu cầu kết bạn
      await FriendRequest.findByIdAndDelete(requestId);

      // Trả về thông tin của yêu cầu đã bị xóa
      return {
        _id: requestId,
        sender: senderInfo,
        receiver: receiverInfo,
        status: "rejected",
        message: friendRequest.message,
        created_at: friendRequest.created_at,
        updated_at: new Date(),
        request_type: friendRequest.request_type,
      };
    }
  }

  // Lấy danh sách lời mời kết bạn cho người dùng
  static async getFriendRequests(userId) {
    return await FriendRequest.find({
      receiver: userId,
      status: "pending",
    }).populate("sender", "name email");
  }

  // Lấy danh sách lời mời kết bạn đã gửi
  static async getSentFriendRequests(userId) {
    return await FriendRequest.find({ sender: userId }).populate(
      "receiver",
      "name email"
    );
  }
  static async cancelFriendRequest(requestId, userId){
    try {
      // Find the friend request
      const friendRequest = await FriendRequest.findById(requestId);
      
      if (!friendRequest) {
        throw new Error('Không tìm thấy lời mời kết bạn');
      }
      
      // Log the IDs for debugging
      console.log(`Service: Request ID: ${requestId}`);
      console.log(`Service: User ID attempting to cancel: ${userId}`);
      console.log(`Service: Sender ID from request: ${friendRequest.sender}`);
      
      // Convert ObjectId to string for comparison
      const senderId = friendRequest.sender.toString();
      
      // Skip permission check if userId matches sender or is not provided
      if (userId && senderId !== userId) {
        console.log(`Permission error: User ${userId} tried to cancel request ${requestId} sent by ${senderId}`);
        throw new Error('Bạn không có quyền hủy lời mời kết bạn này');
      }
      
      // Delete the friend request
      await FriendRequest.findByIdAndDelete(requestId);
      
      return { success: true };
    } catch (error) {
      console.error('Error in cancelFriendRequest service:', error);
      throw error;
    }
  }
}

module.exports = FriendRequestService;
