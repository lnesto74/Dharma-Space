import type { PrismaClient, User } from "@prisma/client";
import { randomUUID } from "node:crypto";

export const ROLE_HOME: Record<string, string> = {
  EMPLOYEE: "/app/dashboard",
  HR_ADMIN: "/hr/dashboard",
  TRAINER: "/trainer/dashboard",
  CORPORATE_ADMIN: "/company/dashboard",
  SUPER_ADMIN: "/admin"
};

export const ONBOARDING_ROLES = ["EMPLOYEE", "HR_ADMIN", "CORPORATE_ADMIN", "TRAINER"] as const;

export type UserWithRelations = User & {
  company?: { id: string; name: string } | null;
  department?: { id: string; name: string } | null;
};

export function pendingAccountMessage() {
  return "Your profile was submitted. A Dharma Space administrator will review your access request and notify you when you can sign in.";
}

export function sanitizeUser(user: UserWithRelations) {
  const u = withAuthFields(user);
  const { passwordHash: _pw, ...safe } = u;
  return {
    ...safe,
    homePath: ROLE_HOME[u.role] || "/app/dashboard",
    needsOnboarding: u.onboardingCompleted === false,
    pendingApproval: u.accountStatus === "PENDING" && u.onboardingCompleted === true
  };
}

export function canAccessPlatform(user: User) {
  return (user.accountStatus === "APPROVED" || !user.accountStatus) && user.onboardingCompleted !== false;
}

export const USER_PROFILE_INCLUDE = {
  company: { select: { id: true, name: true } },
  department: { select: { id: true, name: true } }
} as const;

export type CreateUserInput = {
  name: string;
  email: string;
  passwordHash: string;
  role: string;
  accountStatus?: string;
  onboardingCompleted?: boolean;
  position?: string | null;
  companyId?: string | null;
  departmentId?: string | null;
  avatar?: string | null;
};

function isUnknownPrismaFieldError(error: unknown): boolean {
  const msg = error instanceof Error ? error.message : String(error);
  return msg.includes("Unknown argument");
}

/** Create user; falls back to raw SQL when Prisma client is stale but DB columns exist. */
export async function createUser(prisma: PrismaClient, data: CreateUserInput): Promise<UserWithRelations> {
  const accountStatus = data.accountStatus ?? "APPROVED";
  const onboardingCompleted = data.onboardingCompleted ?? true;

  try {
    return await prisma.user.create({
      data: {
        name: data.name,
        email: data.email,
        passwordHash: data.passwordHash,
        role: data.role,
        accountStatus,
        onboardingCompleted,
        position: data.position ?? undefined,
        companyId: data.companyId ?? undefined,
        departmentId: data.departmentId ?? undefined,
        avatar: data.avatar ?? undefined
      },
      include: USER_PROFILE_INCLUDE
    });
  } catch (error) {
    if (!isUnknownPrismaFieldError(error)) throw error;

    const id = randomUUID();
    await prisma.$executeRaw`
      INSERT INTO "User" (
        "id", "name", "email", "passwordHash", "role",
        "accountStatus", "onboardingCompleted", "position",
        "companyId", "departmentId", "avatar",
        "totalWellnessScore", "totalSteps", "createdAt"
      ) VALUES (
        ${id}, ${data.name}, ${data.email}, ${data.passwordHash}, ${data.role},
        ${accountStatus}, ${onboardingCompleted}, ${data.position ?? null},
        ${data.companyId ?? null}, ${data.departmentId ?? null}, ${data.avatar ?? null},
        0, 0, NOW()
      )
    `;

    const user = await prisma.user.findUniqueOrThrow({
      where: { id },
      include: USER_PROFILE_INCLUDE
    });
    return Object.assign(user, { accountStatus, onboardingCompleted, position: data.position ?? null });
  }
}

export function authFieldsFromUser(user: User & Record<string, unknown>) {
  return {
    accountStatus: typeof user.accountStatus === "string" ? user.accountStatus : "APPROVED",
    onboardingCompleted: typeof user.onboardingCompleted === "boolean" ? user.onboardingCompleted : true,
    position: typeof user.position === "string" ? user.position : user.position === null ? null : undefined
  };
}

export function withAuthFields(user: UserWithRelations): UserWithRelations {
  const fields = authFieldsFromUser(user as User & Record<string, unknown>);
  return Object.assign(user, fields);
}
