const CallService = require('../services/CallService');
const { successResponse, errorResponse } = require('../utils/response');

/**
 * Controller xử lý các request API liên quan đến cuộc gọi
 */
class CallController {
  /**
   * Tạo một cuộc gọi mới
   * @param {Object} req - Request object
   * @param {Object} res - Response object
   * @returns {Object} Response với thông tin cuộc gọi đã tạo
   */
  async createCall(req, res) {
    try {
      const { receiverIds, type, groupId } = req.body;
      const callerId = req.user.id;
      
      if (!receiverIds || !Array.isArray(receiverIds) || receiverIds.length === 0) {
        return errorResponse(res, 'Danh sách người nhận không hợp lệ', 400);
      }
      
      if (!type || !['audio', 'video'].includes(type)) {
        return errorResponse(res, 'Loại cuộc gọi không hợp lệ', 400);
      }
      
      const call = await CallService.createCall(callerId, receiverIds, type, groupId);
      return successResponse(res, 'Tạo cuộc gọi thành công', call);
    } catch (error) {
      return errorResponse(res, error.message, 500);
    }
  }

  /**
   * Kết thúc một cuộc gọi
   * @param {Object} req - Request object
   * @param {Object} res - Response object
   * @returns {Object} Response với thông tin cuộc gọi đã cập nhật
   */
  async endCall(req, res) {
    try {
      const { callId } = req.params;
      
      if (!callId) {
        return errorResponse(res, 'ID cuộc gọi không hợp lệ', 400);
      }
      
      const call = await CallService.endCall(callId);
      return successResponse(res, 'Kết thúc cuộc gọi thành công', call);
    } catch (error) {
      return errorResponse(res, error.message, 500);
    }
  }

  /**
   * Từ chối một cuộc gọi
   * @param {Object} req - Request object
   * @param {Object} res - Response object
   * @returns {Object} Response với thông tin cuộc gọi đã cập nhật
   */
  async rejectCall(req, res) {
    try {
      const { callId } = req.params;
      
      if (!callId) {
        return errorResponse(res, 'ID cuộc gọi không hợp lệ', 400);
      }
      
      const call = await CallService.rejectCall(callId);
      return successResponse(res, 'Từ chối cuộc gọi thành công', call);
    } catch (error) {
      return errorResponse(res, error.message, 500);
    }
  }

  /**
   * Lấy lịch sử cuộc gọi của một người dùng
   * @param {Object} req - Request object
   * @param {Object} res - Response object
   * @returns {Object} Response với danh sách cuộc gọi
   */
  async getCallHistory(req, res) {
    try {
      const userId = req.user.id;
      const limit = parseInt(req.query.limit) || 20;
      const skip = parseInt(req.query.skip) || 0;
      
      const calls = await CallService.getCallHistory(userId, limit, skip);
      return successResponse(res, 'Lấy lịch sử cuộc gọi thành công', calls);
    } catch (error) {
      return errorResponse(res, error.message, 500);
    }
  }

  /**
   * Lấy thông tin chi tiết của một cuộc gọi
   * @param {Object} req - Request object
   * @param {Object} res - Response object
   * @returns {Object} Response với thông tin cuộc gọi
   */
  async getCallDetail(req, res) {
    try {
      const { callId } = req.params;
      
      if (!callId) {
        return errorResponse(res, 'ID cuộc gọi không hợp lệ', 400);
      }
      
      const call = await CallService.getCallById(callId);
      return successResponse(res, 'Lấy thông tin cuộc gọi thành công', call);
    } catch (error) {
      return errorResponse(res, error.message, 500);
    }
  }
}

module.exports = new CallController();