const express = require("express");
const dotenv = require("dotenv");
const connectDB = require("./config/db");
const authRoutes = require("../src/routes/authRoutes");
const bodyParser = require("body-parser");
const authMiddleware = require("../src/middlewares/authMiddleware");
const userRoutes = require("../src/routes/UserRoutes");
const cookieParser = require("cookie-parser");
const messageRoutes = require("../src/routes/MessageRoutes");
const conversationRoutes = require("./routes/ConversationRoutes");
const friendRequestRoutes = require("./routes/FriendRequestRoutes");
const groupRoutes = require("./routes/GroupRoutes");
const cors = require("cors");
const http = require("http");
const { initializeSocket } = require("./socket/socket"); // Import socket.js

dotenv.config();
connectDB();

const app = express();
const server = http.createServer(app); // Tạo HTTP server

initializeSocket(server); // Khởi tạo Socket.IO

app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(cookieParser());
app.use(
  cors({
    origin: process.env.CLIENT_URL || "*",
    credentials: true, // Cho phép cookie được gửi từ client
  })
);

app.use((req, res, next) => {
  res.header(
    "Access-Control-Allow-Headers",
    "Origin, X-Requested-With, Content-Type, Accept"
  );
  res.header("Access-Control-Allow-Credentials", "true");
  next();
});

const openRoutes = [
  "/api/auth/register",
  "/api/auth/login",
  "/api/auth/verify-otp",
  "/api/auth/resend-otp",
  "/api/auth/forgot-password",
  "/api/auth/reset-password",
  "/api/auth/check-auth",
];
app.use((req, res, next) => {
  if (openRoutes.includes(req.path)) {
    return next();
  }
  authMiddleware(req, res, next);
});

app.use("/api/conversation", conversationRoutes);
app.use("/api/auth", authRoutes);
app.use("/api/user", userRoutes);
app.use("/api/message", messageRoutes);
app.use("/api/friend-request", friendRequestRoutes);
app.use("/api/group", groupRoutes);

server.listen(process.env.PORT, () => {
  console.log(`Server running on port ${process.env.PORT}`);
});
