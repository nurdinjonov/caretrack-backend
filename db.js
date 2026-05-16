import pkg from "pg";
import dotenv from "dotenv";

dotenv.config();
const { Pool } = pkg;

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false,
  },
});

pool.connect((err, client, release) => {
  if (err) {
    console.error("Ma'lumotlar bazasiga ulanishda xato:", err.stack);
  } else {
    console.log("PostgreSQL bazasiga muvaffaqiyatli ulandi 🚀");
    if (release) release(); // Ulanish band bo'lib qolmasligi uchun uni darhol bo'shatamiz
  }
});

export default pool;
