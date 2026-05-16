import bcrypt from "bcrypt";
import pool from "./db.js";

async function createSuperAdmin() {
  try {
    const username = "admin";
    const password = "admin123"; // Shu parolni eslab qoling
    const role = "Admin";

    // Parolni shifrlaymiz
    const salt = await bcrypt.genSalt(10);
    const password_hash = await bcrypt.hash(password, salt);

    // Bazaga yozamiz
    await pool.query(
      "INSERT INTO users (username, password_hash, role) VALUES ($1, $2, $3)",
      [username, password_hash, role],
    );

    console.log(
      "🔥 Super Admin muvaffaqiyatli yaratildi! Login: admin, Parol: admin123",
    );
    process.exit(0);
  } catch (err) {
    console.error("Xatolik:", err.message);
    process.exit(1);
  }
}

createSuperAdmin();
