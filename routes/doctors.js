import express from "express";
import pool from "../db.js";
import bcrypt from "bcrypt"; // Parolni shifrlash uchun import qilamiz
import { authenticate, authorize } from "../middleware/authMiddleware.js";

const router = express.Router();

// 1. BARCHA shifokorlarni olish
router.get("/", authenticate, async (req, res) => {
  try {
    const result = await pool.query("SELECT * FROM doctors ORDER BY id ASC");
    res.json(result.rows);
  } catch (err) {
    console.error(err.message);
    res.status(500).send("Server xatosi");
  }
});

// 2. YANGI shifokor va uning login akkauntini BIR VAQTDA yaratish (Unified Flow)
router.post("/", authenticate, authorize(["Admin"]), async (req, res) => {
  try {
    const { name, specialty, department, contact_info, username, password } =
      req.body;

    // Login va parol kiritilganini tekshiramiz
    if (!username || !password) {
      return res
        .status(400)
        .json({ msg: "Shifokor uchun login va parol kiritish shart!" });
    }

    // 1. Avval parolni shifrlaymiz
    const salt = await bcrypt.genSalt(10);
    const password_hash = await bcrypt.hash(password, salt);

    try {
      // 2. Users jadvaliga yangi 'Clinician' foydalanuvchisini qo'shamiz
      const userResult = await pool.query(
        "INSERT INTO users (username, password_hash, role) VALUES ($1, $2, $3) RETURNING id",
        [username, password_hash, "Clinician"],
      );
      const user_id = userResult.rows[0].id;

      // 3. Yaratilgan user_id ni olib, shifokor profiliga avtomatik bog'lab yaratamiz
      const newDoctor = await pool.query(
        "INSERT INTO doctors (name, specialty, department, contact_info, user_id) VALUES ($1, $2, $3, $4, $5) RETURNING *",
        [name, specialty, department, contact_info, user_id],
      );

      res.json(newDoctor.rows[0]);
    } catch (dbErr) {
      // UNIQUE constraint (Foydalanuvchi nomi takrorlanganda) xatosini ushlaymiz
      if (dbErr.code === "23505") {
        return res
          .status(400)
          .json({
            msg: "Bu foydalanuvchi nomi (login) allaqachon band! Boshqa login yozing.",
          });
      }
      throw dbErr;
    }
  } catch (err) {
    console.error(err.message);
    res.status(500).send("Server xatosi");
  }
});

// 3. Shifokor ma'lumotlarini YANGILASH (Faqat Admin)
router.put("/:id", authenticate, authorize(["Admin"]), async (req, res) => {
  try {
    const { id } = req.params;
    const { name, specialty, department, contact_info } = req.body;

    const updateDoctor = await pool.query(
      "UPDATE doctors SET name = $1, specialty = $2, department = $3, contact_info = $4 WHERE id = $5 RETURNING *",
      [name, specialty, department, contact_info, id],
    );

    if (updateDoctor.rows.length === 0)
      return res.status(404).json({ msg: "Shifokor topilmadi" });
    res.json(updateDoctor.rows[0]);
  } catch (err) {
    console.error(err.message);
    res.status(500).send("Server xatosi");
  }
});

// 4. Shifokorni O'CHIRISH (Faqat Admin)
router.delete("/:id", authenticate, authorize(["Admin"]), async (req, res) => {
  try {
    const { id } = req.params;
    const deleteDoctor = await pool.query(
      "DELETE FROM doctors WHERE id = $1 RETURNING *",
      [id],
    );
    if (deleteDoctor.rows.length === 0)
      return res.status(404).json({ msg: "Shifokor topilmadi" });
    res.json({ msg: "Shifokor tizimdan o'chirildi" });
  } catch (err) {
    console.error(err.message);
    res.status(500).send("Server xatosi");
  }
});

export default router;
