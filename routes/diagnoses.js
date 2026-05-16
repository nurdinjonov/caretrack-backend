import express from "express";
import pool from "../db.js";
import { authenticate, authorize } from "../middleware/authMiddleware.js";

const router = express.Router();

// 1. TASHXISLARNI OLISH (Xavfsizlik logikasi qo'shildi)
router.get("/", authenticate, async (req, res) => {
  try {
    // AGAR SHIFOKOR KIRSA:
    if (req.user.role === "Clinician") {
      const docRes = await pool.query(
        "SELECT id FROM doctors WHERE user_id = $1",
        [req.user.id],
      );
      if (docRes.rows.length === 0) return res.json([]);
      const doctorId = docRes.rows[0].id;

      // Faqat o'zining bemorlariga qo'yilgan tashxislarni oladi
      const result = await pool.query(
        `
        SELECT d.id, d.icd_code, d.description, d.severity, d.patient_id, p.name AS patient_name 
        FROM diagnoses d
        JOIN patients p ON d.patient_id = p.id
        WHERE p.doctor_id = $1
        ORDER BY d.id DESC
      `,
        [doctorId],
      );
      return res.json(result.rows);
    }
    // ADMIN UCHUN:
    else {
      const result = await pool.query(`
        SELECT d.id, d.icd_code, d.description, d.severity, d.patient_id, p.name AS patient_name 
        FROM diagnoses d
        JOIN patients p ON d.patient_id = p.id
        ORDER BY d.id DESC
      `);
      return res.json(result.rows);
    }
  } catch (err) {
    res.status(500).send("Server xatosi");
  }
});

router.post(
  "/",
  authenticate,
  authorize(["Admin", "Clinician"]),
  async (req, res) => {
    try {
      const { icd_code, description, severity, patient_id } = req.body;
      const newDiagnosis = await pool.query(
        "INSERT INTO diagnoses (icd_code, description, severity, patient_id) VALUES ($1, $2, $3, $4) RETURNING *",
        [icd_code, description, severity, patient_id],
      );
      res.json(newDiagnosis.rows[0]);
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
      const { icd_code, description, severity, patient_id } = req.body;
      const updateDiagnosis = await pool.query(
        "UPDATE diagnoses SET icd_code = $1, description = $2, severity = $3, patient_id = $4 WHERE id = $5 RETURNING *",
        [icd_code, description, severity, patient_id, id],
      );
      if (updateDiagnosis.rows.length === 0)
        return res.status(404).json({ msg: "Tashxis topilmadi" });
      res.json(updateDiagnosis.rows[0]);
    } catch (err) {
      res.status(500).send("Server xatosi");
    }
  },
);

router.delete("/:id", authenticate, authorize(["Admin"]), async (req, res) => {
  try {
    const { id } = req.params;
    const deleteDiagnosis = await pool.query(
      "DELETE FROM diagnoses WHERE id = $1 RETURNING *",
      [id],
    );
    if (deleteDiagnosis.rows.length === 0)
      return res.status(404).json({ msg: "Tashxis topilmadi" });
    res.json({ msg: "Tashxis o'chirildi" });
  } catch (err) {
    res.status(500).send("Server xatosi");
  }
});

export default router;
