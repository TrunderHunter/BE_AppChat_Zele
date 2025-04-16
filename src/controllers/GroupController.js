const GroupService = require("../services/GroupService");
const sendResponse = require("../utils/response");
const { uploadFileToS3 } = require("../utils/S3Uploader");

class GroupController {
  /**
   * Tạo nhóm chat mới
   */
  static async createGroup(req, res) {
    try {
      const { name, description, members } = req.body;
      const creatorId = req.user._id;
      const avatarUrl = req.body.avatar; // URL avatar từ front-end
      const avatarFile = req.file; // File avatar được upload

      let avatar = avatarUrl;

      // Nếu có file avatar, upload lên S3
      if (avatarFile) {
        try {
          const uploadResult = await uploadFileToS3(avatarFile);
          avatar = uploadResult.url;
        } catch (uploadError) {
          return sendResponse(
            res,
            400,
            "Không thể upload avatar: " + uploadError.message,
            "error"
          );
        }
      }

      if (!name) {
        return sendResponse(res, 400, "Tên nhóm là bắt buộc", "error");
      }

      const result = await GroupService.createGroup(
        { name, description, avatar, members },
        creatorId
      );

      sendResponse(res, 201, "Tạo nhóm thành công", "success", result);
    } catch (error) {
      sendResponse(res, 500, error.message, "error");
    }
  }

  /**
   * Thêm thành viên vào nhóm
   */
  static async addMemberToGroup(req, res) {
    try {
      const { groupId, memberId } = req.body;
      const addedBy = req.user._id;

      if (!groupId || !memberId) {
        return sendResponse(
          res,
          400,
          "ID nhóm và ID thành viên là bắt buộc",
          "error"
        );
      }

      const result = await GroupService.addMemberToGroup(
        groupId,
        memberId,
        addedBy
      );

      sendResponse(res, 200, "Thêm thành viên thành công", "success", result);
    } catch (error) {
      sendResponse(
        res,
        error.message.includes("không có quyền") ? 403 : 500,
        error.message,
        "error"
      );
    }
  }

  /**
   * Xóa thành viên khỏi nhóm
   */
  static async removeMemberFromGroup(req, res) {
    try {
      const { groupId, memberId } = req.body;
      const removedBy = req.user._id;

      if (!groupId || !memberId) {
        return sendResponse(
          res,
          400,
          "ID nhóm và ID thành viên là bắt buộc",
          "error"
        );
      }

      const result = await GroupService.removeMemberFromGroup(
        groupId,
        memberId,
        removedBy
      );

      // Nếu memberID bị xóa là romveBy thì thông báo người dùng này đã rời khỏi nhóm
      if (removedBy.toString() === memberId.toString()) {
        sendResponse(
          res,

          200,
          "Bạn đã rời khỏi nhóm",
          "success",
          result
        );
      } else {
        sendResponse(res, 200, "Xóa thành viên thành công", "success", result);
      }
    } catch (error) {
      sendResponse(
        res,
        error.message.includes("không có quyền") ? 403 : 500,
        error.message,
        "error"
      );
    }
  }

  /**
   * Thay đổi vai trò thành viên
   */
  static async changeRoleMember(req, res) {
    try {
      const { groupId, memberId, role } = req.body;
      const changedBy = req.user._id;

      if (!groupId || !memberId || !role) {
        return sendResponse(
          res,
          400,
          "ID nhóm, ID thành viên và vai trò mới là bắt buộc",
          "error"
        );
      }

      const result = await GroupService.changeRoleMember(
        groupId,
        memberId,
        role,
        changedBy
      );

      sendResponse(res, 200, "Thay đổi vai trò thành công", "success", result);
    } catch (error) {
      sendResponse(
        res,
        error.message.includes("không có quyền") ? 403 : 500,
        error.message,
        "error"
      );
    }
  }

  /**
   * Cập nhật thông tin nhóm
   */
  static async updateGroup(req, res) {
    try {
      const { groupId } = req.params;
      const { name, description, settings } = req.body;
      const userId = req.user._id;
      const avatarUrl = req.body.avatar; // URL avatar từ front-end
      const avatarFile = req.file; // File avatar được upload

      let updateData = { name, description, settings };

      // Nếu có file avatar, upload lên S3
      if (avatarFile) {
        try {
          const uploadResult = await uploadFileToS3(avatarFile);
          updateData.avatar = uploadResult.url;
        } catch (uploadError) {
          return sendResponse(
            res,
            400,
            "Không thể upload avatar: " + uploadError.message,
            "error"
          );
        }
      } else if (avatarUrl) {
        updateData.avatar = avatarUrl;
      }

      if (!groupId) {
        return sendResponse(res, 400, "ID nhóm là bắt buộc", "error");
      }

      const result = await GroupService.updateGroup(
        groupId,
        updateData,
        userId
      );

      sendResponse(res, 200, "Cập nhật nhóm thành công", "success", result);
    } catch (error) {
      sendResponse(
        res,
        error.message.includes("không có quyền") ? 403 : 500,
        error.message,
        "error"
      );
    }
  }

  /**
   * Lấy thông tin chi tiết nhóm
   */
  static async getGroupById(req, res) {
    try {
      const { groupId } = req.params;
      const userId = req.user._id;

      if (!groupId) {
        return sendResponse(res, 400, "ID nhóm là bắt buộc", "error");
      }

      const group = await GroupService.getGroupById(groupId, userId);

      sendResponse(res, 200, "Lấy thông tin nhóm thành công", "success", group);
    } catch (error) {
      sendResponse(
        res,
        error.message.includes("không có quyền") ? 403 : 404,
        error.message,
        "error"
      );
    }
  }

  /**
   * Lấy tất cả nhóm của người dùng
   */
  static async getGroupsByUserId(req, res) {
    try {
      const userId = req.user._id;

      const groups = await GroupService.getGroupsByUserId(userId);

      sendResponse(
        res,
        200,
        "Lấy danh sách nhóm thành công",
        "success",
        groups
      );
    } catch (error) {
      sendResponse(res, 500, error.message, "error");
    }
  }
}

module.exports = GroupController;
