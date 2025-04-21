const CallService = require("../services/CallService");
const { successResponse, errorResponse } = require("../utils/response");

/**
 * Controller xử lý các request API liên quan đến cuộc gọi
 */
class CallController {
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
      return successResponse(res, "Lấy lịch sử cuộc gọi thành công", calls);
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
        return errorResponse(res, "ID cuộc gọi không hợp lệ", 400);
      }

      const call = await CallService.getCallById(callId);
      return successResponse(res, "Lấy thông tin cuộc gọi thành công", call);
    } catch (error) {
      return errorResponse(res, error.message, 500);
    }
  }

  /**
   * Lấy số liệu thống kê về cuộc gọi
   * @param {Object} req - Request object
   * @param {Object} res - Response object
   * @returns {Object} Response với thông tin thống kê
   */
  async getCallStatistics(req, res) {
    try {
      const userId = req.user.id;
      const stats = await CallService.getCallStatistics(userId);
      return successResponse(res, "Lấy thống kê cuộc gọi thành công", stats);
    } catch (error) {
      return errorResponse(res, error.message, 500);
    }
  }
}

module.exports = new CallController();
