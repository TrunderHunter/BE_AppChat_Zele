const CallService = require("../../services/CallService");

/**
 * Xử lý các sự kiện liên quan đến cuộc gọi âm thanh và video
 * @param {Object} io - Instance của Socket.IO server
 * @param {Object} socket - Socket của client kết nối
 * @param {Map} onlineUsers - Map lưu trữ các user đang online
 */
const callHandlers = (io, socket, onlineUsers) => {
  // Xử lý khi có người dùng bắt đầu cuộc gọi
  socket.on(
    "call-user",
    async ({ targetId, callerId, callerName, mediaType, signalData }) => {
      console.log(
        `Call request from ${callerId} to ${targetId}, type: ${mediaType}`
      );
      const targetSocketId = onlineUsers.get(targetId);

      try {
        // Lưu thông tin cuộc gọi vào database
        const call = await CallService.createCall(
          callerId,
          [targetId],
          mediaType
        );

        if (targetSocketId) {
          // Gửi thông báo đến người nhận cuộc gọi kèm theo ID cuộc gọi
          io.to(targetSocketId).emit("incoming-call", {
            callerId,
            callerName,
            mediaType, // 'audio' hoặc 'video'
            signalData,
            callId: call._id, // Thêm ID cuộc gọi để client có thể sử dụng
          });
        } else {
          // Đánh dấu cuộc gọi là bị nhỡ nếu người nhận không online
          await CallService.endCall(call._id);

          // Thông báo cho người gọi rằng người nhận không online
          socket.emit("call-response", {
            status: "failed",
            message: "User is not online",
            targetId,
            callId: call._id,
          });
        }
      } catch (error) {
        console.error("Lỗi khi xử lý cuộc gọi:", error);
        socket.emit("call-error", {
          message: "Có lỗi xảy ra khi xử lý cuộc gọi",
        });
      }
    }
  );

  // Xử lý khi người nhận chấp nhận cuộc gọi
  socket.on("call-accepted", async ({ targetId, callerId, signal, callId }) => {
    const callerSocketId = onlineUsers.get(callerId);

    try {
      // Cập nhật trạng thái cuộc gọi trong database là đã được chấp nhận
      if (callId) {
        await CallService.updateCallStatus(callId, "answered");
      }

      if (callerSocketId) {
        io.to(callerSocketId).emit("call-accepted", {
          targetId,
          signal,
          callId,
        });
      }
    } catch (error) {
      console.error("Lỗi khi chấp nhận cuộc gọi:", error);
    }
  });

  // Xử lý khi người nhận từ chối cuộc gọi
  socket.on("call-rejected", async ({ targetId, callerId, reason, callId }) => {
    const callerSocketId = onlineUsers.get(callerId);

    try {
      // Cập nhật trạng thái cuộc gọi trong database là bị từ chối
      if (callId) {
        await CallService.rejectCall(callId);
      }

      if (callerSocketId) {
        io.to(callerSocketId).emit("call-rejected", {
          targetId,
          reason: reason || "Call was rejected",
          callId,
        });
      }
    } catch (error) {
      console.error("Lỗi khi từ chối cuộc gọi:", error);
    }
  });

  // Xử lý khi kết thúc cuộc gọi
  socket.on("end-call", async ({ targetId, callerId, callId }) => {
    const targetSocketId = onlineUsers.get(targetId);

    try {
      // Cập nhật thông tin cuộc gọi trong database khi kết thúc
      if (callId) {
        await CallService.endCall(callId);
      }

      if (targetSocketId) {
        io.to(targetSocketId).emit("call-ended", {
          callerId,
          callId,
        });
      }
    } catch (error) {
      console.error("Lỗi khi kết thúc cuộc gọi:", error);
    }
  });

  // Xử lý khi người dùng ngắt kết nối hoặc đóng trình duyệt trong khi đang gọi
  socket.on("disconnect-call", async ({ participants, callId }) => {
    try {
      // Cập nhật thông tin cuộc gọi trong database
      if (callId) {
        await CallService.endCall(callId);
      }

      if (Array.isArray(participants)) {
        participants.forEach((participantId) => {
          if (participantId !== socket.userId) {
            const participantSocketId = onlineUsers.get(participantId);
            if (participantSocketId) {
              io.to(participantSocketId).emit("call-disconnected", {
                userId: socket.userId,
                callId,
              });
            }
          }
        });
      }
    } catch (error) {
      console.error("Lỗi khi ngắt kết nối cuộc gọi:", error);
    }
  });

  // Xử lý ICE candidates cho WebRTC
  socket.on("ice-candidate", ({ targetId, candidate }) => {
    const targetSocketId = onlineUsers.get(targetId);

    if (targetSocketId) {
      io.to(targetSocketId).emit("ice-candidate", {
        candidate,
        from: socket.userId,
      });
    }
  });

  // Xử lý cuộc gọi nhóm
  socket.on(
    "group-call-start",
    async ({ groupId, callerId, callerName, mediaType }) => {
      try {
        // Lấy danh sách thành viên của nhóm từ database
        const groupMembers =
          await require("../../services/GroupService").getGroupMembers(groupId);
        const memberIds = groupMembers.map((member) => member._id.toString());

        // Lưu thông tin cuộc gọi nhóm vào database
        const call = await CallService.createCall(
          callerId,
          memberIds,
          mediaType,
          groupId
        );

        // Phát sóng cuộc gọi nhóm đến tất cả thành viên online
        memberIds.forEach((memberId) => {
          if (memberId !== callerId) {
            const memberSocketId = onlineUsers.get(memberId);
            if (memberSocketId) {
              io.to(memberSocketId).emit("group-call-incoming", {
                groupId,
                callerId,
                callerName,
                mediaType,
                callId: call._id,
              });
            }
          }
        });
      } catch (error) {
        console.error("Lỗi khi bắt đầu cuộc gọi nhóm:", error);
        socket.emit("call-error", {
          message: "Có lỗi xảy ra khi bắt đầu cuộc gọi nhóm",
        });
      }
    }
  );

  socket.on(
    "join-group-call",
    async ({ groupId, userId, userName, peerId, callId }) => {
      try {
        // Cập nhật thông tin người tham gia cuộc gọi nhóm
        if (callId) {
          await CallService.addCallParticipant(callId, userId);
        }

        // Thông báo cho các thành viên khác về thành viên mới tham gia cuộc gọi
        socket.broadcast.to(groupId).emit("user-joined-call", {
          groupId,
          userId,
          userName,
          peerId,
          callId,
        });
      } catch (error) {
        console.error("Lỗi khi tham gia cuộc gọi nhóm:", error);
      }
    }
  );
};

module.exports = callHandlers;
