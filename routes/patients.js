import express from "express";
import pool from "../db.js";
import { authenticate, authorize } from "../middleware/authMiddleware.js";

const router = express.Router();

// 1. BEMORLARNI OLISH (Xavfsizlik logikasi qo'shildi)
router.get("/", authenticate, async (req, res) => {
  try {
    // AGAR SHIFOKOR (CLINICIAN) KIRGAN BO'LSA:
    if (req.user.role === "Clinician") {
      // a) Avval bu login qaysi shifokor profiliga tegishli ekanini topamiz
      const docRes = await pool.query(
        "SELECT id FROM doctors WHERE user_id = $1",
        [req.user.id],
      );

      // Agar unga profil biriktirilmagan bo'lsa, bo'sh ro'yxat qaytadi
      if (docRes.rows.length === 0) return res.json([]);

      const doctorId = docRes.rows[0].id;

      // b) Faqat o'ziga biriktirilgan bemorlarni olib kelamiz
      const result = await pool.query(
        `
        SELECT p.id, p.name, p.personal_details, p.doctor_id, d.name AS doctor_name 
        FROM patients p
        LEFT JOIN doctors d ON p.doctor_id = d.id
        WHERE p.doctor_id = $1
        ORDER BY p.id DESC
      `,
        [doctorId],
      );

      return res.json(result.rows);
    }
    // AGAR ADMIN YOKI QABULXONA KIRSA (Barcha bemorlarni ko'radi):
    else {
      const result = await pool.query(`
        SELECT p.id, p.name, p.personal_details, p.doctor_id, d.name AS doctor_name 
        FROM patients p
        LEFT JOIN doctors d ON p.doctor_id = d.id
        ORDER BY p.id DESC
      `);
      return res.json(result.rows);
    }
  } catch (err) {
    console.error(err.message);
    res.status(500).send("Server xatosi");
  }
});

// QOLGAN BARCHA SO'ROVLAR (POST, PUT, DELETE) O'ZGARISHSIZ QOLADI
router.get("/:id", authenticate, async (req, res) => {
  try {
    const { id } = req.params;
    const result = await pool.query("SELECT * FROM patients WHERE id = $1", [
      id,
    ]);
    if (result.rows.length === 0)
      return res.status(404).json({ msg: "Bemor topilmadi" });
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).send("Server xatosi");
  }
});

router.post(
  "/",
  authenticate,
  authorize(["Admin", "Receptionist"]),
  async (req, res) => {
    try {
      const { name, personal_details, doctor_id } = req.body;
      const newPatient = await pool.query(
        "INSERT INTO patients (name, personal_details, doctor_id) VALUES ($1, $2, $3) RETURNING *",
        [name, personal_details, doctor_id],
      );
      res.json(newPatient.rows[0]);
    } catch (err) {
      res.status(500).send("Server xatosi");
    }
  },
);

router.put(
  "/:id",
  authenticate,
  authorize(["Admin", "Clinician"]),
  async (req, res) => {
    try {
      const { id } = req.params;
      const { name, personal_details, doctor_id } = req.body;
      const updatePatient = await pool.query(
        "UPDATE patients SET name = $1, personal_details = $2, doctor_id = $3 WHERE id = $4 RETURNING *",
        [name, personal_details, doctor_id, id],
      );
      if (updatePatient.rows.length === 0)
        return res.status(404).json({ msg: "Bemor topilmadi" });
      res.json(updatePatient.rows[0]);
    } catch (err) {
      res.status(500).send("Server xatosi");
    }
  },
);

router.delete("/:id", authenticate, authorize(["Admin"]), async (req, res) => {
  try {
    const { id } = req.params;
    const deletePatient = await pool.query(
      "DELETE FROM patients WHERE id = $1 RETURNING *",
      [id],
    );
    if (deletePatient.rows.length === 0)
      return res.status(404).json({ msg: "Bemor topilmadi" });
    res.json({ msg: "Bemor o'chirildi" });
  } catch (err) {
    res.status(500).send("Server xatosi");
  }
});

export default router;
