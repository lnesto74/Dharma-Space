import bcrypt from "bcryptjs";
import type { PrismaClient } from "@prisma/client";

const DEMO_PASSWORD = "password123";

const DEMO_USERS: Array<{
  name: string;
  email: string;
  role: string;
  avatar: string;
}> = [
  { name: "Maya Employee", email: "employee@demo.com", role: "EMPLOYEE", avatar: "ME" },
  { name: "Harper HR", email: "hr@demo.com", role: "HR_ADMIN", avatar: "HH" },
  { name: "Cameron Company", email: "company@demo.com", role: "CORPORATE_ADMIN", avatar: "CC" },
  { name: "Talia Trainer", email: "trainer@demo.com", role: "TRAINER", avatar: "TT" },
  { name: "Sage Admin", email: "admin@demo.com", role: "SUPER_ADMIN", avatar: "SA" }
];

/** Keeps demo logins available in every environment (password: password123). */
export async function ensureDemoUsers(prisma: PrismaClient) {
  const passwordHash = await bcrypt.hash(DEMO_PASSWORD, 12);

  let company = await prisma.company.findFirst({ orderBy: { createdAt: "asc" } });
  if (!company) {
    company = await prisma.company.create({
      data: { name: "Demo Company", industry: "General", plan: "Pilot", seats: 100 }
    });
  }

  let department = await prisma.department.findFirst({ where: { companyId: company.id } });
  if (!department) {
    department = await prisma.department.create({
      data: { name: "People & Culture", companyId: company.id }
    });
  }

  for (const demo of DEMO_USERS) {
    const companyId = demo.role === "SUPER_ADMIN" ? null : company.id;
    const departmentId = demo.role === "SUPER_ADMIN" ? null : department.id;

    await prisma.user.upsert({
      where: { email: demo.email },
      create: {
        name: demo.name,
        email: demo.email,
        passwordHash,
        role: demo.role,
        accountStatus: "APPROVED",
        companyId,
        departmentId,
        avatar: demo.avatar
      },
      update: {
        name: demo.name,
        passwordHash,
        role: demo.role,
        accountStatus: "APPROVED",
        companyId,
        departmentId,
        avatar: demo.avatar
      }
    });
  }

  console.log("[startup] Demo users ready (password: password123) — employee@demo.com, hr@demo.com, company@demo.com, trainer@demo.com, admin@demo.com");
}
