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

  /**
   * Xử lý sự kiện tham gia nhóm qua link mời
   */
  socket.on("joinGroupWithInviteLink", async ({ inviteCode, userId }) => {
    try {
      const updatedGroup = await GroupService.joinGroupWithInviteLink(
        inviteCode,
        userId
      );

      // Thông báo cho tất cả thành viên đang online về thành viên mới tham gia
      const memberIds = updatedGroup.members.map((member) =>
        member.user._id ? member.user._id.toString() : member.user.toString()
      );

      // Tìm thông tin người mới tham gia
      const newMember = updatedGroup.members.find(
        (member) =>
          (member.user._id
            ? member.user._id.toString()
            : member.user.toString()) === userId
      );

      memberIds.forEach((id) => {
        if (onlineUsers.has(id) && id !== userId) {
          // Không gửi thông báo cho người mới tham gia
          io.to(onlineUsers.get(id)).emit("memberJoinedViaLink", {
            groupId: updatedGroup._id,
            newMember: {
              user: newMember.user,
              role: newMember.role,
              joined_at: newMember.joined_at,
            },
            group: updatedGroup,
          });
        }
      });

      // Thông báo riêng cho người tham gia mới về thông tin nhóm
      if (onlineUsers.has(userId)) {
        io.to(onlineUsers.get(userId)).emit("joinedGroupViaLink", {
          group: updatedGroup,
        });
      }

      // Lấy thông tin conversation liên kết với nhóm để cập nhật cho người mới
      const conversation = await Conversation.findById(
        updatedGroup.conversation_id
      ).populate("last_message");

      if (conversation && onlineUsers.has(userId)) {
        io.to(onlineUsers.get(userId)).emit("newConversation", {
          conversation: conversation,
          group: updatedGroup,
        });
      }
    } catch (error) {
      socket.emit("error", error.message);
    }
  });

  /**
   * Xử lý sự kiện cập nhật trạng thái link mời
   */
  socket.on("updateInviteLinkStatus", async ({ groupId, isActive, userId }) => {
    try {
      const result = await GroupService.updateInviteLinkStatus(
        groupId,
        isActive,
        userId
      );

      // Thông báo cho tất cả admin và moderator về việc cập nhật trạng thái link
      const group = await GroupService.getGroupById(groupId, userId);
      const adminModIds = group.members
        .filter((member) => ["admin", "moderator"].includes(member.role))
        .map((member) =>
          member.user._id ? member.user._id.toString() : member.user.toString()
        );

      adminModIds.forEach((id) => {
        if (onlineUsers.has(id)) {
          io.to(onlineUsers.get(id)).emit("inviteLinkStatusUpdated", {
            groupId,
            isActive,
            updatedBy: userId,
          });
        }
      });
    } catch (error) {
      socket.emit("error", error.message);
    }
  });

  /**
   * Xử lý sự kiện tạo lại link mời mới
   */
  socket.on("regenerateInviteLink", async ({ groupId, userId }) => {
    try {
      const result = await GroupService.regenerateInviteLink(groupId, userId);

      // Thông báo cho tất cả admin và moderator về link mới
      const group = await GroupService.getGroupById(groupId, userId);
      const adminModIds = group.members
        .filter((member) => ["admin", "moderator"].includes(member.role))
        .map((member) =>
          member.user._id ? member.user._id.toString() : member.user.toString()
        );

      adminModIds.forEach((id) => {
        if (onlineUsers.has(id)) {
          io.to(onlineUsers.get(id)).emit("inviteLinkRegenerated", {
            groupId,
            inviteLink: result.invite_link,
            regeneratedBy: userId,
          });
        }
      });
    } catch (error) {
      socket.emit("error", error.message);
    }
  });

  /**
   * Xử lý sự kiện xóa nhóm
   */
  socket.on("deleteGroup", async ({ groupId, userId }) => {
    try {
      // Lấy thông tin nhóm trước khi xóa để thông báo cho các thành viên
      let groupToDelete;
      try {
        groupToDelete = await GroupService.getGroupById(groupId, userId);
      } catch (error) {
        socket.emit("error", error.message);
        return;
      }

      // Thực hiện xóa nhóm
      const result = await GroupService.deleteGroup(groupId, userId);

      // Thông báo cho tất cả thành viên đang online về việc nhóm bị xóa
      if (groupToDelete) {
        const memberIds = groupToDelete.members.map((member) =>
          member.user._id ? member.user._id.toString() : member.user.toString()
        );

        memberIds.forEach((id) => {
          if (onlineUsers.has(id)) {
            io.to(onlineUsers.get(id)).emit("groupDeleted", {
              groupId,
              conversationId: groupToDelete.conversation_id,
              deletedBy: userId,
            });
          }
        });
      }
    } catch (error) {
      socket.emit("error", error.message);
    }
  });
};
