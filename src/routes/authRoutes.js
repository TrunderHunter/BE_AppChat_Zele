const express = require("express");
const router = express.Router();
const {
  registerUser,
  verifyOTP,
  resendOTP,
  loginUser,
  forgotPassword,
  resetPassword,
  checkAuthentication,
  logoutUser,
} = require("../controllers/authController");

// Đăng ký người dùng
router.post("/register", registerUser);

// Đăng nhập người dùng
router.post("/login", loginUser);

// Xác thực OTP
router.post("/verify-otp", verifyOTP);

// Gửi lại OTP
router.post("/resend-otp", resendOTP);

// Quên mật khẩu
router.post("/forgot-password", forgotPassword);

// Đặt lại mật khẩu
router.post("/reset-password", resetPassword);

// Kiểm tra xác thực người dùng hiện tại
router.get("/check-auth", checkAuthentication);

// Đăng xuất
router.post("/logout", logoutUser);

module.exports = router;
