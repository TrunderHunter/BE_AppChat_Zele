const GroupService = require("../../services/GroupService");
const Conversation = require("../../models/Conversation");
const Group = require("../../models/Group");

/**
 * Handler cho các sự kiện liên quan đến nhóm chat
 */
module.exports = function (io, socket, onlineUsers) {
  /**
   * Xử lý sự kiện tạo nhóm mới
   */
  socket.on(
    "createGroup",
    async ({ groupData, creatorId, existingGroupId }) => {
      try {
        // Nếu đã có existingGroupId, nhóm đã được tạo qua API, không tạo nhóm mới
        // mà chỉ thông báo cho các thành viên khác
        let result;

        if (existingGroupId) {
          // Lấy thông tin nhóm đã tạo
          const group = await GroupService.getGroupById(
            existingGroupId,
            creatorId
          );
          // Lấy thông tin conversation liên kết
          const conversation = await Conversation.findById(
            group.conversation_id
          ).populate("last_message");
          result = { group, conversation };
        } else {
          // Nếu chưa có, tạo nhóm mới (phòng hợp cho trường hợp chỉ dùng socket)
          result = await GroupService.createGroup(groupData, creatorId);
        }

        // Thông báo cho tất cả thành viên ban đầu về nhóm mới
        const memberIds = result.group.members.map((member) =>
          member.user._id ? member.user._id.toString() : member.user.toString()
        );

        memberIds.forEach((memberId) => {
          // Không gửi cho người tạo vì họ đã có thông tin nhóm
          if (onlineUsers.has(memberId) && memberId !== creatorId) {
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
    }
  );

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

      // Lấy thông tin conversation của nhóm để thêm cho thành viên mới
      const conversation = await Conversation.findById(
        updatedGroup.conversation_id
      ).populate("last_message");

      // Thông báo cho tất cả thành viên về thành viên mới
      const memberIds = updatedGroup.members.map((member) =>
        member.user._id ? member.user._id.toString() : member.user.toString()
      );

      // Tìm thông tin chi tiết của thành viên mới
      const newMemberDetail = updatedGroup.members.find(
        (m) =>
          (m.user._id ? m.user._id.toString() : m.user.toString()) === memberId
      );

      memberIds.forEach((id) => {
        if (onlineUsers.has(id)) {
          io.to(onlineUsers.get(id)).emit("memberAddedToGroup", {
            groupId,
            newMember: newMemberDetail,
            addedBy,
            group: updatedGroup,
            conversation: conversation,
          });
        }
      });

      // Thông báo riêng cho thành viên mới
      if (onlineUsers.has(memberId)) {
        io.to(onlineUsers.get(memberId)).emit("addedToGroup", {
          group: updatedGroup,
          conversation: conversation,
        });

        // Gửi thêm một thông báo rõ ràng về cuộc trò chuyện mới cho thành viên mới
        io.to(onlineUsers.get(memberId)).emit("newConversation", {
          conversation: conversation,
          group: updatedGroup,
        });
      }
    } catch (error) {
      socket.emit("error", error.message);
    }
  });

  /**
   * Xử lý sự kiện xóa thành viên khỏi nhóm
   */ socket.on(
    "removeMemberFromGroup",
    async ({
      groupId,
      memberId,
      removedBy,
      removerRole: clientRemoverRole,
    }) => {
      try {
        // Lấy thông tin nhóm để kiểm tra vai trò của người xóa và người bị xóa
        const group = await Group.findById(groupId);
        if (!group) {
          throw new Error("Nhóm không tồn tại");
        }

        // Tìm vai trò của người xóa thành viên - ưu tiên dùng thông tin từ server
        const remover = group.members.find(
          (m) => m.user.toString() === removedBy
        );
        // Sử dụng vai trò từ server để đảm bảo tính an toàn, không tin tưởng hoàn toàn vào client
        const removerRole = remover ? remover.role : "";

        // Tìm tên và vai trò của thành viên bị xóa để thông báo chi tiết hơn
        const removedMember = group.members.find(
          (m) => m.user.toString() === memberId
        );
        let removedMemberName = "Thành viên";
        let removedMemberRole = "member";

        if (removedMember) {
          removedMemberRole = removedMember.role;
          if (removedMember.user) {
            // Nếu user đã được populate
            if (
              typeof removedMember.user === "object" &&
              removedMember.user.name
            ) {
              removedMemberName = removedMember.user.name;
            }
            // Nếu chưa thì sẽ lấy trong lúc xử lý xóa
          }
        }

        // Xác thực thêm quyền xóa thành viên cho moderator
        if (removerRole === "moderator" && removedMemberRole !== "member") {
          socket.emit(
            "error",
            "Điều hành viên chỉ có thể xóa thành viên thường"
          );
          return;
        }

        // Xóa thành viên khỏi nhóm
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
              removerRole, // Thêm vai trò của người xóa
              removedMemberName, // Thêm tên của người bị xóa
              group: updatedGroup,
            });
          }
        }); // Thông báo cho người bị xóa
        if (onlineUsers.has(memberId)) {
          io.to(onlineUsers.get(memberId)).emit("removedFromGroup", {
            groupId,
            conversationId: updatedGroup.conversation_id,
            removerRole, // Thêm vai trò của người xóa
            byAdmin: removerRole === "admin",
            byModerator: removerRole === "moderator",
            selfRemoved: removedBy === memberId, // Người dùng tự rời nhóm
          });
        }
      } catch (error) {
        socket.emit("error", error.message);
      }
    }
  );
  /**
   * Xử lý sự kiện thay đổi vai trò thành viên
   */ socket.on(
    "changeRoleMember",
    async ({ groupId, memberId, role, changedBy }) => {
      try {
        // Lấy thông tin nhóm và vai trò trước đó của thành viên
        const group = await Group.findById(groupId);
        if (!group) {
          throw new Error("Nhóm không tồn tại");
        }

        // Tìm role trước đó của thành viên để thông báo
        const memberBefore = group.members.find(
          (m) => m.user.toString() === memberId
        );
        const previousRole = memberBefore ? memberBefore.role : "member";

        // Lưu lại vai trò cũ của admin hiện tại (để thông báo thay đổi)
        const adminBefore = role === "admin" ? 
          group.members.find(m => m.role === "admin" && m.user.toString() !== memberId) : null;
        const previousAdminId = adminBefore ? adminBefore.user.toString() : null;

        // Thực hiện thay đổi vai trò
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
              previousRole, // Bổ sung thông tin về vai trò trước đó
              newRole: role,
              changedBy,
              group: updatedGroup,
            });
            
            // Nếu là trường hợp thay đổi admin, thông báo thêm về việc admin cũ bị hạ cấp
            if (role === "admin" && previousAdminId && id === previousAdminId) {
              io.to(onlineUsers.get(id)).emit("memberRoleChanged", {
                groupId,
                memberId: previousAdminId,
                previousRole: "admin",
                newRole: "member",
                changedBy,
                group: updatedGroup,
              });
            }
          }
        });
      } catch (error) {
        socket.emit("error", error.message);
      }
    }
  );

  /**
   * Xử lý sự kiện chuyển quyền admin và rời nhóm
   * Thực hiện hai hành động liên tiếp: đầu tiên là chuyển quyền admin, sau đó là rời nhóm
   */
  socket.on(
    "transferAdminAndLeaveGroup",
    async ({ groupId, newAdminId, userId }) => {
      try {
        // Kiểm tra các tham số đầu vào
        if (!groupId || !newAdminId || !userId) {
          socket.emit("error", {
            message: "Thiếu thông tin cần thiết để thực hiện",
          });
          return;
        }

        // Bước 1: Chuyển quyền admin cho thành viên mới
        const updatedGroupAfterTransfer = await GroupService.changeRoleMember(
          groupId,
          newAdminId,
          "admin",
          userId
        );

        // Thông báo cho tất cả thành viên về việc thay đổi vai trò
        const memberIds = updatedGroupAfterTransfer.members.map((member) =>
          member.user._id ? member.user._id.toString() : member.user.toString()
        );

        memberIds.forEach((id) => {
          if (onlineUsers.has(id)) {
            io.to(onlineUsers.get(id)).emit("memberRoleChanged", {
              groupId,
              memberId: newAdminId,
              newRole: "admin",
              changedBy: userId,
              group: updatedGroupAfterTransfer,
            });
          }
        });

        // Bước 2: Người dùng rời nhóm
        const updatedGroupAfterLeave = await GroupService.removeMemberFromGroup(
          groupId,
          userId,
          userId
        );

        // Thông báo cho tất cả thành viên còn lại về việc người dùng rời nhóm
        const remainingMemberIds = updatedGroupAfterLeave.members.map(
          (member) =>
            member.user._id
              ? member.user._id.toString()
              : member.user.toString()
        );

        remainingMemberIds.forEach((id) => {
          if (onlineUsers.has(id)) {
            io.to(onlineUsers.get(id)).emit("memberRemovedFromGroup", {
              groupId,
              removedMember: userId,
              removedBy: userId,
              group: updatedGroupAfterLeave,
              wasAdmin: true,
              newAdminId,
            });
          }
        });

        // Thông báo cho người rời nhóm
        if (onlineUsers.has(userId)) {
          io.to(onlineUsers.get(userId)).emit("removedFromGroup", {
            groupId,
            conversationId: updatedGroupAfterLeave.conversation_id,
            byTransfer: true,
          });
        }

        // Gửi kết quả thành công về cho client đã thực hiện hành động
        socket.emit("transferAdminAndLeaveGroupSuccess", {
          success: true,
          groupId,
          newAdminId,
        });
      } catch (error) {
        console.error("Lỗi khi chuyển quyền admin và rời nhóm:", error);
        socket.emit("error", {
          message: error.message || "Lỗi khi chuyển quyền admin và rời nhóm",
        });
      }
    }
  );

  /**
   * Xử lý sự kiện chuyển quyền sở hữu nhóm
   * Socket event để chuyển quyền sở hữu từ người tạo nhóm hiện tại sang thành viên khác
   */
  socket.on(
    "transferOwnership",
    async ({ groupId, currentOwnerId, newOwnerId }) => {
      try {
        // Kiểm tra các tham số đầu vào
        if (!groupId || !currentOwnerId || !newOwnerId) {
          socket.emit("error", {
            message: "Thiếu thông tin cần thiết để thực hiện",
          });
          return;
        }

        // Thực hiện chuyển quyền sở hữu
        const updatedGroup = await GroupService.transferGroupOwnership(
          groupId,
          currentOwnerId,
          newOwnerId
        );

        // Thông báo cho tất cả thành viên về việc thay đổi quyền sở hữu
        const memberIds = updatedGroup.members.map((member) =>
          member.user._id ? member.user._id.toString() : member.user.toString()
        );

        // Gửi sự kiện tới tất cả thành viên trong nhóm
        memberIds.forEach((id) => {
          if (onlineUsers.has(id)) {
            io.to(onlineUsers.get(id)).emit("ownershipTransferred", {
              groupId,
              previousOwnerId: currentOwnerId,
              newOwnerId,
              group: updatedGroup,
            });
          }
        });

        // Gửi phản hồi thành công về cho người thực hiện
        socket.emit("ownershipTransferSuccess", {
          success: true,
          groupId,
          newOwnerId,
        });
      } catch (error) {
        console.error("Lỗi khi chuyển quyền sở hữu nhóm:", error);
        socket.emit("error", {
          message: error.message || "Lỗi khi chuyển quyền sở hữu nhóm",
        });
      }
    }
  );

  /**
   * Xử lý sự kiện chuyển quyền sở hữu và rời nhóm
   * Kết hợp cả hai hành động: chuyển quyền sở hữu và rời nhóm
   */
  socket.on(
    "transferOwnershipAndLeave",
    async ({ groupId, currentOwnerId, newOwnerId }) => {
      try {
        // Kiểm tra các tham số đầu vào
        if (!groupId || !currentOwnerId || !newOwnerId) {
          socket.emit("error", {
            message: "Thiếu thông tin cần thiết để thực hiện",
          });
          return;
        }

        // Bước 1: Chuyển quyền sở hữu
        const updatedGroupAfterTransfer =
          await GroupService.transferGroupOwnership(
            groupId,
            currentOwnerId,
            newOwnerId
          );

        // Thông báo cho tất cả thành viên về việc thay đổi quyền sở hữu
        const memberIds = updatedGroupAfterTransfer.members.map((member) =>
          member.user._id ? member.user._id.toString() : member.user.toString()
        );

        memberIds.forEach((id) => {
          if (onlineUsers.has(id)) {
            io.to(onlineUsers.get(id)).emit("ownershipTransferred", {
              groupId,
              previousOwnerId: currentOwnerId,
              newOwnerId,
              group: updatedGroupAfterTransfer,
            });
          }
        });

        // Bước 2: Người dùng rời nhóm
        const updatedGroupAfterLeave = await GroupService.removeMemberFromGroup(
          groupId,
          currentOwnerId,
          currentOwnerId
        );

        // Thông báo cho tất cả thành viên còn lại về việc người dùng rời nhóm
        const remainingMemberIds = updatedGroupAfterLeave.members.map(
          (member) =>
            member.user._id
              ? member.user._id.toString()
              : member.user.toString()
        );

        remainingMemberIds.forEach((id) => {
          if (onlineUsers.has(id)) {
            io.to(onlineUsers.get(id)).emit("memberRemovedFromGroup", {
              groupId,
              removedMember: currentOwnerId,
              removedBy: currentOwnerId,
              group: updatedGroupAfterLeave,
              wasOwner: true,
              newOwnerId,
            });
          }
        });

        // Thông báo cho người rời nhóm
        if (onlineUsers.has(currentOwnerId)) {
          io.to(onlineUsers.get(currentOwnerId)).emit("removedFromGroup", {
            groupId,
            conversationId: updatedGroupAfterLeave.conversation_id,
            byOwnerTransfer: true,
          });
        }

        // Gửi kết quả thành công về cho client đã thực hiện hành động
        socket.emit("transferOwnershipAndLeaveSuccess", {
          success: true,
          groupId,
          newOwnerId,
        });
      } catch (error) {
        console.error("Lỗi khi chuyển quyền sở hữu và rời nhóm:", error);
        socket.emit("error", {
          message: error.message || "Lỗi khi chuyển quyền sở hữu và rời nhóm",
        });
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
