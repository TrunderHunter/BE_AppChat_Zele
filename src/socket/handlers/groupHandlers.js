const GroupService = require("../../services/GroupService");
const Conversation = require("../../models/Conversation");

/**
 * Handler cho các sự kiện liên quan đến nhóm chat
 */
module.exports = function (io, socket, onlineUsers) {
  /**
   * Xử lý sự kiện tạo nhóm mới
   */
  socket.on("createGroup", async ({ groupData, creatorId }) => {
    try {
      const result = await GroupService.createGroup(groupData, creatorId);

      // Thông báo cho tất cả thành viên ban đầu về nhóm mới
      const memberIds = result.group.members.map((member) =>
        member.user._id ? member.user._id.toString() : member.user.toString()
      );

      memberIds.forEach((memberId) => {
        if (onlineUsers.has(memberId)) {
          // Thông báo về việc tạo nhóm mới
          io.to(onlineUsers.get(memberId)).emit("newGroupCreated", result);

          // Thông báo về cuộc hội thoại mới được tạo
          io.to(onlineUsers.get(memberId)).emit("newConversation", {
            conversation: result.conversation,
            group: result.group,
          });
        }
      });
    } catch (error) {
      socket.emit("error", error.message);
    }
  });

  /**
   * Xử lý sự kiện thêm thành viên mới vào nhóm
   */
  socket.on("addMemberToGroup", async ({ groupId, memberId, addedBy }) => {
    try {
      const updatedGroup = await GroupService.addMemberToGroup(
        groupId,
        memberId,
        addedBy
      );

      // Thông báo cho tất cả thành viên về thành viên mới
      const memberIds = updatedGroup.members.map((member) =>
        member.user._id ? member.user._id.toString() : member.user.toString()
      );

      memberIds.forEach((id) => {
        if (onlineUsers.has(id)) {
          io.to(onlineUsers.get(id)).emit("memberAddedToGroup", {
            groupId,
            newMember: memberId,
            addedBy,
            group: updatedGroup,
          });
        }
      });

      // Thông báo riêng cho thành viên mới
      if (onlineUsers.has(memberId)) {
        io.to(onlineUsers.get(memberId)).emit("addedToGroup", {
          group: updatedGroup,
        });
      }
    } catch (error) {
      socket.emit("error", error.message);
    }
  });

  /**
   * Xử lý sự kiện xóa thành viên khỏi nhóm
   */
  socket.on(
    "removeMemberFromGroup",
    async ({ groupId, memberId, removedBy }) => {
      try {
        const updatedGroup = await GroupService.removeMemberFromGroup(
          groupId,
          memberId,
          removedBy
        );

        // Thông báo cho tất cả thành viên còn lại
        const remainingMemberIds = updatedGroup.members.map((member) =>
          member.user._id ? member.user._id.toString() : member.user.toString()
        );

        remainingMemberIds.forEach((id) => {
          if (onlineUsers.has(id)) {
            io.to(onlineUsers.get(id)).emit("memberRemovedFromGroup", {
              groupId,
              removedMember: memberId,
              removedBy,
              group: updatedGroup,
            });
          }
        });

        // Thông báo cho người bị xóa
        if (onlineUsers.has(memberId)) {
          io.to(onlineUsers.get(memberId)).emit("removedFromGroup", {
            groupId,
          });
        }
      } catch (error) {
        socket.emit("error", error.message);
      }
    }
  );

  /**
   * Xử lý sự kiện thay đổi vai trò thành viên
   */
  socket.on(
    "changeRoleMember",
    async ({ groupId, memberId, role, changedBy }) => {
      try {
        const updatedGroup = await GroupService.changeRoleMember(
          groupId,
          memberId,
          role,
          changedBy
        );

        // Thông báo cho tất cả thành viên
        const memberIds = updatedGroup.members.map((member) =>
          member.user._id ? member.user._id.toString() : member.user.toString()
        );

        memberIds.forEach((id) => {
          if (onlineUsers.has(id)) {
            io.to(onlineUsers.get(id)).emit("memberRoleChanged", {
              groupId,
              memberId,
              newRole: role,
              changedBy,
              group: updatedGroup,
            });
          }
        });
      } catch (error) {
        socket.emit("error", error.message);
      }
    }
  );

  /**
   * Xử lý sự kiện cập nhật thông tin nhóm
   */
  socket.on("updateGroup", async ({ groupId, updateData, userId }) => {
    try {
      const updatedGroup = await GroupService.updateGroup(
        groupId,
        updateData,
        userId
      );

      // Lấy thông tin conversation liên kết với nhóm
      const conversation = await Conversation.findById(
        updatedGroup.conversation_id
      ).populate("last_message");

      // Thông báo cho tất cả thành viên về thông tin nhóm đã cập nhật
      const memberIds = updatedGroup.members.map((member) =>
        member.user._id ? member.user._id.toString() : member.user.toString()
      );

      memberIds.forEach((id) => {
        if (onlineUsers.has(id)) {
          // Thông báo về việc thông tin nhóm thay đổi
          io.to(onlineUsers.get(id)).emit("groupInfoUpdated", {
            groupId,
            updatedBy: userId,
            group: updatedGroup,
          });

          // Thông báo về việc thông tin cuộc trò chuyện thay đổi
          if (conversation) {
            io.to(onlineUsers.get(id)).emit("conversationInfoUpdated", {
              conversationId: conversation._id,
              name: updatedGroup.name,
              avatar: updatedGroup.avatar,
              conversation: conversation,
            });
          }
        }
      });
    } catch (error) {
      socket.emit("error", error.message);
    }
  });
};
