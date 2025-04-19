const UserService = require("../services/UserService");
const sendResponse = require("../utils/response");

exports.updateUser = async (req, res) => {
  try {
    const { userId } = req.params;
    const { name, dob, phone, avatar } = req.body;
    // Kiểm tra các trường bắt buộc (theo schema)
    if (!name || !phone) {
      return sendResponse(res, 400, "Name and phone are required", "error");
    }
    // Chuẩn bị dữ liệu cập nhật
    const updateData = { name, phone };
    if (dob) {
      updateData.dob = dob;
    }
    if (avatar) {
      updateData.avatar = avatar;
    }

    const updatedUser = await UserService.updateUserById(userId, updateData);

    if (!updatedUser) {
      return sendResponse(res, 404, "User not found", "error");
    }

    sendResponse(res, 200, "User updated successfully", "success", updatedUser);
  } catch (error) {
    sendResponse(res, 500, "Error updating user", "error", {
      error: error.message,
    });
  }
};

exports.addOrUpdateAvatar = async (req, res) => {
  try {
    const { userId } = req.params;
    const { imageUrl } = req.body;

    if (!imageUrl) {
      return sendResponse(res, 400, "Image URL is required", "error");
    }

    const updatedUser = await UserService.addOrUpdateAvatar(userId, imageUrl);

    sendResponse(
      res,
      200,
      "Avatar updated successfully",
      "success",
      updatedUser
    );
  } catch (error) {
    sendResponse(res, 500, "Error updating avatar", "error", {
      error: error.message,
    });
  }
};

exports.getUserByIdOrEmail = async (req, res) => {
  try {
    const { userId, email } = req.query;

    if (!userId && !email) {
      return sendResponse(res, 400, "User ID or email is required", "error");
    }

    const user = await UserService.getUserByIdOrEmail(userId, email);

    if (!user) {
      return sendResponse(res, 404, "User not found", "error");
    }

    sendResponse(res, 200, "User fetched successfully", "success", user);
  } catch (error) {
    sendResponse(res, 500, "Error fetching user", "error", {
      error: error.message,
    });
  }
};

exports.getAllUsers = async (req, res) => {
  try {
    const { page = 1, limit = 10 } = req.query;

    if (page < 1) {
      return sendResponse(
        res,
        400,
        "Page number must be greater than or equal to 1",
        "error"
      );
    }

    const { users, totalPages } = await UserService.getAllUsers({
      page,
      limit,
    });

    if (!users || users.length === 0) {
      return sendResponse(res, 404, "No users found", "error");
    }

    sendResponse(res, 200, "Users fetched successfully", "success", {
      users,
      totalPages,
      currentPage: parseInt(page),
    });
  } catch (error) {
    sendResponse(res, 500, "Error fetching users", "error", {
      error: error.message,
    });
  }
};

exports.searchByNameOrPhone = async (req, res) => {
  try {
    const { query } = req.query;

    if (!query) {
      return sendResponse(res, 400, "Search query is required", "error");
    }

    const users = await UserService.searchUsersByNameOrPhone(query);

    if (!users || users.length === 0) {
      return sendResponse(res, 404, "No users found", "error");
    }

    sendResponse(res, 200, "Users fetched successfully", "success", users);
  } catch (error) {
    sendResponse(res, 500, "Error searching users", "error", {
      error: error.message,
    });
  }
};

exports.getUserFriends = async (req, res) => {
  try {
    const userId = req.params.userId || req.user._id;

    const friends = await UserService.getUserFriends(userId);

    if (!friends || friends.length === 0) {
      return sendResponse(res, 200, "Không có bạn bè nào", "success", []);
    }

    sendResponse(
      res,
      200,
      "Lấy danh sách bạn bè thành công",
      "success",
      friends
    );
  } catch (error) {
    sendResponse(res, 500, "Lỗi khi lấy danh sách bạn bè", "error", {
      error: error.message,
    });
  }
};
