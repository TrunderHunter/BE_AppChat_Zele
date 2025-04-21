const mongoose = require('mongoose');

const callSchema = new mongoose.Schema({
  // Người tạo cuộc gọi
  caller: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  // Danh sách người nhận cuộc gọi
  receivers: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }],
  // Loại cuộc gọi: 'audio' hoặc 'video'
  type: {
    type: String,
    enum: ['audio', 'video'],
    required: true
  },
  // Thời gian bắt đầu cuộc gọi
  startTime: {
    type: Date,
    default: Date.now
  },
  // Thời gian kết thúc cuộc gọi
  endTime: {
    type: Date
  },
  // Thời lượng cuộc gọi tính bằng giây
  duration: {
    type: Number
  },
  // Trạng thái cuộc gọi: 'missed', 'answered', 'rejected'
  status: {
    type: String,
    enum: ['missed', 'answered', 'rejected'],
    default: 'missed'
  },
  // Nhóm cuộc gọi (nếu là cuộc gọi nhóm)
  group: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Group'
  },
  // Đánh dấu cuộc gọi là cá nhân hay nhóm
  isGroupCall: {
    type: Boolean,
    default: false
  }
}, {
  timestamps: true
});

// Phương thức tĩnh để tạo mới cuộc gọi
callSchema.statics.createNewCall = async function(callData) {
  try {
    const call = new this(callData);
    await call.save();
    return call;
  } catch (error) {
    throw error;
  }
};

// Phương thức tĩnh để kết thúc cuộc gọi
callSchema.statics.endCall = async function(callId) {
  try {
    const endTime = new Date();
    const call = await this.findById(callId);
    
    if (!call) {
      throw new Error('Không tìm thấy cuộc gọi');
    }
    
    call.endTime = endTime;
    call.duration = Math.round((endTime - call.startTime) / 1000); // Thời lượng tính bằng giây
    call.status = 'answered'; // Cuộc gọi đã được trả lời
    
    await call.save();
    return call;
  } catch (error) {
    throw error;
  }
};

// Phương thức tĩnh để đánh dấu cuộc gọi bị từ chối
callSchema.statics.rejectCall = async function(callId) {
  try {
    const call = await this.findById(callId);
    
    if (!call) {
      throw new Error('Không tìm thấy cuộc gọi');
    }
    
    call.status = 'rejected';
    call.endTime = new Date();
    
    await call.save();
    return call;
  } catch (error) {
    throw error;
  }
};

// Phương thức tĩnh để lấy lịch sử cuộc gọi của một người dùng
callSchema.statics.getCallHistory = async function(userId, limit = 20, skip = 0) {
  try {
    const calls = await this.find({
      $or: [
        { caller: userId },
        { receivers: userId }
      ]
    })
      .populate('caller', 'name avatar')
      .populate('receivers', 'name avatar')
      .populate('group', 'name avatar')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);
      
    return calls;
  } catch (error) {
    throw error;
  }
};

const Call = mongoose.model('Call', callSchema);

module.exports = Call;