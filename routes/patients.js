import express from "express";
import pool from "../db.js";
import { authenticate, authorize } from "../middleware/authMiddleware.js";

const router = express.Router();

const getClinicianDoctorId = async (userId) => {
  const docRes = await pool.query("SELECT id FROM doctors WHERE user_id = $1", [
    userId,
  ]);

  return docRes.rows[0]?.id || null;
};

const canClinicianAccessPatient = async (userId, patientId) => {
  const doctorId = await getClinicianDoctorId(userId);
  if (!doctorId) return { allowed: false, doctorId: null };

  const patientRes = await pool.query(
    "SELECT id FROM patients WHERE id = $1 AND doctor_id = $2",
    [patientId, doctorId],
  );

  return { allowed: patientRes.rows.length > 0, doctorId };
};

// 1. BEMORLARNI OLISH
router.get("/", authenticate, async (req, res) => {
  try {
    // AGAR SHIFOKOR (CLINICIAN) KIRGAN BO'LSA:
    if (req.user.role === "Clinician") {
      const doctorId = await getClinicianDoctorId(req.user.id);

      // Agar unga profil biriktirilmagan bo'lsa, bo'sh ro'yxat qaytadi
      if (!doctorId) return res.json([]);

      // Faqat o'ziga biriktirilgan bemorlarni olib kelamiz
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
    const result = await pool.query(`
      SELECT p.id, p.name, p.personal_details, p.doctor_id, d.name AS doctor_name 
      FROM patients p
      LEFT JOIN doctors d ON p.doctor_id = d.id
      ORDER BY p.id DESC
    `);
    return res.json(result.rows);
  } catch (err) {
    console.error(err.message);
    res.status(500).send("Server xatosi");
  }
});

router.get("/:id", authenticate, async (req, res) => {
  try {
    const { id } = req.params;

    if (req.user.role === "Clinician") {
      const access = await canClinicianAccessPatient(req.user.id, id);
      if (!access.allowed) {
        return res
          .status(403)
          .json({ msg: "Sizga bu bemorni ko'rish uchun ruxsat yo'q" });
      }
    }

    const result = await pool.query("SELECT * FROM patients WHERE id = $1", [
      id,
    ]);
    if (result.rows.length === 0)
      return res.status(404).json({ msg: "Bemor topilmadi" });
    res.json(result.rows[0]);
  } catch (err) {
    console.error(err.message);
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
      console.error(err.message);
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

      if (req.user.role === "Clinician") {
        const access = await canClinicianAccessPatient(req.user.id, id);
        if (!access.allowed) {
          return res
            .status(403)
            .json({ msg: "Sizga bu bemorni tahrirlash uchun ruxsat yo'q" });
        }

        // Clinician bemorni boshqa shifokorga o'tkazib yubora olmaydi
        if (Number(doctor_id) !== Number(access.doctorId)) {
          return res.status(403).json({
            msg: "Shifokor bemorni boshqa shifokorga biriktira olmaydi",
          });
        }
      }

      const updatePatient = await pool.query(
        "UPDATE patients SET name = $1, personal_details = $2, doctor_id = $3 WHERE id = $4 RETURNING *",
        [name, personal_details, doctor_id, id],
      );
      if (updatePatient.rows.length === 0)
        return res.status(404).json({ msg: "Bemor topilmadi" });
      res.json(updatePatient.rows[0]);
    } catch (err) {
      console.error(err.message);
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
    console.error(err.message);
    res.status(500).send("Server xatosi");
  }
});

export default router;
