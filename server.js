import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import pool from "./db.js";

// Marshrutlarni import qilish
import doctorRoutes from "./routes/doctors.js";
import patientRoutes from "./routes/patients.js";
import diagnosisRoutes from "./routes/diagnoses.js";

import authRoutes from "./routes/auth.js";

dotenv.config();

const app = express();
const port = process.env.PORT || 5000;

// Middleware
// Eski app.use(cors()) o'rniga faqat sizning frontendga ruxsat beruvchi kod:
app.use(
  cors({
    origin: "https://caretrack-frontend-delta.vercel.app", // Vercel bergan havola (oxiridagi /login qismini yozish shart emas)
  }),
);
app.use(express.json());

app.use("/api/auth", authRoutes);
// Marshrutlarni ishlatish
app.use("/api/doctors", doctorRoutes);
app.use("/api/patients", patientRoutes);
app.use("/api/diagnoses", diagnosisRoutes);

// Asosiy tekshiruv marshruti
app.get("/", (req, res) => {
  res.send("CareTrack Clinic API muvaffaqiyatli ishlamoqda!");
});

// Serverni ishga tushirish
app.listen(port, () => {
  console.log(`Server http://localhost:${port} da ishga tushdi 🌐`);
});
