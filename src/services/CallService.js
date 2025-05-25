const Call = require("../models/Call");

/**
 * Service xử lý logic nghiệp vụ liên quan đến cuộc gọi
 */
class CallService {
  /**
   * Tạo một cuộc gọi mới
   * @param {String} callerId - ID người gọi
   * @param {Array} receiverIds - Mảng ID người nhận cuộc gọi
   * @param {String} type - Loại cuộc gọi: 'audio' hoặc 'video'
   * @param {String} groupId - ID của nhóm nếu là cuộc gọi nhóm
   * @returns {Object} Thông tin cuộc gọi đã tạo
   */
  async createCall(callerId, receiverIds, type, groupId = null) {
    try {
      const callData = {
        caller: callerId,
        receivers: receiverIds,
        type,
        isGroupCall: !!groupId,
      };

      if (groupId) {
        callData.group = groupId;
      }

      const call = await Call.createNewCall(callData);
      return call;
    } catch (error) {
      throw new Error(`Không thể tạo cuộc gọi: ${error.message}`);
    }
  }

  /**
   * Kết thúc cuộc gọi
   * @param {String} callId - ID của cuộc gọi
   * @returns {Object} Thông tin cuộc gọi đã cập nhật
   */
  async endCall(callId) {
    try {
      const call = await Call.endCall(callId);
      return call;
    } catch (error) {
      throw new Error(`Không thể kết thúc cuộc gọi: ${error.message}`);
    }
  }

  /**
   * Đánh dấu cuộc gọi bị từ chối
   * @param {String} callId - ID của cuộc gọi
   * @returns {Object} Thông tin cuộc gọi đã cập nhật
   */
  async rejectCall(callId) {
    try {
      const call = await Call.rejectCall(callId);
      return call;
    } catch (error) {
      throw new Error(`Không thể từ chối cuộc gọi: ${error.message}`);
    }
  }

  /**
   * Cập nhật trạng thái của cuộc gọi
   * @param {String} callId - ID của cuộc gọi
   * @param {String} status - Trạng thái mới ('missed', 'answered', 'rejected')
   * @returns {Object} Thông tin cuộc gọi đã cập nhật
   */
  async updateCallStatus(callId, status) {
    try {
      const call = await Call.findById(callId);

      if (!call) {
        throw new Error("Không tìm thấy cuộc gọi");
      }

      call.status = status;

      if (status === "answered") {
        // Nếu cuộc gọi được chấp nhận, ghi lại thời điểm
        call.answeredAt = new Date();
      }

      await call.save();
      return call;
    } catch (error) {
      throw new Error(
        `Không thể cập nhật trạng thái cuộc gọi: ${error.message}`
      );
    }
  }

  /**
   * Thêm người tham gia vào cuộc gọi nhóm
   * @param {String} callId - ID của cuộc gọi
   * @param {String} participantId - ID của người tham gia
   * @returns {Object} Thông tin cuộc gọi đã cập nhật
   */
  async addCallParticipant(callId, participantId) {
    try {
      const call = await Call.findById(callId);

      if (!call) {
        throw new Error("Không tìm thấy cuộc gọi");
      }

      // Kiểm tra nếu người dùng chưa có trong danh sách người nhận
      if (!call.receivers.includes(participantId)) {
        call.receivers.push(participantId);
        await call.save();
      }

      return call;
    } catch (error) {
      throw new Error(
        `Không thể thêm người tham gia vào cuộc gọi: ${error.message}`
      );
    }
  }

  /**
   * Lấy lịch sử cuộc gọi của một người dùng
   * @param {String} userId - ID của người dùng
   * @param {Number} limit - Số lượng kết quả tối đa
   * @param {Number} skip - Số lượng kết quả bỏ qua (để phân trang)
   * @returns {Array} Danh sách cuộc gọi
   */
  async getCallHistory(userId, limit = 20, skip = 0) {
    try {
      const calls = await Call.getCallHistory(userId, limit, skip);
      return calls;
    } catch (error) {
      throw new Error(`Không thể lấy lịch sử cuộc gọi: ${error.message}`);
    }
  }

  /**
   * Lấy thông tin chi tiết của một cuộc gọi
   * @param {String} callId - ID của cuộc gọi
   * @returns {Object} Thông tin cuộc gọi
   */
  async getCallById(callId) {
    try {
      const call = await Call.findById(callId)
        .populate("caller", "name avatar")
        .populate("receivers", "name avatar")
        .populate("group", "name avatar");

      if (!call) {
        throw new Error("Không tìm thấy cuộc gọi");
      }

      return call;
    } catch (error) {
      throw new Error(`Không thể lấy thông tin cuộc gọi: ${error.message}`);
    }
  }

  /**
   * Lấy thống kê về cuộc gọi của một người dùng
   * @param {String} userId - ID của người dùng
   * @returns {Object} Thông tin thống kê cuộc gọi
   */
  async getCallStatistics(userId) {
    try {
      // Tổng số cuộc gọi đã thực hiện
      const outgoingCalls = await Call.countDocuments({ caller: userId });

      // Tổng số cuộc gọi đã nhận
      const incomingCalls = await Call.countDocuments({ receivers: userId });

      // Số cuộc gọi nhỡ
      const missedCalls = await Call.countDocuments({
        receivers: userId,
        status: "missed",
      });

      // Số cuộc gọi từ chối
      const rejectedCalls = await Call.countDocuments({
        receivers: userId,
        status: "rejected",
      });

      // Số cuộc gọi video và audio
      const videoCalls = await Call.countDocuments({
        $or: [{ caller: userId }, { receivers: userId }],
        type: "video",
      });

      const audioCalls = await Call.countDocuments({
        $or: [{ caller: userId }, { receivers: userId }],
        type: "audio",
      });

      // Tổng thời lượng cuộc gọi (giây)
      const durationResult = await Call.aggregate([
        {
          $match: {
            $or: [{ caller: userId }, { receivers: userId }],
            status: "answered",
            duration: { $exists: true },
          },
        },
        {
          $group: {
            _id: null,
            totalDuration: { $sum: "$duration" },
          },
        },
      ]);

      const totalDuration =
        durationResult.length > 0 ? durationResult[0].totalDuration : 0;

      // Thời lượng trung bình mỗi cuộc gọi (giây)
      const answeredCalls = await Call.countDocuments({
        $or: [{ caller: userId }, { receivers: userId }],
        status: "answered",
        duration: { $exists: true },
      });

      const avgDuration =
        answeredCalls > 0 ? Math.round(totalDuration / answeredCalls) : 0;

      return {
        total: outgoingCalls + incomingCalls,
        outgoing: outgoingCalls,
        incoming: incomingCalls,
        missed: missedCalls,
        rejected: rejectedCalls,
        video: videoCalls,
        audio: audioCalls,
        totalDuration,
        avgDuration,
        answeredCalls,
      };
    } catch (error) {
      throw new Error(`Không thể lấy thống kê cuộc gọi: ${error.message}`);
    }
  }
}

module.exports = new CallService();
