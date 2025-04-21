const AuthService = require("../services/authService");
const sendResponse = require("../utils/response");

const registerUser = async (req, res) => {
  const { phone, email, name, password } = req.body;
  try {
    const user = await AuthService.registerUser(phone, email, name, password);
    sendResponse(
      res,
      201,
      "Vui lòng xác thực OTP để hoàn tất quá trình đăng ký!",
      "success"
    );
  } catch (error) {
    sendResponse(res, 400, error.message, "error");
  }
};

const loginUser = async (req, res) => {
  const { email, password } = req.body;

  try {
    const { user, accessToken } = await AuthService.loginUser(
      email,
      password,
      res
    );
    sendResponse(res, 200, "Đăng nhập thành công!", "success", {
      user,
      accessToken,
    });
  } catch (error) {
    sendResponse(res, 400, error.message, "error");
  }
};

const verifyOTP = async (req, res) => {
  const { email, otp } = req.body;
  try {
    await AuthService.verifyOTP(email, otp);
    sendResponse(res, 200, "OTP đã được xác thực thành công!", "success");
  } catch (error) {
    sendResponse(res, 400, error.message, "error");
  }
};

const resendOTP = async (req, res) => {
  const { email } = req.body;
  try {
    await AuthService.resendOTP(email);
    sendResponse(res, 200, "OTP đã được gửi lại thành công!", "success");
  } catch (error) {
    sendResponse(res, 400, error.message, "error");
  }
};

const forgotPassword = async (req, res) => {
  const { email } = req.body;
  try {
    await AuthService.forgotPassword(email);
    sendResponse(
      res,
      200,
      "OTP reset password đã được gửi thành công!",
      "success"
    );
  } catch (error) {
    sendResponse(res, 400, error.message, "error");
  }
};

const resetPassword = async (req, res) => {
  const { email, otp, newPassword } = req.body;
  try {
    await AuthService.resetPassword(email, otp, newPassword);
    sendResponse(res, 200, "Mật khẩu đã được đặt lại thành công!", "success");
  } catch (error) {
    sendResponse(res, 400, error.message, "error");
  }
};

const checkAuthentication = async (req, res) => {
  try {
    const token =
      req.cookies?.jwt || req.headers["authorization"]?.split(" ")[1];

    if (!token) {
      return sendResponse(res, 401, "Không tìm thấy token xác thực", "error");
    }

    const authResult = await AuthService.checkAuth(token);

    if (authResult.isAuthenticated) {
      sendResponse(res, 200, "Người dùng đã xác thực", "success", {
        user: authResult.user,
      });
    } else {
      sendResponse(res, 401, authResult.message, "error");
    }
  } catch (error) {
    sendResponse(res, 500, "Lỗi khi kiểm tra xác thực", "error", {
      error: error.message,
    });
  }
};

module.exports = {
  registerUser,
  verifyOTP,
  resendOTP,
  loginUser,
  forgotPassword,
  resetPassword,
  checkAuthentication,
};
