// src/routes/StringeeRoutes.js
const express = require("express");
const jwt = require("jsonwebtoken");
const router = express.Router();

const API_KEY_SID = "SK.0.PYLQnIC1qQDiK5aEw9kTUKz0D5Y7ZtCq";
const API_KEY_SECRET = "SmVlTUx3MFQxM3RkVnBGMmpUenhpRlhNRkR5SFAzT1A=";

router.get("/token", (req, res) => {
  const { userId } = req.query;

  if (!userId) {
    return res.status(400).json({ error: "Missing userId" });
  }

  try {
    const now = Math.floor(Date.now() / 1000);
    const exp = now + 3600; // 1 giờ

    const token = jwt.sign(
      {
        jti: `${API_KEY_SID}-${Date.now()}`,
        iss: API_KEY_SID,
        exp: exp,
        userId: userId,
      },
      API_KEY_SECRET,
      {
        algorithm: "HS256",
        header: {
          typ: "JWT",
          alg: "HS256",
          cty: "stringee-api;v=1",
        },
      }
    );

    res.json({ token });
  } catch (error) {
    console.error("Error generating token:", error);
    res.status(500).json({ error: "Failed to generate token" });
  }
});

module.exports = router;
