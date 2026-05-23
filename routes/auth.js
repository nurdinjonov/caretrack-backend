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

// 3. Joriy foydalanuvchi ma'lumotlarini olish
router.get("/me", authenticate, async (req, res) => {
  try {
    const result = await pool.query(
      "SELECT id, username, role FROM users WHERE id = $1",
      [req.user.id],
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ msg: "Foydalanuvchi topilmadi" });
    }

    res.json(result.rows[0]);
  } catch (err) {
    console.error(err.message);
    res.status(500).send("Server xatosi");
  }
});

// 4. Joriy foydalanuvchi loginini yangilash
router.put("/profile", authenticate, async (req, res) => {
  try {
    const { username } = req.body;

    if (!username || !username.trim()) {
      return res.status(400).json({ msg: "Login kiritish shart" });
    }

    const normalizedUsername = username.trim().toLowerCase();

    try {
      const result = await pool.query(
        "UPDATE users SET username = $1 WHERE id = $2 RETURNING id, username, role",
        [normalizedUsername, req.user.id],
      );

      if (result.rows.length === 0) {
        return res.status(404).json({ msg: "Foydalanuvchi topilmadi" });
      }

      res.json(result.rows[0]);
    } catch (dbErr) {
      if (dbErr.code === "23505") {
        return res.status(400).json({ msg: "Bu login allaqachon band" });
      }
      throw dbErr;
    }
  } catch (err) {
    console.error(err.message);
    res.status(500).send("Server xatosi");
  }
});

// 5. Joriy foydalanuvchi parolini haqiqiy yangilash
router.put("/password", authenticate, async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;

    if (!currentPassword || !newPassword) {
      return res
        .status(400)
        .json({ msg: "Amaldagi parol va yangi parol kiritish shart" });
    }

    if (newPassword.length < 6) {
      return res
        .status(400)
        .json({
          msg: "Yangi parol kamida 6 ta belgidan iborat bo'lishi kerak",
        });
    }

    const user = await pool.query("SELECT * FROM users WHERE id = $1", [
      req.user.id,
    ]);

    if (user.rows.length === 0) {
      return res.status(404).json({ msg: "Foydalanuvchi topilmadi" });
    }

    const validPassword = await bcrypt.compare(
      currentPassword,
      user.rows[0].password_hash,
    );

    if (!validPassword) {
      return res.status(400).json({ msg: "Amaldagi parol noto'g'ri" });
    }

    const salt = await bcrypt.genSalt(10);
    const password_hash = await bcrypt.hash(newPassword, salt);

    await pool.query("UPDATE users SET password_hash = $1 WHERE id = $2", [
      password_hash,
      req.user.id,
    ]);

    res.json({ msg: "Parolingiz muvaffaqiyatli yangilandi" });
  } catch (err) {
    console.error(err.message);
    res.status(500).send("Server xatosi");
  }
});

export default router;
