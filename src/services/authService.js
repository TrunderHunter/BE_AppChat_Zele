const UserRepository = require("../repositories/userRepository");
const generateOTP = require("../utils/generateOTP");
const bcrypt = require("bcryptjs");
const transporter = require("../config/email");
const handleValidationError = require("../utils/errorHandler");
const { generateToken, verifyToken } = require("../utils/jwt");
const crypto = require("crypto");
const sanitizeUser = require("../utils/sanitizeUser");

class AuthService {
  static async registerUser(phone, email, name, password) {
    // Tạo OTP đăng ký
    const otp = generateOTP();
    const otpExpiry = new Date(Date.now() + 1 * 60 * 1000); // OTP hết hạn sau 1 phút
    const otpSentAt = new Date(); // Lưu thời điểm gửi OTP

    // Mật khẩu không được để trống, phải có ít nhất 6 ký tự và chứa ít nhất 1 ký tự đặc biệt
    if (!password || password.length < 6) {
      throw new Error(
        "Mật khẩu phải có ít nhất 6 ký tự và chứa ít nhất 1 ký tự đặc biệt!"
      );
    }

    // Mã hóa mật khẩu
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    const newUser = {
      phone,
      email,
      name,
      password_hash: hashedPassword,
      registration_otp: otp,
      registration_otp_expiry: otpExpiry,
    };

    try {
      // Lưu người dùng mới
      const savedUser = await UserRepository.saveUser(newUser);

      // Gửi OTP qua email
      const mailOptions = {
        from: process.env.EMAIL_USER,
        to: email,
        subject: "Xác thực tài khoản",
        text: `Mã OTP của bạn là: ${otp}`,
      };

      await transporter.sendMail(mailOptions);

      return savedUser;
    } catch (error) {
      throw new Error(handleValidationError(error));
    }
  }

  static async loginUser(email, password, res) {
    const user = await UserRepository.findUserByEmail(email);
    if (!user) {
      throw new Error("Người dùng không tồn tại!");
    }

    if (!user.otp_verified) {
      throw new Error("Tài khoản chưa được xác thực!");
    }

    const isMatch = await bcrypt.compare(password, user.password_hash);
    if (!isMatch) {
      throw new Error("Mật khẩu không chính xác!");
    }

    const accessToken = generateToken(user, res); // Sử dụng res.cookie trong generateToken

    const sanitizedUser = sanitizeUser(user);
    return { user: sanitizedUser, accessToken };
  }

  static async resendOTP(email) {
    const user = await UserRepository.findUserByEmail(email);
    if (!user) {
      throw new Error("Người dùng không tồn tại!");
    }

    if (user.otp_verified) {
      throw new Error("Tài khoản đã được xác thực trước đó!");
    }

    // Tạo OTP mới
    const otp = generateOTP();
    const otpExpiry = new Date(Date.now() + 1 * 60 * 1000); // OTP hết hạn sau 1 phút

    // Cập nhật OTP và thời điểm gửi OTP
    await UserRepository.updateUser(user._id, {
      registration_otp: otp,
      registration_otp_expiry: otpExpiry,
    });

    // Gửi OTP qua email
    const mailOptions = {
      from: process.env.EMAIL_USER,
      to: email,
      subject: "Gửi lại mã OTP",
      text: `Mã OTP mới của bạn là: ${otp}`,
    };

    await transporter.sendMail(mailOptions);
  }

  static async verifyOTP(email, otp) {
    const user = await UserRepository.findUserByEmail(email);
    if (!user) {
      throw new Error("Người dùng không tồn tại!");
    }

    if (user.otp_verified) {
      throw new Error("Tài khoản đã được xác thực trước đó!");
    }

    const currentTime = new Date();
    if (currentTime > user.registration_otp_expiry) {
      throw new Error("Mã OTP đăng ký đã hết hạn!");
    }

    if (user.registration_otp !== otp) {
      throw new Error("Mã OTP đăng ký không chính xác!");
    }

    // Cập nhật trạng thái OTP đã xác thực
    await UserRepository.updateUser(user._id, {
      otp_verified: true,
      registration_otp: null,
      registration_otp_expiry: null,
    });

    // Thông báo tới người dùng
    const mailOptions = {
      from: process.env.EMAIL_USER,
      to: email,
      subject: "Xác thực tài khoản thành công",
      text: "Tài khoản của bạn đã được xác thực thành công!",
    };

    await transporter.sendMail(mailOptions);

    return;
  }

  static async forgotPassword(email) {
    const user = await UserRepository.findUserByEmail(email);
    if (!user) {
      throw new Error("Người dùng không tồn tại!");
    }

    // Tạo OTP quên mật khẩu
    const otp = generateOTP();
    const otpExpiry = new Date(Date.now() + 5 * 60 * 1000); // OTP hết hạn sau 5 phút

    // Cập nhật OTP và thời điểm hết hạn
    await UserRepository.updateUser(user._id, {
      password_reset_otp: otp,
      password_reset_otp_expiry: otpExpiry,
    });

    // Gửi OTP qua email
    const mailOptions = {
      from: process.env.EMAIL_USER,
      to: email,
      subject: "Đặt lại mật khẩu",
      text: `Mã OTP đặt lại mật khẩu của bạn là: ${otp}`,
    };

    await transporter.sendMail(mailOptions);
  }

  static async resetPassword(email, otp, newPassword) {
    const user = await UserRepository.findUserByEmail(email);
    if (!user) {
      throw new Error("Người dùng không tồn tại!");
    }

    const currentTime = new Date();
    if (currentTime > user.password_reset_otp_expiry) {
      throw new Error("Mã OTP quên mật khẩu đã hết hạn!");
    }

    if (user.password_reset_otp !== otp) {
      throw new Error("Mã OTP quên mật khẩu không chính xác!");
    }

    if (!newPassword || newPassword.length < 6) {
      throw new Error("Mật khẩu mới phải có ít nhất 6 ký tự!");
    }

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(newPassword, salt);

    // Cập nhật mật khẩu và xóa OTP
    await UserRepository.updateUser(user._id, {
      password_hash: hashedPassword,
      password_reset_otp: null,
      password_reset_otp_expiry: null,
    });
  }

  static async checkAuth(token) {
    if (!token) {
      throw new Error("Token không tồn tại!");
    }

    try {
      // Xác thực token
      const decoded = verifyToken(token);

      // Kiểm tra xem người dùng có tồn tại trong hệ thống không
      const userId = decoded.userId;
      const user = await UserRepository.findUserByIdOrEmail(userId);

      if (!user) {
        throw new Error("Người dùng không tồn tại!");
      }

      // Trả về thông tin người dùng đã được xử lý an toàn
      return {
        isAuthenticated: true,
        user: sanitizeUser(user),
      };
    } catch (error) {
      // Xử lý các trường hợp lỗi
      return {
        isAuthenticated: false,
        message: error.message || "Token không hợp lệ!",
      };
    }
  }
}

module.exports = AuthService;
