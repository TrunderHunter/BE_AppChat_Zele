const mongoose = require("mongoose");

const UserSchema = new mongoose.Schema({
  phone: {
    type: String,
    unique: [true, "Số điện thoại đã được đăng ký!"],
    validate: {
      validator: function (v) {
        return /^\d{10}$/.test(v); // Kiểm tra phone có đúng 10 chữ số
      },
      message: (props) =>
        `Số điện thoại không hợp lệ! Số điện thoại phải đúng 10 chữ số!`,
    },
    required: [true, "Vui lòng nhập số điện thoại"],
  },
  email: {
    type: String,
    unique: [true, "Email đã được đăng ký!"],
    match: [/.+\@.+\..+/, "Vui lòng nhập email hợp lệ"], // Kiểm tra định dạng email
    required: [true, "Vui lòng nhập email"],
  },
  name: { type: String, required: [true, "Vui lòng nhập tên"] },
  dob: Date,
  password_hash: {
    type: String,
    required: [true, "Vui lòng nhập mật khẩu"],
  },
  registration_otp: String,
  registration_otp_expiry: Date,
  password_reset_otp: String,
  password_reset_otp_expiry: Date,
  otp_verified: { type: Boolean, default: false },
  created_at: { type: Date, default: Date.now },
  avatar_images: {
    type: [String], // Array of image URLs
    default: [], // Default is an empty array
  },
  primary_avatar: {
    type: String, // URL of the primary avatar
    default: null, // Default is null if no primary avatar is set
  },
  friends: [
    {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
  ],
});

module.exports = mongoose.model("User", UserSchema);
