import "dotenv/config";
import bcrypt from "bcryptjs";
import { PrismaClient } from "@prisma/client";
const db = new PrismaClient();
try {
  const username = process.env.BOOTSTRAP_USERNAME,
    password = process.env.BOOTSTRAP_PASSWORD;
  if (!username || !password || password.length < 16)
    throw new Error(
      "Set BOOTSTRAP_USERNAME and a unique BOOTSTRAP_PASSWORD of at least 16 characters.",
    );
  if (await db.user.count({ where: { role: "admin", active: true } }))
    throw new Error("An active admin already exists; bootstrap refused.");
  await db.user.create({
    data: {
      username,
      name: process.env.BOOTSTRAP_NAME || username,
      role: "admin",
      password: await bcrypt.hash(password, 12),
    },
  });
  console.log(
    "Administrator provisioned. Remove BOOTSTRAP_PASSWORD from the environment.",
  );
} finally {
  await db.$disconnect();
}
