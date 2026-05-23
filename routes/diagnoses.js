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

const canClinicianAccessDiagnosis = async (userId, diagnosisId) => {
  const doctorId = await getClinicianDoctorId(userId);
  if (!doctorId) return { allowed: false, doctorId: null };

  const diagnosisRes = await pool.query(
    `
    SELECT dg.id
    FROM diagnoses dg
    JOIN patients p ON dg.patient_id = p.id
    WHERE dg.id = $1 AND p.doctor_id = $2
  `,
    [diagnosisId, doctorId],
  );

  return { allowed: diagnosisRes.rows.length > 0, doctorId };
};

// 1. TASHXISLARNI OLISH
router.get("/", authenticate, async (req, res) => {
  try {
    // AGAR SHIFOKOR KIRSA:
    if (req.user.role === "Clinician") {
      const doctorId = await getClinicianDoctorId(req.user.id);
      if (!doctorId) return res.json([]);

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

    // ADMIN / boshqa ruxsatli rollar uchun:
    const result = await pool.query(`
      SELECT d.id, d.icd_code, d.description, d.severity, d.patient_id, p.name AS patient_name 
      FROM diagnoses d
      JOIN patients p ON d.patient_id = p.id
      ORDER BY d.id DESC
    `);
    return res.json(result.rows);
  } catch (err) {
    console.error(err.message);
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

      if (req.user.role === "Clinician") {
        const access = await canClinicianAccessPatient(req.user.id, patient_id);
        if (!access.allowed) {
          return res.status(403).json({
            msg: "Sizga bu bemorga tashxis qo'shish uchun ruxsat yo'q",
          });
        }
      }

      const newDiagnosis = await pool.query(
        "INSERT INTO diagnoses (icd_code, description, severity, patient_id) VALUES ($1, $2, $3, $4) RETURNING *",
        [icd_code, description, severity, patient_id],
      );
      res.json(newDiagnosis.rows[0]);
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
      const { icd_code, description, severity, patient_id } = req.body;

      if (req.user.role === "Clinician") {
        const diagnosisAccess = await canClinicianAccessDiagnosis(
          req.user.id,
          id,
        );
        if (!diagnosisAccess.allowed) {
          return res.status(403).json({
            msg: "Sizga bu tashxisni tahrirlash uchun ruxsat yo'q",
          });
        }

        const patientAccess = await canClinicianAccessPatient(
          req.user.id,
          patient_id,
        );
        if (!patientAccess.allowed) {
          return res.status(403).json({
            msg: "Tashxisni boshqa shifokor bemoriga o'tkazish mumkin emas",
          });
        }
      }

      const updateDiagnosis = await pool.query(
        "UPDATE diagnoses SET icd_code = $1, description = $2, severity = $3, patient_id = $4 WHERE id = $5 RETURNING *",
        [icd_code, description, severity, patient_id, id],
      );
      if (updateDiagnosis.rows.length === 0)
        return res.status(404).json({ msg: "Tashxis topilmadi" });
      res.json(updateDiagnosis.rows[0]);
    } catch (err) {
      console.error(err.message);
      res.status(500).send("Server xatosi");
    }
  },
);

router.delete(
  "/:id",
  authenticate,
  authorize(["Admin", "Clinician"]),
  async (req, res) => {
    try {
      const { id } = req.params;

      if (req.user.role === "Clinician") {
        const diagnosisAccess = await canClinicianAccessDiagnosis(
          req.user.id,
          id,
        );
        if (!diagnosisAccess.allowed) {
          return res.status(403).json({
            msg: "Sizga bu tashxisni o'chirish uchun ruxsat yo'q",
          });
        }
      }

      const deleteDiagnosis = await pool.query(
        "DELETE FROM diagnoses WHERE id = $1 RETURNING *",
        [id],
      );
      if (deleteDiagnosis.rows.length === 0)
        return res.status(404).json({ msg: "Tashxis topilmadi" });
      res.json({ msg: "Tashxis o'chirildi" });
    } catch (err) {
      console.error(err.message);
      res.status(500).send("Server xatosi");
    }
  },
);

export default router;
