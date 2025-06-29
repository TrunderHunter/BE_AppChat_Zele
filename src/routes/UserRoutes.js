const express = require("express");
const router = express.Router();
const UserController = require("../controllers/UserController");
const multer = require("multer");

// Cấu hình multer
const upload = multer({ storage: multer.memoryStorage() });

// http://localhost:5000/api/user/update/:userId
router.put("/update/:userId", upload.none(), UserController.updateUser);

// http://localhost:5000/api/user/updateAvatar/:userId
router.put(
  "/updateAvatar/:userId",
  upload.none(),
  UserController.addOrUpdateAvatar
);

// http://localhost:5000/api/user/upload-avatar/:userId
router.post(
  "/upload-avatar/:userId",
  upload.single("avatar"),
  UserController.uploadAvatar
);

// http://localhost:5000/api/user/getUser
router.get("/getUser", UserController.getUserByIdOrEmail); // Route to get user by ID or email

// http://localhost:5000/api/user/getAllUsers?page=1&limit=10
router.get("/getAllUsers", UserController.getAllUsers); // Route to get all users with pagination

// http://localhost:5000/api/user/searchByNameOrPhone?query=John
router.get("/searchByNameOrPhone", UserController.searchByNameOrPhone); // Route to search users by name or email

// http://localhost:5000/api/user/friends
router.get("/friends", UserController.getUserFriends);

// http://localhost:5000/api/user/friends/:userId
router.get("/friends/:userId", UserController.getUserFriends);

// Kiểm tra email đã tồn tại (GET: /api/user/check-email?email=...)
router.get("/check-email", UserController.checkEmailExists);

// Kiểm tra phone đã tồn tại (GET: /api/user/check-phone?phone=...)
router.get("/check-phone", UserController.checkPhoneExists);


module.exports = router;
