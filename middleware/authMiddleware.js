import jwt from "jsonwebtoken";

// 1. Tokenni tekshirish (Tizimga kirganmi yoki yo'qmi?)
export const authenticate = (req, res, next) => {
  const authHeader = req.header("Authorization");
  if (!authHeader)
    return res
      .status(401)
      .json({ msg: "Tizimga kirish taqiqlangan. Token yo'q!" });

  const token = authHeader.split(" ")[1]; // "Bearer TOKEN" dan ajratib olamiz

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded; // Foydalanuvchi ma'lumotlarini req ichiga saqlaymiz
    next();
  } catch (err) {
    res.status(401).json({ msg: "Yaroqsiz yoki eskirgan token" });
  }
};

// 2. Rollarni tekshirish (Masalan: Faqat Admin kira oladimi?)
export const authorize = (roles = []) => {
  return (req, res, next) => {
    if (!roles.includes(req.user.role)) {
      return res
        .status(403)
        .json({ msg: "Sizda bu amalni bajarish uchun ruxsat yo'q" });
    }
    next();
  };
};
