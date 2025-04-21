const GroupService = require("../services/GroupService");
const sendResponse = require("../utils/response");
const { uploadFileToS3 } = require("../utils/S3Uploader");
const { io } = require("../socket/socket");

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

  /**
   * Lấy link tham gia nhóm
   */
  static async getGroupInviteLink(req, res) {
    try {
      const { groupId } = req.params;
      const userId = req.user._id;

      const result = await GroupService.getGroupInviteLink(groupId, userId);

      // Tạo URL đầy đủ để client có thể sử dụng
      const baseUrl = `${req.protocol}://${req.get("host")}`;
      const inviteUrl = `${baseUrl}/api/group/join/${result.invite_link.code}`;

      return sendResponse(res, 200, "Lấy link tham gia thành công", "success", {
        invite_link: {
          ...result.invite_link,
          url: inviteUrl,
        },
        can_share: result.can_share,
      });
    } catch (error) {
      return sendResponse(res, 500, error.message, "error");
    }
  }

  /**
   * Tham gia nhóm bằng link mời
   */
  static async joinGroupWithInviteLink(req, res) {
    try {
      const { inviteCode } = req.params;
      const userId = req.user._id;

      const group = await GroupService.joinGroupWithInviteLink(
        inviteCode,
        userId
      );

      // Kích hoạt sự kiện socket cho việc tham gia nhóm qua link
      if (io) {
        io.emit("user_joined_group_via_link", {
          groupId: group._id,
          userId: userId,
          group: group,
        });
      }

      return sendResponse(res, 200, "Tham gia nhóm thành công", "success", {
        group,
      });
    } catch (error) {
      return sendResponse(res, 500, error.message, "error");
    }
  }

  /**
   * Cập nhật trạng thái của link tham gia (bật/tắt)
   */
  static async updateInviteLinkStatus(req, res) {
    try {
      const { groupId } = req.params;
      const { isActive } = req.body;
      const userId = req.user._id;

      const result = await GroupService.updateInviteLinkStatus(
        groupId,
        isActive,
        userId
      );

      // Kích hoạt sự kiện socket cho việc cập nhật trạng thái link
      if (io) {
        io.emit("invite_link_status_updated", {
          groupId,
          isActive,
          updatedBy: userId,
        });
      }

      return sendResponse(res, 200, result.message, "success", result);
    } catch (error) {
      return sendResponse(res, 500, error.message, "error");
    }
  }

  /**
   * Tạo lại link tham gia mới
   */
  static async regenerateInviteLink(req, res) {
    try {
      const { groupId } = req.params;
      const userId = req.user._id;

      const result = await GroupService.regenerateInviteLink(groupId, userId);

      // Tạo URL đầy đủ để client có thể sử dụng
      const baseUrl = `${req.protocol}://${req.get("host")}`;
      const inviteUrl = `${baseUrl}/api/group/join/${result.invite_link.code}`;

      // Kích hoạt sự kiện socket cho việc tạo lại link mới
      if (io) {
        io.emit("invite_link_regenerated", {
          groupId,
          inviteLink: {
            ...result.invite_link,
            url: inviteUrl,
          },
          regeneratedBy: userId,
        });
      }

      return sendResponse(res, 200, result.message, "success", {
        invite_link: {
          ...result.invite_link,
          url: inviteUrl,
        },
      });
    } catch (error) {
      return sendResponse(res, 500, error.message, "error");
    }
  }

  /**
   * Xóa nhóm
   */
  static async deleteGroup(req, res) {
    try {
      const { groupId } = req.params;
      const userId = req.user._id;

      if (!groupId) {
        return sendResponse(res, 400, "ID nhóm là bắt buộc", "error");
      }

      // Lấy thông tin nhóm trước khi xóa để thông báo cho các thành viên
      const groupToDelete = await GroupService.getGroupById(groupId, userId);

      // Thực hiện xóa nhóm
      const result = await GroupService.deleteGroup(groupId, userId);

      // Kích hoạt sự kiện socket để thông báo cho tất cả thành viên về việc nhóm bị xóa
      if (groupToDelete) {
        const memberIds = groupToDelete.members.map((member) =>
          member.user._id ? member.user._id.toString() : member.user.toString()
        );

        if (io) {
          io.emit("group_deleted", {
            groupId,
            conversationId: groupToDelete.conversation_id,
            deletedBy: userId,
            affectedMembers: memberIds,
          });
        }
      }

      return sendResponse(res, 200, "Xóa nhóm thành công", "success", result);
    } catch (error) {
      return sendResponse(
        res,
        error.message.includes("không có quyền") ? 403 : 500,
        error.message,
        "error"
      );
    }
  }
}

module.exports = GroupController;
