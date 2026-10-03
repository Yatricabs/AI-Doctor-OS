import { insert } from "../app/api/_lib/database.ts";
import bcrypt from "bcryptjs";
import crypto from "crypto";

async function seedUser() {
  const passwordHash = await bcrypt.hash("password123", 10);
  
  await insert("users", {
    id: crypto.randomUUID(),
    email: "doctor@aiupchar.com",
    name: "Dr. Ananya Arya",
    role: "doctor",
    clinicId: "CLINIC-1",
    passwordHash: passwordHash,
    mfaEnabled: 0,
    isActive: 1,
    createdAt: new Date().toISOString()
  });

  console.log("Seeded doctor@aiupchar.com / password123");
}

seedUser().catch(console.error);
