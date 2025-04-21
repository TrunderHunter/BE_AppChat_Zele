/**
 * Xử lý các sự kiện liên quan đến cuộc gọi âm thanh và video
 * @param {Object} io - Instance của Socket.IO server
 * @param {Object} socket - Socket của client kết nối
 * @param {Map} onlineUsers - Map lưu trữ các user đang online
 */
const callHandlers = (io, socket, onlineUsers) => {
  // Xử lý khi có người dùng bắt đầu cuộc gọi
  socket.on('call-user', ({ targetId, callerId, callerName, mediaType, signalData }) => {
    console.log(`Call request from ${callerId} to ${targetId}, type: ${mediaType}`);
    const targetSocketId = onlineUsers.get(targetId);
    
    if (targetSocketId) {
      // Gửi thông báo đến người nhận cuộc gọi
      io.to(targetSocketId).emit('incoming-call', {
        callerId,
        callerName,
        mediaType, // 'audio' hoặc 'video'
        signalData
      });
    } else {
      // Thông báo cho người gọi rằng người nhận không online
      socket.emit('call-response', {
        status: 'failed',
        message: 'User is not online',
        targetId
      });
    }
  });

  // Xử lý khi người nhận chấp nhận cuộc gọi
  socket.on('call-accepted', ({ targetId, callerId, signal }) => {
    const callerSocketId = onlineUsers.get(callerId);
    
    if (callerSocketId) {
      io.to(callerSocketId).emit('call-accepted', {
        targetId,
        signal
      });
    }
  });

  // Xử lý khi người nhận từ chối cuộc gọi
  socket.on('call-rejected', ({ targetId, callerId, reason }) => {
    const callerSocketId = onlineUsers.get(callerId);
    
    if (callerSocketId) {
      io.to(callerSocketId).emit('call-rejected', {
        targetId,
        reason: reason || 'Call was rejected'
      });
    }
  });

  // Xử lý khi kết thúc cuộc gọi
  socket.on('end-call', ({ targetId, callerId }) => {
    const targetSocketId = onlineUsers.get(targetId);
    
    if (targetSocketId) {
      io.to(targetSocketId).emit('call-ended', {
        callerId
      });
    }
  });

  // Xử lý khi người dùng ngắt kết nối hoặc đóng trình duyệt trong khi đang gọi
  socket.on('disconnect-call', ({ participants }) => {
    if (Array.isArray(participants)) {
      participants.forEach(participantId => {
        if (participantId !== socket.userId) {
          const participantSocketId = onlineUsers.get(participantId);
          if (participantSocketId) {
            io.to(participantSocketId).emit('call-disconnected', {
              userId: socket.userId
            });
          }
        }
      });
    }
  });

  // Xử lý ICE candidates cho WebRTC
  socket.on('ice-candidate', ({ targetId, candidate }) => {
    const targetSocketId = onlineUsers.get(targetId);
    
    if (targetSocketId) {
      io.to(targetSocketId).emit('ice-candidate', {
        candidate,
        from: socket.userId
      });
    }
  });

  // Xử lý cuộc gọi nhóm
  socket.on('group-call-start', ({ groupId, callerId, callerName, mediaType }) => {
    // Phát sóng cuộc gọi nhóm đến tất cả thành viên nhóm
    socket.broadcast.to(groupId).emit('group-call-incoming', {
      groupId,
      callerId,
      callerName,
      mediaType
    });
  });

  socket.on('join-group-call', ({ groupId, userId, userName, peerId }) => {
    // Thông báo cho các thành viên khác về thành viên mới tham gia cuộc gọi
    socket.broadcast.to(groupId).emit('user-joined-call', {
      groupId,
      userId,
      userName,
      peerId
    });
  });
};

module.exports = callHandlers;