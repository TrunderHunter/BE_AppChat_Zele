const express = require("express");
const router = express.Router();
const GroupController = require("../controllers/GroupController");
const authMiddleware = require("../middlewares/authMiddleware");
const multer = require("multer");
const upload = multer({ storage: multer.memoryStorage() });

// Tất cả routes đều yêu cầu xác thực
router.use(authMiddleware);

// Tạo nhóm chat mới (hỗ trợ upload file avatar)
// POST /api/group/create
router.post("/create", upload.single("avatar"), GroupController.createGroup);

// Thêm thành viên vào nhóm
// POST /api/group/member/add
router.post("/member/add", GroupController.addMemberToGroup);

// Xóa thành viên khỏi nhóm
// POST /api/group/member/remove
router.post("/member/remove", GroupController.removeMemberFromGroup);

// Thay đổi vai trò thành viên
// PUT /api/group/member/role
router.put("/member/role", GroupController.changeRoleMember);

// Cập nhật thông tin nhóm (hỗ trợ upload file avatar)
// PUT /api/group/:groupId
router.put("/:groupId", upload.single("avatar"), GroupController.updateGroup);

// Lấy thông tin chi tiết nhóm
// GET /api/group/:groupId
router.get("/:groupId", GroupController.getGroupById);

// Lấy tất cả các nhóm của người dùng đang đăng nhập
// GET /api/group
router.get("/", GroupController.getGroupsByUserId);

module.exports = router;
