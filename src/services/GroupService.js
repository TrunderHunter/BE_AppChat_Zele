const Group = require("../models/Group");
const User = require("../models/User");
const Conversation = require("../models/Conversation");
const mongoose = require("mongoose");
const crypto = require("crypto");

class GroupService {
  /**
   * Tạo nhóm chat mới
   * @param {Object} groupData - Thông tin nhóm
   * @param {String} creatorId - ID của người tạo nhóm
   */
  static async createGroup(groupData, creatorId) {
    const { name, description, avatar, members } = groupData;

    const session = await mongoose.startSession();
    let newGroup, newConversation;

    try {
      await session.withTransaction(async () => {
        // Tạo nhóm mới với người tạo là admin đầu tiên

        // Tạo mã mời duy nhất cho nhóm
        const inviteCode = crypto.randomBytes(8).toString("hex");

        newGroup = new Group({
          name,
          description,
          creator: creatorId,
          avatar,
          members: [
            {
              user: creatorId,
              role: "admin",
              joined_at: new Date(),
            },
          ],
          created_at: new Date(),
          updated_at: new Date(),
          invite_link: {
            code: inviteCode,
            is_active: true,
            created_at: new Date(),
          },
        });

        // Thêm các thành viên khác vào nhóm (nếu có)
        if (members && members.length > 0) {
          for (let memberId of members) {
            // Kiểm tra người dùng tồn tại
            const user = await User.findById(memberId);
            if (user && memberId.toString() !== creatorId.toString()) {
              newGroup.members.push({
                user: memberId,
                role: "member",
                joined_at: new Date(),
              });
            }
          }
        }

        // Tạo cuộc hội thoại cho nhóm
        const participantsList = newGroup.members.map((member) => ({
          user_id: member.user,
        }));

        // Sử dụng cùng name và avatar cho cả Group và Conversation
        newConversation = new Conversation({
          participants: participantsList,
          type: "group",
          name: name, // Dùng tên của nhóm cho conversation
          avatar: avatar, // Dùng avatar của nhóm cho conversation
          updated_at: new Date(),
        });

        await newConversation.save({ session });

        // Liên kết nhóm với cuộc hội thoại
        newGroup.conversation_id = newConversation._id;
        await newGroup.save({ session });

        // Cập nhật liên kết ngược từ cuộc hội thoại đến nhóm
        newConversation.group_id = newGroup._id;
        await newConversation.save({ session });
      });

      // Lấy thông tin đầy đủ của nhóm
      await newGroup.populate({
        path: "members.user",
        select: "name email phone primary_avatar",
      });

      return { group: newGroup, conversation: newConversation };
    } catch (error) {
      throw new Error("Không thể tạo nhóm: " + error.message);
    } finally {
      session.endSession();
    }
  }

  /**
   * Thêm thành viên vào nhóm
   * @param {String} groupId - ID nhóm
   * @param {String} memberId - ID thành viên cần thêm
   * @param {String} addedBy - ID người thêm thành viên
   */
  static async addMemberToGroup(groupId, memberId, addedBy) {
    // Kiểm tra nhóm tồn tại
    const group = await Group.findById(groupId);
    if (!group) {
      throw new Error("Nhóm không tồn tại");
    }

    // Kiểm tra quyền hạn của người thêm thành viên
    const addingUser = group.members.find((m) => m.user.toString() === addedBy);
    if (!addingUser) {
      throw new Error("Bạn không phải thành viên của nhóm này");
    }

    // Kiểm tra setting của nhóm về việc ai có thể thêm thành viên
    const canAddMembers = group.settings.who_can_add_members;
    if (canAddMembers === "admins" && addingUser.role !== "admin") {
      throw new Error("Chỉ admin mới có thể thêm thành viên");
    }

    if (
      canAddMembers === "admins_moderators" &&
      !["admin", "moderator"].includes(addingUser.role)
    ) {
      throw new Error("Chỉ admin hoặc moderator mới có thể thêm thành viên");
    }

    // Kiểm tra người dùng đã là thành viên chưa
    const isAlreadyMember = group.members.some(
      (m) => m.user.toString() === memberId
    );
    if (isAlreadyMember) {
      throw new Error("Người dùng đã là thành viên của nhóm");
    }

    // Kiểm tra người dùng tồn tại
    const user = await User.findById(memberId);
    if (!user) {
      throw new Error("Người dùng không tồn tại");
    }

    // Thêm thành viên vào nhóm
    group.members.push({
      user: memberId,
      role: "member",
      joined_at: new Date(),
    });

    // Cập nhật thời gian cập nhật nhóm
    group.updated_at = new Date();
    await group.save();

    // Cập nhật cuộc hội thoại tương ứng
    await Conversation.findByIdAndUpdate(group.conversation_id, {
      $push: { participants: { user_id: memberId } },
      updated_at: new Date(),
    });

    // Trả về nhóm đã cập nhật với thông tin thành viên đầy đủ
    return await Group.findById(groupId).populate({
      path: "members.user",
      select: "name email phone primary_avatar",
    });
  }

  /**
   * Xóa thành viên khỏi nhóm
   * @param {String} groupId - ID nhóm
   * @param {String} memberId - ID thành viên cần xóa
   * @param {String} removedBy - ID người thực hiện xóa
   */
  static async removeMemberFromGroup(groupId, memberId, removedBy) {
    // Kiểm tra nhóm tồn tại
    const group = await Group.findById(groupId);
    if (!group) {
      throw new Error("Nhóm không tồn tại");
    }

    // Không thể xóa người tạo nhóm
    if (group.creator.toString() === memberId) {
      throw new Error("Không thể xóa người tạo nhóm");
    }

    // Kiểm tra thành viên cần xóa tồn tại trong nhóm
    const memberToRemove = group.members.find(
      (m) => m.user.toString() === memberId
    );
    if (!memberToRemove) {
      throw new Error("Thành viên không tồn tại trong nhóm");
    }

    // Kiểm tra quyền hạn
    // Admin có thể xóa bất kỳ ai trừ người tạo nhóm
    // Moderator có thể xóa member
    // User có thể tự xóa mình (rời nhóm)
    const removingUser = group.members.find(
      (m) => m.user.toString() === removedBy
    );
    if (!removingUser) {
      throw new Error("Bạn không phải thành viên của nhóm này");
    }

    if (removedBy === memberId) {
      // Người dùng tự rời nhóm
    } else if (removingUser.role === "admin") {
      // Admin có thể xóa bất kỳ ai trừ người tạo
    } else if (
      removingUser.role === "moderator" &&
      memberToRemove.role === "member"
    ) {
      // Moderator chỉ có thể xóa member
    } else {
      throw new Error("Bạn không có quyền xóa thành viên này");
    }

    // Xóa thành viên khỏi nhóm
    group.members = group.members.filter((m) => m.user.toString() !== memberId);
    group.updated_at = new Date();
    await group.save();

    // Cập nhật cuộc hội thoại tương ứng
    await Conversation.findByIdAndUpdate(group.conversation_id, {
      $pull: { participants: { user_id: memberId } },
      updated_at: new Date(),
    });

    // Trả về nhóm đã cập nhật
    return await Group.findById(groupId).populate({
      path: "members.user",
      select: "name email phone primary_avatar",
    });
  }

  /**
   * Thay đổi vai trò của thành viên trong nhóm
   * @param {String} groupId - ID nhóm
   * @param {String} memberId - ID thành viên cần thay đổi vai trò
   * @param {String} newRole - Vai trò mới ("admin", "moderator", "member")
   * @param {String} changedBy - ID người thực hiện thay đổi
   */
  static async changeRoleMember(groupId, memberId, newRole, changedBy) {
    // Kiểm tra nhóm tồn tại
    const group = await Group.findById(groupId);
    if (!group) {
      throw new Error("Nhóm không tồn tại");
    }

    // Kiểm tra vai trò hợp lệ
    if (!["admin", "moderator", "member"].includes(newRole)) {
      throw new Error("Vai trò không hợp lệ");
    }

    // Kiểm tra quyền hạn của người thực hiện
    const changingUser = group.members.find(
      (m) => m.user.toString() === changedBy
    );
    if (!changingUser || changingUser.role !== "admin") {
      throw new Error("Chỉ admin mới có quyền thay đổi vai trò thành viên");
    }

    // Không thể thay đổi vai trò của người tạo nhóm
    if (group.creator.toString() === memberId && newRole !== "admin") {
      throw new Error("Không thể thay đổi vai trò của người tạo nhóm");
    }

    // Cập nhật vai trò cho thành viên
    const memberIndex = group.members.findIndex(
      (m) => m.user.toString() === memberId
    );
    if (memberIndex === -1) {
      throw new Error("Thành viên không tồn tại trong nhóm");
    }

    group.members[memberIndex].role = newRole;
    group.updated_at = new Date();

    // Nếu không còn admin nào, không cho phép thay đổi
    const hasAdmin = group.members.some((m) => m.role === "admin");
    if (!hasAdmin) {
      throw new Error("Nhóm phải có ít nhất một admin");
    }

    await group.save();

    // Trả về nhóm đã cập nhật
    return await Group.findById(groupId).populate({
      path: "members.user",
      select: "name email phone primary_avatar",
    });
  }

  /**
   * Cập nhật thông tin nhóm
   * @param {String} groupId - ID nhóm
   * @param {Object} updateData - Dữ liệu cập nhật (name, description, avatar, settings)
   * @param {String} userId - ID người thực hiện cập nhật
   */
  static async updateGroup(groupId, updateData, userId) {
    // Kiểm tra nhóm tồn tại
    const group = await Group.findById(groupId);
    if (!group) {
      throw new Error("Nhóm không tồn tại");
    }

    // Kiểm tra quyền hạn của người thực hiện
    const updatingUser = group.members.find(
      (m) => m.user.toString() === userId
    );
    if (!updatingUser || updatingUser.role !== "admin") {
      throw new Error("Chỉ admin mới có quyền cập nhật thông tin nhóm");
    }

    // Cập nhật thông tin cơ bản
    const allowedFields = ["name", "description", "avatar"];
    allowedFields.forEach((field) => {
      if (updateData[field]) {
        group[field] = updateData[field];
      }
    });

    // Cập nhật cài đặt nhóm
    if (updateData.settings) {
      if (updateData.settings.who_can_send_messages) {
        group.settings.who_can_send_messages =
          updateData.settings.who_can_send_messages;
      }
      if (updateData.settings.who_can_add_members) {
        group.settings.who_can_add_members =
          updateData.settings.who_can_add_members;
      }
    }

    group.updated_at = new Date();
    await group.save();

    // Cập nhật thông tin nhóm trong cuộc hội thoại
    // Luôn đảm bảo Conversation có cùng name và avatar với Group
    await Conversation.findByIdAndUpdate(group.conversation_id, {
      name: group.name, // Luôn sử dụng tên nhóm cập nhật mới nhất
      avatar: group.avatar, // Luôn sử dụng avatar nhóm cập nhật mới nhất
      updated_at: new Date(),
    });

    // Trả về nhóm đã cập nhật
    return await Group.findById(groupId).populate({
      path: "members.user",
      select: "name email phone primary_avatar",
    });
  }

  /**
   * Cập nhật trạng thái của link tham gia nhóm (bật/tắt)
   * @param {String} groupId - ID nhóm
   * @param {Boolean} isActive - Trạng thái mới của link
   * @param {String} userId - ID của người thực hiện cập nhật
   */
  static async updateInviteLinkStatus(groupId, isActive, userId) {
    // Kiểm tra nhóm tồn tại
    const group = await Group.findById(groupId);
    if (!group) {
      throw new Error("Nhóm không tồn tại");
    }

    // Kiểm tra quyền hạn (chỉ admin mới có thể cập nhật trạng thái link mời)
    const member = group.members.find((m) => m.user.toString() === userId);
    if (!member || member.role !== "admin") {
      throw new Error("Bạn không có quyền cập nhật trạng thái link mời");
    }

    // Cập nhật trạng thái của link mời
    group.invite_link.is_active = isActive;
    group.updated_at = new Date();
    await group.save();

    return {
      success: true,
      message: isActive
        ? "Đã kích hoạt link tham gia"
        : "Đã vô hiệu hóa link tham gia",
    };
  }

  /**
   * Tạo lại link tham gia mới (nếu link cũ bị lộ hoặc không an toàn)
   * @param {String} groupId - ID nhóm
   * @param {String} userId - ID của người thực hiện cập nhật
   */
  static async regenerateInviteLink(groupId, userId) {
    // Kiểm tra nhóm tồn tại
    const group = await Group.findById(groupId);
    if (!group) {
      throw new Error("Nhóm không tồn tại");
    }

    // Kiểm tra quyền hạn (chỉ admin mới có thể tạo lại link mời)
    const member = group.members.find((m) => m.user.toString() === userId);
    if (!member || member.role !== "admin") {
      throw new Error("Bạn không có quyền tạo lại link tham gia");
    }

    // Tạo mã mời mới
    const newInviteCode = crypto.randomBytes(8).toString("hex");

    // Cập nhật link mời mới
    group.invite_link = {
      code: newInviteCode,
      is_active: true,
      created_at: new Date(),
    };

    group.updated_at = new Date();
    await group.save();

    return {
      invite_link: group.invite_link,
      message: "Đã tạo lại link tham gia mới",
    };
  }

  /**
   * Kiểm tra và sử dụng link mời để tham gia nhóm
   * @param {String} inviteCode - Mã mời
   * @param {String} userId - ID người dùng muốn tham gia nhóm
   */
  static async joinGroupWithInviteLink(inviteCode, userId) {
    // Tìm nhóm có chứa mã mời này
    const group = await Group.findOne({
      "invite_link.code": inviteCode,
    });

    if (!group) {
      throw new Error("Link tham gia không tồn tại");
    }

    // Kiểm tra link có còn hoạt động không
    if (!group.invite_link.is_active) {
      throw new Error("Link tham gia đã bị vô hiệu hóa");
    }

    // Kiểm tra người dùng đã là thành viên chưa
    const isAlreadyMember = group.members.some(
      (m) => m.user.toString() === userId
    );
    if (isAlreadyMember) {
      throw new Error("Bạn đã là thành viên của nhóm này");
    }

    // Kiểm tra người dùng tồn tại
    const user = await User.findById(userId);
    if (!user) {
      throw new Error("Người dùng không tồn tại");
    }

    // Thêm thành viên vào nhóm
    group.members.push({
      user: userId,
      role: "member",
      joined_at: new Date(),
    });

    group.updated_at = new Date();
    await group.save();

    // Cập nhật cuộc hội thoại
    await Conversation.findByIdAndUpdate(group.conversation_id, {
      $push: { participants: { user_id: userId } },
      updated_at: new Date(),
    });

    // Trả về nhóm đã cập nhật
    return await Group.findById(group._id).populate({
      path: "members.user",
      select: "name email phone primary_avatar",
    });
  }

  /**
   * Lấy link tham gia nhóm
   * @param {String} groupId - ID nhóm
   * @param {String} userId - ID người dùng yêu cầu
   */
  static async getGroupInviteLink(groupId, userId) {
    // Kiểm tra nhóm tồn tại
    const group = await Group.findById(groupId);
    if (!group) {
      throw new Error("Nhóm không tồn tại");
    }

    // Kiểm tra quyền hạn để xem link mời
    const member = group.members.find((m) => m.user.toString() === userId);
    if (!member) {
      throw new Error("Bạn không phải thành viên của nhóm này");
    }

    // Kiểm tra quyền chia sẻ link mời
    const canShareLink = group.settings.who_can_share_invite_link;
    const memberRole = member.role;

    if (
      (canShareLink === "admins" && memberRole !== "admin") ||
      (canShareLink === "admins_moderators" &&
        !["admin", "moderator"].includes(memberRole))
    ) {
      throw new Error("Bạn không có quyền xem link tham gia nhóm");
    }

    // Trả về link mời
    return {
      invite_link: group.invite_link,
      can_share: true,
    };
  }

  /**
   * Lấy thông tin chi tiết của nhóm
   * @param {String} groupId - ID nhóm
   * @param {String} userId - ID người dùng đang xem
   */
  static async getGroupById(groupId, userId) {
    // Kiểm tra nhóm tồn tại
    const group = await Group.findById(groupId)
      .populate({
        path: "members.user",
        select: "name email phone primary_avatar",
      })
      .populate("creator", "name email phone primary_avatar");

    if (!group) {
      throw new Error("Nhóm không tồn tại");
    }

    // Kiểm tra người dùng có phải là thành viên nhóm
    const isMember = group.members.some(
      (m) => m.user._id.toString() === userId
    );
    if (!isMember) {
      throw new Error("Bạn không có quyền xem thông tin nhóm này");
    }

    return group;
  }

  /**
   * Lấy tất cả các nhóm mà người dùng tham gia
   * @param {String} userId - ID người dùng
   */
  static async getGroupsByUserId(userId) {
    const groups = await Group.find({ "members.user": userId })
      .populate({
        path: "members.user",
        select: "name email phone primary_avatar",
      })
      .populate("creator", "name email phone primary_avatar")
      .sort({ updated_at: -1 });

    return groups;
  }

  /**
   * Xóa nhóm chat
   * @param {String} groupId - ID của nhóm cần xóa
   * @param {String} userId - ID của người thực hiện xóa (phải là admin)
   */
  static async deleteGroup(groupId, userId) {
    const session = await mongoose.startSession();

    try {
      await session.withTransaction(async () => {
        // Kiểm tra nhóm tồn tại
        const group = await Group.findById(groupId);
        if (!group) {
          throw new Error("Nhóm không tồn tại");
        }

        // Kiểm tra quyền xóa (chỉ admin mới có quyền xóa nhóm)
        const member = group.members.find((m) => m.user.toString() === userId);
        if (!member || member.role !== "admin") {
          throw new Error("Bạn không có quyền xóa nhóm này");
        }

        // Lấy conversation_id để xóa sau khi xóa nhóm
        const conversationId = group.conversation_id;

        // Xóa nhóm
        await Group.findByIdAndDelete(groupId, { session });

        // Xóa conversation liên quan nếu có
        if (conversationId) {
          await Conversation.findByIdAndDelete(conversationId, { session });
        }

        return {
          deletedGroupId: groupId,
          deletedConversationId: conversationId,
        };
      });

      return {
        success: true,
        message: "Xóa nhóm thành công",
        groupId,
      };
    } catch (error) {
      throw new Error(`Không thể xóa nhóm: ${error.message}`);
    } finally {
      session.endSession();
    }
  }
}

module.exports = GroupService;
