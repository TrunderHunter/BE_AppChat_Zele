const Call = require('../models/Call');

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
        isGroupCall: !!groupId
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
        .populate('caller', 'name avatar')
        .populate('receivers', 'name avatar')
        .populate('group', 'name avatar');
        
      if (!call) {
        throw new Error('Không tìm thấy cuộc gọi');
      }
      
      return call;
    } catch (error) {
      throw new Error(`Không thể lấy thông tin cuộc gọi: ${error.message}`);
    }
  }
}

module.exports = new CallService();