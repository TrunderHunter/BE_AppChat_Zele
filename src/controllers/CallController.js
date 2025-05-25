const CallService = require("../services/CallService");
const sendResponse = require("../utils/response");

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
      return sendResponse(
        res,
        200,
        "Lấy lịch sử cuộc gọi thành công",
        "success",
        calls
      );
    } catch (error) {
      return sendResponse(res, 500, error.message, "error");
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
        return sendResponse(res, 400, "ID cuộc gọi không hợp lệ", "error");
      }

      const call = await CallService.getCallById(callId);
      return sendResponse(
        res,
        200,
        "Lấy thông tin cuộc gọi thành công",
        "success",
        call
      );
    } catch (error) {
      return sendResponse(res, 500, error.message, "error");
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
      return sendResponse(
        res,
        200,
        "Lấy thống kê cuộc gọi thành công",
        "success",
        stats
      );
    } catch (error) {
      return sendResponse(res, 500, error.message, "error");
    }
  }
}

module.exports = new CallController();
