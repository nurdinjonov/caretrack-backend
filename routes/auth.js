import express from "express";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import pool from "../db.js";
import { authenticate, authorize } from "../middleware/authMiddleware.js";

const router = express.Router();

// 1. Yangi xodim qo'shish (FAQAT ADMINISTRATOR UCHUN)
router.post(
  "/register",
  authenticate,
  authorize(["Admin"]),
  async (req, res) => {
    try {
      const { username, password, role } = req.body;
      if (!username || !password || !role) {
        return res
          .status(400)
          .json({ msg: "Login, parol va rol kiritish shart" });
      }

      const normalizedUsername = username.trim().toLowerCase();

      const salt = await bcrypt.genSalt(10);
      const password_hash = await bcrypt.hash(password, salt);

      const newUser = await pool.query(
        "INSERT INTO users (username, password_hash, role) VALUES ($1, $2, $3) RETURNING id, username, role",
        [normalizedUsername, password_hash, role],
      );

      res.status(201).json(newUser.rows[0]);
    } catch (err) {
      console.error(err.message);
      res.status(500).send("Server xatosi yoki bunday login avval olingan");
    }
  },
);

// 2. Tizimga kirish (Login - hamma uchun ochiq)
router.post("/login", async (req, res) => {
  try {
    const { username, password } = req.body;
    if (!username || !password) {
      return res.status(400).json({ msg: "Login va parol kiritish shart" });
    }

    const normalizedUsername = username.trim().toLowerCase();

    const user = await pool.query(
      "SELECT * FROM users WHERE LOWER(username) = $1",
      [normalizedUsername],
    );
    if (user.rows.length === 0) {
      return res.status(401).json({ msg: "Foydalanuvchi topilmadi" });
    }

    const validPassword = await bcrypt.compare(
      password,
      user.rows[0].password_hash,
    );
    if (!validPassword) {
      return res.status(401).json({ msg: "Noto'g'ri parol" });
    }

    const token = jwt.sign(
      { id: user.rows[0].id, role: user.rows[0].role },
      process.env.JWT_SECRET,
      { expiresIn: "10h" },
    );

    res.json({
      token,
      role: user.rows[0].role,
      username: user.rows[0].username,
    });
  } catch (err) {
    console.error(err.message);
    res.status(500).send("Server xatosi");
  }
});

export default router;
